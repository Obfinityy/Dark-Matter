/**
 * grpcAnalysis.js — Defensive gRPC surface analysis for an authorized bug-bounty agent.
 *
 * Idea 01031: gRPC health-check protocol probe — build grpc.health.v1.Health/Check
 *   request descriptors for known service names; a health response confirms which
 *   services actually run on the target.
 * Idea 01032: gRPC-web support detection — build application/grpc-web framed probe
 *   descriptors and classify response headers to decide whether the endpoint
 *   speaks gRPC-web (browser-reachable, often CORS-misconfigured).
 * Idea 01033: gRPC transcoding discovery — map gRPC service/method paths to
 *   REST-style candidate paths so the agent can spot transcoding proxies that
 *   translate HTTP/JSON to gRPC and may skip method-level checks.
 * Idea 01034: gRPC error-detail leakage analysis — parse google.rpc.Status JSON
 *   detail payloads for leaked field constraints and internal codes.
 * Idea 01035: gRPC metadata leakage check — inspect response headers and trailers
 *   for reflected internal metadata such as service versions and backend hosts.
 * Idea 01036: gRPC deadline abuse test — build extreme deadline/timeout probe
 *   descriptors and assess how the server treats them (zero, tiny, huge).
 * Idea 01037: gRPC max-message-size probing — generate an incremental message
 *   size ladder so the agent can map a server's message-size limits and
 *   oversized-message handling without touching production payloads.
 * Idea 01038: Proto field-number guessing — build unknown-field-number probe
 *   descriptors and analyse parser tolerance to distinguish strict schemas from
 *   lenient ones that silently accept guessed fields.
 * Idea 01039: gRPC status-to-HTTP mapping analysis — compare REST status codes
 *   against gRPC status codes across transports to detect inconsistent mappings
 *   that leak whether an endpoint is native REST or transcoded.
 * Idea 01040: gRPC keepalive behavior probe — describe idle-stream keepalive
 *   policy probes (ping intervals, timeouts) to surface connection-lifecycle
 *   assumptions the target's operators should review.
 *
 * No network calls: this module builds probe descriptors for the agent's
 * network layer and parses operator-supplied response data (headers,
 * trailers, status text, service lists). Defensive surface-mapping of the
 * engagement's own target only.
 */

/** The standard gRPC health-check service path. */
export const HEALTH_SERVICE_PATH = 'grpc.health.v1.Health';

/** The standard gRPC health-check method name. */
export const HEALTH_METHOD_NAME = 'Check';

/** Well-known service names a gRPC health probe should try. */
export const KNOWN_SERVICE_NAMES = [
  '',
  'grpc.health.v1.Health',
  'grpc.reflection.v1alpha.ServerReflection',
  'grpc.reflection.v1.ServerReflection',
  'google.cloud.automl.v1.AutoMl',
  'envoy.service.discovery.v3.AggregatedDiscoveryService',
];

/** Canonical gRPC status codes. */
export const GRPC_STATUS_CODES = Object.freeze({
  0: 'OK',
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  10: 'ABORTED',
  11: 'OUT_OF_RANGE',
  12: 'UNIMPLEMENTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  15: 'DATA_LOSS',
  16: 'UNAUTHENTICATED',
});

/** gRPC -> HTTP status mapping used by transcoding proxies. */
export const GRPC_TO_HTTP_STATUS = Object.freeze({
  0: 200,
  1: 499,
  2: 500,
  3: 400,
  4: 504,
  5: 404,
  6: 409,
  7: 403,
  8: 429,
  9: 400,
  10: 409,
  11: 400,
  12: 501,
  13: 500,
  14: 503,
  15: 500,
  16: 401,
});

const VALID_FIELD_TYPES = new Set([
  'double', 'float', 'int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64',
  'fixed32', 'fixed64', 'sfixed32', 'sfixed64', 'bool', 'string', 'bytes',
]);

