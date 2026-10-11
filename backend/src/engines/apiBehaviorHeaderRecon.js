/**
 * apiBehaviorHeaderRecon.js — API behavioral & header surface reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Each function
 * inspects ALREADY-COLLECTED observations (response headers, latency samples,
 * feature responses, revocation probe results) from authorized targets and
 * derives a security verdict about header passthrough leakage, latency/cost
 * surfaces, concurrency and keep-alive behavior, client-hint/geo/IP-header
 * trust, and key-revocation propagation.
 *
 * They never send traffic, never run abusive load, and never include exploit
 * payloads. Abusive-sounding ideas (DoS ranking, concurrency, keep-alive) are
 * implemented strictly as cost-surface analysis and probe PLANNING over
 * collected data — the module contains no load-generation code of any kind.
 *
 * Covers idea-bank ideas 1301-1310:
 *  1301 detectPassthroughHeaders       — identify backend headers surviving the gateway
 *  1302 computeLatencyProfile          — measure p50/p99 latency per endpoint
 *  1303 rankCostSurface                — rank endpoints by abuse-relevant response cost
 *  1304 inferConcurrencyPolicy         — infer concurrency limits from collected observations
 *  1305 analyzeKeepAlive               — summarize connection keep-alive behavior
 *  1306 parseClientHintSignals         — detect device-fingerprinting via client hints
 *  1307 analyzeGeoBehavior             — map region-gating driven by geo headers
 *  1308 assessClientIpTrust            — assess trust of True-Client-IP style headers
 *  1309 assessForwardedIpFeatures      — measure feature sensitivity to X-Forwarded-For
 *  1310 measureKeyRevocationTimeline   — measure revoked-key propagation delay
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1301_COVERAGE = [1301, 1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309, 1310];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1301: 'detectPassthroughHeaders',
    1302: 'computeLatencyProfile',
    1303: 'rankCostSurface',
    1304: 'inferConcurrencyPolicy',
    1305: 'analyzeKeepAlive',
    1306: 'parseClientHintSignals',
    1307: 'analyzeGeoBehavior',
    1308: 'assessClientIpTrust',
    1309: 'assessForwardedIpFeatures',
    1310: 'measureKeyRevocationTimeline',
  };
}

// ------------------------------------------------------------- utilities ----

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Normalize a header-name -> value map to lowercase keys. */
function normHeaders(headers) {
  const out = {};
  if (!isObj(headers)) return out;
  for (const [k, v] of Object.entries(headers)) {
    if (typeof k !== 'string') continue;
    out[k.trim().toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

const INTERNAL_IP_RE = /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/;
const VERSION_RE = /\b\d+\.\d+(\.\d+)?\b/;
const HOSTNAME_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i;

// ---------------------------------------------------------------- 1301 ----

const PASSTHROUGH_SUSPICIOUS = [
  'x-powered-by',
  'server',
  'x-backend-server',
  'x-backend',
  'x-internal-ip',
  'x-server-ip',
  'x-real-ip',
  'x-machine-name',
  'x-instance-id',
  'x-hostname',
  'x-app-version',
  'x-runtime',
  'x-aspnet-version',
  'x-aspnetmvc-version',
  'x-generator',
  'x-via',
  'x-cache-server',
  'x-origin-ip',
  'x-upstream-server',
];

/**
 * Detect backend headers surviving a gateway from a side-by-side comparison of
 * the gateway's public response headers and the origin's direct response
 * headers (collected via the agent's normal authorized probing of both).
 *
 * A header "passes through" when it appears on the origin response but is
 * absent (or left byte-identical) on the gateway response, meaning the gateway
 * does not strip or rewrite it.
 *
 * @param {{gatewayHeaders?: object, originHeaders?: object}} input
 * @returns {{passthrough: Array<{name: string, value: string, leaked: boolean, flags: string[]}>,
 *   leakedCount: number, internalIpCount: number, versionCount: number}}
 */
export function detectPassthroughHeaders({ gatewayHeaders = {}, originHeaders = {} } = {}) {
  const gw = normHeaders(gatewayHeaders);
  const origin = normHeaders(originHeaders);
  const passthrough = [];

  for (const [name, value] of Object.entries(origin)) {
    if (name in gw && gw[name] !== value) continue; // gateway rewrote it: not passthrough
    const flags = [];
    if (PASSTHROUGH_SUSPICIOUS.includes(name)) flags.push('suspicious-header-name');
    if (INTERNAL_IP_RE.test(value)) flags.push('internal-ip-leak');
    if (['x-powered-by', 'server', 'x-runtime', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator'].includes(name) && VERSION_RE.test(value)) {
      flags.push('version-disclosure');
    }
    if (flags.length) passthrough.push({ name, value, leaked: true, flags });
    else passthrough.push({ name, value, leaked: false, flags });
  }

  const leaked = passthrough.filter((p) => p.leaked);
  return {
    passthrough,
    leakedCount: leaked.length,
    internalIpCount: leaked.filter((p) => p.flags.includes('internal-ip-leak')).length,
    versionCount: leaked.filter((p) => p.flags.includes('version-disclosure')).length,
  };
}

// ---------------------------------------------------------------- 1302 ----

/**
 * Nearest-rank percentile over a sorted ascending numeric array.
 * @param {number[]} sorted ascending values
 * @param {number} pct percentile 0-100
 */
function percentile(sorted, pct) {
  if (!sorted.length) return null;
  const rank = Math.ceil((pct / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank - 1, 0), sorted.length - 1)];
}

/**
 * Compute per-endpoint latency profiles (p50/p99) from latency samples already
 * collected by the agent during normal authorized interaction.
 *
 * @param {Array<{endpoint: string, latencyMs: number}>} samples
 * @returns {Record<string, {endpoint: string, count: number, p50: number|null, p90: number|null,
 *   p99: number|null, mean: number|null, min: number|null, max: number|null}>}
 */
export function computeLatencyProfile(samples = []) {
  const byEndpoint = {};
  for (const s of samples) {
    if (!isObj(s) || typeof s.endpoint !== 'string') continue;
    const ms = Number(s.latencyMs);
    if (!Number.isFinite(ms) || ms < 0) continue;
    (byEndpoint[s.endpoint] ||= []).push(ms);
  }
  const profiles = {};
  for (const [endpoint, values] of Object.entries(byEndpoint)) {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    profiles[endpoint] = {
      endpoint,
      count: sorted.length,
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      p99: percentile(sorted, 99),
      mean: Math.round(mean * 100) / 100,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }
  return profiles;
}

// ---------------------------------------------------------------- 1303 ----

const COST_TIERS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Rank endpoints by abuse-relevant response cost from precomputed latency
 * profiles. This is pure analysis of already-collected data: it identifies
 * which authenticated endpoints would be the most attractive DoS targets so
 * the agent can prioritize defensive rate-limit review — it generates no load.
 *
 * @param {Array<{endpoint: string, p50?: number|null, p90?: number|null, p99?: number|null,
 *   mean?: number|null, count?: number, authenticated?: boolean}>} profiles
 * @returns {Array<{endpoint: string, costScore: number, p99: number|null, authenticated: boolean, tier: string}>}
 *   sorted by costScore descending
 */
export function rankCostSurface(profiles = []) {
  const scored = [];
  for (const p of profiles) {
    if (!isObj(p) || typeof p.endpoint !== 'string') continue;
    const p99 = Number(p.p99);
    const mean = Number(p.mean);
    const base = Number.isFinite(p99) ? p99 : (Number.isFinite(mean) ? mean * 2 : 0);
    const authBoost = p.authenticated ? 1.5 : 1;
    const costScore = Math.round(base * authBoost * 100) / 100;
    let tier = 'LOW';
    if (costScore >= 10000) tier = 'CRITICAL';
    else if (costScore >= 2000) tier = 'HIGH';
    else if (costScore >= 300) tier = 'MEDIUM';
    scored.push({
      endpoint: p.endpoint,
      costScore,
      p99: Number.isFinite(p99) ? p99 : null,
      authenticated: Boolean(p.authenticated),
      tier,
    });
  }
  return scored.sort((a, b) => b.costScore - a.costScore);
}

// ---------------------------------------------------------------- 1304 ----

/**
 * Infer the concurrency policy for an endpoint from collected parallelism
 * observations (normal, sequential probing at low concurrency). The module
 * never opens parallel connections itself; it reasons about data the agent
 * already recorded.
 *
 * @param {Array<{endpoint: string, parallelism: number, accepted: number, throttled: number,
 *   retried: number, latencyMs?: number}>} observations
 * @returns {Record<string, {endpoint: string, estimatedLimit: number|null, policy: string, evidence: string[]}>}
 */
export function inferConcurrencyPolicy(observations = []) {
  const byEndpoint = {};
  for (const o of observations) {
    if (!isObj(o) || typeof o.endpoint !== 'string') continue;
    (byEndpoint[o.endpoint] ||= []).push(o);
  }
  const result = {};
  for (const [endpoint, obs] of Object.entries(byEndpoint)) {
    const evidence = [];
    let estimatedLimit = null;
    const throttledLevels = obs
      .filter((o) => Number(o.throttled) > 0)
      .map((o) => Number(o.parallelism))
      .filter((n) => Number.isFinite(n));
    const cleanLevels = obs
      .filter((o) => Number(o.throttled) === 0)
      .map((o) => Number(o.parallelism))
      .filter((n) => Number.isFinite(n));
    if (throttledLevels.length) {
      estimatedLimit = Math.min(...throttledLevels) - 1;
      if (estimatedLimit < 0) estimatedLimit = 0;
      evidence.push(`throttling observed at parallelism ${Math.min(...throttledLevels)}`);
      evidence.push(`clean at parallelism up to ${cleanLevels.length ? Math.max(...cleanLevels) : 'none observed'}`);
    }
    let policy;
    if (estimatedLimit === null) {
      policy = cleanLevels.length ? 'no-throttle-observed' : 'insufficient-data';
      if (cleanLevels.length) evidence.push(`no throttling at parallelism up to ${Math.max(...cleanLevels)}`);
    } else if (estimatedLimit === 0) {
      policy = 'strict-throttle';
    } else {
      policy = 'throttle-at-limit';
    }
    result[endpoint] = { endpoint, estimatedLimit, policy, evidence };
  }
  return result;
}

// ---------------------------------------------------------------- 1305 ----

/**
 * Summarize connection keep-alive behavior from observed response headers.
 * Analyzes how the server manages persistent connections — relevant to
 * planning request-smuggling-adjacent testing scope on authorized targets.
 *
 * @param {Array<{endpoint: string, headers: object}>} observations
 * @returns {Record<string, {endpoint: string, keepAliveSupported: boolean, timeoutSec: number|null,
 *   maxRequests: number|null, connectionBehavior: string, notes: string[]}>}
 */
export function analyzeKeepAlive(observations = []) {
  const result = {};
  for (const o of observations) {
    if (!isObj(o) || typeof o.endpoint !== 'string') continue;
    const h = normHeaders(o.headers);
    const notes = [];
    const connection = h['connection'] || '';
    const keepAliveHeader = h['keep-alive'] || '';
    let timeoutSec = null;
    let maxRequests = null;
    const mTimeout = /timeout=(\d+)/i.exec(keepAliveHeader);
    const mMax = /max=(\d+)/i.exec(keepAliveHeader);
    if (mTimeout) timeoutSec = Number(mTimeout[1]);
    if (mMax) maxRequests = Number(mMax[1]);
    const closes = /close/i.test(connection);
    const keepAliveSupported = !closes && /keep-alive/i.test(connection + ' ' + keepAliveHeader);
    let connectionBehavior;
    if (closes) {
      connectionBehavior = 'close-per-request';
      notes.push('Server closes connections after each response');
    } else if (keepAliveSupported) {
      connectionBehavior = 'keep-alive';
      notes.push(`Persistent connections supported${timeoutSec !== null ? `, timeout=${timeoutSec}s` : ''}${maxRequests !== null ? `, max=${maxRequests}` : ''}`);
    } else {
      connectionBehavior = 'unspecified';
      notes.push('No explicit Connection/Keep-Alive signaling observed');
    }
    if (timeoutSec !== null && timeoutSec < 5) notes.push('Short keep-alive timeout: aggressive session teardown');
    if (maxRequests !== null && maxRequests <= 10) notes.push('Low max-requests budget per connection');
    result[o.endpoint] = {
      endpoint: o.endpoint,
      keepAliveSupported,
      timeoutSec,
      maxRequests,
      connectionBehavior,
      notes,
    };
  }
  return result;
}

// ---------------------------------------------------------------- 1306 ----

const CLIENT_HINT_REQUEST_HEADERS = [
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-ch-ua-platform-version',
  'sec-ch-ua-arch',
  'sec-ch-ua-bitness',
  'sec-ch-ua-model',
  'sec-ch-ua-full-version',
  'sec-ch-ua-full-version-list',
  'sec-ch-prefers-color-scheme',
  'sec-ch-prefers-reduced-motion',
  'sec-ch-viewport-width',
  'sec-ch-device-memory',
  'sec-ch-dpr',
  'sec-ch-width',
];
const CLIENT_HINT_RESPONSE_HEADERS = ['accept-ch', 'critical-ch', 'permissions-policy'];

/**
 * Detect client-hint processing that reveals device-fingerprinting logic on
 * the API surface. Inspects response headers the API already sent during
 * normal authorized interaction.
 *
 * @param {object} headers observed response headers
 * @returns {{deviceFingerprinting: boolean, signals: string[], riskLevel: string, details: string[]}}
 */
export function parseClientHintSignals(headers = {}) {
  const h = normHeaders(headers);
  const signals = [];
  const details = [];
  for (const name of CLIENT_HINT_RESPONSE_HEADERS) {
    if (name in h) {
      signals.push(name);
      details.push(`${name}: ${h[name]}`);
    }
  }
  const vary = h['vary'] || '';
  const varyHints = CLIENT_HINT_REQUEST_HEADERS.filter((n) => vary.toLowerCase().includes(n));
  for (const n of varyHints) {
    signals.push(`vary:${n}`);
    details.push(`Vary includes client hint ${n} — responses differ by device signal`);
  }
  const deviceFingerprinting = signals.length > 0;
  const highRisk = signals.includes('accept-ch') && /sec-ch-ua-full-version|sec-ch-ua-model|sec-ch-device-memory/i.test(h['accept-ch'] || '');
  const riskLevel = highRisk ? 'HIGH' : deviceFingerprinting ? 'MEDIUM' : 'LOW';
  if (deviceFingerprinting) details.push('Client-hint processing indicates server-side device fingerprinting logic');
  return { deviceFingerprinting, signals, riskLevel, details };
}

// ---------------------------------------------------------------- 1307 ----

const GEO_HEADERS = ['cf-ipcountry', 'cloudfront-viewer-country', 'x-country-code', 'x-geo-country', 'x-appengine-country'];

/**
 * Build a region-gating map from responses collected under different
 * spoofed geo headers (performed by the agent's probe planner, not here).
 * Maps which features gate on region.
 *
 * @param {Array<{geoHeaderValue: string, blocked?: boolean, region?: string, currency?: string,
 *   language?: string, features?: string[], status?: number}>} responses
 * @returns {{gated: boolean, regionMap: Record<string, {blocked: boolean, region: string|null,
 *   currency: string|null, language: string|null, features: string[], status: number|null}>,
 *   gatedFeatures: string[], notes: string[]}}
 */
export function analyzeGeoBehavior(responses = []) {
  const regionMap = {};
  const notes = [];
  const allFeatures = {};
  const featureRegions = {};
  for (const r of responses) {
    if (!isObj(r) || typeof r.geoHeaderValue !== 'string') continue;
    const key = r.geoHeaderValue.toUpperCase();
    const features = Array.isArray(r.features) ? r.features : [];
    regionMap[key] = {
      blocked: Boolean(r.blocked),
      region: r.region ?? null,
      currency: r.currency ?? null,
      language: r.language ?? null,
      features,
      status: r.status ?? null,
    };
    for (const f of features) {
      allFeatures[f] = (allFeatures[f] || 0) + 1;
      (featureRegions[f] ||= new Set()).add(key);
    }
  }
  const gatedFeatures = Object.keys(allFeatures).filter((f) => featureRegions[f].size < Object.keys(regionMap).length);
  const blockedRegions = Object.entries(regionMap).filter(([, v]) => v.blocked).map(([k]) => k);
  const gated = gatedFeatures.length > 0 || blockedRegions.length > 0;
  if (blockedRegions.length) notes.push(`Blocked for regions: ${blockedRegions.join(', ')}`);
  for (const f of gatedFeatures) notes.push(`Feature '${f}' varies by region`);
  return { gated, regionMap, gatedFeatures, notes };
}

// ---------------------------------------------------------------- 1308 ----

const CLIENT_IP_HEADERS = [
  'true-client-ip',
  'x-real-ip',
  'x-client-ip',
  'cf-connecting-ip',
  'fastly-client-ip',
  'x-forwarded-for',
  'x-cluster-client-ip',
];

/**
 * Assess whether the API trusts client-supplied IP headers, from observations
 * the agent collected while varying those headers during authorized probing.
 * A trusted spoofable header bypasses geo and rate controls.
 *
 * @param {Array<{headerName: string, spoofedValue: string, observedClientIp?: string,
 *   rateLimited?: boolean, geoCountry?: string, expectedCountry?: string}>} observations
 * @returns {{trustedHeaders: string[], bypassFlags: Array<{header: string, flag: string, detail: string}>,
 *   verdict: string}}
 */
export function assessClientIpTrust(observations = []) {
  const trustedHeaders = [];
  const bypassFlags = [];
  for (const o of observations) {
    if (!isObj(o) || typeof o.headerName !== 'string') continue;
    const name = o.headerName.trim().toLowerCase();
    if (!CLIENT_IP_HEADERS.includes(name)) continue;
    const honored = typeof o.observedClientIp === 'string' && o.observedClientIp === o.spoofedValue;
    if (honored) {
      if (!trustedHeaders.includes(name)) trustedHeaders.push(name);
      bypassFlags.push({ header: name, flag: 'ip-trusted', detail: `Server honored spoofed ${name}=${o.spoofedValue}` });
      if (o.rateLimited === false) {
        bypassFlags.push({ header: name, flag: 'rate-control-bypass', detail: 'Spoofed IP was not rate-limited' });
      }
      if (o.geoCountry && o.expectedCountry && o.geoCountry !== o.expectedCountry) {
        bypassFlags.push({ header: name, flag: 'geo-bypass', detail: `Geo resolved to ${o.geoCountry} instead of expected ${o.expectedCountry}` });
      }
    }
  }
  const verdict = trustedHeaders.length
    ? 'UNSAFE — server trusts client-supplied IP headers'
    : observations.length
      ? 'SAFE — client-supplied IP headers ignored'
      : 'UNKNOWN — no observations';
  return { trustedHeaders, bypassFlags, verdict };
}

// ---------------------------------------------------------------- 1309 ----

const FORWARDED_FEATURE_SIGNALS = ['country', 'language', 'currency', 'fraudScore', 'fraudVerdict', 'region', 'price'];

/**
 * Measure how sensitive API features are to X-Forwarded-For values, from
 * responses the agent already collected with varying forwarded IPs.
 * Features keyed on forwarded IP can be manipulated via spoofed values.
 *
 * @param {Array<{xff: string, country?: string, language?: string, currency?: string,
 *   fraudScore?: number, fraudVerdict?: string, region?: string, price?: number}>} responses
 * @returns {{sensitiveFeatures: string[], signalMap: Record<string, string[]>, notes: string[]}}
 */
export function assessForwardedIpFeatures(responses = []) {
  const signalMap = {};
  const notes = [];
  const seen = {};
  for (const r of responses) {
    if (!isObj(r) || typeof r.xff !== 'string') continue;
    for (const sig of FORWARDED_FEATURE_SIGNALS) {
      if (r[sig] === undefined || r[sig] === null) continue;
      (seen[sig] ||= new Set()).add(JSON.stringify(r[sig]));
      (signalMap[sig] ||= {})[r.xff] = r[sig];
    }
  }
  const sensitiveFeatures = Object.keys(seen).filter((sig) => seen[sig].size > 1);
  for (const f of sensitiveFeatures) notes.push(`Feature '${f}' varies with X-Forwarded-For — manipulable via spoofed IP`);
  if (sensitiveFeatures.includes('fraudScore') || sensitiveFeatures.includes('fraudVerdict')) {
    notes.push('Fraud signal keyed on forwarded IP: spoofing can manipulate fraud decisions');
  }
  return { sensitiveFeatures, signalMap, notes };
}

// ---------------------------------------------------------------- 1310 ----

/**
 * Measure API-key revocation propagation delay from revocation probe results
 * collected by the agent (probe, wait, re-probe with the same revoked key).
 * A propagation gap leaves revoked keys usable — a real security finding.
 *
 * @param {Array<{secondsAfterRevocation: number, accepted: boolean}>} probes
 * @returns {{propagationDelaySec: number|null, usableWindowSec: number|null,
 *   probesUsed: number, verdict: string, notes: string[]}}
 */
export function measureKeyRevocationTimeline(probes = []) {
  const valid = probes
    .filter((p) => isObj(p) && Number.isFinite(Number(p.secondsAfterRevocation)) && typeof p.accepted === 'boolean')
    .map((p) => ({ t: Number(p.secondsAfterRevocation), accepted: p.accepted }))
    .sort((a, b) => a.t - b.t);
  const notes = [];
  if (!valid.length) {
    return { propagationDelaySec: null, usableWindowSec: null, probesUsed: 0, verdict: 'UNKNOWN', notes: ['No revocation probe data'] };
  }
  const lastAccepted = [...valid].reverse().find((p) => p.accepted);
  const firstRejected = valid.find((p) => !p.accepted);
  let propagationDelaySec = null;
  let usableWindowSec = null;
  let verdict;
  if (lastAccepted && firstRejected) {
    usableWindowSec = lastAccepted.t;
    propagationDelaySec = firstRejected.t;
    notes.push(`Revoked key still accepted ${usableWindowSec}s after revocation`);
    notes.push(`Key rejected by ${propagationDelaySec}s after revocation`);
    verdict = propagationDelaySec <= 5 ? 'FAST' : 'STALE';
  } else if (lastAccepted && !firstRejected) {
    usableWindowSec = lastAccepted.t;
    notes.push(`Revoked key still accepted ${usableWindowSec}s after revocation — never observed rejected`);
    verdict = 'STALE';
  } else if (!lastAccepted && firstRejected) {
    propagationDelaySec = firstRejected.t;
    notes.push(`Revoked key rejected ${propagationDelaySec}s after revocation`);
    verdict = propagationDelaySec <= 5 ? 'FAST' : 'STALE';
  } else {
    verdict = 'UNKNOWN';
  }
  return { propagationDelaySec, usableWindowSec, probesUsed: valid.length, verdict, notes };
}
