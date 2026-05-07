var hlzIII = ee.Image("projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZIII_1995-2024_CRU409_927m");
var hlzII = ee.Image("projects/ee-philaudebert/assets/HoldridgeLifeZones/HLZII_1995-2024_CRU409_927m");
var gez = ee.Image("projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalEcologicalZones_HLZI_1995-2024_CRU409_927m");
var gcz = ee.Image("projects/ee-philaudebert/assets/HoldridgeLifeZones/IPCC_GlobalClimateZones_1995-2024_CRU409_927m");
// Time series of CRU monthly temperature bands since 1901
var cruTsTmp = ee.Image("projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp");
// Time series of CRU monthly precipitation bands since 1901
var cruTsPre = ee.Image("projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pre");
var cruTsPet = ee.Image("projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pet");
var elevation = ee.Image("USGS/GTOPO30").rename('elevation').select('elevation');
var mon;
var soil = ee.Image("projects/ee-maidiesinitam/assets/soilTypes/ipccFromHWSD2").remap(
  [1,2,3,4,5,6,7,8,9,10,11,12,13],[7,1,2,8,7,4,8,3,8,5,6,8,8]);
var yr;
var thirtyY;


// Tier 1b - Mean annual temperature and precipitation
var yearlyData = function(temperatureData, precipitationData, startYear, endYear) {
    mon = mon || require("users/philipaudebert/GEZGCZComparison:Comparison/MeanTempPrec");
    return mon.yDat(temperatureData, precipitationData, startYear, endYear);
  };
  
// Tier 1b - Mean monthly temperature and precipitation
var monthlyData = function(temperatureData, precipitationData, startYear, endYear) {
    mon = mon || require("users/philipaudebert/GEZGCZComparison:Comparison/MeanTempPrec");
    return mon.monDat(temperatureData, precipitationData, startYear, endYear);
  };
  
// Tier 1b - Mean annual temperature and precipitation
var thirtyYearData = function(temperatureData, preciptationData, petData, elevationData, startYear, endYear) {
    thirtyY = thirtyY || require("users/philipaudebert/GEZGCZComparison:Comparison/MeanTempPrec");
    return thirtyY.climDat(temperatureData, preciptationData, petData, elevationData, startYear, endYear);
  };
  
var labelMap_hlzIII = {
  111: 'Tropical Rain Forest',
  112: 'Tropical Wet Forest',
  113: 'Tropical Moist Forest',
  114: 'Tropical Dry Forest',
  115: 'Tropical Very Dry Forest',
  116: 'Tropical Thorn Woodland',
  117: 'Tropical Desert Scrub',
  118: 'Tropical Desert',
  121: 'Tropical Premontane Rain Forest',
  122: 'Tropical Premontane Wet Forest',
  123: 'Tropical Premontane Moist Forest',
  124: 'Tropical Premontane Dry Forest',
  125: 'Tropical Premontane Thorn Woodland',
  126: 'Tropical Premontane Desert Scrub',
  127: 'Tropical Premontane Desert',
  131: 'Tropical Lower Montane Rain Forest',
  132: 'Tropical Lower Montane Wet Forest',
  133: 'Tropical Lower Montane Moist Forest',
  134: 'Tropical Lower Montane Dry Forest',
  135: 'Tropical Lower Montane Thorn Woodland',
  136: 'Tropical Lower Montane Desert Scrub',
  137: 'Tropical Lower Montane Desert',
  141: 'Tropical Montane Rain Forest',
  142: 'Tropical Montane Wet Forest',
  143: 'Tropical Montane Moist Forest',
  144: 'Tropical Montane Steppe',
  145: 'Tropical Montane Desert Scrub',
  146: 'Tropical Montane Desert',
  151: 'Tropical Subalpine Rain Forest',
  152: 'Tropical Subalpine Wet Forest',
  153: 'Tropical Subalpine Moist Forest',
  154: 'Tropical Subalpine Dry Scrub',
  155: 'Tropical Subalpine Desert',
  161: 'Tropical Alpine Rain Tundra',
  162: 'Tropical Alpine Wet Tundra',
  163: 'Tropical Alpine Moist Tundra',
  164: 'Tropical Alpine Desert',
  171: 'Tropical Nival Desert',
  211: 'Subtropical Rain Forest',
  212: 'Subtropical Wet Forest',
  213: 'Subtropical Moist Forest',
  214: 'Subtropical Dry Forest',
  215: 'Subtropical Thorn Woodland',
  216: 'Subtropical Desert Scrub',
  217: 'Subtropical Desert',
  221: 'Subtropical Lower Montane Rain Forest',
  222: 'Subtropical Lower Montane Wet Forest',
  223: 'Subtropical Lower Montane Moist Forest',
  224: 'Subtropical Lower Montane Dry Forest',
  225: 'Subtropical Lower Montane Thorn Woodland',
  226: 'Subtropical Lower Montane Desert Scrub',
  227: 'Subtropical Lower Montane Desert',
  231: 'Subtropical Montane Rain Forest',
  232: 'Subtropical Montane Wet Forest',
  233: 'Subtropical Montane Moist Forest',
  234: 'Subtropical Montane Steppe',
  235: 'Subtropical Montane Desert Scrub',
  236: 'Subtropical Montane Desert',
  241: 'Subtropical Subalpine Rain Forest',
  242: 'Subtropical Subalpine Wet Forest',
  243: 'Subtropical Subalpine Moist Forest',
  244: 'Subtropical Subalpine Dry Scrub',
  245: 'Subtropical Subalpine Desert',
  251: 'Subtropical Alpine Rain Tundra',
  252: 'Subtropical Alpine Wet Tundra',
  253: 'Subtropical Alpine Moist Tundra',
  254: 'Subtropical Alpine Desert',
  261: 'Subtropical Nival Desert',
  311: 'Warm Temperate Rain Forest',
  312: 'Warm Temperate Wet Forest',
  313: 'Warm Temperate Moist Forest',
  314: 'Warm Temperate Dry Forest',
  315: 'Warm Temperate Thorn Woodland',
  316: 'Warm Temperate Desert Scrub',
  317: 'Warm Temperate Desert',
  321: 'Warm Temperate Subalpine Rain Forest',
  322: 'Warm Temperate Subalpine Wet Forest',
  323: 'Warm Temperate Subalpine Moist Forest',
  324: 'Warm Temperate Subalpine Desert Scrub',
  325: 'Warm Temperate Subalpine Desert',
  331: 'Warm Temperate Alpine Rain Tundra',
  332: 'Warm Temperate Alpine Wet Tundra',
  333: 'Warm Temperate Alpine Moist Tundra',
  334: 'Warm Temperate Alpine Dry Scrub',
  335: 'Warm Temperate Subalpine Desert',
  341: 'Warm Temperate Alpine Rain Tundra',
  342: 'Warm Temperate Alpine Wet Tundra',
  343: 'Warm Temperate Alpine Moist Tundra',
  344: 'Warm Temperate Alpine Desert',
  351: 'Warm Temperate Nival Desert',
  411: 'Cool Temperate Rain Forest',
  412: 'Cool Temperate Wet Forest',
  413: 'Cool Temperate Moist Forest',
  414: 'Cool Temperate Steppe',
  415: 'Cool Temperate Desert Scrub',
  416: 'Cool Temperate Desert',
  421: 'Cool Temperate Subalpine Rain Forest',
  422: 'Cool Temperate Subalpine Wet Forest',
  423: 'Cool Temperate Subalpine Moist Forest',
  424: 'Cool Temperate Subalpine Dry Scrub',
  425: 'Cool Temperate Subalpine Desert',
  431: 'Cool Temperate Alpine Rain Tundra',
  432: 'Cool Temperate Alpine Wet Tundra',
  433: 'Cool Temperate Alpine Moist Tundra',
  434: 'Cool Temperate Alpine Desert',
  441: 'Cool Temperate Nival Desert',
  511: 'Boreal Rain Forest',
  512: 'Boreal Wet Forest',
  513: 'Boreal Moist Forest',
  514: 'Boreal Dry Scrub',
  515: 'Boreal Desert',
  521: 'Boreal Alpine Rain Tundra',
  522: 'Boreal Alpine Wet Tundra',
  523: 'Boreal Alpine Moist Tundra',
  524: 'Boreal Alpine Desert',
  531: 'Boreal Nival Desert',
  611: 'Subpolar Rain Tundra',
  612: 'Subpolar Wet Tundra',
  613: 'Subpolar Moist Tundra',
  614: 'Subpolar Desert',
  621: 'Subpolar Nival Desert',
  711: 'Polar'
};