/**
 * Build a grpc.health.v1.Health/Check request descriptor.
 * @param {string} serviceName - Service name to probe (empty string probes overall health).
 * @returns {{path: string, method: string, serviceName: string, requestBody: object, grpcTimeout: string}}
 */
export function healthCheckDescriptor(serviceName = '') {
  const name = String(serviceName);
  return {
    path: `/${HEALTH_SERVICE_PATH}/${HEALTH_METHOD_NAME}`,
    method: 'POST',
    serviceName: name,
    requestBody: { service: name },
    grpcTimeout: '5s',
    expectedStatusOnMissing: 'UNIMPLEMENTED',
  };
}

/**
 * Build health-check descriptors for every known service name.
 * @param {string[]} [serviceNames] - Extra service names from the engagement scope.
 * @returns {Array<ReturnType<typeof healthCheckDescriptor>>}
 */
export function healthCheckSweepDescriptors(serviceNames = []) {
  const names = new Set([...KNOWN_SERVICE_NAMES, ...serviceNames.map(String)]);
  return [...names].map(healthCheckDescriptor);
}

/**
 * Classify a health-check response status into a finding label.
 * @param {{grpcStatus?: string, servingStatus?: string}} response - Operator-supplied result.
 * @returns {{confirmed: boolean, verdict: string, detail: string}}
 */
export function classifyHealthResponse(response = {}) {
  const { grpcStatus = 'UNKNOWN', servingStatus = '' } = response;
  if (grpcStatus === 'OK' || /^(SERVING|NOT_SERVING|UNKNOWN)$/.test(servingStatus)) {
    return {
      confirmed: true,
      verdict: 'service-present',
      detail: `Health probe answered with serving status "${servingStatus || 'unspecified'}".`,
    };
  }
  if (grpcStatus === 'UNIMPLEMENTED') {
    return { confirmed: false, verdict: 'health-not-implemented', detail: 'Server rejected the health check as unimplemented.' };
  }
  return {
    confirmed: false,
    verdict: 'inconclusive',
    detail: `Health probe returned gRPC status ${grpcStatus} with no serving status.`,
  };
}

/**
 * Build application/grpc-web framed probe descriptors for an endpoint.
 * @param {string} endpoint - Full path, e.g. '/my.package.Service/Method'.
 * @param {string[]} [variants] - Content-type variants to try.
 * @returns {Array<{url: string, method: string, contentType: string, frame: object}>}
 */
export function grpcWebProbeDescriptors(
  endpoint = '/grpc.health.v1.Health/Check',
  variants = ['application/grpc-web', 'application/grpc-web+proto', 'application/grpc-web+json', 'application/grpc-web-text'],
) {
  return variants.map(contentType => ({
    url: endpoint,
    method: 'POST',
    contentType,
    frame: {
      framing: 'grpc-web',
      flags: 0x00,
      payloadBytes: 0,
      payloadPreview: '<empty proto body>',
    },
    note: 'Network layer sends a zero-length gRPC-web frame and records headers/status.',
  }));
}

/**
 * Decide whether operator-supplied response headers indicate gRPC-web support.
 * @param {Record<string, string>} responseHeaders
 * @returns {{supported: boolean, evidence: string[], contentType: string|null}}
 */
export function detectGrpcWebSupport(responseHeaders = {}) {
  const lowered = {};
  for (const [k, v] of Object.entries(responseHeaders)) lowered[k.toLowerCase()] = String(v);
  const contentType = lowered['content-type'] || null;
  const grpcStatus = lowered['grpc-status'] || null;
  const evidence = [];
  let supported = false;

  if (contentType && /application\/grpc-web/i.test(contentType)) {
    supported = true;
    evidence.push(`content-type: ${contentType}`);
  }
  if (grpcStatus !== null) {
    supported = true;
    evidence.push(`grpc-status: ${grpcStatus}`);
  }
  const grpcWebRelated = Object.keys(lowered).filter(k => k.startsWith('x-grpc-web'));
  if (grpcWebRelated.length) {
    supported = true;
    evidence.push(...grpcWebRelated.map(k => `${k}: ${lowered[k]}`));
  }
  return { supported, evidence, contentType };
}

