# Standalone GEE Web App

A web application for querying Global Climate & Ecological Zones, built with React frontend and Firebase Cloud Functions backend.

## Architecture

- **Frontend**: React + Leaflet (map & UI)
- **Backend**: Firebase Cloud Functions (calls GEE API server-side)
- **Data**: Your GEE assets (HLZ, GEZ, GCZ, CRU TS)
- **Hosting**: Firebase Hosting + Cloud Functions

## Setup

### Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Google Cloud project with Firebase enabled
- GEE service account JSON key

### Installation

1. **Clone/extract** this project
2. **Install dependencies**:
   ```bash
   cd functions && npm install
   cd ../frontend && npm install
   cd ..
   ```

3. **Configure Firebase**:
   ```bash
   firebase login
   firebase init
   ```
   Select your Firebase project when prompted.

4. **Add service account credentials**:
   - Download GEE service account JSON from your GCP project
   - In Firebase Console → Project Settings → Service Accounts → Generate new private key
   - Store securely; add to Cloud Secrets Manager or as environment variable in `functions/.env`
   ```bash
   # functions/.env
   GEE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
   ```

### Development

**Local testing with emulator**:
```bash
firebase emulators:start
```

Then in another terminal:
```bash
cd frontend
npm start
```

Visit `http://localhost:3000`

### Deployment

```bash
# Deploy functions and hosting
firebase deploy
```

Or selectively:
```bash
firebase deploy --only functions
firebase deploy --only hosting
```

## Project Structure

```
standalone-app/
├── functions/              # Firebase Cloud Functions (Node.js)
│   ├── handlers/          # Query function implementations
│   ├── services/          # GEE client setup
│   ├── utils/             # Label maps, helpers
│   ├── index.js           # Functions entry point
│   └── package.json
├── frontend/              # React app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # API client, helpers
│   │   ├── styles/        # CSS
│   │   ├── App.jsx
│   │   └── index.jsx
│   ├── public/
│   └── package.json
├── firebase.json
└── README.md
```

## API Endpoints

All endpoints are Firebase Cloud Functions, called from frontend:

- `queryZones(lon, lat)` → `{gcz, gez, hlzII, hlzIII, labels}`
- `getMonthlyClimate(lon, lat, startYear, endYear)` → `[{month, temp, precip}]`
- `getAnnualSummary(lon, lat, startYear, endYear)` → `{mat, map}`
- `getBioecologicalData(lon, lat, startYear, endYear)` → `{biotemperature, precipitation, petRatio, elevation}`

## Data Sources

- **HLZ/GEZ/GCZ**: Your GEE project assets
- **Temperature/Precipitation**: CRU TS 4.09 (1901–2024)
- **Elevation**: USGS GTOPO30

## Troubleshooting

### Functions timeout
- GEE queries can take 2–5 seconds. Firebase has a default 60-second timeout (should be sufficient).
- If recurring timeouts, check GEE API quota.

### Cold starts
- First invocation after deployment may take 5–10 seconds. Normal for serverless.
- Consider warming up with scheduled triggers if acceptable latency is critical.

### Service account permission errors
- Ensure service account has "Compute Engine" and "Earth Engine" API roles in GCP.
- Verify account is authorized in your GEE project settings.

## License & Attribution

- CRU TS data: Harris et al. (2020). Cite appropriately.
- Custom HLZ assets: Check your project licensing.

## Contact

For issues or questions, contact the project owner.
