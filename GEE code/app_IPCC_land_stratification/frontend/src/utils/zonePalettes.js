/**
 * Zone color palettes for map legends.
 * Colors exactly match the SLD styles in getMapTiles.js / Visualization/CRU409/ scripts.
 */

export const GCZ_PALETTE = [
  { value: 1,  color: '#43896e', label: 'Tropical Wet' },
  { value: 2,  color: '#89ce65', label: 'Tropical Moist' },
  { value: 3,  color: '#f5f67a', label: 'Tropical Dry' },
  { value: 4,  color: '#72e0fe', label: 'Warm Temperate Moist' },
  { value: 5,  color: '#ffd381', label: 'Warm Temperate Dry' },
  { value: 6,  color: '#cef57a', label: 'Cool Temperate Moist' },
  { value: 7,  color: '#c29fd8', label: 'Cool Temperate Dry' },
  { value: 8,  color: '#9eaad7', label: 'Boreal Moist' },
  { value: 9,  color: '#d8d89f', label: 'Boreal Dry' },
  { value: 10, color: '#d7ffe8', label: 'Polar' },
];

export const GEZ_PALETTE = [
  // Tropical
  { value: 11, color: '#ce1d09', label: 'Tropical Rain Forest' },
  { value: 12, color: '#DB4A2A', label: 'Tropical Moist Forest' },
  { value: 13, color: '#E36B49', label: 'Tropical Dry Forest' },
  { value: 14, color: '#F0A888', label: 'Tropical Shrubland' },
  { value: 15, color: '#FADDCC', label: 'Tropical Desert' },
  // Subtropical
  { value: 21, color: '#f19137', label: 'Subtropical Rain Forest' },
  { value: 22, color: '#F5AE6C', label: 'Subtropical Moist Forest' },
  { value: 23, color: '#F7BD87', label: 'Subtropical Dry Forest' },
  { value: 24, color: '#F9CCA2', label: 'Subtropical Shrubland' },
  { value: 25, color: '#FCE9D7', label: 'Subtropical Desert' },
  // Warm Temperate
  { value: 31, color: '#ffde4a', label: 'Warm Temperate Rain Forest' },
  { value: 32, color: '#FFE77A', label: 'Warm Temperate Moist Forest' },
  { value: 33, color: '#FFEB92', label: 'Warm Temperate Dry Forest' },
  { value: 34, color: '#FFF0AB', label: 'Warm Temperate Shrubland' },
  { value: 35, color: '#FFF8DB', label: 'Warm Temperate Desert' },
  // Cool Temperate
  { value: 41, color: '#9ec200', label: 'Cool Temperate Rain/Wet Forest' },
  { value: 42, color: '#BDD652', label: 'Cool Temperate Moist Forest' },
  { value: 43, color: '#CDDF7A', label: 'Cool Temperate Steppe' },
  { value: 44, color: '#ECF3CC', label: 'Cool Temperate Desert' },
  // Boreal
  { value: 51, color: '#009837', label: 'Boreal Rain/Wet Forest' },
  { value: 52, color: '#66C187', label: 'Boreal Moist Forest' },
  { value: 53, color: '#99D6AF', label: 'Boreal Dry Scrub' },
  { value: 54, color: '#CCEAD7', label: 'Boreal Desert' },
  // Subpolar
  { value: 61, color: '#00add6', label: 'Subpolar Rain/Wet Tundra' },
  { value: 62, color: '#88D9EC', label: 'Subpolar Moist Tundra' },
  { value: 63, color: '#CCE8FB', label: 'Subpolar Dry Tundra' },
  // Polar
  { value: 71, color: '#1451a0', label: 'Polar' },
];

