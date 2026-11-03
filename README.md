# Johnston Motors — site scripts and Algolia search

Scripts for the Johnston Motors Webflow site (served via jsDelivr) and the Algolia setup behind its
stock search, comparison and navigation search. Adapted from the Ebbett 3.0 site's scripts.

## What's here

| Path | What it is |
|---|---|
| `crawler/stock.config.js` | Algolia Crawler config for the `stock` index (dashboard-editor format) |
| `algolia/stock.settings.json` | `stock` index settings, including its 10 sort replicas |
| `algolia/stock.replicas.json` | Sort order for each replica |
| `tools/test-extractor.mjs` | Runs the crawler's record extractor against the live site, no Algolia needed |
| `tools/crawler.mjs` | Pushes the crawler config, starts a crawl, shows status |
| `tools/algolia-settings.mjs` | Applies (or `--check`s) the index settings |

## How stock gets into search

Ebbett's pipeline writes JM's stock into the Webflow CMS and publishes it. Each vehicle page carries a
hidden JSON block bound to its CMS fields (`<script id="wd-algolia-record">`, in the Stock | Vehicles
template's head code). The Algolia Crawler visits every `/inventory/` page in the sitemap once a day,
turns that block into a record and replaces the `stock` index. A car that's unpublished drops out on
the next crawl.

## Credentials

Nothing secret lives in this repo. The tools read keys from the environment, or from a `.env.local`
one folder above the repo:

```
JOHNSTON_ALGOLIA_APP_ID=
JOHNSTON_ALGOLIA_ADMIN_API_KEY=          # tools/algolia-settings.mjs
JOHNSTON_ALGOLIA_CRAWLER_USER_ID=        # tools/crawler.mjs (Crawler → general Settings)
JOHNSTON_ALGOLIA_CRAWLER_API_KEY=
```

The crawler's own write key is managed in the Algolia dashboard; `tools/crawler.mjs push` never
changes it.

## Common tasks

```bash
npm install
npm run test:extractor                         # check every vehicle page extracts cleanly
node tools/crawler.mjs push <crawlerId>        # after editing crawler/stock.config.js
node tools/crawler.mjs reindex <crawlerId>     # crawl now instead of waiting for the daily run
node tools/algolia-settings.mjs --check        # live index settings vs the JSON files
```
