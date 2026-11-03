// Stock-card urgency tags (02-stock-search) — Eco, Recently added, Popular, Save/Price-Drop.
//
// Config-driven: every rule reads DEFAULT_TAG_CONFIG (overridable) so pending
// answers from Adam (eco set, price-drop semantics) land as config flips, not
// code changes. Rules read fields on the Algolia `stock` record only — never
// raw CMS text. Tags render only on `status: Active` records.
//
// Binding contract (Webflow owns all visuals):
//   - The Webflow card template carries slot elements marked `ais-tag="<key>"`
//     (extends the existing `ais-item` attribute convention). The engine only
//     toggles `is-active` on slots and, for dynamic labels (Save $X), writes
//     the label into a child `[ais-tag-label]` (or the slot itself if none).
//   - If a card has no slots (pre-WHTML pages, harness prototype), the engine
//     falls back to injecting a minimal `.wd-stock-tags` strip — styled by
//     tags.css, disable with `fallbackRender: false` once slots ship.
//
// This module makes no Algolia network calls of any kind.

// Icon SVGs (Josi 2026-07-17) — used by the FALLBACK renderer only; once the
// Webflow card component ships its authored tag slots, icons live in Webflow
// and these are dead weight to remove. fill uses currentColor so pills tint them.
const ICON_ECO = '<svg viewBox="0 0 82 108" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M64.5885 0.0884988C56.1741 1.27157 42.4583 3.76332 29.8855 8.65265C9.31782 16.6567 -4.52925 36.3352 1.36798 58.2458C3.46257 66.0167 7.68784 72.6544 13.2512 77.7047C14.7692 70.6372 17.0441 61.9836 20.2602 54.4495C23.9179 45.8987 29.7558 38.4863 34.5121 33.3144C36.9174 30.6973 39.1067 28.5998 40.6968 27.1433C41.4986 26.4084 42.1517 25.8392 42.6112 25.4448C42.841 25.2431 43.0257 25.0908 43.1608 24.9877L43.3184 24.8577L43.3635 24.8219L43.377 24.804H43.3815L43.386 24.7995C45.7599 22.8813 49.2418 23.2399 51.1743 25.6017C53.1023 27.959 52.7419 31.4232 50.3725 33.3413V33.3458H50.368L50.3545 33.3592L50.2554 33.4399C50.1653 33.5161 50.0212 33.6371 49.8275 33.7939C49.4491 34.1211 48.886 34.614 48.1833 35.2548C46.7778 36.5411 44.8229 38.4143 42.6698 40.7492C38.3185 45.4817 33.3995 51.8321 30.4406 58.7603C29.1974 61.6688 28.0937 64.8238 27.1253 68.0191C24.5307 75.1313 22.6793 82.7455 21.4361 88.8444C20.6748 92.5685 20.1253 95.7908 19.7694 98.0898C19.5893 99.237 19.4586 100.16 19.3731 100.801C19.328 101.115 19.292 101.37 19.2694 101.541L19.2469 101.742L19.2424 101.8L19.2379 101.814V101.827C18.8686 104.843 21.0262 107.591 24.0623 107.958C27.0938 108.33 29.855 106.179 30.2245 103.163V103.158L30.229 103.123L30.2515 102.957C30.2695 102.813 30.2965 102.589 30.3371 102.302C30.4182 101.715 30.5398 100.864 30.7065 99.7794C31.0488 97.6104 31.5668 94.5584 32.2875 91.0359C32.5128 89.929 32.7605 88.7772 33.0263 87.5941C38.9092 88.7279 45.1344 88.5845 51.3142 86.9398C62.0033 84.0895 71.0389 77.9678 76.499 69.2867C81.99 60.5567 83.6883 49.5009 80.1386 37.1861C76.6522 25.1133 75.7602 15.9971 75.6747 10.1988C75.5936 4.71346 70.8413 -0.785415 64.58 0.0929366L64.5885 0.0884988Z" fill="currentColor"/></svg>';
const ICON_NEW_FOR_YOU = '<svg viewBox="0 0 116 112" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M72.5741 11.5063L75.7407 24.6851C76.3222 27.1134 77.7291 29.1358 79.605 30.5079C81.4808 31.8762 83.8445 32.5866 86.3431 32.3873L99.8231 31.3273C103.309 31.0528 106.621 31.9738 109.341 33.7894C112.054 35.6088 114.166 38.3265 115.247 41.6608C116.327 44.9989 116.218 48.4421 115.093 51.5091C113.96 54.5802 111.806 57.2792 108.82 59.1173L97.2906 66.203C95.1596 67.5112 93.6702 69.4733 92.9536 71.6837C92.237 73.8977 92.2895 76.3712 93.2462 78.6829L98.4237 91.2122C99.7593 94.4487 99.9169 97.8919 99.0352 101.031C98.1461 104.181 96.2176 107.041 93.3813 109.101C90.5562 111.157 87.2547 112.112 83.9944 111.988C80.7229 111.857 77.5001 110.646 74.8401 108.368L64.545 99.5684C62.6465 97.9482 60.3242 97.1401 58.0056 97.1401C55.6795 97.1401 53.3572 97.952 51.4662 99.5684L41.1711 108.368C38.5148 110.639 35.292 111.857 32.0243 111.988C28.7603 112.12 25.4549 111.161 22.626 109.105C19.7934 107.041 17.8613 104.188 16.9721 101.034C16.0867 97.8881 16.248 94.4485 17.5836 91.2159L22.7573 78.6867C23.714 76.3673 23.7666 73.8976 23.05 71.6874C22.3334 69.4771 20.8439 67.5149 18.7129 66.2068L7.17593 59.121C4.18574 57.2867 2.03595 54.5877 0.910489 51.5203C-0.218816 48.4567 -0.327636 45.0097 0.752916 41.6721C1.83343 38.3379 3.94566 35.6238 6.65819 33.8007C9.37445 31.9776 12.6948 31.0641 16.1765 31.3385L29.6604 32.3986C32.1628 32.5941 34.5264 31.8836 36.3985 30.5191C38.2744 29.1508 39.6851 27.1285 40.2628 24.6964L43.4294 11.5176C44.2472 8.09686 46.1381 5.21744 48.7006 3.19515C51.2706 1.16901 54.5009 0 57.9976 0C61.4942 0 64.732 1.16901 67.2945 3.19515C69.8532 5.21754 71.7516 8.09695 72.5658 11.5176L72.5741 11.5063Z" fill="currentColor"/></svg>'; // v2 starburst (Josi 2026-07-17) — v1 bloom read as a plain dot at pill size
const ICON_POPULAR = '<svg viewBox="0 0 78 111" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M78 72.7447C78 80.8478 75.9296 88.4257 72.3306 94.8834C68.6012 101.58 63.216 107.066 56.8032 110.671C55.5624 111.366 53.996 110.913 53.3069 109.666C53.067 109.233 52.9642 108.749 52.9882 108.29C53.0396 103.775 52.45 98.2336 50.2117 92.6396C48.1585 87.4991 44.6827 82.2898 39.0034 77.7817C33.3168 82.2965 29.8476 87.5023 27.7951 92.6396C25.5397 98.271 24.9569 103.854 25.0186 108.379C25.0358 109.807 23.8944 110.986 22.4787 110.999C22.0194 111.01 21.5807 110.889 21.1968 110.671C14.7835 107.069 9.39879 101.582 5.66943 94.8864C2.07713 88.4357 0 80.8515 0 72.7477C0 63.8493 2.34801 53.7171 6.46128 44.677C10.3346 36.1694 15.8049 28.5845 22.4002 23.8277C23.5587 23.0015 25.1629 23.2712 25.989 24.4396C26.2495 24.8026 26.3968 25.214 26.4483 25.6289C27.0378 30.3822 28.4432 33.7803 29.9994 36.1902C28.0285 18.0065 45.1564 0.821945 45.2152 0.763536C46.2161 -0.252777 47.8477 -0.252777 48.852 0.753165C49.3559 1.25788 49.6096 1.92506 49.6164 2.58879C49.6198 15.3308 56.4958 25.7709 63.365 36.2145C70.6798 47.322 77.9912 58.4258 77.9912 72.7404L78 72.7447Z" fill="currentColor"/></svg>';

