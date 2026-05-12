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

/**
 * Throttled L.TileLayer subclass.
 *
 * GEE's per-mapId tile worker pool is small (empirically ~6 concurrent
 * requests). Leaflet by default fires *all* viewport tile requests in
 * parallel — on initial load that's typically 16–24 tiles, plus another
 * batch for the pattern overlay. The excess come back as HTTP 429
 * ("Too Many Requests"), which the browser logs to the console and
 * which then forces our retry path to re-issue them anyway.
 *
 * This subclass caps the number of in-flight tile requests at
 * MAX_CONCURRENT and queues the rest. As each request finishes (load or
 * error), the next queued request is dispatched.
 */
const MAX_CONCURRENT_TILES = 2;
// Minimum spacing (ms) between consecutive dispatches. GEE enforces both a
// concurrency cap and a per-second rate limit per mapId, so spacing alone is
// not enough — without it, all tiles would burst in the first 50 ms.
const MIN_DISPATCH_INTERVAL_MS = 120;
let _inFlight = 0;
// Initialise to a past timestamp so the very first dispatch is immediate.
let _lastDispatchAt = -MIN_DISPATCH_INTERVAL_MS;
let _drainTimer = null;
const _tileQueue = [];

function _drainTileQueue() {
  if (_drainTimer) return;
  while (_inFlight < MAX_CONCURRENT_TILES && _tileQueue.length > 0) {
    const now = Date.now();
    const wait = _lastDispatchAt + MIN_DISPATCH_INTERVAL_MS - now;
    if (wait > 0) {
      _drainTimer = setTimeout(() => {
        _drainTimer = null;
        _drainTileQueue();
      }, wait);
      return;
    }
    const fn = _tileQueue.shift();
    _inFlight += 1;
    _lastDispatchAt = now;
    fn();
  }
}

function _scheduleTileLoad(loader) {
  _tileQueue.push(loader);
  _drainTileQueue();
}

function _tileFinished() {
  _inFlight = Math.max(0, _inFlight - 1);
  _drainTileQueue();
}

