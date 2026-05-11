# Firebase Cloud Functions API Reference

## Overview

All functions are HTTP endpoints that accept POST requests with JSON bodies and return JSON responses.

**Base URL (Development):**
```
http://localhost:5001/your-project-id/us-central1
```

**Base URL (Production):**
```
https://us-central1-your-project-id.cloudfunctions.net
```

**CORS:** Enabled for all requests

---

## Endpoints

### 1. Query Zones

Query GCZ, GEZ, HLZ II, and HLZ III at a specific geographic point.

**Endpoint:** `POST /queryZones`

**Request:**
```json
{
  "lon": 10.0,
  "lat": 10.0
}
```

**Response (Success - 200):**
```json
{
  "lon": 10.0,
  "lat": 10.0,
  "gcz": {
    "value": 2,
    "label": "Tropical Moist"
  },
  "gez": {
    "value": 12,
    "label": "Tropical Moist Forest",
    "code": "1b"
  },
  "hlzII": {
    "value": 12,
    "label": "Tropical Wet Forest"
  },
  "hlzIII": {
    "value": 112,
    "label": "Tropical Wet Forest"
  }
}
```

**Response (Error - 400/500):**
```json
{
  "error": "Invalid coordinates: lon must be -180 to 180, lat -90 to 90",
  "code": "QUERY_ZONES_ERROR"
}
```

**Parameters:**
- `lon` (number, required): Longitude (-180 to 180)
- `lat` (number, required): Latitude (-90 to 90)

**Performance:**
- Typical response time: 1–3 seconds
- Cold start: ~5 seconds

---

### 2. Get Monthly Climate

Returns monthly temperature and precipitation data, averaged across the specified year range.

**Endpoint:** `POST /getMonthlyClimate`

**Request:**
```json
{
  "lon": 10.0,
  "lat": 10.0,
  "startYear": 2020,
  "endYear": 2024
}
```

**Response (Success - 200):**
```json
[
  {
    "month": "Jan",
    "temperature": 24.5,
    "precipitation": 120.3
  },
  {
    "month": "Feb",
    "temperature": 25.1,
    "precipitation": 105.8
  },
  ...
  {
    "month": "Dec",
    "temperature": 23.9,
    "precipitation": 145.2
  }
]
```

**Response (Error - 400/500):**
```json
{
  "error": "Data available from 1901 onwards",
  "code": "GET_MONTHLY_CLIMATE_ERROR"
}
```

**Parameters:**
- `lon` (number, required): Longitude (-180 to 180)
- `lat` (number, required): Latitude (-90 to 90)
- `startYear` (integer, required): Start year (1901–2024)
- `endYear` (integer, required): End year (≥ startYear, ≤ current year)

**Notes:**
- Returns exactly 12 months (Jan–Dec)
- Values are averages across all years in the range
- Units: Temperature in °C, Precipitation in mm

**Performance:**
- Typical response time: 2–4 seconds

---

### 3. Get Annual Summary

Returns mean annual temperature (MAT) and mean annual precipitation (MAP) for the specified period.

**Endpoint:** `POST /getAnnualSummary`

**Request:**
```json
{
  "lon": 10.0,
  "lat": 10.0,
  "startYear": 2020,
  "endYear": 2024
}
```

**Response (Success - 200):**
```json
{
  "meanAnnualTemp": 24.2,
  "meanAnnualPrecip": 1456.8
}
```

**Response (Error - 400/500):**
```json
{
  "error": "No data available at this location for the specified years",
  "code": "GET_ANNUAL_SUMMARY_ERROR"
}
```

**Parameters:**
- `lon` (number, required): Longitude
- `lat` (number, required): Latitude
- `startYear` (integer, required): Start year
- `endYear` (integer, required): End year

**Notes:**
- MAT: Mean of all monthly temperatures across the year range
- MAP: Sum of monthly precipitation across the year range
- Units: Temperature in °C, Precipitation in mm

**Performance:**
- Typical response time: 2–3 seconds

---

### 4. Get Bioecological Data

Returns biotemperature, precipitation, PET ratio, and elevation for classification under the Holdridge Life Zone scheme.

**Endpoint:** `POST /getBioecologicalData`

**Request:**
```json
{
  "lon": 10.0,
  "lat": 10.0,
  "startYear": 2020,
  "endYear": 2024
}
```

**Response (Success - 200):**
```json
{
  "biotemperature": 22.5,
  "precipitation": 1456.8,
  "petRatio": 0.75,
  "elevation": 245.3
}
```

