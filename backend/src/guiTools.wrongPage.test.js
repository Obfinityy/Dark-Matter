// Wrong-page guard (25 Oct 2026) — the CDP driver typed the hunt's
// probes into whatever tab happened to be first (about:blank on a
// fresh container, the owner's own frontend left open in the hunt
// browser) and reported success. getPage must pick the tab on the
// target's hosts, refuse a foreign tab with the actual URL named,
// and the type branch must honour its own field check instead of
// reporting { ok: true } on a page with no inputs.
//
// getPage and the type expression are tested from the ACTUAL
// CDP_SCRIPT (not a copy) in a vm sandbox with a fake fetch / fake
// document, in the same shape as guiTools.click.test.js; the
// wrong-page observation translation is tested end-to-end through
// the public gui functions with a stub exec.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  CDP_SCRIPT,
  wrongPageObservation,
  guiBrowserSnapshot,
  guiBrowserType,
  guiBrowserClick,
  guiBrowserScreenshot,
  resetGuiProbeCache,
} from './guiTools.js';

const TARGET_HOSTS = ['ksuite.infomaniak.com', 'login.infomaniak.com'];
const TARGET_URL = 'https://ksuite.infomaniak.com';

// --- getPage / host helpers, extracted from the real CDP_SCRIPT ---

function getPageCodeFromScript(script) {
  const start = script.indexOf('async function getPage() {');
  const end = script.indexOf('const page = await getPage();');
  assert.ok(start >= 0 && end > start, 'getPage + host helpers must be present in CDP_SCRIPT');
  return script.slice(start, end);
}

async function runGetPage({ tabs, act = 'snapshot', params = {} }) {
  const code = getPageCodeFromScript(CDP_SCRIPT);
  let list = tabs;
  const sandbox = {
    act,
    params: { targetHosts: TARGET_HOSTS, url: TARGET_URL, ...params },
    BASE: 'http://127.0.0.1:9222',
    // A fresh vm context has no URL global (real Node does); the
    // driver's hostOf needs it.
    URL,
    fetch: async (url) => {
      if (String(url).includes('/json/new')) {
        list = [...list, { type: 'page', url: 'about:blank', title: '', webSocketDebuggerUrl: 'ws://x/new' }];
      }
      return { json: async () => list };
    },
  };
  vm.createContext(sandbox);
  const result = vm.runInContext(`${code}; getPage();`, sandbox, { timeout: 1000 });
  return result;
}

const tab = (url, title = '') => ({ type: 'page', url, title, webSocketDebuggerUrl: `ws://x/${encodeURIComponent(url)}` });

test('WP-1: getPage picks the target tab even when it is NOT first', async () => {
  const page = await runGetPage({
    tabs: [
      tab('about:blank'),
      tab('https://hack.thebhavesh.online/', 'Dark Matter — Infinity AI - Chromium'),
      tab('https://ksuite.infomaniak.com/login', 'Infomaniak — Sign in'),
    ],
  });
  assert.equal(page.url, 'https://ksuite.infomaniak.com/login');
  assert.equal(page.wrongPage, undefined);
});

test('WP-2: getPage refuses with the actual URL when no tab is on target', async () => {
  const page = await runGetPage({
    tabs: [
      tab('about:blank'),
      tab('https://hack.thebhavesh.online/', 'Dark Matter — Infinity AI - Chromium'),
    ],
  });
  assert.equal(page.wrongPage, true);
  assert.equal(page.url, 'about:blank');
});

test('WP-3: getPage accepts the SSO host and subdomains, rejects lookalikes', async () => {
  const sso = await runGetPage({ tabs: [tab('about:blank'), tab('https://login.infomaniak.com/en/login', 'Sign in')] });
  assert.equal(sso.url, 'https://login.infomaniak.com/en/login');
  const lookalike = await runGetPage({ tabs: [tab('https://ksuite.infomaniak.com.evil.example/', 'trap'), tab('about:blank')] });
  assert.equal(lookalike.wrongPage, true);
  assert.equal(lookalike.url, 'https://ksuite.infomaniak.com.evil.example/');
});

