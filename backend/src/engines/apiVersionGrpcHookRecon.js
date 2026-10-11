/**
 * apiVersionGrpcHookRecon.js — API versioning, gRPC introspection & webhook/hook
 * surface reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Every
 * function inspects OBSERVED or SUPPLIED data (receiver configs, Set-Cookie
 * headers, token claim names, documented service configs, API specs, error
 * text) and derives detection, classification, and risk findings. They plan
 * safe probes (descriptors only — nothing here opens a network connection),
 * never send exploit payloads, and where an idea would require active abuse
 * (e.g. registering exfiltration callbacks via hooks) only the
 * detection/mapping side is implemented — never the abuse step.
 *
 * Covers idea-bank ideas 1291-1300:
 *  1291 scoreWebhookAlgorithmAgility — which signature algorithms a webhook
 *         receiver accepts + algorithm-confusion downgrade risk
 *  1292 detectVersionCookies — version signals hidden in Set-Cookie headers
 *  1293 analyzeTokenVersionClaims — version-routing claims in tokens (format
 *         analysis of claim names only)
 *  1294 planChannelzProbes — channelz / admin-service probe descriptors for
 *         when gRPC reflection is off (no live calls)
 *  1295 analyzeServiceConfig — extract load-balancing / retry / hedging /
 *         timeout policy from a gRPC service config
 *  1296 inferLoadBalancerBehavior — infer backend count, stickiness and
 *         rotation from observed response samples
 *  1297 discoverRestHooks — find REST-hook subscription endpoints in an API spec
 *  1298 classifyTopics — sensitivity tiers for subscribable event topics
 *  1299 mapEventPii — correlate event types with the PII fields their schemas carry
 *  1300 scanErrorForKeyLeak — detect (redacted) leaked keys/ARNs in gateway error text
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1291_COVERAGE = [1291, 1292, 1293, 1294, 1295, 1296, 1297, 1298, 1299, 1300];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1291: 'scoreWebhookAlgorithmAgility',
    1292: 'detectVersionCookies',
    1293: 'analyzeTokenVersionClaims',
    1294: 'planChannelzProbes',
    1295: 'analyzeServiceConfig',
    1296: 'inferLoadBalancerBehavior',
    1297: 'discoverRestHooks',
    1298: 'classifyTopics',
    1299: 'mapEventPii',
    1300: 'scanErrorForKeyLeak',
  };
}

// ---------------------------------------------------------------- 1291 ----

const STRONG_SIGNATURE_ALGORITHMS = new Set([
  'hs256', 'hs384', 'hs512',
  'hmac-sha256', 'hmac-sha384', 'hmac-sha512',
  'rs256', 'rs384', 'rs512',
  'es256', 'es384', 'es512',
  'ps256', 'ps384', 'ps512',
  'eddsa', 'ed25519',
]);

/** Algorithms that represent a signature downgrade (no real MAC / weak hash). */
const DOWNGRADE_ALGORITHMS = new Set([
  'none', 'plain', 'md5', 'sha1', 'sha-1', 'sha256', 'sha-256', 'sha512', 'sha-512',
]);

/**
 * Score a webhook receiver's signature-algorithm agility from its declared config.
 *
 * Algorithm agility (accepting several algorithms) widens the algorithm-confusion
 * surface: a receiver that also honors `none`, bare hashes, or "plain" comparison
 * can be downgraded away from HMAC. This is pure config analysis — it lists
 * accepted algorithms, never forges a signature.
 *
 * @param {object} [receiverConfig]
 * @param {string[]} [receiverConfig.acceptedAlgorithms] — algorithm names the
 *   receiver is observed/configured to accept (e.g. ['HS256', 'none']).
 * @param {boolean} [receiverConfig.requiresSignature=true] — whether the
 *   receiver rejects unsigned deliveries.
 * @param {string} [receiverConfig.signatureHeader] — header carrying the signature.
 * @returns {{ acceptedAlgorithms: string[], strong: string[], downgraded: string[],
 *   unknown: string[], algorithmCount: number, confusionSurface: boolean,
 *   downgradeRisk: 'low'|'medium'|'high'|'critical', score: number, findings: string[] }}
 */
