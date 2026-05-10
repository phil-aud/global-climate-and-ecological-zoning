/**
 * TerraClimate helpers for Holdridge Life Zone computation.
 *
 * Mirrors the GEE standalone scripts in Visualization/TerraClimate/.
 * All functions accept the ee module already initialized via geeClient.
 *
 * TerraClimate band mapping:
 *   pr   → precipitation (mm/month, scale factor 1)
 *   pet  → reference ET  (mm/month, scale factor 0.1)
 *   tmmn → min temp      (°C, scale factor 0.1)
 *   tmmx → max temp      (°C, scale factor 0.1)
 *   mean temp = (tmmn + tmmx) × 0.05
 *
 * Frost: no frost-days band. hasFrost = 1 if any monthly tmmn×0.1 < 0 in the period.
 * TerraClimate availability: 1958–present.
 */

'use strict';

const ee = require('@google/earthengine');

const TC_COLLECTION = 'IDAHO_EPSCOR/TERRACLIMATE';
const ELEVATION_ASSET = 'USGS/GTOPO30';

const TC_MIN_YEAR = 1958;
const TC_MAX_YEAR = 2024;

// ── CRU TS 4.09 asset paths ──────────────────────────────────────────────────
const CRU_TMP = 'projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp';
const CRU_PRE = 'projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pre';
const CRU_PET = 'projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pet';
const CRU_FRS = 'projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_frs';
const CRU_MIN_YEAR = 1901;
const CRU_MAX_YEAR = 2024;
// Total monthly bands in the CRU asset: Jan 1901 = band 1, Dec 2024 = band 1488
const CRU_TOTAL_BANDS = (CRU_MAX_YEAR - CRU_MIN_YEAR + 1) * 12; // 1488

// ── Climate helpers ──────────────────────────────────────────────────────────

/**
 * 12-image ImageCollection: monthly mean temperature (°C).
 * mean = (tmmn + tmmx) × 0.05
 */
function tcMonthlyMeanTemp(startYear, endYear) {
  const tc = ee.ImageCollection(TC_COLLECTION);
  const filtered = tc
    .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
    .map(img =>
      img.select('tmmn').add(img.select('tmmx'))
        .multiply(0.05)
        .rename('tmp')
        .copyProperties(img, ['system:time_start'])
    );
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push(filtered.filter(ee.Filter.calendarRange(m, m, 'month')).mean().rename('tmp'));
  }
  return ee.ImageCollection(months);
}

/**
 * 12-image ImageCollection: monthly mean precipitation (mm/month).
 */
function tcMonthlyMeanPre(startYear, endYear) {
  const tc = ee.ImageCollection(TC_COLLECTION);
  const filtered = tc
    .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
    .map(img =>
      img.select('pr').rename('pr')
        .copyProperties(img, ['system:time_start'])
    );
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push(filtered.filter(ee.Filter.calendarRange(m, m, 'month')).mean().rename('pr'));
  }
  return ee.ImageCollection(months);
}

/**
 * Single-band image: mean annual total PET (mm/year).
 * = sum of 12 monthly means × 0.1
 */
function tcAnnualMeanPet(startYear, endYear) {
  const tc = ee.ImageCollection(TC_COLLECTION);
  const filtered = tc
    .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
    .map(img =>
      img.select('pet').multiply(0.1).rename('pet')
        .copyProperties(img, ['system:time_start'])
    );
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push(filtered.filter(ee.Filter.calendarRange(m, m, 'month')).mean().rename('pet'));
  }
  return ee.ImageCollection(months).sum();
}

// ── CRU monthly means helper ────────────────────────────────────────────────

/**
 * Compute 12 monthly-mean images from a CRU TS multi-band ee.Image.
 * CRU images store one band per calendar month: Jan 1901 = band 1, Feb 1901 = band 2, …
 * Returns an ee.ImageCollection of 12 images (Jan..Dec), each renamed 'v'.
 * @param {ee.Image} img - CRU multi-band image (tmp, pre, pet, or frs)
 * @param {number} startYear - First year of the period (>= 1901)
 * @param {number} endYear   - Last year of the period (<= 2024)
 */
