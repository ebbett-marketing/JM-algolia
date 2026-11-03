// Applies algolia/stock.settings.json (primary `stock` index, incl. its virtual sort replicas),
// algolia/stock.replicas.json (each replica's sort order) and algolia/pages.settings.json (the
// nav search's site pages) to the JM Algolia app.
//
//   node tools/algolia-settings.mjs                apply
//   node tools/algolia-settings.mjs --check        compare live settings with the files, change nothing
//   node tools/algolia-settings.mjs --only pages   either of the above, for one index
//
// The settings were copied from Ebbett's tuned `stock` index (Oct 2026). Needs
// JOHNSTON_ALGOLIA_APP_ID + JOHNSTON_ALGOLIA_ADMIN_API_KEY (environment or ../.env.local).
import { readFile } from 'node:fs/promises';

try {
  const text = await readFile(new URL('../../.env.local', import.meta.url), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch { /* rely on the environment */ }

const APP = process.env.JOHNSTON_ALGOLIA_APP_ID;
const KEY = process.env.JOHNSTON_ALGOLIA_ADMIN_API_KEY;
if (!APP || !KEY) throw new Error('Missing JOHNSTON_ALGOLIA_APP_ID / JOHNSTON_ALGOLIA_ADMIN_API_KEY');
const check = process.argv.includes('--check');
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > -1 ? process.argv[onlyAt + 1] : null;

async function algolia(method, path, body) {
  const res = await fetch(`https://${APP}.algolia.net/1${path}`, {
    method,
    headers: { 'X-Algolia-Application-Id': APP, 'X-Algolia-API-Key': KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// Gives up after 30 s rather than hanging: an unchanged-settings task can sit unpublished.
const waitTask = async (index, taskID) => {
  for (let i = 0; i < 60; i++) {
    const { status } = await algolia('GET', `/indexes/${index}/task/${taskID}`);
    if (status === 'published') return;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(index, `task ${taskID} still pending; run --check later`);
};

const load = async (f) => JSON.parse(await readFile(new URL(`../algolia/${f}`, import.meta.url), 'utf8'));
const primary = await load('stock.settings.json');
const replicas = await load('stock.replicas.json');
const pages = await load('pages.settings.json');
const targets = [['stock', primary], ...Object.entries(replicas), ['pages', pages]];

for (const [index, wanted] of targets) {
  if (only && index !== only) continue;
  if (check) {
    const live = await algolia('GET', `/indexes/${index}/settings`);
    // Algolia hands back the synonym groups in its own order.
    const norm = (k, v) => JSON.stringify(k === 'synonyms' && Array.isArray(v) ? v.map((g) => [...g].sort()).sort() : v);
    const off = Object.keys(wanted).filter((k) => norm(k, live[k]) !== norm(k, wanted[k]));
    console.log(index, off.length ? `differs: ${off.join(', ')}` : 'ok');
    continue;
  }
  const { taskID } = await algolia('PUT', `/indexes/${index}/settings`, wanted);
  await waitTask(index, taskID);
  console.log(index, 'applied');
}
