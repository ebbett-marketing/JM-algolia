// _v1.0.1 imports from /lib_algolia/dev/ — flip back to /latest/ at promotion.
import { waitForInstantSearch } from '/lib_algolia/dev/core/wait-for-instantsearch.js';
import { encodeValue, decodeValue, safeJSONParse } from '/lib_algolia/dev/core/url-codec.js';
import { createDropdown } from '/lib_algolia/dev/widgets/dropdown.js';
import { createPriceRangeWidget } from '/lib_algolia/dev/widgets/price-range.js';
import { createYearRangeWidget } from '/lib_algolia/dev/widgets/year-range.js';
import { createOdometerRangeWidget } from '/lib_algolia/dev/widgets/odometer-range.js';
import { createWeeklyRangeWidget, WEEKLY_CONFIG } from '/lib_algolia/dev/widgets/weekly-range.js';
import { createFilterCheckboxWidget } from '/lib_algolia/dev/widgets/checkbox-filter.js';
import { getValidFacetKeys } from '/lib_algolia/dev/widgets/valid-params.js';
import { decorateCard, updateTagStripExpansion, DEFAULT_TAG_CONFIG } from '/lib_algolia/dev/widgets/stock-tags.js';
import { createQuickFilters, parsePresetsFromDOM, DEFAULT_QUICK_FILTERS } from '/lib_algolia/dev/widgets/quick-filters.js';
import { drivetrainFacetLabel, normaliseTransmission } from '/lib_algolia/dev/core/specs.js';
import { transformCurrentRefinementItems } from '/lib_algolia/dev/core/chip-labels.js';
import { listingUrl } from '/lib_algolia/dev/core/urls.js';
import { createStarFilterWidget } from '/lib_algolia/dev/widgets/star-filter.js';
import { createEnginePowerWidget, createEnginePowerSlider, fetchEnginePowerMap, ENGINE_POWER_CONFIG } from '/lib_algolia/dev/widgets/engine-power-range.js';

rewriteBrandToMake();

waitForInstantSearch(async () => {

const algoliasearch = window.algoliasearch;
const instantsearch = window.instantsearch;
const { clearRefinements } = instantsearch.widgets;
const { stats } = instantsearch.widgets;
const { connectRange } = instantsearch.connectors;

const numericFilters = ['price_current_number', 'price_weekly_number', 'year', 'odometer'];

// --- Su-Anne 24 Sep 2026: energy/carbon star filters + engine power range ---
// engine_power is a STRING facet in the index ("150kW", "1984cc/195kW",
// "Petrol, 1.8L, L4…"), so the kW slider runs in facet-map mode
// (lib_algolia/widgets/engine-power-range.js): one startup facet query, then
// the band refines the matching facet values. Flip mode to 'numeric' once the
// feed carries a numeric kW field (numericAttribute below) — ask logged for Rakib.
const ENGINE_POWER = { mode: 'facet-map', numericAttribute: 'engine_power_kw' };
const enginePowerAttribute = ENGINE_POWER.mode === 'numeric' ? ENGINE_POWER.numericAttribute : ENGINE_POWER_CONFIG.attribute;
const EXTRA_FILTERS = {
    energy: { mount: 'ais_filter-energy-stars', attribute: 'energy_economy_stars', label: 'Energy economy' },
    carbon: { mount: 'ais_filter-carbon-stars', attribute: 'carbon_emission_stars', label: 'Carbon emissions' },
    power: { mount: 'ais_filter-engine-power', attribute: enginePowerAttribute, label: 'Engine power' }
};
// URL shape for every range-style filter: `<attribute>=<min>:<max>`
const ROUTED_RANGE_ATTRIBUTES = ['year', 'price_current_number', 'price_weekly_number', 'odometer',
    EXTRA_FILTERS.energy.attribute, EXTRA_FILTERS.carbon.attribute, EXTRA_FILTERS.power.attribute];
let lastHelperStateSnapshot = null;

// Multi-value params are joined with a bare comma ("Used,Demo"); a comma followed by
// a space belongs to the value itself ("Ebbett Audi, CUPRA & Zeekr", renamed 30 Sep).
const splitListValue = (value) => value.split(/,(?!\s)/).map(v => v.trim()).filter(Boolean);

const processFilterValue = (value) => {
    if (!value) return null;
    const parsed = safeJSONParse(value);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'string' && parsed.includes(',')) {
        return splitListValue(parsed);
    }
    return [parsed];
};

const getPresetFilters = () => {
    const presetFilters = {
        refinementList: {},
        range: {},
        sort: null
    };
    
    // Get the valid facet keys
    const validFacetKeys = getValidFacetKeys();
    
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        const dataAttributes = Object.entries(searchContainer.dataset)
            .filter(([key]) => key.startsWith('ais'));
        
        dataAttributes.forEach(([key, value]) => {
            const cleanKey = key.replace('ais', '')
                              .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
                              .replace(/^_/, '');
            
            if (cleanKey === 'sort') {
                presetFilters.sort = value;
                return;
            }
            
            // Use decodeValue for processing the incoming values
            const decodedValue = decodeValue(value);
            
            // Only process known facets and numeric filters
            if (numericFilters.includes(cleanKey)) {
                const rangeValue = processFilterValue(decodedValue);
                if (rangeValue && rangeValue.length === 2) {
                    presetFilters.range[cleanKey] = {
                        min: Number(rangeValue[0]),
                        max: Number(rangeValue[1])
                    };
                }
            } else if (validFacetKeys.has(cleanKey)) {
                const filterValue = processFilterValue(decodedValue);
                if (filterValue) {
                    presetFilters.refinementList[cleanKey] = filterValue;
                }
            }
        });
    }
    
    // Process URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach((value, key) => {
        const cleanKey = key.replace(/^ais-/, '');
        
        if (cleanKey === 'sort') {
            presetFilters.sort = value;
            return;
        }
        
        // Use decodeValue for processing URL parameters
        const decodedValue = decodeValue(value);
        
        // Only process known facets and numeric filters
        if (numericFilters.includes(cleanKey)) {
            // Skip processing URL params for range here as they are handled by routeToState
            // and we don't want to double-init
        } else if (validFacetKeys.has(cleanKey)) {
            const filterValue = processFilterValue(decodedValue);
            if (filterValue) {
                presetFilters.refinementList[cleanKey] = filterValue;
            }
        } else {
            console.log(`[Preset Filter] Ignoring param: ${cleanKey}`);
        }
    });
    
    return presetFilters;
};


