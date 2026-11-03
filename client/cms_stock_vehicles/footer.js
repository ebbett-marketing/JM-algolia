$(document).ready(function() {

    // === Gallery setup ===

    $('.ss-vehicle_image-button').click(function() {
        $('[data-gallery="position-1"] .stock_cms-gallery-image').click();
    });

    var galleryItems = $('[data-gallery="item"]').slice(0, 4).toArray();
    galleryItems.forEach(function(item, i) {
        $('[data-gallery="position-' + (i + 1) + '"]').append(item);
    });

    var proofItems = $('[data-gallery="item-proof"]').slice(0, 4).toArray();
    proofItems.forEach(function(item, i) {
        $('[data-gallery="position-' + (i + 1) + '-proof"]').append(item);
    });

    $('.stock_cms-gallery-image').magnificPopup({
        type: 'image',
        gallery: { enabled: true }
    });

    $('.stock_cms-gallery-image-proof').magnificPopup({
        type: 'image',
        gallery: { enabled: true }
    });

    // === Buying guides ===

    var $buyingGuidesSection = $("[data-buying-guides='wrapper']");

    // 1. Hide Pre-Owned Promise if the dealership isn't participating, vehicle isn't used, is a JLR yard, or is as-traded
    var hasPreOwnedPromise = (window.__CMS__.dealershipCategories || '').toLowerCase().includes('pre-owned promise');
    var hasUsedCar = (window.__CMS__.condition || '').trim().toLowerCase() === 'used';
    var notJLRYards = window.__CMS__.yard !== '8811' && window.__CMS__.yard !== '11521';

    var hasAsTradedByEbbett = $("[data-cms-reference='comments'], [data-cms-reference='features'], [data-cms-reference='features-2']").filter(function() {
        return $(this).text().toLowerCase().includes('as traded by ebbett');
    }).length > 0;

    if (!hasPreOwnedPromise || !hasUsedCar || !notJLRYards || hasAsTradedByEbbett) {
        $("[data-buying-guide='pre-owned-promise']").hide();
    }

    // 2. Hide charger guide if not Electric or Plug-In Hybrid
    $("[data-vehicle-spec='fuel']").each(function() {
        var fuelType = $(this).text().trim().toLowerCase();
        if (fuelType !== 'electric' && fuelType !== 'plug-in hybrid') {
            $buyingGuidesSection.find("[data-buying-guide='charger']").hide();
        }
    });

    // 3. Hide service-select guide for vehicles within 6 years or luxury makes
    $("[data-vehicle-spec='year']").each(function() {
        var year = parseInt($(this).text().trim());
        var currentYear = new Date().getFullYear();
        if (year >= currentYear - 6) {
            $buyingGuidesSection.find("[data-buying-guide='service-select']").hide();
        }
    });

    var luxuryMakes = ["mercedes-benz", "bmw", "audi", "skoda", "lexus", "land rover", "jaguar",
        "alfa romeo", "bentley", "porsche", "corvette", "maserati", "lamborghini",
        "ferrari", "aston martin", "rolls-royce", "mclaren"];

    var make = (window.__CMS__.make || '').trim().toLowerCase();
    if (luxuryMakes.includes(make)) {
        $buyingGuidesSection.find("[data-buying-guide='service-select']").hide();
    }

    // 4. Limit visible buying guide items to 3
    var visibleItems = $buyingGuidesSection.find("[data-buying-guides='item']:visible");
    if (visibleItems.length > 3) {
        visibleItems.slice(3).each(function() {
            $(this).hide();
        });
    }

    // === Finance wrapper ===

    $('#finance_wrapper-tnz').hide();
    $('#finance_wrapper-standard').hide();
    $('#section_tnc').hide();

    var toyotaDealerships = [
        "Ebbett Toyota Hamilton",
        "Ebbett Toyota Te Awamutu",
        "Ebbett Toyota Morinsville"
    ];

    var lexusDealerships = [
        "Lexus of Hamilton",
        "Lexus of Tauranga"
    ];

    // EM-184: the Ebbett 3.0 /inventory template carries the name on
    // [data-dealership-name] (set via the API 2026-09-03); the old /product
    // template used #dealership_name. First match wins either way.
    var dealershipName = $('#dealership_name, [data-dealership-name]').first().text().trim();

    if (toyotaDealerships.includes(dealershipName)) {
        $('#finance_wrapper-tnz').show();
        $('#finance_learn-more').attr('href', 'https://www.toyota.co.nz/toyota-finance-leasing/finance-and-lease-options/?addealer=ebbett-toyota');
        $buyingGuidesSection.hide();
    } else if (lexusDealerships.includes(dealershipName)) {
        $('#finance_wrapper-tnz').show();
        $('#finance_learn-more').attr('href', 'https://www.lexus.co.nz/en/finance-and-leasing.html');
        $buyingGuidesSection.hide();
    } else {
        $('#finance_wrapper-standard').show();
        $('#section_tnc').show();
    }

    updateFinanceLinks();

    // === Empty state ===

    var hasContent = $('[data-cms-reference="comments"], [data-cms-reference="features"], [data-cms-reference="features-2"]')
        .filter(function() { return $(this).text().trim().length >= 2; }).length > 0;
    $('[data-cms-reference="empty"]').css('display', hasContent ? 'none' : 'flex');

    // === Pre-Owned Promise badge visibility ===

    if (hasPreOwnedPromise) {
        $("[data-dealership-category='pre-owned promise']").hide();
    }

    // === Tracking ===

    if (typeof fbq === 'function') {
        fbq('track', 'ViewContent', {
            content_ids: [window.__CMS__.sku],
            content_type: 'vehicle'
        });
    }

    // === Misc ===

    removeElementsIfVinMatches();
});


