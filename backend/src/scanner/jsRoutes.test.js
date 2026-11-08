// JS-bundle API route mining (7 Nov 2026, Juice Shop lane).
//
// DIAGNOSIS (Juice spec survey, parent-verified): Juice Shop publishes
// NO standalone OpenAPI spec, so openapi-targets can never unlock the
// battery there — but the SPA's served main.js (458,398 bytes live)
// contains every /rest/* + /api/* route the frontend calls, as string
// literals in http.<method>(...) first arguments and as service-base
// assignments (`host = this.hostServer + "/rest/..."`) with this.host
// calls. The JUICE_BUNDLE fixture below is modeled on the REAL bundle
// fetched live from the lab 7 Nov 2026 (same syntactic forms, trimmed
// to the routes that decide targeting; 12 mined GET routes were also
// probed live and all respond).
//
// No network, no docker in these tests — bundle fetches are stubbed
// (opts.fetchPage / opts.jsRoutesFetcher) or served by a local stub
// HTTP server; runScan integration tests pass a restricted phases
// list (no 'nuclei', no 'dom-render') so no container ever spawns.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  collectLiteralBindings,
  discoverJsRoutes,
  extractJsRoutes,
  extractJsRouteRecords,
  extractScriptSrcs,
  synthesiseJsTargets,
  synthesiseJsWriteTargets,
  JS_ROUTES_MAX_TARGETS,
  JS_ROUTES_MAX_BUNDLES,
} from './jsRoutes.js';
import { runScan, PARAM_BATTERY_PHASES, buildPhaseRollup } from './index.js';

// Juice API-login creds for the D3 runScan test — public lab defaults,
// built by concatenation so no secret-shaped literal lands here (GH013).
const D3_JUICE_USER = 'admin' + '@juice-sh.op';
const D3_JUICE_PASS = 'admin' + '123';
const D3_TOKEN = 'fixture-jwt-token-001';

// Juice main.js forms, live (7 Nov 2026): direct http.get literals
// (security-question, change-password concat), hostServer+ literal
// calls (whoami), service bases with this.host calls (Products bare
// GET, captcha GET /, admin GET /application-version, chatbot GET
// /status, snippets/fixes GET /${id}), template-literal calls — the
// REAL search form is a hostServer template (the quoted .concat form
// in the old fixture masked the mining gap; a .concat route is kept
// separately as concat-case), host-template suffix calls
// (`${this.host}/${e}`, `${this.host}/${e}?d=${x}`), a dotted-alias
// hostServer template (I.c.hostServer, 2fa/status), POST-only routes
// (login, reset-password, 2fa/verify, basket checkout + coupon),
// and a mixed GET+POST route (deluxe-membership). A display-only
// template (label) models a non-http template string.
const JUICE_BUNDLE = `
let A=(()=>{class n{http;hostServer=et.c.hostServer;host=this.hostServer+"/api/Products";constructor(e){this.http=e}getAll(){return this.http.get(this.host)}getOne(e){return this.http.get(\`\${this.host}/\${e}\`)}getDated(e,x){return this.http.get(\`\${this.host}/\${e}?d=\${x}\`)}}})();
let B=(()=>{class n{http;hostServer=et.c.hostServer;host=this.hostServer+"/rest/captcha";constructor(e){this.http=e}get(){return this.http.get(this.host+"/")}}})();
let C=(()=>{class n{http;hostServer=et.c.hostServer;host=this.hostServer+"/rest/admin";constructor(e){this.http=e}version(){return this.http.get(this.host+"/application-version")}}} )();
let D=(()=>{class n{http;hostServer=et.c.hostServer;host=this.hostServer+"/rest/chatbot";constructor(e){this.http=e}status(){return this.http.get(this.host+"/status")}respond(t){return this.http.post(this.host+"/respond",t)}}} )();
let E=(()=>{class n{http;hostServer=et.c.hostServer;host=this.hostServer+"/snippets/fixes";constructor(e){this.http=e}get(t){return this.http.get(this.host+\`/\${t}\`)}}} )();
let F=(()=>{class n{http;hostServer=et.c.hostServer;host=this.hostServer+"/rest/user";constructor(e){this.http=e}
search(q){return this.http.get(\`\${this.hostServer}/rest/products/search?q=\${q}\`)}
concatCase(q){return this.http.get("/rest/concat-case?q=".concat(q))}
securityQuestion(e){return this.http.get("/rest/user/security-question?email="+e)}
changePassword(e){return this.http.get("/rest/user/change-password?current="+e.current+"&new="+e.new+"&repeat="+e.repeat)}
whoami(){return this.http.get(Server+"/rest/user/whoami")}
challenges(){return this.http.get("/api/Challenges/?key=nftMintChallenge")}
login(t){return this.http.post("/rest/user/login",t)}
resetPassword(t){return this.http.post("/rest/user/reset-password",t)}
verify(t){return this.http.post("/rest/2fa/verify",t)}
basket(e){return this.http.get(\`/rest/basket/\${e}\`)}
checkout(e){return this.http.post("/rest/basket/"+e+"/checkout",{})}
coupon(e,o){return this.http.put("/rest/basket/"+e+"/coupon/"+o,{})}
deluxe(){return this.http.get("/rest/deluxe-membership")}
deluxeBuy(t){return this.http.post("/rest/deluxe-membership",t)}
continueCode(){return this.http.get("/rest/continue-code")}
twofa(){return this.http.get(\`\${I.c.hostServer}/rest/2fa/status\`)}
label(){return \`See /rest/display-only?q=\${q} for details\`}
languages(){return this.http.get(\`\${this.hostServer}/rest/languages\`)}
}})();
`;

