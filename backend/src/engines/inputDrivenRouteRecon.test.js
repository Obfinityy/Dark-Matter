import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractKeyboardShortcutRoutes,
  mapVoiceCommandActions,
  mapGestureNavigationTargets,
  mapHapticTriggerElements,
  mapDarkModeAssetVariants,
  mapReducedMotionFallbacks,
  mapHighContrastAssets,
  mapFontLoadingStrategies,
  extractCriticalCssUrls,
  mapDeferredScriptExecutionGraph,
} from './inputDrivenRouteRecon.js';

test('921: extractKeyboardShortcutRoutes finds keydown listener bindings', () => {
  const js = `
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'k') { router.push('/search'); }
  if (e.keyCode === 27) { window.location.href = '/logout'; }
});`;
  const out = extractKeyboardShortcutRoutes(js);
  assert.equal(out.length, 2);
  assert.equal(out[0].shortcut, 'ctrl+k');
  assert.equal(out[0].route, '/search');
  assert.equal(out[1].shortcut, 'keyCode:27');
  assert.equal(out[1].route, '/logout');
  assert.ok(out[0].line >= 1);
});

test('921: extractKeyboardShortcutRoutes finds Mousetrap and keymaster bindings', () => {
  const js = `
Mousetrap.bind('g d', function() { navigate('/admin/dashboard'); });
key('shift+/', function() { showHelp(); });`;
  const out = extractKeyboardShortcutRoutes(js);
  assert.ok(out.some(f => f.shortcut === 'g d' && f.route === '/admin/dashboard'));
  assert.ok(out.some(f => f.shortcut === 'shift+/' && f.route === 'action:showHelp'));
});

test('921: extractKeyboardShortcutRoutes finds switch(e.key) dispatchers', () => {
  const js = `
window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case '1': history.push('/step-one'); break;
    case '2': history.push('/step-two'); break;
  }
});`;
  const out = extractKeyboardShortcutRoutes(js);
  assert.ok(out.some(f => f.shortcut === '1' && f.route === '/step-one'));
  assert.ok(out.some(f => f.shortcut === '2' && f.route === '/step-two'));
});

test('922: mapVoiceCommandActions finds annyang commands', () => {
  const js = `
annyang.addCommands({
  'open billing': () => { router.push('/billing'); },
  'go home': goHome
});`;
  const out = mapVoiceCommandActions(js);
  assert.equal(out.length, 2);
  assert.equal(out[0].phrase, 'open billing');
  assert.equal(out[0].route === undefined ? out[0].action : out[0].action, '/billing');
  assert.equal(out[0].framework, 'annyang');
  assert.equal(out[1].action, 'action:goHome');
});

test('922: mapVoiceCommandActions finds Web Speech API commands', () => {
  const js = `
const rec = new webkitSpeechRecognition();
rec.onresult = (ev) => {
  const t = ev.results[0][0].transcript;
  if (t.includes('delete account')) { navigate('/settings/danger'); }
};`;
  const out = mapVoiceCommandActions(js);
  assert.ok(out.some(f => f.phrase === 'delete account' && f.action === '/settings/danger' && f.framework === 'web-speech-api'));
});

test('923: mapGestureNavigationTargets finds Hammer.js swipe handlers', () => {
  const js = `
const h = new Hammer(document.getElementById('cards'));
h.on('swipeleft swiperight', function(ev) { router.push('/next-card'); });`;
  const out = mapGestureNavigationTargets(js);
  assert.ok(out.some(f => f.gesture === 'swipeleft' && f.target === '/next-card' && f.library === 'hammerjs'));
  assert.ok(out.some(f => f.gesture === 'swiperight'));
});

test('923: mapGestureNavigationTargets finds raw touch swipe navigation', () => {
  const js = `
let sx = 0;
el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; });
el.addEventListener('touchend', e => {
  if (sx - e.changedTouches[0].clientX > 80) window.location.href = '/next';
});`;
  const out = mapGestureNavigationTargets(js);
  assert.ok(out.some(f => f.gesture === 'swipe-horizontal' && f.target === '/next'));
});

test('924: mapHapticTriggerElements finds navigator.vibrate with context', () => {
  const js = `
function onLongPress() {
  const btn = document.getElementById('delete-btn');
  navigator.vibrate([50, 100, 50]);
}`;
  const out = mapHapticTriggerElements(js);
  assert.equal(out.length, 1);
  assert.equal(out[0].pattern, '[50, 100, 50]');
  assert.equal(out[0].context, 'element:delete-btn');
});