function cruMonthlyMeans(img, startYear, endYear) {
  // Rename all bands to sequential strings '1'..'CRU_TOTAL_BANDS'
  const allNames  = Array.from({ length: CRU_TOTAL_BANDS }, (_, i) => String(i + 1));
  const renamed   = img.rename(allNames);
  // 1-based index of the January band for startYear
  // Jan 1901 = 1, Jan 1902 = 13, …, Jan Y = (Y - 1901) * 12 + 1
  const startBand = (startYear - 1901) * 12 + 1;
  const nYears    = endYear - startYear + 1;
  const monthly   = [];
  for (let m = 1; m <= 12; m++) {
    const bands = Array.from({ length: nYears }, (_, y) => String(startBand + (m - 1) + y * 12));
    monthly.push(renamed.select(bands).reduce(ee.Reducer.mean()).rename('v'));
  }
  return ee.ImageCollection(monthly);
}

// ── Shared HLZ classification kernel ────────────────────────────────────────

/**
 * Builds the 3-digit HLZ code image from pre-computed climate variables.
 * Called by both computeHLZ (TerraClimate) and computeHLZ_CRU.
 * @param {ee.Image} t0Bio      - Sea-level mean annual biotemperature (°C)
 * @param {ee.Image} hasFrost   - Binary: 1 where frost occurs, 0 elsewhere
 * @param {ee.Image} annualPrecip - Mean annual precipitation (mm/year)
 * @param {ee.Image} annualPet  - Mean annual PET (mm/year)
 * @param {ee.Image} elevation  - Elevation (m)
 */
