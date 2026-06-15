/**
 * Map Component
 * Displays Leaflet map with GEE climate-zone tile overlays and a matching legend.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvent, useMap } from 'react-leaflet';
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { getMapTileLayer } from '../utils/api';
import { EarthEngineTile, earthEngineTileSource } from '../utils/eeTileSource';
import { LAYER_CONFIG, HLZIII_PALETTE_GROUPS } from '../utils/zonePalettes';
import './MapComponent.css';

// Fix default Leaflet icon paths broken by Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const RED_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function MapClickHandler({ onMapClick }) {
  useMapEvent('click', (e) => {
    onMapClick(e.latlng.lng, e.latlng.lat);
  });
  return null;
}

/** Calls invalidateSize after the CSS transition ends so the map fills the new width. */
function MapResizer({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 280);
    return () => clearTimeout(id);
  }, [map, trigger]);
  return null;
}

/**
 * Returns the highest zoom level at which it makes sense to fetch new tiles
 * from GEE for a given layer/dataset. Past this zoom, Leaflet up-scales the
 * existing tiles client-side instead of asking GEE for more, blurrier ones.
 *
 *   CRU TS 4.09 assets:    ~50 km native (0.5°)         → z=5
 *   TerraClimate assets:   ~4 km native                 → z=7
 *   Soil (HWSD2):          ~1 km native                 → z=8
 *
 * The pattern overlay shares the HLZ III asset so it follows the same cap.
 */
function tileMaxNativeZoom(layer, dataset) {
  // We render one zoom level *above* the asset's true resolution so each
  // GEE-rendered tile is ~2x super-sampled. The CSS `image-rendering: pixelated`
  // rule then upscales those crisp tiles further client-side without blur.
  if (layer === 'soil') return 9;
  return dataset === 'terraclimate' ? 8 : 6;
}

// ── Earth Engine-aligned tile loading ─────────────────────────────────────────
//
// The PriorityPool + EarthEngineTile + earthEngineTileSource port lives in
// ../utils/eeTileSource.js so the SAME global token pool is shared with the tile
// prewarmer in utils/api.js — mirroring how ee.layers.EarthEngineTileSource keeps
// a single static TOKEN_POOL_ across every layer and tile request. Only the
// Leaflet-specific EarthEngineTileLayer stays here.

/**
 * L.TileLayer that loads tiles through earthEngineTileSource (the EE token pool +
 * XHR loader) rather than letting the browser fetch each <img> directly. This is
 * the Leaflet counterpart of attaching an ee.layers.ImageOverlay to a Google Map.
 */
const EarthEngineTileLayer = L.TileLayer.extend({
  createTile(coords, done) {
    const img = document.createElement('img');
    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }
    img.alt = '';
    img.setAttribute('role', 'presentation');

    const errorTileUrl = this.options.errorTileUrl;
    const tile = new EarthEngineTile(img, this.getTileUrl(coords), {
      onLoad: () => done(null, img),
      onError: () => {
        if (errorTileUrl) img.src = errorTileUrl;
        done(new Error('Tile failed to load'), img);
      },
    });
    img._eeTile = tile; // so 'tileunload' can abort it (EE's releaseTile())

    // Priority = creation time (seconds); smaller = front of queue, preserving
    // the center-out creation order — identical to AbstractOverlay.getTile().
    earthEngineTileSource.loadTile(tile, Date.now() / 1000);
    return img;
  },
});

/**
 * Manages the zone overlay tile layer imperatively so we can swap it
 * when the active layer or tile URLs change.
 *
 * `maxNativeZoom` is the most important perf knob: it caps the zoom level
 * at which Leaflet *requests new tiles from GEE*. Past that level Leaflet
 * just up-scales the existing tiles client-side. Without this cap, every
 * extra zoom level forces GEE to re-render its limited-resolution asset
 * pyramid into 4x more (un-cached!) tiles for no visual gain.
 */
