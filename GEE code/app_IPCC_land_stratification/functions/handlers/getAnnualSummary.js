/**
 * Annual Summary Handler
 * Returns mean annual temperature and precipitation.
 * Supports 'cru' (default) and 'terraclimate' datasets.
 */

const ee = require('@google/earthengine');
const { tcMonthlyMeanTemp, tcMonthlyMeanPre, TC_MIN_YEAR: TC_MIN, TC_MAX_YEAR: TC_MAX, TC_COLLECTION } = require('./tcHelpers');

const CRU_MIN_YEAR = 1901;
const CRU_MAX_YEAR = 2024;

/**
 * Get annual summary statistics (MAT, MAP)
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @param {number} startYear - Start year
 * @param {number} endYear - End year
 * @param {string} [dataset='cru'] - 'cru' or 'terraclimate'
 * @returns {Promise<object>} {meanAnnualTemp, meanAnnualPrecip}
 */
async function getAnnualSummary(lon, lat, startYear, endYear, dataset = 'cru') {
  // Validate inputs
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error('Invalid coordinates');
  }
  if (startYear > endYear) {
    throw new Error('Start year must be <= end year');
  }

  if (dataset === 'terraclimate') {
    if (startYear < TC_MIN || endYear > TC_MAX) {
      throw new Error(`TerraClimate year range must be between ${TC_MIN} and ${TC_MAX}`);
    }
    const point = ee.Geometry.Point([lon, lat]);

    const monthlyTempIC = tcMonthlyMeanTemp(startYear, endYear);
    const monthlyPreIC  = tcMonthlyMeanPre(startYear, endYear);

    // Sample raw monthly means (not derived images) using the native TC projection.
    const tempList = monthlyTempIC.toList(12);
    const preList  = monthlyPreIC.toList(12);
    const bandImgs = [];
    for (let m = 0; m < 12; m++) {
      bandImgs.push(ee.Image(tempList.get(m)).rename(`t${m}`));
      bandImgs.push(ee.Image(preList.get(m)).rename(`p${m}`));
    }
    const combined = ee.Image.cat(bandImgs);
    const tcNativeProj = ee.ImageCollection(TC_COLLECTION).first().select('pr').projection();

    const result = await new Promise((resolve, reject) => {
      combined.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: tcNativeProj.nominalScale(),
        crs: tcNativeProj,
        bestEffort: true,
      }).evaluate((r, err) => {
        if (err) reject(new Error(err));
        else resolve(r);
      });
    });

    if (!result || result.t0 == null) {
      throw new Error('No data available at this location for the specified years');
    }
    // MAT = mean of 12 monthly temps; MAP = sum of 12 monthly precips (computed in JS)
    let matSum = 0, mapSum = 0;
    for (let m = 0; m < 12; m++) {
      matSum += result[`t${m}`] ?? 0;
      mapSum += result[`p${m}`] ?? 0;
    }
    return {
      meanAnnualTemp:   Number((matSum / 12).toFixed(2)),
      meanAnnualPrecip: Number(mapSum.toFixed(2)),
    };
  }

  // ── CRU (default) ───────────────────────────────────────────────────────────
  const MIN_YEAR = CRU_MIN_YEAR;
  const MAX_YEAR = CRU_MAX_YEAR;
  if (startYear < MIN_YEAR || endYear > MAX_YEAR) {
    throw new Error(`Year range must be between ${MIN_YEAR} and ${MAX_YEAR}`);
  }

  const point = ee.Geometry.Point([lon, lat]);

  // Reference CRU TS datasets
  const cruTsTemp = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp');
  const cruTsPrecip = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pre');

  // Calculate year indices
  const startIdx = (startYear - MIN_YEAR) * 12;
  const endIdx = (endYear - MIN_YEAR + 1) * 12 - 1;

  // Build band name arrays using 1-based b-names matching the GEE asset
  const tempSubset = [];
  const precipSubset = [];
  for (let i = startIdx; i <= endIdx; i++) {
    tempSubset.push(`b${i + 1}`);
    precipSubset.push(`b${i + 1}`);
  }

  const tempMean = cruTsTemp.select(tempSubset).reduce(ee.Reducer.mean());
  // Precipitation: reduce to mean across all monthly bands, then multiply by 12 to get the
  // yearly sum (sum of 12 per-calendar-month means), matching the original GEE yearlyData()
  // which uses cruPreMonthlyMean().sum().
  const precipMean = cruTsPrecip.select(precipSubset).reduce(ee.Reducer.mean());

  // Sample at point
  const result = await new Promise((resolve, reject) => {
    ee.Image.cat([tempMean, precipMean]).sample(point, 5000).first().evaluate((feature, err) => {
      if (err) return reject(err);
      if (!feature || !feature.properties) return reject(new Error('No sample returned from Earth Engine'));
      return resolve(feature.properties);
    });
  });

  const mat = result ? Number(result.mean.toFixed(2)) : null;
  // mean_1 is mean monthly precipitation; × 12 converts to yearly sum of monthly means
  const map = result ? Number((result.mean_1 * 12).toFixed(2)) : null;

  if (mat === null || map === null) {
    throw new Error('No data available at this location for the specified years');
  }

  return {
    meanAnnualTemp: mat,
    meanAnnualPrecip: map,
  };
}

module.exports = { getAnnualSummary };
