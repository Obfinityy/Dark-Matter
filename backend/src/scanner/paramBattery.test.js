// Dark Matter scanner — param-battery visibility tests (5 Nov 2026).
//
// REGRESSION (35/63 gap): on a bare-root paste with zero param-bearing
// targets, the 28-phase injection battery was skipped in total silence —
// step() was never invoked, so no record, no error, and the rollup read a
// clean 35/35 ok on a 35/63 run. DVWA's flagship injection classes (SQLi,
// XSS, CMDI, traversal, SSTI, SSRF) never ran on the bare-root paste.
//
// The fix: (a) runScan emits a skipped record per param-battery phase when
// no target carries a parameter, and buildPhaseRollup counts skipped
// distinctly; (b) POST forms yield synthesized GET probe targets (same
// unique-filler read-only rule as GET forms) so the battery actually runs
// against a POST-login page; (c) fetchPage returns the post-redirect URL.
//
// No network, no docker in these tests — fetch is stubbed throughout.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runScan, PARAM_BATTERY_PHASES, DEFAULT_PHASES, buildPhaseRollup, buildPhaseSummaryLine } from './index.js';
import { fetchPage } from './fingerprint.js';

const realFetch = globalThis.fetch;
const teardown = () => {
  globalThis.fetch = realFetch;
};

// A page with no links, no forms, no parameters — the bare-root paste case.
const BARE_PAGE = `<html><head><title>t</title></head><body><p>hello</p></body></html>`;

// A DVWA-style login page: a single POST form, no GET forms, no links.
const LOGIN_PAGE = `<html><head><title>Login</title></head><body>
<form action="/login.php" method="post">
<input name="username"><input name="password">
<input name="Login" type="submit" value="Login">
</form></body></html>`;

function stubPage(html) {
  globalThis.fetch = async () => ({
    status: 200,
    headers: new Headers({ server: 'nginx/1.24' }),
    text: async () => html,
  });
}

