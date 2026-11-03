// cap_search — template registry + clone/bind engine (adapted from
// cap_compare/_v1.0.1/ui/templates.js, same proven contract).
//
// Every repeated pattern renders by CLONING a template node and filling
// marked descendants. Templates come from two sources:
//   1. Webflow-authored DOM: a hidden [data-wd-search-templates] wrapper
//      holding one authored instance per pattern, marked data-wd-tpl="<key>".
//      Overlay templates live in the nav shell; the /search page may carry
//      its own page-level wrapper. Authored nodes win.
//   2. BUILTIN strings below (identical markup) when no authored template
//      exists — demo, protos and the self-injection fallback render the same
//      surface. The overlay BUILTINs must stay byte-consistent in
//      structure/classes/binds with scaffold.html (the authoring source).
//
// Contract: JS owns data, state classes (is-open/is-active/…) and functional
// attributes (data-wd-search-*); Webflow owns structure and styling. Fill
// targets are marked data-wd-bind="<name>" — a missing bind is skipped,
// never an error. Authored Webflow imgs ship with NO src: fills always set
// src explicitly, and a null image removes the img node entirely.

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Crect width='4' height='3' fill='%23eee'/%3E%3C/svg%3E";

const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const SEARCH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" width="18" height="18"><circle cx="7" cy="7" r="5.25" stroke="currentColor" stroke-width="1.5"/><path d="M11 11L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

