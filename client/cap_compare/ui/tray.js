// cap_compare — persistent compare tray, v2 per the Figma design
// (Compare-tab-v2, node 105:1088): a bottom-right "COMPARE MODELS (n)" bar
// that expands upward into the compare-models panel. Hidden entirely at
// count 0. Open/closed persists per tab session.

const OPEN_KEY = 'wd_compare_tray_open';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function compareHref(store, config) {
  const ids = store.ids();
  return ids.length ? `${config.comparePath}?ids=${ids.join(',')}` : config.comparePath;
}

function itemRow(store, id) {
  const info = store.cacheFor(id) || {};
  const img = info.image
    ? `<img class="wd-compare-tray_thumb" src="${esc(info.image)}" alt="" loading="lazy">`
    : '<span class="wd-compare-tray_thumb is-placeholder"></span>';
  return `<li class="wd-compare-tray_item">
    ${img}
    <span class="wd-compare-tray_item-text">
      <span class="wd-compare-tray_item-name">${esc(info.name || `Vehicle ${id}`)}</span>
      <span class="wd-compare-tray_item-variant">${esc(info.variant || '')}</span>
    </span>
    <button type="button" class="wd-compare-tray_remove" data-wd-compare-remove="${esc(id)}" aria-label="Remove ${esc(info.name || id)} from comparison">&times;</button>
  </li>`;
}

const CHEVRON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';

export function initTray(store, config) {
  if (document.querySelector('[data-wd-compare-tray]')) return null; // once per page
  const el = document.createElement('div');
  el.className = 'wd-compare-tray';
  el.setAttribute('data-wd-compare-tray', '');

  let open = sessionStorage.getItem(OPEN_KEY) === '1';

  function render() {
    const ids = store.ids();
    el.classList.toggle('is-empty', ids.length === 0);
    el.classList.toggle('is-open', open && ids.length > 0);
    el.innerHTML = `
      <section class="wd-compare-tray_panel" role="dialog" aria-label="Compare stock">
        <button type="button" class="wd-compare-tray_close" data-wd-compare-tray-close aria-label="Close compare panel">&times;</button>
        <p class="wd-compare-tray_added">${ids.length} out of ${store.max} added</p>
        <ul class="wd-compare-tray_list">${ids.map((id) => itemRow(store, id)).join('')}</ul>
        ${ids.length < store.max
          ? `<a class="wd-compare-tray_add-more" href="${esc(config.stockPath)}" data-wd-compare-add-more>Add another vehicle</a>`
          : ''}
        <a class="wd-compare-tray_cta" href="${esc(compareHref(store, config))}" data-wd-compare-cta>Compare now</a>
      </section>
      <button type="button" class="wd-compare-tray_bar" aria-expanded="${open ? 'true' : 'false'}" data-wd-compare-tray-toggle>
        <span class="wd-compare-tray_bar-label">Compare stock</span>
        <span class="wd-compare-tray_count" data-wd-compare-count>${ids.length}</span>
        <span class="wd-compare-tray_bar-chevron" aria-hidden="true">${CHEVRON}</span>
      </button>`;
  }

  function closePanel() {
    open = false;
    sessionStorage.setItem(OPEN_KEY, '0');
    el.classList.remove('is-open');
    el.querySelector('[data-wd-compare-tray-toggle]')?.setAttribute('aria-expanded', 'false');
  }

  el.addEventListener('click', (ev) => {
    // EM-94: panel ✕ closes; "Compare now" closes as it navigates so the tray
    // doesn't arrive on /compare still expanded (open state is per-session)
    if (ev.target.closest('[data-wd-compare-tray-close]')) {
      closePanel();
      return;
    }
    if (ev.target.closest('[data-wd-compare-cta]')) {
      closePanel(); // navigation proceeds via the anchor
      return;
    }
    const toggle = ev.target.closest('[data-wd-compare-tray-toggle]');
    if (toggle) {
      open = !open;
      sessionStorage.setItem(OPEN_KEY, open ? '1' : '0');
      // class flip only — a re-render would replace the panel node and kill
      // the CSS open/close transition
      el.classList.toggle('is-open', open && store.ids().length > 0);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    const remove = ev.target.closest('[data-wd-compare-remove]');
    if (remove) {
      store.remove(remove.getAttribute('data-wd-compare-remove'));
      return;
    }
    // "Add another vehicle" now always navigates to the stock page — the
    // compare page's in-stock grid it used to scroll to was removed
    // (Adam 2026-08-05)
  });

  store.subscribe(render);
  // page.js primes cached names/thumbs after fetching records
  window.addEventListener('wd-compare:primed', render);
  render();
  document.body.appendChild(el);
  return el;
}
