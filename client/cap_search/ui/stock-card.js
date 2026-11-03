// cap_search — fills a cloned Task-2 "Stock Card" (the Webflow component the
// stock grid uses, authored into the /site-search template wrapper as
// data-wd-tpl="stock-card" with its [ais-item] slots intact). The fill
// mirrors cms_stock/_v1.0.1 search.js item() — same fields map, same
// special/regular price switch, same orc rule — so the search page renders
// pixel-identical cards. Inline display toggles are 02's shipped mechanism
// for these slots (the site's .button-style display rules outrank [hidden]);
// we mirror it rather than invent a second state system.
//
// Tag strips + card meta (views / weekly price) come from the shared lib —
// lazy-imported so pages without an ais card never pay for it, and OPTIONAL:
// when the lib is unreachable (hermetic demo without the harness server) the
// card still renders, just untagged. Compare buttons need nothing from us:
// cap_compare's sitewide scanner decorates any /product/ card it sees.

import { stockUrl } from '../core/adapters.js';

// ais slot -> raw index field (verbatim from cms_stock search.js item())
const FIELDS = {
  name: 'name',
  'save-value': 'price_savings_text',
  condition: 'condition',
  price: 'price_formatted',
  fuel: 'fuel_type',
  odometer: 'odometer_text',
  variant: 'variant',
  'variant-extra': 'variant_extra',
  image: 'mainImage',
  region: 'region',
  transmission: 'transmission_simple',
  'price-current': 'price_current_text',
  'price-special': 'price_current_text',
};

const VIEWS_DISPLAY_FLOOR = 1; // show any view count (Su-Anne 2026-10-07); 0 stays hidden

// Resolved against THIS module's URL, so the lib always comes from wherever
// cap_search itself is served (client.ebbett.co.nz on dev, the harness root
// locally) — explicit about what a root-relative dynamic import already did.
// The go-live promotion flips /dev/ to /latest/ in both URLs, exactly like
// cms_stock's lib imports.
const TAG_LIB_URL = new URL('../../../lib_algolia/dev/widgets/stock-tags.js', import.meta.url).href;
const TAGS_CSS_URL = new URL('../../../lib_algolia/dev/tags.css', import.meta.url).href;

// lib_algolia's tags.css carries the tag strip's ENTIRE visibility contract
// (.wd-stock-tags display:flex/position, [ais-tag]:not(.is-active) hiding,
// the label-expansion rules updateTagStripExpansion measures). Stock pages
// load it via Webflow custom code; /site-search does not — without this the
// authored strip computes display:none and cards render untagged (dev bug,
// found 2026-08-04). Appended to the END of <head> on purpose: the Webflow
// class and tags.css tie at 0-1-0 specificity, so tags.css must load AFTER
// the site stylesheet to win the display tie.
function ensureTagCss() {
  if (document.querySelector('link[data-wd-search-tags-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = TAGS_CSS_URL;
  link.setAttribute('data-wd-search-tags-css', '');
  document.head.appendChild(link);
}

let libPromise = null;
function ensureTagLib() {
  if (!libPromise) {
    ensureTagCss(); // the strip needs its stylesheet wherever the lib runs
    libPromise = import(TAG_LIB_URL).catch((err) => {
      console.warn('wd-search: stock tag lib unavailable — cards render untagged', err);
      return null;
    });
  }
  return libPromise;
}

/** True when a cloned template carries Task-2 ais slots (vs a BUILTIN card). */
export function isAisCard(node) {
  return Boolean(
    node.matches?.('[ais-item="template"]') || node.querySelector?.('[ais-item="template"]')
  );
}

/**
 * Fill one cloned Stock Card from an adapter-normalised hit (needs hit.raw).
 * `clone` may be the card itself or an authored wrapper around the component
 * instance — the returned node is always the card <a>.
 */
export function fillStockCard(clone, hit) {
  const raw = hit.raw || {};
  const card = clone.matches?.('[ais-item="template"]')
    ? clone
    : clone.querySelector('[ais-item="template"]');
  if (!card) return clone;

  card.removeAttribute('data-wd-tpl');
  card.removeAttribute('hidden');
  card.style.display = 'block'; // the authored template ships display:none
  card.setAttribute('href', stockUrl(raw.url || hit.url));

  for (const [key, field] of Object.entries(FIELDS)) {
    const el = card.querySelector(`[ais-item="${key}"]`);
    if (!el) continue;
    if (key === 'image') {
      el.src = raw[field] || '';
      el.alt = raw.name || hit.title || '';
    } else if (field === 'price_current_text') {
      el.textContent = priceText(raw);
    } else {
      el.textContent = raw[field] ?? '';
    }
  }

  const orc = card.querySelector('[ais-item="orc"]');
  if (orc) orc.style.display = raw.orc ? 'none' : 'block';

  // search always filters status:Active — the ribbons stay hidden
  ['sold', 'pending', 'on-hold'].forEach((status) => {
    card.querySelectorAll(`[ais-item="${status}"]`).forEach((el) => { el.style.display = 'none'; });
  });

  const special = raw.price_savings_number > 0;
  const show = special ? ['price-now', 'price-special', 'save-tab'] : ['price-current'];
  const hide = special ? ['price-current'] : ['price-now', 'price-special', 'save-tab'];
  show.forEach((k) => { const el = card.querySelector(`[ais-item="${k}"]`); if (el) el.style.display = 'flex'; });
  hide.forEach((k) => { const el = card.querySelector(`[ais-item="${k}"]`); if (el) el.style.display = 'none'; });

  populateCardMeta(card, raw);

  // async, best-effort: tags land when the lib does (imports are cached, so
  // this is one fetch for the whole page, then microtask-fast)
  ensureTagLib().then((lib) => {
    if (!lib || !card.isConnected) return;
    try {
      lib.decorateCard(card, raw, lib.DEFAULT_TAG_CONFIG, {});
      lib.updateTagStripExpansion(card);
    } catch (err) {
      console.warn('wd-search: tag decoration failed', err);
    }
  });

  return card;
}

// views + weekly price — mirrors cms_stock search.js populateCardMeta()
function populateCardMeta(card, raw) {
  const set = (key, text) => {
    const el = card.querySelector(`[ais-item="${key}"]`);
    if (!el) return;
    (el.querySelector('[ais-item-value]') ?? el).textContent = text ?? '';
    el.style.display = text ? '' : 'none';
  };
  const views = raw.pageViews ?? 0;
  set('views', views >= VIEWS_DISPLAY_FLOOR ? views.toLocaleString() : null);
  set('price-weekly', raw.price_weekly_number > 0 ? `${weeklyText(raw.price_weekly_text)}/wk` : null);
}

// No price in the feed (blank text or $0) → "P.O.A." — mirrors cms_stock priceText()
const priceText = (raw) => (raw.price_current_text && raw.price_current_number !== 0) ? raw.price_current_text : 'P.O.A.';

// Some syncs already end the text in "/wk" — strip it so we never print "/wk/wk"
const weeklyText = (text) => String(text ?? '').replace(/\s*\/\s*wk\s*$/i, '');