function removeElementsIfVinMatches() {
    var vinList = ["WV1ZZZSYZM9060333"]; // Add more VINs as needed
    var stockVin = $("#stock-vin").text().trim();
    if (vinList.includes(stockVin)) {
        $("#impel-target").remove();
    }
}


function updateFinanceLinks() {
    const listingPrice = document.querySelector('[data-listing-price]')?.textContent || '';
    const listingRego = document.querySelector('[data-listing-rego]')?.textContent || '';

    const calculateLink = document.getElementById('finance-calculate');
    const applyLink = document.getElementById('finance-apply');

    const addParamsToUrl = (url) => {
        const baseUrl = url.split('?')[0];
        const existingParams = url.includes('?') ? url.split('?')[1] : '';
        const newParams = `rego=${encodeURIComponent(listingRego)}&price=${encodeURIComponent(listingPrice)}`;
        const finalParams = existingParams ? `${existingParams}&${newParams}` : newParams;
        return `${baseUrl}?${finalParams}`;
    };

    if (calculateLink) {
        calculateLink.href = addParamsToUrl(calculateLink.href);
    }
    if (applyLink) {
        applyLink.href = addParamsToUrl(applyLink.href);
    }
}


// === Splide slider ===

function slider1() {
    let splides = $('.slider1');
    for (let i = 0, splideLength = splides.length; i < splideLength; i++) {
        new Splide(splides[i], {
            perPage: 1,
            perMove: 1,
            focus: 0,
            lazyLoad: 'nearby',
            type: 'slide',
            gap: '0',
            arrows: 'slider',
            pagination: 'slider',
            speed: 600,
            dragAngleThreshold: 30,
            autoWidth: false,
            rewind: false,
            rewindSpeed: 400,
            waitForTransition: false,
            updateOnMove: true,
            trimSpace: false,
            breakpoints: {
                991: {},
                767: {},
                479: {}
            }
        }).mount();
    }
}

slider1();


// === Showdown markdown ===

$(function() {
    let converter = new showdown.Converter({
        tables: true,
        noHeaderId: true,
        headerLevelStart: 2,
        literalMidWordUnderscores: true
    });

    $('markdown').toArray().forEach((el) => {
        el.outerHTML = converter.makeHtml(el.innerHTML);
    });
});


// === PhotoSwipe lightbox ===

// PhotoSwipe straight from npm (Ebbett served an unmodified copy of 5.4.4).
import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js').then(({ default: PhotoSwipeLightbox }) => {
    const lightbox = new PhotoSwipeLightbox({
        gallery: '#product-gallery',
        children: 'a',
        pswpModule: () => import('https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.esm.min.js')
    });

    lightbox.addFilter('numItems', () => window.__CMS__.productImageNum);

    lightbox.addFilter('itemData', (_itemData, index) => ({
        src: `${window.__CMS__.imagePrefix}-${index}/gallery`,
        width: 1440,
        height: 1080
    }));

    lightbox.init();
    window.pswpLightbox = lightbox;
});
