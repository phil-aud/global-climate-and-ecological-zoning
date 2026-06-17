/**
 * Global Climate Zones (HLZ pyramid)
 *
 * Displays global_climate_zone_pyramid.svg (the rendered figure) with red iso-line overlays for:
 *   - Mean annual biotemperature (horizontal line)
 *   - Annual precipitation (diagonal, parallel to left side)
 *   - PET ratio (diagonal, parallel to right side)
 * and an orange midpoint marker at the intersection of the three lines.
 *
 * Calibration constants are read directly from pyramid2_old.svg
 * (viewBox="0 0 1370 1172.24").
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { GCZ_PALETTE } from '../utils/zonePalettes';
import DownloadButtons from './DownloadButtons';
import { downloadCSV, downloadCompositePNG } from '../utils/exportFigure';

// ── pyramid2_old.svg coordinate system ────────────────────────────────────────────
const IMG2_W = 1370;
const IMG2_H = 1172.24;

// Triangle vertices in pyramid2_old.svg user-space
const IMG2_APEX = { x: 752.15, y: 307.24 };
const IMG2_BL   = { x: 358,    y: 989.92 };
const IMG2_BR   = { x: 1146.3, y: 989.92 };

// y-positions of the biotemperature boundary lines (class st12 in pyramid2_old.svg)
// Spacing = 82.25 px per octave (same as pyramid1); extrapolated 48° = 921.74 + 82.25 = 1003.99
const IMG2_BT_Y_TOP = 592.74;  // 1.5°C
const IMG2_BT_Y_BOT = 1003.99; // extrapolated 48°C

// Precipitation: iso-lines parallel to left side, base x-positions from SVG st11 lines.
// Lines at y≈988.74: 452.8=125mm, 548.8=250, 643.8=500, 737.8=1000, 832.8=2000,
//   927.8=4000, 1023.8=8000, 1117.8=16000 — spacing ≈94.5px/octave.
// 62.5mm extrapolates left: 452.8 - 94.5 = 358.3 ≈ BL.x.
const IMG2_PRECIP_X0 = 358.3;   // 62.5 mm  (≈ BL.x)
const IMG2_PRECIP_X1 = 1117.8;  // 16000 mm

// PET ratio: iso-lines parallel to right side, parameterised via LEFT SIDE intersection y.
// Actual left-side intersection y-values computed from SVG line geometry:
//   PET 0.125→y=309.2, 0.25→389.5, 0.5→470.5, 1→552.7, 2→635.4, 4→716.1, 8→798.2, 16→880.8, 32→963.5
// Spacing ≈82px/octave. Anchor: PET=1 → left-side y=552.7.
const IMG2_PET_LEFT_Y_AT_1 = 552.7;       // left-side y for PET=1
const IMG2_PET_LEFT_Y_PER_OCTAVE = 82.0;  // px per doubling (higher PET → larger y = lower on chart)

function petToLeftY(pet) {
  return IMG2_PET_LEFT_Y_AT_1 + Math.log2(pet) * IMG2_PET_LEFT_Y_PER_OCTAVE;
}
function leftSideXatY(y) {
  const t = (y - IMG2_BL.y) / (IMG2_APEX.y - IMG2_BL.y);
  return IMG2_BL.x + t * (IMG2_APEX.x - IMG2_BL.x);
}


// ── Component ──────────────────────────────────────────────────────────────────

function GlobalClimateZonesTriangle({ bioData }) {
  const [expanded, setExpanded] = useState(false);
  const figureRef = useRef(null);

  const hasBioData = bioData && (
    bioData.biotemperature != null || bioData.precipitation != null || bioData.petRatio != null
  );
  const downloadGczCSV = () => {
    downloadCSV(
      'global_climate_zone_pyramid_point',
      ['Variable', 'Value'],
      [
        ['Mean annual biotemperature tBio (°C)', bioData?.biotemperature],
        ['Mean annual precipitation P (mm)', bioData?.precipitation],
        ['Potential evapotranspiration ratio', bioData?.petRatio],
        ['Elevation (m)', bioData?.elevation],
      ]
    );
  };

  // Close modal on Escape key
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // ── Reference biotemperature line ────────────────────────────────────────────
  // GCZ pyramid uses tBio (mean annual biotemperature at elevation), not the sea-level t0Bio.
  const refBiotempLine = useMemo(() => {
    const tBioSL = parseFloat(bioData?.biotemperature); // tBio — biotemperature at elevation, used for triangle axis
    const tBioElev = tBioSL;                            // same value used for label
    if (!tBioSL || isNaN(tBioSL)) return null;
    const btClamped = Math.max(1.5, Math.min(48, tBioSL));
    const f = Math.log2(btClamped / 1.5) / Math.log2(48 / 1.5);
    const y = IMG2_BT_Y_TOP + f * (IMG2_BT_Y_BOT - IMG2_BT_Y_TOP);
    const yClipped = Math.min(y, IMG2_BL.y);
    const triH = IMG2_BL.y - IMG2_APEX.y;
    const t = (yClipped - IMG2_APEX.y) / triH;
    const x1 = IMG2_APEX.x + (IMG2_BL.x - IMG2_APEX.x) * t;
    const x2 = IMG2_APEX.x + (IMG2_BR.x - IMG2_APEX.x) * t;
    const labelBt = !isNaN(tBioElev) ? tBioElev : tBioSL;
    return { x1, y1: yClipped, x2, y2: yClipped, label: `${Math.round(labelBt * 10) / 10}° (tBio)` };
  }, [bioData?.biotemperature]);

  // ── Reference precipitation line ─────────────────────────────────────────────
  // Starts at the base, goes parallel to the left side (BL → APEX), ends on right side.
  const refPrecipLine = useMemo(() => {
    const pr = parseFloat(bioData?.precipitation);
    if (!pr || isNaN(pr)) return null;
    const prClamped = Math.max(62.5, Math.min(16000, pr));
    const f = Math.log2(prClamped / 62.5) / Math.log2(16000 / 62.5);
    const baseX = IMG2_PRECIP_X0 + f * (IMG2_PRECIP_X1 - IMG2_PRECIP_X0);
    const baseY = IMG2_BL.y;
    // Direction: parallel to left side (BL → APEX)
    const dx = IMG2_APEX.x - IMG2_BL.x;
    const dy = IMG2_APEX.y - IMG2_BL.y;
    // Intersection with right side
    const t = (baseX - IMG2_BR.x) / (IMG2_BL.x - IMG2_BR.x);
    const ex = baseX + dx * t;
    const ey = baseY + dy * t;
    const label = `${Math.round(pr)} (P)`;
    return { x1: baseX, y1: baseY, x2: ex, y2: ey, label };
  }, [bioData?.precipitation]);

  // ── Reference PET ratio line ──────────────────────────────────────────────────
  // Parameterised via left-side tick y-position. Line starts on left side and goes
  // parallel to right side (BR→APEX) direction, ending at the base.
  const refPetLine = useMemo(() => {
    const pet = parseFloat(bioData?.petRatio);
    if (!pet || isNaN(pet)) return null;
    const petClamped = Math.max(0.125, Math.min(32, pet));
    // Start: on left side at the tick y-position (clamped inside triangle)
    const leftY = Math.max(IMG2_APEX.y, Math.min(IMG2_BL.y, petToLeftY(petClamped)));
    const leftX = leftSideXatY(leftY);
    // Direction: parallel to right side (BR → APEX), i.e. going right and down to base
    // We want the line going FROM left side TOWARD base/right, so use opposite direction: BR - APEX
    const dx = IMG2_BR.x - IMG2_APEX.x;  // positive (goes right)
    const dy = IMG2_BR.y - IMG2_APEX.y;  // positive (goes down)
    // End: intersection with base (y = BL.y)
    const t = (IMG2_BL.y - leftY) / dy;
    const endX = Math.min(IMG2_BR.x, Math.max(IMG2_BL.x, leftX + t * dx));
    const label = petClamped < 1
      ? `${Math.round(petClamped * 1000) / 1000} (petRatio)`
      : `${Math.round(petClamped * 10) / 10} (petRatio)`;
    return { x1: leftX, y1: leftY, x2: endX, y2: IMG2_BL.y, label };
  }, [bioData?.petRatio]);

  // ── Life zone midpoint ────────────────────────────────────────────────────────
  const lifeZonePoint = useMemo(() => {
    if (!refBiotempLine || !refPrecipLine || !refPetLine) return null;
    const yBt = refBiotempLine.y1;
    // tBio ∩ Precip: walk along precip line (direction BL→APEX) from base to yBt
    const dpx = IMG2_APEX.x - IMG2_BL.x;
    const dpy = IMG2_APEX.y - IMG2_BL.y;
    const tA = (yBt - refPrecipLine.y1) / dpy;
    const ax = refPrecipLine.x1 + tA * dpx;
    // tBio ∩ PET: walk along PET line (direction APEX→BR, i.e. from left side downward)
    // PET line goes from leftX,leftY in direction (BR-APEX). Walk backward to reach yBt.
    const drx = IMG2_BR.x - IMG2_APEX.x;
    const dry = IMG2_BR.y - IMG2_APEX.y;
    const tB = (yBt - refPetLine.y1) / dry;
    const bx = refPetLine.x1 + tB * drx;
    return { x: (ax + bx) / 2, y: yBt };
  }, [refBiotempLine, refPrecipLine, refPetLine]);

  // ── SVG overlay (shared between inline and modal) ─────────────────────────────
  const overlay = (
    <svg
      viewBox={`0 0 ${IMG2_W} ${IMG2_H}`}
      width="100%"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      {refBiotempLine && (
        <g>
          <line
            x1={refBiotempLine.x1} y1={refBiotempLine.y1}
            x2={refBiotempLine.x2} y2={refBiotempLine.y2}
            stroke="red" strokeWidth="3"
          />
          <text
            x={refBiotempLine.x1 - 12} y={refBiotempLine.y1}
            textAnchor="end" fontSize="22" fill="red"
            dominantBaseline="middle" fontWeight="700"
          >
            {refBiotempLine.label}
          </text>
        </g>
      )}
      {refPrecipLine && (
        <g>
          <line
            x1={refPrecipLine.x1} y1={refPrecipLine.y1}
            x2={refPrecipLine.x2} y2={refPrecipLine.y2}
            stroke="red" strokeWidth="3"
          />
          <text
            x={refPrecipLine.x2 + 18} y={refPrecipLine.y2}
            textAnchor="start" fontSize="22" fill="red"
            dominantBaseline="middle" fontWeight="700"
          >
            {refPrecipLine.label}
          </text>
        </g>
      )}
      {refPetLine && (
        <g>
          <line
            x1={refPetLine.x1} y1={refPetLine.y1}
            x2={refPetLine.x2} y2={refPetLine.y2}
            stroke="red" strokeWidth="3"
          />
          {/* Label at left-side start of the PET line */}
          <text
            x={refPetLine.x1 - 18} y={refPetLine.y1}
            textAnchor="end" fontSize="22" fill="red"
            dominantBaseline="middle" fontWeight="700"
          >
            {refPetLine.label}
          </text>
        </g>
      )}
      {lifeZonePoint && (
        <g>
          {/* Outer glow rings */}
          <circle cx={lifeZonePoint.x} cy={lifeZonePoint.y} r="30" fill="orange" fillOpacity="0.12" stroke="none" />
          <circle cx={lifeZonePoint.x} cy={lifeZonePoint.y} r="22" fill="orange" fillOpacity="0.22" stroke="none" />
          {/* Solid filled dot with thick white border */}
          <circle cx={lifeZonePoint.x} cy={lifeZonePoint.y} r="14" fill="orange" stroke="white" strokeWidth="3.5" />
          {/* Dark outline */}
          <circle cx={lifeZonePoint.x} cy={lifeZonePoint.y} r="14" fill="none" stroke="#b85c00" strokeWidth="1.5" />
          {/* Crosshair lines */}
          <line x1={lifeZonePoint.x - 26} y1={lifeZonePoint.y} x2={lifeZonePoint.x - 17} y2={lifeZonePoint.y} stroke="orange" strokeWidth="2.5" />
          <line x1={lifeZonePoint.x + 17} y1={lifeZonePoint.y} x2={lifeZonePoint.x + 26} y2={lifeZonePoint.y} stroke="orange" strokeWidth="2.5" />
          <line x1={lifeZonePoint.x} y1={lifeZonePoint.y - 26} x2={lifeZonePoint.x} y2={lifeZonePoint.y - 17} stroke="orange" strokeWidth="2.5" />
          <line x1={lifeZonePoint.x} y1={lifeZonePoint.y + 17} x2={lifeZonePoint.x} y2={lifeZonePoint.y + 26} stroke="orange" strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );

  const pyramidContent = (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <img
        src="/global_climate_zone_pyramid.svg"
        alt="Global Climate Zones (HLZ pyramid)"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
      {overlay}
    </div>
  );

  return (
    <div className="holdridge-triangle-container">
      <div className="pyramid-subsection-header">
        <span className="pyramid-subsection-title">Global Climate Zone pyramid</span>
        <span className="hlz-header-actions">
          <DownloadButtons
            label="Global Climate Zone pyramid"
            onPng={() => downloadCompositePNG(figureRef.current, 'global_climate_zone_pyramid')}
            onCsv={hasBioData ? downloadGczCSV : undefined}
          />
          <button
            className="hlz-maximize-btn"
            onClick={() => setExpanded(true)}
            title="Maximise"
            aria-label="Maximise pyramid"
          >
            &#x26F6;
          </button>
        </span>
      </div>

      <div ref={figureRef}>{pyramidContent}</div>

      {/* GCZ colour legend */}
      <div style={{ marginTop: 8, padding: '6px 4px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {GCZ_PALETTE.map(({ value, color, label }) => (
          <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#0f172a' }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14,
              background: color,
              border: '1px solid rgba(0,0,0,0.25)',
              borderRadius: 2, flexShrink: 0,
            }} />
            {label}
          </div>
        ))}
      </div>

      {/* Full-screen modal */}
      {expanded && (
        <div className="hlz-modal-backdrop" onClick={() => setExpanded(false)}>
          <div className="hlz-modal-content" onClick={e => e.stopPropagation()}>
            <button
              className="hlz-modal-close"
              onClick={() => setExpanded(false)}
              aria-label="Close"
            >
              ✕
            </button>
            {pyramidContent}
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalClimateZonesTriangle;
