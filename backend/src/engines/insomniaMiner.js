/**
 * insomniaMiner.js — Public Insomnia collection miner.
 *
 * Parses fetched public Insomnia export/workspace JSON (published by the org
 * itself) and extracts:
 *  - hosts from request URLs, including environment-template resolution
 *  - environment names/values that disclose stages, base domains, or credentials
 *  - authentication types in use per request
 *
 * Pure functions: takes parsed Insomnia JSON, returns structured intel.
 */

const HOST_RE = /https?:\/\/([^/:?#"'\s]+)/gi;

/** Pull Insomnia resources from either export format or workspace format. */
export function collectResources(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.resources)) return data.resources;
  if (Array.isArray(data.__export_resources)) return data.__export_resources;
  return [];
}

/** Build a variable map from environment resources (highest precedence last). */
export function buildEnvironmentMap(resources = [], activeEnvironmentId = null) {
  const vars = {};
  const envs = resources.filter(r => r && r._type === 'environment');
  const ordered = envs.sort((a, b) => {
    if (a._id === activeEnvironmentId) return 1;
    if (b._id === activeEnvironmentId) return -1;
    return 0;
  });
  for (const e of ordered) {
    const data = e.data || {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' || typeof v === 'number') vars[k] = String(v);
    }
  }
  return vars;
}

/** Resolve an Insomnia request URL template against environment variables. */
export function resolveRequestUrl(request, vars = {}) {
  if (!request || typeof request.url !== 'string') return '';
  const lookup = name => {
    // Insomnia template prefixes: {{ _.var }}, {{ _.env.var }}, {{ base_url }}
    if (name.startsWith('_.env.')) name = name.slice(6);
    else if (name.startsWith('_.')) name = name.slice(2);
    else if (name.startsWith('env.')) name = name.slice(4);
    return name in vars ? vars[name] : null;
  };
  return request.url.replace(
    /\{\{\s*([A-Za-z0-9_.$-]+(?:\.[A-Za-z0-9_.$-]+)*)\s*\}\}/g,
    (m, name) => {
      const v = lookup(name);
      return v === null ? m : v;
    }
  );
}

/** Extract distinct hosts from resolved URL strings. */
export function extractHosts(urls = []) {
  const seen = new Set();
  for (const u of urls) {
    HOST_RE.lastIndex = 0;
    let m;
    while ((m = HOST_RE.exec(u))) seen.add(m[1].toLowerCase());
  }
  return [...seen];
}

/** Flag environment values that look like secrets or stage hosts. */
export function flagEnvironmentValues(vars = {}) {
  const flagged = [];
  for (const [k, v] of Object.entries(vars)) {
    const key = k.toLowerCase();
    if (
      /api[_-]?key|secret|token|password|passwd|credential|private/i.test(key) &&
      v &&
      !/\{\{/.test(v)
    ) {
      flagged.push({
        key: k,
        kind: 'possible-credential',
        confidence: 'medium',
        note: 'Environment variable name suggests a secret; value was published in a public collection.',
      });
    }
    if (/staging|stage|dev|test|prod|internal|corp/i.test(v)) {
      flagged.push({
        key: k,
        value: v,
        kind: 'stage-host',
        confidence: 'medium',
        note: 'Value discloses a deployment stage or internal host.',
      });
    }
  }
  return flagged;
}

/**
 * Mine fetched public Insomnia collection JSON for org API intel.
 * @param {object} input
 * @param {string} input.url - provenance URL of the fetched export
 * @param {object} input.data - parsed Insomnia export/workspace JSON
 * @param {string} [input.activeEnvironmentId] - environment id selected by publisher
 * @returns structured findings
 */
export function mineInsomniaCollection({ url = '', data = {}, activeEnvironmentId = null } = {}) {
  const resources = collectResources(data);
  if (!resources.length) {
    return {
      url,
      type: 'Insomnia Collection Mining',
      confidence: 'none',
      error: 'No resources found in export',
    };
  }
  const vars = buildEnvironmentMap(resources, activeEnvironmentId);
  const requests = resources.filter(r => r && r._type === 'request');

  const resolved = requests.map(r => ({
    name: r.name || r._id,
    method: r.method || 'GET',
    url: resolveRequestUrl(r, vars),
    auth: (r.authentication && r.authentication.type) || 'none',
  }));

  const hosts = extractHosts(resolved.map(r => r.url));
  const flagged = flagEnvironmentValues(vars);
  const authCounts = {};
  for (const r of resolved) authCounts[r.auth] = (authCounts[r.auth] || 0) + 1;

  return {
    url,
    type: 'Insomnia Collection Mining',
    confidence: hosts.length ? 'high' : 'low',
    evidence: `${requests.length} request(s) across collection, ${hosts.length} distinct host(s) after environment resolution.`,
    requestCount: requests.length,
    hosts,
    endpoints: resolved.slice(0, 200),
    authSummary: authCounts,
    flaggedEnvironmentValues: flagged,
    unresolvedTemplates: [...new Set(resolved.flatMap(r => r.url.match(/\{\{[^}]+\}\}/g) || []))],
  };
}

export const INSOMNIA_MINER = {
  collectResources,
  buildEnvironmentMap,
  resolveRequestUrl,
  extractHosts,
  flagEnvironmentValues,
  mineInsomniaCollection,
};
export default INSOMNIA_MINER;
