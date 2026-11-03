// Clears jsDelivr's cache of client/ files for a version range, so the site picks up a new release
// tag straight away instead of within hours. Exact release URLs (@v1.2.3) never change, so they
// never need it.
//
//   node tools/purge-jsdelivr.mjs                 every file under client/, for @0.1 (staging)
//   node tools/purge-jsdelivr.mjs client/a.js …   just these (paths relative to the repo)
//   node tools/purge-jsdelivr.mjs --ref 1         another range, branch or tag
//
// Purge every file, not only the changed ones: modules import each other by relative path, and a
// half-purged set can mix two releases.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'ebbett-marketing/JM-algolia';
const root = fileURLToPath(new URL('..', import.meta.url));

const args = process.argv.slice(2);
const refAt = args.indexOf('--ref');
const ref = refAt > -1 ? args.splice(refAt, 2)[1] : '0.1';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(rel)));
    else if (/\.(js|css|json)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const files = args.length ? args : await walk('client');
let failed = 0;
for (let i = 0; i < files.length; i += 4) {
  await Promise.all(files.slice(i, i + 4).map(async (file) => {
    const url = `https://purge.jsdelivr.net/gh/${REPO}@${ref}/${file}`;
    const res = await fetch(url).catch((e) => ({ ok: false, status: e.message }));
    if (!res.ok) { failed++; console.log('failed', res.status, file); }
  }));
}
console.log(`purged ${files.length - failed}/${files.length} files on @${ref}`);
if (failed) process.exitCode = 1;
