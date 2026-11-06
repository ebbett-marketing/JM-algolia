// cap_search — /search results page renderer (BRIEF §D2). URL-driven:
// `?q=…` renders the all-results view (pill row + one scroll-snap card row
// per non-zero category, fixed intent order); `&category=…` renders the
// category-scoped paginated grid. Pill/show-all clicks pushState + re-render
// so every view is shareable and back-button-safe.
//
// pushState throws on captured snapshots (cross-origin <base> — 02's
// stock-meta precedent), so navigation falls back to an in-memory state
// update; deps.getLocation lets tests inject a location-like ctx.

import {
  createRegistry, bindTargets, fill, renderHit, ensureButtonSemantics, wireButtonKeys,
} from './templates.js';
import { isAisCard, fillStockCard } from './stock-card.js';
import { runSearch, CATEGORIES, LABELS } from '../core/federated.js';

const CARD_KEYS = {
  stock: 'stock-card',
  models: 'model-card',
  offers: 'offer-card',
  news: 'news-card',
  dealerships: 'dealership-card',
  pages: 'page-card',
};
const ROW_HITS = 10; // max cards per category scroll-snap row
const GRID_PAGE = 24; // category-scoped grid page size

// Page-level authored templates live in a [data-wd-search-templates] wrapper
// OUTSIDE the nav overlay (the overlay's wrapper holds the mini templates).
function pageTemplatesRoot() {
  for (const el of document.querySelectorAll('[data-wd-search-templates]')) {
    if (!el.closest('[data-wd-search-overlay]')) return el;
  }
  return null;
}

const plural = (n) => (n === 1 ? '' : 's');

// Webflow authors buttons as Links with a placeholder href="#" — strip it so
// clicks can't hash-jump, and keep them keyboard-reachable (templates.js
// ensureButtonSemantics covers the data-wd-search-* controls; these are
// bind-marked controls, so they get the same treatment here).
function asButton(el) {
  if (!el || el.tagName !== 'A') return el;
  const href = el.getAttribute('href');
  if (!href || href === '#') {
    el.removeAttribute('href');
    el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  }
  return el;
}

/**
 * Mount the /search renderer into [data-wd-search-page]. Returns
 * { render, navigate, state, mount } (also exposed for tests via
 * window.wdSearch.page).
 */
