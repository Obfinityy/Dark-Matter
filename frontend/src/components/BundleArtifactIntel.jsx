import { useMemo, useState } from 'react';
import {
  mineSwcTransformArtifacts,
  fingerprintBabelPlugins,
  mapPolyfillServices,
  detectCoreJsVersion,
  detectRegeneratorRuntime,
  mapZoneJsPatches,
  mineRxjsOperators,
  extractNgRxStoreShapes,
  mapVuexModules,
  extractPiniaStores,
} from '../../backend/src/engines/bundleArtifactIntel.js';

const SAMPLE = `/*! swc v1.3.90 */
var _swc_class_call_check = function(i,t){};
import { defineStore } from 'pinia';
export const useAuthStore = defineStore('auth', {
  state: () => ({ token: null, profile: {} }),
  actions: {
    async login(creds) {
      const res = await axios.post('/api/v1/auth/login', creds);
      this.token = res.data.token;
    }
  }
});`;

function Section({ title, children }) {
  return (
    <div className="w921c-section">
      <h3 className="w921c-section-title">{title}</h3>
      {children}
    </div>
  );
}

function Kv({ rows }) {
  if (!rows.length) return <p className="w921c-empty">Not detected in this bundle.</p>;
  return (
    <ul className="w921c-list">
      {rows.map((r) => (
        <li key={r[0]} className="w921c-item">
          <span className="w921c-key">{r[0]}</span>
          <span className="w921c-val">{r[1]}</span>
        </li>
      ))}
    </ul>
  );
}