test('925: mapDarkModeAssetVariants finds media queries, selectors and picture sources', () => {
  const css = `
@media (prefers-color-scheme: dark) {
  .hero { background-image: url('/img/hero-dark.jpg'); }
}
[data-theme="dark"] .logo { content: url('/img/logo-dark.svg'); }`;
  const html = `<picture><source media="(prefers-color-scheme: dark)" srcset="/img/banner-dark.webp"><img src="/img/banner.webp"></picture>
<div class="dark:bg-slate-900 bg-white">x</div>`;
  const out = mapDarkModeAssetVariants(css + '\n' + html);
  assert.ok(out.some(f => f.kind === 'media-query' && f.assets.includes('/img/hero-dark.jpg')));
  assert.ok(out.some(f => f.kind === 'dark-selector' && f.assets.includes('/img/logo-dark.svg')));
  assert.ok(out.some(f => f.kind === 'picture-source' && f.assets.includes('/img/banner-dark.webp')));
  assert.ok(out.some(f => f.kind === 'tailwind-variant' && f.selector.includes('dark:bg-slate-900')));
});

test('926: mapReducedMotionFallbacks finds media query and matchMedia checks', () => {
  const src = `
@media (prefers-reduced-motion: reduce) {
  .anim { animation: none; background: url('/img/static-hero.png'); }
}
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { loadStatic('/img/static-hero.png'); }`;
  const out = mapReducedMotionFallbacks(src);
  assert.ok(out.some(f => f.kind === 'media-query' && f.detail.includes('animations disabled') && f.assets.includes('/img/static-hero.png')));
  assert.ok(out.some(f => f.kind === 'js-check'));
});

test('927: mapHighContrastAssets finds forced-colors links and media blocks', () => {
  const html = `<link rel="stylesheet" media="(forced-colors: active)" href="/css/hc.css">`;
  const css = `@media (forced-colors: active) {
  .btn { forced-color-adjust: none; border: 2px solid ButtonText; }
}`;
  const out = mapHighContrastAssets(html + '\n' + css);
  assert.ok(out.some(f => f.kind === 'stylesheet' && f.href === '/css/hc.css'));
  assert.ok(out.some(f => f.kind === 'media-query' && f.detail.includes('forced-color-adjust:none')));
});

test('928: mapFontLoadingStrategies groups strategies per host', () => {
  const css = `
@font-face { font-family: 'Inter'; font-display: swap; src: url('https://fonts.gstatic.com/inter.woff2') format('woff2'); }
@font-face { font-family: 'Brand'; font-display: block; src: url('/fonts/brand.woff2') format('woff2'); }`;
  const html = `<link rel="preconnect" href="https://fonts.googleapis.com">`;
  const out = mapFontLoadingStrategies(css + '\n' + html);
  const gstatic = out.find(f => f.host === 'fonts.gstatic.com');
  assert.ok(gstatic && gstatic.strategy === 'swap' && gstatic.families.includes('Inter'));
  const local = out.find(f => f.host === '(same-origin)' && f.strategy === 'block');
  assert.ok(local && local.families.includes('Brand'));
  assert.ok(out.some(f => f.strategy === 'link-hint:preconnect' && f.host === 'fonts.googleapis.com'));
});

test('929: extractCriticalCssUrls finds preload and blocking stylesheets', () => {
  const html = `
<link rel="preload" as="style" href="/css/critical.css">
<link rel="stylesheet" href="/css/main.css">
<link rel="stylesheet" media="print" href="/css/print.css">
<style data-critical>.hero{color:red}</style>`;
  const out = extractCriticalCssUrls(html);
  assert.ok(out.some(f => f.url === '/css/critical.css' && f.kind === 'preload-style'));
  assert.ok(out.some(f => f.url === '/css/main.css' && f.kind === 'blocking-stylesheet'));
  assert.ok(!out.some(f => f.url === '/css/print.css'));
  assert.ok(out.some(f => f.kind === 'inline-critical' && f.url === null));
});

test('930: mapDeferredScriptExecutionGraph builds order and edges', () => {
  const html = `
<script src="/js/vendor.js"></script>
<script src="/js/app.js" defer></script>
<script src="/js/lazy.js" defer></script>
<script src="/js/track.js" async></script>
<script type="module" src="/js/mod.js"></script>`;
  const { scripts, edges } = mapDeferredScriptExecutionGraph(html);
  assert.equal(scripts.length, 5);
  assert.deepEqual(scripts.map(s => s.kind), ['blocking', 'deferred', 'deferred', 'async', 'module-deferred']);
  const vendor = scripts[0], app = scripts[1], lazy = scripts[2], mod = scripts[4];
  assert.ok(vendor.execOrder < app.execOrder, 'blocking runs before deferred');
  assert.ok(app.execOrder < lazy.execOrder && lazy.execOrder < mod.execOrder, 'deferred run in document order');
  assert.ok(edges.some(e => e.from === app.order && e.to === lazy.order && e.relation === 'executes-after'));
  assert.ok(edges.some(e => e.to === app.order && e.relation === 'after-dom-parse'));
});