export const HLZII_PALETTE = [
  // Tropical
  { value: 11, color: '#C71D31', label: 'Tropical Rain Forest' },
  { value: 12, color: '#CC2836', label: 'Tropical Wet Forest' },
  { value: 13, color: '#D8503A', label: 'Tropical Moist Forest' },
  { value: 14, color: '#E47060', label: 'Tropical Dry Forest' },
  { value: 15, color: '#EE9080', label: 'Tropical Very Dry Forest' },
  { value: 16, color: '#F4B0A0', label: 'Tropical Thorn Woodland' },
  { value: 17, color: '#F8CCC0', label: 'Tropical Desert Scrub' },
  { value: 18, color: '#FDDCD9', label: 'Tropical Desert' },
  // Subtropical
  { value: 21, color: '#F17C1D', label: 'Subtropical Rain Forest' },
  { value: 22, color: '#F3883A', label: 'Subtropical Wet Forest' },
  { value: 23, color: '#F59555', label: 'Subtropical Moist Forest' },
  { value: 24, color: '#F8A870', label: 'Subtropical Dry Forest' },
  { value: 25, color: '#FABB8C', label: 'Subtropical Thorn Woodland' },
  { value: 26, color: '#FCCFAD', label: 'Subtropical Desert Scrub' },
  { value: 27, color: '#FEE3CE', label: 'Subtropical Desert' },
  // Warm Temperate
  { value: 31, color: '#FFDD00', label: 'Warm Temperate Rain Forest' },
  { value: 32, color: '#FFE11B', label: 'Warm Temperate Wet Forest' },
  { value: 33, color: '#FFE636', label: 'Warm Temperate Moist Forest' },
  { value: 34, color: '#FFEA55', label: 'Warm Temperate Dry Forest' },
  { value: 35, color: '#FFF070', label: 'Warm Temperate Thorn Woodland' },
  { value: 36, color: '#FFF5AA', label: 'Warm Temperate Desert Scrub' },
  { value: 37, color: '#FFFACC', label: 'Warm Temperate Desert' },
  // Cool Temperate
  { value: 41, color: '#74A900', label: 'Cool Temperate Rain Forest' },
  { value: 42, color: '#92BB22', label: 'Cool Temperate Wet Forest' },
  { value: 43, color: '#B0CD44', label: 'Cool Temperate Moist Forest' },
  { value: 44, color: '#CEDF66', label: 'Cool Temperate Steppe' },
  { value: 45, color: '#DCEC99', label: 'Cool Temperate Desert Scrub' },
  { value: 46, color: '#EBF5BB', label: 'Cool Temperate Desert' },
  // Boreal
  { value: 51, color: '#009F49', label: 'Boreal Rain Forest' },
  { value: 52, color: '#33B36A', label: 'Boreal Wet Forest' },
  { value: 53, color: '#66C88B', label: 'Boreal Moist Forest' },
  { value: 54, color: '#99DCAC', label: 'Boreal Dry Scrub' },
  { value: 55, color: '#CCF0CD', label: 'Boreal Desert' },
  // Subpolar
  { value: 61, color: '#0088D6', label: 'Subpolar Rain Tundra' },
  { value: 62, color: '#44A8E3', label: 'Subpolar Wet Tundra' },
  { value: 63, color: '#88C8F0', label: 'Subpolar Moist Tundra' },
  { value: 64, color: '#CCE8F7', label: 'Subpolar Dry Tundra' },
  // Polar
  { value: 71, color: '#1451a0', label: 'Polar' },
];

