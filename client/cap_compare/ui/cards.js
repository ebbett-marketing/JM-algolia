// cap_compare — "Add to compare" buttons on stock grid cards.
// Zero-contact integration with 02's search pipeline: we observe the DOM for
// rendered cards and parse the objectID from the card link (…-{objectID}).
//
// 2026-07-31 (Josi ask): the button can now be AUTHORED inside the Stock Card
// Webflow component — mark it [data-wd-compare-btn] and cards.js hydrates it
// (id, state, icon) instead of injecting one, so designers own its
// structure/style in the Designer. Injection remains the fallback for any
// card without an authored button (live site pre-scaffold, protos, demo).
//
// 2026-08-05 (Adam bug — sort-flip instability): Algolia re-renders REUSE and
// CLONE card DOM. A cloned card carries a copy of the button with the old
// car's id + tick state and NO listeners (cloneNode drops them), so ticks
// appeared on never-added cars and clicks fell through to the product page.
// Two structural fixes:
//   1. decorateCard re-syncs id/state on EVERY scan (no early-out on an
//      existing button) — stale ids and phantom ticks self-heal.
//   2. Activation is DELEGATED (capture, document level), never per-button —
//      cloned buttons work without ever being re-wired.
//
// 2026-09-07 (EM-240, Vanessa + Su-Anne): the injected button moved from the
// image's top-right corner to the card's bottom-right, REPLACING the "View
// details" arrow (compare.css hides .wd-view-details / .button.is-news-link
// inside a decorated card; the whole card is the link anyway). That retires
// the old Save-banner collision handling (.is-bumped) — nothing shares that
// corner now, so the buttons line up across a row whether or not a car is
// discounted. The host is the card <a> itself.
//
// `decorateCard(el, hit, store, config)` is also exported as the coordinated
// hook for cms_stock/search.js to call directly later (one-liner, optional).
import { ADD_ICON_SVG, ensureButtonSemantics } from './templates.js';

const CARD_SELECTOR = 'a[ais-item="template"], a[href*="/product/"], a[href*="/inventory/"]';
// zones with their own delegates (compare page, tray) or no buttons (spotlight).
// EM-388 / EM-389 (Vanessa, 2026-09-17): .vehicle-models_list is the site's
// MODEL-card layout; the EV range page pours stock hits (/inventory/ links)
// into it and wants those cards to look like every other model card — no
// compare button.
const FOREIGN_ZONES = '[data-wd-component="compare-page"], .wd-compare_page, [data-wd-compare-tray], [data-wd-search-overlay], .vehicle-models_list';

