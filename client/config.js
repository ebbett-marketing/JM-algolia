// Johnston Motors — site settings, in one place (Deliverable 1).
//
// The scripts in this repo came from the Ebbett 3.0 site. Everything that differs
// for Johnston Motors (Algolia app, search key, indices, domains) lives here, so
// the domain switch or a new key is an edit to this file plus a release.
//
// Read by the ES-module scripts: cap_search, cap_compare, cap_stock-meta,
// cms_stock and lib_algolia. Everything here ships to the browser, so it must
// stay public.

export const ALGOLIA = {
  appId: 'EMQLKN9FHC',
  // Search-only key, limited to the stock (+ sort replicas) and pages indices and
  // to JM's domains (johnston-motors.webflow.io, johnstonmotors.co.nz). Public
  // by design.
  searchKey: 'f8ff4a2393901b6f4a76262fc9a5beab',
};

// Index per nav-search category. A category left out is not searched: JM's nav
// search covers stock and site pages only (D4).
export const INDICES = {
  stock: 'stock',
  pages: 'pages',
};

// Absolute URLs on these hosts are turned into on-site paths, so links never jump
// between staging and the live domain. The page's own host always counts.
export const SITE_HOSTS = [
  'johnston-motors.webflow.io',
  'johnstonmotors.co.nz',
  'www.johnstonmotors.co.nz',
];

export function isSiteHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (SITE_HOSTS.includes(host)) return true;
  return typeof location !== 'undefined' && host === location.hostname;
}

// Algolia Insights (click and conversion events) on the stock search. Off until
// Johnston Motors wants Algolia's click analytics; turning it on sets Algolia's
// anonymous user cookie.
export const INSIGHTS = false;

// Ebbett's Pre-Owned Promise programme (banner on used-stock results, the
// "Pre-Owned Promise" filter and quick-filter chip). Johnston Motors isn't part of
// it, so it's off: no banner, no Promise filter or chip on the stock pages.
export const PRE_OWNED_PROMISE = false;
