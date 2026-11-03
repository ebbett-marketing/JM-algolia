// star-filter.js — "N stars and up" picker for the EECA star ratings
// (Su-Anne via Josi, 24 Sep 2026): energy_economy_stars / carbon_emission_stars.
//
// The index stores the ratings as stars × 2 (0–12, half-star resolution, 0 =
// unrated), the same encoding cap_stock-meta halves for the product page's
// safety stars. Picking N here means "N stars or better", so the widget is a
// connectRange render that refines [N × step, undefined] — the URL therefore
// reads like every other range on the page (`energy_economy_stars=6:`), and
// Clear-all / chips work unchanged.
//
// Interaction: click a star to pick it, click the picked star again to clear;
// press-and-drag across the row (mouse or finger) previews and commits on
// release, so "drag up to 3 stars" works on a phone. Hover previews the pick
// (CSS, pointer devices only). Stars are real buttons: Tab + Enter/Space work.
//
// Contract with the connectRange render: `render({ start, range, refine })`
// on every render; `start` is the current refinement (±Infinity = open).

import { normalizeStart } from './range-slider.js';

export const STAR_CONFIG = {
  scale: 6, // EECA labels run 0.5–6 stars
  step: 2,  // index value per whole star
};

// The product template's star art (Webflow assets Start-Gold-Left/Right), as
// one inline star so it tints with currentColor: no image requests, and the
// hover/drag preview is a colour change.
const STAR_LEFT = 'm11.48,0c-.4,0-.79.2-1.01.57l-2.94,5.95-6.57.95c-.42.06-.77.36-.91.76h0c-.13.41-.02.85.28,1.15l4.76,4.64-1.12,6.55c-.04.24,0,.5.11.71.29.55.97.76,1.51.47l5.88-3.09V0Z';
const STAR_RIGHT = 'm0,18.67l5.88,3.09c.55.29,1.23.08,1.51-.47.12-.22.16-.47.11-.71l-1.12-6.55,4.76-4.64c.31-.3.42-.75.28-1.15h0c-.13-.41-.48-.7-.91-.76l-6.57-.95L1.01.57C.79.2.4,0,0,0v18.67Z';
export const STAR_SVG = `<svg viewBox="0 0 22.96 21.89" aria-hidden="true" focusable="false"><path class="wd-stars_half is-left" d="${STAR_LEFT}"/><path class="wd-stars_half is-right" transform="translate(11.48 0)" d="${STAR_RIGHT}"/></svg>`;

/** index value → whole stars for the picker (a 7 = 3.5-star car shows as 3+ when picked via ≥6) */
export function starsFromValue(value, step = STAR_CONFIG.step) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / step);
}

export function valueFromStars(stars, step = STAR_CONFIG.step) {
  return stars > 0 ? stars * step : undefined;
}

export function hintText(stars) {
  return stars > 0 ? `${stars}+ stars` : 'Any';
}

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * @param {HTMLElement} host   element the picker renders into (the filter placeholder)
 * @param {object} opts
 * @param {string} opts.name   'energy' | 'carbon' (data attribute)
 * @param {string} opts.label  aria wording, e.g. "energy economy rating"
 * @param {number} [opts.scale]
 * @param {number} [opts.step]
 */
export function createStarPicker(host, opts) {
  const { name, label, scale = STAR_CONFIG.scale, step = STAR_CONFIG.step } = opts;
  let selected = 0;   // whole stars, 0 = Any
  let refine = null;
  let preview = null; // stars under the pointer while dragging
  let dragged = false;

  const root = el('div', 'wd-stars', { 'data-wd-stars': name, role: 'group', 'aria-label': `Minimum ${label}` });
  const row = el('div', 'wd-stars_row');
  const stars = [];
  for (let i = 1; i <= scale; i += 1) {
    const btn = el('button', 'wd-stars_star', { type: 'button', 'data-stars': String(i), 'aria-pressed': 'false', 'aria-label': `${i} ${i === 1 ? 'star' : 'stars'} and up` });
    btn.innerHTML = STAR_SVG;
    stars.push(btn);
    row.appendChild(btn);
  }
  const hint = el('span', 'wd-stars_hint', { 'aria-live': 'polite' });
  root.append(row, hint);
  host.appendChild(root);

  function paint() {
    const shown = preview ?? selected;
    stars.forEach((btn, i) => {
      btn.classList.toggle('is-on', i < selected);
      btn.classList.toggle('is-preview', preview !== null && i < preview);
      btn.setAttribute('aria-pressed', i + 1 === selected ? 'true' : 'false');
    });
    row.classList.toggle('is-dragging', preview !== null);
    root.classList.toggle('is-refined', selected > 0);
    hint.textContent = hintText(shown);
  }

  function commit(next) {
    const value = next === selected ? 0 : next; // same star again = clear
    selected = value;
    paint();
    if (refine) refine([valueFromStars(selected, step), undefined]);
  }

  // stars under a pointer x: the star whose box the x is in or to the right of;
  // left of the first star (only reachable mid-drag) = Any
  function starsAtX(x) {
    let n = 0;
    stars.forEach((btn, i) => { if (x >= btn.getBoundingClientRect().left) n = i + 1; });
    return n;
  }

  row.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragged = false;
    preview = starsAtX(e.clientX);
    try { row.setPointerCapture(e.pointerId); } catch (err) { /* capture unsupported */ }
    paint();
  });
  row.addEventListener('pointermove', (e) => {
    if (preview === null) return;
    const n = starsAtX(e.clientX);
    if (n !== preview) { dragged = true; preview = n; paint(); }
  });
  const release = (e) => {
    if (preview === null) return;
    const n = dragged ? preview : starsAtX(e.clientX);
    preview = null;
    if (dragged) { selected = n; paint(); if (refine) refine([valueFromStars(selected, step), undefined]); }
    else commit(n);
    dragged = false;
  };
  row.addEventListener('pointerup', release);
  row.addEventListener('pointercancel', () => { preview = null; dragged = false; paint(); });
  // keyboard activation (Enter/Space) fires click with detail 0; pointer clicks are handled above
  row.addEventListener('click', (e) => {
    const btn = e.target.closest('.wd-stars_star');
    if (!btn) return;
    e.preventDefault();
    if (e.detail === 0) commit(Number(btn.dataset.stars));
  });

  return {
    root,
    /** current: [min|undefined, max|undefined] in index units */
    update(current, nextRefine) {
      refine = nextRefine;
      const [min] = current || [];
      selected = Math.min(starsFromValue(min, step), scale);
      paint();
    },
    state() { return { selected, scale, step }; },
  };
}

/**
 * Wire a picker to a connectRange render. Returns `{ render, picker }`;
 * a missing host renders nothing (page without the mount).
 */
export function createStarFilterWidget(host, opts) {
  if (!host) return { render: () => {}, picker: null };
  // the Webflow placeholder is a fixed 2.5rem (select height); tags.css lets a
  // .wd-stars-host placeholder grow with the row + hint
  host.closest('.ais_filter-wrapper')?.classList.add('wd-stars-host');
  let picker = null;
  const render = (renderOptions) => {
    const { start, refine } = renderOptions;
    if (!picker) picker = createStarPicker(host, opts);
    picker.update(normalizeStart(start), refine);
  };
  return { render, get picker() { return picker; } };
}
