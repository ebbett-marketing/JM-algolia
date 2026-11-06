import { createDropdown } from './dropdown.js';
import { createPriceRangeWidget } from './widget-price-range.js';

const WAIT_FOR_INSTANTSEARCH_MAX_ATTEMPTS = 100;
const WAIT_FOR_INSTANTSEARCH_INTERVAL_MS = 100;

function waitForInstantSearch(callback, attempt = 0) {
    if (
        window.algoliasearch &&
        window.instantsearch &&
        window.instantsearch.widgets
    ) {
        callback();
    } else if (attempt >= WAIT_FOR_INSTANTSEARCH_MAX_ATTEMPTS) {
        console.warn(
            'ev.js: Algolia InstantSearch failed to load after',
            WAIT_FOR_INSTANTSEARCH_MAX_ATTEMPTS * WAIT_FOR_INSTANTSEARCH_INTERVAL_MS,
            'ms. Search UI was not initialized.'
        );
    } else {
        setTimeout(
            () => waitForInstantSearch(callback, attempt + 1),
            WAIT_FOR_INSTANTSEARCH_INTERVAL_MS
        );
    }
}

waitForInstantSearch(async () => {
const algoliasearch = window.algoliasearch;
const instantsearch = window.instantsearch;
const { clearRefinements } = instantsearch.widgets;
const { stats } = instantsearch.widgets;

const searchClient = algoliasearch(
    'G2Y7I1BLJW',
    'e54bd7c6bd9b6c2df13fe6615eca943d'
);

const search = instantsearch({
    searchClient,
    indexName: "models_price_asc",
    routing: true,
    insights: true
});

let totalObjectsInIndex = 0;

async function getObjectCount() {
    const index = searchClient.initIndex('models_price_asc');

    try {
        const result = await index.search('', {
            hitsPerPage: 0,
            filters: 'fuelType:"Electric (EV)" OR fuelType:"Plug-In Hybrid (PHEV)"'
        });
        totalObjectsInIndex = result.nbHits;
        return totalObjectsInIndex;
    } catch (err) {
        console.error('Error fetching object count:', err);
        throw err;
    }
}

const { render: renderPriceRangeInput, priceRangeFilter } = createPriceRangeWidget(
    document.querySelector('#ais_filter-price-min'),
    document.querySelector('#ais_filter-price-max')
);

const customPriceRangeInput = instantsearch.connectors.connectRange(renderPriceRangeInput);

let hitItemTemplateEl;
let hitItemTemplateWarned = false;

search.addWidgets([
    instantsearch.widgets.configure({
        hitsPerPage: 40,
        filters: 'fuelType:"Electric (EV)" OR fuelType:"Plug-In Hybrid (PHEV)"',
    }),
    instantsearch.widgets.searchBox({
        container: "#ais_search",
        placeholder: 'Type to search...',
        showReset: true
    }),
    clearRefinements({
        container: '#ais_search-clear',
        includedAttributes: ['query'],
        templates: {
            resetLabel: 'x',
        },
    }),
    customPriceRangeInput({
        attribute: 'price'
    }),
    clearRefinements({
        container: '#ais_filter-price-clear',
        includedAttributes: ['price'],
        templates: {
            resetLabel: 'x',
        },
    }),
    createDropdown(instantsearch.widgets.refinementList, {
        closeOnChange: false,
        buttonClassName: 'vs-filter-search w-select',
        buttonText({ items }) {
            const refinedItems = (items || []).filter(
                item => item.label !== 'All' && item.isRefined
            );
            if (refinedItems.length === 1) {
                return `${refinedItems[0].label}`;
            } else if (refinedItems.length === 2) {
                return `${refinedItems[0].label}, ${refinedItems[1].label}`;
            } else if (refinedItems.length > 2) {
                return `${refinedItems.length} selected`;
            } else {
                return 'Select Fuel Type';
            }
        }
    })({
        container: '#ais_filter-fuel',
        attribute: 'fuelType',
        searchable: false
    }),
    clearRefinements({
        container: '#ais_filter-fuel-clear',
        includedAttributes: ['fuelType'],
        templates: {
            resetLabel: 'x',
        }
    }),
    createDropdown(instantsearch.widgets.refinementList, {
        closeOnChange: false,
        buttonClassName: 'vs-filter-search w-select',
        buttonText({ items }) {
            const refinedItems = (items || []).filter(
                item => item.label !== 'All' && item.isRefined
            );
            if (refinedItems.length === 1) {
                return `${refinedItems[0].label}`;
            } else if (refinedItems.length === 2) {
                return `${refinedItems[0].label}, ${refinedItems[1].label}`;
            } else if (refinedItems.length > 2) {
                return `${refinedItems.length} selected`;
            } else {
                return 'Select Brand';
            }
        }
    })({
        container: '#ais_filter-make',
        attribute: 'vehicleBrand',
        limit: 50
    }),
    clearRefinements({
        container: '#ais_filter-make-clear',
        includedAttributes: ['vehicleBrand'],
        templates: {
            resetLabel: 'x',
        }
    }),
    createDropdown(instantsearch.widgets.refinementList, {
        closeOnChange: false,
        buttonClassName: 'vs-filter-search w-select',
        buttonText({ items }) {
            const refinedItems = (items || []).filter(
                item => item.label !== 'All' && item.isRefined
            );
            if (refinedItems.length === 1) {
                return `${refinedItems[0].label}`;
            } else if (refinedItems.length > 1) {
                return `${refinedItems.length} selected`;
            } else {
                return 'Minimum number of seats';
            }
        }
    })({
        container: '#ais_filter-seats',
        attribute: 'seats',
        searchable: false,
        sortBy: function (a, b) {
            return Number(a.label) - Number(b.label);
        }
    }),
    clearRefinements({
        container: '#ais_filter-seats-clear',
        includedAttributes: ['seats'],
        templates: {
            resetLabel: 'x',
        }
    }),
    stats({
        container: '#ais_stats',
        templates: {
            text(data, { html }) {
                let count = '';

                if (data.hasManyResults) {
                    count += `${data.nbSortedHits || data.nbHits} vehicles`;
                } else if (data.hasOneResult) {
                    count += `1 vehicle`;
                } else {
                    count += `No matching vehicles`;
                }

                if (totalObjectsInIndex > 0) {
                    return html`<div class="text-size-small">Showing <span class="text-weight-semibold">${count}</span> of ${totalObjectsInIndex} vehicles in stock</div>`;
                } else {
                    return html`<span class="text-size-small text-weight-semibold">${count}</span>`;
                }
            },

        }
    }),
    createDropdown(instantsearch.widgets.refinementList, {
        closeOnChange: false,
        buttonClassName: 'vs-filter-search w-select',
        buttonText({ items }) {
            const refinedItems = (items || []).filter(
                item => item.label !== 'All' && item.isRefined
            );
            if (refinedItems.length === 1) {
                return refinedItems[0].label.length > 22 
                    ? "1 selected" 
                    : refinedItems[0].label;
            } else if (refinedItems.length > 1) {
                return `${refinedItems.length} selected`;
            } else {
                return 'Select Dealership';
            }
        }
    })({
        container: '#ais_filter-dealership',
        attribute: 'dealerships',
        searchable: false,
        sortRemainingBy: 'alpha',
        limit: 50
    }),
    clearRefinements({
        container: '#ais_filter-dealership-clear',
        includedAttributes: ['dealerships'],
        templates: {
            resetLabel: 'x',
        }
    }),
    
    createDropdown(instantsearch.widgets.refinementList, {
        closeOnChange: false,
        buttonClassName: 'vs-filter-search w-select',
        buttonText({ items }) {
            const refinedItems = (items || []).filter(
                item => item.label !== 'All' && item.isRefined
            );
            if (refinedItems.length === 1) {
                return `${refinedItems[0].label}`;
            } else if (refinedItems.length === 2) {
                return `${refinedItems[0].label}, ${refinedItems[1].label}`;
            } else if (refinedItems.length > 2) {
                return `${refinedItems.length} selected`;
            } else {
                return 'Select Body Type';
            }
        }
    })({
        container: '#ais_filter-body-type',
        attribute: 'bodyType',
        searchable: false
    }),
    clearRefinements({
        container: '#ais_filter-body-clear',
        includedAttributes: ['bodyType'],
        templates: {
            resetLabel: 'x',
        }
    }),
    createDropdown(instantsearch.widgets.refinementList, {
        closeOnChange: false,
        buttonClassName: 'vs-filter-search w-select',
        buttonText({ items }) {
            const refinedItems = (items || []).filter(
                item => item.label !== 'All' && item.isRefined
            );
            if (refinedItems.length === 1) {
                return `${refinedItems[0].label}`;
            } else if (refinedItems.length === 2) {
                return `${refinedItems[0].label}, ${refinedItems[1].label}`;
            } else if (refinedItems.length > 2) {
                return `${refinedItems.length} selected`;
            } else {
                return 'Select Drivetrain';
            }
        }
    })({
        container: '#ais_filter-drivetrain',
        attribute: 'driveTrain',
        searchable: false
    }),
    clearRefinements({
        container: '#ais_filter-drivetrain-clear',
        includedAttributes: ['driveTrain'],
        templates: {
            resetLabel: 'x',
        }
    }),
    instantsearch.widgets.sortBy({
        container: '#ais_sort-by',
        items: [
            { label: 'Most popular models', value: 'models_popularity' },
            { label: 'Lowest price', value: 'models_price_asc' },
            { label: 'Highest price', value: 'models_price_desc' }
        ],
        cssClasses: {
            select: 'select-field w-select'
        }
    }),
    instantsearch.widgets.hits({
        container: "#ais_results",
        templates: {
            item(hit, { sendEvent, components }) {
                if (hitItemTemplateEl === undefined) {
                    hitItemTemplateEl = document.querySelector('[ais-item="template"]');
                    if (!hitItemTemplateEl && !hitItemTemplateWarned) {
                        hitItemTemplateWarned = true;
                        console.error('Template not found');
                    }
                }
                if (!hitItemTemplateEl) {
                    return '';
                }

                const clone = hitItemTemplateEl.cloneNode(true);
                clone.style.display = 'block';
                clone.href = hit.url;

                if (hit.openInNewTab) {
                    clone.setAttribute("target", "_blank");
                } else {
                    clone.removeAttribute("target");
                }

                const mappings = {
                    name: 'name',
                    price: 'priceFormatted',
                    pricedetail: 'priceDetail',
                    fuel: 'fuelType',
                    image: 'mainImage',
                    transmission: 'transmission_simple',
                };

                Object.keys(mappings).forEach(key => {
                    const element = clone.querySelector(`[ais-item="${key}"]`);
                    if (element) {
                        if (key === 'image') {
                            element.src = hit[mappings[key]];
                            element.alt = hit.name;
                            element.setAttribute('loading', 'lazy'); // Lazy load images
                        } else {
                            element.textContent = hit[mappings[key]];
                        }
                    }
                });

                return clone.outerHTML;
            }
        }
    }),
    instantsearch.widgets.pagination({
        container: "#ais_pagination",
        scrollTo: "#model-search"
    })
]);

function hideUnwantedValues(unwantedValues) {
    const dropdownItems = document.querySelectorAll('#ais_filter-fuel .ais-RefinementList-item');
    dropdownItems.forEach(item => {
        const labelEl = item.querySelector('.ais-RefinementList-labelText');
        if (!labelEl) {
            return;
        }
        if (unwantedValues.includes(labelEl.textContent)) {
            item.style.display = 'none';
        }
    });
}

search.on('render', function () {
    hideUnwantedValues(['Hybrid (HEV)', 'Petrol', 'Diesel']);

    const minSelect = document.querySelector('#ais_filter-price-min select');
    const maxSelect = document.querySelector('#ais_filter-price-max select');
    if (minSelect && maxSelect) {
        const minValue = parseFloat(minSelect.value) || 0;
        const maxValue = parseFloat(maxSelect.value) || 0;
        // Use the priceRangeFilter instance from the widget
        priceRangeFilter.updateRefinedClass(minValue, maxValue);
    }
    const clearWrapper = document.querySelector('.ais_clear-button-placeholder');
    const clearButton = document.querySelector('#ais_filter-price-clear button');
    
    if (clearWrapper && clearButton) {
        clearWrapper.style.display = clearButton.hasAttribute('disabled') ? 'block' : 'none';
    }

});

async function startSearch() {
    try {
        await getObjectCount();
        search.start();
    } catch (err) {
        console.error('Error starting the search:', err);
    }
}

startSearch();
});