test('WP-4: getPage for navigate reuses the tab on the requested host, else the first tab', async () => {
  // Reuse is by HOST, not exact URL: the login tab is on the
  // requested URL's host, so it is taken and Page.navigate moves it
  // to /dashboard.
  const reuse = await runGetPage({
    act: 'navigate',
    params: { url: 'https://ksuite.infomaniak.com/dashboard' },
    tabs: [tab('https://hack.thebhavesh.online/', 'Dark Matter'), tab('https://ksuite.infomaniak.com/login', 'Sign in')],
  });
  assert.equal(reuse.url, 'https://ksuite.infomaniak.com/login');
  const first = await runGetPage({
    act: 'navigate',
    params: { url: 'https://ksuite.infomaniak.com/login' },
    tabs: [tab('about:blank'), tab('https://hack.thebhavesh.online/', 'Dark Matter')],
  });
  // No tab on the requested host: the first tab is taken and
  // Page.navigate moves it to the target.
  assert.equal(first.url, 'about:blank');
});

// --- type branch: the field check must be honoured ---

function typeExprFromScript(script) {
  const m = /const field = await evaluate\(`\(\(\) => \{([\s\S]*?) \}\)\(\)`\);/.exec(script);
  assert.ok(m, 'type field-check expression must be present in CDP_SCRIPT');
  return m[1];
}

function runTypeExpr(exprSrc, doc) {
  const code = `(() => {${exprSrc} })()`;
  const sandbox = { document: doc };
  vm.createContext(sandbox);
  return vm.runInContext(code, sandbox, { timeout: 1000 });
}

function fakeInputDoc({ activeIsInput = false } = {}) {
  const input = {
    tagName: 'INPUT',
    isContentEditable: false,
    getBoundingClientRect: () => ({ width: 200, height: 30 }),
    scrollIntoView() { this.scrolled = true; },
    focus() { this.focused = true; },
    scrolled: false,
    focused: false,
  };
  return {
    input,
    activeElement: activeIsInput ? input : null,
    querySelectorAll: () => [input],
  };
}

test('WP-5: the type field check fails honestly on a page with no inputs', () => {
  const expr = typeExprFromScript(CDP_SCRIPT);
  const empty = runTypeExpr(expr, { activeElement: null, querySelectorAll: () => [] });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /no typeable field found/);
});

test('WP-6: the same field check passes and focuses a visible input', () => {
  const expr = typeExprFromScript(CDP_SCRIPT);
  const doc = fakeInputDoc({ activeIsInput: true });
  const result = runTypeExpr(expr, doc);
  assert.equal(result.ok, true);
  assert.equal(doc.input.focused, true);
});

// --- wrong-page observation + public-function translation ---

