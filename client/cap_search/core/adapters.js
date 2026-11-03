// cap_search — per-category record adapters. Raw Algolia hits (field shapes
// verified in ebbett-agents/04-algolia/index-recon-2026-08-03.md) normalise to
// ONE renderer-facing shape before anything touches the DOM:
//
//   { objectID, category, tag, title, url, external, image, meta, price,
//     subtitle }
//
// price is null outside stock/models; image/meta/price/subtitle are null when
// a record has nothing usable — fill() removes the bound node, so renderers
// never special-case. Index strings are NEVER trusted: renderers fill via
// textContent/setAttribute, and esc() is exported for any innerHTML path.

/** Display labels, keyed by category (fixed vocabulary, BRIEF §D). */
export const LABELS = {
  stock: 'Vehicle stock',
  models: 'Models',
  offers: 'Offers',
  dealerships: 'Dealerships',
  news: 'News',
  pages: 'Pages',
};

/** HTML-escape for the rare innerHTML path. Prefer textContent fills. */
export const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

// Records carry absolute www.ebbett.co.nz URLs; on-site links must stay
// relative so dev.ebbett.co.nz navigation does not jump hosts (cms_browse
// precedent). External/OEM URLs pass through untouched.
export function relUrl(url) {
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (/(^|\.)ebbett\.co\.nz$/.test(u.hostname)) return u.pathname + u.search;
    return url;
  } catch {
    return url;
  }
}

// Stock record URLs additionally carry the old-live /product/ path — the
// Ebbett 3.0 vehicle template lives at /inventory/ (EM-184 / EM-122; see
// lib_algolia core/urls.js). Drop the remap once the sync writes /inventory/.
export function stockUrl(url) {
  return relUrl(url).replace(/^\/product\//, '/inventory/');
}

/**
 * Canonical on-site path for a pages hit. objectID/url include query strings
 * (/dealerships appears 5x with ?region=…) so the query/hash is stripped —
 * this is both the dedupe key and the href.
 */
export function pagePath(hit) {
  let p = hit.path;
  if (!p) {
    try { p = new URL(hit.url || hit.objectID).pathname; } catch { p = String(hit.url || ''); }
  }
  return String(p).split(/[?#]/)[0] || '/';
}

/** EM-420: first usable offer image for a 16:9 card slot. */
export function offerImage(hit) {
  return hit.imageThumbnailAlt || hit.imageWide || hit.thumbnail || hit.imageMobileTile || hit.hero || null;
}

const join = (parts, sep = ' · ') => {
  const s = parts.filter(Boolean).join(sep);
  return s || null;
};

export const ADAPTERS = {
  stock(hit) {
    return {
      objectID: hit.objectID,
      category: 'stock',
      tag: LABELS.stock,
      title: hit.name || '',
      url: stockUrl(hit.url),
      external: false,
      image: hit.mainImage || null,
      subtitle: join([hit.variant, hit.variant_extra], ' '),
      meta: join([hit.odometer_text, hit.fuel_type, hit.dealership]),
      price: hit.price_current_text || null, // can be "P.O.A." — text, never parsed
    };
  },

  models(hit) {
    return {
      objectID: hit.objectID,
      category: 'models',
      tag: LABELS.models,
      title: hit.name || '',
      // 13% of model URLs are off-site OEM pages — relUrl leaves those alone
      url: relUrl(hit.url),
      external: hit.openInNewTab === true,
      image: hit.mainImage || null,
      subtitle: hit.vehicleBrand || null,
      // `description` is HTML and boilerplate-heavy — deliberately unused
      meta: null,
      // priceFormatted may be CTA text ("View Toyota Driveaway Price") —
      // render verbatim, never assume currency
      price: hit.priceFormatted || null,
    };
  },

  offers(hit) {
    return {
      objectID: hit.objectID,
      category: 'offers',
      tag: LABELS.offers,
      title: hit.name || hit.offerTitle || '',
      url: relUrl(hit.url),
      external: false,
      // EM-420 (Alex, 2026-09-17): the card is 16:9 — prefer the "Thumbnail
      // alternative" field, then the 16:9 "current offers alternative", then
      // the square thumbnail, mobile tile and hero. Same chain as cms_browse.
      image: offerImage(hit),
      subtitle: null,
      meta: hit.cardShortDescription || hit.shortDescription || null,
      price: null,
    };
  },

  news(hit) {
    return {
      objectID: hit.objectID,
      category: 'news',
      tag: LABELS.news,
      title: hit.title || '', // news titles live in `title`, not `name`
      url: relUrl(hit.url),
      external: false,
      image: hit.mainImage || hit.thumbnail || null, // both nullable
      subtitle: null,
      meta: hit.summary || null,
      price: null,
    };
  },

  dealerships(hit) {
    return {
      objectID: hit.objectID,
      category: 'dealerships',
      tag: LABELS.dealerships,
      title: hit.name || '',
      url: relUrl(hit.url),
      external: false,
      image: hit.thumbnail || hit.logo || null,
      subtitle: null,
      meta: hit.address || join([hit.city, hit.region], ', '),
      price: null,
    };
  },

  pages(hit) {
    return {
      objectID: hit.objectID,
      category: 'pages',
      tag: LABELS.pages,
      title: hit.title || '',
      url: pagePath(hit), // query-stripped on-site path, never the raw URL
      external: false,
      image: hit.image || null,
      subtitle: null,
      meta: hit.description || null, // never the ~4kB `content` blob
      price: null,
    };
  },
};

/** Normalise one raw hit. Unknown categories fall back to a bare shape.
 * `raw` keeps the untouched index record — the /site-search Stock Card
 * filler needs the full ais field set, not the normalised subset. */
export function adapt(category, hit) {
  const fn = ADAPTERS[category];
  if (fn) return Object.assign(fn(hit || {}), { raw: hit || {} });
  return {
    objectID: hit && hit.objectID,
    category,
    tag: LABELS[category] || category,
    title: (hit && (hit.title || hit.name)) || '',
    url: relUrl(hit && hit.url),
    external: false,
    image: null,
    subtitle: null,
    meta: null,
    price: null,
  };
}
