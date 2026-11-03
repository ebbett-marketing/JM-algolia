// Clears jsDelivr's cache of client/ files on `main`, so staging picks up a push straight away
// instead of within 12 hours. Pinned release URLs (@v1.2.3) never change, so they never need it.
//
//   node tools/purge-jsdelivr.mjs                 every file under client/
//   node tools/purge-jsdelivr.mjs client/a.js …   just these (paths relative to the repo)
//   node tools/purge-jsdelivr.mjs --ref v1.2.3    another branch or tag instead of main
//
// Purge every file, not only the changed ones: modules import each other by relative path, and a
// half-purged set can mix old and new versions of the same release.
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const REPO = 'ebbett-marketing/JM-algolia';
const root = new URL('..', import.meta.url).pathname;

const args = process.argv.slice(2);
const refAt = args.indexOf('--ref');
const ref = refAt > -1 ? args.splice(refAt, 2)[1] : 'main';

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