export const BUILTIN = {
  // ── overlay hit templates — mirror scaffold.html exactly ────────────────
  'stock-mini': `<a class="wd-search_stock-card" href="#">
    <img data-wd-bind="image" class="wd-search_stock-image" alt=""
         src="${PLACEHOLDER_IMG}" loading="lazy" />
    <div class="wd-search_stock-body">
      <div data-wd-bind="title" class="wd-search_stock-name">Vehicle name</div>
      <div data-wd-bind="meta" class="wd-search_stock-meta">Odometer &middot; Fuel &middot; Dealership</div>
      <div data-wd-bind="price" class="wd-search_stock-price">$0</div>
    </div>
  </a>`,

  'model-mini': `<a class="wd-search_model-card" href="#">
    <img data-wd-bind="image" class="wd-search_model-image" alt=""
         src="${PLACEHOLDER_IMG}" loading="lazy" />
    <div data-wd-bind="title" class="wd-search_model-name">Model name</div>
  </a>`,

  'list-row': `<a class="wd-search_list-row" href="#">
    <img data-wd-bind="image" class="wd-search_list-image" alt=""
         src="${PLACEHOLDER_IMG}" loading="lazy" />
    <span class="wd-search_list-text">
      <span data-wd-bind="tag" class="wd-search_tag">Category</span>
      <span data-wd-bind="title" class="wd-search_list-title">Result title</span>
      <span data-wd-bind="meta" class="wd-search_list-meta">Supporting detail</span>
    </span>
  </a>`,

  // filters column pill (overlay) — single-select category filter for the
  // merged list; JS owns is-active / is-empty and data-wd-search-filter
  'filter-pill': `<div class="wd-search_filter-pill" role="button" tabindex="0">
    <span data-wd-bind="label" class="wd-search_filter-pill-label">Category</span>
    <span data-wd-bind="count" class="wd-search_filter-pill-count">0</span>
  </div>`,

  // ── overlay self-injection fallback (BRIEF §D1 — only when no authored
  //    shell exists; mirrors scaffold.html's nav overlay zone) ─────────────
  'overlay-shell': `<section class="wd-search_overlay is-closed" data-wd-search-overlay>
    <div class="wd-search_backdrop" data-wd-search-close></div>
    <div class="wd-search_panel" role="dialog" aria-modal="true" aria-label="Search">
      <div class="wd-search_input-row">
        <div class="wd-search_input-icon" aria-hidden="true">${SEARCH_ICON}</div>
        <div class="wd-search_input-slot" data-wd-search-input-slot></div>
        <div class="wd-search_esc" data-wd-search-close role="button" tabindex="0" aria-label="Close search">esc</div>
      </div>
      <div class="wd-search_results" data-wd-search-results>
        <div class="wd-search_hint" data-wd-search-hint>Start typing to search the whole site.</div>
        <div class="wd-search_empty" data-wd-search-empty hidden>
          No results for &ldquo;<span data-wd-bind="query"></span>&rdquo;.
        </div>
        <section class="wd-search_section is-stock" data-wd-search-section="stock" hidden>
          <header class="wd-search_section-header">
            <div class="wd-search_section-title">Vehicle stock</div>
            <a class="wd-search_show-all" data-wd-search-show-all="stock" href="/site-search">Show all <span data-wd-bind="count"></span></a>
          </header>
          <div class="wd-search_row" data-wd-search-row="stock"></div>
        </section>
        <section class="wd-search_section is-models" data-wd-search-section="models" hidden>
          <header class="wd-search_section-header">
            <div class="wd-search_section-title">Models</div>
            <a class="wd-search_show-all" data-wd-search-show-all="models" href="/site-search">Show all <span data-wd-bind="count"></span></a>
          </header>
          <div class="wd-search_row" data-wd-search-row="models"></div>
        </section>
        <div class="wd-search_bottom" data-wd-search-bottom hidden>
          <section class="wd-search_section is-filters" data-wd-search-section="filters" hidden>
            <header class="wd-search_section-header">
              <div class="wd-search_section-title">Filters</div>
            </header>
            <div class="wd-search_filter-list" data-wd-search-filter-pills></div>
          </section>
          <section class="wd-search_section is-merged" data-wd-search-section="merged" hidden>
            <div class="wd-search_list" data-wd-search-list></div>
          </section>
        </div>
      </div>
      <div class="wd-search_footer">
        <a class="button wd-search_all-button" data-wd-search-all href="/site-search">Search all results</a>
      </div>
    </div>
    <div data-wd-search-templates hidden aria-hidden="true"></div>
  </section>`,

  // ── /search page shell + chrome ─────────────────────────────────────────
  // The page bar re-searches without leaving the page (page.js intercepts
  // submit); as a plain GET form it also works with JS half-loaded. The
  // Webflow-authored shell may carry an input SLOT instead of an input
  // (nav-shell precedent) — page.js creates the input either way.
  'page-shell': `<div class="wd-search_page-shell">
    <form class="wd-search_page-bar" data-wd-search-page-bar method="get">
      <div class="wd-search_input-row is-page">
        <div class="wd-search_input-icon" aria-hidden="true">${SEARCH_ICON}</div>
        <div class="wd-search_input-slot" data-wd-search-input-slot></div>
        <button type="submit" class="wd-search_page-submit" data-wd-search-page-submit>Search</button>
      </div>
    </form>
    <header class="wd-search_page-header">
      <h1 class="wd-search_page-heading" data-wd-bind="heading">0 search results</h1>
      <p class="wd-search_page-subtitle" data-wd-bind="subtitle">&nbsp;</p>
    </header>
    <nav class="wd-search_pills" data-wd-bind="pills" aria-label="Result categories"></nav>
    <div class="wd-search_page-sections" data-wd-bind="sections"></div>
  </div>`,

  'page-pill': `<button type="button" class="wd-search_pill">
    <span class="wd-search_pill-label" data-wd-bind="label">Category</span>
    <span class="wd-search_pill-count" data-wd-bind="count">0</span>
  </button>`,

  'page-section': `<section class="wd-search_page-section">
    <header class="wd-search_page-section-header">
      <h2 class="wd-search_page-section-title">
        <span data-wd-bind="label">Category</span>
        <span class="wd-search_page-section-count" data-wd-bind="count">0</span>
      </h2>
      <a class="wd-search_show-all" data-wd-bind="show-all" href="/site-search">Show all</a>
    </header>
    <div class="wd-search_scroller">
      <div class="wd-search_snap-row" data-wd-bind="row"></div>
      <button type="button" class="wd-search_arrow is-prev" data-wd-bind="prev" aria-label="Previous results" hidden>${CHEVRON_LEFT}</button>
      <button type="button" class="wd-search_arrow is-next" data-wd-bind="next" aria-label="Next results" hidden>${CHEVRON_RIGHT}</button>
    </div>
  </section>`,

  'page-grid': `<section class="wd-search_page-section is-scoped">
    <div class="wd-search_grid" data-wd-bind="grid"></div>
    <div class="wd-search_more-row">
      <button type="button" class="wd-search_load-more" data-wd-bind="more" hidden>Load more</button>
    </div>
  </section>`,

  'page-empty': `<form class="wd-search_page-empty" action="/site-search" method="get">
    <label class="wd-search_page-empty-label" for="wd-search-page-q">Search the whole site</label>
    <div class="wd-search_input-row is-page">
      <div class="wd-search_input-icon" aria-hidden="true">${SEARCH_ICON}</div>
      <input id="wd-search-page-q" class="wd-search_input" data-wd-search-input name="q" type="search"
             placeholder="Search stock, models, offers, dealerships, news&hellip;"
             aria-label="Search" autocomplete="off" />
      <button type="submit" class="wd-search_page-empty-submit">Search</button>
    </div>
  </form>`,

  // ── /search page hit cards ──────────────────────────────────────────────
  // stock/model/page cards use wd-search_* classes (search.css styles them);
  // offer/news/dealership cards reuse the site card classes exactly as the
  // cms_browse card literals do — the site stylesheet styles them.
  'stock-card': `<a class="wd-search_card is-stock" href="#">
    <img data-wd-bind="image" class="wd-search_card-image" alt="" src="${PLACEHOLDER_IMG}" loading="lazy" />
    <div class="wd-search_card-body">
      <div data-wd-bind="title" class="wd-search_card-title">Vehicle name</div>
      <div data-wd-bind="subtitle" class="wd-search_card-subtitle">Variant</div>
      <div data-wd-bind="meta" class="wd-search_card-meta">Odometer &middot; Fuel &middot; Dealership</div>
      <div data-wd-bind="price" class="wd-search_card-price">$0</div>
    </div>
  </a>`,

  // EM-287: mirrors the site's Featured-models card — no brand subtitle (the
  // index `name` already carries it: "Toyota Corolla Cross")
  'model-card': `<a class="wd-search_card is-model" href="#">
    <img data-wd-bind="image" class="wd-search_card-image" alt="" src="${PLACEHOLDER_IMG}" loading="lazy" />
    <div class="wd-search_card-body">
      <div data-wd-bind="title" class="wd-search_card-title">Model name</div>
      <div data-wd-bind="price" class="wd-search_card-price">Price</div>
    </div>
  </a>`,

  // EM-414 / EM-415 (Alex, 2026-09-17): no corner arrow button — the whole
  // card is the link, same as the stock/model cards and the cms_browse offer
  // and news cards since EM-301/302 (038e940).
  'offer-card': `<div role="listitem" class="news_featured_item wd-search_hit">
    <a data-wd-bind="link" href="#" class="news_featured_link w-inline-block">
      <img data-wd-bind="image" alt="" loading="lazy" src="${PLACEHOLDER_IMG}" class="news_featured_image">
      <div class="news_featured_details">
        <h3 data-wd-bind="title" class="heading-style-h5">Offer name</h3>
        <p data-wd-bind="meta" class="text-style-2lines">Short description</p>
      </div>
    </a>
  </div>`,

  'news-card': `<div role="listitem" class="news_featured_item wd-search_hit">
    <a data-wd-bind="link" href="#" class="news_featured_link w-inline-block">
      <img data-wd-bind="image" alt="" loading="lazy" src="${PLACEHOLDER_IMG}" class="news_featured_image">
      <div class="news_featured_details">
        <h3 data-wd-bind="title" class="heading-style-h5">Article title</h3>
        <p data-wd-bind="meta" class="text-style-2lines">Summary</p>
      </div>
    </a>
  </div>`,

  'dealership-card': `<div role="listitem" class="dealerships_cms-item wd-search_hit">
    <a data-wd-bind="link" href="#" class="card5_image-link w-inline-block">
      <img data-wd-bind="image" alt="" loading="lazy" src="${PLACEHOLDER_IMG}" class="card5_image">
    </a>
    <div class="card5_details">
      <a data-wd-bind="link" href="#" class="w-inline-block"><h2 data-wd-bind="title" class="heading-style-h5">Dealership name</h2></a>
      <div data-wd-bind="meta" class="text-size-small flex-grow">Address</div>
      <div class="button-row margin-top margin-small">
        <a data-wd-bind="link" href="#" class="button is-dealership-card w-button">Dealership Info</a>
      </div>
    </div>
  </div>`,

  // OG image on top (crawler index `image` field; null removes the node),
  // then title + description — the path line left with the 2026-08-04 round
  'page-card': `<a class="wd-search_card is-page" href="#">
    <img data-wd-bind="image" class="wd-search_card-image" alt="" src="${PLACEHOLDER_IMG}" loading="lazy" />
    <div class="wd-search_card-body">
      <div data-wd-bind="title" class="wd-search_card-title">Page title</div>
      <div data-wd-bind="meta" class="wd-search_card-meta">Page description</div>
    </div>
  </a>`,
};