/**
 * Map a gRPC service/method path to REST-style transcoding candidate paths.
 * @param {string} servicePath - e.g. '/billing.v1.InvoiceService/CreateInvoice'.
 * @returns {string[]}
 */
export function transcodingCandidatePaths(servicePath = '') {
  const clean = String(servicePath).replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts.length < 2) return [`/${clean}`];
  const [service, method] = parts;
  const serviceSegments = service.split('.');
  const base = serviceSegments.slice(-1)[0].replace(/Service$/i, '');
  const snake = method
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
  const lowerBase = base.charAt(0).toLowerCase() + base.slice(1);
  const kebabBase = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return [
    `/${clean}`,
    `/v1/${lowerBase}:${method}`,
    `/v1/${lowerBase}/${snake}`,
    `/v1/${lowerBase}/${method}`,
    `/api/v1/${lowerBase}:${method}`,
    `/api/v1/${kebabBase}/${snake}`,
  ].filter((p, i, arr) => arr.indexOf(p) === i);
}

/**
 * Compare transcoding candidate responses to spot method-check bypasses.
 * @param {{path: string, httpStatus: number}[]} probeResults - Operator-supplied results.
 * @returns {{suspicious: Array<{path: string, httpStatus: number, reason: string}>, summary: string}}
 */
export function analyzeTranscodingResponses(probeResults = []) {
  const suspicious = [];
  for (const r of probeResults) {
    const { path = '', httpStatus = 0 } = r;
    if (httpStatus >= 200 && httpStatus < 300 && /\/v1\//.test(path)) {
      suspicious.push({ path, httpStatus, reason: 'REST-style path answered 2xx — transcoding proxy may translate without method-level checks.' });
    } else if (httpStatus === 405 || httpStatus === 501) {
      suspicious.push({ path, httpStatus, reason: 'Distinct method-not-supported handling hints at a transcoding layer.' });
    }
  }
  return {
    suspicious,
    summary: `${probeResults.length} path(s) probed, ${suspicious.length} look like transcoding endpoints.`,
  };
}

/**
 * Parse a google.rpc.Status JSON detail payload for leaked constraints.
 * @param {string|object} statusJson - Raw JSON string or parsed object.
 * @returns {{leaks: Array<{field: string, kind: string, detail: string}>, detailCount: number, rawTypes: string[]}}
 */
export function parseStatusDetails(statusJson) {
  let parsed;
  try {
    parsed = typeof statusJson === 'string' ? JSON.parse(statusJson) : statusJson;
  } catch {
    return { leaks: [], detailCount: 0, rawTypes: [], parseError: true };
  }
  const details = Array.isArray(parsed?.details) ? parsed.details : [];
  const leaks = [];
  const rawTypes = [];

  for (const d of details) {
    if (!d || typeof d !== 'object') continue;
    const typeUrl = String(d['@type'] || '');
    rawTypes.push(typeUrl);
    const shortType = typeUrl.split('/').pop() || '';

    if (/BadRequest/i.test(shortType) && Array.isArray(d.fieldViolations)) {
      for (const v of d.fieldViolations) {
        leaks.push({
          field: String(v.field || ''),
          kind: 'field-constraint',
          detail: String(v.description || 'field violation reported by server'),
        });
      }
    } else if (/ErrorInfo/i.test(shortType)) {
      if (d.reason) leaks.push({ field: '', kind: 'internal-reason', detail: String(d.reason) });
      if (d.domain) leaks.push({ field: '', kind: 'internal-domain', detail: String(d.domain) });
      if (d.metadata && typeof d.metadata === 'object') {
        for (const [k, v] of Object.entries(d.metadata)) {
          leaks.push({ field: k, kind: 'internal-metadata', detail: String(v) });
        }
      }
    } else if (/DebugInfo/i.test(shortType)) {
      if (d.stackEntries?.length) leaks.push({ field: '', kind: 'stack-trace', detail: `${d.stackEntries.length} stack frame(s) leaked` });
      if (d.detail) leaks.push({ field: '', kind: 'debug-detail', detail: String(d.detail).slice(0, 300) });
    } else if (/QuotaFailure|RetryInfo|RequestInfo|ResourceInfo|Help|LocalizedMessage|PreconditionFailure/i.test(shortType)) {
      leaks.push({ field: '', kind: 'rich-error-detail', detail: `detail type ${shortType} exposed by server` });
    }
  }
  return { leaks, detailCount: details.length, rawTypes };
}

