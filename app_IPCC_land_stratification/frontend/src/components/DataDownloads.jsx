/**
 * DataDownloads
 * Offers the published GIS products as GeoTIFF rasters (the authoritative format):
 * the GCZ / GEZ / HLZ layers for the selected climatology plus the global IPCC
 * soil map. Shapefile (.zip) versions and the full archive are reached via the
 * linked Zenodo record. Direct file URLs, no account required; heavy files are
 * not bundled with the app — see utils/dataProducts.js.
 */
import React from 'react';
import {
  DATA_PRODUCTS,
  DATA_PUBLISHED,
  SOIL_PRODUCT,
  ZENODO_DOI,
  ZENODO_DOI_URL,
  ZENODO_RECORD_URL,
  fileUrl,
} from '../utils/dataProducts';

function DownloadGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 3v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 10.5 12 15l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 17v1.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FormatLink({ filename, children }) {
  if (!DATA_PUBLISHED) {
    return (
      <span className="data-dl-link data-dl-link--disabled" aria-disabled="true">
        <DownloadGlyph /> {children}
      </span>
    );
  }
  return (
    <a className="data-dl-link" href={fileUrl(filename)} target="_blank" rel="noopener noreferrer">
      <DownloadGlyph /> {children}
    </a>
  );
}

function DataDownloads({ dataset = 'cru' }) {
  const group = DATA_PRODUCTS[dataset] || DATA_PRODUCTS.cru;

  return (
    <div className="zone-panel data-downloads">
      <div className="panel-title">
        <span className="tier-badge tier-badge--b">Data</span>
        <span className="tier-label subsubtitle">Download data products</span>
      </div>

      <p className="panel-desc">
        Download the underlying GeoTIFF rasters for the maps contained in the app.
        The rasters are showing the <strong>{group.label}</strong> climatology
        together with the IPCC soil map.
      </p>

      {!DATA_PUBLISHED && (
        <div className="data-dl-notice">
          Downloads will be available here once the dataset DOI is published.
        </div>
      )}

      <div className="zone-results">
        {group.products.map((p) => (
          <div className="zone-row data-dl-row" key={p.key}>
            <div className="zone-label data-dl-name">{p.name}</div>
            <div className="zone-value data-dl-actions">
              <FormatLink filename={p.tif}>GeoTIFF</FormatLink>
            </div>
          </div>
        ))}
        <div className="zone-row data-dl-row" key={SOIL_PRODUCT.key}>
          <div className="zone-label data-dl-name">{SOIL_PRODUCT.name}</div>
          <div className="zone-value data-dl-actions">
            <FormatLink filename={SOIL_PRODUCT.tif}>GeoTIFF</FormatLink>
          </div>
        </div>
      </div>

      <p className="panel-desc data-dl-cite">
        {DATA_PUBLISHED ? (
          <>
            Shapefile (.zip) versions, legends and all files:{' '}
            <a href={ZENODO_RECORD_URL} target="_blank" rel="noopener noreferrer">Zenodo record</a>
            {' · '}
            Cite: <a href={ZENODO_DOI_URL} target="_blank" rel="noopener noreferrer">{ZENODO_DOI}</a>
          </>
        ) : (
          <>The full dataset (both climatologies, legends and metadata) will be deposited as a single Zenodo record.</>
        )}
      </p>
    </div>
  );
}

export default DataDownloads;
