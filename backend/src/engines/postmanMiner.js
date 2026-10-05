/**
 * postmanMiner.js — Public Postman workspace miner.
 *
 * Parses fetched public Postman workspace/collection JSON (the data published
 * by the organization itself on postman.com) and extracts:
 *  - base URLs / hosts from requests and environment variable values
 *  - auth types and header usage across the collection
 *  - environment names that leak deployment stages (staging/prod)
 *
 * Pure functions: takes parsed Postman JSON, returns structured intel.
 */

const VAR_RE = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const HOST_RE = /https?:\/\/([^/:?#"'\s]+)/gi;

/** Recursively collect all request items from collection item trees. */
export function collectRequests(items, acc = []) {
  if (!Array.isArray(items)) return acc;
  for (const it of items) {
    if (!it) continue;
    if (Array.isArray(it.item)) collectRequests(it.item, acc);
    if (it.request) acc.push({ folder: it.name || '', request: it.request });
  }
  return acc;
}

/** Resolve a Postman `url` node (string or {raw,host,path}) to a string. */
export function resolveUrlNode(url) {
  if (typeof url === 'string') return url;
  if (!url || typeof url !== 'object') return '';
  if (url.raw) return url.raw;
  const host = Array.isArray(url.host) ? url.host.join('.') : String(url.host || '');
  const path = Array.isArray(url.path) ? '/' + url.path.join('/') : '';
  return (url.protocol ? url.protocol + '://' : 'https://') + host + path;
}

/** Substitute {{variables}} using a map of variable values. */
export function substituteVariables(text, vars = {}) {
  if (typeof text !== 'string') return text;
  VAR_RE.lastIndex = 0;
  return text.replace(VAR_RE, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** Pull variable maps from environment/workspace JSON blobs. */
export function extractVariables(environments = []) {
  const vars = {};
  for (const env of environments) {
    if (!env || !Array.isArray(env.values)) continue;
    for (const v of env.values) {
      if (v && v.key && typeof v.value !== 'undefined') vars[v.key] = v.value;
    }
  }
  return vars;
}

/** Extract distinct hosts from a list of resolved URL strings. */
export function extractHostsFromUrls(urls = []) {
  const seen = new Set();
  for (const u of urls) {
    HOST_RE.lastIndex = 0;
    let m;
    while ((m = HOST_RE.exec(u))) seen.add(m[1].toLowerCase());
  }
  return [...seen];
}

/** Summarize auth types used across requests. */
export function summarizeAuth(requests = []) {
  const counts = {};
  for (const { request } of requests) {
    const t = request && request.auth ? request.auth.type : 'none';
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

/**
 * Mine fetched public Postman workspace/collection JSON for org API intel.
 * @param {object} input
 * @param {string} input.url - provenance URL of the fetched Postman JSON
 * @param {object} input.data - parsed workspace JSON { collection, environments }
 * @returns structured findings
 */
export function minePostmanWorkspace({ url = '', data = {} } = {}) {
  if (!data || typeof data !== 'object') {
    return { url, type: 'Postman Workspace Mining', confidence: 'none', error: 'No data supplied' };
  }
  const collection = data.collection || data;
  const environments = data.environments || [];
  const vars = extractVariables(environments);

  const requests = collectRequests(collection.item || []);
  const resolved = requests.map(({ folder, request }) => ({
    name: request.name || folder,
    method: request.method || 'GET',
    url: substituteVariables(resolveUrlNode(request.url), vars),
  }));

  const hosts = extractHostsFromUrls(resolved.map(r => r.url));
  const auth = summarizeAuth(requests);
  const stageEnvs = environments
    .map(e => e.name || '')
    .filter(n => /staging|stage|prod(uction)?|dev(elopment)?|qa|uat/i.test(n));

  return {
    url,
    type: 'Postman Workspace Mining',
    confidence: hosts.length ? 'high' : 'low',
    evidence: `${requests.length} request(s) across collection, ${hosts.length} distinct host(s) resolved after variable substitution.`,
    collectionName: collection.info ? collection.info.name : '',
    requestCount: requests.length,
    hosts,
    baseUrls: [...new Set(resolved.map(r => r.url.split(/[?#]/)[0]))].slice(0, 200),
    authSummary: auth,
    stageEnvironments: stageEnvs,
    unresolvedVariables: [...new Set(resolved.flatMap(r => (r.url.match(/\{\{[^}]+\}\}/g) || [])))],
  };
}

export const POSTMAN_MINER = {
  collectRequests, resolveUrlNode, substituteVariables, extractVariables,
  extractHostsFromUrls, summarizeAuth, minePostmanWorkspace,
};
export default POSTMAN_MINER;
