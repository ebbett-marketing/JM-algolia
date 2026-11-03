// cap_compare — compare-list state. localStorage-backed, max 3 vehicles.
// Pure module: no DOM rendering here; UI layers subscribe for changes.

export const STORAGE_KEY = 'wd_compare';
export const MAX_COMPARE = 3;
const VERSION = 1;

/** '?ids=a,b,c' (or a full search string) → up to `max` deduped id strings. */
export function parseIdsParam(search, max = MAX_COMPARE) {
  const raw = new URLSearchParams(search || '').get('ids');
  if (!raw) return [];
  const out = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

function memoryStorage() {
  const bag = new Map();
  return {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, String(v)),
    removeItem: (k) => bag.delete(k),
  };
}

function safeStorage(preferred) {
  const candidate = preferred || (typeof localStorage !== 'undefined' ? localStorage : null);
  try {
    candidate.setItem('__wd_compare_probe', '1');
    candidate.removeItem('__wd_compare_probe');
    return candidate;
  } catch {
    return memoryStorage(); // private mode / blocked storage: degrade to in-memory
  }
}

export function createStore({ storage, max = MAX_COMPARE, key = STORAGE_KEY } = {}) {
  const box = safeStorage(storage);
  const listeners = new Set();

  function load() {
    try {
      const parsed = JSON.parse(box.getItem(key));
      if (parsed && parsed.v === VERSION && Array.isArray(parsed.ids)) {
        return {
          ids: parsed.ids.map(String).slice(0, max),
          cache: parsed.cache && typeof parsed.cache === 'object' ? parsed.cache : {},
        };
      }
    } catch { /* corrupt state falls through to fresh */ }
    return { ids: [], cache: {} };
  }

  let state = load();

  function persist() {
    // prune cache to current ids so removed vehicles don't linger in storage
    const cache = {};
    for (const id of state.ids) if (state.cache[id]) cache[id] = state.cache[id];
    state.cache = cache;
    try {
      box.setItem(key, JSON.stringify({ v: VERSION, ids: state.ids, cache }));
    } catch { /* storage full — in-memory state still works this page-load */ }
  }

  function emit() {
    persist();
    for (const fn of listeners) fn(api);
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('wd-compare:change', { detail: { ids: api.ids() } }));
    }
  }

  const api = {
    max,
    ids: () => state.ids.slice(),
    count: () => state.ids.length,
    has: (id) => state.ids.includes(String(id)),
    cacheFor: (id) => state.cache[String(id)] || null,
    add(id, entry) {
      id = String(id);
      if (state.ids.includes(id)) {
        if (entry) { state.cache[id] = entry; persist(); }
        return { ok: false, reason: 'duplicate' };
      }
      if (state.ids.length >= max) return { ok: false, reason: 'full' };
      state.ids.push(id);
      if (entry) state.cache[id] = entry;
      emit();
      return { ok: true };
    },
    remove(id) {
      id = String(id);
      if (!state.ids.includes(id)) return { ok: false, reason: 'missing' };
      state.ids = state.ids.filter((x) => x !== id);
      emit();
      return { ok: true };
    },
    toggle(id, entry) {
      if (api.has(id)) return { ...api.remove(id), added: false };
      const res = api.add(id, entry);
      return { ...res, added: res.ok };
    },
    /** Update display cache without emitting (e.g. page hydrating tray names). */
    prime(id, entry) {
      id = String(id);
      if (!state.ids.includes(id) || !entry) return;
      state.cache[id] = entry;
      persist();
    },
    replaceAll(ids, cacheEntries = {}) {
      const next = [];
      for (const raw of ids.map(String)) {
        if (raw && !next.includes(raw)) next.push(raw);
        if (next.length >= max) break;
      }
      state.ids = next;
      Object.assign(state.cache, cacheEntries);
      emit();
    },
    clear() {
      state = { ids: [], cache: {} };
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return api;
}