function createFloatingStats() {
    const container = document.createElement('div');
    container.className = 'floating-stats hidden';
    container.innerHTML = `
        <div class="stats-count"></div>
        <button class="view-results-button">
            <span>View Results</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </button>
    `;
    
    document.body.appendChild(container);
    
    const button = container.querySelector('button');
    button.addEventListener('click', () => {
        document.querySelector('#ais_results')?.scrollIntoView({ behavior: 'smooth' });
        container.classList.add('hidden');
    });
    
    return container;
}

const stateToRoute = (uiState) => {
    const indexState = uiState.stock || {};
    const cleanState = {};
    const numericRangeAttributes = ROUTED_RANGE_ATTRIBUTES;
    const toggleParamDefaults = {
        is_pre_owned_promise: 'true',
        safety_stars: '10'
    };

    const getHelperFacetValues = (attribute) => {
        const disjunctive = lastHelperStateSnapshot?.disjunctiveFacetsRefinements?.[attribute] || [];
        const conjunctive = lastHelperStateSnapshot?.facetsRefinements?.[attribute] || [];
        return [...new Set([...disjunctive, ...conjunctive])];
    };

    // Handle query
    if (indexState.query) {
        cleanState.q = encodeValue(indexState.query);
    }

    // Handle refinement lists
    if (indexState.refinementList) {
        Object.entries(indexState.refinementList).forEach(([key, values]) => {
            if (values && values.length > 0) {
                cleanState[key] = values.map(encodeValue).join(',');
            }
        });
    }

    // Ensure boolean toggle facets (stored as refinement lists) still get serialized
    Object.entries(toggleParamDefaults).forEach(([attribute, paramValue]) => {
        const refinementValues = indexState.refinementList?.[attribute];
        if (refinementValues && refinementValues.includes(paramValue)) {
            cleanState[attribute] = paramValue;
        }
    });

    // Handle numeric ranges
    if (indexState.range) {
        numericRangeAttributes.forEach(attr => {
            if (indexState.range[attr]) {
                let rangeData = indexState.range[attr];
                
                // Handle case where range might be stored as string "min:max" in uiState
                // This can happen with some connector configurations or state mappings
                if (typeof rangeData === 'string' && rangeData.includes(':')) {
                    const [minStr, maxStr] = rangeData.split(':');
                    rangeData = {
                        min: minStr !== '' ? Number(minStr) : undefined,
                        max: maxStr !== '' ? Number(maxStr) : undefined
                    };
                }

                const { min, max } = rangeData;
                if (min !== undefined || max !== undefined) {
                    // Use explicit check for undefined/null instead of falsy check to handle 0 values
                    const minStr = min != null ? String(min) : '';
                    const maxStr = max != null ? String(max) : '';
                    cleanState[attr] = `${minStr}:${maxStr}`;
                }
            }
        });
    }

    // Handle numeric refinements (for checkbox filters)
    if (indexState.numericRefinements) {
        Object.entries(indexState.numericRefinements).forEach(([attribute, comparisons]) => {
            Object.entries(comparisons).forEach(([comparison, values]) => {
                if (values && values.length > 0) {
                    // For price_savings_number >= 1, add it to URL
                    if (attribute === 'price_savings_number' && comparison === '>=' && values.includes(1)) {
                        cleanState[attribute] = '1';
                    }
                    // For safety_stars = 10, add it to URL  
                    if (attribute === 'safety_stars' && comparison === '=' && values.includes(10)) {
                        cleanState[attribute] = '10';
                    }
                    // Add other numeric refinements as needed
                }
            });
        });
    }

    Object.entries(toggleParamDefaults).forEach(([attribute, paramValue]) => {
        let handledViaToggle = false;

        if (indexState.toggle) {
            const toggleValue = indexState.toggle[attribute];
            if (
                toggleValue === true ||
                toggleValue === paramValue ||
                (toggleValue && toggleValue.isRefined) ||
                (typeof toggleValue === 'string' && toggleValue.toLowerCase() === 'true')
            ) {
                cleanState[attribute] = paramValue;
                handledViaToggle = true;
            }
        }

        if (!handledViaToggle && indexState.refinementList?.[attribute]) {
            const refinementValues = indexState.refinementList[attribute];
            if (refinementValues.includes(paramValue)) {
                cleanState[attribute] = paramValue;
                handledViaToggle = true;
            }
        }

        if (!handledViaToggle) {
            const helperValues = getHelperFacetValues(attribute);
            if (helperValues.includes(paramValue)) {
                cleanState[attribute] = paramValue;
            }
        }
    });

    /* no-op placeholder to keep logical separation */

    // Handle sorting
    if (indexState.sortBy && indexState.sortBy !== 'stock') {
        cleanState.sort = indexState.sortBy;
    }

    return cleanState;
};

