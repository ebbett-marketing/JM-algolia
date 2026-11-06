// Johnston Motors — stock crawler (Algolia Crawler, dashboard-editor format).
//
// Source of truth for the JM stock crawler in Algolia app EMQLKN9FHC. Deploy with
// `node tools/crawler.mjs push`, or paste into the dashboard editor. The write key is
// managed by the dashboard and never lives in this public repo, so `apiKey` is a placeholder.
//
// Each vehicle page carries a CMS-bound JSON block (<script id="wd-algolia-record">, in the
// Stock | Vehicles template's page head code). The extractor turns it into the record shape the
// Ebbett 3.0 stock search, compare and nav search already read, so that code runs unchanged.
//
// At launch (Task C): swap johnston-motors.webflow.io for JM's domain, verify that domain in
// the Crawler, and drop the three staging-only `ignore*` overrides.
new Crawler({
  appId: 'EMQLKN9FHC',
  apiKey: 'SET_IN_DASHBOARD',
  rateLimit: 4,
  maxUrls: 300, // ~75 cars + ~32 models + ~34 site pages today; the agreement sizes stock for 100
  // The plan enforces >= 23 h between scheduled crawls. 17:00 UTC = 6am NZDT (5am NZST).
  schedule: 'every 1 day at 5:00 pm',
  sitemaps: ['https://johnston-motors.webflow.io/sitemap.xml'],
  startUrls: [],
  // Only URLs some action's pathsToMatch accepts are fetched (cars, models, site pages); nothing is discovered
  // beyond the sitemap.
  discoveryPatterns: [],
  renderJavaScript: false,
  // Staging only: robots.txt disallows everything, and the canonicals still point at
  // www.ebbett.co.nz until D6.
  ignoreRobotsTxtRules: true,
  ignoreNoIndex: true,
  ignoreCanonicalTo: true,
  safetyChecks: {
    beforeIndexPublishing: {
      // A broken template drops every record and is blocked; a busy sales day (a few cars
      // out of ~75) is not, which the 10% default would block.
      maxLostRecordsPercentage: 40,
    },
  },
  actions: [
    {
      indexName: 'stock',
      pathsToMatch: ['https://johnston-motors.webflow.io/inventory/**'],
      recordExtractor: ({ url, $, dataSources }) => {
        const raw = $('script#wd-algolia-record').html();
        if (!raw) return [];

        let f;
        try {
          // Webflow HTML-escapes bound values (& → &amp;, " → &quot;), so the JSON stays valid;
          // a stray backslash in a value is the one thing that could break it.
          f = JSON.parse(raw.replace(/\\/g, '\\\\'));
        } catch (e) {
          return [];
        }

        const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
        const str = (v) => {
          const s = String(v == null ? '' : v)
            .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
              if (e[0] !== '#') return ENTITIES[e.toLowerCase()] || m;
              const hex = e[1] === 'x' || e[1] === 'X';
              return String.fromCodePoint(parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10));
            })
            .trim();
          return s === '' ? null : s;
        };
        const text = (v) => str(v) || '';
        const num = (v) => {
          const s = str(v);
          if (s == null) return null;
          const n = Number(s.replace(/,/g, ''));
          return Number.isFinite(n) ? n : null;
        };
        const group = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const money = (n) => (n == null ? null : '$' + group(n));

        const objectID = str(f.objectID);
        if (!objectID) return [];

        const priceNow = num(f.price_now);
        const priceWas = num(f.price_was);
        let saving = num(f.price_saving);
        if (saving == null && priceWas != null && priceNow != null) saving = priceWas - priceNow;
        if (saving != null && saving <= 0) saving = null;
        const weekly = num(f.price_weekly);
        const odometer = num(f.odometer);
        const cc = num(f.engine_cc);
        // AutoPlay gives some EVs an engine of "1cc": treat a bare tiny cc as no engine figure.
        const engine = str(f.engine_kw);
        const kw = engine && /^\d{1,2}\s*cc$/i.test(engine) ? null : engine;
        const condition = str(f.condition);
        const carbon = num(f.carbon_emissions);
        const regions = (str(f.dealership_regions) || str(f.dealership_city) || '')
          .split(',').map((s) => s.trim()).filter(Boolean);

        // D7: GA4 page views via the Crawler's external data, once JM's GA4 is connected.
        const ga4 = dataSources && dataSources.ga4;
        const gaViews = ga4 ? num(ga4.screenPageViews) : null;
        const cmsViews = num(f.view_count);

        return [{
          autoplay_created_date: str(f.autoplay_created_date),
          autoplay_updated_date: str(f.autoplay_updated_date),
          name: str(f.name),
          stock_number: str(f.stock_number),
          plate: str(f.plate),
          status: str(f.status),
          condition,
          carbon_emissions_measurement: carbon,
          year: num(f.year),
          make: str(f.make),
          model: str(f.model),
          variant: text(f.variant),
          variant_extra: text(f.variant_extra),
          body_type: str(f.body_type),
          dealership: str(f.dealership),
          yard: num(f.yard),
          orc: str(f.orc_bool) === 'true',
          odometer,
          odometer_text: odometer == null ? null : group(odometer) + ' km',
          price_was_text: saving ? money(priceWas) : null,
          price_current_number: priceNow,
          price_current_text: money(priceNow),
          price_savings_number: saving,
          price_savings_text: saving ? money(saving) : '',
          price_weekly_number: weekly,
          price_weekly_text: money(weekly),
          fuel_type: str(f.fuel_type),
          doors: num(f.doors),
          seats: num(f.seats),
          safety_stars: num(f.safety_vehicle) != null ? num(f.safety_vehicle) : num(f.safety_driver),
          fuel_consumption: num(f.fuel_consumption),
          // Some CMS engine values already read "1000cc/82kW"; only prefix the cc when missing.
          engine_power: kw && /\dcc\b/i.test(kw) ? kw : cc && kw ? cc + 'cc/' + kw : kw || (cc ? cc + 'cc' : null),
          energy_economy_stars: num(f.energy_economy_stars),
          carbon_emission_stars: num(f.carbon_emission_stars),
          carbon_emissions: carbon,
          annual_fuel_cost: num(f.annual_fuel_cost),
          colour_exterior: text(f.colour_exterior),
          colour_interior: text(f.colour_interior),
          engine_size: cc ? (cc / 1000).toFixed(1) : null,
          drivetrain: text(f.drivetrain),
          drivetrain_simple: str(f.drivetrain_simple),
          transmission_simple: str(f.transmission_simple),
          transmission_detail: str(f.transmission_detail),
          features: null,
          comment: null,
          // A path, not a full URL: the stock/compare/nav-search link helpers keep relative
          // URLs as-is, so the records survive the domain switch.
          url: url.pathname,
          mainImage: str(f.main_image),
          // D5: one [data-gallery="item"] per photo in the template's hidden "Gallery" collection list.
          image_count: $('[data-gallery="item"]').length || null,
          region: regions,
          pageViews: gaViews != null ? gaViews : cmsViews != null ? cmsViews : 0,
          // Ebbett's Pre-owned Promise programme: only when the dealership lists it.
          is_pre_owned_promise: condition === 'Used' && /pre-owned promise/i.test(str(f.dealership_services) || ''),
          updatedAt: new Date().toISOString(),
          objectID,
        }];
      },
    },
    {
      // EV range page (/electric-vehicles/our-range-of-electric-cars). Each model page carries a CMS-bound JSON
      // block (<script id="wd-algolia-model">, Vehicle | Models template head). Records keep the shape of
      // Ebbett's `models` index, which client/cms_ev-range/search.js was written for. Every published model is
      // indexed; the page itself filters to EV and PHEV.
      indexName: 'models',
      pathsToMatch: ['https://johnston-motors.webflow.io/model/**'],
      recordExtractor: ({ url, $, dataSources }) => {
        const raw = $('script#wd-algolia-model').html();
        if (!raw) return [];

        let f;
        try {
          f = JSON.parse(raw.replace(/\\/g, '\\\\'));
        } catch (e) {
          return [];
        }

        const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
        const str = (v) => {
          const s = String(v == null ? '' : v)
            .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
              if (e[0] !== '#') return ENTITIES[e.toLowerCase()] || m;
              const hex = e[1] === 'x' || e[1] === 'X';
              return String.fromCodePoint(parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10));
            })
            .trim();
          return s === '' ? null : s;
        };
        const num = (v) => {
          const s = str(v);
          if (s == null) return null;
          const n = Number(s.replace(/[$,\s]/g, ''));
          return Number.isFinite(n) ? n : null;
        };
        // Multi-value Webflow options read "Front-wheel Drive|All-wheel Drive"; Ebbett's records hold arrays.
        const list = (v) => (str(v) || '').split('|').map((s) => s.trim()).filter(Boolean);

        const slug = str(f.slug);
        // "Proof - Hide model on site" models stay out of search.
        if (!slug || str(f.hidden) === 'true') return [];

        const price = num(f.price);
        const ga4 = dataSources && dataSources.ga4;
        const gaViews = ga4 ? num(ga4.screenPageViews) : null;

        return [{
          name: str(f.name),
          model: str(f.model),
          slug,
          vehicleBrand: str(f.brand),
          price,
          priceFormatted: str(f.price_text) || (price == null ? null : '$' + String(Math.round(price)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
          priceDetail: str(f.price_detail),
          fuelType: list(f.fuel_type),
          bodyType: list(f.body_type),
          driveTrain: list(f.drivetrain),
          transmission: list(f.transmission),
          seats: list(f.seats).map(Number).filter(Number.isFinite),
          engineSizes: list(f.engine_sizes),
          mainImage: str(f.image),
          // A path, so the records survive the domain switch (same as the stock records).
          url: url.pathname,
          openInNewTab: false,
          orderImportance: num(f.order),
          pageViews: gaViews != null ? gaViews : 0,
          updatedAt: new Date().toISOString(),
          objectID: slug,
        }];
      },
    },
    {
      // Nav search + /site-search: site pages, news posts and offers, one record per page, objectID = path.
      // Port of Ebbett's pages crawler (ebbett-agents 04-algolia/src/transforms/pages.js). Ebbett keeps news
      // and offers in their own indices; JM keeps them here, tagged by `category` ('pages', 'news' or
      // 'offers'), and cap_search filters on it (client/config.js INDICES). Cars, models and dealership
      // pages are left out (the first two have their own indices; JM's dealership pages are hidden).
      indexName: 'pages',
      pathsToMatch: [
        'https://johnston-motors.webflow.io',
        'https://johnston-motors.webflow.io/**',
        '!https://johnston-motors.webflow.io/inventory/**',
        '!https://johnston-motors.webflow.io/product/**',
        '!https://johnston-motors.webflow.io/stock/**',
        '!https://johnston-motors.webflow.io/model/**',
        '!https://johnston-motors.webflow.io/dealership/**',
      ],
      recordExtractor: ({ url, $ }) => {
        const path = (url.pathname.replace(/\/+$/, '') || '/');
        const EXCLUDE_PREFIXES = ['/inventory/', '/product/', '/stock/', '/model/', '/dealership/'];
        const EXCLUDE_EXACT = [
          '/access-denied', '/checkout', '/paypal-checkout', '/order-confirmation', '/log-in', '/sign-up',
          '/reset-password', '/update-password', '/user-account', '/site-search', '/search', '/untitled',
          '/test', // JM staging test page
        ];
        if (EXCLUDE_EXACT.includes(path) || EXCLUDE_PREFIXES.some((p) => path.startsWith(p))) return [];

        // noindex pages stay out (plus the "noidex" typo seen in Ebbett's CMS data).
        const robots = $('meta[name="robots"]').attr('content') || '';
        if (/noindex|noidex/i.test(robots)) return [];

        const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
        const segs = path.split('/').filter(Boolean);
        // A news post or an offer (the /news and /offers listing pages themselves are 'pages').
        const category = segs.length > 1 && (segs[0] === 'news' || segs[0] === 'offers') ? segs[0] : 'pages';

        // An offer's Offer JSON-LD (D6, Offers template) has its short name, description and end date.
        // Webflow writes the CMS text into it HTML-escaped ("Trade-In &amp; Upgrade").
        const unescape = (v) => $('<i></i>').html(String(v || '')).text();
        let offer = null;
        if (category === 'offers') {
          $('script[type="application/ld+json"]').each((i, el) => {
            if (offer) return;
            try {
              const data = JSON.parse($(el).html());
              const nodes = [].concat(data['@graph'] || data);
              offer = nodes.find((n) => n && n['@type'] === 'Offer') || null;
            } catch (e) { /* a bad block is skipped */ }
          });
        }

        // "Kia EV5 Roadshow | Johnston Motors" → "Kia EV5 Roadshow".
        const title = clean((offer && unescape(offer.name)) || $('title').first().text()).replace(/\s+[|–-]\s+Johnston Motors$/i, '');
        if (!title) return [];

        // Page content only: the nav (incl. its pop-ups) and footer sit outside <main>.
        const scope = $('main').length ? $('main').first() : $('body');
        scope.find('script, style, noscript, svg').remove();
        const headings = [];
        scope.find('h1, h2, h3').each((i, el) => {
          const h = clean($(el).text());
          if (h && !headings.includes(h)) headings.push(h);
        });
        const meta = (k) => $(`meta[name="${k}"]`).attr('content') || $(`meta[property="${k}"]`).attr('content') || '';
        // cap_search hides an offer once endDate (ms) has passed, as on Ebbett. validThrough is a date:
        // the offer runs to the end of that day, NZ time. No end date = always shown.
        let endDate = null;
        if (category === 'offers') {
          const end = offer && /^\d{4}-\d{2}-\d{2}$/.test(offer.validThrough || '') ? Date.parse(`${offer.validThrough}T23:59:59+13:00`) : NaN;
          endDate = Number.isFinite(end) ? end : 4102444800000; // 2100-01-01
        }

        return [{
          objectID: path,
          category,
          path,
          // A path, like the stock and model records, so they survive the domain switch.
          url: path,
          title,
          description: clean(meta('description') || meta('og:description') || (offer && unescape(offer.description))) || null,
          image: meta('og:image') || null,
          headings,
          body: clean(scope.text()).slice(0, 6000),
          pageType: segs.length > 1 ? segs[0] : 'general',
          endDate,
          updatedAt: new Date().toISOString(),
        }];
      },
    },
  ],
});