export function scoreWebhookAlgorithmAgility({ acceptedAlgorithms = [], requiresSignature = true, signatureHeader = '' } = {}) {
  const accepted = (Array.isArray(acceptedAlgorithms) ? acceptedAlgorithms : [])
    .map((a) => String(a).trim().toLowerCase())
    .filter(Boolean);

  const strong = accepted.filter((a) => STRONG_SIGNATURE_ALGORITHMS.has(a));
  const downgraded = accepted.filter((a) => DOWNGRADE_ALGORITHMS.has(a));
  const unknown = accepted.filter((a) => !STRONG_SIGNATURE_ALGORITHMS.has(a) && !DOWNGRADE_ALGORITHMS.has(a));

  let score = 100;
  if (accepted.includes('none')) score -= 50;
  if (accepted.includes('plain')) score -= 40;
  score -= 20 * downgraded.filter((a) => a !== 'none' && a !== 'plain').length;
  if (accepted.length > 1) score -= 10; // agility itself widens the confusion surface
  if (requiresSignature === false) score -= 30;
  score = Math.max(0, Math.min(100, score));

  let downgradeRisk = score >= 85 ? 'low' : score >= 65 ? 'medium' : score >= 40 ? 'high' : 'critical';
  if (accepted.includes('none')) downgradeRisk = 'critical';
  else if (accepted.includes('plain') && (downgradeRisk === 'low' || downgradeRisk === 'medium')) downgradeRisk = 'high';

  const findings = [];
  if (accepted.length === 0) {
    findings.push('No accepted algorithms declared — agility posture is unknown.');
  }
  if (accepted.includes('none')) {
    findings.push("Receiver accepts alg 'none' — signature verification can be trivially bypassed (critical downgrade).");
  }
  if (accepted.includes('plain')) {
    findings.push("Receiver accepts 'plain' comparison — HMAC can be downgraded to an unkeyed comparison.");
  }
  for (const w of downgraded.filter((a) => a !== 'none' && a !== 'plain')) {
    findings.push(`Weak/downgrade algorithm accepted: '${w}' — not a real message-authentication code.`);
  }
  if (accepted.length > 1) {
    findings.push(`Algorithm agility: ${accepted.length} algorithms accepted — confusion surface is present; receivers should pin a single strong algorithm.`);
  }
  if (requiresSignature === false) {
    findings.push('Signatures are optional — unsigned deliveries are accepted.');
  }
  if (signatureHeader && !/sig/i.test(signatureHeader)) {
    findings.push(`Signature header '${signatureHeader}' has an unusual name — verify it is actually verified.`);
  }
  if (unknown.length > 0) {
    findings.push(`Unrecognized algorithms accepted: ${unknown.join(', ')} — review for custom downgrade paths.`);
  }
  if (findings.length === 0) {
    findings.push('Single strong signature algorithm required — no downgrade path detected.');
  }

  return {
    acceptedAlgorithms: accepted,
    strong,
    downgraded,
    unknown,
    algorithmCount: accepted.length,
    confusionSurface: accepted.length > 1,
    downgradeRisk,
    score,
    findings,
  };
}

// ---------------------------------------------------------------- 1292 ----

const VERSION_COOKIE_NAME_RE = /(^|[_.-])(v|ver|version|apiver|api[_.-]?ver|release|build|rev|revision)($|[_.-])/i;
const VERSION_VALUE_RE = /^(v?\d+(\.\d+){0,3}([-.+][0-9a-z.-]+)?|\d{4}[-_]\d{2}([-_]\d{2})?)$/i;

/**
 * Detect API-version signals hidden in Set-Cookie response headers.
 *
 * Cookie-versioned APIs hide their version surface from URL/path scanners; a
 * `api_version=v2` cookie is a routing signal worth mapping. Passive header
 * analysis only — no requests are sent.
 *
 * @param {string|string[]|{ setCookie?: string|string[] }} [input] — raw
 *   Set-Cookie header value(s).
 * @returns {{ cookies: Array<{ name: string, value: string, nameLooksVersioned: boolean,
 *   valueLooksVersioned: boolean, isVersionSignal: boolean }>, versionSignals: Array,
 *   hiddenVersionSurface: boolean, findings: string[] }}
 */
export function detectVersionCookies(input = []) {
  let raw = [];
  if (typeof input === 'string') raw = [input];
  else if (Array.isArray(input)) raw = input;
  else if (input && typeof input === 'object') {
    const sc = input.setCookie;
    raw = Array.isArray(sc) ? sc : (typeof sc === 'string' ? [sc] : []);
  }

  const cookies = raw
    .filter((h) => typeof h === 'string' && h.length > 0)
    .map((header) => {
      const pair = header.split(';', 1)[0] || '';
      const eq = pair.indexOf('=');
      const name = (eq >= 0 ? pair.slice(0, eq) : pair).trim();
      const value = (eq >= 0 ? pair.slice(eq + 1) : '').trim();
      const nameLooksVersioned = VERSION_COOKIE_NAME_RE.test(name);
      const valueLooksVersioned = value.length > 0 && VERSION_VALUE_RE.test(value);
      return { name, value, nameLooksVersioned, valueLooksVersioned, isVersionSignal: nameLooksVersioned || valueLooksVersioned };
    });

  const versionSignals = cookies.filter((c) => c.isVersionSignal);
  const findings = [];
  if (cookies.length === 0) {
    findings.push('No Set-Cookie headers supplied — cookie version surface is unknown.');
  } else if (versionSignals.length === 0) {
    findings.push(`${cookies.length} cookie(s) observed, none carry version signals.`);
  } else {
    findings.push(
      `Versioned cookie surface detected: ${versionSignals.map((c) => `${c.name}=${c.value}`).join(', ')} — version routing is cookie-driven, invisible to URL scanners.`
    );
  }

  return { cookies, versionSignals, hiddenVersionSurface: versionSignals.length > 0, findings };
}

