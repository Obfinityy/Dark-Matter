/**
 * idea681-690.test.js — Tests for the JS crawling/intel extraction wave.
 *
 * Ideas 681-690: source-map chaining + hidden .map discovery
 * (sourceMapHunter.js), framework fingerprinting + build-mode detection
 * (frameworkIntel.js), dead-code/commented endpoint extraction
 * (bundleEndpointMiner.js), event-handler + callback-param URL mining
 * (jsUrlMiner.js), and postMessage origin cataloging + listener mapping
 * (postMessageIntel.js). All fixtures are synthetic build artifacts shaped
 * like real bundler/framework outputs described in each parser's JSDoc.
 *
 * Run: cd backend && node --test tests/idea681-690.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveMapUrl,
  collectChunkMapRefs,
  chainSourceMapRefs,
  predictHiddenMapNames,
  scoreMapLikelihood,
} from '../src/engines/sourceMapHunter.js';

import {
  fingerprintFrameworks,
  detectBuildMode,
} from '../src/engines/frameworkIntel.js';

import {
  normalizeEndpoint,
  extractEndpointsFromText,
  harvestCommentedEndpoints,
  extractDeadCodeEndpoints,
} from '../src/engines/bundleEndpointMiner.js';

import {
  mineEventHandlerUrls,
  mineCallbackParams,
} from '../src/engines/jsUrlMiner.js';

import {
  catalogPostMessageOrigins,
  mapMessageListeners,
} from '../src/engines/postMessageIntel.js';

// ---------------------------------------------------------------- 681/682
describe('sourceMapHunter (681, 682)', () => {
  it('resolves relative, absolute and protocol-relative map refs', () => {
    assert.equal(resolveMapUrl('app.js.map', 'https://cdn.example.com/static/app.js'),
      'https://cdn.example.com/static/app.js.map');
    assert.equal(resolveMapUrl('https://maps.example.com/app.js.map', 'https://cdn.example.com/a.js'),
      'https://maps.example.com/app.js.map');
    assert.equal(resolveMapUrl('//maps.example.com/app.js.map', 'https://cdn.example.com/a.js'),
      'https://maps.example.com/app.js.map');
    assert.equal(resolveMapUrl('data:application/json;base64,xxx', 'https://x/a.js'), null);
  });

  it('chains sourceMappingURL refs across chunks (681)', () => {
    const chunks = [
      { url: 'https://app.example.com/main.abc123.js', text: '(()=>{})()\n//# sourceMappingURL=main.abc123.js.map' },
      { url: 'https://app.example.com/vendor.def456.js', text: '/*# sourceMappingURL=/maps/vendor.def456.js.map */' },
      { url: 'https://app.example.com/inline.js', text: 'x=1;\n//# sourceMappingURL=data:application/json;base64,eyJ2IjozfQ==' },
    ];
    const { maps, mapUrls, inlineRefs } = chainSourceMapRefs(chunks);
    assert.equal(maps.length, 3);
    assert.ok(mapUrls.includes('https://app.example.com/main.abc123.js.map'));
    assert.ok(mapUrls.includes('https://app.example.com/maps/vendor.def456.js.map'));
    assert.equal(inlineRefs.length, 1);
    assert.equal(maps.find((m) => m.kind === 'inline').chunkUrl, 'https://app.example.com/inline.js');
  });

  it('collects refs for a single chunk', () => {
    const r = collectChunkMapRefs('https://a/b.js', 'y();\n//# sourceMappingURL=b.js.map');
    assert.equal(r.refs.length, 1);
    assert.equal(r.refs[0].mapUrl, 'https://a/b.js.map');
  });

  it('predicts hidden .map names for stripped references (682)', () => {
    const c = predictHiddenMapNames('https://cdn.example.com/static/app.a1b2c3d4e5.js');
    assert.ok(c.includes('https://cdn.example.com/static/app.a1b2c3d4e5.js.map'));
    assert.ok(c.includes('https://cdn.example.com/static/app.js.map'));
    const css = predictHiddenMapNames('https://cdn.example.com/main.css');
    assert.ok(css[0].endsWith('main.css.map'));
  });

  it('scores map payload likelihood', () => {
    const good = scoreMapLikelihood('{"version":3,"sources":["a.ts"],"mappings":"AAAA","sourcesContent":["x"]}');
    assert.equal(good.looksLikeMap, true);
    assert.equal(good.confidence, 'high');
    const bad = scoreMapLikelihood('<html><body>Not found</body></html>');
    assert.equal(bad.looksLikeMap, false);
  });
});