function _buildHLZImage(t0Bio, hasFrost, annualPrecip, annualPet, elevation) {
  // ── Latitudinal regions (constant-lapse-rate variant: temperature only) ──
  const tropical      = t0Bio.gte(24);
  const subtropical   = t0Bio.gte(18).and(t0Bio.lt(24));
  const warmTemperate = t0Bio.gte(12).and(t0Bio.lt(18));
  const coolTemperate = t0Bio.gte(6).and(t0Bio.lt(12));
  const boreal        = t0Bio.gte(3).and(t0Bio.lt(6));
  const subpolar      = t0Bio.gte(1.5).and(t0Bio.lt(3));
  const polar         = t0Bio.gte(0).and(t0Bio.lt(1.5));

  // ── Altitudinal belts (constant lapse rate: 6 °C/km → k = 1000/6 m per °C) ──
  const el = elevation;
  const k = 1000 / 6;

  const trop_base = t0Bio.subtract(24).multiply(k);
  const subt_base = t0Bio.subtract(18).multiply(k);
  const wt_base   = t0Bio.subtract(12).multiply(k);
  const ct_base   = t0Bio.subtract(6).multiply(k);
  const bor_base  = t0Bio.subtract(3).multiply(k);
  const sp_base   = t0Bio.subtract(1.5).multiply(k);

  // ── TROPICAL ──
  const tropicalBasal        = tropical.multiply(el.lte(trop_base));
  const tropicalPremontane   = tropical.multiply(el.gt(trop_base).and(el.lte(trop_base.add(1000))));
  const tropicalLowerMontane = tropical.multiply(el.gt(trop_base.add(1000)).and(el.lte(trop_base.add(2000))));
  const tropicalMontane      = tropical.multiply(el.gt(trop_base.add(2000)).and(el.lte(trop_base.add(3000))));
  const tropicalSubalpine    = tropical.multiply(el.gt(trop_base.add(3000)).and(el.lte(trop_base.add(3500))));
  const tropicalAlpine       = tropical.multiply(el.gt(trop_base.add(3500)).and(el.lte(trop_base.add(3750))));
  const tropicalNival        = tropical.multiply(el.gt(trop_base.add(3750)));

  // ── SUBTROPICAL ──
  // Basal: 18-24 °C range, below basal threshold, NO frost
  // Above basal: entire 18-24 °C range uses subtropical geometry regardless of frost
  const subtropicalBasal        = subtropical.multiply(el.lte(subt_base).and(hasFrost.not()));
  const subtropicalLowerMontane = subtropical.multiply(el.gt(subt_base).and(el.lte(subt_base.add(1000))));
  const subtropicalMontane      = subtropical.multiply(el.gt(subt_base.add(1000)).and(el.lte(subt_base.add(2000))));
  const subtropicalSubalpine    = subtropical.multiply(el.gt(subt_base.add(2000)).and(el.lte(subt_base.add(2500))));
  const subtropicalAlpine       = subtropical.multiply(el.gt(subt_base.add(2500)).and(el.lte(subt_base.add(2750))));
  const subtropicalNival        = subtropical.multiply(el.gt(subt_base.add(2750)));

  // ── WARM TEMPERATE ──
  // Basal: 12-18 °C basal OR 18-24 °C basal WITH frost
  // Above basal: only 12-18 °C range uses warm temperate geometry
  const warmTemperateBasal     = warmTemperate.multiply(el.lte(wt_base))
                                   .or(subtropical.multiply(el.lte(subt_base).and(hasFrost)));
  const warmTemperateMontane   = warmTemperate.multiply(el.gt(wt_base).and(el.lte(wt_base.add(1000))));
  const warmTemperateSubalpine = warmTemperate.multiply(el.gt(wt_base.add(1000)).and(el.lte(wt_base.add(1500))));
  const warmTemperateAlpine    = warmTemperate.multiply(el.gt(wt_base.add(1500)).and(el.lte(wt_base.add(1750))));
  const warmTemperateNival     = warmTemperate.multiply(el.gt(wt_base.add(1750)));

  // ── COOL TEMPERATE ──
  const coolTemperateBasal     = coolTemperate.multiply(el.lte(ct_base));
  const coolTemperateSubalpine = coolTemperate.multiply(el.gt(ct_base).and(el.lte(ct_base.add(500))));
  const coolTemperateAlpine    = coolTemperate.multiply(el.gt(ct_base.add(500)).and(el.lte(ct_base.add(750))));
  const coolTemperateNival     = coolTemperate.multiply(el.gt(ct_base.add(750)));

  // ── BOREAL ──
  const borealBasal  = boreal.multiply(el.lte(bor_base));
  const borealAlpine = boreal.multiply(el.gt(bor_base).and(el.lte(bor_base.add(500))));
  const borealNival  = boreal.multiply(el.gt(bor_base.add(500)));

  // ── SUBPOLAR ──
  const subpolarBasal = subpolar.multiply(el.lte(sp_base));
  const subpolarNival = subpolar.multiply(el.gt(sp_base));

  // ── POLAR ──
  const polarZone = polar;

  // ── Moisture class (circumcenter-of-hypotenuse) ──
  const map       = annualPrecip;
  const petRatio  = annualPet.divide(map);
  const nMap      = map.divide(62.5).log().divide(ee.Number(2).log()).add(1);
  const nPetRatio = petRatio.divide(0.125).log().divide(ee.Number(2).log()).add(1);

  const ch = petRatioMax => {
    const nMax = ee.Image(petRatioMax).divide(0.125).log().divide(ee.Image(2).log()).add(1).add(1);
    return nMap.add(nMax.subtract(nPetRatio)).divide(2);
  };

  const chT  = ch(32);   // Tropical
  const chSW = ch(16);   // Subtropical / Warm Temperate
  const chC  = ch(8);    // Cool Temperate
  const chB  = ch(4);    // Boreal
  const chSP = ch(2);    // Subpolar

  const tPM = (belt, v) => belt.multiply(chSW.gt(v - 1).multiply(chSW.lte(v)));

  // ── Life zone image ──
  return (
    // Tropical Basal
    tropicalBasal.multiply(chT.gt(8)).multiply(111)
    .add(tropicalBasal.multiply(chT.gt(7).multiply(chT.lte(8))).multiply(112))
    .add(tropicalBasal.multiply(chT.gt(6).multiply(chT.lte(7))).multiply(113))
    .add(tropicalBasal.multiply(chT.gt(5).multiply(chT.lte(6))).multiply(114))
    .add(tropicalBasal.multiply(chT.gt(4).multiply(chT.lte(5))).multiply(115))
    .add(tropicalBasal.multiply(chT.gt(3).multiply(chT.lte(4))).multiply(116))
    .add(tropicalBasal.multiply(chT.gt(2).multiply(chT.lte(3))).multiply(117))
    .add(tropicalBasal.multiply(chT.lte(2)).multiply(118))
    // Tropical Premontane
    .add(tropicalPremontane.multiply(chSW.gt(7)).multiply(121))
    .add(tPM(tropicalPremontane, 7).multiply(122))
    .add(tPM(tropicalPremontane, 6).multiply(123))
    .add(tPM(tropicalPremontane, 5).multiply(124))
    .add(tPM(tropicalPremontane, 4).multiply(125))
    .add(tPM(tropicalPremontane, 3).multiply(126))
    .add(tropicalPremontane.multiply(chSW.lte(2)).multiply(127))
    // Tropical Lower Montane
    .add(tropicalLowerMontane.multiply(chSW.gt(7)).multiply(131))
    .add(tPM(tropicalLowerMontane, 7).multiply(132))
    .add(tPM(tropicalLowerMontane, 6).multiply(133))
    .add(tPM(tropicalLowerMontane, 5).multiply(134))
    .add(tPM(tropicalLowerMontane, 4).multiply(135))
    .add(tPM(tropicalLowerMontane, 3).multiply(136))
    .add(tropicalLowerMontane.multiply(chSW.lte(2)).multiply(137))
    // Tropical Montane
    .add(tropicalMontane.multiply(chC.gt(6)).multiply(141))
    .add(tropicalMontane.multiply(chC.gt(5).multiply(chC.lte(6))).multiply(142))
    .add(tropicalMontane.multiply(chC.gt(4).multiply(chC.lte(5))).multiply(143))
    .add(tropicalMontane.multiply(chC.gt(3).multiply(chC.lte(4))).multiply(144))
    .add(tropicalMontane.multiply(chC.gt(2).multiply(chC.lte(3))).multiply(145))
    .add(tropicalMontane.multiply(chC.lte(2)).multiply(146))
    // Tropical Subalpine
    .add(tropicalSubalpine.multiply(chB.gt(5)).multiply(151))
    .add(tropicalSubalpine.multiply(chB.gt(4).multiply(chB.lte(5))).multiply(152))
    .add(tropicalSubalpine.multiply(chB.gt(3).multiply(chB.lte(4))).multiply(153))
    .add(tropicalSubalpine.multiply(chB.gt(2).multiply(chB.lte(3))).multiply(154))
    .add(tropicalSubalpine.multiply(chB.lte(2)).multiply(155))
    // Tropical Alpine
    .add(tropicalAlpine.multiply(chSP.gt(4)).multiply(161))
    .add(tropicalAlpine.multiply(chSP.gt(3).multiply(chSP.lte(4))).multiply(162))
    .add(tropicalAlpine.multiply(chSP.gt(2).multiply(chSP.lte(3))).multiply(163))
    .add(tropicalAlpine.multiply(chSP.lte(2)).multiply(164))
    // Tropical Nival
    .add(tropicalNival.multiply(171))
    // Subtropical Basal
    .add(subtropicalBasal.multiply(chSW.gt(7)).multiply(211))
    .add(tPM(subtropicalBasal, 7).multiply(212))
    .add(tPM(subtropicalBasal, 6).multiply(213))
    .add(tPM(subtropicalBasal, 5).multiply(214))
    .add(tPM(subtropicalBasal, 4).multiply(215))
    .add(tPM(subtropicalBasal, 3).multiply(216))
    .add(subtropicalBasal.multiply(chSW.lte(2)).multiply(217))
    // Subtropical Lower Montane
    .add(subtropicalLowerMontane.multiply(chSW.gt(7)).multiply(221))
    .add(tPM(subtropicalLowerMontane, 7).multiply(222))
    .add(tPM(subtropicalLowerMontane, 6).multiply(223))
    .add(tPM(subtropicalLowerMontane, 5).multiply(224))
    .add(tPM(subtropicalLowerMontane, 4).multiply(225))
    .add(tPM(subtropicalLowerMontane, 3).multiply(226))
    .add(subtropicalLowerMontane.multiply(chSW.lte(2)).multiply(227))
    // Subtropical Montane
    .add(subtropicalMontane.multiply(chC.gt(6)).multiply(231))
    .add(subtropicalMontane.multiply(chC.gt(5).multiply(chC.lte(6))).multiply(232))
    .add(subtropicalMontane.multiply(chC.gt(4).multiply(chC.lte(5))).multiply(233))
    .add(subtropicalMontane.multiply(chC.gt(3).multiply(chC.lte(4))).multiply(234))
    .add(subtropicalMontane.multiply(chC.gt(2).multiply(chC.lte(3))).multiply(235))
    .add(subtropicalMontane.multiply(chC.lte(2)).multiply(236))
    // Subtropical Subalpine
    .add(subtropicalSubalpine.multiply(chB.gt(5)).multiply(241))
    .add(subtropicalSubalpine.multiply(chB.gt(4).multiply(chB.lte(5))).multiply(242))
    .add(subtropicalSubalpine.multiply(chB.gt(3).multiply(chB.lte(4))).multiply(243))
    .add(subtropicalSubalpine.multiply(chB.gt(2).multiply(chB.lte(3))).multiply(244))
    .add(subtropicalSubalpine.multiply(chB.lte(2)).multiply(245))
    // Subtropical Alpine
    .add(subtropicalAlpine.multiply(chSP.gt(4)).multiply(251))
    .add(subtropicalAlpine.multiply(chSP.gt(3).multiply(chSP.lte(4))).multiply(252))
    .add(subtropicalAlpine.multiply(chSP.gt(2).multiply(chSP.lte(3))).multiply(253))
    .add(subtropicalAlpine.multiply(chSP.lte(2)).multiply(254))
    // Subtropical Nival
    .add(subtropicalNival.multiply(261))
    // Warm Temperate Basal
    .add(warmTemperateBasal.multiply(chSW.gt(7)).multiply(311))
    .add(tPM(warmTemperateBasal, 7).multiply(312))
    .add(tPM(warmTemperateBasal, 6).multiply(313))
    .add(tPM(warmTemperateBasal, 5).multiply(314))
    .add(tPM(warmTemperateBasal, 4).multiply(315))
    .add(tPM(warmTemperateBasal, 3).multiply(316))
    .add(warmTemperateBasal.multiply(chSW.lte(2)).multiply(317))
    // Warm Temperate Montane
    .add(warmTemperateMontane.multiply(chC.gt(6)).multiply(321))
    .add(warmTemperateMontane.multiply(chC.gt(5).multiply(chC.lte(6))).multiply(322))
    .add(warmTemperateMontane.multiply(chC.gt(4).multiply(chC.lte(5))).multiply(323))
    .add(warmTemperateMontane.multiply(chC.gt(3).multiply(chC.lte(4))).multiply(324))
    .add(warmTemperateMontane.multiply(chC.gt(2).multiply(chC.lte(3))).multiply(325))
    .add(warmTemperateMontane.multiply(chC.lte(2)).multiply(326))
    // Warm Temperate Subalpine
    .add(warmTemperateSubalpine.multiply(chB.gt(5)).multiply(331))
    .add(warmTemperateSubalpine.multiply(chB.gt(4).multiply(chB.lte(5))).multiply(332))
    .add(warmTemperateSubalpine.multiply(chB.gt(3).multiply(chB.lte(4))).multiply(333))
    .add(warmTemperateSubalpine.multiply(chB.gt(2).multiply(chB.lte(3))).multiply(334))
    .add(warmTemperateSubalpine.multiply(chB.lte(2)).multiply(335))
    // Warm Temperate Alpine
    .add(warmTemperateAlpine.multiply(chSP.gt(4)).multiply(341))
    .add(warmTemperateAlpine.multiply(chSP.gt(3).multiply(chSP.lte(4))).multiply(342))
    .add(warmTemperateAlpine.multiply(chSP.gt(2).multiply(chSP.lte(3))).multiply(343))
    .add(warmTemperateAlpine.multiply(chSP.lte(2)).multiply(344))
    // Warm Temperate Nival
    .add(warmTemperateNival.multiply(351))
    // Cool Temperate Basal
    .add(coolTemperateBasal.multiply(chC.gt(6)).multiply(411))
    .add(coolTemperateBasal.multiply(chC.gt(5).multiply(chC.lte(6))).multiply(412))
    .add(coolTemperateBasal.multiply(chC.gt(4).multiply(chC.lte(5))).multiply(413))
    .add(coolTemperateBasal.multiply(chC.gt(3).multiply(chC.lte(4))).multiply(414))
    .add(coolTemperateBasal.multiply(chC.gt(2).multiply(chC.lte(3))).multiply(415))
    .add(coolTemperateBasal.multiply(chC.lte(2)).multiply(416))
    // Cool Temperate Subalpine
    .add(coolTemperateSubalpine.multiply(chB.gt(5)).multiply(421))
    .add(coolTemperateSubalpine.multiply(chB.gt(4).multiply(chB.lte(5))).multiply(422))
    .add(coolTemperateSubalpine.multiply(chB.gt(3).multiply(chB.lte(4))).multiply(423))
    .add(coolTemperateSubalpine.multiply(chB.gt(2).multiply(chB.lte(3))).multiply(424))
    .add(coolTemperateSubalpine.multiply(chB.lte(2)).multiply(425))
    // Cool Temperate Alpine
    .add(coolTemperateAlpine.multiply(chSP.gt(4)).multiply(431))
    .add(coolTemperateAlpine.multiply(chSP.gt(3).multiply(chSP.lte(4))).multiply(432))
    .add(coolTemperateAlpine.multiply(chSP.gt(2).multiply(chSP.lte(3))).multiply(433))
    .add(coolTemperateAlpine.multiply(chSP.lte(2)).multiply(434))
    // Cool Temperate Nival
    .add(coolTemperateNival.multiply(441))
    // Boreal Basal
    .add(borealBasal.multiply(chB.gt(5)).multiply(511))
    .add(borealBasal.multiply(chB.gt(4).multiply(chB.lte(5))).multiply(512))
    .add(borealBasal.multiply(chB.gt(3).multiply(chB.lte(4))).multiply(513))
    .add(borealBasal.multiply(chB.gt(2).multiply(chB.lte(3))).multiply(514))
    .add(borealBasal.multiply(chB.lte(2)).multiply(515))
    // Boreal Alpine
    .add(borealAlpine.multiply(chSP.gt(4)).multiply(521))
    .add(borealAlpine.multiply(chSP.gt(3).multiply(chSP.lte(4))).multiply(522))
    .add(borealAlpine.multiply(chSP.gt(2).multiply(chSP.lte(3))).multiply(523))
    .add(borealAlpine.multiply(chSP.lte(2)).multiply(524))
    // Boreal Nival
    .add(borealNival.multiply(531))
    // Subpolar Basal
    .add(subpolarBasal.multiply(chSP.gt(4)).multiply(611))
    .add(subpolarBasal.multiply(chSP.gt(3).multiply(chSP.lte(4))).multiply(612))
    .add(subpolarBasal.multiply(chSP.gt(2).multiply(chSP.lte(3))).multiply(613))
    .add(subpolarBasal.multiply(chSP.lte(2)).multiply(614))
    // Subpolar Nival
    .add(subpolarNival.multiply(621))
    // Polar
    .add(polarZone.multiply(711))
  );
}

