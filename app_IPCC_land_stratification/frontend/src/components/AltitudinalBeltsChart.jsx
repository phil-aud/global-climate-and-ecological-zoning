/**
 * AltitudinalBeltsChart
 *
 * Programmatic (inline SVG) version of public/latitudinal_regions_altitudinal_belts.svg:
 * Holdridge's approximate equivalence between latitudinal regions (mean annual
 * biotemperature at sea level, x-axis, linear) and altitudinal belts (elevation,
 * y-axis, linear) under an average 6 °C/km lapse rate. Every belt boundary is the
 * iso-line  tBio = t0Bio − 6·elev/1000 = threshold.
 *
 * The static figure stops at 30 °C, so a point whose lapse-rate-extrapolated
 * t0Bio exceeds 30 °C is clamped to the right edge and lands in the wrong belt.
 * Here the sea-level axis (tMax) and, by default, the elevation axis
 * (elevMax = tMax/6 km, keeping the 0 °C iso-line corner-to-corner) can be
 * extended (e.g. tMax = 48 °C) and all iso-lines are extended accordingly.
 *
 * viewBox and plot-area pixel constants are identical to the static SVG, so
 * with tMax = 30 this component reproduces that figure.
 */

import React from 'react';

// ── Coordinate system (read from latitudinal_regions_altitudinal_belts.svg) ──────
const VIEWBOX = '0 0 1329.03 1033.73';
const X0 = 4.83;    // x of 0 °C (sea-level biotemperature)
const X1 = 1091.83; // x of tMax
const Y0 = 884.91;  // y of sea level (0 m)
const Y1 = 20.91;   // y of elevMax
const LAPSE = 6;    // °C per 1000 m

const GREY = '#7a7a7a';
const BASAL_FILL = '#e0e0e0';
const FONT = 'ArialMT, Arial, Helvetica, sans-serif';

// Altitudinal-belt boundaries (mean annual biotemperature, °C), sea level upward.
const THRESHOLDS = [0, 1.5, 3, 6, 12, 18, 24];
const FROST = 18; // frost / critical temperature line (dashed)
// Belt lying between THRESHOLDS[i] and THRESHOLDS[i + 1]
const BELT_NAMES = ['Nival', 'Alpine', 'Subalpine', 'Montane', 'Lower Montane', 'Premontane'];
// Latitudinal regions (sea-level biotemperature, °C); the last one runs to tMax.
const REGIONS = [
  { lines: ['POLAR'], lo: 0, hi: 1.5 },
  { lines: ['SUB-', 'POLAR'], lo: 1.5, hi: 3 },
  { lines: ['BOREAL'], lo: 3, hi: 6 },
  { lines: ['COOL', 'TEMPERATE'], lo: 6, hi: 12 },
  { lines: ['WARM', 'TEMPERATE'], lo: 12, hi: 18 },
  { lines: ['SUBTROPICAL'], lo: 18, hi: 24 },
  { lines: ['TROPICAL'], lo: 24, hi: Infinity },
];

const degLabel = (t) => (t === FROST ? `≃${t}°` : `${t}°`);

// Sea-level-biotemperature axis end of the static figure (public/latitudinal_regions_
// altitudinal_belts.svg). A point whose t0Bio exceeds this is clamped to the right
// edge there and can appear in the wrong altitudinal belt.
export const STATIC_TMAX = 30;

/**
 * Axis maximum for the extended diagram: at least 1 °C of headroom past the point's
 * t0Bio, rounded up to the next multiple of 3 °C. Since 3 °C = 500 m at the 6 °C/km
 * lapse rate, the elevation axis then always ends on a round 500 m value with the
 * 0 °C iso-line meeting the top-right corner.
 * @param {number} t0Bio sea-level biotemperature (°C)
 */
export function extendedTMax(t0Bio) {
  if (!isFinite(t0Bio)) return STATIC_TMAX;
  return Math.max(STATIC_TMAX, Math.ceil((t0Bio + 1) / 3) * 3);
}