// ---------------------------------------------------------------- 1293 ----

const VERSION_CLAIM_NAMES = new Set([
  'v', 'ver', 'version', 'apiversion', 'tokenversion', 'release', 'build',
]);
const VERSION_VALUE_HINT_RE = /\bv\d+(\.\d+)*\b/i;

function normalizeClaimName(name) {
  return String(name).toLowerCase().replace(/[_-]+/g, '');
}

function valueTypeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Analyze token version-routing claims using FORMAT analysis only.
 *
 * Versioned tokens can route to different backends; knowing that a `ver` claim
 * exists is legitimate recon. Defensive by design: only claim NAMES and VALUE
 * TYPES are inspected — the values of non-version claims are never read,
 * echoed, or stored. Version-claim values (e.g. "v2") are echoed truncated
 * because they are the routing signal itself.
 *
 * @param {object} [header] — decoded JWT header (names/types only).
 * @param {object} [payload] — decoded JWT payload (names/types only).
 * @returns {{ claims: Array<{ name: string, valueType: string, isVersionClaim: boolean,
 *   versionValue?: string }>, versionClaims: string[], versionRoutingSuspected: boolean,
 *   formatOnly: boolean, findings: string[] }}
 */
export function analyzeTokenVersionClaims(header = {}, payload = {}) {
  const h = header && typeof header === 'object' ? header : {};
  const p = payload && typeof payload === 'object' ? payload : {};

  const claims = [];
  const versionClaims = [];

  for (const [name, value] of Object.entries(p)) {
    const isVersionClaim = VERSION_CLAIM_NAMES.has(normalizeClaimName(name));
    const entry = { name, valueType: valueTypeOf(value), isVersionClaim };
    if (isVersionClaim) {
      versionClaims.push(name);
      if (typeof value === 'string' || typeof value === 'number') {
        entry.versionValue = String(value).slice(0, 64);
      }
    }
    claims.push(entry);
  }

  // Version hints smuggled in kid / aud (name + type inspected, values truncated).
  const kidHint = typeof h.kid === 'string' && VERSION_VALUE_HINT_RE.test(h.kid);
  const audHint = typeof p.aud === 'string' && VERSION_VALUE_HINT_RE.test(p.aud);

  const versionRoutingSuspected = versionClaims.length > 0 || kidHint || audHint;

  const findings = [];
  if (claims.length === 0) {
    findings.push('No payload claims supplied — version routing is unknown.');
  }
  if (versionClaims.length > 0) {
    findings.push(`Version-routing claim(s) present: ${versionClaims.join(', ')} — token version may select the backend.`);
  }
  if (kidHint) findings.push("Key id ('kid') embeds a version hint — key rotation may be version-coupled.");
  if (audHint) findings.push("Audience ('aud') embeds a version hint — versioned audiences may route differently.");
  if (!versionRoutingSuspected && claims.length > 0) {
    findings.push('No version-routing claims detected in the token format.');
  }
  findings.push('Format analysis only — non-version claim values were never read or stored.');

  return { claims, versionClaims, versionRoutingSuspected, formatOnly: true, findings };
}

// ---------------------------------------------------------------- 1294 ----

const CHANNELZ_PROBE_BLUEPRINTS = [
  {
    id: 'channelz-top-channels',
    service: 'grpc.channelz.v1.Channelz',
    method: 'GetTopChannels',
    purpose: 'Enumerate client channels when reflection is disabled; reveals backend topology.',
  },
  {
    id: 'channelz-servers',
    service: 'grpc.channelz.v1.Channelz',
    method: 'GetServers',
    purpose: 'List servers known to the channelz service; maps the serving surface.',
  },
  {
    id: 'channelz-server-sockets',
    service: 'grpc.channelz.v1.Channelz',
    method: 'GetServerSockets',
    purpose: 'Inspect listening sockets; confirms which services are actually bound.',
  },
  {
    id: 'health-check',
    service: 'grpc.health.v1.Health',
    method: 'Check',
    purpose: 'Standard health oracle; useful availability baseline before deeper probes.',
  },
  {
    id: 'reflection-alt-v1',
    service: 'grpc.reflection.v1.ServerReflection',
    method: 'ServerReflectionInfo',
    purpose: 'Reflection alternative when only the v1alpha endpoint was disabled.',
  },
];