// ---------------------------------------------------------------- 683/684
describe('frameworkIntel (683, 684)', () => {
  const reactProd = `!function(){var e={};__REACT_DEVTOOLS_GLOBAL_HOOK__.isDisabled=!0;
    //# sourceMappingURL=react-dom.production.min.js.map`;
  const vueDev = `[Vue warn]: Missing required prop\n__VUE_DEVTOOLS_GLOBAL_HOOK__ = {};
    Vue.version="3.4.21"; app.config.debug=true;`;
  const angularHtml = `<app-root ng-version="17.1.0"></app-root>`;

  it('fingerprints React and flags no version when absent (683)', () => {
    const f = fingerprintFrameworks(reactProd);
    assert.equal(f[0].framework, 'react');
    assert.equal(f[0].version, null);
    assert.ok(['medium', 'low'].includes(f[0].confidence));
  });

  it('fingerprints Vue with version (683)', () => {
    const f = fingerprintFrameworks(vueDev);
    const vue = f.find((x) => x.framework === 'vue');
    assert.ok(vue);
    assert.equal(vue.version, '3.4.21');
    assert.equal(vue.confidence, 'high');
  });

  it('fingerprints Angular from ng-version (683)', () => {
    const f = fingerprintFrameworks(angularHtml);
    const ng = f.find((x) => x.framework === 'angular');
    assert.ok(ng);
    assert.equal(ng.version, '17.1.0');
  });

  it('detects production builds (684)', () => {
    const r = detectBuildMode(reactProd + '\nprocess.env.NODE_ENV="production";');
    assert.equal(r.mode, 'production');
    assert.ok(r.prodHits.length > 0);
  });

  it('detects development builds (684)', () => {
    const r = detectBuildMode(vueDev + '\nif(process.env.NODE_ENV!=="production"){console.warn("dev")}');
    assert.equal(r.mode, 'development');
    assert.ok(r.devScore > r.prodScore);
  });
});

// ---------------------------------------------------------------- 685/686
describe('bundleEndpointMiner (685, 686)', () => {
  const bundle = `
    // TODO: re-enable /api/v1/internal/legacy-export after review
    /* deprecated endpoint: "/api/v2/old-report" — keep for compat */
    <!-- staging hook: https://staging.example.com/hooks/debug -->
    fetch("/api/v1/users");
    if(false){ fetch("/api/v1/internal/debug-reset"); }
    while(false){ post("/hidden/cron/trigger"); }
    const mode = false ? "/api/v9/removed-flag" : "/api/v9/live";
  `;

  it('harvests endpoints from comments (686)', () => {
    const found = harvestCommentedEndpoints(bundle);
    const eps = found.map((f) => f.endpoint);
    assert.ok(eps.includes('/api/v1/internal/legacy-export'));
    assert.ok(eps.includes('/api/v2/old-report'));
    assert.ok(eps.includes('https://staging.example.com/hooks/debug'));
    assert.ok(!eps.includes('/api/v1/users'), 'live code must not be attributed to comments');
    const kinds = new Set(found.map((f) => f.commentKind));
    assert.ok(kinds.has('line') && kinds.has('block') && kinds.has('html'));
  });

  it('extracts endpoints from dead branches and ternaries (685)', () => {
    const found = extractDeadCodeEndpoints(bundle);
    const eps = found.map((f) => f.endpoint);
    assert.ok(eps.includes('/api/v1/internal/debug-reset'));
    assert.ok(eps.includes('/hidden/cron/trigger'));
    assert.ok(eps.includes('/api/v9/removed-flag'));
    assert.ok(!eps.includes('/api/v9/live'), 'live ternary branch must not be harvested');
    assert.ok(!eps.includes('/api/v1/users'), 'live code must not be harvested');
    assert.ok(found.every((f) => ['dead-branch', 'dead-ternary'].includes(f.reason)));
  });

  it('normalizes and filters noise endpoints', () => {
    assert.equal(normalizeEndpoint('/favicon.ico'), null);
    assert.equal(normalizeEndpoint('not-a-path'), null);
    assert.equal(normalizeEndpoint('/api/v1/things'), '/api/v1/things');
    assert.deepEqual(extractEndpointsFromText('no urls here'), []);
  });
});

