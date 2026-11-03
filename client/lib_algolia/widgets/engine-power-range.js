// engine-power-range.js — kW range slider over the `engine_power` facet
// (Su-Anne via Josi, 24 Sep 2026).
//
// `engine_power` is a STRING in the stock index ("150kW", "1984cc/195kW",
// "139 KW", "Petrol, 1.8L, L4, 16-DOHC…", "6200cc"), so Algolia cannot run a
// numeric filter on it. Until the feed carries a numeric kW field this widget
// runs in FACET-MAP mode: one startup query pulls every facet value
// (279 distinct on 24 Sep, 1,258 of 1,400 Active records parse to a kW), and
// the slider refines the facet values whose kW falls inside the picked band —
// a disjunctive facet refinement, so Clear-all and the chips see it as any
// other facet. The URL keeps the band, not the values (`engine_power=100:200`).
// Values with no parseable kW (~5%: Toyota engine descriptions, cc-only
// strings) drop out while the band is active, exactly as a null numeric would.
//
// NUMERIC mode (when the feed gains e.g. `engine_power_kw`): search.js wires
// `createEnginePowerSlider` to connectRange on that attribute instead — same
// slider, no facet map, no custom widget. Both share the ladder and format.

import { createSliderWidget } from './range-slider.js';

export const ENGINE_POWER_CONFIG = {
  attribute: 'engine_power',
  breakpoints: [200, 400], // kW tiers for the ladder step
  increments: [10, 25, 50],
  maxValuesPerFacet: 1000, // Algolia's ceiling; the index has ~280 distinct values
};

export const fmtKw = (v) => `${Math.round(v)} kW`;

