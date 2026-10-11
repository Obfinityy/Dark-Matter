/**
 * apiCacheReplayRecon.js — API cache & replay surface reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Each function
 * inspects OBSERVED behavior (response headers, status codes, bodies, docs) of
 * authorized targets and derives a security verdict about idempotency-key
 * handling, cache-key behavior, conditional requests, and polymorphic type
 * handling — they never send exploit payloads, never replay other users' live
 * operations destructively, and never bypass real authorization controls.
 *
 * Covers idea-bank ideas 1241-1250:
 *  1241 discoverIdempotencySupport — detect whether an API honors Idempotency-Key headers
 *  1242 assessIdempotencyReplayBinding — assess whether replays bind the key to the original body
 *  1243 assessIdempotencyKeyScoping — assess whether keys are scoped per user/account
 *  1244 mapETagCaching — map ETag/If-None-Match caching behavior of endpoints
 *  1245 discoverCacheKeyParams — identify which query params influence the cache key
 *  1246 differentialCachedVsFresh — compare cached vs fresh responses for data leakage
 *  1247 testConditionalRequestHandling — analyze If-Modified-Since handling for 304 bypasses
 *  1248 testRangeRequestOnApi — analyze Range-request handling on API endpoints
 *  1249 mapOpenApiDiscriminators — parse OpenAPI discriminators/oneOf/anyOf for hidden subtypes
 *  1250 assessPolymorphicTypeConfusion — assess wrong-subtype routing from observed responses
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1241_COVERAGE = [1241, 1242, 1243, 1244, 1245, 1246, 1247, 1248, 1249, 1250];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1241: 'discoverIdempotencySupport',
    1242: 'assessIdempotencyReplayBinding',
    1243: 'assessIdempotencyKeyScoping',
    1244: 'mapETagCaching',
    1245: 'discoverCacheKeyParams',
    1246: 'differentialCachedVsFresh',
    1247: 'testConditionalRequestHandling',
    1248: 'testRangeRequestOnApi',
    1249: 'mapOpenApiDiscriminators',
    1250: 'assessPolymorphicTypeConfusion',
  };
}

// ---------------------------------------------------------------- 1241 ----

const IDEMPOTENCY_HEADER_NAMES = [
  'idempotency-key',
  'idempotence-key',
  'x-idempotency-key',
  'x-idempotence-key',
  'x-idempotent-key',
];

/**
 * Discover whether an API honors idempotency keys, from observed request/response pairs.
 *
 * Observations come from authorized, non-destructive probes against the target's
 * own documented behavior (e.g. sending the same safe key twice against a test
 * endpoint, or reading the API docs' stated behavior).
 *
 * @param {object} obs
 * @param {Array<{ sentKey: string, responseStatus: number, responseHeader?: object, responseBody?: string|object, duplicate?: boolean, processingDurationMs?: number }>} [obs.pairs]
 *   — paired observations: first submission of a key and a second submission of the same key.
 * @returns {{ supported: boolean, evidence: string[], findings: string[], confidence: 'high'|'medium'|'low' }}
 */
