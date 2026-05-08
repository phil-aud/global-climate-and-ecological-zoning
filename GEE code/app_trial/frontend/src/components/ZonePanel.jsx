/**
 * Zone Panel Component
 * Displays GCZ, GEZ, HLZ II, HLZ III results
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { queryZones } from '../utils/api';
import HoldridgeTriangle from './HoldridgeTriangle';
import GlobalClimateZonesTriangle from './GlobalClimateZonesTriangle';

function ZonePanel({ coords, zoneData, bioData, onCoordsChange, onZoneDataUpdate, loading, onLoadingChange, onError, dataset }) {
  const [localLon, setLocalLon] = useState(coords?.lon ?? '');
  const [localLat, setLocalLat] = useState(coords?.lat ?? '');
  const [altBeltsExpanded, setAltBeltsExpanded] = useState(false);

  // ── Altitudinal belts marker ─────────────────────────────────────────────────
  // SVG viewBox: 0 0 1329.03 1033.73
  // x-axis: LINEAR sea-level biotemperature 0°C (x=5.18) → 30°C (x=1091.83)
  // y-axis: linear elevation 0 m (y=884.91) → 5000 m (y=20.91)
  // Frost line (Lugo et al. 1999): mean annual frost days > 0.5 → Warm Temperate,
  //   ≤ 0.5 → Subtropical (same 12–24°C biotemperature band, split by measured frost).
  //   When frost line applies and seaLevelBT is in the 12–24°C band, the dot is
  //   placed at the 18°C boundary; a ghost dot shows the geometric sea-level position.
  const altMarker = useMemo(() => {
    const seaLevelBT = parseFloat(bioData?.biotemperature); // t0Bio from backend
    const elev = parseFloat(bioData?.elevation);
    const frostDays = parseFloat(bioData?.frostDays); // mean annual frost days (GEE: cruFrsMonthlyMean().sum())
    if (isNaN(seaLevelBT) || isNaN(elev)) return null;

    const elevClamped = Math.max(0, Math.min(5000, elev));
    const y = 884.91 - (elevClamped / 5000) * (884.91 - 20.91);

    // Frost line: > 0.5 mean annual frost days → Warm Temperate side of the 12–24°C band
    // Only relevant when seaLevelBT falls in the shared 12–24°C band
    const inSharedBand = seaLevelBT >= 12 && seaLevelBT < 24;
    const frostLineApplies = inSharedBand && !isNaN(frostDays) && frostDays > 0.5;

    const btMain = frostLineApplies ? 18 : Math.max(0, Math.min(30, seaLevelBT));
    const xMain = 5.18 + (btMain / 30) * (1091.83 - 5.18);

    // Ghost position: geometric sea-level BT (only shown when frost line snaps dot to 18°C)
    const xGhost = frostLineApplies
      ? 5.18 + (Math.min(30, seaLevelBT) / 30) * (1091.83 - 5.18)
      : null;

    return { x: xMain, y, xGhost, frostLineApplies };
  }, [bioData?.biotemperature, bioData?.elevation, bioData?.frostDays]);

  useEffect(() => {
    if (!altBeltsExpanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setAltBeltsExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [altBeltsExpanded]);

  const fetchZoneData = useCallback(async (lon, lat) => {
    try {
      onLoadingChange(true);
      onError(null);
      const data = await queryZones(lon, lat, dataset);
      onZoneDataUpdate(data);
    } catch (err) {
      onError(err.message);
      onZoneDataUpdate(null);
    } finally {
      onLoadingChange(false);
    }
  }, [onLoadingChange, onError, onZoneDataUpdate, dataset]);

  useEffect(() => {
    if (!coords || coords.lon == null || coords.lat == null) return;
    setLocalLon(coords.lon);
    setLocalLat(coords.lat);
    fetchZoneData(coords.lon, coords.lat);
  }, [coords, fetchZoneData, dataset]);

  

  return (
    <div className="zone-panel">
      <div className="panel-title">
        <span className="tier-badge">Tier 1</span>
        <span className="tier-label subsubtitle">Global Climate &amp; Ecological Zones</span>
      </div>
      <p className="panel-desc">
        The Global Climate Zones (GCZ) and Global Ecological Zones (GEZ) are based on the Holdridge Life Zone (HLZ) scheme, ensuring for the first time an exact correspondence between GCZs and GEZs. All raster and vector files can be downloaded here: <a href="https://github.com/phil-aud/global-climate-and-ecological-zoning" target="_blank" rel="noopener noreferrer">https://github.com/phil-aud/global-climate-and-ecological-zoning</a>
      </p>

      

      {loading && <div className="loading">Loading zone data...</div>}

      <div className="zone-results">
        <div className="zone-row zone-row--highlight">
          <div className="zone-label">GCZ</div>
          <div className="zone-value">
            {zoneData?.gcz?.label ?? '—'} {zoneData?.gcz?.value ? `(${zoneData.gcz.value})` : ''}
          </div>
        </div>
        <div className="zone-row zone-row--highlight">
          <div className="zone-label">GEZ (HLZ I)</div>
          <div className="zone-value">
            {zoneData?.gez?.label ?? '—'} {zoneData?.gez?.code ? `(${zoneData.gez.code})` : ''}
          </div>
        </div>
        <div className="zone-row">
          <div className="zone-label">HLZ II</div>
          <div className="zone-value">
            {zoneData?.hlzII?.label ?? '—'} {zoneData?.hlzII?.value ? `(${zoneData.hlzII.value})` : ''}
          </div>
        </div>
        <div className="zone-row">
          <div className="zone-label">HLZ III</div>
          <div className="zone-value">
            {zoneData?.hlzIII?.label ?? '—'} {zoneData?.hlzIII?.value ? `(${zoneData.hlzIII.value})` : ''}
          </div>
        </div>
        {/* Soil moved to dedicated Soils panel */}
      </div>

      <div className="bio-summary">
        <p>
          <strong>Mean annual biotemperature (tBio):</strong>{' '}
          {bioData?.biotemperature != null && bioData?.elevation != null
            ? `${Math.round((bioData.biotemperature - (bioData.elevation * 6 / 1000)) * 100) / 100}°C`
            : '—'}
        </p>
        <p>
          <strong><em>Mean annual biotemperature (tBio) at sea-level:</em></strong> <em>{bioData?.biotemperature ?? '—'}°C</em>
        </p>
        <p>
          <strong>Mean annual precipitation (P):</strong> {bioData?.precipitation ?? '—'} mm
        </p>
        <p>
          <strong>Potential evapotranspiration ratio (R):</strong> {bioData?.petRatio ?? '—'}
        </p>
        <p>
          <strong>Elevation:</strong> {bioData?.elevation ?? '—'} m
        </p>
      </div>

      <div className="pyramids-group">
        <GlobalClimateZonesTriangle bioData={bioData} />

        <HoldridgeTriangle bioData={bioData} imgSrc={'/pyramid1bis.svg'} hideReference={true} title="Global Ecological Zone pyramid" badge="GEZ" />

        <HoldridgeTriangle bioData={bioData} imgSrc={'/pyramid1_grey.svg'} hideReference={true} title="Holdridge Life Zone pyramid" badge="HLZ" hideLegend={true} />

        <div className="holdridge-triangle-container">
          <div className="pyramid-subsection-header">
            <span className="pyramid-subsection-title">Latitudinal regions and altitudinal belts</span>
            <button
              className="hlz-maximize-btn"
              onClick={() => setAltBeltsExpanded(true)}
              title="Maximise"
              aria-label="Maximise altitudinal belts diagram"
            >
              &#x26F6;
            </button>
          </div>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <img
              src="/Altidudinal_belts.svg"
              alt="Latitudinal regions and altitudinal belts in the Holdridge Life Zones"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            <svg
              viewBox="0 0 1329.03 1033.73"
              width="100%"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              preserveAspectRatio="xMidYMid meet"
              xmlns="http://www.w3.org/2000/svg"
            >
              {altMarker && (
                <g>
                  {/* Ghost dot: uncorrected geometric position (only when frost line applies) */}
                  {altMarker.xGhost != null && (
                    <g opacity="0.35">
                      <circle cx={altMarker.xGhost} cy={altMarker.y} r="12" fill="orange" stroke="white" strokeWidth="2" />
                      {/* Arrow from ghost toward main dot */}
                      <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                          <path d="M0,0 L0,6 L6,3 z" fill="orange" />
                        </marker>
                      </defs>
                      <line
                        x1={altMarker.xGhost - 16} y1={altMarker.y}
                        x2={altMarker.x + 16} y2={altMarker.y}
                        stroke="orange" strokeWidth="2.5"
                        markerEnd="url(#arrowhead)"
                        strokeDasharray="6,3"
                      />
                    </g>
                  )}
                  {/* Main dot: frost-corrected position */}
                  <circle cx={altMarker.x} cy={altMarker.y} r="28" fill="orange" fillOpacity="0.12" stroke="none" />
                  <circle cx={altMarker.x} cy={altMarker.y} r="20" fill="orange" fillOpacity="0.22" stroke="none" />
                  <circle cx={altMarker.x} cy={altMarker.y} r="12" fill="orange" stroke="white" strokeWidth="3" />
                  <circle cx={altMarker.x} cy={altMarker.y} r="12" fill="none" stroke="#b85c00" strokeWidth="1.5" />
                  <line x1={altMarker.x - 24} y1={altMarker.y} x2={altMarker.x - 15} y2={altMarker.y} stroke="orange" strokeWidth="2.5" />
                  <line x1={altMarker.x + 15} y1={altMarker.y} x2={altMarker.x + 24} y2={altMarker.y} stroke="orange" strokeWidth="2.5" />
                  <line x1={altMarker.x} y1={altMarker.y - 24} x2={altMarker.x} y2={altMarker.y - 15} stroke="orange" strokeWidth="2.5" />
                  <line x1={altMarker.x} y1={altMarker.y + 15} x2={altMarker.x} y2={altMarker.y + 24} stroke="orange" strokeWidth="2.5" />
                </g>
              )}
            </svg>
          </div>
          <p style={{ margin: '6px 4px 0', fontSize: 11, color: '#555', fontStyle: 'italic' }}>
            Approximate equivalence of latitudinal regions and altitudinal belts for Holdridge Life Zones (based on average 6° lapse rate)
          </p>
        </div>

        {altBeltsExpanded && (
          <div className="hlz-modal-backdrop" onClick={() => setAltBeltsExpanded(false)}>
            <div className="hlz-modal-content" onClick={e => e.stopPropagation()}>
              <button
                className="hlz-modal-close"
                onClick={() => setAltBeltsExpanded(false)}
                aria-label="Close"
              >
                ✕
              </button>
              <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                <img
                  src="/Altidudinal_belts.svg"
                  alt="Latitudinal regions and altitudinal belts in the Holdridge Life Zones"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
                <svg
                  viewBox="0 0 1329.03 1033.73"
                  width="100%"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  preserveAspectRatio="xMidYMid meet"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {altMarker && (
                    <g>
                      {/* Ghost dot: uncorrected geometric position (only when frost line applies) */}
                      {altMarker.xGhost != null && (
                        <g opacity="0.35">
                          <circle cx={altMarker.xGhost} cy={altMarker.y} r="12" fill="orange" stroke="white" strokeWidth="2" />
                          <defs>
                            <marker id="arrowhead-modal" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                              <path d="M0,0 L0,6 L6,3 z" fill="orange" />
                            </marker>
                          </defs>
                          <line
                            x1={altMarker.xGhost - 16} y1={altMarker.y}
                            x2={altMarker.x + 16} y2={altMarker.y}
                            stroke="orange" strokeWidth="2.5"
                            markerEnd="url(#arrowhead-modal)"
                            strokeDasharray="6,3"
                          />
                        </g>
                      )}
                      {/* Main dot: frost-corrected position */}
                      <circle cx={altMarker.x} cy={altMarker.y} r="28" fill="orange" fillOpacity="0.12" stroke="none" />
                      <circle cx={altMarker.x} cy={altMarker.y} r="20" fill="orange" fillOpacity="0.22" stroke="none" />
                      <circle cx={altMarker.x} cy={altMarker.y} r="12" fill="orange" stroke="white" strokeWidth="3" />
                      <circle cx={altMarker.x} cy={altMarker.y} r="12" fill="none" stroke="#b85c00" strokeWidth="1.5" />
                      <line x1={altMarker.x - 24} y1={altMarker.y} x2={altMarker.x - 15} y2={altMarker.y} stroke="orange" strokeWidth="2.5" />
                      <line x1={altMarker.x + 15} y1={altMarker.y} x2={altMarker.x + 24} y2={altMarker.y} stroke="orange" strokeWidth="2.5" />
                      <line x1={altMarker.x} y1={altMarker.y - 24} x2={altMarker.x} y2={altMarker.y - 15} stroke="orange" strokeWidth="2.5" />
                      <line x1={altMarker.x} y1={altMarker.y + 15} x2={altMarker.x} y2={altMarker.y + 24} stroke="orange" strokeWidth="2.5" />
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="panel-sources">
        <p className="sources-title">Sources</p>
        <ul>
          <li>Audebert, P., Milne, E., Schiettecatte, L.S. et al. (2024) Ecological zoning for climate policy and global change studies. <em>Nat Sustain</em> 7, 1294–1303.</li>
          <li>Audebert et al. (2026). Aligning climate zoning to ecological zoning: A harmonized classification approach. Under review.</li>
          <li>Holdridge, L.R. (1967). <em>Life Zone Ecology</em>. Tropical Science Center, San José, Costa Rica.</li>
        </ul>
      </div>

    </div>
  );
}

export default ZonePanel;