/**
 * Plan channelz / admin-service probes for a gRPC target (DESCRIPTORS ONLY).
 *
 * When server reflection is off, debug services like channelz sometimes remain
 * enabled. This function returns a probe plan — service, method, target and
 * purpose for each — and performs NO live calls itself. The agent's prober
 * executes the plan only against authorized targets.
 *
 * @param {object} [target]
 * @param {string} target.host — gRPC server hostname.
 * @param {number} [target.port=443]
 * @param {boolean} [target.tls=true]
 * @param {boolean} [target.reflectionEnabled=false]
 * @returns {{ target: string|null, probeCount: number,
 *   probes: Array<{ id: string, service: string, method: string, target: string,
 *   transport: string, executes: boolean, purpose: string, defensiveNote: string }>,
 *   findings: string[] }}
 */
export function planChannelzProbes({ host = '', port = 443, tls = true, reflectionEnabled = false } = {}) {
  const findings = [];
  const cleanHost = String(host || '').trim();
  if (!cleanHost) {
    findings.push('No target host supplied — cannot build a probe plan.');
    return { target: null, probeCount: 0, probes: [], findings };
  }

  const target = `${cleanHost}:${Number(port) || 443}`;
  const transport = tls ? 'h2/tls' : 'h2c';

  const probes = CHANNELZ_PROBE_BLUEPRINTS.map((b) => ({
    ...b,
    target,
    transport,
    executes: false,
    defensiveNote: 'Descriptor only — no network call made. Execute solely against authorized targets.',
  }));

  if (reflectionEnabled) {
    findings.push('Reflection is enabled — prefer the standard reflection service; channelz is a secondary surface.');
  } else {
    findings.push('Reflection is disabled — channelz and admin/debug services are the fallback introspection surface.');
  }
  findings.push(`${probes.length} probe descriptors planned for ${target} (${transport}); none executed.`);

  return { target, probeCount: probes.length, probes, findings };
}

// ---------------------------------------------------------------- 1295 ----

/**
 * Extract load-balancing, retry, hedging and timeout policy from a gRPC
 * service config (as served via reflection alternatives or documentation).
 *
 * Configs reveal retry storms, LB strategy and timeouts — all passive
 * document analysis, no traffic generated.
 *
 * @param {string} configText — JSON service-config text.
 * @returns {{ parsed: boolean, parseError: string|null, loadBalancing: string[],
 *   retryPolicies: Array, hedgingPolicies: Array, timeouts: Array, findings: string[] }}
 */
