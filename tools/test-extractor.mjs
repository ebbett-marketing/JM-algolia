// Runs crawler/stock.config.js's recordExtractor against the live site, without the Crawler.
//
//   node tools/test-extractor.mjs [siteOrigin]     (default: https://johnston-motors.webflow.io)
//
// Fetches every /inventory/ URL in the sitemap, extracts a record per page, checks each one has
// exactly the Ebbett 3.0 `stock` record keys with the right value types, and writes the records
// to out/records.json for a closer look.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';

const ORIGIN = (process.argv[2] || 'https://johnston-motors.webflow.io').replace(/\/$/, '');
const CONCURRENCY = 4;

// Key → allowed typeof values, from a live Ebbett `stock` record (2 Nov 2026).
const SHAPE = {
  autoplay_created_date: 'string|null', autoplay_updated_date: 'string|null', name: 'string',
  stock_number: 'string|null', plate: 'string|null', status: 'string|null', condition: 'string|null',
  carbon_emissions_measurement: 'number|null', year: 'number|null', make: 'string|null',
  model: 'string|null', variant: 'string', variant_extra: 'string', body_type: 'string|null',
  dealership: 'string|null', yard: 'number|null', orc: 'boolean', odometer: 'number|null',
  odometer_text: 'string|null', price_was_text: 'string|null', price_current_number: 'number|null',
  price_current_text: 'string|null', price_savings_number: 'number|null', price_savings_text: 'string',
  price_weekly_number: 'number|null', price_weekly_text: 'string|null', fuel_type: 'string|null',
  doors: 'number|null', seats: 'number|null', safety_stars: 'number|null', fuel_consumption: 'number|null',
  engine_power: 'string|null', energy_economy_stars: 'number|null', carbon_emission_stars: 'number|null',
  carbon_emissions: 'number|null', annual_fuel_cost: 'number|null', colour_exterior: 'string',
  colour_interior: 'string', engine_size: 'string|null', drivetrain: 'string', drivetrain_simple: 'string|null',
  transmission_simple: 'string|null', transmission_detail: 'string|null', features: 'null', comment: 'null',
  url: 'string', mainImage: 'string|null', image_count: 'number|null', region: 'array', pageViews: 'number',
  is_pre_owned_promise: 'boolean', updatedAt: 'string', objectID: 'string',
};

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

async function loadExtractor() {
  const src = await readFile(new URL('../crawler/stock.config.js', import.meta.url), 'utf8');
  let config;
  class Crawler { constructor(opts) { config = opts; } }
  new Function('Crawler', src)(Crawler);
  return config.actions[0].recordExtractor;
}

async function inventoryUrls() {
  const xml = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.includes('/inventory/'));
}

async function pool(items, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) { const n = i++; out[n] = await fn(items[n]); }
  }));
  return out;
}

const extract = await loadExtractor();
const urls = (await inventoryUrls()).map((u) => u.replace(/^https?:\/\/[^/]+/, ORIGIN));
console.log(`${urls.length} vehicle URLs in ${ORIGIN}/sitemap.xml`);

const results = await pool(urls, async (u) => {
  const res = await fetch(`${u}?cb=${Date.now()}`);
  if (!res.ok) return { u, error: `HTTP ${res.status}` };
  const records = extract({ url: new URL(u), $: cheerio.load(await res.text()), dataSources: {} });
  return records.length ? { u, record: records[0] } : { u, error: 'no record (block missing or invalid JSON)' };
});

const records = results.filter((r) => r.record).map((r) => r.record);
const problems = [];
for (const r of results) {
  if (r.error) { problems.push(`${r.u}: ${r.error}`); continue; }
  const keys = Object.keys(r.record);
  const missing = Object.keys(SHAPE).filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !(k in SHAPE));
  const badTypes = keys.filter((k) => k in SHAPE && !SHAPE[k].split('|').includes(typeOf(r.record[k])));
  if (missing.length || extra.length || badTypes.length) {
    problems.push(`${r.u}: missing [${missing}] extra [${extra}] bad types [${badTypes.map((k) => `${k}=${typeOf(r.record[k])}`)}]`);
  }
}

const empty = Object.fromEntries(Object.keys(SHAPE).map((k) => [k, 0]));
for (const r of records) for (const k of Object.keys(SHAPE)) {
  const v = r[k];
  if (v === null || v === '' || (Array.isArray(v) && !v.length)) empty[k] += 1;
}
const dupes = records.length - new Set(records.map((r) => r.objectID)).size;

await mkdir(new URL('../out/', import.meta.url), { recursive: true });
await writeFile(new URL('../out/records.json', import.meta.url), JSON.stringify(records, null, 2));

console.log(`${records.length} records, ${problems.length} problems, ${dupes} duplicate objectIDs`);
problems.forEach((p) => console.log('  ✗', p));
console.log('Empty values per field (of', records.length + '):');
console.log(Object.entries(empty).filter(([, n]) => n).map(([k, n]) => `  ${k}: ${n}`).join('\n'));
process.exitCode = problems.length || dupes ? 1 : 0;
