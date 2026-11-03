// cap_compare — the comparison page renderer. Mounts on
// <div data-wd-component="compare-page"></div>.
//
// 2026-07-31 (Josi ask): rendering is template-driven. Repeated patterns
// (slot cards, sticky entries, accordion sections, table rows/cells, stock
// cards) CLONE a template node and fill data-wd-bind marks — templates come
// from Webflow-authored DOM when the scaffold provides them (designers edit
// one instance, every clone inherits it) and from ui/templates.js BUILTIN
// strings otherwise (demo/protos render exactly as before). One engine, two
// template sources. JS owns data + state classes + functional attributes;
// Webflow owns structure + styling.
//
// Column system: slots, sticky bar, spec/feature tables all share the same
// 3-track grid so every section's columns align under their car at any
// count. Below 768px the table tracks gain a minimum width and each table
// sits in a scroll-synced overflow-x container.
import { parseIdsParam } from '../core/store.js';
import { fetchByIds } from '../core/data.js';
import { buildSpecColumn, metaLine } from '../core/spec-rows.js';
import { featureMatrix } from '../core/features.js';
import { dealershipInfo, loadDealerships } from '../core/dealerships.js';
import { createRegistry, fill, sectionInternals, bindTargets, ensureButtonSemantics, wireButtonKeys } from './templates.js';

const DASH = '—';
// No price in the feed (blank text or $0) → "P.O.A." — same rule as the stock cards
const priceText = (r) => (r.price_current_text && r.price_current_number !== 0) ? r.price_current_text : 'P.O.A.';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function firstRegion(record) {
  return Array.isArray(record.region) ? record.region[0] : record.region;
}

// The star glyph from the 2026-07-31 design's assets (colours now the
// stock/product pages' gold via CSS — Adam 2026-08-05): one star = the
// design's half-star path + a horizontal mirror of it, so half-star states
// are geometric — no clipping needed.
const STAR_HALF = 'M8.28892 12.2998H8.28794L3.55259 15.7598C3.30036 15.9429 2.96589 15.6938 3.0604 15.4023L4.88169 9.82129L0.132665 6.37793C-0.126222 6.19138 0.021029 5.78095 0.339696 5.7998L6.18247 5.80957L7.98423 0.222656C8.03206 0.0738286 8.16059 -0.00013182 8.28892 1.76365e-07V12.2998Z';

/** Star count → glyphs (is-full / is-half / is-empty) on a 5- or 6-star scale. */
function starsHtml(stars, outOf = 5) {
  if (stars == null) return `<span class="wd-compare_stars-missing">${DASH}</span>`;
  let out = `<span class="wd-compare_stars" role="img" aria-label="${esc(stars)} out of ${outOf} stars">`;
  for (let i = 1; i <= outOf; i += 1) {
    const state = stars >= i ? 'is-full' : stars >= i - 0.5 ? 'is-half' : 'is-empty';
    out += `<svg class="wd-compare_star ${state}" viewBox="0 0 16.58 15.82" width="17" height="16" aria-hidden="true">`
      + `<path class="wd-compare_star-left" d="${STAR_HALF}"/>`
      + `<path class="wd-compare_star-right" transform="translate(16.58 0) scale(-1 1)" d="${STAR_HALF}"/>`
      + '</svg>';
  }
  return `${out}</span>`;
}

function slotCard(tpl, record) {
  const region = firstRegion(record);
  const node = fill(tpl.clone('slot'), {
    image: { attrs: { src: record.mainImage || '', alt: record.name || '' } },
    region: region ? {} : null,
    'region-name': region ? { text: region } : undefined,
    remove: { attrs: { 'data-wd-compare-remove': record.objectID, 'aria-label': `Remove ${record.name} from comparison` } },
    title: record.name || '',
    variant: record.variant || '',
    meta: metaLine(record),
    price: priceText(record),
    // `orc: true` = the price already includes on-road costs (used/demo cars),
    // so "+ ORC" shows only when it is false — the same rule as the stock cards
    // (cms_stock search.js, cap_search stock-card.js). Pastel #53, 13 Oct.
    orc: record.orc ? null : {},
    link: { attrs: { href: record.url || '#', 'aria-label': `View ${record.name}` } },
  });
  node.setAttribute('data-wd-compare-slot', record.objectID);
  return node;
}

function emptySlot(tpl) {
  return tpl.clone('slot-empty');
}

function stickyEntry(tpl, record) {
  // bare design bar (2026-08-03, Josi: back to the on-page CTA stacks):
  // thumb + name + price + remove only. `enquire: null` also strips the
  // button from older authored Webflow templates that still carry it.
  return fill(tpl.clone('sticky-item'), {
    image: { attrs: { src: record.mainImage || '', alt: '' } },
    link: { attrs: { href: record.url || '#' } },
    name: record.name || '',
    price: priceText(record),
    enquire: null,
    remove: { attrs: { 'data-wd-compare-remove': record.objectID, 'aria-label': `Remove ${record.name} from comparison` } },
  });
}

