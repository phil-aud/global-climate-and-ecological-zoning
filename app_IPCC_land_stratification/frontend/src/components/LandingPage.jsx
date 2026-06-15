/**
 * Landing / Cover page shown before the main app.
 */

import React from 'react';
import './LandingPage.css';

export default function LandingPage({ onEnter }) {
  return (
    <div className="landing-root">
      <div className="landing-bg" aria-hidden="true" />
      <div className="landing-overlay" aria-hidden="true" />

      <main className="landing-card">
        <div className="landing-badge">IPCC · Tier 1</div>

        <h1 className="landing-title">
          IPCC Land Stratification for NGGI
        </h1>

        <p className="landing-lead">
          This application supports the land stratification used by inventory
          compilers under the IPCC Tier&nbsp;1 approach, following Volume&nbsp;4,
          Chapter&nbsp;3 of the IPCC Guidelines.
        </p>

        <p className="landing-sub">
          It was developed in the context of the 2027 IPCC Methodology Report
          on Inventories for Short-lived Climate Forcers.
        </p>

        <button
          type="button"
          className="landing-cta"
          onClick={onEnter}
        >
          Go to the app
          <span className="landing-cta-arrow" aria-hidden="true">→</span>
        </button>
      </main>

      <footer className="landing-footer">
        Land stratification with Global Climate and Ecological Zones and Soil types
      </footer>
    </div>
  );
}
