/**
 * Bioecological Data Handler
 * Returns sea-level biotemperature (t0Bio), precipitation, PET ratio, and elevation.
 * Supports 'cru' (default) and 'terraclimate' datasets.
 *
 * For CRU:
 *   tBio = mean annual biotemperature at actual elevation: monthly CRU temps clamped to
 *   [0, 30] °C, averaged over 12 months. Sampled at scale: 5000 (matching App_GEZGCZ.js).
 *   t0Bio = sea-level biotemperature: tBio + (tBio > 0) * (elevation/1000) * 6*cos(lat),
 *   where elevation is sampled from GTOPO30 at its native scale (~927 m) and the lapse
 *   rate 6·cos(lat) °C/km is computed in JS from the requested latitude.
 *
 * For TerraClimate:
 *   Uses IDAHO_EPSCOR/TERRACLIMATE collection. Mean temp = (tmmn + tmmx) × 0.05.
 *   PET is in mm/month with scale 0.1. No frost-days band available.
 *
 * Returned field `biotemperature` = t0Bio (sea-level corrected).
 */

const ee = require('@google/earthengine');
const { tcMonthlyMeanTemp, tcMonthlyMeanPre, tcAnnualMeanPet, TC_MIN_YEAR: TC_MIN, TC_MAX_YEAR: TC_MAX } = require('./tcHelpers');

const TC_COLLECTION = 'IDAHO_EPSCOR/TERRACLIMATE';
const CRU_MIN_YEAR = 1901;
const CRU_MAX_YEAR = 2024;

/**
 * Average days per year over a range (accounts for leap years).
 * Mirrors getAverageDaysInYear() from App_product.js.
 */
function getAverageDaysInYear(startYear, endYear) {
  let totalDays = 0;
  for (let y = startYear; y <= endYear; y++) {
    totalDays += ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
  }
  return totalDays / (endYear - startYear + 1);
}

/**
 * Get bioecological data (biotemperature, P, R, elevation)
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @param {number} startYear - Start year
 * @param {number} endYear - End year
 * @param {string} [dataset='cru'] - 'cru' or 'terraclimate'
 * @returns {Promise<object>} {biotemperature, precipitation, petRatio, elevation, frostDays}
 */
