const filterElements = () => {

    // Combine secondary stock items into the primary list after filtering.
    var secondaryItems = $('[offer-stock="secondary-item"]');
    secondaryItems.appendTo('[offer-stock="primary-list"]');
    $('[offer-stock="secondary-list"]').remove();

    const fields = ['sku', 'dealership', 'condition', 'brand', 'model', 'yard', 'year'];
    const numericFields = ['savings', 'year', 'price']; // Fields that should always be treated as integers
    const brandExclusions = getExclusionValues('[manual-cmsfilter-field="brand-exclusions"]');
    const modelExclusions = getExclusionValues('[manual-cmsfilter-field="model-exclusions"]');
    let itemsToSort = [];

    $('[manual-cmsfilter-element="item"]').each(function() {
        let item = $(this);
        let showItem = true;

        // Apply dynamic queries for each field
        fields.forEach(field => {
            const queryValue = getFilterValue(`[manual-cmsfilter-field="${field}-query"]`);
            if (queryValue) {
                // Split the query values and ensure no extra spaces
                const queries = queryValue.split(',').map(query => query.trim().toLowerCase());
                
                // Check if any of the queries match the item's field
                const fieldText = item.find(`[manual-cmsfilter-field="${field}"]`).text().trim().toLowerCase();
                const fieldMatch = queries.some(query => fieldText.includes(query));
                
                if (!fieldMatch) showItem = false;
            }
        });

        // Apply brand exclusion logic
        const brand = item.find('[manual-cmsfilter-field="brand"]').text().trim().toLowerCase();
        if (brandExclusions.includes(brand)) {
            showItem = false;
        }

        // Apply model exclusion logic
        const model = item.find('[manual-cmsfilter-field="model"]').text().trim().toLowerCase();
        if (modelExclusions.includes(model)) {
            showItem = false;
        }

        // -----------------------------------------------------------
        // ED UPDATED: Savings Logic (Range + Threshold support)
        // -----------------------------------------------------------
        if (showItem) { 
            // Get raw savings and clean currency chars ($ ,) just in case
            const rawSavings = item.find('[manual-cmsfilter-field="savings"]').text().trim();
            const savings = parseInt(rawSavings.replace(/[^0-9.-]+/g,""), 10) || 0;

            // 1. Legacy Range Support (If you still use from/to inputs elsewhere)
            const savingsFrom = parseInt(getFilterValue('[manual-cmsfilter-field="savings-query"][manual-cmsfilter-range="from"]'), 10);
            const savingsTo = parseInt(getFilterValue('[manual-cmsfilter-field="savings-query"][manual-cmsfilter-range="to"]'), 10);

            // 2. New Threshold Support (Your requested "Greater than" logic)
            // Looks for input without range attributes
            const savingsThreshold = parseInt(getFilterValue('input[manual-cmsfilter-field="savings-query"]:not([manual-cmsfilter-range])'), 10);

            // Apply Range Filter (Legacy)
            if ((!isNaN(savingsFrom) && savings < savingsFrom) ||
                (!isNaN(savingsTo) && savings > savingsTo)) {
                showItem = false;
            }

            // Apply Threshold Filter (New)
            // If savings are LESS than the threshold, hide the item.
            if (!isNaN(savingsThreshold) && savings < savingsThreshold) {
                showItem = false;
            }
        }
        // -----------------------------------------------------------


        // Handle each item that passes the filters
        if (showItem) {
            let itemData = { item: item[0] }; // Store the DOM element
            fields.concat(numericFields).forEach(field => {
                let fieldValue = item.find(`[manual-cmsfilter-field="${field}"]`).text().trim();
                // Ensure numeric fields are cleaned before parsing
                if (numericFields.includes(field)) {
                     itemData[field] = parseInt(fieldValue.replace(/[^0-9.-]+/g,""), 10) || 0;
                } else {
                     itemData[field] = fieldValue.toLowerCase();
                }
            });
            itemsToSort.push(itemData);
        } else {
            item.hide();
        }
    });

    // Sorting items by numeric fields where applicable
    const sortFields = ['price', 'savings']; // fields to sort
    itemsToSort.sort((a, b) => {
        let result = 0;
        sortFields.forEach(field => {
            const sortDirection = getFilterValue(`[manual-cmsfilter-field="${field}-sort"]`);
            if (sortDirection && result === 0) { // Only apply sort if no previous sorting criteria has determined an order
                const valA = a[field], valB = b[field];
                if (valA != null && valB != null) {
                    result = sortDirection === 'asc' ? valA - valB : valB - valA;
                }
            }
        });
        return result;
    });

    // Append sorted items back to the DOM
    const container = $('[manual-cmsfilter-element="item"]').parent();
    container.empty();
    itemsToSort.forEach(data => container.append(data.item)); // Append the stored DOM elements
};

const getExclusionValues = selector => {
    const exclusions = $(selector).val();
    return exclusions ? exclusions.split(',').map(exclusion => exclusion.trim().toLowerCase()) : [];
};

const getFilterValue = selector => {
    const element = $(selector);
    return element.length ? element.val() : null;
};

$(document).ready(() => {
    filterElements();
});

$(document).ready(function() {
    $('form').each(function() {
        var ids = {};
        $(this).find('[id]').each(function() {
            var id = $(this).attr('id');
            if (id !== 'field-date') { // Exclude #field-date
                if (ids[id]) {
                    ids[id].remove();
                }
                ids[id] = $(this);
            }
        });
    });
});


$(document).ready(function () {

   var now = Date.now();

    $('[data-input="datepicker"]').datepicker({
        format: 'dd-mm-yyyy',
        startDate: now,
        weekStart: 1,
        filter: function(date, view) {
            if (date.getDay() === 0 && view === 'day') {
              return false; // Disable all Sundays, but still leave months/years, whose first day is a Sunday, enabled.
            }
        }
    });


    var itemCount = $('[data-select2="item"]').length;
    if (itemCount === 1) {
        console.log($('[data-select2="item"]').find('[data-select2="dealership"]').text());
        $('#wrapper-dealership').remove();
        $('#field-dealership').remove();
        var dealershipText = $('[data-select2="item"]').find('[data-select2="dealership"]').text();
        var hiddenInput = $('<input>', {
            type: 'hidden',
            id: 'hidden-dealership',
            name: 'Dealership',
            value: dealershipText
        });
        $('#form-html-embed').append(hiddenInput);
        $('[data-ga4tracking-type="form"]').attr('data-ga4-param-dealership', dealershipText);
    }
});