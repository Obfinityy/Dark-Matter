/**
 * browserApiSurface.test.js — Tests for the browser-API surface recon engine.
 *
 * Ideas 821-830: getUserMedia constraint analysis (821), screen-share endpoint
 * mapping (822), clipboard API mapping (823), notification endpoint extraction
 * (824), geolocation call mapping (825), DeviceOrientation handler mining
 * (826), vibration API detection (827), battery data-flow mapping (828),
 * Network Information API mapping (829), and Payment Request endpoint mining
 * (830). All fixtures are synthetic client-side JS shaped like real-world
 * snippets described in each analyzer's JSDoc.
 *
 * Run: cd backend && node --test tests/browserApiSurface.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeGetUserMediaConstraints,
  mapScreenShareEndpoints,
  mapClipboardApiUsage,
  extractNotificationEndpoints,
  mapGeolocationCalls,
  mineDeviceOrientationHandlers,
  detectVibrationApiUsage,
  mapBatteryDataFlow,
  mapNetworkInformationApi,
  minePaymentRequestEndpoints,
  analyzeBrowserApiSurface,
} from '../src/engines/browserApiSurface.js';

// ---------------------------------------------------------------- 821
describe('analyzeGetUserMediaConstraints (821)', () => {
  it('flags exact deviceId constraints as high risk', () => {
    const src = `navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: "abc123" } }, audio: true });`;
    const f = analyzeGetUserMediaConstraints(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].idea, 821);
    assert.equal(f[0].api, 'getUserMedia');
    assert.equal(f[0].risk, 'high');
    assert.ok(f[0].signals.some((s) => /exact deviceId/i.test(s)));
  });

  it('flags min+max resolution ranges and exact frameRate', () => {
    const src = `getUserMedia({ video: { width: { min: 1280, max: 1920 }, frameRate: { exact: 60 } } });`;
    const f = analyzeGetUserMediaConstraints(src);
    assert.ok(f[0].signals.some((s) => /min\+max resolution/i.test(s)));
    assert.ok(f[0].signals.some((s) => /frameRate/i.test(s)));
  });

  it('flags enumerateDevices label harvesting', () => {
    const src = `const devs = await navigator.mediaDevices.enumerateDevices();\nconst labels = devs.map(d => d.label);`;
    const f = analyzeGetUserMediaConstraints(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].type, 'device-enumeration');
    assert.ok(f[0].signals.some((s) => /label collection/i.test(s)));
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(analyzeGetUserMediaConstraints('const a = 1; console.log(a);'), []);
  });

  it('handles non-string input safely', () => {
    assert.deepEqual(analyzeGetUserMediaConstraints(null), []);
    assert.deepEqual(analyzeGetUserMediaConstraints(undefined), []);
  });

  it('reports the page URL in signals when given', () => {
    const src = `getUserMedia({ audio: true });`;
    const f = analyzeGetUserMediaConstraints(src, 'https://example.com/call');
    assert.ok(f[0].signals.some((s) => /example\.com\/call/.test(s)));
  });
});

// ---------------------------------------------------------------- 822
describe('mapScreenShareEndpoints (822)', () => {
  it('detects getDisplayMedia and nearby signaling URLs', () => {
    const src = [
      `const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });`,
      `const pc = new RTCPeerConnection();`,
      `await fetch("https://signal.example.com/screen/session", { method: "POST" });`,
    ].join('\n');
    const f = mapScreenShareEndpoints(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].idea, 822);
    assert.ok(f[0].urls.includes('https://signal.example.com/screen/session'));
    assert.ok(f[0].signals.some((s) => /signaling/i.test(s)));
  });

  it('detects captureStream', () => {
    const f = mapScreenShareEndpoints(`canvas.captureStream(30);`);
    assert.equal(f.length, 1);
    assert.equal(f[0].api, 'captureStream');
    assert.equal(f[0].risk, 'low');
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(mapScreenShareEndpoints('fetch("/api/data");'), []);
  });
});

// ---------------------------------------------------------------- 823
describe('mapClipboardApiUsage (823)', () => {
  it('flags clipboard read without a user gesture as high risk', () => {
    const src = `setInterval(() => { navigator.clipboard.readText().then(t => send(t)); }, 5000);`;
    const f = mapClipboardApiUsage(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].type, 'clipboard-read');
    assert.equal(f[0].risk, 'high');
  });

  it('rates gesture-tied clipboard read as medium', () => {
    const src = `btn.addEventListener('click', () => { navigator.clipboard.readText().then(t => show(t)); });`;
    const f = mapClipboardApiUsage(src);
    assert.equal(f[0].risk, 'medium');
  });

  it('flags clipboard overwrite on a non-copy gesture', () => {
    const src = `document.addEventListener('mouseover', () => { navigator.clipboard.writeText("https://evil.example/"); });`;
    const f = mapClipboardApiUsage(src);
    assert.equal(f[0].type, 'clipboard-write');
    assert.equal(f[0].risk, 'high');
    assert.ok(f[0].signals.some((s) => /paste-jacking/i.test(s)));
  });

  it('detects legacy execCommand paste', () => {
    const f = mapClipboardApiUsage(`document.execCommand('paste');`);
    assert.equal(f.length, 1);
    assert.equal(f[0].risk, 'medium');
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(mapClipboardApiUsage('localStorage.setItem("k","v");'), []);
  });
});

// ---------------------------------------------------------------- 824
describe('extractNotificationEndpoints (824)', () => {
  it('extracts the VAPID key and push-service URLs', () => {
    const src = [
      `const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: "BH8xVAPIDPUBLICKEY0123456789abcdef" });`,
      `await fetch("https://push.example.com/subscribe", { method: "POST", body: JSON.stringify(sub) });`,
      `console.log("endpoint:", sub.endpoint);`,
    ].join('\n');
    const f = extractNotificationEndpoints(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].idea, 824);
    assert.ok(f[0].urls.includes('https://push.example.com/subscribe'));
    assert.ok(f[0].signals.some((s) => /VAPID public key/i.test(s)));
    assert.ok(f[0].signals.some((s) => /subscription\.endpoint/i.test(s)));
  });

  it('detects Notification.requestPermission', () => {
    const f = extractNotificationEndpoints(`await Notification.requestPermission();`);
    assert.equal(f.length, 1);
    assert.equal(f[0].api, 'Notification.requestPermission');
    assert.equal(f[0].risk, 'low');
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(extractNotificationEndpoints('alert("hi");'), []);
  });
});

// ---------------------------------------------------------------- 825
describe('mapGeolocationCalls (825)', () => {
  it('maps position data flowing into a network sink as high risk', () => {
    const src = [
      `navigator.geolocation.getCurrentPosition((pos) => {`,
      `  const { latitude, longitude } = pos.coords;`,
      `  fetch("https://geo.example.com/checkin?lat=" + latitude + "&lon=" + longitude);`,
      `}, null, { enableHighAccuracy: true });`,
    ].join('\n');
    const f = mapGeolocationCalls(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].type, 'location-exfil');
    assert.equal(f[0].risk, 'high');
    assert.ok(f[0].urls.includes('https://geo.example.com/checkin?lat='));
    assert.ok(f[0].signals.some((s) => /enableHighAccuracy/i.test(s)));
  });

  it('detects watchPosition without sinks as lower risk', () => {
    const src = `navigator.geolocation.watchPosition(showMap);`;
    const f = mapGeolocationCalls(src);
    assert.equal(f[0].type, 'location-access');
    assert.equal(f[0].risk, 'low');
  });

  it('detects clearWatch too', () => {
    const f = mapGeolocationCalls(`navigator.geolocation.clearWatch(id);`);
    assert.equal(f[0].api, 'geolocation.clearWatch');
  });
});

// ---------------------------------------------------------------- 826
describe('mineDeviceOrientationHandlers (826)', () => {
  it('mines sensor axes and flags network sinks in the handler', () => {
    const src = [
      `window.addEventListener('deviceorientation', (e) => {`,
      `  const { alpha, beta, gamma } = e;`,
      `  fetch("https://sensors.example.com/tilt", { method: "POST", body: JSON.stringify({ alpha, beta, gamma }) });`,
      `});`,
    ].join('\n');
    const f = mineDeviceOrientationHandlers(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].idea, 826);
    assert.equal(f[0].type, 'sensor-exfil');
    assert.equal(f[0].risk, 'high');
    assert.ok(f[0].signals.some((s) => /alpha, beta, gamma/i.test(s)));
  });

  it('detects devicemotion and permission-request patterns', () => {
    const src = [
      `if (typeof DeviceMotionEvent.requestPermission === 'function') {`,
      `  await DeviceMotionEvent.requestPermission();`,
      `}`,
      `window.addEventListener('devicemotion', (e) => { handle(e.acceleration); });`,
    ].join('\n');
    const f = mineDeviceOrientationHandlers(src);
    assert.ok(f.some((x) => /permission/i.test(x.signals.join(' '))));
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(mineDeviceOrientationHandlers('window.addEventListener("click", go);'), []);
  });
});

// ---------------------------------------------------------------- 827
describe('detectVibrationApiUsage (827)', () => {
  it('detects a vibration pattern sequence', () => {
    const f = detectVibrationApiUsage(`navigator.vibrate([200, 100, 200]);`);
    assert.equal(f.length, 1);
    assert.equal(f[0].idea, 827);
    assert.ok(f[0].signals.some((s) => /pattern sequence/i.test(s)));
  });

  it('flags aggressive patterns as medium risk', () => {
    const f = detectVibrationApiUsage(`navigator.vibrate([1000,500,1000,500,1000,500,1000,500,1000,500,1000]);`);
    assert.equal(f[0].risk, 'medium');
    assert.ok(f[0].signals.some((s) => /dark-pattern/i.test(s)));
  });

  it('notes status-feedback vibration as a mobile-web feature indicator', () => {
    const src = `function onError() { navigator.vibrate(300); }`;
    const f = detectVibrationApiUsage(src);
    assert.ok(f[0].signals.some((s) => /mobile-web feature/i.test(s)));
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(detectVibrationApiUsage('navigator.geolocation.getCurrentPosition(go);'), []);
  });
});

// ---------------------------------------------------------------- 828
describe('mapBatteryDataFlow (828)', () => {
  it('detects battery data flowing into a network sink as high risk', () => {
    const src = [
      `navigator.getBattery().then((battery) => {`,
      `  const info = { level: battery.level, charging: battery.charging };`,
      `  fetch("https://fp.example.com/collect", { method: "POST", body: JSON.stringify(info) });`,
      `});`,
    ].join('\n');
    const f = mapBatteryDataFlow(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].type, 'battery-exfil-flow');
    assert.equal(f[0].risk, 'high');
    assert.ok(f[0].signals.some((s) => /reaches network sinks/i.test(s)));
  });

  it('detects battery reads without sinks as low/medium risk', () => {
    const src = `navigator.getBattery().then(b => { updateIcon(b.level); });`;
    const f = mapBatteryDataFlow(src);
    assert.equal(f[0].type, 'battery-read');
    assert.equal(f[0].risk, 'low');
  });

  it('detects destructured battery fields', () => {
    const src = [
      `navigator.getBattery().then((b) => {`,
      `  const { level, charging } = b;`,
      `  navigator.sendBeacon("https://fp.example.com/b", level + "," + charging);`,
      `});`,
    ].join('\n');
    const f = mapBatteryDataFlow(src);
    assert.equal(f[0].type, 'battery-exfil-flow');
    assert.ok(f[0].signals.some((s) => /destructured battery fields/i.test(s)));
  });

  it('detects legacy navigator battery property probes', () => {
    const f = mapBatteryDataFlow(`const c = navigator.charging;`);
    assert.equal(f.length, 1);
    assert.ok(f[0].signals.some((s) => /legacy/i.test(s)));
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(mapBatteryDataFlow('fetch("/api/status");'), []);
  });
});

// ---------------------------------------------------------------- 829
describe('mapNetworkInformationApi (829)', () => {
  it('maps adaptive-content endpoints under effectiveType branching', () => {
    const src = [
      `const conn = navigator.connection;`,
      `if (conn.effectiveType === '4g') {`,
      `  fetch("https://cdn.example.com/video/hd.mp4");`,
      `} else {`,
      `  fetch("https://cdn.example.com/video/sd.mp4");`,
      `}`,
    ].join('\n');
    const f = mapNetworkInformationApi(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].idea, 829);
    assert.equal(f[0].type, 'adaptive-endpoint');
    assert.ok(f[0].urls.includes('https://cdn.example.com/video/hd.mp4'));
    assert.ok(f[0].signals.some((s) => /effectiveType/i.test(s)));
  });

  it('notes saveData and change listeners', () => {
    const src = [
      `if (navigator.connection.saveData) { loadLite(); }`,
      `navigator.connection.addEventListener('change', onNetChange);`,
    ].join('\n');
    const f = mapNetworkInformationApi(src);
    const all = f.flatMap((x) => x.signals).join(' ');
    assert.ok(/saveData/i.test(all));
    assert.ok(/connection changes/i.test(all));
  });

  it('returns empty for unrelated source', () => {
    assert.deepEqual(mapNetworkInformationApi('navigator.onLine;'), []);
  });
});

// ---------------------------------------------------------------- 830
describe('minePaymentRequestEndpoints (830)', () => {
  it('extracts third-party payment handler URLs from method data', () => {
    const src = [
      `const methodData = [{`,
      `  supportedMethods: "https://payments.example.com/pay",`,
      `  data: { merchantId: "m123" }`,
      `}, { supportedMethods: "basic-card" }];`,
      `const req = new PaymentRequest(methodData, { total: { label: "Total", amount: { currency: "USD", value: "9.99" } } });`,
      `await req.show();`,
    ].join('\n');
    const f = minePaymentRequestEndpoints(src);
    assert.equal(f.length, 1);
    assert.equal(f[0].idea, 830);
    assert.ok(f[0].urls.includes('https://payments.example.com/pay'));
    assert.ok(f[0].signals.some((s) => /third-party payment handler/i.test(s)));
    assert.ok(f[0].signals.some((s) => /show\(\) invoked/i.test(s)));
  });

  it('notes standard methods like basic-card without URLs', () => {
    const src = `const req = new PaymentRequest([{ supportedMethods: "basic-card" }], { total: t });`;
    const f = minePaymentRequestEndpoints(src);
    assert.equal(f[0].risk, 'low');
    assert.ok(f[0].signals.some((s) => /standard payment method/i.test(s)));
  });

  it('finds confirmation endpoints near the PaymentRequest flow', () => {
    const src = [
      `const req = new PaymentRequest([{ supportedMethods: "basic-card" }], details);`,
      `const res = await req.show();`,
      `await fetch("https://shop.example.com/pay/confirm", { method: "POST", body: JSON.stringify(res) });`,
    ].join('\n');
    const f = minePaymentRequestEndpoints(src);
    assert.ok(f[0].urls.includes('https://shop.example.com/pay/confirm'));
    assert.ok(f[0].signals.some((s) => /confirmation\/webhook/i.test(s)));
  });

  it('detects canMakePayment pre-checks', () => {
    const src = `const req = new PaymentRequest(md, d);\nif (await req.canMakePayment()) { req.show(); }`;
    const f = minePaymentRequestEndpoints(src);
    assert.ok(f[0].signals.some((s) => /canMakePayment/i.test(s)));
  });
});

// ------------------------------------------------------------- combined API
describe('analyzeBrowserApiSurface (all ideas)', () => {
  it('aggregates findings across ideas and surfaces top risks', () => {
    const src = [
      `navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: "cam1" } } });`,
      `setInterval(() => navigator.clipboard.readText().then(send), 3000);`,
      `navigator.geolocation.getCurrentPosition(p => fetch("https://geo.example.com/x?" + p.coords.latitude));`,
      `navigator.vibrate(100);`,
    ].join('\n');
    const r = analyzeBrowserApiSurface(src, 'https://example.com/app');
    assert.equal(r.pageUrl, 'https://example.com/app');
    assert.ok(r.totalFindings >= 4);
    assert.ok(r.byIdea[821].length >= 1);
    assert.ok(r.byIdea[823].length >= 1);
    assert.ok(r.byIdea[825].length >= 1);
    assert.ok(r.byIdea[827].length >= 1);
    assert.ok(r.topRisks.length > 0);
    assert.equal(r.topRisks[0].risk, 'high');
  });

  it('returns an empty summary for clean source', () => {
    const r = analyzeBrowserApiSurface('const x = 42;');
    assert.equal(r.totalFindings, 0);
    assert.deepEqual(r.findings, []);
    assert.deepEqual(r.topRisks, []);
  });

  it('handles empty and non-string input', () => {
    const r = analyzeBrowserApiSurface('');
    assert.equal(r.totalFindings, 0);
    const r2 = analyzeBrowserApiSurface(null);
    assert.equal(r2.totalFindings, 0);
  });

  it('deduplicates nothing but groups every finding by idea', () => {
    const src = `navigator.vibrate(100); navigator.vibrate(200);`;
    const r = analyzeBrowserApiSurface(src);
    assert.equal(r.byIdea[827].length, 2);
    assert.equal(r.totalFindings, 2);
  });
});
