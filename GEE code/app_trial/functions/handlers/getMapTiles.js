/**
 * getMapTiles handler
 * Returns GEE tile URL templates for each zone classification layer.
 * Tiles are styled server-side using SLD intervals matching the GEE visualization scripts.
 * Accepts ?dataset=cru (default) or ?dataset=terraclimate
 */

const { getEarthEngine } = require('../services/geeClient');
const {
  computeHLZ,
  computeHLZ_CRU,
  HLZ_FROM,
  GCZ_TO,
  GEZ_TO,
  HLZII_TO,
} = require('./tcHelpers');

// Default period for TerraClimate tiles
const TC_TILE_START = 1995;
const TC_TILE_END   = 2024;

// Default period for CRU tiles
const CRU_TILE_START = 1995;
const CRU_TILE_END   = 2024;

// ── SLD styles (match the GEE visualization scripts in Visualization/CRU409/) ──

const SLD_GCZ =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false">' +
      '<ColorMapEntry color="#43896e" quantity="1"  label="Tropical Wet"/>' +
      '<ColorMapEntry color="#89ce65" quantity="2"  label="Tropical Moist"/>' +
      '<ColorMapEntry color="#f5f67a" quantity="3"  label="Tropical Dry"/>' +
      '<ColorMapEntry color="#72e0fe" quantity="4"  label="Warm Temperate Moist"/>' +
      '<ColorMapEntry color="#ffd381" quantity="5"  label="Warm Temperate Dry"/>' +
      '<ColorMapEntry color="#cef57a" quantity="6"  label="Cool Temperate Moist"/>' +
      '<ColorMapEntry color="#c29fd8" quantity="7"  label="Cool Temperate Dry"/>' +
      '<ColorMapEntry color="#9eaad7" quantity="8"  label="Boreal Moist"/>' +
      '<ColorMapEntry color="#d8d89f" quantity="9"  label="Boreal Dry"/>' +
      '<ColorMapEntry color="#d7ffe8" quantity="10" label="Polar"/>' +
    '</ColorMap>' +
  '</RasterSymbolizer>';

const SLD_GEZ =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false">' +
      '<ColorMapEntry color="#ce1d09" quantity="11" label="Tropical Rain Forest"/>' +
      '<ColorMapEntry color="#DB4A2A" quantity="12" label="Tropical Moist Forest"/>' +
      '<ColorMapEntry color="#E36B49" quantity="13" label="Tropical Dry Forest"/>' +
      '<ColorMapEntry color="#F0A888" quantity="14" label="Tropical Shrubland"/>' +
      '<ColorMapEntry color="#FADDCC" quantity="15" label="Tropical Desert"/>' +
      '<ColorMapEntry color="#f19137" quantity="21" label="Subtropical Rain Forest"/>' +
      '<ColorMapEntry color="#F5AE6C" quantity="22" label="Subtropical Moist Forest"/>' +
      '<ColorMapEntry color="#F7BD87" quantity="23" label="Subtropical Dry Forest"/>' +
      '<ColorMapEntry color="#F9CCA2" quantity="24" label="Subtropical Shrubland"/>' +
      '<ColorMapEntry color="#FCE9D7" quantity="25" label="Subtropical Desert"/>' +
      '<ColorMapEntry color="#ffde4a" quantity="31" label="Warm Temperate Rain Forest"/>' +
      '<ColorMapEntry color="#FFE77A" quantity="32" label="Warm Temperate Moist Forest"/>' +
      '<ColorMapEntry color="#FFEB92" quantity="33" label="Warm Temperate Dry Forest"/>' +
      '<ColorMapEntry color="#FFF0AB" quantity="34" label="Warm Temperate Shrubland"/>' +
      '<ColorMapEntry color="#FFF8DB" quantity="35" label="Warm Temperate Desert"/>' +
      '<ColorMapEntry color="#9ec200" quantity="41" label="Cool Temperate Rain/Wet Forest"/>' +
      '<ColorMapEntry color="#BDD652" quantity="42" label="Cool Temperate Moist Forest"/>' +
      '<ColorMapEntry color="#CDDF7A" quantity="43" label="Cool Temperate Steppe"/>' +
      '<ColorMapEntry color="#ECF3CC" quantity="44" label="Cool Temperate Desert"/>' +
      '<ColorMapEntry color="#009837" quantity="51" label="Boreal Rain/Wet Forest"/>' +
      '<ColorMapEntry color="#66C187" quantity="52" label="Boreal Moist Forest"/>' +
      '<ColorMapEntry color="#99D6AF" quantity="53" label="Boreal Dry Scrub"/>' +
      '<ColorMapEntry color="#CCEAD7" quantity="54" label="Boreal Desert"/>' +
      '<ColorMapEntry color="#00add6" quantity="61" label="Subpolar Rain/Wet Tundra"/>' +
      '<ColorMapEntry color="#88D9EC" quantity="62" label="Subpolar Moist Tundra"/>' +
      '<ColorMapEntry color="#CCE8FB" quantity="63" label="Subpolar Dry Tundra"/>' +
      '<ColorMapEntry color="#1451a0" quantity="71" label="Polar"/>' +
    '</ColorMap>' +
  '</RasterSymbolizer>';

