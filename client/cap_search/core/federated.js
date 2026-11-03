// cap_search — federated query layer. One debounced
// `client.search([...requests])` round-trip returns all six category result
// sets together (raw algoliasearch-lite, no InstantSearch — DECISIONS
// 2026-08-03: the per-index widget model fights the rank-position interleave).
//
// Categories run in FIXED intent order (BRIEF §D): hit volume is not intent,
// and a fixed order never reshuffles while typing.

import { adapt, pagePath, LABELS } from './adapters.js';

export { LABELS };

/** Fixed intent order — every surface renders categories in this order. */
export const CATEGORIES = ['stock', 'models', 'offers', 'dealerships', 'news', 'pages'];

/** The categories merged into the overlay's tagged list. Pages rejoined the
 * merge 2026-08-04 (filters round): the old pages column is now the filter
 * pills column, and pages hits render as ordinary tagged rows. */
export const MERGED_CATEGORIES = ['offers', 'dealerships', 'news', 'pages'];

// Pages hygiene (dedupe on path + drop CMS-owned prefixes) predates our own
// pages_staging index (it was built for Adam's crawler test index) and is KEPT:
// the crawler excludes CMS prefixes upstream, but the client-side guard is
// cheap and protects search if the crawler's exclusions ever regress. Server
// pagination would paginate the PRE-filter list, so pages requests always
// fetch the full match window (index holds ~115 records) and runSearch slices
// client-side — counts and page boundaries stay honest.
const PAGES_FETCH = 100;
const PAGE_DROP_PREFIXES = ['/news/', '/model/', '/product/', '/dealership/', '/offers/'];

function perPage(hitsPerPage, category) {
  if (typeof hitsPerPage === 'number') return hitsPerPage;
  if (hitsPerPage && typeof hitsPerPage[category] === 'number') return hitsPerPage[category];
  return 6;
}

/**
 * Build the multi-index request array, in category order.
 * opts: {
 *   indices:     { category: indexName } map (config.indices) — required
 *   categories:  subset of CATEGORIES, default all six
 *   hitsPerPage: number, or { category: number } map (default 6)
 *   page:        zero-based page (default 0; single-category grids)
 *   now:         ms timestamp for the offers endDate filter (testability;
 *                default Date.now())
 * }
 */
export function buildRequests(query, opts = {}) {
  const {
    indices = {},
    categories = CATEGORIES,
    hitsPerPage = 6,
    page = 0,
    now = Date.now(),
  } = opts;

  return categories.map((category) => {
    const params = { query, hitsPerPage: perPage(hitsPerPage, category), page };
    if (category === 'stock') params.filters = 'status:Active'; // index holds Sold/Pending too
    if (category === 'offers') params.numericFilters = ['endDate>' + now]; // expired offers linger between resyncs
    if (category === 'pages') { params.hitsPerPage = PAGES_FETCH; params.page = 0; }
    return { indexName: indices[category] || category, params };
  });
}

function pagesHygiene(hits) {
  const seen = new Set();
  const out = [];
  for (const hit of hits) {
    const path = pagePath(hit);
    if (seen.has(path)) continue;
    if (PAGE_DROP_PREFIXES.some((p) => path.startsWith(p))) continue;
    seen.add(path);
    out.push(hit);
  }
  return out;
}

/**
 * Run a federated search and return `{ [category]: { hits, nbHits } }` with
 * hits already adapter-normalised. Pages results are hygiene-filtered and
 * their nbHits recomputed — the raw index count is never surfaced.
 * Accepts the same opts as buildRequests.
 */
export async function runSearch(client, query, opts = {}) {
  const categories = opts.categories || CATEGORIES;
  // JM: only categories with an index in config.indices are queried (stock and
  // pages); a missing index would fail the whole multi-index request.
  const indices = opts.indices || {};
  const searched = categories.filter((category) => indices[category]);
  const requests = searched.length ? buildRequests(query, { ...opts, categories: searched }) : [];
  const res = requests.length ? await client.search(requests) : null;
  const results = (res && res.results) || [];

  const out = {};
  categories.forEach((category) => {
    const i = searched.indexOf(category);
    const r = (i >= 0 && results[i]) || {};
    let hits = r.hits || [];
    let nbHits = typeof r.nbHits === 'number' ? r.nbHits : hits.length;
    if (category === 'pages') {
      hits = pagesHygiene(hits);
      nbHits = hits.length; // honest post-filter count
      const per = perPage(opts.hitsPerPage == null ? 6 : opts.hitsPerPage, category);
      const page = opts.page || 0;
      hits = hits.slice(page * per, page * per + per);
    }
    out[category] = { hits: hits.map((h) => adapt(category, h)), nbHits };
  });
  return out;
}

/** Trailing-edge debounce; `.cancel()` clears a pending call. */
export function debounce(fn, wait = 200) {
  let timer = 0;
  const run = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  run.cancel = () => clearTimeout(timer);
  return run;
}
