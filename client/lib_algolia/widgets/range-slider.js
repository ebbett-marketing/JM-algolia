// range-slider.js — dual-thumb range slider over a preset ladder (EM-241,
// Josi 2026-09-08). Replaces the min/max <select> pairs of the price, per-week,
// year and odometer filters in the More-options box.
//
// One slider = two native <input type="range"> stacked on a shared track (the
// standard overlap trick: inputs are invisible, only their thumbs take
// pointer events), plus two text inputs underneath that show the current
// values and accept typed numbers. Thumbs move over a LADDER of preset values
// (the same step ladders the dropdowns used — $10k/$25k/$50k/$100k for price,
// the km list for odometer, era-based steps for year, the $/wk tiers), so
// every position is a "nice" number and typed values snap to the nearest rung.
// Rung 0 and the last rung are the "Any" ends: a thumb parked there refines to
// undefined, exactly like the old "Any" option — so there's no clear X;
// dragging a thumb back to its end clears that side.
//
// Contract with the connectRange render: `update(ladder, [min, max], refine)`
// on every render (ladders follow Algolia's current facet bounds), where min/max
// are the current refinement in DISPLAY units (undefined = unrefined).

export function nearestRung(ladder, value, preferHigher = false) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ladder.length; i += 1) {
    const d = Math.abs(ladder[i] - value);
    if (d < bestDist || (d === bestDist && preferHigher)) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * @param {HTMLElement} host      element the slider renders into (the widget's min placeholder)
 * @param {object} opts
 * @param {string} opts.name      'price' | 'weekly' | 'year' | 'odometer' (data attribute + aria)
 * @param {string} opts.label     human label for aria ("price", "kilometres"…)
 * @param {(v:number)=>string} opts.format   display formatter
 * @param {(s:string)=>number|undefined} opts.parse  text → number (undefined = invalid)
 */
export function createRangeSlider(host, opts) {
  const { name, label, format, parse } = opts;
  let ladder = [];
  let refine = null;
  let lo = 0; // rung index of the min thumb
  let hi = 0; // rung index of the max thumb

  const root = el('div', 'wd-range', { 'data-wd-range': name });
  const track = el('div', 'wd-range_track');
  const fill = el('div', 'wd-range_fill');
  const thumbMin = el('input', 'wd-range_thumb is-min', { type: 'range', min: '0', max: '0', step: '1', 'aria-label': `Minimum ${label}` });
  const thumbMax = el('input', 'wd-range_thumb is-max', { type: 'range', min: '0', max: '0', step: '1', 'aria-label': `Maximum ${label}` });
  track.append(fill, thumbMin, thumbMax);
  const vals = el('div', 'wd-range_vals');
  const inputMin = el('input', 'wd-range_input is-min', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': `Minimum ${label}` });
  const sep = el('span', 'wd-range_sep');
  sep.textContent = '–';
  const inputMax = el('input', 'wd-range_input is-max', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': `Maximum ${label}` });
  vals.append(inputMin, sep, inputMax);
  root.append(track, vals);
  host.appendChild(root);

  const last = () => ladder.length - 1;
  const refined = () => lo > 0 || hi < last();

  function paint() {
    const n = last();
    thumbMin.max = String(n);
    thumbMax.max = String(n);
    thumbMin.value = String(lo);
    thumbMax.value = String(hi);
    const pct = (i) => (n > 0 ? (i / n) * 100 : 0);
    fill.style.left = `${pct(lo)}%`;
    fill.style.right = `${100 - pct(hi)}%`;
    if (document.activeElement !== inputMin) inputMin.value = format(ladder[lo]);
    if (document.activeElement !== inputMax) inputMax.value = format(ladder[hi]);
    root.classList.toggle('is-refined', refined());
    // the top-most input wins the pointer where thumbs overlap — keep the one
    // that has room to move on top (both parked at an end otherwise jams)
    thumbMin.style.zIndex = lo === n ? 3 : 2;
    thumbMax.style.zIndex = lo === n ? 2 : 3;
  }

  function commit() {
    if (!refine) return;
    refine([lo > 0 ? ladder[lo] : undefined, hi < last() ? ladder[hi] : undefined]);
  }

  // thumbs: live paint while dragging, refine on release
  thumbMin.addEventListener('input', () => {
    lo = Math.min(Number(thumbMin.value), Math.max(hi - 1, 0));
    paint();
  });
  thumbMax.addEventListener('input', () => {
    hi = Math.max(Number(thumbMax.value), Math.min(lo + 1, last()));
    paint();
  });
  thumbMin.addEventListener('change', commit);
  thumbMax.addEventListener('change', commit);

  // typed values: snap to the nearest rung on blur / Enter
  function applyTyped(input, side) {
    const v = parse(input.value);
    if (v === undefined || Number.isNaN(v)) { paint(); return; }
    if (side === 'min') {
      lo = Math.min(nearestRung(ladder, v), Math.max(hi - 1, 0));
    } else {
      hi = Math.max(nearestRung(ladder, v, true), Math.min(lo + 1, last()));
    }
    paint();
    commit();
  }
  for (const [input, side] of [[inputMin, 'min'], [inputMax, 'max']]) {
    input.addEventListener('change', () => applyTyped(input, side));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    input.addEventListener('focus', () => input.select());
  }

  return {
    root,
    /** ladder: ascending numbers, ends = "Any"; current: [min|undefined, max|undefined] in display units */
    update(nextLadder, current, nextRefine) {
      ladder = nextLadder;
      refine = nextRefine;
      const [curMin, curMax] = current || [];
      lo = curMin === undefined ? 0 : nearestRung(ladder, curMin);
      hi = curMax === undefined ? last() : nearestRung(ladder, curMax, true);
      if (hi <= lo) hi = Math.min(lo + 1, last());
      paint();
    },
    state() { return { lo, hi, ladder: ladder.slice(), refined: refined() }; },
  };
}

// ---------------------------------------------------------------------------
// Ladders — the same step tables the dropdown widgets use, as flat arrays.
// Every ladder starts at the lower bound and ends at the upper bound (both
// "Any"), so a thumb has somewhere to park.

function stepped(min, max, stepFor) {
  const out = [min];
  let v = min;
  for (let guard = 0; guard < 500; guard += 1) {
    const step = stepFor(v);
    v = Math.floor(v / step) * step + step; // next multiple of the step above v
    if (v >= max) break;
    out.push(v);
  }
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

export function priceLadder(range, config) {
  const inc = config.increments;
  const bp = config.breakpoints;
  const min = Math.max(0, Math.floor((range.min ?? 0) / inc[0]) * inc[0]);
  const max = Math.max(min + inc[0], Math.ceil((range.max ?? 0) / inc[0]) * inc[0]);
  return stepped(min, max, (v) => (v < bp[0] ? inc[0] : v < bp[1] ? inc[1] : v < bp[2] ? inc[2] : inc[3]));
}

export function odometerLadder(range) {
  const rungs = [500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 100000, 150000, 200000];
  const min = 0;
  const max = Math.max(500, Math.ceil((range.max ?? 0) / 500) * 500);
  return [min, ...rungs.filter((r) => r > min && r < max), max];
}

export function yearLadder(range, config) {
  const min = Math.floor(range.min ?? 0);
  const max = Math.max(min + 1, Math.floor(range.max ?? 0));
  const bp = config.breakpoints;
  const inc = config.increments;
  return stepped(min, max, (v) => (v < bp.tenYear ? inc.before2000 : v < bp.fiveYear ? inc.before2015 : inc.after2015));
}

export function weeklyLadder(rangeWk, config) {
  const min = 0;
  const max = Math.max(config.increments[0], Math.ceil((rangeWk.max ?? 0) / config.increments[0]) * config.increments[0]);
  const stepFor = (v) => {
    for (let i = 0; i < config.breakpoints.length; i += 1) if (v < config.breakpoints[i]) return config.increments[i];
    return config.increments[config.breakpoints.length];
  };
  return stepped(min, max, stepFor);
}

// ---------------------------------------------------------------------------
// Formatters / parsers shared by the widgets

export const fmt = {
  price: (v) => `$${Math.round(v).toLocaleString()}`,
  weekly: (v) => `$${Math.round(v).toLocaleString()}/wk`,
  km: (v) => `${Math.round(v).toLocaleString()} km`,
  year: (v) => String(Math.round(v)),
};

export function parseNumber(text) {
  const digits = String(text ?? '').replace(/[^0-9.]/g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) ? n : undefined;
}

/** connectRange `start` → [min, max] numbers or undefined (handles ±Infinity, "min:max" strings) */
export function normalizeStart(start) {
  const norm = (v) => (v === undefined || v === null || v === '' || v === -Infinity || v === Infinity ? undefined : Number(v));
  if (Array.isArray(start)) return [norm(start[0]), norm(start[1])];
  if (typeof start === 'string' && start.includes(':')) {
    const [a, b] = start.split(':');
    return [a?.trim() ? Number(a) : undefined, b?.trim() ? Number(b) : undefined];
  }
  return [undefined, undefined];
}

/**
 * Wire a slider to a connectRange render. `ladder(range)` builds the rungs in
 * display units; `ratio` converts display → attribute units (weekly's
 * converted mode; 1 = native). The max placeholder and the clear holder are
 * unused in slider mode — the wrapper gets .wd-range-host and CSS hides them.
 */
export function createSliderWidget(minContainer, maxContainer, { name, label, format, ladder, ratio = 1 }) {
  if (!minContainer) return { render: () => {} };
  const wrapper = minContainer.closest('.ais_filter-wrapper');
  if (wrapper) wrapper.classList.add('wd-range-host');
  if (maxContainer) maxContainer.hidden = true;
  let slider = null;

  const render = (renderOptions) => {
    const { start, range, refine } = renderOptions;
    if (!range || (range.min === 0 && range.max === 0) || !(range.max > 0)) return;
    const displayRange = { min: (range.min ?? 0) / ratio, max: (range.max ?? 0) / ratio };
    const rungs = ladder(displayRange);
    const [sMin, sMax] = normalizeStart(start);
    const current = [sMin === undefined ? undefined : sMin / ratio, sMax === undefined ? undefined : sMax / ratio];
    if (!slider) slider = createRangeSlider(minContainer, { name, label, format, parse: parseNumber });
    slider.update(rungs, current, ([min, max]) => refine([
      min === undefined ? undefined : Math.round(min * ratio),
      max === undefined ? undefined : Math.round(max * ratio),
    ]));
  };

  return { render, get slider() { return slider; } };
}
