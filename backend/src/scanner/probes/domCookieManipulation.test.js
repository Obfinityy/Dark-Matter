// Dark Matter rule-based scanner — DOM-Based Cookie Manipulation tests
// (coverage row #90 [Medium] DOM-Based Cookie Manipulation,
// Technique (no single CVE) | PortSwigger DOM; phase 100
// 'dom-cookie-manipulation').
//
// The probe has two tiers: a static mine (document.cookie writes in
// first-party code) and — only when a write exists — a CDP cookie
// drive in a real browser WITH the lab session. Tests cover the mine
// and the drive with fake fetchPage / fake runner / fake CDP seams;
// no docker, no network. Fixtures are built by concatenation, never
// single literals (the repo's secret-shape rule), and every fake is
// per-test so no state leaks between tests.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDomCookieManipulation,
  driveCookieManipulation,
  findCookieWrites,
  assessCookieFlow,
  assessDriveResult,
  extractParamNames,
  parseCookieString,
  findCanaryCookies,
  canaryValue,
  controlValue,
  __domCookieMeta,
} from './domCookieManipulation.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3000/';
const BUNDLE_URL = 'http://172.17.0.1:3000/main.js';
const LAB_TARGETS = ['172.17.0.1'];
const LAB_CREDS = { username: 'lab-user', password: 'lab-pass' };
const FAKE_TOKEN = 'fake-' + 'session-' + 'token';
const FAKE_SESSION = { token: FAKE_TOKEN, cookies: [] };

function labOpts(extra = {}) {
  return {
    labCreds: LAB_CREDS,
    allowWrite: true,
    labTargets: LAB_TARGETS,
    depth: 'standard',
    ...extra,
  };
}

// ---- fixtures (concatenation, never single literals) -----------------------

const BUNDLE_CLEAN =
  'const app = ' + "'demo';\n" +
  'const el = document.querySelector(' + "'#out');\n" +
  'el.textContent = ' + "'hello';\n";

const BUNDLE_THEME_WRITE =
  'const q = new URLSearchParams(location.search).get(' + "'theme');\n" +
  "document.cookie = 'theme=' + q;\n";

const BUNDLE_SESSION_WRITE =
  'const v = new URLSearchParams(location.search).get(' + "'session');\n" +
  "document.cookie = 'session=' + v;\n";

const BUNDLE_HASH_WRITE =
  'const h = location.hash.slice(1);\n' +
  "document.cookie = 'auth=' + h;\n";

const BUNDLE_COOKIES_SET =
  'const v = new URLSearchParams(location.search).get(' + "'token');\n" +
  "Cookies.set('token', v);\n";

const BUNDLE_PLAIN_WRITE =
  "document.cookie = 'x=1';\n";

// ---- fakes -----------------------------------------------------------------

