// cap_stock-meta — stock meta on the ecomm product template (/product/*):
// views count + "Added X days ago" + safety stars, filled from the Algolia
// `stock` record.
//
// Data path: the trailing numeric segment of the /product/ slug IS the record's
// objectID (Autoplay/elsp listing ID), so this is a single read-only getObject —
// no search query, no InstantSearch, no dependencies.
//
// Miss-handling is a feature, not an edge case: sold/delisted vehicles are
// DELETED from the index, so a 404 (or non-Active status) means render nothing.
// Nothing is authored in Webflow for this module — no markup exists until a
// record is found, so a miss leaves the page byte-identical to before.
//
// Load (Webflow vehicle template custom code):
//   <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ebbett-marketing/JM-algolia@<version>/client/cap_stock-meta/meta.css">
//   <script type="module" src="https://cdn.jsdelivr.net/gh/ebbett-marketing/JM-algolia@<version>/client/cap_stock-meta/meta.js"></script>

import { ALGOLIA, INDICES } from '../config.js';

export const DEFAULT_META_CONFIG = {
  appId: ALGOLIA.appId,
  searchKey: ALGOLIA.searchKey, // search-only key — public by design (client/config.js)
  indexName: INDICES.stock,
  headerSelector: '.stock_detail-header',
  activeOnly: true, // sold pages already carry a SOLD banner; meta would be noise
  viewsDisplayFloor: 1, // show any view count (Su-Anne 2026-10-07); 0 stays hidden (matches card)
  addedMaxDays: 29, // hide "Added X days ago" entirely beyond this (Josi 2026-07-30)
  viewsTooltip: 'Times this listing has been viewed', // confirmed Josi 2026-07-30
  safetySelector: '[ais-item="safety-stars"]', // Webflow-authored star block (Adam 2026-08-05)
  safetyStarScale: 5, // authored star slots per block (ANCAP is out of 5)
  safetyTextSelector: '#safety-stars', // authored "X stars" line (Josi 2026-08-05) — filled with the /2 value
};

// Same Material Symbols eye as the stock-card views slot (currentColor).
const EYE_SVG =
  '<svg fill="currentColor" viewBox="0 -960 960 960" aria-hidden="true"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Z"/></svg>';

// /inventory/2025-Toyota-RAV4-3862366 -> "3862366". Requires the /inventory/
// base (or the legacy /product/ base it replaced on Ebbett 3.0 — EM-184) and
// a 4+ digit trailing segment so model names ending in a digit (CX-5,
// Series-3) never false-match. Null when the path is not a vehicle listing.
export function parseListingId(pathname) {
  const m = /^\/(?:inventory|product)\/[^/]+-(\d{4,})\/?$/.exec(pathname || '');
  return m ? m[1] : null;
}

