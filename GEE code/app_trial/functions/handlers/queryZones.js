/**
 * Query Zone Classification Handler
 * Returns GCZ, GEZ, HLZ II, HLZ III values at a given point
 * Supports 'cru' (default) and 'terraclimate' datasets.
 */

const ee = require('@google/earthengine');
const {
  labelMap_hlzIII,
  labelMap_hlzII,
  labelMap_gez,
  labelMap_gcz,
  formatGEZCode,
} = require('../utils/labelMaps');
const { labelMap_soil } = require('../utils/labelMaps');
const {
  computeHLZ,
  HLZ_FROM,
  GCZ_TO,
  GEZ_TO,
  HLZII_TO,
  GCZ_LOOKUP,
  GEZ_LOOKUP,
  HLZII_LOOKUP,
} = require('./tcHelpers');

// Default period used for TerraClimate zone classification
const TC_ZONE_START = 1995;
const TC_ZONE_END   = 2024;

/**
 * Query zone classifications at a point
 * @param {number} lon - Longitude
 * @param {number} lat - Latitude
 * @param {string} [dataset='cru'] - 'cru' or 'terraclimate'
 * @returns {Promise<object>} Zone classification data
 */
async function queryZones(lon, lat, dataset = 'cru') {
  // Validate coordinates
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error('Invalid coordinates: lon must be -180 to 180, lat -90 to 90');
  }

  const point = ee.Geometry.Point([lon, lat]);

  // ── Soil query (shared for both datasets) ──────────────────────────────────
  const soil = ee.Image('projects/ee-maidiesinitam/assets/soilTypes/ipccFromHWSD2')
    .remap([1,2,3,4,5,6,7,8,9,10,11,12,13],[7,1,2,8,7,4,8,3,8,5,6,8,8]);

  const soilResultPromise = new Promise((resolve, reject) => {
    soil.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 30,
      bestEffort: true
    }).evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  if (dataset === 'terraclimate') {
    // ── TerraClimate: compute HLZ III on-the-fly, derive others by JS lookup ──
    const hlzImage = computeHLZ(TC_ZONE_START, TC_ZONE_END);

    const hlzResult = await new Promise((resolve, reject) => {
      hlzImage.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: 1000,
        bestEffort: true,
      }).evaluate((result, err) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const soilResult = await soilResultPromise;

    // HLZ III: the single band from computeHLZ has name 'constant' after all the .add() chain
    let valueHlzIII = null;
    if (hlzResult) {
      for (const k in hlzResult) { valueHlzIII = hlzResult[k]; break; }
    }
    const labelHlzIII = valueHlzIII !== null ? labelMap_hlzIII[valueHlzIII] : 'No data';

    // Derive GCZ, GEZ, HLZ II from the HLZ III code via JS lookup
    const valueGcz  = valueHlzIII !== null ? (GCZ_LOOKUP[valueHlzIII]  ?? null) : null;
    const valueGez  = valueHlzIII !== null ? (GEZ_LOOKUP[valueHlzIII]  ?? null) : null;
    const valueHlzII = valueHlzIII !== null ? (HLZII_LOOKUP[valueHlzIII] ?? null) : null;

    const labelGcz  = valueGcz  !== null ? labelMap_gcz[valueGcz]  : 'No data';
    const labelGez  = valueGez  !== null ? labelMap_gez[valueGez]  : 'No data';
    const gezCode   = valueGez  !== null ? formatGEZCode(valueGez) : 'No data';
    const labelHlzII = valueHlzII !== null ? labelMap_hlzII[valueHlzII] : 'No data';

    let valueSoil = null;
    if (soilResult) { for (const k in soilResult) { valueSoil = soilResult[k]; break; } }
    const labelSoil = valueSoil !== null ? labelMap_soil[valueSoil] : 'No data';

    return {
      lon, lat, dataset: 'terraclimate',
      gcz:   { value: valueGcz,   label: labelGcz },
      gez:   { value: valueGez,   label: labelGez, code: gezCode },
      hlzII: { value: valueHlzII, label: labelHlzII },
      hlzIII:{ value: valueHlzIII,label: labelHlzIII },
      soil:  { value: valueSoil,  label: labelSoil },
    };
  }

  // ── CRU (default): use pre-computed GEE assets ─────────────────────────────
  // Reference GEE assets (update these with your project paths)
  const hlzIII = ee.Image('projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZIII_1995-2024_CRU409');
  const hlzII = ee.Image('projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZII_1995-2024_CRU409');
  const gez = ee.Image('projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalEcologicalZones_HLZI_1995-2024_CRU409');
  const gcz = ee.Image('projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalClimateZones_1995-2024_CRU409');

  // Query GCZ
  const gczResult = await new Promise((resolve, reject) => {
    gcz.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 30,
      bestEffort: true
    }).evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  const valueGcz = gczResult ? gczResult.remapped : null;
  const labelGcz = valueGcz !== null ? labelMap_gcz[valueGcz] : 'No data';

  // Query GEZ
  const gezResult = await new Promise((resolve, reject) => {
    gez.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 30,
      bestEffort: true
    }).evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  const valueGez = gezResult ? gezResult.remapped : null;
  const labelGez = valueGez !== null ? labelMap_gez[valueGez] : 'No data';
  const gezCode = valueGez !== null ? formatGEZCode(valueGez) : 'No data';

  // Query HLZ II
  const hlzIIResult = await new Promise((resolve, reject) => {
    hlzII.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 30,
      bestEffort: true
    }).evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  const valueHlzII = hlzIIResult ? hlzIIResult.remapped : null;
  const labelHlzII = valueHlzII !== null ? labelMap_hlzII[valueHlzII] : 'No data';

  // Query HLZ III
  const hlzIIIResult = await new Promise((resolve, reject) => {
    hlzIII.select('biotemperature').reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 30,
      bestEffort: true
    }).evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  const valueHlzIII = hlzIIIResult ? hlzIIIResult.biotemperature : null;
  const labelHlzIII = valueHlzIII !== null ? labelMap_hlzIII[valueHlzIII] : 'No data';

  const soilResult = await soilResultPromise;

  let valueSoil = null;
  if (soilResult) {
    for (const k in soilResult) { valueSoil = soilResult[k]; break; }
  }
  const labelSoil = valueSoil !== null ? labelMap_soil[valueSoil] : 'No data';

  return {
    lon,
    lat,
    dataset: 'cru',
    gcz: {
      value: valueGcz,
      label: labelGcz,
    },
    gez: {
      value: valueGez,
      label: labelGez,
      code: gezCode,
    },
    hlzII: {
      value: valueHlzII,
      label: labelHlzII,
    },
    hlzIII: {
      value: valueHlzIII,
      label: labelHlzIII,
    },
    soil: {
      value: valueSoil,
      label: labelSoil,
    },
  };
}

module.exports = { queryZones };