/** Header/trailer names that commonly leak internal infrastructure details. */
export const LEAKY_METADATA_PATTERNS = [
  { name: 'server', pattern: /^(?!envoy$|grpc$).+/i, reason: 'server banner discloses product/version' },
  { name: 'x-backend-host', pattern: /.+/, reason: 'internal backend host reflected' },
  { name: 'x-internal-host', pattern: /.+/, reason: 'internal host reflected' },
  { name: 'x-envoy-upstream-service-time', pattern: /.+/, reason: 'upstream timing side-channel' },
  { name: 'grpc-service-version', pattern: /.+/, reason: 'service version disclosed' },
  { name: 'x-service-version', pattern: /.+/, reason: 'service version disclosed' },
  { name: 'x-app-version', pattern: /.+/, reason: 'application version disclosed' },
  { name: 'x-powered-by', pattern: /.+/, reason: 'framework banner disclosed' },
  { name: 'x-request-id', pattern: /^[0-9a-f-]{20,}$/i, reason: 'correlatable request id' },
  { name: 'set-cookie', pattern: /.+/, reason: 'cookie set on an API transport' },
  { name: 'x-debug', pattern: /.+/, reason: 'debug metadata enabled' },
];

/**
 * Inspect response headers and trailers for leaked internal metadata.
 * @param {Record<string, string>} [headers]
 * @param {Record<string, string>} [trailers]
 * @returns {{findings: Array<{source: 'header'|'trailer', name: string, value: string, reason: string}>, internalHosts: string[]}}
 */
export function analyzeMetadataLeakage(headers = {}, trailers = {}) {
  const findings = [];
  const internalHosts = [];
  const hostPattern = /\b(?:[a-z0-9-]+\.)+(?:internal|local|corp|lan|svc|cluster)(?:\.[a-z0-9-]+)*\b|\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2}\b/i;

  const scan = (source, bag) => {
    for (const [rawName, rawValue] of Object.entries(bag || {})) {
      const name = String(rawName).toLowerCase();
      const value = String(rawValue);
      for (const leak of LEAKY_METADATA_PATTERNS) {
        if (name === leak.name && leak.pattern.test(value)) {
          findings.push({ source, name: rawName, value: value.slice(0, 200), reason: leak.reason });
        }
      }
      const hostMatch = value.match(hostPattern);
      if (hostMatch && !internalHosts.includes(hostMatch[0])) {
        internalHosts.push(hostMatch[0]);
        findings.push({ source, name: rawName, value: value.slice(0, 200), reason: 'internal hostname or RFC1918 address in metadata value' });
      }
    }
  };

  scan('header', headers);
  scan('trailer', trailers);
  return { findings, internalHosts };
}

/**
 * Build extreme deadline/timeout probe descriptors.
 * @param {string[]} [deadlineValues] - Deadline strings to test.
 * @returns {Array<{deadline: string, grpcTimeoutHeader: string, intent: string}>}
 */