const SLD_HLZII =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false">' +
      '<ColorMapEntry color="#C71D31" quantity="11" label="Tropical Rain Forest"/>' +
      '<ColorMapEntry color="#CC2836" quantity="12" label="Tropical Wet Forest"/>' +
      '<ColorMapEntry color="#D8503A" quantity="13" label="Tropical Moist Forest"/>' +
      '<ColorMapEntry color="#E47060" quantity="14" label="Tropical Dry Forest"/>' +
      '<ColorMapEntry color="#EE9080" quantity="15" label="Tropical Very Dry Forest"/>' +
      '<ColorMapEntry color="#F4B0A0" quantity="16" label="Tropical Thorn Woodland"/>' +
      '<ColorMapEntry color="#F8CCC0" quantity="17" label="Tropical Desert Scrub"/>' +
      '<ColorMapEntry color="#FDDCD9" quantity="18" label="Tropical Desert"/>' +
      '<ColorMapEntry color="#F17C1D" quantity="21" label="Subtropical Rain Forest"/>' +
      '<ColorMapEntry color="#F3883A" quantity="22" label="Subtropical Wet Forest"/>' +
      '<ColorMapEntry color="#F59555" quantity="23" label="Subtropical Moist Forest"/>' +
      '<ColorMapEntry color="#F8A870" quantity="24" label="Subtropical Dry Forest"/>' +
      '<ColorMapEntry color="#FABB8C" quantity="25" label="Subtropical Thorn Woodland"/>' +
      '<ColorMapEntry color="#FCCFAD" quantity="26" label="Subtropical Desert Scrub"/>' +
      '<ColorMapEntry color="#FEE3CE" quantity="27" label="Subtropical Desert"/>' +
      '<ColorMapEntry color="#FFDD00" quantity="31" label="Warm Temperate Rain Forest"/>' +
      '<ColorMapEntry color="#FFE11B" quantity="32" label="Warm Temperate Wet Forest"/>' +
      '<ColorMapEntry color="#FFE636" quantity="33" label="Warm Temperate Moist Forest"/>' +
      '<ColorMapEntry color="#FFEA55" quantity="34" label="Warm Temperate Dry Forest"/>' +
      '<ColorMapEntry color="#FFF070" quantity="35" label="Warm Temperate Thorn Woodland"/>' +
      '<ColorMapEntry color="#FFF5AA" quantity="36" label="Warm Temperate Desert Scrub"/>' +
      '<ColorMapEntry color="#FFFACC" quantity="37" label="Warm Temperate Desert"/>' +
      '<ColorMapEntry color="#74A900" quantity="41" label="Cool Temperate Rain Forest"/>' +
      '<ColorMapEntry color="#92BB22" quantity="42" label="Cool Temperate Wet Forest"/>' +
      '<ColorMapEntry color="#B0CD44" quantity="43" label="Cool Temperate Moist Forest"/>' +
      '<ColorMapEntry color="#CEDF66" quantity="44" label="Cool Temperate Steppe"/>' +
      '<ColorMapEntry color="#DCEC99" quantity="45" label="Cool Temperate Desert Scrub"/>' +
      '<ColorMapEntry color="#EBF5BB" quantity="46" label="Cool Temperate Desert"/>' +
      '<ColorMapEntry color="#009F49" quantity="51" label="Boreal Rain Forest"/>' +
      '<ColorMapEntry color="#33B36A" quantity="52" label="Boreal Wet Forest"/>' +
      '<ColorMapEntry color="#66C88B" quantity="53" label="Boreal Moist Forest"/>' +
      '<ColorMapEntry color="#99DCAC" quantity="54" label="Boreal Dry Scrub"/>' +
      '<ColorMapEntry color="#CCF0CD" quantity="55" label="Boreal Desert"/>' +
      '<ColorMapEntry color="#0088D6" quantity="61" label="Subpolar Rain Tundra"/>' +
      '<ColorMapEntry color="#44A8E3" quantity="62" label="Subpolar Wet Tundra"/>' +
      '<ColorMapEntry color="#88C8F0" quantity="63" label="Subpolar Moist Tundra"/>' +
      '<ColorMapEntry color="#CCE8F7" quantity="64" label="Subpolar Dry Tundra"/>' +
      '<ColorMapEntry color="#1451a0" quantity="71" label="Polar"/>' +
    '</ColorMap>' +
  '</RasterSymbolizer>';