export function discoverIdempotencySupport({ pairs = [] } = {}) {
  const findings = [];
  const evidence = [];
  const list = Array.isArray(pairs) ? pairs : [];

  const firsts = list.filter((p) => !p.duplicate);
  const seconds = list.filter((p) => p.duplicate);

  if (list.length === 0) {
    findings.push('No idempotency probe observations supplied — support is unknown.');
    return { supported: false, evidence, findings, confidence: 'low' };
  }

  let supported = false;
  let confidence = 'low';

  // Signal 1: API documentation / response headers mention idempotency key names.
  for (const p of list) {
    const headers = p.responseHeader || {};
    const headerNames = Object.keys(headers).map((h) => String(h).toLowerCase());
    const matched = IDEMPOTENCY_HEADER_NAMES.filter((n) => headerNames.includes(n));
    if (matched.length > 0) {
      evidence.push(`Response echoes idempotency header (${matched.join(', ')}) on status ${p.responseStatus}.`);
      supported = true;
    }
  }

  // Signal 2: second submission of the same key short-circuits or dedupes.
  for (const dup of seconds) {
    const status = Number(dup.responseStatus);
    const dur = Number(dup.processingDurationMs);
    if ([200, 201, 202, 409].includes(status)) {
      evidence.push(`Duplicate key submission returned HTTP ${status} (not a fresh 2xx create).`);
      supported = true;
    }
    if (Number.isFinite(dur) && dur >= 0) {
      const firstDur = firsts.find((f) => f.sentKey === dup.sentKey);
      if (firstDur && Number.isFinite(Number(firstDur.processingDurationMs)) &&
          dur < Number(firstDur.processingDurationMs) * 0.5) {
        evidence.push(
          `Duplicate key processed in ${dur}ms vs ${firstDur.processingDurationMs}ms for the original — ` +
          'server short-circuited instead of re-executing.'
        );
        supported = true;
      }
    }
  }

  // Signal 3: body hash or key echo in the response.
  for (const p of list) {
    const body = typeof p.responseBody === 'string' ? p.responseBody : JSON.stringify(p.responseBody || '');
    if (/idempot/i.test(body)) {
      evidence.push(`Response body references idempotency on status ${p.responseStatus}.`);
      supported = true;
    }
  }

  if (supported) {
    confidence = evidence.length >= 2 ? 'high' : 'medium';
    findings.push(`API honors idempotency keys (confidence: ${confidence}). Replay safety analysis is meaningful here.`);
  } else {
    findings.push(
      'No evidence of idempotency-key support — retries of mutating requests may re-execute side effects (double charge, double create).'
    );
  }

  return { supported, evidence, findings, confidence };
}

// ---------------------------------------------------------------- 1242 ----

/**
 * Assess whether idempotency replays are bound to the ORIGINAL request body.
 *
 * A safe implementation rejects (422/409) a replay whose body differs from the
 * original; a weak one silently returns the cached response while ignoring the
 * new body — letting an attacker swap payload fields under the same key.
 *
 * @param {object} obs
 * @param {string} [obs.originalBody] — the body sent with the key the first time.
 * @param {string} [obs.replayBody] — the (different) body sent on the second submission.
 * @param {number} [obs.replayStatus] — HTTP status of the second submission.
 * @param {string} [obs.replayResponseBody] — response body of the second submission.
 * @returns {{ binding: 'STRICT'|'WEAK'|'ABSENT'|'UNKNOWN', finding: string|null, verdict: string }}
 */
export function assessIdempotencyReplayBinding({ originalBody, replayBody, replayStatus, replayResponseBody } = {}) {
  if (typeof originalBody !== 'string' || typeof replayBody !== 'string') {
    return {
      binding: 'UNKNOWN',
      finding: null,
      verdict: 'No original/replay body pair supplied — body-binding posture is unknown.',
    };
  }

  const bodiesIdentical = originalBody === replayBody;

  if (bodiesIdentical) {
    return {
      binding: 'UNKNOWN',
      finding: null,
      verdict: 'Original and replay bodies are identical — a body-differing replay is needed to test binding.',
    };
  }

  const status = Number(replayStatus);
  if (!Number.isFinite(status)) {
    return {
      binding: 'UNKNOWN',
      finding: null,
      verdict: 'Bodies differ but no replay status was observed — body-binding posture is unknown.',
    };
  }

  // Strict implementations reject body mismatches explicitly.
  if ([400, 409, 422].includes(status)) {
    const body = String(replayResponseBody || '').toLowerCase();
    if (/idempot/.test(body) || /mismatch|conflict|same key/.test(body)) {
      return {
        binding: 'STRICT',
        finding: null,
        verdict: `HTTP ${status} rejects the body-mismatched replay — the key is bound to the original body.`,
      };
    }
    return {
      binding: 'STRICT',
      finding: null,
      verdict: `HTTP ${status} rejects the body-mismatched replay — key binding appears enforced.`,
    };
  }

  if (status >= 200 && status < 300) {
    return {
      binding: 'WEAK',
      finding:
        'Idempotency key is NOT bound to the request body: a replay with a different body returned ' +
        `HTTP ${status} instead of a 422/409 rejection. An attacker who can influence retry parameters ` +
        'may swap payload fields while the server serves the cached result — verify on the target whether ' +
        'side effects follow the original or the swapped body before escalating.',
      verdict: `HTTP ${status} accepts a body-mismatched replay — weak key-to-body binding.`,
    };
  }

  return {
    binding: 'ABSENT',
    finding: null,
    verdict: `HTTP ${status} on body-mismatched replay — idempotency does not appear to be enforced on this endpoint.`,
  };
}