var labelMap_hlzII = {
  11: "Tropical Rain Forest",
  12: "Tropical Wet Forest",
  13: "Tropical Moist Forest",
  14: "Tropical Dry Forest",
  15: "Tropical Very Dry Forest",
  16: "Tropical Thorn Woodland",
  17: "Tropical Desert Scrub",
  18: "Tropical Desert",
  21: "Subtropical Rain Forest",
  22: "Subtropical Wet Forest",
  23: "Subtropical Moist Forest",
  24: "Subtropical Dry Forest",
  25: "Subtropical Thorn Woodland",
  26: "Subtropical Desert Scrub",
  27: "Subtropical Desert",
  31: "Warm Temperate Rain Forest",
  32: "Warm Temperate Wet Forest",
  33: "Warm Temperate Moist Forest",
  34: "Warm Temperate Dry Forest",
  35: "Warm Temperate Thorn Woodland",
  36: "Warm Temperate Desert Scrub",
  37: "Warm Temperate Desert",
  41: "Cool Temperate Rain Forest",
  42: "Cool Temperate Wet Forest",
  43: "Cool Temperate Moist Forest",
  44: "Cool Temperate Steppe",
  45: "Cool Temperate Desert Scrub",
  46: "Cool Temperate Desert",
  51: "Boreal Rain Forest",
  52: "Boreal Wet Forest",
  53: "Boreal Moist Forest",
  54: "Boreal Dry Scrub",
  55: "Boreal Desert",
  61: "Subpolar Rain Tundra",
  62: "Subpolar Wet Tundra",
  63: "Subpolar Moist Tundra",
  64: "Subpolar Dry Tundra",
  71: "Polar",
};

var labelMap_gez = {
  11: 'Tropical Rain Forest',
  12: 'Tropical Moist Forest',
  13: 'Tropical Dry Forest',
  14: 'Tropical Shrubland',
  15: 'Tropical Desert',
  21: 'Subtropical Rain Forest',
  22: 'Subtropical Moist Forest',
  23: 'Subtropical Dry Forest',
  24: 'Subtropical Shrubland',
  25: 'Subtropical Desert',
  31: 'Warm Temperate Rain Forest',
  32: 'Warm Temperate Moist Forest',
  33: 'Warm Temperate Dry Forest',
  34: 'Warm Temperate Shrubland',
  35: 'Warm Temperate Desert',
  41: 'Cool Temperate Rain/Wet Forest',
  42: 'Cool Temperate Moist Forest',
  43: 'Cool Temperate Steppe',
  44: 'Cool Temperate Desert',
  51: 'Boreal Rain/Wet Forest',
  52: 'Boreal Moist Forest',
  53: 'Boreal Dry Scrub',
  54: 'Boreal Desert',
  61: 'Subpolar Rain/Wet Tundra',
  62: 'Subpolar Moist Tundra',
  63: 'Subpolar Dry Tundra',
  71: 'Polar'
};

var labelMap_gcz = {
  1: 'Tropical Wet',
  2: 'Tropical Moist',
  3: 'Tropical Dry',
  4: 'Warm Temperate Moist',
  5: 'Warm Temperate Dry',
  6: 'Cool Temperate Moist',
  7: 'Cool Temperate Dry',
  8: 'Boreal Moist',
  9: 'Boreal Dry',
  10: 'Polar'
};

// Soil label map for remapped soil classes (1-8)
var labelMap_soil = {
  1: 'HAC',
  2: 'LAC',
  3: 'Sandy soils',
  4: 'Spodic',
  5: 'Volcanic soils',
  6: 'Wetland soils',
  7: 'Organic',
  8: 'Water'
};



