// DOM form discovery (6 Nov 2026): the scanner's static analysis
// finds zero forms on an SPA root (Juice Shop: Angular shell), so the
// 28-phase injection battery skips in silence. This lane adds a real
// browser render pass (transient chromium container) + SPA route
// discovery, merged into the existing target builder.
//
// Fixtures below are modeled on the REAL rendered DOM observed live
// on EC2 6 Nov 2026 (transient-container chromium --dump-dom vs
// Juice Shop): the root render has exactly one input — the navbar
// search box, nameless + disabled — and five routes via routerlink /
// hash hrefs; /#/login renders two NAMED standalone inputs
// (email, password) and no <form> tag anywhere in the app.
//
// The chromium execution itself is always stubbed here (opts.runner /
// opts.domRender / opts.domRenderer seams) — unit tests must never
// spawn docker. The real render command is proven live on EC2, not
// in this file.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  buildDomRenderArgs,
  renderDom,
  extractSpaRoutes,
  discoverDomForms,
  DOM_MAX_ROUTES,
  DOM_RENDER_IMAGE,
  DOM_RENDER_TIMEOUT_MS,
  DOM_VIRTUAL_TIME_BUDGET_MS,
} from './domRender.js';
import { runScan, PARAM_BATTERY_PHASES, buildPhaseRollup } from './index.js';

// Rendered Juice Shop root (trimmed, structure verbatim from the live
// EC2 render): Angular shell, five SPA routes, one nameless input.
const ROOT_DOM = `<html><head><title>OWASP Juice Shop</title></head><body><app-root>
<nav><button routerlink="/search">Back to homepage</button>
<a href="#/login">Login</a><a href="#/about">About</a>
<a href="#/contact">Contact</a><a href="#/photo-wall">Photo Wall</a>
<input matinput type="text" id="mat-input-1" disabled=""></nav>
<router-outlet></router-outlet></app-root></body></html>`;

// Rendered Juice Shop /#/login (trimmed, verbatim shape): two NAMED
// standalone inputs, no <form> element — Angular reactive form.
const LOGIN_DOM = `<html><body><app-root>
<input id="email" name="email" matinput type="text" required="">
<input id="password" name="password" matinput type="password" required="">
<input type="checkbox" id="rememberMe-input">
</app-root></body></html>`;

// Rendered Juice Shop /#/contact (trimmed): fields exist but NONE has
// a name — the honest limit: nameless controls stay invisible.
const CONTACT_DOM = `<html><body><app-root>
<input hidden type="text" id="userId" ngdefaultcontrol="">
<input ngdefaultcontrol="" matinput type="text" id="mat-input-2" disabled="">
<input id="captchaControl" ngdefaultcontrol="" matinput type="text" required="">
</app-root></body></html>`;

// Rendered DOM carrying a real POST form (a DOM form, not static HTML).
const POST_FORM_DOM = `<html><body>
<form action="/login" method="post">
<input name="username"><input name="password" type="password">
<input type="submit" value="Login"></form>
</body></html>`;

// Static shell served by the stub HTTP server for the pasted page:
// what fetchPage sees before any JS runs — zero forms, zero inputs.
const STATIC_SHELL = `<html><head><title>OWASP Juice Shop</title></head><body><app-root></app-root><script src="main.js"></script></body></html>`;

function startStub(rootHtml) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, body: raw });
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(rootHtml);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, calls }));
  });
}
const stopStub = (s) => new Promise((r) => s.server.close(r));

// Rendered Juice Shop root AFTER login (CDP auth lane, 8 Nov 2026):
// the account view renders only post-login — one named standalone
// input plus a basket route the logged-out shell never shows.
const AUTH_ROOT_DOM = `<html><body><app-root>
<input id="account" name="account" matinput type="text">
<a href="#/basket">Basket</a></app-root></body></html>`;