// ---------------------------------------------------------------- 1243 ----

/**
 * Assess whether idempotency keys are scoped per user/account.
 *
 * Observations are built from authorized cross-account test cases: two test
 * accounts belonging to the hunter (e.g. the hunter's own accounts A and B).
 * If account B can replay account A's key and see A's operation result, keys
 * are unscoped — a cross-user leak/replay channel.
 *
 * @param {object} obs
 * @param {Array<{ accountAKey: string, replayedByAccountB: boolean, replayStatus?: number, accountBSeesAccountAData?: boolean, responseBodyExcerpt?: string }>} [obs.crossAccountReplays]
 * @returns {{ scoping: 'SCOPED'|'UNSCOPED'|'UNKNOWN', finding: string|null, verdicts: string[] }}
 */
export function assessIdempotencyKeyScoping({ crossAccountReplays = [] } = {}) {
  const list = Array.isArray(crossAccountReplays) ? crossAccountReplays : [];
  const verdicts = [];

  if (list.length === 0) {
    return {
      scoping: 'UNKNOWN',
      finding: null,
      verdicts: ['No cross-account key-replay observations supplied — key scoping is unknown.'],
    };
  }

  let unscopedHits = 0;
  let scopedHits = 0;

  for (const r of list) {
    const replayed = r.replayedByAccountB === true;
    const leaked = r.accountBSeesAccountAData === true;
    if (!replayed) {
      scopedHits += 1;
      verdicts.push(
        `Key ${maskKey(r.accountAKey)} replayed by account B was rejected/not executed — keys appear account-scoped.`
      );
      continue;
    }
    if (leaked) {
      unscopedHits += 1;
      verdicts.push(
        `Key ${maskKey(r.accountAKey)} replayed by account B returned account A's data (HTTP ${r.replayStatus ?? 'n/a'}) — cross-user key collision.`
      );
    } else {
      unscopedHits += 1;
      verdicts.push(
        `Key ${maskKey(r.accountAKey)} replayed by account B was executed (HTTP ${r.replayStatus ?? 'n/a'}) — key not bound to the originating account.`
      );
    }
  }

  const scoping = unscopedHits > 0 ? 'UNSCOPED' : scopedHits > 0 ? 'SCOPED' : 'UNKNOWN';
  const finding = scoping === 'UNSCOPED'
    ? 'Idempotency keys are NOT scoped per user: a key minted by one account can be replayed by another ' +
      'account to execute or read the original operation. This leaks cross-user operation state — a reportable ' +
      'finding when keys are predictable or exposed through shared channels (webhooks, logs, referrals).'
    : null;

  return { scoping, finding, verdicts };
}

/**
 * Mask an idempotency key for safe reporting (keep first/last 4 chars).
 * @param {string} key
 * @returns {string}
 */
