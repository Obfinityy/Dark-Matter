/**
 * gatewayRequestIdMining.js — request-ID format mining for API-gateway fingerprinting.
 *
 * Implements idea-bank item 00439: mine the format of request/correlation
 * ID headers to fingerprint the API gateway or proxy that minted them
 * (AWS, Google Cloud, Cloudflare, Azure, Datadog, Zipkin/B3, and others).
 *
 * All functions are pure and side-effect free: they operate on header maps
 * and ID strings supplied by the caller (gathered during an authorized
 * engagement). No network requests are performed here.
 */

/**
 * Request-ID header names commonly minted by gateways and proxies.
 */
export const REQUEST_ID_HEADER_NAMES = [
  'x-request-id',
  'x-correlation-id',
  'x-amzn-trace-id',
  'x-cloud-trace-context',
  'cf-ray',
  'x-b3-traceid',
  'x-b3-spanid',
  'traceparent',
  'x-datadog-trace-id',
  'x-requestid',
  'x-correlationid',
  'request-id',
  'x-azure-ref',
  'x-ms-request-id',
];

/**
 * Known request-ID formats with matchers over the ID value.
 */
export const REQUEST_ID_FORMATS = [
  {
    product: 'AWS (X-Ray trace ID)',
    confidence: 'high',
    test: (v) => /^1-[0-9a-f]{8}-[0-9a-f]{24}$/i.test(v),
    note: 'AWS X-Ray format "1-<epoch-hex-8>-<unique-hex-24>" — minted by ALB, API Gateway, or Lambda.',
  },
  {
    product: 'Google Cloud (Cloud Trace)',
    confidence: 'high',
    test: (v) => /^[0-9a-f]{32}\/\d+;o=\d$/i.test(v),
    note: 'X-Cloud-Trace-Context "<32-hex-trace>/<span>;o=<flags>" — Google Cloud load balancers and services.',
  },
  {
    product: 'Cloudflare (Ray ID)',
    confidence: 'high',
    test: (v) => /^[0-9a-f]{16}-[A-Z]{3,4}\d?$/i.test(v),
    note: 'CF-RAY "<16-hex>-<colo-code>" — Cloudflare edge; the suffix names the serving datacenter.',
  },
  {
    product: 'W3C Trace Context',
    confidence: 'high',
    test: (v) => /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i.test(v),
    note: 'traceparent "version-traceid-parentid-flags" — OpenTelemetry-compatible stacks.',
  },
  {
    product: 'Zipkin B3 (single or multi-header)',
    confidence: 'medium',
    test: (v) => /^[0-9a-f]{16}([0-9a-f]{16})?$/i.test(v),
    note: 'B3 trace IDs are 16 or 32 lowercase hex chars — Zipkin-instrumented services and gateways.',
  },
  {
    product: 'Datadog APM',
    confidence: 'medium',
    test: (v, header) => /datadog/i.test(header || '') && /^\d{1,20}$/.test(v),
    note: 'Datadog uses decimal 64-bit trace/span IDs in x-datadog-trace-id / x-datadog-parent-id.',
  },
  {
    product: 'ULID (time-ordered)',
    confidence: 'medium',
    test: (v) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(v),
    note: '26-char Crockford base32 ULID — time-ordered IDs minted by modern API frameworks.',
  },
  {
    product: 'UUID (random)',
    confidence: 'low',
    test: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
    note: 'UUIDv4 — generic; many gateways and frameworks mint these (Envoy, Kong, Rails, Django).',
  },
  {
    product: 'Azure (x-ms-request-id)',
    confidence: 'medium',
    test: (v, header) => /x-ms-request-id|x-azure-ref/i.test(header || '') && /^[0-9a-f-]{36}$/i.test(v),
    note: 'Azure services mint GUID request IDs in x-ms-request-id.',
  },
];

/**
 * Collect request-ID header values from an observed header map.
 * @param {object} headers Header map (name -> value).
 * @returns {Array<{header:string, value:string}>}
 */
export function extractRequestIds(headers) {
  const out = [];
  if (!headers || typeof headers !== 'object') return out;
  for (const key of Object.keys(headers)) {
    if (REQUEST_ID_HEADER_NAMES.includes(key.toLowerCase())) {
      out.push({ header: key, value: String(headers[key]).trim() });
    }
  }
  return out;
}

/**
 * Classify one request-ID value against the known format catalog.
 * @param {string} value Request-ID value.
 * @param {string} [headerName] Header the value came from (disambiguates decimal IDs).
 * @returns {{product:string|null, confidence:string, note:string|null}}
 */
export function classifyRequestId(value, headerName = '') {
  if (!value || typeof value !== 'string') return { product: null, confidence: 'none', note: null };
  const v = value.trim();
  for (const fmt of REQUEST_ID_FORMATS) {
    let matched = false;
    try {
      matched = fmt.test(v, headerName) === true;
    } catch {
      matched = false;
    }
    if (matched) return { product: fmt.product, confidence: fmt.confidence, note: fmt.note };
  }
  if (/^\d{10,20}$/.test(v)) {
    return { product: 'unknown (decimal/snowflake-like)', confidence: 'low', note: 'Long decimal ID — could be a snowflake-style generator; not attributable.' };
  }
  return { product: null, confidence: 'none', note: 'No known gateway request-ID format matched.' };
}

/**
 * Mine all request IDs in an observed header map and fingerprint the minting product(s).
 * @param {object} headers Header map (name -> value).
 * @returns {{ids:Array<{header:string, value:string, product:string|null, confidence:string, note:string|null}>, products:Array<{product:string, confidence:string, evidence:string[]}>}}
 */
export function mineRequestIds(headers) {
  const ids = extractRequestIds(headers).map(({ header, value }) => {
    const c = classifyRequestId(value, header);
    return { header, value, product: c.product, confidence: c.confidence, note: c.note };
  });
  const byProduct = new Map();
  for (const id of ids) {
    if (!id.product) continue;
    if (!byProduct.has(id.product)) byProduct.set(id.product, { product: id.product, confidence: id.confidence, evidence: [] });
    byProduct.get(id.product).evidence.push(`${id.header}: ${id.value}`);
  }
  const rank = { high: 3, medium: 2, low: 1, none: 0 };
  const products = [...byProduct.values()].sort((a, b) => rank[b.confidence] - rank[a.confidence]);
  return { ids, products };
}
