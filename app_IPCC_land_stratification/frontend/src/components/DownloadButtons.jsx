/**
 * DownloadButtons
 * A single download (⤓) control shown next to a figure's maximise button.
 * Hovering (or keyboard-focusing) the control reveals a dropdown to pick the
 * export format. Pass only the handlers that apply (e.g. CSV-only for tables).
 *
 * `stopEvents` should be true when the control lives inside a <summary> (or any
 * element whose default click behaviour, like toggling <details>, must not fire).
 */
import React from 'react';

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 3v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 10.5 12 15l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 17v1.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DownloadButtons({ onPng, onCsv, label = 'figure', stopEvents = false }) {
  if (!onPng && !onCsv) return null;

  const guard = (e) => {
    if (stopEvents) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const handle = (fn) => (e) => {
    guard(e);
    fn();
  };

  return (
    <span className="hlz-download-menu">
      <button
        type="button"
        className="hlz-maximize-btn hlz-download-trigger"
        onClick={guard}
        title="Download"
        aria-label={`Download ${label}`}
        aria-haspopup="true"
      >
        <DownloadIcon />
      </button>
      <div className="hlz-download-dropdown" role="menu" aria-label={`Download ${label} as…`}>
        {onPng && (
          <button type="button" role="menuitem" onClick={handle(onPng)}>PNG image</button>
        )}
        {onCsv && (
          <button type="button" role="menuitem" onClick={handle(onCsv)}>CSV data</button>
        )}
      </div>
    </span>
  );
}

export default DownloadButtons;
