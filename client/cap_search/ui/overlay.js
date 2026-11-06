// cap_search — spotlight overlay behaviour. The shell is Webflow-authored in
// the nav component (scaffold.html); this module only flips state classes,
// clones hit templates and fills binds — it never re-renders the panel node,
// so CSS open/close transitions survive (cap_compare tray.js precedent).
//
// Lazy-loaded: embed.js dynamic-imports this file on first open (warm-up on
// trigger hover/focus imports it without touching the Algolia SDK).

import {
  createRegistry, fill, renderHit, ensureButtonSemantics, wireButtonKeys,
} from './templates.js';
import {
  runSearch, debounce, MERGED_CATEGORIES, LABELS,
} from '../core/federated.js';
import { interleave } from '../core/interleave.js';

// stock/models rows show 6; each merged category contributes up to 5 hits to
// the rank-interleaved list, capped at 10.
const OVERLAY_HITS = { stock: 6, models: 6, offers: 5, dealerships: 5, news: 5, pages: 5 };
const MERGED_CAP = 10;
const DEBOUNCE_MS = 200;

// filters column pill order (Josi 2026-08-04) — deliberately NOT the
// interleave's intent order; the pill row is its own fixed vocabulary.
const FILTER_ORDER = ['dealerships', 'offers', 'pages', 'news'];

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Bind the overlay. `deps.ensureClient()` resolves the search client (embed
 * owns SDK loading; the harness stubs it). Returns { el, open, close,
 * isOpen, search }.
 */
