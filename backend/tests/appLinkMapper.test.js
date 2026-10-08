/**
 * appLinkMapper.test.js — deterministic unit tests for appLinkMapper.js
 * (idea-bank ideas 871–880). All fixtures are inline; no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapPwaInstallRoutes,
  extractSmartAppBannerUrls,
  mapUniversalLinks,
  mapAndroidAppLinks,
  enumerateDeepLinkSchemes,
  extractBranchDomains,
  mapFirebaseDynamicLinkDomains,
  extractAdjustTrackers,
  mapAppsFlyerOneLinkDomains,
  extractKochavaTrackers,
  mapAppLinkSurface,
} from '../src/engines/appLinkMapper.js';

// --- 871 --------------------------------------------------------------------

test('871: mapPwaInstallRoutes reads manifest entry points + install signals', () => {
  const manifest = JSON.stringify({
    name: 'Shop', start_url: '/app/', scope: '/app/',
    shortcuts: [{ name: 'Cart', url: '/app/cart' }, { name: 'Deals', url: '/app/deals' }],
  });
  const js = `
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
    deferredPrompt.userChoice.then(() => {});
    navigator.serviceWorker.register('/sw.js');
    window.addEventListener('appinstalled', () => {});
  `;
  const r = mapPwaInstallRoutes(manifest, js);
  assert.equal(r.startUrl, '/app/');
  assert.equal(r.scope, '/app/');
  assert.deepEqual(r.shortcuts, [
    { name: 'Cart', url: '/app/cart' },
    { name: 'Deals', url: '/app/deals' },
  ]);
  assert.ok(r.installSignals.includes('beforeinstallprompt'));
  assert.ok(r.installSignals.includes('deferredprompt'));
  assert.ok(r.installSignals.includes('appinstalled'));
  assert.equal(r.serviceWorkerRegistered, true);
  assert.deepEqual(r.entryRoutes, ['/app/', '/app/cart', '/app/deals']);
});

test('871: mapPwaInstallRoutes tolerates missing manifest gracefully', () => {
  const r = mapPwaInstallRoutes(null, 'var x = 1;');
  assert.equal(r.startUrl, null);
  assert.equal(r.scope, null);
  assert.deepEqual(r.shortcuts, []);
  assert.deepEqual(r.installSignals, []);
  assert.equal(r.serviceWorkerRegistered, false);
});

// --- 872 --------------------------------------------------------------------

test('872: extractSmartAppBannerUrls parses iTunes + Play banners', () => {
  const html = `
    <meta name="apple-itunes-app" content="app-id=123456789, affiliate-data=myAff, app-argument=shopapp://product/42">
    <meta name="google-play-app" content="app-id=com.example.shop">
  `;
  const r = extractSmartAppBannerUrls(html);
  assert.equal(r.apple.appId, '123456789');
  assert.equal(r.apple.affiliateData, 'myAff');
  assert.equal(r.apple.appArgument, 'shopapp://product/42');
  assert.equal(r.googlePlay.appId, 'com.example.shop');
  assert.ok(r.urls.includes('https://apps.apple.com/app/id123456789'));
  assert.ok(r.urls.includes('shopapp://product/42'));
  assert.ok(r.urls.includes('https://play.google.com/store/apps/details?id=com.example.shop'));
});

test('872: extractSmartAppBannerUrls returns nulls when no banners', () => {
  const r = extractSmartAppBannerUrls('<html><head><title>x</title></head></html>');
  assert.equal(r.apple, null);
  assert.equal(r.googlePlay, null);
  assert.deepEqual(r.urls, []);
});

// --- 873 --------------------------------------------------------------------

test('873: mapUniversalLinks parses legacy paths with NOT exclusions', () => {
  const aasa = JSON.stringify({
    applinks: {
      details: [{
        appID: 'TEAM1234.com.example.shop',
        paths: ['/shop/*', '/checkout/*', 'NOT /shop/internal/*'],
      }],
    },
  });
  const r = mapUniversalLinks(aasa);
  assert.equal(r.length, 1);
  assert.equal(r[0].apps[0].teamId, 'TEAM1234');
  assert.equal(r[0].apps[0].bundleId, 'com.example.shop');
  assert.deepEqual(r[0].includes, ['/shop/*', '/checkout/*']);
  assert.deepEqual(r[0].excludes, ['/shop/internal/*']);
  assert.equal(r[0].routes.length, 3);
});

test('873: mapUniversalLinks parses modern components format', () => {
  const aasa = {
    applinks: {
      details: [{
        appID: 'TEAM9.com.example.app',
        components: [
          { '/': '/items/*', '#exclude': true },
          { '/': '/public/*', comment: 'open area' },
        ],
      }],
    },
  };
  const r = mapUniversalLinks(aasa);
  assert.equal(r.length, 1);
  assert.ok(r[0].excludes.some((x) => x.includes('/items/*')));
  assert.ok(r[0].includes.some((x) => x.includes('/public/*')));
});

// --- 874 --------------------------------------------------------------------

test('874: mapAndroidAppLinks parses assetlinks statements', () => {
  const assetlinks = JSON.stringify([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.example.shop',
      sha256_cert_fingerprints: ['AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89'],
    },
  }]);
  const r = mapAndroidAppLinks(assetlinks);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].relations, ['delegate_permission/common.handle_all_urls']);
  assert.equal(r[0].namespace, 'android_app');
  assert.equal(r[0].packageName, 'com.example.shop');
  assert.equal(r[0].sha256Fingerprints.length, 1);
  assert.ok(/^[0-9A-F]{64}$/.test(r[0].sha256Fingerprints[0]));
});

// --- 875 --------------------------------------------------------------------

test('875: enumerateDeepLinkSchemes finds custom schemes, skips known protocols', () => {
  const js = `
    window.location = "shopapp://product/42?ref=web";
    var a = 'https://example.com/x';
    var b = "mailto:help@example.com";
    var c = 'javascript:void(0)';
    var u = "intent://scan/#Intent;scheme=shopapp;package=com.example.shop;end";
  `;
  const r = enumerateDeepLinkSchemes(js);
  assert.deepEqual(r.schemes, ['shopapp']);
  assert.ok(r.deepLinks.includes('shopapp://product/42?ref=web'));
  assert.equal(r.intentUris.length, 1);
  assert.ok(!r.deepLinks.some((d) => d.startsWith('https://')));
  assert.ok(!r.deepLinks.some((d) => d.startsWith('mailto:')));
});

// --- 876 --------------------------------------------------------------------

test('876: extractBranchDomains finds app.link hosts and keys', () => {
  const js = `
    var branch_key = "key_live_abcdefghijklmnopqrstuvwxyz12";
    branch.init('key_live_abcdefghijklmnopqrstuvwxyz12');
    link_domain: "go.example.com",
    fetch('https://example.app.link/aBcDeF');
    fetch('https://api2.branch.io/v1/open');
  `;
  const r = extractBranchDomains(js);
  assert.ok(r.domains.includes('example.app.link'));
  assert.ok(r.domains.includes('go.example.com'));
  assert.deepEqual(r.branchKeys, ['key_live_abcdefghijklmnopqrstuvwxyz12']);
  assert.ok(r.apiHosts.includes('api2.branch.io'));
});

// --- 877 --------------------------------------------------------------------

test('877: mapFirebaseDynamicLinkDomains finds page.link domains', () => {
  const html = `
    <a href="https://example.page.link/welcome">open app</a>
    firebase.dynamicLinks().buildLink(...);
  `;
  const r = mapFirebaseDynamicLinkDomains(html);
  assert.deepEqual(r.pageLinkDomains, ['example.page.link']);
  assert.equal(r.apiUsed, true);
});

test('877: mapFirebaseDynamicLinkDomains detects custom domains near firebase code', () => {
  const html = `
    const cfg = firebaseConfig;
    const link = "https://go.example.com/dl/abc";
  `;
  const r = mapFirebaseDynamicLinkDomains(html);
  assert.ok(r.customDomains.includes('go.example.com'));
});

// --- 878 --------------------------------------------------------------------

test('878: extractAdjustTrackers mines tracker tokens and URLs', () => {
  const js = `
    var tracker = "https://app.adjust.com/abc123xy?campaign=summer";
    var plain = "https://adjust.com/def456gh";
    AdjustSDK.init();
  `;
  const r = extractAdjustTrackers(js);
  assert.ok(r.tokens.includes('abc123xy'));
  assert.ok(r.tokens.includes('def456gh'));
  assert.ok(r.trackerUrls.includes('https://app.adjust.com/abc123xy?campaign=summer'));
  assert.ok(r.trackerUrls.includes('https://adjust.com/def456gh'));
  assert.equal(r.sdkDetected, true);
});

// --- 879 --------------------------------------------------------------------

test('879: mapAppsFlyerOneLinkDomains finds OneLink domains and key signals', () => {
  const html = `
    <script src="https://onelinksmartscript.appsflyer.com/onelink/v2?..."></script>
    <a href="https://go.example.onelink.me/Ab12Cd">install</a>
    appsflyer_key = "XyZ12345-AbCdEf";
  `;
  const r = mapAppsFlyerOneLinkDomains(html);
  assert.ok(r.domains.includes('go.example.onelink.me'));
  assert.equal(r.sdkDetected, true);
  assert.deepEqual(r.webKeySignals, ['appsflyer_key_present']);
});

// --- 880 --------------------------------------------------------------------

test('880: extractKochavaTrackers finds kochava hosts and URLs', () => {
  const html = `
    <script src="https://control.kochava.com/v1.0/track.js"></script>
    <img src="https://imp.kochava.net/pixel?a=1">
  `;
  const r = extractKochavaTrackers(html);
  assert.ok(r.hosts.includes('control.kochava.com'));
  assert.ok(r.hosts.includes('imp.kochava.net'));
  assert.ok(r.trackerUrls.some((u) => u.includes('control.kochava.com')));
  assert.equal(r.sdkDetected, true);
});

// --- aggregate ---------------------------------------------------------------

test('aggregate: mapAppLinkSurface combines all engines', () => {
  const r = mapAppLinkSurface({
    manifestJson: JSON.stringify({ start_url: '/app/' }),
    html: '<meta name="apple-itunes-app" content="app-id=999">',
    aasaJson: JSON.stringify({
      applinks: { details: [{ appID: 'T.com.x', paths: ['/a/*'] }] },
    }),
    assetlinksJson: JSON.stringify([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: 'com.x', sha256_cert_fingerprints: [] },
    }]),
    jsSource: 'location.href="myapp://open"; fetch("https://x.app.link/a");',
  });
  assert.equal(r.pwa.startUrl, '/app/');
  assert.equal(r.banners.apple.appId, '999');
  assert.equal(r.universal.length, 1);
  assert.equal(r.android.length, 1);
  assert.deepEqual(r.schemes.schemes, ['myapp']);
  assert.ok(r.branch.domains.includes('x.app.link'));
  assert.ok(r.notes.length >= 5);
});
