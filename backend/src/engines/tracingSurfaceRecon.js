/**
 * tracingSurfaceRecon.js — Proxy chain and distributed-tracing surface reconnaissance.
 *
 * Implements idea-bank items 01221–01225 for the autonomous bug-bounty agent:
 *   01221 Proxy-chain via-header mapping
 *   01222 Gateway request-ID tracing
 *   01223 Traceparent reflection test
 *   01224 B3 propagation handling
 *   01225 Distributed-tracing endpoint leak
 *
 * During an authorized engagement the caller sends the benign probe headers
 * described by the build* functions below and records the responses. This
 * module performs PURE analysis of recorded request/response data: it maps
 * proxy topology from Via/X-Forwarded-For chains, follows request IDs across
 * services, and detects reflected W3C/Zipkin tracing context or exposed
 * tracing UIs. It sends no network traffic itself and contains no exploit
 * payloads.
 */

/**
 * Normalize a header map to lower-cased keys with joined array values.
 * @param {object} headers Header map (any case).
 * @returns {Record<string,string>}
 */
function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers)) {
    const key = String(k).toLowerCase();
    if (Array.isArray(v)) out[key] = v.join(', ');
    else if (v != null) out[key] = String(v);
  }
  return out;
}

/**
 * Test whether a string looks like an RFC1918 / link-local / loopback address
 * or an internal-only hostname.
 * @param {string} token A candidate host or IP token.
 * @returns {boolean}
 */
export function isInternalToken(token) {
  const t = String(token || '').trim().toLowerCase();
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.|fc00:|fd00:|::1)/.test(t))
    return true;
  if (/^localhost(\.|\b|$)/.test(t)) return true;
  if (/(^|\.)(internal|intranet|lan|local|corp|svc|cluster|sandbox|private)(\.|$)/.test(t))
    return true;
  return false;
}

/**
 * Describe the passive observation plan for idea 01221 (proxy-chain mapping).
 * No special request headers are needed: the caller makes a normal GET to the
 * target and records the response headers and body.
 * @returns {{requestHeaders:object, record:string[], note:string}}
 */
export function buildProxyChainProbe() {
  return {
    requestHeaders: {},
    record: [
      'via',
      'x-forwarded-for',
      'forwarded',
      'x-real-ip',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-forwarded-port',
      'x-original-forwarded-for',
      'x-proxy-id',
      'x-amzn-trace-id',
      'x-envoy-external-address',
      'server',
    ],
    note:
      'Send a benign GET with no probe headers; record the response headers ' +
      'and body. Analysis is entirely passive.',
  };
}

/**
 * Parse a Via header value into hop entries.
 * Via format: "1.1 proxyA, 1.0 proxyB:8080".
 * @param {string} value Raw Via header value.
 * @returns {{version:string, receivedBy:string}[]}
 */
export function parseViaHeader(value) {
  const hops = [];
  const raw = String(value || '');
  for (const part of raw.split(',')) {
    const m = part.trim().match(/^(?:([^\s]+)\s+)?(\S+)\s*(\([^)]*\))?$/);
    if (m && m[2]) hops.push({ version: m[1] || 'unknown', receivedBy: m[2] });
  }
  return hops;
}

/**
 * Parse an X-Forwarded-For header value into an ordered IP list.
 * @param {string} value Raw X-Forwarded-For value.
 * @returns {string[]}
 */
export function parseXForwardedFor(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().replace(/^\[|\]$/g, ''))
    .filter((s) => s.length > 0);
}

/**
 * Parse an RFC 7239 Forwarded header into per-element objects.
 * @param {string} value Raw Forwarded header value.
 * @returns {Record<string,string>[]}
 */
export function parseForwardedHeader(value) {
  const elements = [];
  for (const chunk of String(value || '').split(',')) {
    const pairs = chunk.split(';');
    const obj = {};
    for (const p of pairs) {
      const eq = p.indexOf('=');
      if (eq > 0)
        obj[p.slice(0, eq).trim().toLowerCase()] = p
          .slice(eq + 1)
          .trim()
          .replace(/^"|"$/g, '');
    }
    if (Object.keys(obj).length > 0) elements.push(obj);
  }
  return elements;
}