// REAL Juice main.js call forms, live (8 Nov 2026): the hostServer+
// quoted-literal calls the miner missed until branch (a2) —
// this.http.post(this.hostServer+"/rest/user/login",e) and
// this.http.get(this.hostServer+"/rest/user/whoami") — plus the
// 2fa/status dotted-alias template (branch (b2)) and the basket
// template (branch (b2), path param). The OLD JUICE_BUNDLE masked
// the gap with minified bare-ident forms (Server+"/rest/user/whoami")
// that branch (b) already handled.
const REAL_JUICE_BUNDLE = `
let F=(()=>{class n{http;hostServer=et.c.hostServer;constructor(e){this.http=e}
login(t){return this.http.post(this.hostServer+"/rest/user/login",t)}
whoami(){return this.http.get(this.hostServer+"/rest/user/whoami")}
twofa(){return this.http.get(\`\${I.c.hostServer}/rest/2fa/status\`)}
find(e){return this.http.get(\`\${this.hostServer}/rest/basket/\${e}\`)}
}})();
`;

const JUICE_SHELL =
  '<html><head><script src="runtime.js"></script><script src="polyfills.js"></script>' +
  '<script src="vendor.js"></script><script src="main.js"></script></head><body>Juice Shop</body></html>';

function stubFetchFor(shell, bundles) {
  return async (url) => {
    const u = new URL(url);
    if (u.pathname === '/' || u.pathname === '/index.html') {
      return { url, status: 200, headers: {}, body: shell };
    }
    if (Object.hasOwn(bundles, u.pathname.slice(1))) {
      return { url, status: 200, headers: {}, body: bundles[u.pathname.slice(1)] };
    }
    return { url, status: 404, headers: {}, body: '' };
  };
}

describe('extractScriptSrcs', () => {
  test('JS-1: same-origin .js only — cross-origin + non-js + dupes dropped, cap honoured', () => {
    const html =
      '<script src="main.js"></script><script src="/static/app.js?v=2"></script>' +
      '<script src="https://cdn.example.com/x.js"></script><script src="style.css"></script>' +
      '<script src="main.js"></script><script>var x = 1;</script>';
    const srcs = extractScriptSrcs(html, 'http://example.com/');
    assert.deepEqual(srcs, ['http://example.com/main.js', 'http://example.com/static/app.js?v=2']);
    assert.equal(extractScriptSrcs('', 'http://example.com/').length, 0);
    assert.equal(extractScriptSrcs('<html></html>', 'http://example.com/').length, 0);
    assert.equal(extractScriptSrcs('<script src="a.js"></script>', 'not a url').length, 0);
    const many = Array.from({ length: 8 }, (_, i) => `<script src="b${i}.js"></script>`).join('');
    assert.equal(extractScriptSrcs(many, 'http://example.com/').length, JS_ROUTES_MAX_BUNDLES);
  });
});