export function analyzeServiceConfig(configText = '') {
  const empty = {
    parsed: false, parseError: null, loadBalancing: [], retryPolicies: [],
    hedgingPolicies: [], timeouts: [], findings: [],
  };
  if (typeof configText !== 'string' || configText.trim().length === 0) {
    empty.parseError = 'empty config text';
    empty.findings.push('No service-config text supplied.');
    return empty;
  }

  let parsed;
  try {
    parsed = JSON.parse(configText);
  } catch (err) {
    empty.parseError = err instanceof Error ? err.message : String(err);
    empty.findings.push(`Service config is not valid JSON: ${empty.parseError}`);
    return empty;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    empty.parseError = 'top-level JSON value is not an object';
    empty.findings.push('Service config parsed but is not an object — no policy extracted.');
    return empty;
  }

  const loadBalancing = [];
  const lbConfig = parsed.loadBalancingConfig;
  if (Array.isArray(lbConfig)) {
    for (const entry of lbConfig) {
      if (entry && typeof entry === 'object') loadBalancing.push(...Object.keys(entry));
    }
  }

  const retryPolicies = [];
  const hedgingPolicies = [];
  const timeouts = [];
  const methodConfigs = Array.isArray(parsed.methodConfig) ? parsed.methodConfig : [];
  for (const mc of methodConfigs) {
    if (!mc || typeof mc !== 'object') continue;
    const names = Array.isArray(mc.name)
      ? mc.name.map((n) => `${(n && n.service) || '*'}/${(n && n.method) || '*'}`)
      : ['*/*'];
    if (mc.retryPolicy && typeof mc.retryPolicy === 'object') {
      retryPolicies.push({
        methods: names,
        maxAttempts: Number(mc.retryPolicy.maxAttempts) || null,
        initialBackoff: mc.retryPolicy.initialBackoff || null,
        backoffMultiplier: Number(mc.retryPolicy.backoffMultiplier) || null,
        retryableStatusCodes: Array.isArray(mc.retryPolicy.retryableStatusCodes) ? mc.retryPolicy.retryableStatusCodes : [],
      });
    }
    if (mc.hedgingPolicy && typeof mc.hedgingPolicy === 'object') {
      hedgingPolicies.push({
        methods: names,
        maxAttempts: Number(mc.hedgingPolicy.maxAttempts) || null,
        hedgingDelay: mc.hedgingPolicy.hedgingDelay || null,
        nonFatalStatusCodes: Array.isArray(mc.hedgingPolicy.nonFatalStatusCodes) ? mc.hedgingPolicy.nonFatalStatusCodes : [],
      });
    }
    if (typeof mc.timeout === 'string') {
      timeouts.push({ methods: names, timeout: mc.timeout });
    }
  }

  const findings = [];
  if (loadBalancing.length > 0) {
    findings.push(`Load-balancing policy: ${loadBalancing.join(', ')}.`);
    if (loadBalancing.includes('pick_first')) findings.push('pick_first LB — all traffic pins to one backend; single-instance failure mode.');
    if (loadBalancing.includes('round_robin')) findings.push('round_robin LB — requests spread across backends; instance enumeration via response variance is possible.');
    if (loadBalancing.includes('ring_hash')) findings.push('ring_hash LB — request affinity by hash; stickiness is by design.');
  } else {
    findings.push('No loadBalancingConfig found — default pick_first behavior assumed.');
  }
  for (const rp of retryPolicies) {
    findings.push(`Retry policy on ${rp.methods.join(', ')}: up to ${rp.maxAttempts ?? '?'} attempts, backoff ${rp.initialBackoff ?? '?'} x${rp.backoffMultiplier ?? '?'} — aggressive retries amplify load on backends.`);
  }
  for (const hp of hedgingPolicies) {
    findings.push(`Hedging policy on ${hp.methods.join(', ')}: up to ${hp.maxAttempts ?? '?'} parallel attempts — hedged fan-out multiplies backend load.`);
  }
  for (const t of timeouts) {
    findings.push(`Timeout on ${t.methods.join(', ')}: ${t.timeout}.`);
  }
  if (findings.length === 0) findings.push('Config parsed but carries no LB/retry/hedging/timeout policy.');

  return { parsed: true, parseError: null, loadBalancing, retryPolicies, hedgingPolicies, timeouts, findings };
}

// ---------------------------------------------------------------- 1296 ----

/**
 * Infer load-balancer behavior from observed response samples.
 *
 * Passive analysis of already-collected samples (backend ids from Server
 * headers, instance ids, timings). Infers backend count, stickiness and
 * rotation — the kind of fingerprinting an authorized agent does to map the
 * serving fleet before deeper (authorized) testing.
 *
 * @param {Array<{ backendId?: string, serverHeader?: string, durationMs?: number }>} [samples]
 *   — samples in request order.
 * @returns {{ sampleCount: number, backendCount: number, backends: string[],
 *   stickinessRatio: number, sticky: boolean, rotationSuspected: boolean,
 *   timing: { min: number, max: number, avg: number }|null, findings: string[] }}
 */
export function inferLoadBalancerBehavior(samples = []) {
  const list = Array.isArray(samples) ? samples : [];
  const ids = list.map((s) => String((s && (s.backendId ?? s.serverHeader)) ?? 'unknown'));
  const backends = [...new Set(ids)];

  let sameAsPrevious = 0;
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] === ids[i - 1]) sameAsPrevious++;
  }
  const stickinessRatio = ids.length > 1 ? sameAsPrevious / (ids.length - 1) : 0;
  const sticky = ids.length > 1 && stickinessRatio >= 0.8;
  const rotationSuspected = backends.length > 1 && stickinessRatio < 0.3;

  const durations = list
    .map((s) => Number(s && s.durationMs))
    .filter((n) => Number.isFinite(n));
  const timing = durations.length > 0
    ? {
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) / 100,
    }
    : null;

  const findings = [];
  if (list.length === 0) {
    findings.push('No samples supplied — balancer behavior is unknown.');
  } else {
    findings.push(`Observed ${backends.length} distinct backend(s) across ${list.length} samples.`);
    if (sticky) findings.push(`Sticky routing detected (stickiness ratio ${(stickinessRatio * 100).toFixed(0)}%) — sessions pin to one backend; session affinity is in play.`);
    else if (backends.length > 1) findings.push(`Non-sticky routing (stickiness ratio ${(stickinessRatio * 100).toFixed(0)}%) — requests spread across the fleet.`);
    if (rotationSuspected) findings.push('Rotation suspected — backends cycle with little repetition, consistent with round-robin.');
    if (timing && timing.max - timing.min > timing.avg) {
      findings.push(`Wide timing spread (${timing.min}–${timing.max} ms) — backends respond unevenly; slow instances may be distinguishable.`);
    }
  }

  return {
    sampleCount: list.length,
    backendCount: backends.length,
    backends,
    stickinessRatio: Math.round(stickinessRatio * 1000) / 1000,
    sticky,
    rotationSuspected,
    timing,
    findings,
  };
}

