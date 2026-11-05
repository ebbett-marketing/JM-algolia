$(window).on('load', function() {
  var $promiseBanner = $('[data-pre-owned-promise="banner"]');
  var lastKnownState = null;

  function setPromiseVisibility(isVisible) {
    if (!$promiseBanner.length) {
      return;
    }

    var displayValue = isVisible ? 'block' : 'none';
    $promiseBanner.each(function() {
      this.style.setProperty('display', displayValue, 'important');
    });
  }

  function applyEligibilityState(isEligible) {
    var normalizedState = Boolean(isEligible);
    if (lastKnownState === normalizedState) {
      return;
    }

    lastKnownState = normalizedState;
    setPromiseVisibility(normalizedState);
  }

  // Mirror Algolia eligibility updates onto the banner element.
  applyEligibilityState(window.preOwnedPromiseEligible);

  window.addEventListener('preOwnedPromise:update', function(event) {
    var nextState = event && event.detail ? event.detail.eligible : false;
    applyEligibilityState(nextState);
  });
});


var search = window.location.search;
  if (search) {
    var queryParams = new URLSearchParams(search);
    var newParams = new URLSearchParams();

    for (let [key, value] of queryParams) {
      // Only apply the replacement to parameters other than 'dealership'
      if (key === 'dealership') {
        newParams.set(key, value);
      } else {
        newParams.set(key, value.replace(/Š/g, 'S'));
      }
    }

    var newSearch = newParams.toString();
    if (search !== '?' + newSearch) {
      window.history.replaceState(null, null, window.location.pathname + '?' + newSearch + window.location.hash);
    }
  }

// JM: Ebbett's "group_used_cars" campaign header image (files.ebbett.co.nz) removed.
// The stock page header image comes from the Stock | Pages CMS item ("Image - Header").