// HLZ III legend groups by latitudinal belt (compact display for 120+ zones)
// Colors sourced from GEZ_LEVEL_3symbology.lyrx (ArcGIS Pro CIM, v3.1).
// Pattern-fill nival deserts (no solid fill in lyrx) use a very light tint of their belt colour.
// Classes with no colour assigned in the lyrx (Tropical/Warm-Temperate Montane zones) retain
// the previously defined colours.
export const HLZIII_PALETTE_GROUPS = [
  {
    group: 'Tropical (1xx)',
    entries: [
      // Base belt — red gradient (wet → dry)
      { value: 111, color: '#B91A08', label: 'Tropical Rain Forest' },
      { value: 112, color: '#CE1D09', label: 'Tropical Wet Forest' },
      { value: 113, color: '#D53B2A', label: 'Tropical Moist Forest' },
      { value: 114, color: '#DB594B', label: 'Tropical Dry Forest' },
      { value: 115, color: '#E2776B', label: 'Tropical Very Dry Forest' },
      { value: 116, color: '#E8968C', label: 'Tropical Thorn Woodland' },
      { value: 117, color: '#EFB4AD', label: 'Tropical Desert Scrub' },
      { value: 118, color: '#F5D2CE', label: 'Tropical Desert' },
      // Premontane — same red gradient as base belt
      { value: 121, color: '#B91A08', label: 'Tropical Premontane Rain Forest' },
      { value: 122, color: '#CE1D09', label: 'Tropical Premontane Wet Forest' },
      { value: 123, color: '#D53B2A', label: 'Tropical Premontane Moist Forest' },
      { value: 124, color: '#DB594B', label: 'Tropical Premontane Dry Forest' },
      { value: 125, color: '#E2776B', label: 'Tropical Premontane Thorn Woodland' },
      { value: 126, color: '#E8968C', label: 'Tropical Premontane Desert Scrub' },
      { value: 127, color: '#EFB4AD', label: 'Tropical Premontane Desert' },
      // Lower Montane — same red gradient as base belt (altitude shown by hatch pattern)
      { value: 131, color: '#B91A08', label: 'Tropical Lower Montane Rain Forest' },
      { value: 132, color: '#CE1D09', label: 'Tropical Lower Montane Wet Forest' },
      { value: 133, color: '#D53B2A', label: 'Tropical Lower Montane Moist Forest' },
      { value: 134, color: '#DB594B', label: 'Tropical Lower Montane Dry Forest' },
      { value: 135, color: '#E2776B', label: 'Tropical Lower Montane Thorn Woodland' },
      { value: 136, color: '#E8968C', label: 'Tropical Lower Montane Desert Scrub' },
      { value: 137, color: '#EFB4AD', label: 'Tropical Lower Montane Desert' },
      // Montane — same red gradient as base belt (altitude shown by hatch pattern)
      { value: 141, color: '#B91A08', label: 'Tropical Montane Rain Forest' },
      { value: 142, color: '#CE1D09', label: 'Tropical Montane Wet Forest' },
      { value: 143, color: '#D53B2A', label: 'Tropical Montane Moist Forest' },
      { value: 144, color: '#DB594B', label: 'Tropical Montane Steppe' },
      { value: 145, color: '#E2776B', label: 'Tropical Montane Desert Scrub' },
      { value: 146, color: '#E8968C', label: 'Tropical Montane Desert' },
      // Subalpine — same red gradient as base belt
      { value: 151, color: '#B91A08', label: 'Tropical Subalpine Rain Forest' },
      { value: 152, color: '#CE1D09', label: 'Tropical Subalpine Wet Forest' },
      { value: 153, color: '#D53B2A', label: 'Tropical Subalpine Moist Forest' },
      { value: 154, color: '#DB594B', label: 'Tropical Subalpine Dry Scrub' },
      { value: 155, color: '#E2776B', label: 'Tropical Subalpine Desert' },
      // Alpine — same red gradient as base belt (altitude shown by stipple pattern)
      { value: 161, color: '#B91A08', label: 'Tropical Alpine Rain Tundra' },
      { value: 162, color: '#CE1D09', label: 'Tropical Alpine Wet Tundra' },
      { value: 163, color: '#D53B2A', label: 'Tropical Alpine Moist Tundra' },
      { value: 164, color: '#DB594B', label: 'Tropical Alpine Desert' },
      // Nival — pattern fill in lyrx; very light tint
      { value: 171, color: '#FBF0EF', label: 'Tropical Nival Desert' },
    ],
  },
  {
    group: 'Subtropical (2xx)',
    entries: [
      // Base belt — orange gradient
      { value: 211, color: '#F19137', label: 'Subtropical Rain Forest' },
      { value: 212, color: '#F3A052', label: 'Subtropical Wet Forest' },
      { value: 213, color: '#F5AE6C', label: 'Subtropical Moist Forest' },
      { value: 214, color: '#F7BD87', label: 'Subtropical Dry Forest' },
      { value: 215, color: '#F9CCA2', label: 'Subtropical Thorn Woodland' },
      { value: 216, color: '#FADABC', label: 'Subtropical Desert Scrub' },
      { value: 217, color: '#FCE9D7', label: 'Subtropical Desert' },
      // Lower Montane — same orange gradient as base belt (altitude shown by hatch)
      { value: 221, color: '#F19137', label: 'Subtropical Lower Montane Rain Forest' },
      { value: 222, color: '#F3A052', label: 'Subtropical Lower Montane Wet Forest' },
      { value: 223, color: '#F5AE6C', label: 'Subtropical Lower Montane Moist Forest' },
      { value: 224, color: '#F7BD87', label: 'Subtropical Lower Montane Dry Forest' },
      { value: 225, color: '#F9CCA2', label: 'Subtropical Lower Montane Thorn Woodland' },
      { value: 226, color: '#FADABC', label: 'Subtropical Lower Montane Desert Scrub' },
      { value: 227, color: '#FCE9D7', label: 'Subtropical Lower Montane Desert' },
      // Montane — same orange gradient (altitude shown by hatch)
      { value: 231, color: '#F19137', label: 'Subtropical Montane Rain Forest' },
      { value: 232, color: '#F3A052', label: 'Subtropical Montane Wet Forest' },
      { value: 233, color: '#F5AE6C', label: 'Subtropical Montane Moist Forest' },
      { value: 234, color: '#F7BD87', label: 'Subtropical Montane Steppe' },
      { value: 235, color: '#F9CCA2', label: 'Subtropical Montane Desert Scrub' },
      { value: 236, color: '#FADABC', label: 'Subtropical Montane Desert' },
      // Subalpine — same orange gradient (altitude shown by stipple)
      { value: 241, color: '#F19137', label: 'Subtropical Subalpine Rain Forest' },
      { value: 242, color: '#F3A052', label: 'Subtropical Subalpine Wet Forest' },
      { value: 243, color: '#F5AE6C', label: 'Subtropical Subalpine Moist Forest' },
      { value: 244, color: '#F7BD87', label: 'Subtropical Subalpine Dry Scrub' },
      { value: 245, color: '#F9CCA2', label: 'Subtropical Subalpine Desert' },
      // Alpine — same orange gradient (altitude shown by stipple)
      { value: 251, color: '#F19137', label: 'Subtropical Alpine Rain Tundra' },
      { value: 252, color: '#F3A052', label: 'Subtropical Alpine Wet Tundra' },
      { value: 253, color: '#F5AE6C', label: 'Subtropical Alpine Moist Tundra' },
      { value: 254, color: '#F7BD87', label: 'Subtropical Alpine Desert' },
      { value: 261, color: '#FEF6EE', label: 'Subtropical Nival Desert' },
    ],
  },
  {
    group: 'Warm Temperate (3xx)',
    entries: [
      // Base belt — yellow gradient
      { value: 311, color: '#FFDE4A', label: 'Warm Temperate Rain Forest' },
      { value: 312, color: '#FFDE4A', label: 'Warm Temperate Wet Forest' },
      { value: 313, color: '#FFE77A', label: 'Warm Temperate Moist Forest' },
      { value: 314, color: '#FFEB92', label: 'Warm Temperate Dry Forest' },
      { value: 315, color: '#FFF0AB', label: 'Warm Temperate Thorn Woodland' },
      { value: 316, color: '#FFF4C3', label: 'Warm Temperate Desert Scrub' },
      { value: 317, color: '#FFF8DB', label: 'Warm Temperate Desert' },
      // Montane — same yellow gradient as base belt (altitude shown by hatch)
      { value: 321, color: '#FFDE4A', label: 'Warm Temperate Montane Rain Forest' },
      { value: 322, color: '#FFDE4A', label: 'Warm Temperate Montane Wet Forest' },
      { value: 323, color: '#FFE77A', label: 'Warm Temperate Montane Moist Forest' },
      { value: 324, color: '#FFEB92', label: 'Warm Temperate Montane Steppe' },
      { value: 325, color: '#FFF0AB', label: 'Warm Temperate Montane Desert Scrub' },
      { value: 326, color: '#FFF4C3', label: 'Warm Temperate Montane Desert' },
      // Subalpine — same yellow gradient (altitude shown by stipple)
      { value: 331, color: '#FFDE4A', label: 'Warm Temperate Subalpine Rain Forest' },
      { value: 332, color: '#FFDE4A', label: 'Warm Temperate Subalpine Wet Forest' },
      { value: 333, color: '#FFE77A', label: 'Warm Temperate Subalpine Moist Forest' },
      { value: 334, color: '#FFEB92', label: 'Warm Temperate Subalpine Dry Scrub' },
      { value: 335, color: '#FFF0AB', label: 'Warm Temperate Subalpine Desert' },
      // Alpine — same yellow gradient (altitude shown by stipple)
      { value: 341, color: '#FFDE4A', label: 'Warm Temperate Alpine Rain Tundra' },
      { value: 342, color: '#FFDE4A', label: 'Warm Temperate Alpine Wet Tundra' },
      { value: 343, color: '#FFE77A', label: 'Warm Temperate Alpine Moist Tundra' },
      { value: 344, color: '#FFEB92', label: 'Warm Temperate Alpine Desert' },
      // Nival — pattern fill in lyrx; very light tint
      { value: 351, color: '#FFFDE0', label: 'Warm Temperate Nival Desert' },
    ],
  },
  {
    group: 'Cool Temperate (4xx)',
    entries: [
      // Base belt — yellow-green gradient
      { value: 411, color: '#74A900', label: 'Cool Temperate Rain Forest' },
      { value: 412, color: '#8EBF23', label: 'Cool Temperate Wet Forest' },
      { value: 413, color: '#A7D641', label: 'Cool Temperate Moist Forest' },
      { value: 414, color: '#CDDF7A', label: 'Cool Temperate Steppe' },
      { value: 415, color: '#D7E78F', label: 'Cool Temperate Desert Scrub' },
      { value: 416, color: '#ECF3CC', label: 'Cool Temperate Desert' },
      // Subalpine — same yellow-green gradient as base
      { value: 421, color: '#74A900', label: 'Cool Temperate Subalpine Rain Forest' },
      { value: 422, color: '#8EBF23', label: 'Cool Temperate Subalpine Wet Forest' },
      { value: 423, color: '#A7D641', label: 'Cool Temperate Subalpine Moist Forest' },
      { value: 424, color: '#CDDF7A', label: 'Cool Temperate Subalpine Dry Scrub' },
      { value: 425, color: '#D7E78F', label: 'Cool Temperate Subalpine Desert' },
      // Alpine — same yellow-green gradient as base
      { value: 431, color: '#74A900', label: 'Cool Temperate Alpine Rain Tundra' },
      { value: 432, color: '#8EBF23', label: 'Cool Temperate Alpine Wet Tundra' },
      { value: 433, color: '#A7D641', label: 'Cool Temperate Alpine Moist Tundra' },
      { value: 434, color: '#CDDF7A', label: 'Cool Temperate Alpine Desert' },
      // Nival — pattern fill in lyrx; very light tint
      { value: 441, color: '#F2F9E8', label: 'Cool Temperate Nival Desert' },
    ],
  },
  {
    group: 'Boreal (5xx)',
    entries: [
      // Base belt — green gradient
      { value: 511, color: '#009F49', label: 'Boreal Rain Forest' },
      { value: 512, color: '#33AD5F', label: 'Boreal Wet Forest' },
      { value: 513, color: '#66C187', label: 'Boreal Moist Forest' },
      { value: 514, color: '#99D6AF', label: 'Boreal Dry Scrub' },
      { value: 515, color: '#CCEAD7', label: 'Boreal Desert' },
      // Alpine — same green gradient as base belt (altitude shown by stipple)
      { value: 521, color: '#009F49', label: 'Boreal Alpine Rain Tundra' },
      { value: 522, color: '#33AD5F', label: 'Boreal Alpine Wet Tundra' },
      { value: 523, color: '#66C187', label: 'Boreal Alpine Moist Tundra' },
      { value: 524, color: '#99D6AF', label: 'Boreal Alpine Desert' },
      // Nival — pattern fill in lyrx; very light tint
      { value: 531, color: '#EBF7F0', label: 'Boreal Nival Desert' },
    ],
  },
  {
    group: 'Subpolar / Polar (6xx–7xx)',
    entries: [
      // Blue gradient (wet → dry)
      { value: 611, color: '#0088D6', label: 'Subpolar Rain Tundra' },
      { value: 612, color: '#43A7E0', label: 'Subpolar Wet Tundra' },
      { value: 613, color: '#88C1E6', label: 'Subpolar Moist Tundra' },
      { value: 614, color: '#CCE8FB', label: 'Subpolar Desert' },
      // Nival — pattern fill in lyrx; very light tint
      { value: 621, color: '#EEF5FD', label: 'Subpolar Nival Desert' },
      { value: 711, color: '#1451A0', label: 'Polar' },
    ],
  },
];

