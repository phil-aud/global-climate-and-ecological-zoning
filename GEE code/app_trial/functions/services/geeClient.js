/**
 * GEE Client Service
 * Initializes and authenticates with Earth Engine API using service account
 */

const ee = require('@google/earthengine');

let isInitialized = false;

/**
 * Initialize Earth Engine with service account credentials.
 * Uses the full credentials JSON from GEE_SERVICE_ACCOUNT_KEY so that
 * project_id and all other fields are always populated, and passes the
 * project to ee.initialize() as required by the GEE REST API.
 * @param {string} privateKey - Service account private key (fallback if JSON unavailable)
 * @param {string} clientEmail - Service account client email (fallback)
 * @returns {Promise<void>}
 */
async function initializeEarthEngine(privateKey, clientEmail) {
  // Prefer the full credentials JSON so no fields are undefined
  let credentials;
  try {
    credentials = JSON.parse(process.env.GEE_SERVICE_ACCOUNT_KEY);
  } catch (e) {
    credentials = {
      type: 'service_account',
      private_key: privateKey,
      client_email: clientEmail,
    };
  }

  // Normalise escaped newlines that some env serialisers produce
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }

  // Pass the bare project ID — ee.initialize() prepends "projects/" internally
  const project = credentials.project_id || null;

  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      credentials,
      () => {
        try {
          ee.initialize(null, null, () => {
            isInitialized = true;
            resolve();
          }, (err) => {
            reject(new Error(`Earth Engine initialization failed: ${err}`));
          }, null, project);
        } catch (err) {
          reject(new Error(`Earth Engine initialization failed: ${err}`));
        }
      },
      (err) => {
        reject(new Error(`Earth Engine authentication failed: ${err}`));
      }
    );
  });
}

/**
 * Get initialized Earth Engine instance
 * @returns {object} Earth Engine module
 */
function getEarthEngine() {
  if (!isInitialized) {
    throw new Error('Earth Engine not initialized');
  }
  return ee;
}

/**
 * Parse service account credentials from environment
 * @returns {object} Parsed credentials
 */
function getServiceAccountCredentials() {
  let credentials;
  
  try {
    // Try to parse JSON string from env
    if (process.env.GEE_SERVICE_ACCOUNT_KEY) {
      credentials = JSON.parse(process.env.GEE_SERVICE_ACCOUNT_KEY);
    } else {
      // Or parse individual fields
      credentials = {
        private_key: process.env.GEE_PRIVATE_KEY || '',
        client_email: process.env.GEE_CLIENT_EMAIL || '',
      };
    }
  } catch (e) {
    throw new Error(`Failed to parse service account credentials: ${e.message}`);
  }

  if (!credentials.private_key || !credentials.client_email) {
    throw new Error('Missing GEE credentials in environment');
  }

  return credentials;
}

module.exports = {
  initializeEarthEngine,
  getEarthEngine,
  getServiceAccountCredentials,
};
