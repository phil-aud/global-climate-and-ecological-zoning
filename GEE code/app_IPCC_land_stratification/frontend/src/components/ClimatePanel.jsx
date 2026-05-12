/**
 * Climate Panel Component
 * Displays climate data input controls and results
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAnnualSummary, getBioecologicalData, getMonthlyClimate, getGczTempStats } from '../utils/api';
import Chart from './Chart';

// GCZ zone colours — match SLD_GCZ in getMapTiles.js
const GCZ_COLORS = {
  1:  '#43896e',
  2:  '#89ce65',
  3:  '#f5f67a',
  4:  '#72e0fe',
  5:  '#ffd381',
  6:  '#cef57a',
  7:  '#c29fd8',
  8:  '#9eaad7',
  9:  '#d8d89f',
  10: '#d7ffe8',
};

function ClimatePanel({ coords, onClimateDataUpdate, loading, onLoadingChange, onError, bioData, dataset, onGczStatsUpdate }) {
  const minYear = dataset === 'terraclimate' ? 1958 : 1901;
  const [startYear, setStartYear] = useState(1995);
  const [endYear, setEndYear] = useState(2024);
  const [annualSummary, setAnnualSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [gczStats, setGczStats] = useState(null);
  const [gczStatsLoading, setGczStatsLoading] = useState(false);
  const [gczStatsError, setGczStatsError] = useState(null);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [tableExpanded, setTableExpanded] = useState(false);

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
    setGczStats(null);
    setGczStatsError(null);
    if (onGczStatsUpdate) onGczStatsUpdate(null);
  }, [dataset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch per-GCZ MAT statistics on mount and whenever dataset changes.
  // The reduction is heavy (global grouped reduceRegion); fire it on the next
  // tick so parallel map-tile requests get queued first.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setGczStatsLoading(true);
      setGczStatsError(null);
      getGczTempStats(dataset)
        .then((data) => {
          if (cancelled) return;
          setGczStats(data);
          if (onGczStatsUpdate) onGczStatsUpdate(data);
        })
        .catch((err) => {
          if (cancelled) return;
          setGczStatsError(err.message || 'Failed to load per-zone temperature statistics');
        })
        .finally(() => {
          if (!cancelled) setGczStatsLoading(false);
        });
    }, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [dataset]);

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

  // Close expanded modals on Escape key
  useEffect(() => {
    if (!chartExpanded && !tableExpanded) return;
    const onKey = (e) => { if (e.key === 'Escape') { setChartExpanded(false); setTableExpanded(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [chartExpanded, tableExpanded]);

  return (
    <div className="climate-panel">
      <div className="panel-title">
        <span className="tier-badge tier-badge--b">Tier 1b</span>
        <span className="tier-label subsubtitle">Temperature &amp; Precipitation Data</span>
      </div>

      {/* Per-GCZ MAT statistics (1995–2024). Global table — same for all locations. */}
      <div className="gcz-stats">
        <div className="pyramid-subsection-header">
          <p className="gcz-stats-title" style={{ margin: 0 }}>
            Median annual temperature per Global Climate Zone <span className="gcz-stats-period">(1995–2024)</span>
          </p>
          {gczStats && gczStats.rows && (
            <button
              className="hlz-maximize-btn"
              onClick={() => setTableExpanded(true)}
              title="Maximise"
              aria-label="Maximise table"
            >
              &#x26F6;
            </button>
          )}
        </div>
        {gczStatsLoading && <div className="loading">Loading per-zone temperature…</div>}
        {gczStatsError && <div className="error-message">{gczStatsError}</div>}
        {gczStats && gczStats.rows && (
          <table className="gcz-stats-table">
            <thead>
              <tr>
                <th>Climate zone</th>
                <th>Median (°C)</th>
                <th>Min (°C)</th>
                <th>Max (°C)</th>
              </tr>
            </thead>
            <tbody>
              {gczStats.rows.map((r) => (
                <tr key={r.zone}>
                  <td>
                    <span
                      className="gcz-color-swatch"
                      style={{ background: GCZ_COLORS[r.zone] ?? '#ccc' }}
                    />
                    {r.label}
                  </td>
                  <td>{r.median ?? '—'}</td>
                  <td>{r.min ?? '—'}</td>
                  <td>{r.max ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tableExpanded && gczStats && gczStats.rows && (
          <div className="hlz-modal-backdrop" onClick={() => setTableExpanded(false)}>
            <div className="hlz-modal-content" onClick={e => e.stopPropagation()}>
              <button className="hlz-modal-close" onClick={() => setTableExpanded(false)} aria-label="Close">✕</button>
              <p className="gcz-stats-title">Median annual temperature per Global Climate Zone <span className="gcz-stats-period">(1995–2024)</span></p>
              <table className="gcz-stats-table">
                <thead>
                  <tr>
                    <th>Climate zone</th>
                    <th>Median (°C)</th>
                    <th>Min (°C)</th>
                    <th>Max (°C)</th>
                  </tr>
                </thead>
                <tbody>
                  {gczStats.rows.map((r) => (
                    <tr key={r.zone}>
                      <td>
                        <span
                          className="gcz-color-swatch"
                          style={{ background: GCZ_COLORS[r.zone] ?? '#ccc' }}
                        />
                        {r.label}
                      </td>
                      <td>{r.median ?? '—'}</td>
                      <td>{r.min ?? '—'}</td>
                      <td>{r.max ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="climate-point-card">
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

      {monthlyData && (
        <div className="monthly-chart-section">
          <div className="pyramid-subsection-header">
            <span className="pyramid-subsection-title">Monthly climate chart</span>
            <button
              className="hlz-maximize-btn"
              onClick={() => setChartExpanded(true)}
              title="Maximise"
              aria-label="Maximise chart"
            >
              &#x26F6;
            </button>
          </div>
          <Chart data={monthlyData} />
          {chartExpanded && (
            <div className="hlz-modal-backdrop" onClick={() => setChartExpanded(false)}>
              <div className="hlz-modal-content hlz-modal-content--chart" onClick={e => e.stopPropagation()}>
                <button className="hlz-modal-close" onClick={() => setChartExpanded(false)} aria-label="Close">✕</button>
                <Chart data={monthlyData} />
              </div>
            </div>
          )}
        </div>
      )}
      </div>

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