const routeToState = (routeState) => {
    try {
        // Get preset filters from the container
        const presetFilters = getPresetFilters();
        const refinementList = { ...presetFilters.refinementList };
        // Range values for connectRange must be in STRING format "min:max"
        const range = {};
        const numericRefinements = {};
        const toggleState = {};
        const numericRangeAttributes = ROUTED_RANGE_ATTRIBUTES;
        const toggleParamDefaults = {
            is_pre_owned_promise: 'true',
            safety_stars: '10'
        };

        // Convert any preset range objects to string format
        if (presetFilters.range) {
            Object.entries(presetFilters.range).forEach(([attr, rangeObj]) => {
                if (rangeObj && typeof rangeObj === 'object') {
                    const minStr = rangeObj.min != null ? String(rangeObj.min) : '';
                    const maxStr = rangeObj.max != null ? String(rangeObj.max) : '';
                    if (minStr || maxStr) {
                        range[attr] = `${minStr}:${maxStr}`;
                    }
                }
            });
        }

        // console.log('[routeToState] Input routeState:', JSON.stringify(routeState));
        // console.log('[routeToState] Preset filters:', JSON.stringify(presetFilters));


        // Merge URL state with presets
        Object.entries(routeState).forEach(([key, value]) => {
            if (!value) return;

            if (toggleParamDefaults[key] && value === toggleParamDefaults[key]) {
                toggleState[key] = true;
            }

            // Handle numeric range attributes - MUST be in format "min:max"
            if (numericRangeAttributes.includes(key)) {
                // Only process if it's a string containing ":"
                if (typeof value === 'string' && value.includes(':')) {
                    const [minStr, maxStr] = value.split(':');
                    
                    // Validate that we have at least one numeric value
                    const hasMin = minStr && minStr.trim() !== '' && Number.isFinite(parseInt(minStr, 10));
                    const hasMax = maxStr && maxStr.trim() !== '' && Number.isFinite(parseInt(maxStr, 10));

                    if (hasMin || hasMax) {
                        // Keep as string format for connectRange: "min:max"
                        const cleanMin = hasMin ? minStr.trim() : '';
                        const cleanMax = hasMax ? maxStr.trim() : '';
                        range[key] = `${cleanMin}:${cleanMax}`;
                    }
                }
                // Skip any other format for numeric range attributes (don't let them fall through)
                return;
            } else if (key === 'price_savings_number') {
                // Handle the "Only Discounted Cars" checkbox
                const numericValue = parseInt(value, 10);
                if (numericValue >= 1) {
                    numericRefinements[key] = {
                        '>=': [1]
                    };
                }
            } else if (key === 'safety_stars') {
                // Handle the "5 Safety Stars" checkbox
                const numericValue = parseInt(value, 10);
                if (numericValue === 10) {
                    numericRefinements[key] = {
                        '=': [10]
                    };
                }
            } else if (key !== 'sort' && key !== 'q' && !numericRangeAttributes.includes(key)) {
                // Handle refinement lists
                const values = value.includes(',')
                    ? splitListValue(value).map(decodeValue)
                    : [decodeValue(value)];
                    
                // Merge with existing preset values if any
                refinementList[key] = refinementList[key] 
                    ? [...new Set([...refinementList[key], ...values])]
                    : values;
            }
        });

        // Sanity check: ensure numeric range attributes are not in refinementList
        numericRangeAttributes.forEach(attr => {
            if (refinementList[attr]) {
                delete refinementList[attr];
            }
        });

        const state = {
            stock: {
                query: decodeValue(routeState.q || ''),
                refinementList,
                range,
                sortBy: routeState.sort || presetFilters.sort || 'stock',
                configure: {
                    hitsPerPage: 21,
                    filters: 'status:Active'
                }
            }
        };

        // Add numeric refinements if they exist
        if (Object.keys(numericRefinements).length > 0) {
            // state.stock.numericRefinements = numericRefinements;
        }

        if (Object.keys(toggleState).length > 0) {
            state.stock.toggle = toggleState;
        }

        return state;
    } catch (e) {
        console.error("Error in routeToState", e);
        return { stock: {} };
    }
};

const searchClient = algoliasearch(
    'G2Y7I1BLJW',
    'e54bd7c6bd9b6c2df13fe6615eca943d'
);

const search = instantsearch({
    searchClient,
    indexName: "stock",
    routing: {
        router: instantsearch.routers.history(),
        stateMapping: {
            stateToRoute,
            routeToState
        }
    },
    insights: true
});

search.once('render', () => {
    const helper = search.helper;
    const presetFilters = getPresetFilters();
    
    // Apply preset refinements
    Object.entries(presetFilters.refinementList).forEach(([attribute, values]) => {
        values.forEach(value => {
            helper.addFacetRefinement(attribute, value);
        });
    });
    
    // Apply preset ranges
    Object.entries(presetFilters.range).forEach(([attribute, { min, max }]) => {
        if (min !== undefined) {
            helper.addNumericRefinement(attribute, '>=', min);
        }
        if (max !== undefined) {
            helper.addNumericRefinement(attribute, '<=', max);
        }
    });
    
    // Apply preset sort
    if (presetFilters.sort) {
        helper.setIndex(presetFilters.sort);
    }
    
    // Only trigger search if we have presets to apply
    if (Object.keys(presetFilters.refinementList).length > 0 || 
        Object.keys(presetFilters.range).length > 0 ||
        presetFilters.sort) {
        helper.search();
    }
});


const filterHidingConfig = {
    'ais_filter-seats': ['0'],
};

const preOwnedPromiseRules = {
    requiredCondition: 'used',
    restrictedDealerships: ['duncan & ebbett', 'ebbett prestige tauranga'],
    restrictedMakes: ['Jaguar', 'Land Rover'],
    excludedDealerships: [
        'ebbett toyota hamilton',
        'ebbett toyota te awamutu',
        'ebbett toyota morrinsville',
        'lexus of hamilton',
        'lexus of tauranga',
        'ebbett audi & cupra hamilton',
        'duncan & ebbett hamilton'
    ],
    promiseFacetAttribute: 'is_pre_owned_promise',
    eventName: 'preOwnedPromise:update'
};

if (typeof window !== 'undefined' && typeof window.preOwnedPromiseEligible === 'undefined') {
    window.preOwnedPromiseEligible = false;
}

function normalizeString(value) {
    return (value || '').toLowerCase();
}

function dealerMatches(name, matcher) {
    const normalizedName = normalizeString(name);
    const normalizedMatcher = normalizeString(matcher);
    return normalizedName === normalizedMatcher || normalizedName.includes(normalizedMatcher);
}

function getFacetValues(results, attribute) {
    if (!results || typeof results.getFacetValues !== 'function') {
        return [];
    }

    try {
        const facetData = results.getFacetValues(attribute, { sortBy: ['count:desc'] }) || [];
        if (Array.isArray(facetData)) {
            return facetData.map(item => item.name);
        }
        if (facetData && Array.isArray(facetData.data)) {
            return facetData.data.map(item => item.name);
        }
    } catch (err) {
        console.warn(`Unable to read facet values for ${attribute}`, err);
    }

    return [];
}

function hasFacetValue(results, attribute, predicate) {
    return getFacetValues(results, attribute).some(predicate);
}

