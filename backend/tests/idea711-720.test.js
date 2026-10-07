/**
 * idea711-720.test.js — Tests for ideas 711-720: client config intelligence
 * (engines/configIntel.js) and interactive-crawl strategy generation
 * (crawler/interactiveStrategies.js). All fixtures are synthetic snippets
 * shaped like the SDK call patterns described in each extractor's JSDoc.
 *
 * Run: cd backend && node --test tests/idea711-720.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  enumerateFlagKeys,
  discoverRemoteConfigEndpoints,
  extractErrorMonitoringDsns,
  catalogAnalyticsEndpoints,
  mapExperimentVariants,
  summarizeConfigIntel,
} from '../src/engines/configIntel.js';

import {
  selectorFor,
  planInteractiveCrawl,
  detectInfiniteScroll,
  planInfiniteScroll,
  benignFillValue,
  extractFormSchemas,
  planFormFill,
  detectWizardStructure,
  planWizardTraversal,
  detectTabs,
  planTabExtraction,
  extractRoutesFromHtml,
  analyzeClickables,
  composePagePlan,
} from '../src/crawler/interactiveStrategies.js';

// ---------------------------------------------------------------------------
// Idea 711 — Feature-flag key enumeration
// ---------------------------------------------------------------------------
describe('idea 711 — enumerateFlagKeys', () => {
  const js = `
    const dark = ldClient.variation("new-checkout-flow", false);
    const flags = unleash.isEnabled("beta-search");
    configCat.getValue("enable-ai-suggestions", false);
    splitio.getTreatment("homepage-redesign");
    Statsig.checkGate("premium-dashboard");
    flagsmith.hasFeature("dark-mode");
    growthbook.isOn("upsell-banner");
    const on = featureFlags["legacy-export"];
    isFeatureEnabled("invoice-automation");
    const again = ldClient.variation("new-checkout-flow", false); // duplicate
  `;
  it('finds flag keys across SDKs with sdk attribution', () => {
    const flags = enumerateFlagKeys(js);
    const keys = flags.map((f) => f.key);
    assert.ok(keys.includes('new-checkout-flow'));
    assert.ok(keys.includes('beta-search'));
    assert.ok(keys.includes('enable-ai-suggestions'));
    assert.ok(keys.includes('homepage-redesign'));
    assert.ok(keys.includes('premium-dashboard'));
    assert.ok(keys.includes('dark-mode'));
    assert.ok(keys.includes('upsell-banner'));
    assert.ok(keys.includes('legacy-export'));
    assert.ok(keys.includes('invoice-automation'));
  });
  it('dedupes repeated references', () => {
    const flags = enumerateFlagKeys(js);
    assert.equal(flags.filter((f) => f.key === 'new-checkout-flow').length, 1);
  });
  it('returns empty for non-flag code', () => {
    assert.deepEqual(enumerateFlagKeys('const x = 1; function f() { return x; }'), []);
  });
});

// ---------------------------------------------------------------------------
// Idea 712 — Remote config-endpoint discovery
// ---------------------------------------------------------------------------
describe('idea 712 — discoverRemoteConfigEndpoints', () => {
  const js = `
    fetch("https://cdn.configcat.com/config_v5/p/abc123/config.json");
    const rc = "https://firebaseremoteconfig.googleapis.com/v1/projects/p1/namespaces/firebase:fetch";
    const flags = "https://app.launchdarkly.com/sdk/flags/ABCDEF1234";
    const cfg = "/.well-known/remote-config";
    const local = "/static/app-config.json";
  `;
  it('finds provider remote-config endpoints', () => {
    const eps = discoverRemoteConfigEndpoints(js);
    const urls = eps.map((e) => e.url);
    assert.ok(urls.some((u) => u.includes('cdn.configcat.com')));
    assert.ok(urls.some((u) => u.includes('firebaseremoteconfig.googleapis.com')));
    assert.ok(urls.some((u) => u.includes('launchdarkly.com')));
    assert.ok(eps.some((e) => e.provider === 'configcat-cdn'));
    assert.ok(eps.some((e) => e.provider === 'firebase-remote-config'));
  });
  it('finds well-known and generic config paths', () => {
    const jsCfg = 'const cfg = "/.well-known/remote-config"; const local = "/static/app-config.json";';
    const eps = discoverRemoteConfigEndpoints(jsCfg, '<script src="/app.js"></script><!-- /.well-known/remote-config -->');
    const urls = eps.map((e) => e.url);
    assert.ok(urls.some((u) => u.includes('remote-config')));
    assert.ok(eps.some((e) => e.provider === 'well-known-remote-config'));
    assert.ok(urls.some((u) => u.includes('app-config.json')));
  });
});

// ---------------------------------------------------------------------------
// Idea 713 — Error-monitoring DSN discovery
// ---------------------------------------------------------------------------
describe('idea 713 — extractErrorMonitoringDsns', () => {
  const js = `
    Sentry.init({ dsn: "https://a1b2c3d4e5f60718293a4b5c6d7e8f9a@o123.ingest.sentry.io/456" });
    Bugsnag.start({ apiKey: "0123456789abcdef0123456789abcdef" });
    const rollbar = { accessToken: "00112233445566778899aabbccddeeff", environment: "production" };
    const airbrake = { projectId: 98765, projectKey: "aa11bb22cc33dd44ee55ff66" };
  `;
  it('extracts sentry DSN with host and project id', () => {
    const found = extractErrorMonitoringDsns(js);
    const sentry = found.find((f) => f.provider === 'sentry');
    assert.ok(sentry);
    assert.equal(sentry.detail.projectId, '456');
    assert.equal(sentry.detail.host, 'o123.ingest.sentry.io');
  });
  it('extracts bugsnag, rollbar and airbrake identifiers', () => {
    const found = extractErrorMonitoringDsns(js);
    assert.ok(found.some((f) => f.provider === 'bugsnag' && f.detail.apiKey.length === 32));
    assert.ok(found.some((f) => f.provider === 'rollbar' && f.detail.environment === 'production'));
    assert.ok(found.some((f) => f.provider === 'airbrake' && f.detail.projectId === '98765'));
  });
  it('ignores code with no monitoring keys', () => {
    assert.deepEqual(extractErrorMonitoringDsns('console.log("hello");'), []);
  });
});

// ---------------------------------------------------------------------------
// Idea 714 — Analytics endpoint cataloging
// ---------------------------------------------------------------------------
describe('idea 714 — catalogAnalyticsEndpoints', () => {
  const js = `
    <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>
    <script src="https://cdn.segment.com/analytics.js/v1/ab12cd34ef/analytics.min.js"></script>
    mixpanel.init("token");
  `;
  it('catalogs analytics providers with attribution', () => {
    const eps = catalogAnalyticsEndpoints(js);
    assert.ok(eps.some((e) => e.provider === 'google-tag-manager'));
    assert.ok(eps.some((e) => e.provider === 'segment'));
    assert.ok(eps.some((e) => e.provider === 'mixpanel'));
  });
  it('scans html input too', () => {
    const eps = catalogAnalyticsEndpoints('', '<script src="https://cdn.amplitude.com/libs/amplitude.min.js"></script>');
    assert.ok(eps.some((e) => e.provider === 'amplitude'));
  });
});

// ---------------------------------------------------------------------------
// Idea 715 — A/B testing variant mapping
// ---------------------------------------------------------------------------
describe('idea 715 — mapExperimentVariants', () => {
  const js = `
    optimizely.activate("checkout_button_color");
    const exp = useExperiment({ key: "pricing_table_v2" });
    splitio.getTreatment("onboarding_flow");
    const e2 = run({ key: "hero_copy", variations: ["control", "variant-a", "variant-b"] });
  `;
  it('maps experiments across SDKs', () => {
    const exps = mapExperimentVariants(js);
    const names = exps.map((e) => e.name);
    assert.ok(names.includes('checkout_button_color'));
    assert.ok(names.includes('pricing_table_v2'));
    assert.ok(names.includes('onboarding_flow'));
    assert.ok(names.includes('hero_copy'));
  });
  it('parses growthbook variation arrays', () => {
    const exps = mapExperimentVariants(js);
    const hero = exps.find((e) => e.name === 'hero_copy');
    assert.ok(hero);
    assert.deepEqual(hero.variants, ['control', 'variant-a', 'variant-b']);
  });
});

describe('summarizeConfigIntel aggregates all five', () => {
  it('returns all five buckets', () => {
    const js = `
      ldClient.variation("flag-a", false);
      Sentry.init({ dsn: "https://a1b2c3d4e5f60718293a4b5c6d7e8f9a@o1.ingest.sentry.io/7" });
      optimizely.activate("exp-1");
    `;
    const summary = summarizeConfigIntel(js, '<script src="https://cdn.posthog.com/array.js"></script>');
    assert.ok(summary.flagKeys.length >= 1);
    assert.ok(summary.errorMonitoring.length >= 1);
    assert.ok(summary.experiments.length >= 1);
    assert.ok(summary.analyticsEndpoints.some((e) => e.provider === 'posthog'));
    assert.ok(Array.isArray(summary.remoteConfigEndpoints));
  });
});

// ---------------------------------------------------------------------------
// Idea 716 — Headless-browser interactive crawling
// ---------------------------------------------------------------------------
describe('idea 716 — planInteractiveCrawl', () => {
  it('orders scroll, clicks, fills and extractions', () => {
    const plan = planInteractiveCrawl({
      url: 'https://target.example/app',
      clickables: [{ tag: 'button', text: 'Load results' }],
      forms: [{ action: '/search', method: 'get', fields: [{ type: 'search', name: 'q' }] }],
    });
    const actions = plan.map((p) => p.action);
    assert.equal(actions[0], 'scroll');
    assert.ok(actions.includes('click'));
    assert.ok(actions.includes('fill'));
    assert.ok(actions.includes('extract'));
  });
  it('skips destructive labels and empty urls', () => {
    const plan = planInteractiveCrawl({
      url: 'https://target.example/app',
      clickables: [{ tag: 'button', text: 'Delete account' }],
    });
    assert.ok(!plan.some((p) => p.action === 'click'));
    assert.deepEqual(planInteractiveCrawl({}), []);
  });
  it('selectorFor prefers id, then class, then name', () => {
    assert.equal(selectorFor({ tag: 'button', id: 'go' }), 'button#go');
    assert.equal(selectorFor({ tag: 'a', class: 'nav link' }), 'a.nav');
    assert.equal(selectorFor({ tag: 'input', name: 'q' }), 'input[name="q"]');
  });
});

// ---------------------------------------------------------------------------
// Idea 717 — Infinite-scroll pagination harvesting
// ---------------------------------------------------------------------------
describe('idea 717 — infinite scroll', () => {
  it('detects infinite-scroll markers', () => {
    const d = detectInfiniteScroll('<div class="infinite-scroll-feed"><button>Load more</button></div>');
    assert.ok(d.infinite);
    assert.ok(d.markers.length > 0);
    assert.ok(d.container.includes('infinite-scroll-feed'));
  });
  it('does not false-positive plain pages', () => {
    assert.equal(detectInfiniteScroll('<p>hello</p>').infinite, false);
  });
  it('generates bounded scroll+extract cycles', () => {
    const plan = planInfiniteScroll({ maxScrolls: 3, scrollAmount: 2000 });
    assert.equal(plan.filter((p) => p.action === 'scroll').length, 3);
    assert.equal(plan.filter((p) => p.action === 'extract').length, 3);
    assert.ok(plan.every((p) => p.reason));
  });
  it('caps the scroll budget', () => {
    assert.equal(planInfiniteScroll({ maxScrolls: 500 }).filter((p) => p.action === 'scroll').length, 50);
  });
});

// ---------------------------------------------------------------------------
// Idea 718 — Form-fill state exploration
// ---------------------------------------------------------------------------
describe('idea 718 — form fill', () => {
  const html = `
    <form action="/search" method="get">
      <input type="search" name="q" placeholder="Search" required>
      <input type="email" name="email">
      <input type="hidden" name="csrf" value="abc">
      <button type="submit">Go</button>
    </form>`;
  it('parses form schemas and skips hidden inputs', () => {
    const forms = extractFormSchemas(html);
    assert.equal(forms.length, 1);
    assert.equal(forms[0].action, '/search');
    assert.equal(forms[0].fields.length, 3);
    const plan = planFormFill({ forms });
    assert.ok(!plan.some((p) => String(p.value).includes('abc')));
  });
  it('uses benign values per input type', () => {
    assert.equal(benignFillValue({ type: 'email' }), 'test@example.com');
    assert.equal(benignFillValue({ type: 'checkbox' }), true);
    assert.equal(benignFillValue({ type: 'mystery' }), 'HuntBot Test');
  });
  it('fills then submits to reach post-submit state', () => {
    const forms = extractFormSchemas(html);
    const plan = planFormFill({ forms });
    const actions = plan.map((p) => p.action);
    assert.ok(actions.includes('fill'));
    assert.ok(actions.includes('submit'));
    assert.ok(actions.includes('extract'));
  });
  it('can suppress submission', () => {
    const plan = planFormFill({ forms: extractFormSchemas(html) }, { submit: false });
    assert.ok(!plan.some((p) => p.action === 'submit'));
  });
});

// ---------------------------------------------------------------------------
// Idea 719 — Multi-step wizard traversal
// ---------------------------------------------------------------------------
describe('idea 719 — wizard traversal', () => {
  const html = `
    <div data-wizard class="checkout-wizard">
      <div data-step-name="details"></div>
      <div data-step-name="payment"></div>
      <div data-step-name="review"></div>
      <button class="next-btn">Continue</button>
      <button class="back-btn">Back</button>
    </div>`;
  it('detects wizard, steps and controls', () => {
    const w = detectWizardStructure(html);
    assert.ok(w.wizard);
    assert.deepEqual(w.steps, ['details', 'payment', 'review']);
    assert.ok(w.nextSelector.includes('next-btn'));
    assert.ok(w.backSelector.includes('back-btn'));
  });
  it('walks every step with per-step extraction', () => {
    const plan = planWizardTraversal({ steps: ['details', 'payment', 'review'], nextSelector: 'button.next-btn' });
    assert.equal(plan.filter((p) => p.action === 'extract').length, 3);
    assert.equal(plan.filter((p) => p.action === 'click').length, 2);
  });
});

// ---------------------------------------------------------------------------
// Idea 720 — Tab-interface content extraction
// ---------------------------------------------------------------------------
describe('idea 720 — tab extraction', () => {
  const html = `
    <div role="tablist">
      <button role="tab" aria-controls="panel-1">Overview</button>
      <button role="tab" aria-controls="panel-2">Reports</button>
      <div id="panel-1" role="tabpanel">one</div>
      <div id="panel-2" role="tabpanel">two</div>
    </div>`;
  it('detects tabs with labels and panels', () => {
    const tabs = detectTabs(html);
    assert.equal(tabs.length, 2);
    assert.equal(tabs[0].label, 'Overview');
    assert.equal(tabs[0].panelSelector, '#panel-1');
  });
  it('falls back to data-tab markup', () => {
    const tabs = detectTabs('<button data-tab="a">Alpha</button><div data-tab-panel="a">x</div>');
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].target, 'a');
  });
  it('activates every tab then extracts', () => {
    const plan = planTabExtraction(detectTabs(html));
    assert.equal(plan.filter((p) => p.action === 'activate-tab').length, 2);
    assert.equal(plan.filter((p) => p.action === 'extract').length, 2);
  });
});

// ---------------------------------------------------------------------------
// Shared analyzers + composer
// ---------------------------------------------------------------------------
describe('route analyzers', () => {
  it('extractRoutesFromHtml absolutizes and skips pseudo-links', () => {
    const routes = extractRoutesFromHtml(
      '<a href="/about">a</a><a href="https://x.example/docs">d</a><a href="mailto:a@b.c">m</a><a href="/about">dup</a>',
      'https://target.example'
    );
    const paths = routes.map((r) => r.path);
    assert.ok(paths.includes('https://target.example/about'));
    assert.ok(paths.includes('https://x.example/docs'));
    assert.equal(paths.length, 2);
  });
  it('analyzeClickables lists buttons, links and submit inputs', () => {
    const els = analyzeClickables('<button id="go">Go</button><a class="nav" href="/">Home</a><input type="text" name="q">');
    assert.ok(els.some((e) => e.tag === 'button' && e.id === 'go'));
    assert.ok(els.some((e) => e.tag === 'a' && e.class === 'nav'));
    assert.ok(!els.some((e) => e.tag === 'input' && e.name === 'q'));
  });
  it('composePagePlan merges detected affordances', () => {
    const html = `
      <div class="infinite-scroll-feed"></div>
      <div data-wizard><div data-step-name="a"></div><button class="next-btn">Next</button></div>
      <div role="tablist"><button role="tab" aria-controls="p1">T1</button><div id="p1">x</div></div>
      <form action="/s"><input name="q"></form>
      <a href="/contact">Contact</a>`;
    const { url, plan, detected } = composePagePlan('https://target.example/', html);
    assert.equal(url, 'https://target.example/');
    assert.ok(detected.infiniteScroll.infinite);
    assert.ok(detected.wizard.wizard);
    assert.equal(detected.tabs.length, 1);
    assert.ok(plan.some((p) => p.action === 'scroll'));
    assert.ok(plan.some((p) => p.action === 'activate-tab'));
    assert.ok(plan.some((p) => p.action === 'fill'));
    assert.ok(plan.length > 10);
  });
});