// Read-only getObject. Returns the record, or null on 404/network failure —
// callers treat every null identically (render nothing).
export async function fetchStockRecord(id, config = DEFAULT_META_CONFIG) {
  const attrs = 'pageViews,autoplay_created_date,status,safety_stars';
  const url =
    `https://${config.appId}-dsn.algolia.net/1/indexes/${config.indexName}/${id}` +
    `?attributesToRetrieve=${encodeURIComponent(attrs)}` +
    `&x-algolia-application-id=${config.appId}&x-algolia-api-key=${config.searchKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function formatViews(pageViews, config = DEFAULT_META_CONFIG) {
  const views = Number(pageViews) || 0;
  return views >= config.viewsDisplayFloor ? views.toLocaleString() : null;
}

export function formatAddedAgo(iso, nowMs, config = DEFAULT_META_CONFIG) {
  const added = Date.parse(iso ?? '');
  if (Number.isNaN(added)) return null;
  const days = Math.max(0, Math.floor((nowMs - added) / 86400000));
  if (days > config.addedMaxDays) return null; // stale = say nothing (Josi 2026-07-30)
  if (days === 0) return 'Added today';
  if (days === 1) return 'Added yesterday';
  return `Added ${days} days ago`;
}

// Build the meta row for one record. Null when neither piece has anything to
// say (below views floor AND no usable date) — callers skip injection entirely.
export function buildStockMeta(record, config = DEFAULT_META_CONFIG, ctx = {}) {
  const doc = ctx.document ?? document;
  const now = ctx.now ?? Date.now();
  const viewsText = formatViews(record.pageViews, config);
  const addedText = formatAddedAgo(record.autoplay_created_date, now, config);
  if (!viewsText && !addedText) return null;

  const wrap = doc.createElement('div');
  wrap.className = 'wd-stock-meta';

  if (addedText) {
    const added = doc.createElement('span');
    added.className = 'wd-meta-added';
    added.textContent = addedText;
    wrap.appendChild(added);
  }
  if (viewsText) {
    const views = doc.createElement('span');
    views.className = 'wd-meta-views wd-has-tooltip';
    const icon = doc.createElement('span');
    icon.className = 'wd-meta-views_icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = EYE_SVG;
    const count = doc.createElement('span');
    count.className = 'wd-meta-views_count';
    count.textContent = viewsText;
    const tooltip = doc.createElement('span');
    tooltip.className = 'wd-tooltip';
    tooltip.textContent = config.viewsTooltip;
    views.append(icon, count, tooltip);
    wrap.appendChild(views);
  }
  return wrap;
}

// Fill every header instance (the template has desktop + mobile variants).
// Idempotent: an existing .wd-stock-meta is replaced, never duplicated.
export function renderStockMeta(record, config = DEFAULT_META_CONFIG, ctx = {}) {
  const doc = ctx.document ?? document;
  const headers = doc.querySelectorAll(config.headerSelector);
  let filled = 0;
  headers.forEach((header) => {
    header.querySelectorAll(':scope > .wd-stock-meta').forEach((el) => el.remove());
    const meta = buildStockMeta(record, config, ctx);
    if (meta) {
      header.appendChild(meta);
      filled += 1;
    }
  });
  return filled;
}

// safety_stars is 0–10 in the index (10 = the "5 Safety Stars" filter value),
// so stars = value / 2 — halves fall out naturally (7 → 3.5). Null when the
// record has no usable rating; the authored block then stays hidden.
export function safetyStarsValue(raw, config = DEFAULT_META_CONFIG) {
  const stars = Number(raw) / 2;
  if (!Number.isFinite(stars) || stars <= 0) return null;
  return Math.min(stars, config.safetyStarScale);
}

// Fill the Webflow-authored safety star block(s). Authored contract: the
// wrapper holds 4 imgs per star in DOM order goldL, goldR, greyL, greyR —
// the same structure the CMS conditional-visibility star blocks publish;
// this module just toggles .wd-star-hidden instead of CMS conditions
// (Adam 2026-08-05: skip conditional visibility, use a lightweight function).
export function renderSafetyStars(record, config = DEFAULT_META_CONFIG, ctx = {}) {
  const doc = ctx.document ?? document;
  const stars = safetyStarsValue(record?.safety_stars, config);
  let filled = 0;
  doc.querySelectorAll(config.safetySelector).forEach((root) => {
    const icons = root.querySelectorAll('.component_stars_wrapper img');
    // The authored block is 4 imgs per star (goldL, goldR, greyL, greyR) x scale. Fewer than
    // that (CMS conditional visibility stripped some at publish, 15 Sep 2026) would scramble
    // the index-based toggle, so leave the block alone. MORE than that (a duplicated star,
    // 16 Sep 2026: 24 imgs published) is tolerated: the first scale*4 imgs are the stars,
    // the rest are hidden.
    const need = config.safetyStarScale * 4;
    if (stars === null || icons.length < need) {
      root.classList.remove('wd-stars-filled');
      return;
    }
    icons.forEach((img, i) => {
      if (i >= need) { img.classList.add('wd-star-hidden'); return; }
      const star = Math.floor(i / 4) + 1;
      const role = i % 4; // 0 goldL, 1 goldR, 2 greyL, 3 greyR
      const on =
        role === 0 ? stars >= star - 0.5 :
        role === 1 ? stars >= star :
        role === 2 ? stars < star - 0.5 :
                     stars < star;
      img.classList.toggle('wd-star-hidden', !on);
    });
    // "X stars" line (Webflow CMS stores the 0–10 value, so the /2 number
    // comes from here rather than a second conversion script — Josi's call).
    const textEl = root.querySelector(config.safetyTextSelector);
    if (textEl) textEl.textContent = `${stars} ${stars === 1 ? 'star' : 'stars'}`;
    root.classList.add('wd-stars-filled');
    filled += 1;
  });
  return filled;
}

export async function initStockMeta(config = DEFAULT_META_CONFIG, ctx = {}) {
  const doc = ctx.document ?? document;
  const pathname = ctx.pathname ?? location.pathname;
  const id = parseListingId(pathname);
  if (!id || !doc.querySelector(config.headerSelector)) return 0;
  const record = await fetchStockRecord(id, config);
  if (!record) return 0;
  if (config.activeOnly && record.status !== 'Active') return 0;
  renderSafetyStars(record, config, ctx);
  return renderStockMeta(record, config, ctx);
}

// Auto-init on real pages; harness/tests set __WD_STOCK_META_MANUAL first and
// drive the exports directly. Snapshot paths (/product-rav4/) never match
// parseListingId, so a stray auto-init in the harness is a guaranteed no-op.
if (typeof window !== 'undefined' && !window.__WD_STOCK_META_MANUAL) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initStockMeta());
  } else {
    initStockMeta();
  }
}
