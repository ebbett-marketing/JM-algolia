// Algolia Crawler helper for the JM stock crawler.
//
//   node tools/crawler.mjs list              crawlers on the account (find the ID)
//   node tools/crawler.mjs push <id>         upload crawler/stock.config.js (keeps the dashboard's appId/apiKey)
//   node tools/crawler.mjs reindex <id>      start a crawl now
//   node tools/crawler.mjs status <id>       crawler state + last crawl stats
//
// Credentials come from the environment, or from ../.env.local (the johnston-motors folder, outside
// this public repo): JOHNSTON_ALGOLIA_CRAWLER_USER_ID, JOHNSTON_ALGOLIA_CRAWLER_API_KEY.
import { readFile } from 'node:fs/promises';

const API = 'https://crawler.algolia.com/api/1';

async function env() {
  try {
    const text = await readFile(new URL('../../.env.local', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch { /* no file: rely on the environment */ }
  const user = process.env.JOHNSTON_ALGOLIA_CRAWLER_USER_ID;
  const key = process.env.JOHNSTON_ALGOLIA_CRAWLER_API_KEY;
  if (!user || !key) throw new Error('Missing JOHNSTON_ALGOLIA_CRAWLER_USER_ID / _API_KEY');
  return 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64');
}

async function call(auth, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// The API takes functions as { __type: 'function', source }.
function serialise(value) {
  if (typeof value === 'function') return { __type: 'function', source: value.toString() };
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialise(v)]));
  }
  return value;
}

async function loadConfig() {
  const src = await readFile(new URL('../crawler/stock.config.js', import.meta.url), 'utf8');
  let config;
  class Crawler { constructor(opts) { config = opts; } }
  new Function('Crawler', src)(Crawler);
  const { appId, apiKey, ...rest } = config; // owned by the dashboard
  return serialise(rest);
}

const [cmd, id] = process.argv.slice(2);
const auth = await env();
const need = () => { if (!id) throw new Error(`Usage: node tools/crawler.mjs ${cmd} <crawlerId>`); };

if (cmd === 'list') {
  const { items = [] } = await call(auth, 'GET', '/crawlers?itemsPerPage=100');
  items.forEach((c) => console.log(c.id, c.name));
} else if (cmd === 'push') {
  need();
  console.log(await call(auth, 'PATCH', `/crawlers/${id}/config`, await loadConfig()));
} else if (cmd === 'reindex') {
  need();
  console.log(await call(auth, 'POST', `/crawlers/${id}/reindex`));
} else if (cmd === 'status') {
  need();
  const c = await call(auth, 'GET', `/crawlers/${id}`);
  const stats = await call(auth, 'GET', `/crawlers/${id}/stats/urls`).catch((e) => ({ error: e.message }));
  console.log(JSON.stringify({ name: c.name, running: c.running, reindexing: c.reindexing, blocked: c.blocked, blockingError: c.blockingError, lastReindexStartedAt: c.lastReindexStartedAt, lastReindexEndedAt: c.lastReindexEndedAt, stats }, null, 2));
} else {
  console.log('Commands: list | push <id> | reindex <id> | status <id>');
}
