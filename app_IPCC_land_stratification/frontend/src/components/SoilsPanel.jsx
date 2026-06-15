import React from 'react';

function SoilsPanel({ coords, zoneData }) {
  return (
    <div className="zone-panel">
      <div className="panel-title">
        <span className="tier-badge">Tier 1</span>
        <span className="tier-label subsubtitle">IPCC Soil category</span>
      </div>

      <p className="panel-desc">
        The Harmonized World Soil Database (HWSD) 2.0 was used to derive the 6 IPCC major soil types. The raster can be downloaded here: <a href="https://github.com/phil-aud/IPCCSoils" target="_blank" rel="noopener noreferrer">https://github.com/phil-aud/IPCCSoils</a>
      </p>

      <div className="zone-results">
        <div className="zone-row zone-row--highlight">
          <div className="zone-label">IPCC Soil</div>
          <div className="zone-value">
            {zoneData?.soil?.label ?? '—'} {zoneData?.soil?.value ? `(${zoneData.soil.value})` : ''}
          </div>
        </div>
      </div>

      <div className="panel-sources">
        <p className="sources-title">Sources</p>
        <ul>
          <li>
            Sinitambirivoutin, M., Milne, E., Schiettecatte, L.-S., Tzamtzis, I., et al. (2024). An updated IPCC major soil types map derived from the harmonized world soil database v2.0. <em>CATENA</em>, 244, 108258.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default SoilsPanel;