// ---------------------------------------------------------------- 687/688
describe('jsUrlMiner (687, 688)', () => {
  const page = `
    <button onclick="location.href='/account/settings'">x</button>
    <form onsubmit="return postForm('/api/v1/submit')">
    <script>
      btn.addEventListener('click', () => { window.open('/reports/export?fmt=pdf'); });
      link.onclick = "go('/legacy/home')";
      const cfg = { callback: "https://hooks.example.com/oauth/cb", redirect_uri: "/login/return" };
      const authUrl = "https://idp.example.com/authorize?redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb&state=1";
    </script>
  `;

  it('mines URLs from event handlers (687)', () => {
    const found = mineEventHandlerUrls(page);
    const all = found.flatMap((f) => f.urls);
    assert.ok(all.includes('/account/settings'));
    assert.ok(all.includes('/api/v1/submit'));
    assert.ok(all.includes('/reports/export?fmt=pdf'));
    assert.ok(all.includes('/legacy/home'));
    assert.ok(found.some((f) => f.source === 'inline-attr' && f.event === 'click'));
    assert.ok(found.some((f) => f.source === 'addEventListener' && f.event === 'click'));
  });

  it('mines callback and redirect URL parameters (688)', () => {
    const found = mineCallbackParams(page);
    const cb = found.find((f) => f.param === 'callback');
    assert.ok(cb);
    assert.equal(cb.host, 'hooks.example.com');
    assert.equal(cb.context, 'js-assignment');
    const ru = found.find((f) => f.param === 'redirect_uri' && f.context === 'query-string');
    assert.ok(ru, 'query-string redirect_uri should be found');
    assert.ok(ru.host.includes('app.example.com'));
  });
});

// ---------------------------------------------------------------- 689/690
describe('postMessageIntel (689, 690)', () => {
  const bundle = `
    iframe.contentWindow.postMessage({cmd:'init'}, 'https://embed.example.com');
    popup.postMessage(token, '*');
    other.postMessage(data, allowedOrigin);
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://embed.example.com') return;
      if (!event.origin.endsWith('.trusted.example')) return;
      switch (event.data.type) {
        case 'login': handleLogin(event.data.payload); break;
        case 'logout': break;
      }
      const action = event.data.action;
    });
  `;

  it('catalogs postMessage target origins incl. wildcard (689)', () => {
    const origins = catalogPostMessageOrigins(bundle);
    const literal = origins.find((o) => o.kind === 'literal');
    assert.equal(literal.origin, 'https://embed.example.com');
    const wild = origins.find((o) => o.kind === 'wildcard');
    assert.ok(wild, 'wildcard must be flagged');
    assert.equal(wild.count, 1);
    const dyn = origins.find((o) => o.kind === 'dynamic');
    assert.ok(dyn, 'expression origins must be cataloged as dynamic');
  });

  it('maps message listeners with origin checks and data shapes (690)', () => {
    const listeners = mapMessageListeners(bundle);
    assert.equal(listeners.length, 1);
    const [l] = listeners;
    assert.ok(l.expectedOrigins.includes('https://embed.example.com'));
    assert.ok(l.originChecks.some((c) => c.includes('!==')));
    assert.ok(l.dataFields.includes('type'));
    assert.ok(l.dataFields.includes('action'));
    assert.ok(l.messageKinds.includes('login'));
    assert.ok(l.messageKinds.includes('logout'));
  });
});
