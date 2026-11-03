# Where these scripts came from

Everything in `client/` was copied from the Ebbett 3.0 site in November 2026, when HNDRX duplicated that
site for Johnston Motors. Two sources:

- **ebbett-core-edge** (Ebbett's private repo) at commit `be1dbe1`: the build the duplicated site loaded,
  which is the highest `_v*` folder where one exists, else the highest `v*`.
- **files.ebbett.co.nz** (Ebbett's file server): `cms_brands/footer.js` and `cms_dealership/` were copied
  from there because they are newer than core-edge's copies. Every other file on that server that JM
  loads is identical to its core-edge copy.

The first commit that adds `client/` is the unchanged copy; the JM changes are in the commits after it.

| Module | Copied from | Loaded on (JM staging) | Replaces |
|---|---|---|---|
| `config.js` | new | (imported by the modules) | the Algolia keys and hostnames hard-coded per module |
| `cap_search` | core-edge `cap_search/_v1.0.0` | every page | `client.ebbett.co.nz/cap_search/dev/` |
| `cap_compare` | core-edge `cap_compare/_v1.0.1` | every page | `client.ebbett.co.nz/cap_compare/dev/` |
| `cap_dropdown` | core-edge `cap_dropdown/_v1.0.0` | every page | `client.ebbett.co.nz/cap_dropdown/dev/` |
| `cap_intelligence` | core-edge `cap_intelligence/v1.0.0` | every page | `files.ebbett.co.nz/…/form-utils.js` (same code) |
| `site_core` | core-edge `site_core/v1.0.0` (`footer.js`) | every page | `files.ebbett.co.nz/…/site-footer.js` |
| `cms_stock` | core-edge `cms_stock/_v1.0.1` | `/stock/*` | `client.ebbett.co.nz/cms_stock/dev/` |
| `cap_stock-selector` | core-edge `cap_stock-selector/v1.0.0` | `/stock/*` | `client.ebbett.co.nz/cap_stock-selector/dev/` |
| `lib_algolia` | core-edge `lib_algolia/_v1.0.1` | `/stock/*`, plus imports | `client.ebbett.co.nz/lib_algolia/dev/` |
| `cms_stock_vehicles` | core-edge `cms_stock_vehicles/_v1.0.1` | `/inventory/*` | `client.ebbett.co.nz/cms_stock_vehicles/dev/` |
| `cap_stock-meta` | core-edge `cap_stock-meta/_v1.0.0` | `/inventory/*` | `client.ebbett.co.nz/cap_stock-meta/dev/` |
| `cap_forms` | core-edge `cap_forms/v1.0.0` (`form.js`, `uploader.css`) | `/inventory/*`, `/offers/*`, `/model/*` | `files.ebbett.co.nz/…/form.js`, `uploader.css`; `client.ebbett.co.nz/cap_forms/dev/uploader.css` |
| `cms_offers` | core-edge `cms_offers/v1.0.0` | `/offers/*` | `files.ebbett.co.nz/…/offers-footer.js` |
| `lib_splide` | core-edge `lib_splide/v1.0.0` (`styles-ebbett.css` → `styles.css`) | `/offers/*`, `/news/*` | `files.ebbett.co.nz/…/splide-ebbett.css` |
| `cap_dealership-filter` | core-edge `cap_dealership-filter/v1.0.0` (`filter.js`) | `/`, `/dealerships` | `files.ebbett.co.nz/scripts/dealership-filter.js` |
| `cms_dealership` | files.ebbett.co.nz `dealership-footer.js`, `languages.json` | `/dealership/*` | same files |
| `cms_brands` | files.ebbett.co.nz `brands-footer.js` | `/brand/*` | same file |
| `cms_vehicle-models` | core-edge `cms_vehicle-models/v1.0.0` (`footer-early.js`, `footer-late.js`) | `/model/*` | `files.ebbett.co.nz/…/vehicle-models-footer-first.js`, `-last.js` |
| `lib_gmaps` | core-edge `lib_gmaps/v1.0.0` (`locator.js`) | `/service` | `files.ebbett.co.nz/…/google-maps-core.js` |

`…` is `files.ebbett.co.nz/scripts/ebbett.co.nz`.

## Not copied

| Ebbett file | Why |
|---|---|
| `lib_photoswipe` | An unmodified PhotoSwipe 5.4.4, so it loads from `cdn.jsdelivr.net/npm/photoswipe@5.4.4` |
| `cms_browse` | Runs the Algolia lists on offers, news and dealerships, which HNDRX rebuilds as native Webflow lists |
| `cms_vehicle-models/search.js` (`files.ebbett.co.nz/scripts/algolia/ev.js`) | The EV range page searches Ebbett's `models` index, which JM doesn't have |
| `lib_algolia/dropdown.css` | Empty file |
| `site-header.js` | Empty file on Ebbett's server |
| `ev-range-footer.js` | Returns 404 on Ebbett's server |
| `select2.js` | Only referenced inside an HTML comment; `cap_dropdown` replaced it |
| `ebbett-finance-footer-last.js` (core-edge `page_ebbett-finance`) | Commented out on the finance page ("old functionality") |
| `stock-selector-footer.js`, `product-header.js`, `product-footer.js` | Only on `/dev/our-vehicle-stock` and the old e-commerce `/product` template, which JM doesn't use |

## Pages Johnston Motors may drop

HNDRX hasn't confirmed which of the duplicated page groups JM keeps. If one goes, delete its scripts:

| If this goes | Delete |
|---|---|
| `/dealerships` and `/dealership/*` | `cms_dealership`, and `cap_dealership-filter` unless the home page still uses it |
| `/brand/*` | `cms_brands` |
| `/model/*` | `cms_vehicle-models` (and `cap_forms/uploader.css` if no other page uses it) |
| `/service` | `lib_gmaps` |
| `/offers/*` | `cms_offers`, and `lib_splide` unless `/news/*` still uses it |
