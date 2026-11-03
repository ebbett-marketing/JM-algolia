// weekly-range.js — "$/wk" range filter (Josi 2026-07-30, TASKLIST "simple range v1").
//
// price_weekly_number is NOT in numericAttributesForFiltering yet (Ask C, Adam),
// so v1 runs in CONVERTED mode: the widget is a second VIEW of the existing
// price_current_number refinement, translating weekly dollars via the observed
// price/weekly ratio (~247, 2026-07-17 audit). Both the Price and Per-week
// dropdowns therefore drive the SAME underlying refinement and can never
// contradict each other.
//
// When Adam ships Ask C: flip WEEKLY_CONFIG.mode to 'native' in search.js's
// widget registration (attribute becomes price_weekly_number, ratio 1). The
// widget itself is ratio-agnostic — no code change here.

import { createSliderWidget, weeklyLadder, fmt } from './range-slider.js';

export const WEEKLY_CONFIG = {
  ratio: 247, // price_current_number ≈ ratio × price_weekly_number (observed median)
  breakpoints: [400, 800, 1500], // $/wk tier boundaries for step size
  increments: [25, 50, 100, 500], // real index tail runs to ~$4k/wk — keep it coarse up there
  label: '/wk',
};

function stepFor(value, config) {
  for (let i = 0; i < config.breakpoints.length; i++) {
    if (value < config.breakpoints[i]) return config.increments[i];
  }
  return config.increments[config.breakpoints.length];
}

// Weekly option ladder spanning [min, max] (both in $/wk).
export function buildWeeklyLadder(minWk, maxWk, config = WEEKLY_CONFIG) {
  const values = [];
  let v = Math.ceil(minWk / config.increments[0]) * config.increments[0];
  if (v === 0) v = config.increments[0];
  while (v < maxWk) {
    values.push(v);
    v += stepFor(v, config);
  }
  return values;
}

export class WeeklyRangeFilter {
  constructor(minContainer, maxContainer, config = WEEKLY_CONFIG) {
    this.minContainer = minContainer;
    this.maxContainer = maxContainer;
    this.config = config;
    this.minSelect = null;
    this.maxSelect = null;
    this.anyMax = null; // sentinel select value meaning "no upper bound"
  }

  // range/start arrive in the CONNECTED ATTRIBUTE's unit (dollars in converted
  // mode); this widget displays and collects $/wk, converting via config.ratio.
  initialize(range, start, refine) {
    if (!range || (range.min === 0 && range.max === 0)) return;
    const r = this.config.ratio;
    const wkMin = Math.floor((range.min ?? 0) / r);
    const wkMax = Math.ceil((range.max ?? 0) / r);
    if (!(wkMax > 0)) return;
    this.anyMax = wkMax + 1;

    this.createSelects(refine);
    const [curMin, curMax] = this.normalizeStart(start).map((v) =>
      v === undefined ? undefined : Math.round(v / r));
    this.populate(wkMin, wkMax, curMin, curMax);
  }

  normalizeStart(start) {
    const norm = (v) =>
      v === undefined || v === null || v === '' || v === -Infinity || v === Infinity
        ? undefined
        : Number(v);
    return Array.isArray(start) ? [norm(start[0]), norm(start[1])] : [undefined, undefined];
  }

  createSelects(refine) {
    if (!this.minSelect) {
      this.minSelect = this.makeSelect('min');
      this.minContainer.appendChild(this.minSelect);
    }
    if (!this.maxSelect) {
      this.maxSelect = this.makeSelect('max');
      this.maxContainer.appendChild(this.maxSelect);
      const onChange = () => this.handleChange(refine);
      this.minContainer.addEventListener('change', onChange);
      this.maxContainer.addEventListener('change', onChange);
    }
  }

  makeSelect(name) {
    const select = document.createElement('select');
    select.name = name;
    select.classList.add('vs-filter-search', 'w-select');
    return select;
  }

  handleChange(refine) {
    const r = this.config.ratio;
    const wkMin = parseFloat(this.minSelect.value) || 0;
    const wkMax = parseFloat(this.maxSelect.value) || 0;
    const min = wkMin > 0 ? Math.round(wkMin * r) : undefined;
    const max = wkMax > 0 && wkMax < this.anyMax ? Math.round(wkMax * r) : undefined;
    refine([min, max]);
    this.updateRefinedClass(wkMin, wkMax);
  }

  populate(wkMin, wkMax, curMin, curMax) {
    const ladder = buildWeeklyLadder(wkMin, wkMax, this.config);
    const fmt = (v) => `$${v.toLocaleString()}${this.config.label}`;

    const minFrag = document.createDocumentFragment();
    this.addOption(minFrag, 0, 'Any', !curMin);
    ladder.forEach((v) => {
      if (curMax && v >= curMax) return; // keep min < max
      this.addOption(minFrag, v, fmt(v), v === curMin);
    });
    this.minSelect.innerHTML = '';
    this.minSelect.appendChild(minFrag);

    const maxFrag = document.createDocumentFragment();
    ladder.forEach((v) => {
      if (curMin && v <= curMin) return;
      this.addOption(maxFrag, v, fmt(v), v === curMax);
    });
    this.addOption(maxFrag, this.anyMax, 'Any', !curMax || !ladder.includes(curMax));
    this.maxSelect.innerHTML = '';
    this.maxSelect.appendChild(maxFrag);

    this.updateRefinedClass(curMin ?? 0, curMax ?? 0);
  }

  addOption(parent, value, text, isSelected) {
    const option = document.createElement('option');
    option.value = value;
    option.text = text;
    option.selected = isSelected;
    parent.appendChild(option);
  }

  updateRefinedClass(wkMin, wkMax) {
    const flag = (el, refined) => {
      el.classList.toggle('ais-Dropdown-button--refined', refined);
      el.classList.toggle('ais-Dropdown-button--inactive', !refined);
    };
    flag(this.minSelect, wkMin > 0);
    flag(this.maxSelect, wkMax > 0 && wkMax < this.anyMax);
  }
}

// Null-safe factory: pages without the weekly mounts get a no-op render —
// same guard contract as the checkbox widgets (mounts stay Webflow's job).
export function createWeeklyRangeWidget(minContainer, maxContainer, config = WEEKLY_CONFIG) {
  if (!minContainer || !maxContainer) {
    return { render: () => {}, weeklyRangeFilter: null };
  }
  // EM-241 (Josi 2026-09-08): slider UI replaces the two selects when asked.
  // ratio converts $/wk (display) ↔ the connected attribute (1 in native mode).
  if (config.slider) {
    const w = createSliderWidget(minContainer, maxContainer, {
      name: 'weekly', label: 'weekly payment', format: fmt.weekly, ratio: config.ratio || 1,
      ladder: (rangeWk) => weeklyLadder(rangeWk, config),
    });
    return { render: w.render, weeklyRangeFilter: null, sliderWidget: w };
  }
  const weeklyRangeFilter = new WeeklyRangeFilter(minContainer, maxContainer, config);
  const render = (renderOptions) => {
    const { start, range, refine } = renderOptions;
    weeklyRangeFilter.initialize(range, start, refine);
  };
  return { render, weeklyRangeFilter };
}
