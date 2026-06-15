/**
 * API Client for Firebase Cloud Functions
 * Handles all calls to the backend
 */

import axios from 'axios';
import { EarthEngineTile, earthEngineTileSource } from './eeTileSource';

// Change this to your Firebase function URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/climate-and-ecological-zoning/us-central1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
});

/** Throw a friendly Error when the backend returned a {noData:true} payload. */
function throwIfNoData(data, fallback) {
  if (data && data.noData) {
    const err = new Error(data.message || fallback || 'No data available at this location');
    err.noData = true;
    throw err;
  }
  return data;
}

/**
 * Query zone classifications at a point
 */
export async function queryZones(lon, lat, dataset = 'cru') {
  try {
    const response = await apiClient.post('/queryZones', { lon, lat, dataset });
    return throwIfNoData(response.data, 'No zone classification available at this location');
  } catch (error) {
    if (error.noData) throw error;
    throw new Error(error.response?.data?.error || 'Failed to query zones');
  }
}

/**
 * Get monthly climate data
 */
export async function getMonthlyClimate(lon, lat, startYear, endYear, dataset = 'cru') {
  try {
    const response = await apiClient.post('/getMonthlyClimate', {
      lon,
      lat,
      startYear,
      endYear,
      dataset,
    });
    return throwIfNoData(response.data, 'No monthly climate data available at this location');
  } catch (error) {
    if (error.noData) throw error;
    throw new Error(error.response?.data?.error || 'Failed to get monthly climate data');
  }
}

/**
 * Get annual summary
 */
export async function getAnnualSummary(lon, lat, startYear, endYear, dataset = 'cru') {
  try {
    const response = await apiClient.post('/getAnnualSummary', {
      lon,
      lat,
      startYear,
      endYear,
      dataset,
    });
    return throwIfNoData(response.data, 'No annual summary available at this location');
  } catch (error) {
    if (error.noData) throw error;
    throw new Error(error.response?.data?.error || 'Failed to get annual summary');
  }
}

/**
 * Get bioecological data
 */
export async function getBioecologicalData(lon, lat, startYear, endYear, dataset = 'cru') {
  try {
    const response = await apiClient.post('/getBioecologicalData', {
      lon,
      lat,
      startYear,
      endYear,
      dataset,
    });
    return throwIfNoData(response.data, 'No bioecological data available at this location');
  } catch (error) {
    if (error.noData) throw error;
    throw new Error(error.response?.data?.error || 'Failed to get bioecological data');
  }
}

/**
 * Get GEE tile URL templates for all zone layers.
 * Returns { gcz, gez, hlzII, hlzIII, hlzIIIPattern, soil } — each value is a
 * Leaflet-compatible tile URL template. This bundle endpoint waits for the
 * slowest layer; prefer `getMapTileLayer` to fetch one layer at a time.
 */
