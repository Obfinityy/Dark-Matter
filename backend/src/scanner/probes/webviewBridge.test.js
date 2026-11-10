// WebView JavaScript bridge probe tests (row #511 [High] WebView
// JavaScript bridge abuse, CWE-749; phase 114, 'webview-bridge').
//
// A finding fires ONLY on a bridge registration PLUS a reachable
// call path: the call's argument must come from
// attacker-controllable input (URL parameter, input value,
// postMessage data) or sit inside a message-event handler that
// reads event data. A registered bridge with no reachable call,
// and a call with no registration, both stay quiet.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeWebViewBridge,
  scanBridgeRegistrations,
  scanBridgeCallSites,
  findTaintedVars,
  assessBridgeReachability,
  scanWebViewBridges,
  blankStringsAndComments,
  __webviewBridgeMeta,
} from './webviewBridge.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'https://example.com/app';

// Android: bridge registered, called with a URL parameter.
const ANDROID_FLOW_BODY = `
webView.addJavascriptInterface(nativeObj, "Android");
const cmd = new URLSearchParams(location.search).get('cmd');
Android.runCommand(cmd);
`;

// iOS: message handler called with an input-field value.
const IOS_FLOW_BODY = `
const msg = document.getElementById('msg').value;
window.webkit.messageHandlers.AppBridge.postMessage(msg);
`;

// Message-event handler: the bridge call runs on incoming
// postMessage data (the handler reads event.data; the call
// itself takes a literal argument).
const HANDLER_FLOW_BODY = `
webView.addJavascriptInterface(nativeObj, "NativeBridge");
window.addEventListener('message', (event) => {
  const d = event.data;
  console.log(d);
  NativeBridge.handle('ping');
});
`;

// Nonsense control: registered bridge, called with a literal.
const REGISTERED_QUIET_BODY = `
webView.addJavascriptInterface(nativeObj, "Android");
Android.getVersion();
`;

// Call with attacker input but no registration anywhere.
const UNREGISTERED_BODY = `
const cmd = new URLSearchParams(location.search).get('cmd');
Android.runCommand(cmd);
`;

function mockFetchPage(bodiesByUrl) {
  return async (url) => {
    const body = bodiesByUrl[url];
    if (body === undefined) return { status: 404, body: '' };
    return { status: 200, body };
  };
}

// ---- pure helpers ------------------------------------------------------------

test('WB-1: scanBridgeRegistrations finds Android, iOS and JSBridge registrations', () => {
  const regs = scanBridgeRegistrations(`
    webView.addJavascriptInterface(nativeObj, "Android");
    window.webkit.messageHandlers.AppBridge.postMessage({});
    WebViewJavascriptBridge.registerHandler("share", function(data) {});
  `);
  assert.deepEqual(
    regs.map((r) => `${r.kind}:${r.name}`).sort(),
    ['android:Android', 'ios:AppBridge', 'jsbridge:share'],
  );
});

test('WB-2: commented-out registrations do not register', () => {
  const regs = scanBridgeRegistrations(`
    // webView.addJavascriptInterface(nativeObj, "Android");
    /* webView.addJavascriptInterface(nativeObj, "Hidden"); */
  `);
  assert.equal(regs.length, 0);
});

test('WB-3: findTaintedVars tracks URL, input and postMessage sources', () => {
  const tainted = findTaintedVars(`
    const cmd = new URLSearchParams(location.search).get('cmd');
    const msg = document.getElementById('msg').value;
    const d = event.data;
    const chained = cmd;
  `);
  assert.equal(tainted.get('cmd'), 'url parameter');
  assert.equal(tainted.get('msg'), 'input value');
  assert.equal(tainted.get('d'), 'postMessage data');
  assert.equal(tainted.get('chained'), 'url parameter');
});

test('WB-4: scanBridgeCallSites finds window, bare and webkit call sites', () => {
  const sites = scanBridgeCallSites(`
    window.Android.runCommand(cmd);
    NativeBridge.handle(data);
    window.webkit.messageHandlers.AppBridge.postMessage(msg);
  `);
  assert.deepEqual(
    sites.map((s) => `${s.bridge}.${s.method}`).sort(),
    ['Android.runCommand', 'AppBridge.postMessage', 'NativeBridge.handle'],
  );
});

test('WB-5: assessBridgeReachability confirms on a tainted argument', () => {
  const tainted = new Map([['cmd', 'url parameter']]);
  const v = assessBridgeReachability({
    argText: 'cmd',
    offset: 0,
    tainted,
    handlerSpans: [],
    blanked: '',
  });
  assert.equal(v.verdict, 'confirmed');
  assert.match(v.via, /url parameter/);
});

test('WB-6: assessBridgeReachability rejects an untainted call', () => {
  const v = assessBridgeReachability({
    argText: "'ping'",
    offset: 0,
    tainted: new Map(),
    handlerSpans: [],
    blanked: '',
  });
  assert.equal(v.verdict, 'rejected');
});

test('WB-7: assessBridgeReachability confirms inside a data-reading message handler', () => {
  const blanked = blankStringsAndComments(HANDLER_FLOW_BODY);
  const sites = scanBridgeCallSites(HANDLER_FLOW_BODY);
  const site = sites.find((s) => s.bridge === 'NativeBridge');
  assert.ok(site);
  const v = assessBridgeReachability({
    argText: site.argText,
    offset: site.offset,
    tainted: new Map([['d', 'postMessage data']]),
    handlerSpans: [[0, blanked.length]],
    blanked,
  });
  assert.equal(v.verdict, 'confirmed');
});

