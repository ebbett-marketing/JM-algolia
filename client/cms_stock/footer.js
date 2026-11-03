(function() {
  const bannerSelector = '[data-pre-owned-promise="banner"]';
  let lastVisibilityState = null;
  let currentEligibilityState = false;
  let currentCheckboxState = false;
  let searchContainerMoved = false;

  // --- EXISTING FUNCTIONS ---
  function getBannerSection() { return document.querySelector(bannerSelector); }

  function updateBannerVisibility() {
    const section = getBannerSection();
    if (!section) return;
    const shouldShow = Boolean(currentEligibilityState || currentCheckboxState);
    if (lastVisibilityState === shouldShow) return;
    lastVisibilityState = shouldShow;
    section.style.setProperty('display', shouldShow ? 'block' : 'none', 'important');
  }

  function refreshCheckboxState() {
    const checkbox = document.querySelector('#ais_filter-check-3 .ais-ToggleRefinement-checkbox');
    currentCheckboxState = checkbox ? checkbox.checked : false;
    updateBannerVisibility();
  }

  function initPreOwnedPromiseSync() {
    currentEligibilityState = Boolean(window.preOwnedPromiseEligible);
    updateBannerVisibility();
    window.addEventListener('preOwnedPromise:update', function(event) {
      currentEligibilityState = Boolean(event && event.detail ? event.detail.eligible : false);
      updateBannerVisibility();
    });
  }

  function setupCheckboxListeners() {
    document.addEventListener('change', function(event) {
      if (event.target && event.target.classList.contains('ais-ToggleRefinement-checkbox') &&
          event.target.closest('#ais_filter-check-3')) {
        refreshCheckboxState();
      }
    });
    const checkboxContainer = document.querySelector('#ais_filter-check-3');
    if (checkboxContainer) {
      const observer = new MutationObserver(() => refreshCheckboxState());
      observer.observe(checkboxContainer, { childList: true, subtree: true, attributes: true });
    }
    refreshCheckboxState();
  }

  function handleIntroText() {
    if (searchContainerMoved) return;
    const sectionHeader = document.querySelector('[data-stock-tool="section-header"]');
    const searchContainer = document.querySelector('[data-stock-tool="search-container"]');
    if (!searchContainer) return;
    
    if (sectionHeader) {
      const searchOnHeader = document.querySelector('[data-stock-tool="search-on-header"]');
      if (searchOnHeader) {
        searchOnHeader.appendChild(searchContainer);
        searchContainer.style.display = 'flex';
        searchContainerMoved = true;
      }
    } else {
      const filterContainer = document.querySelector('[data-stock-tool="filter-container"]');
      if (filterContainer) {
        const secondChild = filterContainer.children[1];
        if (secondChild) filterContainer.insertBefore(searchContainer, secondChild);
        else filterContainer.appendChild(searchContainer);
        searchContainer.style.gridColumn = 'span 4';
        searchContainer.style.display = 'flex';
        searchContainerMoved = true;
      }
    }
    const searchInput = document.querySelector('.ais-SearchBox-input');
    if (searchInput) searchInput.style.background = 'transparent';
  }


  function setupMonitor() {
    setupCheckboxListeners();
    initPreOwnedPromiseSync();
    handleIntroText();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(setupMonitor, 1000));
  } else {
    setTimeout(setupMonitor, 1000);
  }
})();