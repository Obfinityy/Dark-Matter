/**
 * serviceWorkerScopeAnalyzer.js — Service-worker scope analysis engine.
 *
 * Analyzes service-worker registrations (URL + scope) observed on authorized
 * targets to map offline-capable application boundaries. The scope defines
 * which paths the worker can intercept — an overly broad scope on a
 * third-party script is a supply-chain observation worth flagging.
 */

/**
 * Parse a service-worker registration entry.
 * @param {{scriptUrl: string, scope?: string}} registration
 * @returns {{scriptUrl: string, scope: string, scriptHost: string, scopeHost: string, broad: boolean}|null}
 */
export function analyzeScope(registration = {}) {
  const { scriptUrl, scope } = registration;
  if (!scriptUrl) return null;
  let scriptHost = '';
  try {
    scriptHost = new URL(scriptUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  let scopeUrl = scope;
  if (!scopeUrl) {
    // Default scope: directory containing the script.
    const u = new URL(scriptUrl);
    scopeUrl = `${u.origin}${u.pathname.replace(/[^/]*$/, '')}`;
  }
  let scopeHost = '';
  let scopePath = '/';
  try {
    const u = new URL(scopeUrl);
    scopeHost = u.hostname.toLowerCase();
    scopePath = u.pathname;
  } catch {
    return null;
  }
  const broad = scopePath === '/' || scopePath === '';
  return {
    scriptUrl,
    scope: scopeUrl,
    scriptHost,
    scopeHost,
    scopePath,
    broad,
    crossOrigin: scriptHost !== scopeHost,
  };
}

/**
 * Analyze a batch of observed service-worker registrations.
 * @param {Array} registrations list of {scriptUrl, scope?}
 * @returns {{workers: Array, offlineCapable: boolean, boundaries: string[], flags: string[]}}
 */
export function analyzeWorkerScopes(registrations = []) {
  const workers = [];
  const flags = [];
  for (const r of registrations) {
    const parsed = analyzeScope(r);
    if (parsed) workers.push(parsed);
  }
  for (const w of workers) {
    if (w.broad && w.crossOrigin) {
      flags.push(
        `third-party worker ${w.scriptHost} claims root scope on ${w.scopeHost} — supply-chain review warranted`
      );
    } else if (w.broad) {
      flags.push(`root-scope worker at ${w.scriptUrl} intercepts all site traffic`);
    }
    if (w.crossOrigin) {
      flags.push(`cross-origin service worker: script ${w.scriptHost} vs scope ${w.scopeHost}`);
    }
  }
  const boundaries = [...new Set(workers.map(w => `${w.scopeHost}${w.scopePath}`))];
  return {
    workers,
    offlineCapable: workers.length > 0,
    boundaries,
    flags,
  };
}

export const SERVICE_WORKER_SCOPE_ANALYZER = {
  analyzeScope,
  analyzeWorkerScopes,
};

export default SERVICE_WORKER_SCOPE_ANALYZER;