function hasStateRefinement(state, attribute, targetValue) {
    if (!state) {
        return false;
    }

    const normalizedTarget = (targetValue || '').toLowerCase();
    const disjunctiveValues = state.disjunctiveFacetsRefinements?.[attribute] || [];
    if (disjunctiveValues.some(value => (value || '').toLowerCase() === normalizedTarget)) {
        return true;
    }

    const conjunctiveValues = state.facetsRefinements?.[attribute] || [];
    if (conjunctiveValues.some(value => (value || '').toLowerCase() === normalizedTarget)) {
        return true;
    }

    const numericValues = state.numericRefinements?.[attribute];
    if (numericValues) {
        return Object.values(numericValues).some(arr => arr.some(value => ('' + value).toLowerCase() === normalizedTarget));
    }

    return false;
}

function hasRestrictedDealerMakeCombo(results) {
    if (!results || !Array.isArray(results.hits)) {
        return false;
    }

    return results.hits.some(hit =>
        preOwnedPromiseRules.restrictedDealerships.some(dealer => dealerMatches(hit.dealership, dealer)) &&
        preOwnedPromiseRules.restrictedMakes.includes(hit.make)
    );
}

function hitsIncludeDealer(results, predicate) {
    if (!results || !Array.isArray(results.hits)) {
        return false;
    }

    return results.hits.some(hit => predicate(hit.dealership));
}

function hasAnyFacetSelection(state, attribute) {
    if (!state) {
        return false;
    }

    const disjunctive = state.disjunctiveFacetsRefinements?.[attribute] || [];
    const conjunctive = state.facetsRefinements?.[attribute] || [];
    return disjunctive.length > 0 || conjunctive.length > 0;
}

function hitsIncludeCondition(results, targetCondition) {
    if (!results || !Array.isArray(results.hits)) {
        return false;
    }

    const normalizedTarget = normalizeString(targetCondition);
    return results.hits.some(hit => normalizeString(hit.condition) === normalizedTarget);
}

function isPreOwnedPromiseEligible(state, results) {
    if (!state || !results) {
        return false;
    }

    if (!hasAnyFacetSelection(state, 'condition')) {
        return false;
    }

    const hasUsedSelected = hasStateRefinement(state, 'condition', preOwnedPromiseRules.requiredCondition);
    const hasNewSelected = hasStateRefinement(state, 'condition', 'new');
    const hasDemoSelected = hasStateRefinement(state, 'condition', 'demo');

    if (hasUsedSelected && (hasNewSelected || hasDemoSelected)) {
        return false;
    }

    const hasRequiredCondition =
        hasUsedSelected ||
        hitsIncludeCondition(results, preOwnedPromiseRules.requiredCondition);

    const hasPromiseToggle =
        hasStateRefinement(state, preOwnedPromiseRules.promiseFacetAttribute, 'true') ||
        hasFacetValue(results, preOwnedPromiseRules.promiseFacetAttribute, name => name === 'true');
    if (!hasRequiredCondition && !hasPromiseToggle) {
        return false;
    }

    const containsExcludedDealer = hitsIncludeDealer(results, name =>
        preOwnedPromiseRules.excludedDealerships.some(excluded => dealerMatches(name, excluded))
    );

    if (containsExcludedDealer) {
        return false;
    }

    if (hasRestrictedDealerMakeCombo(results)) {
        return false;
    }

    return true;
}

function syncPreOwnedPromiseEligibility(state) {
    if (typeof window === 'undefined') {
        return;
    }

    const results = search.helper?.lastResults;
    const eligible = isPreOwnedPromiseEligible(state, results);

    if (window.preOwnedPromiseEligible !== eligible) {
        window.preOwnedPromiseEligible = eligible;

        if (typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent(preOwnedPromiseRules.eventName, {
                detail: { eligible }
            }));
        }
    }
}

let totalObjectsInIndex = 0;

async function getObjectCount() {
    const index = searchClient.initIndex('stock');
    try {
        const result = await index.search('', {
            hitsPerPage: 0,
            filters: 'status:Active'
        });
        totalObjectsInIndex = result.nbHits;
        return totalObjectsInIndex;
    } catch (err) {
        console.error('Error fetching object count:', err);
        throw err;
    }
}

// EM-241 (Josi 2026-09-08): the four range filters render as dual-thumb
// sliders (lib_algolia widgets/range-slider.js) instead of min/max selects.
// Flip to false to get the select pairs back.
const RANGE_UI = { slider: true };

const { render: renderPriceRangeInput, priceRangeFilter } = createPriceRangeWidget(
    document.querySelector('#ais_filter-price-min'),
    document.querySelector('#ais_filter-price-max'),
    RANGE_UI
);

const { render: renderYearRangeInput, yearRangeFilter } = createYearRangeWidget(
    document.querySelector('#ais_filter-year-min'),
    document.querySelector('#ais_filter-year-max'),
    RANGE_UI
);

const { render: renderOdometerRangeInput, odometerRangeFilter } = createOdometerRangeWidget(
    document.querySelector('#ais_filter-odometer-min'),
    document.querySelector('#ais_filter-odometer-max'),
    RANGE_UI
);

// "$/wk" range — NATIVE mode since 2026-07-30 (Ask C/D done: price_weekly_number
// + seats added to numericAttributesForFiltering by Josi's approval; backup in
// 02-stock-search/algolia-numericAttributesForFiltering-backup-2026-07-30.txt).
// ratio: 1 = range/refine values are already weekly dollars.
const weeklyFilterAttribute = 'price_weekly_number';
const { render: renderWeeklyRangeInput } = createWeeklyRangeWidget(
    document.querySelector('#ais_filter-weekly-min'),
    document.querySelector('#ais_filter-weekly-max'),
    { ...WEEKLY_CONFIG, ratio: 1, ...RANGE_UI }
);

