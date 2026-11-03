// cap_search — rank-position round-robin merge for the overlay's tagged list.
// Algolia has NO cross-index relevancy score (ranking is per-index only), so
// the merged Offers/Dealerships/News/Pages list interleaves by rank position:
// every category's #1 first (in intent order), then the #2s, and so on.
// Deterministic, reads as relevance-ordered, zero pipeline changes
// (DECISIONS 2026-07-31).

/** Intent order of the merged categories. */
export const MERGED_ORDER = ['offers', 'dealerships', 'news', 'pages'];

/**
 * Merge `{ category: adaptedHits[] }` into one flat array of adapted hits.
 * Pure and deterministic: same input, same output, no ties to break.
 *
 * @param {Object} byCategory  arrays of adapter-normalised hits per category
 * @param {Object} [opts]      { order = MERGED_ORDER, cap = 10 }
 * @returns {Array} interleaved hits, at most `cap` long
 */
export function interleave(byCategory, opts = {}) {
  const { order = MERGED_ORDER, cap = 10 } = opts;
  const out = [];
  let longest = 0;
  for (const category of order) {
    const len = (byCategory[category] || []).length;
    if (len > longest) longest = len;
  }
  for (let rank = 0; rank < longest && out.length < cap; rank++) {
    for (const category of order) {
      const hit = (byCategory[category] || [])[rank];
      if (!hit) continue;
      out.push(hit);
      if (out.length >= cap) break;
    }
  }
  return out;
}