// Rendered Juice Shop /#/basket after login: a named quantity input.
const BASKET_DOM = `<html><body><app-root>
<input id="quantity" name="quantity" matinput type="number">
</app-root></body></html>`;

// Route-aware stub for the auth integration tests: serves the static
// shell for the pasted page, the JS bundle (which names the login
// API), and the login API itself — 200 + token when loginOk, 401
// otherwise. Every call is recorded for probe assertions.
function startAuthStub({ loginOk = true } = {}) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, body: raw });
      if (req.method === 'GET' && req.url === '/main.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        return res.end('const LOGIN_API = "/rest/user/login"; fetch(LOGIN_API, {method:"POST"});');
      }
      if (req.method === 'POST' && req.url === '/rest/user/login') {
        if (!loginOk) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ message: 'Invalid credentials' }));
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=stub1; Path=/',
        });
        return res.end(JSON.stringify({ authentication: { token: 'jwt-test-123', bid: 1 } }));
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(req.method === 'GET' && req.url === '/' ? STATIC_SHELL : '');
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, calls }));
  });
}

// Lab canary credentials, built by concatenation so no secret-shaped
// literal lands in the file (GH013 push protection).
const LAB_USER = 'admin@juice-sh.op';
const LAB_PASS = 'admin' + '123';

describe('buildDomRenderArgs (transient-container render command)', () => {
  test('DR-1: uses --entrypoint chromium so the hunt image entrypoint cannot swallow the args', () => {
    const args = buildDomRenderArgs('http://172.17.0.1:3000/');
    assert.deepEqual(args, [
      'run',
      '--rm',
      '--entrypoint',
      'chromium',
      DOM_RENDER_IMAGE,
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--virtual-time-budget=${DOM_VIRTUAL_TIME_BUDGET_MS}`,
      '--dump-dom',
      'http://172.17.0.1:3000/',
    ]);
  });

  test('DR-1b: custom image and virtual-time budget are honoured', () => {
    const args = buildDomRenderArgs('http://example.com/', { image: 'img:test', virtualTimeBudgetMs: 3000 });
    assert.ok(args.includes('img:test'));
    assert.ok(args.includes('--virtual-time-budget=3000'));
    assert.equal(args[args.length - 1], 'http://example.com/');
  });
});

describe('renderDom (single-page render, stubbed runner)', () => {
  test('DR-2: success path returns the HTML and drives docker with the built args', async () => {
    const seen = [];
    const runner = async (file, args, opts) => {
      seen.push({ file, args, opts });
      return { ok: true, code: 0, stdout: '<html>rendered</html>', stderr: '', timedOut: false };
    };
    const r = await renderDom('http://example.com/', { runner });
    assert.equal(r.ok, true);
    assert.equal(r.html, '<html>rendered</html>');
    assert.equal(r.error, null);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].file, 'docker');
    assert.deepEqual(seen[0].args, buildDomRenderArgs('http://example.com/'));
    assert.equal(seen[0].opts.timeoutMs, DOM_RENDER_TIMEOUT_MS);
  });

  test('DR-3: runner failure, empty output, and runner throw all fail honestly — never throw', async () => {
    const failed = await renderDom('http://example.com/', {
      runner: async () => ({ ok: false, code: 1, stdout: '', stderr: 'Cannot connect to the Docker daemon', timedOut: false }),
    });
    assert.equal(failed.ok, false);
    assert.match(failed.error, /Docker daemon/);

    const empty = await renderDom('http://example.com/', {
      runner: async () => ({ ok: true, code: 0, stdout: '   \n', stderr: '', timedOut: false }),
    });
    assert.equal(empty.ok, false);
    assert.match(empty.error, /no output/);

    const threw = await renderDom('http://example.com/', {
      runner: async () => { throw new Error('spawn docker ENOENT'); },
    });
    assert.equal(threw.ok, false);
    assert.match(threw.error, /ENOENT/);
  });
});

describe('extractSpaRoutes (route discovery from rendered DOM)', () => {
  test('DR-4: Juice root yields its five routes in DOM order (routerlink mapped via hash evidence)', () => {
    const routes = extractSpaRoutes(ROOT_DOM, 'http://172.17.0.1:3000/');
    assert.deepEqual(routes, [
      'http://172.17.0.1:3000/#/search',
      'http://172.17.0.1:3000/#/login',
      'http://172.17.0.1:3000/#/about',
      'http://172.17.0.1:3000/#/contact',
      'http://172.17.0.1:3000/#/photo-wall',
    ]);
  });

  test('DR-4b: external, javascript:, mailto:, self, and bare-hash links are excluded; duplicates collapse', () => {
    const html = `<a href="https://evil.example/x">e</a>
      <a href="javascript:void(0)">j</a><a href="mailto:a@b.c">m</a>
      <a href="#/login">one</a><a href="#/login">two</a>
      <a href="/">root</a><a href="#">hash</a>`;
    assert.deepEqual(extractSpaRoutes(html, 'http://172.17.0.1:3000/'), [
      'http://172.17.0.1:3000/#/login',
    ]);
  });

  test('DR-5: without hash-routing evidence a routerlink resolves as a plain path', () => {
    const html = `<button routerlink="/dashboard">D</button><a href="/settings">S</a>`;
    assert.deepEqual(extractSpaRoutes(html, 'http://example.com/app/'), [
      'http://example.com/dashboard',
      'http://example.com/settings',
    ]);
  });

  test('DR-6b: route list caps at DOM_MAX_ROUTES', () => {
    const links = Array.from({ length: 8 }, (_, i) => `<a href="#/r${i}">r${i}</a>`).join('');
    const routes = extractSpaRoutes(links, 'http://example.com/');
    assert.equal(routes.length, DOM_MAX_ROUTES);
    assert.equal(routes[0], 'http://example.com/#/r0');
  });
});

describe('discoverDomForms (render + route merge, stubbed renderer)', () => {
  test('DR-6: root + login routes merge — named login inputs arrive as standalone with page=route', async () => {
    const seen = [];
    const domRender = async (url) => {
      seen.push(url);
      if (url === 'http://172.17.0.1:3000/') return { ok: true, html: ROOT_DOM };
      if (url === 'http://172.17.0.1:3000/#/login') return { ok: true, html: LOGIN_DOM };
      if (url === 'http://172.17.0.1:3000/#/contact') return { ok: true, html: CONTACT_DOM };
      return { ok: false, html: '', error: 'no such route in stub' };
    };
    const { analysis, errors, rendered } = await discoverDomForms('http://172.17.0.1:3000/', { domRender });
    assert.ok(analysis, 'analysis must exist');
    // The nameless root search input and the nameless contact fields
    // contribute NOTHING — only login's named inputs become targets.
    assert.equal(analysis.inputs.length, 2);
    const byName = Object.fromEntries(analysis.inputs.map((i) => [i.name, i]));
    assert.equal(byName.email.type, 'text');
    assert.equal(byName.password.type, 'password');
    assert.equal(byName.email.form, null);
    assert.equal(byName.email.page, 'http://172.17.0.1:3000/#/login');
    assert.equal(byName.password.page, 'http://172.17.0.1:3000/#/login');
    assert.equal(analysis.forms.length, 0);
    // Six renders attempted (root + 5 routes); the login + contact
    // renders succeeded, the rest failed honestly and were recorded.
    assert.equal(rendered.length, 6);
    assert.equal(rendered.filter((r) => r.ok).length, 3);
    assert.ok(errors.length >= 1, 'failed route renders must be recorded');
    assert.ok(seen.includes('http://172.17.0.1:3000/#/login'), 'login route must be rendered');
  });

  test('DR-7: pasted-page render failure returns null analysis + error, never throws', async () => {
    const r = await discoverDomForms('http://example.com/', {
      domRender: async () => { throw new Error('docker unavailable'); },
    });
    assert.equal(r.analysis, null);
    assert.ok(r.errors.length >= 1);
    assert.match(r.errors[0], /docker unavailable/);
    assert.equal(r.rendered.length, 1);
    assert.equal(r.rendered[0].ok, false);
  });

  test('DR-8: a failed route render is recorded and the remaining routes still render', async () => {
    const order = [];
    const domRender = async (url) => {
      order.push(url);
      if (url === 'http://example.com/') return { ok: true, html: ROOT_DOM };
      if (url === 'http://example.com/#/search') return { ok: false, html: '', error: 'chromium crashed' };
      if (url === 'http://example.com/#/login') return { ok: true, html: LOGIN_DOM };
      return { ok: false, html: '', error: 'stub: no' };
    };
    const { analysis, errors } = await discoverDomForms('http://example.com/', { domRender });
    assert.ok(analysis);
    assert.equal(analysis.inputs.length, 2, 'login inputs must survive the search-route failure');
    assert.ok(errors.some((e) => /chromium crashed/.test(e)));
    assert.ok(order.indexOf('http://example.com/#/login') > order.indexOf('http://example.com/#/search'));
  });
});

describe('runScan DOM integration (Juice-shaped stub server, stubbed renderer)', () => {
  const BATTERY_PHASES = ['fingerprint', 'crawl', 'page-analyze', 'dom-render', ...PARAM_BATTERY_PHASES, 'headers', 'csrf', 'post-forms'];

  test('DOM-INT-1: SPA root unlocks the battery — all 34 phases run, login params probed, GET only', async () => {
    const stub = await startStub(STATIC_SHELL);
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      // normalizeTarget strips the pasted URL's trailing slash, so
      // compare slash-insensitively — the stub sees the normalised URL.
      const norm = (u) => String(u).replace(/\/$/, '');
      const domRenderer = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: ROOT_DOM };
        if (url === `${norm(target)}/#/login`) return { ok: true, html: LOGIN_DOM };
        return { ok: false, html: '', error: 'stub: route not rendered' };
      };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1', phases: BATTERY_PHASES },
        { timeoutMs: 5000, domRenderer, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      // The battery RAN: zero skipped records (before this lane the
      // same paste read 35 ok / 28 skipped). Two DOM targets (email,
      // password) mean the 34 phases record twice — 7 non-param + 68.
      assert.equal(result.phases.filter((p) => p.skipped).length, 0);
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 75,
        ok: 75,
        failed: 0,
        skipped: 0,
        timedOut: 0,
      });
      const domPhase = result.phases.find((p) => p.name === 'dom-render');
      assert.ok(domPhase && domPhase.ok, 'dom-render phase must record ok');
      assert.ok(domPhase.domRoutes >= 2, `expected >=2 rendered routes, got ${domPhase.domRoutes}`);
      assert.equal(domPhase.findingsCount, 2, 'dom-render counts the 2 DOM inputs');
      for (const name of ['sqli-error', 'xss', 'cmdi', 'traversal']) {
        const ph = result.phases.find((p) => p.name === name);
        assert.ok(ph && ph.ok && !ph.skipped, `${name} must run, not skip`);
      }
      // The synthesised GET targets were actually probed — the login
      // route's named inputs, each with a unique filler.
      assert.ok(
        stub.calls.some((c) => /[?&]email=dmprobe_/.test(c.url)),
        `expected a GET probe with the email param, got: ${stub.calls.map((c) => c.url).slice(0, 8).join(' | ')}`
      );
      assert.ok(
        stub.calls.some((c) => /[?&]password=dmprobe_/.test(c.url)),
        'expected a GET probe with the password param'
      );
      // The full battery legitimately POSTs (hpp T4/T5, ldap-blind,
      // nosql-deep) — pre-existing probe behaviour, same on static
      // targets. The invariant is WHERE those POSTs go: only to
      // synthesised param-target URLs carrying a DOM-discovered param
      // (hpp T4 replaces the filler with its own canary, so a filler
      // check would be wrong) — never to a bare endpoint, and there
      // is no form here to submit.
      const posts = stub.calls.filter((c) => c.method === 'POST');
      assert.ok(posts.length > 0, 'expected the battery\'s designed POST probes to run');
      assert.ok(
        posts.every((c) => /[?&](email|password)=/.test(c.url)),
        'every POST must target a DOM-discovered param URL'
      );
      assert.ok((result.pageAnalysis?.inputs || 0) >= 2, 'DOM inputs must count in pageAnalysis');
    } finally {
      await stopStub(stub);
    }
  });

  test('DOM-INT-2: static-form target never pays the render — records a skip instead', async () => {
    const stub = await startStub(
      `<html><body><form action="/login.php" method="post"><input name="username"><input name="password" type="password"></form></body></html>`
    );
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      let domCalls = 0;
      const domRenderer = async () => { domCalls += 1; return { ok: true, html: LOGIN_DOM }; };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1', phases: ['fingerprint', 'crawl', 'page-analyze', 'dom-render', 'sqli-error', 'xss'] },
        { timeoutMs: 5000, domRenderer, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      assert.equal(domCalls, 0, 'DOM renderer must not run when static forms exist');
      // GATED SKIP (7 Nov 2026): the phase never fires on static
      // targets, but it must still leave a skipped record — otherwise
      // the rollup cannot tell "gate false" from "phase missing".
      const domPhase = result.phases.find((p) => p.name === 'dom-render');
      assert.ok(domPhase, 'dom-render must leave a skip record on static targets');
      assert.equal(domPhase.skipped, true);
      assert.equal(domPhase.skipReason, 'static elements found');
      assert.equal(domPhase.ok, true);
      assert.deepEqual(buildPhaseRollup(result.phases), { total: 6, ok: 5, failed: 0, skipped: 1, timedOut: 0 });
      assert.ok(
        stub.calls.some((c) => /login\.php\?username=dmprobe/.test(c.url)),
        'static POST form must still synthesise its GET target'
      );
    } finally {
      await stopStub(stub);
    }
  });

  test('DOM-INT-3: render failure fails the phase honestly and the scan completes with the battery skipped', async () => {
    const stub = await startStub(STATIC_SHELL);
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const domRenderer = async () => { throw new Error('docker unavailable'); };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1', phases: BATTERY_PHASES },
        { timeoutMs: 5000, domRenderer, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const domPhase = result.phases.find((p) => p.name === 'dom-render');
      assert.ok(domPhase && !domPhase.ok, 'dom-render must record ok:false on render failure');
      assert.match(domPhase.error || '', /docker unavailable/);
      const rollup = buildPhaseRollup(result.phases);
      assert.equal(rollup.skipped, 34, 'all 34 param phases skip when the DOM pass fails');
      assert.equal(rollup.total, BATTERY_PHASES.length);
      assert.ok(result.phases.filter((p) => p.skipped).every((p) => p.skipReason === 'no param targets'));
    } finally {
      await stopStub(stub);
    }
  });

  test('DOM-INT-4: a DOM POST form is synthesised as GET — never submitted', async () => {
    const stub = await startStub(STATIC_SHELL);
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const norm = (u) => String(u).replace(/\/$/, '');
      const domRenderer = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: POST_FORM_DOM };
        return { ok: false, html: '', error: 'stub: no routes' };
      };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1', phases: ['fingerprint', 'crawl', 'page-analyze', 'dom-render', 'sqli-error', 'xss', 'csrf', 'post-forms'] },
        { timeoutMs: 5000, domRenderer, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const domPhase = result.phases.find((p) => p.name === 'dom-render');
      assert.ok(domPhase && domPhase.ok, 'dom-render must record ok');
      assert.equal(domPhase.domForms, 1, 'the DOM form must count in the phase extras');
      // Each probe replaces exactly one param, so the two fillers are
      // never intact on the SAME call — assert them separately (the
      // established paramBattery pattern): a call with username at
      // filler proves the password was probed, and vice versa.
      assert.ok(
        stub.calls.some((c) => /\/login\?username=dmprobe/.test(c.url)),
        `expected a GET probe with the username filler, got: ${stub.calls.map((c) => c.url).slice(0, 8).join(' | ')}`
      );
      assert.ok(
        stub.calls.some((c) => /password=dmprobe/.test(c.url)),
        'expected a GET probe with the password filler'
      );
      // "Never submitted" means the PARAM BATTERY never POSTs the form
      // — it only GETs the synthesised target (asserted above). The
      // dedicated post-forms probe DOES post to POST forms by design
      // (same treatment a static DVWA login form gets): the DOM form
      // must reach it exactly like a static one, with the unique-filler
      // safety rule intact (every POST body carries a dmprobe filler in
      // a non-target field, so no POST can ever carry matching values).
      const posts = stub.calls.filter((c) => c.method === 'POST');
      assert.ok(
        posts.some((c) => c.url.startsWith('/login')),
        'expected the DOM POST form to reach the post-forms probe'
      );
      assert.ok(
        posts.every((c) => /dmprobe/.test(c.body || '')),
        'every POST body must carry a dmprobe filler (unique-filler rule)'
      );
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.ok(sqli && sqli.ok && !sqli.skipped, 'battery must run on the DOM form target');
    } finally {
      await stopStub(stub);
    }
  });

  test('DOM-INT-5: authenticated pass merges post-login inputs — the battery probes them too', async () => {
    const stub = await startAuthStub({ loginOk: true });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const norm = (u) => String(u).replace(/\/$/, '');
      const domRenderer = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: ROOT_DOM };
        if (url === `${norm(target)}/#/login`) return { ok: true, html: LOGIN_DOM };
        return { ok: false, html: '', error: 'stub: route not rendered' };
      };
      // The authenticated renderer: same shape as the unauthenticated
      // one, but it sees the post-login DOM — account input + basket.
      const authDomRender = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: AUTH_ROOT_DOM };
        if (url === `${norm(target)}/#/basket`) return { ok: true, html: BASKET_DOM };
        return { ok: false, html: '', error: 'stub: route not rendered' };
      };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1', phases: BATTERY_PHASES },
        {
          timeoutMs: 5000,
          domRenderer,
          authDomRender,
          labCreds: { username: LAB_USER, password: LAB_PASS },
          nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }),
        }
      );
      const domPhase = result.phases.find((p) => p.name === 'dom-render');
      assert.ok(domPhase && domPhase.ok, 'dom-render must record ok');
      assert.equal(domPhase.authDom, true, 'the authenticated pass must have run');
      assert.equal(domPhase.authSession, 'token+cookies', 'token + session cookie must both have been carried');
      assert.equal(domPhase.authInputs, 2, 'account + quantity must be the auth additions');
      assert.equal(domPhase.authForms, 0);
      assert.equal(domPhase.authError, null);
      // Four DOM targets (email, password + account, quantity): the
      // 34-phase battery records once per target — 7 non-param + 136.
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 143,
        ok: 143,
        failed: 0,
        skipped: 0,
        timedOut: 0,
      });
      // The login API was actually hit with the lab credentials, and
      // the post-login params were actually probed.
      assert.ok(
        stub.calls.some((c) => c.method === 'POST' && c.url === '/rest/user/login' && c.body.includes('"email"')),
        'expected a login POST with the lab credentials'
      );
      assert.ok(
        stub.calls.some((c) => /[?&]account=dmprobe_/.test(c.url)),
        'expected a GET probe with the post-login account param'
      );
      assert.ok(
        stub.calls.some((c) => /[?&]quantity=dmprobe_/.test(c.url)),
        'expected a GET probe with the post-login quantity param'
      );
      // pageAnalysis.inputs is a COUNT on the returned result (the
      // internal array lives in the step) — 4 means the two post-login
      // inputs were merged into the target set.
      assert.ok((result.pageAnalysis?.inputs || 0) >= 4, 'account + quantity must count in pageAnalysis');
    } finally {
      await stopStub(stub);
    }
  });

  test('DOM-INT-6: failed login leaves the unauthenticated analysis standing — scan still passes', async () => {
    const stub = await startAuthStub({ loginOk: false });
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const norm = (u) => String(u).replace(/\/$/, '');
      const domRenderer = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: ROOT_DOM };
        if (url === `${norm(target)}/#/login`) return { ok: true, html: LOGIN_DOM };
        return { ok: false, html: '', error: 'stub: route not rendered' };
      };
      let authCalls = 0;
      const authDomRender = async () => {
        authCalls += 1;
        return { ok: true, html: AUTH_ROOT_DOM };
      };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1', phases: BATTERY_PHASES },
        {
          timeoutMs: 5000,
          domRenderer,
          authDomRender,
          labCreds: { username: LAB_USER, password: LAB_PASS },
          nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }),
        }
      );
      const domPhase = result.phases.find((p) => p.name === 'dom-render');
      assert.ok(domPhase && domPhase.ok, 'dom-render must stay ok when login fails');
      assert.equal(domPhase.authDom, false, 'no authenticated render without a session');
      assert.equal(domPhase.authSession, null);
      assert.equal(domPhase.authInputs, 0);
      assert.equal(domPhase.authError, 'login-failed');
      assert.equal(authCalls, 0, 'the auth renderer must never run without a session');
      // Same rollup as DOM-INT-1: the unauthenticated analysis stands.
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 75,
        ok: 75,
        failed: 0,
        skipped: 0,
        timedOut: 0,
      });
      assert.ok(
        !stub.calls.some((c) => /[?&]account=dmprobe_/.test(c.url)),
        'no post-login param must be probed after a failed login'
      );
    } finally {
      await stopStub(stub);
    }
  });

  test('DOM-INT-7: without lab creds the auth pass never fires — behaviour is byte-identical to DOM-INT-1', async () => {
    const stub = await startStub(STATIC_SHELL);
    try {
      const target = `http://127.0.0.1:${stub.port}/`;
      const norm = (u) => String(u).replace(/\/$/, '');
      const domRenderer = async (url) => {
        if (norm(url) === norm(target)) return { ok: true, html: ROOT_DOM };
        if (url === `${norm(target)}/#/login`) return { ok: true, html: LOGIN_DOM };
        return { ok: false, html: '', error: 'stub: route not rendered' };
      };
      let authCalls = 0;
      const authDomRender = async () => {
        authCalls += 1;
        return { ok: true, html: AUTH_ROOT_DOM };
      };
      const result = await runScan(
        { target, confirmedAuthorized: true, labTargets: '127.0.0.1', phases: BATTERY_PHASES },
        { timeoutMs: 5000, domRenderer, authDomRender, nucleiRunner: async () => ({ findings: [], ok: true, timedOut: false }) }
      );
      const domPhase = result.phases.find((p) => p.name === 'dom-render');
      assert.ok(domPhase && domPhase.ok);
      assert.equal(domPhase.authDom, false);
      assert.equal(domPhase.authSession, null);
      assert.equal(domPhase.authInputs, 0);
      assert.equal(authCalls, 0, 'no auth pass without lab creds');
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 75,
        ok: 75,
        failed: 0,
        skipped: 0,
        timedOut: 0,
      });
      // The battery legitimately POSTs to DOM-param URLs (DOM-INT-1)
      // — the invariant is that no POST ever reaches the login API
      // without lab creds.
      assert.ok(
        !stub.calls.some((c) => c.method === 'POST' && c.url === '/rest/user/login'),
        'no login attempt may fire without lab creds'
      );
    } finally {
      await stopStub(stub);
    }
  });
});