/**
 * Analyze a recorded response for proxy-chain topology leakage (idea 01221).
 * Parses Via / X-Forwarded-For / Forwarded / X-Real-IP chains, counts tiers,
 * and flags internal hostnames or private addresses in the chain.
 * @param {{status?:number, headers?:object, body?:string}} response Recorded response.
 * @returns {{chainDepth:number, hops:object[], internalHops:string[], proxyHeadersSeen:string[], internalTierExposed:boolean, topologySummary:string, findings:string[], verdict:'exposed'|'suspected'|'none'}}
 */
export function analyzeProxyChainResponse(response) {
  const res = response && typeof response === 'object' ? response : {};
  const headers = normalizeHeaders(res.headers);
  const body = typeof res.body === 'string' ? res.body : '';
  const findings = [];
  const hops = [];
  const internalHops = [];
  const proxyHeadersSeen = [];

  const addHop = (source, token) => {
    hops.push({ source, token });
    if (isInternalToken(token)) internalHops.push(`${source}:${token}`);
  };

  if (headers['via']) {
    proxyHeadersSeen.push('via');
    for (const h of parseViaHeader(headers['via'])) addHop('via', h.receivedBy);
  }
  if (headers['x-forwarded-for']) {
    proxyHeadersSeen.push('x-forwarded-for');
    for (const ip of parseXForwardedFor(headers['x-forwarded-for'])) addHop('x-forwarded-for', ip);
  }
  if (headers['forwarded']) {
    proxyHeadersSeen.push('forwarded');
    for (const el of parseForwardedHeader(headers['forwarded'])) {
      if (el.for) addHop('forwarded', el.for.replace(/_/g, ''));
      if (el.by) addHop('forwarded', el.by.replace(/_/g, ''));
      if (el.host) addHop('forwarded', el.host);
    }
  }
  if (headers['x-real-ip']) {
    proxyHeadersSeen.push('x-real-ip');
    addHop('x-real-ip', headers['x-real-ip']);
  }
  for (const h of ['x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'x-envoy-external-address']) {
    if (headers[h]) {
      proxyHeadersSeen.push(h);
      addHop(h, headers[h]);
    }
  }

  const chainDepth = hops.length;
  if (proxyHeadersSeen.length > 0)
    findings.push(`Proxy-indicative headers in response: ${proxyHeadersSeen.join(', ')}`);
  if (chainDepth >= 2)
    findings.push(`${chainDepth} proxy hops parsed across the chain`);
  if (internalHops.length > 0)
    findings.push(`Internal tier identifiers leaked in chain: ${[...new Set(internalHops)].join('; ')}`);
  else if (chainDepth > 0)
    findings.push('Chain visible but contains only public-facing tokens');

  const internalTierExposed = internalHops.length > 0;
  let verdict = 'none';
  if (internalTierExposed) verdict = 'exposed';
  else if (chainDepth > 0) verdict = 'suspected';

  const topologySummary =
    hops.length > 0
      ? hops.map((h) => h.token).join('  <-  ')
      : 'No proxy chain tokens observed';

  return {
    chainDepth,
    hops,
    internalHops: [...new Set(internalHops)],
    proxyHeadersSeen,
    internalTierExposed,
    topologySummary,
    findings,
    verdict,
  };
}

/**
 * Describe the request-ID correlation plan for idea 01222.
 * The caller sends requests carrying a unique canary request ID and records
 * which IDs appear in each response.
 * @param {string} canary A unique canary string (e.g. a UUID) for this probe.
 * @returns {{requestHeaders:object, responseHeadersToRecord:string[], note:string}}
 */
export function buildRequestIdProbe(canary) {
  const c = String(canary || 'infinity-probe');
  return {
    requestHeaders: {
      'X-Request-ID': c,
      'X-Correlation-ID': c,
      'X-Canary': c,
    },
    responseHeadersToRecord: [
      'x-request-id',
      'x-correlation-id',
      'x-amzn-trace-id',
      'x-b3-traceid',
      'x-trace-id',
      'x-cloud-trace-context',
      'traceparent',
      'server-timing',
    ],
    note:
      'Send the canary request ID to several endpoints/services of the target; ' +
      'record the response headers. Propagation of the canary across services ' +
      'maps the microservice call graph.',
  };
}

/**
 * Analyze recorded responses for gateway request-ID tracing (idea 01222).
 * Compares the sent canary ID against IDs echoed by each service and detects
 * when a service mints its own internal ID format.
 * @param {{canary:string, records:{endpoint:string, headers?:object}[]}} input Canary plus per-endpoint response headers.
 * @returns {{canaryPropagatedTo:string[], serviceMintedIds:{endpoint:string, header:string, id:string}[], callGraphHint:string, findings:string[], verdict:'traced'|'partial'|'opaque'}}
 */
export function analyzeRequestIdTrace(input) {
  const canary = String((input && input.canary) || '');
  const records = Array.isArray(input && input.records) ? input.records : [];
  const findings = [];
  const canaryPropagatedTo = [];
  const serviceMintedIds = [];

  const idHeaders = [
    'x-request-id',
    'x-correlation-id',
    'x-amzn-trace-id',
    'x-b3-traceid',
    'x-trace-id',
    'x-cloud-trace-context',
    'traceparent',
  ];

  for (const rec of records) {
    const headers = normalizeHeaders(rec && rec.headers);
    const endpoint = rec && rec.endpoint ? String(rec.endpoint) : 'unknown';
    let echoed = false;
    for (const h of idHeaders) {
      const v = headers[h];
      if (!v) continue;
      if (canary && v.toLowerCase().includes(canary.toLowerCase())) {
        echoed = true;
        if (!canaryPropagatedTo.includes(endpoint)) canaryPropagatedTo.push(endpoint);
      } else if (v.length >= 8) {
        serviceMintedIds.push({ endpoint, header: h, id: v.slice(0, 64) });
      }
    }
    if (!echoed && canary)
      findings.push(`${endpoint}: canary request ID was NOT echoed (opaque gateway behavior)`);
  }

  if (canaryPropagatedTo.length > 0)
    findings.push(
      `Canary request ID propagated to: ${canaryPropagatedTo.join(', ')} — ` +
        'these endpoints/services share the tracing path'
    );
  if (serviceMintedIds.length > 0)
    findings.push(
      `Services minting their own IDs: ${serviceMintedIds
        .map((s) => `${s.endpoint} (${s.header}=${s.id})`)
        .join('; ')}`
    );

  let verdict = 'opaque';
  if (canaryPropagatedTo.length > 0 && serviceMintedIds.length > 0) verdict = 'partial';
  else if (canaryPropagatedTo.length > 0) verdict = 'traced';

  const callGraphHint =
    canaryPropagatedTo.length > 0
      ? `Shared tracing path across: ${canaryPropagatedTo.join(' -> ')}`
      : 'No shared tracing path observable';

  return {
    canaryPropagatedTo,
    serviceMintedIds,
    callGraphHint,
    findings,
    verdict,
  };
}

/**
 * Build a W3C traceparent probe for idea 01223.
 * @param {string} [traceId] Optional 32-hex-char trace ID; a random one is minted otherwise.
 * @returns {{requestHeaders:object, responseHeadersToRecord:string[], note:string}}
 */
export function buildTraceparentProbe(traceId) {
  const tid =
    /^[0-9a-f]{32}$/i.test(String(traceId || ''))
      ? String(traceId).toLowerCase()
      : Array.from({ length: 32 }, () =>
          '0123456789abcdef'[Math.floor(Math.random() * 16)]
        ).join('');
  const spanId = Array.from({ length: 16 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
  const traceparent = `00-${tid}-${spanId}-01`;
  return {
    requestHeaders: {
      traceparent,
      tracestate: `infinity=${spanId}`,
    },
    responseHeadersToRecord: [
      'traceparent',
      'tracestate',
      'x-b3-traceid',
      'uber-trace-id',
      'x-cloud-trace-context',
      'x-amzn-trace-id',
      'x-datadog-trace-id',
      'x-request-id',
    ],
    note:
      'Send the W3C traceparent header; a service with distributed-tracing ' +
      'instrumentation may reflect the context or mint trace IDs tied to it.',
  };
}

/**
 * Analyze a recorded response for traceparent reflection (idea 01223).
 * @param {{requestHeaders?:object, status?:number, headers?:object, body?:string}} exchange Recorded exchange.
 * @returns {{traceId:string|null, reflected:boolean, propagationHeaders:string[], instrumented:boolean, findings:string[], verdict:'reflected'|'instrumented'|'absent'}}
 */
export function analyzeTraceparentReflection(exchange) {
  const ex = exchange && typeof exchange === 'object' ? exchange : {};
  const reqHeaders = normalizeHeaders(ex.requestHeaders);
  const resHeaders = normalizeHeaders(ex.headers);
  const body = typeof ex.body === 'string' ? ex.body : '';
  const findings = [];

  const tp = reqHeaders['traceparent'] || '';
  const m = String(tp).match(/^00-([0-9a-f]{32})-/i);
  const traceId = m ? m[1].toLowerCase() : null;

  const propagationHeaders = [
    'traceparent',
    'tracestate',
    'x-b3-traceid',
    'uber-trace-id',
    'x-cloud-trace-context',
    'x-amzn-trace-id',
    'x-datadog-trace-id',
  ].filter((h) => h in resHeaders);

  let reflected = false;
  if (traceId) {
    const haystack = (
      Object.values(resHeaders).join('\n') + '\n' + body
    ).toLowerCase();
    if (haystack.includes(traceId)) {
      reflected = true;
      findings.push('Sent trace ID is reflected in the response — tracing context leaks back to the client');
    }
    if ('tracestate' in resHeaders && String(resHeaders['tracestate']).toLowerCase().includes('infinity'))
      findings.push('tracestate value echoed, including the canary vendor key');
  }

  const instrumented = propagationHeaders.length > 0;
  if (instrumented)
    findings.push(`Tracing instrumentation evident via headers: ${propagationHeaders.join(', ')}`);
  if (!instrumented && !reflected)
    findings.push('No tracing context observed in the response');

  let verdict = 'absent';
  if (reflected) verdict = 'reflected';
  else if (instrumented) verdict = 'instrumented';

  return { traceId, reflected, propagationHeaders, instrumented, findings, verdict };
}

/**
 * Build a Zipkin B3 probe for idea 01224 (both multi-header and single-header forms).
 * @returns {{requestHeaders:object, responseHeadersToRecord:string[], note:string}}
 */
export function buildB3Probe() {
  const traceId = Array.from({ length: 32 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
  const spanId = Array.from({ length: 16 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
  return {
    requestHeaders: {
      'X-B3-TraceId': traceId,
      'X-B3-SpanId': spanId,
      'X-B3-ParentSpanId': '0000000000000000',
      'X-B3-Sampled': '1',
      b3: `${traceId}-${spanId}-1`,
    },
    responseHeadersToRecord: [
      'x-b3-traceid',
      'x-b3-spanid',
      'x-b3-parentspanid',
      'x-b3-sampled',
      'b3',
      'traceparent',
      'uber-trace-id',
    ],
    note:
      'Send both Zipkin B3 multi-header and b3 single-header forms. Echoed or ' +
      'propagated B3 context reveals service-mesh tracing internals.',
  };
}

/**
 * Analyze a recorded response for Zipkin B3 propagation handling (idea 01224).
 * @param {{requestHeaders?:object, status?:number, headers?:object, body?:string}} exchange Recorded exchange.
 * @returns {{sentTraceId:string|null, propagated:boolean, conversionDetected:boolean, propagationHeaders:string[], findings:string[], verdict:'propagated'|'converted'|'absent'}}
 */
export function analyzeB3Propagation(exchange) {
  const ex = exchange && typeof exchange === 'object' ? exchange : {};
  const reqHeaders = normalizeHeaders(ex.requestHeaders);
  const resHeaders = normalizeHeaders(ex.headers);
  const body = typeof ex.body === 'string' ? ex.body : '';
  const findings = [];

  const sentTraceId = reqHeaders['x-b3-traceid'] || null;
  const b3Headers = [
    'x-b3-traceid',
    'x-b3-spanid',
    'x-b3-parentspanid',
    'x-b3-sampled',
    'x-b3-flags',
    'b3',
  ].filter((h) => h in resHeaders);

  let propagated = false;
  if (sentTraceId) {
    const haystack = Object.values(resHeaders).join('\n') + '\n' + body;
    if (haystack.toLowerCase().includes(String(sentTraceId).toLowerCase())) {
      propagated = true;
      findings.push('Sent B3 trace ID propagated/echoed — service mesh honors Zipkin B3 context');
    }
  }

  const conversionDetected =
    'traceparent' in resHeaders || 'x-cloud-trace-context' in resHeaders;
  if (conversionDetected)
    findings.push(
      'B3 context converted into another tracing format ' +
        `(${['traceparent', 'x-cloud-trace-context'].filter((h) => h in resHeaders).join(', ')}) — ` +
        'multi-format instrumentation present'
    );
  if (b3Headers.length > 0)
    findings.push(`B3 propagation headers observed: ${b3Headers.join(', ')}`);
  if (b3Headers.length === 0 && !propagated && !conversionDetected)
    findings.push('No B3 handling observed');

  let verdict = 'absent';
  if (propagated) verdict = 'propagated';
  else if (conversionDetected) verdict = 'converted';

  return {
    sentTraceId,
    propagated,
    conversionDetected,
    propagationHeaders: b3Headers,
    findings,
    verdict,
  };
}

/**
 * Candidate paths where distributed-tracing consoles are commonly exposed
 * (idea 01225). All are benign GETs of read-only dashboards/queries.
 * @returns {string[]}
 */
export function tracingEndpointCandidates() {
  return [
    '/jaeger',
    '/jaeger/search',
    '/jaeger/api/traces',
    '/api/traces',
    '/traces',
    '/zipkin',
    '/zipkin/',
    '/zipkin/api/v2/traces',
    '/api/v2/traces',
    '/otel',
    '/otel/traces',
    '/tempo',
    '/tempo/api/search',
    '/signoz',
    '/query/service/jaeger',
    '/tracing',
    '/ui/jaeger',
    '/lightstep',
    '/newrelic',
  ];
}

/**
 * Analyze a recorded probe of a candidate tracing endpoint (idea 01225).
 * Looks for UI markers (Jaeger/Zipkin/SigNoz/Tempo), span payload keys, and
 * HTTP behaviors that indicate an exposed tracing console.
 * @param {{path:string, status?:number, headers?:object, body?:string}} response Recorded response.
 * @returns {{path:string, exposed:boolean, platform:string|null, evidence:string[], payloadLeak:boolean, findings:string[], verdict:'exposed'|'auth-gated'|'absent'}}
 */
export function analyzeTracingEndpoint(response) {
  const res = response && typeof response === 'object' ? response : {};
  const path = String(res.path || '');
  const status = typeof res.status === 'number' ? res.status : null;
  const headers = normalizeHeaders(res.headers);
  const body = typeof res.body === 'string' ? res.body : '';
  const bodyLower = body.toLowerCase();
  const findings = [];
  const evidence = [];
  let platform = null;

  const markers = [
    ['jaeger', /jaeger/i],
    ['zipkin', /zipkin/i],
    ['signoz', /signoz/i],
    ['tempo', /tempo|grafana.*tracing/i],
    ['opentelemetry', /opentelemetry|otel/i],
    ['lightstep', /lightstep/i],
    ['elastic-apm', /elastic-apm|apm-server/i],
  ];
  for (const [name, rx] of markers) {
    if (rx.test(body) || rx.test(headers['server'] || '') || rx.test(path)) {
      platform = platform || name;
      evidence.push(`platform marker: ${name}`);
    }
  }

  const payloadKeys = ['traceID', '"spans"', '"trace_id"', 'operationName', 'durationUs', '"processes"'];
  const payloadHits = payloadKeys.filter((k) => body.includes(k));
  if (payloadHits.length >= 2) {
    evidence.push(`span payload keys: ${payloadHits.join(', ')}`);
  }

  if (/<title>.*(jaeger|zipkin|signoz|tempo).*<\/title>/i.test(body)) {
    evidence.push('tracing UI title tag');
  }
  if (/Content-Security-Policy|application\/json/.test(headers['content-type'] || '')) {
    evidence.push(`content-type: ${headers['content-type']}`);
  }

  const exposed = status === 200 && evidence.length > 0;
  const payloadLeak = status === 200 && payloadHits.length >= 2;

  if (exposed) {
    findings.push(
      `Exposed distributed-tracing endpoint at ${path} ` +
        `(platform: ${platform || 'unknown'}) — may disclose real request payloads`
    );
  } else if (status === 401 || status === 403) {
    findings.push(`${path} returned ${status} — tracing endpoint exists but is auth-gated`);
  } else if (status === 404) {
    findings.push(`${path} returned 404 — no tracing endpoint here`);
  } else {
    findings.push(`${path} returned status ${status} — inconclusive`);
  }
  if (payloadLeak)
    findings.push('Response contains span payload data (trace IDs, spans, operation names)');

  let verdict = 'absent';
  if (exposed) verdict = 'exposed';
  else if (status === 401 || status === 403) verdict = 'auth-gated';

  return { path, exposed, platform, evidence, payloadLeak, findings, verdict };
}

/**
 * One-line summary of the tracing surface findings for a hunt report.
 * @param {object} summary Any analyzer result from this module carrying a findings array.
 * @returns {string}
 */
export function tracingSurfaceSummary(summary) {
  if (!summary || !Array.isArray(summary.findings) || summary.findings.length === 0)
    return 'No tracing surface observations recorded.';
  return summary.findings.join(' ');
}
