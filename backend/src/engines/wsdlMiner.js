/**
 * wsdlMiner.js — WSDL service-address extractor.
 *
 * Parses Web Services Description Language (WSDL) documents and extracts
 * the concrete service endpoint addresses (soap:address / soap12:address
 * location attributes), along with the service/port names and target
 * namespace that describe them. Pure text analysis: the caller supplies
 * the fetched WSDL document as a string.
 *
 * Defensive use: authorized asset discovery — mapping the SOAP endpoints
 * a target organization publicly advertises so security reviews cover
 * the full attack surface.
 */

const ADDRESS_RE =
  /<\s*(?:[\w.-]+:)?address\b[^>]*?\blocation\s*=\s*["']([^"']+)["'][^>]*>/gi;
const PORT_RE =
  /<\s*(?:[\w.-]+:)?port\b[^>]*?\bname\s*=\s*["']([^"']+)["'][^>]*>/gi;
const BINDING_RE =
  /<\s*(?:[\w.-]+:)?binding\b[^>]*?\bname\s*=\s*["']([^"']+)["'][^>]*>/gi;
const SERVICE_RE =
  /<\s*(?:[\w.-]+:)?service\b[^>]*?\bname\s*=\s*["']([^"']+)["'][^>]*>/gi;
const TARGET_NS_RE =
  /<\s*(?:[\w.-]+:)?definitions\b[^>]*?\btargetNamespace\s*=\s*["']([^"']+)["']/i;
const BINDING_TYPE_RE =
  /<\s*(?:[\w.-]+:)?binding\b[^>]*?\btype\s*=\s*["'](?:[\w.-]+:)?([^"']+)["']/gi;

/**
 * Extract every unique location attribute value from the document.
 *
 * @param {string} wsdlText - Raw WSDL document text.
 * @returns {string[]} Unique endpoint URLs in document order.
 */
export function extractAddresses(wsdlText) {
  if (typeof wsdlText !== 'string' || !wsdlText) return [];
  const seen = new Set();
  const out = [];
  let m;
  ADDRESS_RE.lastIndex = 0;
  while ((m = ADDRESS_RE.exec(wsdlText)) !== null) {
    const loc = m[1].trim();
    if (loc && !seen.has(loc)) {
      seen.add(loc);
      out.push(loc);
    }
  }
  return out;
}

/**
 * Collect named structural elements of a WSDL document.
 *
 * @param {string} wsdlText - Raw WSDL document text.
 * @returns {{ services: string[], ports: string[], bindings: string[], bindingTypes: string[] }}
 */
export function extractStructure(wsdlText) {
  const collect = (re, text) => {
    const names = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) names.push(m[1]);
    return names;
  };
  if (typeof wsdlText !== 'string') wsdlText = '';
  return {
    services: collect(SERVICE_RE, wsdlText),
    ports: collect(PORT_RE, wsdlText),
    bindings: collect(BINDING_RE, wsdlText),
    bindingTypes: collect(BINDING_TYPE_RE, wsdlText),
  };
}

/**
 * Derive hostnames from extracted endpoint URLs.
 *
 * @param {string} wsdlText - Raw WSDL document text.
 * @returns {{ host: string, scheme: string, endpoint: string }[]} Host intel rows.
 */
export function extractHosts(wsdlText) {
  const out = [];
  const seen = new Set();
  for (const endpoint of extractAddresses(wsdlText)) {
    try {
      const u = new URL(endpoint);
      if (!u.hostname || seen.has(u.hostname)) continue;
      seen.add(u.hostname);
      out.push({ host: u.hostname, scheme: u.protocol.replace(':', ''), endpoint });
    } catch {
      // Non-absolute or relative location — keep as evidence without host parsing.
      out.push({ host: '', scheme: '', endpoint });
    }
  }
  return out;
}

/**
 * Full analysis of a fetched WSDL document.
 *
 * @param {{ url?: string, wsdlText: string }} input
 * @returns {{ type: string, confidence: string, targetNamespace: string|null, endpoints: string[], hosts: object[], structure: object, evidence: string }}
 */
export function analyzeWsdl({ url = '', wsdlText = '' } = {}) {
  const text = typeof wsdlText === 'string' ? wsdlText : '';
  const nsMatch = TARGET_NS_RE.exec(text);
  const endpoints = extractAddresses(text);
  const hosts = extractHosts(text);
  const structure = extractStructure(text);
  const namedHosts = hosts.filter((h) => h.host).map((h) => h.host);

  return {
    type: 'WSDL Service-Address Extraction',
    confidence: endpoints.length ? 'high' : 'low',
    targetNamespace: nsMatch ? nsMatch[1] : null,
    endpoints,
    hosts,
    structure,
    evidence:
      endpoints.length > 0
        ? `Found ${endpoints.length} SOAP endpoint(s) in WSDL${url ? ` at ${url}` : ''}: ${namedHosts.join(', ') || '(relative addresses)'}.`
        : `No soap:address locations found in WSDL${url ? ` at ${url}` : ''}.`,
  };
}

export const WSDL_MINER = { extractAddresses, extractStructure, extractHosts, analyzeWsdl };
export default WSDL_MINER;