// Define an SLD style of discrete intervals to apply to the image.
var sld_intervals_hlzII =
'<RasterSymbolizer>' +
  '<ColorMap type="intervals" extended="false">' +
    '<ColorMapEntry color="#ce1d09" quantity="111" label="Tropical Rain Forest"/>' +
    '<ColorMapEntry color="#D2280D" quantity="112" label="Tropical Wet Forest"/>' +
    '<ColorMapEntry color="#DB4A2A" quantity="113" label="Tropical Moist Forest"/>' +
    '<ColorMapEntry color="#E36B49" quantity="114" label="Tropical Dry Forest"/>' +
    '<ColorMapEntry color="#EA8A68" quantity="115" label="Tropical Very Dry Forest"/>' +
    '<ColorMapEntry color="#F0A888" quantity="116" label="Tropical Thorn Woodland"/>' +
    '<ColorMapEntry color="#F6C3AA" quantity="117" label="Tropical Desert Scrub"/>' +
    '<ColorMapEntry color="#FADDCC" quantity="118" label="Tropical Desert"/>' +
    '<ColorMapEntry color="#f19137" quantity="121" label="Tropical Premontane Rain Forest"/>' +
    '<ColorMapEntry color="#F3A052" quantity="122" label="Tropical Premontane Wet Forest"/>' +
    '<ColorMapEntry color="#F5AE6C" quantity="123" label="Tropical Premontane Moist Forest"/>' +
    '<ColorMapEntry color="#F7BD87" quantity="124" label="Tropical Premontane Dry Forest"/>' +
    '<ColorMapEntry color="#F9CCA2" quantity="125" label="Tropical Premontane Thorn Woodland"/>' +
    '<ColorMapEntry color="#FADABC" quantity="126" label="Tropical Premontane Desert Scrub"/>' +
    '<ColorMapEntry color="#FCE9D7" quantity="127" label="Tropical Premontane Desert"/>' +
    '<ColorMapEntry color="#ffde4a" quantity="131" label="Tropical Lower Montane Rain Forest"/>' +
    '<ColorMapEntry color="#FFE262" quantity="132" label="Tropical Lower Montane Wet Forest"/>' +
    '<ColorMapEntry color="#FFE77A" quantity="133" label="Tropical Lower Montane Moist Forest"/>' +
    '<ColorMapEntry color="#FFEB92" quantity="134" label="Tropical Lower Montane Dry Forest"/>' +
    '<ColorMapEntry color="#FFF0AB" quantity="135" label="Tropical Lower Montane Thorn Woodland"/>' +
    '<ColorMapEntry color="#FFF4C3" quantity="136" label="Tropical Lower Montane Desert Scrub"/>' +
    '<ColorMapEntry color="#FFF8DB" quantity="137" label="Tropical Lower Montane Desert"/>' +
    '<ColorMapEntry color="#9ec200" quantity="141" label="Tropical Montane Rain Forest"/>' +
    '<ColorMapEntry color="#AECC29" quantity="142" label="Tropical Montane Wet Forest"/>' +
    '<ColorMapEntry color="#BDD652" quantity="143" label="Tropical Montane Moist Forest"/>' +
    '<ColorMapEntry color="#CDDF7A" quantity="144" label="Tropical Montane Steppe"/>' +
    '<ColorMapEntry color="#DCE9A3" quantity="145" label="Tropical Montane Desert Scrub"/>' +
    '<ColorMapEntry color="#ECF3CC" quantity="146" label="Tropical Montane Desert"/>' +
    '<ColorMapEntry color="#009837" quantity="151" label="Tropical Subalpine Rain Forest"/>' +
    '<ColorMapEntry color="#33AD5F" quantity="152" label="Tropical Subalpine Wet Forest"/>' +
    '<ColorMapEntry color="#66C187" quantity="153" label="Tropical Subalpine Moist Forest"/>' +
    '<ColorMapEntry color="#99D6AF" quantity="154" label="Tropical Subalpine Dry Scrub"/>' +
    '<ColorMapEntry color="#CCEAD7" quantity="155" label="Tropical Subalpine Desert"/>'+
    '<ColorMapEntry color="#00add6" quantity="161" label="Tropical Alpine Rain Tundra"/>' +
    '<ColorMapEntry color="#44C3E1" quantity="162" label="Tropical Alpine Wet Tundra"/>' +
    '<ColorMapEntry color="#88D9EC" quantity="163" label="Tropical Alpine Moist Tundra"/>' +
    '<ColorMapEntry color="#CCEFF7" quantity="164" label="Tropical Alpine Desert"/>'+
    '<ColorMapEntry color="#1451a0" quantity="171" label="Tropical Nival Desert"/>' +
    
    '<ColorMapEntry color="#f19137" quantity="211" label="Subtropical Rain Forest"/>' +
    '<ColorMapEntry color="#F3A052" quantity="212" label="Subtropical Wet Forest"/>' +
    '<ColorMapEntry color="#F5AE6C" quantity="213" label="Subtropical Moist Forest"/>' +
    '<ColorMapEntry color="#F7BD87" quantity="214" label="Subtropical Dry Forest"/>' +
    '<ColorMapEntry color="#F9CCA2" quantity="215" label="Subtropical Thorn Woodland"/>' +
    '<ColorMapEntry color="#FADABC" quantity="216" label="Subtropical Desert Scrub"/>' +
    '<ColorMapEntry color="#FCE9D7" quantity="217" label="Subtropical Desert"/>' +
    '<ColorMapEntry color="#ffde4a" quantity="221" label="Subtropical Lower Montane Rain Forest"/>' +
    '<ColorMapEntry color="#FFE262" quantity="222" label="Subtropical Lower Montane Wet Forest"/>' +
    '<ColorMapEntry color="#FFE77A" quantity="223" label="Subtropical Lower Montane Moist Forest"/>' +
    '<ColorMapEntry color="#FFEB92" quantity="224" label="Subtropical Lower Montane Dry Forest"/>' +
    '<ColorMapEntry color="#FFF0AB" quantity="225" label="Subtropical Lower Montane Thorn Woodland"/>' +
    '<ColorMapEntry color="#FFF4C3" quantity="226" label="Subtropical Lower Montane Desert Scrub"/>' +
    '<ColorMapEntry color="#FFF8DB" quantity="227" label="Subtropical Lower Montane Desert"/>' +
    '<ColorMapEntry color="#9ec200" quantity="231" label="Subtropical Montane Rain Forest"/>' +
    '<ColorMapEntry color="#AECC29" quantity="232" label="Subtropical Montane Wet Forest"/>' +
    '<ColorMapEntry color="#BDD652" quantity="233" label="Subtropical Montane Moist Forest"/>' +
    '<ColorMapEntry color="#CDDF7A" quantity="234" label="Subtropical Montane Steppe"/>' +
    '<ColorMapEntry color="#DCE9A3" quantity="235" label="Subtropical Montane Desert Scrub"/>' +
    '<ColorMapEntry color="#ECF3CC" quantity="236" label="Subtropical Montane Desert"/>' +
    '<ColorMapEntry color="#009837" quantity="241" label="Subtropical Subalpine Rain Forest"/>' +
    '<ColorMapEntry color="#33AD5F" quantity="242" label="Subtropical Subalpine Wet Forest"/>' +
    '<ColorMapEntry color="#66C187" quantity="243" label="Subtropical Subalpine Moist Forest"/>' +
    '<ColorMapEntry color="#99D6AF" quantity="244" label="Subtropical Subalpine Dry Scrub"/>' +
    '<ColorMapEntry color="#CCEAD7" quantity="245" label="Subtropical Subalpine Desert"/>'+
    '<ColorMapEntry color="#00add6" quantity="251" label="Subtropical Alpine Rain Tundra"/>' +
    '<ColorMapEntry color="#44C3E1" quantity="252" label="Subtropical Alpine Wet Tundra"/>' +
    '<ColorMapEntry color="#88D9EC" quantity="253" label="Subtropical Alpine Moist Tundra"/>' +
    '<ColorMapEntry color="#CCEFF7" quantity="254" label="Subtropical Alpine Desert"/>'+
    '<ColorMapEntry color="#1451a0" quantity="261" label="Subtropical Nival Desert"/>' +
    
    '<ColorMapEntry color="#ffde4a" quantity="311" label="Warm Temperate Rain Forest"/>' +
    '<ColorMapEntry color="#FFE262" quantity="312" label="Warm Temperate Wet Forest"/>' +
    '<ColorMapEntry color="#FFE77A" quantity="313" label="Warm Temperate Moist Forest"/>' +
    '<ColorMapEntry color="#FFEB92" quantity="314" label="Warm Temperate Dry Forest"/>' +
    '<ColorMapEntry color="#FFF0AB" quantity="315" label="Warm Temperate Thorn Woodland"/>' +
    '<ColorMapEntry color="#FFF4C3" quantity="316" label="Warm Temperate Desert Scrub"/>' +
    '<ColorMapEntry color="#FFF8DB" quantity="317" label="Warm Temperate Desert"/>' +
    '<ColorMapEntry color="#9ec200" quantity="321" label="Warm Temperate Montane Rain Forest"/>' +
    '<ColorMapEntry color="#AECC29" quantity="322" label="Warm Temperate Montane Wet Forest"/>' +
    '<ColorMapEntry color="#BDD652" quantity="323" label="Warm Temperate Montane Moist Forest"/>' +
    '<ColorMapEntry color="#CDDF7A" quantity="324" label="Warm Temperate Montane Steppe"/>' +
    '<ColorMapEntry color="#DCE9A3" quantity="325" label="Warm Temperate Montane Desert Scrub"/>' +
    '<ColorMapEntry color="#ECF3CC" quantity="326" label="Warm Temperate Montane Desert"/>' +
    '<ColorMapEntry color="#009837" quantity="331" label="Warm Temperate Subalpine Rain Forest"/>' +
    '<ColorMapEntry color="#33AD5F" quantity="332" label="Warm Temperate Subalpine Wet Forest"/>' +
    '<ColorMapEntry color="#66C187" quantity="333" label="Warm Temperate Subalpine Moist Forest"/>' +
    '<ColorMapEntry color="#99D6AF" quantity="334" label="Warm Temperate Subalpine Dry Scrub"/>' +
    '<ColorMapEntry color="#CCEAD7" quantity="335" label="Warm Temperate Subalpine Desert"/>'+
    '<ColorMapEntry color="#00add6" quantity="341" label="Warm Temperate Alpine Rain Tundra"/>' +
    '<ColorMapEntry color="#44C3E1" quantity="342" label="Warm Temperate Alpine Wet Tundra"/>' +
    '<ColorMapEntry color="#88D9EC" quantity="343" label="Warm Temperate Alpine Moist Tundra"/>' +
    '<ColorMapEntry color="#CCEFF7" quantity="344" label="Warm Temperate Alpine Desert"/>'+
    '<ColorMapEntry color="#1451a0" quantity="351" label="Warm Temperate Nival Desert"/>' +
    
    '<ColorMapEntry color="#9ec200" quantity="411" label="Cool Temperate Rain Forest"/>' +
    '<ColorMapEntry color="#AECC29" quantity="412" label="Cool Temperate Wet Forest"/>' +
    '<ColorMapEntry color="#BDD652" quantity="413" label="Cool Temperate Moist Forest"/>' +
    '<ColorMapEntry color="#CDDF7A" quantity="414" label="Cool Temperate Steppe"/>' +
    '<ColorMapEntry color="#DCE9A3" quantity="415" label="Cool Temperate Desert Scrub"/>' +
    '<ColorMapEntry color="#ECF3CC" quantity="416" label="Cool Temperate Desert"/>' +
    '<ColorMapEntry color="#009837" quantity="421" label="Cool Temperate Subalpine Rain Forest"/>' +
    '<ColorMapEntry color="#33AD5F" quantity="422" label="Cool Temperate Subalpine Wet Forest"/>' +
    '<ColorMapEntry color="#66C187" quantity="423" label="Cool Temperate Subalpine Moist Forest"/>' +
    '<ColorMapEntry color="#99D6AF" quantity="424" label="Cool Temperate Subalpine Dry Scrub"/>' +
    '<ColorMapEntry color="#CCEAD7" quantity="425" label="Cool Temperate Subalpine Desert"/>'+
    '<ColorMapEntry color="#00add6" quantity="431" label="Cool Temperate Alpine Rain Tundra"/>' +
    '<ColorMapEntry color="#44C3E1" quantity="432" label="Cool Temperate Alpine Wet Tundra"/>' +
    '<ColorMapEntry color="#88D9EC" quantity="433" label="Cool Temperate Alpine Moist Tundra"/>' +
    '<ColorMapEntry color="#CCEFF7" quantity="434" label="Cool Temperate Alpine Desert"/>'+
    '<ColorMapEntry color="#1451a0" quantity="441" label="Cool Temperate Nival Desert"/>' +
     
     
    '<ColorMapEntry color="#009837" quantity="511" label="Boreal Rain Forest"/>' +
    '<ColorMapEntry color="#33AD5F" quantity="512" label="Boreal Wet Forest"/>' +
    '<ColorMapEntry color="#66C187" quantity="513" label="Boreal Moist Forest"/>' +
    '<ColorMapEntry color="#99D6AF" quantity="514" label="Boreal Dry Scrub"/>' +
    '<ColorMapEntry color="#CCEAD7" quantity="515" label="Boreal Desert"/>'+
    '<ColorMapEntry color="#00add6" quantity="521" label="Boreal Alpine Rain Tundra"/>' +
    '<ColorMapEntry color="#44C3E1" quantity="522" label="Boreal Alpine Wet Tundra"/>' +
    '<ColorMapEntry color="#88D9EC" quantity="523" label="Boreal Alpine Moist Tundra"/>' +
    '<ColorMapEntry color="#CCEFF7" quantity="524" label="Boreal Alpine Desert"/>'+
    '<ColorMapEntry color="#1451a0" quantity="531" label="Boreal Nival Desert"/>' +
    
    '<ColorMapEntry color="#00add6" quantity="611" label="Subpolar Rain Tundra"/>' +
    '<ColorMapEntry color="#44C3E1" quantity="612" label="Subpolar Wet Tundra"/>' +
    '<ColorMapEntry color="#88D9EC" quantity="613" label="Subpolar Moist Tundra"/>' +
    '<ColorMapEntry color="#CCEFF7" quantity="614" label="Subpolar Desert"/>'+
    '<ColorMapEntry color="#1451a0" quantity="621" label="Subpolar Nival Desert"/>' +
    
    '<ColorMapEntry color="#1451a0" quantity="711" label="Polar"/>' +

  '</ColorMap>' +
