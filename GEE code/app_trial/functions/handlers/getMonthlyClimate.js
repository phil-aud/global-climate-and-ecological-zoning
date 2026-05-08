/**
 * Monthly Climate Data Handler
 * Returns monthly temperature and precipitation data averaged across years.
 * Supports 'cru' (default) and 'terraclimate' datasets.
 */

const ee = require('@google/earthengine');
const { tcMonthlyMeanTemp, tcMonthlyMeanPre, TC_MIN_YEAR: TC_MIN, TC_MAX_YEAR: TC_MAX } = require('./tcHelpers');

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Get monthly climate data (averaged across specified year range)
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @param {number} startYear - Start year
 * @param {number} endYear - End year
 * @param {string} [dataset='cru'] - 'cru' or 'terraclimate'
 * @returns {Promise<array>} Array of {month, temperature, precipitation}
 */
async function getMonthlyClimate(lon, lat, startYear, endYear, dataset = 'cru') {
  // Validate inputs
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error('Invalid coordinates');
  }
  if (startYear > endYear) {
    throw new Error('Start year must be <= end year');
  }

  if (dataset === 'terraclimate') {
    if (startYear < TC_MIN) throw new Error(`TerraClimate data available from ${TC_MIN} onwards`);
    if (endYear > TC_MAX)   throw new Error(`TerraClimate end year cannot exceed ${TC_MAX}`);

    const point = ee.Geometry.Point([lon, lat]);

    const monthlyTempIC = tcMonthlyMeanTemp(startYear, endYear);
    const monthlyPreIC  = tcMonthlyMeanPre(startYear, endYear);

    // Sample all 12 monthly mean temperature images
    const tempList  = monthlyTempIC.toList(12);
    const preList   = monthlyPreIC.toList(12);

    const monthlyData = [];
    for (let m = 0; m < 12; m++) {
      const tImg = ee.Image(tempList.get(m));
      const pImg = ee.Image(preList.get(m));

      const [tResult, pResult] = await Promise.all([
        new Promise((resolve, reject) => {
          tImg.reduceRegion({
            reducer: ee.Reducer.first(),
            geometry: point,
            scale: 1000,
            bestEffort: true,
          }).evaluate((r, err) => err ? reject(new Error(err)) : resolve(r));
        }),
        new Promise((resolve, reject) => {
          pImg.reduceRegion({
            reducer: ee.Reducer.first(),
            geometry: point,
            scale: 1000,
            bestEffort: true,
          }).evaluate((r, err) => err ? reject(new Error(err)) : resolve(r));
        }),
      ]);

      let tVal = null, pVal = null;
      if (tResult) for (const k in tResult) { tVal = tResult[k]; break; }
      if (pResult) for (const k in pResult) { pVal = pResult[k]; break; }

      monthlyData.push({
        month: MONTH_NAMES[m],
        temperature:   tVal !== null ? Number(Number(tVal).toFixed(2)) : null,
        precipitation: pVal !== null ? Number(Number(pVal).toFixed(2)) : null,
      });
    }
    return monthlyData;
  }

  // ── CRU (default) ───────────────────────────────────────────────────────────
  const MAX_YEAR = 2024;
  if (startYear < 1901) {
    throw new Error('Data available from 1901 onwards');
  }
  if (endYear > MAX_YEAR) {
    throw new Error(`End year cannot exceed ${MAX_YEAR} (dataset coverage limit)`);
  }

  const point = ee.Geometry.Point([lon, lat]);

  // Reference CRU TS datasets
  const cruTsTemp = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp');
  const cruTsPrecip = ee.Image('projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pre');

  // Calculate year indices in the dataset
  const startIdx = (startYear - 1901) * 12;
  const endIdx = (endYear - 1901 + 1) * 12 - 1;
  const years = endYear - startYear + 1;

  // Build band name arrays using 1-based b-names matching the GEE asset
  const tempSubset = [];
  const precipSubset = [];
  for (let i = startIdx; i <= endIdx; i++) {
    tempSubset.push(`b${i + 1}`);
    precipSubset.push(`b${i + 1}`);
  }

  // Sample data at point
  const tempData = await new Promise((resolve, reject) => {
    cruTsTemp.select(tempSubset).sample(point, 5000).first().evaluate((result, err) => {
      if (err) return reject(err);
      if (!result || !result.properties) return reject(new Error('No temperature sample returned from Earth Engine'));
      return resolve(result);
    });
  });

  const precipData = await new Promise((resolve, reject) => {
    cruTsPrecip.select(precipSubset).sample(point, 5000).first().evaluate((result, err) => {
      if (err) return reject(err);
      if (!result || !result.properties) return reject(new Error('No precipitation sample returned from Earth Engine'));
      return resolve(result);
    });
  });

  // Aggregate by month (average across all years)
  const monthlyAgg = {};
  for (let m = 0; m < 12; m++) {
    let tempSum = 0;
    let precipSum = 0;
    for (let y = 0; y < years; y++) {
      const idx = y * 12 + m;
      const bandNameTemp = `b${startIdx + idx + 1}`;
      const bandNamePrecip = `b${startIdx + idx + 1}`;

      tempSum += (tempData.properties[bandNameTemp] || 0);
      precipSum += (precipData.properties[bandNamePrecip] || 0);
    }
    monthlyAgg[m] = {
      month: MONTH_NAMES[m],
      temperature: Number((tempSum / years).toFixed(2)),
      precipitation: Number((precipSum / years).toFixed(2)),
    };
  }

  return Object.values(monthlyAgg);
}

module.exports = { getMonthlyClimate };