// ── Full HLZ classification (3-digit codes) ──────────────────────────────────

/**
 * Computes the full Holdridge Life Zone classification (3-digit codes)
 * from TerraClimate data for the specified period.
 * Returns a single-band ee.Image with 3-digit HLZ codes.
 */
function computeHLZ(startYear, endYear) {
  const elevation = ee.Image(ELEVATION_ASSET);
  const tcTemp    = tcMonthlyMeanTemp(startYear, endYear);
  const tcPre     = tcMonthlyMeanPre(startYear, endYear);
  const annualPet = tcAnnualMeanPet(startYear, endYear);

  // ── Biotemperature: clamp monthly temp to [0, 30] °C ──
  const tb = tcTemp.toBands();
  const mmb = b => tb.select(b).max(ee.Image(0)).min(ee.Image(30)).rename('b');

  const tBio = ee.ImageCollection.fromImages([
    mmb(0), mmb(1), mmb(2),  mmb(3),  mmb(4),  mmb(5),
    mmb(6), mmb(7), mmb(8),  mmb(9),  mmb(10), mmb(11),
  ]).sum().divide(12);

  // Sea-level biotemperature: constant 6 °C per km elevation (only where tBio > 0)
  const t0Bio = tBio.add(tBio.gt(0).multiply(elevation.divide(1000).multiply(6)));

  // ── Frost: any month where tmmn×0.1 < 0 ──
  const hasFrost = ee.ImageCollection(TC_COLLECTION)
    .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
    .select('tmmn')
    .min()
    .multiply(0.1)
    .lt(0);

  return _buildHLZImage(t0Bio, hasFrost, tcPre.sum(), annualPet, elevation);
}

