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

const items = document.querySelectorAll('[data-direct-item]');

items.forEach(item => {

    const linkElements = item.querySelectorAll('[data-direct-link]');
    
    linkElements.forEach(linkElement => {
        const statusElement = linkElement.querySelector('[data-direct-status][data-direct-url]');
        
        if (statusElement && statusElement.getAttribute('data-direct-status') === 'true') {
            const newUrl = statusElement.getAttribute('data-direct-url');
            
            if (newUrl) {
                linkElement.setAttribute('href', newUrl);
                linkElement.setAttribute('target', '_blank');
                linkElement.setAttribute('rel', 'noopener noreferrer');
            }
        }
    });
}); 

document.querySelectorAll('[data-external-link-check] a').forEach(link => {
  const url = new URL(link.href);
  if (url.hostname !== location.hostname) {
      link.target = '_blank';
  }
});

// Global variable to store language data
let languageData = null;
let languageToCode = null;

function getLanguageTooltipText(language, languageCode = null) {
    if (!languageData) {
        return language;
    }

    let languageInfo = null;

    // Try to find language info by exact name first
    languageInfo = languageData.find(lang =>
        lang.name.toLowerCase() === language.toLowerCase()
    );

    // If no exact name match, then try by code
    if (!languageInfo && languageCode) {
        languageInfo = languageData.find(lang => lang.code === languageCode);
    }

    // If still no match, try finding by name containing the input language
    if (!languageInfo) {
        languageInfo = languageData.find(lang =>
            lang.name.toLowerCase().includes(language.toLowerCase())
        );
    }

    // Generate tooltip text
    if (languageInfo) {
        return languageInfo.nativeName 
            ? `${languageInfo.name} (${languageInfo.nativeName})`
            : `${languageInfo.name}`;
    }

    return language;
}

function createLanguageIcon(language, languageCode = null) {
    // Log when language data is not loaded
    if (!languageData) {
        console.warn('Language data not loaded. Unable to create language icon for:', language);
        return null;
    }
    let languageInfo = null;

    // Try to find language info by exact name first
    languageInfo = languageData.find(lang =>
        lang.name.toLowerCase() === language.toLowerCase()
    );

    // If no exact name match, then try by code
    if (!languageInfo && languageCode) {
        languageInfo = languageData.find(lang => lang.code === languageCode);
    }

    // If still no match, try finding by name containing the input language
    if (!languageInfo) {
        languageInfo = languageData.find(lang =>
            lang.name.toLowerCase().includes(language.toLowerCase())
        );
    }

    // Create the icon element
    const iconContainer = document.createElement('div');
    iconContainer.className = 'language-icon';

    const icon = document.createElement('div');
    icon.className = 'icon';
    
    // Determine icon text and tooltip
    let iconText, tooltipText;
    if (languageInfo) {
        // Use existing language info
        iconText = languageInfo.code;
        
        // Include native name in tooltip if available
        tooltipText = languageInfo.nativeName 
            ? `${languageInfo.name} (${languageInfo.nativeName})`
            : `${languageInfo.name}`;
        
        // Apply styles from language data
        Object.assign(icon.style, languageInfo.style);
    } else {
        // Fallback for unknown language
        iconText = language.slice(0, 2).toUpperCase();
        tooltipText = `${language}`;
        
        // Apply fallback style
        icon.style.background = '#FFFFFF';
        icon.style.color = '#000000';
        icon.style.border = '1px solid #000000';
        
        // Log that language was not found
        console.warn('No language info found for:', language);
    }

    icon.textContent = iconText;
    icon.setAttribute('data-tooltip', tooltipText);

    const name = document.createElement('div');
    name.className = 'language-name';
    name.textContent = language;

    iconContainer.appendChild(icon);

    return iconContainer;
}

function handleLanguageIcons() {
    // Ensure language data is loaded
    if (!languageData) {
        console.warn('Language data not loaded. Cannot handle language icons.');
        return;
    }

    // Find all elements with data-languages-spoken attribute
    const languageElements = document.querySelectorAll('[data-languages-spoken]:not([data-languages-spoken=""])');
    
    // Add the necessary styles if not already present
    const styleElement = document.getElementById('language-icon-styles');
    if (!styleElement) {
        const style = document.createElement('style');
        style.id = 'language-icon-styles';
        style.textContent = `
            .dealership_team-language-icons[data-languages-spoken]:not([data-languages-spoken=""]) {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .language-icon {
                display: inline-flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
                margin: 0 0.25rem;
                position: relative;
            }
            .language-icon .icon {
                width: 1.5rem;
                height: 1.5rem;
                border-radius: 0.25rem;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 0.8rem;
                box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1);
                cursor: help;
                position: relative;
            }
            .language-icon .icon::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0,0,0,0.8);
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.75rem;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s;
                z-index: 10;
            }
            .language-icon .icon:hover::after {
                opacity: 1;
            }
            .language-icon .language-name {
                font-size: 0.75rem;
                text-align: center;
                color: #333;
            }
        `;
        document.head.appendChild(style);
    }

    // Create language to code mapping
    const languageToCodeMap = languageData.reduce((acc, lang) => {
        acc[lang.name.toLowerCase()] = lang.code;
        return acc;
    }, {});

    languageElements.forEach(element => {
        // Get the languages string and split it into an array
        const languages = element.getAttribute('data-languages-spoken')
            .split(',')
            .map(lang => lang.trim());
        
        // Find the existing language icon template if any
        const existingIcons = element.querySelectorAll('.language-icon');
        existingIcons.forEach(icon => icon.remove());

        // Process each language
        languages.forEach((language) => {
            const languageCode = languageToCodeMap[language.toLowerCase()];
            
            // Generate tooltip text
            const tooltipText = getLanguageTooltipText(language, languageCode);
            
            // Create and append the language icon
            const languageIcon = createLanguageIcon(language, languageCode);
            
            if (languageIcon) {
                // Get the icon element
                const iconElement = languageIcon.querySelector('.icon');
                
                // Set tooltip using ::after pseudo-element
                iconElement.setAttribute('data-tooltip', tooltipText);
                
                element.appendChild(languageIcon);
            }
        });
    });
}

