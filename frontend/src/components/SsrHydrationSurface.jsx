/**
 * SsrHydrationSurface.jsx — demo surface for the SSR/hydration recon engine.
 *
 * Export-only demo (not wired into any page): paste a target's public HTML/JS
 * and inspect what the ssrHydrationSurface engine extracts — async scripts,
 * modulepreload graphs, preload-scanner hints, fetchpriority signals, hydration
 * boundaries, island components, hydration triggers, RSC payloads, Flight rows
 * and Turbopack chunks. Ideas 931–940. Signed: Infinity AI.
 */
import { useMemo, useState } from 'react';
import './SsrHydrationSurface.css';
import {
  mapAsyncScriptDependencies,
  extractModulePreloadGraph,
  analyzePreloadScannerHints,
  mapFetchPriorityHints,
  mapLazyHydrationBoundaries,
  mapIslandArchitectureComponents,
  mapPartialHydrationTriggers,
  mineServerComponentPayloads,
  analyzeRscFlightProtocol,
  mapTurbopackChunks,
} from '../../../backend/src/engines/ssrHydrationSurface.js';

const SAMPLE = `<!DOCTYPE html>
<html><head>
<link rel="preload" href="/css/critical.css" as="style">
<link rel="preload" href="/fonts/app.woff2" as="font" crossorigin fetchpriority="high">
<link rel="modulepreload" href="/_next/static/chunks/app.js">
<script async src="https://cdn.example.com/vendor/analytics.js"></script>
<script defer src="/js/app.js" integrity="sha384-abc"></script>
<script>self.__next_f.push([1,"0:I[\\"abc\\",\\"app/page\\",\\"\\"]\\n3:\\"/api/products\\""]);</script>
<script id="__NEXT_DATA__" type="application/json">{"page":"/shop"}</script>
</head><body>
<div id="__next"><!--$--><main><!--/$--></main></div>
<img src="/img/hero.jpg" fetchpriority="high">
<astro-island component-url="/_astro/Cart.D123.js" props="{&quot;api&quot;:&quot;/api/cart&quot;}"></astro-island>
</body></html>`;

function Section({ title, count, children }) {
  return (
    <section className="w921b-section">
      <h3 className="w921b-section-title">
        {title} <span className="w921b-count">{count}</span>
      </h3>
      <div className="w921b-section-body">{children}</div>
    </section>
  );
}

function Json({ value }) {
  return <pre className="w921b-json">{JSON.stringify(value, null, 2)}</pre>;
}

export default function SsrHydrationSurface() {
  const [input, setInput] = useState(SAMPLE);
  const [ran, setRan] = useState(false);

  const results = useMemo(() => {
    if (!ran) return null;
    const text = input || '';
    return {
      asyncScripts: mapAsyncScriptDependencies(text),
      preloadGraph: extractModulePreloadGraph(text),
      scannerHints: analyzePreloadScannerHints(text),
      fetchPriority: mapFetchPriorityHints(text),
      hydration: mapLazyHydrationBoundaries(text),
      islands: mapIslandArchitectureComponents(text),
      triggers: mapPartialHydrationTriggers(text),
      rscPayloads: mineServerComponentPayloads(text),
      flight: analyzeRscFlightProtocol(text),
      turbopack: mapTurbopackChunks(text),
    };
  }, [input, ran]);

  return (
    <div className="w921b-root">
      <header className="w921b-header">
        <h2 className="w921b-title">SSR / Hydration Surface Recon</h2>
        <p className="w921b-sub">
          Client-asset surface mapping for authorized targets — paste the target's public
          HTML or bundled JS (ideas 931–940).
        </p>
      </header>

      <textarea
        className="w921b-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        aria-label="Page HTML or JS to analyze"
        rows={10}
      />
      <div className="w921b-actions">
        <button className="w921b-btn w921b-btn-primary" onClick={() => setRan(true)}>
          Analyze surface
        </button>
        <button
          className="w921b-btn"
          onClick={() => { setInput(SAMPLE); setRan(true); }}
        >
          Load sample
        </button>
        <button className="w921b-btn" onClick={() => setRan(false)}>
          Clear
        </button>
      </div>

      {results && (
        <div className="w921b-results">
          <Section title="931 · Async script dependencies" count={results.asyncScripts.length}>
            <Json value={results.asyncScripts} />
          </Section>
          <Section
            title="932 · Modulepreload graph"
            count={results.preloadGraph.preloads.length + results.preloadGraph.edges.length}
          >
            <Json value={results.preloadGraph} />
          </Section>
          <Section title="933 · Preload-scanner hints" count={results.scannerHints.priorityAssets.length}>
            <Json value={results.scannerHints} />
          </Section>
          <Section title="934 · Fetch-priority hints" count={results.fetchPriority.hints.length}>
            <Json value={results.fetchPriority} />
          </Section>
          <Section title="935 · Hydration boundaries" count={results.hydration.boundaries.length}>
            <p className="w921b-note">Framework: {results.hydration.framework || 'unknown'}</p>
            <Json value={results.hydration.boundaries} />
          </Section>
          <Section title="936 · Island components" count={results.islands.length}>
            <Json value={results.islands} />
          </Section>
          <Section title="937 · Hydration triggers" count={results.triggers.length}>
            <Json value={results.triggers} />
          </Section>
          <Section title="938 · RSC payload endpoints" count={results.rscPayloads.length}>
            <Json value={results.rscPayloads} />
          </Section>
          <Section title="939 · Flight protocol rows" count={results.flight.rows.length}>
            <Json value={results.flight} />
          </Section>
          <Section title="940 · Turbopack chunks" count={results.turbopack.length}>
            <Json value={results.turbopack} />
          </Section>
        </div>
      )}
    </div>
  );
}
