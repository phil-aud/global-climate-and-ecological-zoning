var mmt;
var mmpre;
var mmpet;
var jan;
var feb;
var mar;
var apr;
var may;
var jun;
var jul;
var aug;
var sep;
var oct;
var nov;
var dec;

// Mean Monthly Temperature
var cruTempMonthlyMean = function(image, startYear, endYear) {
	mmt = mmt || require("users/philipaudebert/HLZs:Holdridge/Utils/CRU_FormattedDataset");
	return mmt.monthlyMeanD(image, startYear, endYear);
	};

// Monthly mean precipitation
var cruPreMonthlyMean = function(image, startYear, endYear) {
	mmpre = mmpre || require("users/philipaudebert/HLZs:Holdridge/Utils/CRU_FormattedDataset");
	return mmpre.monthlyMeanD(image, startYear, endYear);
	};
	
// Since the potential evapotranspiration is measured in mm/day it is important to adjust for leap years. The following functions calculate the average number of days for a given period of years. 
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

function getAverageDaysInYear(startYear, endYear) {
  var totalDays = 0;
  for (var year = startYear; year <= endYear; year++) {
    totalDays += getDaysInYear(year);
  }
  return totalDays / (endYear - startYear + 1);
}

// Monthly mean potential evapotranspiration
var cruPetYearlyMean = function(image, startYear, endYear) {
	mmpet = mmpet || require("users/philipaudebert/HLZs:Holdridge/Utils/CRU_FormattedDataset");
	return mmpet.monthlyMeanD(image, startYear, endYear).mean().multiply(getAverageDaysInYear(startYear, endYear));
	};


// Calculate monthly means/sums
var monthlyData = function(temperatureData, preciptationData, startYear, endYear) {
  var tempBands = cruTempMonthlyMean(temperatureData, startYear, endYear).toBands();
  var preBands = cruPreMonthlyMean(preciptationData, startYear, endYear).toBands();
  
  jan = tempBands.select(0).rename('temperature').addBands(preBands.select(0).rename('precipitation'));
  feb = tempBands.select(1).rename('temperature').addBands(preBands.select(1).rename('precipitation'));
  mar = tempBands.select(2).rename('temperature').addBands(preBands.select(2).rename('precipitation'));
  apr = tempBands.select(3).rename('temperature').addBands(preBands.select(3).rename('precipitation'));
  may = tempBands.select(4).rename('temperature').addBands(preBands.select(4).rename('precipitation'));
  jun = tempBands.select(5).rename('temperature').addBands(preBands.select(5).rename('precipitation'));
  jul = tempBands.select(6).rename('temperature').addBands(preBands.select(6).rename('precipitation'));
  aug = tempBands.select(7).rename('temperature').addBands(preBands.select(7).rename('precipitation'));
  sep = tempBands.select(8).rename('temperature').addBands(preBands.select(8).rename('precipitation'));
  oct = tempBands.select(9).rename('temperature').addBands(preBands.select(9).rename('precipitation'));
  nov = tempBands.select(10).rename('temperature').addBands(preBands.select(10).rename('precipitation'));
  dec = tempBands.select(11).rename('temperature').addBands(preBands.select(11).rename('precipitation'));
  
  // Monthly means
  var mData = ee.ImageCollection.fromImages([jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec])//.sum()).divide(12);

  return mData;

};

// Calculate yearly mean temperature/precipitation
var yearlyData = function(temperatureData, preciptationData, startYear, endYear) {
  var tempBands = cruTempMonthlyMean(temperatureData, startYear, endYear).mean().rename('temperature');
  var preBands = cruPreMonthlyMean(preciptationData, startYear, endYear).sum().rename('precipitation');
  
  // Annual mean: sum all temperatures for months with tmonth > 0°C and < 30°C
  var yData = tempBands.addBands(preBands)
  
  return yData;
};

