// price-range-filter.js

export const PRICE_CONFIG = {
    breakpoints: [100000, 200000, 300000],
    increments: [10000, 25000, 50000, 100000],
    anyValue: {
        min: 0,
        max: null
    }
};

export class PriceRangeFilter {
    constructor(minContainer, maxContainer) {
        this.minContainer = minContainer;
        this.maxContainer = maxContainer;
        this.minSelect = null;
        this.maxSelect = null;
    }

    initialize(range, start, refine) {
        if (!this.validateRange(range)) return;
        
        // Set the dynamic max value for "Any" option
        PRICE_CONFIG.anyValue.max = range.max + 1;
        
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
                minValue === PRICE_CONFIG.anyValue.min ? undefined : minValue,
                maxValue >= PRICE_CONFIG.anyValue.max ? undefined : maxValue
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
        return {
            min: Math.floor(range.min / 10000) * 10000,
            max: Math.min(
                Math.ceil(range.max / 10000) * 10000,
                range.max
            )
        };
    }

    populateMinOptions(range, currentValue, opposingValue) {
        const fragment = document.createDocumentFragment();
    
        this.addOption(fragment, PRICE_CONFIG.anyValue.min, "Any", currentValue === 0);
    
        let value = range.min + PRICE_CONFIG.increments[0];
    
        while (value <= range.max) {
            if (value > range.max) break;
            if (opposingValue > 0 && value >= opposingValue) break;
    
            this.addOption(fragment, value, `$${value.toLocaleString()}`, value === currentValue);
            
            const nextIncrement = this.getIncrement(value);
            if (value + nextIncrement > range.max) break;
            
            value += nextIncrement;
        }

        this.minSelect.innerHTML = '';
        this.minSelect.appendChild(fragment);
    }

    populateMaxOptions(range, currentValue, opposingValue) {
        const fragment = document.createDocumentFragment();
        
        let startValue = opposingValue > 0 ? 
            opposingValue + this.getIncrement(opposingValue) : 
            range.min + PRICE_CONFIG.increments[0];
        
        let highestStandardValue = this.findHighestStandardValue(startValue, range.max);
        
        if (startValue >= highestStandardValue || 
            (startValue + this.getIncrement(startValue) > highestStandardValue)) {
            this.addOption(fragment, range.max, "Any", true);
        } else {
            let value = startValue;
            while (value <= highestStandardValue) {
                if (value > opposingValue) {
                    this.addOption(
                        fragment,
                        value,
                        `$${value.toLocaleString()}`,
                        value === currentValue
                    );
                }
                value += this.getIncrement(value);
            }
            
            this.addOption(
                fragment,
                range.max,
                "Any",
                !currentValue || currentValue > highestStandardValue
            );
        }

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
        if (value < PRICE_CONFIG.breakpoints[0]) return PRICE_CONFIG.increments[0];
        if (value < PRICE_CONFIG.breakpoints[1]) return PRICE_CONFIG.increments[1];
        if (value < PRICE_CONFIG.breakpoints[2]) return PRICE_CONFIG.increments[2];
        return PRICE_CONFIG.increments[3];
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

// Helper function to create the price range widget
export function createPriceRangeWidget(minContainer, maxContainer) {
    const priceRangeFilter = new PriceRangeFilter(minContainer, maxContainer);

    const renderRangeInput = (renderOptions, isFirstRender) => {
        const { start, range, refine } = renderOptions;
        priceRangeFilter.initialize(range, start, refine);
    };

    return {
        render: renderRangeInput,
        priceRangeFilter // Expose the filter instance if needed
    };
}