export function initPage(config, deps = {}) {
  const mount = document.querySelector('[data-wd-search-page]');
  if (!mount) return null;

  const getLocation = deps.getLocation || (() => window.location);
  const registry = createRegistry(pageTemplatesRoot());

  const state = {
    q: '',
    category: '',
    fedQuery: null, // query the cached federated result belongs to
    federated: null,
    scoped: null, // { category, page, hits, nbHits }
  };
  let token = 0;

  // Stock hits render through the real Task-2 Stock Card when the authored
  // template carries ais slots; every other card (and the BUILTIN stock card)
  // uses the data-wd-bind fill.
  function renderCard(category, hit) {
    if (category === 'stock') {
      const clone = registry.clone('stock-card');
      if (isAisCard(clone)) return fillStockCard(clone, hit);
    }
    return renderHit(registry, CARD_KEYS[category], hit);
  }

  function readUrl() {
    const params = new URLSearchParams(getLocation().search || '');
    state.q = (params.get('q') || '').trim();
    const cat = (params.get('category') || '').trim();
    state.category = CATEGORIES.includes(cat) ? cat : '';
  }

  function urlFor(category) {
    const base = `${config.searchPath}?q=${encodeURIComponent(state.q)}`;
    return category ? `${base}&category=${encodeURIComponent(category)}` : base;
  }

  function navigate(category) {
    state.category = CATEGORIES.includes(category) ? category : '';
    state.scoped = null;
    try {
      history.pushState({ wdSearch: true }, '', urlFor(state.category));
    } catch {
      // snapshot <base> is cross-origin — keep the in-memory state and render
    }
    render();
  }

  // ── view builders ─────────────────────────────────────────────────────────

  // change the query in place (page search bar) — same render path as a
  // fresh ?q= load, shareable URL included
  function submitQuery(q) {
    const next = (q || '').trim();
    if (!next || next === state.q) return;
    state.q = next;
    state.category = '';
    state.fedQuery = null;
    state.federated = null;
    state.scoped = null;
    try {
      history.pushState({ wdSearch: true }, '', urlFor(''));
    } catch {
      // snapshot <base> is cross-origin — keep the in-memory state and render
    }
    render();
  }

  function buildShell(heading) {
    const shell = registry.clone('page-shell');
    fill(shell, { heading, subtitle: `Results for “${state.q}”` });
    wireSearchBar(shell);
    return shell;
  }

  // The big search bar above the heading (Josi 2026-08-03). The authored
  // Webflow shell ships an input SLOT (nav-shell precedent — a bare Text
  // Field can't be authored outside a Form); the BUILTIN shell does too, so
  // both paths create the input here. Submit is intercepted; as a GET form
  // the BUILTIN still degrades to a full navigation.
  function wireSearchBar(shell) {
    const bar = shell.querySelector('[data-wd-search-page-bar]');
    if (!bar) return;
    const form = bar.tagName === 'FORM' ? bar : bar.querySelector('form');
    if (form) form.setAttribute('action', config.searchPath);

    let input = bar.querySelector('[data-wd-search-input]');
    if (!input) {
      const slot = bar.querySelector('[data-wd-search-input-slot]');
      if (!slot) return;
      input = document.createElement('input');
      input.className = 'wd-search_input';
      input.setAttribute('data-wd-search-input', '');
      input.type = 'search';
      input.name = 'q';
      input.placeholder = 'Search stock, models, offers, news…'; // [JM] no dealerships
      input.setAttribute('aria-label', 'Search');
      input.autocomplete = 'off';
      slot.appendChild(input);
    }
    input.value = state.q;

    const submit = () => submitQuery(input.value);
    if (form) {
      form.addEventListener('submit', (ev) => { ev.preventDefault(); submit(); });
    }
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    });
    const button = asButton(bar.querySelector('[data-wd-search-page-submit]'));
    if (button && button.tagName !== 'BUTTON') {
      button.addEventListener('click', (ev) => { ev.preventDefault(); submit(); });
      button.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); submit(); }
      });
    }
  }

  function buildPills(shell) {
    const holder = bindTargets(shell, 'pills')[0];
    if (!holder || !state.federated) return;
    holder.textContent = '';
    const nonZero = CATEGORIES.filter((c) => state.federated[c].nbHits > 0);
    const total = nonZero.reduce((sum, c) => sum + state.federated[c].nbHits, 0);

    const addPill = (category, label, count) => {
      const pill = registry.clone('page-pill');
      fill(pill, { label, count: String(count) });
      pill.setAttribute('data-wd-search-pill', category);
      pill.classList.toggle('is-active', state.category === category);
      holder.appendChild(pill);
    };
    addPill('', 'All', total);
    for (const c of nonZero) addPill(c, LABELS[c], state.federated[c].nbHits);
    ensureButtonSemantics(holder);
  }

  function buildSection(category) {
    const { hits, nbHits } = state.federated[category];
    const section = registry.clone('page-section');
    section.setAttribute('data-wd-search-section', category);
    fill(section, {
      label: LABELS[category],
      count: String(nbHits),
      'show-all': { attrs: { href: urlFor(category) } },
    });
    const showAll = bindTargets(section, 'show-all')[0];
    if (showAll) showAll.setAttribute('data-wd-search-show-all', category);

    const row = bindTargets(section, 'row')[0];
    if (row) {
      row.setAttribute('data-wd-search-row', category);
      for (const hit of hits.slice(0, ROW_HITS)) {
        row.appendChild(renderCard(category, hit));
      }
    }

    const prev = asButton(bindTargets(section, 'prev')[0]);
    const next = asButton(bindTargets(section, 'next')[0]);
    if (row && prev && next) {
      prev.addEventListener('click', () => row.scrollBy({ left: -row.clientWidth, behavior: 'smooth' }));
      next.addEventListener('click', () => row.scrollBy({ left: row.clientWidth, behavior: 'smooth' }));
      // each arrow hides at its own end of the row (and both hide when the
      // row fits); overflow is only measurable after layout, so the initial
      // pass runs in rAF. Resize re-fires every row's scroll handler.
      const updateArrows = () => {
        const max = row.scrollWidth - row.clientWidth;
        prev.hidden = max <= 1 || row.scrollLeft <= 1;
        next.hidden = max <= 1 || row.scrollLeft >= max - 1;
      };
      row.addEventListener('scroll', updateArrows, { passive: true });
      requestAnimationFrame(updateArrows);
    }
    return section;
  }

  function renderEmpty() {
    const node = registry.clone('page-empty');
    const form = node.tagName === 'FORM' ? node : node.querySelector('form');
    if (form) form.setAttribute('action', config.searchPath);
    mount.textContent = '';
    mount.appendChild(node);
    mount.setAttribute('data-wd-search-view', 'empty');
  }

  function renderAll() {
    const nonZero = CATEGORIES.filter((c) => state.federated[c].nbHits > 0);
    const total = nonZero.reduce((sum, c) => sum + state.federated[c].nbHits, 0);
    const shell = buildShell(`${total} search result${plural(total)}`);
    buildPills(shell);
    const holder = bindTargets(shell, 'sections')[0];
    if (holder) for (const c of nonZero) holder.appendChild(buildSection(c));
    mount.textContent = '';
    mount.appendChild(shell);
    mount.setAttribute('data-wd-search-view', 'all');
  }

  function renderScoped() {
    const { category, hits, nbHits } = state.scoped;
    const shell = buildShell(`${nbHits} search result${plural(nbHits)} in ${LABELS[category]}`);
    buildPills(shell);
    const holder = bindTargets(shell, 'sections')[0];

    const section = registry.clone('page-grid');
    section.setAttribute('data-wd-search-section', category);
    const grid = bindTargets(section, 'grid')[0];
    if (grid) {
      grid.setAttribute('data-wd-search-grid', category);
      for (const hit of hits) grid.appendChild(renderCard(category, hit));
    }
    const more = asButton(bindTargets(section, 'more')[0]);
    if (more) {
      more.setAttribute('data-wd-search-more', '');
      more.hidden = hits.length >= nbHits;
      more.addEventListener('click', loadMore);
    }

    if (holder) holder.appendChild(section);
    mount.textContent = '';
    mount.appendChild(shell);
    mount.setAttribute('data-wd-search-view', 'category');
  }

  async function loadMore() {
    const s = state.scoped;
    if (!s) return;
    const t = token;
    let res;
    try {
      const client = await deps.ensureClient();
      res = await runSearch(client, state.q, {
        indices: config.indices,
        categories: [s.category],
        hitsPerPage: GRID_PAGE,
        page: s.page + 1,
      });
    } catch (err) {
      console.warn('wd-search: load more failed', err);
      return;
    }
    if (t !== token || state.scoped !== s) return; // superseded by a re-render
    s.page += 1;
    const fresh = res[s.category].hits;
    s.hits = s.hits.concat(fresh);
    const grid = mount.querySelector('[data-wd-search-grid]');
    if (grid) for (const hit of fresh) grid.appendChild(renderCard(s.category, hit));
    const more = mount.querySelector('[data-wd-search-more]');
    if (more) more.hidden = s.hits.length >= s.nbHits || fresh.length === 0;
  }

  // ── render loop ───────────────────────────────────────────────────────────

  async function render() {
    const t = ++token;
    if (!state.q) { renderEmpty(); return; }
    let client;
    try {
      client = await deps.ensureClient();
    } catch (err) {
      console.warn('wd-search: search client unavailable', err);
      return;
    }

    try {
      if (state.fedQuery !== state.q) {
        const federated = await runSearch(client, state.q, {
          indices: config.indices,
          hitsPerPage: ROW_HITS,
        });
        if (t !== token) return;
        state.federated = federated;
        state.fedQuery = state.q;
      }
      if (state.category) {
        if (!state.scoped || state.scoped.category !== state.category) {
          const res = await runSearch(client, state.q, {
            indices: config.indices,
            categories: [state.category],
            hitsPerPage: GRID_PAGE,
            page: 0,
          });
          if (t !== token) return;
          state.scoped = {
            category: state.category,
            page: 0,
            hits: res[state.category].hits,
            nbHits: res[state.category].nbHits,
          };
        }
        renderScoped();
      } else {
        renderAll();
      }
    } catch (err) {
      console.warn('wd-search: page query failed', err);
    }
  }

  mount.addEventListener('click', (ev) => {
    const pill = ev.target.closest('[data-wd-search-pill]');
    if (pill) {
      ev.preventDefault();
      navigate(pill.getAttribute('data-wd-search-pill') || '');
      return;
    }
    const showAll = ev.target.closest('[data-wd-search-show-all]');
    if (showAll) {
      ev.preventDefault();
      navigate(showAll.getAttribute('data-wd-search-show-all') || '');
    }
  });
  wireButtonKeys(mount);

  window.addEventListener('popstate', () => {
    readUrl();
    state.scoped = null;
    render();
  });

  // arrow visibility depends on overflow — recheck every row on resize by
  // re-firing its own scroll handler (no per-section window listeners to leak)
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      mount.querySelectorAll('[data-wd-search-row]').forEach((row) => {
        row.dispatchEvent(new Event('scroll'));
      });
    }, 150);
  });

  readUrl();
  render();

  return { render, navigate, state, mount };
}