// Fake fetchPage: serves one bundle body per URL.
function fakeFetchPage(bodiesByUrl) {
  return async (url) => {
    const body = Object.prototype.hasOwnProperty.call(bodiesByUrl, url) ? bodiesByUrl[url] : null;
    if (body === null) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

// Fake CDP client. `mode` decides what the canary observes:
//   'noexec'           — document.cookie never carries the marker.
//   'exec-session'     — the marker lands in a sensitive cookie
//                        (session) in the canary render only.
//   'exec-nonsensitive'— the marker lands in a non-sensitive cookie
//                        (theme) only — never a finding.
function fakeCdpClient(mode) {
  let currentUrl = '';
  const navigations = [];
  return {
    navigations,
    async newTarget() {
      return { webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/FAKE' };
    },
    async attach() {},
    async send() {
      return {};
    },
    async setCookie() {
      return {};
    },
    async addInitScript() {
      return {};
    },
    async navigate(url) {
      currentUrl = String(url);
      navigations.push(currentUrl);
      return {};
    },
    async evaluate(expr) {
      if (expr === 'document.cookie') {
        let marker = null;
        try {
          const parsed = new URL(currentUrl);
          for (const v of parsed.searchParams.values()) {
            if (v.startsWith('dmcookie-')) marker = v;
          }
          if (parsed.hash) {
            const h = decodeURIComponent(parsed.hash.slice(1));
            if (h.startsWith('dmcookie-')) marker = h;
          }
        } catch {
          // malformed URL — no marker
        }
        // The server-set cookie is present in BOTH renders with a
        // server-chosen value — the baseline the differential must
        // not confuse with a DOM write.
        let jar = 'PHPSESSID=srv-123';
        if (marker && mode === 'exec-session') jar += `; session=${marker}`;
        if (marker && mode === 'exec-nonsensitive') jar += `; theme=${marker}`;
        return jar;
      }
      return undefined;
    },
    async close() {},
  };
}

function fakeCdpConnect(mode) {
  const client = fakeCdpClient(mode);
  return async () => ({ ok: true, client });
}

// Fake docker runner: 'run' starts a container, 'rm' removes it.
function fakeRunner(calls) {
  return async (_file, args) => {
    calls.push(Array.isArray(args) ? args.slice() : args);
    if (Array.isArray(args) && args[0] === 'run') return { ok: true, stdout: 'fake-container-id\n' };
    if (Array.isArray(args) && args[0] === 'rm') return { ok: true, stdout: '' };
    return { ok: true, stdout: '' };
  };
}

function failingRunner() {
  return async () => ({ ok: false, stdout: '', stderr: 'Cannot connect to the Docker daemon' });
}

// Probe with the CDP drive faked (mode selects the observed outcome).
// `session` defaults to a lab session; pass null for the no-session case.
async function probeWithFakeCdp(mode, targets, extra = {}) {
  const calls = [];
  const diag = {};
  const session = Object.prototype.hasOwnProperty.call(extra, 'session') ? extra.session : FAKE_SESSION;
  const findings = await probeDomCookieManipulation(LAB_URL, targets, labOpts({
    fetchPage: fakeFetchPage({ [BUNDLE_URL]: extra.bundleBody || BUNDLE_CLEAN }),
    session,
    runner: fakeRunner(calls),
    cdpConnect: fakeCdpConnect(mode),
    diagnostics: diag,
  }));
  return { findings, diag, calls };
}

describe('domCookieManipulation — tier-1 mine (pure)', () => {
  it('COOKIE-1: finds document.cookie, Cookies.set and $.cookie writes with line numbers', () => {
    const body =
      "document.cookie = 'a=1';\n" +
      "Cookies.set('b', '2');\n" +
      "$.cookie('c', '3');\n";
    const writes = findCookieWrites(body);
    assert.equal(writes.length, 3);
    assert.deepEqual(writes.map((w) => w.kind), ['document.cookie', 'Cookies.set', 'jQuery.cookie']);
    assert.deepEqual(writes.map((w) => w.line), [1, 2, 3]);
    assert.ok(writes.every((w) => typeof w.snippet === 'string' && w.snippet.length > 0));
  });

  it('COOKIE-2: clean code has no writes', () => {
    assert.deepEqual(findCookieWrites(BUNDLE_CLEAN), []);
    assert.deepEqual(findCookieWrites(''), []);
    assert.deepEqual(findCookieWrites(null), []);
  });

  it('COOKIE-3: a write near location.search is query-sourced with the parameter name extracted', () => {
    const writes = findCookieWrites(BUNDLE_THEME_WRITE);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].kind, 'document.cookie');
    assert.equal(writes[0].paramSource, 'query');
    assert.equal(writes[0].nearSink, true);
    assert.deepEqual(writes[0].paramNames, ['theme']);
    assert.equal(writes[0].sensitiveName, null);
  });

  it('COOKIE-4: a write near location.hash is fragment-sourced', () => {
    const writes = findCookieWrites(BUNDLE_HASH_WRITE);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].paramSource, 'fragment');
    assert.equal(writes[0].nearSink, true);
    assert.deepEqual(writes[0].paramNames, []);
    assert.equal(writes[0].sensitiveName, 'auth');
  });

  it('COOKIE-5: a write with no parameter read has unknown source and is not near-sink', () => {
    const writes = findCookieWrites(BUNDLE_PLAIN_WRITE);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].paramSource, 'unknown');
    assert.equal(writes[0].nearSink, false);
  });

  it('COOKIE-6: a write spelling out a sensitive cookie name records it', () => {
    const writes = findCookieWrites(BUNDLE_SESSION_WRITE);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].sensitiveName, 'session');
    const setWrites = findCookieWrites(BUNDLE_COOKIES_SET);
    assert.equal(setWrites.length, 1);
    assert.equal(setWrites[0].kind, 'Cookies.set');
    assert.deepEqual(setWrites[0].paramNames, ['token']);
  });

  it('COOKIE-7: parseCookieString splits name=value pairs', () => {
    const map = parseCookieString('PHPSESSID=srv-123; session=abc; theme=dark');
    assert.equal(map.get('PHPSESSID'), 'srv-123');
    assert.equal(map.get('session'), 'abc');
    assert.equal(map.get('theme'), 'dark');
    assert.equal(parseCookieString('').size, 0);
    assert.equal(parseCookieString(null).size, 0);
  });

  it('COOKIE-8: findCanaryCookies — server-set in both renders never hits; marker in a sensitive cookie only hits in the canary render', () => {
    const control = parseCookieString('PHPSESSID=srv-123; session=srv-abc');
    const canary = parseCookieString('PHPSESSID=srv-123; session=dmcookie-a1b2c3d4');
    assert.deepEqual(findCanaryCookies(control, canary, 'dmcookie-a1b2c3d4'), [
      { name: 'session', value: 'dmcookie-a1b2c3d4' },
    ]);
    // Non-sensitive cookie carrying the marker is never a hit.
    assert.deepEqual(
      findCanaryCookies(control, parseCookieString('PHPSESSID=srv-123; theme=dmcookie-a1b2c3d4'), 'dmcookie-a1b2c3d4'),
      []
    );
    // Marker in BOTH renders is not a DOM write.
    assert.deepEqual(
      findCanaryCookies(
        parseCookieString('session=dmcookie-a1b2c3d4'),
        parseCookieString('session=dmcookie-a1b2c3d4'),
        'dmcookie-a1b2c3d4'
      ),
      []
    );
    // No marker anywhere is not a hit.
    assert.deepEqual(findCanaryCookies(control, parseCookieString('PHPSESSID=srv-123; session=other'), 'dmcookie-a1b2c3d4'), []);
  });

  it('COOKIE-9: assessCookieFlow drives only when a write exists, with the dmcookie carrier fallback', () => {
    assert.deepEqual(assessCookieFlow([]), {
      cookieSinks: 0, cookieNearSink: 0, drive: false, paramNames: [], hasFragmentWrite: false,
    });
    const flow = assessCookieFlow(findCookieWrites(BUNDLE_SESSION_WRITE));
    assert.deepEqual(flow, {
      cookieSinks: 1, cookieNearSink: 1, drive: true, paramNames: ['session'], hasFragmentWrite: false,
    });
    // Query-sourced write with no mined name drives the carrier param.
    const carrier = assessCookieFlow(findCookieWrites("const q = location.search;\ndocument.cookie = q;"));
    assert.deepEqual(carrier.paramNames, ['dmcookie']);
    // Fragment-only writes drive the fragment, never a query param.
    const frag = assessCookieFlow(findCookieWrites(BUNDLE_HASH_WRITE));
    assert.equal(frag.hasFragmentWrite, true);
    assert.deepEqual(frag.paramNames, []);
  });

  it('COOKIE-10: canary and control values — canary is alphanumeric, control is a bare token', () => {
    const rid = 'a1b2c3d4';
    assert.equal(canaryValue(rid), 'dmcookie-a1b2c3d4');
    assert.equal(controlValue(rid), 'dmcontrol-a1b2c3d4');
    assert.ok(/^[A-Za-z0-9-]+$/.test(canaryValue(rid)), 'canary must survive URL encoding and cookie parsing');
  });

  it('COOKIE-11: assessDriveResult — a canary cookie confirms, none does not', () => {
    assert.equal(assessDriveResult({ canaryCookies: [{ name: 'session' }] }).verdict, 'confirmed');
    assert.equal(assessDriveResult({ canaryCookies: [] }).verdict, 'not-executed');
  });
});