// Flat lookup: value → color for all HLZ III entries
export const HLZIII_PALETTE = HLZIII_PALETTE_GROUPS.flatMap((g) => g.entries);

// Layer metadata used by the UI
export const LAYER_CONFIG = {
  gcz: {
    key: 'gcz',
    label: 'GCZ — Global Climate Zones',
    palette: GCZ_PALETTE,
    groups: null,
  },
  gez: {
    key: 'gez',
    label: 'GEZ — Global Ecological Zones (HLZ I)',
    palette: GEZ_PALETTE,
    groups: null,
  },
  hlzII: {
    key: 'hlzII',
    label: 'HLZ II — Holdridge Life Zones Level II',
    palette: HLZII_PALETTE,
    groups: null,
  },
  hlzIII: {
    key: 'hlzIII',
    label: 'HLZ III — Holdridge Life Zones Level III',
    palette: HLZIII_PALETTE,
    groups: HLZIII_PALETTE_GROUPS,
  },
  soil: {
    key: 'soil',
    label: 'Soil — IPCC soil types',
    palette: [
      { value: 1, color: '#A66F03', label: 'HAC' },
      { value: 2, color: '#FFD27F', label: 'LAC' },
      { value: 3, color: '#FFFFBD', label: 'Sandy soils' },
      { value: 4, color: '#D7D69D', label: 'Spodic' },
      { value: 5, color: '#0083A8', label: 'Volcanic soils' },
      { value: 6, color: '#8303A7', label: 'Wetland soils' },
      { value: 7, color: '#2A7200', label: 'Organic' },
      { value: 8, color: '#BDE7FF', label: 'Water' },
    ],
    groups: null,
  },
};

/** Returns { color, label } for a zone value in a given layer, or null if not found. */
export function getZoneColor(layerKey, value) {
  const cfg = LAYER_CONFIG[layerKey];
  if (!cfg) return null;
  return cfg.palette.find((e) => e.value === value) || null;
}