export const DEFAULT_TAG_CONFIG = {
  activeOnly: true, // criterion 6: never tag non-Active records
  // false since 2026-07-28: the Webflow "Stock Card" component ships authored
  // [ais-tag] slots on both the dev page and (via recapture) the harness
  // snapshot. Flip back to true only for pages whose card predates the slots.
  fallbackRender: false,
  fallbackMount: '.stock-selector_image-wrapper',
  eco: {
    enabled: true,
    // Default eco set — exact definition is an open Adam question (BRIEF);
    // change here only. Live fuel_type facet values as of 2026-07-16:
    // Petrol, Hybrid, Diesel, Electric, Plug-In Hybrid, Other.
    fuelTypes: ['Electric', 'Hybrid', 'Plug-In Hybrid'],
    label: 'Eco',
    icon: ICON_ECO,
    tooltip: 'For hybrids, PHEVs and EVs', // static — Webflow-editable on the component slot
  },
  recentlyAdded: {
    // Renamed from "New for you" (Adam via Josi 2026-07-18) — pure recency now,
    // the localStorage seen-set personalisation was dropped with the rename.
    enabled: true,
    freshDays: 7, // "recently added" window off autoplay_created_date
    label: 'Recently added',
    icon: ICON_NEW_FOR_YOU,
    tooltipTemplate: 'Added {days} ago', // {days} <- "1 day" | "N days"
    tooltipToday: 'Added today',
  },
  popular: {
    enabled: true,
    label: 'Popular',
    icon: ICON_POPULAR,
    // Primary rule (Adam 2026-07-18): global rank in the popularity replica —
    // tooltip can then say "#4 most viewed car available". The page passes a
    // rank map via ctx.ranks (fetched once from stock_popularity_desc by the
    // template's search.js — this module makes no network calls itself).
    topN: 50,
    tooltipTemplate: '#{rank} most viewed car available',
    // Fallback when no rank map is supplied (harness unit runs, fetch failure):
    // p90-of-pageViews-per-body_type thresholds, derived 2026-07-16.
    thresholds: {
      default: 100,
      SUV: 125,
      'Ute/Utility': 141,
      Hatchback: 87,
      'Station Wagon': 100,
      Sedan: 111,
      'Van/People Mover': 79,
      Coupe: 212,
    },
    tooltipFallback: 'One of the most viewed cars available',
  },
  save: {
    // Disabled by default (Josi 2026-07-17): the card already carries the big
    // "Save $X" banner (ais-item="save-tab"), so a savings tag in the tag row
    // duplicates it — and labelling savings as "Price Drop" without real
    // price-reduction data would breach Commerce Commission / Fair Trading
    // guidance. Enable with mode 'priceDrop' ONLY when Adam confirms real
    // reduction semantics (or ships a price_dropped_at field) — config only.
    enabled: false,
    mode: 'save',
    labelTemplate: 'Save {amount}', // {amount} <- price_savings_text
    priceDropLabel: 'Price Drop',
  },
};