function maskKey(key) {
  const k = String(key || '');
  if (k.length <= 8) return '***';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

// ---------------------------------------------------------------- 1244 ----

const CACHE_STATUS_HIT_VALUES = ['hit', 'tcp_hit', 'tcp_mem_hit', 'hit-stale'];
const CACHE_STATUS_MISS_VALUES = ['miss', 'tcp_miss', 'bypass', 'dynamic'];

/**
 * Map ETag / If-None-Match caching behavior of endpoints from observed header pairs.
 *
 * @param {object} obs
 * @param {Array<{ endpoint: string, authenticated: boolean, etag?: string|null, ifNoneMatchSent?: boolean, responseStatus?: number, cacheControl?: string|null, age?: number|null, authenticatedContentServedFromCache?: boolean }>} [obs.endpoints]
 * @returns {{ endpoints: Array<{ endpoint: string, cacheable: boolean, stalePrivilegeRisk: boolean, notes: string[] }>, findings: string[] }}
 */
export function mapETagCaching({ endpoints = [] } = {}) {
  const list = Array.isArray(endpoints) ? endpoints : [];
  const findings = [];

  const mapped = list.map((e) => {
    const notes = [];
    const hasEtag = typeof e.etag === 'string' && e.etag.length > 0;
    const cacheable = hasEtag && e.ifNoneMatchSent === true && Number(e.responseStatus) === 304;
    const stalePrivilegeRisk =
      e.authenticated === true && e.authenticatedContentServedFromCache === true;

    if (!hasEtag) notes.push('No ETag validator emitted.');
    if (hasEtag && e.ifNoneMatchSent !== true) notes.push('ETag emitted but conditional revalidation was not observed.');
    if (cacheable) notes.push('ETag + If-None-Match returns 304 — endpoint participates in cache validation.');
    if (stalePrivilegeRisk) {
      notes.push('Authenticated response was served from cache — stale privileged data may leak to the wrong principal.');
    }
    const cc = String(e.cacheControl || '').toLowerCase();
    if (/private/.test(cc)) notes.push('Cache-Control: private — not for shared caches.');
    if (/no-store/.test(cc)) notes.push('Cache-Control: no-store — validator caching disabled.');
    if (/public/.test(cc) && e.authenticated === true) notes.push('Cache-Control: public on an authenticated response — misconfiguration.');

    return {
      endpoint: String(e.endpoint || '(unknown)'),
      cacheable,
      stalePrivilegeRisk,
      notes,
    };
  });

  const risky = mapped.filter((m) => m.stalePrivilegeRisk);
  if (risky.length > 0) {
    findings.push(
      `${risky.length} authenticated endpoint${risky.length === 1 ? '' : 's'} served cached privileged content ` +
      `(${risky.map((m) => m.endpoint).join(', ')}) — investigate per-user cache-key isolation.`
    );
  }
  if (list.length === 0) {
    findings.push('No endpoint observations supplied — ETag caching behavior is unmapped.');
  }

  return { endpoints: mapped, findings };
}

// ---------------------------------------------------------------- 1245 ----

const CACHE_STATUS_HEADERS = ['x-cache', 'x-cache-status', 'cf-cache-status', 'x-varnish', 'age', 'x-cdn'];

/**
 * Identify which query parameters influence the cache key, from A/B observations.
 *
 * Each probe varies ONE parameter and records whether the cache status flips
 * (e.g. MISS→HIT or a fresh body), which proves the parameter is part of the
 * key; a parameter that never flips the status is UNKEYED — the classic
 * cache-deception precondition.
 *
 * @param {object} obs
 * @param {Array<{ param: string, flippedCacheStatus: boolean, notes?: string }>} [obs.probes]
 * @returns {{ keyed: string[], unkeyed: string[], verdict: string, findings: string[] }}
 */
export function discoverCacheKeyParams({ probes = [] } = {}) {
  const list = Array.isArray(probes) ? probes : [];
  const findings = [];
  const keyed = [];
  const unkeyed = [];

  for (const p of list) {
    const param = String(p.param || '').trim();
    if (!param) continue;
    if (p.flippedCacheStatus === true) keyed.push(param);
    else unkeyed.push(param);
  }

  const unique = (arr) => [...new Set(arr)];
  const keyedU = unique(keyed);
  const unkeyedU = unique(unkeyed);

  let verdict;
  if (list.length === 0) {
    verdict = 'No cache-key probes supplied — keyed/unkeyed parameter sets are unknown.';
  } else if (unkeyedU.length === 0) {
    verdict = `All ${keyedU.length} tested parameter${keyedU.length === 1 ? ' is' : 's are'} part of the cache key — no cache-deception surface found.`;
  } else {
    verdict =
      `${unkeyedU.length} parameter${unkeyedU.length === 1 ? '' : 's'} not part of the cache key ` +
      `(${unkeyedU.join(', ')}) — cache-deception variants are possible where the origin's response ` +
      'depends on an unkeyed parameter while the cache stores one shared copy.';
  }

  if (unkeyedU.length > 0) {
    findings.push(
      `Unkeyed params (${unkeyedU.join(', ')}) are candidates for cache deception: vary them against ` +
      'endpoints whose origin output depends on them (error pages, redirects, language, debug flags).'
    );
  }
  if (keyedU.length > 0) {
    findings.push(`Keyed params (${keyedU.join(', ')}) safely bust the cache — useful as cache-busters during testing.`);
  }

  return { keyed: keyedU, unkeyed: unkeyedU, verdict, findings };
}

/**
 * Extract a normalized cache-status token from response headers (helper for
 * building the A/B observations that feed discoverCacheKeyParams).
 * @param {object} headers — raw response headers (any case).
 * @returns {'HIT'|'MISS'|'UNKNOWN'}
 */
export function classifyCacheStatus(headers = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers || {})) lower[String(k).toLowerCase()] = String(v).toLowerCase();

  for (const h of CACHE_STATUS_HEADERS) {
    const v = lower[h];
    if (!v) continue;
    if (CACHE_STATUS_HIT_VALUES.some((hit) => v.includes(hit))) return 'HIT';
    if (CACHE_STATUS_MISS_VALUES.some((miss) => v.includes(miss))) return 'MISS';
  }
  return 'UNKNOWN';
}

