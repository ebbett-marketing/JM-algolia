// cap_search — entry point. One script tag site-wide (registered inline
// script `searchembeddev`, footer, all pages):
//   <script type="module" src="https://client.ebbett.co.nz/cap_search/dev/embed.js"></script>
//
// Mounts (scaffold.html is the markup contract):
//   - nav trigger  <div data-wd-search-trigger>            (navbar component)
//   - overlay      <section data-wd-search-overlay>        (navbar component)
//   - /search page <div data-wd-search-page>               (/search page only)
//
// Self-injects search.css as the FIRST stylesheet so Designer edits to
// wd-search_* classes win the cascade. The overlay module + Algolia SDK
// lazy-load on first open (module-only warm-up on trigger hover/focus) —
// zero search-JS cost for pageviews that never search.
//
// Config overrides via window.WD_SEARCH_CONFIG — the harness passes a stub
// `searchClient` here so Tier 1 tests never touch the network.

const DEFAULTS = {
  // public search-only credentials — same pair committed in cms_stock/search.js
  appId: 'G2Y7I1BLJW',
  searchKey: 'e54bd7c6bd9b6c2df13fe6615eca943d',
  // lazy-injected UMD; skipped entirely when `searchClient` is stubbed
  algoliaCdn: 'https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch-lite.umd.js',
  searchClient: null, // harness stub hook
  indices: {
    stock: 'stock', // Adam's, read-only
    models: 'models_dev', // ours — n8n Model Sync c0jOiInHZ5o67ad6 from the 3.0 CMS (`models` is fed from the old site)
    offers: 'offers_staging',
    news: 'news_staging',
    dealerships: 'dealerships_staging',
    pages: 'pages_staging', // ours (n8n crawler yrVMp6kOuHAuxXRk); Adam's ebbett_website_pages test index was deleted 2026-08-05
  },
  // Webflow reserves /search for its native site search — the results page
  // lives at /site-search (slug renamed 2026-08-03)
  searchPath: '/site-search',
};

function injectCss() {
  if (document.querySelector('link[data-wd-search-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./search.css', import.meta.url).href;
  link.setAttribute('data-wd-search-css', '');
  // FIRST stylesheet in <head>, not last: search.css is the base layer and
  // the site's Webflow stylesheet must come after it, so Designer edits to
  // the wd-search_* classes win the cascade (cap_compare precedent).
  const firstSheet = document.head.querySelector('link[rel="stylesheet"], style');
  if (firstSheet) document.head.insertBefore(link, firstSheet);
  else document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`wd-search: failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function start() {
  const userConfig = window.WD_SEARCH_CONFIG || {};
  const config = {
    ...DEFAULTS,
    ...userConfig,
    indices: { ...DEFAULTS.indices, ...(userConfig.indices || {}) },
  };
  injectCss();

  let clientPromise = null;
  const ensureClient = () => (clientPromise ??= (async () => {
    if (config.searchClient) return config.searchClient;
    if (!window.algoliasearch) await loadScript(config.algoliaCdn);
    return window.algoliasearch(config.appId, config.searchKey);
  })());

  // ── overlay: lazy module, warm on intent ─────────────────────────────────
  let overlayModule = null;
  const warm = () => (overlayModule ??= import('./ui/overlay.js'));
  let overlayApi = null;

  async function open() {
    ensureClient().catch(() => {}); // SDK ensure joins the first open only
    let mod;
    try {
      mod = await warm();
    } catch (err) {
      console.warn('wd-search: overlay failed to load', err);
      return;
    }
    if (!overlayApi) {
      overlayApi = mod.initOverlay(config, { ensureClient });
      window.wdSearch.overlay = overlayApi;
    }
    overlayApi.open();
  }

  function close() {
    if (overlayApi) overlayApi.close();
  }

  // every trigger on the page (16 Sep: the nav-menu item on desktop plus a
  // search icon beside the hamburger on mobile — both carry the attribute)
  for (const trigger of document.querySelectorAll('[data-wd-search-trigger]')) {
    trigger.addEventListener('click', (ev) => { ev.preventDefault(); open(); });
    trigger.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
    });
    // module-only warm-up — no SDK, no queries
    trigger.addEventListener('pointerenter', warm);
    trigger.addEventListener('focus', warm);
  }

  // Ctrl/Cmd+K anywhere — except while typing somewhere that isn't ours
  // (Esc is handled inside the overlay while it is open)
  document.addEventListener('keydown', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey) || (ev.key !== 'k' && ev.key !== 'K')) return;
    const t = ev.target;
    const typing = t instanceof Element
      && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
      && !t.closest('[data-wd-search-trigger], [data-wd-search-input]');
    if (typing) return;
    ev.preventDefault();
    open();
  });

  // ── /search page: mounts immediately (needs results on load) ────────────
  if (document.querySelector('[data-wd-search-page]')) {
    import('./ui/page.js')
      .then((mod) => { window.wdSearch.page = mod.initPage(config, { ensureClient }); })
      .catch((err) => console.warn('wd-search: page renderer failed to load', err));
  }

  // debug + coordination surface
  window.wdSearch = Object.assign(window.wdSearch || {}, { config, open, close });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
