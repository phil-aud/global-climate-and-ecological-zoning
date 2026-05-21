/**
 * Annual Summary Handler
 * Returns mean annual temperature and precipitation.
 * Supports 'cru' (default) and 'terraclimate' datasets.
 */

const ee = require('@google/earthengine');
const { tcMonthlyMeanTemp, tcMonthlyMeanPre, TC_MIN_YEAR: TC_MIN, TC_MAX_YEAR: TC_MAX, TC_COLLECTION } = require('./tcHelpers');

const CRU_MIN_YEAR = 1901;
const CRU_MAX_YEAR = 2024;

// median of a numeric array (nulls ignored). Returns null if empty.
function median(arr) {
  const v = arr.filter(x => x != null && Number.isFinite(x)).slice().sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return null;
  return n % 2 ? v[(n - 1) >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

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

    // Per-year annual T (mean of 12 monthly mean T) and annual P (sum of 12
    // monthly P). Build one combined image with bands t{y}, p{y}.
    const tc = ee.ImageCollection(TC_COLLECTION);
    const bandImgs = [];
    const yearIndices = [];
    for (let y = startYear; y <= endYear; y++) {
      const yIdx = y - startYear;
      yearIndices.push(yIdx);
      const icYear = tc.filter(ee.Filter.calendarRange(y, y, 'year'));
      const tYear = icYear.map(img =>
        img.select('tmmn').add(img.select('tmmx'))
          .multiply(0.05).rename('tmp')
      ).mean().rename(`t${yIdx}`);
      const pYear = icYear.select('pr').sum().rename(`p${yIdx}`);
      bandImgs.push(tYear);
      bandImgs.push(pYear);
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
    const tVals = yearIndices.map(i => result[`t${i}`]).filter(v => v != null);
    const pVals = yearIndices.map(i => result[`p${i}`]).filter(v => v != null);
    const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    const round2 = v => v != null ? Number(v.toFixed(2)) : null;
    return {
      meanAnnualTemp:     round2(mean(tVals)),
      meanAnnualPrecip:   round2(mean(pVals)),
      medianAnnualTemp:   round2(median(tVals)),
      medianAnnualPrecip: round2(median(pVals)),
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
  const years = endYear - startYear + 1;

  // Build band name arrays using 1-based b-names matching the GEE asset
  const tempSubset = [];
  const precipSubset = [];
  for (let i = startIdx; i <= endIdx; i++) {
    tempSubset.push(`b${i + 1}`);
    precipSubset.push(`b${i + 1}`);
  }

  // Sample all monthly bands at the point so we can compute per-year stats
  // in JS (mean and median annual T/P).
  const tempData = await new Promise((resolve, reject) => {
    cruTsTemp.select(tempSubset).sample(point, 5000).first().evaluate((feature, err) => {
      if (err) return reject(err);
      if (!feature || !feature.properties) return reject(new Error('No temperature sample returned from Earth Engine'));
      return resolve(feature.properties);
    });
  });
  const precipData = await new Promise((resolve, reject) => {
    cruTsPrecip.select(precipSubset).sample(point, 5000).first().evaluate((feature, err) => {
      if (err) return reject(err);
      if (!feature || !feature.properties) return reject(new Error('No precipitation sample returned from Earth Engine'));
      return resolve(feature.properties);
    });
  });

  // Per-year aggregates
  const annualT = [];
  const annualP = [];
  for (let y = 0; y < years; y++) {
    let tSum = 0, tCount = 0, pSum = 0, pCount = 0;
    for (let m = 0; m < 12; m++) {
      const bandName = `b${startIdx + y * 12 + m + 1}`;
      const tv = tempData[bandName];
      const pv = precipData[bandName];
      if (tv != null) { tSum += tv; tCount += 1; }
      if (pv != null) { pSum += pv; pCount += 1; }
    }
    if (tCount === 12) annualT.push(tSum / 12);     // mean of monthly T
    if (pCount === 12) annualP.push(pSum);          // sum of monthly P
  }

  if (!annualT.length || !annualP.length) {
    throw new Error('No data available at this location for the specified years');
  }

  const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const round2 = v => v != null ? Number(v.toFixed(2)) : null;

  return {
    meanAnnualTemp:     round2(mean(annualT)),
    meanAnnualPrecip:   round2(mean(annualP)),
    medianAnnualTemp:   round2(median(annualT)),
    medianAnnualPrecip: round2(median(annualP)),
  };
}

module.exports = { getAnnualSummary };
