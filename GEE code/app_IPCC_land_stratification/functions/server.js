/**
 * Standalone Express server - replaces Firebase emulator (no Java required)
 * Listens on port 5001, same URL pattern as emulator:
 *   http://localhost:5001/climate-and-ecological-zoning/us-central1/<functionName>
 */

require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const cors = require('cors');
const geeClient = require('./services/geeClient');

const { queryZones } = require('./handlers/queryZones');
const { getMonthlyClimate } = require('./handlers/getMonthlyClimate');
const { getAnnualSummary } = require('./handlers/getAnnualSummary');
const { getBioecologicalData } = require('./handlers/getBioecologicalData');
const { getMapTiles } = require('./handlers/getMapTiles');
const { getGczTempStats } = require('./handlers/getGczTempStats');

const app = express();
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

const BASE = '/climate-and-ecological-zoning/us-central1';

// Earth Engine initialisation (lazy, cached)
let eeInitialized = false;
async function ensureEEInitialized() {
  if (eeInitialized) return;
  const credentials = geeClient.getServiceAccountCredentials();
  await geeClient.initializeEarthEngine(credentials.private_key, credentials.client_email);
  eeInitialized = true;
}

app.post(`${BASE}/queryZones`, async (req, res) => {
  try {
    const { lon, lat } = req.body;
    if (lon === undefined || lat === undefined)
      return res.status(400).json({ error: 'Missing lon or lat' });
    const dataset = req.body.dataset || 'cru';
    await ensureEEInitialized();
    const result = await queryZones(parseFloat(lon), parseFloat(lat), dataset);
    res.json(result);
  } catch (err) {
    console.error('queryZones error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post(`${BASE}/getMonthlyClimate`, async (req, res) => {
  try {
    const { lon, lat, startYear, endYear } = req.body;
    if ([lon, lat, startYear, endYear].some(v => v === undefined))
      return res.status(400).json({ error: 'Missing parameters' });
    const dataset = req.body.dataset || 'cru';
    await ensureEEInitialized();
    const result = await getMonthlyClimate(parseFloat(lon), parseFloat(lat), parseInt(startYear), parseInt(endYear), dataset);
    res.json(result);
  } catch (err) {
    console.error('getMonthlyClimate error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post(`${BASE}/getAnnualSummary`, async (req, res) => {
  try {
    const { lon, lat, startYear, endYear } = req.body;
    if ([lon, lat, startYear, endYear].some(v => v === undefined))
      return res.status(400).json({ error: 'Missing parameters' });
    const dataset = req.body.dataset || 'cru';
    await ensureEEInitialized();
    const result = await getAnnualSummary(parseFloat(lon), parseFloat(lat), parseInt(startYear), parseInt(endYear), dataset);
    res.json(result);
  } catch (err) {
    console.error('getAnnualSummary error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post(`${BASE}/getBioecologicalData`, async (req, res) => {
  try {
    const { lon, lat, startYear, endYear } = req.body;
    if ([lon, lat, startYear, endYear].some(v => v === undefined))
      return res.status(400).json({ error: 'Missing parameters' });
    const dataset = req.body.dataset || 'cru';
    await ensureEEInitialized();
    const result = await getBioecologicalData(parseFloat(lon), parseFloat(lat), parseInt(startYear), parseInt(endYear), dataset);
    res.json(result);
  } catch (err) {
    console.error('getBioecologicalData error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get(`${BASE}/getMapTiles`, async (req, res) => {
  try {
    await ensureEEInitialized();
    await getMapTiles(req, res);
  } catch (err) {
    console.error('getMapTiles error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get(`${BASE}/getGczTempStats`, async (req, res) => {
  try {
    const dataset = (req.query && req.query.dataset) === 'terraclimate' ? 'terraclimate' : 'cru';
    await ensureEEInitialized();
    const result = await getGczTempStats(dataset);
    res.json(result);
  } catch (err) {
    console.error('getGczTempStats error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}${BASE}`);
});

// Prevent unhandled errors from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Intercept process.exit to log the source
const _exit = process.exit.bind(process);
process.exit = function(code) {
  console.error(`process.exit(${code}) called from:`);
  console.error(new Error().stack);
  _exit(code);
};
