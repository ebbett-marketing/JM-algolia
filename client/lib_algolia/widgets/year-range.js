import { createSliderWidget, yearLadder, fmt } from './range-slider.js';
export const YEAR_CONFIG = {
    breakpoints: {
        tenYear: 2000,
        fiveYear: 2015
    },
    increments: {
        before2000: 10,
        before2015: 5,
        after2015: 1
    }
};

class YearRangeFilter {
    constructor(minContainer, maxContainer) {
        this.minContainer = minContainer;
        this.maxContainer = maxContainer;
        this.minSelect = null;
        this.maxSelect = null;
        this.range = null;
        this.facetStats = null;
        this.refine = null;
        this.hasListeners = false;
        this.handleChange = this.handleChange.bind(this);
        this.lastRenderedRange = null;
    }

    initialize(range, start, refine, instantSearchInstance) {
        this.refine = refine;
        if (!this.validateRange(range)) return;
    
        this.range = range;
        this.facetStats = instantSearchInstance.helper.lastResults?.facets_stats?.year;

        // Ensure we are working with numbers, not strings from the URL state
        // This is critical for preventing t.indexOf errors in connectRange
        const normalize = v => (v === undefined || v === null || v === '' || v === -Infinity || v === Infinity) ? undefined : Number(v);

        // Handle start which can be array [min, max] from connectRange
        // connectRange passes [-Infinity, Infinity] when no refinement is set
        let rawMin, rawMax;
        if (Array.isArray(start)) {
            rawMin = start[0];
            rawMax = start[1];
        } else if (typeof start === 'string' && start.includes(':')) {
            // Fallback: handle string format just in case
            const [minStr, maxStr] = start.split(':');
            rawMin = minStr && minStr.trim() !== '' ? parseInt(minStr, 10) : undefined;
            rawMax = maxStr && maxStr.trim() !== '' ? parseInt(maxStr, 10) : undefined;
        }

        rawMin = normalize(rawMin);
        rawMax = normalize(rawMax);

        const currentMin = Number.isFinite(rawMin)
            ? Math.max(Math.floor(rawMin), Math.floor(this.range.min))
            : undefined;
        const currentMax = Number.isFinite(rawMax)
            ? Math.min(Math.floor(rawMax), Math.floor(this.range.max))
            : undefined;
    
        this.createSelects();
        this.setupEventListeners();

        // Only rebuild options if the range (available bounds) has changed
        if (!this.lastRenderedRange || 
            this.lastRenderedRange.min !== range.min || 
            this.lastRenderedRange.max !== range.max) {
                
            this.populateOptions(range, [currentMin, currentMax]);
            this.lastRenderedRange = { ...range };
        } else {
            // Just update selected values without rebuilding DOM
            this.updateSelection(this.minSelect, currentMin);
            this.updateSelection(this.maxSelect, currentMax);
            
            // Still need to update states derived from selection
            this.updateRefinedClass(currentMin, currentMax);
            this.updateMaxSelectState(currentMin, this.getEffectiveRange().max);
        }
    }

    updateSelection(select, value) {
        if (!select) return;
        select.value = value !== undefined ? value : '';
        // If value not found (e.g. "Any"), default to empty
        if (select.selectedIndex === -1) select.value = '';
    }
    


    validateRange(range) {
        if (range.min === 0 && range.max === 0) return false;
        return true;
    }

    createSelects() {
        if (!this.minSelect) {
            this.minSelect = this.createSelectElement('min');
            this.minContainer.appendChild(this.minSelect);
        }
        if (!this.maxSelect) {
            this.maxSelect = this.createSelectElement('max');
            this.maxContainer.appendChild(this.maxSelect);
        }
    }

    createSelectElement(name) {
        const select = document.createElement('select');
        select.name = name;
        select.classList.add('vs-filter-search', 'w-select');
        return select;
    }

    getEffectiveRange() {
        const normalized = this.normalizeRange(this.range);
        
        const facetMin = this.facetStats?.min || normalized.min;
        const facetMax = this.facetStats?.max || normalized.max;
    
        return {
            min: Math.min(normalized.min, Math.floor(facetMin)),
            max: Math.max(normalized.max, Math.ceil(facetMax))
        };
    }
    
    

    normalizeRange(range) {
        return {
            min: Math.floor(range.min),
            max: Math.floor(range.max)
        };
    }

    populateOptions(range, [currentMin, currentMax]) {
        const effectiveRange = this.getEffectiveRange();
        const opposingMin = parseFloat(this.maxSelect?.value) || 0;
        const opposingMax = parseFloat(this.minSelect?.value) || 0;
        
        this.populateMinOptions(effectiveRange, currentMin, opposingMin);
        this.populateMaxOptions(effectiveRange, currentMax, opposingMax);
        
        this.updateRefinedClass(currentMin, currentMax);
        this.updateMaxSelectState(currentMin, effectiveRange.max);
    }

    getIncrement(value) {
        if (value < YEAR_CONFIG.breakpoints.tenYear) return YEAR_CONFIG.increments.before2000;
        if (value < YEAR_CONFIG.breakpoints.fiveYear) return YEAR_CONFIG.increments.before2015;
        return YEAR_CONFIG.increments.after2015;
    }

    getNextValidIncrement(value) {
        const increment = this.getIncrement(value);
        const nextValue = value + increment;

        if (value < YEAR_CONFIG.breakpoints.tenYear && nextValue >= YEAR_CONFIG.breakpoints.tenYear) {
            return YEAR_CONFIG.breakpoints.tenYear;
        }
        if (value < YEAR_CONFIG.breakpoints.fiveYear && nextValue >= YEAR_CONFIG.breakpoints.fiveYear) {
            return YEAR_CONFIG.breakpoints.fiveYear;
        }
        return nextValue;
    }

