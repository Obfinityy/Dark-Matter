/**
 * soapActionEnumerator.js — SOAP action enumeration engine.
 *
 * Idea 00627 — SOAP action enumeration.
 *
 * On authorized targets, fetches WSDL documents (?wsdl) and enumerates
 * operations, SOAP actions, bindings, and service endpoints to map legacy
 * SOAP services. Parsing only; no SOAP calls are ever invoked.
 */

const WSDL_SUFFIXES = ['?wsdl', '?WSDL', '/wsdl'];

/**
 * Candidate WSDL URLs for a base URL and optional service paths.
 * @param {string} baseUrl
 * @param {string[]} [servicePaths] e.g. ['/services/OrderService']
 * @returns {string[]}
 */
export function wsdlCandidates(baseUrl, servicePaths = []) {
  if (!baseUrl || typeof baseUrl !== 'string') return [];
  const base = baseUrl.replace(/\/+$/, '');
  const paths = servicePaths.length ? servicePaths : ['/service', '/services', '/soap'];
  const out = [];
  for (const p of paths) {
    for (const suffix of WSDL_SUFFIXES) out.push(`${base}${p}${suffix}`);
  }
  return [...new Set(out)];
}

/**
 * Enumerate SOAP operations from a WSDL document.
 * @param {string} wsdl raw WSDL XML
 * @returns {{ operations: Array<{name: string, soapAction: string|null, binding: string|null}>, serviceEndpoints: string[], targetNamespace: string|null }}
 */
export function enumerateSoapActions(wsdl = '') {
  const result = { operations: [], serviceEndpoints: [], targetNamespace: null };
  const text = String(wsdl);
  const defMatch = text.match(/<definitions[^>]*targetNamespace="([^"]+)"/i)
    || text.match(/<wsdl:definitions[^>]*targetNamespace="([^"]+)"/i);
  if (defMatch) result.targetNamespace = defMatch[1];

  // Map operation name -> soapAction from binding sections.
  const soapActionByOp = new Map();
  const opRe = /<operation\s+name="([^"]+)"[^>]*>[\s\S]*?<soap(?:12)?:operation\s+soapAction="([^"]*)"/gi;
  let m;
  while ((m = opRe.exec(text)) !== null) {
    soapActionByOp.set(m[1], m[2]);
  }
  // Fallback: operations without explicit soap action in binding.
  const bindingOpRe = /<operation\s+name="([^"]+)"/gi;
  while ((m = bindingOpRe.exec(text)) !== null) {
    if (!soapActionByOp.has(m[1])) soapActionByOp.set(m[1], null);
  }

  // portType operations carry input/output message names; keep it to operation names.
  const portTypeOps = new Set();
  const ptRe = /<portType[^>]*>[\s\S]*?<\/portType>/gi;
  let pt;
  while ((pt = ptRe.exec(text)) !== null) {
    const inner = pt[0];
    const opInnerRe = /<operation\s+name="([^"]+)"/gi;
    let oi;
    while ((oi = opInnerRe.exec(inner)) !== null) portTypeOps.add(oi[1]);
  }

  const names = new Set([...soapActionByOp.keys(), ...portTypeOps]);
  result.operations = [...names].map((name) => ({
    name,
    soapAction: soapActionByOp.get(name) ?? null,
    binding: null,
  }));

  const endpointRe = /<soap(?:12)?:address\s+location="([^"]+)"/gi;
  const endpoints = new Set();
  let e;
  while ((e = endpointRe.exec(text)) !== null) endpoints.add(e[1]);
  result.serviceEndpoints = [...endpoints];
  return result;
}

/**
 * Fetch and enumerate a WSDL document.
 * @param {string} url WSDL URL
 * @param {Function} [fetchImpl] injectable fetch
 * @returns {Promise<object>} enumeration plus the URL
 */
export async function enumerateFromUrl(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, operations: [], serviceEndpoints: [], error: null };
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/xml, text/xml' } });
    const text = await res.text();
    if (!/<definitions|<wsdl:definitions/i.test(text)) {
      outcome.error = `not a WSDL document (HTTP ${res.status})`;
      return outcome;
    }
    const parsed = enumerateSoapActions(text);
    Object.assign(outcome, parsed, { status: res.status });
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize SOAP enumeration as a hardening note.
 * @param {object[]} enumerations
 * @returns {string|null}
 */
export function summarizeFindings(enumerations = []) {
  const found = enumerations.filter((x) => x.operations.length > 0);
  if (found.length === 0) return null;
  const lines = found.map((x) => `- ${x.url}: ${x.operations.length} operation(s) (${x.operations.slice(0, 5).map((o) => o.name).join(', ')}${x.operations.length > 5 ? ', ...' : ''})`);
  return `SOAP services mapped from WSDL:\n${lines.join('\n')}\nRecommendation: disable public ?wsdl disclosure, restrict sensitive operations, and validate inputs against XML attacks (XXE, billion laughs).`;
}
