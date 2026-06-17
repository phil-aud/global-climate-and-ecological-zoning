/**
 * Holdridge Life Zone Triangle
 * 
 * Equilateral triangle with three geometric-progression axes:
 *   - Biotemperature (horizontal base): 1.5°, 3°, 6°, 12°, 24°
 *   - Annual Precipitation (left side, 120°→0°): 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 mm
 *   - PET Ratio (right side, 0°→60°): 0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32
 *
 * Coordinate system: the triangle vertices are computed in a Cartesian (x, y) system.
 * The SVG viewBox maps directly to these coordinates.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import DownloadButtons from './DownloadButtons';
import { downloadCSV, downloadCompositePNG } from '../utils/exportFigure';

// ── Constants ──────────────────────────────────────────────────────────────────
const SIDE = 600; // triangle side length in coordinate units
const SQRT3 = Math.sqrt(3);
const H = (SQRT3 / 2) * SIDE; // triangle height

// Vertices of the equilateral triangle (top-pointing)
// Bottom-left = A, Bottom-right = B, Top = C
const A = { x: 0, y: 0 };
const B = { x: SIDE, y: 0 };
const C = { x: SIDE / 2, y: H };

// ── Axis values (geometric progressions) ──────────────────────────────────────
// Biotemperature dividing lines between latitudinal regions (°C)
const BIOTEMPS = [1.5, 3, 6, 12, 24];

// Annual precipitation (mm) — 9 values forming boundaries within the triangle
const PRECIP = [62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// PET ratio — 9 values
const PET_RATIO = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32];

// ── pyramid1_old.svg overlay coordinate system ────────────────────────────────────
// These values are read directly from pyramid1_old.svg (viewBox="230 0 1400 1163.13")
// Note: viewBox has an X offset (minX = 230) to crop left whitespace while keeping
// the latitudinal region labels (leftmost at ~x=250) fully visible.
const IMG_VIEWBOX_X = 230;
const IMG_W = 1400;
const IMG_H = 1163.13;
// Triangle vertices in pyramid1_old.svg user-space
const IMG_APEX = { x: 997.92, y: 298.13 };
const IMG_BL   = { x: 603.77, y: 980.81 };
const IMG_BR   = { x: 1392.06, y: 980.81 };
// y-positions of the biotemperature boundary lines (class st18 in pyramid1_old.svg)
const IMG_BT_Y = { 1.5: 583.63, 3: 666.63, 6: 748.63, 12: 830.63, 24: 912.63 };
// y where the top-left/top-right edges of the outer polar hexagons intersect the triangle sides
// (left hexagon top-left edge crosses left triangle side at y≈503.2;
//  right hexagon top-right edge crosses right triangle side at y≈505.9; avg ≈ 504.5)
const IMG_POLAR_0_Y = 504.5;

// ── Latitudinal region labels ─────────────────────────────────────────────────
const LAT_REGIONS = [
  'Polar',        // 3 hexagons
  'Subpolar',     // 4 hexagons  
  'Boreal',       // 5 hexagons
  'Cool Temperate', // 6 hexagons
  'Warm Temperate', // 7 hexagons
  'Subtropical',    // 7 hexagons (same as warm temperate)
  'Tropical',       // 8 hexagons
];

// ── Humidity province labels ──────────────────────────────────────────────────
const HUMIDITY_PROVINCES = [
  'Superarid', 'Perarid', 'Arid', 'Semiarid',
  'Subhumid', 'Humid', 'Perhumid', 'Superhumid'
];

// ── Life zone names by row (bottom=tropical to top=polar) ─────────────────────
const LIFE_ZONES = [
  // Tropical (8 hexagons)
  ['Desert', 'Desert Scrub', 'Thorn Woodland', 'Very Dry Forest', 'Dry Forest', 'Moist Forest', 'Wet Forest', 'Rain Forest'],
  // Subtropical / Warm Temperate (7 hexagons)
  ['Desert', 'Desert Scrub', 'Thorn Steppe/\nWoodland', 'Dry Forest', 'Moist Forest', 'Wet Forest', 'Rain Forest'],
  // Cool Temperate (6 hexagons)
  ['Desert', 'Desert Scrub', 'Steppe', 'Moist Forest', 'Wet Forest', 'Rain Forest'],
  // Boreal (5 hexagons)
  ['Desert', 'Dry Scrub', 'Moist Forest', 'Wet Forest', 'Rain Forest'],
  // Subpolar (4 hexagons)
  ['Dry Tundra', 'Moist Tundra', 'Wet Tundra', 'Rain Tundra'],
  // Polar (3 hexagons)
  ['Desert', 'Desert', 'Desert'],
];

// ── Hex colours per row (matching the classic Holdridge diagram) ──────────────
const ROW_COLORS = [
  // Tropical
  ['#f5deb3', '#d2b48c', '#c4a86c', '#8fbc8f', '#5f9f5f', '#3cb371', '#2e8b57', '#228b22'],
  // Subtropical/Warm Temperate
  ['#f5deb3', '#d2b48c', '#c4a86c', '#8fbc8f', '#5f9f5f', '#3cb371', '#228b22'],
  // Cool Temperate
  ['#f5deb3', '#d2b48c', '#daa520', '#5f9f5f', '#3cb371', '#228b22'],
  // Boreal
  ['#f5deb3', '#d2b48c', '#5f9f5f', '#3cb371', '#228b22'],
  // Subpolar
  ['#e8d5b7', '#c9b896', '#a8cca8', '#7fbf7f'],
  // Polar
  ['#e0e0e0', '#d0d0d0', '#c0c0c0'],
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Convert normalised triangle coordinates (p, q, r) to Cartesian (x, y).
 * p = fraction along precipitation axis (left side, 0 at A, 1 at C)
 * q = fraction along PET ratio axis (right side, 0 at B, 1 at C)
 * The three barycentric-like fractions satisfy: the point lies at
 *   P = (1-p-q)*base_fraction + p*left + q*right  (simplified via lerp)
 *
 * We use a simpler parameterisation based on row (vertical) and column (horizontal):
 *   row_frac = vertical position (0 = base, 1 = apex)
 *   col_frac = horizontal position within that row (0 = left edge, 1 = right edge)
 */
