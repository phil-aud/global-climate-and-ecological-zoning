/**
 * Climate Panel Component
 * Displays climate data input controls and results
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAnnualSummary, getBioecologicalData, getMonthlyClimate } from '../utils/api';
import Chart from './Chart';

function ClimatePanel({ coords, onClimateDataUpdate, loading, onLoadingChange, onError, bioData, dataset }) {
  const minYear = dataset === 'terraclimate' ? 1958 : 1901;
  const [startYear, setStartYear] = useState(2024);
  const [endYear, setEndYear] = useState(2024);
  const [annualSummary, setAnnualSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);

  // Track the years + dataset used for the last fetch so changes also trigger a refetch
  const lastFetch = useRef(null);
  // Generation counter: incremented on every new fetch; used to discard stale responses
  const fetchGen = useRef(0);

  // Reset year range min when dataset changes (clamp startYear if needed)
  // Also clear stale local state immediately so the old dataset's data doesn't persist
  useEffect(() => {
    if (startYear < minYear) setStartYear(minYear);
    setAnnualSummary(null);
    setMonthlyData(null);
  }, [dataset]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClimateData = useCallback(async (lon, lat, start, end) => {
    const gen = ++fetchGen.current;
    try {
      onLoadingChange(true);
      onError(null);

      const bioStart = 1995;
      const bioEnd   = 2024;

      const [annual, bio, monthly] = await Promise.all([
        getAnnualSummary(lon, lat, start, end, dataset),
        getBioecologicalData(lon, lat, bioStart, bioEnd, dataset),
        getMonthlyClimate(lon, lat, start, end, dataset),
      ]);

      // Discard if a newer fetch has already started (race condition guard)
      if (gen !== fetchGen.current) return;

      setAnnualSummary(annual);
      setMonthlyData(monthly);
      onClimateDataUpdate({ annual, bio, monthly });
    } catch (err) {
      if (gen !== fetchGen.current) return;
      onError(err.message);
      setAnnualSummary(null);
      setMonthlyData(null);
    } finally {
      if (gen === fetchGen.current) onLoadingChange(false);
    }
  }, [onLoadingChange, onError, onClimateDataUpdate, dataset]);

  useEffect(() => {
    if (!coords || coords.lon == null || coords.lat == null) return;
    const key = `${coords.lon},${coords.lat},${startYear},${endYear},${dataset}`;
    if (lastFetch.current === key) return;
    lastFetch.current = key;
    fetchClimateData(coords.lon, coords.lat, parseInt(startYear), parseInt(endYear));
  }, [coords, startYear, endYear, fetchClimateData, dataset]);

  return (
    <div className="climate-panel">
      <div className="panel-title">
        <span className="tier-badge tier-badge--b">Tier 1b</span>
        <span className="tier-label subsubtitle">Temperature &amp; Precipitation Data</span>
      </div>

      <div className="climate-inputs">
        <label>
          Start:
          <input
            type="number"
            min={minYear}
            max={endYear}
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
          />
        </label>
        <label>
          End:
          <input
            type="number"
            min={startYear}
            max={new Date().getFullYear()}
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
          />
        </label>
      </div>

      {loading && <div className="loading">Loading climate data...</div>}

      <div className="annual-summary">
        <p>
          <strong>Mean annual temperature (MAT):</strong> {annualSummary?.meanAnnualTemp ?? '—'}°C
        </p>
        <p>
          <strong>Mean annual precipitation (MAP):</strong> {annualSummary?.meanAnnualPrecip ?? '—'} mm
        </p>
      </div>

      {monthlyData && <Chart data={monthlyData} />}

      {/* Holdridge triangle moved to Tier 1 zone panel */}

      <div className="panel-sources">
        <p className="sources-title">Sources</p>
        <ul>
          {dataset === 'terraclimate' ? (
            <li>Abatzoglou, J.T., Dobrowski, S.Z., Parks, S.A. &amp; Hegewisch, K.C. (2018). TerraClimate, a high-resolution global dataset of monthly climate and climatic water balance. <em>Scientific Data</em> 5, 170191. IDAHO_EPSCOR/TERRACLIMATE (1958–2024).</li>
          ) : (
            <li>Harris, I., Osborn, T.J., Jones, P. &amp; Lister, D. (2020). Version 4 of the CRU TS monthly high-resolution gridded multivariate climate dataset. <em>Scientific Data</em> 7, 109. CRU TS 4.09 (1901–2024).</li>
          )}
          <li>USGS GTOPO30 Global Digital Elevation Model. U.S. Geological Survey, EROS Center.</li>
        </ul>
      </div>
    </div>
  );
}

export default ClimatePanel;
