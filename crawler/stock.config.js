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
  maxUrls: 300, // ~75 cars today; the agreement sizes it for 100
  // The plan enforces >= 23 h between scheduled crawls. 17:00 UTC = 6am NZDT (5am NZST).
  schedule: 'every 1 day at 5:00 pm',
  sitemaps: ['https://johnston-motors.webflow.io/sitemap.xml'],
  startUrls: [],
  // Only vehicle pages are fetched: nothing outside pathsToMatch is discovered or crawled.
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
  ],
});