'</RasterSymbolizer>';


var sld_intervals_gez =
'<RasterSymbolizer>' +
  '<ColorMap type="intervals" extended="false">' +
    '<ColorMapEntry color="#ce1d09" quantity="11" label="Tropical rainforest"/>' +
    '<ColorMapEntry color="#DB4A2A" quantity="12" label="Tropical moist forest"/>' +
    '<ColorMapEntry color="#E36B49" quantity="13" label="Tropical dry forest"/>' +
    '<ColorMapEntry color="#F0A888" quantity="14" label="Tropical shrubland"/>' +
    '<ColorMapEntry color="#FADDCC" quantity="15" label="Tropical desert"/>' + 
    
    '<ColorMapEntry color="#f19137" quantity="21" label="Subtropical rain forest"/>' +
    '<ColorMapEntry color="#F5AE6C" quantity="22" label="Subtropical moist forest"/>' +
    '<ColorMapEntry color="#F7BD87" quantity="23" label="Subtropical dry forest"/>' +
    '<ColorMapEntry color="#F9CCA2" quantity="24" label="Subtropical shrubland"/>' +
    '<ColorMapEntry color="#FCE9D7" quantity="25" label="Subtropical desert"/>' +
    
    '<ColorMapEntry color="#ffde4a" quantity="31" label="Warm Temperate rain forest"/>' +
    '<ColorMapEntry color="#FFE77A" quantity="32" label="Warm Temperate moist forest"/>' +
    '<ColorMapEntry color="#FFEB92" quantity="33" label="Warm Temperate dry forest"/>' +
    '<ColorMapEntry color="#FFF0AB" quantity="34" label="Warm Temperate shrubland"/>' +
    '<ColorMapEntry color="#FFF8DB" quantity="35" label="Warm Temperate desert"/>' +
    
    '<ColorMapEntry color="#9ec200" quantity="41" label="Cool Temperate rain/wet forest"/>' +
    '<ColorMapEntry color="#BDD652" quantity="42" label="Cool Temperate moist forst"/>' +
    '<ColorMapEntry color="#CDDF7A" quantity="43" label="Cool Temperate steppe"/>' +
    '<ColorMapEntry color="#ECF3CC" quantity="44" label="Cool Temperate desert"/>' +
    
    '<ColorMapEntry color="#009837" quantity="51" label="Boreal rain/wet forest"/>' +
    '<ColorMapEntry color="#66C187" quantity="52" label="Boreal moist forest"/>' +
    '<ColorMapEntry color="#99D6AF" quantity="53" label="Boreal dry scrub"/>' +
    '<ColorMapEntry color="#CCEAD7" quantity="54" label="Boreal desert"/>' +
    
    '<ColorMapEntry color="#00add6" quantity="61" label="Subpolar rain/wet tundra"/>' +
    '<ColorMapEntry color="#88D9EC" quantity="62" label="Subpolar moist tundra"/>' +
    '<ColorMapEntry color="#CCEFF7" quantity="63" label="Subpolar dry tundra"/>' +
    
    '<ColorMapEntry color="#1451a0" quantity="71" label="Polar"/>' +
  '</ColorMap>' +
'</RasterSymbolizer>';

