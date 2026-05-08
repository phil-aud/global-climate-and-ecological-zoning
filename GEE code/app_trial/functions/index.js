/**
 * Firebase Cloud Functions - Main Entry Point
 * Exposes queryZones, getMonthlyClimate, getAnnualSummary, getBioecologicalData
 */

const functions = require('firebase-functions');
// Load local env if present to support emulator runs (functions/.env)
try {
  require('dotenv').config({ path: __dirname + '/.env' });
} catch (e) {
  // dotenv may not be installed in production; ignore if not available
}

const corsMiddleware = require('cors')({ origin: true });
const geeClient = require('./services/geeClient');

const { queryZones } = require('./handlers/queryZones');
const { getMonthlyClimate } = require('./handlers/getMonthlyClimate');
const { getAnnualSummary } = require('./handlers/getAnnualSummary');
const { getBioecologicalData } = require('./handlers/getBioecologicalData');
const { getMapTiles } = require('./handlers/getMapTiles');

// Initialize Earth Engine on cold start
let eeInitialized = false;

async function ensureEEInitialized() {
  if (eeInitialized) return;

  const credentials = geeClient.getServiceAccountCredentials();
  try {
    await geeClient.initializeEarthEngine(
      credentials.private_key,
      credentials.client_email
    );
    eeInitialized = true;
  } catch (err) {
    eeInitialized = false; // allow retry on next request
    throw err;
  }
}

/**
 * Cloud Function: Query zone classifications
 * POST /queryZones
 * Body: {lon: number, lat: number}
 */
exports.queryZones = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method not allowed');

      const { lon, lat } = req.body;
      if (lon === undefined || lat === undefined) return res.status(400).send('Missing lon or lat');
      const dataset = req.body.dataset || 'cru';

      await ensureEEInitialized();
      const result = await queryZones(parseFloat(lon), parseFloat(lat), dataset);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in queryZones:', error);
      return res.status(500).json({ error: error.message || 'Internal server error', code: 'QUERY_ZONES_ERROR' });
    }
  });
});

/**
 * Cloud Function: Get monthly climate data
 * POST /getMonthlyClimate
 * Body: {lon: number, lat: number, startYear: number, endYear: number}
 */
exports.getMonthlyClimate = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method not allowed');

      const { lon, lat, startYear, endYear } = req.body;
      if (lon === undefined || lat === undefined || startYear === undefined || endYear === undefined)
        return res.status(400).send('Missing parameters: lon, lat, startYear, endYear');
      const dataset = req.body.dataset || 'cru';

      await ensureEEInitialized();
      const result = await getMonthlyClimate(parseFloat(lon), parseFloat(lat), parseInt(startYear), parseInt(endYear), dataset);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in getMonthlyClimate:', error);
      return res.status(500).json({ error: error.message || 'Internal server error', code: 'GET_MONTHLY_CLIMATE_ERROR' });
    }
  });
});

/**
 * Cloud Function: Get annual summary (MAT, MAP)
 * POST /getAnnualSummary
 * Body: {lon: number, lat: number, startYear: number, endYear: number}
 */
exports.getAnnualSummary = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method not allowed');

      const { lon, lat, startYear, endYear } = req.body;
      if (lon === undefined || lat === undefined || startYear === undefined || endYear === undefined)
        return res.status(400).send('Missing parameters: lon, lat, startYear, endYear');
      const dataset = req.body.dataset || 'cru';

      await ensureEEInitialized();
      const result = await getAnnualSummary(parseFloat(lon), parseFloat(lat), parseInt(startYear), parseInt(endYear), dataset);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in getAnnualSummary:', error);
      return res.status(500).json({ error: error.message || 'Internal server error', code: 'GET_ANNUAL_SUMMARY_ERROR' });
    }
  });
});

/**
 * Cloud Function: Get GEE tile URLs for all zone layers
 * GET /getMapTiles
 */
exports.getMapTiles = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    try {
      if (req.method !== 'GET') return res.status(405).send('Method not allowed');
      await ensureEEInitialized();
      await getMapTiles(req, res);
    } catch (error) {
      console.error('Error in getMapTiles:', error);
      return res.status(500).json({ error: error.message || 'Internal server error', code: 'GET_MAP_TILES_ERROR' });
    }
  });
});

/**
 * Cloud Function: Get bioecological data
 * POST /getBioecologicalData
 * Body: {lon: number, lat: number, startYear: number, endYear: number}
 */
exports.getBioecologicalData = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method not allowed');

      const { lon, lat, startYear, endYear } = req.body;
      if (lon === undefined || lat === undefined || startYear === undefined || endYear === undefined)
        return res.status(400).send('Missing parameters: lon, lat, startYear, endYear');
      const dataset = req.body.dataset || 'cru';

      await ensureEEInitialized();
      const result = await getBioecologicalData(parseFloat(lon), parseFloat(lat), parseInt(startYear), parseInt(endYear), dataset);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in getBioecologicalData:', error);
      return res.status(500).json({ error: error.message || 'Internal server error', code: 'GET_BIOECOLOGICAL_DATA_ERROR' });
    }
  });
});