// Colors match GEZ_LEVEL_3symbology.lyrx (HSV/RGB → hex).
// GEE SLD raster rendering does not support pattern fills; colours only.
const SLD_HLZIII =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false">' +
      // Tropical base belt — dark red gradient (rain → desert)
      '<ColorMapEntry color="#B91A08" quantity="111" label="Tropical Rain Forest"/>' +
      '<ColorMapEntry color="#CE1D09" quantity="112" label="Tropical Wet Forest"/>' +
      '<ColorMapEntry color="#D53B2A" quantity="113" label="Tropical Moist Forest"/>' +
      '<ColorMapEntry color="#DB594B" quantity="114" label="Tropical Dry Forest"/>' +
      '<ColorMapEntry color="#E2776B" quantity="115" label="Tropical Very Dry Forest"/>' +
      '<ColorMapEntry color="#E8968C" quantity="116" label="Tropical Thorn Woodland"/>' +
      '<ColorMapEntry color="#EFB4AD" quantity="117" label="Tropical Desert Scrub"/>' +
      '<ColorMapEntry color="#F5D2CE" quantity="118" label="Tropical Desert"/>' +
      // Tropical Premontane — same red gradient with hatch overlay in lyrx
      '<ColorMapEntry color="#B91A08" quantity="121" label="Tropical Premontane Rain Forest"/>' +
      '<ColorMapEntry color="#CE1D09" quantity="122" label="Tropical Premontane Wet Forest"/>' +
      '<ColorMapEntry color="#D53B2A" quantity="123" label="Tropical Premontane Moist Forest"/>' +
      '<ColorMapEntry color="#DB594B" quantity="124" label="Tropical Premontane Dry Forest"/>' +
      '<ColorMapEntry color="#E2776B" quantity="125" label="Tropical Premontane Thorn Woodland"/>' +
      '<ColorMapEntry color="#E8968C" quantity="126" label="Tropical Premontane Desert Scrub"/>' +
      '<ColorMapEntry color="#EFB4AD" quantity="127" label="Tropical Premontane Desert"/>' +
      // Tropical Lower Montane — same red gradient as base belt (altitude shown by hatch pattern)
      '<ColorMapEntry color="#B91A08" quantity="131" label="Tropical Lower Montane Rain Forest"/>' +
      '<ColorMapEntry color="#CE1D09" quantity="132" label="Tropical Lower Montane Wet Forest"/>' +
      '<ColorMapEntry color="#D53B2A" quantity="133" label="Tropical Lower Montane Moist Forest"/>' +
      '<ColorMapEntry color="#DB594B" quantity="134" label="Tropical Lower Montane Dry Forest"/>' +
      '<ColorMapEntry color="#E2776B" quantity="135" label="Tropical Lower Montane Thorn Woodland"/>' +
      '<ColorMapEntry color="#E8968C" quantity="136" label="Tropical Lower Montane Desert Scrub"/>' +
      '<ColorMapEntry color="#EFB4AD" quantity="137" label="Tropical Lower Montane Desert"/>' +
      // Tropical Montane — same red gradient as base belt (altitude shown by hatch pattern)
      '<ColorMapEntry color="#B91A08" quantity="141" label="Tropical Montane Rain Forest"/>' +
      '<ColorMapEntry color="#CE1D09" quantity="142" label="Tropical Montane Wet Forest"/>' +
      '<ColorMapEntry color="#D53B2A" quantity="143" label="Tropical Montane Moist Forest"/>' +
      '<ColorMapEntry color="#DB594B" quantity="144" label="Tropical Montane Steppe"/>' +
      '<ColorMapEntry color="#E2776B" quantity="145" label="Tropical Montane Desert Scrub"/>' +
      '<ColorMapEntry color="#E8968C" quantity="146" label="Tropical Montane Desert"/>' +
      // Tropical Subalpine — same red gradient with stipple overlay in lyrx
      '<ColorMapEntry color="#B91A08" quantity="151" label="Tropical Subalpine Rain Forest"/>' +
      '<ColorMapEntry color="#CE1D09" quantity="152" label="Tropical Subalpine Wet Forest"/>' +
      '<ColorMapEntry color="#D53B2A" quantity="153" label="Tropical Subalpine Moist Forest"/>' +
      '<ColorMapEntry color="#DB594B" quantity="154" label="Tropical Subalpine Dry Scrub"/>' +
      '<ColorMapEntry color="#E2776B" quantity="155" label="Tropical Subalpine Desert"/>' +
      // Tropical Alpine — same red gradient as base belt (altitude shown by stipple pattern)
      '<ColorMapEntry color="#B91A08" quantity="161" label="Tropical Alpine Rain Tundra"/>' +
      '<ColorMapEntry color="#CE1D09" quantity="162" label="Tropical Alpine Wet Tundra"/>' +
      '<ColorMapEntry color="#D53B2A" quantity="163" label="Tropical Alpine Moist Tundra"/>' +
      '<ColorMapEntry color="#DB594B" quantity="164" label="Tropical Alpine Desert"/>' +
      // Tropical Nival — stipple-only (no fill) in lyrx; very light tint
      '<ColorMapEntry color="#FBF0EF" quantity="171" label="Tropical Nival Desert"/>' +
      // Subtropical base belt — orange gradient
      '<ColorMapEntry color="#F19137" quantity="211" label="Subtropical Rain Forest"/>' +
      '<ColorMapEntry color="#F3A052" quantity="212" label="Subtropical Wet Forest"/>' +
      '<ColorMapEntry color="#F5AE6C" quantity="213" label="Subtropical Moist Forest"/>' +
      '<ColorMapEntry color="#F7BD87" quantity="214" label="Subtropical Dry Forest"/>' +
      '<ColorMapEntry color="#F9CCA2" quantity="215" label="Subtropical Thorn Woodland"/>' +
      '<ColorMapEntry color="#FADABC" quantity="216" label="Subtropical Desert Scrub"/>' +
      '<ColorMapEntry color="#FCE9D7" quantity="217" label="Subtropical Desert"/>' +
      // Subtropical Lower Montane — same orange gradient as base belt (altitude shown by hatch)
      '<ColorMapEntry color="#F19137" quantity="221" label="Subtropical Lower Montane Rain Forest"/>' +
      '<ColorMapEntry color="#F3A052" quantity="222" label="Subtropical Lower Montane Wet Forest"/>' +
      '<ColorMapEntry color="#F5AE6C" quantity="223" label="Subtropical Lower Montane Moist Forest"/>' +
      '<ColorMapEntry color="#F7BD87" quantity="224" label="Subtropical Lower Montane Dry Forest"/>' +
      '<ColorMapEntry color="#F9CCA2" quantity="225" label="Subtropical Lower Montane Thorn Woodland"/>' +
      '<ColorMapEntry color="#FADABC" quantity="226" label="Subtropical Lower Montane Desert Scrub"/>' +
      '<ColorMapEntry color="#FCE9D7" quantity="227" label="Subtropical Lower Montane Desert"/>' +
      // Subtropical Montane — same orange gradient (altitude shown by hatch)
      '<ColorMapEntry color="#F19137" quantity="231" label="Subtropical Montane Rain Forest"/>' +
      '<ColorMapEntry color="#F3A052" quantity="232" label="Subtropical Montane Wet Forest"/>' +
      '<ColorMapEntry color="#F5AE6C" quantity="233" label="Subtropical Montane Moist Forest"/>' +
      '<ColorMapEntry color="#F7BD87" quantity="234" label="Subtropical Montane Steppe"/>' +
      '<ColorMapEntry color="#F9CCA2" quantity="235" label="Subtropical Montane Desert Scrub"/>' +
      '<ColorMapEntry color="#FADABC" quantity="236" label="Subtropical Montane Desert"/>' +
      // Subtropical Subalpine — same orange gradient (altitude shown by stipple)
      '<ColorMapEntry color="#F19137" quantity="241" label="Subtropical Subalpine Rain Forest"/>' +
      '<ColorMapEntry color="#F3A052" quantity="242" label="Subtropical Subalpine Wet Forest"/>' +
      '<ColorMapEntry color="#F5AE6C" quantity="243" label="Subtropical Subalpine Moist Forest"/>' +
      '<ColorMapEntry color="#F7BD87" quantity="244" label="Subtropical Subalpine Dry Scrub"/>' +
      '<ColorMapEntry color="#F9CCA2" quantity="245" label="Subtropical Subalpine Desert"/>' +
      // Subtropical Alpine — same orange gradient (altitude shown by stipple)
      '<ColorMapEntry color="#F19137" quantity="251" label="Subtropical Alpine Rain Tundra"/>' +
      '<ColorMapEntry color="#F3A052" quantity="252" label="Subtropical Alpine Wet Tundra"/>' +
      '<ColorMapEntry color="#F5AE6C" quantity="253" label="Subtropical Alpine Moist Tundra"/>' +
      '<ColorMapEntry color="#F7BD87" quantity="254" label="Subtropical Alpine Desert"/>' +
      '<ColorMapEntry color="#FEF6EE" quantity="261" label="Subtropical Nival Desert"/>' +
      // Warm Temperate base belt — yellow gradient
      '<ColorMapEntry color="#FFDE4A" quantity="311" label="Warm Temperate Rain Forest"/>' +
      '<ColorMapEntry color="#FFDE4A" quantity="312" label="Warm Temperate Wet Forest"/>' +
      '<ColorMapEntry color="#FFE77A" quantity="313" label="Warm Temperate Moist Forest"/>' +
      '<ColorMapEntry color="#FFEB92" quantity="314" label="Warm Temperate Dry Forest"/>' +
      '<ColorMapEntry color="#FFF0AB" quantity="315" label="Warm Temperate Thorn Woodland"/>' +
      '<ColorMapEntry color="#FFF4C3" quantity="316" label="Warm Temperate Desert Scrub"/>' +
      '<ColorMapEntry color="#FFF8DB" quantity="317" label="Warm Temperate Desert"/>' +
      // Warm Temperate Montane — same yellow gradient as base belt (altitude shown by hatch)
      '<ColorMapEntry color="#FFDE4A" quantity="321" label="Warm Temperate Montane Rain Forest"/>' +
      '<ColorMapEntry color="#FFDE4A" quantity="322" label="Warm Temperate Montane Wet Forest"/>' +
      '<ColorMapEntry color="#FFE77A" quantity="323" label="Warm Temperate Montane Moist Forest"/>' +
      '<ColorMapEntry color="#FFEB92" quantity="324" label="Warm Temperate Montane Steppe"/>' +
      '<ColorMapEntry color="#FFF0AB" quantity="325" label="Warm Temperate Montane Desert Scrub"/>' +
      '<ColorMapEntry color="#FFF4C3" quantity="326" label="Warm Temperate Montane Desert"/>' +
      // Warm Temperate Subalpine — same yellow gradient (altitude shown by stipple)
      '<ColorMapEntry color="#FFDE4A" quantity="331" label="Warm Temperate Subalpine Rain Forest"/>' +
      '<ColorMapEntry color="#FFDE4A" quantity="332" label="Warm Temperate Subalpine Wet Forest"/>' +
      '<ColorMapEntry color="#FFE77A" quantity="333" label="Warm Temperate Subalpine Moist Forest"/>' +
      '<ColorMapEntry color="#FFEB92" quantity="334" label="Warm Temperate Subalpine Dry Scrub"/>' +
      '<ColorMapEntry color="#FFF0AB" quantity="335" label="Warm Temperate Subalpine Desert"/>' +
      // Warm Temperate Alpine — same yellow gradient (altitude shown by stipple)
      '<ColorMapEntry color="#FFDE4A" quantity="341" label="Warm Temperate Alpine Rain Tundra"/>' +
      '<ColorMapEntry color="#FFDE4A" quantity="342" label="Warm Temperate Alpine Wet Tundra"/>' +
      '<ColorMapEntry color="#FFE77A" quantity="343" label="Warm Temperate Alpine Moist Tundra"/>' +
      '<ColorMapEntry color="#FFEB92" quantity="344" label="Warm Temperate Alpine Desert"/>' +
      // Warm Temperate Nival — stipple-only in lyrx; very light tint
      '<ColorMapEntry color="#FFFDE0" quantity="351" label="Warm Temperate Nival Desert"/>' +
      // Cool Temperate base belt — yellow-green gradient
      '<ColorMapEntry color="#74A900" quantity="411" label="Cool Temperate Rain Forest"/>' +
      '<ColorMapEntry color="#8EBF23" quantity="412" label="Cool Temperate Wet Forest"/>' +
      '<ColorMapEntry color="#A7D641" quantity="413" label="Cool Temperate Moist Forest"/>' +
      '<ColorMapEntry color="#CDDF7A" quantity="414" label="Cool Temperate Steppe"/>' +
      '<ColorMapEntry color="#D7E78F" quantity="415" label="Cool Temperate Desert Scrub"/>' +
      '<ColorMapEntry color="#ECF3CC" quantity="416" label="Cool Temperate Desert"/>' +
      // Cool Temperate Subalpine — same gradient with stipple in lyrx
      '<ColorMapEntry color="#74A900" quantity="421" label="Cool Temperate Subalpine Rain Forest"/>' +
      '<ColorMapEntry color="#8EBF23" quantity="422" label="Cool Temperate Subalpine Wet Forest"/>' +
      '<ColorMapEntry color="#A7D641" quantity="423" label="Cool Temperate Subalpine Moist Forest"/>' +
      '<ColorMapEntry color="#CDDF7A" quantity="424" label="Cool Temperate Subalpine Dry Scrub"/>' +
      '<ColorMapEntry color="#D7E78F" quantity="425" label="Cool Temperate Subalpine Desert"/>' +
      // Cool Temperate Alpine — same gradient with stipple in lyrx
      '<ColorMapEntry color="#74A900" quantity="431" label="Cool Temperate Alpine Rain Tundra"/>' +
      '<ColorMapEntry color="#8EBF23" quantity="432" label="Cool Temperate Alpine Wet Tundra"/>' +
      '<ColorMapEntry color="#A7D641" quantity="433" label="Cool Temperate Alpine Moist Tundra"/>' +
      '<ColorMapEntry color="#CDDF7A" quantity="434" label="Cool Temperate Alpine Desert"/>' +
      // Cool Temperate Nival — stipple-only in lyrx; very light tint
      '<ColorMapEntry color="#F2F9E8" quantity="441" label="Cool Temperate Nival Desert"/>' +
      // Boreal base belt — green gradient
      '<ColorMapEntry color="#009F49" quantity="511" label="Boreal Rain Forest"/>' +
      '<ColorMapEntry color="#33AD5F" quantity="512" label="Boreal Wet Forest"/>' +
      '<ColorMapEntry color="#66C187" quantity="513" label="Boreal Moist Forest"/>' +
      '<ColorMapEntry color="#99D6AF" quantity="514" label="Boreal Dry Scrub"/>' +
      '<ColorMapEntry color="#CCEAD7" quantity="515" label="Boreal Desert"/>' +
      // Boreal Alpine — same green gradient as base belt (altitude shown by stipple)
      '<ColorMapEntry color="#009F49" quantity="521" label="Boreal Alpine Rain Tundra"/>' +
      '<ColorMapEntry color="#33AD5F" quantity="522" label="Boreal Alpine Wet Tundra"/>' +
      '<ColorMapEntry color="#66C187" quantity="523" label="Boreal Alpine Moist Tundra"/>' +
      '<ColorMapEntry color="#99D6AF" quantity="524" label="Boreal Alpine Desert"/>' +
      // Boreal Nival — stipple-only in lyrx; very light tint
      '<ColorMapEntry color="#EBF7F0" quantity="531" label="Boreal Nival Desert"/>' +
      // Subpolar — blue gradient
      '<ColorMapEntry color="#0088D6" quantity="611" label="Subpolar Rain Tundra"/>' +
      '<ColorMapEntry color="#43A7E0" quantity="612" label="Subpolar Wet Tundra"/>' +
      '<ColorMapEntry color="#88C1E6" quantity="613" label="Subpolar Moist Tundra"/>' +
      '<ColorMapEntry color="#CCE8FB" quantity="614" label="Subpolar Desert"/>' +
      // Subpolar Nival — stipple-only in lyrx; very light tint
      '<ColorMapEntry color="#EEF5FD" quantity="621" label="Subpolar Nival Desert"/>' +
      '<ColorMapEntry color="#1451A0" quantity="711" label="Polar"/>' +
    '</ColorMap>' +
  '</RasterSymbolizer>';