**Response (Error - 400/500):**
```json
{
  "error": "Internal server error",
  "code": "GET_BIOECOLOGICAL_DATA_ERROR"
}
```

**Parameters:**
- `lon` (number, required): Longitude
- `lat` (number, required): Latitude
- `startYear` (integer, required): Start year
- `endYear` (integer, required): End year

**Notes:**
- **Biotemperature**: Mean temperature of months with temperature > 0°C (simplified; doesn't include half-weighting for 0–2°C)
- **Precipitation**: Total annual (sum of monthly)
- **PET Ratio**: Precipitation / Potential Evapotranspiration (0 = desert, 1+ = wet)
- **Elevation**: Mean elevation from DTOPO30
- Units: Temperature in °C, Precipitation in mm, Elevation in meters

**Performance:**
- Typical response time: 2–4 seconds

---

## Error Responses

All errors return JSON with `error` and `code` fields.

**Common Errors:**

| Code | Status | Cause | Solution |
|------|--------|-------|----------|
| `QUERY_ZONES_ERROR` | 500 | Invalid input or GEE query failed | Check coordinates; verify assets exist |
| `GET_MONTHLY_CLIMATE_ERROR` | 500 | Year out of range or no data | Use 1901–2024 range |
| `GET_ANNUAL_SUMMARY_ERROR` | 500 | No data at location | Try nearby location |
| `GET_BIOECOLOGICAL_DATA_ERROR` | 500 | Elevation or PET data missing | Check location coverage |
| (Missing params) | 400 | Required parameter missing | Include all required fields |
| (Method not allowed) | 405 | Non-POST request | Use POST |

---

## Request/Response Example (cURL)

```bash
# Query zones at a point
curl -X POST \
  http://localhost:5001/your-project-id/us-central1/queryZones \
  -H 'Content-Type: application/json' \
  -d '{
    "lon": 10.0,
    "lat": 10.0
  }'

# Get monthly climate
curl -X POST \
  http://localhost:5001/your-project-id/us-central1/getMonthlyClimate \
  -H 'Content-Type: application/json' \
  -d '{
    "lon": 10.0,
    "lat": 10.0,
    "startYear": 2020,
    "endYear": 2024
  }'

# Get annual summary
curl -X POST \
  http://localhost:5001/your-project-id/us-central1/getAnnualSummary \
  -H 'Content-Type: application/json' \
  -d '{
    "lon": 10.0,
    "lat": 10.0,
    "startYear": 2020,
    "endYear": 2024
  }'

# Get bioecological data
curl -X POST \
  http://localhost:5001/your-project-id/us-central1/getBioecologicalData \
  -H 'Content-Type: application/json' \
  -d '{
    "lon": 10.0,
    "lat": 10.0,
    "startYear": 2020,
    "endYear": 2024
  }'
```

---

## Frontend Usage

The frontend uses `frontend/src/utils/api.js` to call these endpoints:

```javascript
import { queryZones, getMonthlyClimate, getAnnualSummary, getBioecologicalData } from './utils/api';

// Query zones
const zones = await queryZones(10, 10);

// Get monthly data
const monthly = await getMonthlyClimate(10, 10, 2020, 2024);

// Get annual summary
const annual = await getAnnualSummary(10, 10, 2020, 2024);

// Get bioecological data
const bio = await getBioecologicalData(10, 10, 2020, 2024);
```

---

## Rate Limiting & Quotas

- **Firebase Functions**: 2M invocations/month (free tier)
- **GEE API**: Check your service account quota (typically 40K requests/month)
- **Recommended**: Cache queries if same location is queried multiple times (see IMPLEMENTATION_NOTES.md)

---

## Timeouts

- **Firebase default**: 60 seconds (sufficient for GEE queries)
- **Typical query response**: 2–5 seconds
- **Cold start**: ~5 seconds on first invocation after deploy

---

## Debugging

**Enable local logging:**
```bash
firebase functions:log
```

**Check live logs in Firebase Console:**
- Navigate to: Cloud Functions → Select Function → Logs tab

**Common issues:**
- "Earth Engine not initialized" → Check `.env` credentials
- "Assets not found" → Verify asset paths in handlers
- Timeout → GEE query taking too long; check API quota

---

## Future Enhancements

- [ ] Add request ID tracking for debugging
- [ ] Implement request batching (query multiple points in one call)
- [ ] Add response caching
- [ ] Implement authentication (if multiple users needed)
- [ ] Add data export (CSV, GeoJSON)
