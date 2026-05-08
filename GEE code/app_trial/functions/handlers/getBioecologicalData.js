/**
 * Bioecological Data Handler
 * Returns sea-level biotemperature (t0Bio), precipitation, PET ratio, and elevation.
 * Supports 'cru' (default) and 'terraclimate' datasets.
 *
 * For CRU:
 *   Mirrors climDat() from App_product.js (GEE source), but computes the lapse-rate
 *   correction numerically (in JS) rather than as a GEE image expression. This avoids
 *   GTOPO30 being resampled to the CRU sampling scale (5 km) during reduceRegion, which
 *   would yield a different elevation—and therefore a different t0Bio—than GEE's code
 *   editor, which samples elevation at native GTOPO30 resolution (~927 m).
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

    const samplingImage = tBio.rename('biotemperature')
      .addBands(preImg)
      .addBands(petRatioImg);

    const climateResult = await new Promise((resolve, reject) => {
      samplingImage.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: 1000,
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
      biotemperature: Number(t0BioVal.toFixed(2)),
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
  // Use JS Array.map() so each month image is explicitly constructed and renamed.
  const monthlyBioImages = monthlyTmpImages.map(function(img) {
    return img.gt(30).multiply(30)
      .add(img.lte(30).multiply(img.gt(0)).multiply(img))
      .rename('biotemperature');
  });

  // Mean annual biotemperature at actual elevation (no lapse-rate correction yet).
  // This is sampled from CRU data only, keeping the elevation out of the image expression
  // so that GTOPO30 is not resampled to the CRU sampling scale.
  const tBio = ee.ImageCollection.fromImages(monthlyBioImages).sum().divide(12);

  // Assemble the sampling image (climate bands at CRU/5 km scale, NO lapse-rate correction)
  const annualFrostDays = ee.ImageCollection.fromImages(monthlyFrsImages).sum().rename('frostDays');

  // DEBUG: sample each month's raw temperature (before clamping)
  const debugMonthlyTemps = await new Promise((resolve, reject) => {
    const debugBands = monthlyTmpImages.map((img, i) => img.rename(`m${i}`));
    const debugImg = debugBands.reduce((acc, img) => acc ? acc.addBands(img) : img);
    debugImg.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: cruTsTmp.projection().nominalScale(),
      crs: cruTsTmp.projection(),
      bestEffort: true,
    }).evaluate((r, err) => err ? reject(new Error(err)) : resolve(r));
  });
  console.log('[getBioecologicalData] monthly raw temps:', JSON.stringify(debugMonthlyTemps));

  const samplingImage = tBio.rename('biotemperature')
    .addBands(preBands)
    .addBands(petRatioBands)
    .addBands(annualFrostDays);

  // Sample climate at native CRU projection and scale.
  // Using scale: 5000 without specifying the CRS causes GEE to resample the ~55 km CRU
  // pixels onto a 5 km grid, which can interpolate across pixel boundaries and hit a
  // different CRU cell than GEE's code editor.  Sampling at native CRU scale/projection
  // matches the raw pixel value, consistent with GEE Inspector and the code-editor result.
  const cruProj = cruTsTmp.projection();
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

  // Sample elevation separately at native GTOPO30 CRS and nominalScale (~927 m).
  // This matches GEE's:  elevation.reduceRegion({ scale: elevation.projection().nominalScale(),
  //                                               crs:   elevation.projection(), ... })
  // and avoids the ~6 m bias that results from using an arbitrary scale without the
  // native projection.
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

  console.log('[getBioecologicalData] raw result:', JSON.stringify(result));

  if (!result || result.biotemperature == null) {
    throw new Error('No data available at this location for the specified years');
  }

  const tBioVal = result.biotemperature;  // tBio at actual elevation (CRU-only, no lapse-rate)
  const elevVal  = result.elevation ?? 0;

  // Compute sea-level biotemperature (t0Bio) numerically using the native-scale elevation.
  // Formula: t0Bio = tBio + (tBio > 0) * (elevation / 1000) * 6·cos(lat)
  const lapseRate = 6 * Math.cos(lat * Math.PI / 180);
  const t0BioVal = tBioVal > 0 ? tBioVal + (elevVal / 1000) * lapseRate : tBioVal;

  return {
    biotemperature: Number(t0BioVal.toFixed(2)),  // sea-level corrected (t0Bio)
    precipitation:  Number(Number(result.precipitation).toFixed(2)),
    petRatio:       Number(Number(result.petRatio).toFixed(2)),
    elevation:      Number(Number(elevVal).toFixed(2)),
    frostDays:      Number(Number(result.frostDays).toFixed(2)),
  };
}

module.exports = { getBioecologicalData };