export function deadlineProbeDescriptors(
  deadlineValues = ['0s', '1ns', '1ms', '100y', '9999999999s', '-1s'],
) {
  return deadlineValues.map(deadline => ({
    deadline,
    grpcTimeoutHeader: deadline,
    intent:
      deadline === '0s'
        ? 'zero deadline — server should fail fast, not hang'
        : /^-/.test(deadline) || deadline === '1ns' || deadline === '1ms'
          ? 'near-zero deadline — checks whether server work stops on expiry'
          : 'absurdly large deadline — checks whether limits are clamped',
    probeFor: 'DEADLINE_EXCEEDED vs silent-hang vs clamped-value behaviour',
  }));
}

/**
 * Assess how a server treated an extreme deadline (operator-supplied outcome).
 * @param {{deadline: string, outcome: string, elapsedMs?: number}} probe - outcome in
 *   {'deadline-exceeded','hung','completed','clamped'}.
 * @returns {{risk: 'low'|'medium'|'high', assessment: string}}
 */
export function assessDeadlineBehavior(probe = {}) {
  const { deadline = '', outcome = '', elapsedMs = 0 } = probe;
  if (outcome === 'hung') {
    return {
      risk: 'high',
      assessment: `Deadline ${deadline} left server work running after client disconnect (no DEADLINE_EXCEEDED within ${elapsedMs}ms).`,
    };
  }
  if (outcome === 'clamped') {
    return { risk: 'low', assessment: `Deadline ${deadline} was clamped to a sane maximum by the server.` };
  }
  if (outcome === 'deadline-exceeded') {
    return { risk: 'low', assessment: `Deadline ${deadline} produced a clean DEADLINE_EXCEEDED.` };
  }
  return { risk: 'medium', assessment: `Deadline ${deadline} completed normally; verify cancellation actually stops server work.` };
}

/**
 * Generate an incremental message-size ladder for max-message-size probing.
 * @param {number} [startBytes] - Smallest message size.
 * @param {number} [maxBytes] - Largest message size (default 16 MiB).
 * @param {number} [steps] - Number of ladder rungs.
 * @returns {number[]}
 */
export function sizeProbeLadder(startBytes = 1024, maxBytes = 16 * 1024 * 1024, steps = 8) {
  const start = Math.max(1, Math.floor(startBytes));
  const max = Math.max(start, Math.floor(maxBytes));
  const n = Math.max(2, Math.floor(steps));
  const ladder = [];
  for (let i = 0; i < n; i++) {
    const ratio = i / (n - 1);
    ladder.push(Math.round(start * Math.pow(max / start, ratio)));
  }
  return ladder;
}

/**
 * Classify the outcome of one message-size probe rung.
 * @param {{bytes: number, grpcStatus?: string, httpStatus?: number}} result - Operator-supplied outcome.
 * @returns {{verdict: 'accepted'|'rejected'|'inconclusive', note: string}}
 */
export function classifySizeProbeResult(result = {}) {
  const { bytes = 0, grpcStatus = '', httpStatus = 0 } = result;
  if (grpcStatus === 'OK') return { verdict: 'accepted', note: `${bytes} bytes accepted.` };
  if (grpcStatus === 'RESOURCE_EXHAUSTED' || grpcStatus === 'INVALID_ARGUMENT' || httpStatus === 413) {
    return { verdict: 'rejected', note: `${bytes} bytes rejected (${grpcStatus || httpStatus}) — size limit lies below this rung.` };
  }
  return { verdict: 'inconclusive', note: `${bytes} bytes gave ${grpcStatus || httpStatus || 'no clear signal'}.` };
}

/**
 * Build unknown-field-number probe descriptors for proto field-number guessing.
 * @param {string} messageType - e.g. 'billing.v1.CreateInvoiceRequest'.
 * @param {number[]} [fieldNumbers] - Field numbers to try (should be unassigned).
 * @param {string} [fieldType] - Wire-compatible field type to encode, default 'string'.
 * @returns {Array<{messageType: string, fieldNumber: number, wireType: number, encoding: string}>}
 */