export function objectIdFromHref(href) {
  const m = typeof href === 'string' ? href.match(/-(\d+)(?:[/?#]|$)/) : null;
  return m ? m[1] : null;
}

/** Read tray-cache display info off a rendered card. Best-effort per field. */
export function extractCardInfo(card) {
  const text = (sel) => card.querySelector(sel)?.textContent.trim() || null;
  return {
    name: text('[ais-item="name"]') || text('h3') || null,
    variant: text('[ais-item="variant"]'),
    price: text('[ais-item="price-current"]') || text('[ais-item="price-special"]'),
    image: card.querySelector('[ais-item="image"]')?.src || card.querySelector('img')?.src || null,
    region: text('[ais-item="region"]'),
    url: card.getAttribute('href') || null,
  };
}

// Pastel #51 (Alex, 13 Oct): an authored [data-wd-compare-btn] OUTSIDE any stock
// card — the vehicle page's "Add to compare" — compares the page's own car. Its
// id comes from the URL (/inventory/…-{objectID}); the tray's name/variant/thumb
// come from the page (the compare page re-primes them from Algolia anyway).
const standaloneButtons = new WeakSet();

function pageCarInfo(id) {
  const h1 = document.querySelector('.stock_detail-header h1') || document.querySelector('h1');
  const variant = h1?.nextElementSibling;
  const img = document.querySelector(`img[src*="elsp-${id}-"]`);
  return {
    name: h1?.textContent.trim() || null,
    variant: variant && !variant.matches('h1, h2, h3') ? variant.textContent.trim() || null : null,
    price: null,
    image: img ? (img.currentSrc || img.src) : null,
    region: null,
    url: location.pathname,
  };
}

function decorateStandalone(btn, store) {
  const id = objectIdFromHref(location.pathname);
  if (!id) return;
  standaloneButtons.add(btn);
  btn.setAttribute('data-wd-compare-add', id);
  const icon = btn.querySelector('[class*="add-icon"]');
  if (icon && !icon.firstElementChild) icon.innerHTML = ADD_ICON_SVG;
  ensureButtonSemantics(btn);
  buttonState(btn, store.has(id));
}

function buttonState(btn, added) {
  btn.classList.toggle('is-added', added);
  btn.setAttribute('aria-pressed', added ? 'true' : 'false');
  const label = btn.querySelector('[data-wd-compare-add-label]');
  if (label) label.textContent = added ? 'Added to compare' : 'Add to compare';
}

function buildButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'wd-compare_add';
  btn.innerHTML =
    '<span class="wd-compare_add-label" data-wd-compare-add-label>Add to compare</span>'
    + '<span class="wd-compare_add-icon" aria-hidden="true"></span>';
  return btn;
}

export function decorateCard(card, hit, store, config) {
  if (!card) return;
  const id = hit?.objectID != null ? String(hit.objectID) : objectIdFromHref(card.getAttribute('href'));
  let btn = card.querySelector('[data-wd-compare-add]');

  if (!id) {
    // a re-render cloned a decorated card into an id-less one (e.g. back into
    // the pristine grid template): injected debris goes, authored buttons reset
    // — otherwise the template propagates a ticked button to EVERY next clone
    if (btn) {
      if (btn.hasAttribute('data-wd-compare-btn')) {
        btn.removeAttribute('data-wd-compare-add');
        buttonState(btn, false);
      } else {
        btn.remove();
      }
    }
    return;
  }

  if (!btn) {
    // authored button (Stock Card component) wins; otherwise inject one
    const authored = card.querySelector('[data-wd-compare-btn]');
    btn = authored || buildButton();
    // injected: the card itself hosts the button (bottom-right, EM-240);
    // authored: whatever the Designer wrapped it in
    const host = authored ? (btn.parentElement || card) : card;
    host.classList.add('wd-compare_add-host');
    if (!authored) host.appendChild(btn);
  }

  // ALWAYS re-sync — never trust what a reused/cloned node already carries
  btn.setAttribute('data-wd-compare-add', id);
  const icon = btn.querySelector('[class*="add-icon"]');
  if (icon && !icon.firstElementChild) icon.innerHTML = ADD_ICON_SVG;
  ensureButtonSemantics(btn); // authored <button>s arrive as <a> from Webflow
  buttonState(btn, store.has(id));
}

function scan(root, store, config) {
  for (const card of root.querySelectorAll(CARD_SELECTOR)) {
    // compare-page internals render their own controls — never decorate those
    // (cap_search's spotlight minis are /product/ links too — no buttons there,
    // Josi 2026-08-03; the /site-search page grid is fair game)
    if (card.closest(FOREIGN_ZONES)) continue;
    // EM-388/389: Adam's EV range page clones its model-card template
    // (a.vehicle-models_link) into #ais_results, outside any model list —
    // the card's own class is the tell.
    if (card.matches('.vehicle-models_link')) continue;
    decorateCard(card, null, store, config);
  }
  for (const btn of root.querySelectorAll('[data-wd-compare-btn]')) {
    if (btn.closest(CARD_SELECTOR) || btn.closest(FOREIGN_ZONES)) continue;
    decorateStandalone(btn, store);
  }
}

export function initCardButtons(store, config, root = document) {
  scan(root, store, config);

  const host = root === document ? document : root;

  // Delegated activation, capture phase: runs for every current AND future
  // button (cloned ones included) and ahead of any card-level handlers —
  // matching the old per-button listener's first-in-line semantics.
  const grabButton = (ev) => {
    const btn = ev.target.closest?.('[data-wd-compare-add]');
    return btn && !btn.closest(FOREIGN_ZONES) ? btn : null;
  };
  host.addEventListener('click', (ev) => {
    const btn = grabButton(ev);
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const card = btn.closest(CARD_SELECTOR) || btn.closest('a') || btn;
    // prefer the card's CURRENT href — a click can land between a re-render
    // mutation and the rAF-batched scan that re-syncs the button's id
    const id = objectIdFromHref(card.getAttribute?.('href')) || btn.getAttribute('data-wd-compare-add');
    const info = standaloneButtons.has(btn) ? pageCarInfo(id) : extractCardInfo(card);
    const res = store.toggle(id, info);
    if (!res.ok && res.reason === 'full') {
      btn.classList.add('is-rejected');
      setTimeout(() => btn.classList.remove('is-rejected'), 600);
      document.querySelector('[data-wd-compare-tray]')?.classList.add('is-nudged');
      setTimeout(() => document.querySelector('[data-wd-compare-tray]')?.classList.remove('is-nudged'), 900);
    }
  }, true);
  host.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const btn = grabButton(ev);
    if (!btn) return;
    ev.preventDefault();
    btn.click();
  }, true);

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan(root, store, config);
    });
  });
  observer.observe(root === document ? document.body : root, { childList: true, subtree: true });

  // keep every button's state honest when the list changes anywhere (tray, page…)
  store.subscribe(() => {
    for (const btn of (root === document ? document : root).querySelectorAll('[data-wd-compare-add]')) {
      buttonState(btn, store.has(btn.getAttribute('data-wd-compare-add')));
    }
  });
  return observer;
}
