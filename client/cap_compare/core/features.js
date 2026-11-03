// cap_compare — vehicle features parsing + comparison matrix.
//
// Input shapes for a record's `features` value, in preference order:
//
// 1. JSON object (the Adam-ask, 2026-07-30: the stock sync will push
//    `{ "Heading": ["feature", …], … }` to Algolia — either as a nested
//    object or a JSON string). Headings become comparison sections
//    DYNAMICALLY, items are kept verbatim (Adam curates upstream; no fixed
//    mapping in our code). New headings need zero frontend change.
//
// 2. process_features HTML (`<h3>{Category}</h3><ul><li>…</li></ul>` — what
//    Webflow's rich-text field holds, should the sync ever pass it through).
//    Same header-driven behaviour as the JSON shape.
//
// 3. FALLBACK: raw comma string (what Algolia carries today; verified
//    2026-07-28, 26.8% fill, e.g. "5 Door, Turbo, Bluetooth, NZ New").
//    Categorised client-side with the vocabulary of Adam's
//    elsp.process_features() (docs/reference/adam-process_features.sql) —
//    three buckets, unknown features dropped, upstream parity with the
//    product pages. This fixed mapping exists ONLY for this legacy shape and
//    dies once the JSON sync lands.
//
// All shapes normalise into the same ordered group list so mixed-shape
// records still compare (headings matching the canonical bucket titles merge
// onto the canonical keys).

export const FEATURE_CATEGORIES = Object.freeze([
  { key: 'exterior', title: 'Exterior Options' },
  { key: 'interior', title: 'Interior Options' },
  { key: 'specifications', title: 'Specifications' },
]);

const EXTERIOR = [
  'Heated Mirrors', 'Alloy Wheels', 'Auto Headlights', 'Blind Spot Warning',
  'Full Body Kit', 'Bull Bars', 'Canopy', 'Central Locking', 'Deck Liner',
  'Dual Sliding Doors', 'Electric Mirrors', 'Electric Windows', 'Electronic Tailgate',
  'Flatdeck', 'Fog Lights', 'Hard Cover', 'Adaptive Headlights', 'Daytime Running Lights',
  'Nudge Bars', 'Paint Protection', 'Proximity Key', 'Rain Sensing Wipers',
  'Remote Central Locking', 'Reverse Camera', 'Reverse Sensors', 'Roof Rack',
  'Roof Rails', 'Running Boards', 'Rust Proofing', 'Spoiler', 'Sports Bar',
  'Sunroof', 'Tail Lift', 'Tinted Windows', 'Tonneau Cover', 'Towbar', 'Tuff Deck',
];

const INTERIOR = [
  'Ventilated Seats', 'Wireless Charging', '2 Sets Of Keys', '6 Disc CD Player',
  '7 Seater +', 'Air Conditioning', 'Android Auto', 'Apple Car Play', 'Alarm',
  'Bench Seat', 'Bluetooth', 'Cassette Player', 'CD Player', 'Climate Air 4 Zone',
  'Climate Control', 'Digital Dashboard', 'Dual Zone Air Conditioning', 'DVD',
  'Electric Drivers Seat', 'Engine Start Button', 'Full Electric Seats',
  'GPS/Satellite Navigation', 'Half Leather', 'Heated Front Seats',
  'Engine Immobiliser', 'Interior Protection', 'iPod Dock', 'Leather Interior',
  'Leather Seats', 'Full Leather Trim', 'Memory Drivers Seat', 'MP3 Player',
  'NZ New', 'Radio', 'Comfort Seats', 'Heated Rear Seats', 'Rear Seat Entertainment',
  'Spare Key', 'Sports Seats', 'Heated Steering Wheel', 'Steering Wheel Controls',
  'Sunblinds', 'Tri-Zone Climate Control',
];

const SPECIFICATIONS = [
  'Diff Lock', '4 Star ANCAP Rating', '5 Star ANCAP Rating', 'AA Appraised',
  'ABS Brakes', 'Adaptive Cruise Control', 'AirBags', 'Surround View Camera',
  'Certified Odometer', 'Cruise Control', 'Radar Cruise Control', 'Disability Enabled',
  'Double Overhead Cam', 'Downhill Brake Control', 'Dynamic Stability Control', 'EFI',
  'Exhaust Brakes', 'Forward Collision Alert', 'Fuel Injected', 'Full Service History',
  'Heads Up Display', 'Hill Start Assist', 'Imported', 'Lane Change Warning',
  'Lane Deviation Warning', 'M/Sports Suspension', 'One Owner', 'Paddle Shift Controls',
  'Panorama Glass Roof', 'Parking Sensors', 'Power Steering', 'Push Button Start Stop',
  'Stability Control', 'Service Books', 'Speed Limit Info', 'Sports Suspension',
  'Supercharged', 'Traction Control', 'Turbo', 'Turbo Timer', 'Twin Turbo',
  'USB Interface', 'Warranty',
];