async function getBioecologicalData(lon, lat, startYear, endYear, dataset = 'cru') {
  // Validate inputs
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error('Invalid coordinates');
  }
  if (startYear > endYear) {
    throw new Error('Start year must be <= end year');
  }

  if (dataset === 'terraclimate') {
    const MIN_YEAR = TC_MIN;
    const MAX_YEAR = TC_MAX;
    if (startYear < MIN_YEAR || endYear > MAX_YEAR) {
      throw new Error(`TerraClimate year range must be between ${MIN_YEAR} and ${MAX_YEAR}`);
    }

    const point = ee.Geometry.Point([lon, lat]);
    const elevation = ee.Image('USGS/GTOPO30').rename('elevation').select('elevation');

    // Build monthly mean images (12 images)
    const monthlyTempIC = tcMonthlyMeanTemp(startYear, endYear);
    const monthlyPreIC  = tcMonthlyMeanPre(startYear, endYear);
    const annualPetImg  = tcAnnualMeanPet(startYear, endYear);

    // Mean annual precipitation = sum of 12 monthly means
    const preImg = monthlyPreIC.sum().rename('precipitation');

    // Annual PET ratio
    const petRatioImg = annualPetImg.divide(preImg).rename('petRatio');

    // Biotemperature: clamp monthly means [0, 30], average
    const monthlyTempList = monthlyTempIC.toList(12);
    const bioImages = [];
    for (let m = 0; m < 12; m++) {
      const img = ee.Image(monthlyTempList.get(m));
      bioImages.push(
        img.gt(30).multiply(30)
          .add(img.lte(30).multiply(img.gt(0)).multiply(img))
          .rename('biotemperature')
      );
    }
    const tBio = ee.ImageCollection.fromImages(bioImages).sum().divide(12);

    // Sample at native TerraClimate projection and scale (~4638 m).
    const tcProj = ee.Image(monthlyTempIC.first()).projection();
    const samplingImage = tBio.rename('biotemperature')
      .addBands(preImg)
      .addBands(petRatioImg);

    const climateResult = await new Promise((resolve, reject) => {
      samplingImage.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: tcProj.nominalScale(),
        crs: tcProj,
        bestEffort: true,
      }).evaluate((r, err) => {
        if (err) reject(new Error(err));
        else resolve(r);
      });
    });

    const elevResult = await new Promise((resolve, reject) => {
      elevation.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: elevation.projection().nominalScale(),
        crs: elevation.projection(),
        bestEffort: true,
      }).evaluate((r, err) => {
        if (err) reject(new Error(err));
        else resolve(r);
      });
    });

    const result = Object.assign({}, climateResult, elevResult);
    if (!result || result.biotemperature == null) {
      throw new Error('No data available at this location for the specified years');
    }

    const tBioVal  = result.biotemperature;
    const elevVal   = result.elevation ?? 0;
    const lapseRate = 6 * Math.cos(lat * Math.PI / 180);
    const t0BioVal  = tBioVal > 0 ? tBioVal + (elevVal / 1000) * lapseRate : tBioVal;

    return {
      biotemperature: Number(tBioVal.toFixed(2)),   // tBio at actual elevation
      tBio0:          Number(t0BioVal.toFixed(2)),  // sea-level corrected (t0Bio)
      precipitation:  Number(Number(result.precipitation).toFixed(2)),
      petRatio:       Number(Number(result.petRatio).toFixed(2)),
      elevation:      Number(Number(elevVal).toFixed(2)),
      frostDays:      null,  // TerraClimate has no frost-days band
    };
  }

  // ── CRU (default) ───────────────────────────────────────────────────────────
  const MIN_YEAR = CRU_MIN_YEAR;
  const MAX_YEAR = CRU_MAX_YEAR;
  if (startYear < MIN_YEAR || endYear > MAX_YEAR) {
    throw new Error(`Year range must be between ${MIN_YEAR} and ${MAX_YEAR}`);
  }

  const point = ee.Geometry.Point([lon, lat]);

  // ── Exact mirrors of the variables in App_GEZGCZ.js lines 6–9 ──────────────
  const cruTsTmp  = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp');
  const cruTsPre  = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pre');
  const cruTsPet  = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pet');
  const cruTsFrs  = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_frs');
  const elevation = ee.Image('USGS/GTOPO30').rename('elevation').select('elevation');

  const startBandIdx = (startYear - MIN_YEAR) * 12;  // 0-based index of Jan of startYear
  const periodYears  = endYear - startYear + 1;

  // ── monthlyMeanD() port: for each calendar month build the mean across all years ──
  // Mirrors CRU_FormattedDataset.monthlyMeanD(image, startYear, endYear)
  const monthlyTmpImages = [];
  const monthlyPreImages = [];
  const monthlyPetImages = [];
  const monthlyFrsImages = [];

  for (let m = 0; m < 12; m++) {
    const monthBands = [];
    for (let y = 0; y < periodYears; y++) {
      monthBands.push(`b${startBandIdx + y * 12 + m + 1}`);
    }
    monthlyTmpImages.push(cruTsTmp.select(monthBands).reduce(ee.Reducer.mean()));
    monthlyPreImages.push(cruTsPre.select(monthBands).reduce(ee.Reducer.mean()));
    monthlyPetImages.push(cruTsPet.select(monthBands).reduce(ee.Reducer.mean()));
    monthlyFrsImages.push(cruTsFrs.select(monthBands).reduce(ee.Reducer.mean()));
  }

  // ── Exact port of climDat() from App_product.js ─────────────────────────────
  // var preBands = cruPreMonthlyMean(preciptationData, startYear, endYear).sum().rename('precipitation');
  const preBands = ee.ImageCollection.fromImages(monthlyPreImages).sum().rename('precipitation');

  // var petRatioBands = cruPetYearlyMean(petData, startYear, endYear).divide(preBands).rename('petRatio');
  // cruPetYearlyMean = monthlyMeanD().mean().multiply(getAverageDaysInYear())
  const avgDaysInYear = getAverageDaysInYear(startYear, endYear);
  const annualPet = ee.ImageCollection.fromImages(monthlyPetImages).mean().multiply(avgDaysInYear);
  const petRatioBands = annualPet.divide(preBands).rename('petRatio');

  // var elevationBands = elevationData.rename('elevation');
  const elevationBands = elevation.rename('elevation');

  // Derguy et al. 2019 clamping — mirrors jan/feb/.../dec in climDat() exactly.
  const monthlyBioImages = monthlyTmpImages.map(function(img) {
    return img.gt(30).multiply(30)
      .add(img.lte(30).multiply(img.gt(0)).multiply(img))
      .rename('biotemperature');
  });

  // tBio = mean annual biotemperature at actual elevation (no lapse-rate correction).
  // Elevation is kept OUT of the image expression so GEE samples only CRU data here.
  const tBio = ee.ImageCollection.fromImages(monthlyBioImages).sum().divide(12);

  const annualFrostDays = ee.ImageCollection.fromImages(monthlyFrsImages).sum().rename('frostDays');

  // Sample tBio + precipitation + PET at native CRU projection and scale (~55 km).
  const cruProj = cruTsTmp.projection();
  const samplingImage = tBio.rename('biotemperature')
    .addBands(preBands)
    .addBands(petRatioBands)
    .addBands(annualFrostDays);

  const climateResult = await new Promise((resolve, reject) => {
    samplingImage.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: cruProj.nominalScale(),
      crs: cruProj,
      bestEffort: true,
    }).evaluate((r, err) => {
      if (err) reject(new Error(err));
      else resolve(r);
    });
  });

  // Sample elevation separately at native GTOPO30 resolution (~927 m).
  const elevResult = await new Promise((resolve, reject) => {
    elevationBands.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: elevationBands.projection().nominalScale(),
      crs: elevationBands.projection(),
      bestEffort: true,
    }).evaluate((r, err) => {
      if (err) reject(new Error(err));
      else resolve(r);
    });
  });

  const result = Object.assign({}, climateResult, elevResult);

  if (!result || result.biotemperature == null) {
    throw new Error('No data available at this location for the specified years');
  }

  const tBioVal = result.biotemperature;  // tBio at actual elevation
  const elevVal  = result.elevation ?? 0;

  // t0Bio = sea-level biotemperature using dynamic lapse rate: 6·cos(lat) °C/km.
  // Only applied where tBio > 0 (avoids skewing cold/frozen locations).
  const lapseRate = 6 * Math.cos(lat * Math.PI / 180);
  const t0BioVal  = tBioVal > 0 ? tBioVal + (elevVal / 1000) * lapseRate : tBioVal;

  return {
    biotemperature: Number(tBioVal.toFixed(2)),   // tBio at actual elevation
    tBio0:          Number(t0BioVal.toFixed(2)),  // sea-level corrected (t0Bio)
    precipitation:  Number(Number(result.precipitation).toFixed(2)),
    petRatio:       Number(Number(result.petRatio).toFixed(2)),
    elevation:      Number(Number(elevVal).toFixed(2)),
    frostDays:      Number(Number(result.frostDays).toFixed(2)),
  };
}

module.exports = { getBioecologicalData };
