/**
 * API Client for Firebase Cloud Functions
 * Handles all calls to the backend
 */

import axios from 'axios';

// Change this to your Firebase function URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/climate-and-ecological-zoning/us-central1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
});

/**
 * Query zone classifications at a point
 */
export async function queryZones(lon, lat, dataset = 'cru') {
  try {
    const response = await apiClient.post('/queryZones', { lon, lat, dataset });
    return response.data;
  } catch (error) {
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
    return response.data;
  } catch (error) {
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
    return response.data;
  } catch (error) {
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
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to get bioecological data');
  }
}

/**
 * Get GEE tile URL templates for all zone layers.
 * Returns { gcz, gez, hlzII, hlzIII } — each value is a Leaflet-compatible tile URL template.
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

export default apiClient;