function triPoint(rowFrac, colFrac) {
  // At rowFrac, the left edge point is lerp(A, C, rowFrac), right is lerp(B, C, rowFrac)
  const lx = A.x + (C.x - A.x) * rowFrac;
  const ly = A.y + (C.y - A.y) * rowFrac;
  const rx = B.x + (C.x - B.x) * rowFrac;
  const ry = B.y + (C.y - B.y) * rowFrac;
  return {
    x: lx + (rx - lx) * colFrac,
    y: ly + (ry - ly) * colFrac,
  };
}

/**
 * Normalised position along a geometric axis.
 * Given a value and the array of boundary values, returns 0..1 fraction
 * in log-space between first and last boundary.
 */
function geoFrac(value, boundaries) {
  const logMin = Math.log2(boundaries[0]);
  const logMax = Math.log2(boundaries[boundaries.length - 1]);
  const logVal = Math.log2(value);
  return (logVal - logMin) / (logMax - logMin);
}

/**
 * Build a flat-top hexagon path centred at (cx, cy) with given "radius" (centre to vertex).
 * Holdridge hexagons have vertices pointing up and down.
 */
function hexPath(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    // pointy-top: first vertex at 90°
    const angle = (Math.PI / 180) * (60 * i + 90);
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M${pts.join('L')}Z`;
}

// ── Group legend (matches the 5 colour groups originally in pyramid1_old.svg) ─────
const HLZ_LEGEND = [
  { label: 'Desert',                color: '#ee2531' },
  { label: 'Scrub/Woodland/Steppe', color: '#ff962e' },
  { label: 'Dry Forest',            color: '#fff431' },
  { label: 'Moist Forest',          color: '#69d600' },
  { label: 'Rain/Wet Forest',       color: '#58b79a' },
];

// ── Component ──────────────────────────────────────────────────────────────────

function HoldridgeTriangle({ bioData, imgSrc, hideReference = false, title = 'Holdridge Life Zone Triangle', badge = 'HLZ', hideLegend = false }) {
  const [expanded, setExpanded] = useState(false);
  const figureRef = useRef(null);

  const fileSlug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const hasBioData = bioData && (
    bioData.biotemperature != null || bioData.precipitation != null || bioData.petRatio != null
  );
  const downloadPointCSV = () => {
    downloadCSV(
      `${fileSlug}_point`,
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

  // Number of rows (polar=top to tropical=bottom): 6 rows of hexagons
  // Row 0 = tropical (8 hex), row 5 = polar (3 hex)
  const NUM_ROWS = 6;
  // Total "slots" in base row
  const BASE_COUNT = 8;

  const hexagons = useMemo(() => {
    const hexes = [];
    // Hex geometry: we divide the triangle height into NUM_ROWS bands.
    // Each row's vertical centre is at rowFrac = (row + 0.5) / NUM_ROWS from base.
    // Actually, rows go from bottom (tropical) to top (polar).
    // Row index 0 = tropical (bottom), row index 5 = polar (top).
    
    const rowHeight = 1 / NUM_ROWS; // fraction of triangle height per row
    // Hex radius in coordinate units
    const hexR = (H * rowHeight) / SQRT3 * 0.95;

    for (let row = 0; row < NUM_ROWS; row++) {
      const count = BASE_COUNT - row; // 8, 7, 6, 5, 4, 3
      // Vertical centre of this row (from base)
      const rowFrac = (row + 0.5) * rowHeight;
      
      for (let col = 0; col < count; col++) {
        // Horizontal fraction within this row (centred)
        const colFrac = (col + 0.5) / count;
        const pt = triPoint(rowFrac, colFrac);
        
        // Flip y for SVG (SVG y goes down, our y goes up)
        const names = LIFE_ZONES[row] || [];
        const colors = ROW_COLORS[row] || [];
        
        hexes.push({
          cx: pt.x,
          cy: H - pt.y, // flip for SVG
          r: hexR,
          label: names[col] || '',
          color: colors[col] || '#ddd',
          row,
          col,
        });
      }
    }
    return hexes;
  }, []);

  // Triangle outline vertices (SVG coords: y flipped)
  const triA = { x: A.x, y: H - A.y }; // bottom-left
  const triB = { x: B.x, y: H - B.y }; // bottom-right
  const triC = { x: C.x, y: H - C.y }; // top

  // Axis guide lines
  const precipLines = useMemo(() => {
    return PRECIP.map((val) => {
      const f = geoFrac(val, PRECIP);
      // Precipitation lines run parallel to the right side (B→C), from points on the left side (A→C)
      const startX = A.x + (C.x - A.x) * f;
      const startY = A.y + (C.y - A.y) * f;
      // End point: same height, hits right side
      // Line parallel to B→C from (startX, startY)
      const endX = startX + (B.x - A.x) * (1 - f);
      const endY = startY;
      return { val, x1: startX, y1: H - startY, x2: endX, y2: H - endY };
    });
  }, []);

  const petLines = useMemo(() => {
    return PET_RATIO.map((val) => {
      const f = geoFrac(val, PET_RATIO);
      // PET lines run parallel to the left side (A→C), from points on the right side (B→C)
      const startX = B.x + (C.x - B.x) * f;
      const startY = B.y + (C.y - B.y) * f;
      // End: same height, hits left side
      const endX = startX - (B.x - A.x) * (1 - f);
      const endY = startY;
      return { val, x1: startX, y1: H - startY, x2: endX, y2: H - endY };
    });
  }, []);

  const biotempLines = useMemo(() => {
    // Biotemperature lines are horizontal, dividing latitudinal regions
    // 5 values → 5 horizontal lines at specific vertical positions
    // The biotemperature axis maps along the triangle height
    // 1.5° at top (polar/subpolar boundary), 24° at bottom (subtropical/tropical boundary)
    // These are geometric: 1.5, 3, 6, 12, 24 — so log2 spacing
    return BIOTEMPS.map((val) => {
      // 24° = bottom of triangle (rowFrac=0 from base → but it's actually 
      // the dividing line between tropical row and subtropical row)
      // Map: 24° → rowFrac = 1/6 from base, 12° → 2/6, 6° → 3/6, 3° → 4/6, 1.5° → 5/6
      const idx = BIOTEMPS.indexOf(val);
      const rowFrac = (NUM_ROWS - 1 - idx) / NUM_ROWS; // from base
      const left = triPoint(rowFrac, 0);
      const right = triPoint(rowFrac, 1);
      return {
        val,
        x1: left.x,
        y1: H - left.y,
        x2: right.x,
        y2: H - right.y,
      };
    });
  }, []);

  // Precipitation diagonal lines (parallel to right side, i.e. from left-side to base/right-side)
  const precipDiagLines = useMemo(() => {
    return PRECIP.map((val) => {
      const f = geoFrac(val, PRECIP);
      // Point on left side at fraction f
      const lp = { x: A.x + (C.x - A.x) * f, y: A.y + (C.y - A.y) * f };
      // This line goes parallel to right side (B→C direction is (C.x-B.x, C.y-B.y))
      // Actually parallel to base-right → parallel to the side from B to C
      // Precipitation lines go from left side to bottom side (or right side)
      // Parallel to right side means direction of (B→C) = (C.x-B.x, C.y-B.y) = (-SIDE/2, H)
      // But we need to go from the left-side point to where it hits the base or right side.
      // Let's compute properly:
      // The line from lp parallel to BC: parametric: lp + t*(C-B)
      // It hits the base (y=0) when lp.y + t*H = 0 → t = -lp.y/H
      // It hits the right side ... let's just use base intersection if lp.y > 0 we go down
      // Direction BC = (C.x - B.x, C.y - B.y) = (SIDE/2 - SIDE, H - 0) = (-SIDE/2, H)
      // Going opposite direction to reach base: direction (SIDE/2, -H)
      const t = lp.y / H;
      const ep = { x: lp.x + t * (SIDE / 2), y: 0 };
      return { val, x1: lp.x, y1: H - lp.y, x2: ep.x, y2: H - ep.y };
    });
  }, []);

  const petDiagLines = useMemo(() => {
    return PET_RATIO.map((val) => {
      const f = geoFrac(val, PET_RATIO);
      // Point on right side at fraction f (from B toward C)
      const rp = { x: B.x + (C.x - B.x) * f, y: B.y + (C.y - B.y) * f };
      // Line parallel to left side (A→C): direction (C.x-A.x, C.y-A.y) = (SIDE/2, H)
      // Going opposite to reach base: direction (-SIDE/2, -H)
      const t = rp.y / H;
      const ep = { x: rp.x - t * (SIDE / 2), y: 0 };
      return { val, x1: rp.x, y1: H - rp.y, x2: ep.x, y2: H - ep.y };
    });
  }, []);

  // Reference biotemperature line — driven by bioData, computed in pyramid1_old.svg coordinate space
  // GEZ/HLZ pyramids use tBio (mean annual biotemperature at elevation), not the sea-level t0Bio.
  const refBiotempLine = useMemo(() => {
    const tBioSL = parseFloat(bioData?.biotemperature); // tBio — biotemperature at elevation, used for triangle axis
    const tBioElev = tBioSL;                            // same value used for label
    if (!tBioSL || isNaN(tBioSL)) return null;
    // Extend geometric progression one octave past 24° → 48°
    // Spacing in pyramid1_old.svg is 82px per octave (doubling); 48° extrapolates to y=994.63
    const btClamped = Math.max(1.5, Math.min(48, tBioSL));
    const f = Math.log2(btClamped / 1.5) / Math.log2(48 / 1.5);
    const yTop = IMG_BT_Y[1.5];  // 583.63
    const yBot = 994.63;          // extrapolated 48° (912.63 + 82)
    const y = yTop + f * (yBot - yTop);
    // x extent: walk along the triangle edges; clip y to the base so the line stays inside
    const yClipped = Math.min(y, IMG_BL.y);
    const triH = IMG_BL.y - IMG_APEX.y;
    const t = (yClipped - IMG_APEX.y) / triH;
    const x1 = IMG_APEX.x + (IMG_BL.x - IMG_APEX.x) * t;
    const x2 = IMG_APEX.x + (IMG_BR.x - IMG_APEX.x) * t;
    const labelBt = !isNaN(tBioElev) ? tBioElev : tBioSL;
    return { x1, y1: yClipped, x2, y2: yClipped, label: `${Math.round(labelBt * 10) / 10}° (tBio)` };
  }, [bioData?.biotemperature]);

  // Reference precipitation line — diagonal parallel to LEFT side (60° from base)
  // Precipitation tick marks are along the BASE of the triangle in pyramid1_old.svg.
  // Iso-precip lines go from the base UPWARD at 60° (parallel to the left side BL→APEX)
  // to the right side of the triangle.
  const refPrecipLine = useMemo(() => {
    const pr = parseFloat(bioData?.precipitation);
    if (!pr || isNaN(pr)) return null;
    const prClamped = Math.max(62.5, Math.min(16000, pr));
    // log2 fraction along the base: 62.5mm (f=0, at BL) → 16000mm (f=1, near BR)
    const f = Math.log2(prClamped / 62.5) / Math.log2(16000 / 62.5);
    // x-position on the base (calibrated from SVG: 62.5mm≈603.56, 16000mm=1363.56)
    const baseX = IMG_BL.x + f * (1363.56 - IMG_BL.x);
    const baseY = IMG_BL.y;
    // Direction: parallel to left side (BL → APEX), going up-right at 60°
    const dx = IMG_APEX.x - IMG_BL.x;
    const dy = IMG_APEX.y - IMG_BL.y;
    // End: intersection with the right side (BR → APEX)
    const t = (baseX - IMG_BR.x) / (IMG_BL.x - IMG_BR.x);
    const ex = baseX + dx * t;
    const ey = baseY + dy * t;
    const label = `${Math.round(pr)} (P)`;
    return { x1: baseX, y1: baseY, x2: ex, y2: ey, label };
  }, [bioData?.precipitation]);

  // Reference PET ratio line — parameterised via LEFT SIDE tick y-position (exact geometry).
  // Actual left-side intersection y-values from pyramid1_old.svg iso-line geometry:
  //   PET 0.125→y≈297, 0.25→379, 0.5→461, 1→544, 2→626, 4→707, 8→790, 16→872, 32→954
  // Anchor: PET=1 → left-side y=543.8, spacing=82.1px/octave.
  const refPetLine = useMemo(() => {
    const pet = parseFloat(bioData?.petRatio);
    if (!pet || isNaN(pet)) return null;
    const petClamped = Math.max(0.125, Math.min(32, pet));
    const leftY = Math.max(IMG_APEX.y, Math.min(IMG_BL.y,
      543.8 + Math.log2(petClamped) * 82.1
    ));
    const t = (leftY - IMG_BL.y) / (IMG_APEX.y - IMG_BL.y);
    const leftX = IMG_BL.x + t * (IMG_APEX.x - IMG_BL.x);
    // Direction: parallel to right side going down-right (left side → base)
    const dx = IMG_BR.x - IMG_APEX.x;
    const dy = IMG_BR.y - IMG_APEX.y;
    const t2 = (IMG_BL.y - leftY) / dy;
    const endX = Math.min(IMG_BR.x, Math.max(IMG_BL.x, leftX + t2 * dx));
    const label = petClamped < 1
      ? `${Math.round(petClamped * 1000) / 1000} (petRatio)`
      : `${Math.round(petClamped * 10) / 10} (petRatio)`;
    return { x1: leftX, y1: leftY, x2: endX, y2: IMG_BL.y, label };
  }, [bioData?.petRatio]);

  // Circumcenter of the triangle formed by the three red lines
  // = centroid of the three pairwise intersection points
  const lifeZonePoint = useMemo(() => {
    if (!refBiotempLine || !refPrecipLine || !refPetLine) return null;

    const yBt = refBiotempLine.y1; // tBio line is horizontal

    // Direction vectors
    const dpx = IMG_APEX.x - IMG_BL.x;  // precip: parallel to left side (going up)
    const dpy = IMG_APEX.y - IMG_BL.y;
    const drx = IMG_APEX.x - IMG_BR.x;  // PET: parallel to right side (going up-left)
    const dry = IMG_APEX.y - IMG_BR.y;

    // Vertex A: tBio ∩ P  (walk precip line from base upward to yBt)
    const tA = (yBt - refPrecipLine.y1) / dpy;
    const ax = refPrecipLine.x1 + tA * dpx;

    // Vertex B: tBio ∩ PET  (walk PET line from left-side start upward to yBt)
    const tB = (yBt - refPetLine.y1) / dry;
    const bx = refPetLine.x1 + tB * drx;

    // Vertex C: P ∩ PET  →  solve 2×2: refPrecipLine + t*dp = refPetLine + s*dr
    const det = dpx * (-dry) - dpy * (-drx);
    const cx1 = refPetLine.x1 - refPrecipLine.x1;
    const cy1 = refPetLine.y1 - refPrecipLine.y1;
    const tC = (cx1 * (-dry) - cy1 * (-drx)) / det;
    const cx = refPrecipLine.x1 + tC * dpx;
    const cy = refPrecipLine.y1 + tC * dpy;

    // Midpoint of the base side (tBio line segment between A and B)
    return { x: (ax + bx) / 2, y: yBt };
  }, [refBiotempLine, refPrecipLine, refPetLine]);

  // Frost-adjusted biotemperature line
  // When seaLevelBT ≥ 18°C, observedBT < 18°C, AND frost days > 0.5, the dot is
  // placed on the 18°C vertical frost line at the actual elevation.
  // This gives frostAdjBT = 18 - elev*6/1000, which is the observedBT that a site
  // at the 18°C frost boundary would have at this elevation.
  //
  // Geometric equivalence: at the 18°C frost line, each altitudinal belt spans the
  // same BT range as its latitudinal counterpart (nival=polar, alpine=subpolar, …).
  // The fraction within the belt — e.g. (elev - beltBase) / beltHeight in linear
  // elevation space — is recovered exactly by frostAdjBT = 18 - elev*6/1000, and
  // the log2 formula below then places the point at the correct geometric position
  // within the equivalent latitudinal region of the pyramid.
  const frostAdjBiotempLine = useMemo(() => {
    const tBioSL = parseFloat(bioData?.biotemperature);
    const elev = parseFloat(bioData?.elevation);
    const frostDays = parseFloat(bioData?.frostDays);
    if (isNaN(tBioSL) || isNaN(elev)) return null;
    const observedBT = tBioSL - (elev * 6 / 1000);
    if (tBioSL < 18 || observedBT >= 18) return null; // frost line not applicable
    if (isNaN(frostDays) || frostDays <= 0.5) return null; // no frost → no adjustment
    // frostAdjBT = observedBT at the 18°C frost line position for this elevation
    const frostAdjBT = Math.max(0, 18 - (elev * 6 / 1000));
    let yClipped;
    if (frostAdjBT === 0) {
      // BT reaches 0°C → clamp to 0°C = intersection of outer polar hexagons with triangle
      yClipped = IMG_POLAR_0_Y;
    } else {
      // Log2 extrapolation — same scale as the rest of the diagram.
      // Negative f values (frostAdjBT < 1.5°C) place the dot above the 1.5°C line
      // (i.e. in the polar/nival region). Clamped to IMG_POLAR_0_Y (0°C upper limit).
      const f = Math.log2(frostAdjBT / 1.5) / Math.log2(48 / 1.5);
      const yTop = IMG_BT_Y[1.5];
      const yBot = 994.63;
      const y = yTop + f * (yBot - yTop);
      yClipped = Math.max(IMG_POLAR_0_Y, Math.min(IMG_BL.y, y));
    }
    const triH = IMG_BL.y - IMG_APEX.y;
    const t = (yClipped - IMG_APEX.y) / triH;
    const x1 = IMG_APEX.x + (IMG_BL.x - IMG_APEX.x) * t;
    const x2 = IMG_APEX.x + (IMG_BR.x - IMG_APEX.x) * t;
    const label = frostAdjBT <= 0 ? '0° (frost adj.)' : `${Math.round(frostAdjBT * 10) / 10}° (frost adj.)`;
    return { x1, y1: yClipped, x2, y2: yClipped, label };
  }, [bioData?.biotemperature, bioData?.elevation, bioData?.frostDays]);

  // Frost-adjusted life zone point — same P & PET lines, frost-adjusted tBio line
  const frostAdjLifeZonePoint = useMemo(() => {
    if (!frostAdjBiotempLine || !refPrecipLine || !refPetLine) return null;
    const yBt = frostAdjBiotempLine.y1;
    const dpx = IMG_APEX.x - IMG_BL.x;
    const dpy = IMG_APEX.y - IMG_BL.y;
    const drx = IMG_APEX.x - IMG_BR.x;
    const dry = IMG_APEX.y - IMG_BR.y;
    const tA = (yBt - refPrecipLine.y1) / dpy;
    const ax = refPrecipLine.x1 + tA * dpx;
    const tB = (yBt - refPetLine.y1) / dry;
    const bx = refPetLine.x1 + tB * drx;
    return { x: (ax + bx) / 2, y: yBt };
  }, [frostAdjBiotempLine, refPrecipLine, refPetLine]);

  // Marker for current biodata point
  const marker = useMemo(() => {
    if (!bioData?.biotemperature || !bioData?.precipitation || !bioData?.petRatio) return null;
    const tBioSL = parseFloat(bioData.biotemperature);
    const elev = parseFloat(bioData.elevation);
    const bt = !isNaN(elev) ? tBioSL - (elev * 6 / 1000) : tBioSL;
    const pr = parseFloat(bioData.precipitation);
    const pet = parseFloat(bioData.petRatio);
    if (isNaN(bt) || isNaN(pr) || isNaN(pet)) return null;
    
    // Clamp values to triangle range
    const btClamped = Math.max(1.5, Math.min(24, bt));
    const prClamped = Math.max(62.5, Math.min(16000, pr));
    
    // Biotemperature determines vertical position (row fraction from base)
    // 24° = base (rowFrac=0), 1.5° = top (rowFrac=1)
    const logBtMin = Math.log2(1.5);
    const logBtMax = Math.log2(24);
    const rowFrac = 1 - (Math.log2(btClamped) - logBtMin) / (logBtMax - logBtMin);
    
    // Precipitation determines horizontal position via geoFrac
    const colFrac = geoFrac(prClamped, PRECIP);
    
    const pt = triPoint(rowFrac, colFrac);
    return { x: pt.x, y: H - pt.y };
  }, [bioData]);

  const margin = 80;
  const svgWidth = SIDE + margin * 2;
  const svgHeight = H + margin * 2;

  // ── Pyramid content (shared between inline and modal) ───────────────────────
  const pyramidContent = imgSrc ? (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <img src={imgSrc} alt="Holdridge Life Zone" style={{ width: '100%', height: 'auto', display: 'block' }} />
      {/* SVG overlay — viewBox matches pyramid1_old.svg so coordinates align exactly */}
      <svg
        viewBox={`${IMG_VIEWBOX_X} 0 ${IMG_W} ${IMG_H}`}
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
              x={refPrecipLine.x2 + 18}
              y={refPrecipLine.y2}
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
              x={refPetLine.x1 - 18}
              y={refPetLine.y1}
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
            {/* Dark outline to pop against any background */}
            <circle cx={lifeZonePoint.x} cy={lifeZonePoint.y} r="14" fill="none" stroke="#b85c00" strokeWidth="1.5" />
            {/* Crosshair lines */}
            <line x1={lifeZonePoint.x - 26} y1={lifeZonePoint.y} x2={lifeZonePoint.x - 17} y2={lifeZonePoint.y} stroke="orange" strokeWidth="2.5" />
            <line x1={lifeZonePoint.x + 17} y1={lifeZonePoint.y} x2={lifeZonePoint.x + 26} y2={lifeZonePoint.y} stroke="orange" strokeWidth="2.5" />
            <line x1={lifeZonePoint.x} y1={lifeZonePoint.y - 26} x2={lifeZonePoint.x} y2={lifeZonePoint.y - 17} stroke="orange" strokeWidth="2.5" />
            <line x1={lifeZonePoint.x} y1={lifeZonePoint.y + 17} x2={lifeZonePoint.x} y2={lifeZonePoint.y + 26} stroke="orange" strokeWidth="2.5" />
          </g>
        )}
        {frostAdjLifeZonePoint && lifeZonePoint && (
          <g>
            <defs>
              <marker id="arrowhead-frost-pyr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#2563eb" />
              </marker>
            </defs>
            {/* Dashed arrow from original → frost-adjusted point */}
            <line
              x1={lifeZonePoint.x} y1={lifeZonePoint.y}
              x2={frostAdjLifeZonePoint.x} y2={frostAdjLifeZonePoint.y}
              stroke="#2563eb" strokeWidth="2" strokeDasharray="7,4"
              markerEnd="url(#arrowhead-frost-pyr)"
            />
            {/* Frost-adjusted dot (blue) */}
            <circle cx={frostAdjLifeZonePoint.x} cy={frostAdjLifeZonePoint.y} r="30" fill="#2563eb" fillOpacity="0.10" stroke="none" />
            <circle cx={frostAdjLifeZonePoint.x} cy={frostAdjLifeZonePoint.y} r="22" fill="#2563eb" fillOpacity="0.18" stroke="none" />
            <circle cx={frostAdjLifeZonePoint.x} cy={frostAdjLifeZonePoint.y} r="14" fill="#2563eb" stroke="white" strokeWidth="3.5" />
            <circle cx={frostAdjLifeZonePoint.x} cy={frostAdjLifeZonePoint.y} r="14" fill="none" stroke="#1e40af" strokeWidth="1.5" />
            <line x1={frostAdjLifeZonePoint.x - 26} y1={frostAdjLifeZonePoint.y} x2={frostAdjLifeZonePoint.x - 17} y2={frostAdjLifeZonePoint.y} stroke="#2563eb" strokeWidth="2.5" />
            <line x1={frostAdjLifeZonePoint.x + 17} y1={frostAdjLifeZonePoint.y} x2={frostAdjLifeZonePoint.x + 26} y2={frostAdjLifeZonePoint.y} stroke="#2563eb" strokeWidth="2.5" />
            <line x1={frostAdjLifeZonePoint.x} y1={frostAdjLifeZonePoint.y - 26} x2={frostAdjLifeZonePoint.x} y2={frostAdjLifeZonePoint.y - 17} stroke="#2563eb" strokeWidth="2.5" />
            <line x1={frostAdjLifeZonePoint.x} y1={frostAdjLifeZonePoint.y + 17} x2={frostAdjLifeZonePoint.x} y2={frostAdjLifeZonePoint.y + 26} stroke="#2563eb" strokeWidth="2.5" />
            {/* Label */}
            <text
              x={frostAdjLifeZonePoint.x + 30} y={frostAdjLifeZonePoint.y}
              textAnchor="start" fontSize="19" fill="#2563eb"
              dominantBaseline="middle" fontWeight="700"
            >
              {frostAdjBiotempLine?.label}
            </text>
          </g>
        )}
      </svg>
    </div>
  ) : null;

  return (
    <div className="holdridge-triangle-container">
      <div className="pyramid-subsection-header">
        <span className="pyramid-subsection-title">{title}</span>
        <span className="hlz-header-actions">
          <DownloadButtons
            label={title}
            onPng={() => downloadCompositePNG(figureRef.current, fileSlug)}
            onCsv={hasBioData ? downloadPointCSV : undefined}
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

      {/* Inline pyramid */}
      {imgSrc ? (
        <div ref={figureRef}>{pyramidContent}</div>
      ) : (<span />
      )}

      {/* Group legend */}
      {imgSrc && !hideLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '6px 4px' }}>
          {HLZ_LEGEND.map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#0f172a' }}>
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
      )}

      {!imgSrc && (
        <svg
          ref={figureRef}
          viewBox={`${-margin} ${-margin} ${svgWidth} ${svgHeight}`}
          width="100%"
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Triangle outline */}
          <polygon
            points={`${triA.x},${triA.y} ${triB.x},${triB.y} ${triC.x},${triC.y}`}
            fill="none"
            stroke="#333"
            strokeWidth="1.5"
          />

          {/* Biotemperature horizontal guide lines */}
          {biotempLines.map(({ val, x1, y1, x2, y2 }) => (
            <g key={`bt-${val}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#999" strokeWidth="0.5" strokeDasharray="4,3" />
              <text x={x1 - 8} y={y1} textAnchor="end" fontSize="9" fill="#555" dominantBaseline="middle">
                {val}°
              </text>
            </g>
          ))}

          {/* Reference biotemperature line at 18°C */}
          <g>
            <line
              x1={refBiotempLine.x1} y1={refBiotempLine.y1}
              x2={refBiotempLine.x2} y2={refBiotempLine.y2}
              stroke="red" strokeWidth="1.5"
            />
            <text
              x={refBiotempLine.x1 - 8} y={refBiotempLine.y1}
              textAnchor="end" fontSize="9" fill="red"
              dominantBaseline="middle" fontWeight="600"
            >
              18°
            </text>
          </g>

          {/* Precipitation diagonal lines (parallel to right side) */}
          {precipDiagLines.map(({ val, x1, y1, x2, y2 }) => (
            <g key={`pr-${val}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#aac" strokeWidth="0.4" strokeDasharray="3,3" />
            </g>
          ))}

          {/* PET ratio diagonal lines (parallel to left side) */}
          {petDiagLines.map(({ val, x1, y1, x2, y2 }) => (
            <g key={`pet-${val}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#caa" strokeWidth="0.4" strokeDasharray="3,3" />
            </g>
          ))}

          {/* Precipitation axis labels along left side */}
          {PRECIP.map((val) => {
            const f = geoFrac(val, PRECIP);
            const px = A.x + (C.x - A.x) * f;
            const py = H - (A.y + (C.y - A.y) * f);
            return (
              <text key={`prl-${val}`} x={px - 10} y={py} textAnchor="end" fontSize="8" fill="#446"
                transform={`rotate(-60, ${px - 10}, ${py})`} dominantBaseline="middle">
                {val} mm
              </text>
            );
          })}

          {/* PET ratio axis labels along right side */}
          {PET_RATIO.map((val) => {
            const f = geoFrac(val, PET_RATIO);
            const px = B.x + (C.x - B.x) * f;
            const py = H - (B.y + (C.y - B.y) * f);
            return (
              <text key={`petl-${val}`} x={px + 10} y={py} textAnchor="start" fontSize="8" fill="#644"
                transform={`rotate(60, ${px + 10}, ${py})`} dominantBaseline="middle">
                {val}
              </text>
            );
          })}

          {/* Hexagons with life zone labels */}
          {hexagons.map((hex, i) => (
            <g key={i}>
              <path
                d={hexPath(hex.cx, hex.cy, hex.r)}
                fill={hex.color}
                fillOpacity="0.6"
                stroke="#555"
                strokeWidth="0.8"
              />
              {hex.label.split('\n').map((line, li, arr) => (
                <text
                  key={li}
                  x={hex.cx}
                  y={hex.cy + (li - (arr.length - 1) / 2) * 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="7"
                  fontWeight="600"
                  fill="#222"
                >
                  {line}
                </text>
              ))}
            </g>
          ))}

          {/* Latitudinal region labels on the left */}
          {LAT_REGIONS.map((label, i) => {
            // Regions from bottom: tropical (row 0), subtropical (row 1 shares with warm temperate),
            // etc. We have 6 hex rows but 7 labels. Subtropical and Warm Temperate share row 1.
            let yPos;
            if (i <= 1) {
              // Tropical and Subtropical share the bottom two visual positions
              const rowIdx = i === 0 ? 0 : 1;
              const rowFrac = (rowIdx + 0.5) / NUM_ROWS;
              yPos = H - rowFrac * H;
            } else {
              const rowIdx = i - 1;
              const rowFrac = (rowIdx + 0.5) / NUM_ROWS;
              yPos = H - rowFrac * H;
            }
            return (
              <text key={`lr-${i}`} x={-12} y={yPos} textAnchor="end" fontSize="8" fill="#333"
                fontWeight="600" dominantBaseline="middle" textTransform="uppercase">
                {label}
              </text>
            );
          })}

          {/* Axis titles */}
          <text x={SIDE / 2} y={H + 25} textAnchor="middle" fontSize="10" fill="#333" fontWeight="600">
            Mean Annual Biotemperature (°C)
          </text>
          <text
            x={-40} y={H / 2}
            textAnchor="middle" fontSize="10" fill="#446" fontWeight="600"
            transform={`rotate(-60, ${-40}, ${H / 2})`}
          >
            Annual Precipitation (mm)
          </text>
          <text
            x={SIDE + 40} y={H / 2}
            textAnchor="middle" fontSize="10" fill="#644" fontWeight="600"
            transform={`rotate(60, ${SIDE + 40}, ${H / 2})`}
          >
            Potential Evapotranspiration Ratio
          </text>

          {/* Humidity province labels along the bottom */}
          {HUMIDITY_PROVINCES.map((label, i) => {
            const xPos = (i + 0.5) * (SIDE / HUMIDITY_PROVINCES.length);
            return (
              <text key={`hp-${i}`} x={xPos} y={H + 45} textAnchor="middle" fontSize="7" fill="#555">
                {label}
              </text>
            );
          })}

          {/* Current point marker */}
          {marker && (
            <g>
              <circle cx={marker.x} cy={marker.y} r={6} fill="red" fillOpacity="0.8" stroke="#fff" strokeWidth="1.5" />
              <circle cx={marker.x} cy={marker.y} r={10} fill="none" stroke="red" strokeWidth="1" strokeDasharray="3,2" />
            </g>
          )}
        </svg>
      )}

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
            {imgSrc ? pyramidContent : null}
            {imgSrc && !hideLegend && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', padding: '6px 4px', justifyContent: 'center' }}>
                {HLZ_LEGEND.map(({ label, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <svg width="18" height="18" viewBox="-10 -10 20 20" style={{ flexShrink: 0 }}>
                      <path d={hexPath(0, 0, 9)} fill={color} fillOpacity="0.57" stroke="#555" strokeWidth="1" />
                    </svg>
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!hideReference && (
        <div className="panel-sources">
          <p className="sources-title">Reference</p>
          <ul>
            <li>Holdridge, L.R. (1967). <em>Life Zone Ecology</em>. Tropical Science Center, San José, Costa Rica.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default HoldridgeTriangle;
