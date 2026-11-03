// Outcome-based quick filters (02-stock-search) — one-tap preset chips that
// apply/remove a filter combo on the InstantSearch helper. Config-driven like
// the tag engine: the preset list is data, the widget is generic.
//
// v1 presets per Josi 2026-07-17 (workshop); "outcome-based" definition to be
// confirmed with Adam — presets are config, so his answer is a list edit.
//
// Notes on the data:
// - `seats` is NOT in numericAttributesForFiltering (verified 2026-07-17), so
//   Family 7+ refines the seats facet values ≥7 observed in the index.
// - `price_current_number` IS numerically filterable.
// This module makes no Algolia network calls; it only mutates helper state.

export const DEFAULT_QUICK_FILTERS = [
  {
    key: 'ev-hybrid',
    label: 'EVs & Hybrids',
    facets: { fuel_type: ['Electric', 'Plug-In Hybrid', 'Hybrid'] },
  },
  {
    key: 'under-30k',
    label: 'Under $30k',
    numeric: { price_current_number: { '<=': 30000 } },
  },
  {
    key: 'family-7-seats',
    label: 'Family (7+ seats)',
    // live seats facet values ≥ 7 as of 2026-07-17: 7, 8, 9, 10, 12
    facets: { seats: ['7', '8', '9', '10', '11', '12'] },
  },
];

/**
 * Parse presets from the hidden Webflow collection list ("Search | Quick
 * Filters" CMS collection, Adam's ask 2026-07-17). Contract: `container` holds
 * one `[data-wd-qf-item]` per chip, with child text nodes
 * `[data-wd-qf="label"]` (chip text) and `[data-wd-qf="filters"]` (PlainText
 * JSON — {"facets": {...}} and/or {"numeric": {...}}, same shape as
 * DEFAULT_QUICK_FILTERS entries). Item order = collection-list order (the list
 * sorts by the Order field; Enabled=off items are filtered out by the list).
 * Invalid JSON/shape → chip skipped with a console warning, never a broken UI.
 * Returns [] when the container is absent/empty (caller falls back to config).
 */
export function parsePresetsFromDOM(container) {
  if (!container) return [];
  const presets = [];
  for (const item of container.querySelectorAll('[data-wd-qf-item]')) {
    const label = item.querySelector('[data-wd-qf="label"]')?.textContent.trim();
    const rawFilters = item.querySelector('[data-wd-qf="filters"]')?.textContent.trim();
    if (!label || !rawFilters) continue; // unfilled CMS row
    let filters;
    try {
      filters = JSON.parse(rawFilters);
    } catch {
      console.warn(`[quick-filters] CMS preset "${label}" has invalid JSON — skipped`);
      continue;
    }
    const facetsOk = filters.facets == null || (typeof filters.facets === 'object' && Object.values(filters.facets).every(Array.isArray));
    const numericOk = filters.numeric == null || (typeof filters.numeric === 'object' && Object.values(filters.numeric).every((v) => typeof v === 'object' && v !== null));
    if (!facetsOk || !numericOk || (filters.facets == null && filters.numeric == null)) {
      console.warn(`[quick-filters] CMS preset "${label}" has no valid facets/numeric — skipped`);
      continue;
    }
    presets.push({
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      label,
      ...(filters.facets ? { facets: filters.facets } : {}),
      ...(filters.numeric ? { numeric: filters.numeric } : {}),
    });
  }
  return presets;
}

const facetEntries = (preset) => Object.entries(preset.facets ?? {});
const numericEntries = (preset) => Object.entries(preset.numeric ?? {});

const refinedValues = (state, attribute) => {
  const disjunctive = state.disjunctiveFacetsRefinements?.[attribute] ?? [];
  const conjunctive = state.facetsRefinements?.[attribute] ?? [];
  return new Set([...disjunctive, ...conjunctive].map(String));
};

/** True when every refinement the preset would apply is currently applied. */
export function presetIsActive(state, preset) {
  for (const [attribute, values] of facetEntries(preset)) {
    const current = refinedValues(state, attribute);
    if (!values.every((v) => current.has(String(v)))) return false;
  }
  for (const [attribute, ops] of numericEntries(preset)) {
    for (const [op, value] of Object.entries(ops)) {
      const current = (state.numericRefinements?.[attribute]?.[op] ?? []).map(Number);
      if (!current.includes(Number(value))) return false;
    }
  }
  return facetEntries(preset).length + numericEntries(preset).length > 0;
}

/**
 * Which helper API refines `attribute` (EM-303, 2026-09-16). The page's
 * dropdowns register their attributes as disjunctive facets, but
 * `is_pre_owned_promise` is declared through configure({ facets }) — a
 * CONJUNCTIVE facet — and the disjunctive calls throw
 * "… is not defined in the disjunctiveFacets attribute" for it. An attribute
 * no widget declares at all (a chip on a facet the page has no dropdown for)
 * gets registered as disjunctive first, so the refinement can be applied.
 * Returns 'facet' | 'disjunctive'.
 */
export function facetMode(helper, attribute) {
  const state = helper.state;
  if (state?.facets?.includes(attribute)) return 'facet';
  if (state?.disjunctiveFacets && !state.disjunctiveFacets.includes(attribute) && typeof state.addDisjunctiveFacet === 'function') {
    helper.setState(state.addDisjunctiveFacet(attribute));
  }
  return 'disjunctive';
}

export function applyPreset(helper, preset) {
  for (const [attribute, values] of facetEntries(preset)) {
    const conjunctive = facetMode(helper, attribute) === 'facet';
    for (const v of values) {
      if (conjunctive) helper.addFacetRefinement(attribute, v);
      else helper.addDisjunctiveFacetRefinement(attribute, v);
    }
  }
  for (const [attribute, ops] of numericEntries(preset)) {
    for (const [op, value] of Object.entries(ops)) helper.addNumericRefinement(attribute, op, Number(value));
  }
}

export function removePreset(helper, preset) {
  for (const [attribute, values] of facetEntries(preset)) {
    const conjunctive = facetMode(helper, attribute) === 'facet';
    for (const v of values) {
      if (conjunctive) helper.removeFacetRefinement(attribute, v);
      else helper.removeDisjunctiveFacetRefinement(attribute, v);
    }
  }
  for (const [attribute, ops] of numericEntries(preset)) {
    for (const [op, value] of Object.entries(ops)) helper.removeNumericRefinement(attribute, op, Number(value));
  }
}

/**
 * Render the chip row into `container` and keep chip active-states in sync.
 * `search` is the InstantSearch instance (for helper access + render events).
 */
export function createQuickFilters({ container, search, presets = DEFAULT_QUICK_FILTERS }) {
  if (!container) return null;

  container.classList.add('wd-quick-filters');
  container.innerHTML = '';
  const buttons = new Map();
  for (const preset of presets) {
    const button = container.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'wd-quick-filter';
    button.setAttribute('data-wd-preset', preset.key);
    button.textContent = preset.label;
    button.addEventListener('click', () => {
      const helper = search.helper;
      if (!helper) return;
      if (presetIsActive(helper.state, preset)) removePreset(helper, preset);
      else applyPreset(helper, preset);
      helper.search();
    });
    container.appendChild(button);
    buttons.set(preset.key, { button, preset });
  }

  const sync = () => {
    const state = search.helper?.state;
    if (!state) return;
    for (const { button, preset } of buttons.values()) {
      button.classList.toggle('is-active', presetIsActive(state, preset));
    }
  };
  search.on('render', sync);
  sync();
  return { sync };
}
