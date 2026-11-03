// Sort Dealerships so that service only locations are last in the list - Adam Murray - 9/2/24
$(document).ready(function() {
    var serviceOnlyItems = $("[data-dealership='listing-sort-item']").filter(function() {
        return $(this).find("[data-dealership='service only']").length > 0;
    });

    $("[data-dealership='sorted-list']").append(serviceOnlyItems);

    $("[data-dealership='proof']").each(function() {
        $(this).parent().hide();
    });
});

function handleFieldChange() {
  var selectedValue = $('#field-dealership').val();
  var fieldEnquiryValue = $('#field-enquiry').val();

  var matchedItem = $('[data-select2="item"]').filter(function() {
      return $(this).find('[data-select2="dealership"]').text() === selectedValue;
  });

  var siblingUrl = matchedItem.find('[data-select2="url"]').text();
  var serviceOnline = matchedItem.find('[data-service-online-url]').attr('data-service-online-url') === 'true';

  if ((fieldEnquiryValue === "service enquiry" || fieldEnquiryValue === "service booking") && serviceOnline && siblingUrl) {
      $('[data-serviceonline="wrapper"]').css('display', 'flex');
      $('[data-serviceonline="wrapper"]').find('[data-serviceonline="button"]').attr('href', siblingUrl);
      $('[data-serviceonline="wrapper"]').find('[data-serviceonline="button"]').attr('data-ga4-param-dealership', selectedValue);
  } else {
      $('[data-serviceonline="wrapper"]').css('display', 'none');
  }
}

$(document).ready(function() {
  $('#field-dealership, #field-enquiry').change(handleFieldChange);
});


$(document).ready(function() {
  if ($('[data-select2="item"]').length === 1) {
      $('#wrapper-dealership').remove();

      var dealershipName = $('[data-select2="item"]').find('[data-select2="dealership"]').text();

      var hiddenInput = $('<input>').attr({
          type: 'hidden',
          id: 'field-dealership',
          name: 'Dealership',
          value: dealershipName
      });

      $('[data-ga4tracking-type="form"]').attr('data-ga4-param-dealership', dealershipName);

      $('#form-html').append(hiddenInput);
  }
});


const offersObserver = new MutationObserver((mutations) => {
  const slide2 = document.querySelector('#current-offers-slide-2');
  const offersList = document.querySelector('#current-offers-list');
  
  if (slide2 && offersList) {
    const isHidden = slide2.style.display === 'none' || 
                     window.getComputedStyle(slide2).display === 'none';
    
    if (isHidden) {
      offersList.style.gridTemplateColumns = '1fr';
      offersList.style.margin = '0 auto';
      offersList.style.maxWidth = '640px';
    } else {
      offersList.style.gridTemplateColumns = '1fr 1fr';
      offersList.style.margin = '0';
      offersList.style.maxWidth = 'none';
    }
  }
});

// Start observing the target element
const slide2 = document.querySelector('#current-offers-slide-2');
if (slide2) {
  offersObserver.observe(slide2, {
    attributes: true,
    attributeFilter: ['style']
  });
}

