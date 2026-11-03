// Applied-filter chip labels (02-stock-search) — plain-language labels for the
// currentRefinements widget (Adam 2026-08-05: words, not operator symbols).
//   <= → "Less than $30,000"     >= → "More than $50/wk"
//   both bounds on one attribute → ONE chip: "Between $30,000 and $50,000"
//   year reads oddly with less/more, so: "2015 or newer" / "2020 or older".
// Removing a merged Between chip clears BOTH bounds (wrapped item.refine).
// Pure functions over connectCurrentRefinements items — no DOM, no network.

import { drivetrainFacetLabel, normaliseTransmission } from './specs.js';

export const FRIENDLY_FILTER_NAMES = {
  query: 'Search',
  make: 'Brand',
  model: 'Model',
  condition: 'Condition',
  dealership: 'Dealership',
  region: 'Region',
  fuel_type: 'Fuel',
  body_type: 'Body',
  drivetrain_simple: 'Drivetrain',
  transmission_simple: 'Transmission',
  seats: 'Seats',
  year: 'Year',
  price_current_number: 'Price',
  price_weekly_number: 'Per week',
  odometer: 'Kms',
  price_savings_number: 'Discounted',
  safety_stars: 'Safety',
  is_pre_owned_promise: 'Pre-Owned Promise',
  energy_economy_stars: 'Energy economy',
  carbon_emission_stars: 'Carbon emissions',
  engine_power: 'Engine power',
  engine_power_kw: 'Engine power',
};

// EECA star ratings are stored as stars × 2 (Su-Anne 24 Sep 2026); the picker
// refines ">= N×2", read here as "N+ stars".
export const STAR_ATTRIBUTES = { energy_economy_stars: 2, carbon_emission_stars: 2 };

export function numericValueLabel(attribute, value) {
  if (attribute === 'price_current_number') return `$${Number(value).toLocaleString()}`;
  if (attribute === 'price_weekly_number') return `$${Number(value).toLocaleString()}/wk`;
  if (attribute === 'odometer') return `${Number(value).toLocaleString()} km`;
  if (attribute === 'engine_power' || attribute === 'engine_power_kw') return `${Math.round(Number(value))} kW`;
  if (STAR_ATTRIBUTES[attribute]) return `${Number(value) / STAR_ATTRIBUTES[attribute]} stars`;
  return `${value}`;
}

export function numericChipLabel(attribute, refinement) {
  if (attribute === 'price_savings_number') return 'Yes';
  if (attribute === 'safety_stars') return '5 stars';
  if (STAR_ATTRIBUTES[attribute]) {
    const stars = Number(refinement.value) / STAR_ATTRIBUTES[attribute];
    if (refinement.operator === '>=') return `${stars}+ stars`;
    if (refinement.operator === '<=') return `Up to ${stars} stars`;
    return `${stars} stars`;
  }
  const value = numericValueLabel(attribute, refinement.value);
  if (attribute === 'year') {
    if (refinement.operator === '>=') return `${value} or newer`;
    if (refinement.operator === '<=') return `${value} or older`;
    return value;
  }
  if (refinement.operator === '>=') return `More than ${value}`;
  if (refinement.operator === '<=') return `Less than ${value}`;
  return value;
}

export function chipLabel(attribute, refinement) {
  if (refinement.type === 'numeric') return numericChipLabel(attribute, refinement);
  if (attribute === 'drivetrain_simple') return drivetrainFacetLabel(refinement.label);
  if (attribute === 'transmission_simple') return normaliseTransmission(refinement.label) ?? refinement.label;
  if (attribute === 'is_pre_owned_promise') return 'Yes';
  return refinement.label;
}

// A min+max pair on one numeric attribute collapses to a single Between chip.
// The chip keeps ONE refinement object (the widget needs one per pill) but the
// item's refine is wrapped to remove both bounds, so the x clears the range.
export function mergeNumericBounds(item) {
  if (item.refinements.length !== 2) return null;
  const lower = item.refinements.find((r) => r.type === 'numeric' && r.operator === '>=');
  const upper = item.refinements.find((r) => r.type === 'numeric' && r.operator === '<=');
  if (!lower || !upper) return null;
  const label = `Between ${numericValueLabel(item.attribute, lower.value)} and ${numericValueLabel(item.attribute, upper.value)}`;
  return {
    ...item,
    refinements: [{ ...upper, label }],
    refine: () => {
      item.refine(lower);
      item.refine(upper);
    },
  };
}

// A band of facet values standing in for a numeric range (engine_power in
// facet-map mode) collapses to ONE chip worded like the numeric ones; its x
// clears the whole band through the widget rather than one value at a time.
export function bandChipLabel(attribute, min, max) {
  if (min !== undefined && max !== undefined) {
    return `Between ${numericValueLabel(attribute, min)} and ${numericValueLabel(attribute, max)}`;
  }
  if (min !== undefined) return numericChipLabel(attribute, { operator: '>=', value: min });
  return numericChipLabel(attribute, { operator: '<=', value: max });
}

// transformItems for instantsearch.widgets.currentRefinements.
//   options.bands: { [attribute]: () => ({ min, max, clear }) } — see bandChipLabel
export function transformCurrentRefinementItems(items, { bands = {} } = {}) {
  return items.map((item) => {
    const friendly = FRIENDLY_FILTER_NAMES[item.attribute] ?? item.label;
    const band = bands[item.attribute]?.();
    if (band && (band.min !== undefined || band.max !== undefined)) {
      return {
        ...item,
        label: friendly,
        refinements: [{ ...item.refinements[0], label: bandChipLabel(item.attribute, band.min, band.max) }],
        refine: () => band.clear(),
      };
    }
    const merged = mergeNumericBounds(item);
    if (merged) return { ...merged, label: friendly };
    return {
      ...item,
      label: friendly,
      refinements: item.refinements.map((r) => ({ ...r, label: chipLabel(item.attribute, r) })),
    };
  });
}