// languages.json sits next to this script in the JM repo.
const LANGUAGES_URL = new URL('languages.json', document.currentScript.src).href;

// Async initialization function
async function loadLanguageData(jsonPath = LANGUAGES_URL) {
    try {
        console.log('Attempting to load language data from:', jsonPath);
        
        const response = await fetch(jsonPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Support both formats: direct array or { languageData: [...] }
        languageData = Array.isArray(data) ? data : data.languageData;
        
        console.log('Language data loaded successfully:', languageData.length, 'languages');
        
        // Trigger language icon creation
        handleLanguageIcons();
        
        return languageData;
    } catch (error) {
        console.error('Error loading language data:', error);
        return null;
    }
}

// Ensure language icons are created even if script loads after HTML
function setupLanguageIcons() {
    console.log('Setting up language icons');
    
    // Check if language data is already loaded
    if (languageData) {
        handleLanguageIcons();
    } else {
        // If not loaded, initialize with default path
        loadLanguageData();
    }
}

// Multiple ways to trigger initialization
if (document.readyState === 'loading') {
    // If page is still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', setupLanguageIcons);
} else {
    // If page is already loaded, run immediately
    setupLanguageIcons();
}

// Expose functions globally
window.loadLanguageData = loadLanguageData;
window.handleLanguageIcons = handleLanguageIcons;


// Splide Implementation for Community (AM 05/25)
document.addEventListener('DOMContentLoaded', function () {
    // Delay initialization slightly to let other systems stabilize
    setTimeout(() => {
      document.querySelectorAll('[data-splide-id="community"]').forEach(function (el) {
        // Create a flag to prevent animation systems from conflicting
        window.isSplideTransitioning = false;
        
        const splide = new Splide(el, {
          type: 'slide',
          perPage: 4,
          perMove: 1,
          gap: '1rem',
          arrows: true,
          pagination: false,
          breakpoints: {
            992: { perPage: 2 },
            768: { perPage: 1 }
          },
          autoHeight: false,
          trimSpace: true,
          speed: 400, // Adjust speed to avoid conflicts with animation system
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)' // Smoother easing
        });
        
        // Function to calculate and set heights based on tallest slide
        function setEqualHeights() {
          const slides = el.querySelectorAll('.splide__slide');
          let maxHeight = 0;
          
          // First reset heights to get natural height
          slides.forEach(slide => {
            slide.style.height = '';
          });
          
          // Find the tallest slide
          slides.forEach(slide => {
            const slideHeight = slide.offsetHeight;
            maxHeight = Math.max(maxHeight, slideHeight);
          });
          
          // Apply the max height to all slides
          slides.forEach(slide => {
            slide.style.height = `${maxHeight}px`;
          });
          
          // Set the track and list heights if needed
          const track = el.querySelector('.splide__track');
          if (track) track.style.height = `${maxHeight}px`;
        }
        
        // Set a flag when transitions are happening to help other systems
        splide.on('move', function() {
          window.isSplideTransitioning = true;
        });
        
        splide.on('moved', function() {
          // Add slight delay before removing flag
          setTimeout(() => {
            window.isSplideTransitioning = false;
          }, 50);
        });
        
        splide.on('mounted moved resized', function () {
          const list = el.querySelector('.splide__list');
          if (splide.Components.Layout.isOverflow()) {
            list.style.justifyContent = 'flex-start';
          } else {
            list.style.justifyContent = 'center';
          }
          
          // Apply equal heights after alignment is set
          setEqualHeights();
        });
        
        // Force GPU acceleration on slide elements to reduce layout shifts
        const slides = el.querySelectorAll('.splide__slide');
        slides.forEach(slide => {
          slide.style.transform = 'translateZ(0)';
          slide.style.backfaceVisibility = 'hidden';
        });
        
        // Handle window resize with debounce
        const debouncedResize = debounce(function() {
          setEqualHeights();
        }, 200);
        
        window.addEventListener('resize', debouncedResize);
  
        splide.mount();
        
        // Set equal heights immediately after mount
        setTimeout(setEqualHeights, 100);
      });
    }, 100); // Small delay to let other systems initialize first
    
    // Debounce function to prevent too many resize events
    function debounce(func, wait) {
      let timeout;
      return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
          func.apply(context, args);
        }, wait);
      };
    }
  });
  