function ZoneTileLayer({ tileUrl, opacity, maxNativeZoom = 8 }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!tileUrl) return;
    if (layerRef.current) {
      // removeLayer fires 'tileunload' for every tile → aborts in-flight loads.
      map.removeLayer(layerRef.current);
    }
    layerRef.current = new EarthEngineTileLayer(tileUrl, {
      opacity,
      attribution: 'GEE / ee-philaudebert',
      maxZoom: 18,
      maxNativeZoom,
      // Tiles arrive as same-origin object URLs (never CORS-tainted), but keep
      // crossOrigin set so the <img> stays canvas-readable for the pattern path.
      crossOrigin: 'anonymous',
      className: 'gee-zone-tile',
      // keepBuffer=1: only pre-load 1 tile beyond the viewport edge.
      // GEE has a small per-mapId tile worker pool. Large keepBuffer values
      // (e.g. 6) cause Leaflet to request hundreds of off-viewport tiles,
      // saturating GEE's pool and leaving visible tiles stuck in the queue.
      keepBuffer: 1,
      // Don't request new tiles during a pinch/scroll zoom animation —
      // the existing tiles are CSS-scaled during the animation anyway.
      updateWhenZooming: false,
      // 1×1 transparent PNG — prevents the browser "broken image" icon.
      errorTileUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    }).addTo(map);

    // EE's AbstractOverlay.releaseTile(): the moment Leaflet drops a tile from
    // view, abort its in-flight XHR (or release its still-queued slot in the
    // token pool) so we never finish a request for a no-longer-visible tile.
    // Retries and HTTP-429 backoff live inside EarthEngineTile, so no per-tile
    // retry wiring is needed here anymore.
    layerRef.current.on('tileunload', (e) => {
      if (e.tile && e.tile._eeTile) e.tile._eeTile.abort();
    });

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current); // aborts remaining tiles via tileunload
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tileUrl, maxNativeZoom]);

  useEffect(() => {
    if (layerRef.current) layerRef.current.setOpacity(opacity);
  }, [opacity]);

  return null;
}

/**
 * Canvas-based Leaflet tile layer that draws stipple / hatch / cross-hatch /
 * nival patterns on top of the HLZ III colour tiles.
 *
 * It consumes a second GEE tile stream (the "pattern mask") where each pixel's
 * colour encodes the pattern category:
 *   #FF0000 → stipple   (Alpine / Subalpine)
 *   #00FF00 → hatch     (Lower Montane / Montane / Subtropical Lower Montane)
 *   #0000FF → cross-hatch (Tropical Premontane)
 *   #FFFF00 → nival     (Nival deserts – stipple-only, no solid fill in lyrx)
 *   #FFFFFF → no pattern (transparent in the canvas output)
 */