test('WP-7: wrongPageObservation names the actual page and the way back', () => {
  const obs = wrongPageObservation({ url: 'about:blank' }, TARGET_URL);
  assert.match(obs, /^WRONG PAGE — you are on about:blank/);
  assert.match(obs, /Do NOT type or click here/);
  assert.match(obs, new RegExp(`browser_open ${TARGET_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('WP-8: wrongPageObservation falls back gracefully without a URL', () => {
  assert.match(wrongPageObservation({}, ''), /\(unknown page\)/);
  assert.match(wrongPageObservation(null, ''), /your target/);
});

// Stub exec that puts the driver in CDP mode and answers the CDP
// script with a canned driver result, capturing the params the
// loop bound into the driver call.
function cdpStubExec(driverResult, captured) {
  return async (h, cmd, t, o) => {
    const c = String(cmd);
    if (c.includes('DMGUI_P64=')) {
      const m = /DMGUI_P64='([^']+)'/.exec(c);
      captured.params = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
      captured.action = /cdp\.mjs (\w+)/.exec(c)[1];
      return { code: 0, stdout: JSON.stringify(driverResult), stderr: '' };
    }
    if (c.includes('wc -c')) return { code: 0, stdout: '5000', stderr: '' };
    if (c.includes('json/version')) {
      return {
        code: 0,
        stdout: 'chrome=/usr/bin/chromium\ncdp={"Browser":"x","webSocketDebuggerUrl":"ws://127.0.0.1:9222/devtools/browser/y"}\nxsock=X0\n',
        stderr: '',
      };
    }
    return { code: 0, stdout: '', stderr: '' };
  };
}

test('WP-9: snapshot on a foreign tab refuses with WRONG PAGE and the driver got the target hosts', async () => {
  resetGuiProbeCache();
  const captured = {};
  const deps = {
    exec: cdpStubExec({ ok: false, error: 'wrong_page', url: 'about:blank', title: '' }, captured),
    targetHosts: TARGET_HOSTS,
    targetUrl: TARGET_URL,
  };
  const res = await guiBrowserSnapshot('h_test_wp', deps);
  assert.equal(res.ok, false);
  assert.match(res.observation, /^WRONG PAGE — you are on about:blank/);
  assert.match(res.observation, /ksuite\.infomaniak\.com/);
  assert.deepEqual(captured.params.targetHosts, TARGET_HOSTS);
  assert.equal(captured.params.targetUrl, TARGET_URL);
  assert.equal(captured.action, 'snapshot');
});

test('WP-10: type and click on a foreign tab refuse — never a fake success', async () => {
  resetGuiProbeCache();
  const wrong = { ok: false, error: 'wrong_page', url: 'https://hack.thebhavesh.online/', title: 'Dark Matter — Infinity AI - Chromium' };
  const typeRes = await guiBrowserType('h_test_wp2', 'obfinity-ml5eemlu', false, {
    exec: cdpStubExec(wrong, {}),
    targetHosts: TARGET_HOSTS,
    targetUrl: TARGET_URL,
  });
  assert.equal(typeRes.ok, false);
  assert.match(typeRes.observation, /^WRONG PAGE — you are on https:\/\/hack\.thebhavesh\.online\//);
  assert.doesNotMatch(typeRes.observation, /Type failed/);
  resetGuiProbeCache();
  const clickRes = await guiBrowserClick('h_test_wp3', 'Sign in', {
    exec: cdpStubExec(wrong, {}),
    targetHosts: TARGET_HOSTS,
    targetUrl: TARGET_URL,
  });
  assert.equal(clickRes.ok, false);
  assert.match(clickRes.observation, /^WRONG PAGE/);
  assert.doesNotMatch(clickRes.observation, /Click failed/);
});

test('WP-11: screenshot on a foreign tab refuses instead of falling back to headless', async () => {
  resetGuiProbeCache();
  // The stub answers only probe/install/CDP calls: any headless
  // fallback would hit the empty default and fail loudly, so a
  // WRONG PAGE observation proves the fallback was never attempted.
  const res = await guiBrowserScreenshot('h_test_wp4', {
    exec: cdpStubExec({ ok: false, error: 'wrong_page', url: 'about:blank', title: '' }, {}),
    targetHosts: TARGET_HOSTS,
    targetUrl: TARGET_URL,
  });
  assert.equal(res.ok, false);
  assert.match(res.observation, /^WRONG PAGE — you are on about:blank/);
  assert.equal(res.artifact, undefined);
});

test('WP-12: a real snapshot on the target still flows through unchanged', async () => {
  resetGuiProbeCache();
  const snap = {
    url: 'https://ksuite.infomaniak.com/login',
    title: 'Infomaniak — Sign in',
    text: 'Email address',
    elements: [{ tag: 'input', type: 'email', label: 'Email address', href: '', id: '', name: '', placeholder: '' }],
  };
  const res = await guiBrowserSnapshot('h_test_wp5', {
    exec: cdpStubExec(snap, {}),
    targetHosts: TARGET_HOSTS,
    targetUrl: TARGET_URL,
  });
  assert.equal(res.ok, true);
  assert.match(res.observation, /^Page: Infomaniak — Sign in — https:\/\/ksuite\.infomaniak\.com\/login/);
  assert.match(res.observation, /Email address/);
});