    populateMinOptions(range, currentMin, opposingValue) {
        if (!this.minSelect) return;
    
        const fragment = document.createDocumentFragment();
        const effectiveRange = this.getEffectiveRange();
        const lowestValue = effectiveRange.min;
        const highestValue = effectiveRange.max;
    
        // Add "Any" option with the lowest available value
        this.addOption(
            fragment,
            '',
            "Any",
            !currentMin || currentMin === lowestValue,
            true
        );
    
        let value = lowestValue;
        while (value < highestValue) { // Stop before adding the highest value
            if (value === lowestValue) {
                value += this.getIncrement(value);
                continue;
            }
            if (opposingValue > 0 && value >= opposingValue) break;
    
            this.addOption(
                fragment,
                value,
                value.toString(),
                value === currentMin
            );
    
            const nextIncrement = this.getIncrement(value);
            if (value + nextIncrement > highestValue) break;
            value += nextIncrement;
        }
    
        // Add the highest value explicitly if not already included
        this.addOption(
            fragment,
            highestValue,
            highestValue.toString(),
            currentMin === highestValue
        );
    
        this.minSelect.innerHTML = '';
        this.minSelect.appendChild(fragment);
    }
    
    

    populateMaxOptions(range, currentValue, opposingValue) {
        if (!this.maxSelect) return;
    
        const fragment = document.createDocumentFragment();
        const effectiveRange = this.getEffectiveRange();
        const highestValue = effectiveRange.max;
    
        let startValue = opposingValue > 0
            ? this.getNextValidIncrement(opposingValue)
            : effectiveRange.min;
    
        let value = startValue;
        while (value < highestValue) {
            this.addOption(
                fragment,
                value,
                value.toString(),
                value === currentValue
            );
    
            const nextIncrement = this.getIncrement(value);
            if (value + nextIncrement > highestValue) break;
            value += nextIncrement;
        }
    
        // Add the "Any" option only once at the top
        this.addOption(
            fragment,
            '',
            "Any",
            !currentValue || currentValue >= highestValue,
            true
        );
    
        this.maxSelect.innerHTML = '';
        this.maxSelect.appendChild(fragment);
    }
    
    

    setupEventListeners() {
        if (this.hasListeners) return;

        this.minContainer?.addEventListener('change', this.handleChange);
        this.maxContainer?.addEventListener('change', this.handleChange);
        this.hasListeners = true;
    }

    handleChange() {
        if (!this.minSelect || !this.maxSelect || !this.refine) return;

        const minVal = this.minSelect.value;
        const maxVal = this.maxSelect.value;

        const minValue = minVal === '' ? undefined : parseInt(minVal, 10);
        const maxValue = maxVal === '' ? undefined : parseInt(maxVal, 10);

        this.refine([minValue, maxValue]);
        
        this.updateRefinedClass(minValue, maxValue);
        this.updateMaxSelectState(minValue, this.range.max);
    }
    

    updateRefinedClass(minValue, maxValue) {
        if (!this.minSelect || !this.maxSelect) return;
    
        const effectiveRange = this.getEffectiveRange();
    
        // Determine if min and max are refined
        const isMinRefined = minValue !== undefined && minValue > effectiveRange.min;
        const isMaxRefined = maxValue !== undefined && maxValue < effectiveRange.max;
    
        // Toggle refined classes for min select
        this.toggleRefinedClass(this.minSelect, isMinRefined, !isMinRefined);
    
        // Toggle refined classes for max select
        this.toggleRefinedClass(this.maxSelect, isMaxRefined, !isMaxRefined);
    }
    

    updateMaxSelectState(minValue, rangeMax) {
        if (!this.maxSelect) return;

        const baseMin = Number.isFinite(minValue) ? minValue : this.range?.min || 0;
        const nextPossibleValue = this.getNextValidIncrement(baseMin);
        const shouldDisable = nextPossibleValue > rangeMax;
        
        if (shouldDisable) {
            this.maxSelect.classList.add('is-disabled');
            this.maxSelect.disabled = true;
            const anyOption = Array.from(this.maxSelect.options).find(option => option.text === "Any");
            if (anyOption) anyOption.selected = true;
        } else {
            this.maxSelect.classList.remove('is-disabled');
            this.maxSelect.disabled = false;
        }
    }

    toggleRefinedClass(element, isRefined, isInactive) {
        if (!element) return;
        element.classList.toggle('ais-Dropdown-button--refined', isRefined);
        element.classList.toggle('ais-Dropdown-button--inactive', isInactive);
    }

    addOption(parent, value, text, isSelected, isAny = false) {
        const option = document.createElement('option');
        option.value = value;
        option.text = text;
        option.selected = isSelected;
        if (isAny) option.dataset.any = 'true';
        parent.appendChild(option);
    }
}

export function createYearRangeWidget(minContainer, maxContainer, opts = {}) {
    // EM-241 (Josi 2026-09-08): slider UI replaces the two selects when asked
    if (opts.slider) {
        const w = createSliderWidget(minContainer, maxContainer, {
            name: 'year', label: 'year', format: fmt.year,
            ladder: (range) => yearLadder(range, YEAR_CONFIG),
        });
        return { render: w.render, yearRangeFilter: null, sliderWidget: w };
    }
    const yearRangeFilter = new YearRangeFilter(minContainer, maxContainer);

    const render = (renderOptions, isFirstRender) => {
        const { start, range, refine, instantSearchInstance } = renderOptions;
        yearRangeFilter.initialize(range, start, refine, instantSearchInstance);
    };

    return {
        render,
        yearRangeFilter
    };
}