// ---------------------------------------------------------------- 1246 ----

/**
 * Differential analysis of cached vs fresh API responses for data leakage.
 *
 * Compares a response served from cache (observed headers/body) against a fresh
 * origin response for the same resource. Differences in authenticated fields,
 * user identifiers, or privileged data indicate the CDN cached a personalized
 * response and served it to the wrong principal.
 *
 * @param {object} obs
 * @param {object} [obs.cached] — { headers, body, forUser } observed cached response.
 * @param {object} [obs.fresh] — { headers, body, forUser } observed fresh origin response.
 * @returns {{ leak: boolean, leakedFields: string[], verdict: string, findings: string[] }}
 */
export function differentialCachedVsFresh({ cached = {}, fresh = {} } = {}) {
  const findings = [];

  const cachedBody = cached.body;
  const freshBody = fresh.body;
  if (cachedBody === undefined || freshBody === undefined) {
    return {
      leak: false,
      leakedFields: [],
      verdict: 'Cached and fresh bodies were not both supplied — differential analysis is impossible.',
      findings,
    };
  }

  const cachedFields = flattenFields(cachedBody);
  const freshFields = flattenFields(freshBody);
  const leakedFields = [];

  // A leak exists when the cached body contains personalized/privileged values
  // that belong to a DIFFERENT user than the requester of the cached copy.
  const cachedUser = String(cached.forUser || '');
  const freshUser = String(fresh.forUser || '');
  const usersDiffer = cachedUser !== '' && freshUser !== '' && cachedUser !== freshUser;

  if (usersDiffer) {
    for (const [path, value] of Object.entries(cachedFields)) {
      if (looksPersonalized(path, value) && freshFields[path] !== value) {
        leakedFields.push(path);
      }
    }
  }

  const leak = leakedFields.length > 0;
  if (leak) {
    findings.push(
      `Cached response for '${cachedUser}' contains ${leakedFields.length} personalized field${leakedFields.length === 1 ? '' : 's'} ` +
      `(${leakedFields.slice(0, 8).join(', ')}${leakedFields.length > 8 ? ', …' : ''}) that differ from the fresh response for ` +
      `'${freshUser}' — the CDN cached an authenticated response and leaked it across users. Report as web-cache deception/data leak.`
    );
  } else if (usersDiffer) {
    findings.push('Cached and fresh responses show no personalized-field divergence — no cross-user cache leak detected in this pair.');
  } else {
    findings.push('Both responses were observed as the same user — rerun with distinct test principals to test cross-user leakage.');
  }

  const verdict = leak
    ? 'LEAK: cached response contains another user\u2019s personalized data.'
    : 'CLEAN: no cross-user data leak detected in this response pair.';

  return { leak, leakedFields, verdict, findings };
}

/**
 * Flatten an object body into dotted-path -> primitive value entries.
 * @param {any} body
 * @param {string} [prefix]
 * @returns {Record<string, string>}
 */
function flattenFields(body, prefix = '') {
  const out = {};
  const visit = (node, path) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) visit(v, path ? `${path}.${k}` : k);
      return;
    }
    out[path] = String(node);
  };
  visit(body, prefix);
  return out;
}

const PERSONALIZED_PATH_PATTERNS = [
  /email/i, /username/i, /user[_-]?id/i, /account[_-]?id/i, /phone/i,
  /name$/i, /first[_-]?name/i, /last[_-]?name/i, /address/i, /ssn/i,
  /balance/i, /credit/i, /token/i, /session/i, /api[_-]?key/i,
  /dob|birth/i, /national/i, /passport/i,
];

/**
 * Heuristic: does a field path/value look like personalized data?
 * @param {string} path
 * @param {string} value
 * @returns {boolean}
 */
function looksPersonalized(path, value) {
  if (PERSONALIZED_PATH_PATTERNS.some((p) => p.test(path))) return true;
  // Email-shaped or long-token-shaped values in any field.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return true;
  return false;
}

