/**
 * traceReflectionAnalyzer.js — TRACE method reflection analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00405: analyze a recorded TRACE response for
 * Cross-Site Tracing (XST) reflection behavior and proxy header leakage.
 *
 * During an authorized engagement the caller sends a single benign TRACE
 * request carrying a canary header and records the response. A compliant
 * server echoes the request back in the message body; reflecting cookies or
 * authorization headers through TRACE enables XST attacks when combined with
 * script execution, and leaked Via/X-Forwarded-For headers expose proxy
 * topology. This module is pure analysis of the recorded request/response
 * pair. No requests are sent by this module.
 */

/**
 * Normalize a header map to lower-cased keys.
 * @param {object} headers Header map (any case).
 * @returns {Record<string,string>}
 */
export function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers)) {
    if (Array.isArray(v)) out[String(k).toLowerCase()] = v.join(', ');
    else if (v != null) out[String(k).toLowerCase()] = String(v);
  }
  return out;
}

/**
 * Analyze a recorded TRACE exchange for reflection and leakage.
 * @param {object} exchange { requestHeaders?: object, responseStatus?: number, responseHeaders?: object, responseBody?: string }.
 * @param {object} opts { canaryHeader?: string (default 'x-trace-canary') }.
 * @returns {{traceEnabled:boolean, reflected:boolean, reflectedHeaders:string[], cookieReflected:boolean, authReflected:boolean, proxyLeakage:string[], xstRisk:'critical'|'high'|'medium'|'low', findings:string[]}}
 */
export function analyzeTraceResponse(exchange, opts = {}) {
  const canary = String(opts.canaryHeader || 'x-trace-canary').toLowerCase();
  const ex = exchange && typeof exchange === 'object' ? exchange : {};
  const reqHeaders = normalizeHeaders(ex.requestHeaders);
  const resHeaders = normalizeHeaders(ex.responseHeaders);
  const body = typeof ex.responseBody === 'string' ? ex.responseBody : '';
  const status = typeof ex.responseStatus === 'number' ? ex.responseStatus : null;

  const traceEnabled =
    status === 200 || status === 201 || (body.length > 0 && /trace\s+\//i.test(body));
  const findings = [];
  const reflectedHeaders = [];
  let cookieReflected = false;
  let authReflected = false;

  if (traceEnabled) {
    findings.push('TRACE method is enabled and echoes request data back to the client');
    const bodyLower = body.toLowerCase();
    for (const [name, value] of Object.entries(reqHeaders)) {
      if (bodyLower.includes(name) && body.includes(String(value).slice(0, 24))) {
        reflectedHeaders.push(name);
        if (name === 'cookie') cookieReflected = true;
        if (name === 'authorization' || name === 'proxy-authorization') authReflected = true;
      }
    }
    if (reflectedHeaders.length > 0) {
      findings.push(
        `Reflected request headers observed in TRACE body: ${reflectedHeaders.join(', ')}`
      );
    }
    if (canary in reqHeaders && !reflectedHeaders.includes(canary)) {
      findings.push('Canary header was NOT reflected — TRACE echo may be filtered or partial');
    }
  } else {
    findings.push('TRACE does not appear enabled (non-2xx status and no echo body)');
  }

  const proxyLeakage = [];
  const proxyHeaders = [
    'via',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
    'forwarded',
  ];
  for (const h of proxyHeaders) {
    if (h in resHeaders || body.toLowerCase().includes(h)) proxyLeakage.push(h);
  }
  if (proxyLeakage.length > 0) {
    findings.push(`Proxy topology leakage via headers: ${proxyLeakage.join(', ')}`);
  }

  let xstRisk = 'low';
  if (traceEnabled && (cookieReflected || authReflected)) xstRisk = 'critical';
  else if (traceEnabled && reflectedHeaders.length > 0) xstRisk = 'high';
  else if (traceEnabled) xstRisk = 'medium';

  return {
    traceEnabled,
    reflected: reflectedHeaders.length > 0,
    reflectedHeaders,
    cookieReflected,
    authReflected,
    proxyLeakage,
    xstRisk,
    findings,
  };
}

/**
 * Render a one-paragraph assessment of the TRACE analysis.
 * @param {{traceEnabled:boolean, xstRisk:string, reflectedHeaders:string[], proxyLeakage:string[]}} result Output of analyzeTraceResponse.
 * @returns {string}
 */
export function traceRiskSummary(result) {
  if (!result || !result.traceEnabled) return 'TRACE is not enabled; no XST exposure.';
  const parts = [`TRACE is enabled with XST risk rated ${result.xstRisk}.`];
  if (result.reflectedHeaders.length > 0)
    parts.push(`Echoed headers: ${result.reflectedHeaders.join(', ')}.`);
  if (result.proxyLeakage.length > 0)
    parts.push(`Proxy leakage: ${result.proxyLeakage.join(', ')}.`);
  parts.push('Recommendation: disable TRACE at the server or edge.');
  return parts.join(' ');
}
