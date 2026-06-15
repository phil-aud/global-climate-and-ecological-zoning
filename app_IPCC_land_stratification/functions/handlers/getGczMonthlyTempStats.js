/**
 * getGczMonthlyTempStats handler
 *
 * For each Global Climate Zone (GCZ, 1..10) computes, for every calendar
 * month (Jan..Dec), the median and standard deviation of the per-pixel
 * "monthly mean temperature" (°C) over the reference period 1995–2024.
 *
 * The per-pixel monthly mean is the average of all Januaries (then all
 * Februaries, …) across the 30-year period. The median and stdDev are then
 * computed across all pixels that fall within each GCZ.
 *
 * Result is cached per dataset for the lifetime of the process — the inputs
 * are global static images so the table never changes.
 *
 * GET /getGczMonthlyTempStats?dataset=cru|terraclimate
 * Response: {
 *   dataset,
 *   period: '1995-2024',
 *   rows: [{
 *     zone, label,
 *     months: [{median, std}, ... 12 entries Jan..Dec]
 *   }, ...]
 * }
 */

const ee = require('@google/earthengine');

const REF_START = 1995;
const REF_END   = 2024;
const CRU_MIN_YEAR = 1901;

const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

const GCZ_LABELS = {
  1:  'Tropical Wet',
  2:  'Tropical Moist',
  3:  'Tropical Dry',
  4:  'Warm Temperate Moist',
  5:  'Warm Temperate Dry',
  6:  'Cool Temperate Moist',
  7:  'Cool Temperate Dry',
  8:  'Boreal Moist',
  9:  'Boreal Dry',
  10: 'Polar',
};

const GCZ_ASSETS = {
  cru:          'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCCversions/IPCC_GlobalClimateZones_1995-2024_CRU409',
  terraclimate: 'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCCversions/IPCC_GlobalClimateZones_1995-2024_TerraClimate',
};

const CRU_TMP_ASSET = 'projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp';
const TC_COLLECTION = 'IDAHO_EPSCOR/TERRACLIMATE';

// In-memory cache
const cache = {};
const inflight = {};

/**
 * Build a 12-band image where each band is the mean temperature for a given
 * calendar month, averaged across REF_START..REF_END.
 * Band names: jan, feb, ..., dec.
 */
function buildMonthlyMeanImage(dataset) {
  if (dataset === 'terraclimate') {
    const ic = ee.ImageCollection(TC_COLLECTION)
      .filter(ee.Filter.calendarRange(REF_START, REF_END, 'year'))
      .map(img =>
        img.select('tmmn').add(img.select('tmmx'))
          .multiply(0.05).rename('tmp')
          .copyProperties(img, ['system:time_start'])
      );
    const bands = [];
    for (let m = 1; m <= 12; m++) {
      bands.push(
        ic.filter(ee.Filter.calendarRange(m, m, 'month'))
          .mean()
          .rename(MONTH_NAMES[m - 1])
      );
    }
    return ee.Image.cat(bands);
  }

  // CRU TS 4.09 — bands b1..bN, monthly, starting Jan 1901.
  const cru = ee.Image(CRU_TMP_ASSET);
  const bands = [];
  for (let m = 1; m <= 12; m++) {
    const monthBandNames = [];
    for (let y = REF_START; y <= REF_END; y++) {
      const idx = (y - CRU_MIN_YEAR) * 12 + (m - 1); // 0-based
      monthBandNames.push(`b${idx + 1}`);
    }
    bands.push(cru.select(monthBandNames).reduce(ee.Reducer.mean()).rename(MONTH_NAMES[m - 1]));
  }
  return ee.Image.cat(bands);
}

function computeStats(dataset) {
  const monthlyMean = buildMonthlyMeanImage(dataset); // 12 bands jan..dec
  const gcz = ee.Image(GCZ_ASSETS[dataset]).rename('zone');
  // Stack the 12 monthly mean bands + zone (group field = index 12).
  const stack = monthlyMean.addBands(gcz);

  const perValueReducer = ee.Reducer.percentile([50], ['p50'])
    .combine({ reducer2: ee.Reducer.stdDev(), sharedInputs: true });

  // Apply the same reducer to each of the 12 monthly bands, then group by
  // zone (the 13th band, index 12).
  const reducer = perValueReducer
    .repeat(12)
    .group({ groupField: 12, groupName: 'zone' });

  const scale = dataset === 'terraclimate' ? 4638 : 5566;

  const stats = stack.reduceRegion({
    reducer,
    geometry: ee.Geometry.Rectangle([-180, -60, 180, 85], null, false),
    scale,
    maxPixels: 1e13,
    bestEffort: true,
    tileScale: 4,
  });

  return new Promise((resolve, reject) => {
    stats.evaluate((result, err) => {
      if (err) return reject(new Error(String(err)));
      if (!result || !Array.isArray(result.groups)) {
        return reject(new Error('No groups returned from Earth Engine'));
      }
      // Each group: { zone, p50: [12 values], stdDev: [12 values] }
      const rows = result.groups
        .filter(g => g && g.zone != null && GCZ_LABELS[g.zone])
        .map(g => {
          const p50  = Array.isArray(g.p50)    ? g.p50    : [];
          const std  = Array.isArray(g.stdDev) ? g.stdDev : [];
          const months = MONTH_NAMES.map((_, i) => ({
            median: p50[i]  != null ? Number(p50[i].toFixed(2))  : null,
            std:    std[i]  != null ? Number(std[i].toFixed(2))  : null,
          }));
          return {
            zone:   g.zone,
            label:  GCZ_LABELS[g.zone],
            months,
          };
        })
        .sort((a, b) => a.zone - b.zone);
      resolve(rows);
    });
  });
}

async function getGczMonthlyTempStats(dataset = 'cru') {
  const ds = dataset === 'terraclimate' ? 'terraclimate' : 'cru';
  if (cache[ds]) return cache[ds];
  if (inflight[ds]) return inflight[ds];

  inflight[ds] = (async () => {
    try {
      const rows = await computeStats(ds);
      const payload = { dataset: ds, period: `${REF_START}-${REF_END}`, months: MONTH_NAMES, rows };
      cache[ds] = payload;
      return payload;
    } finally {
      delete inflight[ds];
    }
  })();

  return inflight[ds];
}

module.exports = { getGczMonthlyTempStats };