// ---------------------------------------------------------------- 1247 ----

/**
 * Analyze If-Modified-Since / conditional-request handling for 304-path bypasses.
 *
 * Some servers short-circuit to 304 on ANY plausible If-Modified-Since value
 * without re-running authorization — or return the full body with 304, or honor
 * impossible dates. These observations are classified into risk bands.
 *
 * @param {object} obs
 * @param {Array<{ sentValue: string, responseStatus: number, bodyServedWith304?: boolean, authorizationChecked?: boolean, notes?: string }>} [obs.probes]
 * @returns {{ risk: 'HIGH'|'MEDIUM'|'LOW'|'UNKNOWN', verdict: string, findings: string[] }}
 */
export function testConditionalRequestHandling({ probes = [] } = {}) {
  const list = Array.isArray(probes) ? probes : [];
  const findings = [];

  if (list.length === 0) {
    return { risk: 'UNKNOWN', verdict: 'No conditional-request probes supplied — 304-path posture is unknown.', findings };
  }

  let score = 0;
  for (const p of list) {
    const sent = String(p.sentValue || '');
    const status = Number(p.responseStatus);

    // Impossible/future dates that still yield 304 = broken conditional logic.
    if (isImpossibleDate(sent) && status === 304) {
      score += 30;
      findings.push(`Impossible date '${sent}' still returned 304 — conditional logic is not validating the timestamp.`);
    }
    // 304 WITH a body = protocol violation that may skip output filters.
    if (status === 304 && p.bodyServedWith304 === true) {
      score += 40;
      findings.push('Server returned a response BODY with 304 Not Modified — downstream filters/proxies may mishandle it.');
    }
    // 304 where authorization was provably skipped.
    if (status === 304 && p.authorizationChecked === false) {
      score += 40;
      findings.push('304 served without re-running authorization — privileged resource metadata may be enumerable by unauthorized principals.');
    }
    // Garbage dates accepted as valid.
    if (!isPlausibleHttpDate(sent) && !isImpossibleDate(sent) && status === 304) {
      score += 20;
      findings.push(`Malformed date '${sent}' returned 304 — the parser is lenient, conditional logic may be guessable.`);
    }
  }

  const risk = score >= 60 ? 'HIGH' : score >= 25 ? 'MEDIUM' : score > 0 ? 'LOW' : 'LOW';
  if (score === 0) {
    findings.push('Conditional requests behaved correctly: plausible dates revalidate, garbage is ignored or rejected.');
  }

  return {
    risk,
    verdict: `Conditional-request risk: ${risk} (${list.length} probe${list.length === 1 ? '' : 's'} analyzed).`,
    findings,
  };
}

/**
 * Detect obviously impossible HTTP dates (year 0001, far-future, epoch 0 sent as string).
 * @param {string} value
 * @returns {boolean}
 */
function isImpossibleDate(value) {
  const v = String(value);
  if (/0001|9999|epoch|^\s*$/.test(v)) return true;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  const year = new Date(t).getUTCFullYear();
  return year < 1971 || year > 2100;
}

/**
 * Check whether a value parses as a plausible HTTP date.
 * @param {string} value
 * @returns {boolean}
 */
function isPlausibleHttpDate(value) {
  const t = Date.parse(String(value));
  if (!Number.isFinite(t)) return false;
  const year = new Date(t).getUTCFullYear();
  return year >= 1971 && year <= 2100;
}

// ---------------------------------------------------------------- 1248 ----

/**
 * Analyze Range-request handling on API (JSON) endpoints.
 *
 * Range requests are meant for static assets; when an API honors `Range` on
 * JSON responses it can slice through output filters (e.g. returning only the
 * tail of a filtered document), leak field fragments, or reveal that partial
 * content paths skip serialization/authorization logic.
 *
 * @param {object} obs
 * @param {Array<{ sentRange: string, responseStatus: number, contentRange?: string|null, bodyLength?: number, fullLength?: number, filterBypassed?: boolean }>} [obs.probes]
 * @returns {{ rangeSupported: boolean, risk: 'HIGH'|'MEDIUM'|'LOW'|'UNKNOWN', verdict: string, findings: string[] }}
 */