describe('param battery skipped records (35/63 fix)', () => {
  it('PARAM_BATTERY_PHASES is exactly the 33 loop phases, all in DEFAULT_PHASES', () => {
    assert.equal(PARAM_BATTERY_PHASES.length, 33);
    assert.equal(new Set(PARAM_BATTERY_PHASES).size, 33);
    for (const name of PARAM_BATTERY_PHASES) {
      assert.ok(DEFAULT_PHASES.includes(name), `${name} missing from DEFAULT_PHASES`);
    }
    // 155 since 10 Nov 2026 (scout classes 479-515): 26 new phases
    // — 'ssti-pebble' joins the battery as a loop phase (one record
    // per param target); the other 25 join as standalone phases
    // (see index.js wiring).
    // 87 since 8 Nov 2026 (DOM XSS sinks): 'dom-xss-sinks'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script).
    // 86 since 7 Nov 2026 (missing auth): 'missing-auth'
    // joins as a standalone always-run phase (one record per scan —
    // the fixed candidate list is never empty, so it never skips).
    // 85 since 7 Nov 2026 (browser storage): 'browser-storage'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script).
    // 84 since 7 Nov 2026 (sensitive cache): 'sensitive-cache'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 79 since 7 Nov 2026 (untrusted JS inclusion): 'untrusted-js-inclusion'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 78 since 7 Nov 2026 (XML injection): 'xml-injection'
    // joins the battery as a loop phase (one record per param
    // target — structure breakout + parser-error vectors).
    // 77 since 7 Nov 2026 (timing side-channel): 'timing-side-channel'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 76 since 7 Nov 2026 (sensitive information disclosure): 'sensitive-info-disclosure'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is the baseline, so it never skips).
    // 75 since 7 Nov 2026 (sensitive data in logs): 'sensitive-data-in-logs'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 74 since 7 Nov 2026 (metadata leakage): 'metadata-leakage'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 73 since 7 Nov 2026 (source code disclosure): 'source-code-disclosure'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 72 since 7 Nov 2026 (fingerprint / banner disclosure): 'fingerprint-banner'
    // joins as a standalone always-run phase (one record per scan —
    // the pasted page is always a surface, so it never skips).
    // 71 since 7 Nov 2026 (input validation): 'validation'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no probe targets' when no scan target carries a probe
    // point and no form exists).
    // (70 since 7 Nov 2026 (error disclosure): 'error-disclosure'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no probe targets' when no scan target carries a probe
    // point).
    // (95 since 9 Nov 2026 (CAPTCHA bypass): 'captcha'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script; lab-gated,
    // drives the feedback math-CAPTCHA flow only when a solvable math
    // CAPTCHA exists in first-party code).
    // (94 since 9 Nov 2026 (client-side template injection): 'csti'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script; lab-gated,
    // drives a template canary in a real browser only when a runtime
    // template engine exists in first-party code).
    // (93 since 9 Nov 2026 (DOM XSS via postMessage): 'dom-postmessage'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script; lab-gated,
    // drives canary messages in a real browser only when a message
    // listener exists in first-party code).
    // (92 since 9 Nov 2026 (credential stuffing): 'credential-stuffing'
    // joins as a standalone gated phase (one record per scan, always-run
    // as an honest no-op: no login route on a bare page; lab-gated,
    // confirms only on 10 wrong passwords with no throttle signal).
    // (98 since 9 Nov 2026 (mutation XSS): 'mutation-xss' joins as
    // a standalone gated phase (one record per scan, skipped with
    // 'no script targets' when the page carries no script; lab-gated,
    // drives a mutation canary in a real browser only when an
    // HTML-write assignment exists in first-party code).
    // (99 since 9 Nov 2026 (coupon abuse): 'coupon-abuse'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no coupon routes on a bare
    // page; lab-gated, control apply first, then reuse on a fresh
    // basket and stacking against the single-coupon floor).
    // (104 since 9 Nov 2026 (autocomplete): 'autocomplete' joins
    // as a standalone phase (one record per scan, always-run as an
    // honest no-op: no sensitive inputs on a bare page; static
    // served-HTML check, no lab gate, no drive).
    // (105 since 9 Nov 2026 (blind XPath): 'blind-xpath' joins
    // the battery as a loop phase (one record per param target —
    // TRUE/FALSE substring() differential + second witness; the
    // general XPath row #215 is covered by 'xpathi', this is the
    // blind variant #479).
    // (107 since 9 Nov 2026 (workflow data exposure):
    // 'workflow-data-exposure' joins as a standalone gated phase
    // (one record per scan, always-run as an honest no-op: no
    // workflow routes on a bare page; lab-gated, inspects each
    // workflow-step response for fields beyond the step's need).
    // (100-102 since 9 Nov 2026 (DOM trio): 'dom-open-redirect',
    // 'dom-clobbering' and 'dom-cookie-manipulation' join as
    // standalone gated phases (one record per scan, skipped with
    // 'no script targets' when the page carries no script;
    // lab-gated, each drives a canary in a real browser only when
    // its sink exists in first-party code — a redirect target, a
    // clobbered global, a cookie write; the cookie drive reuses
    // the dom-render lab session and confirms only on a sensitive
    // cookie carrying the marker in the canary render only).
    // (103 since 9 Nov 2026 (API token auth): 'api-token-auth'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no token-param routes and no
    // lab login on a bare page; lab-gated, three-way differential
    // on mined token-param API routes plus a two-login weak-token
    // judgement — confirms only when the API returns the protected
    // response with the token in the URL, or the issued token is
    // static, short numeric, or a trivial derivation of the
    // username).
    // (106 since 9 Nov 2026 (exceptional conditions):
    // 'exceptional-conditions' joins as a standalone gated phase
    // (one record per scan, always-run as an honest no-op: no
    // basket routes on a bare page; lab-gated, calibrates with a
    // well-formed basket add, then feeds type-confusion quantities
    // to the same add endpoint and, when all are rejected there,
    // to the sibling update endpoint; confirms only on 2xx + a
    // basket state change).
    // (108 since 9 Nov 2026 (JWT sensitive claims): 'jwt-claims'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no issued token on a bare
    // page; lab-gated, decodes the token the login issues and
    // walks its claims for sensitive fields — confirms only when
    // a credential/secret or personal-data field carries a
    // non-empty value).
    // (109 since 9 Nov 2026 (limit / quota bypass): 'quota-bypass'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no API routes on a bare
    // page; lab-gated, control GET first, then the same GET 15
    // times in rapid succession; confirms only when every burst
    // answer is granted with no throttle signal).
    // (113 since 10 Nov 2026 (webrtc-leak): 'webrtc-leak'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no labCreds on a bare
    // page; lab-gated, drives a real browser via CDP and gathers
    // ICE candidates with an RTCPeerConnection that uses no
    // STUN/TURN servers; confirms only on a literal RFC1918 /
    // link-local / IPv6-ULA address in a host candidate).
    // (120 since 10 Nov 2026 (business flow access): 'business-flow-access'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no basket routes on a bare
    // page; lab-gated, three-way differential on a mined basket
    // route with a self-registered low-privilege account; confirms
    // only on a cross-user GET returning the victim's basket with
    // the seeded item).
    // (121 since 10 Nov 2026 (LLM prompt injection): 'llm-injection'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no LLM chat endpoint on a bare
    // page; lab-gated, benign control first, then jailbreak /
    // indirect / RAG-leak tests; confirms only on an observed leak
    // in the completion).
    // (110 since 9 Nov 2026 (document.domain): 'document-domain'
    // joins as a standalone gated phase (one record per scan,
    // skipped with 'no script targets' when the page carries no
    // script; static mining only, no lab gate — confirms only on
    // an observed string-literal assignment to a parent suffix of
    // the page host).
    // (118 since 10 Nov 2026 (CSTI framework variants): 'csti-frameworks'
    // joins as a standalone gated phase (one record per scan,
    // skipped with 'no matching framework' when the page carries no
    // matching client-side template framework; framework-gated,
    // drives the {{7*7*191}} canary only on a fingerprinted
    // AngularJS/Vue/Knockout/Handlebars template or a React
    // dangerouslySetInnerHTML sink).
    // (119 since 10 Nov 2026 (weak password policy):
    // 'weak-password-policy' joins as a standalone gated phase
    // (one record per scan, always-run as an honest no-op: no
    // registration route on a bare page; lab-gated, strong-password
    // control registration first, then trivial passwords; confirms
    // only when a trivial password registers on the same route the
    // control succeeded on).
    // (122 since 10 Nov 2026 (LLM rate limit / unbounded
    // consumption): 'llm-rate-limit' joins as a standalone gated
    // phase (one record per scan, always-run as an honest no-op:
    // no labCreds on a bare page; lab-gated, control chat first,
    // then 12 identical chat POSTs + 4 identical tool POSTs in
    // rapid succession; confirms only when every burst answer is
    // granted with no throttle signal).
    // (123 since 10 Nov 2026 (LLM training-data extraction):
    // 'llm-training-data' joins as a standalone gated phase (one
    // record per scan, always-run as an honest no-op: no labCreds
    // on a bare page; lab-gated, learns canary tokens at runtime
    // from /api/rag, then prompts for the planted key and customer
    // record; confirms only on verbatim regurgitation of a canary
    // token).
    // (124 since 10 Nov 2026 (LLM training-data poisoning):
    // 'llm-training-poisoning' joins as a standalone gated phase
    // (one record per scan, always-run as an honest no-op: no
    // labCreds on a bare page; lab-gated, benign control must call
    // no tool, then prompts for the internal notes; confirms only
    // when the reply carries a readFile toolCall with the poisoned
    // doc's content folded into the completion — partial surface:
    // the stub has no training step).
    // (125 since 10 Nov 2026 (LLM model extraction):
    // 'llm-model-extraction' joins as a standalone gated phase
    // (one record per scan, always-run as an honest no-op: no
    // labCreds on a bare page; lab-gated, reads the model card and
    // attempts extraction twice; true negative by design — the
    // stub carries no weights — confirms only on a weights
    // disclosure).
    // (126 since 10 Nov 2026 (LLM multimodal prompt injection):
    // 'llm-multimodal' joins as a standalone gated phase (one
    // record per scan, always-run as an honest no-op: no labCreds
    // on a bare page; lab-gated, inventories the index page and
    // model card for media endpoints, then sends image + audio
    // data-URI prompts; unprovable on this lab — the stub treats
    // both as text — confirms only on a media-triggered injection).
    // (127 since 10 Nov 2026 (LLM membership inference):
    // 'llm-membership-inference' joins as a standalone gated phase
    // (one record per scan, always-run as an honest no-op: no
    // labCreds on a bare page; lab-gated, records determinism and
    // the absence of confidence signals; no finding branch by
    // design — RAG membership is directly observable, not
    // inferable).
    // (128 since 10 Nov 2026 (LLM supply chain):
    // 'llm-supply-chain' joins as a standalone gated phase (one
    // record per scan, always-run as an honest no-op: no labCreds
    // on a bare page; lab-gated, inventories the model card and
    // index page for plugin/download/registry markers; true
    // negative by design — no third-party model surface on this
    // lab).
    // (129 since 10 Nov 2026 (service worker cache poisoning):
    // 'sw-cache-poisoning' joins as a standalone gated phase (one
    // record per scan, skipped with 'no script targets' when the
    // page carries no script; tier-1 static mining of worker
    // registrations + cache-write sinks, tier-2 CDP poison drive
    // only when a poisonable sink exists — confirms only when a
    // later clean fetch serves the poisoned cache entry).
    // (130 since 10 Nov 2026 (OAuth lab flows): 'oauth-lab' joins
    // as a standalone gated phase (one record per scan, always-run
    // as an honest no-op: no labCreds on a bare page; lab-gated
    // AND fingerprint-gated — the target must answer service=
    // oauth-lab on /health — drives the completed OAuth/OIDC flows
    // (magic-link replay, pre-account hijack, unverified-email
    // IdP, forced linking, code injection, IdP mix-up, SSRF via
    // dynamic registration, refresh reuse, WebAuthn without
    // validation) with canary accounts; confirms only on
    // differential / state-change evidence).
    // (150 since 14 Nov 2026 (UNION + boolean-blind SQLi, rows
    // #277/#278): 'sqli-union' and 'sqli-boolean-blind' join the
    // battery as loop phases (both lab-gated inside their probes).
    // (148 since 10 Nov 2026 (anti-automation, row #79): 'anti-automation'
    // joins as a standalone gated phase (one record per scan,
    // always-run as an honest no-op: no login route on a bare page;
    // lab-gated, 10 back-to-back wrong-password attempts; confirms
    // only when all 10 are answered ordinarily with no bot challenge
    // and no throttle).
    // (152 since 11 Nov 2026 (V10 generated-document external-image
    // phases): 'document-external-image', 'spreadsheet-external-image'
    // and 'presentation-external-image' join as standalone phases
    // (one record per scan, always-run as honest no-ops: no document
    // links on a bare page; read-only GETs of linked documents;
    // confirm only on TargetMode="External" + r:link with no media
    // embedding; the presentation phase records the embedded-image
    // control instead of a finding).
    // (153 since 14 Nov 2026 (second-order SQLi, rows #208/#281):
    // 'sqli-second-order' joins as a standalone gated phase (one
    // record per scan, skipped with 'lab-gated: second-order writes
    // need a lab target' on a non-lab host; runs next to stored-xss
    // on the same forms surface — stores a canary quote via a form,
    // confirms only on a DB error on the SECOND request).
    // (147 since 10 Nov 2026 (scout classes 479-515): 17 new
    // non-OAuth phases — 'ssti-pebble' joins the battery as a loop
    // phase; xxe-xinclude, smuggling-cl-cl, smuggling-zero-cl,
    // smuggling-h2-tunnel, hash-length-extension, ssrf-routing,
    // ssrf-referer, referer-access-control, upload-race,
    // upload-htaccess, graphql-relay, graphql-apq, graphql-defer,
    // deep-link, webview-bridge and mcp-tool-poisoning join as
    // standalone phases. The scout lane's nine OAuth-family phases
    // are not in this tree: the merged oauth-lab phase already
    // covers those rows.)
    // (97 since 9 Nov 2026 (BFLA): 'bfla' joins as a standalone
    // gated phase (one record per scan, always-run as an honest
    // no-op: no admin routes on a bare page; lab-gated, three-way
    // differential on mined admin routes with a self-registered
    // low-privilege account; confirms only on a low-privilege GET
    // returning the admin-only response).
    // (91 since 9 Nov 2026 (DOM XSS via location.hash): 'dom-xss-location-hash'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script; lab-gated,
    // drives a canary fragment in a real browser only when a location.hash
    // read exists in first-party code).
    // (69 since 7 Nov 2026 (secrets in JS): 'secrets-in-js'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no script targets' when the page carries no script).
    // (68 since 7 Nov 2026 (method override): 'method-override'
    // joins as a standalone gated phase (one record per scan, skipped
    // with 'no probe targets' when no scan target carries a probe
    // point and no POST form exists).
    // (67 since 7 Nov 2026 (verb tampering): 'verb-tampering' joins
    // as a standalone gated phase (one record per scan, skipped with
    // 'no probe targets' when no scan target carries a probe point).
    // (66 since 7 Nov 2026 (JS-bundle API routes): 'js-api-routes'
    // joins the battery so spec-less SPA APIs get a bundle-mined
    // inventory pass. (65 since 6 Nov 2026: 'openapi-targets'.)
    assert.ok(DEFAULT_PHASES.includes('sqli-second-order'), "'sqli-second-order' must be registered");
    assert.equal(DEFAULT_PHASES.length, 155);
  });

  it('zero param targets: all 33 param phases emit skipped records, rollup reports them', async () => {
    stubPage(BARE_PAGE);
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: [...PARAM_BATTERY_PHASES],
        },
        { timeoutMs: 5000 }
      );
      assert.equal(result.phases.length, 33);
      assert.deepEqual(
        result.phases.map((p) => p.name),
        PARAM_BATTERY_PHASES
      );
      for (const p of result.phases) {
        assert.equal(p.skipped, true);
        assert.equal(p.skipReason, 'no param targets');
        assert.equal(p.ok, true);
        assert.equal(p.error, null);
        assert.equal(p.findingsCount, 0);
        assert.equal(p.durationMs, 0);
      }
      // The rollup must NOT read this as a pass: 0 ok, 33 skipped.
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 33,
        ok: 0,
        failed: 0,
        skipped: 33,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('zero param targets with a mixed phase list: executed phases stay ok, param phases skipped', async () => {
    stubPage(BARE_PAGE);
    try {
      const seen = [];
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers', 'sqli-error', 'xss'],
        },
        { timeoutMs: 5000, onPhase: (p) => seen.push(p) }
      );
      assert.equal(result.phases.length, 6);
      const byName = Object.fromEntries(result.phases.map((p) => [p.name, p]));
      for (const name of ['fingerprint', 'crawl', 'page-analyze', 'headers']) {
        assert.equal(byName[name].ok, true);
        assert.equal(byName[name].skipped, undefined);
      }
      assert.equal(byName['sqli-error'].skipped, true);
      assert.equal(byName['xss'].skipped, true);
      // Skipped records stream through onPhase exactly like executed ones.
      assert.equal(seen.length, 6);
      assert.equal(seen.filter((p) => p.skipped).length, 2);
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 6,
        ok: 4,
        failed: 0,
        skipped: 2,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('a POST login form yields synthesized GET targets and the battery runs (never submits the POST)', async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), method: String(init.method || 'GET').toUpperCase() });
      return {
        status: 200,
        headers: new Headers({ server: 'nginx/1.24' }),
        text: async () => LOGIN_PAGE,
      };
    };
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'headers', 'sqli-error', 'xss', 'cmdi', 'traversal', 'csrf'],
        },
        { timeoutMs: 5000 }
      );
      const byName = Object.fromEntries(result.phases.map((p) => [p.name, p]));
      // The battery ran against the synthesized target — no skipped records.
      for (const name of ['sqli-error', 'xss', 'cmdi', 'traversal']) {
        assert.equal(byName[name].skipped, undefined, `${name} must not be skipped`);
        assert.equal(byName[name].ok, true);
      }
      // The synthesized GET target was actually probed (login.php with
      // unique fillers for username/password), and the POST form was never
      // submitted — the battery only GETs.
      assert.ok(
        calls.some((c) => /login\.php\?username=dmprobe/.test(c.url)),
        `expected a GET probe of the synthesized login target, got: ${calls.map((c) => c.url).slice(0, 5).join(' | ')}`
      );
      assert.ok(
        calls.every((c) => c.method === 'GET'),
        `battery must never POST; saw: ${calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url}`).join(', ')}`
      );
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 9,
        ok: 9,
        failed: 0,
        skipped: 0,
        timedOut: 0,
      });
    } finally {
      teardown();
    }
  });

  it('a GET form still yields param targets (existing behaviour unchanged)', async () => {
    stubPage(
      `<html><body><form action="/s" method="get"><input name="q"></form></body></html>`
    );
    try {
      const result = await runScan(
        {
          target: 'http://example.com/',
          confirmedAuthorized: true,
          phases: ['fingerprint', 'crawl', 'page-analyze', 'sqli-error'],
        },
        { timeoutMs: 5000 }
      );
      const sqli = result.phases.find((p) => p.name === 'sqli-error');
      assert.equal(sqli.skipped, undefined);
      assert.equal(sqli.ok, true);
    } finally {
      teardown();
    }
  });
});

describe('fetchPage post-redirect URL (35/63 fix)', () => {
  it('returns res.url — the landing URL after redirects', async () => {
    globalThis.fetch = async () => ({
      url: 'http://example.com/login.php',
      status: 200,
      headers: new Headers({ server: 'nginx/1.24' }),
      text: async () => LOGIN_PAGE,
    });
    try {
      const page = await fetchPage('http://example.com/', { timeoutMs: 5000 });
      assert.equal(page.url, 'http://example.com/login.php');
      assert.equal(page.status, 200);
    } finally {
      teardown();
    }
  });

  it('falls back to the requested URL when res.url is absent (stubbed fetch)', async () => {
    globalThis.fetch = async () => ({
      status: 200,
      headers: new Headers({ server: 'nginx/1.24' }),
      text: async () => BARE_PAGE,
    });
    try {
      const page = await fetchPage('http://example.com/', { timeoutMs: 5000 });
      assert.equal(page.url, 'http://example.com/');
    } finally {
      teardown();
    }
  });
});

describe('buildPhaseRollup', () => {
  it('counts ok/failed/skipped/timedOut distinctly', () => {
    assert.deepEqual(
      buildPhaseRollup([
        { name: 'a', ok: true },
        { name: 'b', ok: true, skipped: true },
        { name: 'c', ok: false },
        { name: 'd', ok: false, timedOut: true },
      ]),
      { total: 4, ok: 1, failed: 2, skipped: 1, timedOut: 1 }
    );
  });

  it('returns zeros for empty / non-array input', () => {
    assert.deepEqual(buildPhaseRollup([]), {
      total: 0,
      ok: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0,
    });
    assert.deepEqual(buildPhaseRollup(null), {
      total: 0,
      ok: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0,
    });
  });
});

describe('buildPhaseSummaryLine (phase-split message)', () => {
  // Fabricate the exact bWAPP / VAmPI / Juice Shop rollup shape from the
  // 6 Nov 2026 nuclei-600 re-validation: 35 ran ok, 28 skipped, 0 failed.
  const skippedBattery = () => [
    ...Array.from({ length: 35 }, (_, i) => ({ name: `ok-${i}`, ok: true })),
    ...PARAM_BATTERY_PHASES.map((name) => ({
      name,
      ok: true,
      skipped: true,
      skipReason: 'no param targets',
    })),
  ];

  it('35/31 case renders the split with the shared skip reason — never 66/66 ok', () => {
    const phases = skippedBattery();
    // Skipped records still carry ok:true by design (see skipPhase) — the
    // line must read the rollup's skipped count, never ok:true.
    assert.ok(phases.filter((p) => p.skipped).every((p) => p.ok === true));
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 35 ran ok, 33 skipped (no param targets), 0 failed, 0 timed out.'
    );
  });

  // 103/52 since 10 Nov 2026 (scout classes 479-515: ssti-pebble,
  // xxe-xinclude, smuggling CL.CL / 0.CL / H2 tunnel, hash-length
  // extension, ssrf-routing, ssrf-referer, referer-access-control,
  // upload-race, upload-htaccess, graphql-relay / apq / defer, the
  // nine OAuth-family phases, deep-link, webview-bridge,
  // mcp-tool-poisoning — on top of the 81/48 from API token auth +
  // autocomplete + blind XPath + exceptional conditions + workflow
  // data exposure + JWT sensitive claims + limit / quota bypass +
  // document.domain relaxation + session timeout / remember-me +
  // insecure provisioning + webrtc-leak + LLM tool misuse +
  // excessive agency + output handling + misinformation + CSTI
  // framework variants + weak password policy + business flow
  // access + LLM prompt injection + LLM rate limit +
  // training-data extraction + training-data poisoning + model
  // extraction + multimodal prompt injection + membership
  // inference + supply chain + service worker cache poisoning +
  // anti-automation):
  // 'api-token-auth' adds a 59th ok record (always-run as an honest
  // no-op: no token-param routes and no lab login on a bare page)
  // and 'autocomplete' adds a 60th ok record (always-run as an
  // honest no-op: no sensitive inputs on a bare page), and
  // 'blind-xpath' adds a 45th skipped record (battery skip: no
  // param targets on a bare page), and 'exceptional-conditions'
  // adds a 61st ok record (always-run as an honest no-op: no
  // basket routes on a bare page), and 'workflow-data-exposure'
  // adds a 62nd ok record (always-run as an honest no-op: no
  // workflow routes on a bare page), and 'jwt-claims' adds a 63rd
  // ok record (always-run as an honest no-op: no issued token on
  // a bare page), and 'quota-bypass' adds a 64th ok record
  // (always-run as an honest no-op: no API routes on a bare
  // page), and 'document-domain' adds a 46th skipped record
  // (SKIPS on a bare page: no script targets), and
  // 'session-timeout' adds a 65th ok record (always-run as an
  // honest no-op: no labCreds on a bare page), and 'provisioning'
  // adds a 66th ok record (always-run as an honest no-op: no
  // registration routes and no labCreds on a bare page), and
  // 'webrtc-leak' adds a 67th ok record (always-run as an honest
  // no-op: no labCreds on a bare page), and 'llm-tool-misuse' adds
  // a 68th ok record (always-run as an honest no-op: no LLM surface
  // on a bare page), and 'llm-excessive-agency' adds a 69th ok
  // record (always-run as an honest no-op: no LLM surface on a bare
  // page), and 'llm-output-handling' adds a 70th ok record
  // (always-run as an honest no-op: no LLM surface on a bare page),
  // and 'llm-misinformation' adds a 71st ok record (always-run as
  // an honest no-op: no LLM surface on a bare page), and
  // 'csti-frameworks' adds a 47th skipped record ('no matching
  // framework': the bare page carries no matching client-side
  // template framework), and 'weak-password-policy' adds a 72nd ok
  // record (always-run as an honest no-op: no registration route
  // on a bare page), and 'business-flow-access' adds a 73rd ok
  // record (always-run as an honest no-op: no basket routes on a
  // bare page), and 'llm-injection' adds a 74th ok record
  // (always-run as an honest no-op: no LLM chat endpoint on a bare
  // page), and 'llm-rate-limit' adds a 75th ok record (always-run
  // as an honest no-op: no labCreds on a bare page), and
  // 'llm-training-data' adds a 76th ok record (always-run as an
  // honest no-op: no labCreds on a bare page), and
  // 'llm-training-poisoning' adds a 77th ok record (always-run as
  // an honest no-op: no labCreds on a bare page), and
  // 'llm-model-extraction' adds a 78th ok record (always-run as an
  // honest no-op: no labCreds on a bare page), and 'llm-multimodal'
  // adds a 79th ok record (always-run as an honest no-op: no
  // labCreds on a bare page), and 'llm-membership-inference' adds
  // an 80th ok record (always-run as an honest no-op: no labCreds
  // on a bare page), and 'llm-supply-chain' adds an 81st ok record
  // (always-run as an honest no-op: no labCreds on a bare page),
  // and 'sw-cache-poisoning' adds a 48th skipped record (SKIPS on
  // a bare page: no script targets), and 'oauth-lab' adds an 82nd
  // ok record (always-run as an honest no-op: no labCreds on a
  // bare page), so the bare-page line reads 82 ran ok, 48 skipped.
  // 58/40 since 9 Nov 2026 (coupon abuse): 'coupon-abuse' adds a
  // 58th ok record (always-run as an honest no-op: no coupon routes
  // on a bare page), so the bare-page line reads 58 ran ok, 40 skipped.
  // 57/40 since 9 Nov 2026 (BFLA): 'bfla' adds a
  // 57th ok record (always-run as an honest no-op: no admin routes
  // on a bare page), so the bare-page line reads 57 ran ok, 40 skipped.
  // 56/40 since 9 Nov 2026 (CSS injection): 'css-injection' adds a
  // 56th ok record (always-run as an honest no-op: no style contexts
  // on a bare page), so the bare-page line reads 56 ran ok, 40 skipped.
  // 55/40 since 9 Nov 2026 (CAPTCHA bypass): 'captcha' adds a
  // 40th skipped record ('no script targets': the bare page carries
  // no script), so the bare-page line reads 55 ran ok, 40 skipped.
  // 55/39 since 9 Nov 2026 (client-side template injection): 'csti' adds a
  // 39th skipped record ('no script targets': the bare page carries
  // no script), so the bare-page line reads 55 ran ok, 39 skipped.
  // 55/38 since 9 Nov 2026 (DOM XSS via postMessage): 'dom-postmessage' adds a
  // 38th skipped record ('no script targets': the bare page carries
  // no script), so the bare-page line reads 55 ran ok, 38 skipped.
  // 55/37 since 9 Nov 2026 (credential stuffing): 'credential-stuffing' adds a
  // 55th ok record (always-run as an honest no-op: no login route
  // on a bare page), so the bare-page line reads 55 ran ok, 37 skipped.
  // 54/36 since 8 Nov 2026 (2FA brute-force): 'twofa-bruteforce' adds a
  // 54th ok record (always-run as an honest no-op: no 2FA verify route
  // on a bare page), so the bare-page line reads 54 ran ok, 36 skipped.
  // 53/36 since 8 Nov 2026 (workflow skip): 'workflow-skip' adds a
  // 53rd ok record (always-run as an honest no-op: no basket or
  // checkout routes on a bare page), so the bare-page line reads
  // 53 ran ok, 36 skipped.
  // 52/36 since 8 Nov 2026 (basket logic): 'basket-logic' adds a
  // 52nd ok record (always-run as an honest no-op: no basket routes
  // on a bare page), so the bare-page line reads 52 ran ok, 36 skipped.
  // 51/36 since 8 Nov 2026 (DOM XSS sinks): 'dom-xss-sinks' adds a
  // 36th skipped record ('no script targets': the bare page carries
  // no script), so the bare-page line reads 51 ran ok, 36 skipped.
  // 51/35 since 7 Nov 2026 (missing auth): 'missing-auth' adds a
  // 51st ok record (always-run: the fixed candidate list is never
  // empty, so it never skips), while the bare-page line still reads
  // 35 skipped.
  // 50/35 since 7 Nov 2026 (browser storage): 'browser-storage' adds
  // a 35th skipped record ('no script targets': the bare page carries
  // no script), so the bare-page line reads 50 ran ok, 35 skipped.
  // 46/34 since 7 Nov 2026 (XML injection + untrusted JS inclusion): the battery
  // gained 'js-api-routes', so a bare page runs 46 non-param phases — and
  // 'verb-tampering' + 'method-override' add a 29th and 30th skipped
  // record ('no probe targets': no scan target carries a probe point
  // on a bare page, and no POST form exists), 'secrets-in-js' adds
  // a 31st ('no script targets': the bare page carries no script),
  // 'error-disclosure' adds a 32nd ('no probe targets'), and
  // 'validation' adds a 33rd ('no probe targets': no probe point
  // and no form), while 'xml-injection' adds a 34th (the battery
  // gained a 29th loop phase — see PARAM_BATTERY_PHASES above),
  // while 'fingerprint-banner' adds a 39th RUNNING
  // record, 'source-code-disclosure' a 40th, 'metadata-leakage'
  // a 41st, 'sensitive-data-in-logs' a 42nd,
  // 'sensitive-info-disclosure' a 43rd, 'timing-side-channel'
  // a 44th, 'untrusted-js-inclusion' a 45th, 'api-versioning' a 46th and
  // 'session-token-in-url' a 47th (the pasted page
  // is always a surface — 0 findings on
  // the bare stub), so the two skip reasons mix and the summary
  // renders a bare count. The spec fetch is stubbed to the bare page
  // (HTML, not JSON), so the pass records an honest no-op with 0
  // targets — the same seam discipline as domRenderer above.
  // (37/28 before js-api-routes; 43/33 before timing-side-channel;
  // 44/33 before xml-injection and untrusted-js-inclusion;
  // 46/34 before session-token-in-url; 47/34 before credential-disclosure;
  // 48/34 before sqli-oob.)
  it('real runScan on a bare page renders the 103/52 line end to end', async () => {
    stubPage(BARE_PAGE);
    try {
      const result = await runScan(
        { target: 'http://example.com/', confirmedAuthorized: true },
        {
          timeoutMs: 5000,
          nucleiRunner: async () => ({ ok: true, timedOut: false, findings: [] }),
          domRenderer: async () => ({ ok: true, html: '<html><body></body></html>' }),
        }
      );
      assert.deepEqual(buildPhaseRollup(result.phases), {
        total: 155,
        ok: 100,
        failed: 0,
        skipped: 55,
        timedOut: 0,
      });
      assert.equal(
        buildPhaseSummaryLine(result.phases),
        'Phases: 100 ran ok, 55 skipped, 0 failed, 0 timed out.'
      );
    } finally {
      teardown();
    }
  });

  it('clean 63/63 run renders zero skipped', () => {
    const phases = Array.from({ length: 63 }, (_, i) => ({ name: `p-${i}`, ok: true }));
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 63 ran ok, 0 skipped, 0 failed, 0 timed out.'
    );
  });

  it('failed and timed-out phases render distinctly', () => {
    const phases = [
      ...Array.from({ length: 60 }, (_, i) => ({ name: `p-${i}`, ok: true })),
      { name: 'x', ok: false },
      { name: 'nuclei', ok: false, timedOut: true },
    ];
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 60 ran ok, 0 skipped, 2 failed, 1 timed out.'
    );
  });

  it('mixed skip reasons render as a bare count, no parenthetical', () => {
    const phases = [
      { name: 'a', ok: true },
      { name: 'b', ok: true, skipped: true, skipReason: 'no param targets' },
      { name: 'c', ok: true, skipped: true, skipReason: 'other reason' },
    ];
    assert.equal(
      buildPhaseSummaryLine(phases),
      'Phases: 1 ran ok, 2 skipped, 0 failed, 0 timed out.'
    );
  });

  it('returns zeros for empty / non-array input', () => {
    assert.equal(
      buildPhaseSummaryLine([]),
      'Phases: 0 ran ok, 0 skipped, 0 failed, 0 timed out.'
    );
    assert.equal(
      buildPhaseSummaryLine(null),
      'Phases: 0 ran ok, 0 skipped, 0 failed, 0 timed out.'
    );
  });
});
