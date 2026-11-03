// cap_compare — Algolia data access. READ-ONLY by design: this module may only
// ever issue object-lookup and query requests. No write/settings/Insights calls.
// Tier 1 tests run hermetically via config.stubRecords (no network).

import { isSiteHost } from '../../config.js';

const ACTIVE = 'Active';

// On-site hrefs must be host-relative (JM's hosts: client/config.js) and the
// vehicle template lives at /inventory/ (EM-184 / EM-122; see lib_algolia
// core/urls.js). Normalised once here so every consumer (compare page fills,
// tray prime, in-stock cards) inherits it.
function listingUrl(url) {
  if (!url) return url;
  let out = url;
  try {
    const u = new URL(url);
    if (isSiteHost(u.hostname)) out = u.pathname + u.search;
    else return url;
  } catch {
    out = String(url);
  }
  return out.replace(/^\/product\//, '/inventory/');
}

const normaliseRecord = (r) => (r && r.url ? { ...r, url: listingUrl(r.url) } : r);

function endpoint(config, path) {
  return `https://${config.appId}-dsn.algolia.net${path}`;
}

function headers(config) {
  return {
    'X-Algolia-Application-Id': config.appId,
    'X-Algolia-API-Key': config.searchKey,
  };
}

/**
 * Fetch records by objectID, preserving id order. Non-Active and unknown ids are
 * reported in `dropped` — the comparison must never show a sold car as current.
 */
export async function fetchByIds(ids, config) {
  if (!ids.length) return { records: [], dropped: [] };
  let hits;
  if (config.stubRecords) {
    const byId = new Map(config.stubRecords.map((r) => [String(r.objectID), r]));
    hits = ids.map((id) => byId.get(String(id)) || null);
  } else {
    const res = await fetch(endpoint(config, '/1/indexes/*/objects'), {
      method: 'POST',
      headers: headers(config),
      body: JSON.stringify({
        requests: ids.map((objectID) => ({ indexName: config.indexName, objectID: String(objectID) })),
      }),
    });
    if (!res.ok) throw new Error(`compare fetch failed: HTTP ${res.status}`);
    hits = (await res.json()).results || [];
  }
  const records = [];
  const dropped = [];
  ids.forEach((id, i) => {
    const hit = hits[i];
    if (hit && hit.status === ACTIVE) records.push(normaliseRecord(hit));
    else dropped.push(String(id));
  });
  return { records, dropped };
}

/** Active records for the "Currently in stock" section, excluding compared ids. */
export async function fetchInStock(config, { exclude = [], limit = 6 } = {}) {
  if (config.stubRecords) {
    const excl = new Set(exclude.map(String));
    return config.stubRecords
      .filter((r) => r.status === ACTIVE && !excl.has(String(r.objectID)))
      .slice(0, limit)
      .map(normaliseRecord);
  }
  const filters = [`status:${ACTIVE}`, ...exclude.map((id) => `NOT objectID:${id}`)].join(' AND ');
  const res = await fetch(endpoint(config, `/1/indexes/${encodeURIComponent(config.inStockIndexName || config.indexName)}/query`), {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({ params: `hitsPerPage=${limit}&filters=${encodeURIComponent(filters)}` }),
  });
  if (!res.ok) throw new Error(`in-stock fetch failed: HTTP ${res.status}`);
  return ((await res.json()).hits || []).map(normaliseRecord);
}
