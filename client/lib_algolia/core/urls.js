// lib_algolia — stock listing URL normaliser (EM-184 / EM-122 launch fix).
//
// On-site links must be host-relative, so staging navigation never jumps to the
// live domain. JM's crawler already stores paths (/inventory/<slug>), which pass
// through; absolute URLs on JM's hosts (client/config.js) are cut to paths, and
// off-site URLs pass through untouched. The /product/ → /inventory/ remap is
// kept from Ebbett's copy, where old records still carried /product/.
import { isSiteHost } from '../../config.js';

export function listingUrl(url) {
  if (!url) return '#';
  let out = url;
  try {
    const u = new URL(url);
    if (isSiteHost(u.hostname)) out = u.pathname + u.search;
    else return url;
  } catch {
    out = String(url);
  }
  return out.replace(/^\/product\//, '/inventory/');
}
