/**
 * getGczTempStats handler
 *
 * For each Global Climate Zone (GCZ, 1..10) computes the median, minimum,
 * maximum and standard deviation of the mean annual temperature (MAT, °C)
 * over the reference period 1995–2024, using the precomputed GCZ asset and
 * the corresponding temperature dataset (CRU TS 4.09 or TerraClimate).
 *
 * NOTE: this returns *temperature* (mean annual T), not biotemperature.
 *
 * Result is cached per dataset for the lifetime of the process — the inputs
 * are global static images so the table never changes.
 *
 * GET /getGczTempStats?dataset=cru|terraclimate
 * Response: { dataset, period: '1995-2024', rows: [{zone, label, median, min, max, std}, ...] }
 */

const ee = require('@google/earthengine');

const REF_START = 1995;
const REF_END   = 2024;
const CRU_MIN_YEAR = 1901;

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

const CRU_TMP_ASSET   = 'projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp';
const TC_COLLECTION   = 'IDAHO_EPSCOR/TERRACLIMATE';

// In-memory cache
const cache = {};
const inflight = {};

function buildMatImage(dataset) {
  if (dataset === 'terraclimate') {
    const ic = ee.ImageCollection(TC_COLLECTION)
      .filter(ee.Filter.calendarRange(REF_START, REF_END, 'year'))
      .map(img =>
        img.select('tmmn').add(img.select('tmmx'))
          .multiply(0.05).rename('tmp')
          .copyProperties(img, ['system:time_start'])
      );
    const months = [];
    for (let m = 1; m <= 12; m++) {
      months.push(ic.filter(ee.Filter.calendarRange(m, m, 'month')).mean().rename('tmp'));
    }
    return ee.ImageCollection(months).mean().rename('mat');
  }

  // CRU TS 4.09: select bands b{1129..1488} for 1995-01..2024-12
  const startIdx = (REF_START - CRU_MIN_YEAR) * 12;
  const endIdx   = (REF_END   - CRU_MIN_YEAR + 1) * 12 - 1;
  const bandNames = [];
  for (let i = startIdx; i <= endIdx; i++) bandNames.push(`b${i + 1}`);
  return ee.Image(CRU_TMP_ASSET).select(bandNames).reduce(ee.Reducer.mean()).rename('mat');
}

function computeStats(dataset) {
  const matImage = buildMatImage(dataset);
  const gcz = ee.Image(GCZ_ASSETS[dataset]).rename('zone');
  const stack = matImage.addBands(gcz);

  const reducer = ee.Reducer.percentile([50], ['p50'])
    .combine({ reducer2: ee.Reducer.minMax(),  sharedInputs: true })
    .combine({ reducer2: ee.Reducer.stdDev(),  sharedInputs: true })
    .group({ groupField: 1, groupName: 'zone' });

  // Native scale of the underlying climate dataset.
  // CRU: ~55 km. We sample at ~5.5 km via the (finer) GCZ asset so that small
  // zones get represented but the reduction stays tractable.
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
      const rows = result.groups
        .filter(g => g && g.zone != null && GCZ_LABELS[g.zone])
        .map(g => ({
          zone:   g.zone,
          label:  GCZ_LABELS[g.zone],
          median: g.p50 != null ? Number(g.p50.toFixed(2)) : null,
          min:    g.min != null ? Number(g.min.toFixed(2)) : null,
          max:    g.max != null ? Number(g.max.toFixed(2)) : null,
          std:    g.stdDev != null ? Number(g.stdDev.toFixed(2)) : null,
        }))
        .sort((a, b) => a.zone - b.zone);
      resolve(rows);
    });
  });
}

async function getGczTempStats(dataset = 'cru') {
  const ds = dataset === 'terraclimate' ? 'terraclimate' : 'cru';
  if (cache[ds]) return cache[ds];
  if (inflight[ds]) return inflight[ds];

  inflight[ds] = (async () => {
    try {
      const rows = await computeStats(ds);
      const payload = { dataset: ds, period: `${REF_START}-${REF_END}`, rows };
      cache[ds] = payload;
      return payload;
    } finally {
      delete inflight[ds];
    }
  })();

  return inflight[ds];
}

module.exports = { getGczTempStats };