describe('domCookieManipulation — gates (fail-closed)', () => {
  it('COOKIE-12: no labCreds → no findings and fetchPage never called', async () => {
    let fetched = 0;
    const findings = await probeDomCookieManipulation(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, {
      allowWrite: true,
      labTargets: LAB_TARGETS,
      session: FAKE_SESSION,
      fetchPage: async () => { fetched += 1; return { status: 200, body: BUNDLE_SESSION_WRITE }; },
    });
    assert.deepEqual(findings, []);
    assert.equal(fetched, 0);
  });

  it('COOKIE-13: allowWrite false → no findings', async () => {
    // Control: the same fixture WOULD fire with allowWrite true, so
    // the gate is what blocks the finding here.
    const { findings: control } = await probeWithFakeCdp('exec-session', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SESSION_WRITE });
    assert.equal(control.length, 1);
    const gated = await probeDomCookieManipulation(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      allowWrite: false,
      session: FAKE_SESSION,
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SESSION_WRITE }),
    }));
    assert.deepEqual(gated, []);
  });

  it('COOKIE-14: non-lab target → no findings', async () => {
    const findings = await probeDomCookieManipulation('https://example.com/', { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SESSION_WRITE }),
      session: FAKE_SESSION,
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-session'),
    }));
    assert.deepEqual(findings, []);
  });

  it('COOKIE-15: depth quick → no findings', async () => {
    const findings = await probeDomCookieManipulation(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      depth: 'quick',
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SESSION_WRITE }),
      session: FAKE_SESSION,
      runner: fakeRunner([]),
      cdpConnect: fakeCdpConnect('exec-session'),
    }));
    assert.deepEqual(findings, []);
  });
});