/**
 * Computes the full Holdridge Life Zone classification (3-digit codes)
 * from CRU TS data for the specified period.
 * Returns a single-band ee.Image with 3-digit HLZ codes.
 *
 * CRU TS bands: temperature (°C), precipitation (mm/month),
 *               PET (mm/day), frost days (days/month).
 */
function computeHLZ_CRU(startYear, endYear) {
  const elevation = ee.Image(ELEVATION_ASSET);
  const cruTemp = cruMonthlyMeans(ee.Image(CRU_TMP), startYear, endYear);
  const cruPre  = cruMonthlyMeans(ee.Image(CRU_PRE), startYear, endYear);
  const cruFrs  = cruMonthlyMeans(ee.Image(CRU_FRS), startYear, endYear);

  // Annual PET (mm/year): CRU PET is in mm/day; mean over 12 monthly means × 365.25
  const annualPet = cruMonthlyMeans(ee.Image(CRU_PET), startYear, endYear)
    .mean().multiply(365.25);

  // ── Biotemperature: clamp monthly temp to [0, 30] °C ──
  const tb  = cruTemp.toBands();
  const mmb = b => tb.select(b).max(ee.Image(0)).min(ee.Image(30)).rename('b');

  const tBio = ee.ImageCollection.fromImages([
    mmb(0), mmb(1), mmb(2),  mmb(3),  mmb(4),  mmb(5),
    mmb(6), mmb(7), mmb(8),  mmb(9),  mmb(10), mmb(11),
  ]).sum().divide(12);

  // Sea-level biotemperature: constant 6 °C per km elevation (only where tBio > 0)
  const t0Bio = tBio.add(tBio.gt(0).multiply(elevation.divide(1000).multiply(6)));

  // ── Frost: mean annual frost days (sum of 12 monthly means) > 0.5 ──
  // Follows Lugo et al. 1999: < 0.5 frost days/year = no-frost zone
  const hasFrost = cruFrs.sum().gt(0.5);

  return _buildHLZImage(t0Bio, hasFrost, cruPre.sum(), annualPet, elevation);
}

