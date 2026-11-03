/**
 * Poll until Algolia InstantSearch SDK is available on window.
 */
export function waitForInstantSearch(callback) {
  if (
    window.algoliasearch &&
    window.instantsearch &&
    window.instantsearch.widgets
  ) {
    callback();
  } else {
    setTimeout(() => waitForInstantSearch(callback), 100);
  }
}