// Define an SLD style of discrete intervals to apply to the image.
var sld_intervals_gcz =
'<RasterSymbolizer>' +
  '<ColorMap type="intervals" extended="false">' +
    '<ColorMapEntry color="#43896e" quantity="1" label="Tropical Wet"/>' +
    '<ColorMapEntry color="#89ce65" quantity="2" label="Tropical Moist"/>' +
    '<ColorMapEntry color="#f5f67a" quantity="3" label="Tropical Dry"/>' +
    '<ColorMapEntry color="#72e0fe" quantity="4" label="Warm Temperate Moist"/>' +
    '<ColorMapEntry color="#ffd381" quantity="5" label="Warm Temperate Dry"/>' +
    '<ColorMapEntry color="#cef57a" quantity="6" label="Cool Temperate Moist"/>' +
    '<ColorMapEntry color="#c29fd8" quantity="7" label="Cool Temperate Dry"/>' +
    '<ColorMapEntry color="#9eaad7" quantity="8" label="Boreal Moist"/>' +
    '<ColorMapEntry color="#d8d89f" quantity="9" label="Boreal Dry"/>' +
    '<ColorMapEntry color="#d7ffe8" quantity="10" label="Polar"/>' +
  '</ColorMap>' +
'</RasterSymbolizer>';

// Apply the SLD style to the hlzIII and hlzII layers
var styled_hlzII = hlzIII.sldStyle(sld_intervals_hlzII);
var styled_gez = gez.sldStyle(sld_intervals_gez);
var styled_gcz = gcz.sldStyle(sld_intervals_gcz);

// Add the styled layers to the map
Map.addLayer(styled_hlzII, {}, 'Holdridge Life Zones - Level II');
Map.addLayer(styled_gez, {}, 'Global Ecological Zones (GEZ, Holdridge Life Zones - Level I)');
Map.addLayer(styled_gcz, {}, 'Global Climate Zones (GCZ)');

// Visualization parameters for soil (classes 1–8)
var vis = {
  min: 1,
  max: 8,
  palette: [
    '#A66F03', // 1 HAC
    '#FFD27F', // 2 LAC
    '#FFFFBD', // 3 Sandy soils
    '#D7D69D', // 4 Spodic
    '#0083A8', // 5 Volcanic soils
    '#8303A7', // 6 Wetland soils
    '#2A7200', // 7 Organic
    '#BDE7FF', // 8 Water
  ]
};

// Add soil layer
Map.addLayer(soil, vis, 'IPCC soil types');



Map.style().set('cursor', 'crosshair');




// ========================================
// MAIN CENTRE PANEL
// ========================================

var mainPanel = ui.Panel({
  style: {
    position: 'bottom-center',
    width: '565px',
    height: '260px',
    maxHeight: '260px',
    padding: '10px 12px',
    backgroundColor: 'white',
    border: '1px solid #444',
    borderRadius: '10px'
  },
  layout: ui.Panel.Layout.flow('vertical')
});


// Main title
var titleLabel = ui.Label('IPCC land stratification for National Greenhouse Gas Inventories (NGGI)');
titleLabel.style().set({
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#222',
  textAlign: 'center',
  stretch: 'horizontal',
  margin: '0 0 3px 0',
  backgroundColor: 'white'
});


// Subtitle
var subtitleLabel = ui.Label('>> Click a location to query GCZ, GEZ, and yearly and monthly temperature and precipitation data <<');
subtitleLabel.style().set({
  fontSize: '11px',
  color: '#777',
  textAlign: 'center',
  stretch: 'horizontal',
  margin: '0 0 6px 0',
  backgroundColor: 'white'
});


// Tier 1 title
var tier1Title = ui.Label('Tier 1. Global Climate and Ecological Zones');
tier1Title.style().set({
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0 0 4px 0',
  backgroundColor: 'white'
});


// Tier 1 text
var tier1Text = ui.Label('The Global Climate Zones (GCZ) and Global Ecological Zones (GEZ) are based on the Holdridge Life Zone (HLZ) scheme, ensuring for the first time an exact correspondence between GCZs and GEZs. All raster and vector files can be downloaded here: https://github.com/phil-aud/global-climate-and-ecological-zoning');
tier1Text.style().set({
  fontSize: '10px',
  color: '#777',
  margin: '0 0 4px 0',
  backgroundColor: 'white'
});


// ========================================
// HIGHLIGHTED ZONE RESULT BLOCK
// ========================================

function makeResultRow(labelText, valueText, isPrimary) {
  var label = ui.Label(labelText);
  label.style().set({
    fontSize: isPrimary ? '11px' : '10px',
    fontWeight: 'bold',
    color: isPrimary ? '#1f1f1f' : '#444',
    width: isPrimary ? '150px' : '120px',
    margin: '0 6px 0 0',
    backgroundColor: isPrimary ? '#eef5f3' : '#f7f7f7',
    padding: isPrimary ? '4px 6px' : '3px 5px',
    border: isPrimary ? '1px solid #9db8b0' : '1px solid #dddddd',
    borderRadius: '6px'
  });

  var value = ui.Label(valueText);
  value.style().set({
    fontSize: isPrimary ? '11px' : '10px',
    fontWeight: isPrimary ? 'bold' : 'normal',
    color: '#222',
    stretch: 'horizontal',
    margin: '0',
    padding: isPrimary ? '4px 6px' : '3px 5px',
    backgroundColor: 'white',
    border: isPrimary ? '1px solid #9db8b0' : '1px solid #e3e3e3',
    borderRadius: '6px'
  });

  return {
    panel: ui.Panel({
      widgets: [label, value],
      layout: ui.Panel.Layout.flow('horizontal'),
      style: {
        margin: '0 0 4px 0',
        backgroundColor: '#eef5f3'
      }
    }),
    valueLabel: value
  };
}

var gczRow = makeResultRow('GCZ', 'Click map to query', true);
var gezRow = makeResultRow('GEZ (HLZ I)', 'Click map to query', true);
var hlzIIRow = makeResultRow('HLZ II', 'Click map to query', false);
var hlzIIIRow = makeResultRow('HLZ III', 'Click map to query', false);
var soilRow = makeResultRow('Soil', 'Click map to query', false);

var hlzBlock = ui.Panel({
  widgets: [
    gczRow.panel,
    gezRow.panel,
    hlzIIRow.panel,
    hlzIIIRow.panel,
    soilRow.panel
  ],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    margin: '0 0 6px 0',
    padding: '8px 8px',
    backgroundColor: '#eef5f3',
    border: '2px solid #6f8f87',
    borderRadius: '8px'
  }
});

// New label for tBio, P, R (below GCZ/GEZ/HLZ box, same style as MAT/MAP)
var bioSummaryLabel = ui.Label({
  value: '',
  style: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#222',
    margin: '0 0 4px 0',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'white'
  }
});


// Tier 1 sources title
var tier1SourcesTitle = ui.Label({
  value: 'Sources:',
  style: {
    fontSize: '9px',
    fontWeight: 'bold',
    color: '#777',
    margin: '2px 0 1px 0',
    backgroundColor: 'white'
  }
});


// Tier 1 source 1
var tier1SourceLabel1 = ui.Label({
  value: '- Audebert, P., Milne, E., Schiettecatte, LS. et al. Ecological zoning for climate policy and global change studies. Nat Sustain 7, 1294–1303 (2024). https://doi.org/10.1038/s41893-024-01416-5',
  style: {
    fontSize: '9px',
    color: '#777',
    margin: '0 0 1px 0',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'white'
  }
});


