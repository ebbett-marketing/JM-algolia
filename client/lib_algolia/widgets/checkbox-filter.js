export const createFilterCheckboxWidget = ({ container, config }) => {
  let containerElement = null;

  const applyFilter = (helper, checked) => {
    if (checked) {
      switch (config.type) {
        case 'numeric':
          helper.addNumericRefinement(
            config.attribute,
            config.comparison,
            config.value
          );
          break;
        case 'facet':
          helper.addFacetRefinement(config.attribute, config.value);
          break;
        case 'tag':
          helper.addTagRefinement(config.value);
          break;
        case 'disjunctive':
          helper.addDisjunctiveFacetRefinement(config.attribute, config.value);
          break;
      }
    } else {
      switch (config.type) {
        case 'numeric':
          helper.removeNumericRefinement(config.attribute, config.comparison);
          break;
        case 'facet':
          helper.removeFacetRefinement(config.attribute, config.value);
          break;
        case 'tag':
          helper.removeTagRefinement(config.value);
          break;
        case 'disjunctive':
          helper.removeDisjunctiveFacetRefinement(config.attribute, config.value);
          break;
      }
    }
    helper.search();
  };

  const checkRefinement = (state) => {
    if (!state) return false;
    
    switch (config.type) {
      case 'numeric': {
        const refinements = state.numericRefinements?.[config.attribute]?.[config.comparison] || [];
        return refinements.includes(config.value);
      }
      case 'facet':
        return state.facetsRefinements?.[config.attribute]?.includes(config.value);
      case 'tag':
        return state.tagRefinements?.includes(config.value);
      case 'disjunctive':
        return state.disjunctiveFacetsRefinements?.[config.attribute]?.includes(config.value);
      default:
        return false;
    }
  };

  const render = ({ helper, instantSearchInstance }) => {
    if (!containerElement) {
      containerElement = document.createElement('div');
      containerElement.className = 'ais-ToggleRefinement';
      container.appendChild(containerElement);
    }

    const isRefined = checkRefinement(helper.state);

    containerElement.innerHTML = `
      <label class="ais-ToggleRefinement-label">
        <input 
          type="checkbox" 
          class="ais-ToggleRefinement-checkbox"
          ${isRefined ? 'checked' : ''}
        >
        <span class="ais-ToggleRefinement-labelText">${config.label}</span>
      </label>
    `;

    const checkbox = containerElement.querySelector('input');
    checkbox.replaceWith(checkbox.cloneNode(true));
    
    containerElement.querySelector('input').addEventListener('change', (e) => {
      applyFilter(helper, e.target.checked);
    });
  };

  return {
    $$type: 'ais.customCheckbox',
    init(initOptions) {
      const { helper, instantSearchInstance } = initOptions;
      
      // Check URL parameters for this filter
      const searchParams = new URLSearchParams(window.location.search);
      const paramValue = searchParams.get(config.attribute); // Gets "price_savings_number" from URL
      
      // If the URL has price_savings_number with any value >= 1, check the box
      if (paramValue && parseFloat(paramValue) >= config.value) {
        helper.addNumericRefinement(
          config.attribute,
          config.comparison,
          config.value
        );
        helper.search();
      }
      
      render({ helper, instantSearchInstance });
    },
    render(renderOptions) {
      render(renderOptions);
    },
    dispose({ state }) {
      containerElement?.remove();
      return state;
    },
    getWidgetUiState(uiState, { searchParameters }) {
      // If not refined, return clean state without this refinement
      if (!checkRefinement(searchParameters)) {
        const { numericRefinements = {} } = uiState;
        const { [config.attribute]: _, ...remainingRefinements } = numericRefinements;
        
        // Only return the object if there are other refinements
        if (Object.keys(remainingRefinements).length === 0) {
          const { numericRefinements, ...restOfState } = uiState;
          return restOfState;
        }
        
        return {
          ...uiState,
          numericRefinements: remainingRefinements
        };
      }

      // If refined, add only the necessary refinement
      return {
        ...uiState,
        numericRefinements: {
          ...(uiState.numericRefinements || {}),
          [config.attribute]: {
            [config.comparison]: [config.value]
          }
        }
      };
    },
    getWidgetSearchParameters(searchParameters, { uiState }) {
      // Always start with a clean state
      let newSearchParameters = searchParameters.removeNumericRefinement(config.attribute, config.comparison);

      // Check if we should apply the refinement
      if (uiState?.numericRefinements?.[config.attribute]?.[config.comparison]?.[0] === config.value) {
        newSearchParameters = newSearchParameters.addNumericRefinement(
          config.attribute,
          config.comparison,
          config.value
        );
      }

      return newSearchParameters;
    }
  };
};