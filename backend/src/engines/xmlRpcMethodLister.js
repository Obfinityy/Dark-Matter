/**
 * xmlRpcMethodLister.js — XML-RPC method-listing detection engine.
 *
 * Idea 00626 — XML-RPC method listing.
 *
 * On authorized targets, sends the standard system.listMethods introspection
 * call and parses the methodResponse. An exposed method list is reported as a
 * hardening finding (information disclosure that aids attackers in mapping
 * the attack surface); the engine never invokes the listed methods.
 */

const CANDIDATE_PATHS = [
  '/xmlrpc.php', '/xmlrpc', '/RPC2', '/api/xmlrpc', '/xml-rpc', '/rpc/xmlrpc',
];

/**
 * Candidate XML-RPC endpoint URLs for a base URL.
 * @param {string} baseUrl
 * @param {string[]} [extraPaths]
 * @returns {string[]}
 */
export function xmlRpcCandidates(baseUrl, extraPaths = []) {
  if (!baseUrl || typeof baseUrl !== 'string') return [];
  const base = baseUrl.replace(/\/+$/, '');
  return [...new Set([...CANDIDATE_PATHS, ...extraPaths])].map((p) => `${base}${p}`);
}

/**
 * Build the standard system.listMethods introspection request body.
 * @returns {string} XML payload
 */
export function buildListMethodsRequest() {
  return `<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName><params></params></methodCall>`;
}

/**
 * Parse a system.listMethods methodResponse XML document.
 * @param {string} xml raw response body
 * @returns {{ exposed: boolean, methods: string[], fault: string|null }}
 */
export function parseMethodListResponse(xml = '') {
  const result = { exposed: false, methods: [], fault: null };
  const body = String(xml);
  if (!/<methodResponse[\s>]/i.test(body)) return result;
  const faultMatch = body.match(/<fault>[\s\S]*?<string>([\s\S]*?)<\/string>/i);
  if (faultMatch) {
    result.fault = faultMatch[1].trim().slice(0, 200);
    return result;
  }
  const methods = [];
  const stringRe = /<string>([^<]*)<\/string>/gi;
  let m;
  while ((m = stringRe.exec(body)) !== null) {
    const name = m[1].trim();
    if (name && !name.includes(' ') && name.length <= 128) methods.push(name);
  }
  if (methods.length > 0) {
    result.exposed = true;
    result.methods = [...new Set(methods)];
  }
  return result;
}

/**
 * Categorize exposed methods into risk-relevant groups for the report.
 * @param {string[]} methods
 * @returns {{ system: string[], admin: string[], other: string[] }}
 */
export function categorizeMethods(methods = []) {
  const groups = { system: [], admin: [], other: [] };
  for (const name of methods) {
    const lower = name.toLowerCase();
    if (lower.startsWith('system.')) groups.system.push(name);
    else if (/admin|config|setting|backup|delete|upload|exec|debug/i.test(name)) groups.admin.push(name);
    else groups.other.push(name);
  }
  return groups;
}

/**
 * Probe an endpoint for an exposed system.listMethods listing.
 * @param {string} url
 * @param {Function} [fetchImpl] injectable fetch
 * @returns {Promise<object>} { url, exposed, methods, fault, error }
 */
export async function probeMethodListing(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, exposed: false, methods: [], fault: null, error: null };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: buildListMethodsRequest(),
    });
    const text = await res.text();
    const parsed = parseMethodListResponse(text);
    Object.assign(outcome, parsed, { status: res.status });
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize an exposed method listing as a hardening finding.
 * @param {object[]} probes
 * @returns {string|null}
 */
export function summarizeFindings(probes = []) {
  const exposed = probes.filter((p) => p.exposed);
  if (exposed.length === 0) return null;
  const lines = exposed.map((p) => {
    const groups = categorizeMethods(p.methods);
    return `- ${p.url}: XML-RPC method listing exposed (${p.methods.length} methods; system: ${groups.system.length}, sensitive-looking: ${groups.admin.length})`;
  });
  return `Exposed XML-RPC system.listMethods endpoint(s) reveal the full method surface:\n${lines.join('\n')}\nRecommendation: disable system.listMethods (and other introspection methods) on public endpoints and harden XML-RPC against brute force.`;
}