// Mounts for the three new filters are Webflow-authored once Josi builds them
// in the Designer (ids in EXTRA_FILTERS; stars under a titled block in the
// Location column, the kW slider as a full-width first row in Vehicle). Until then
// search.js injects the same markup (stamped data-wd-fallback) so the filters
// can be dialled in on dev without a publish; authored mounts win when present.
function ensureExtraFilterMounts() {
    const sections = [...document.querySelectorAll('.wd-filter-sections .wd-filter-section')];
    const byTitle = (re) => sections.find(s => re.test(s.querySelector('.wd-filter-section_title')?.textContent || ''));
    const wrapper = ({ mount, label }, extraClass = '') => {
        const wrap = document.createElement('div');
        wrap.className = `ais_filter-wrapper${extraClass ? ` ${extraClass}` : ''}`;
        wrap.setAttribute('data-wd-fallback', '');
        wrap.innerHTML = `<div class="stock_filters_input-label">${label}</div><div id="${mount}" class="ais_filter-placeholder"></div>`;
        return wrap;
    };
    const vehicle = byTitle(/vehicle/i) || sections[0];
    if (vehicle && !document.getElementById(EXTRA_FILTERS.power.mount)) {
        vehicle.querySelector('.wd-filter-section_body')?.prepend(wrapper(EXTRA_FILTERS.power, 'is-full')); // Josi 24 Sep: top of the grid
    }
    const location = byTitle(/location/i) || sections[sections.length - 1];
    if (location && !document.getElementById(EXTRA_FILTERS.energy.mount) && !document.getElementById(EXTRA_FILTERS.carbon.mount)) {
        const block = document.createElement('div');
        block.className = 'wd-filter-subsection';
        block.setAttribute('data-wd-fallback', '');
        block.innerHTML = '<div class="wd-filter-section_title">Economy &amp; Emissions</div><div class="wd-filter-section_body"></div>';
        block.querySelector('.wd-filter-section_body').append(wrapper(EXTRA_FILTERS.energy), wrapper(EXTRA_FILTERS.carbon));
        location.appendChild(block);
    }
}
ensureExtraFilterMounts();

// Star pickers (lib_algolia/widgets/star-filter.js): the index stores the EECA
// ratings as stars × 2 (12 = 6 stars, 0 = unrated), so a pick of N refines
// `>= N×2` through connectRange — same URL shape as the other ranges.
const { render: renderEnergyStars } = createStarFilterWidget(
    document.getElementById(EXTRA_FILTERS.energy.mount), { name: 'energy', label: 'energy economy rating' }
);
const { render: renderCarbonStars } = createStarFilterWidget(
    document.getElementById(EXTRA_FILTERS.carbon.mount), { name: 'carbon', label: 'carbon emissions rating' }
);
const customEnergyStars = instantsearch.connectors.connectRange(renderEnergyStars);
const customCarbonStars = instantsearch.connectors.connectRange(renderCarbonStars);
let enginePowerWidget = null; // facet-map widget, created in startSearch once the facet map is in

const customOdometerRangeInput = instantsearch.connectors.connectRange(renderOdometerRangeInput);
const customWeeklyRangeInput = instantsearch.connectors.connectRange(renderWeeklyRangeInput);
const customPriceRangeInput = instantsearch.connectors.connectRange(renderPriceRangeInput);
const customYearRangeInput = instantsearch.connectors.connectRange(renderYearRangeInput);

window.refinementListWidget = null;

document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('clear-all-button')) {
        const clearButton = document.querySelector('#ais_clear-all button');
        if (clearButton) {
            clearButton.click();
        }
    }
});

const createFilterDropdown = ({ container, attribute, label, searchable = false, sortType = null, labelTransform = null }) => {
    const baseConfig = {
        container,
        attribute,
        searchable,
        limit: 100,
    };

    if (sortType === 'numeric') {
        baseConfig.sortBy = ['name:asc'];
        baseConfig.transformItems = items => [...items].sort((a, b) => Number(a.label) - Number(b.label));
    } else if (sortType === 'alpha') {
        baseConfig.sortBy = ['name:asc'];
        baseConfig.transformItems = items => [...items].sort((a, b) =>
            a.label.toLowerCase().localeCompare(b.label.toLowerCase())
        );
    }

    // Display-only normalisation (lib_algolia/core/specs.js): relabel before the
    // sort transform; item.value is untouched so refinements still hit the index.
    if (labelTransform) {
        const sortTransform = baseConfig.transformItems;
        const relabel = items => items.map(item => {
            const display = labelTransform(item.label);
            return display === item.label ? item : { ...item, label: display, highlighted: display };
        });
        baseConfig.transformItems = sortTransform ? items => sortTransform(relabel(items)) : relabel;
    }

    return createDropdown(instantsearch.widgets.refinementList, {
        closeOnChange: false,
        buttonClassName: 'vs-filter-search w-select',
        buttonText({ items }) {
            const refinedItems = (items || []).filter(item => item.label !== 'All' && item.isRefined);
            if (refinedItems.length === 0) return `Select ${label}`;
            if (refinedItems.length === 1) return refinedItems[0].label.length > 22 ? "1 selected" : refinedItems[0].label;
            return `${refinedItems.length} selected`;
        }
    })(baseConfig);
};

const filters = [
    { container: '#ais_filter-make', attribute: 'make', label: 'Brand', searchable: true, sortType: 'alpha' },
    { container: '#ais_filter-fuel', attribute: 'fuel_type', label: 'Fuel Type', sortType: 'alpha' },
    { container: '#ais_filter-dealership', attribute: 'dealership', label: 'Dealership', sortType: 'alpha' },
    { container: '#ais_filter-region', attribute: 'region', label: 'Region', sortType: 'alpha' },
    { container: '#ais_filter-drivetrain', attribute: 'drivetrain_simple', label: 'Drivetrain', sortType: 'alpha', labelTransform: drivetrainFacetLabel },
    { container: '#ais_filter-condition', attribute: 'condition', label: 'New, Used or Demo', sortType: 'alpha' },
    { container: '#ais_filter-seats', attribute: 'seats', label: '# of Seats', sortType: 'numeric' },
    { container: '#ais_filter-model', attribute: 'model', label: 'Model', searchable: true, sortType: 'alpha' },
    { container: '#ais_filter-body-type', attribute: 'body_type', label: 'Body Type', sortType: 'alpha' },
    { container: '#ais_filter-transmission', attribute: 'transmission_simple', label: 'Transmission', sortType: 'alpha', labelTransform: v => normaliseTransmission(v) ?? v }
];

