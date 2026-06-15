/**
 * Climate Panel Component
 * Displays climate data input controls and results
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, Filler } from 'chart.js';
import { getAnnualSummary, getBioecologicalData, getMonthlyClimate, getGczTempStats, getGczMonthlyTempStats } from '../utils/api';
import Chart from './Chart';
import DownloadButtons from './DownloadButtons';
import { downloadCSV, downloadChartPNG } from '../utils/exportFigure';

// Filler is required for the shaded ±std band in GczMonthlyMedianChart.
ChartJS.register(Filler);

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

function ClimatePanel({ coords, onClimateDataUpdate, loading, onLoadingChange, onError, bioData, dataset, startYear, endYear, onGczStatsUpdate }) {
  const [annualSummary, setAnnualSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [gczStats, setGczStats] = useState(null);
  const [gczStatsLoading, setGczStatsLoading] = useState(false);
  const [gczStatsError, setGczStatsError] = useState(null);
  const [gczMonthlyStats, setGczMonthlyStats] = useState(null);
  const [gczMonthlyStatsLoading, setGczMonthlyStatsLoading] = useState(false);
  const [gczMonthlyStatsError, setGczMonthlyStatsError] = useState(null);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [chartMedianExpanded, setChartMedianExpanded] = useState(false);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [monthlyTableExpanded, setMonthlyTableExpanded] = useState(false);
  const [selectedGczZone, setSelectedGczZone] = useState(1);

  // Refs to the two monthly Chart.js instances, used for PNG export.
  const meanChartRef = useRef(null);
  const medianChartRef = useRef(null);

  // ── Figure export handlers ──────────────────────────────────────────────────
  const downloadGczAnnualCSV = useCallback(() => {
    if (!gczStats || !gczStats.rows) return;
    downloadCSV(
      'median_annual_temperature_per_GCZ_1995-2024',
      ['Climate zone', 'Median (°C)', 'Min (°C)', 'Max (°C)', 'Std (°C)'],
      gczStats.rows.map((r) => [r.label, r.median, r.min, r.max, r.std])
    );
  }, [gczStats]);

  const downloadGczMonthlyCSV = useCallback(() => {
    if (!gczMonthlyStats || !gczMonthlyStats.rows) return;
    const headers = ['Climate zone'];
    MONTH_LABELS.forEach((m) => { headers.push(`${m} median (°C)`, `${m} std (°C)`); });
    const rows = gczMonthlyStats.rows.map((r) => {
      const row = [r.label];
      r.months.forEach((c) => { row.push(c && c.median != null ? c.median : '', c && c.std != null ? c.std : ''); });
      return row;
    });
    downloadCSV('median_monthly_temperature_per_GCZ_1995-2024', headers, rows);
  }, [gczMonthlyStats]);

  const downloadMonthlyMeanCSV = useCallback(() => {
    if (!monthlyData) return;
    downloadCSV(
      'monthly_mean_temperature_precipitation',
      ['Month', 'Temperature (°C)', 'Precipitation (mm)'],
      monthlyData.map((d) => [d.month, d.temperature, d.precipitation])
    );
  }, [monthlyData]);

  const downloadMonthlyMedianCSV = useCallback(() => {
    if (!monthlyData) return;
    downloadCSV(
      'monthly_median_temperature_precipitation',
      ['Month', 'Temperature median (°C)', 'Precipitation median (mm)'],
      monthlyData.map((d) => [d.month, d.temperatureMedian, d.precipitationMedian])
    );
  }, [monthlyData]);

  // Track the years + dataset used for the last fetch so changes also trigger a refetch
  const lastFetch = useRef(null);
  // Generation counter: incremented on every new fetch; used to discard stale responses
  const fetchGen = useRef(0);

  // Clear stale local state when dataset changes so the previous dataset's
  // data doesn't briefly persist. The year range itself is owned by App.jsx
  // (top-level "Select year range" control) and passed in as props.
  useEffect(() => {
    setAnnualSummary(null);
    setMonthlyData(null);
    setGczStats(null);
    setGczStatsError(null);
    setGczMonthlyStats(null);
    setGczMonthlyStatsError(null);
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

  // Fetch per-GCZ monthly-mean temperature stats (median + std per calendar
  // month) on mount/dataset change. Heavier than the annual table — delay a
  // bit more so map tiles and the annual stats fire first.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setGczMonthlyStatsLoading(true);
      setGczMonthlyStatsError(null);
      getGczMonthlyTempStats(dataset)
        .then((data) => {
          if (cancelled) return;
          setGczMonthlyStats(data);
        })
        .catch((err) => {
          if (cancelled) return;
          setGczMonthlyStatsError(err.message || 'Failed to load per-zone monthly temperature statistics');
        })
        .finally(() => {
          if (!cancelled) setGczMonthlyStatsLoading(false);
        });
    }, 3000);
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
    if (!chartExpanded && !chartMedianExpanded && !tableExpanded && !monthlyTableExpanded) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setChartExpanded(false);
        setChartMedianExpanded(false);
        setTableExpanded(false);
        setMonthlyTableExpanded(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [chartExpanded, chartMedianExpanded, tableExpanded, monthlyTableExpanded]);

  return (
    <div className="climate-panel">
      <div className="panel-title">
        <span className="tier-badge tier-badge--b">Tier 1b</span>
        <span className="tier-label subsubtitle">Temperature &amp; Precipitation Data</span>
      </div>

      {/* Per-GCZ MAT statistics (1995–2024). Global table — same for all locations. */}
      <div className="gcz-stats">
        <details className="gcz-annual-details">
          <summary className="pyramid-subsection-header gcz-annual-summary">
            <p className="gcz-stats-title" style={{ margin: 0 }}>
              Median mean annual temperature per Global Climate Zone <span className="gcz-stats-period">(1995–2024)</span>
            </p>
            {gczStats && gczStats.rows && (
              <span className="hlz-header-actions">
                <DownloadButtons label="annual temperature table" stopEvents onCsv={downloadGczAnnualCSV} />
                <button
                  className="hlz-maximize-btn"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTableExpanded(true); }}
                  title="Maximise"
                  aria-label="Maximise table"
                >
                  &#x26F6;
                </button>
              </span>
            )}
          </summary>
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
                  <th>Std (°C)</th>
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
                    <td>{r.std ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
        {tableExpanded && gczStats && gczStats.rows && (
          <div className="hlz-modal-backdrop" onClick={() => setTableExpanded(false)}>
            <div className="hlz-modal-content" onClick={e => e.stopPropagation()}>
              <button className="hlz-modal-close" onClick={() => setTableExpanded(false)} aria-label="Close">✕</button>
              <p className="gcz-stats-title">Median mean annual temperature per Global Climate Zone <span className="gcz-stats-period">(1995–2024)</span></p>
              <table className="gcz-stats-table">
                <thead>
                  <tr>
                    <th>Climate zone</th>
                    <th>Median (°C)</th>
                    <th>Min (°C)</th>
                    <th>Max (°C)</th>
                    <th>Std (°C)</th>
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
                      <td>{r.std ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Per-GCZ median monthly mean temperature (1995–2024).
            Values shown as "median (std)" in °C. */}
        <div className="pyramid-subsection-header gcz-monthly-stats-header">
          <p className="gcz-stats-title" style={{ margin: 0 }}>
            Median monthly mean temperature per Global Climate Zone <span className="gcz-stats-period">(1995–2024, °C — median (std))</span>
          </p>
          {gczMonthlyStats && gczMonthlyStats.rows && (
            <span className="hlz-header-actions">
              <DownloadButtons label="monthly temperature table" onCsv={downloadGczMonthlyCSV} />
              <button
                className="hlz-maximize-btn"
                onClick={() => setMonthlyTableExpanded(true)}
                title="Maximise"
                aria-label="Maximise monthly table"
              >
                &#x26F6;
              </button>
            </span>
          )}
        </div>
        {gczMonthlyStatsLoading && <div className="loading">Loading per-zone monthly temperature…</div>}
        {gczMonthlyStatsError && <div className="error-message">{gczMonthlyStatsError}</div>}
        {gczMonthlyStats && gczMonthlyStats.rows && (
          <div className="gcz-monthly-stats-scroll" style={{ overflowX: 'auto' }}>
            <table className="gcz-stats-table gcz-monthly-stats-table">
              <thead>
                <tr>
                  <th>Climate zone</th>
                  {MONTH_LABELS.map((m) => <th key={m}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {gczMonthlyStats.rows.map((r) => (
                  <tr key={r.zone}>
                    <td>
                      <span
                        className="gcz-color-swatch"
                        style={{ background: GCZ_COLORS[r.zone] ?? '#ccc' }}
                      />
                      {r.label}
                    </td>
                    {r.months.map((cell, i) => (
                      <td key={i}>
                        {cell && cell.median != null
                          ? `${cell.median.toFixed(2)}${cell.std != null ? ` (${cell.std.toFixed(2)})` : ''}`
                          : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {monthlyTableExpanded && gczMonthlyStats && gczMonthlyStats.rows && (
          <div className="hlz-modal-backdrop" onClick={() => setMonthlyTableExpanded(false)}>
            <div className="hlz-modal-content hlz-modal-content--monthly-table" onClick={e => e.stopPropagation()}>
              <button className="hlz-modal-close" onClick={() => setMonthlyTableExpanded(false)} aria-label="Close">✕</button>
              <p className="gcz-stats-title">Median monthly mean temperature per Global Climate Zone <span className="gcz-stats-period">(1995–2024, °C — median (std))</span></p>
              <div className="gcz-monthly-stats-scroll">
                <table className="gcz-stats-table gcz-monthly-stats-table">
                  <thead>
                    <tr>
                      <th>Climate zone</th>
                      {MONTH_LABELS.map((m) => <th key={m}>{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {gczMonthlyStats.rows.map((r) => (
                      <tr key={r.zone}>
                        <td>
                          <span
                            className="gcz-color-swatch"
                            style={{ background: GCZ_COLORS[r.zone] ?? '#ccc' }}
                          />
                          {r.label}
                        </td>
                        {r.months.map((cell, i) => (
                          <td key={i}>
                            {cell && cell.median != null
                              ? `${cell.median.toFixed(2)}${cell.std != null ? ` (${cell.std.toFixed(2)})` : ''}`
                              : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Median monthly mean temperature chart for a user-selected GCZ */}
        {gczMonthlyStats && gczMonthlyStats.rows && gczMonthlyStats.rows.length > 0 && (
          <GczMonthlyMedianChart
            rows={gczMonthlyStats.rows}
            selectedZone={selectedGczZone}
            onSelectZone={setSelectedGczZone}
          />
        )}
      </div>

      <div className="climate-point-card">
        <div className="panel-title climate-point-title">
          <span className="tier-label subsubtitle">Climatic information for selected point</span>
        </div>

      {loading && <div className="loading">Loading climate data...</div>}

      <div className="annual-summary annual-summary--grid">
        <div className="annual-stat">
          <span className="annual-stat-label">Mean annual temperature (MAT)</span>
          <span className="annual-stat-value">{annualSummary?.meanAnnualTemp ?? '—'} °C</span>
        </div>
        <div className="annual-stat">
          <span className="annual-stat-label">Median annual temperature</span>
          <span className="annual-stat-value">{annualSummary?.medianAnnualTemp ?? '—'} °C</span>
        </div>
        <div className="annual-stat">
          <span className="annual-stat-label">Mean annual precipitation (MAP)</span>
          <span className="annual-stat-value">{annualSummary?.meanAnnualPrecip ?? '—'} mm</span>
        </div>
        <div className="annual-stat">
          <span className="annual-stat-label">Median annual precipitation</span>
          <span className="annual-stat-value">{annualSummary?.medianAnnualPrecip ?? '—'} mm</span>
        </div>
      </div>

      {monthlyData && (
        <div className="monthly-chart-section">
          <div className="pyramid-subsection-header">
            <span className="pyramid-subsection-title">Monthly mean climate chart</span>
            <span className="hlz-header-actions">
              <DownloadButtons
                label="monthly mean climate chart"
                onPng={() => downloadChartPNG(meanChartRef, 'monthly_mean_climate_chart')}
                onCsv={downloadMonthlyMeanCSV}
              />
              <button
                className="hlz-maximize-btn"
                onClick={() => setChartExpanded(true)}
                title="Maximise"
                aria-label="Maximise chart"
              >
                &#x26F6;
              </button>
            </span>
          </div>
          <Chart
            chartRef={meanChartRef}
            data={monthlyData}
            tempKey="temperature"
            precipKey="precipitation"
            title="Monthly mean temperature and precipitation"
          />
          {chartExpanded && (
            <div className="hlz-modal-backdrop" onClick={() => setChartExpanded(false)}>
              <div className="hlz-modal-content hlz-modal-content--chart" onClick={e => e.stopPropagation()}>
                <button className="hlz-modal-close" onClick={() => setChartExpanded(false)} aria-label="Close">✕</button>
                <Chart
                  data={monthlyData}
                  tempKey="temperature"
                  precipKey="precipitation"
                  title="Monthly mean temperature and precipitation"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {monthlyData && monthlyData.some(d => d.temperatureMedian != null || d.precipitationMedian != null) && (
        <div className="monthly-chart-section">
          <div className="pyramid-subsection-header">
            <span className="pyramid-subsection-title">Monthly median climate chart</span>
            <span className="hlz-header-actions">
              <DownloadButtons
                label="monthly median climate chart"
                onPng={() => downloadChartPNG(medianChartRef, 'monthly_median_climate_chart')}
                onCsv={downloadMonthlyMedianCSV}
              />
              <button
                className="hlz-maximize-btn"
                onClick={() => setChartMedianExpanded(true)}
                title="Maximise"
                aria-label="Maximise median chart"
              >
                &#x26F6;
              </button>
            </span>
          </div>
          <Chart
            chartRef={medianChartRef}
            data={monthlyData}
            tempKey="temperatureMedian"
            precipKey="precipitationMedian"
            title="Monthly median temperature and precipitation"
          />
          {chartMedianExpanded && (
            <div className="hlz-modal-backdrop" onClick={() => setChartMedianExpanded(false)}>
              <div className="hlz-modal-content hlz-modal-content--chart" onClick={e => e.stopPropagation()}>
                <button className="hlz-modal-close" onClick={() => setChartMedianExpanded(false)} aria-label="Close">✕</button>
                <Chart
                  data={monthlyData}
                  tempKey="temperatureMedian"
                  precipKey="precipitationMedian"
                  title="Monthly median temperature and precipitation"
                />
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

// Hex (#rrggbb) → rgba(r,g,b,a)
function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(180,180,180,${alpha})`;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Line chart showing the 12 calendar-month median temperatures (with ±1 std
 * shaded band) for a single user-selected Global Climate Zone.
 */
function GczMonthlyMedianChart({ rows, selectedZone, onSelectZone }) {
  const [expanded, setExpanded] = useState(false);
  const chartRef = useRef(null);

  // Close on Escape while modal is open
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  const row = useMemo(
    () => rows.find((r) => r.zone === selectedZone) || rows[0],
    [rows, selectedZone]
  );

  // Shared y-axis range across all zones so curves are visually comparable
  // (e.g. polar zones swing far more than tropical ones). Bounds are the
  // global min(median−std) / max(median+std) over every zone × month,
  // rounded outward to the nearest 10 °C.
  const [yMin, yMax] = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    rows.forEach((r) => r.months.forEach((c) => {
      if (!c || c.median == null) return;
      const s = c.std != null ? c.std : 0;
      lo = Math.min(lo, c.median - s);
      hi = Math.max(hi, c.median + s);
    }));
    if (!isFinite(lo) || !isFinite(hi)) return [-40, 40];
    return [Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10];
  }, [rows]);

  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const downloadZoneCSV = () => {
    downloadCSV(
      `median_monthly_temperature_${slug(row.label)}_1995-2024`,
      ['Month', 'Median (°C)', 'Std (°C)'],
      row.months.map((c, i) => [
        MONTH_LABELS[i],
        c && c.median != null ? c.median : '',
        c && c.std != null ? c.std : '',
      ])
    );
  };

  const color = GCZ_COLORS[row.zone] ?? '#888';
  const labels = MONTH_LABELS;
  const median = row.months.map((c) => (c && c.median != null ? c.median : null));
  const upper  = row.months.map((c) => (c && c.median != null && c.std != null ? c.median + c.std : null));
  const lower  = row.months.map((c) => (c && c.median != null && c.std != null ? c.median - c.std : null));

  // Dark outline drawn behind everything else so that even the palest IPCC
  // colours (Polar, Tropical Dry, Boreal Dry, …) stand out against a white
  // background while keeping the official zone colour identity intact.
  const HALO = 'rgba(40, 40, 40, 0.85)';

  const data = {
    labels,
    datasets: [
      // ── Std-band halo (slightly larger dark outline behind the fill) ──
      {
        label: '+1 std outline',
        data: upper,
        borderColor: HALO,
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        tension: 0.25,
        order: 4,
      },
      {
        label: '−1 std outline',
        data: lower,
        borderColor: HALO,
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        tension: 0.25,
        order: 4,
      },
      // ── Std band fill ──────────────────────────────────────────────
      {
        label: '+1 std',
        data: upper,
        borderColor: 'transparent',
        pointRadius: 0,
        fill: '+1', // fill to next dataset (lower)
        backgroundColor: hexToRgba(color, 0.55),
        tension: 0.25,
        order: 3,
      },
      {
        label: '−1 std',
        data: lower,
        borderColor: 'transparent',
        pointRadius: 0,
        fill: false,
        tension: 0.25,
        order: 3,
      },
      // ── Dark halo behind the median line ───────────────────────────
      {
        label: 'Median halo',
        data: median,
        borderColor: HALO,
        backgroundColor: HALO,
        borderWidth: 5,
        pointRadius: 5,
        pointBackgroundColor: HALO,
        pointBorderWidth: 0,
        tension: 0.25,
        order: 2,
      },
      // ── Median line on top, in the official IPCC zone colour ───────
      {
        label: 'Median (°C)',
        data: median,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: color,
        pointBorderColor: HALO,
        pointBorderWidth: 1,
        tension: 0.25,
        order: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          filter: (item) => item.text === 'Median (°C)',
        },
      },
      title: {
        display: true,
        text: `Median monthly mean temperature — ${row.label} (1995–2024)`,
      },
      tooltip: {
        // Only show the Median dataset; suppresses the halo, ±std outline
        // and band-fill series so the tooltip stays a single clean line.
        filter: (item) => item.dataset.label === 'Median (°C)',
        callbacks: {
          label: (ctx) => {
            const i = ctx.dataIndex;
            const m = row.months[i];
            if (!m || m.median == null) return 'No data';
            const std = m.std != null ? ` ± ${m.std.toFixed(2)}` : '';
            return `${m.median.toFixed(2)} °C${std}`;
          },
        },
      },
    },
    scales: {
      y: {
        min: yMin,
        max: yMax,
        ticks: { stepSize: 10 },
        title: { display: true, text: 'Temperature (°C)' },
      },
    },
  };

  return (
    <div className="gcz-monthly-median-chart">
      <div className="pyramid-subsection-header gcz-monthly-chart-header">
        <span className="pyramid-subsection-title">Median monthly mean temperature per Global Climate Zone</span>
        <div className="gcz-monthly-chart-controls">
          <label className="gcz-zone-select-label">
            Climate zone:&nbsp;
            <select
              className="gcz-zone-select"
              value={row.zone}
              onChange={(e) => onSelectZone(Number(e.target.value))}
            >
              {rows.map((r) => (
                <option key={r.zone} value={r.zone}>{r.label}</option>
              ))}
            </select>
          </label>
          <DownloadButtons
            label="median monthly temperature chart"
            onPng={() => downloadChartPNG(chartRef, `median_monthly_temperature_${slug(row.label)}_chart`)}
            onCsv={downloadZoneCSV}
          />
          <button
            className="hlz-maximize-btn"
            onClick={() => setExpanded(true)}
            title="Maximise"
            aria-label="Maximise chart"
          >
            &#x26F6;
          </button>
        </div>
      </div>
      <div className="gcz-monthly-median-chart-canvas">
        <Line ref={chartRef} data={data} options={options} />
      </div>
      {expanded && (
        <div className="hlz-modal-backdrop" onClick={() => setExpanded(false)}>
          <div className="hlz-modal-content hlz-modal-content--chart" onClick={(e) => e.stopPropagation()}>
            <button className="hlz-modal-close" onClick={() => setExpanded(false)} aria-label="Close">✕</button>
            <div className="gcz-monthly-median-chart-canvas gcz-monthly-median-chart-canvas--expanded">
              <Line data={data} options={options} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClimatePanel;