// ---------------------------------------------------------------- 1297 ----

const HOOK_PATH_RE = /webhook|rest[-_ ]?hook|\bhook\b|subscription|callback|event[-_ ]?(subscri|regist|notif|push|hook)/i;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Discover REST-hook subscription endpoints in an API specification.
 *
 * Hook subscriptions let a caller register callbacks that receive event data —
 * mapping WHERE subscriptions can be created is the detection side. This
 * function only reads the spec and flags endpoints; it never registers a
 * subscription or exfiltrates anything.
 *
 * @param {object|string[]} [spec] — OpenAPI-style `{ paths: { '/p': { post: {} } } }`
 *   or a plain array of path strings / `{ path, methods }` entries.
 * @returns {{ endpoints: Array<{ path: string, methods: string[], matchedPattern: string,
 *   confidence: 'high'|'medium' }>, endpointCount: number, findings: string[] }}
 */
export function discoverRestHooks(spec = {}) {
  let entries = [];
  if (Array.isArray(spec)) {
    entries = spec.map((p) => {
      if (typeof p === 'string') return { path: p, methods: [] };
      if (p && typeof p === 'object') {
        return {
          path: String(p.path || ''),
          methods: (Array.isArray(p.methods) ? p.methods : []).map((m) => String(m).toUpperCase()),
        };
      }
      return { path: '', methods: [] };
    });
  } else if (spec && typeof spec === 'object') {
    const paths = spec.paths && typeof spec.paths === 'object' ? spec.paths : {};
    entries = Object.entries(paths).map(([path, ops]) => ({
      path: String(path),
      methods: ops && typeof ops === 'object' ? Object.keys(ops).map((m) => String(m).toUpperCase()) : [],
    }));
  }

  const endpoints = [];
  for (const { path, methods } of entries) {
    if (!path) continue;
    const match = HOOK_PATH_RE.exec(path);
    if (!match) continue;
    const hasMutation = methods.some((m) => MUTATING_METHODS.has(m));
    endpoints.push({
      path,
      methods,
      matchedPattern: match[0],
      confidence: hasMutation ? 'high' : 'medium',
    });
  }

  const findings = [];
  if (entries.length === 0) {
    findings.push('No API paths supplied — hook surface is unknown.');
  } else if (endpoints.length === 0) {
    findings.push(`${entries.length} path(s) scanned — no REST-hook subscription endpoints detected.`);
  } else {
    findings.push(
      `${endpoints.length} hook-subscription endpoint(s) detected: ${endpoints.map((e) => e.path).join(', ')}.`
    );
    const high = endpoints.filter((e) => e.confidence === 'high');
    if (high.length > 0) {
      findings.push(`${high.length} endpoint(s) accept subscription mutations — review authorization on subscription create/delete (detection only; no subscription was registered).`);
    }
  }

  return { endpoints, endpointCount: endpoints.length, findings };
}

// ---------------------------------------------------------------- 1298 ----

/** Ordered sensitivity tiers — first matching tier wins. */
const TOPIC_TIERS = [
  {
    tier: 'critical',
    keywords: ['user.deleted', 'account.deleted', 'password', 'credential', 'ssn', 'social.security', 'biometric', 'private.key', 'secret', 'api.key'],
  },
  {
    tier: 'high',
    keywords: ['payment', 'card', 'bank', 'payout', 'refund', 'invoice', 'auth', 'login', 'token', 'mfa', '2fa', 'otp', 'session'],
  },
  {
    tier: 'medium',
    keywords: ['user.created', 'user.updated', 'order', 'subscription', 'profile', 'email', 'notification', 'consent'],
  },
  {
    tier: 'low',
    keywords: ['ping', 'heartbeat', 'health', 'metric', 'log', 'audit'],
  },
];