/** "150kW" / "1984cc/195kW" / "139 KW" / "74KkW" → 150 / 195 / 139 / 74; null when no kW figure */
export function parseKw(text) {
  const m = String(text ?? '').match(/(\d+(?:\.\d+)?)\s*k+\s*w\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** facet counts {value: count} → sorted [{value, kw, count}] with kW bounds */
export function buildKwMap(facetCounts) {
  const entries = [];
  let unparsed = 0;
  for (const [value, count] of Object.entries(facetCounts || {})) {
    const kw = parseKw(value);
    if (kw === null) unparsed += count;
    else entries.push({ value, kw, count });
  }
  entries.sort((a, b) => a.kw - b.kw || a.value.localeCompare(b.value));
  return {
    entries,
    min: entries.length ? entries[0].kw : 0,
    max: entries.length ? entries[entries.length - 1].kw : 0,
    unparsed,
  };
}

/** facet values whose kW sits inside [min, max] (either side open when undefined) */
export function valuesInRange(map, min, max) {
  return map.entries
    .filter((e) => (min === undefined || e.kw >= min) && (max === undefined || e.kw <= max))
    .map((e) => e.value);
}

/** ladder of "nice" kW rungs spanning the map bounds; ends = Any */
export function kwLadder(range, config = ENGINE_POWER_CONFIG) {
  const inc = config.increments;
  const bp = config.breakpoints;
  const min = Math.max(0, Math.floor((range.min ?? 0) / inc[0]) * inc[0]);
  const max = Math.max(min + inc[0], Math.ceil((range.max ?? 0) / inc[0]) * inc[0]);
  const stepFor = (v) => (v < bp[0] ? inc[0] : v < bp[1] ? inc[1] : inc[2]);
  const out = [min];
  let v = min;
  for (let guard = 0; guard < 500; guard += 1) {
    const step = stepFor(v);
    v = Math.floor(v / step) * step + step;
    if (v >= max) break;
    out.push(v);
  }
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

/** one read-only query for the whole facet value list (hitsPerPage 0) */
export async function fetchEnginePowerMap(searchClient, indexName, { filters, config = ENGINE_POWER_CONFIG } = {}) {
  const index = searchClient.initIndex(indexName);
  const result = await index.search('', {
    hitsPerPage: 0,
    filters,
    facets: [config.attribute],
    maxValuesPerFacet: config.maxValuesPerFacet,
    attributesToRetrieve: [],
    attributesToHighlight: [],
    analytics: false,
    clickAnalytics: false,
  });
  return buildKwMap(result.facets?.[config.attribute]);
}

/** numeric-mode slider for connectRange (attribute = the future numeric kW field) */
export function createEnginePowerSlider(container, config = ENGINE_POWER_CONFIG) {
  return createSliderWidget(container, null, {
    name: 'engine-power', label: 'engine power', format: fmtKw, ladder: (r) => kwLadder(r, config),
  });
}

function parseBounds(text) {
  if (typeof text !== 'string' || !text.includes(':')) return null;
  const [a, b] = text.split(':');
  const min = a.trim() ? Number(a) : undefined;
  const max = b.trim() ? Number(b) : undefined;
  const okMin = min !== undefined && Number.isFinite(min);
  const okMax = max !== undefined && Number.isFinite(max);
  if (!okMin && !okMax) return null;
  return { min: okMin ? min : undefined, max: okMax ? max : undefined };
}

/**
 * Facet-map mode: an InstantSearch widget (init/render/dispose + uiState
 * hooks) that owns the picked band and mirrors it into disjunctive facet
 * refinements on `engine_power`.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container  the filter placeholder the slider renders into
 * @param {object} opts.map             buildKwMap() output
 * @param {object} [opts.config]
 */
export function createEnginePowerWidget({ container, map, config = ENGINE_POWER_CONFIG }) {
  const attribute = config.attribute;
  let bounds = null; // { min, max } in kW, either side undefined = open
  let helper = null;
  const slider = createEnginePowerSlider(container, config);

  const hasRefinement = (state) => (state?.disjunctiveFacetsRefinements?.[attribute] || []).length > 0;

  const applyBounds = (sp, b) => {
    let next = sp.isDisjunctiveFacet(attribute) ? sp : sp.addDisjunctiveFacet(attribute);
    next = next.removeDisjunctiveFacetRefinement(attribute);
    if (!b) return next;
    for (const value of valuesInRange(map, b.min, b.max)) next = next.addDisjunctiveFacetRefinement(attribute, value);
    return next;
  };

  const setBounds = (next) => {
    bounds = next && (next.min !== undefined || next.max !== undefined) ? next : null;
    if (helper) helper.setState(applyBounds(helper.state, bounds)).search();
  };

  const paint = () => {
    slider.render({
      range: { min: map.min, max: map.max },
      start: [bounds?.min ?? -Infinity, bounds?.max ?? Infinity],
      refine: ([min, max]) => setBounds({ min, max }),
    });
  };

  return {
    $$type: 'wd.enginePowerRange',
    $$widgetType: 'wd.enginePowerRange',
    init({ helper: h }) { helper = h; },
    render({ state }) {
      if (bounds && !hasRefinement(state)) bounds = null; // cleared elsewhere (Clear all, chip x)
      paint();
    },
    dispose({ state }) {
      helper = null;
      return state.removeDisjunctiveFacetRefinement(attribute).removeDisjunctiveFacet(attribute);
    },
    getWidgetUiState(uiState, { searchParameters }) {
      const range = { ...(uiState.range || {}) };
      if (bounds && hasRefinement(searchParameters)) {
        range[attribute] = `${bounds.min ?? ''}:${bounds.max ?? ''}`;
      } else {
        delete range[attribute];
      }
      const next = { ...uiState };
      if (Object.keys(range).length) next.range = range; else delete next.range;
      return next;
    },
    getWidgetSearchParameters(searchParameters, { uiState }) {
      bounds = parseBounds(uiState.range?.[attribute]);
      return applyBounds(searchParameters, bounds);
    },
    // for the applied-filter chip (one chip for the band, x clears it) and tests
    chip: () => ({ min: bounds?.min, max: bounds?.max, clear: () => setBounds(null) }),
    bounds: () => bounds,
    map,
    get slider() { return slider.slider; },
  };
}
