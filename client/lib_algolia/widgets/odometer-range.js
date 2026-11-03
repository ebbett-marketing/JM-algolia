import { createSliderWidget, odometerLadder, fmt } from './range-slider.js';
export const ODOMETER_CONFIG = {
    breakpoints: [500, 5000, 10000, 50000, 100000],
    increments: [500, 1000, 5000, 10000, 50000],
    anyValue: {
        min: 0,
        max: null
    }
};


export class OdometerRangeFilter {
    constructor(minContainer, maxContainer) {
        this.minContainer = minContainer;
        this.maxContainer = maxContainer;
        this.minSelect = null;
        this.maxSelect = null;
    }

    initialize(range, start, refine) {
        if (!this.validateRange(range)) return;
        
        // Set the dynamic max value for "Any" option
        ODOMETER_CONFIG.anyValue.max = range.max + 1;
        
        this.createSelects();
        this.setupEventListeners(refine);
        
        // Normalize start values - handle Infinity/-Infinity from connectRange
        const normalizedStart = this.normalizeStart(start);
        this.populateOptions(range, normalizedStart);
    }

    normalizeStart(start) {
        const normalize = v => (v === undefined || v === null || v === '' || v === -Infinity || v === Infinity) ? undefined : Number(v);
        
        let rawMin, rawMax;
        if (Array.isArray(start)) {
            rawMin = start[0];
            rawMax = start[1];
        } else if (typeof start === 'string' && start.includes(':')) {
            // Fallback: handle string format
            const [minStr, maxStr] = start.split(':');
            rawMin = minStr && minStr.trim() !== '' ? parseFloat(minStr) : undefined;
            rawMax = maxStr && maxStr.trim() !== '' ? parseFloat(maxStr) : undefined;
        }
        
        return [normalize(rawMin), normalize(rawMax)];
    }
    