const ThrottledTileLayer = L.TileLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('img');

    L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

    if (this.options.crossOrigin || this.options.crossOrigin === '') {
      tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
    }
    tile.alt = '';
    tile.setAttribute('role', 'presentation');

    const url = this.getTileUrl(coords);
    let settled = false;

    // Called when the tile's network request completes (load or error).
    // Releases the in-flight slot for the next queued tile.
    const finish = () => {
      if (settled) return;
      settled = true;
      _tileFinished();
    };
    L.DomEvent.on(tile, 'load', finish);
    L.DomEvent.on(tile, 'error', finish);

    // _abortLoad just marks the tile cancelled. It does NOT release a slot —
    // the tile is still in the queue at this point (src not yet set), so no
    // slot has been taken. The loader will release when it runs.
    tile._abortLoad = () => { tile._cancelled = true; };

    _scheduleTileLoad(() => {
      if (tile._cancelled) {
        // This loader was dispatched from the queue (_inFlight was already
        // incremented). Release that slot without making a network request.
        _tileFinished();
        return;
      }
      tile.src = url;
    });

    return tile;
  },

  // Override _removeTile so that queued (not-yet-dispatched) tiles are
  // marked cancelled before Leaflet removes them, preventing wasted requests.
  _removeTile(key) {
    const tile = this._tiles[key];
    if (tile && tile.el && tile.el._abortLoad) {
      tile.el._abortLoad();
    }
    // Delegate to GridLayer (where _removeTile actually lives in Leaflet 1.x).
    return L.GridLayer.prototype._removeTile.call(this, key);
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
      // Abort in-flight requests before swapping layers
      if (layerRef.current._tiles) {
        Object.values(layerRef.current._tiles).forEach(({ el }) => {
          if (el && !el.complete) { el.onload = null; el.onerror = null; el.src = ''; }
        });
      }
      map.removeLayer(layerRef.current);
    }
    layerRef.current = new ThrottledTileLayer(tileUrl, {
      opacity,
      attribution: 'GEE / ee-philaudebert',
      maxZoom: 18,
      maxNativeZoom,
      // Allow canvas pixel-reads so we can detect GEE cold-pipeline blank tiles.
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

    // Capture the original GEE URL at tileloadstart ONCE (do not overwrite on
    // retry requests so originalSrc always points to the clean GEE URL).
    const tileOriginalUrls = new Map();
    layerRef.current.on('tileloadstart', (e) => {
      if (e.tile && e.tile.src && !tileOriginalUrls.has(e.tile)) {
        tileOriginalUrls.set(e.tile, e.tile.src);
      }
    });

    // Retry HTTP-error tiles (4xx / 5xx) with exponential backoff + jitter.
    // GEE's per-mapId tile pool is small and frequently returns HTTP 429
    // ("Too Many Requests") on initial map load. A short fixed backoff causes
    // every retry batch to hit the server simultaneously and 429 again, which
    // the browser logs to the console for each failed request. Exponential
    // backoff with jitter spreads retries out so they actually succeed.
    //
    // IMPORTANT: GEE's tile endpoint rejects unknown query parameters with
    // HTTP 400. Cache-bust the <img> using a URL **fragment** (#retry=N)
    // instead — fragments are not sent to the server but still make the
    // browser treat the URL as new and re-issue the request.
    const retryCounts = new WeakMap();
    layerRef.current.on('tileerror', (e) => {
      const tileEl = e.tile;
      if (!tileEl) return;
      const originalSrc = tileOriginalUrls.get(tileEl);
      if (!originalSrc || originalSrc.startsWith('data:')) return;
      const tries = (retryCounts.get(tileEl) || 0) + 1;
      if (tries > 5) return;
      retryCounts.set(tileEl, tries);
      // 1.5 s, 3 s, 6 s, 12 s, 24 s + up to 50% jitter
      const base = 1500 * Math.pow(2, tries - 1);
      const delay = base + Math.random() * base * 0.5;
      setTimeout(() => {
        if (!tileEl.parentNode) return;
        tileEl.src = `${originalSrc}#retry=${tries}`;
      }, delay);
    });

    // Detect GEE cold-pipeline blank tiles (HTTP 200, transparent PNG).
    // These never trigger tileerror, so we inspect each loaded tile by sampling
    // its centre pixel via canvas. If alpha === 0 the tile is blank and we
    // retry it individually — no setUrl, so other tiles are never disturbed.
    const blankRetryCounts = new WeakMap();
    layerRef.current.on('tileload', (e) => {
      const tileEl = e.tile;
      const originalSrc = tileOriginalUrls.get(tileEl);
      if (!originalSrc || originalSrc.startsWith('data:')) return;
      if ((blankRetryCounts.get(tileEl) || 0) >= 3) return;
      try {
        const check = document.createElement('canvas');
        check.width = 1; check.height = 1;
        const ctx = check.getContext('2d');
        // Sample the centre pixel of the 256×256 tile
        ctx.drawImage(tileEl, 128, 128, 1, 1, 0, 0, 1, 1);
        const alpha = ctx.getImageData(0, 0, 1, 1).data[3];
        if (alpha > 0) return; // tile has real data — nothing to do
      } catch (_) {
        return; // CORS / tainted-canvas error — can't check, leave tile as-is
      }
      // Tile is fully transparent → GEE pipeline was cold. Schedule a retry.
      const tries = (blankRetryCounts.get(tileEl) || 0) + 1;
      blankRetryCounts.set(tileEl, tries);
      setTimeout(() => {
        if (!tileEl.parentNode) return;
        tileEl.src = `${originalSrc}#blank_retry=${tries}`;
      }, 3000 * tries); // 3 s, 6 s, 9 s
    });

    return () => {
      if (layerRef.current) {
        const layer = layerRef.current;
        if (layer._tiles) {
          Object.values(layer._tiles).forEach(({ el }) => {
            if (el && !el.complete) {
              el.onload = null;
              el.onerror = null;
              el.src = '';
            }
          });
        }
        map.removeLayer(layer);
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

        // Route pattern-tile loads through the same global concurrency queue
        // used by ThrottledTileLayer so the colour layer + pattern layer share
        // GEE's small per-mapId tile worker pool instead of doubling it.
        let slotReleased = false;
        const releaseSlot = () => {
          if (slotReleased) return;
          slotReleased = true;
          _tileFinished();
        };

        // Retry transient GEE tile failures (HTTP 429 / 5xx) with exponential
        // backoff + jitter so we don't keep slamming GEE's rate-limited tile
        // pool with synchronized retries. Cache-bust via URL fragment so we
        // don't add unknown query params (GEE returns 400 for those).
        let attempts = 0;
        img.onerror = function () {
          releaseSlot();
          attempts += 1;
          if (attempts > 5) {
            done(null, canvas);
            return;
          }
          const base = 1500 * Math.pow(2, attempts - 1);
          const delay = base + Math.random() * base * 0.5;
          setTimeout(() => {
            _scheduleTileLoad(() => {
              slotReleased = false;
              img.src = `${url}#retry=${attempts}`;
            });
          }, delay);
        };

        img.onload = function () {
          releaseSlot();
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
                if ((px - py + 2048) % 7 < 2) mark(i, HATCH_A);
                break;
              case 2: // left-diagonal hatch (\)   — matches legend 'left-hatch'
                if ((px + py) % 7 < 2) mark(i, HATCH_A);
                break;
              case 3: // vertical lines |||         — matches legend 'vertical'
                if (px % 7 < 2) mark(i, VERT_A);
                break;
              case 4: // X cross-hatch              — matches legend 'x'
                if ((px - py + 2048) % 7 < 2 || (px + py) % 7 < 2) mark(i, X_A);
                break;
              case 5: // dots                       — matches legend 'points'
                if (px % 8 < 3 && py % 8 < 3) mark(i, DOT_A);
                break;
              case 6: // snowflake +                — matches legend 'snowflake'
                if (px % 12 === 0 && py % 12 === 0) {
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

        _scheduleTileLoad(() => { img.src = url; });
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

const _DOT   = `radial-gradient(circle, rgba(0,0,0,0.38) 1px, transparent 1px) 0 0 / 8px 8px`;
const _HATCH = `repeating-linear-gradient(135deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 7px)`;
const _HATCH2 = `repeating-linear-gradient(45deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 7px)`;

function getSwatchStyle(color, pattern) {
  switch (pattern) {
    case 'points':       return { background: `${_DOT}, ${color}` };
    case 'left-hatch':   return { background: `${_HATCH}, ${color}` };
    case 'right-hatch':  return { background: `${_HATCH2}, ${color}` };
    case 'x':            return { background: `${_HATCH}, ${_HATCH2}, ${color}` };
    case 'vertical':     return { background: `repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 7px), ${color}` };
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
    <div className="map-legend">
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
    <div className="layer-selector">
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

function MapComponent({ onMapClick, selectedCoords, zoneData, panelVisible, onPanelToggle, dataset, startYear, endYear }) {
  const [tileUrls, setTileUrls] = useState(null);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tilesError, setTilesError] = useState(null);
  // Separate state for HLZ III pattern layer (fetched independently).
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternError, setPatternError] = useState(null);
  const [activeLayer, setActiveLayer] = useState('gez');
  const [opacity, setOpacity] = useState(0.75);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Reset cached URLs whenever the dataset or year range changes.
  useEffect(() => {
    setTileUrls(null);
  }, [dataset, startYear, endYear]);

  // ── Fetch the active SLD layer independently ────────────────────────────
  // Each layer is fetched on-demand when the user switches to it and cached
  // in tileUrls so repeated switches don't re-hit the server.
  useEffect(() => {
    let cancelled = false;

    async function fetchLayer(attemptsLeft, delay) {
      try {
        const url = await getMapTileLayer(activeLayer, dataset, startYear, endYear);
        if (cancelled) return;
        setTileUrls((prev) => ({ ...(prev || {}), [activeLayer]: url }));
        setTilesError(null);
        setTilesLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (attemptsLeft <= 1) {
          setTilesError(err.message);
          setTilesLoading(false);
          return;
        }
        setTimeout(() => fetchLayer(attemptsLeft - 1, Math.min(delay * 2, 8000)), delay);
      }
    }

    setTilesLoading(true);
    setTilesError(null);
    fetchLayer(3, 2000);
    return () => { cancelled = true; };
  }, [activeLayer, dataset, startYear, endYear]);

  // ── Fetch the HLZ III pattern layer independently ───────────────────────
  // Only triggered when HLZ III is active. Runs concurrently with the SLD
  // fetch above so the color tiles and pattern tiles load in parallel.
  useEffect(() => {
    if (activeLayer !== 'hlzIII') return;
    let cancelled = false;

    async function fetchPattern(attemptsLeft, delay) {
      try {
        const url = await getMapTileLayer('hlzIIIPattern', dataset, startYear, endYear);
        if (cancelled) return;
        setTileUrls((prev) => ({ ...(prev || {}), hlzIIIPattern: url }));
        setPatternError(null);
        setPatternLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (attemptsLeft <= 1) {
          setPatternError(err.message);
          setPatternLoading(false);
          return;
        }
        setTimeout(() => fetchPattern(attemptsLeft - 1, Math.min(delay * 2, 8000)), delay);
      }
    }

    setPatternLoading(true);
    setPatternError(null);
    fetchPattern(3, 2000);
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
  const patternTileUrl = tileUrls ? tileUrls.hlzIIIPattern : null;
  const mapCenter = selectedCoords ? [selectedCoords.lat, selectedCoords.lon] : [20, 0];
  const mapZoom = selectedCoords ? 6 : 2;

  return (
    <div className="map-wrapper">
      {/* Layer selector (top-left overlay) */}
      <LayerSelector activeLayer={activeLayer} onSelect={setActiveLayer} />

      {/* Opacity slider (top-right overlay) */}
      <OpacitySlider value={opacity} onChange={setOpacity} />

      {/* SLD layer loading / error indicator */}
      {tilesLoading && (
        <div className="map-status map-status--loading">Loading zone layer…</div>
      )}
      {tilesError && !tilesLoading && (
        <div className="map-status map-status--error">
          Zone overlay unavailable: {tilesError}
        </div>
      )}

      {/* HLZ III pattern layer loading / error indicator (independent) */}
      {activeLayer === 'hlzIII' && patternLoading && !tilesLoading && (
        <div className="map-status map-status--loading map-status--pattern">Loading pattern overlay…</div>
      )}
      {activeLayer === 'hlzIII' && patternError && !patternLoading && (
        <div className="map-status map-status--error map-status--pattern">
          Pattern overlay unavailable: {patternError}
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

        {/* GEE zone SLD overlay — mounts as soon as its URL arrives */}
        {activeTileUrl && (
          <ZoneTileLayer
            tileUrl={activeTileUrl}
            opacity={opacity}
            maxNativeZoom={tileMaxNativeZoom(activeLayer, dataset)}
          />
        )}

        {/* HLZ III pattern overlay — fetched independently, mounts when its URL arrives */}
        {activeLayer === 'hlzIII' && patternTileUrl && (
          <PatternTileLayer
            patternUrl={patternTileUrl}
            opacity={opacity}
            maxNativeZoom={tileMaxNativeZoom('hlzIII', dataset)}
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