export async function getMapTiles(dataset = 'cru', startYear, endYear) {
  try {
    const params = { dataset };
    if (Number.isFinite(startYear)) params.startYear = startYear;
    if (Number.isFinite(endYear))   params.endYear   = endYear;
    const response = await apiClient.get('/getMapTiles', { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to get map tiles');
  }
}

/**
 * Get the GEE tile URL for a single zone layer. Resolves as soon as that
 * single layer's getMapId call completes server-side — much faster than the
 * bundle endpoint when only one layer is needed up-front.
 * Returns the tile URL string.
 */
export async function getMapTileLayer(layer, dataset = 'cru', startYear, endYear) {
  try {
    const params = { dataset, layer };
    if (Number.isFinite(startYear)) params.startYear = startYear;
    if (Number.isFinite(endYear))   params.endYear   = endYear;
    const response = await apiClient.get('/getMapTiles', { params });
    return response.data[layer];
  } catch (error) {
    throw new Error(error.response?.data?.error || `Failed to get map tile layer: ${layer}`);
  }
}

/**
 * Pre-warm GEE's tile cache (and the browser's image cache) for a freshly
 * issued tile URL template.
 *
 * GEE renders tiles lazily on first request and caches them per-mapId on
 * Google's edge. The first hit for an un-rendered tile can take several
 * seconds, especially at low zoom where each tile covers a large asset
 * area. Until the edge cache is warm, panning around feels laggy after a
 * fresh server restart even though the GEE Code Editor feels instant —
 * the Code Editor's tile coords are already warm.
 *
 * Tiles in Leaflet are loaded via <img>, so we use `new Image()` here
 * (matching the same image cache Leaflet itself populates) instead of
 * `fetch(..., {mode: 'no-cors'})`, which would only warm the fetch cache.
 *
 * Returns a Promise that resolves once all warming requests have settled
 * (callers may ignore it — it's purely opportunistic).
 *
 * @param {string} urlTemplate Leaflet-style template containing {z}/{x}/{y}
 *                             (and optional {s} subdomain placeholder).
 * @param {number[]} [zooms]   Zoom levels to warm. Default [2].
 */
export function prewarmTileUrl(urlTemplate, zooms = [2]) {
  if (!urlTemplate || typeof urlTemplate !== 'string') return Promise.resolve();
  const subdomains = ['a', 'b', 'c'];

  // Build the list of tile URLs to warm.
  const urls = [];
  for (const z of zooms) {
    const n = 1 << z;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        urls.push(
          urlTemplate
            .replace('{s}', subdomains[(x + y) % subdomains.length])
            .replace('{z}', String(z))
            .replace('{x}', String(x))
            .replace('{y}', String(y))
        );
      }
    }
  }

  // Route every prewarm request through the SAME global EE token pool that the
  // map's visible tiles use (ee.layers.EarthEngineTileSource keeps one static
  // TOKEN_POOL_ shared across all layers). Two things fall out of this:
  //   • Total in-flight GEE requests never exceed the pool limit, so a background
  //     prewarm can't stack on top of the visible-tile requests and trigger an
  //     HTTP 429 burst — which the old standalone CONCURRENCY=3 throttle could.
  //   • Prewarm is enqueued at the LOWEST priority (largest priority number =
  //     back of the queue), so a real tile the user is looking at always
  //     preempts opportunistic cache-warming.
  // maxRetries:0 keeps a failed prewarm from holding a token through backoff;
  // the real visible-tile load retries properly when the user navigates there.
  // The XHR GET warms the browser HTTP cache that the visible tile's XHR load
  // then hits, plus GEE's per-mapId edge cache — same as the old <img> warm-up.
  const PREWARM_PRIORITY = Number.MAX_SAFE_INTEGER;
  return new Promise((resolveAll) => {
    let remaining = urls.length;
    if (remaining === 0) { resolveAll(); return; }
    const settle = () => { remaining -= 1; if (remaining === 0) resolveAll(); };
    for (const url of urls) {
      const tile = new EarthEngineTile(new Image(), url, {
        onLoad: settle,
        onError: settle,
        maxRetries: 0,
      });
      earthEngineTileSource.loadTile(tile, PREWARM_PRIORITY);
    }
  });
}

/**
 * Get per-GCZ MAT statistics (median, min, max) for 1995–2024.
 * Returns { dataset, period, rows: [{zone, label, median, min, max}, ...] }.
 */
export async function getGczTempStats(dataset = 'cru') {
  try {
    const response = await apiClient.get('/getGczTempStats', {
      params: { dataset },
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to get GCZ temperature statistics');
  }
}

/**
 * Get per-GCZ monthly-mean temperature statistics (median + std) for each
 * calendar month over 1995–2024.
 * Returns { dataset, period, months, rows: [{zone, label, months: [{median,std}x12]}, ...] }.
 */
export async function getGczMonthlyTempStats(dataset = 'cru') {
  try {
    const response = await apiClient.get('/getGczMonthlyTempStats', {
      params: { dataset },
      timeout: 180000,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to get GCZ monthly temperature statistics');
  }
}

export default apiClient;
