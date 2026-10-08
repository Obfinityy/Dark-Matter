/**
 * openApiCallbackMiner.js — OpenAPI callback-URL extractor.
 *
 * OpenAPI 3.x operations may declare `callbacks`: named sets of out-of-band
 * webhook calls the API server makes back to the client (e.g. payment
 * notifications, async completion hooks). OpenAPI 3.1 also supports a
 * top-level `webhooks` map. Extracting these reveals every webhook host the
 * API advertises — including internal or staging hosts the publisher forgot
 * were documented.
 *
 * Pure structure analysis: the caller supplies the fetched spec (JSON string
 * or already-parsed object). Defensive use: authorized discovery of webhook
 * surface and stray internal callback hosts during bug-bounty review.
 */

/**
 * Walk the operations of every path item and collect callback definitions.
 *
 * @param {object} spec - Parsed OpenAPI document.
 * @returns {Array<{ path: string, method: string, callbackName: string, callbackPath: string, targetMethod: string, servers: string[], expression: string|null }>}
 */
export function extractCallbacks(spec = {}) {
  const out = [];
  const paths = spec.paths && typeof spec.paths === 'object' ? spec.paths : {};
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== 'object') continue;
    for (const [method, operation] of Object.entries(item)) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        method === 'parameters' ||
        method.startsWith('x-')
      )
        continue;
      const callbacks =
        operation.callbacks && typeof operation.callbacks === 'object' ? operation.callbacks : {};
      for (const [callbackName, callback] of Object.entries(callbacks)) {
        if (!callback || typeof callback !== 'object') continue;
        for (const [callbackPath, pathItem] of Object.entries(callback)) {
          if (!pathItem || typeof pathItem !== 'object') continue;
          const pathItemServers = Array.isArray(pathItem.servers)
            ? pathItem.servers.map(s => s && s.url).filter(Boolean)
            : [];
          for (const [targetMethod, targetOp] of Object.entries(pathItem)) {
            if (
              !targetOp ||
              typeof targetOp !== 'object' ||
              targetMethod === 'servers' ||
              targetMethod === 'parameters'
            )
              continue;
            const opServers = Array.isArray(targetOp.servers)
              ? targetOp.servers.map(s => s && s.url).filter(Boolean)
              : [];
            const servers = [...new Set([...pathItemServers, ...opServers])];
            out.push({
              path,
              method: method.toUpperCase(),
              callbackName,
              callbackPath,
              targetMethod: targetMethod.toUpperCase(),
              servers,
              expression: looksLikeRuntimeExpression(callbackPath) ? callbackPath : null,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Extract top-level `webhooks` (OpenAPI 3.1).
 *
 * @param {object} spec
 * @returns {Array<{ name: string, path: string, method: string, servers: string[] }>}
 */
export function extractTopLevelWebhooks(spec = {}) {
  const out = [];
  const webhooks = spec.webhooks && typeof spec.webhooks === 'object' ? spec.webhooks : {};
  for (const [name, pathItem] of Object.entries(webhooks)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const servers = Array.isArray(pathItem.servers)
      ? pathItem.servers.map(s => s && s.url).filter(Boolean)
      : [];
    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        method === 'servers' ||
        method === 'parameters'
      )
        continue;
      out.push({ name, path: name, method: method.toUpperCase(), servers });
    }
  }
  return out;
}

/**
 * Check whether a callback path expression uses OpenAPI runtime expressions
 * (e.g. `{$request.body#/callbackUrl}`), which point at client-supplied hosts.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeRuntimeExpression(value) {
  return typeof value === 'string' && /\{\$request\./.test(value);
}

/**
 * Collect distinct hostnames referenced by callback server URLs.
 *
 * @param {Array<{servers: string[]}>} callbacks
 * @returns {string[]}
 */
export function callbackHosts(callbacks = []) {
  const hosts = new Set();
  for (const cb of callbacks) {
    for (const serverUrl of cb.servers || []) {
      try {
        const parsed = new URL(serverUrl, 'https://placeholder.invalid');
        if (parsed.hostname && parsed.hostname !== 'placeholder.invalid')
          hosts.add(parsed.hostname);
      } catch {
        /* ignore unparsable server URLs */
      }
    }
  }
  return [...hosts].sort();
}

/**
 * Flag callback targets that look like internal/dev hosts rather than
 * client-supplied runtime expressions.
 *
 * @param {Array} callbacks
 * @returns {Array}
 */
export function findSuspiciousCallbackTargets(callbacks = []) {
  const internalRe =
    /(localhost|127\.0\.0\.1|::1|\.local$|\.internal$|\.corp$|dev|staging|test|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i;
  return callbacks.filter(
    cb => !looksLikeRuntimeExpression(cb.callbackPath) && cb.servers.some(s => internalRe.test(s))
  );
}

/**
 * Full analysis of a fetched OpenAPI document.
 *
 * @param {{ url?: string, spec: string|object }} input
 * @returns {{ type: string, confidence: string, callbacks: object[], webhooks: object[], hosts: string[], suspicious: object[], evidence: string }}
 */
export function analyzeOpenApiCallbacks({ url = '', spec = null } = {}) {
  let parsed = spec;
  if (typeof spec === 'string') {
    try {
      parsed = JSON.parse(spec);
    } catch {
      return {
        type: 'OpenAPI Callback-URL Extraction',
        confidence: 'low',
        callbacks: [],
        webhooks: [],
        hosts: [],
        suspicious: [],
        evidence: `Spec${url ? ` at ${url}` : ''} is not valid JSON; callbacks could not be extracted.`,
      };
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      type: 'OpenAPI Callback-URL Extraction',
      confidence: 'low',
      callbacks: [],
      webhooks: [],
      hosts: [],
      suspicious: [],
      evidence: 'No OpenAPI document supplied.',
    };
  }

  const callbacks = extractCallbacks(parsed);
  const webhooks = extractTopLevelWebhooks(parsed);
  const hosts = callbackHosts([...callbacks, ...webhooks]);
  const suspicious = findSuspiciousCallbackTargets(callbacks);

  return {
    type: 'OpenAPI Callback-URL Extraction',
    confidence: callbacks.length || webhooks.length ? 'high' : 'low',
    callbacks,
    webhooks,
    hosts,
    suspicious,
    evidence:
      callbacks.length || webhooks.length
        ? `OpenAPI spec${url ? ` at ${url}` : ''} declares ${callbacks.length} operation callback(s) and ${webhooks.length} top-level webhook(s) referencing host(s): ${hosts.join(', ') || '(client-supplied only)'}.` +
          (suspicious.length
            ? ` ${suspicious.length} callback target(s) point at internal/dev hosts — verify they are intentional.`
            : '')
        : `No callbacks or webhooks declared in spec${url ? ` at ${url}` : ''}.`,
  };
}

export const OPENAPI_CALLBACK_MINER = {
  extractCallbacks,
  extractTopLevelWebhooks,
  looksLikeRuntimeExpression,
  callbackHosts,
  findSuspiciousCallbackTargets,
  analyzeOpenApiCallbacks,
};
export default OPENAPI_CALLBACK_MINER;
