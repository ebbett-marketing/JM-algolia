// cap_compare — template registry + clone/bind engine (2026-07-31, Josi ask:
// "make more of the DOM editable in Webflow").
//
// Every repeated pattern on the compare page renders by CLONING a template
// node and filling marked descendants. Templates come from two sources:
//   1. Webflow-authored DOM inside the mount: a hidden wrapper
//      [data-wd-compare-templates] holding one authored instance of each
//      pattern, marked data-wd-tpl="<key>". Designers restyle/extend the ONE
//      instance in the Designer and every clone inherits it.
//   2. BUILTIN strings below (identical markup) when no authored template
//      exists — the demo, protos and any page without the Webflow scaffold
//      render exactly as before. The BUILTIN block is also the canonical
//      source used to author the Webflow templates (keep them in sync).
//
// Contract: JS owns data, state classes (is-open/is-missing/…) and functional
// attributes (data-wd-compare-*); Webflow owns structure and styling. Fill
// targets are marked data-wd-bind="<name>" — designers may move or delete
// them (a missing bind is skipped, never an error), but must keep the marks
// on whatever should carry the data.

export const BUILTIN = {
  // No back link / in-stock section here: the "Return to all stock"
  // affordance is a hero-component button on the Webflow page (2026-08-05).
  shell: `<div class="wd-compare_page" data-wd-compare-shell>
    <p class="wd-compare_count" data-wd-compare-count-line>Comparing 0 of 3</p>
    <div class="wd-compare_slots" data-wd-compare-slots></div>
    <div class="wd-compare_stickybar" data-wd-compare-stickybar>
      <div class="wd-compare_sticky-inner" data-wd-compare-sticky-inner></div>
    </div>
    <div class="wd-compare_sections" data-wd-compare-sections></div>
  </div>`,

  slot: `<article class="wd-compare_slot">
    <div class="wd-compare_slot-media">
      <img class="wd-compare_slot-image" data-wd-bind="image" src="" alt="" loading="lazy">
      <span class="wd-compare_slot-region" data-wd-bind="region"><span data-wd-bind="region-name"></span> <svg viewBox="0 0 384 512" width="11" height="14" fill="currentColor" aria-hidden="true"><path d="M172.3 501.7C27 291 0 269.4 0 192 0 86 86 0 192 0s192 86 192 192c0 77.4-27 99-172.3 309.7-9.5 13.8-29.9 13.8-39.4 0z"/></svg></span>
      <button type="button" class="wd-compare_slot-remove" data-wd-bind="remove">&times;</button>
    </div>
    <h3 class="wd-compare_slot-title" data-wd-bind="title"></h3>
    <p class="wd-compare_slot-variant" data-wd-bind="variant"></p>
    <p class="wd-compare_slot-meta" data-wd-bind="meta"></p>
    <div class="wd-compare_slot-pricing">
      <span class="wd-compare_slot-price" data-wd-bind="price"></span>
      <span class="wd-compare_slot-orc" data-wd-bind="orc">+ ORC</span>
      <a class="wd-compare_slot-link" data-wd-bind="link" href="#"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>
    </div>
  </article>`,

  'slot-empty': `<button type="button" class="wd-compare_slot is-empty" data-wd-compare-add-slot>
    <span class="wd-compare_slot-add-label">+ Add vehicle</span>
  </button>`,

  'sticky-item': `<div class="wd-compare_sticky-item">
    <img class="wd-compare_sticky-thumb" data-wd-bind="image" src="" alt="" loading="lazy">
    <a class="wd-compare_sticky-name" data-wd-bind="link" href="#"><span data-wd-bind="name"></span> <span aria-hidden="true">&rsaquo;</span></a>
    <span class="wd-compare_sticky-price" data-wd-bind="price"></span>
    <button type="button" class="wd-compare_sticky-remove" data-wd-bind="remove">&times;</button>
  </div>`,

  'cta-row': `<div class="wd-compare_table-scroll" data-wd-compare-scroll>
    <div class="wd-compare_cta-row" data-wd-compare-cta-row data-wd-bind="cta-row"></div>
  </div>`,

  'cta-stack': `<div class="wd-compare_ctas">
    <a class="wd-compare_cta is-primary" data-wd-bind="enquire" href="#">Enquire now</a>
    <a class="wd-compare_cta" data-wd-bind="phone" href="#">Phone</a>
    <a class="wd-compare_cta" data-wd-bind="test-drive" href="#">Book a test drive</a>
  </div>`,

  section: `<section class="wd-compare_section is-collapsible">
    <h2 class="wd-compare_heading">
      <button type="button" class="wd-compare_section-toggle" data-wd-bind="toggle" aria-expanded="false">
        <span class="wd-compare_section-title" data-wd-bind="title"></span>
        <svg class="wd-compare_section-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    </h2>
    <div class="wd-compare_section-body">
      <div class="wd-compare_table-scroll" data-wd-compare-scroll>
        <div class="wd-compare_table" data-wd-bind="table">
          <div class="wd-compare_table-row" data-wd-tpl="row">
            <div class="wd-compare_spec-cell" data-wd-tpl="spec-cell">
              <span class="wd-compare_spec-label" data-wd-bind="label"></span>
              <span class="wd-compare_spec-stars" data-wd-bind="stars"></span>
              <span class="wd-compare_spec-value" data-wd-bind="value"></span>
              <span class="wd-compare_spec-sub" data-wd-bind="sub"></span>
              <a class="wd-compare_spec-link" data-wd-bind="link" target="_blank" rel="noopener"></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`,

  'features-note': `<p class="wd-compare_features-note" data-wd-compare-features-note>*Please note, not all used models have features listed.</p>`,

  notice: `<p class="wd-compare_notice" data-wd-compare-notice></p>`,

  // NOTE (2026-08-05, Adam): the 'stock-card' template + the in-stock
  // heading/subtitle/grid were removed with the "Currently in stock" section.
  // The markup is archived on the dev Webflow page
  // "Unused comparison tool components" (Development folder) and in git
  // history should the section ever come back.
};

