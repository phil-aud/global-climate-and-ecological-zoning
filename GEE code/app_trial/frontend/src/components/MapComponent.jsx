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
import { getMapTiles } from '../utils/api';
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
 * Manages the zone overlay tile layer imperatively so we can swap it
 * when the active layer or tile URLs change.
 */
function ZoneTileLayer({ tileUrl, opacity }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!tileUrl) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    layerRef.current = L.tileLayer(tileUrl, {
      opacity,
      attribution: 'GEE / ee-philaudebert',
      maxZoom: 18,
    }).addTo(map);
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tileUrl]);

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
function PatternTileLayer({ patternUrl, opacity }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!patternUrl) return;

    const PatternLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const tileSize = this.getTileSize();
        const canvas = document.createElement('canvas');
        canvas.width  = tileSize.x;
        canvas.height = tileSize.y;

        const url = patternUrl
          .replace('{z}', coords.z)
          .replace('{x}', coords.x)
          .replace('{y}', coords.y);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = function () {
          const w = canvas.width;
          const h = canvas.height;
          const ctx = canvas.getContext('2d');

          // Draw the mask tile onto the canvas to read its pixels
          ctx.drawImage(img, 0, 0, w, h);
          const { data } = ctx.getImageData(0, 0, w, h);

          // Build a transparent output image for the pattern overlay
          ctx.clearRect(0, 0, w, h);
          const out = ctx.createImageData(w, h);
          const od  = out.data;

          for (let i = 0; i < data.length; i += 4) {
            const r  = data[i];
            const g  = data[i + 1];
            const b  = data[i + 2];
            const px = (i / 4) % w;
            const py = Math.floor(i / 4 / w);

            // Tolerant colour tests to survive JPEG tile compression.
            // Colour → symbol mapping (server SLD uses distinct pure colours):
            //  Red   (#FF0000)   -> premontane -> right-diagonal hatch
            //  Green (#00FF00)   -> lower montane -> left-diagonal hatch
            //  Blue  (#0000FF)   -> montane -> vertical lines
            //  Magenta (#FF00FF) -> subalpine -> X (both diagonals)
            //  Orange (#FFA500)  -> alpine -> points
            //  Yellow (#FFFF00)  -> nival -> stars
            if (r > 180 && g < 120 && b < 120) {
              // Right-diagonal hatch (45°)
              if ((px - py + 1024) % 5 === 0) {
                od[i] = 0; od[i+1] = 0; od[i+2] = 0; od[i+3] = 150;
              }
            } else if (g > 180 && r < 120 && b < 120) {
              // Left-diagonal hatch (135°)
              if ((px + py) % 5 === 0) {
                od[i] = 0; od[i+1] = 0; od[i+2] = 0; od[i+3] = 150;
              }
            } else if (r > 180 && b > 180 && g < 120) {
              // Magenta -> X pattern (both diagonals)
              if ((px + py) % 5 === 0 || (px - py + 1024) % 5 === 0) {
                od[i] = 0; od[i+1] = 0; od[i+2] = 0; od[i+3] = 140;
              }
            } else if (b > 180 && r < 120 && g < 120) {
              // Blue -> vertical lines for montane
              if (px % 4 === 0) {
                od[i] = 0; od[i+1] = 0; od[i+2] = 0; od[i+3] = 140;
              }
            } else if (r > 200 && g > 120 && g < 210 && b < 120) {
              // Points (orange #FFA500) — grid of dots every 6 px.
              // Note: g<210 keeps pure yellow (255,255,0) out of this branch
              // so nival pixels reach the star branch below.
              if (px % 6 === 0 && py % 6 === 0) {
                od[i] = 0; od[i+1] = 0; od[i+2] = 0; od[i+3] = 170;
              }
            } else if (r > 180 && g > 180 && b < 120) {
              // Stars (yellow) — draw small star glyphs sparsely
              if (px % 12 === 0 && py % 12 === 0) {
                // small plus-shaped star
                od[i] = 60; od[i+1] = 60; od[i+2] = 60; od[i+3] = 220;
                const offs = [1, -1, 256, -256];
                offs.forEach((off) => {
                  const j = i + off * 4;
                  if (j >= 0 && j < od.length) {
                    od[j] = 60; od[j+1] = 60; od[j+2] = 60; od[j+3] = 220;
                  }
                });
              }
            }
            // White (#FFFFFF) or unknown → all zeros = transparent (already 0)
          }

          ctx.putImageData(out, 0, 0);
          done(null, canvas);
        };

        img.onerror = () => done(null, canvas);
        img.src = url;
        return canvas;
      },
    });

    const layer = new PatternLayer({ tileSize: 256, opacity, pane: 'overlayPane' });
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, patternUrl]);

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
  const [activeLayer, setActiveLayer] = useState('gez');
  const [opacity, setOpacity] = useState(0.75);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Fetch tile URLs when dataset changes, retrying up to 5 times with backoff
  useEffect(() => {
    let cancelled = false;
    async function fetchWithRetry(attemptsLeft, delay) {
      try {
        const urls = await getMapTiles(dataset, startYear, endYear);
        if (!cancelled) {
          setTileUrls(urls);
          setTilesError(null);
          setTilesLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (attemptsLeft <= 1) {
          setTilesError(err.message);
          setTilesLoading(false);
        } else {
          setTimeout(() => fetchWithRetry(attemptsLeft - 1, Math.min(delay * 2, 10000)), delay);
        }
      }
    }
    setTilesLoading(true);
    // Keep previous tileUrls visible while the new bundle is being fetched —
    // the GEE recompute can take several seconds and a blank map looks broken.
    fetchWithRetry(5, 2000);
    return () => { cancelled = true; };
  }, [dataset, startYear, endYear]);

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
          <ZoneTileLayer tileUrl={activeTileUrl} opacity={opacity} />
        )}

        {/* Pattern overlay for HLZ III (canvas tile layer, client-side) */}
        {activeLayer === 'hlzIII' && tileUrls?.hlzIIIPattern && (
          <PatternTileLayer patternUrl={tileUrls.hlzIIIPattern} opacity={opacity} />
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

