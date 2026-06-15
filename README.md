# IPCC Land Stratification App

A web application for exploring Global Climate Zones (GCZ) and Global Ecological / Holdridge Life Zones (GEZ/HLZ) anywhere on Earth.

**Live app:** https://ipcc-land-stratification-for-nggi.web.app

Click any location to query its climate and ecological zone classification, monthly climate, and bioecological indicators, derived from Holdridge Life Zones using CRU TS climate data and USGS elevation.

## Repository contents

This repository contains the source code for the app, located in
[`app_IPCC_land_stratification/`](app_IPCC_land_stratification/):

- **`frontend/`** — React + Leaflet map and UI
- **`functions/`** — Firebase Cloud Functions backend (calls the Google Earth Engine API server-side)

See the [app README](app_IPCC_land_stratification/README.md) for setup, development, deployment, and API details.

## Tech stack

- **Frontend:** React + Leaflet
- **Backend:** Firebase Cloud Functions + Google Earth Engine
- **Data:** Holdridge Life Zone assets, CRU TS 4.09 (1901–2024), USGS GTOPO30 elevation
- **Hosting:** Firebase Hosting

## Background

The app builds on a globally consistent ecological zoning approach based on Holdridge life zones, and a Global Climate Zone (GCZ) map with an exact correspondence to the Global Ecological Zones (GEZ). For the full scientific methodology and the underlying map products, please consult the associated paper or contact the author.

## Contact

For issues or questions, contact the project owner.