// case-insensitive lookup → { key, canonical } (canonical = Adam's exact string)
const LOOKUP = new Map();
for (const [key, list] of [['exterior', EXTERIOR], ['interior', INTERIOR], ['specifications', SPECIFICATIONS]]) {
  for (const name of list) LOOKUP.set(name.toLowerCase(), { key, canonical: name });
}

// canonical bucket titles → keys, so H3s like "Exterior Options" merge with
// raw-shape groups (and keep their category icon on the page)
const TITLE_TO_KEY = new Map(FEATURE_CATEGORIES.map(({ key, title }) => [title.toLowerCase(), key]));

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function groupsFromRaw(value) {
  const out = new Map(FEATURE_CATEGORIES.map(({ key, title }) => [key, { key, title, items: [] }]));
  // CMS rich text arrives as "A<br>B<br>" — treat <br> as a separator, drop other tags
  const text = value.replace(/<br\s*\/?>/gi, ',').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  for (const name of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const hit = LOOKUP.get(name.toLowerCase());
    if (hit && !out.get(hit.key).items.includes(hit.canonical)) out.get(hit.key).items.push(hit.canonical);
  }
  return [...out.values()].filter((g) => g.items.length);
}

function groupsFromJson(obj) {
  // { "Heading": ["feature", …], … } — heading order is section order
  const groups = [];
  for (const [heading, items] of Object.entries(obj)) {
    const title = String(heading).trim();
    if (!title || !Array.isArray(items)) continue;
    const names = items.map((i) => String(i ?? '').trim()).filter(Boolean);
    if (!names.length) continue;
    const key = TITLE_TO_KEY.get(title.toLowerCase()) || slugify(title);
    const existing = groups.find((g) => g.key === key);
    const target = existing || { key, title, items: [] };
    if (!existing) groups.push(target);
    for (const name of names) if (!target.items.includes(name)) target.items.push(name);
  }
  return groups;
}

function groupsFromHtml(value) {
  // <h3>{Category}</h3> starts a group; its <li>s (until the next <h3>) are the
  // items, verbatim. New H3s from Adam become new groups automatically.
  const groups = [];
  const chunks = value.split(/<h3[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const titleEnd = chunk.indexOf('</h3>');
    if (titleEnd === -1) continue;
    const title = chunk.slice(0, titleEnd).replace(/<[^>]+>/g, '').trim();
    if (!title) continue;
    const items = [...chunk.slice(titleEnd).matchAll(/<li[^>]*>\s*([^<]+?)\s*<\/li>/gi)].map((m) => m[1]);
    if (!items.length) continue;
    const key = TITLE_TO_KEY.get(title.toLowerCase()) || slugify(title);
    const existing = groups.find((g) => g.key === key);
    const target = existing || { key, title, items: [] };
    if (!existing) groups.push(target);
    for (const item of items) if (!target.items.includes(item)) target.items.push(item);
  }
  return groups;
}

/**
 * Parse a record's `features` value (JSON object / JSON string /
 * process_features HTML / raw comma list) into ordered groups:
 * [{ key, title, items: [...] }]. JSON and HTML shapes are heading-driven and
 * kept verbatim; the raw shape is filtered to Adam's vocabulary (canonical
 * casing). Returns null when nothing usable is found.
 */
export function parseFeatures(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const groups = groupsFromJson(value);
    return groups.length ? groups : null;
  }
  if (Array.isArray(value)) return parseFeatures(value.join(', ')); // bare list → vocab fallback
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  if (text.startsWith('{')) {
    try {
      return parseFeatures(JSON.parse(text));
    } catch { return null; } // malformed JSON is not a feature list
  }
  const groups = text.includes('<li') ? groupsFromHtml(text) : groupsFromRaw(text);
  return groups.length ? groups : null;
}

/**
 * Comparison matrix across records: one section per category (canonical three
 * first when present, then Adam's extra H3 categories in first-seen order),
 * rows = union of feature names in first-seen order with a per-record boolean.
 * Categories empty for every record are omitted; [] when nobody has features.
 * Shape: [{ key, title, rows: [{ name, has: [bool, …] }] }]
 */
export function featureMatrix(records) {
  const per = records.map((r) => parseFeatures(r.features));
  const sections = new Map(); // key → { key, title, names: [] } in first-seen order
  for (const { key, title } of FEATURE_CATEGORIES) sections.set(key, { key, title, names: [] });
  for (const groups of per) for (const g of groups || []) {
    if (!sections.has(g.key)) sections.set(g.key, { key: g.key, title: g.title, names: [] });
    const section = sections.get(g.key);
    for (const name of g.items) {
      if (!section.names.some((n) => n.toLowerCase() === name.toLowerCase())) section.names.push(name);
    }
  }
  return [...sections.values()]
    .filter((s) => s.names.length)
    .map(({ key, title, names }) => ({
      key,
      title,
      rows: names.map((name) => ({
        name,
        has: per.map((groups) => !!(groups || []).find((g) => g.key === key)
          ?.items.some((i) => i.toLowerCase() === name.toLowerCase())),
      })),
    }));
}