const additionalClearFilters = [
    { container: '#ais_filter-year', attribute: 'year' },
    { container: '#ais_filter-price', attribute: 'price_current_number' },
    { container: '#ais_filter-weekly', attribute: 'price_weekly_number' },
    { container: '#ais_filter-odometer', attribute: 'odometer' },
    { container: '#ais_search', attribute: 'query' }
];

search.addWidgets([
    instantsearch.widgets.configure({
        hitsPerPage: 21,
        filters: 'status:Active',
        facets: ['is_pre_owned_promise'] 
    }),

    instantsearch.widgets.searchBox({
        container: "#ais_search",
        placeholder: 'Type to search...',
        showReset: true,
        cssClasses: { input: ['vs-filter-search', 'is-wide', 'w-select'] }
    }),

    // Extras checkboxes removed from the filter UI (Josi 2026-07-28) — widgets
    // mount only if a page still carries the container; replacements, if ever
    // missed, are outcome-based quick filters.
    ...(document.querySelector('#ais_filter-check-1') ? [createFilterCheckboxWidget({
        container: document.querySelector('#ais_filter-check-1'),
        config: {
            type: 'numeric',
            attribute: 'price_savings_number',
            comparison: '>=',
            value: 1,
            label: 'Only Discounted Cars'
        }
    })] : []),

    ...(document.querySelector('#ais_filter-check-3') ? [createFilterCheckboxWidget({
        container: document.querySelector('#ais_filter-check-3'),
        config: {
        type: 'facet',
        attribute: 'is_pre_owned_promise',
        value: 'true',
        label: 'Pre-Owned Promise'
        }
    })] : []),

    ...(document.querySelector('#ais_filter-check-2') ? [createFilterCheckboxWidget({
        container: document.querySelector('#ais_filter-check-2'),
        config: {
            type: 'numeric',
            attribute: 'safety_stars',
            comparison: '=',
            value: 10,
            label: '5 Safety Stars'
        }
    })] : []),

    instantsearch.widgets.clearRefinements({
        container: '#ais_clear-all',
        templates: {
            resetLabel: 'Clear search and all filters'
        },
        cssClasses: {
            button: 'clear-all-button w-button'
        },
        includedAttributes: [
            'query',
            'make',
            'fuel_type',
            'dealership',
            'region',
            'drivetrain_simple',
            'condition',
            'seats',
            'model',
            'body_type',
            'price_weekly_number',
            'transmission_simple',
            'year',
            'price_current_number',
            'price_savings_number',
            'safety_stars',
            'odometer',
            'is_pre_owned_promise',
            EXTRA_FILTERS.energy.attribute,
            EXTRA_FILTERS.carbon.attribute,
            EXTRA_FILTERS.power.attribute
        ]
    }),

    stats({
        container: '#ais_stats',
        templates: {
            text(data, { html }) {
                const count = data.hasManyResults
                    ? `Showing ${data.nbHits} vehicles`
                    : data.hasOneResult
                        ? 'Showing 1 vehicle'
                        : 'No matching vehicles';
    
                const floatingStats = document.querySelector('.floating-stats');
                const statsText = floatingStats?.querySelector('.text-sm');
                if (statsText) {
                    if (data.nbHits > 0) {
                        statsText.textContent = `Found ${data.nbHits.toLocaleString()} vehicles`;
                        floatingStats.classList.remove('hidden');
                    } else {
                        floatingStats.classList.add('hidden');
                    }
                }
    
                return html`<span>${count} of ${totalObjectsInIndex} vehicles in stock</span>`;
            },
        }
    }),

    customYearRangeInput({ attribute: 'year' }),
    customPriceRangeInput({ attribute: 'price_current_number' }),
    customOdometerRangeInput({ attribute: 'odometer' }),
    customWeeklyRangeInput({ attribute: weeklyFilterAttribute }),
    customEnergyStars({ attribute: EXTRA_FILTERS.energy.attribute }),
    customCarbonStars({ attribute: EXTRA_FILTERS.carbon.attribute }),

    instantsearch.widgets.sortBy({
        container: '#ais_sort-by',
        items: [
            { label: 'Most relevant', value: 'stock' },
            { label: 'Most popular', value: 'stock_popularity_desc' },
            { label: 'Most recently added', value: 'stock_created_desc' },
            { label: 'Lowest price', value: 'stock_price_asc' },
            { label: 'Highest price', value: 'stock_price_desc' },
            { label: 'Largest discount', value: 'stock_savings_desc' },
            { label: 'Newest vehicles', value: 'stock_year_desc' },
            { label: 'Oldest vehicles', value: 'stock_year_asc' },
            { label: 'Lowest kms', value: 'stock_odometer_asc' },
            { label: 'Highest kms', value: 'stock_odometer_desc' }
        ],
        cssClasses: {
            select: 'select-field w-select'
        }
    }),

    instantsearch.widgets.hits({
        container: "#ais_results",
        templates: {
            empty(results, { html }) {
                return html`
                    <div class="no-results-message" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; padding: 2rem 0;">
                        <p>No vehicles found</p>
                        <p>Please clear your filters or broaden your search terms</p>
                        <div>
                            <button class="clear-all-button w-button" style="margin-left: 0">
                                Clear search and all filters
                            </button>
                        </div>
                    </div>
                `;
            },
            
            item(hit, { sendEvent, components }) {
                const template = document.querySelector('[ais-item="template"]');
                if (!template) {
                    console.error('Template not found');
                    return '';
                }
            
                const clone = template.cloneNode(true);
                clone.style.display = 'block';
                clone.href = listingUrl(hit.url);
            
                const fields = {
                    name: 'name',
                    'save-value': 'price_savings_text',
                    condition: 'condition',
                    price: 'price_formatted',
                    fuel: 'fuel_type',
                    odometer: 'odometer_text',
                    variant: 'variant',
                    'variant-extra': 'variant_extra',
                    image: 'mainImage',
                    region: 'region',
                    transmission: 'transmission_simple',
                    'price-current': 'price_current_text',
                    'price-special': 'price_current_text',
                };
            
                Object.entries(fields).forEach(([key, value]) => {
                    const element = clone.querySelector(`[ais-item="${key}"]`);
                    if (element) {
                        if (key === 'image') {
                            element.src = hit[value];
                            element.alt = hit.name;
                        } else if (value === 'price_current_text') {
                            element.textContent = priceText(hit);
                        } else {
                            element.textContent = hit[value];
                        }
                    }
                });
            
                const orcContainer = clone.querySelector('[ais-item="orc"]');
                if (orcContainer) {
                    orcContainer.style.display = hit.orc ? 'none' : 'block';
                }
            
                ['sold', 'pending', 'on-hold'].forEach(status => {
                    clone.querySelectorAll(`[ais-item="${status}"]`)
                        .forEach(el => el.style.display = 'none');
                });
            
                if (hit.status !== 'Active') {
                    const statusMap = { 'Sold': 'sold', 'Pending': 'pending', 'On-Hold': 'on-hold' };
                    const statusElements = clone.querySelectorAll(`[ais-item="${statusMap[hit.status]}"]`);
                    statusElements.forEach(el => el.style.display = 'flex');
                }
            
                const priceElements = {
                    special: ['price-now', 'price-special', 'save-tab'],
                    regular: ['price-current']
                };
            
                const showPrice = hit.price_savings_number > 0 ? 'special' : 'regular';
                const hidePrice = hit.price_savings_number > 0 ? 'regular' : 'special';
            
                priceElements[showPrice].forEach(attr => {
                    const element = clone.querySelector(`[ais-item="${attr}"]`);
                    if (element) element.style.display = 'flex';
                });
            
                priceElements[hidePrice].forEach(attr => {
                    const element = clone.querySelector(`[ais-item="${attr}"]`);
                    if (element) element.style.display = 'none';
                });

                decorateCard(clone, hit, DEFAULT_TAG_CONFIG, { ranks: popularityRanks });
                populateCardMeta(clone, hit);

                return clone.outerHTML;
            }
        }
    }),

    instantsearch.widgets.pagination({
        container: "#ais_pagination"
    }),

    ...filters.map(filter => createFilterDropdown(filter)),

    ...[...filters, ...additionalClearFilters].map(({ container, attribute }) =>
        clearRefinements({
            container: `${container}-clear`,
            includedAttributes: [attribute],
            templates: { resetLabel: 'x' }
        })
    )
]);