const mergeConfig = (overrides = {}) => {
  const merged = { ...DEFAULT_TAG_CONFIG, ...overrides };
  for (const key of ['eco', 'recentlyAdded', 'popular', 'save']) {
    merged[key] = { ...DEFAULT_TAG_CONFIG[key], ...(overrides[key] || {}) };
  }
  return merged;
};

// --- rules -------------------------------------------------------------------

const daysSince = (isoDate, now) => {
  if (!isoDate) return null;
  const created = Date.parse(isoDate);
  if (Number.isNaN(created)) return null;
  const days = Math.floor((now - created) / 86400000);
  return days < 0 ? null : days;
};

const daysPhrase = (days) => (days === 1 ? '1 day' : `${days} days`);

/**
 * Pure rule evaluation — returns [{ key, label, dynamic, tooltip }] for a hit.
 * `tooltip` is set for dynamic tooltip text (days ago, rank); null means the
 * Webflow-authored (or config fallback) static text stands.
 * ctx: { now?: number, ranks?: Map<objectID, 1-based rank> } — injectable.
 */
export function computeTags(hit, config = DEFAULT_TAG_CONFIG, ctx = {}) {
  const cfg = mergeConfig(config === DEFAULT_TAG_CONFIG ? {} : config);
  if (!hit || (cfg.activeOnly && hit.status !== 'Active')) return [];

  const now = ctx.now ?? Date.now();
  const tags = [];

  if (cfg.eco.enabled && cfg.eco.fuelTypes.includes(hit.fuel_type)) {
    tags.push({ key: 'eco', label: cfg.eco.label, dynamic: false, tooltip: null });
  }

  if (cfg.recentlyAdded.enabled) {
    const days = daysSince(hit.autoplay_created_date, now);
    if (days != null && days <= cfg.recentlyAdded.freshDays) {
      tags.push({
        key: 'recently-added',
        label: cfg.recentlyAdded.label,
        dynamic: false,
        tooltip: days === 0 ? cfg.recentlyAdded.tooltipToday : cfg.recentlyAdded.tooltipTemplate.replace('{days}', daysPhrase(days)),
      });
    }
  }

  if (cfg.popular.enabled) {
    const rank = ctx.ranks?.get?.(String(hit.objectID));
    if (rank != null && rank <= cfg.popular.topN) {
      tags.push({
        key: 'popular',
        label: cfg.popular.label,
        dynamic: false,
        tooltip: cfg.popular.tooltipTemplate.replace('{rank}', String(rank)),
      });
    } else if (!ctx.ranks) {
      // no rank map supplied — fall back to per-segment pageViews thresholds
      const threshold = cfg.popular.thresholds[hit.body_type] ?? cfg.popular.thresholds.default;
      if ((hit.pageViews ?? 0) >= threshold) {
        tags.push({ key: 'popular', label: cfg.popular.label, dynamic: false, tooltip: cfg.popular.tooltipFallback });
      }
    }
  }

  if (cfg.save.enabled && hit.price_savings_number > 0) {
    const label =
      cfg.save.mode === 'priceDrop'
        ? cfg.save.priceDropLabel
        : cfg.save.labelTemplate.replace('{amount}', hit.price_savings_text ?? '');
    tags.push({ key: 'save', label, dynamic: true, tooltip: null });
  }

  return tags;
}

