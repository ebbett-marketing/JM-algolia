// valid-params.js

// Define known valid facet/filter keys (must match Algolia index settings)
const VALID_FACET_KEYS = new Set([
    'make',
    'fuel_type',
    'dealership',
    'region',
    'drivetrain_simple',
    'condition',
    'seats',
    'model',
    'body_type',
    'transmission_simple',
    'is_pre_owned_promise',
    'price_savings_number',
    'safety_stars'
  ]);
  
  /**
   * Returns only valid facet filters from the current URL parameters.
   * Each entry is an object: { key, value }
   */
  export function getValidFacetFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);
    const validFilters = [];
  
    for (const [key, value] of params.entries()) {
      if (VALID_FACET_KEYS.has(key)) {
        validFilters.push({ key, value });
      }
    }
  
    return validFilters;
  }
  
  /**
   * Returns a Set of all valid facet keys
   */
  export function getValidFacetKeys() {
    return VALID_FACET_KEYS;
  }
  