function PatternTileLayer({ patternUrl, opacity, maxNativeZoom = 8 }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!patternUrl) return;

    // geeMaxZoom = the highest zoom at which GEE has real tiles for the
    // pattern mask image (same as the zone layer's maxNativeZoom).
    // The GridLayer itself has NO maxNativeZoom so Leaflet always calls
    // createTile() at the actual map zoom — we generate fresh canvas tiles
    // at every zoom level so the symbols stay the same physical screen size
    // instead of being CSS-upscaled into giant blobs.
    const geeMaxZoom = maxNativeZoom;

    const PatternLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const tileSize = this.getTileSize();
        const canvas = document.createElement('canvas');
        canvas.width  = tileSize.x;   // 256
        canvas.height = tileSize.y;   // 256

        // Clamp the GEE request to the data's native zoom.
        // If the map is at zoom 10 but GEE only has data up to zoom 6,
        // we request the zoom-6 parent tile and extract the sub-region that
        // corresponds to this canvas tile.
        const clampZ = Math.min(coords.z, geeMaxZoom);
        const zDiff  = coords.z - clampZ;   // extra zoom levels beyond native
        const scale  = 1 << zDiff;          // 2^zDiff  (1 when at/below native)
        const clampX = coords.x >> zDiff;
        const clampY = coords.y >> zDiff;

        // Which sub-tile of the parent GEE tile we need (0-based)
        const subTileX = coords.x & (scale - 1);
        const subTileY = coords.y & (scale - 1);

        const url = patternUrl
          .replace('{z}', clampZ)
          .replace('{x}', clampX)
          .replace('{y}', clampY);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        // Draws the pattern marks onto the canvas once the GEE mask tile has
        // loaded. (Retries / HTTP-429 backoff are handled by EarthEngineTile.)
        const renderPattern = () => {
          const w = tileSize.x;
          const h = tileSize.y;

          // ── Step 1: read GEE mask pixels via an OFFSCREEN canvas ──────────
          // We never draw onto the output `canvas` until we putImageData at
          // the end, so there is zero risk of GEE tile colours leaking through.
          const offscreen = document.createElement('canvas');
          offscreen.width  = w;
          offscreen.height = h;
          const octx = offscreen.getContext('2d');
          octx.imageSmoothingEnabled = false;
          // Extract the correct sub-region of the GEE parent tile.
          const srcSize = w / scale;
          const srcLeft = subTileX * srcSize;
          const srcTop  = subTileY * srcSize;
          octx.drawImage(img, srcLeft, srcTop, srcSize, srcSize, 0, 0, w, h);

          let imageData;
          try {
            imageData = octx.getImageData(0, 0, w, h);
          } catch (_) {
            done(null, canvas); // CORS-tainted — return transparent tile
            return;
          }
          const { data } = imageData;

          // ── Step 2: classify pixels and write pattern marks ───────────────
          // Output starts all-transparent; only marks are written.
          const ctx = canvas.getContext('2d');
          const out = ctx.createImageData(w, h);
          const od  = out.data;

          // Server SLD encodes pattern category as a distinct pure RGB colour:
          //   0 → #FFFFFF white   → no marks
          //   1 → #FF0000 red     → right-diagonal hatch  (premontane)
          //   2 → #00FF00 green   → left-diagonal hatch   (lower montane)
          //   3 → #0000FF blue    → vertical lines        (montane)
          //   4 → #FF00FF magenta → X cross-hatch         (subalpine)
          //   5 → #FFA500 orange  → dots                  (alpine)
          //   6 → #FFFF00 yellow  → stars / snowflake     (nival)
          //
          // GEE pyramid tiles use mean-aggregation so boundary pixels mix
          // category colours. Use nearest-reference Euclidean distance
          // classification instead of per-channel thresholds.
          const REF = [
            [255,   0,   0], // cat 1 — red
            [  0, 255,   0], // cat 2 — green
            [  0,   0, 255], // cat 3 — blue
            [255,   0, 255], // cat 4 — magenta
            [255, 165,   0], // cat 5 — orange
            [255, 255,   0], // cat 6 — yellow
          ];

          // Mark opacities and widths tuned to match the legend CSS swatches.
          // Legend uses repeating-linear-gradient: 1px solid / 4px gap at 28-38% opacity.
          // On a 256-px canvas a 2-px mark every 5 px is clearly visible but not shady.
          const HATCH_A  = 140; // 2-px lines every 5 px
          const VERT_A   = 140;
          const X_A      = 120; // X = both diagonals, keep slightly lighter
          const DOT_A    = 180; // 2×2 dot grid — needs higher alpha to read as dots
          const STAR_A   = 230;

          function mark(idx, a) {
            if (idx < 0 || idx + 3 >= od.length) return;
            od[idx] = 0; od[idx + 1] = 0; od[idx + 2] = 0; od[idx + 3] = a;
          }

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 16) continue; // transparent (ocean / no-data)

            // Filter near-white / near-grey → category 0 (no marks).
            const mx = Math.max(r, g, b);
            const mn = Math.min(r, g, b);
            if (mx < 80) continue;
            if ((mx - mn) / (mx || 1) < 0.25) continue;

            // Nearest reference colour (Euclidean distance in RGB)
            let best = 0, bestD = Infinity;
            for (let k = 0; k < REF.length; k++) {
              const dr = r - REF[k][0], dg = g - REF[k][1], db = b - REF[k][2];
              const d = dr * dr + dg * dg + db * db;
              if (d < bestD) { bestD = d; best = k; }
            }
            if (bestD > 180 * 180) continue; // too ambiguous, skip

            const px = (i >> 2) % w;
            const py = (i >> 2) / w | 0;

            switch (best + 1) {
              case 1: // right-diagonal hatch (/)  — matches legend 'right-hatch'
                if ((px - py + 2048) % 10 < 2) mark(i, HATCH_A);
                break;
              case 2: // left-diagonal hatch (\)   — matches legend 'left-hatch'
                if ((px + py) % 10 < 2) mark(i, HATCH_A);
                break;
              case 3: // vertical lines |||         — matches legend 'vertical'
                if (px % 10 < 2) mark(i, VERT_A);
                break;
              case 4: // X cross-hatch              — matches legend 'x'
                if ((px - py + 2048) % 10 < 2 || (px + py) % 10 < 2) mark(i, X_A);
                break;
              case 5: // dots                       — matches legend 'points'
                if (px % 10 < 3 && py % 10 < 3) mark(i, DOT_A);
                break;
              case 6: // snowflake +                — matches legend 'snowflake'
                if (px % 16 === 0 && py % 16 === 0) {
                  for (let arm = -3; arm <= 3; arm++) {
                    mark(i + arm * 4, STAR_A);          // horizontal arm
                    mark(i + arm * w * 4, STAR_A);      // vertical arm
                  }
                }
                break;
              default: break;
            }
          }

          ctx.putImageData(out, 0, 0);
          done(null, canvas);
        };

        // Load the GEE mask tile through the EE token pool + XHR loader. On
        // terminal failure, emit a transparent tile so the map isn't blocked.
        const tile = new EarthEngineTile(img, url, {
          onLoad: renderPattern,
          onError: () => done(null, canvas),
        });
        canvas._eeTile = tile; // so 'tileunload' can abort it (EE's releaseTile())
        earthEngineTileSource.loadTile(tile, Date.now() / 1000);
        return canvas;
      },
    });

    const layer = new PatternLayer({
      tileSize: 256,
      opacity,
      pane: 'overlayPane',
      // No maxNativeZoom here — the GridLayer must generate fresh canvas tiles
      // at every zoom level so symbols keep a consistent screen size.
      // The GEE URL is clamped to geeMaxZoom internally above.
      keepBuffer: 1,
    });
    layer.addTo(map);
    layerRef.current = layer;

    // EE's AbstractOverlay.releaseTile(): abort a pattern tile's load the moment
    // Leaflet drops it from view so its XHR / token-pool slot is freed.
    layer.on('tileunload', (e) => {
      if (e.tile && e.tile._eeTile) e.tile._eeTile.abort();
    });

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, patternUrl, maxNativeZoom]);

  useEffect(() => {
    if (layerRef.current) layerRef.current.setOpacity(opacity);
  }, [opacity]);

  return null;
}