// --- 02-stock-search UX: applied-filter chips + outcome quick filters --------
// Mounts are Webflow-authored (#ais_current-filters, #ais_quick-filters);
// each widget silently no-ops when its mount is absent from the page.

// Chip labels live in lib_algolia/core/chip-labels.js (plain-language wording
// per Adam 2026-08-05: Less than / More than / Between, no operator symbols).
const currentFiltersEl = document.querySelector('#ais_current-filters');
if (currentFiltersEl) {
    currentFiltersEl.classList.add('wd-current-filters');
    search.addWidgets([
        instantsearch.widgets.currentRefinements({
            container: currentFiltersEl,
            // engine_power in facet-map mode is many facet values → ONE chip for the band
            transformItems: items => transformCurrentRefinementItems(items, {
                bands: { [ENGINE_POWER_CONFIG.attribute]: () => enginePowerWidget?.chip() }
            })
        })
    ]);
}

const quickFiltersEl = document.querySelector('#ais_quick-filters');
if (quickFiltersEl) {
    // Presets come from the hidden "Search | Quick Filters" collection list when
    // present (client-editable, goes live on publish); config list is the fallback.
    const cmsPresets = parsePresetsFromDOM(document.querySelector('#ais_quick-filters-data'));
    createQuickFilters({ container: quickFiltersEl, search, presets: cmsPresets.length ? cmsPresets : DEFAULT_QUICK_FILTERS });
}

// Card meta (ClickUp + Adam 2026-07-18): views (eye icon) / weekly price beside
// the main price. Each fills its `ais-item` slot when present — no slot, no-op.
// Slots keep authored children (icons, tooltips); text goes into [ais-item-value].
const VIEWS_DISPLAY_FLOOR = 1; // show any view count (Su-Anne 2026-10-07); 0 stays hidden

function populateCardMeta(clone, hit) {
    const set = (key, text) => {
        const el = clone.querySelector(`[ais-item="${key}"]`);
        if (!el) return;
        (el.querySelector('[ais-item-value]') ?? el).textContent = text ?? '';
        el.style.display = text ? '' : 'none';
    };
    const views = hit.pageViews ?? 0;
    set('views', views >= VIEWS_DISPLAY_FLOOR ? views.toLocaleString() : null);
    // display only — weekly *filtering* waits on Adam adding price_weekly_number
    // to numericAttributesForFiltering (index setting, his call)
    set('price-weekly', hit.price_weekly_number > 0 ? `${weeklyText(hit.price_weekly_text)}/wk` : null);
}

// No price in the feed (blank text or $0) → "P.O.A." rather than an empty slot or "$0"
const priceText = (hit) => (hit.price_current_text && hit.price_current_number !== 0) ? hit.price_current_text : 'P.O.A.';

// Some syncs already end the text in "/wk" — strip it so we never print "/wk/wk"
const weeklyText = (text) => String(text ?? '').replace(/\s*\/\s*wk\s*$/i, '');

// Tag strips re-measure on resize (fit-aware expansion), debounced.
let tagExpandTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(tagExpandTimer);
    tagExpandTimer = setTimeout(() => updateTagStripExpansion(document.querySelector('#ais_results') || document), 150);
});

// Popularity rank map for the Popular tag's "#N most viewed" tooltip — one
// read-only query against the existing popularity replica at startup.
let popularityRanks = null;

async function fetchPopularityRanks() {
    try {
        const index = searchClient.initIndex('stock_popularity_desc');
        const result = await index.search('', {
            hitsPerPage: DEFAULT_TAG_CONFIG.popular.topN,
            filters: 'status:Active',
            attributesToRetrieve: ['objectID'],
            attributesToHighlight: []
        });
        popularityRanks = new Map(result.hits.map((h, i) => [String(h.objectID), i + 1]));
    } catch (err) {
        console.warn('Popularity ranks unavailable — Popular tag falls back to thresholds', err);
    }
}
  