export function testRangeRequestOnApi({ probes = [] } = {}) {
  const list = Array.isArray(probes) ? probes : [];
  const findings = [];

  if (list.length === 0) {
    return {
      rangeSupported: false,
      risk: 'UNKNOWN',
      verdict: 'No Range-request probes supplied — partial-content posture is unknown.',
      findings,
    };
  }

  const supported = list.filter((p) => Number(p.responseStatus) === 206);
  const rangeSupported = supported.length > 0;

  let risk = 'LOW';
  for (const p of supported) {
    findings.push(
      `Range '${p.sentRange}' honored with 206 Partial Content` +
      (p.contentRange ? ` (${p.contentRange})` : '') +
      (Number.isFinite(Number(p.bodyLength)) && Number.isFinite(Number(p.fullLength))
        ? ` — served ${p.bodyLength} of ${p.fullLength} bytes.`
        : '.')
    );
    if (p.filterBypassed === true) {
      risk = 'HIGH';
      findings.push('Partial content skipped an output filter present on the full response — filter bypass confirmed on this endpoint.');
    }
  }

  if (rangeSupported && risk !== 'HIGH') {
    risk = 'MEDIUM';
    findings.push(
      'API honors Range on JSON endpoints: partial slices can bypass output filters and reveal document structure ' +
      '(field order, hidden keys) — probe whether filtered fields appear in sliced windows.'
    );
  }

  const ignored = list.filter((p) => Number(p.responseStatus) === 200);
  if (ignored.length > 0 && !rangeSupported) {
    findings.push(`Range ignored on ${ignored.length} probe${ignored.length === 1 ? '' : 's'} (full 200 served) — Range is not honored here.`);
  }
  const rejected = list.filter((p) => Number(p.responseStatus) === 416);
  if (rejected.length > 0) {
    findings.push(`Range rejected with 416 on ${rejected.length} probe${rejected.length === 1 ? '' : 's'} — range handling is explicitly validated.`);
  }

  return {
    rangeSupported,
    risk,
    verdict: rangeSupported
      ? `Range honored on API endpoint (risk ${risk}) — partial-content output-filter bypass surface exists.`
      : 'Range not honored on tested API endpoints — no partial-content surface.',
    findings,
  };
}

// ---------------------------------------------------------------- 1249 ----

/**
 * Map OpenAPI discriminators and polymorphic branches (oneOf/anyOf) to expose
 * hidden subtypes a flat schema review would miss.
 *
 * Pure document analysis — parses an OpenAPI/Swagger document object (already
 * fetched by the agent's recon tooling) and reports polymorphic structure.
 *
 * @param {object} openapi — OpenAPI 3.x document (or Swagger 2.0 with x- extensions).
 * @returns {{ schemas: Array<{ name: string, discriminatorProperty: string|null, branches: string[], inlineBranches: number, hiddenSubtypeHints: string[] }>, findings: string[] }}
 */
export function mapOpenApiDiscriminators(openapi = {}) {
  const findings = [];
  const doc = openapi || {};
  const schemas = doc.components?.schemas || doc.definitions || {};
  const out = [];

  for (const [name, schema] of Object.entries(schemas)) {
    if (!schema || typeof schema !== 'object') continue;
    const discriminatorProperty = schema.discriminator?.propertyName || schema['x-discriminator'] || null;
    const branches = [];

    for (const kw of ['oneOf', 'anyOf']) {
      const arr = schema[kw];
      if (Array.isArray(arr)) {
        for (const b of arr) {
          if (b && typeof b === 'object') {
            if (typeof b.$ref === 'string') branches.push(b.$ref.split('/').pop());
            else branches.push(`inline-${kw}`);
          }
        }
      }
    }
    const allOf = Array.isArray(schema.allOf) ? schema.allOf : [];
    for (const b of allOf) {
      if (b && typeof b.$ref === 'string') branches.push(`allOf:${b.$ref.split('/').pop()}`);
    }

    const inlineBranches = branches.filter((b) => b.startsWith('inline-')).length;
    const hiddenSubtypeHints = [];
    // Subtypes not reachable from any path operation are "hidden".
    const referenced = JSON.stringify(doc.paths || {});
    for (const b of branches) {
      if (!b.startsWith('inline-') && !b.startsWith('allOf:') && !referenced.includes(`"${b}"`)) {
        hiddenSubtypeHints.push(b);
      }
    }

    if (discriminatorProperty || branches.length > 0) {
      out.push({
        name,
        discriminatorProperty,
        branches: [...new Set(branches)],
        inlineBranches,
        hiddenSubtypeHints: [...new Set(hiddenSubtypeHints)],
      });
    }
  }

  if (out.length === 0) {
    findings.push('No discriminators or oneOf/anyOf polymorphism found — schema appears flat.');
  } else {
    for (const s of out) {
      findings.push(
        `Schema '${s.name}' is polymorphic` +
        (s.discriminatorProperty ? ` (discriminator: '${s.discriminatorProperty}')` : ' (no discriminator property)') +
        ` with ${s.branches.length} branch${s.branches.length === 1 ? '' : 'es'}: ${s.branches.join(', ') || 'none enumerated'}.`
      );
      if (s.hiddenSubtypeHints.length > 0) {
        findings.push(
          `Hidden subtypes in '${s.name}' not referenced by any path: ${s.hiddenSubtypeHints.join(', ')} — ` +
          'these may be reachable through the discriminator with elevated fields.'
        );
      }
      if (!s.discriminatorProperty && s.branches.length > 1) {
        findings.push(`'${s.name}' has multiple branches but no discriminator — branch selection logic is server-side and worth probing.`);
      }
    }
  }

  return { schemas: out, findings };
}