    validateRange(range) {
        if (range.min === 0 && range.max === 0) {
            return false;
        }
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

    setupEventListeners(refine) {
        const handleChange = () => {
            const minValue = parseFloat(this.minSelect.value) || undefined;
            const maxValue = parseFloat(this.maxSelect.value) || undefined;
    
            refine([
                minValue === ODOMETER_CONFIG.anyValue.min ? undefined : minValue,
                maxValue >= ODOMETER_CONFIG.anyValue.max ? undefined : maxValue
            ]);
    
            this.updateRefinedClass(minValue, maxValue);
        };

        this.minContainer.addEventListener('change', handleChange);
        this.maxContainer.addEventListener('change', handleChange);
    }

    populateOptions(range, [currentMin, currentMax]) {
        const normalizedRange = this.normalizeRange(range);
        
        this.populateMinOptions(normalizedRange, currentMin, parseFloat(this.maxSelect.value) || 0);
        this.populateMaxOptions(normalizedRange, currentMax, parseFloat(this.minSelect.value) || 0);
        
        this.updateRefinedClass(currentMin, currentMax);
    }

    normalizeRange(range) {
        const roundToNearest = (value, increment) => {
            return Math.floor(value / increment) * increment;
        };
    
        return {
            min: Math.min(roundToNearest(range.min, 500), range.min),
            max: Math.max(roundToNearest(range.max + 500, 500), range.max)
        };
    }
    

    populateMinOptions(range, currentValue, opposingValue) {
        const fragment = document.createDocumentFragment();
        
        // Add "Any" option
        this.addOption(fragment, ODOMETER_CONFIG.anyValue.min, "Any", currentValue === 0);
        
        let values = [
            500,
            1000, 2000, 3000, 4000, 5000,
            10000, 20000, 30000, 40000, 50000,
            100000, 150000, 200000
        ];
        
        for (let value of values) {
            if (value > range.max) break;
            if (opposingValue > 0 && value >= opposingValue) break;
    
            this.addOption(
                fragment,
                value,
                `${value.toLocaleString()} km`,
                value === currentValue
            );
        }
    
        this.minSelect.innerHTML = '';
        this.minSelect.appendChild(fragment);
    }
    
        

    populateMaxOptions(range, currentValue, opposingValue) {
        const fragment = document.createDocumentFragment();
        
        let values = [
            500,
            1000, 2000, 3000, 4000, 5000,
            10000, 20000, 30000, 40000, 50000,
            100000, 150000, 200000
        ];
        
        // Filter values based on opposing value
        values = values.filter(value => {
            return opposingValue === 0 || value > opposingValue;
        });
        
        // Add all valid options
        for (let value of values) {
            if (value > range.max) break;
    
            this.addOption(
                fragment,
                value,
                `${value.toLocaleString()} km`,
                value === currentValue
            );
        }
        
        // Add the "Any" option at the end
        this.addOption(
            fragment,
            range.max,
            "Any",
            !currentValue || currentValue >= range.max
        );
    
        this.maxSelect.innerHTML = '';
        this.maxSelect.appendChild(fragment);
    }
    
    

    findHighestStandardValue(startValue, maxValue) {
        let value = 0;
        while (value + this.getIncrement(value) <= maxValue) {
            value += this.getIncrement(value);
        }
        return value;
    }

    getIncrement(value) {
        if (value < ODOMETER_CONFIG.breakpoints[0]) return ODOMETER_CONFIG.increments[0]; 
        if (value < ODOMETER_CONFIG.breakpoints[1]) return ODOMETER_CONFIG.increments[1]; 
        if (value < ODOMETER_CONFIG.breakpoints[2]) return ODOMETER_CONFIG.increments[2]; 
        if (value < ODOMETER_CONFIG.breakpoints[3]) return ODOMETER_CONFIG.increments[3]; 
        return ODOMETER_CONFIG.increments[4];
    }
    
    getNextValue(value) {
        if (value < 5000) {
            return value + 1000;
        } else if (value < 10000) {
            return 10000;
        } else if (value < 50000) {
            return value + 10000;
        } else {
            return value + 50000;
        }
    }    
    

    addOption(parent, value, text, isSelected) {
        const option = document.createElement('option');
        option.value = value;
        option.text = text;
        option.selected = isSelected;
        parent.appendChild(option);
    }

    updateRefinedClass(minValue, maxValue) {
        this.toggleRefinedClass(
            this.minSelect, 
            minValue !== undefined && minValue > 0,
            minValue === undefined || minValue === 0
        );
        
        const anyOptionValue = this.maxSelect?.options[this.maxSelect.options.length - 1]?.value;
        this.toggleRefinedClass(
            this.maxSelect, 
            maxValue !== undefined && maxValue < Number(anyOptionValue),
            maxValue === undefined || maxValue === Number(anyOptionValue)
        );
    }
    
    toggleRefinedClass(element, isRefined, isInactive) {
        element.classList.toggle('ais-Dropdown-button--refined', isRefined);
        element.classList.toggle('ais-Dropdown-button--inactive', isInactive);
    }
}

// Helper function to create the odometer range widget
export function createOdometerRangeWidget(minContainer, maxContainer, opts = {}) {
    // EM-241 (Josi 2026-09-08): slider UI replaces the two selects when asked
    if (opts.slider) {
        const w = createSliderWidget(minContainer, maxContainer, {
            name: 'odometer', label: 'kilometres', format: fmt.km, ladder: odometerLadder,
        });
        return { render: w.render, odometerRangeFilter: null, sliderWidget: w };
    }
    const odometerRangeFilter = new OdometerRangeFilter(minContainer, maxContainer);

    const renderRangeInput = (renderOptions, isFirstRender) => {
        const { start, range, refine } = renderOptions;
        odometerRangeFilter.initialize(range, start, refine);
    };

    return {
        render: renderRangeInput,
        odometerRangeFilter // Expose the filter instance if needed
    };
}