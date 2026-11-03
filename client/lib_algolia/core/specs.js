// Spec normalisation — static mapping tables to the canonical `Vehicle | Variants`
// vocabulary. Shared by stock search facet display (02) and the comparison tool (03).
//
// Policy: unknown input maps to null, never a guess — a wrong drivetrain on a car
// listing is worse than a dash. Tables cover every spelling observed in the CMS
// audit (24, spec-audit.md) and the Algolia sweep (17, fixtures 2026-07-16), plus
// the `drivetrain_simple` facet alphabet (4X4/4X2/FWD/AWD/RWD). "4Motion" → AWD
// follows Adam's own elsp mapping (observed drivetrain→drivetrain_simple pairs).

export const DRIVETRAIN_VOCAB = Object.freeze([
  'Front-Wheel Drive',
  'Rear-Wheel Drive',
  'All-Wheel Drive',
  'Four-Wheel Drive',
]);

// Factually accurate but NOT in the Variants vocabulary — the 2WD family
// (2WD/Two Wheel Drive/4X2) doesn't say which axle drives. Strict mode blanks it.
export const TWO_WHEEL = 'Two-Wheel Drive';

const FRONT = 'Front-Wheel Drive';
const REAR = 'Rear-Wheel Drive';
const ALL = 'All-Wheel Drive';
const FOUR = 'Four-Wheel Drive';

// Keys are trim+lowercase. Includes the in-the-wild typo "Front Wheel Dirve".
const DRIVETRAIN_MAP = Object.freeze({
  'four wheel drive': FOUR,
  '4wd': FOUR,
  '4x4': FOUR,
  'all wheel drive': ALL,
  'awd': ALL,
  '4motion': ALL, // VW branding; Adam's elsp maps it to AWD
  'front wheel drive': FRONT,
  'front wheel dirve': FRONT, // observed typo, fixed mapping
  'fwd': FRONT,
  'rear wheel drive': REAR,
  'rear': REAR,
  'rwd': REAR,
  'two wheel drive': TWO_WHEEL,
  '2wd': TWO_WHEEL,
  '4x2': TWO_WHEEL,
});

const TRANSMISSION_MAP = Object.freeze({
  automatic: 'Automatic',
  manual: 'Manual',
});

const key = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/**
 * Normalise a drivetrain value (raw CMS free text or `drivetrain_simple` facet)
 * to the Variants vocabulary. Returns null for unknown input.
 * `strict: true` also blanks the 2WD family (values outside the 4-value vocab).
 */
export function normaliseDrivetrain(value, { strict = false } = {}) {
  const canon = DRIVETRAIN_MAP[key(value)] ?? null;
  if (strict && canon === TWO_WHEEL) return null;
  return canon;
}

/** Normalise transmission to `Automatic | Manual`. Unknown → null. */
export function normaliseTransmission(value) {
  return TRANSMISSION_MAP[key(value)] ?? null;
}

/**
 * Facet-display label: canonical name when known, otherwise the raw value
 * unchanged. Filter dropdowns must never blank a value — that would make
 * its records unfilterable; honesty rule applies to *wrong* labels only.
 */
export function drivetrainFacetLabel(value) {
  return normaliseDrivetrain(value) ?? value;
}

/** Engine casing: "74KW" / "74 KW" → "74kW" (unit casing only, per spec-audit). */
export function formatEngineCasing(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/(\d)\s*kw\b/gi, '$1kW');
}

/**
 * Fuel-consumption zero rule (spec-audit): the CMS stores 0 for both EVs and
 * unknowns. 0 + Electric → "0 — electric"; 0 otherwise → null (render "—").
 * Non-zero numerics pass through as their string form.
 */
export function fuelConsumptionDisplay(value, fuelType) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num == null || Number.isNaN(num)) return null;
  if (num === 0) return key(fuelType) === 'electric' ? '0 — electric' : null;
  return String(value).trim();
}