// ── HLZ III pattern mask ─────────────────────────────────────────────────────
//
// A second GEE tile maps each HLZ III zone code to a pattern category:
//   0 = no pattern   → white  #FFFFFF (transparent in canvas overlay)
//   1 = stipple       → red    #FF0000 (Alpine / Subalpine / Boreal Alpine)
//   2 = hatch         → green  #00FF00 (Lower Montane / Montane / Subtropical Lower Montane)
//   3 = cross-hatch   → blue   #0000FF (Tropical Premontane)
//   4 = nival         → yellow #FFFF00 (Nival deserts — stipple-only, no solid fill)
//
// The canvas tile layer reads these indicator colours pixel-by-pixel and draws
// the corresponding CSS-style patterns as a transparent overlay.

// Parallel arrays: zone code → pattern category
const HLZIII_FROM_VALUES = [
  // Tropical base (0)
  111,112,113,114,115,116,117,118,
  // Tropical Premontane (3 = cross-hatch)
  121,122,123,124,125,126,127,
  // Tropical Lower Montane (2 = hatch)
  131,132,133,134,135,136,137,
  // Tropical Montane (2 = hatch)
  141,142,143,144,145,146,
  // Tropical Subalpine (1 = stipple)
  151,152,153,154,155,
  // Tropical Alpine (1 = stipple)
  161,162,163,164,
  // Tropical Nival (4 = nival)
  171,
  // Subtropical base (0)
  211,212,213,214,215,216,217,
  // Subtropical Lower Montane (2 = hatch)
  221,222,223,224,225,226,227,
  // Subtropical Montane / Subalpine / Alpine — not in lyrx (0)
  231,232,233,234,235,236,
  241,242,243,244,245,
  251,252,253,254,
  // Subtropical Nival (4)
  261,
  // Warm Temperate base (0)
  311,312,313,314,315,316,317,
  // Warm Temperate Montane (2 = hatch)
  321,322,323,324,325,326,
  // Warm Temperate Subalpine (1 = stipple)
  331,332,333,334,335,
  // Warm Temperate Alpine (1 = stipple)
  341,342,343,344,
  // Warm Temperate Nival (4)
  351,
  // Cool Temperate base (0)
  411,412,413,414,415,416,
  // Cool Temperate Subalpine (1 = stipple)
  421,422,423,424,425,
  // Cool Temperate Alpine (1 = stipple)
  431,432,433,434,
  // Cool Temperate Nival (4)
  441,
  // Boreal base (0)
  511,512,513,514,515,
  // Boreal Alpine (1 = stipple)
  521,522,523,524,
  // Boreal Nival (4)
  531,
  // Subpolar base (0)
  611,612,613,614,
  // Subpolar Nival (4)
  621,
  // Polar (0)
  711,
];