// --- DOM binding ---------------------------------------------------------------

/**
 * Expand tag labels on touch/narrow viewports — but only on strips where the
 * expanded labels fit without overrunning the card edge or hitting the Save
 * tab (Josi 2026-07-18). Default state is collapsed (icons only), so nothing
 * flashes on load. Desktop skips measurement entirely: hover handles labels
 * there. Reads and writes are batched — two reflows total per call, not two
 * per strip. Call AFTER hits render (and on resize), never on detached clones.
 */
export function updateTagStripExpansion(rootEl = document) {
  const strips = [...rootEl.querySelectorAll('.wd-stock-tags')];
  if (strips.length === 0) return;

  if (!window.matchMedia('(hover: none), (max-width: 767px)').matches) {
    strips.forEach((s) => s.classList.remove('is-expanded')); // e.g. resized narrow → wide
    return;
  }

  strips.forEach((s) => s.classList.add('is-measuring')); // write pass
  const fits = strips.map((strip) => { // read pass (single layout)
    const wrapper = strip.parentElement;
    if (!wrapper) return false;
    let limit = wrapper.getBoundingClientRect().right - 8;
    const saveTab = wrapper.querySelector('[ais-item="save-tab"]');
    if (saveTab && getComputedStyle(saveTab).display !== 'none') {
      limit = Math.min(limit, saveTab.getBoundingClientRect().left - 8);
    }
    return strip.getBoundingClientRect().left + strip.scrollWidth <= limit;
  });
  strips.forEach((strip, i) => { // write pass
    strip.classList.remove('is-measuring');
    strip.classList.toggle('is-expanded', fits[i]);
  });
}