(() => {
    const handleStyles = () => {
      const slide2 = document.querySelector('#current-offers-slide-2');
      const slide3 = document.querySelector('#current-offers-slide-3');
      
      const isSlide2Hidden = !slide2 || slide2.style.display === 'none' || 
                            window.getComputedStyle(slide2).display === 'none';
      const isSlide3Hidden = !slide3 || slide3.style.display === 'none' || 
                            window.getComputedStyle(slide3).display === 'none';
      
      const isSingleSlide = isSlide2Hidden && isSlide3Hidden;
                           
      if (!isSingleSlide) return;
  
      const slide1 = document.querySelector('#current-offers-slide-1');
      if (!slide1) return;
      
      const isFullwidth = slide1.getAttribute('current-offers-commands')?.includes('fullwidth');
      const isTablet = window.innerWidth <= 991;
      
      const itemContainer = document.querySelector('.current-offers_featured-item-container');
      if (!itemContainer) return;
  
      if (!isFullwidth) {
        itemContainer.style.cssText = 'grid-column: auto; max-width: 960px; margin: 0 auto;';
        slide1.style.cssText = 'aspect-ratio: 16/9; margin: 0 auto;';
        
        slide1.querySelectorAll('.current-offers_featured-image').forEach(img => {
          img.style.cssText = '';
        });
        
        const featuredLink = slide1.querySelector('.current-offers_featured-link');
        if (featuredLink) featuredLink.style.cssText = '';
        return;
      }
      
      // Only process fullwidth styles
      const featuredList = document.querySelector('.current-offers_featured-list');
      if (featuredList) featuredList.style.display = 'block';
      
      itemContainer.style.cssText = 'grid-column: 1 / -1; max-width: none; margin: 0;';
      
      slide1.style.cssText = `
        max-width: none;
        width: 100%;
        aspect-ratio: ${isTablet ? '16/9' : 'auto'};
        height: ${isTablet ? '' : '540px'};
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
      `;
      
      slide1.querySelectorAll('.current-offers_featured-image').forEach(img => {
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; object-position: center; aspect-ratio: auto;';
      });
      
      const featuredLink = slide1.querySelector('.current-offers_featured-link');
      if (featuredLink) {
        featuredLink.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
      }
    };
  
    const stylesObserver = new MutationObserver(handleStyles);
    const slide1 = document.querySelector('#current-offers-slide-1');
    const slide2 = document.querySelector('#current-offers-slide-2');
    const slide3 = document.querySelector('#current-offers-slide-3');
  
    [slide1, slide2, slide3].forEach(el => {
      if (el) stylesObserver.observe(el, {
        attributes: true,
        attributeFilter: el.id === 'current-offers-slide-1' ? ['current-offers-commands'] : ['style']
      });
    });
  
    window.addEventListener('resize', handleStyles);
    handleStyles();
  })();
  
  document.querySelectorAll('a[data-url-alt]').forEach(anchor => {
    const dataUrlAlt = anchor.getAttribute('data-url-alt');
    if (dataUrlAlt) {
        let href = anchor.getAttribute('href');
        // Use a regular expression to find and replace "make=***"
        href = href.replace(/make=[^&]*/, `make=${dataUrlAlt}`);
        anchor.setAttribute('href', href);
    }
});


const items = document.querySelectorAll('[data-direct-item]');

items.forEach(item => {
    const linkElement = item.querySelector('[data-direct-link]');
    
    const statusElement = item.querySelector('[data-direct-status][data-direct-url]');
    
    if (linkElement && 
        statusElement && 
        statusElement.getAttribute('data-direct-status') === 'true') {
        
        const newUrl = statusElement.getAttribute('data-direct-url');
        
        if (newUrl) {
            linkElement.setAttribute('href', newUrl);
            linkElement.setAttribute('target', '_blank');
            linkElement.setAttribute('rel', 'noopener noreferrer');
        }
    }
});

document.querySelectorAll('[data-external-link-check] a').forEach(link => {
  const url = new URL(link.href);
  if (url.hostname !== location.hostname) {
      link.target = '_blank';
  }
});

// Remove Valuation link for Toyota and Lexus - Adam Murray - 29/11/2025

(function() {
    const clean = () => {
        if (/toyota|lexus/i.test(location.href)) {
            const elements = document.querySelectorAll('[data-sub-nav="valuation"]');
            elements.forEach(el => {
                const wrapper = el.parentElement;
                if (wrapper) {
                    wrapper.remove();
                } else {
                    el.remove();
                }
            });
        }
    };

    clean();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', clean);
    } else {
        setTimeout(clean, 100);
    }

    new MutationObserver(clean).observe(document.body, { childList: true, subtree: true });
})();