// ---------------------------------------------------------------- 1250 ----

/**
 * Assess polymorphic type-confusion routing from OBSERVED responses.
 *
 * Given authorized test submissions where a field declared as one subtype was
 * sent as another (e.g. an 'adminConfig' subtype where 'userConfig' was
 * expected), classify how the server handled it — type confusion that routes
 * data into privileged handlers is a real escalation vector.
 *
 * @param {object} obs
 * @param {Array<{ field: string, expectedSubtype: string, sentSubtype: string, responseStatus: number, routedToPrivilegedHandler?: boolean, errorMessage?: string|null }>} [obs.probes]
 * @returns {{ confusion: boolean, risk: 'HIGH'|'MEDIUM'|'LOW'|'UNKNOWN', verdict: string, findings: string[] }}
 */
export function assessPolymorphicTypeConfusion({ probes = [] } = {}) {
  const list = Array.isArray(probes) ? probes : [];
  const findings = [];

  if (list.length === 0) {
    return {
      confusion: false,
      risk: 'UNKNOWN',
      verdict: 'No type-confusion probes supplied — polymorphic routing posture is unknown.',
      findings,
    };
  }

  let score = 0;
  let confusion = false;

  for (const p of list) {
    const status = Number(p.responseStatus);
    const expected = String(p.expectedSubtype || '');
    const sent = String(p.sentSubtype || '');
    if (expected === sent) continue; // not a confusion probe

    if (p.routedToPrivilegedHandler === true) {
      confusion = true;
      score += 60;
      findings.push(
        `Field '${p.field}': subtype '${sent}' (expected '${expected}') was routed to a privileged handler ` +
        `(HTTP ${status}) — type confusion with privilege escalation. Reportable.`
      );
    } else if (status >= 200 && status < 300) {
      confusion = true;
      score += 30;
      findings.push(
        `Field '${p.field}': wrong subtype '${sent}' accepted with HTTP ${status} — server does not validate the discriminator.`
      );
    } else if ([400, 422].includes(status)) {
      findings.push(
        `Field '${p.field}': wrong subtype '${sent}' rejected with HTTP ${status} — discriminator validation appears enforced.`
      );
    } else {
      findings.push(
        `Field '${p.field}': wrong subtype '${sent}' → HTTP ${status} — inconclusive; verify server-side handling.`
      );
      score += 5;
    }

    const err = String(p.errorMessage || '');
    if (/discriminator|oneOf|anyOf|subtype|polymorph/i.test(err) && status >= 400) {
      findings.push(`Error message discloses polymorphic internals: '${err.slice(0, 120)}' — useful for mapping hidden branches.`);
    }
  }

  const risk = score >= 60 ? 'HIGH' : score >= 25 ? 'MEDIUM' : score > 0 ? 'LOW' : 'LOW';
  const verdict = confusion
    ? `Type confusion CONFIRMED in ${list.length} probe${list.length === 1 ? '' : 's'} (risk ${risk}) — wrong subtypes are accepted and/or routed.`
    : 'No type confusion observed — wrong subtypes were rejected or handled safely.';

  return { confusion, risk, verdict, findings };
}