export function initOverlay(config, deps = {}) {
  let overlay = document.querySelector('[data-wd-search-overlay]');
  if (!overlay) {
    // No authored shell in the nav — self-inject the BUILTIN one (BRIEF §D1
    // fallback; normal pages always carry the Webflow shell).
    overlay = createRegistry(null).clone('overlay-shell');
    document.body.appendChild(overlay);
    console.info('wd-search: no authored overlay shell found — injected BUILTIN fallback');
  }

  const registry = createRegistry(overlay.querySelector('[data-wd-search-templates]'));
  const panel = overlay.querySelector('.wd-search_panel') || overlay;

  // Webflow can't author a bare input in the nav (Text Field requires a
  // Form), so the authored shell ships an empty slot the module fills. A
  // directly-authored input (protos, fallback shell markup) still wins.
  let input = overlay.querySelector('[data-wd-search-input]');
  if (!input) {
    const slot = overlay.querySelector('[data-wd-search-input-slot]');
    if (slot) {
      input = document.createElement('input');
      input.className = 'wd-search_input';
      input.setAttribute('data-wd-search-input', '');
      input.type = 'search';
      input.placeholder = 'Search stock, models, offers, news…'; // [JM] no dealerships
      input.setAttribute('aria-label', 'Search');
      input.autocomplete = 'off';
      slot.appendChild(input);
    }
  }

  const hint = overlay.querySelector('[data-wd-search-hint]');
  const emptyEl = overlay.querySelector('[data-wd-search-empty]');
  const searchAll = overlay.querySelector('[data-wd-search-all]');

  let isOpen = false;
  let lastFocus = null;
  let query = '';
  let token = 0;
  let activeFilter = ''; // '' = all merged categories (single-select pills)
  let lastResult = null; // last rendered federated result (pill re-renders)

  overlay.setAttribute('aria-hidden', 'true');
  ensureButtonSemantics(overlay);
  wireButtonKeys(overlay);

  function searchUrl(category) {
    const base = `${config.searchPath}?q=${encodeURIComponent(query)}`;
    return category ? `${base}&category=${encodeURIComponent(category)}` : base;
  }

  function updateHrefs() {
    if (searchAll) searchAll.setAttribute('href', searchUrl(''));
    overlay.querySelectorAll('[data-wd-search-show-all]').forEach((a) => {
      a.setAttribute('href', searchUrl(a.getAttribute('data-wd-search-show-all')));
    });
  }

  function sectionEl(name) {
    return overlay.querySelector(`[data-wd-search-section="${name}"]`);
  }

  function setHidden(el, hidden) {
    if (el) el.hidden = hidden;
  }

  function renderIdle() {
    activeFilter = '';
    lastResult = null;
    setHidden(hint, false);
    setHidden(emptyEl, true);
    ['stock', 'models', 'merged', 'filters'].forEach((s) => setHidden(sectionEl(s), true));
    setHidden(overlay.querySelector('[data-wd-search-bottom]'), true);
  }

  function renderRow(name, tplKey, result) {
    const section = sectionEl(name);
    const row = overlay.querySelector(`[data-wd-search-row="${name}"]`);
    const { hits, nbHits } = result;
    if (row) {
      row.textContent = '';
      for (const hit of hits) row.appendChild(renderHit(registry, tplKey, hit));
    }
    if (section) fill(section, { count: String(nbHits) });
    setHidden(section, hits.length === 0);
  }

  // ── bottom zone: filters column + merged tagged list (Josi 2026-08-04) ──
  // One pill per merged category in FIXED order; single-select toggle scopes
  // the merged list to that category only. Pure re-render from lastResult —
  // pill clicks never re-query.

  function mergedHits(result) {
    if (activeFilter) return result[activeFilter].hits.slice(0, MERGED_CAP);
    return interleave(
      Object.fromEntries(MERGED_CATEGORIES.map((c) => [c, result[c].hits])),
      { cap: MERGED_CAP }
    );
  }

  // [JM] a pill only for a category the site searches (config.indices): JM has no dealerships.
  const filterOrder = FILTER_ORDER.filter((c) => config.indices && config.indices[c]);

  function renderFilterPills(result) {
    const holder = overlay.querySelector('[data-wd-search-filter-pills]');
    if (!holder) return;
    holder.textContent = '';
    for (const category of filterOrder) {
      const count = result[category].nbHits;
      const pill = registry.clone('filter-pill');
      fill(pill, { label: LABELS[category], count: String(count) });
      pill.setAttribute('data-wd-search-filter', category);
      pill.classList.toggle('is-active', activeFilter === category);
      // zero-count pills are inert: CSS kills pointer events, tabindex leaves
      // the keyboard path, and the click handler ignores them regardless
      pill.classList.toggle('is-empty', count === 0);
      if (count === 0) {
        pill.setAttribute('tabindex', '-1');
        pill.setAttribute('aria-disabled', 'true');
      }
      holder.appendChild(pill);
    }
  }

  function renderBottom(result) {
    // a query that zeroes the active category clears the filter (never show
    // an empty scoped list)
    if (activeFilter && result[activeFilter].nbHits === 0) activeFilter = '';

    const list = overlay.querySelector('[data-wd-search-list]');
    const merged = mergedHits(result);
    if (list) {
      list.textContent = '';
      for (const hit of merged) list.appendChild(renderHit(registry, 'list-row', hit));
    }
    // does ANY merged category have hits? (drives the whole zone, not just
    // the currently-scoped list)
    const anyMerged = MERGED_CATEGORIES.some((c) => result[c].hits.length > 0);
    renderFilterPills(result);
    setHidden(sectionEl('merged'), merged.length === 0);
    setHidden(sectionEl('filters'), !anyMerged); // filters show with the zone
    const bottom = overlay.querySelector('[data-wd-search-bottom]');
    if (bottom) {
      // .has-filters switches the zone to [filters | merged] columns; it is
      // ON whenever the zone renders with the column (state class = module-owned)
      bottom.classList.toggle('has-filters', anyMerged);
      setHidden(bottom, !anyMerged);
    }
    return anyMerged;
  }

  function renderResults(q, result) {
    lastResult = result;
    renderRow('stock', 'stock-mini', result.stock);
    renderRow('models', 'model-mini', result.models);

    const anyMerged = renderBottom(result);

    const anyHits = result.stock.hits.length > 0 || result.models.hits.length > 0
      || anyMerged;
    setHidden(hint, true);
    setHidden(emptyEl, anyHits);
    if (!anyHits && emptyEl) fill(emptyEl, { query: q });

    overlay.dispatchEvent(new CustomEvent('wd-search:results', { detail: { query: q } }));
  }

  async function doSearch() {
    const q = query;
    if (!q) { renderIdle(); return; }
    const t = ++token;
    let result;
    try {
      const client = await deps.ensureClient();
      result = await runSearch(client, q, { indices: config.indices, hitsPerPage: OVERLAY_HITS });
    } catch (err) {
      console.warn('wd-search: overlay query failed', err);
      return;
    }
    if (t !== token || q !== query) return; // stale response
    renderResults(q, result);
  }

  const debouncedSearch = debounce(doSearch, DEBOUNCE_MS);

  if (input) {
    input.addEventListener('input', () => {
      query = input.value.trim();
      updateHrefs();
      if (!query) { debouncedSearch.cancel(); token++; renderIdle(); return; }
      debouncedSearch();
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (query) location.assign(searchUrl('')); // Enter ≡ "Search all"
      }
    });
  }

  function trapTab(ev) {
    const focusables = [...panel.querySelectorAll(FOCUSABLE)]
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active)) { ev.preventDefault(); first.focus(); return; }
    if (ev.shiftKey && active === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && active === last) { ev.preventDefault(); first.focus(); }
  }

  function onDocKeydown(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
    if (ev.key === 'Tab') trapTab(ev);
  }

  function open() {
    if (isOpen) { if (input) input.focus(); return; }
    isOpen = true;
    lastFocus = document.activeElement;
    overlay.classList.remove('is-closed');
    overlay.classList.add('is-open');
    overlay.removeAttribute('aria-hidden');
    document.body.classList.add('wd-search-open');
    document.addEventListener('keydown', onDocKeydown, true);
    if (input) input.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    debouncedSearch.cancel();
    overlay.classList.add('is-closed');
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('wd-search-open');
    document.removeEventListener('keydown', onDocKeydown, true);
    const target = lastFocus && document.contains(lastFocus)
      ? lastFocus
      : document.querySelector('[data-wd-search-trigger]');
    if (target && typeof target.focus === 'function') target.focus();
  }

  overlay.addEventListener('click', (ev) => {
    const closer = ev.target.closest('[data-wd-search-close]');
    if (closer && overlay.contains(closer)) {
      ev.preventDefault();
      close();
      return;
    }
    // filter pills: single-select toggle over the merged list only (stock /
    // models rows are never scoped). Keyboard activation arrives here too —
    // wireButtonKeys turns Enter/Space on [role="button"] into click().
    const pill = ev.target.closest('[data-wd-search-filter]');
    if (pill && overlay.contains(pill) && !pill.classList.contains('is-empty')) {
      ev.preventDefault();
      const category = pill.getAttribute('data-wd-search-filter');
      activeFilter = activeFilter === category ? '' : category;
      if (lastResult) renderBottom(lastResult);
    }
  });

  renderIdle();

  return {
    el: overlay,
    open,
    close,
    isOpen: () => isOpen,
    search: doSearch,
  };
}
