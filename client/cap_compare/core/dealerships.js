// Keyed by the `dealership` string carried on Algolia stock records. JM has one
// dealership; Ebbett's copy was generated from its Dealerships CMS export.
// Update by hand if the name or number changes (the crawler copies the name from
// the vehicle's Related Dealership).

export const DEALERSHIPS = {
  "Johnston Motors": {
    "phone": "04 238 4660",
    "region": "Wellington"
  }
};

// Runtime overlay (Ebbett, 16 Sep 2026): on Ebbett's site a `dealerships_staging`
// Algolia index carries name / navName / phone / region, and the page loads it
// once and lets it win over the static map. JM has no dealerships index
// (embed.js sets dealershipsIndex: null), so the static map above is used.
const LIVE = new Map();
let livePromise = null;

/** Pure merge: index hits → { name: { phone, region } } (name + navName keys). */
export function mergeDealerships(hits) {
  const out = new Map();
  for (const h of hits || []) {
    if (!h || typeof h.name !== 'string' || !h.name.trim()) continue;
    const info = { phone: typeof h.phone === 'string' && h.phone.trim() ? h.phone.trim() : null, region: h.region || null };
    out.set(h.name.trim(), info);
    if (typeof h.navName === 'string' && h.navName.trim() && !out.has(h.navName.trim())) out.set(h.navName.trim(), info);
  }
  return out;
}

/**
 * Fetch the dealerships index once (search key, read-only). Resolves to the
 * number of live entries; never rejects — any failure leaves the static map in
 * charge. `config.dealershipsIndex` names the index; with no index (JM),
 * `config.stubRecords` (Tier 1) or no appId nothing is fetched.
 */
export function loadDealerships(config = {}) {
  if (livePromise) return livePromise;
  if (!config.appId || !config.searchKey || config.stubRecords) return Promise.resolve(0);
  const indexName = config.dealershipsIndex;
  if (!indexName) return Promise.resolve(0);
  livePromise = fetch(`https://${config.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`, {
    method: 'POST',
    headers: { 'X-Algolia-Application-Id': config.appId, 'X-Algolia-API-Key': config.searchKey },
    body: JSON.stringify({ params: 'query=&hitsPerPage=100&attributesToRetrieve=%5B%22name%22%2C%22navName%22%2C%22phone%22%2C%22region%22%5D' }),
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((json) => {
      for (const [k, v] of mergeDealerships(json.hits)) LIVE.set(k, v);
      return LIVE.size;
    })
    .catch((err) => {
      console.warn('[cap_compare] dealerships index unavailable — static phone map in use:', err?.message || err);
      return 0;
    });
  return livePromise;
}

/** Test hook: forget the live overlay. */
export function resetDealerships() { LIVE.clear(); livePromise = null; }

/** Lookup tolerant of casing/whitespace drift; live index first, then the static map; null when unknown. */
export function dealershipInfo(name) {
  if (typeof name !== 'string') return null;
  const key = name.trim();
  if (LIVE.has(key)) return LIVE.get(key);
  if (DEALERSHIPS[key]) return DEALERSHIPS[key];
  const want = key.toLowerCase();
  for (const [k, v] of LIVE) {
    if (k.toLowerCase() === want) return v;
  }
  for (const [k, v] of Object.entries(DEALERSHIPS)) {
    if (k.toLowerCase() === want) return v;
  }
  return null;
}
