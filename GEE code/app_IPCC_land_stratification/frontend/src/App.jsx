/**
 * Main App Component
 */

import React, { useState, useCallback } from 'react';
import MapComponent from './components/MapComponent';
import ZonePanel from './components/ZonePanel';
import SoilsPanel from './components/SoilsPanel';
import ClimatePanel from './components/ClimatePanel';
import Tour, { TourLauncher } from './components/Tour';
import LandingPage from './components/LandingPage';
import './styles/App.css';

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [zoneData, setZoneData] = useState(null);
  const [climateData, setClimateData] = useState(null);
  const [gczStats, setGczStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dataset, setDataset] = useState('cru');

  // Year range applied to the GCZ / GEZ / HLZ map tiles. Default 1995-2024.
  const DEFAULT_TILE_START = 1995;
  const DEFAULT_TILE_END = 2024;
  const [tileStartYear, setTileStartYear] = useState(DEFAULT_TILE_START);
  const [tileEndYear, setTileEndYear] = useState(DEFAULT_TILE_END);
  const [yearRangeOpen, setYearRangeOpen] = useState(false);
  const [pendingStartYear, setPendingStartYear] = useState(String(DEFAULT_TILE_START));
  const [pendingEndYear, setPendingEndYear] = useState(String(DEFAULT_TILE_END));

  const tileMinYear = dataset === 'terraclimate' ? 1958 : 1901;
  const tileMaxYear = 2024;

  const handleApplyYearRange = useCallback(() => {
    let s = parseInt(pendingStartYear, 10);
    let e = parseInt(pendingEndYear, 10);
    if (!Number.isFinite(s)) s = DEFAULT_TILE_START;
    if (!Number.isFinite(e)) e = DEFAULT_TILE_END;
    s = Math.min(Math.max(s, tileMinYear), tileMaxYear);
    e = Math.min(Math.max(e, tileMinYear), tileMaxYear);
    if (s > e) { const t = s; s = e; e = t; }
    setPendingStartYear(String(s));
    setPendingEndYear(String(e));
    setTileStartYear(s);
    setTileEndYear(e);
  }, [pendingStartYear, pendingEndYear, tileMinYear, tileMaxYear]);

  const handleResetYearRange = useCallback(() => {
    setPendingStartYear(String(DEFAULT_TILE_START));
    setPendingEndYear(String(DEFAULT_TILE_END));
    setTileStartYear(DEFAULT_TILE_START);
    setTileEndYear(DEFAULT_TILE_END);
  }, []);

  const handleDatasetChange = useCallback((newDataset) => {
    if (newDataset === dataset) return;
    setDataset(newDataset);
    setZoneData(null);
    setClimateData(null);
    setGczStats(null);
  }, [dataset]);

  const handleMapClick = useCallback((lon, lat) => {
    setSelectedCoords({ lon, lat });
    setError(null);
  }, []);

  const handleCoordinatesChange = useCallback((lon, lat) => {
    setSelectedCoords({ lon, lat });
  }, []);

  function buildSummary() {
    const lines = [];
    lines.push('Global Climate & Ecological Zones — Point Summary');
    lines.push('='.repeat(50));
    if (selectedCoords) {
      lines.push(`Coordinates: ${selectedCoords.lon.toFixed(4)}°E, ${selectedCoords.lat.toFixed(4)}°N`);
    } else {
      lines.push('Coordinates: (none)');
    }
    lines.push('');

    if (zoneData) {
      lines.push('TIER 1: Climate & Ecological Zones');
      lines.push(`  GCZ:      ${zoneData.gcz.label} (${zoneData.gcz.value})`);
      lines.push(`  GEZ:      ${zoneData.gez.label} (${zoneData.gez.code})`);
      lines.push(`  HLZ II:   ${zoneData.hlzII.label} (${zoneData.hlzII.value})`);
      lines.push(`  HLZ III:  ${zoneData.hlzIII.label} (${zoneData.hlzIII.value})`);
    }

    if (climateData?.bio) {
      const { biotemperature, precipitation, petRatio, elevation } = climateData.bio;
      lines.push('');
      lines.push('BIOCLIMATIC PARAMETERS');
      lines.push(`  Mean annual biotemperature (tBio): ${biotemperature} °C`);
      lines.push(`  Mean annual precipitation (P):     ${precipitation} mm`);
      lines.push(`  PET ratio (R):                     ${petRatio}`);
      lines.push(`  Elevation:                         ${elevation} m`);
    }

    if (climateData?.annual) {
      const { meanAnnualTemp, meanAnnualPrecip } = climateData.annual;
      lines.push('');
      lines.push('TIER 1b: Temperature & Precipitation');
      lines.push(`  Mean annual temperature (MAT): ${meanAnnualTemp} °C`);
      lines.push(`  Mean annual precipitation (MAP): ${meanAnnualPrecip} mm`);
    }

    if (climateData?.monthly && climateData.monthly.length > 0) {
      lines.push('');
      lines.push('MONTHLY CLIMATE DATA');
      lines.push('  Month     Temp (°C)  Precip (mm)');
      climateData.monthly.forEach((d) => {
        const m = String(d.month).padEnd(9);
        const t = String(d.temperature ?? '—').padStart(9);
        const p = String(d.precipitation ?? '—').padStart(11);
        lines.push(`  ${m} ${t}  ${p}`);
      });
    }

    if (gczStats?.rows && gczStats.rows.length > 0) {
      lines.push('');
      lines.push('MEAN ANNUAL TEMPERATURE PER GLOBAL CLIMATE ZONE (1995–2024)');
      lines.push('  Zone                      Median (°C)  Min (°C)  Max (°C)');
      gczStats.rows.forEach((r) => {
        const zone = String(r.label || r.zone).padEnd(25);
        const med  = String(r.median ?? '—').padStart(11);
        const min  = String(r.min ?? '—').padStart(8);
        const max  = String(r.max ?? '—').padStart(8);
        lines.push(`  ${zone} ${med}  ${min}  ${max}`);
      });
    }

    lines.push('');
    lines.push(`Exported: ${new Date().toISOString()}`);
    return lines.join('\n');
  }

  function handleCopy() {
    if (!zoneData && !climateData) return;
    navigator.clipboard.writeText(buildSummary()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const hasData = !!(zoneData || climateData);

  const [panelVisible, setPanelVisible] = React.useState(true);
  const [localLon, setLocalLon] = React.useState('');
  const [localLat, setLocalLat] = React.useState('');
  const [tourForceOpen, setTourForceOpen] = React.useState(false);

  React.useEffect(() => {
    if (selectedCoords) {
      setLocalLon(selectedCoords.lon);
      setLocalLat(selectedCoords.lat);
    }
  }, [selectedCoords]);

  function handleCoordInput(field, value) {
    const num = parseFloat(value);
    if (field === 'lon') {
      setLocalLon(value);
      if (!isNaN(num) && !isNaN(parseFloat(localLat))) {
        handleCoordinatesChange(num, parseFloat(localLat));
      }
    } else {
      setLocalLat(value);
      if (!isNaN(num) && !isNaN(parseFloat(localLon))) {
        handleCoordinatesChange(parseFloat(localLon), num);
      }
    }
  }

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className="app-container">
      <div className="map-container">
        <MapComponent
          onMapClick={handleMapClick}
          selectedCoords={selectedCoords}
          zoneData={zoneData}
          panelVisible={panelVisible}
          onPanelToggle={() => setPanelVisible(v => !v)}
          dataset={dataset}
          startYear={tileStartYear}
          endYear={tileEndYear}
        />
      </div>
      
      <div className={`panel-container${panelVisible ? '' : ' panel-container--hidden'}`}>
        <div className="panel-header">
          <h1 title="IPCC land stratification for National Greenhouse Gas Inventories (NGGI)">IPCC land stratification for National Greenhouse Gas Inventories <span className="nggi">(NGGI)</span></h1>
        </div>

        {/* previous explorer placeholder moved below coordinates (rendered as subtitle) */}

        <div className="shared-coords" data-tour="coords">
          <p className="shared-coords-hint">Click on the map or enter coordinates to query climate and ecological zone data</p>
          <div className="coords-input">
            <label>
              Lon:
              <input
                type="number"
                min="-180"
                max="180"
                step="0.0001"
                value={localLon}
                onChange={(e) => handleCoordInput('lon', e.target.value)}
              />
            </label>
            <label>
              Lat:
              <input
                type="number"
                min="-90"
                max="90"
                step="0.0001"
                value={localLat}
                onChange={(e) => handleCoordInput('lat', e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Explorer section: subtitle + Tier 1 and Tier 1b panels */}
        <div className="explorer-section" data-tour="tier">
          <div className="subtitle" role="note" aria-label="Previous Explorer Subtitle">
            <div className="subtitle-banner">
              <span className="subtitle-left">EXPLORER</span>
              <span className="subtitle-right">Climate &amp; Ecological Zones</span>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Dataset selector */}
          <div className="dataset-selector" data-tour="dataset">
            <button
              className={`dataset-btn${dataset === 'cru' ? ' dataset-btn--active' : ''}`}
              onClick={() => handleDatasetChange('cru')}
            >
              CRU (55 km)
            </button>
            <button
              className={`dataset-btn${dataset === 'terraclimate' ? ' dataset-btn--active' : ''}`}
              onClick={() => handleDatasetChange('terraclimate')}
            >
              TerraClimate (5 km)
            </button>
          </div>

          {/* Year range selector for GCZ / GEZ / HLZ map tiles */}
          <div className="year-range-selector" data-tour="yearRange">
            <button
              type="button"
              className="year-range-toggle"
              onClick={() => setYearRangeOpen(o => !o)}
              aria-expanded={yearRangeOpen}
            >
              <span className="year-range-toggle-caret">{yearRangeOpen ? '▾' : '▸'}</span>
              Select year range of GCZ, GEZ and HLZ
              <span className="year-range-current">
                ({tileStartYear}–{tileEndYear}{(tileStartYear === DEFAULT_TILE_START && tileEndYear === DEFAULT_TILE_END) ? ' IPCC default' : ''})
              </span>
            </button>
            {yearRangeOpen && (
              <div className="year-range-body">
                <div className="year-range-inputs">
                  <label>
                    Start
                    <input
                      type="number"
                      min={tileMinYear}
                      max={tileMaxYear}
                      step="1"
                      value={pendingStartYear}
                      onChange={(e) => setPendingStartYear(e.target.value)}
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="number"
                      min={tileMinYear}
                      max={tileMaxYear}
                      step="1"
                      value={pendingEndYear}
                      onChange={(e) => setPendingEndYear(e.target.value)}
                    />
                  </label>
                </div>
                <div className="year-range-actions">
                  <button
                    type="button"
                    className="year-range-btn year-range-btn--apply"
                    onClick={handleApplyYearRange}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="year-range-btn"
                    onClick={handleResetYearRange}
                  >
                    Reset to {DEFAULT_TILE_START}–{DEFAULT_TILE_END}
                  </button>
                </div>
                <p className="year-range-hint">
                  Allowed: {tileMinYear}–{tileMaxYear} · Recomputes the GCZ, GEZ, HLZ II and HLZ III map tiles for the selected period.
                </p>
              </div>
            )}
          </div>

          <ZonePanel
            coords={selectedCoords}
            zoneData={zoneData}
            bioData={climateData?.bio}
            onCoordsChange={handleCoordinatesChange}
            onZoneDataUpdate={setZoneData}
            loading={loading}
            onLoadingChange={setLoading}
            onError={setError}
            dataset={dataset}
          />

          <hr className="tier-separator" />

          <ClimatePanel
            coords={selectedCoords}
            onClimateDataUpdate={setClimateData}
            bioData={climateData?.bio}
            loading={loading}
            onLoadingChange={setLoading}
            onError={setError}
            dataset={dataset}
            onGczStatsUpdate={setGczStats}
          />
        </div>

        {/* EXPLORER Soils section */}
        <div className="explorer-section explorer-section--spaced-bottom" style={{ marginTop: 12 }} data-tour="soils">
          <div className="subtitle" role="note" aria-label="Soils Explorer Subtitle">
            <div className="subtitle-banner">
              <span className="subtitle-left">EXPLORER</span>
              <span className="subtitle-right">Soils</span>
            </div>
          </div>

          <SoilsPanel
            coords={selectedCoords}
            zoneData={zoneData}
          />
        </div>

        <div className="panel-footer">
          <div className="footer-copy-row">
            <div className="footer-copy-info">
              <span className="footer-copy-title">Export point summary</span>
              <span className="footer-copy-sub">
                {hasData
                  ? (selectedCoords ? `${selectedCoords.lon.toFixed(4)}°E, ${selectedCoords.lat.toFixed(4)}°N` : 'Click the map to load data')
                  : 'Click the map to load data'}
              </span>
            </div>
            <button
              className={`footer-copy-btn${copied ? ' footer-copy-btn--done' : ''}`}
              onClick={handleCopy}
              disabled={!hasData}
            >
              {copied ? '✓ Copied' : 'Copy all outputs'}
            </button>
          </div>
        </div>
      </div>

      <TourLauncher onOpen={() => setTourForceOpen(true)} />
      <Tour forceOpen={tourForceOpen} onClose={() => setTourForceOpen(false)} />
    </div>
  );
}

export default App;