// Community modal repositioning outside of splide (AM 05/25)
document.addEventListener('DOMContentLoaded', function() {
    // Minimal CSS for positioning only
    const style = document.createElement('style');
    style.textContent = `
      .modal-container-fixed {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: auto;
      }
      .modal-container-fixed .section_community-modal {
        position: relative !important;
        opacity: 1 !important;
        width: 100%;
        overflow-x: auto!important;
        padding:1rem;
        align-items: flext-start;        
      }
      .modal-container-fixed .container-modal {
        opacity: 1 !important;
      }
        
      @media (max-width: 767px) {
        .modal-container-fixed .section_community-modal {
          padding-top: 60px; 
        }
        .modal-container-fixed .nav_modal_close {
          position: fixed !important;
          top: 15px !important;
          right: 15px !important;
          background: white !important;
          padding: 8px 12px !important;
          border-radius: 4px !important;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Create modal container once
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container-fixed';
    modalContainer.style.display = 'none';
    document.body.appendChild(modalContainer);
    
    // Function to close modal
    function closeModal() {
      document.body.classList.remove('no-scroll');
      modalContainer.style.display = 'none';
    }
    
    // Handle slide link clicks
    document.querySelectorAll('.community_featured_link').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Add no-scroll to body
        document.body.classList.add('no-scroll');
        
        // Clone and show the modal
        const modal = this.closest('.splide__slide').querySelector('.section_community-modal');
        const modalClone = modal.cloneNode(true);
        modalContainer.innerHTML = '';
        modalContainer.appendChild(modalClone);
        
        // Show the modal
        modalClone.style.display = 'flex';
        modalClone.style.opacity = '1';
        modalClone.querySelector('.container-modal').style.opacity = '1';
        modalContainer.style.display = 'flex';
        
        // Add close button event
        modalClone.querySelector('.nav_modal_close')?.addEventListener('click', closeModal);
        
        // Add click event to the section_community-modal to close when clicked
        // but prevent closing when container-modal is clicked
        modalClone.addEventListener('click', function(e) {
          // Check if click was on section_community-modal directly (not on container-modal)
          if (!e.target.closest('.container-modal')) {
            e.stopPropagation();
            closeModal();
          }
        });
      });
    });
    
    // Close when clicking on the container background
    modalContainer.addEventListener('click', function(e) {
      // Only close if the click was directly on the modalContainer
      // (not on any of its children that have their own handlers)
      if (e.target === modalContainer) {
        closeModal();
      }
    });
    
    // Close on ESC key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modalContainer.style.display === 'flex') closeModal();
    });
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

$(document).ready(function() {

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
  
    const stylesObserver2 = new MutationObserver(handleStyles);
    const slide1 = document.querySelector('#current-offers-slide-1');
    const slide2 = document.querySelector('#current-offers-slide-2');
    const slide3 = document.querySelector('#current-offers-slide-3');
  
    [slide1, slide2, slide3].forEach(el => {
      if (el) stylesObserver2.observe(el, {
        attributes: true,
        attributeFilter: el.id === 'current-offers-slide-1' ? ['current-offers-commands'] : ['style']
      });
    });
  
    window.addEventListener('resize', handleStyles);
    handleStyles();
  })();
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

$(document).ready(function () {
  var teamItems = $('.dealership-team_item');
  var fallbackContainer = $('[data-dealership="team-no-department"]');
  var departmentIndicator = $('[data-dealership="team-department"]');

  if (departmentIndicator.length > 0) {
    fallbackContainer.css('display', 'none');

    var departmentItems = {
      '1. Management and Administration': [],
      '2. Sales': [],
      '3. Finance and Insurance': [],
      '4. Parts and Service': []
    };

    teamItems.each(function () {
      var department = $(this).find('.is-team-department').text().trim();
      var order = parseInt($(this).find('.is-team-order').text()) || 0;

      if (departmentItems.hasOwnProperty(department)) {
        departmentItems[department].push({ element: this, order: order });
      }
    });

    for (var department in departmentItems) {
      departmentItems[department].sort(function (a, b) {
        return a.order - b.order;
      });
    }

    for (var department in departmentItems) {
      var containerId = '';

      switch (department) {
        case '1. Management and Administration':
          containerId = '#team-management';
          break;
        case '2. Sales':
          containerId = '#team-sales';
          break;
        case '3. Finance and Insurance':
          containerId = '#team-fni';
          break;
        case '4. Parts and Service':
          containerId = '#team-aftersales';
          break;
      }

      if (containerId) {
        var container = $(containerId);
        $.each(departmentItems[department], function (index, item) {
          container.append($(item.element).clone());
        });
      }
    }
  }
});