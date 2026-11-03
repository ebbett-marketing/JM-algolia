// lib_algolia — stock listing URL normaliser (EM-184 / EM-122 launch fix).
//
// Stock records are synced with absolute old-live URLs
// (https://www.ebbett.co.nz/product/<slug>), but on-site links must be
// host-relative (so dev.ebbett.co.nz navigation never jumps hosts — the
// cms_browse relUrl precedent) AND the vehicle template lives at /inventory/
// on Ebbett 3.0 (/product/ 404s there). Off-site URLs pass through untouched.
// Remove the /product/ remap once the stock sync writes /inventory/ URLs.
export function listingUrl(url) {
  if (!url) return '#';
  let out = url;
  try {
    const u = new URL(url);
    if (/(^|\.)ebbett\.co\.nz$/.test(u.hostname)) out = u.pathname + u.search;
    else return url;
  } catch {
    out = String(url);
  }
  return out.replace(/^\/product\//, '/inventory/');
}