function hideUnwantedValues() {
    Object.entries(filterHidingConfig).forEach(([filterId, unwantedValues]) => {
        const valuesToHide = Array.isArray(unwantedValues) ? unwantedValues : [unwantedValues];
        const dropdownItems = document.querySelectorAll(`#${filterId} .ais-RefinementList-item`);

        dropdownItems.forEach(item => {
            const labelText = item.querySelector('.ais-RefinementList-labelText').textContent;
            if (valuesToHide.includes(labelText)) {
                item.style.display = 'none';
            }
        });
    });
}

search.once('start', () => {
    try {
        const helper = search.helper;
        if (!helper) return;
        helper.search();
    } catch (err) {
        console.error("Error applying URL filters:", err);
    }
});

search.on('render', function () {
    if (search.helper?.state) {
        lastHelperStateSnapshot = search.helper.state.clone ? search.helper.state.clone() : JSON.parse(JSON.stringify(search.helper.state));
    }

    syncPreOwnedPromiseEligibility(search.helper?.state);
    hideUnwantedValues();
    updateTagStripExpansion(document.querySelector('#ais_results') || document);

    ['price', 'weekly', 'year', 'odometer'].forEach(type => {
        const clearButton = document.querySelector(`#ais_filter-${type}-clear button`);
        const clearHolder = document.querySelector(`#ais_filter-${type}-clear-holder`);

        if (clearHolder && clearButton) {
            clearHolder.style.display = clearButton.hasAttribute('disabled') ? 'block' : 'none';
        }
    });

    const clearRefinementsContainer = document.querySelector('#ais_clear-all');
    const hasResults = search.status === 'idle' && search.searchResults?.nbHits > 0;

    if (clearRefinementsContainer) {
        clearRefinementsContainer.style.display = hasResults ? 'none' : 'block';
    }
});

// Engine power slider: facet-map mode needs the facet value list before the
// first search (so a URL band can be applied); numeric mode is a plain
// connectRange slider. A page without the mount, or a failed facet query,
// leaves the filter out (wrapper hidden) — nothing else changes.
async function mountEnginePower() {
    const container = document.getElementById(EXTRA_FILTERS.power.mount);
    if (!container) return;
    const wrapper = container.closest('.ais_filter-wrapper');
    if (ENGINE_POWER.mode === 'numeric') {
        const { render } = createEnginePowerSlider(container);
        search.addWidgets([instantsearch.connectors.connectRange(render)({ attribute: ENGINE_POWER.numericAttribute })]);
        return;
    }
    try {
        const map = await fetchEnginePowerMap(searchClient, 'stock', { filters: 'status:Active' });
        if (!map.entries.length) throw new Error('no parseable kW facet values');
        enginePowerWidget = createEnginePowerWidget({ container, map });
        search.addWidgets([enginePowerWidget]);
    } catch (err) {
        console.warn('Engine power filter unavailable:', err);
        if (wrapper) wrapper.hidden = true;
    }
}

async function startSearch() {
    try {
        await Promise.all([getObjectCount(), fetchPopularityRanks(), mountEnginePower()]);
        const floatingStats = createFloatingStats();
        floatingStats.classList.add('floating-stats');
        search.start();
    } catch (err) {
        console.error('Error starting the search:', err);
    }
}

startSearch();
});

document.addEventListener('DOMContentLoaded', function() {
    const filterRows = document.querySelectorAll('.ais_filter-row');
    const moreButton = document.querySelector('.ais_filters-more');
    const moreIcon = document.querySelector('.ais_filters-more svg');
    const moreText = document.querySelector('.ais_filters-more-text');
    let isExpanded = false;

    const setupFilterRows = () => {
        filterRows.forEach(row => {
            row.style.display = 'none';
            row.style.height = '0';
            row.style.overflow = 'hidden';
            row.style.transition = 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)';

            Array.from(row.children).forEach(child => {
                child.style.opacity = '0';
                child.style.transition = 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                child.style.transitionDelay = '0.4s';
            });
        });

        if (moreIcon) {
            moreIcon.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            moreIcon.style.transformOrigin = 'center';
            moreIcon.style.transform = 'rotate(90deg)';
        }
    };

    const expandRows = (row) => {
        row.style.transition = 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        row.style.display = 'grid';
        
        setTimeout(() => {
            const targetHeight = row.scrollHeight;
            row.style.height = '0';
            row.offsetHeight;
            row.style.height = `${targetHeight}px`;
            
            Array.from(row.children).forEach(child => {
                child.style.opacity = '1';
            });
            
            setTimeout(() => {
                row.style.height = 'auto';
                row.style.overflow = 'visible';
            }, 600);
        }, 0);
    };

    const collapseRows = (row) => {
        Array.from(row.children).forEach(child => {
            child.style.transitionDelay = '0s';
            child.style.opacity = '0';
        });

        setTimeout(() => {
            row.style.height = `${row.scrollHeight}px`;
            row.style.overflow = 'hidden';
            row.offsetHeight;
            row.style.height = '0';
            
            setTimeout(() => {
                row.style.display = 'none';
                Array.from(row.children).forEach(child => {
                    child.style.transitionDelay = '0.4s';
                });
            }, 600);
        }, 400);
    };

    setupFilterRows();

    moreButton.addEventListener('click', function(e) {
        e.preventDefault();
        isExpanded = !isExpanded;

        filterRows.forEach(row => {
            isExpanded ? expandRows(row) : collapseRows(row);
        });

        if (moreIcon) {
            moreIcon.style.transform = isExpanded ? 'rotate(-90deg)' : 'rotate(90deg)';
        }

        if (moreText) {
            moreText.textContent = isExpanded ? 'Less options' : 'More options';
        }
    });
});

function rewriteBrandToMake() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('brand')) {
        // Get the value of 'brand' and remove it
        const brandValue = urlParams.get('brand');
        urlParams.delete('brand');

        // Add the same value under 'make'
        urlParams.set('make', brandValue);

        // Update the browser's URL without refreshing the page
        const newUrl = `${window.location.pathname}?${urlParams.toString()}${window.location.hash}`;
        window.history.replaceState({}, '', newUrl);
    }
}