export default function BundleArtifactIntel() {
  const [input, setInput] = useState(SAMPLE);

  const findings = useMemo(() => {
    const swc = mineSwcTransformArtifacts(input);
    const babel = fingerprintBabelPlugins(input);
    const polyfills = mapPolyfillServices(input);
    const coreJs = detectCoreJsVersion(input);
    const regenerator = detectRegeneratorRuntime(input);
    const zoneJs = mapZoneJsPatches(input);
    const rxjs = mineRxjsOperators(input);
    const ngrx = extractNgRxStoreShapes(input);
    const vuex = mapVuexModules(input);
    const pinia = extractPiniaStores(input);
    const endpointSet = new Set();
    [ngrx, vuex, pinia].forEach((r) => {
      (r.endpoints || []).forEach((e) => endpointSet.add(e));
      (r.actions || []).forEach((a) => (a.endpoints || []).forEach((e) => endpointSet.add(e)));
      (r.stores || []).forEach((s) =>
        (s.actions || []).forEach((a) => (a.endpoints || []).forEach((e) => endpointSet.add(e)))
      );
    });
    rxjs.chains.forEach((c) => c.endpoints.forEach((e) => endpointSet.add(e)));
    return { swc, babel, polyfills, coreJs, regenerator, zoneJs, rxjs, ngrx, vuex, pinia, endpoints: [...endpointSet] };
  }, [input]);

  const { swc, babel, polyfills, coreJs, regenerator, zoneJs, rxjs, ngrx, vuex, pinia, endpoints } = findings;

  return (
    <div className="w921c-root">
      <div className="w921c-head">
        <h2 className="w921c-title">Bundle Artifact &amp; Framework Intel</h2>
        <p className="w921c-sub">
          Paste the target&apos;s own publicly served HTML/JS to mine build-toolchain artifacts
          and framework data-flow hints (ideas 941–950).
        </p>
      </div>
      <textarea
        className="w921c-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder="Paste HTML or JS bundle text here…"
      />
      <div className="w921c-grid">
        <Section title="941 · SWC transform artifacts">
          <Kv
            rows={[
              ['Detected', swc.swcDetected ? 'yes' : 'no'],
              ...(swc.version ? [['Version', swc.version]] : []),
              ...(swc.sourceMapUrl ? [['Source map', swc.sourceMapUrl]] : []),
              ...(swc.helpers.length ? [['Helpers', swc.helpers.join(', ')]] : []),
            ]}
          />
        </Section>
        <Section title="942 · Babel plugin fingerprints">
          <Kv
            rows={[
              ['Detected', babel.babelDetected ? 'yes' : 'no'],
              ...(babel.helpers.length ? [['Helpers', babel.helpers.join(', ')]] : []),
              ...(babel.plugins.length ? [['Plugins', babel.plugins.join(', ')]] : []),
            ]}
          />
        </Section>
        <Section title="943 · Polyfill services">
          {polyfills.length ? (
            <ul className="w921c-list">
              {polyfills.map((p, i) => (
                <li key={i} className="w921c-item">
                  <span className="w921c-key">{p.service}</span>
                  <span className="w921c-val">{p.features.join(', ') || 'no feature query'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="w921c-empty">None found.</p>
          )}
        </Section>
        <Section title="944 · core-js version">
          <Kv
            rows={[
              ['Detected', coreJs.detected ? 'yes' : 'no'],
              ...(coreJs.version ? [['Version', coreJs.version + (coreJs.vulnerable ? ' (EOL — patch recommended)' : '')]] : []),
              ...(coreJs.modules.length ? [['Modules', coreJs.modules.join(', ')]] : []),
            ]}
          />
        </Section>
        <Section title="945 · Regenerator runtime">
          <Kv
            rows={[
              ['Detected', regenerator.detected ? 'yes' : 'no'],
              ...(regenerator.variant ? [['Variant', regenerator.variant]] : []),
              ...(regenerator.asyncContexts.length ? [['Async fns', regenerator.asyncContexts.join(', ')]] : []),
            ]}
          />
        </Section>
        <Section title="946 · Zone.js patches">
          <Kv
            rows={[
              ['Detected', zoneJs.detected ? 'yes' : 'no'],
              ...(zoneJs.patches.length ? [['Patches', zoneJs.patches.join(', ')]] : []),
              ...(zoneJs.asyncChannels.length ? [['Async channels', zoneJs.asyncChannels.join(', ')]] : []),
              ...(zoneJs.version ? [['Version', zoneJs.version]] : []),
            ]}
          />
        </Section>
        <Section title="947 · RxJS operators">
          <Kv
            rows={[
              ['Detected', rxjs.rxjsDetected ? 'yes' : 'no'],
              ...(rxjs.operators.length ? [['Operators', rxjs.operators.join(', ')]] : []),
              ...(rxjs.version ? [['Version', rxjs.version]] : []),
            ]}
          />
        </Section>
        <Section title="948 · NgRx store shapes">
          <Kv
            rows={[
              ['Detected', ngrx.detected ? 'yes' : 'no'],
              ...(ngrx.reducers.length ? [['Reducers', ngrx.reducers.join(', ')]] : []),
              ...(ngrx.featureSelectors.length ? [['Selectors', ngrx.featureSelectors.join(', ')]] : []),
              ...(ngrx.storeModules.length ? [['Modules', ngrx.storeModules.join(', ')]] : []),
              ['Effects', String(ngrx.effects)],
            ]}
          />
        </Section>
        <Section title="949 · Vuex modules">
          <Kv
            rows={[
              ['Detected', vuex.detected ? 'yes' : 'no'],
              ...(vuex.modules.length ? [['Modules', vuex.modules.join(', ')]] : []),
              ...(vuex.actions.length ? [['Actions', vuex.actions.map((a) => a.action).join(', ')]] : []),
            ]}
          />
        </Section>
        <Section title="950 · Pinia stores">
          <Kv
            rows={[
              ['Detected', pinia.detected ? 'yes' : 'no'],
              ...(pinia.stores.length
                ? [['Stores', pinia.stores.map((s) => `${s.name} (${s.actions.length} actions)`).join(', ')]]
                : []),
            ]}
          />
        </Section>
        <Section title="Data-flow endpoint hints">
          {endpoints.length ? (
            <ul className="w921c-list">
              {endpoints.map((e) => (
                <li key={e} className="w921c-item">
                  <span className="w921c-val w921c-mono">{e}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="w921c-empty">No endpoint hints extracted.</p>
          )}
        </Section>
      </div>
      <style>{`
        .w921c-root { padding: 24px; max-width: 1080px; margin: 0 auto; color: #e6e6e6; font-family: inherit; }
        .w921c-title { font-size: 22px; margin: 0 0 6px; }
        .w921c-sub { margin: 0 0 16px; color: #9a9a9a; font-size: 14px; }
        .w921c-input { width: 100%; box-sizing: border-box; background: #111; color: #d8d8d8; border: 1px solid #333; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; resize: vertical; }
        .w921c-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 16px; }
        .w921c-section { background: #161616; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px; }
        .w921c-section-title { font-size: 14px; margin: 0 0 10px; color: #f0c75e; }
        .w921c-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .w921c-item { display: flex; gap: 8px; align-items: baseline; font-size: 13px; }
        .w921c-key { color: #8f8f8f; min-width: 96px; }
        .w921c-val { color: #e0e0e0; word-break: break-word; }
        .w921c-mono { font-family: monospace; }
        .w921c-empty { color: #6f6f6f; font-size: 13px; margin: 0; }
      `}</style>
    </div>
  );
}
