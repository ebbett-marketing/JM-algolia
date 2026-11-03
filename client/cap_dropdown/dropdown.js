/**
 * cap_dropdown — dependency-free searchable dropdown (Select2 replacement).
 *
 * Progressively enhances the three dealership selects previously initialised
 * by lib_select2 (#field-dealership, #field-ebbett-finance,
 * #nav_service-dropdown): builds options from the CMS-rendered lists already
 * in the page, renders a searchable custom control, and keeps the native
 * <select> as the form value source (real `change` events, so form-utils.js
 * and Webflow forms are untouched).
 *
 * Zero external dependencies — no libraries, no CDN loads. See README.md.
 */
(function () {
  'use strict';

  var currentScript = document.currentScript;

  // EM-70 (2026-09-03): the nav's Contact modal select joins the set. Its
  // options come from the same hidden dealership list the Service modal uses
  // ([data-select2-service="item"]), and picking one clones that dealership's
  // details block into [data-contact-nav="wrapper"] — same pattern as the
  // Service modal's [data-service-nav="wrapper"].
  var TARGETS = ['#field-dealership', '#field-ebbett-finance', '#nav_service-dropdown', '#nav_contact-dropdown'];
  // EM-278 (Alex, 2026-09-07): match the native selects beside it, whose empty
  // first option reads "Please select...". A select whose own empty option
  // carries text keeps that text (editable in Webflow); this is the fallback.
  var PLACEHOLDER = 'Please select...';
  var initialized = false;

  // --- module CSS (served from this module's folder) ------------------------
  function injectStyles() {
    if (document.getElementById('wd-dropdown-css')) return;
    var base = currentScript && currentScript.src
      ? currentScript.src.replace(/\/[^/]*$/, '')
      : '';
    var link = document.createElement('link');
    link.id = 'wd-dropdown-css';
    link.rel = 'stylesheet';
    link.href = base + '/dropdown.css';
    document.head.appendChild(link);
  }

  // --- CMS option building (parity with legacy select2.js) ------------------
  function textOf(row, attr, field) {
    var el = row.querySelector('[' + attr + '="' + field + '"]');
    return el ? el.textContent.trim() : '';
  }

  function findOptgroup(select, label) {
    var groups = select.querySelectorAll('optgroup');
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].label === label) return groups[i];
    }
    return null;
  }

  function hasOptionValue(select, value) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === value) return true;
    }
    return false;
  }

  function appendSelectOption(selector, name, region, details, url) {
    var select = document.querySelector(selector);
    if (!select || select.tagName !== 'SELECT' || !name) return;
    if (hasOptionValue(select, name)) return; // idempotent: snapshot/BFCache safe

    var group = findOptgroup(select, region);
    if (!group) {
      group = document.createElement('optgroup');
      group.label = region;
      select.appendChild(group);
    }
    var option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    option.setAttribute('data-subtext', details);
    option.setAttribute('data-select2-url', url);
    group.appendChild(option);
  }

  function buildOptionsFromCms() {
    // /service-select + /ebbett-finance reference lists
    document.querySelectorAll('[data-select2="item"]').forEach(function (row) {
      var name = textOf(row, 'data-select2', 'dealership');
      var region = textOf(row, 'data-select2', 'region');
      var details = textOf(row, 'data-select2', 'details');
      // CMS uses finance-url; keep "url" as fallback for older markup
      var url = textOf(row, 'data-select2', 'finance-url') || textOf(row, 'data-select2', 'url');
      appendSelectOption('#field-dealership', name, region, details, url);
      appendSelectOption('#field-ebbett-finance', name, region, details, url);
    });
    // sitewide nav service modal list
    document.querySelectorAll('[data-select2-service="item"]').forEach(function (row) {
      var name = textOf(row, 'data-select2-service', 'dealership');
      var region = textOf(row, 'data-select2-service', 'region');
      var details = textOf(row, 'data-select2-service', 'details');
      appendSelectOption('#nav_service-dropdown', name, region, details, '');
      appendSelectOption('#nav_contact-dropdown', name, region, details, '');
    });
  }

  // --- legacy artifact cleanup ----------------------------------------------
  // Snapshots (and any page where Select2 ran before us) carry the rendered
  // Select2 widget + classes; the pristine live page has neither.
  function cleanupLegacy(select) {
    // keep the marker class ON: if the legacy select2.js tag is still present
    // (dev during transition), its initialiser skips selects carrying it, so
    // no second widget gets mounted next to ours
    select.classList.add('select2-hidden-accessible');
    select.removeAttribute('data-select2-id');
    var parent = select.parentElement;
    if (parent) {
      parent.querySelectorAll(':scope > .select2-container').forEach(function (el) {
        el.remove();
      });
    }
  }

  // --- component --------------------------------------------------------------
  function optionLabel(option) {
    return {
      title: option.textContent.trim(),
      subtitle: option.getAttribute('data-subtext') || ''
    };
  }

  function placeholderFor(select) {
    var first = select && select.options[0];
    var text = first && !first.value ? first.textContent.trim() : '';
    return text || PLACEHOLDER;
  }

  function renderValue(container, option, select) {
    container.textContent = '';
    if (!option || !option.value) {
      var ph = document.createElement('span');
      ph.className = 'wd-dropdown_placeholder';
      ph.textContent = placeholderFor(select);
      container.appendChild(ph);
      return;
    }
    var label = optionLabel(option);
    var wrap = document.createElement('span');
    wrap.className = 'option';
    var title = document.createElement('span');
    title.className = 'option-title';
    title.textContent = label.title;
    wrap.appendChild(title);
    if (label.subtitle) {
      var sub = document.createElement('span');
      sub.className = 'option-subtitle';
      sub.textContent = label.subtitle;
      wrap.appendChild(sub);
    }
    container.appendChild(wrap);
  }

  function enhance(select) {
    // Dealership pages reuse the ID #field-dealership for a hidden <input>
    // (the enquiry form's prefilled carrier) — only real selects enhance
    if (!select || select.tagName !== 'SELECT') return;
    if (select.dataset.wdDropdown === 'bound') return;
    select.dataset.wdDropdown = 'bound';
    cleanupLegacy(select);

    var idBase = select.id || 'wd-dd-' + Math.random().toString(36).slice(2, 8);

    // hide the native select but keep it in the DOM as the form value source
    select.classList.add('wd-dropdown_native');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    var root = document.createElement('div');
    root.className = 'wd-dropdown';
    root.setAttribute('data-wd-dropdown-for', idBase);

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'wd-dropdown_toggle';
    toggle.setAttribute('role', 'combobox');
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', idBase + '-listbox');

    var valueSpan = document.createElement('span');
    valueSpan.className = 'wd-dropdown_value';
    toggle.appendChild(valueSpan);

    var arrow = document.createElement('span');
    arrow.className = 'wd-dropdown_arrow';
    arrow.setAttribute('aria-hidden', 'true');
    toggle.appendChild(arrow);

    var panel = document.createElement('div');
    panel.className = 'wd-dropdown_panel';
    panel.hidden = true;

    var search = document.createElement('input');
    search.type = 'text';
    search.className = 'wd-dropdown_search';
    search.setAttribute('role', 'combobox');
    search.setAttribute('aria-autocomplete', 'list');
    search.setAttribute('aria-expanded', 'true');
    search.setAttribute('aria-controls', idBase + '-listbox');
    search.setAttribute('aria-label', 'Search dealerships');
    search.autocomplete = 'off';

    var list = document.createElement('ul');
    list.className = 'wd-dropdown_list';
    list.id = idBase + '-listbox';
    list.setAttribute('role', 'listbox');

    panel.appendChild(search);
    panel.appendChild(list);
    root.appendChild(toggle);
    root.appendChild(panel);
    select.insertAdjacentElement('afterend', root);

    renderValue(valueSpan, select.selectedOptions[0] || null, select);

    var activeIndex = -1; // index into currently visible option <li>s

    function optionItems() {
      return Array.prototype.slice.call(list.querySelectorAll('li[role="option"]'));
    }
    function visibleItems() {
      return optionItems().filter(function (li) { return !li.hidden; });
    }

    function renderList() {
      list.textContent = '';
      var counter = 0;
      var seen = Object.create(null); // legacy select2.js appends without dedupe
      Array.prototype.forEach.call(select.children, function (child) {
        if (child.tagName === 'OPTGROUP') {
          var header = document.createElement('li');
          header.className = 'wd-dropdown_group-label';
          header.setAttribute('role', 'presentation');
          header.textContent = child.label;
          list.appendChild(header);
          Array.prototype.forEach.call(child.children, function (opt) {
            appendItem(opt, child.label);
          });
        } else if (child.tagName === 'OPTION' && child.value) {
          appendItem(child, '');
        }
      });

      function appendItem(opt, groupLabel) {
        if (seen[opt.value]) return;
        seen[opt.value] = true;
        var li = document.createElement('li');
        li.dataset.group = groupLabel;
        li.id = idBase + '-opt-' + counter++;
        li.setAttribute('role', 'option');
        li.dataset.value = opt.value;
        li.setAttribute('aria-selected', String(opt.value === select.value));
        if (opt.value === select.value) li.classList.add('is-selected');
        var label = optionLabel(opt);
        var wrap = document.createElement('div');
        wrap.className = 'option';
        var title = document.createElement('span');
        title.className = 'option-title';
        title.textContent = label.title;
        wrap.appendChild(title);
        var sub = document.createElement('span');
        sub.className = 'option-subtitle';
        sub.textContent = label.subtitle;
        wrap.appendChild(sub);
        li.appendChild(wrap);
        list.appendChild(li);
      }
    }

    function fold(text) {
      // case- and diacritic-insensitive ("skoda" matches "Škoda")
      return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function applyFilter(query) {
      var q = fold(query.trim());
      var anyVisible = false;
      var items = optionItems();
      items.forEach(function (li) {
        // match every string an option shows: title, subtitle (brands) and
        // its region group label — so "Auckland" surfaces the whole group
        var haystack = li.querySelector('.option-title').textContent + ' ' +
          li.querySelector('.option-subtitle').textContent + ' ' +
          (li.dataset.group || '');
        li.hidden = q !== '' && fold(haystack).indexOf(q) === -1;
        if (!li.hidden) anyVisible = true;
      });
      // hide group headers whose whole group is filtered out
      list.querySelectorAll('.wd-dropdown_group-label').forEach(function (header) {
        var sibling = header.nextElementSibling;
        var groupVisible = false;
        while (sibling && sibling.getAttribute('role') === 'option') {
          if (!sibling.hidden) { groupVisible = true; break; }
          sibling = sibling.nextElementSibling;
        }
        header.hidden = !groupVisible;
      });
      var empty = list.querySelector('.wd-dropdown_empty');
      if (empty) empty.remove();
      if (!anyVisible) {
        var li = document.createElement('li');
        li.className = 'wd-dropdown_empty';
        li.setAttribute('role', 'presentation');
        li.textContent = 'No results found';
        list.appendChild(li);
      }
      setActive(anyVisible ? 0 : -1);
    }

    function setActive(index) {
      var items = visibleItems();
      optionItems().forEach(function (li) { li.classList.remove('is-active'); });
      activeIndex = index;
      if (index < 0 || index >= items.length) {
        search.removeAttribute('aria-activedescendant');
        return;
      }
      var li = items[index];
      li.classList.add('is-active');
      search.setAttribute('aria-activedescendant', li.id);
      if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    }

    function open() {
      if (!panel.hidden) return;
      renderList();
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      root.classList.add('is-open');
      // Webflow sections later in the DOM paint over earlier ones; raise the
      // section this dropdown lives in while the panel is open (CSS handles
      // the visuals — state-class rule)
      // EM-70 follow-up: only raise a normally-flowing section. Modal
      // overlays (position fixed/absolute, e.g. the nav's .nav_modal_contact)
      // must keep their own positioning — the raise class's
      // position:relative yanked the contact modal into the page flow.
      var section = root.closest('section, [class*="section_"]');
      if (section) {
        section.classList.add('wd-dropdown_section-raised');
        // position:relative only for a normally-flowing section; a modal
        // overlay (absolute/fixed) keeps its own positioning and just wins
        // on z-index
        if (getComputedStyle(section).position === 'static') section.classList.add('wd-dropdown_section-static');
      }
      search.value = '';
      applyFilter('');
      // start active on the selected option if present
      var items = visibleItems();
      var selected = items.findIndex(function (li) { return li.dataset.value === select.value; });
      setActive(selected >= 0 ? selected : (items.length ? 0 : -1));
      search.focus();
      document.addEventListener('pointerdown', onOutsidePointer, true);
    }

    function close(refocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
      var section = root.closest('section, [class*="section_"]');
      if (section) section.classList.remove('wd-dropdown_section-raised', 'wd-dropdown_section-static');
      document.removeEventListener('pointerdown', onOutsidePointer, true);
      if (refocus) toggle.focus();
    }

    function onOutsidePointer(event) {
      if (!root.contains(event.target)) close(false);
    }

    function commit(value) {
      if (select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      renderValue(valueSpan, select.selectedOptions[0] || null, select);
      close(true);
    }

    toggle.addEventListener('click', function () {
      panel.hidden ? open() : close(true);
    });
    toggle.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        open();
      }
      // Enter/Space activate the button natively -> click handler opens
    });

    search.addEventListener('input', function () {
      applyFilter(search.value);
    });

    panel.addEventListener('keydown', function (event) {
      var items = visibleItems();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive(Math.min(activeIndex + 1, items.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        var li = items[activeIndex];
        if (li) commit(li.dataset.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab') {
        close(false);
      }
    });

    list.addEventListener('click', function (event) {
      var li = event.target.closest('li[role="option"]');
      if (li) commit(li.dataset.value);
    });

    // external value changes (URL preselect, enquire links) refresh the label
    select.addEventListener('change', function () {
      renderValue(valueSpan, select.selectedOptions[0] || null, select);
    });

    select._wdDropdownDestroy = function () {
      root.remove();
      delete select.dataset.wdDropdown;
      delete select._wdDropdownDestroy;
    };
  }

  // --- Ebbett behaviour wiring (parity with legacy select2.js) ---------------

  function decodeEntities(value) {
    var textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  function preSelectDealership(dealerName) {
    var decoded = decodeEntities(dealerName);
    TARGETS.forEach(function (selector) {
      var select = document.querySelector(selector);
      if (!select) return;
      var match = Array.prototype.find.call(select.options, function (opt) {
        var val = opt.value;
        var text = opt.textContent.trim();
        return val === dealerName || val === decoded ||
          val.toUpperCase() === dealerName.toUpperCase() ||
          val.toUpperCase() === decoded.toUpperCase() ||
          text === dealerName || text.toUpperCase() === dealerName.toUpperCase();
      });
      if (match) {
        select.value = match.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function preSelectFromUrl() {
    var urlParams = window.location.search;
    if (urlParams.indexOf('dealership=') === -1) return;
    var match = urlParams.match(/dealership=([^#]*)/);
    if (!match) return;
    var param = match[1].split(/&(?=debug|utm_|fbclid|gclid)/)[0].trim();
    param = decodeURIComponent(param.replace(/\+/g, ' '));
    if (param) setTimeout(function () { preSelectDealership(param); }, 50);
  }

  /**
   * GA4: mimic a tracked link click with finance apply + dealership context.
   * Site scripts (e.g. footer) read data-ga4-param-* from the click target.
   */
  function fireGa4FinanceEbbettApply(dealershipName) {
    if (!dealershipName) return;
    var a = document.createElement('a');
    a.href = '#';
    a.setAttribute('data-ga4-param-click', 'finance_ebbett_apply');
    a.setAttribute('data-ga4-param-dealership', dealershipName);
    a.setAttribute('aria-hidden', 'true');
    a.className = 'wd-dropdown_visually-hidden';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    document.body.removeChild(a);
  }

  function renderNavDealershipDetails(select, wrapperSelector) {
    var selected = select.selectedOptions[0];
    if (!selected) return;

    var url = selected.getAttribute('data-select2-url');
    if (url) {
      window.location.href = url;
      return;
    }

    var selectedName = selected.textContent.trim();
    var details = null;
    document.querySelectorAll('[data-service-nav="dealership-select-source"]').forEach(function (source) {
      if (details) return;
      if (source.textContent.trim() !== selectedName) return;
      var parent = source.parentElement;
      var candidate = parent ? parent.querySelector('[data-service-nav="dealership-details"]') : null;
      if (candidate && candidate !== source) details = candidate;
    });

    var wrapper = document.querySelector(wrapperSelector || '[data-service-nav="wrapper"]');
    if (wrapper && details) {
      var clone = details.cloneNode(true);
      if (wrapperSelector === '[data-contact-nav="wrapper"]') adaptDetailsForContact(clone, selectedName);
      wrapper.textContent = '';
      wrapper.appendChild(clone);
    }
  }

  // EM-70: the nav's hidden dealership list only carries the SERVICE details
  // block (Book online / Send service enquiry / Phone). For the Contact modal
  // reuse the same block but make the buttons contact-shaped:
  //   1. "Send an enquiry"  -> dealership page, general enquiry form
  //   2. "Phone <number>"   -> unchanged
  //   3. "View dealership"  -> dealership page
  // Links are made host-relative so dev never escapes to the live domain.
  function dealershipPath(href) {
    try {
      var u = new URL(href, window.location.href);
      return /(^|\.)ebbett\.co\.nz$/.test(u.hostname) || u.hostname === window.location.hostname ? u.pathname : null;
    } catch (e) { return null; }
  }

  function adaptDetailsForContact(clone, dealershipName) {
    var links = Array.prototype.slice.call(clone.querySelectorAll('a'));
    var pageLink = links.find(function (a) { return dealershipPath(a.getAttribute('href') || ''); });
    var path = pageLink ? dealershipPath(pageLink.getAttribute('href')) : null;
    links.forEach(function (a) {
      var isPhone = /^tel:/i.test(a.getAttribute('href') || '');
      if (isPhone) return; // keep as-is
      var click = a.getAttribute('data-ga4-param-click') || '';
      if (/service_booking/.test(click)) {
        // primary: general enquiry on the dealership page
        a.textContent = 'Send an enquiry';
        if (path) a.setAttribute('href', path + '?enquiry=general#enquire');
        a.setAttribute('data-ga4-param-click', 'contact_intent');
        if (dealershipName) a.setAttribute('data-ga4-param-dealership', dealershipName);
      } else if (/service_intent/.test(click)) {
        a.textContent = 'View dealership';
        if (path) a.setAttribute('href', path);
        a.setAttribute('data-ga4-param-click', 'contact_intent');
      } else if (path) {
        a.setAttribute('href', dealershipPath(a.getAttribute('href')) || path);
      }
    });
  }

  function bindDocumentHandlers() {
    if (document._wdDropdownDocBound) return;
    document._wdDropdownDocBound = true;

    document.addEventListener('change', function (event) {
      var el = event.target;
      if (!el || !el.matches) return;
      if (el.matches('#nav_service-dropdown')) renderNavDealershipDetails(el);
      if (el.matches('#nav_contact-dropdown')) renderNavDealershipDetails(el, '[data-contact-nav="wrapper"]');
      if (el.matches('#field-ebbett-finance')) {
        var opt = el.selectedOptions[0];
        if (opt && opt.value) fireGa4FinanceEbbettApply(opt.textContent.trim() || opt.value);
      }
    });

    // Enquire links carry the dealership to pre-select
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href*="#enquire"][data-dealership]');
      if (!link) return;
      var value = link.getAttribute('data-dealership');
      if (value) setTimeout(function () { preSelectDealership(value); }, 100);
    });

    // EM-314 (Pooja, 2026-09-16): the footer "Book A Service" link still
    // carries the OLD header's click interaction ("service modal [open]",
    // targets .nav_modal_service / .nav_modal_container — neither exists on
    // 3.0), so it did nothing. The nav button (#book-a-service) has the 3.0
    // interaction that opens #book-service. Forward every other
    // [modal="book-a-service"] click to it. Harmless if the Designer
    // interaction is fixed later: both set the same display/opacity.
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[modal="book-a-service"]');
      if (!link || link.id === 'book-a-service') return;
      var navButton = document.getElementById('book-a-service');
      if (!navButton) return;
      event.preventDefault();
      navButton.click();
    });
  }

  // --- lifecycle ---------------------------------------------------------------

  // EM-304 (Alex, 2026-09-16): model cards whose CMS item is flagged for direct
  // linking should open the OEM page in a new tab instead of the (mostly blank)
  // model page. Every model carries an explore link, so the URL alone says
  // nothing - only the CMS switch "Link - Vehicle Direct Linking" decides (the
  // same field the models Algolia sync and the brand-page range cards honour).
  // Webflow cannot bind a Switch to an attribute, so the Designer (Josi,
  // 2026-09-25) puts a child element inside each `.vehicle-models_link`
  // (`div.alternate-link-switch[data-alt-direct]`; `[data-alt-url]` also
  // accepted) with its visibility conditioned on the switch: the
  // card links out when that child is present. Webflow now drops
  // condition-hidden elements from the published DOM entirely (Josi, 25 Sep);
  // the `.w-condition-invisible` check only guards older render paths. The
  // URL comes from the child, falling back to the link's own `data-alt-url`.
  // Legacy: `data-alt-direct="true"` on the link itself still works.
  function isOn(value) { return /^(true|1|yes|on)$/i.test(String(value || '').trim()); }
  function altUrlFor(link) {
    var flag = link.querySelector('[data-alt-direct], [data-alt-url], .alternate-link-switch');
    if (flag && !flag.classList.contains('w-condition-invisible')) {
      return (flag.getAttribute('data-alt-url') || link.getAttribute('data-alt-url') || '').trim();
    }
    if (isOn(link.getAttribute('data-alt-direct'))) return (link.getAttribute('data-alt-url') || '').trim();
    return '';
  }
  function applyModelAltUrls(root) {
    var links = (root || document).querySelectorAll('a.vehicle-models_link');
    for (var i = 0; i < links.length; i++) {
      var url = altUrlFor(links[i]);
      if (!url || url === '#') continue;
      links[i].setAttribute('href', url);
      links[i].setAttribute('target', '_blank');
      links[i].setAttribute('rel', 'noopener');
    }
  }

  function init() {
    if (initialized) return;
    injectStyles();
    applyModelAltUrls();
    buildOptionsFromCms();
    TARGETS.forEach(function (selector) {
      var select = document.querySelector(selector);
      if (select) enhance(select);
    });
    bindDocumentHandlers();
    preSelectFromUrl();
    initialized = true;
    document.dispatchEvent(new CustomEvent('select2-initialized')); // legacy compat
  }

  function destroyAll() {
    TARGETS.forEach(function (selector) {
      var select = document.querySelector(selector);
      if (select && select._wdDropdownDestroy) select._wdDropdownDestroy();
    });
    initialized = false;
  }

  // BFCache: re-initialise on back/forward navigation without duplicating
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      destroyAll();
      init();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