// Tier 1 source 2
var tier1SourceLabel2 = ui.Label({
  value: '- Audebert et al. (2026). Aligning climate zoning to ecological zoning: A harmonized classification approach. Under review. https://www.researchsquare.com/article/rs-8843420/v1',
  style: {
    fontSize: '9px',
    color: '#777',
    margin: '0 0 8px 0',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'white'
  }
});


// Tier 1 source 3
var tier1SourceLabel3 = ui.Label({
  value: '',
  style: {
    fontSize: '9px',
    color: '#777',
    margin: '0 0 8px 0',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'white'
  }
});


// Tier 1b title
var tier15Title = ui.Label('Tier 1b. Temperature and Precipitation Data for SLCF inventories');
tier15Title.style().set({
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0 0 4px 0',
  backgroundColor: 'white'
});


// Inputs
var lonBox = ui.Textbox({
  placeholder: 'Longitude',
  value: '0',
  style: {
    width: '95px',
    margin: '0 4px 0 0',
    backgroundColor: 'white'
  }
});

var latBox = ui.Textbox({
  placeholder: 'Latitude',
  value: '0',
  style: {
    width: '95px',
    margin: '0 4px 0 0',
    backgroundColor: 'white'
  }
});

var startYearBox = ui.Textbox({
  placeholder: 'Start',
  value: '2024',
  style: {
    width: '70px',
    margin: '0 4px 0 0',
    backgroundColor: 'white'
  }
});

var endYearBox = ui.Textbox({
  placeholder: 'End',
  value: '2024',
  style: {
    width: '70px',
    margin: '0 4px 0 0',
    backgroundColor: 'white'
  }
});

var plotButton = ui.Button({
  label: 'Plot',
  style: {
    width: '70px',
    margin: '0',
    color: '#222',
    backgroundColor: 'white',
    border: '1px solid #bdbdbd',
    borderRadius: '6px'
  }
});


// Small labels
function smallLabel(text, width) {
  return ui.Label({
    value: text,
    style: {
      fontSize: '10px',
      fontWeight: 'bold',
      color: '#333',
      width: width,
      margin: '2px 4px 2px 0',
      backgroundColor: 'white'
    }
  });
}


// Input label row
var emptySpacer = ui.Label('');
emptySpacer.style().set({
  width: '70px',
  backgroundColor: 'white'
});

var headerRow = ui.Panel({
  widgets: [
    smallLabel('Lon', '95px'),
    smallLabel('Lat', '95px'),
    smallLabel('Start', '70px'),
    smallLabel('End', '70px'),
    emptySpacer
  ],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    margin: '0 0 1px 0',
    backgroundColor: 'white'
  }
});


// Input row
var inputRow = ui.Panel({
  widgets: [lonBox, latBox, startYearBox, endYearBox, plotButton],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    margin: '0 0 4px 0',
    backgroundColor: 'white'
  }
});


// Output labels
var statusLabel = ui.Label({
  value: '',
  style: {
    fontSize: '10px',
    color: '#666',
    margin: '0 0 2px 0',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'white'
  }
});

var annualSummaryLabel = ui.Label({
  value: '',
  style: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#222',
    margin: '0 0 4px 0',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'white'
  }
});


// Chart container
var chartPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    margin: '0',
    padding: '0',
    backgroundColor: 'white'
  }
});


// Temperature and Precipitation sources title
var sourceLabel = ui.Label({
  value: 'Sources:',
  style: {
    fontSize: '9px',
    fontWeight: 'bold',
    color: '#777',
    margin: '2px 0 1px 0',
    backgroundColor: 'white'
  }
});


// Source content
var sourceLabelContent = ui.Label({
  value: '- Temperature and Precipitation data from Climatic Research Unit (CRU TS 4.09) at the University of East Anglia at a 0.5° resolution. https://crudata.uea.ac.uk/cru/data/hrg/. Harris I., Osborn T.J., Jones P. and Lister G. Version 4 of the CRU TS monthly high resolution gridded multivariate climate dataset. Scientific Data 7, Article number 109 (2020).',
  style: {
    fontSize: '9px',
    color: '#777',
    margin: '0 0 1px 0',
    whiteSpace: 'pre-wrap',
    backgroundColor: 'white'
  }
});


// EXPLORER - Soils subtitle (placed after Temperature & Precipitation sources)
var explorerSoilsLabel = ui.Label('EXPLORER\nSoils');
explorerSoilsLabel.style().set({
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#333',
  textAlign: 'center',
  stretch: 'horizontal',
  margin: '8px 0 8px 0',
  backgroundColor: 'white'
});


// Add all widgets
mainPanel
  .add(titleLabel)
  .add(subtitleLabel)
  .add(tier1Title)
  .add(tier1Text)
  .add(hlzBlock)
  // new tBio/P/R label directly below the GCZ/GEZ/HLZ block
  .add(bioSummaryLabel)
  .add(tier1SourcesTitle)
  .add(tier1SourceLabel1)
  .add(tier1SourceLabel2)
  .add(tier1SourceLabel3)
  .add(tier15Title)
  .add(headerRow)
  .add(inputRow)
  .add(statusLabel)
  .add(annualSummaryLabel)
  .add(chartPanel)
  .add(sourceLabel)
  .add(sourceLabelContent)
  .add(explorerSoilsLabel);

Map.add(mainPanel);




// ========================================
// OPTIONAL POINT LAYER
// ========================================

var pointLayer = ui.Map.Layer(null, {color: 'FF0000'}, 'Selected point');
Map.layers().add(pointLayer);




// ========================================
// HLZ UPDATE
// ========================================

