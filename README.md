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

## Data availability

The published GIS map products (GCZ, GEZ and HLZ layers as GeoTIFFs and shapefiles,
for the CRU TS 4.09 and TerraClimate climatologies, 1995–2024) are archived on
Zenodo and can be downloaded directly with no account required:

**DOI: [10.5281/zenodo.20715275](https://doi.org/10.5281/zenodo.20715275)**

The layers are also linked per-product from within the app under
**Explorer → Data & Downloads**. The record additionally bundles the companion
IPCC major soil types map ([Sinitambirivoutin et al. 2024](https://doi.org/10.1016/j.catena.2024.108258)).

## Background

The app builds on a globally consistent ecological zoning approach based on Holdridge life zones, and a Global Climate Zone (GCZ) map with an exact correspondence to the Global Ecological Zones (GEZ). For the full scientific methodology and the underlying map products, please consult the associated paper or contact the author.

## Contact

For issues or questions, contact the project owner.
