/**
 * Monthly Climate Data Handler
 * Returns monthly temperature and precipitation data averaged across years.
 * Supports 'cru' (default) and 'terraclimate' datasets.
 */

const ee = require('@google/earthengine');
const { tcMonthlyMeanTemp, tcMonthlyMeanPre, TC_MIN_YEAR: TC_MIN, TC_MAX_YEAR: TC_MAX, TC_COLLECTION } = require('./tcHelpers');

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// median of a numeric array (nulls ignored). Returns null if empty.
function median(arr) {
  const v = arr.filter(x => x != null && Number.isFinite(x)).slice().sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return null;
  return n % 2 ? v[(n - 1) >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

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

    // ── Means (per calendar month) ─────────────────────────────────────────
    const monthlyTempIC = tcMonthlyMeanTemp(startYear, endYear);
    const monthlyPreIC  = tcMonthlyMeanPre(startYear, endYear);
    const tempList = monthlyTempIC.toList(12);
    const preList  = monthlyPreIC.toList(12);

    // ── Medians (per calendar month, across years) ────────────────────────
    // Build per-calendar-month median images directly from the raw IC so we
    // don't have to fetch every per-year value to the client.
    const tcRawTemp = ee.ImageCollection(TC_COLLECTION)
      .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
      .map(img =>
        img.select('tmmn').add(img.select('tmmx'))
          .multiply(0.05).rename('tmp')
          .copyProperties(img, ['system:time_start'])
      );
    const tcRawPre = ee.ImageCollection(TC_COLLECTION)
      .filter(ee.Filter.calendarRange(startYear, endYear, 'year'))
      .select(['pr']);

    const bandImgs = [];
    for (let m = 0; m < 12; m++) {
      bandImgs.push(ee.Image(tempList.get(m)).rename(`t${m}`));
      bandImgs.push(ee.Image(preList.get(m)).rename(`p${m}`));
      bandImgs.push(
        tcRawTemp.filter(ee.Filter.calendarRange(m + 1, m + 1, 'month'))
          .reduce(ee.Reducer.percentile([50])).rename(`tmed${m}`)
      );
      bandImgs.push(
        tcRawPre.filter(ee.Filter.calendarRange(m + 1, m + 1, 'month'))
          .reduce(ee.Reducer.percentile([50])).rename(`pmed${m}`)
      );
    }
    const combined = ee.Image.cat(bandImgs);

    const result = await new Promise((resolve, reject) => {
      const tcNativeProj = ee.ImageCollection(TC_COLLECTION).first().select('pr').projection();
      combined.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: tcNativeProj.nominalScale(),
        crs: tcNativeProj,
        bestEffort: true,
      }).evaluate((r, err) => err ? reject(new Error(err)) : resolve(r));
    });

    if (!result) throw new Error('No data available at this location for the specified years');

    const round2 = v => v != null ? Number(Number(v).toFixed(2)) : null;
    return MONTH_NAMES.map((month, m) => ({
      month,
      temperature:        round2(result[`t${m}`]),
      precipitation:      round2(result[`p${m}`]),
      temperatureMedian:  round2(result[`tmed${m}`]),
      precipitationMedian:round2(result[`pmed${m}`]),
    }));
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

  // Aggregate by month (mean + median across all years)
  const monthlyAgg = {};
  for (let m = 0; m < 12; m++) {
    const tVals = [];
    const pVals = [];
    for (let y = 0; y < years; y++) {
      const idx = y * 12 + m;
      const bandName = `b${startIdx + idx + 1}`;
      const tv = tempData.properties[bandName];
      const pv = precipData.properties[bandName];
      if (tv != null) tVals.push(tv);
      if (pv != null) pVals.push(pv);
    }
    const tMean = tVals.length ? tVals.reduce((s, v) => s + v, 0) / tVals.length : null;
    const pMean = pVals.length ? pVals.reduce((s, v) => s + v, 0) / pVals.length : null;
    const round2 = v => v != null ? Number(v.toFixed(2)) : null;
    monthlyAgg[m] = {
      month: MONTH_NAMES[m],
      temperature:         round2(tMean),
      precipitation:       round2(pMean),
      temperatureMedian:   round2(median(tVals)),
      precipitationMedian: round2(median(pVals)),
    };
  }

  return Object.values(monthlyAgg);
}

module.exports = { getMonthlyClimate };