function updateLabel(coords) {
  var point = ee.Geometry.Point(coords.lon, coords.lat);

  gcz.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 30,
    bestEffort: true
  }).evaluate(function(result_gcz) {

    var value_gcz = result_gcz ? result_gcz['remapped'] : null;
    var labelName_gcz = value_gcz !== null ? labelMap_gcz[value_gcz] : 'No data';

    gez.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 30,
      bestEffort: true
    }).evaluate(function(result_gez) {

      var value_gez = result_gez ? result_gez['remapped'] : null;
      var labelName_gez = value_gez !== null ? labelMap_gez[value_gez] : 'No data';

      var value_gez_adj = value_gez;
      if (value_gez_adj === 11) value_gez_adj = '1a';
      else if (value_gez_adj === 12) value_gez_adj = '1b';
      else if (value_gez_adj === 13) value_gez_adj = '1c';
      else if (value_gez_adj === 14) value_gez_adj = '1d';
      else if (value_gez_adj === 15) value_gez_adj = '1e';
      else if (value_gez_adj === 21) value_gez_adj = '2a';
      else if (value_gez_adj === 22) value_gez_adj = '2b';
      else if (value_gez_adj === 23) value_gez_adj = '2c';
      else if (value_gez_adj === 24) value_gez_adj = '2d';
      else if (value_gez_adj === 25) value_gez_adj = '2e';
      else if (value_gez_adj === 31) value_gez_adj = '3a';
      else if (value_gez_adj === 32) value_gez_adj = '3b';
      else if (value_gez_adj === 33) value_gez_adj = '3c';
      else if (value_gez_adj === 34) value_gez_adj = '3d';
      else if (value_gez_adj === 35) value_gez_adj = '3e';
      else if (value_gez_adj === 41) value_gez_adj = '4a';
      else if (value_gez_adj === 42) value_gez_adj = '4b';
      else if (value_gez_adj === 43) value_gez_adj = '4c';
      else if (value_gez_adj === 44) value_gez_adj = '4d';
      else if (value_gez_adj === 51) value_gez_adj = '5a';
      else if (value_gez_adj === 52) value_gez_adj = '5b';
      else if (value_gez_adj === 53) value_gez_adj = '5c';
      else if (value_gez_adj === 54) value_gez_adj = '5d';
      else if (value_gez_adj === 61) value_gez_adj = '6a';
      else if (value_gez_adj === 62) value_gez_adj = '6b';
      else if (value_gez_adj === 63) value_gez_adj = '6c';
      else if (value_gez_adj === 71) value_gez_adj = '7a';
      else if (value_gez_adj === null) value_gez_adj = 'No data';
      else value_gez_adj = 'Unknown Value';

      hlzII.reduceRegion({
        reducer: ee.Reducer.first(),
        geometry: point,
        scale: 30,
        bestEffort: true
      }).evaluate(function(result_hlzII) {

        var value_hlzII = result_hlzII ? result_hlzII['remapped'] : null;
        var labelName_hlzII = value_hlzII !== null ? labelMap_hlzII[value_hlzII] : 'No data';

        hlzIII.reduceRegion({
          reducer: ee.Reducer.first(),
          geometry: point,
          scale: 30,
          bestEffort: true
        }).evaluate(function(result_hlzIII) {

          var value_hlzIII = result_hlzIII ? result_hlzIII['biotemperature'] : null;
          var labelName_hlzIII = value_hlzIII !== null ? labelMap_hlzIII[value_hlzIII] : 'No data';
            // Also sample soil at this point and then update all rows
            soil.reduceRegion({
              reducer: ee.Reducer.first(),
              geometry: point,
              scale: 30,
              bestEffort: true
            }).evaluate(function(result_soil) {
              var value_soil = null;
              if (result_soil) {
                for (var k in result_soil) { value_soil = result_soil[k]; break; }
              }
              var labelName_soil = value_soil !== null ? labelMap_soil[value_soil] : 'No data';

              gczRow.valueLabel.setValue(labelName_gcz + ' (' + value_gcz + ')');
              gezRow.valueLabel.setValue(labelName_gez + ' (' + value_gez_adj + ')');
              hlzIIRow.valueLabel.setValue(labelName_hlzII + ' (' + value_hlzII + ')');
              hlzIIIRow.valueLabel.setValue(labelName_hlzIII + ' (' + value_hlzIII + ')');
              soilRow.valueLabel.setValue(labelName_soil + ' (' + value_soil + ')');
            });
        });
      });
    });
  });
}




// ========================================
// CLIMATE PLOT
// ========================================

// NOTE: this uses thirtyYearData(temperatureData, preciptationData, petData, elevationData, startYear, endYear)
// where petData is cruTsPet and elevationData is elevation.

var plotClimateAtPoint = function(lon, lat, startYear, endYear) {
  chartPanel.clear();
  statusLabel.setValue('');
  annualSummaryLabel.setValue('');
  bioSummaryLabel.setValue('');

  lon = Number(lon);
  lat = Number(lat);
  startYear = parseInt(startYear, 10);
  endYear = parseInt(endYear, 10);

  if (isNaN(lon) || isNaN(lat)) {
    statusLabel.setValue('Please enter valid coordinates.');
    return;
  }

  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    statusLabel.setValue('Lon must be -180 to 180, lat -90 to 90.');
    return;
  }

  if (isNaN(startYear) || isNaN(endYear)) {
    statusLabel.setValue('Please enter valid years.');
    return;
  }

  if (startYear > endYear) {
    statusLabel.setValue('Start year must be <= end year.');
    return;
  }

  var point = ee.Geometry.Point([lon, lat]);

  lonBox.setValue(lon.toFixed(4), false);
  latBox.setValue(lat.toFixed(4), false);
  startYearBox.setValue(String(startYear), false);
  endYearBox.setValue(String(endYear), false);

  pointLayer.setEeObject(point);
  Map.centerObject(point, 6);

  statusLabel.setValue(
    'Loading: ' + lon.toFixed(2) + ', ' + lat.toFixed(2) +
    ' | ' + startYear + '-' + endYear
  );

  var monthlyDataCollection = monthlyData(cruTsTmp, cruTsPre, startYear, endYear);
  var annualDataImage = yearlyData(cruTsTmp, cruTsPre, startYear, endYear);

  var annualStats = annualDataImage.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 5000,
    bestEffort: true
  });

  annualStats.evaluate(function(result) {
    if (result && result.temperature !== null && result.precipitation !== null) {
      annualSummaryLabel.setValue(
        'Mean annual temperature (MAT): ' + Number(result.temperature).toFixed(2) + ' °C' +
        ' | Mean annual precipitation (MAP): ' + Number(result.precipitation).toFixed(2) + ' mm'
      );
    } else {
      annualSummaryLabel.setValue('No annual data available.');
    }
  });

  // New: compute 30-year / bioclim data and show tBio, P, R
  // Fixed period 1995-2024 for the reference biotemperature/PET calculation
  var thirtyYearImage = thirtyYearData(cruTsTmp, cruTsPre, cruTsPet, elevation, 1995, 2024);

  var bioStats = thirtyYearImage.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 5000,
    bestEffort: true
  });

  // Sample elevation at GTOPO30 native projection and resolution (30 arc-seconds)
  var elevStats = elevation.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: elevation.projection().nominalScale(),
    crs: elevation.projection(),
    bestEffort: true
  });

  bioStats.combine(elevStats, true).evaluate(function(result) {
    if (result &&
        result.biotemperature !== null &&
        result.precipitation !== null &&
        result.petRatio !== null &&
        result.elevation !== null) {
      bioSummaryLabel.setValue(
        'Mean annual biotemperature (tBio): ' + Number(result.biotemperature).toFixed(2) + ' °C' +
        ' | Mean annual precipitation (P): ' + Number(result.precipitation).toFixed(2) + ' mm' +
        ' | Potential Evapotranspiration Ratio (R): ' + Number(result.petRatio).toFixed(2) +
        ' | Elevation: ' + Number(result.elevation).toFixed(2) + ' m'
      );
    } else {
      bioSummaryLabel.setValue('No tBio/P/R/elevation data available.');
    }
  });

  var timeSeries = monthlyDataCollection.map(function(image) {
    var sampled = image.sample({
      region: point,
      scale: 5000,
      geometries: false
    }).first();

    return ee.Feature(sampled);
  });

  var features = timeSeries.toList(monthlyDataCollection.size());

  var pairedValues = features.map(function(feature) {
    feature = ee.Feature(feature);
    return ee.Algorithms.If(
      feature,
      [feature.get('temperature'), feature.get('precipitation')],
      null
    );
  });

  pairedValues = ee.List(pairedValues).removeAll([null]);

  var months = ee.List([
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]);

  var chart = ui.Chart.array.values({
    array: ee.Array(pairedValues),
    axis: 0,
    xLabels: months
  })
  .setSeriesNames(['Temp °C', 'Prec mm'])
  .setOptions({
    title: 'Monthly temperature and precipitation data',
    titleTextStyle: {fontSize: 11, bold: true},
    hAxis: {
      title: 'Month',
      titleTextStyle: {fontSize: 10},
      textStyle: {fontSize: 9}
    },
    vAxes: {
      0: {title: 'Temperature °C', titleTextStyle: {fontSize: 10}, textStyle: {fontSize: 9}},
      1: {title: 'Precipitation mm', titleTextStyle: {fontSize: 10}, textStyle: {fontSize: 9}}
    },
    series: {
      0: {targetAxisIndex: 0, color: 'red', lineWidth: 2, pointSize: 2},
      1: {targetAxisIndex: 1, color: 'blue', lineWidth: 2, pointSize: 2}
    },
    legend: {
      position: 'right',
      textStyle: {fontSize: 9}
    },
    chartArea: {
      left: 40,
      right: 45,
      top: 22,
      bottom: 25,
      width: '62%',
      height: '52%'
    }
  });

  chartPanel.add(chart);

  statusLabel.setValue(
    'Shown: ' + lon.toFixed(2) + ', ' + lat.toFixed(2) +
    ' | ' + startYear + '-' + endYear
  );
};