// ── Remap tables ─────────────────────────────────────────────────────────────

const HLZ_FROM = [
  111,112,113,114,115,116,117,118,
  121,122,123,124,125,126,127,
  131,132,133,134,135,136,137,
  141,142,143,144,145,146,
  151,152,153,154,155,
  161,162,163,164,
  171,
  211,212,213,214,215,216,217,
  221,222,223,224,225,226,227,
  231,232,233,234,235,236,
  241,242,243,244,245,
  251,252,253,254,
  261,
  311,312,313,314,315,316,317,
  321,322,323,324,325,326,
  331,332,333,334,335,
  341,342,343,344,
  351,
  411,412,413,414,415,416,
  421,422,423,424,425,
  431,432,433,434,
  441,
  511,512,513,514,515,
  521,522,523,524,
  531,
  611,612,613,614,
  621,
  711,
];

// HLZ III → GCZ (10 classes)
const GCZ_TO = [
  1,1,1,2,3,3,3,3,
  4,4,4,5,5,5,5,
  4,4,4,5,5,5,5,
  6,6,6,7,7,7,
  8,8,8,9,9,
  10,10,10,10,
  10,
  4,4,4,5,5,5,5,
  4,4,4,5,5,5,5,
  6,6,6,7,7,7,
  8,8,8,9,9,
  10,10,10,10,
  10,
  4,4,4,5,5,5,5,
  6,6,6,7,7,7,
  8,8,8,9,9,
  10,10,10,10,
  10,
  6,6,6,7,7,7,
  8,8,8,9,9,
  10,10,10,10,
  10,
  8,8,8,9,9,
  10,10,10,10,
  10,
  10,10,10,10,
  10,
  10,
];