/** Per-car CTA stack (2026-08-03 revert to the design's on-page buttons):
 *  Enquire now / Phone <dealership> / Book a test drive, column-aligned. */
function ctaStack(tpl, record) {
  const phone = dealershipInfo(record.dealership)?.phone;
  return fill(tpl.clone('cta-stack'), {
    enquire: { attrs: { href: record.url || '#' } },
    phone: phone ? { text: `Phone ${phone}`, attrs: { href: `tel:${phone.replace(/\s+/g, '')}` } } : null,
    'test-drive': { attrs: { href: record.url || '#' } },
  });
}

function ctaRow(tpl, records) {
  const node = tpl.clone('cta-row');
  const row = bindTargets(node, 'cta-row')[0] || node;
  records.forEach((r) => row.appendChild(ctaStack(tpl, r)));
  return node;
}

/** Fill one spec cell clone from a spec-rows cell descriptor. */
function specCell(cellProto, cell) {
  const node = cellProto.cloneNode(true);
  node.setAttribute('data-wd-spec', cell.key);
  const hasStars = 'stars' in cell;
  const hasValue = 'value' in cell || cell.na;
  // design: a trailing dollar amount in the sub-note reads bold ("…cost of $3,020")
  const subHtml = cell.sub ? esc(cell.sub).replace(/\$[\d,.]+$/, '<strong>$&</strong>') : '';
  fill(node, {
    label: { text: cell.label },
    stars: hasStars ? { html: starsHtml(cell.stars, cell.starsOutOf || 5) } : null,
    value: hasValue ? {} : null,
    sub: cell.sub ? { html: subHtml } : null,
    link: cell.link ? { text: cell.link.label, attrs: { href: cell.link.url } } : null,
  });
  const value = bindTargets(node, 'value')[0];
  if (value) {
    // na (non-applicable) renders "✕"; null value (no data) renders "—"
    if (cell.na) {
      value.classList.add('is-na');
      value.setAttribute('role', 'img');
      value.setAttribute('aria-label', 'Not applicable');
      value.textContent = '✕';
    } else {
      value.classList.toggle('is-missing', cell.value == null);
      value.textContent = cell.value == null ? DASH : String(cell.value);
    }
  }
  return node;
}

/** Feature cell = the spec cell template reduced to its value line. */
function featureCell(cellProto, name, has) {
  const node = cellProto.cloneNode(true);
  node.setAttribute('data-wd-compare-feature', name);
  fill(node, { label: null, stars: null, sub: null, link: null, value: {} });
  const value = bindTargets(node, 'value')[0];
  if (value) {
    value.classList.toggle('is-missing', !has);
    value.textContent = has ? name : DASH;
  }
  return node;
}

/** Accordion section shared by Quick Specs and every feature category. */
function buildSection(tpl, { key, title, open, last = false, extraAttrs = {} }, buildRows) {
  const node = tpl.clone('section');
  node.classList.add('is-collapsible');
  node.classList.toggle('is-open', open);
  node.classList.toggle('is-last', last);
  node.setAttribute('data-wd-compare-section', key);
  for (const [n, v] of Object.entries(extraAttrs)) node.setAttribute(n, v);
  fill(node, {
    title: { text: title },
    toggle: { attrs: { 'data-wd-compare-toggle': key, 'aria-expanded': String(open) } },
  });
  const { table, rowProto, cellProto } = sectionInternals(node);
  buildRows(table, rowProto, cellProto);
  return node;
}

function quickSpecs(tpl, records, config, open) {
  const columns = records.map((r) => buildSpecColumn(r, config));
  const node = buildSection(
    tpl,
    { key: 'quick-specs', title: 'Quick Specs', open, extraAttrs: { 'data-wd-compare-specs': '' } },
    (table, rowProto, cellProto) => {
      columns[0].forEach((_, i) => {
        const row = rowProto.cloneNode(true);
        columns.forEach((col) => row.appendChild(specCell(cellProto, col[i])));
        table.appendChild(row);
      });
    },
  );
  // EM-155 / EM-2 (Ebbett, 2026-09-03): no CTA stack inside Quick Specs any
  // more — it duplicated the bottom set. One row now closes the page (below
  // the feature sections when they exist, straight after the specs otherwise).
  return node;
}