// ========================================
// HANDLERS
// ========================================

plotButton.onClick(function() {
  plotClimateAtPoint(
    lonBox.getValue(),
    latBox.getValue(),
    startYearBox.getValue(),
    endYearBox.getValue()
  );
});

Map.onClick(function(coords) {
  updateLabel(coords);
  plotClimateAtPoint(
    coords.lon,
    coords.lat,
    startYearBox.getValue(),
    endYearBox.getValue()
  );
});

lonBox.onChange(function(text) {
  var lon = Number(text);
  var lat = Number(latBox.getValue());

  if (!isNaN(lon) && !isNaN(lat) &&
      lon >= -180 && lon <= 180 &&
      lat >= -90 && lat <= 90) {
    updateLabel({lon: lon, lat: lat});
  }
});

latBox.onChange(function(text) {
  var lon = Number(lonBox.getValue());
  var lat = Number(text);

  if (!isNaN(lon) && !isNaN(lat) &&
      lon >= -180 && lon <= 180 &&
      lat >= -90 && lat <= 90) {
    updateLabel({lon: lon, lat: lat});
  }
});




// =========================== LEGENDS ===========================

// ---- Legend for GEZ ----
function createLegend_GEZ() {
  var legend = ui.Panel({
    style: {
      position: 'bottom-right',
      padding: '8px 12px',
      border: '1px solid #444',
      borderRadius: '10px',
      backgroundColor: 'white',
      maxHeight: '192px'
    }
  });

  var legendTitle_GEZ = ui.Label({
    value: 'Global Ecological Zones',
    style: {
      fontWeight: 'bold',
      fontSize: '15px',
      color: '#222',
      margin: '0 0 6px 0',
      padding: '0',
      backgroundColor: 'white'
    }
  });

  legend.add(legendTitle_GEZ);

  var makeRow = function(color, name) {
    var colorBox = ui.Label({
      style: {
        backgroundColor: '#' + color,
        padding: '7px',
        margin: '0 0 4px 0',
        border: '1px solid #cccccc',
        borderRadius: '3px'
      }
    });

    var description = ui.Label({
      value: name,
      style: {
        margin: '0 0 4px 6px',
        fontSize: '11px',
        color: '#222',
        backgroundColor: 'white'
      }
    });

    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {
        backgroundColor: 'white'
      }
    });
  };

  var palette_GEZ = [
    'C71D31','D64758','E37280','EEA0A9','F7CED3',
    'F17C1D','F89646','FDB071','FFCA9E','FFE4CE',
    'FFDD00','FFE833','FFF066','FFF799','FFFCCC',
    '74A900','9BC444','C0DC88','E5F1CC',
    '009F49','44BD79','88D7AA','CCEFDA',
    '0088D6','66B9ED','CCE8FB',
    '1451a0'
  ];

  var names_GEZ = [
    'Tropical rainforest','Tropical moist forest','Tropical dry forest',
    'Tropical shrubland','Tropical desert','Subtropical rain forest',
    'Subtropical moist forest','Subtropical dry forest',
    'Subtropical steppe/shrubland','Subtropical desert',
    'Warm Temperate rain/wet forest','Warm Temperate moist forest',
    'Warm Temperate dry forest','Warm Temperate steppe/shrubland',
    'Warm Temperate desert','Cool Temperate rain/wet forest',
    'Cool Temperate moist forest','Cool Temperate steppe',
    'Cool Temperate desert','Boreal rain/wet forest',
    'Boreal moist forest','Boreal dry scrub','Boreal desert',
    'Subpolar rain/wet tundra','Subpolar moist tundra',
    'Subpolar dry tundra','Polar desert'
  ];

  for (var i = 0; i < 27; i++) {
    legend.add(makeRow(palette_GEZ[i], names_GEZ[i]));
  }

  return legend;
}

Map.add(createLegend_GEZ());


// ---- Legend for GCZ ----
function createLegendGCZ() {
  var legend = ui.Panel({
    style: {
      position: 'bottom-left',
      padding: '8px 12px',
      border: '1px solid #444',
      borderRadius: '10px',
      backgroundColor: 'white',
      maxHeight: '192px'
    }
  });

  var legendTitleGCZ = ui.Label({
    value: 'Global Climate Zones',
    style: {
      fontWeight: 'bold',
      fontSize: '15px',
      color: '#222',
      margin: '0 0 6px 0',
      padding: '0',
      backgroundColor: 'white'
    }
  });

  legend.add(legendTitleGCZ);

  var makeRow = function(color, name) {
    var colorBox = ui.Label({
      style: {
        backgroundColor: '#' + color,
        padding: '7px',
        margin: '0 0 4px 0',
        border: '1px solid #cccccc',
        borderRadius: '3px'
      }
    });

    var description = ui.Label({
      value: name,
      style: {
        margin: '0 0 4px 6px',
        fontSize: '11px',
        color: '#222',
        backgroundColor: 'white'
      }
    });

    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {
        backgroundColor: 'white'
      }
    });
  };

  var palette_GCZ = [
    '43896e','89ce65','f5f67a','72e0fe','ffd381',
    'cef57a','c29fd8','9eaad7','d8d89f','d7ffe8'
  ];

  var names_GCZ = [
    'Tropical Wet',
    'Tropical Moist',
    'Tropical Dry',
    'Warm Temperate Moist',
    'Warm Temperate Dry',
    'Cool Temperate Moist',
    'Cool Temperate Dry',
    'Boreal Moist',
    'Boreal Dry',
    'Polar'
  ];

  for (var i = 0; i < 10; i++) {
    legend.add(makeRow(palette_GCZ[i], names_GCZ[i]));
  }

  return legend;
}

Map.add(createLegendGCZ());

// ---- Legend for Soil ----
function createLegendSoil() {
  var legend = ui.Panel({
    style: {
      position: 'top-right',
      padding: '8px 12px',
      border: '1px solid #444',
      borderRadius: '10px',
      backgroundColor: 'white',
      maxHeight: '220px'
    }
  });

  var legendTitle = ui.Label({
    value: 'IPCC Soil Types',
    style: {
      fontWeight: 'bold',
      fontSize: '15px',
      color: '#222',
      margin: '0 0 6px 0',
      backgroundColor: 'white'
    }
  });

  legend.add(legendTitle);

  var makeRow = function(color, name) {
    var colorBox = ui.Label({
      style: {
        backgroundColor: color,
        padding: '7px',
        margin: '0 0 4px 0',
        border: '1px solid #cccccc',
        borderRadius: '3px'
      }
    });

    var description = ui.Label({
      value: name,
      style: {
        margin: '0 0 4px 6px',
        fontSize: '11px',
        color: '#222',
        backgroundColor: 'white'
      }
    });

    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal'),
      style: {backgroundColor: 'white'}
    });
  };

  var palette = vis.palette;
  var names = [
    'HAC', 'LAC', 'Sandy soils', 'Spodic', 'Volcanic soils', 'Wetland soils', 'Organic', 'Water'
  ];

  for (var i = 0; i < palette.length; i++) {
    legend.add(makeRow('#' + palette[i].replace('#',''), names[i]));
  }

  return legend;
}

Map.add(createLegendSoil());

Map.setCenter(10, 10, 2);