function fromString(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/**
 * Build the template registry for a root (a [data-wd-search-templates]
 * wrapper, or null for BUILTIN-only). Authored [data-wd-tpl] nodes win over
 * BUILTIN; clones are stripped of template marks.
 */
export function createRegistry(root) {
  const authored = {};
  (root || document.createElement('div')).querySelectorAll('[data-wd-tpl]').forEach((el) => {
    const key = el.getAttribute('data-wd-tpl');
    if (!(key in authored)) authored[key] = el;
  });
  const cache = {};
  return {
    authored: Object.keys(authored).length > 0,
    has(key) {
      return Boolean(authored[key] || BUILTIN[key]);
    },
    /** A fresh clone of the template, stripped of template marks. */
    clone(key) {
      const proto = authored[key] || (cache[key] ??= fromString(BUILTIN[key]));
      const node = proto.cloneNode(true);
      node.removeAttribute('data-wd-tpl');
      node.removeAttribute('hidden');
      return node;
    },
  };
}

/** All bind targets for a name (the node itself included). Missing = []. */
export function bindTargets(node, name) {
  const sel = `[data-wd-bind="${name}"]`;
  const list = [...node.querySelectorAll(sel)];
  if (node.matches?.(sel)) list.unshift(node);
  return list;
}

/**
 * Fill a clone. Map values per bind name:
 *   string            -> textContent
 *   null / undefined  -> remove the bound node(s)
 *   { text, html, attrs: {n:v} } -> granular fill
 * Unmatched names are skipped so designer deletions never throw.
 */
export function fill(node, map) {
  for (const [name, spec] of Object.entries(map)) {
    const targets = bindTargets(node, name);
    for (const t of targets) {
      if (spec == null) { t.remove(); continue; }
      if (typeof spec === 'string') { t.textContent = spec; continue; }
      if (spec.text != null) t.textContent = spec.text;
      if (spec.html != null) t.innerHTML = spec.html;
      if (spec.attrs) for (const [n, v] of Object.entries(spec.attrs)) t.setAttribute(n, v);
    }
  }
  return node;
}

function linkAttrs(hit) {
  const attrs = { href: hit.url || '#' };
  if (hit.external) { attrs.target = '_blank'; attrs.rel = 'noopener'; }
  return attrs;
}

/**
 * Clone + fill a hit card from an adapter-normalised hit. One shared fill map
 * covers every card size — templates simply omit the binds they don't show
 * (missing binds are skipped). Root <a> templates get href/target directly
 * (the allowed attr exception); inner links use the "link" bind.
 */
export function renderHit(registry, key, hit) {
  const node = registry.clone(key);
  fill(node, {
    tag: hit.tag,
    title: hit.title || '',
    subtitle: hit.subtitle == null ? null : hit.subtitle,
    meta: hit.meta == null ? null : hit.meta,
    price: hit.price == null ? null : hit.price,
    path: hit.category === 'pages' ? hit.url : null,
    // authored Webflow imgs carry no src — always set it; null removes the img
    image: hit.image ? { attrs: { src: hit.image, alt: hit.title || '' } } : null,
    link: { attrs: linkAttrs(hit) },
  });
  if (node.tagName === 'A') {
    for (const [n, v] of Object.entries(linkAttrs(hit))) node.setAttribute(n, v);
  }
  // GA4 attributes mirror the live-site dealership CMS card (EM-170): GTM
  // click triggers key on data-ga4-param-*. The name link (wraps the title
  // heading) fires click-external; the image link and Info button fire
  // contact_intent. Other card types carry no GA4 attrs natively.
  if (hit.category === 'dealerships') {
    for (const t of bindTargets(node, 'link')) {
      if (t.tagName !== 'A') continue;
      if (t.querySelector('h1,h2,h3')) t.setAttribute('data-ga4-param-click-external', hit.title || '');
      else t.setAttribute('data-ga4-param-click', 'contact_intent');
    }
  }
  // category tint hook (search.css .wd-tag-*): class, not inline style, per repo rules
  if (hit.category) {
    for (const t of bindTargets(node, 'tag')) t.classList.add(`wd-tag-${hit.category}`);
  }
  return node;
}

/**
 * Webflow authors <button> markup as Link (<a>) elements. Give authored
 * control clones button semantics so keyboard users can reach them; real
 * <button>s (the BUILTIN path) are untouched. Pair with wireButtonKeys.
 */
export function ensureButtonSemantics(root) {
  const CONTROLS = '[data-wd-search-close], [data-wd-search-trigger], [data-wd-search-pill]';
  const list = [...root.querySelectorAll(CONTROLS)];
  if (root.matches?.(CONTROLS)) list.unshift(root);
  for (const el of list) {
    const href = el.getAttribute('href');
    // Webflow gives authored links a placeholder href="#" — strip it so
    // clicks can't hash-navigate; keydown activation covers Enter/Space
    if (el.tagName === 'A' && (!href || href === '#')) {
      el.removeAttribute('href');
      el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    }
  }
}

/** Delegated Enter/Space activation for role="button" links. */
export function wireButtonKeys(root) {
  root.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const btn = ev.target.closest('[role="button"]');
    if (!btn || !root.contains(btn)) return;
    ev.preventDefault();
    btn.click();
  });
}
