/**
 * Figure export helpers
 *
 * Shared utilities for downloading the app's graphs/figures as PNG images and
 * their underlying data as CSV. No external dependencies — PNGs are produced
 * with native canvas APIs:
 *   - Chart.js charts        → downloadChartPNG  (uses the live <canvas>)
 *   - SVG-over-image figures → downloadCompositePNG (draws img + SVG overlay)
 *   - tabular data           → downloadCSV
 */

// Programmatically trigger a browser download for a given URL.
function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function withExt(filename, ext) {
  return filename.toLowerCase().endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}

// Escape a single CSV field per RFC 4180.
function csvField(value) {
  if (value == null) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Download tabular data as a CSV file.
 * @param {string} filename  base name (".csv" appended if missing)
 * @param {Array<string>} headers  column headers (pass null/[] to omit)
 * @param {Array<Array>} rows  array of row arrays
 */
export function downloadCSV(filename, headers, rows) {
  const lines = [];
  if (headers && headers.length) lines.push(headers.map(csvField).join(','));
  (rows || []).forEach((r) => lines.push((r || []).map(csvField).join(',')));
  // Prepend a UTF-8 BOM so Excel reads °C and other non-ASCII characters correctly.
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, withExt(filename, 'csv'));
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Download a Chart.js chart as a PNG (flattened onto a solid background so the
 * normally-transparent canvas looks right in image viewers / documents).
 * @param {{current: import('chart.js').Chart}} chartRef  ref to the chart instance
 * @param {string} filename  base name (".png" appended if missing)
 */
export function downloadChartPNG(chartRef, filename, { background = '#ffffff' } = {}) {
  const chart = chartRef && chartRef.current;
  if (!chart || !chart.canvas) return;
  const src = chart.canvas;
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(src, 0, 0);
  triggerDownload(out.toDataURL('image/png'), withExt(filename, 'png'));
}

/**
 * Download a "composite" figure (a background <img> with an absolutely
 * positioned inline <svg> overlay, or a standalone <svg>) as a PNG.
 *
 * The background image and the overlay share a coordinate system (the overlay
 * viewBox matches the image's intrinsic size with preserveAspectRatio), so both
 * are drawn into a canvas sized to that viewBox and they align exactly.
 *
 * @param {HTMLElement} container  element containing the <img> and/or <svg>
 * @param {string} filename  base name (".png" appended if missing)
 */
export function downloadCompositePNG(container, filename, { scale = 2, background = '#ffffff' } = {}) {
  if (!container) return;
  const matches = (el, sel) => el.matches && el.matches(sel);
  const img = matches(container, 'img') ? container : container.querySelector('img');
  const svg = matches(container, 'svg') ? container : container.querySelector('svg');

  // Base dimensions: prefer the SVG viewBox, fall back to the image's natural size.
  let baseW;
  let baseH;
  const vb = svg && svg.viewBox && svg.viewBox.baseVal;
  if (vb && vb.width && vb.height) {
    baseW = vb.width;
    baseH = vb.height;
  } else if (img && img.naturalWidth) {
    baseW = img.naturalWidth;
    baseH = img.naturalHeight;
  } else {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(baseW * scale);
  canvas.height = Math.round(baseH * scale);
  const ctx = canvas.getContext('2d');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const finish = () => {
    let url;
    try {
      url = canvas.toDataURL('image/png');
    } catch (e) {
      // Canvas got tainted (e.g. an SVG referencing external resources) — bail
      // out gracefully rather than throwing in the UI.
      return;
    }
    triggerDownload(url, withExt(filename, 'png'));
  };

  const drawOverlayAndFinish = () => {
    if (!svg) {
      finish();
      return;
    }
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', baseW);
    clone.setAttribute('height', baseH);
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const xml = new XMLSerializer().serializeToString(clone);
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    const overlay = new Image();
    overlay.onload = () => {
      ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
      finish();
    };
    overlay.onerror = () => finish();
    overlay.src = svgUrl;
  };

  if (img && img.src) {
    // Redraw from a fresh Image so we don't depend on the on-screen element's
    // decode state. Same-origin (public/) asset → canvas stays untainted.
    const bg = new Image();
    bg.onload = () => {
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
      drawOverlayAndFinish();
    };
    bg.onerror = () => drawOverlayAndFinish();
    bg.src = img.src;
  } else {
    drawOverlayAndFinish();
  }
}