// Climate data for identification of HLZ, GEZ and GCZ
var climateData = function(temperatureData, preciptationData, petData, elevationData, startYear, endYear) {
  var tempBands = cruTempMonthlyMean(temperatureData, startYear, endYear).toBands();
  var preBands = cruPreMonthlyMean(preciptationData, startYear, endYear).sum().rename('precipitation');
  var petRatioBands = cruPetYearlyMean(petData, startYear, endYear).divide(preBands).rename('petRatio');
  var elevationBands = elevationData.rename('elevation')
  

  // Derguy et al. 2019. "In the present study, we observed that, in the [Sahara Desert], using such temperature limits gave some unconvincing results (lower than expected) in biotemperature
  // calculation for a few particular, isolated locations with some summer temperatures above 30° C. Accordingly, we decided to replace all values >30°C
  // with 30 °C, not with 0 °C. We observed that results were then similar in neighboring sites with the previously unconvincing and expected responses. In this way,
  // based on mean monthly temperatures (MMT), we estimated mean monthly biotemperatures (MMB) by replacing values <0 °C with 0 °C and values >30°C with
  // 30 °C. After that, we used MMB to calculate annual mean biotemperature (MAB)"
  // Deprecated code: (tempBands.select(0).gt(0)).multiply(tempBands.select(0).lt(30)).multiply(tempBands.select(0)).rename('biotemperature');
  jan = (tempBands.select(0).gt(30).multiply(30)).add(tempBands.select(0).lte(30).multiply(tempBands.select(0).gt(0)).multiply(tempBands.select(0))).rename('biotemperature');
  feb = (tempBands.select(1).gt(30).multiply(30)).add(tempBands.select(1).lte(30).multiply(tempBands.select(1).gt(0)).multiply(tempBands.select(1))).rename('biotemperature');
  mar = (tempBands.select(2).gt(30).multiply(30)).add(tempBands.select(2).lte(30).multiply(tempBands.select(2).gt(0)).multiply(tempBands.select(2))).rename('biotemperature');
  apr = (tempBands.select(3).gt(30).multiply(30)).add(tempBands.select(3).lte(30).multiply(tempBands.select(3).gt(0)).multiply(tempBands.select(3))).rename('biotemperature');
  may = (tempBands.select(4).gt(30).multiply(30)).add(tempBands.select(4).lte(30).multiply(tempBands.select(4).gt(0)).multiply(tempBands.select(4))).rename('biotemperature');
  jun = (tempBands.select(5).gt(30).multiply(30)).add(tempBands.select(5).lte(30).multiply(tempBands.select(5).gt(0)).multiply(tempBands.select(5))).rename('biotemperature');
  jul = (tempBands.select(6).gt(30).multiply(30)).add(tempBands.select(6).lte(30).multiply(tempBands.select(6).gt(0)).multiply(tempBands.select(6))).rename('biotemperature');
  aug = (tempBands.select(7).gt(30).multiply(30)).add(tempBands.select(7).lte(30).multiply(tempBands.select(7).gt(0)).multiply(tempBands.select(7))).rename('biotemperature');
  sep = (tempBands.select(8).gt(30).multiply(30)).add(tempBands.select(8).lte(30).multiply(tempBands.select(8).gt(0)).multiply(tempBands.select(8))).rename('biotemperature');
  oct = (tempBands.select(9).gt(30).multiply(30)).add(tempBands.select(9).lte(30).multiply(tempBands.select(9).gt(0)).multiply(tempBands.select(9))).rename('biotemperature');
  nov = (tempBands.select(10).gt(30).multiply(30)).add(tempBands.select(10).lte(30).multiply(tempBands.select(10).gt(0)).multiply(tempBands.select(10))).rename('biotemperature');
  dec = (tempBands.select(11).gt(30).multiply(30)).add(tempBands.select(11).lte(30).multiply(tempBands.select(11).gt(0)).multiply(tempBands.select(11))).rename('biotemperature');
  
  // Mean annual biotemperature: sum all temperatures for months with tmonth > 0°C and < 30°C
  var tBio = ee.Image(ee.ImageCollection.fromImages([jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]).sum()).divide(12);
  
  
  // Sea-level biotemperature taking into account the altitudinal belts of Holdridge et al.
  // A lapse rate of -6°C/km is applied to the equation above (6°C for each 1,000m)
  // The lapse rate is not applied to tBio <= 0, since this would otherwise skew the results towards warmer climates
  var t0Bio = tBio.add(tBio.gt(0).multiply(elevationData.divide(1000).multiply(6)));
  //Map.addLayer(t0Bio, {}, 'tBio', 0)
  
  var climateDataAggregated = t0Bio.addBands(preBands).addBands(petRatioBands).addBands(elevationBands)

  return climateDataAggregated;

};

/*
var cruTsTmp = ee.Image("projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_tmp");
var cruTsPre = ee.Image("projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pre");
var cruTsPet = ee.Image("projects/ee-philaudebert/assets/CRU/CRU409_1901-2024/cru_ts409_1901-2024_pet");
var elevation = ee.Image("USGS/GTOPO30").rename('elevation').select('elevation');

Map.addLayer(monthlyData(cruTsTmp,cruTsPre,1995,2024))
Map.addLayer(yearlyData(cruTsTmp,cruTsPre,1995,2024))
Map.addLayer(climateData(cruTsTmp,cruTsPre,cruTsPet,elevation,1995,2024))
*/

exports = {
		monDat : monthlyData,
		yDat : yearlyData,
		climDat: climateData
};