function AltitudinalBeltsChart({ bioData, tMax = 30, elevMax, beltFontSize, regionFontSize }) {
  // Default keeps the figure a right triangle: the 0 °C iso-line runs corner to corner.
  const eMax = elevMax ?? (tMax / LAPSE) * 1000;
  // Region columns get narrower as tMax grows (the 0–1.5 °C polar column is the
  // tightest), so shrink the in-column labels proportionally, down to a floor that
  // stays legible. At tMax = 30 these reproduce the static figure's sizes.
  const shrink = Math.min(1, 30 / tMax);
  const beltFont = beltFontSize ?? Math.max(11, 20 * shrink);
  const regionFont = regionFontSize ?? Math.max(8, 12.17 * shrink);

  const xOf = (t) => X0 + (t / tMax) * (X1 - X0);
  const yOf = (e) => Y0 - (e / eMax) * (Y0 - Y1);
  // Elevation (m) at which the iso-line "tBio = c" crosses sea-level biotemperature t0
  const isoElev = (c, t0) => ((t0 - c) / LAPSE) * 1000;
  // Sea-level biotemperature at which the iso-line "tBio = c" reaches elevation e
  const isoT0 = (c, e) => c + (LAPSE * e) / 1000;
  // Where the iso-line "tBio = c" leaves the plot: right edge (t = tMax) or top edge (eMax)
  const isoEnd = (c) => {
    const eRight = isoElev(c, tMax);
    return eRight <= eMax ? { x: X1, y: yOf(eRight) } : { x: xOf(isoT0(c, eMax)), y: Y1 };
  };
  // Pixel-space slope of the iso-lines (negative: rising to the right), used to rotate labels
  const angle = (Math.atan2(yOf(isoElev(0, tMax)) - Y0, X1 - X0) * 180) / Math.PI;
  const along = (x, y) => `translate(${x} ${y}) rotate(${angle})`;

  const regions = REGIONS.map((r) => ({ ...r, hi: Math.min(r.hi, tMax) }));

  // Elevation grid every 500 m (label eMax separately at the top-right corner)
  const gridElevs = [];
  for (let e = 500; e < eMax; e += 500) gridElevs.push(e);

  // Sea-level ticks: belt thresholds, then every 6 °C beyond 24 °C up to tMax
  const extraTicks = [];
  for (let t = 30; t < tMax; t += 6) extraTicks.push(t);
  const ticks = [...THRESHOLDS.filter((t) => t < tMax), ...extraTicks, tMax];

  // Belt-boundary temperature bubbles sit on each iso-line at 70 % of the axis
  const bubbleT0 = 0.7 * tMax;

  const hypotenuseEnd = isoEnd(0);
  const titleAnchor = {
    x: X0 + 0.3 * (hypotenuseEnd.x - X0),
    y: Y0 + 0.3 * (hypotenuseEnd.y - Y0),
  };

  // Marker: x from t0Bio, y from elevation (clamped to the plot)
  const t0Bio = parseFloat(bioData?.t0Bio);
  const elev = parseFloat(bioData?.elevation);
  const marker = !isNaN(t0Bio) && !isNaN(elev)
    ? { x: xOf(Math.max(0, Math.min(tMax, t0Bio))), y: yOf(Math.max(0, Math.min(eMax, elev))) }
    : null;

  return (
    <svg
      viewBox={VIEWBOX}
      width="100%"
      style={{ display: 'block', width: '100%', height: 'auto' }}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      fontFamily={FONT}
      role="img"
      aria-label={`Latitudinal regions and altitudinal belts in the Holdridge Life Zones (sea-level biotemperature 0–${tMax} °C)`}
    >
      {/* Basal-belt positions: below each region's lower iso-line, within its column */}
      <g id="basal-belts">
        {regions.map((r) => (
          <polygon
            key={r.lo}
            fill={BASAL_FILL}
            points={[
              `${xOf(r.hi)},${yOf(Math.min(eMax, isoElev(r.lo, r.hi)))}`,
              `${xOf(r.lo)},${Y0}`,
              `${xOf(r.hi)},${Y0}`,
            ].join(' ')}
          />
        ))}
      </g>

      {/* Horizontal elevation grid: from the 0 °C iso-line to the right axis */}
      <g id="elevation-grid" stroke={GREY} strokeWidth="1">
        {gridElevs.map((e) => (
          <line
            key={e}
            x1={xOf(Math.min(tMax, isoT0(0, e)))}
            y1={yOf(e)}
            x2={X1 - 0.42}
            y2={yOf(e)}
            strokeDasharray="12 12"
          />
        ))}
      </g>

      {/* Belt-boundary iso-lines (tBio = threshold) and the frame */}
      <g id="iso-lines" stroke={GREY} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {THRESHOLDS.map((c) => {
          const end = isoEnd(c);
          return (
            <line
              key={c}
              x1={xOf(c)}
              y1={Y0}
              x2={end.x}
              y2={end.y}
              strokeDasharray={c === FROST ? '12 12' : undefined}
            />
          );
        })}
        <line x1={X1} y1={Math.min(hypotenuseEnd.y, Y1 + 1)} x2={X1} y2={Y0} />
        <line x1={X0} y1={Y0} x2={X1} y2={Y0} />
      </g>

      {/* Region column boundaries, up to the 0 °C iso-line */}
      <g id="column-lines" stroke={GREY} strokeWidth="1">
        {THRESHOLDS.slice(1).map((c) => (
          <line key={c} x1={xOf(c)} y1={Y0} x2={xOf(c)} y2={yOf(Math.min(eMax, isoElev(0, c)))} />
        ))}
      </g>

      {/* Elevation labels (right) */}
      <g id="elevation-labels" fill={GREY} fontSize="15">
        {gridElevs.map((e) => (
          <text key={e} x={X1 + 10.72} y={yOf(e) + 3.9}>{e}</text>
        ))}
        <text x={X1 + 10.72} y={Y1 - 8}>{Math.round(eMax)}</text>
        <text x={X1 + 10.72} y={Y0 - 6.64} fill="#000" fontSize="20">SEA LEVEL</text>
      </g>
      <g id="elevation-axis-title" fontSize="20" textAnchor="middle">
        {'ELEVATION IN METERS'.split('').map((ch, i) => (
          <text key={i} x={1318.5} y={268.11 + i * 21.44}>{ch}</text>
        ))}
      </g>

      {/* Sea-level axis: ticks, region separators, region names, title */}
      <g id="sea-level-axis">
        <g stroke={GREY} strokeWidth="1" strokeLinecap="round" opacity="0.5">
          {THRESHOLDS.slice(1).map((c) => (
            <line key={c} x1={xOf(c)} y1={Y0} x2={xOf(c)} y2={968.58} />
          ))}
          {extraTicks.map((t) => (
            <line key={t} x1={xOf(t)} y1={Y0} x2={xOf(t)} y2={Y0 + 8} />
          ))}
        </g>
        <g fill={GREY} fontSize="15">
          {ticks.map((t) => (
            <text
              key={t}
              x={t === tMax ? xOf(t) : xOf(t) + 3}
              y={907.07}
              textAnchor={t === tMax ? 'middle' : 'start'}
            >
              {degLabel(t)}
            </text>
          ))}
        </g>
        <g fontSize={regionFont} textAnchor="middle">
          {regions.map((r) => {
            const cx = (xOf(r.lo) + xOf(r.hi)) / 2;
            return r.lines.length === 1
              ? <text key={r.lo} x={cx} y={954.26}>{r.lines[0]}</text>
              : (
                <g key={r.lo}>
                  <text x={cx} y={946.45}>{r.lines[0]}</text>
                  <text x={cx} y={961.66}>{r.lines[1]}</text>
                </g>
              );
          })}
        </g>
        <text x={(X0 + X1) / 2} y={1027.23} fontSize="20" textAnchor="middle">
          LATITUDINAL REGIONS (MEAN ANNUAL BIOTEMPERATURE AT SEA LEVEL, °C)
        </text>
      </g>

      {/* Altitudinal-belt axis title, parallel to the 0 °C iso-line */}
      <text transform={along(titleAnchor.x, titleAnchor.y)} y={-29} fontSize="20">
        ALTITUDINAL BELTS (MEAN ANNUAL BIOTEMPERATURE, °C)
      </text>

      {/* Belt names, one per region column, centred on each belt */}
      <g id="belt-labels" fontSize={beltFont}>
        {regions.flatMap((r) => {
          const t0 = r.lo + Math.min(0.3 * (r.hi - r.lo), 2);
          return BELT_NAMES.map((name, i) => {
            if (THRESHOLDS[i + 1] > r.lo) return null; // belt not present in this column
            const mid = (THRESHOLDS[i] + THRESHOLDS[i + 1]) / 2;
            const e = isoElev(mid, t0);
            if (e > eMax) return null;
            return (
              <text key={`${r.lo}-${name}`} transform={along(xOf(t0), yOf(e))} y={beltFont * 0.36}>
                {name}
              </text>
            );
          });
        })}
      </g>

      {/* Frost line label, just above the dashed 18 °C iso-line */}
      <text transform={along(xOf(FROST + 2.8), yOf(isoElev(FROST, FROST + 2.8)))} y={-6} fontSize="15">
        FROST OR CRITICAL TEMPERATURE LINE
      </text>

      {/* Belt-boundary temperature bubbles on the iso-lines */}
      <g id="threshold-bubbles" fontSize="11" textAnchor="middle">
        {THRESHOLDS.filter((c) => c !== FROST && c < bubbleT0).map((c) => {
          const cx = xOf(bubbleT0);
          const cy = yOf(isoElev(c, bubbleT0));
          const label = degLabel(c);
          return (
            <g key={c}>
              <circle cx={cx} cy={cy} r={label.length > 2 ? 12.5 : 9.4} fill="#fff" />
              <text x={cx} y={cy + 3.9}>{label}</text>
            </g>
          );
        })}
      </g>

      {/* Legend */}
      <g id="legend">
        <rect x={6.83} y={328.91} width={36} height={36} fill={BASAL_FILL} />
        <text x={59.2} y={354.59} fontSize="24">Basal belt position</text>
      </g>

      {/* Point marker (same styling as the other pyramids' markers) */}
      {marker && (
        <g id="marker">
          <circle cx={marker.x} cy={marker.y} r="28" fill="orange" fillOpacity="0.12" stroke="none" />
          <circle cx={marker.x} cy={marker.y} r="20" fill="orange" fillOpacity="0.22" stroke="none" />
          <circle cx={marker.x} cy={marker.y} r="12" fill="orange" stroke="white" strokeWidth="3" />
          <circle cx={marker.x} cy={marker.y} r="12" fill="none" stroke="#b85c00" strokeWidth="1.5" />
          <line x1={marker.x - 24} y1={marker.y} x2={marker.x - 15} y2={marker.y} stroke="orange" strokeWidth="2.5" />
          <line x1={marker.x + 15} y1={marker.y} x2={marker.x + 24} y2={marker.y} stroke="orange" strokeWidth="2.5" />
          <line x1={marker.x} y1={marker.y - 24} x2={marker.x} y2={marker.y - 15} stroke="orange" strokeWidth="2.5" />
          <line x1={marker.x} y1={marker.y + 15} x2={marker.x} y2={marker.y + 24} stroke="orange" strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}

export default AltitudinalBeltsChart;