//
// The lyrx uses three overlay types on top of the solid fill:
//   CIMVectorMarker  → 'stipple'      (Alpine + Subalpine zones)
//   CIMHatchFill     → 'hatch'        (Montane / Lower Montane zones)
//   double CIMHatchFill → 'cross-hatch' (Tropical Premontane zones)
//   CIMVectorMarker only (no fill) → 'stipple-only' (Nival deserts)

function getZonePattern(value) {
  // Explicit nival list (some belts place nival on different tens digits)
  if ([171, 261, 351, 441, 531, 621].includes(value)) return 'snowflake';
  const h = Math.floor(value / 100);       // latitudinal belt (1=Tropical … 7=Polar)
  const t = Math.floor((value % 100) / 10); // altitudinal tier

  switch (h) {
    case 1: // Tropical: has premontane
      if (t === 1) return null;
      if (t === 2) return 'right-hatch';
      if (t === 3) return 'left-hatch';
      if (t === 4) return 'vertical';
      if (t === 5) return 'x';
      if (t === 6) return 'points';
      return null;

    case 2: // Subtropical: no premontane (t=2 is lower montane)
      if (t === 1) return null;
      if (t === 2) return 'left-hatch';
      if (t === 3) return 'vertical';
      if (t === 4) return 'x';
      if (t === 5) return 'points';
      return null;

    case 3: // Warm temperate: t=2 is montane
      if (t === 1) return null;
      if (t === 2) return 'vertical';
      if (t === 3) return 'x';
      if (t === 4) return 'points';
      if (t === 5) return 'snowflake';
      return null;

    case 4: // Cool temperate: t=2 is subalpine (X), t=3 is alpine (points)
      if (t === 1) return null;
      if (t === 2) return 'x';
      if (t === 3) return 'points';
      if (t === 4) return 'snowflake';
      return null;

    case 5: // Boreal
      if (t === 1) return null;
      if (t === 2) return 'points';
      if (t === 3) return 'snowflake';
      return null;

    case 6: // Subpolar
      if (t === 1) return null;
      if (t === 2) return 'snowflake';
      return null;

    default:
      return null;
  }
}

