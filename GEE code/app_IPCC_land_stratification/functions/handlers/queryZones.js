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

// Precomputed published assets — MUST match the asset paths used by
// getMapTiles.js so that point-queried zone codes match the rendered tiles.
const ZONE_ASSETS = {
  cru: {
    gcz:    'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalClimateZones_1995-2024_CRU409_final',
    gez:    'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GEZ_HLZ_Level1_CRU409_1995-2024_final',
    hlzII:  'projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZ_Level2_CRU409_1995-2024_final',
    hlzIII: 'projects/ee-philaudebert/assets/HoldridgeLifeZones/HoldridgeLifeZones_Level3_CRU409_1995-2024_final',
  },
  terraclimate: {
    gcz:    'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalClimateZones_1995-2024_TerraClimate',
    gez:    'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GEZ_HLZ_Level1_TerraClimate_1995-2024',
    hlzII:  'projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZ_Level2_TerraClimate_1995-2024',
    hlzIII: 'projects/ee-philaudebert/assets/HoldridgeLifeZones/HoldridgeLifeZones_Level3_TerraClimate_1995-2024',
  },
};

// Sample an integer-classification image at a point using the image's own
// native projection. This matches the projection used during tile rendering,
// so the value returned here is the same code the tile pixel was coloured by.
function samplePointInt(image, point) {
  return new Promise((resolve, reject) => {
    const proj = image.projection();
    image.toInt().reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      crs: proj,
      scale: proj.nominalScale(),
      bestEffort: true,
    }).evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Extract the first numeric value from a reduceRegion result dict.
function firstValue(result) {
  if (!result) return null;
  for (const k in result) {
    const v = result[k];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

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
  const ds = (dataset === 'terraclimate') ? 'terraclimate' : 'cru';
  const a  = ZONE_ASSETS[ds];

  // ── Soil query (shared for both datasets) ──────────────────────────────────
  const soil = ee.Image('projects/ee-maidiesinitam/assets/soilTypes/ipccFromHWSD2')
    .remap([1,2,3,4,5,6,7,8,9,10,11,12,13],[7,1,2,8,7,4,8,3,8,5,6,8,8]);

  const soilResultPromise = new Promise((resolve, reject) => {
    soil.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 30,
      bestEffort: true,
    }).evaluate((result, err) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

  // ── Sample each zone classification directly from the published assets ────
  // Sampling each layer independently (rather than deriving GCZ/GEZ/HLZ II
  // from HLZ III via a JS lookup) guarantees that the value returned at the
  // point matches the colour shown by the corresponding tile layer.
  const gczImage    = ee.Image(a.gcz);
  const gezImage    = ee.Image(a.gez);
  const hlzIIImage  = ee.Image(a.hlzII);
  const hlzIIIImage = ee.Image(a.hlzIII);

  const [gczResult, gezResult, hlzIIResult, hlzIIIResult, soilResult] = await Promise.all([
    samplePointInt(gczImage,    point),
    samplePointInt(gezImage,    point),
    samplePointInt(hlzIIImage,  point),
    samplePointInt(hlzIIIImage, point),
    soilResultPromise,
  ]);

  const valueGcz    = firstValue(gczResult);
  const valueGez    = firstValue(gezResult);
  const valueHlzII  = firstValue(hlzIIResult);
  const valueHlzIII = firstValue(hlzIIIResult);
  const valueSoil   = firstValue(soilResult);

  const labelGcz    = valueGcz    !== null ? (labelMap_gcz[valueGcz]      || 'No data') : 'No data';
  const labelGez    = valueGez    !== null ? (labelMap_gez[valueGez]      || 'No data') : 'No data';
  const gezCode     = valueGez    !== null ? formatGEZCode(valueGez)                    : 'No data';
  const labelHlzII  = valueHlzII  !== null ? (labelMap_hlzII[valueHlzII]  || 'No data') : 'No data';
  const labelHlzIII = valueHlzIII !== null ? (labelMap_hlzIII[valueHlzIII]|| 'No data') : 'No data';
  const labelSoil   = valueSoil   !== null ? (labelMap_soil[valueSoil]    || 'No data') : 'No data';

  return {
    lon, lat, dataset: ds,
    gcz:   { value: valueGcz,    label: labelGcz },
    gez:   { value: valueGez,    label: labelGez, code: gezCode },
    hlzII: { value: valueHlzII,  label: labelHlzII },
    hlzIII:{ value: valueHlzIII, label: labelHlzIII },
    soil:  { value: valueSoil,   label: labelSoil },
  };
}

module.exports = { queryZones };