function featureSections(tpl, records, openSections) {
  const matrix = featureMatrix(records);
  return matrix.map((section, i) => buildSection(
    tpl,
    {
      key: `features-${section.key}`,
      title: section.title,
      open: openSections.has(`features-${section.key}`),
      last: i === matrix.length - 1,
      extraAttrs: { 'data-wd-compare-feature-section': section.key },
    },
    (table, rowProto, cellProto) => {
      section.rows.forEach((row) => {
        const rowNode = rowProto.cloneNode(true);
        row.has.forEach((has) => rowNode.appendChild(featureCell(cellProto, row.name, has)));
        table.appendChild(rowNode);
      });
    },
  ));
}

export function initComparePage(mount, store, config) {
  // URL wins over storage, then stays in sync (shareable comparisons)
  const urlIds = parseIdsParam(window.location.search, store.max);
  if (urlIds.length) store.replaceAll(urlIds);

  const tpl = createRegistry(mount);
  // QA-inspectable: which template source is this page running on?
  mount.setAttribute('data-wd-tpl-authored', String(tpl.authored));

  // The shell (count line, slots, sticky bar, sections wrapper) is authored
  // in Webflow when the scaffold provides it; otherwise it is built once from
  // BUILTIN. It persists across renders — only the dynamic containers inside
  // it are re-filled. The "Return to all stock" affordance is a hero-component
  // button on the Webflow page, outside this shell (2026-08-05).
  let shell = mount.querySelector('[data-wd-compare-shell]');
  const authoredShell = Boolean(shell);
  if (!shell) {
    shell = fill(tpl.clone('shell'), {});
    mount.appendChild(shell);
  }
  const q = (sel) => shell.querySelector(sel);

  // 2026-08-03 (new mobile design): the slot row and the sticky bar ride the
  // same synced side-scroll as the tables, so every column stays under its
  // car. Functional attribute — JS-owned, works on authored shells too.
  q('[data-wd-compare-slots]')?.setAttribute('data-wd-compare-scroll', '');
  (q('[data-wd-compare-sticky-inner]') || q('.wd-compare_sticky-inner'))
    ?.setAttribute('data-wd-compare-scroll', '');

  const recordCache = new Map(); // objectID -> record (avoid refetching on re-render)
  let renderToken = 0;
  let stickyObserver = null;
  let notice = null; // one-shot line, e.g. "no longer available" (criterion 9)
  const openSections = new Set(['quick-specs']); // accordion state survives re-renders
  let sharedScrollLeft = 0; // mobile: all table scrollers move together

  // The sticky mini-bar should sit flush under the site nav. The nav height is
  // only knowable at runtime (responsive, proto vs dev vs live), so measure the
  // first fixed/sticky header and publish it via the CSS knob the stylesheet
  // already reads (--wd-compare-sticky-top); visuals stay fully in CSS.
  function applyStickyTop() {
    const selector = config.headerSelector || '[data-wd-compare-header], .w-nav, body > header, header';
    const header = document.querySelector(selector);
    if (!header) return;
    const style = getComputedStyle(header);
    if (style.position !== 'fixed' && style.position !== 'sticky') return;
    const rect = header.getBoundingClientRect();
    const top = style.position === 'sticky' ? Math.max(0, parseFloat(style.top) || 0) : Math.max(0, rect.top);
    document.documentElement.style.setProperty('--wd-compare-sticky-top', `${Math.round(top + rect.height)}px`);
  }

  // Persistent scrollers (slots, sticky bar) survive re-renders — wire each
  // element once and resolve the peer list at event time so stale nodes drop
  // out naturally. Table/CTA scrollers are recreated per render and re-wire.
  const wiredScrollers = new WeakSet();
  let syncingScroll = false;
  function wireScrollSync() {
    shell.querySelectorAll('[data-wd-compare-scroll]').forEach((el) => {
      el.scrollLeft = sharedScrollLeft;
      if (wiredScrollers.has(el)) return;
      wiredScrollers.add(el);
      el.addEventListener('scroll', () => {
        if (syncingScroll) return;
        syncingScroll = true;
        sharedScrollLeft = el.scrollLeft;
        shell.querySelectorAll('[data-wd-compare-scroll]').forEach((other) => {
          if (other !== el) other.scrollLeft = sharedScrollLeft;
        });
        requestAnimationFrame(() => { syncingScroll = false; });
      });
    });
  }

  function syncUrl() {
    const ids = store.ids();
    const url = new URL(window.location.href);
    if (ids.length) url.searchParams.set('ids', ids.join(','));
    else url.searchParams.delete('ids');
    history.replaceState(history.state, '', url);
  }

  function renderNotice() {
    q('[data-wd-compare-notice]')?.remove();
    if (!notice) return;
    const node = tpl.clone('notice');
    node.textContent = notice;
    const countLine = q('[data-wd-compare-count-line]');
    if (countLine) countLine.after(node);
    else shell.prepend(node);
  }

  async function render() {
    const token = ++renderToken;
    const ids = store.ids();
    syncUrl();

    const missing = ids.filter((id) => !recordCache.has(id));
    let dropped = [];
    if (missing.length) {
      // live dealership phones ride along with the first record fetch (cached after)
      const [result] = await Promise.all([fetchByIds(missing, config), loadDealerships(config)]);
      if (token !== renderToken) return; // superseded by a newer render
      result.records.forEach((r) => recordCache.set(String(r.objectID), r));
      dropped = result.dropped;
    }
    if (dropped.length) {
      // sold/unknown vehicles leave the comparison; store change re-renders
      notice = dropped.length === 1
        ? 'One vehicle in your comparison is no longer available and has been removed.'
        : `${dropped.length} vehicles in your comparison are no longer available and have been removed.`;
      dropped.forEach((id) => store.remove(id));
      return;
    }
    const records = ids.map((id) => recordCache.get(id)).filter(Boolean);
    records.forEach((r) => store.prime(String(r.objectID), {
      name: r.name,
      variant: r.variant,
      price: priceText(r),
      image: r.mainImage,
      region: firstRegion(r),
      url: r.url,
    }));
    window.dispatchEvent(new CustomEvent('wd-compare:primed'));
    const n = records.length;

    const countLine = q('[data-wd-compare-count-line]');
    if (countLine) countLine.textContent = `Comparing ${n} of ${store.max}`;
    renderNotice();

    q('[data-wd-compare-slots]')?.replaceChildren(
      ...records.map((r) => slotCard(tpl, r)),
      ...Array.from({ length: store.max - n }, () => emptySlot(tpl)),
    );
    (q('[data-wd-compare-sticky-inner]') || q('.wd-compare_sticky-inner'))
      ?.replaceChildren(...records.map((r) => stickyEntry(tpl, r)));

    const sections = [];
    if (n) {
      sections.push(quickSpecs(tpl, records, config, openSections.has('quick-specs')));
      const features = featureSections(tpl, records, openSections);
      // one CTA row, always last (EM-155): after the feature sections when
      // they exist, straight after Quick Specs otherwise
      sections.push(...features, ctaRow(tpl, records));
      if (features.length) sections.push(tpl.clone('features-note'));
    }
    q('[data-wd-compare-sections]')?.replaceChildren(...sections);

    notice = null; // one-shot: shown on the render right after the drop
    ensureButtonSemantics(shell); // authored <button>s arrive as <a> from Webflow
    wireScrollSync();

    // sticky mini-bar shows once the slot row has scrolled off the top
    stickyObserver?.disconnect();
    const slots = q('[data-wd-compare-slots]');
    const sticky = q('[data-wd-compare-stickybar]');
    if (slots && sticky && n) {
      stickyObserver = new IntersectionObserver(([entry]) => {
        const visible = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
        sticky.classList.toggle('is-visible', visible);
        if (visible) {
          // it missed any horizontal sync while display:none
          sticky.querySelectorAll('[data-wd-compare-scroll]').forEach((el) => { el.scrollLeft = sharedScrollLeft; });
        }
      });
      stickyObserver.observe(slots);
    }
  }

  mount.addEventListener('click', (ev) => {
    // authored controls may be <a> elements — never let them navigate
    const control = ev.target.closest('[data-wd-compare-toggle], [data-wd-compare-remove], [data-wd-compare-add-slot], [data-wd-compare-add]');
    if (control && control.tagName === 'A') ev.preventDefault();
    const toggle = ev.target.closest('[data-wd-compare-toggle]');
    if (toggle) {
      const key = toggle.getAttribute('data-wd-compare-toggle');
      const section = toggle.closest('[data-wd-compare-section]');
      const open = !openSections.has(key);
      if (open) openSections.add(key);
      else openSections.delete(key);
      section?.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open && section) {
        // freshly shown scrollers missed any sync while display:none
        section.querySelectorAll('[data-wd-compare-scroll]').forEach((el) => { el.scrollLeft = sharedScrollLeft; });
      }
      return;
    }
    const remove = ev.target.closest('[data-wd-compare-remove]');
    if (remove) {
      store.remove(remove.getAttribute('data-wd-compare-remove'));
      return;
    }
    const addSlot = ev.target.closest('[data-wd-compare-add-slot]');
    if (addSlot) {
      // the in-stock grid is gone (Adam 2026-08-05) — adding means browsing stock
      window.location.href = config.stockPath;
      return;
    }
    const add = ev.target.closest('[data-wd-compare-add]');
    if (add) {
      const id = add.getAttribute('data-wd-compare-add');
      const res = store.add(id);
      if (!res.ok && res.reason === 'full') {
        add.classList.add('is-rejected');
        setTimeout(() => add.classList.remove('is-rejected'), 600);
      }
    }
  });

  applyStickyTop();
  wireButtonKeys(mount);
  window.addEventListener('resize', applyStickyTop);
  store.subscribe(render);
  render();
}