const _DOT   = `radial-gradient(circle, rgba(0,0,0,0.38) 1px, transparent 1px) 0 0 / 5px 5px`;
const _HATCH = `repeating-linear-gradient(135deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 5px)`;
const _HATCH2 = `repeating-linear-gradient(45deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 5px)`;

function getSwatchStyle(color, pattern) {
  switch (pattern) {
    case 'points':       return { background: `${_DOT}, ${color}` };
    case 'left-hatch':   return { background: `${_HATCH}, ${color}` };
    case 'right-hatch':  return { background: `${_HATCH2}, ${color}` };
    case 'x':            return { background: `${_HATCH}, ${_HATCH2}, ${color}` };
    case 'vertical':     return { background: `repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 4px), ${color}` };
    case 'waves':        return { background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.28) 2px, transparent 2px, transparent 10px), ${color}` };
    case 'snowflake': {
      const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><polygon points="4,0 4.7,2.6 7.6,2.6 5.1,4.1 5.8,6.9 4,5.2 2.2,6.9 2.9,4.1 0.4,2.6 3.3,2.6" fill="rgba(0,0,0,0.6)"/></svg>');
      return {
        background: `${color}`,
        backgroundImage: `url("data:image/svg+xml;utf8,${svg}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '12px 12px',
        boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.06)'
      };
    }
    default:             return { background: color };
  }
}

// ── Legend sub-components ─────────────────────────────────────────────────────

function LegendEntry({ color, label, highlight, pattern }) {
  return (
    <div className={`legend-entry${highlight ? ' legend-entry--highlight' : ''}`}>
      <span className="legend-swatch" style={getSwatchStyle(color, pattern)} />
      <span className="legend-label">{label}</span>
    </div>
  );
}

function Legend({ layerKey, highlightValue, collapsed, onToggle }) {
  const cfg = LAYER_CONFIG[layerKey];
  if (!cfg) return null;

  const isGrouped = layerKey === 'hlzIII';

  return (
    <div className="map-legend" data-tour="legend">
      <div className="legend-header" onClick={onToggle}>
        <strong>{cfg.label}</strong>
        <span className="legend-toggle">{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <div className="legend-body">
          {isGrouped
            ? HLZIII_PALETTE_GROUPS.map((grp) => (
                <details key={grp.group} className="legend-group">
                  <summary className="legend-group-title">{grp.group}</summary>
                  {grp.entries.map((e) => (
                    <LegendEntry
                      key={e.value}
                      color={e.color}
                      label={e.label}
                      highlight={e.value === highlightValue}
                      pattern={getZonePattern(e.value)}
                    />
                  ))}
                </details>
              ))
            : cfg.palette.map((e) => (
                <LegendEntry
                  key={e.value}
                  color={e.color}
                  label={e.label}
                  highlight={e.value === highlightValue}
                />
              ))}
        </div>
      )}
    </div>
  );
}

// ── Layer selector ────────────────────────────────────────────────────────────