// HLZ III → GEZ (27 classes, 2-digit codes)
const GEZ_TO = [
  11,11,11,12,13,14,14,15,
  21,21,22,23,24,24,25,
  31,31,32,33,34,34,35,
  41,41,42,43,43,44,
  51,51,52,53,54,
  61,61,62,63,
  71,
  21,21,22,23,24,24,25,
  31,31,32,33,34,34,35,
  41,41,42,43,43,44,
  51,51,52,53,54,
  61,61,62,63,
  71,
  31,31,32,33,34,34,35,
  41,41,42,43,43,44,
  51,51,52,53,54,
  61,61,62,63,
  71,
  41,41,42,43,43,44,
  51,51,52,53,54,
  61,61,62,63,
  71,
  51,51,52,53,54,
  61,61,62,63,
  71,
  61,61,62,63,
  71,
  71,
];

// HLZ III → HLZ II (2-digit codes: tens=region, units=moisture class)
const HLZII_TO = [
  11,12,13,14,15,16,17,18,
  21,22,23,24,25,26,27,
  31,32,33,34,35,36,37,
  41,42,43,44,45,46,
  51,52,53,54,55,
  61,62,63,64,
  71,
  21,22,23,24,25,26,27,
  31,32,33,34,35,36,37,
  41,42,43,44,45,46,
  51,52,53,54,55,
  61,62,63,64,
  71,
  31,32,33,34,35,36,37,
  41,42,43,44,45,46,
  51,52,53,54,55,
  61,62,63,64,
  71,
  41,42,43,44,45,46,
  51,52,53,54,55,
  61,62,63,64,
  71,
  51,52,53,54,55,
  61,62,63,64,
  71,
  61,62,63,64,
  71,
  71,
];

/**
 * Build a JS lookup map from HLZ_FROM codes to target values.
 * @param {number[]} toValues
 * @returns {Object} {hlzCode: targetValue, ...}
 */
function buildLookup(toValues) {
  const map = {};
  HLZ_FROM.forEach((code, i) => { map[code] = toValues[i]; });
  return map;
}

const GCZ_LOOKUP  = buildLookup(GCZ_TO);
const GEZ_LOOKUP  = buildLookup(GEZ_TO);
const HLZII_LOOKUP = buildLookup(HLZII_TO);

module.exports = {
  TC_MIN_YEAR,
  TC_MAX_YEAR,
  TC_COLLECTION,
  CRU_MIN_YEAR,
  CRU_MAX_YEAR,
  HLZ_FROM,
  GCZ_TO,
  GEZ_TO,
  HLZII_TO,
  GCZ_LOOKUP,
  GEZ_LOOKUP,
  HLZII_LOOKUP,
  computeHLZ,
  computeHLZ_CRU,
  tcMonthlyMeanTemp,
  tcMonthlyMeanPre,
  tcAnnualMeanPet,
};