/**
 * Classify subscribable event topics into sensitivity tiers.
 *
 * Topic lists (e.g. from hook documentation) reveal event types like
 * `user.deleted`; tiering them tells the agent which subscriptions carry the
 * most sensitive data so testing effort is prioritized. Name analysis only.
 *
 * @param {Array<string|{ name: string }>} [topics]
 * @returns {{ classified: Array<{ topic: string, tier: 'critical'|'high'|'medium'|'low',
 *   matchedKeywords: string[] }>, tierCounts: Record<string, number>,
 *   highestTier: string|null, findings: string[] }}
 */
export function classifyTopics(topics = []) {
  const list = (Array.isArray(topics) ? topics : [])
    .map((t) => (typeof t === 'string' ? t : (t && typeof t.name === 'string' ? t.name : '')))
    .filter((t) => t.length > 0);

  const classified = list.map((topic) => {
    const lower = topic.toLowerCase();
    for (const { tier, keywords } of TOPIC_TIERS) {
      const matchedKeywords = keywords.filter((k) => lower.includes(k));
      if (matchedKeywords.length > 0) return { topic, tier, matchedKeywords };
    }
    return { topic, tier: 'low', matchedKeywords: [] };
  });

  const tierCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const c of classified) tierCounts[c.tier]++;
  const highestTier = ['critical', 'high', 'medium', 'low'].find((t) => tierCounts[t] > 0) || null;

  const findings = [];
  if (classified.length === 0) {
    findings.push('No topics supplied — nothing classified.');
  } else {
    findings.push(
      `${classified.length} topic(s) classified — critical: ${tierCounts.critical}, high: ${tierCounts.high}, medium: ${tierCounts.medium}, low: ${tierCounts.low}.`
    );
    const critical = classified.filter((c) => c.tier === 'critical');
    if (critical.length > 0) {
      findings.push(`Critical topics (highest data sensitivity): ${critical.map((c) => c.topic).join(', ')}.`);
    }
  }

  return { classified, tierCounts, highestTier, findings };
}

// ---------------------------------------------------------------- 1299 ----

/** PII keyword lists by category — matched against normalized field names. */
const PII_CATEGORIES = {
  direct: [
    'email', 'e-mail', 'phone', 'mobile', 'tel', 'firstname', 'lastname',
    'fullname', 'full_name', 'name', 'address', 'street', 'city', 'zip',
    'postal', 'dob', 'birth', 'ssn', 'socialsecurity', 'passport', 'license',
    'nationalid', 'ipaddress', 'ip_address', 'deviceid', 'username',
  ],
  financial: [
    'cardnumber', 'card_number', 'ccnum', 'cvv', 'cvc', 'expiry',
    'iban', 'bankaccount', 'accountnumber', 'routing', 'swift',
  ],
  credential: [
    'password', 'passwd', 'pwd', 'token', 'secret', 'apikey', 'api_key', 'privatekey',
  ],
};

function normalizeFieldName(name) {
  return String(name).toLowerCase().replace(/[_\-. ]+/g, '');
}

/**
 * Correlate event types with the PII fields their schemas carry.
 *
 * Event schemas show exactly which PII each event carries — mapping that from
 * the documented schema is the defensive use (data-flow inventory for an
 * authorized assessment). Field NAMES are analyzed; field VALUES are never
 * touched.
 *
 * @param {Record<string, Record<string, string>|string[]>} [eventSchemas] —
 *   event name -> field map (`{ field: type }`) or field-name array.
 * @returns {{ mapping: Record<string, Array<{ field: string, type: string,
 *   category: 'direct'|'financial'|'credential', matchedKeyword: string }>>,
 *   eventCount: number, totalFields: number, totalPiiFields: number,
 *   piiDensity: number, eventsWithPii: string[], findings: string[] }}
 */