export function fieldNumberGuessDescriptors(messageType, fieldNumbers = [99, 100, 199, 1000], fieldType = 'string') {
  const type = VALID_FIELD_TYPES.has(fieldType) ? fieldType : 'string';
  const wireType = type === 'string' || type === 'bytes' ? 2 : type === 'bool' ? 0 : 0;
  return fieldNumbers
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 536870911 && !(n >= 19000 && n <= 19999))
    .map(fieldNumber => ({
      messageType: String(messageType),
      fieldNumber,
      wireType,
      encoding: `field ${fieldNumber} (${type}, wire type ${wireType}) with a benign sentinel value`,
      note: 'Network layer encodes the unknown field and records whether the server accepts, ignores, or rejects it.',
    }));
}

/**
 * Analyse parser tolerance from operator-supplied unknown-field probe outcomes.
 * @param {{fieldNumber: number, outcome: string}[]} responses - outcome in
 *   {'accepted','ignored','rejected','error'}.
 * @returns {{tolerance: 'strict'|'lenient'|'mixed', summary: string, detail: object}}
 */
export function analyzeFieldTolerance(responses = []) {
  const counts = { accepted: 0, ignored: 0, rejected: 0, error: 0 };
  for (const r of responses) {
    if (r && counts[r.outcome] !== undefined) counts[r.outcome] += 1;
  }
  const total = responses.length;
  const acceptedOrIgnored = counts.accepted + counts.ignored;
  let tolerance = 'mixed';
  if (total === 0) tolerance = 'mixed';
  else if (acceptedOrIgnored === 0) tolerance = 'strict';
  else if (counts.rejected === 0 && counts.error === 0) tolerance = 'lenient';

  const summary =
    total === 0
      ? 'No probe outcomes supplied.'
      : tolerance === 'lenient'
        ? `${acceptedOrIgnored}/${total} unknown field number(s) tolerated — parser is lenient; guessed fields may reach application logic.`
        : tolerance === 'strict'
          ? `All ${total} unknown field number(s) rejected — parser enforces a strict schema.`
          : `Mixed tolerance across ${total} probe(s): accepted/ignored=${acceptedOrIgnored}, rejected=${counts.rejected}, error=${counts.error}.`;
  return { tolerance, summary, detail: counts };
}

/**
 * Compare REST status codes against gRPC status codes across transports.
 * @param {Array<{transport: string, status: number|string}>} observations - Operator-supplied.
 * @returns {{consistent: boolean, mismatches: Array<{transport: string, status: number|string, expectedHttp: number|null}>, summary: string}}
 */
export function analyzeStatusMapping(observations = []) {
  const mismatches = [];
  for (const obs of observations) {
    if (!obs || obs.transport !== 'rest') continue;
    const http = Number(obs.status);
    for (const other of observations) {
      if (!other || other.transport !== 'grpc') continue;
      const grpcCode = Number(other.status);
      const expectedHttp = GRPC_TO_HTTP_STATUS[grpcCode];
      if (expectedHttp !== undefined && http !== expectedHttp) {
        mismatches.push({
          transport: 'rest',
          status: http,
          expectedHttp,
          reason: `REST returned ${http} but the equivalent gRPC status ${grpcCode} (${GRPC_STATUS_CODES[grpcCode]}) maps to ${expectedHttp} — inconsistent mapping.`,
        });
      }
    }
  }
  const unique = mismatches.filter((m, i, arr) => arr.findIndex(x => x.status === m.status && x.expectedHttp === m.expectedHttp) === i);
  return {
    consistent: unique.length === 0,
    mismatches: unique,
    summary: unique.length
      ? `${unique.length} inconsistent status mapping(s) — endpoint behaviour differs across transports.`
      : 'REST/gRPC status mappings are consistent across the observed transports.',
  };
}

/**
 * Describe an idle-stream keepalive policy probe.
 * @param {string} streamTarget - e.g. '/my.package.Service/Subscribe'.
 * @returns {{target: string, phases: Array<{name: string, idleSeconds: number, keepalivePingInterval: string, observe: string}>}}
 */