const LAYER_KEYS = ['gcz', 'gez', 'hlzII', 'hlzIII', 'soil'];
const LAYER_SHORT = { gcz: 'GCZ', gez: 'GEZ', hlzII: 'HLZ II', hlzIII: 'HLZ III', soil: 'Soil' };

function LayerSelector({ activeLayer, onSelect }) {
  return (
    <div className="layer-selector" data-tour="layers">
      {LAYER_KEYS.map((key) => (
        <button
          key={key}
          className={`layer-btn ${key === 'soil' ? 'layer-btn--soil' : 'layer-btn--zone'}${activeLayer === key ? ' layer-btn--active' : ''}`}
          onClick={() => onSelect(key)}
        >
          {LAYER_SHORT[key]}
        </button>
      ))}
    </div>
  );
}

// ── Opacity slider ────────────────────────────────────────────────────────────

function OpacitySlider({ value, onChange }) {
  return (
    <div className="opacity-slider">
      <span>Opacity</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span>{Math.round(value * 100)}%</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// All layer keys that can be prefetched (includes the pattern overlay).
const ALL_TILE_LAYERS = ['gcz', 'gez', 'hlzII', 'hlzIII', 'hlzIIIPattern', 'soil'];

function MapComponent({ onMapClick, selectedCoords, zoneData, panelVisible, onPanelToggle, dataset, startYear, endYear }) {
  const [tileUrls, setTileUrls] = useState(null);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tilesError, setTilesError] = useState(null);
  const [activeLayer, setActiveLayer] = useState('gez');
  const [opacity, setOpacity] = useState(0.75);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  // Tracks which layer URLs are already held in state so we don't re-fetch them.
  const cachedUrls = useRef({});

  // Reset cached URLs whenever the dataset or year range changes.
  useEffect(() => {
    setTileUrls(null);
    cachedUrls.current = {};
  }, [dataset, startYear, endYear]);

  // Fetch the active layer's tile URL. Skips the API call when the URL is
  // already in cachedUrls. For HLZ III, the main layer and pattern mask are
  // fetched in parallel (both are fast backend API calls, not GEE tile requests).
  // After the active layer loads, other layers are prefetched in the background
  // so switching between layers requires no extra wait.
  useEffect(() => {
    let cancelled = false;

    const needMain    = !cachedUrls.current[activeLayer];
    const needPattern = activeLayer === 'hlzIII' && !cachedUrls.current.hlzIIIPattern;

    if (!needMain && !needPattern) {
      setTilesLoading(false);
      setTilesError(null);
      return;
    }

    async function fetchActive(attemptsLeft, delay) {
      try {
        if (activeLayer === 'hlzIII') {
          // Fetch main layer and pattern mask in parallel.
          const requests = [];
          if (needMain)    requests.push(getMapTileLayer('hlzIII',        dataset, startYear, endYear).then(u => ({ key: 'hlzIII',        url: u })));
          if (needPattern) requests.push(getMapTileLayer('hlzIIIPattern', dataset, startYear, endYear).then(u => ({ key: 'hlzIIIPattern', url: u })));
          const results = await Promise.all(requests);
          if (cancelled) return;
          const updates = {};
          for (const { key, url } of results) { cachedUrls.current[key] = url; updates[key] = url; }
          setTileUrls((prev) => ({ ...(prev || {}), ...updates }));
        } else {
          const url = await getMapTileLayer(activeLayer, dataset, startYear, endYear);
          if (cancelled) return;
          cachedUrls.current[activeLayer] = url;
          setTileUrls((prev) => ({ ...(prev || {}), [activeLayer]: url }));
        }

        setTilesError(null);
        setTilesLoading(false);

        // Background-prefetch the remaining layers so switching is instant.
        // These hit the backend cache (fast) and don't block the active layer.
        ALL_TILE_LAYERS
          .filter((l) => !cachedUrls.current[l])
          .forEach((layer) => {
            getMapTileLayer(layer, dataset, startYear, endYear)
              .then((url) => {
                if (cancelled) return;
                cachedUrls.current[layer] = url;
                setTileUrls((prev) => ({ ...(prev || {}), [layer]: url }));
              })
              .catch(() => {});
          });

      } catch (err) {
        if (cancelled) return;
        if (attemptsLeft <= 1) {
          setTilesError(err.message);
          setTilesLoading(false);
          return;
        }
        setTimeout(() => fetchActive(attemptsLeft - 1, Math.min(delay * 2, 8000)), delay);
      }
    }

    setTilesLoading(true);
    setTilesError(null);
    fetchActive(3, 2000);
    return () => { cancelled = true; };
  }, [activeLayer, dataset, startYear, endYear]);

  // Determine the highlighted zone value for the active layer
  const highlightValue = (() => {
    if (!zoneData) return null;
    if (activeLayer === 'gcz') return zoneData.gcz?.value ?? null;
    if (activeLayer === 'gez') return zoneData.gez?.value ?? null;
    if (activeLayer === 'hlzII') return zoneData.hlzII?.value ?? null;
    if (activeLayer === 'hlzIII') return zoneData.hlzIII?.value ?? null;
    return null;
  })();

  const activeTileUrl = tileUrls ? tileUrls[activeLayer] : null;
  const mapCenter = selectedCoords ? [selectedCoords.lat, selectedCoords.lon] : [20, 0];
  const mapZoom = selectedCoords ? 6 : 2;

  return (
    <div className="map-wrapper">
      {/* Layer selector (top-left overlay) */}
      <LayerSelector activeLayer={activeLayer} onSelect={setActiveLayer} />

      {/* Opacity slider (top-right overlay) */}
      <OpacitySlider value={opacity} onChange={setOpacity} />

      {/* Tile loading / error indicator */}
      {tilesLoading && (
        <div className="map-status map-status--loading">Loading zone layers…</div>
      )}
      {tilesError && !tilesLoading && (
        <div className="map-status map-status--error">
          Zone overlay unavailable: {tilesError}
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
        zoomControl={true}
      >
        {/* Base map */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* GEE zone overlay */}
        {activeTileUrl && (
          <ZoneTileLayer
            tileUrl={activeTileUrl}
            opacity={opacity}
            maxNativeZoom={tileMaxNativeZoom(activeLayer, dataset)}
          />
        )}

        {/* Pattern overlay for HLZ III (canvas tile layer, client-side) */}
        {activeLayer === 'hlzIII' && tileUrls?.hlzIIIPattern && (
          <PatternTileLayer
            patternUrl={tileUrls.hlzIIIPattern}
            opacity={opacity}
            maxNativeZoom={tileMaxNativeZoom('hlzIIIPattern', dataset)}
          />
        )}

        {/* Click handler */}
        <MapClickHandler onMapClick={onMapClick} />

        {/* Resize map when panel opens/closes */}
        <MapResizer trigger={panelVisible} />

        {/* Selected location marker */}
        {selectedCoords && (
          <Marker
            position={[selectedCoords.lat, selectedCoords.lon]}
            icon={RED_ICON}
          />
        )}
      </MapContainer>

      {/* Coordinate readout */}
      <div className="coord-display">
        {selectedCoords ? (
          <>
            <strong>{selectedCoords.lon.toFixed(4)}</strong>,&nbsp;
            <strong>{selectedCoords.lat.toFixed(4)}</strong>
          </>
        ) : (
          <span className="coord-hint">Click the map to select coordinates</span>
        )}
        <span className="coord-hint"> — click to query</span>
      </div>

      {/* Legend */}
      <Legend
        layerKey={activeLayer}
        highlightValue={highlightValue}
        collapsed={legendCollapsed}
        onToggle={() => setLegendCollapsed((c) => !c)}
      />

      {/* Panel toggle button — rendered after Legend so CSS sibling selector works */}
      <button
        className="panel-toggle-btn"
        onClick={onPanelToggle}
        title={panelVisible ? 'Hide panel' : 'Show panel'}
      >
        {panelVisible ? '\u25b6' : '\u25c0'}
      </button>
    </div>
  );
}

export default MapComponent;