describe('extractJsRouteRecords (Juice bundle fixture)', () => {
  test('JS-2: GET literals + hostServer template yield query params — search q (template), security-question email, change-password 3 params', () => {
    const recs = extractJsRouteRecords(JUICE_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    assert.deepEqual(byPath.get('/rest/products/search').queryNames, ['q']);
    assert.deepEqual(byPath.get('/rest/products/search').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/user/security-question').queryNames, ['email']);
    assert.deepEqual(byPath.get('/rest/user/change-password').queryNames, ['current', 'new', 'repeat']);
    assert.deepEqual(byPath.get('/api/Challenges/').queryNames, ['key']);
    assert.deepEqual(byPath.get('/rest/continue-code').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/languages').methods, ['get']);
  });

  test('JS-3: template path params become descriptors — basket ${e}, snippets/fixes ${t}', () => {
    const { targets, pathParams } = extractJsRoutes(JUICE_BUNDLE, 'http://example.com/');
    const basket = targets.find((t) => t.includes('/rest/basket/'));
    assert.ok(basket, 'basket target must exist');
    assert.deepEqual(pathParams[basket], [{ name: 'e', segment: 3 }]);
    assert.match(basket, /\/rest\/basket\/dmprobe\d+_[0-9a-f]+\?e=dmprobe/);
    const fix = targets.find((t) => t.includes('/snippets/fixes/'));
    assert.ok(fix, 'snippets/fixes target must exist');
    assert.deepEqual(pathParams[fix], [{ name: 't', segment: 3 }]);
    assert.match(fix, /\/snippets\/fixes\/dmprobe\d+_[0-9a-f]+\?t=dmprobe/);
  });

  test('JS-4: service bases resolve via this.host — bare GET, GET /, GET /suffix, hostServer+literal', () => {
    const { targets } = extractJsRoutes(JUICE_BUNDLE, 'http://example.com/');
    for (const want of [
      '/api/Products',
      '/rest/captcha/',
      '/rest/admin/application-version',
      '/rest/chatbot/status',
      '/rest/user/whoami',
    ]) {
      assert.ok(
        targets.some((t) => new URL(t).pathname === want),
        `expected mined target ${want}`
      );
    }
  });

  test('JS-5: POST-only routes excluded, mixed GET+POST included', () => {
    const { targets } = extractJsRoutes(JUICE_BUNDLE, 'http://example.com/');
    const paths = targets.map((t) => new URL(t).pathname);
    for (const banned of [
      '/rest/user/login',
      '/rest/user/reset-password',
      '/rest/2fa/verify',
    ]) {
      assert.ok(!paths.some((p) => p === banned), `${banned} must never become a target`);
    }
    assert.ok(!paths.some((p) => p.includes('/checkout')), 'basket checkout must never become a target');
    assert.ok(!paths.some((p) => p.includes('/coupon/')), 'basket coupon must never become a target');
    assert.ok(paths.includes('/rest/deluxe-membership'), 'mixed GET+POST deluxe-membership must be included');
  });

  test('JS-6: no-routes bundle and bad input yield zero targets, never a throw', () => {
    assert.deepEqual(extractJsRoutes('var x = 1; console.log("hi");', 'http://example.com/').targets, []);
    assert.deepEqual(extractJsRoutes('', 'http://example.com/').targets, []);
    assert.deepEqual(extractJsRoutes(null, 'http://example.com/').targets, []);
    assert.deepEqual(extractJsRoutes(JUICE_BUNDLE, 'not a url').targets, []);
    assert.deepEqual(extractJsRouteRecords(''), []);
    assert.deepEqual(extractJsRouteRecords(null), []);
  });

  test('JS-7: cap 20 with param-bearing routes first', () => {
    const lines = [];
    for (let i = 0; i < 25; i++) lines.push(`this.http.get("/rest/item${i}?q="+v);`);
    for (let i = 0; i < 5; i++) lines.push(`this.http.get("/rest/plain${i}");`);
    const bundle = lines.join('\n');
    const { targets } = extractJsRoutes(bundle, 'http://example.com/');
    assert.equal(targets.length, JS_ROUTES_MAX_TARGETS);
    assert.ok(
      targets.every((t) => new URL(t).searchParams.has('q')),
      'all 20 capped targets must be param-bearing'
    );
  });
});

describe('extractJsRouteRecords (template-literal host calls)', () => {
  test('JS-10: hostServer template mines search with q — plus languages and dotted-alias 2fa', () => {
    const recs = extractJsRouteRecords(JUICE_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    assert.deepEqual(byPath.get('/rest/products/search').queryNames, ['q']);
    assert.deepEqual(byPath.get('/rest/products/search').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/languages').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/languages').queryNames, []);
    assert.deepEqual(byPath.get('/rest/2fa/status').methods, ['get']);
    const { targets } = extractJsRoutes(JUICE_BUNDLE, 'http://example.com/');
    assert.ok(targets.some((t) => t.includes('/rest/products/search?q=dmprobe')));
  });

  test('JS-11: host-template suffix resolves via nearest base — Products /${e} + ?d=', () => {
    const recs = extractJsRouteRecords(JUICE_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    const one = byPath.get('/api/Products/${e}');
    assert.ok(one, 'Products /${e} record must exist');
    assert.deepEqual(one.methods, ['get']);
    assert.deepEqual(one.queryNames, ['d']);
    assert.deepEqual(one.pathDescriptors, [{ name: 'e', segment: 3 }]);
    const { targets, pathParams } = extractJsRoutes(JUICE_BUNDLE, 'http://example.com/');
    const t = targets.find((x) => x.includes('/api/Products/dmprobe'));
    assert.ok(t, 'Products /:id target must exist');
    assert.deepEqual(pathParams[t], [{ name: 'e', segment: 3 }]);
    assert.match(t, /\/api\/Products\/dmprobe\d+_[0-9a-f]+\?d=dmprobe\d+_[0-9a-f]+&e=dmprobe\d+_[0-9a-f]+/);
  });

  test('JS-12: display-only template contributes no method/param evidence; .concat form still mined', () => {
    const recs = extractJsRouteRecords(JUICE_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    const display = byPath.get('/rest/display-only');
    assert.ok(display, 'orphan literal still records the path (pre-existing rule)');
    assert.deepEqual(display.methods, []);
    assert.deepEqual(display.queryNames, []);
    const { targets } = extractJsRoutes(JUICE_BUNDLE, 'http://example.com/');
    const dt = targets.find((x) => x.includes('/rest/display-only'));
    assert.ok(!dt || !new URL(dt).searchParams.has('q'), 'display-only target must carry no q param');
    assert.deepEqual(byPath.get('/rest/concat-case').queryNames, ['q']);
    assert.deepEqual(byPath.get('/rest/concat-case').methods, ['get']);
  });
});

describe('extractJsRouteRecords (hostServer+literal, re-proof fix)', () => {
  test('JS-16: real main.js forms — hostServer+literal login/whoami get methods; login is a write target, whoami a GET target', () => {
    const recs = extractJsRouteRecords(REAL_JUICE_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    assert.deepEqual(byPath.get('/rest/user/login').methods, ['post']);
    assert.deepEqual(byPath.get('/rest/user/whoami').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/2fa/status').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/basket/${e}').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/basket/${e}').pathDescriptors, [{ name: 'e', segment: 3 }]);
    const { targets, writeTargets } = extractJsRoutes(REAL_JUICE_BUNDLE, 'http://example.com/');
    assert.ok(writeTargets.includes('http://example.com/rest/user/login'), 'login must be a write target');
    assert.ok(targets.some((t) => new URL(t).pathname === '/rest/user/whoami'), 'whoami must be a GET target');
    assert.ok(targets.some((t) => new URL(t).pathname === '/rest/2fa/status'), '2fa/status must be a GET target');
    assert.ok(!targets.some((t) => t.includes('/rest/user/login')), 'login must never be a GET target');
  });

  test('JS-17: cap race — login/check routes survive the 20-cap against param-bearing routes', () => {
    const lines = [];
    for (let i = 0; i < 25; i++) lines.push(`this.http.get("/rest/item${i}?q="+v);`);
    for (let i = 0; i < 25; i++) lines.push(`this.http.post("/rest/w${i}",{});`);
    lines.push('this.http.post(this.hostServer+"/rest/user/login",t);');
    lines.push('this.http.get(this.hostServer+"/rest/user/whoami");');
    lines.push('this.http.get(`${I.c.hostServer}/rest/2fa/status`);');
    const bundle = lines.join('\n');
    const { targets, writeTargets } = extractJsRoutes(bundle, 'http://example.com/');
    assert.equal(targets.length, JS_ROUTES_MAX_TARGETS);
    assert.ok(targets.some((t) => new URL(t).pathname === '/rest/user/whoami'), 'whoami must survive the GET cap');
    assert.ok(targets.some((t) => new URL(t).pathname === '/rest/2fa/status'), '2fa/status must survive the GET cap');
    assert.equal(writeTargets.length, JS_ROUTES_MAX_TARGETS);
    assert.ok(writeTargets.includes('http://example.com/rest/user/login'), 'login must survive the write cap');
  });
});

describe('synthesiseJsWriteTargets (D3, #474 repair)', () => {
  test('JS-13: POST-only routes become write targets; GET, mixed and orphan routes never do', () => {
    const recs = extractJsRouteRecords(JUICE_BUNDLE);
    const write = synthesiseJsWriteTargets(recs, 'http://example.com/');
    const paths = write.map((t) => new URL(t).pathname);
    for (const want of [
      '/rest/user/login',
      '/rest/user/reset-password',
      '/rest/2fa/verify',
      '/rest/chatbot/respond',
      // The concat-form checkout + coupon share the '/rest/basket/'
      // literal record (methods post+put) — one write target, no
      // templated path (the miner cannot resolve concat suffixes).
      '/rest/basket/',
    ]) {
      assert.ok(paths.includes(want), `expected write target ${want}`);
    }
    for (const banned of [
      '/rest/user/whoami',
      '/rest/products/search',
      '/rest/deluxe-membership', // mixed GET+POST: a GET target, never write-only
      '/rest/display-only', // orphan: no method evidence
      '/api/Products',
      '/rest/basket/dmprobe', // the GET basket record is a GET target, not a write target
    ]) {
      assert.ok(!paths.some((p) => p === banned || p.startsWith(`${banned}/`)), `${banned} must never be a write target`);
    }
    assert.ok(write.every((t) => t.startsWith('http://example.com/')), 'same origin only');
    assert.ok(!write.some((t) => t.includes('${') || t.includes('/:'), 'no literal-brace URLs'));
    assert.deepEqual(synthesiseJsWriteTargets([], 'http://example.com/'), []);
    assert.deepEqual(synthesiseJsWriteTargets(null, 'not a url'), []);
  });
});

describe('discoverJsRoutes (stubbed fetchPage)', () => {
  test('JS-8: shell + bundles merged, cross-origin bundle never fetched, fetch failure is an honest no-op', async () => {
    const fetchPage = stubFetchFor(JUICE_SHELL, {
      'runtime.js': 'var r = 1;',
      'polyfills.js': 'var p = 1;',
      'vendor.js': 'var v = 1;',
      'main.js': JUICE_BUNDLE,
    });
    const found = await discoverJsRoutes('http://example.com/', { fetchPage });
    assert.equal(found.routesFound, true);
    assert.equal(found.bundlesFetched, 4);
    assert.ok(found.targets.length >= 10, `expected >=10 targets, got ${found.targets.length}`);
    assert.ok(found.targets.some((t) => t.includes('/rest/products/search?q=dmprobe')));
    assert.ok(found.targets.some((t) => t.includes('/rest/basket/dmprobe')));
    assert.ok(!found.targets.some((t) => t.includes('/rest/user/login')));

    const failing = async () => {
      throw new Error('boom');
    };
    const missed = await discoverJsRoutes('http://example.com/', { fetchPage: failing });
    assert.equal(missed.routesFound, false);
    assert.deepEqual(missed.targets, []);
    assert.ok(missed.errors.length > 0);

    const noScripts = await discoverJsRoutes('http://example.com/', {
      fetchPage: stubFetchFor('<html><body>no scripts</body></html>', {}),
    });
    assert.equal(noScripts.routesFound, false);
    assert.deepEqual(noScripts.targets, []);
    assert.equal(await discoverJsRoutes('not a url', { fetchPage }).then((r) => r.routesFound), false);
  });

  test('JS-14: discoverJsRoutes also returns POST-only writeTargets; GET targets still exclude them', async () => {
    const fetchPage = stubFetchFor(JUICE_SHELL, {
      'runtime.js': 'var r = 1;',
      'polyfills.js': 'var p = 1;',
      'vendor.js': 'var v = 1;',
      'main.js': JUICE_BUNDLE,
    });
    const found = await discoverJsRoutes('http://example.com/', { fetchPage });
    assert.ok(found.writeTargets.some((t) => t === 'http://example.com/rest/user/login'), 'login must be a write target');
    assert.ok(found.writeTargets.some((t) => t === 'http://example.com/rest/user/reset-password'), 'reset-password must be a write target');
    assert.ok(!found.targets.some((t) => t.includes('/rest/user/login')), 'login must never be a GET target');
    assert.ok(!found.targets.some((t) => t.includes('/rest/user/reset-password')), 'reset-password must never be a GET target');

    const failing = async () => {
      throw new Error('boom');
    };
    const missed = await discoverJsRoutes('http://example.com/', { fetchPage: failing });
    assert.deepEqual(missed.writeTargets, []);
  });
});

describe('runScan integration (stub server)', () => {
  test('JS-9: Juice-shaped stub unlocks the battery in runScan — 0 skipped, mined targets probed', async () => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: raw });
        if (req.url === '/main.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(JUICE_BUNDLE);
          return;
        }
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(JUICE_SHELL);
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        { target, confirmedAuthorized: true, phases: ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', 'js-api-routes', ...PARAM_BATTERY_PHASES, 'headers'] },
        { timeoutMs: 5000, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const jsPhase = result.phases.find((p) => p.name === 'js-api-routes');
      assert.ok(jsPhase && jsPhase.ok, 'js-api-routes phase must record ok');
      assert.ok(jsPhase.jsRouteTargets >= 10, `expected >=10 mined targets, got ${jsPhase.jsRouteTargets}`);
      assert.equal(jsPhase.jsBundles, 4, 'shell lists 4 same-origin bundles');
      const openApiPhase = result.phases.find((p) => p.name === 'openapi-targets');
      assert.ok(openApiPhase && openApiPhase.ok, 'openapi-targets phase must record ok');
      assert.equal(openApiPhase.openApiTargets, 0, 'no spec at the stub, openapi must find 0');
      assert.equal(result.phases.filter((p) => p.skipped).length, 0);
      const rollup = buildPhaseRollup(result.phases);
      assert.equal(rollup.skipped, 0);
      assert.equal(rollup.failed, 0);
      assert.ok(calls.some((c) => c.url === '/main.js'), 'bundle must be fetched');
      assert.ok(
        calls.filter((c) => c.url === '/main.js').every((c) => c.method === 'GET'),
        'bundle fetch must be GET-only'
      );
      // NOTE: the battery's own probes POST by design on some targets
      // (e.g. the HPP probe POSTs a polluted body) — that is
      // pre-existing probe behaviour, not this lane's doing. The
      // mining fetches themselves are GET-only, asserted above.
      assert.ok(
        calls.some((c) => /\/rest\/products\/search\?q=dmprobe/.test(c.url)),
        'expected a GET probe of the mined search target'
      );
      assert.ok(
        calls.some((c) => /\/rest\/basket\/dmprobe\d+_[0-9a-f]+\?e=dmprobe/.test(c.url)),
        'expected a GET probe of the mined basket segment target'
      );
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

describe('runScan integration — D3 write targets (T4b end to end)', () => {
  test('JS-15: POST-only /rest/user/login mined as a write target feeds T4b in runScan — login POST-only, T4b fires', async () => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: raw });
        if (req.url === '/main.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(JUICE_BUNDLE);
          return;
        }
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(JUICE_SHELL);
          return;
        }
        if (req.method === 'POST' && req.url === '/rest/user/login') {
          let body = {};
          try { body = JSON.parse(raw); } catch { /* non-JSON login body */ }
          if (!body.email && !body.username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'email or username required' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authentication: { token: D3_TOKEN, bid: 1, umail: D3_JUICE_USER } }));
          return;
        }
        if (req.method === 'GET' && req.url === '/rest/user/whoami') {
          if (req.headers.authorization !== `Bearer ${D3_TOKEN}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Unauthorized' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ user: { id: 1, email: D3_JUICE_USER, role: 'admin' } }));
          return;
        }
        if (req.method === 'GET' && ['/logout', '/logout.php', '/signout', '/auth/logout'].includes(req.url)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        {
          target,
          confirmedAuthorized: true,
          labTargets: '127.0.0.1',
          phases: ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', 'js-api-routes', 'session-fixation'],
        },
        {
          timeoutMs: 5000,
          labCreds: { username: D3_JUICE_USER, password: D3_JUICE_PASS },
        }
      );
      const jsPhase = result.phases.find((p) => p.name === 'js-api-routes');
      assert.ok(jsPhase && jsPhase.ok, 'js-api-routes phase must record ok');
      assert.ok(jsPhase.jsWriteTargets >= 1, `expected >=1 write target, got ${jsPhase.jsWriteTargets}`);
      const sfPhase = result.phases.find((p) => p.name === 'session-fixation');
      assert.ok(sfPhase && sfPhase.ok, 'session-fixation phase must record ok');
      assert.equal(sfPhase.findingsCount, 1, 'session-fixation must record exactly 1 finding');
      const t4b = result.findings.find((f) => f.title === 'Session lifecycle — bearer token remains valid after logout (MEDIUM)');
      assert.ok(t4b, `T4b finding must be confirmed end to end; got: ${result.findings.map((f) => f.title).join(' | ')}`);
      assert.equal(t4b.class, 'session_fixation');
      assert.equal(t4b.confirmation, 'confirmed');
      // The GET-only mining contract still holds: the login route was
      // reached ONLY by the T4b POST, never by a GET probe.
      const loginCalls = calls.filter((c) => c.url === '/rest/user/login');
      assert.ok(loginCalls.length >= 1, 'T4b must POST the login route');
      assert.ok(loginCalls.every((c) => c.method === 'POST'), 'login must never be GET-probed');
      assert.ok(calls.some((c) => c.method === 'GET' && c.url === '/rest/user/whoami'), 'whoami check must be reached');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

describe('runScan integration — re-proof T4b end to end (live Juice pair)', () => {
  test('JS-18: real hostServer forms + dead whoami + live 2fa/status — T4b fires exactly once via /rest/2fa/status', async () => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
      });
      req.on('end', () => {
        calls.push({ method: req.method, url: req.url, body: raw });
        if (req.url === '/main.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(REAL_JUICE_BUNDLE);
          return;
        }
        if (req.url === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(JUICE_SHELL);
          return;
        }
        if (req.method === 'POST' && req.url === '/rest/user/login') {
          let body = {};
          try { body = JSON.parse(raw); } catch { /* non-JSON login body */ }
          if (!body.email && !body.username) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'email or username required' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ authentication: { token: D3_TOKEN, bid: 1, umail: D3_JUICE_USER } }));
          return;
        }
        if (req.method === 'GET' && req.url === '/rest/user/whoami') {
          // Live-faithful dead oracle: identical 200 {"user":{}} with
          // and without a token — must never fire T4b on its own.
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ user: {} }));
          return;
        }
        if (req.method === 'GET' && req.url === '/rest/2fa/status') {
          if (req.headers.authorization !== `Bearer ${D3_TOKEN}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Unauthorized' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ setup: false, email: D3_JUICE_USER }));
          return;
        }
        if (req.method === 'GET' && req.url.startsWith('/rest/basket/')) {
          if (req.headers.authorization !== `Bearer ${D3_TOKEN}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Unauthorized' }));
            return;
          }
          // The mined dmprobe basket is not the canary's basket.
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Not found' }));
          return;
        }
        if (req.method === 'GET' && ['/logout', '/logout.php', '/signout', '/auth/logout'].includes(req.url)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
    });
    const stub = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const result = await runScan(
        {
          target,
          confirmedAuthorized: true,
          labTargets: '127.0.0.1',
          phases: ['fingerprint', 'crawl', 'page-analyze', 'openapi-targets', 'js-api-routes', 'session-fixation'],
        },
        {
          timeoutMs: 5000,
          labCreds: { username: D3_JUICE_USER, password: D3_JUICE_PASS },
        }
      );
      const jsPhase = result.phases.find((p) => p.name === 'js-api-routes');
      assert.ok(jsPhase && jsPhase.ok, 'js-api-routes phase must record ok');
      assert.ok(jsPhase.jsWriteTargets >= 1, `expected >=1 write target, got ${jsPhase.jsWriteTargets}`);
      const sfPhase = result.phases.find((p) => p.name === 'session-fixation');
      assert.ok(sfPhase && sfPhase.ok, 'session-fixation phase must record ok');
      assert.equal(sfPhase.findingsCount, 1, 'session-fixation must record exactly 1 finding');
      const t4b = result.findings.find((f) => f.title === 'Session lifecycle — bearer token remains valid after logout (MEDIUM)');
      assert.ok(t4b, `T4b finding must be confirmed end to end; got: ${result.findings.map((f) => f.title).join(' | ')}`);
      assert.equal(t4b.class, 'session_fixation');
      assert.equal(t4b.confirmation, 'confirmed');
      assert.ok(t4b.url.endsWith('/rest/2fa/status'), `T4b must fire on the 2fa/status check, got ${t4b.url}`);
      // The GET-only mining contract still holds: the login route was
      // reached ONLY by the T4b POST, never by a GET probe.
      const loginCalls = calls.filter((c) => c.url === '/rest/user/login');
      assert.ok(loginCalls.length >= 1, 'T4b must POST the login route');
      assert.ok(loginCalls.every((c) => c.method === 'POST'), 'login must never be GET-probed');
      // The dead whoami oracle was tried (a candidate) and skipped;
      // the 2fa/status check was probed twice: no-token, then replay.
      assert.ok(calls.some((c) => c.method === 'GET' && c.url === '/rest/user/whoami'), 'whoami candidate must be tried');
      assert.equal(
        calls.filter((c) => c.method === 'GET' && c.url === '/rest/2fa/status').length,
        2, '2fa/status must be probed without a token and with the old token'
      );
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

// Template/variable service bases + interpolation-named query params
// (miner extension, 8 Nov 2026). TEMPLATE_BASE_BUNDLE models the
// new base forms: backtick base literal, template base with
// ${this.hostServer}, template base with ${this.host} on an earlier
// base, variable base (ident + literal), bare variable base.
// INTERP_PARAM_BUNDLE models interpolation-named query params
// resolved from single-assignment literals, plus unbound names that
// must stay unmined. BINDING_DISCIPLINE_BUNDLE models assignments
// that must NEVER bind (reassigned, concatenated, interpolated).
const TEMPLATE_BASE_BUNDLE = `
const API_BASE = "/rest";
const API2 = "/rest/direct";
let G = (() => { class n { http; hostServer = et.c.hostServer;
  host = this.hostServer + \`/rest/tpl\`;
  constructor(e) { this.http = e; }
  status() { return this.http.get(this.host + "/status"); }
} })();
let H = (() => { class n { http; hostServer = et.c.hostServer;
  host = \`\${this.hostServer}/rest/tplhost\`;
  constructor(e) { this.http = e; }
  ping() { return this.http.get(this.host + "/ping"); }
} })();
let I = (() => { class n { http; hostServer = et.c.hostServer;
  host = API_BASE + "/varbase";
  constructor(e) { this.http = e; }
  go() { return this.http.get(this.host); }
} })();
let J = (() => { class n { http; hostServer = et.c.hostServer;
  host = API2;
  constructor(e) { this.http = e; }
  go() { return this.http.get(this.host + "/go"); }
} })();
let K = (() => { class n { http; hostServer = et.c.hostServer;
  host = this.hostServer + "/rest/parent";
  constructor(e) { this.http = e; }
  child() { return this.http.get(\`\${this.host}/child\`); }
} })();
`;

const INTERP_PARAM_BUNDLE = `
const q = "query";
const qs = "page=1&size=10";
const qn = "term";
let L = (() => { class n { http; constructor(e) { this.http = e; }
  search(v) { return this.http.get(\`/rest/search?\${q}=\${v}\`); }
  list() { return this.http.get(\`/rest/list?\${qs}\`); }
  concatCase(v) { return this.http.get("/rest/concat?\${qn}=" + v); }
  skip(v) { return this.http.get(\`/rest/skip?\${unknown}=\${v}\`); }
  skipBare() { return this.http.get(\`/rest/skip-bare?\${unknown}\`); }
} })();
`;

const BINDING_DISCIPLINE_BUNDLE = `
let q = "first";
q = "second";
let r = "a" + "b";
let s = \`pre\${x}\`;
let M = (() => { class n { http; constructor(e) { this.http = e; }
  a(v) { return this.http.get(\`/rest/a?\${q}=\${v}\`); }
  b(v) { return this.http.get(\`/rest/b?\${r}=\${v}\`); }
  c(v) { return this.http.get(\`/rest/c?\${s}=\${v}\`); }
} })();
`;

describe('extractJsRouteRecords (template/variable service bases)', () => {
  test('JS-19: backtick base, template base, variable base, bare variable base all resolve; this.host suffix calls follow', () => {
    const recs = extractJsRouteRecords(TEMPLATE_BASE_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    for (const base of ['/rest/tpl', '/rest/tplhost', '/rest/varbase', '/rest/direct', '/rest/parent']) {
      assert.ok(byPath.has(base), `base record ${base} must exist`);
    }
    assert.deepEqual(byPath.get('/rest/tpl/status').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/tplhost/ping').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/varbase').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/direct/go').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/parent/child').methods, ['get']);
    const { targets } = extractJsRoutes(TEMPLATE_BASE_BUNDLE, 'http://example.com/');
    for (const want of ['/rest/tpl/status', '/rest/tplhost/ping', '/rest/varbase', '/rest/direct/go', '/rest/parent/child']) {
      assert.ok(targets.some((t) => new URL(t).pathname === want), `expected mined target ${want}`);
    }
  });
});

describe('extractJsRouteRecords (interpolation-named query params)', () => {
  test('JS-20: ?${name}=v resolves a bound name, ?${qs} parses a bound query string, unbound names stay unmined', () => {
    const recs = extractJsRouteRecords(INTERP_PARAM_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    assert.deepEqual(byPath.get('/rest/search').queryNames, ['query']);
    assert.deepEqual(byPath.get('/rest/search').methods, ['get']);
    assert.deepEqual(byPath.get('/rest/list').queryNames, ['page', 'size']);
    assert.deepEqual(byPath.get('/rest/concat').queryNames, ['term']);
    assert.deepEqual(byPath.get('/rest/skip').queryNames, []);
    assert.deepEqual(byPath.get('/rest/skip-bare').queryNames, []);
    const { targets } = extractJsRoutes(INTERP_PARAM_BUNDLE, 'http://example.com/');
    assert.ok(targets.some((t) => /\/rest\/search\?query=dmprobe/.test(t)), 'search target must carry the resolved query name');
    assert.ok(
      targets.some((t) => /\/rest\/list\?page=dmprobe/.test(t) && t.includes('size=dmprobe')),
      'list target must carry both parsed query names'
    );
    assert.ok(targets.some((t) => /\/rest\/concat\?term=dmprobe/.test(t)), 'concat target must carry the resolved term name');
  });

  test('JS-21: bindings discipline — reassigned, concatenated, interpolated assignments never bind', () => {
    const bindings = collectLiteralBindings(BINDING_DISCIPLINE_BUNDLE);
    assert.equal(bindings.has('q'), false, 'reassigned q must not bind');
    assert.equal(bindings.has('r'), false, 'concatenated r must not bind');
    assert.equal(bindings.has('s'), false, 'interpolated s must not bind');
    assert.equal(collectLiteralBindings('const a = "x";').get('a'), 'x');
    assert.equal(collectLiteralBindings('let a = "x"; a = "y";').size, 0);
    assert.equal(collectLiteralBindings('').size, 0);
    assert.equal(collectLiteralBindings(null).size, 0);
    const recs = extractJsRouteRecords(BINDING_DISCIPLINE_BUNDLE);
    const byPath = new Map(recs.map((r) => [r.path, r]));
    assert.deepEqual(byPath.get('/rest/a').queryNames, []);
    assert.deepEqual(byPath.get('/rest/b').queryNames, []);
    assert.deepEqual(byPath.get('/rest/c').queryNames, []);
  });
});

describe('discoverJsRoutes (miner extension end to end)', () => {
  test('JS-22: template bases + interpolation params mine end to end through discoverJsRoutes', async () => {
    const fetchPage = stubFetchFor(JUICE_SHELL, {
      'runtime.js': 'var r = 1;',
      'polyfills.js': 'var p = 1;',
      'vendor.js': 'var v = 1;',
      'main.js': TEMPLATE_BASE_BUNDLE,
    });
    const found = await discoverJsRoutes('http://example.com/', { fetchPage });
    assert.equal(found.routesFound, true);
    assert.equal(found.bundlesFetched, 4);
    for (const want of ['/rest/tpl/status', '/rest/tplhost/ping', '/rest/varbase', '/rest/direct/go', '/rest/parent/child']) {
      assert.ok(found.targets.some((t) => new URL(t).pathname === want), `expected mined target ${want}`);
    }
    const found2 = await discoverJsRoutes('http://example.com/', {
      fetchPage: stubFetchFor(JUICE_SHELL, {
        'runtime.js': 'var r = 1;',
        'polyfills.js': 'var p = 1;',
        'vendor.js': 'var v = 1;',
        'main.js': INTERP_PARAM_BUNDLE,
      }),
    });
    assert.equal(found2.routesFound, true);
    assert.ok(found2.targets.some((t) => /\/rest\/search\?query=dmprobe/.test(t)));
    assert.ok(found2.targets.some((t) => /\/rest\/list\?page=dmprobe/.test(t)));
  });
});