const HLZIII_TO_PATTERNS = [
  0,0,0,0,0,0,0,0,   // 111-118 no pattern
  3,3,3,3,3,3,3,     // 121-127 cross-hatch
  2,2,2,2,2,2,2,     // 131-137 hatch
  2,2,2,2,2,2,       // 141-146 hatch
  1,1,1,1,1,         // 151-155 stipple
  1,1,1,1,           // 161-164 stipple
  4,                 // 171     nival
  0,0,0,0,0,0,0,     // 211-217 no pattern
  2,2,2,2,2,2,2,     // 221-227 hatch
  0,0,0,0,0,0,       // 231-236 no pattern
  0,0,0,0,0,         // 241-245 no pattern
  0,0,0,0,           // 251-254 no pattern
  4,                 // 261     nival
  0,0,0,0,0,0,0,     // 311-317 no pattern
  2,2,2,2,2,2,       // 321-326 hatch
  1,1,1,1,1,         // 331-335 stipple
  1,1,1,1,           // 341-344 stipple
  4,                 // 351     nival
  0,0,0,0,0,0,       // 411-416 no pattern
  1,1,1,1,1,         // 421-425 stipple
  1,1,1,1,           // 431-434 stipple
  4,                 // 441     nival
  0,0,0,0,0,         // 511-515 no pattern
  1,1,1,1,           // 521-524 stipple
  4,                 // 531     nival
  0,0,0,0,           // 611-614 no pattern
  4,                 // 621     nival
  0,                 // 711     no pattern
];

