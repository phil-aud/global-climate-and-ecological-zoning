# Standalone GEE Web App - Setup & Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Firebase CLI: `npm install -g firebase-tools`
- Google Cloud project with Firebase enabled
- GEE service account JSON key

### Setup Steps

#### 1. Clone/Extract Project
```bash
cd standalone-app
```

#### 2. Install Dependencies

**Backend (Firebase Functions):**
```bash
cd functions
npm install
```

**Frontend (React):**
```bash
cd ../frontend
npm install
cd ..
```

#### 3. Configure Environment Variables

**Firebase Functions** (`functions/.env`):
```bash
# Copy and edit .env.example
cp functions/.env.example functions/.env
```

Add your GEE service account credentials:
```
GEE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

Or set individual fields:
```
GEE_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
GEE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GEE_PROJECT_ID=your-gcp-project
GEE_CLIENT_ID=...
GEE_PRIVATE_KEY_ID=...
GEE_CLIENT_X509_CERT_URL=...
```

**Frontend** (`frontend/.env`):
```bash
cp frontend/.env.example frontend/.env
```

For local development with emulator:
```
REACT_APP_API_URL=http://localhost:5001/your-project-id/us-central1
```

#### 4. Initialize Firebase

```bash
firebase init
```
- Select your Firebase project
- Use existing config (firebase.json already set up)

### Development (Local)

#### Option A: Run Separately

**Terminal 1 - Firebase Functions Emulator:**
```bash
firebase emulators:start --only functions
```

**Terminal 2 - React Dev Server:**
```bash
cd frontend
npm start
```

Visit `http://localhost:3000`

**Note:** Update `frontend/.env` to point to emulator:
```
REACT_APP_API_URL=http://localhost:5001/your-project-id/us-central1
```

#### Option B: Run Both Together

```bash
firebase emulators:start
```

This runs all emulators (functions, hosting, etc.)

### Troubleshooting Development

**Port 5001 already in use:**
```bash
lsof -ti:5001 | xargs kill -9
```

**Port 3000 already in use:**
```bash
lsof -ti:3000 | xargs kill -9
```

**Functions not connecting:**
- Ensure emulator is running
- Check `.env` has `REACT_APP_API_URL` pointing to emulator
- Verify CORS is enabled in functions (it is by default)

### Production Deployment

#### 1. Update GEE Asset Paths

In `functions/handlers/queryZones.js`, update asset paths to your GEE project:
```javascript
const hlzIII = ee.Image('projects/YOUR-PROJECT/assets/HoldridgeLifeZones/...');
const hlzII = ee.Image('projects/YOUR-PROJECT/assets/HoldridgeLifeZones/...');
const gez = ee.Image('projects/YOUR-PROJECT/assets/HoldridgeLifeZones/...');
const gcz = ee.Image('projects/YOUR-PROJECT/assets/HoldridgeLifeZones/...');
```

Do the same for CRU TS paths in other handlers.

#### 2. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

This creates `frontend/build/` directory.

#### 3. Deploy to Firebase

```bash
# Deploy everything
firebase deploy

# Or selectively
firebase deploy --only functions
firebase deploy --only hosting
```

Monitor the deployment in Firebase Console.

#### 4. Update Frontend API URL

After deployment, update production API URL in `frontend/.env`:
```
REACT_APP_API_URL=https://us-central1-your-project-id.cloudfunctions.net
```

Then rebuild and redeploy:
```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

### Monitoring & Logs

**View function logs:**
```bash
firebase functions:log
```

**Or in Firebase Console:**
- Cloud Functions → Click function → Logs tab

**Common Issues:**

| Issue | Solution |
|-------|----------|
| `Earth Engine not initialized` | Verify service account credentials in `.env` |
| `Missing GEE_SERVICE_ACCOUNT_KEY` | Check env vars in Cloud Functions settings |
| `Assets not found` | Update asset paths to match your GEE project |
| `Timeout` | GEE queries can take 2–5 seconds; check API quota |
| `CORS errors` | CORS already enabled in functions/index.js |

### Customization

#### Change Map Tiles
In `frontend/src/components/MapComponent.jsx`, modify the TileLayer URL to use different basemap (default: OpenStreetMap)

#### Add GEZ/GCZ/HLZ Overlays
Follow TODOs in MapComponent.jsx to add raster tiles from GEE. Options:
1. Export as Cloud-optimized GeoTIFFs from GEE
2. Use GEE tiles endpoint (requires additional setup)
3. Pre-compute statistics and serve as vector tiles (Protomaps, tippecanoe, etc.)

#### Adjust Colors & Styling
- Zone colors: `frontend/src/styles/App.css`
- Map styles: `frontend/src/components/MapComponent.css`
- Chart colors: `frontend/src/components/Chart.jsx`

### GEE Data Licensing & Attribution

- **CRU TS 4.09**: Cite Harris et al. (2020)
- **USGS GTOPO30**: Public domain, cite USGS
- **Custom HLZ/GEZ/GCZ assets**: Check your project licensing

### Performance Optimization

**Current bottlenecks:**
- GEE queries: 2–5 seconds per click
- Cold starts: ~5 seconds on first deploy
- Large raster rendering: Depends on tile resolution

**Optimization strategies (future):**
- Cache common queries in Firestore
- Use indexed vector data for faster lookups
- Implement request batching
- Compress raster tiles (WebP/AVIF)
- Add service worker for offline capability

### Contact & Support

For issues:
1. Check Firebase console logs
2. Verify GEE service account permissions
3. Confirm asset paths are correct
4. Review this guide's troubleshooting section