// The +/tick icon cards.js injects into empty [class*="add-icon"] spans —
// kept here so authored buttons never need an inline SVG in Webflow.
export const ADD_ICON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path class="wd-compare_add-plus" d="M12 5v14M5 12h14"/><path class="wd-compare_add-tick" d="M5 13l4 4L19 7"/></svg>';

function fromString(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/**
 * Build the template registry for a mount. Authored nodes (inside the hidden
 * [data-wd-compare-templates] wrapper, or anywhere under the mount) win over
 * BUILTIN. Nested templates (row/spec-cell inside section) resolve lazily via
 * the section template itself, so they follow whichever source section used.
 */
export function createRegistry(mount) {
  const authored = {};
  (mount || document.createElement('div')).querySelectorAll('[data-wd-tpl]').forEach((el) => {
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
 *   { text, html, attrs: {n:v}, keep: true } -> granular fill
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

/**
 * Webflow authors <button> markup as Link (<a>) elements. Give authored
 * control clones button semantics so keyboard users can reach them; real
 * <button>s (the BUILTIN path) are untouched. Pair with a delegated
 * keydown that forwards Enter/Space to click().
 */
export function ensureButtonSemantics(root) {
  const CONTROLS = '[data-wd-compare-remove], [data-wd-compare-toggle], [data-wd-compare-add-slot], [data-wd-compare-add], [data-wd-compare-btn]';
  const list = [...root.querySelectorAll(CONTROLS)];
  if (root.matches?.(CONTROLS)) list.unshift(root);
  for (const el of list) {
    const href = el.getAttribute('href');
    // Webflow gives authored links a placeholder href="#" — strip it so
    // clicks can't hash-navigate/scroll-jump; keydown activation covers Enter/Space
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

/**
 * Extract the row + cell prototypes out of a section clone and empty its
 * table. Returns { table, rowProto, cellProto } (all non-null: falls back to
 * BUILTIN section internals when a designer stripped them from the authored
 * section).
 */
export function sectionInternals(sectionClone) {
  let table = bindTargets(sectionClone, 'table')[0]
    || sectionClone.querySelector('.wd-compare_table');
  if (!table) {
    // authored section lost its table — rebuild the body from BUILTIN
    const rebuilt = fromString(BUILTIN.section);
    const body = sectionClone.querySelector('.wd-compare_section-body');
    const freshBody = rebuilt.querySelector('.wd-compare_section-body');
    if (body) body.replaceWith(freshBody);
    else sectionClone.appendChild(freshBody);
    table = bindTargets(sectionClone, 'table')[0];
  }
  let rowProto = table.querySelector('[data-wd-tpl="row"]') || table.firstElementChild;
  if (!rowProto) rowProto = fromString(BUILTIN.section).querySelector('[data-wd-tpl="row"]');
  rowProto = rowProto.cloneNode(true);
  rowProto.removeAttribute('data-wd-tpl');
  let cellProto = rowProto.querySelector('[data-wd-tpl="spec-cell"]') || rowProto.firstElementChild;
  if (!cellProto) cellProto = fromString(BUILTIN.section).querySelector('[data-wd-tpl="spec-cell"]');
  cellProto = cellProto.cloneNode(true);
  cellProto.removeAttribute('data-wd-tpl');
  rowProto.textContent = '';
  table.textContent = '';
  return { table, rowProto, cellProto };
}