export function keepaliveProbeDescriptor(streamTarget = '') {
  return {
    target: String(streamTarget),
    method: 'server-streaming keepalive policy probe',
    phases: [
      {
        name: 'baseline-idle',
        idleSeconds: 30,
        keepalivePingInterval: 'none',
        observe: 'Does the server close an idle stream on its own, and with what status?',
      },
      {
        name: 'aggressive-ping',
        idleSeconds: 120,
        keepalivePingInterval: '5s',
        observe: 'Does the server enforce a minimum ping interval (ENHANCE_YOUR_CALM / GOAWAY)?',
      },
      {
        name: 'sparse-ping',
        idleSeconds: 600,
        keepalivePingInterval: '120s',
        observe: 'How long will the server hold a barely-alive stream? Note max connection age.',
      },
    ],
    note: 'Network layer opens the stream, holds it per phase, and records GOAWAY frames, ping acks, and close statuses.',
  };
}

/**
 * Summarise an operator-supplied keepalive observation.
 * @param {{phase: string, serverClosed: boolean, closeStatus?: string, goawayReceived?: boolean, maxIdleSeconds?: number}} observation
 * @returns {{assessment: string, risk: 'low'|'medium'|'high'}}
 */
export function summarizeKeepaliveBehavior(observation = {}) {
  const { phase = '', serverClosed = false, closeStatus = '', goawayReceived = false, maxIdleSeconds = 0 } = observation;
  if (goawayReceived) {
    return { risk: 'low', assessment: `Phase "${phase}": server sent GOAWAY — keepalive policy is enforced.` };
  }
  if (!serverClosed && maxIdleSeconds >= 600) {
    return {
      risk: 'medium',
      assessment: `Phase "${phase}": server held an idle stream for ${maxIdleSeconds}s without closing — long-lived idle streams accumulate server-side.`,
    };
  }
  if (serverClosed) {
    return { risk: 'low', assessment: `Phase "${phase}": server closed the idle stream with status ${closeStatus || 'unknown'} — lifecycle bounded.` };
  }
  return { risk: 'medium', assessment: `Phase "${phase}": no server close observed within the window; retest with a longer idle phase.` };
}

/**
 * Build a report finding from a gRPC analysis result bundle.
 * @param {{title?: string, evidence?: string[], leaks?: number, confirmedServices?: string[]}} result
 */
export function grpcAnalysisFinding(result = {}) {
  const { title = 'gRPC surface analysis', evidence = [], leaks = 0, confirmedServices = [] } = result;
  return {
    title,
    severity: leaks > 0 ? 'Medium' : confirmedServices.length > 0 ? 'Low' : 'Info',
    confidence: evidence.length > 0 ? 'high' : 'medium',
    confirmedServices: [...confirmedServices],
    leakCount: leaks,
    evidence: evidence.join(' | '),
  };
}

export const GRPC_ANALYSIS = {
  healthCheckDescriptor,
  healthCheckSweepDescriptors,
  classifyHealthResponse,
  grpcWebProbeDescriptors,
  detectGrpcWebSupport,
  transcodingCandidatePaths,
  analyzeTranscodingResponses,
  parseStatusDetails,
  analyzeMetadataLeakage,
  deadlineProbeDescriptors,
  assessDeadlineBehavior,
  sizeProbeLadder,
  classifySizeProbeResult,
  fieldNumberGuessDescriptors,
  analyzeFieldTolerance,
  analyzeStatusMapping,
  keepaliveProbeDescriptor,
  summarizeKeepaliveBehavior,
  grpcAnalysisFinding,
  HEALTH_SERVICE_PATH,
  HEALTH_METHOD_NAME,
  KNOWN_SERVICE_NAMES,
  GRPC_STATUS_CODES,
  GRPC_TO_HTTP_STATUS,
  LEAKY_METADATA_PATTERNS,
};
export default GRPC_ANALYSIS;
