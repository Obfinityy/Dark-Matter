/**
 * IDOR dual-account checker — two test accounts (A = victim, B = attacker)
 * against the SAME resource URL; responses are diffed for unauthorized data
 * disclosure. Real HTTP, used in tests against our own fixture on 127.0.0.1.
 *
 * Detection logic:
 *   1. GET resource as A (owner) → baseline body
 *   2. GET same resource as B (non-owner) → candidate body
 *   3. If B gets 200 with the SAME sensitive fields as A's baseline (and B is
 *      not an admin / not the owner), that's an IDOR candidate.
 *   4. Controls: unauthenticated request must NOT get the data (else the
 *      endpoint is just public, not IDOR); B requesting B's OWN resource must
 *      succeed (sanity that tokens work).
 *
 * Returns a normalized finding when confirmed, with both response bodies as
 * evidence. Never touches external targets — baseUrl is validated to be
 * loopback-only when `enforceLoopback` is true (default in tests).
 */
import { isLoopbackUrl } from './netGuard.js';

function summarize(body, maxLen = 2000) {
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  return s.length > maxLen ? `${s.slice(0, maxLen)}…[truncated]` : s;
}

/** Fields that indicate real data disclosure (not just "exists"). */
const SENSITIVE_KEYS = ['email', 'password', 'ssn', 'phone', 'address', 'token', 'secret', 'balance', 'salary', 'dob', 'credit'];

function sensitiveOverlap(baseline, candidate) {
  let baselineObj, candidateObj;
  try {
    baselineObj = typeof baseline === 'string' ? JSON.parse(baseline) : baseline;
    candidateObj = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
  } catch { return { overlap: false }; }
  if (!baselineObj || typeof baselineObj !== 'object' || !candidateObj || typeof candidateObj !== 'object') {
    return { overlap: false };
  }
  const disclosed = [];
  for (const key of Object.keys(baselineObj)) {
    const lk = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((s) => lk.includes(s));
    if (isSensitive && candidateObj[key] !== undefined && String(candidateObj[key]) === String(baselineObj[key]) && baselineObj[key] !== '' && baselineObj[key] != null) {
      disclosed.push(key);
    }
  }
  return { overlap: disclosed.length > 0, disclosed };
}

export async function checkIdor(baseUrl, {
  resourcePath,          // e.g. '/api/users/:id' with :id replaced per account
  victimId, attackerId,  // resource ids owned by A and B respectively
  tokenA, tokenB,         // bearer tokens
  authHeader = 'authorization',
  authScheme = 'Bearer ',
  enforceLoopback = true,
  timeoutMs = 10_000
} = {}) {
  if (!baseUrl || !resourcePath || victimId == null || attackerId == null || !tokenA || !tokenB) {
    throw new Error('checkIdor requires baseUrl, resourcePath, victimId, attackerId, tokenA, tokenB');
  }
  if (enforceLoopback && !isLoopbackUrl(baseUrl)) {
    throw new Error(`checkIdor refused: ${baseUrl} is not loopback (safety)`);
  }
  const urlFor = (id) => `${baseUrl}${resourcePath.replace(':id', encodeURIComponent(String(id)))}`;
  const get = async (url, token) => {
    const headers = {};
    if (token) headers[authHeader] = `${authScheme}${token}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      const body = await res.text();
      return { status: res.status, body };
    } finally { clearTimeout(t); }
  };

  // 1. Baseline: A reads A's own resource — must succeed for the test to mean anything
  const baseline = await get(urlFor(victimId), tokenA);
  if (baseline.status !== 200) {
    return { vulnerable: false, reason: `baseline failed: victim could not read own resource (HTTP ${baseline.status})`, evidence: { baselineStatus: baseline.status } };
  }
  // 2. Sanity: B reads B's own resource — tokens must work
  const sanity = await get(urlFor(attackerId), tokenB);
  if (sanity.status !== 200) {
    return { vulnerable: false, reason: `sanity failed: attacker token could not read own resource (HTTP ${sanity.status})` };
  }
  // 3. The actual test: B reads A's resource
  const attack = await get(urlFor(victimId), tokenB);
  // 4. Control: unauthenticated read — if public, it's not IDOR
  const anon = await get(urlFor(victimId), null);

  const { overlap, disclosed } = sensitiveOverlap(baseline.body, attack.body);
  const anonOverlap = sensitiveOverlap(baseline.body, anon.body).overlap;

  if (attack.status === 200 && overlap && !anonOverlap) {
    return {
      vulnerable: true,
      finding: {
        type: 'idor',
        title: `IDOR: account B can read account A's resource (${resourcePath.replace(':id', victimId)})`,
        severity: 'high',
        url: urlFor(victimId),
        evidence: {
          victimResource: urlFor(victimId),
          attackerReadStatus: attack.status,
          disclosedFields: disclosed,
          baselineBody: summarize(baseline.body),
          attackerBody: summarize(attack.body),
          anonymousStatus: anon.status,
          controlNote: 'unauthenticated request did not receive the data — not a public endpoint'
        },
        confidence: 0.9,
        source: 'idor-dual-account'
      }
    };
  }
  if (attack.status === 200 && overlap && anonOverlap) {
    return { vulnerable: false, reason: 'endpoint is public (anonymous read returns the same data) — not IDOR', evidence: { anonymousStatus: anon.status } };
  }
  return {
    vulnerable: false,
    reason: `no disclosure: attacker got HTTP ${attack.status}${overlap ? '' : ' without matching sensitive fields'}`,
    evidence: { attackerStatus: attack.status, anonymousStatus: anon.status }
  };
}