describe('domCookieManipulation — probe outcomes (fake CDP drive)', () => {
  it('COOKIE-16: true negative — bundle with no cookie writes → no findings, no drive', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_CLEAN });
    assert.deepEqual(findings, []);
    assert.equal(diag.cookieSinks, 0);
    assert.equal(diag.cookieNearSink, 0);
    assert.equal(diag.driveAttempted, undefined);
    assert.equal(calls.length, 0);
  });

  it('COOKIE-17: writes exist but no lab session → no findings, no drive (authenticated surface unreached)', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('exec-session', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SESSION_WRITE, session: null });
    assert.deepEqual(findings, []);
    assert.equal(diag.cookieSinks, 1);
    assert.equal(diag.sessionOk, false);
    assert.equal(diag.driveAttempted, undefined);
    assert.equal(calls.length, 0);
  });

  it('COOKIE-18: session present but the canary never lands in a cookie → no finding, drive attempted', async () => {
    const { findings, diag, calls } = await probeWithFakeCdp('noexec', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SESSION_WRITE });
    assert.deepEqual(findings, []);
    assert.equal(diag.cookieSinks, 1);
    assert.equal(diag.cookieNearSink, 1);
    assert.equal(diag.sessionOk, true);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
    assert.ok(calls.some((a) => a[0] === 'run'), 'the drive must have started a browser');
    assert.ok(calls.some((a) => a[0] === 'rm'), 'the drive must have removed the container');
  });

  it('COOKIE-19: canary lands in the session cookie → exactly one medium finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('exec-session', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SESSION_WRITE });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].id, 'dom-cookie-manipulation');
    assert.equal(findings[0].parameter, 'session');
    assert.match(findings[0].title, /Cookie Manipulation/);
    assert.match(findings[0].evidence.request, /dmcookie-/);
    assert.match(findings[0].evidence.response, /'session' with the canary marker/);
    assert.match(findings[0].evidence.response, /server-set cookie would appear in BOTH renders/);
    assert.equal(diag.cookieSinks, 1);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, true);
  });

  it('COOKIE-20: canary lands in a non-sensitive cookie only → no finding', async () => {
    const { findings, diag } = await probeWithFakeCdp('exec-nonsensitive', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_THEME_WRITE });
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('COOKIE-21: browser fails to start → no findings, never throws', async () => {
    const diag = {};
    const findings = await probeDomCookieManipulation(LAB_URL, { bundles: [BUNDLE_URL], inline: [] }, labOpts({
      fetchPage: fakeFetchPage({ [BUNDLE_URL]: BUNDLE_SESSION_WRITE }),
      session: FAKE_SESSION,
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-session'),
      diagnostics: diag,
    }));
    assert.deepEqual(findings, []);
    assert.equal(diag.driveAttempted, true);
    assert.equal(diag.driveExecuted, false);
  });

  it('COOKIE-22: assessConfirmation judges a probe finding confirmed (default protocol)', async () => {
    const { findings } = await probeWithFakeCdp('exec-session', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SESSION_WRITE });
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });

  it('COOKIE-23: class is dom_sink, never contains xss (no xss_reflected routing trap)', async () => {
    const { findings } = await probeWithFakeCdp('exec-session', { bundles: [BUNDLE_URL], inline: [] }, { bundleBody: BUNDLE_SESSION_WRITE });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'dom_sink');
    assert.ok(!String(findings[0].class).includes('xss'));
  });
});

describe('domCookieManipulation — drive helper', () => {
  it('COOKIE-24: driveCookieManipulation returns the driven rid and cookie name for verbatim evidence', async () => {
    const calls = [];
    const out = await driveCookieManipulation(LAB_URL, ['session'], FAKE_SESSION, {
      runner: fakeRunner(calls),
      cdpConnect: fakeCdpConnect('exec-session'),
    });
    assert.equal(out.attempted, true);
    assert.equal(out.executed, true);
    assert.equal(out.cookieName, 'session');
    assert.equal(out.param, 'session');
    assert.equal(out.shape, 'query');
    assert.match(out.rid, /^[0-9a-f]{8}$/);
    assert.equal(out.canary, `dmcookie-${out.rid}`);
    assert.ok(calls.some((a) => a[0] === 'run'));
    assert.ok(calls.some((a) => a[0] === 'rm'));
  });

  it('COOKIE-25: driveCookieManipulation never throws when the runner fails', async () => {
    const out = await driveCookieManipulation(LAB_URL, ['session'], FAKE_SESSION, {
      runner: failingRunner(),
      cdpConnect: fakeCdpConnect('exec-session'),
    });
    assert.equal(out.executed, false);
    assert.ok(typeof out.error === 'string' && out.error.length > 0);
  });
});

describe('domCookieManipulation — registration metadata', () => {
  it('COOKIE-meta: phase 100 registration metadata', () => {
    assert.deepEqual(__domCookieMeta, { phases: ['dom-cookie-manipulation'], depth: ['standard', 'deep'] });
  });
});
