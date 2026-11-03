# Johnston Motors — site scripts and Algolia search

Scripts for the Johnston Motors Webflow site (served via jsDelivr) and the Algolia setup behind its
stock search, comparison and navigation search. Adapted from the Ebbett 3.0 site's scripts.

## What's here

| Path | What it is |
|---|---|
| `client/` | The site's scripts and styles, one folder per module, served via jsDelivr |
| `client/config.js` | JM's settings for those scripts: Algolia app, search key, indices, domains |
| `client/UPSTREAM.md` | Where each module came from and which pages load it |
| `crawler/stock.config.js` | Algolia Crawler config for the `stock` index (dashboard-editor format) |
| `algolia/stock.settings.json` | `stock` index settings, including its 10 sort replicas |
| `algolia/stock.replicas.json` | Sort order for each replica |
| `algolia/pages.settings.json` | `pages` index settings (site pages in the nav search) |
| `tools/test-extractor.mjs` | Runs the crawler's record extractor against the live site, no Algolia needed |
| `tools/crawler.mjs` | Pushes the crawler config, starts a crawl, shows status |
| `tools/algolia-settings.mjs` | Applies (or `--check`s) the index settings |
| `tools/purge-jsdelivr.mjs` | Clears jsDelivr's cache of `main` after a push |

## How the site loads the scripts

Webflow's custom code and embeds point at jsDelivr, which serves files straight from this repo:

```
https://cdn.jsdelivr.net/gh/ebbett-marketing/JM-algolia@main/client/cap_search/embed.js
```

Staging uses `@main`. jsDelivr caches a branch for up to 12 hours, so run `node tools/purge-jsdelivr.mjs`
after each push. The live site uses a tagged release (`@v1.0.0`), which never changes once published.

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
node tools/purge-jsdelivr.mjs                  # after pushing to main, so staging gets the change
```
