import { useState } from 'react';
import './InputRouteRecon.css';
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
} from '../../backend/src/engines/inputDrivenRouteRecon.js';

const SAMPLE = `document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'k') { router.push('/search'); }
  if (e.keyCode === 27) { window.location.href = '/logout'; }
});
Mousetrap.bind('g d', function() { navigate('/admin/dashboard'); });
annyang.addCommands({ 'open billing': () => { router.push('/billing'); } });
const h = new Hammer(document.getElementById('cards'));
h.on('swipeleft', function() { router.push('/next-card'); });
function onLongPress() { navigator.vibrate([50, 100, 50]); }
@media (prefers-color-scheme: dark) { .hero { background-image: url('/img/hero-dark.jpg'); } }
@media (prefers-reduced-motion: reduce) { .anim { animation: none; } }
@font-face { font-family: 'Inter'; font-display: swap; src: url('https://fonts.gstatic.com/inter.woff2'); }
<link rel="preload" as="style" href="/css/critical.css">
<script src="/js/vendor.js"></script>
<script src="/js/app.js" defer></script>
<script src="/js/track.js" async></script>`;

const ANALYSERS = [
  ['921 · Keyboard shortcuts', extractKeyboardShortcutRoutes],
  ['922 · Voice commands', mapVoiceCommandActions],
  ['923 · Gestures', mapGestureNavigationTargets],
  ['924 · Haptic triggers', mapHapticTriggerElements],
  ['925 · Dark-mode assets', mapDarkModeAssetVariants],
  ['926 · Reduced-motion fallbacks', mapReducedMotionFallbacks],
  ['927 · High-contrast assets', mapHighContrastAssets],
  ['928 · Font loading strategies', mapFontLoadingStrategies],
  ['929 · Critical CSS URLs', extractCriticalCssUrls],
  ['930 · Deferred script graph', mapDeferredScriptExecutionGraph],
];

export default function InputRouteRecon() {
  const [source, setSource] = useState(SAMPLE);
  const [results, setResults] = useState(null);

  const run = () => {
    const out = {};
    for (const [label, fn] of ANALYSERS) {
      try {
        out[label] = fn(source);
      } catch (err) {
        out[label] = { error: String(err && err.message ? err.message : err) };
      }
    }
    setResults(out);
  };

  return (
    <div className="w921a-root">
      <h2 className="w921a-title">Input-Driven Route &amp; Asset Surface Recon</h2>
      <p className="w921a-sub">
        Paste a target page&apos;s HTML / JS / CSS and map hidden navigation surfaces:
        keyboard shortcuts, voice commands, gestures, haptic triggers and adaptive asset variants.
      </p>
      <textarea
        className="w921a-input"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={14}
        spellCheck={false}
        aria-label="HTML, JS or CSS source to analyse"
      />
      <button className="w921a-run" type="button" onClick={run}>
        Analyse surface
      </button>
      {results && (
        <div className="w921a-results">
          {Object.entries(results).map(([label, data]) => {
            const items = Array.isArray(data) ? data : data.scripts || [];
            return (
              <section key={label} className="w921a-card">
                <h3 className="w921a-card-title">
                  {label}
                  <span className="w921a-count">{items.length} finding{items.length === 1 ? '' : 's'}</span>
                </h3>
                {items.length === 0 ? (
                  <p className="w921a-empty">No matches in the provided source.</p>
                ) : (
                  <pre className="w921a-json">{JSON.stringify(data, null, 2)}</pre>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