// SLD applied to the remapped pattern-category image (values 0-4)
const SLD_HLZIII_PATTERN =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false">' +
      '<ColorMapEntry color="#FFFFFF" quantity="0" label="no pattern"/>' +
      '<ColorMapEntry color="#FF0000" quantity="1" label="stipple"/>' +
      '<ColorMapEntry color="#00FF00" quantity="2" label="hatch"/>' +
      '<ColorMapEntry color="#0000FF" quantity="3" label="cross-hatch"/>' +
      '<ColorMapEntry color="#FFFF00" quantity="4" label="nival"/>' +
    '</ColorMap>' +
  '</RasterSymbolizer>';

// Soil SLD for remapped classes 1..8
const SLD_SOIL =
  '<RasterSymbolizer>' +
    '<ColorMap type="intervals" extended="false">' +
      '<ColorMapEntry color="#A66F03" quantity="1" label="HAC"/>' +
      '<ColorMapEntry color="#FFD27F" quantity="2" label="LAC"/>' +
      '<ColorMapEntry color="#FFFFBD" quantity="3" label="Sandy soils"/>' +
      '<ColorMapEntry color="#D7D69D" quantity="4" label="Spodic"/>' +
      '<ColorMapEntry color="#0083A8" quantity="5" label="Volcanic soils"/>' +
      '<ColorMapEntry color="#8303A7" quantity="6" label="Wetland soils"/>' +
      '<ColorMapEntry color="#2A7200" quantity="7" label="Organic"/>' +
      '<ColorMapEntry color="#BDE7FF" quantity="8" label="Water"/>' +
    '</ColorMap>' +
  '</RasterSymbolizer>';

