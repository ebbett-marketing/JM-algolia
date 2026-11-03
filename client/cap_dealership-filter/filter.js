/**
 * Dealership Filter - Mobile-compatible version
 * A simplified approach focused on reliability across all browsers
 */
 
(function() {
    // Main object for the dealership filter functionality
    const DealershipFilter = {
      // Configuration
      selectors: {
        regionSelect: '[data-dealership="region-select"]',
        brandSelect: '[data-dealership="brand-select"]',
        dealershipItems: '[data-dealership="item"]',
        regionSource: '[data-dealership="region-source"]',
        brandSource: '[data-dealership="brand-source"]',
        serviceSource: '[data-dealership="service-source"]',
        serviceTag: '[data-dealership="service-tag"]',
        clearButton: '[data-dealership="clear"]',
        noResult: '[data-dealership="no-result"]'
      },
      
      // Brand aliases mapping
      brandAliases: {
        'Haval': 'GWM',
        'Chevrolet': 'GMSV',
        'GMC': 'GMSV'
      },
      
      // Wait for DOM to be fully interactive
      init: function() {
        // Get elements
        this.regionSelect = document.querySelector(this.selectors.regionSelect);
        this.brandSelect = document.querySelector(this.selectors.brandSelect);
        this.dealershipItems = document.querySelectorAll(this.selectors.dealershipItems);
        this.clearButtons = document.querySelectorAll(this.selectors.clearButton);
        
        // Exit if required elements aren't found
        if (!this.regionSelect || !this.brandSelect || !this.dealershipItems.length) {
          return;
        }
        
        // First populate the filter options
        this.populateFilters();
        
        // Then bind event listeners
        this.bindEvents();
        
        // Finally, apply filters from URL parameters or localStorage
        setTimeout(() => {
          this.applyInitialFilters();
        }, 100); // Small delay to ensure DOM is ready
      },
      
      // Populate filter dropdowns with options from page content
      populateFilters: function() {
        const regions = new Set();
        const brands = new Set();
        
        // Extract unique regions and brands from dealership items
        this.dealershipItems.forEach(item => {
          // Get region
          const regionEl = item.querySelector(this.selectors.regionSource);
          if (regionEl && regionEl.textContent.trim()) {
            regions.add(regionEl.textContent.trim());
          }
          
          // Get brands from brand source
          const brandEl = item.querySelector(this.selectors.brandSource);
          if (brandEl && brandEl.textContent.trim()) {
            brandEl.textContent.split(',')
              .map(brand => brand.trim())
              .filter(brand => brand.length > 0)
              .forEach(brand => brands.add(brand));
          }
          
          // Get brands from service source
          const serviceEl = item.querySelector(this.selectors.serviceSource);
          if (serviceEl && serviceEl.textContent.trim()) {
            serviceEl.textContent.split(',')
              .map(brand => brand.trim())
              .filter(brand => brand.length > 0)
              .forEach(brand => brands.add(brand));
          }
        });
        
        // If the select already has options (other than the default), don't repopulate
        if (this.regionSelect.options.length <= 1) {
          // Sort and populate regions
          const sortedRegions = Array.from(regions)
            .sort((a, b) => a.localeCompare(b));
            
          this.populateSelectOptions(this.regionSelect, sortedRegions);
        }
        
        if (this.brandSelect.options.length <= 1) {
          // Add brand aliases
          const brandsWithAliases = new Set(brands);
          Object.entries(this.brandAliases).forEach(([alias, mainBrand]) => {
            if (brands.has(mainBrand)) {
              brandsWithAliases.add(alias);
            }
          });
          
          // Sort and populate brands
          const sortedBrands = Array.from(brandsWithAliases)
            .sort((a, b) => a.localeCompare(b));
            
          this.populateSelectOptions(this.brandSelect, sortedBrands, true);
        }
      },
      
      // Add options to select element
      populateSelectOptions: function(selectElement, options, isBrandSelect = false) {
        // Preserve the first option (usually "Any...")
        const firstOption = selectElement.options[0];
        selectElement.innerHTML = '';
        
        if (firstOption) {
          selectElement.appendChild(firstOption);
        }
        
        // Add new options
        options.forEach(option => {
          const optEl = document.createElement('option');
          
          // Handle brand aliases
          if (isBrandSelect && this.brandAliases[option]) {
            optEl.value = this.brandAliases[option];
            optEl.textContent = option;
          } else {
            optEl.value = option;
            optEl.textContent = option;
          }
          
          selectElement.appendChild(optEl);
        });
      },
      
      // Bind event listeners
      bindEvents: function() {
        // Filter changes
        this.regionSelect.addEventListener('change', () => this.applyFilters());
        this.brandSelect.addEventListener('change', () => this.applyFilters());
        
        // Clear filters button
        this.clearButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            e.preventDefault();
            this.clearFilters();
          });
        });
        
        // Handle links to dealerships page to set localStorage
        document.addEventListener('click', (e) => {
          const link = e.target.closest('a');
          if (link && link.href && link.href.includes('/dealerships')) {
            try {
              const url = new URL(link.href);
              const regionParam = url.searchParams.get('region');
              const brandParam = url.searchParams.get('brand');
              
              if (regionParam) {
                localStorage.setItem('dealership_region', decodeURIComponent(regionParam));
              }
              
              if (brandParam) {
                localStorage.setItem('dealership_brand', decodeURIComponent(brandParam));
              }
            } catch (error) {
              // Silently fail for invalid URLs
            }
          }
        });
      },
      
      // Apply initial filters from URL parameters or localStorage
      applyInitialFilters: function() {
        // First try URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlRegion = urlParams.get('region');
        const urlBrand = urlParams.get('brand');
        
        let filtersApplied = false;
        
        // Apply URL parameters if they exist
        if (urlRegion || urlBrand) {
          if (urlRegion) {
            this.setSelectValue(this.regionSelect, urlRegion);
            localStorage.setItem('dealership_region', urlRegion);
          }
          
          if (urlBrand) {
            this.setSelectValue(this.brandSelect, urlBrand);
            localStorage.setItem('dealership_brand', urlBrand);
          }
          
          filtersApplied = true;
        }
        
        // If no URL parameters, try localStorage
        if (!filtersApplied) {
          const storedRegion = localStorage.getItem('dealership_region');
          const storedBrand = localStorage.getItem('dealership_brand');
          
          if (storedRegion || storedBrand) {
            if (storedRegion) {
              this.setSelectValue(this.regionSelect, storedRegion);
            }
            
            if (storedBrand) {
              this.setSelectValue(this.brandSelect, storedBrand);
            }
            
            filtersApplied = true;
          }
        }
        
        // Apply filters if any values were set
        if (filtersApplied) {
          this.applyFilters();
        }
      },
      
      // Helper function to set select value with case-insensitive matching
      setSelectValue: function(selectElement, value) {
        const decodedValue = decodeURIComponent(value);
        
        // Try exact match first
        for (let i = 0; i < selectElement.options.length; i++) {
          if (selectElement.options[i].value === decodedValue) {
            selectElement.value = decodedValue;
            return true;
          }
        }
        
        // Try case-insensitive match
        for (let i = 0; i < selectElement.options.length; i++) {
          if (selectElement.options[i].value.toLowerCase() === decodedValue.toLowerCase()) {
            selectElement.value = selectElement.options[i].value;
            return true;
          }
        }
        
        return false;
      },
      
      // Apply filters based on current select values
      applyFilters: function() {
        const selectedRegion = this.regionSelect.value;
        const selectedBrand = this.brandSelect.value;
        
        // Save to localStorage for persistence
        if (selectedRegion) {
          localStorage.setItem('dealership_region', selectedRegion);
        } else {
          localStorage.removeItem('dealership_region');
        }
        
        if (selectedBrand) {
          localStorage.setItem('dealership_brand', selectedBrand);
        } else {
          localStorage.removeItem('dealership_brand');
        }
        
        // Update URL for shareable links
        this.updateURL(selectedRegion, selectedBrand);
        
        // Filter dealership items
        let hasVisibleDealerships = false;
        
        this.dealershipItems.forEach(item => {
          const regionEl = item.querySelector(this.selectors.regionSource);
          const brandEl = item.querySelector(this.selectors.brandSource);
          const serviceEl = item.querySelector(this.selectors.serviceSource);
          const serviceTag = item.querySelector(this.selectors.serviceTag);
          
          // Check if region matches
          const regionMatch = !selectedRegion || (regionEl && regionEl.textContent === selectedRegion);
          
          // Check if brand matches in either brand source or service source
          let brandMatch = false;
          let isServiceOnly = false;
          
          if (selectedBrand) {
            const brandBrands = brandEl ? brandEl.textContent.split(',').map(b => b.trim()) : [];
            const serviceBrands = serviceEl ? serviceEl.textContent.split(',').map(b => b.trim()) : [];
            
            const matchesInBrand = brandBrands.includes(selectedBrand);
            const matchesInService = serviceBrands.includes(selectedBrand);
            
            brandMatch = matchesInBrand || matchesInService;
            isServiceOnly = !matchesInBrand && matchesInService;
          } else {
            brandMatch = true;
          }
          
          // Show/hide based on filter matches
          if (regionMatch && brandMatch) {
            item.style.display = '';
            hasVisibleDealerships = true;
            
            // Handle service tag
            if (serviceTag) {
              serviceTag.style.display = isServiceOnly ? 'block' : 'none';
            }
          } else {
            item.style.display = 'none';
            
            if (serviceTag) {
              serviceTag.style.display = 'none';
            }
          }
        });
        
        // Update empty state
        const noResultElements = document.querySelectorAll(this.selectors.noResult);
        noResultElements.forEach(element => {
          element.style.display = hasVisibleDealerships ? 'none' : 'flex';
        });
      },
      
      // Update the URL with the current filter values
      updateURL: function(region, brand) {
        if (!window.history || !window.history.pushState) {
          return; // Skip for browsers that don't support history API
        }
        
        const url = new URL(window.location.href);
        
        // Clear existing parameters
        url.searchParams.delete('region');
        url.searchParams.delete('brand');
        
        // Add current parameters
        if (region) {
          url.searchParams.set('region', region);
        }
        
        if (brand) {
          url.searchParams.set('brand', brand);
        }
        
        // Update URL without page reload
        try {
          window.history.pushState({}, '', url);
        } catch (error) {
          // Some browsers restrict pushState in certain contexts
        }
      },
      
      // Clear all filters
      clearFilters: function() {
        // Reset select values
        this.regionSelect.value = '';
        this.brandSelect.value = '';
        
        // Clear localStorage
        localStorage.removeItem('dealership_region');
        localStorage.removeItem('dealership_brand');
        
        // Update URL and re-apply filters
        this.updateURL('', '');
        this.applyFilters();
      }
    };
    
    // Initialize on DOM content loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        DealershipFilter.init();
      });
    } else {
      // DOM already loaded, initialize immediately
      DealershipFilter.init();
    }
    
    // Also initialize on window load (backup)
    window.addEventListener('load', function() {
      // Check if filter select elements have values set but items aren't filtered
      const regionSelect = document.querySelector(DealershipFilter.selectors.regionSelect);
      const brandSelect = document.querySelector(DealershipFilter.selectors.brandSelect);
      
      if (regionSelect && brandSelect && (regionSelect.value || brandSelect.value)) {
        // Re-apply filters just to be sure
        DealershipFilter.applyFilters();
      } else {
        // If we somehow missed initialization, try again
        DealershipFilter.init();
      }
    });
    
    // Initialize every 1 second for the first 5 seconds (fallback for problematic mobile browsers)
    for (let i = 1; i <= 5; i++) {
      setTimeout(function() {
        const regionSelect = document.querySelector(DealershipFilter.selectors.regionSelect);
        const brandSelect = document.querySelector(DealershipFilter.selectors.brandSelect);
        
        // Only re-apply if elements exist but filters haven't been applied
        if (regionSelect && brandSelect) {
          const shouldHaveFilters = new URLSearchParams(window.location.search).has('region') || 
                                   new URLSearchParams(window.location.search).has('brand') ||
                                   localStorage.getItem('dealership_region') ||
                                   localStorage.getItem('dealership_brand');
          
          if (shouldHaveFilters) {
            DealershipFilter.applyInitialFilters();
          }
        }
      }, i * 1000);
    }
  })();