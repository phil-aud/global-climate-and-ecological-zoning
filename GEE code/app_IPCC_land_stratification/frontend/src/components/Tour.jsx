/**
 * Tour.jsx — first-visit guided overlay with animated, hand-drawn arrows.
 *
 * Each step:
 *   - dims the rest of the page (SVG mask spotlight on the target)
 *   - shows a centered tooltip box
 *   - draws an animated wavy arrow from the tooltip to the target
 *
 * Skipped or completed state is persisted in localStorage so the tour
 * only appears on the first visit. A small "Help" button is rendered
 * in the bottom-right corner so users can replay it any time.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import '../styles/Tour.css';

const STORAGE_KEY = 'ipcc_tour_seen_v1';

const STEPS = [
  {
    id: 'layers',
    selectors: ['[data-tour="layers"]'],
    title: 'Map layers',
    body:
      'Switch between global map layers: Climate Zones (GCZ), Ecological Zones (GEZ), Holdridge Life Zones — Level II & III (HLZII / HLZIII), and Soils.',
    arrowFrom: 'top',
  },
  {
    id: 'coords',
    selectors: ['[data-tour="coords"]'],
    title: 'Pick a location',
    body:
      'Pick a point on the map, or enter its longitude and latitude, to fetch data for that location.',
    arrowFrom: 'right',
  },
  {
    id: 'dataset',
    selectors: ['[data-tour="dataset"]'],
    title: 'Choose a dataset',
    body:
      'Choose the dataset used for map layers and point calculations.',
    arrowFrom: 'right',
  },
  {
    id: 'yearRange',
    selectors: ['[data-tour="yearRange"]'],
    title: 'Year range (optional)',
    body:
      'Optional. Choose the time period for GEZ, GCZ, and HLZ layers.\nNote: IPCC default emission factors were calculated for 1995–2024 (30-year period).',
    arrowFrom: 'right',
  },
  {
    id: 'data',
    selectors: ['[data-tour="tier"]', '[data-tour="soils"]'],
    title: 'Automatic data fetch',
    body:
      'After you select a point, its zones, bioecological data, and soil data are fetched automatically. The pyramids and altitudinal triangle show which GCZ, GEZ, and HLZ the point falls into based on its bioecological values.',
    arrowFrom: 'right',
  },
  {
    id: 'legend',
    selectors: ['[data-tour="legend"]'],
    title: 'Dynamic legend',
    body:
      'The legend updates to match the selected map layer. For a selected point, its zone is highlighted in bold.',
    arrowFrom: 'top',
  },
];

function unionRects(rects) {
  if (!rects.length) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const r of rects) {
    if (!r) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!isFinite(left)) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function getTargetRect(selectors) {
  const rects = [];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) rects.push(el.getBoundingClientRect());
  }
  return unionRects(rects);
}

export default function Tour({ forceOpen = false, onClose }) {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const tooltipRef = useRef(null);
  const [tooltipRect, setTooltipRect] = useState(null);

  // Open on first visit, or when explicitly forced.
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStepIdx(0);
      return;
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Slight delay so the layout settles (map + panels render first).
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch (_) { /* storage may be unavailable */ }
  }, [forceOpen]);

  const close = useCallback((markSeen = true) => {
    setOpen(false);
    if (markSeen) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) { /* ignore */ }
    }
    if (onClose) onClose();
  }, [onClose]);

  const step = STEPS[stepIdx];

  // Recompute target rect on step change, resize, or scroll.
  useLayoutEffect(() => {
    if (!open) return;
    function recompute() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      setTargetRect(getTargetRect(step.selectors));
      if (tooltipRef.current) setTooltipRect(tooltipRef.current.getBoundingClientRect());
    }
    recompute();
    // Allow layout to settle for a frame (e.g. after step change).
    const raf = requestAnimationFrame(recompute);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, stepIdx, step]);

  // Scroll the target into view (within its scroll container).
  useEffect(() => {
    if (!open) return;
    const el = document.querySelector(step.selectors[0]);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [open, stepIdx, step]);

  const handleNext = useCallback(() => {
    if (stepIdx >= STEPS.length - 1) close(true);
    else setStepIdx(stepIdx + 1);
  }, [stepIdx, close]);

  const handlePrev = useCallback(() => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }, [stepIdx]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') close(true);
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleNext, handlePrev, close]);

  const arrowPath = useMemo(() => {
    if (!targetRect || !tooltipRect) return null;
    // Start: nearest edge of the tooltip toward the target center.
    const tCenter = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
    const ttCenter = { x: tooltipRect.left + tooltipRect.width / 2, y: tooltipRect.top + tooltipRect.height / 2 };
    const dx = tCenter.x - ttCenter.x;
    const dy = tCenter.y - ttCenter.y;

    // Pick exit point on tooltip box facing target.
    let start;
    if (Math.abs(dx) > Math.abs(dy)) {
      start = {
        x: dx > 0 ? tooltipRect.right + 4 : tooltipRect.left - 4,
        y: ttCenter.y,
      };
    } else {
      start = {
        x: ttCenter.x,
        y: dy > 0 ? tooltipRect.bottom + 4 : tooltipRect.top - 4,
      };
    }

    // Pick anchor point on target rect closest to the start, with margin.
    const margin = 10;
    const end = {
      x: Math.max(targetRect.left - margin, Math.min(targetRect.right + margin, start.x)),
      y: Math.max(targetRect.top - margin, Math.min(targetRect.bottom + margin, start.y)),
    };
    // Snap end to the side facing the tooltip
    const distToLeft = Math.abs(start.x - (targetRect.left - margin));
    const distToRight = Math.abs(start.x - (targetRect.right + margin));
    const distToTop = Math.abs(start.y - (targetRect.top - margin));
    const distToBottom = Math.abs(start.y - (targetRect.bottom + margin));
    const minD = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    if (minD === distToLeft) end.x = targetRect.left - margin;
    else if (minD === distToRight) end.x = targetRect.right + margin;
    else if (minD === distToTop) end.y = targetRect.top - margin;
    else end.y = targetRect.bottom + margin;

    // Curved bezier path with a couple of "wobble" waypoints for a hand-drawn feel.
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    // Perpendicular offset for curvature
    const vx = end.x - start.x;
    const vy = end.y - start.y;
    const len = Math.hypot(vx, vy) || 1;
    const nx = -vy / len;
    const ny = vx / len;
    const curve = Math.min(80, len * 0.25);
    const c1 = { x: start.x + vx * 0.33 + nx * curve * 0.9, y: start.y + vy * 0.33 + ny * curve * 0.9 };
    const c2 = { x: start.x + vx * 0.66 + nx * curve * 0.4, y: start.y + vy * 0.66 + ny * curve * 0.4 };
    const path = `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;

    // Arrow head at end
    const tangentX = end.x - c2.x;
    const tangentY = end.y - c2.y;
    const tLen = Math.hypot(tangentX, tangentY) || 1;
    const tux = tangentX / tLen;
    const tuy = tangentY / tLen;
    const headLen = 14;
    const headSpread = 7;
    const headLeft = {
      x: end.x - tux * headLen - tuy * headSpread,
      y: end.y - tuy * headLen + tux * headSpread,
    };
    const headRight = {
      x: end.x - tux * headLen + tuy * headSpread,
      y: end.y - tuy * headLen - tux * headSpread,
    };
    const head = `M ${headLeft.x} ${headLeft.y} L ${end.x} ${end.y} L ${headRight.x} ${headRight.y}`;

    // approx length for stroke-dasharray
    const approxLen = len + curve;
    return { path, head, approxLen, start, end, mx, my };
  }, [targetRect, tooltipRect]);

  if (!open) return null;

  // Build mask: full white rect with a black "hole" over the target.
  const maskHole = targetRect
    ? {
        x: Math.max(0, targetRect.left - 8),
        y: Math.max(0, targetRect.top - 8),
        w: targetRect.width + 16,
        h: targetRect.height + 16,
      }
    : null;

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Guided tour">
      <svg className="tour-overlay-svg" width={viewport.w} height={viewport.h}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="white" />
            {maskHole && (
              <rect
                x={maskHole.x}
                y={maskHole.y}
                width={maskHole.w}
                height={maskHole.h}
                rx="10"
                ry="10"
                fill="black"
              />
            )}
          </mask>
          {/* Hand-drawn wobble filter */}
          <filter id="tour-wobble" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" />
          </filter>
        </defs>
        <rect
          className="tour-dim"
          x="0"
          y="0"
          width={viewport.w}
          height={viewport.h}
          fill="rgba(15, 23, 42, 0.55)"
          mask="url(#tour-spotlight-mask)"
        />
        {targetRect && (
          <rect
            className="tour-spotlight-outline"
            x={maskHole.x}
            y={maskHole.y}
            width={maskHole.w}
            height={maskHole.h}
            rx="10"
            ry="10"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeDasharray="6 5"
          />
        )}
        {arrowPath && (
          <g className="tour-arrow" filter="url(#tour-wobble)">
            <path
              key={`p-${stepIdx}`}
              d={arrowPath.path}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: arrowPath.approxLen,
                strokeDashoffset: arrowPath.approxLen,
                animation: 'tourDraw 700ms ease-out forwards',
              }}
            />
            <path
              key={`h-${stepIdx}`}
              d={arrowPath.head}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 60,
                strokeDashoffset: 60,
                animation: 'tourDraw 300ms ease-out 700ms forwards',
              }}
            />
          </g>
        )}
      </svg>

      <div className="tour-tooltip" ref={tooltipRef} key={`tt-${stepIdx}`}>
        <div className="tour-tooltip-header">
          <span className="tour-step-counter">Step {stepIdx + 1} of {STEPS.length}</span>
          <button className="tour-skip" onClick={() => close(true)} aria-label="Skip tour">Skip</button>
        </div>
        <h3 className="tour-tooltip-title">{step.title}</h3>
        <p className="tour-tooltip-body">{step.body}</p>
        <div className="tour-actions">
          <button
            className="tour-btn tour-btn--ghost"
            onClick={handlePrev}
            disabled={stepIdx === 0}
          >
            Back
          </button>
          <button className="tour-btn tour-btn--primary" onClick={handleNext}>
            {stepIdx === STEPS.length - 1 ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small floating button that re-opens the tour on demand. */
export function TourLauncher({ onOpen }) {
  return (
    <button className="tour-launcher" onClick={onOpen} aria-label="Show guided tour" title="Show guided tour">
      ?
    </button>
  );
}