// ── Asset paths ──────────────────────────────────────────────────────────────

const ASSETS = {
  gcz:   'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalClimateZones_1995-2024_CRU409',
  gez:   'projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalEcologicalZones_HLZI_1995-2024_CRU409',
  hlzII: 'projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZII_1995-2024_CRU409',
  hlzIII:'projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZIII_1995-2024_CRU409',
  soil:  'projects/ee-maidiesinitam/assets/soilTypes/ipccFromHWSD2',
};

const SLD_MAP = {
  gcz:    SLD_GCZ,
  gez:    SLD_GEZ,
  hlzII:  SLD_HLZII,
  hlzIII: SLD_HLZIII,
};

// ── Helper: promisify getMapId ───────────────────────────────────────────────

function getMapId(image) {
  return new Promise((resolve, reject) => {
    image.getMapId({}, (mapId, error) => {
      if (error) reject(new Error(String(error)));
      else resolve(mapId);
    });
  });
}

function buildTileUrl(mapId) {
  // urlFormat is available in newer EE client versions; fall back to legacy format
  if (mapId.urlFormat) {
    // Some EE client versions provide a urlFormat but omit the token.
    // Ensure the returned template contains the token query parameter when available.
    if (mapId.token) {
      return mapId.urlFormat.includes('?')
        ? `${mapId.urlFormat}&token=${mapId.token}`
        : `${mapId.urlFormat}?token=${mapId.token}`;
    }
    return mapId.urlFormat;
  }
  return `https://earthengine.googleapis.com/map/${mapId.mapid}/{z}/{x}/{y}?token=${mapId.token}`;
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function getMapTiles(req, res) {
  try {
    const ee = getEarthEngine();
    const dataset = (req.query && req.query.dataset) === 'terraclimate' ? 'terraclimate' : 'cru';

    if (dataset === 'terraclimate') {
      // ── TerraClimate: compute all zone images on-the-fly ────────────────────
      const hlzImage = computeHLZ(TC_TILE_START, TC_TILE_END);

      const gczImage   = hlzImage.remap(HLZ_FROM, GCZ_TO,  0);
      const gezImage   = hlzImage.remap(HLZ_FROM, GEZ_TO,  0);
      const hlzIIImage = hlzImage.remap(HLZ_FROM, HLZII_TO, 0);
      const hlzIIIPatternImage = hlzImage.remap(HLZIII_FROM_VALUES, HLZIII_TO_PATTERNS, 0);

      const soilImage = ee.Image(ASSETS.soil)
        .remap([1,2,3,4,5,6,7,8,9,10,11,12,13],[7,1,2,8,7,4,8,3,8,5,6,8,8]);

      const [gczMapId, gezMapId, hlzIIMapId, hlzIIIMapId, hlzIIIPatternMapId, soilMapId] = await Promise.all([
        getMapId(gczImage.sldStyle(SLD_GCZ)),
        getMapId(gezImage.sldStyle(SLD_GEZ)),
        getMapId(hlzIIImage.sldStyle(SLD_HLZII)),
        getMapId(hlzImage.sldStyle(SLD_HLZIII)),
        getMapId(hlzIIIPatternImage.sldStyle(SLD_HLZIII_PATTERN)),
        getMapId(soilImage.sldStyle(SLD_SOIL)),
      ]);

      return res.status(200).json({
        gcz:           buildTileUrl(gczMapId),
        gez:           buildTileUrl(gezMapId),
        hlzII:         buildTileUrl(hlzIIMapId),
        hlzIII:        buildTileUrl(hlzIIIMapId),
        hlzIIIPattern: buildTileUrl(hlzIIIPatternMapId),
        soil:          buildTileUrl(soilMapId),
      });
    }

    // ── CRU (default): compute on-the-fly using same formula as inspector ────
    // Using computeHLZ_CRU ensures the map tiles use the exact same lapse-rate
    // formula (6·cos(lat) °C/km) and data as getBioecologicalData.js.
    const hlzImageCRU = computeHLZ_CRU(CRU_TILE_START, CRU_TILE_END);

    const gczImageCRU   = hlzImageCRU.remap(HLZ_FROM, GCZ_TO,  0);
    const gezImageCRU   = hlzImageCRU.remap(HLZ_FROM, GEZ_TO,  0);
    const hlzIIImageCRU = hlzImageCRU.remap(HLZ_FROM, HLZII_TO, 0);
    const hlzIIIPatternImage = hlzImageCRU.remap(HLZIII_FROM_VALUES, HLZIII_TO_PATTERNS, 0);

    const [gczMapId, gezMapId, hlzIIMapId, hlzIIIMapId, hlzIIIPatternMapId, soilMapId] = await Promise.all([
      getMapId(gczImageCRU.sldStyle(SLD_GCZ)),
      getMapId(gezImageCRU.sldStyle(SLD_GEZ)),
      getMapId(hlzIIImageCRU.sldStyle(SLD_HLZII)),
      getMapId(hlzImageCRU.sldStyle(SLD_HLZIII)),
      getMapId(hlzIIIPatternImage.sldStyle(SLD_HLZIII_PATTERN)),
      // Soil: remap original codes to 1..8 classes to match frontend palette
      getMapId(ee.Image(ASSETS.soil).remap([1,2,3,4,5,6,7,8,9,10,11,12,13],[7,1,2,8,7,4,8,3,8,5,6,8,8]).sldStyle(SLD_SOIL)),
    ]);

    try {
      console.log('getMapTiles mapIds:', {
        gcz: { mapid: gczMapId.mapid, token: gczMapId.token, urlFormat: gczMapId.urlFormat },
        gez: { mapid: gezMapId.mapid, token: gezMapId.token, urlFormat: gezMapId.urlFormat },
        hlzII: { mapid: hlzIIMapId.mapid, token: hlzIIMapId.token, urlFormat: hlzIIMapId.urlFormat },
        hlzIII: { mapid: hlzIIIMapId.mapid, token: hlzIIIMapId.token, urlFormat: hlzIIIMapId.urlFormat },
        hlzIIIPattern: { mapid: hlzIIIPatternMapId.mapid, token: hlzIIIPatternMapId.token, urlFormat: hlzIIIPatternMapId.urlFormat },
      });
    } catch (e) {
      console.log('Could not stringify mapId objects for debugging:', e.message);
    }

    return res.status(200).json({
      gcz:           buildTileUrl(gczMapId),
      gez:           buildTileUrl(gezMapId),
      hlzII:         buildTileUrl(hlzIIMapId),
      hlzIII:        buildTileUrl(hlzIIIMapId),
      hlzIIIPattern: buildTileUrl(hlzIIIPatternMapId),
      soil:          buildTileUrl(soilMapId),
    });
  } catch (err) {
    console.error('Error in getMapTiles:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate map tiles' });
  }
}

module.exports = { getMapTiles };