export function mapEventPii(eventSchemas = {}) {
  const schemas = eventSchemas && typeof eventSchemas === 'object' ? eventSchemas : {};
  const mapping = {};
  let totalFields = 0;
  let totalPiiFields = 0;

  for (const [event, schema] of Object.entries(schemas)) {
    const fields = [];
    if (Array.isArray(schema)) {
      for (const name of schema) fields.push([String(name), 'unknown']);
    } else if (schema && typeof schema === 'object') {
      for (const [name, type] of Object.entries(schema)) fields.push([String(name), String(type)]);
    }
    totalFields += fields.length;

    const piiFields = [];
    for (const [field, type] of fields) {
      const normalized = normalizeFieldName(field);
      let hit = null;
      for (const [category, keywords] of Object.entries(PII_CATEGORIES)) {
        const keyword = keywords.find((k) => normalized.includes(k));
        if (keyword) {
          hit = { field, type, category, matchedKeyword: keyword };
          break;
        }
      }
      if (hit) piiFields.push(hit);
    }
    totalPiiFields += piiFields.length;
    mapping[event] = piiFields;
  }

  const eventsWithPii = Object.keys(mapping).filter((e) => mapping[e].length > 0);
  const piiDensity = totalFields > 0 ? Math.round((totalPiiFields / totalFields) * 1000) / 1000 : 0;

  const findings = [];
  if (Object.keys(schemas).length === 0) {
    findings.push('No event schemas supplied — nothing mapped.');
  } else {
    findings.push(
      `${eventsWithPii.length}/${Object.keys(schemas).length} event type(s) carry PII (${totalPiiFields}/${totalFields} fields, density ${piiDensity}).`
    );
    for (const event of eventsWithPii) {
      const cats = [...new Set(mapping[event].map((f) => f.category))];
      findings.push(`Event '${event}' carries ${mapping[event].length} PII field(s) [${cats.join(', ')}]: ${mapping[event].map((f) => f.field).join(', ')}.`);
    }
  }

  return {
    mapping,
    eventCount: Object.keys(schemas).length,
    totalFields,
    totalPiiFields,
    piiDensity,
    eventsWithPii,
    findings,
  };
}

// ---------------------------------------------------------------- 1300 ----

const LEAK_PATTERNS = [
  { type: 'aws_access_key', regex: /\b(AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g, valueGroup: 0 },
  {
    type: 'aws_secret_key',
    regex: /(aws[_-]?secret(?:[_-]?access[_-]?key)?|secret[_-]?access[_-]?key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{16,})["']?/gi,
    valueGroup: 2,
  },
  { type: 'aws_arn', regex: /\barn:aws:[a-z0-9-]*:[a-z0-9-]*:[0-9]*:[^\s"'<>]+/gi, valueGroup: 0 },
  { type: 'private_key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, valueGroup: 0 },
  {
    type: 'api_key_assignment',
    regex: /\b(api[_-]?key|client[_-]?secret|secret[_-]?key)\b\s*[:=]\s*["']?([\w\-.+/=]{8,})["']?/gi,
    valueGroup: 2,
  },
  { type: 'bearer_token', regex: /\bBearer\s+([A-Za-z0-9\-._~+/=]{16,})/g, valueGroup: 1 },
];

/**
 * Redact a detected secret for safe reporting (prefix/suffix only, length noted).
 * @param {string} value
 * @returns {string}
 */
function redactSecret(value) {
  const v = String(value);
  if (v.length <= 8) return '•••••••• (value withheld)';
  return `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} chars withheld)`;
}

/**
 * Scan gateway error text for leaked backend keys / ARNs — REDACTED output.
 *
 * Gateway error pages sometimes reflect backend keys and ARNs. This scanner
 * detects the PATTERNS and reports type, line, and a redacted preview only —
 * full values are never stored, echoed, or exfiltrated. Detection only.
 *
 * @param {string} [errorText] — error page / log text to scan.
 * @returns {{ leaks: Array<{ type: string, line: number, preview: string }>,
 *   leakCount: number, scannedLines: number, findings: string[],
 *   defensiveNote: string }}
 */
export function scanErrorForKeyLeak(errorText = '') {
  const text = typeof errorText === 'string' ? errorText : '';
  const lines = text.split('\n');
  const leaks = [];

  lines.forEach((line, index) => {
    for (const { type, regex, valueGroup } of LEAK_PATTERNS) {
      regex.lastIndex = 0; // shared global regex — reset before each line
      let m;
      while ((m = regex.exec(line)) !== null) {
        const value = m[valueGroup] || m[0];
        leaks.push({ type, line: index + 1, preview: redactSecret(value) });
        if (m[0].length === 0) regex.lastIndex++;
      }
    }
  });

  const findings = [];
  if (leaks.length === 0) {
    findings.push(`Scanned ${lines.length} line(s) — no key/ARN leak patterns detected.`);
  } else {
    const byType = {};
    for (const l of leaks) byType[l.type] = (byType[l.type] || 0) + 1;
    findings.push(
      `LEAK DETECTED: ${leaks.length} key/ARN pattern(s) in gateway error text — ${Object.entries(byType).map(([t, n]) => `${t} x${n}`).join(', ')}.`
    );
    findings.push('All matches are redacted in this report — full secret values were never stored or transmitted.');
  }

  return {
    leaks,
    leakCount: leaks.length,
    scannedLines: lines.length,
    findings,
    defensiveNote: 'Detection only. Matches are redacted; no secret material is persisted or exfiltrated by this scanner.',
  };
}
