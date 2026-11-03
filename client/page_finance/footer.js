$(document).ready(function() {
    function handleFinanceButtons(selector, buttonDataFinance) {
        var selectedValue = $(selector).val();
        
        // Find the dealership data by matching the selected value
        $('[data-select2="dealership"]').each(function() {
            if ($(this).text().trim() === selectedValue) {
                var url = $(this).siblings('[data-select2="finance-url"]').text().trim();
                var $button = $('[data-finance="' + buttonDataFinance + '"]');
                
                // Update button attributes if URL exists
                if (url && url.length > 0) {
                    $button.attr('href', url);
                    $button.attr('data-ga4-param-dealership', selectedValue);
                    
                    // Reset button styling
                    $button.css({
                        'background-color': '',
                        'border-color': '',
                        'cursor': ''
                    });
                }
            }
        });
    }

    function handleUsedCarButton(selector) {
        var selectedValue = $(selector).val();
        var $usedCarButton = $('[data-finance="used car button"]');
        
        if (selectedValue && $usedCarButton.length) {
            $('[data-select2="dealership"]').each(function() {
                if ($(this).text().trim() === selectedValue) {
                    var altDealerParam = $(this).siblings('[data-select2="alt-dealer-param"]').text().trim();
                    var dealerParam = altDealerParam || $(this).text().trim();
                    var usedCarUrl = 'https://www.ebbett.co.nz/stock/all?dealership=' + dealerParam + '&condition=Used,Demo';
                    $usedCarButton.attr('href', usedCarUrl);
                    
                    // Reset button styling
                    $usedCarButton.css({
                        'background-color': '',
                        'border-color': '',
                        'cursor': ''
                    });
                }
            });
        }
    }

    function setupButton(selector, buttonSelector) {
        // Initial button state setup
        $(buttonSelector).each(function() {
            var href = $(this).attr('href');
            if (!href || href === '#' || href.length < 2) {
                $(this).css({
                    'background-color': '#6d6e71',
                    'border-color': '#6d6e71',
                    'cursor': 'no-drop'
                });
            }
        });
    }

    // Handle selector changes
    $('#field-ebbett-finance').change(function() {
        if ($(this).val()) {
            handleFinanceButtons(this, 'new car button');
            handleFinanceButtons(this, 'calculator button');
            handleUsedCarButton(this);
        }
    });

    // Initial setup for all buttons
    setupButton('#field-ebbett-finance', '[data-finance="new car button"]');
    setupButton('#field-ebbett-finance', '[data-finance="calculator button"]');
    setupButton('#field-ebbett-finance', '[data-finance="used car button"]');
});