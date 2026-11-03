// cap_compare — "Quick Specs" row model, one column per compared vehicle.
// Row set per the Figma design (node 105:908) + Adam's 2026-07-30 revision:
// Year / Odometer / Body style / Fuel type / Power / Engine / Transmission /
// Seats / Colour / Safety rating (stars) / Energy economy (stars) / Carbon
// emissions (stars) — Stock # removed.
//
// Missing-value policy per spec-audit + Adam 2026-07-30: unknown → null
// (renders "—", NO DATA); `na: true` marks NON-APPLICABLE (renders "✕").
// EM-168 (Ebbett, 2026-09-03) overrides Adam's EV convention: pure Electric
// vehicles now READ as electric instead of "✕" — Engine "Electric [RWD]",
// Energy economy "0L / 100km", Carbon emissions "0 grams / km" (zero
// tailpipe). `na` is kept in the model for any future non-applicable cell.
// Normalisation is lib_algolia's (shared with 02).
//
// Star scales mirror the product-page CMS convention (recon 2026-07-30:
// Webflow conditional-visibility star halves, no script): values are
// HALF-STAR counts — safety/ANCAP 0–10 → 5 stars; energy economy and carbon
// emissions 0–12 → 6 stars (EECA). `safety_stars` is synced (92.4% fill);
// energy/carbon stars, annual fuel cost, g/km and power-kW are NOT in the
// index yet — the Adam sync ask in BRIEF.md. Those cells render "—" and
// light up automatically once the sync carries: energy_economy_stars,
// carbon_emission_stars, annual_fuel_cost, carbon_emissions, engine_power.
import {
  normaliseDrivetrain,
  normaliseTransmission,
  formatEngineCasing,
  fuelConsumptionDisplay,
} from '/lib_algolia/dev/core/specs.js';

// Short display codes for the Engine row ("1.6L AWD"), from the canonical vocab.
const DRIVETRAIN_SHORT = {
  'Front-Wheel Drive': 'FWD',
  'Rear-Wheel Drive': 'RWD',
  'All-Wheel Drive': 'AWD',
  'Four-Wheel Drive': '4WD',
  'Two-Wheel Drive': '2WD',
};

const nonEmpty = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Half-star count (e.g. safety_stars: 8) → stars, clamped to the scale's max
    halves (10 = ANCAP 5 stars, 12 = EECA 6 stars). */
export function starsOf(value, maxHalves = 10) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(Math.max(num, 0), maxHalves) / 2;
}

export const isElectric = (record) => (record.fuel_type || '').trim().toLowerCase() === 'electric';

export function engineDisplay(record) {
  const parts = [];
  // cc today (2494); some syncs send litres (2.5) — nothing real is under 20cc
  const size = Number(record.engine_size);
  if (size > 0) parts.push(`${(size < 20 ? size : size / 1000).toFixed(1)}L`);
  // EM-168: a pure EV has no displacement — say so instead of "✕"
  else if (isElectric(record)) parts.push('Electric');
  const canon = normaliseDrivetrain(record.drivetrain_simple) || normaliseDrivetrain(record.drivetrain);
  if (canon) parts.push(DRIVETRAIN_SHORT[canon] || canon);
  return parts.length ? parts.join(' ') : null;
}

export function powerDisplay(record) {
  // engine_power is the future sync field (CMS "Engine", "{n}kW"); absent today
  const raw = record.engine_power ?? record.power;
  if (raw == null || raw === '') return null;
  if (Number.isFinite(Number(raw))) return `${Number(raw)}kW`;
  return formatEngineCasing(String(raw));
}

export function odometerDisplay(record) {
  if (nonEmpty(record.odometer_text)) return record.odometer_text.trim();
  const km = Number(record.odometer);
  return Number.isFinite(km) && km > 0 ? `${km.toLocaleString('en-NZ')} km` : null;
}

export function transmissionDisplay(record) {
  // spec-audit: display the raw detail string; group via transmission_simple.
  return nonEmpty(record.transmission_detail)
    || normaliseTransmission(record.transmission_simple)
    || nonEmpty(record.transmission_simple);
}

export function energyEconomyDisplay(record) {
  const consumption = fuelConsumptionDisplay(record.fuel_consumption, record.fuel_type);
  if (consumption == null) return null;
  if (consumption === '0 — electric') return '0L / 100km'; // EM-168: EVs read as zero
  const num = Number(consumption);
  return Number.isFinite(num) ? `${num}L / 100km` : consumption;
}

function money(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? `$${num.toLocaleString('en-NZ')}` : null;
}

/**
 * Build the Quick Specs column for one record: ordered cells of
 * { key, label, value|null, na?, stars?, starsOutOf?, sub?, link? }.
 * `stars` is a star count or null; `starsOutOf` is the scale (5 or 6);
 * `na: true` = non-applicable (renders "✕", beats value); `sub` is a
 * secondary line under the value. Star-only cells omit `value` entirely.
 */
export function buildSpecColumn(record, config = {}) {
  const annual = money(record.annual_fuel_cost);
  // EM-168: pure EVs show 0 g/km (zero tailpipe) when the index carries no
  // figure; hybrids/PHEVs keep real values, so match the exact fuel type only
  const electric = isElectric(record);
  const gkm = Number(record.carbon_emissions);
  const gkmValue = Number.isFinite(gkm) && gkm > 0 ? `${gkm} grams / km` : electric ? '0 grams / km' : null;
  const engine = engineDisplay(record);
  return [
    { key: 'year', label: 'Year', value: record.year ? String(record.year) : null },
    { key: 'odometer', label: 'Odometer', value: odometerDisplay(record) },
    { key: 'body-style', label: 'Body style', value: nonEmpty(record.body_type) },
    { key: 'fuel-type', label: 'Fuel type', value: nonEmpty(record.fuel_type) },
    { key: 'power', label: 'Power', value: powerDisplay(record) },
    { key: 'engine', label: 'Engine', value: engine },
    { key: 'transmission', label: 'Transmission', value: transmissionDisplay(record) },
    { key: 'seats', label: 'Seats', value: Number(record.seats) > 0 ? String(record.seats) : null },
    { key: 'colour', label: 'Colour', value: nonEmpty(record.colour_exterior) },
    { key: 'safety', label: 'Safety rating', stars: starsOf(record.safety_stars), starsOutOf: 5 },
    {
      key: 'energy-economy',
      label: 'Energy economy',
      stars: starsOf(record.energy_economy_stars, 12),
      starsOutOf: 6,
      value: energyEconomyDisplay(record),
      sub: annual && !electric ? `Estimated annual fuel cost of ${annual}` : null,
    },
    {
      key: 'carbon-emissions',
      label: 'Carbon emissions',
      stars: starsOf(record.carbon_emission_stars, 12),
      starsOutOf: 6,
      value: gkmValue,
      link: { label: 'Learn about these emissions ratings', url: config.carbonInfoUrl || 'https://rightcar.govt.nz/' },
    },
  ];
}

/** Meta line under slot titles: "Used | Petrol | 23,359 km | Automatic". */
export function metaLine(record) {
  return [
    nonEmpty(record.condition),
    nonEmpty(record.fuel_type),
    odometerDisplay(record),
    normaliseTransmission(record.transmission_simple) || nonEmpty(record.transmission_simple),
  ].filter(Boolean).join('  |  ');
}