/**
 * Decorate one card element (a clone of the Webflow `[ais-item="template"]`).
 * Idempotent: decorating the same element twice yields the same DOM.
 * Returns the computed tags.
 */
export function decorateCard(cardEl, hit, config = DEFAULT_TAG_CONFIG, ctx = {}) {
  const cfg = mergeConfig(config === DEFAULT_TAG_CONFIG ? {} : config);
  const tags = computeTags(hit, cfg, ctx);
  if (hit && hit.objectID != null) cardEl.dataset.wdObjectId = String(hit.objectID);

  // The grid's hits template clones the first card in document order, so a
  // clone can inherit a previous hit's fallback strip — remove it BEFORE slot
  // detection or its pills would masquerade as Webflow-authored slots. Only
  // fallback strips carry data-wd-fallback; the Webflow-authored strip shares
  // the .wd-stock-tags class (styling + expansion) and must survive.
  cardEl.querySelectorAll('.wd-stock-tags[data-wd-fallback]').forEach((el) => el.remove());

  const configKeyFor = { eco: 'eco', 'recently-added': 'recentlyAdded', popular: 'popular', save: 'save' };

  const slots = cardEl.querySelectorAll('[ais-tag]');
  if (slots.length > 0) {
    slots.forEach((slot) => {
      const tag = tags.find((t) => t.key === slot.getAttribute('ais-tag'));
      slot.classList.toggle('is-active', Boolean(tag));
      if (!tag) return;
      if (tag.dynamic) {
        (slot.querySelector('[ais-tag-label]') ?? slot).textContent = tag.label;
      }
      // dynamic tooltip text (days ago, rank) overwrites the authored slot text;
      // static tooltips (eco, finance) keep whatever Webflow authored
      const tooltipEl = slot.querySelector('[ais-tag-tooltip]');
      if (tooltipEl && tag.tooltip) tooltipEl.textContent = tag.tooltip;
    });
    return tags;
  }

  if (!cfg.fallbackRender) return tags;

  if (tags.length > 0) {
    const doc = cardEl.ownerDocument;
    const strip = doc.createElement('div');
    strip.className = 'wd-stock-tags';
    strip.setAttribute('data-wd-fallback', ''); // marks the strip as engine-injected (vs Webflow-authored)
    for (const tag of tags) {
      const pill = doc.createElement('span');
      pill.className = `wd-stock-tag is-${tag.key} is-active`;
      pill.setAttribute('ais-tag', tag.key);
      pill.setAttribute('aria-label', tag.label);
      const iconSvg = cfg[configKeyFor[tag.key]]?.icon;
      if (iconSvg) {
        // icon pill: hover/focus expands the label (always expanded on touch — tags.css)
        const icon = doc.createElement('span');
        icon.className = 'wd-stock-tag_icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = iconSvg; // config-owned markup, not record data
        const label = doc.createElement('span');
        label.className = 'wd-stock-tag_label';
        label.setAttribute('ais-tag-label', '');
        label.textContent = tag.label;
        pill.append(icon, label);
      } else {
        pill.textContent = tag.label;
      }
      // two-stage hover: label expands immediately, tooltip fades in after ~1s (tags.css)
      const tooltipText = tag.tooltip ?? cfg[configKeyFor[tag.key]]?.tooltip;
      if (tooltipText) {
        const tip = doc.createElement('span');
        tip.className = 'wd-stock-tag_tooltip';
        tip.setAttribute('ais-tag-tooltip', '');
        tip.setAttribute('role', 'tooltip');
        tip.textContent = tooltipText;
        pill.appendChild(tip);
      }
      strip.appendChild(pill);
    }
    (cardEl.querySelector(cfg.fallbackMount) ?? cardEl).appendChild(strip);
  }
  return tags;
}

