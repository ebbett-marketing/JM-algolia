// cap_compare — entry point. One script tag per page:
//   <script type="module" src="https://cdn.jsdelivr.net/gh/ebbett-marketing/JM-algolia@<version>/client/cap_compare/embed.js"></script>
// Self-injects compare.css. On stock grid pages it mounts the tray + card
// buttons; on the compare page (div[data-wd-component="compare-page"]) it also
// renders the comparison surface. Config overrides via window.WD_COMPARE_CONFIG.
import { createStore } from './core/store.js';
import { initTray } from './ui/tray.js';
import { initCardButtons } from './ui/cards.js';
import { initComparePage } from './ui/page.js';
import { ALGOLIA, INDICES } from '../config.js';

const DEFAULTS = {
  // public search-only credentials (client/config.js)
  appId: ALGOLIA.appId,
  searchKey: ALGOLIA.searchKey,
  indexName: INDICES.stock,
  inStockIndexName: `${INDICES.stock}_created_desc`,
  // JM has no dealerships index: phone + region come from the static map in
  // core/dealerships.js
  dealershipsIndex: null,
  inStockLimit: 6,
  comparePath: '/compare',
  stockPath: '/stock/all',
  carbonInfoUrl: 'https://rightcar.govt.nz/',
  maxCompare: 3,
};

function start() {
  const config = { ...DEFAULTS, ...(window.WD_COMPARE_CONFIG || {}) };

  if (!document.querySelector('link[data-wd-compare-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./compare.css', import.meta.url).href;
    link.setAttribute('data-wd-compare-css', '');
    // FIRST stylesheet in <head>, not last: compare.css is the base layer and
    // the site's Webflow stylesheet must come after it, so Designer edits to
    // the wd-compare_* template classes win the cascade (2026-07-31 Josi ask).
    const firstSheet = document.head.querySelector('link[rel="stylesheet"], style');
    if (firstSheet) document.head.insertBefore(link, firstSheet);
    else document.head.appendChild(link);
  }

  const store = createStore({ max: config.maxCompare });
  initTray(store, config);
  initCardButtons(store, config);

  const mount = document.querySelector('[data-wd-component="compare-page"]');
  if (mount) initComparePage(mount, store, config);

  // debug + coordination surface (e.g. cms_stock/search.js calling decorateCard)
  window.wdCompare = Object.assign(window.wdCompare || {}, { store, config });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