test('WB-8: blankStringsAndComments blanks strings and comments', () => {
  const blanked = blankStringsAndComments(`
    // Android.runCommand(cmd);
    const s = "Android.runCommand(cmd);";
    Android.runCommand(cmd);
  `);
  assert.equal((blanked.match(/Android\.runCommand/g) || []).length, 1);
});

// ---- bridge scanning ---------------------------------------------------------

test('WB-9: Android flow confirms with registration and call path', () => {
  const scan = scanWebViewBridges(ANDROID_FLOW_BODY);
  assert.equal(scan.reachable.length, 1);
  assert.equal(scan.reachable[0].bridge, 'Android');
  assert.equal(scan.reachable[0].method, 'runCommand');
  assert.equal(scan.reachable[0].registration.kind, 'android');
  assert.match(scan.reachable[0].via, /url parameter/);
});

test('WB-10: iOS message-handler flow confirms', () => {
  const scan = scanWebViewBridges(IOS_FLOW_BODY);
  assert.equal(scan.reachable.length, 1);
  assert.equal(scan.reachable[0].bridge, 'AppBridge');
  assert.equal(scan.reachable[0].method, 'postMessage');
});

test('WB-11: message-handler span confirms a literal-argument call', () => {
  const scan = scanWebViewBridges(HANDLER_FLOW_BODY);
  assert.equal(scan.reachable.length, 1);
  assert.equal(scan.reachable[0].bridge, 'NativeBridge');
  assert.match(scan.reachable[0].via, /message-event handler/);
});

test('WB-12: registered bridge with no reachable call stays quiet', () => {
  const scan = scanWebViewBridges(REGISTERED_QUIET_BODY);
  assert.equal(scan.registrations.length, 1);
  assert.equal(scan.callSites.length, 1);
  assert.equal(scan.reachable.length, 0);
});

test('WB-13: call with attacker input but no registration stays quiet', () => {
  const scan = scanWebViewBridges(UNREGISTERED_BODY);
  assert.equal(scan.callSites.length, 1);
  assert.equal(scan.reachable.length, 0);
});

test('WB-14: commented-out registration and call stay quiet', () => {
  const scan = scanWebViewBridges(`
    // webView.addJavascriptInterface(nativeObj, "Android");
    // const cmd = new URLSearchParams(location.search).get('cmd');
    // Android.runCommand(cmd);
  `);
  assert.equal(scan.reachable.length, 0);
});

test('WB-15: probe meta names the phase and all depths', () => {
  assert.deepEqual(__webviewBridgeMeta.phases, ['webview-bridge']);
  assert.deepEqual(__webviewBridgeMeta.depth, ['quick', 'standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('WB-16: planted Android flow files one confirmed finding', async () => {
  const findings = await probeWebViewBridge(PAGE, { bundles: [], inline: [ANDROID_FLOW_BODY] }, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'webview_bridge_abuse');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].parameter, 'Android');
  assert.match(findings[0].title, /Android/);
  assert.ok(findings[0].evidence.signalCorrelated);
  assert.match(findings[0].evidence.response, /addJavascriptInterface/);
  assert.match(findings[0].evidence.response, /runCommand/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.filter((f) => f.class === 'webview_bridge_abuse').length, 1);
});

test('WB-17: iOS flow files one finding', async () => {
  const findings = await probeWebViewBridge(PAGE, { bundles: [], inline: [IOS_FLOW_BODY] }, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].parameter, 'AppBridge');
});

test('WB-18: quiet bodies stay quiet', async () => {
  const findings = await probeWebViewBridge(
    PAGE,
    { bundles: [], inline: [REGISTERED_QUIET_BODY, UNREGISTERED_BODY] },
    {},
  );
  assert.equal(findings.length, 0);
});

test('WB-19: bundle flow fires via the fetchPage seam; vendor bundle is skipped', async () => {
  const fetchPage = mockFetchPage({
    'https://example.com/app.js': ANDROID_FLOW_BODY,
    'https://example.com/static/vendor.bundle.js': ANDROID_FLOW_BODY,
  });
  const findings = await probeWebViewBridge(
    PAGE,
    { bundles: ['https://example.com/app.js', 'https://example.com/static/vendor.bundle.js'], inline: [] },
    { fetchPage },
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].url, 'https://example.com/app.js');
});

test('WB-20: diagnostics record registrations, call sites and reachable calls', async () => {
  const diag = {};
  await probeWebViewBridge(PAGE, { bundles: [], inline: [ANDROID_FLOW_BODY] }, { diagnostics: diag });
  assert.equal(diag.bridgesRegistered, 1);
  assert.equal(diag.callSites, 1);
  assert.equal(diag.reachableCalls, 1);
});

test('WB-21: no targets means no findings', async () => {
  const findings = await probeWebViewBridge(PAGE, { bundles: [], inline: [] }, {});
  assert.equal(findings.length, 0);
});

test('WB-22: invalid page URL stays quiet and never throws', async () => {
  const findings = await probeWebViewBridge('not a url', { bundles: [], inline: [ANDROID_FLOW_BODY] }, {});
  assert.equal(findings.length, 0);
});
