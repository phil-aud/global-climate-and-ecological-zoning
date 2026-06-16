/**
 * Published GIS data products (GCZ / GEZ / HLZ) for download.
 *
 * The heavy raster/vector files are NOT shipped inside the app or the GitHub
 * repo. They live in an archival, citable data repository (Zenodo) so that
 * downloads need no account (unlike Earth Engine assets) and the dataset has a
 * permanent DOI for the paper.
 *
 * ─── TO PUBLISH ──────────────────────────────────────────────────────────────
 * 1. Upload the files in local-only/Output/ to a Zenodo record.
 * 2. Set ZENODO_RECORD_ID to the numeric record id and ZENODO_DOI to the DOI.
 * 3. Flip DATA_PUBLISHED to true.
 * 4. Confirm each product's `tif` / `zip` filename below matches the name Zenodo
 *    assigned to the uploaded file (Zenodo may rewrite some characters).
 * Until then the UI shows an "available upon publication" notice instead of
 * dead links.
 */

// Placeholder — replace with the real Zenodo record once deposited.
export const ZENODO_RECORD_ID = '0000000';
export const ZENODO_DOI = '10.5281/zenodo.0000000';
export const DATA_PUBLISHED = false;

export const ZENODO_RECORD_URL = `https://zenodo.org/records/${ZENODO_RECORD_ID}`;
export const ZENODO_DOI_URL = `https://doi.org/${ZENODO_DOI}`;

/** Build a direct download URL for a file in the Zenodo record. */
export function fileUrl(filename) {
  return `${ZENODO_RECORD_URL}/files/${encodeURIComponent(filename)}?download=1`;
}

/**
 * Products are keyed by climatology (matching the app's `dataset` selector:
 * 'cru' → CRU TS 4.09 IPCC default, 'terraclimate' → TerraClimate). Each entry
 * lists the descriptive GeoTIFF and zipped-shapefile filenames as published.
 */
export const DATA_PRODUCTS = {
  cru: {
    label: 'CRU TS 4.09 (IPCC default, ~55 km)',
    products: [
      {
        key: 'gcz',
        name: 'Global Climate Zones (GCZ)',
        tif: 'IPCC_GlobalClimateZones(GCZ)_1995-2024_CRU409.tif',
        zip: 'IPCC_GlobalClimateZones(GCZ)_CRU409_1995-2024.zip',
      },
      {
        key: 'gez',
        name: 'Global Ecological Zones (GEZ) — HLZ Level I',
        tif: 'IPCC_GlobalEcologicalZones(GEZ)__HLZ_Level1_CRU409_1995-2024.tif',
        zip: 'IPCC_GlobalEcologicalZones(GEZ)__HLZ_Level1_CRU409_1995-2024.zip',
      },
      {
        key: 'hlz2',
        name: 'Holdridge Life Zones — Level II',
        tif: 'HoldridgeLifeZones(HLZ)_Level2_CRU409_1995-2024.tif',
        zip: 'IPCC_HoldridgeLifeZones(HLZ)_Level2_CRU409_1995-2024.zip',
      },
      {
        key: 'hlz3',
        name: 'Holdridge Life Zones — Level III',
        tif: 'HoldridgeLifeZones(HLZ)_Level3_CRU409_1995-2024.tif',
        zip: 'IPCC_HoldridgeLifeZones(HLZ)_Level3_CRU409_1995-2024.zip',
      },
    ],
  },
  terraclimate: {
    label: 'TerraClimate (~5 km)',
    products: [
      {
        key: 'gcz',
        name: 'Global Climate Zones (GCZ)',
        tif: 'IPCC_GlobalClimateZones(GCZ)_1995-2024_TerraClimate.tif',
        zip: 'GlobalClimateZones(GCZ)_TerraClimate_1995-2024.zip',
      },
      {
        key: 'gez',
        name: 'Global Ecological Zones (GEZ) — HLZ Level I',
        tif: 'IPCC_GlobalEcologicalZones(GEZ)__HLZ_Level1_TerraClimate_1995-2024.tif',
        zip: 'GlobalEcologicalZones(GEZ)__HLZ_Level1_TerraClimate_1995-2024.zip',
      },
      {
        key: 'hlz2',
        name: 'Holdridge Life Zones — Level II',
        tif: 'HoldridgeLifeZones(HLZ)_Level2_TerraClimate_1995-2024.tif',
        zip: 'HoldridgeLifeZones(HLZ)_Level2_TerraClimate_1995-2024.zip',
      },
      {
        key: 'hlz3',
        name: 'Holdridge Life Zones — Level III',
        tif: 'HoldridgeLifeZones(HLZ)_Level3_TerraClimate_1995-2024.tif',
        zip: 'HoldridgeLifeZones(HLZ)_Level3_TerraClimate_1995-2024.zip',
      },
    ],
  },
};
