/**
 * apiKeyTierStaleRecon.js — API key lifecycle, plan-tier, and stale-surface reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Each function
 * inspects OBSERVED data (permission snapshots, response headers, rate-limit
 * counters, SDK route lists, docs text, traffic route inventories) gathered from
 * authorized targets and derives a security verdict about key lifecycle hygiene,
 * tier-gate enforcement, and stale-but-live API surface — they never send exploit
 * payloads, never burn quotas abusively, never issue keys fraudulently, never
 * bypass real authorization controls, and never unlock anything. Where an idea
 * describes adversarial behavior (self-serve issuance abuse, quota exhaustion,
 * trial unlocks), this module implements only the DETECTION / mapping /
 * differential-analysis side: risk-factor scoring, ceiling mapping from passive
 * observations, and safe probe planning.
 *
 * Covers idea-bank ideas 1311-1320:
 *  1311 detectScopeDrift — re-check key permissions over time; silent scope expansion widens key power
 *  1312 planCanaryKeys — plant canary key descriptors in monitored locations; canary usage alerts reveal attacker tooling
 *  1313 analyzeSelfServeRisk — score self-serve key-issuance exposure from observed signup-flow properties
 *  1314 analyzeQuotaBehavior — map quota/limit ceilings from PASSIVE observations (no quota burning)
 *  1315 diffPlanTiers — compare free vs paid endpoint access; flag paid endpoints reachable from free tier
 *  1316 evaluateTrialScope — test whether trial permissions include enterprise/unreleased features
 *  1317 analyzeExpiredKeyGrace — measure grace windows from responses observed after key expiry
 *  1318 parseDeprecationNotices — parse docs text and headers into a deprecation timeline for retest priority
 *  1319 diffSdkVersions — diff old vs new SDK route lists; SDK-dropped routes are stale-but-live retest candidates
 *  1320 diffMobileWebApis — diff mobile vs web API route inventories; mobile-only endpoints are discovery candidates
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1311_COVERAGE = [1311, 1312, 1313, 1314, 1315, 1316, 1317, 1318, 1319, 1320];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1311: 'detectScopeDrift',
    1312: 'planCanaryKeys',
    1313: 'analyzeSelfServeRisk',
    1314: 'analyzeQuotaBehavior',
    1315: 'diffPlanTiers',
    1316: 'evaluateTrialScope',
    1317: 'analyzeExpiredKeyGrace',
    1318: 'parseDeprecationNotices',
    1319: 'diffSdkVersions',
    1320: 'diffMobileWebApis',
  };
}

// ---------------------------------------------------------------- 1311 ----

const PRIVILEGED_SCOPE_KEYWORDS = [
  'admin', 'owner', 'root', 'superuser', 'write', 'delete', 'destroy',
  'billing', 'payment', 'impersonat', 'elevat', 'privileg', 'manage',
  'configure', 'deploy', 'secret', 'key',
];

/**
 * Normalize a scope input into a sorted, de-duplicated array of scope strings.
 * Accepts either an array of scope strings or an object mapping key ids to arrays.
 * @param {string[]|Record<string,string[]>} scopes
 * @returns {{ flat: string[], perKey: Record<string,string[]> }}
 */
function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) {
    const flat = [...new Set(scopes.map(String).map((s) => s.trim()).filter(Boolean))].sort();
    return { flat, perKey: { default: flat } };
  }
  const perKey = {};
  const flat = new Set();
  if (scopes && typeof scopes === 'object') {
    for (const [keyId, list] of Object.entries(scopes)) {
      const arr = [...new Set((Array.isArray(list) ? list : []).map(String).map((s) => s.trim()).filter(Boolean))].sort();
      perKey[String(keyId)] = arr;
      arr.forEach((s) => flat.add(s));
    }
  }
  return { flat: [...flat].sort(), perKey };
}

/**
 * Decide whether a scope string grants privileged capability, by keyword match.
 * @param {string} scope
 * @returns {boolean}
 */
export function isPrivilegedScope(scope) {
  const s = String(scope).toLowerCase();
  return PRIVILEGED_SCOPE_KEYWORDS.some((k) => s.includes(k));
}

/**
 * Detect permission drift between a baseline scope snapshot and a current one.
 *
 * Silent scope expansion widens what a key can do without any visible change to
 * the holder — this function compares two OBSERVED snapshots (e.g. from a
 * permissions introspection endpoint or token metadata on an authorized target)
 * and reports added/removed scopes with a risk rating.
 *
 * @param {string[]|Record<string,string[]>} [baselineScopes] — earlier snapshot
 * @param {string[]|Record<string,string[]>} [currentScopes] — later snapshot
 * @returns {{ drifted: boolean, added: string[], removed: string[], unchanged: string[],
 *   expandedPrivileged: string[], risk: 'high'|'medium'|'low'|'none',
 *   perKey: Record<string,{added:string[],removed:string[]}>, findings: string[] }}
 */
export function detectScopeDrift(baselineScopes = [], currentScopes = []) {
  const base = normalizeScopes(baselineScopes);
  const curr = normalizeScopes(currentScopes);
  const baseSet = new Set(base.flat);
  const currSet = new Set(curr.flat);

  const added = curr.flat.filter((s) => !baseSet.has(s));
  const removed = base.flat.filter((s) => !currSet.has(s));
  const unchanged = curr.flat.filter((s) => baseSet.has(s));
  const expandedPrivileged = added.filter(isPrivilegedScope);
  const drifted = added.length > 0 || removed.length > 0;

  const perKey = {};
  for (const keyId of new Set([...Object.keys(base.perKey), ...Object.keys(curr.perKey)])) {
    const b = new Set(base.perKey[keyId] || []);
    const c = new Set(curr.perKey[keyId] || []);
    perKey[keyId] = {
      added: [...c].filter((s) => !b.has(s)).sort(),
      removed: [...b].filter((s) => !c.has(s)).sort(),
    };
  }

  let risk = 'none';
  const findings = [];
  if (expandedPrivileged.length > 0) {
    risk = 'high';
    findings.push(`HIGH: ${expandedPrivileged.length} privileged scope(s) silently added: ${expandedPrivileged.join(', ')}.`);
  } else if (added.length > 0) {
    const writes = added.filter((s) => /write|create|update|post|put|patch/i.test(s));
    risk = writes.length > 0 ? 'medium' : 'low';
    findings.push(`${added.length} scope(s) added without privilege keywords: ${added.join(', ')}.`);
  } else if (removed.length > 0) {
    risk = 'low';
    findings.push(`${removed.length} scope(s) removed: ${removed.join(', ')} — contraction, usually benign.`);
  } else {
    findings.push('No scope drift detected between snapshots.');
  }

  return { drifted, added, removed, unchanged, expandedPrivileged, risk, perKey, findings };
}

// ---------------------------------------------------------------- 1312 ----

const CANARY_LOCATION_KINDS = ['docs', 'repo', 'config', 'notebook', 'ci', 'wiki', 'ticket', 'chat'];

/**
 * Build a canary-key deployment plan for monitored locations.
 *
 * Canary keys are deliberately planted, uniquely identifiable credentials placed
 * where an attacker would look (docs, repos, configs). Any usage of a canary is
 * an intrusion signal that also reveals attacker tooling (user-agent, IP, call
 * pattern). This function produces DESCRIPTORS — it never generates live
 * credentials; the security team provisions the actual tokens through their
 * vault/secret manager and wires the monitoring hook.
 *
 * @param {Array<{ name: string, kind?: string, visibility?: 'public'|'internal'|'private', notes?: string }>} [locations]
 * @returns {{ canaries: Array<{ id: string, label: string, location: string, kind: string,
 *   tokenPrefix: string, alertOn: string[], rotationDays: number, provisionVia: string }>,
 *   coverage: { total: number, byKind: Record<string, number>, publicFacing: number },
 *   findings: string[] }}
 */
export function planCanaryKeys(locations = []) {
  const list = Array.isArray(locations) ? locations : [];
  const slug = (s) => String(s || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site';

  const canaries = list.map((loc, i) => {
    const kind = CANARY_LOCATION_KINDS.includes(String(loc.kind).toLowerCase()) ? String(loc.kind).toLowerCase() : 'config';
    const id = `canary-${slug(loc.name)}-${String(i + 1).padStart(2, '0')}`;
    return {
      id,
      label: `Canary key for ${loc.name || 'unnamed location'}`,
      location: String(loc.name || ''),
      kind,
      tokenPrefix: 'dm_canary_',
      alertOn: ['any-authenticated-use', 'failed-auth-with-canary-prefix', 'canary-seen-in-logs'],
      rotationDays: 90,
      provisionVia: 'vault/secret-manager — provision a low-privilege token with a unique audit label; this plan creates no credentials',
    };
  });

  const byKind = {};
  for (const c of canaries) byKind[c.kind] = (byKind[c.kind] || 0) + 1;
  const publicFacing = list.filter((l) => String(l.visibility).toLowerCase() === 'public').length;

  const findings = [];
  if (canaries.length === 0) {
    findings.push('No locations supplied — no canary plan generated.');
  } else {
    findings.push(`${canaries.length} canary descriptor(s) planned across ${Object.keys(byKind).length} location kind(s).`);
    if (publicFacing > 0) findings.push(`${publicFacing} public-facing location(s) prioritized — highest attacker-visibility placement.`);
    findings.push('Monitoring rule: alert on ANY authenticated use of a canary token; treat failed-auth attempts with the canary prefix as recon signal.');
  }

  return { canaries, coverage: { total: canaries.length, byKind, publicFacing }, findings };
}

// ---------------------------------------------------------------- 1313 ----

/**
 * Score self-serve API-key issuance exposure from observed signup-flow properties.
 *
 * This is the defensive side of the self-registration idea: it measures how
 * easily an authorized target's own issuance flow could be used to mint keys at
 * scale (weak verification, no bot checks, many keys per account), so the
 * bounty agent can report the exposure. It performs no signups itself.
 *
 * @param {object} [signupFlow]
 * @param {boolean} [signupFlow.emailVerification] — email ownership verified before key issuance
 * @param {boolean} [signupFlow.captchaOrBotCheck] — bot challenge present
 * @param {boolean} [signupFlow.paymentInstrumentRequired] — card/identity required
 * @param {number} [signupFlow.keysPerAccount] — max keys an account may hold
 * @param {boolean} [signupFlow.signupRateLimit] — signup endpoint rate limited
 * @param {boolean} [signupFlow.phoneVerification] — phone ownership verified
 * @param {number} [signupFlow.trialDays] — free trial length in days
 * @returns {{ score: number, level: 'high'|'medium'|'low', riskFactors: Array<{ factor: string, severity: 'high'|'medium'|'low', detail: string }>, findings: string[] }}
 */
export function analyzeSelfServeRisk(signupFlow = {}) {
  const f = signupFlow || {};
  const riskFactors = [];

  const add = (factor, severity, detail) => riskFactors.push({ factor, severity, detail });

  if (f.emailVerification === false) add('no-email-verification', 'high', 'Keys are issued without verifying email ownership; throwaway addresses can mint keys.');
  if (f.captchaOrBotCheck === false) add('no-bot-check', 'high', 'No bot challenge on signup; issuance can be fully automated.');
  if (f.paymentInstrumentRequired === false) add('no-payment-instrument', 'medium', 'No card or identity required; issuance is cost-free and anonymous.');
  if (typeof f.keysPerAccount === 'number' && f.keysPerAccount > 3) {
    add('generous-key-quota', f.keysPerAccount > 10 ? 'high' : 'medium', `Up to ${f.keysPerAccount} keys per account multiplies the value of each fake account.`);
  }
  if (f.signupRateLimit === false) add('no-signup-rate-limit', 'high', 'Signup endpoint is not rate limited; mass account creation is unthrottled.');
  if (f.phoneVerification === false) add('no-phone-verification', 'low', 'No phone check; low-friction second accounts are possible.');
  if (typeof f.trialDays === 'number' && f.trialDays > 30) {
    add('long-free-trial', 'low', `${f.trialDays}-day trial extends the useful life of each issued key.`);
  }

  const weights = { high: 30, medium: 15, low: 5 };
  const score = Math.min(100, riskFactors.reduce((sum, r) => sum + weights[r.severity], 0));
  const level = score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low';

  const findings = riskFactors.length === 0
    ? ['Signup flow shows no self-serve issuance risk factors from the observed properties.']
    : [`Self-serve issuance risk scored ${score}/100 (${level}).`, ...riskFactors.map((r) => `${r.severity.toUpperCase()}: ${r.factor} — ${r.detail}`)];

  return { score, level, riskFactors, findings };
}

// ---------------------------------------------------------------- 1314 ----

/**
 * Map quota/limit ceilings from PASSIVE observations of an authorized test key.
 *
 * Quota behavior (when 429s start, Retry-After values, hard vs soft limits)
 * reveals cost-based abuse ceilings — but this function only ANALYZES data the
 * agent already gathered through its own normal, authorized test traffic. It
 * contains no probing loop and performs no quota burning.
 *
 * @param {Array<{ keyLabel?: string, observedCeiling?: number, limitHeader?: number|string|null,
 *   requestsSeen?: number, status429Count?: number, retryAfterSec?: number|null,
 *   degradedInsteadOf429?: boolean, windowMs?: number|null }>} [observations]
 * @returns {{ ceilings: Record<string, { observedCeiling: number|null, limitSource: 'header'|'429-observed'|'none-observed',
 *   throttlingBehavior: 'hard-429'|'soft-degrade'|'none-observed', windowMs: number|null,
 *   retryAfterSec: number|null, findings: string[] }>, findings: string[] }}
 */
export function analyzeQuotaBehavior(observations = []) {
  const list = Array.isArray(observations) ? observations : [];
  const ceilings = {};
  const findings = [];

  if (list.length === 0) {
    findings.push('No quota observations supplied — ceiling map is empty.');
    return { ceilings, findings };
  }

  for (const obs of list) {
    const label = String(obs.keyLabel || 'default');
    const limitHeader = obs.limitHeader == null ? null : Number(obs.limitHeader);
    const ceiling = typeof obs.observedCeiling === 'number' ? obs.observedCeiling
      : (Number.isFinite(limitHeader) ? limitHeader : null);
    const saw429 = Number(obs.status429Count || 0) > 0;
    const degraded = Boolean(obs.degradedInsteadOf429);

    const limitSource = Number.isFinite(limitHeader) ? 'header' : (saw429 || ceiling != null ? '429-observed' : 'none-observed');
    const throttlingBehavior = saw429 ? 'hard-429' : degraded ? 'soft-degrade' : 'none-observed';

    const entryFindings = [];
    if (ceiling != null) entryFindings.push(`Observed ceiling ~${ceiling} requests (source: ${limitSource}).`);
    if (saw429) entryFindings.push('Hard 429 throttling observed — requests beyond the ceiling are rejected, not degraded.');
    if (degraded) entryFindings.push('Soft degradation observed instead of 429s — throttling is graceful (slower responses / reduced features).');
    if (obs.retryAfterSec != null) entryFindings.push(`Retry-After of ${obs.retryAfterSec}s observed — backoff window is server-advertised.`);
    if (ceiling == null && !saw429 && !degraded) entryFindings.push('No ceiling signal in observations — limit unknown from passive data.');

    ceilings[label] = {
      observedCeiling: ceiling,
      limitSource,
      throttlingBehavior,
      windowMs: typeof obs.windowMs === 'number' ? obs.windowMs : null,
      retryAfterSec: obs.retryAfterSec == null ? null : Number(obs.retryAfterSec),
      findings: entryFindings,
    };
  }

  findings.push(`Ceiling map built for ${Object.keys(ceilings).length} key label(s) from passive observations.`);
  return { ceilings, findings };
}

// ---------------------------------------------------------------- 1315 ----

/**
 * Diff free-tier vs paid-tier endpoint access to find tier gates enforced only client-side.
 *
 * Each entry describes one endpoint as OBSERVED from one tier: whether the call
 * succeeded and what the docs/marketing page claim the tier boundary is. When a
 * paid-documented endpoint answers successfully on the free tier, the tier gate
 * is likely client-side (UI-hidden) rather than server-enforced — a finding worth
 * reporting on an authorized target. Uses observed booleans only; performs no calls.
 *
 * @param {Array<{ path: string, method?: string, accessible: boolean, documentedTier?: string }>} [freeAccess]
 * @param {Array<{ path: string, method?: string, accessible: boolean, documentedTier?: string }>} [paidAccess]
 * @returns {{ flags: Array<{ path: string, method: string, type: 'unprotected-paid'|'tier-mismatch'|'consistent', severity: 'high'|'medium'|'info', detail: string }>,
 *   summary: { total: number, unprotectedPaid: number }, findings: string[] }}
 */
export function diffPlanTiers(freeAccess = [], paidAccess = []) {
  const key = (e) => `${String(e.method || 'GET').toUpperCase()} ${String(e.path || '').replace(/\/+$/, '') || '/'}`;
  const paidMap = new Map();
  for (const e of Array.isArray(paidAccess) ? paidAccess : []) paidMap.set(key(e), e);

  const flags = [];
  for (const f of Array.isArray(freeAccess) ? freeAccess : []) {
    const k = key(f);
    const p = paidMap.get(k);
    if (!p) continue;
    const documentedPaid = /paid|pro|enterprise|premium|business/i.test(String(f.documentedTier || p.documentedTier || ''));
    const path = String(f.path || '');
    const method = String(f.method || 'GET').toUpperCase();
    if (documentedPaid && f.accessible === true) {
      flags.push({
        path, method,
        type: 'unprotected-paid',
        severity: 'high',
        detail: 'Documented as a paid-tier endpoint but reachable from the free tier — tier gate appears client-side only.',
      });
    } else if (documentedPaid && f.accessible === false && p.accessible === true) {
      flags.push({ path, method, type: 'consistent', severity: 'info', detail: 'Tier gate consistent: blocked on free, allowed on paid.' });
    } else if (!documentedPaid && f.accessible !== p.accessible) {
      flags.push({
        path, method,
        type: 'tier-mismatch',
        severity: 'medium',
        detail: 'Access differs between tiers but the endpoint is not documented as tier-gated — undocumented gate or inconsistency.',
      });
    }
  }

  const unprotectedPaid = flags.filter((fl) => fl.type === 'unprotected-paid').length;
  const findings = [
    `Compared ${Array.isArray(freeAccess) ? freeAccess.length : 0} free-tier and ${Array.isArray(paidAccess) ? paidAccess.length : 0} paid-tier endpoint observations.`,
    unprotectedPaid > 0
      ? `HIGH: ${unprotectedPaid} paid-documented endpoint(s) reachable from the free tier.`
      : 'No paid-documented endpoints reachable from the free tier.',
  ];
  return { flags, summary: { total: flags.length, unprotectedPaid }, findings };
}

// ---------------------------------------------------------------- 1316 ----

const UNRELEASED_FEATURE_KEYWORDS = ['beta', 'preview', 'unreleased', 'early-access', 'experimental', 'labs', 'alpha', 'canary'];

/**
 * Evaluate whether trial-tier permissions include enterprise or unreleased features.
 *
 * Trial scopes frequently bundle unreleased capabilities by mistake. This function
 * compares the OBSERVED trial permission set against the enterprise endpoint
 * catalog (from docs) and flags overlaps — analysis only, no trial abuse.
 *
 * @param {string[]} [trialPermissions] — scopes/features observed on the trial key
 * @param {Array<{ path: string, method?: string, requiredFeature: string }>} [enterpriseEndpoints]
 * @returns {{ matches: Array<{ path: string, method: string, requiredFeature: string, severity: 'high'|'medium', detail: string }>,
 *   unreleasedInTrial: string[], risk: 'high'|'medium'|'low'|'none', findings: string[] }}
 */
export function evaluateTrialScope(trialPermissions = [], enterpriseEndpoints = []) {
  const perms = new Set((Array.isArray(trialPermissions) ? trialPermissions : []).map((p) => String(p).toLowerCase().trim()));
  const matches = [];

  for (const ep of Array.isArray(enterpriseEndpoints) ? enterpriseEndpoints : []) {
    const feature = String(ep.requiredFeature || '').toLowerCase().trim();
    if (!feature) continue;
    const granted = [...perms].some((p) => p === feature || p.includes(feature) || feature.includes(p));
    if (granted) {
      const unreleased = UNRELEASED_FEATURE_KEYWORDS.some((k) => feature.includes(k));
      matches.push({
        path: String(ep.path || ''),
        method: String(ep.method || 'GET').toUpperCase(),
        requiredFeature: String(ep.requiredFeature || ''),
        severity: unreleased ? 'high' : 'medium',
        detail: unreleased
          ? 'Trial key holds an UNRELEASED enterprise feature — pre-release surface exposed to trial tier.'
          : 'Trial key holds an enterprise feature — enterprise gate may be mis-scoped for trial tier.',
      });
    }
  }

  const unreleasedInTrial = [...perms].filter((p) => UNRELEASED_FEATURE_KEYWORDS.some((k) => p.includes(k)));
  let risk = 'none';
  if (matches.some((m) => m.severity === 'high')) risk = 'high';
  else if (matches.length > 0) risk = 'medium';
  else if (unreleasedInTrial.length > 0) risk = 'low';

  const findings = [
    `Checked ${perms.size} trial permission(s) against ${Array.isArray(enterpriseEndpoints) ? enterpriseEndpoints.length : 0} enterprise endpoint(s).`,
    matches.length > 0
      ? `${matches.length} enterprise feature(s) present in trial scope (risk: ${risk}).`
      : 'No enterprise features found in trial scope.',
  ];
  if (unreleasedInTrial.length > 0) findings.push(`Unreleased-labeled permissions on trial key: ${unreleasedInTrial.join(', ')}.`);
  return { matches, unreleasedInTrial, risk, findings };
}

// ---------------------------------------------------------------- 1317 ----

/**
 * Measure expired-key grace windows from responses observed after key expiry.
 *
 * Grace periods that silently extend access beyond a key's expiry are a
 * lifecycle finding. This function takes timestamped response observations
 * (status codes seen after the key's stated expiry) and measures how long
 * expired keys kept working — pure measurement, no expired-key reuse.
 *
 * @param {Array<{ keyLabel?: string, expiredAtMs: number, requestAtMs: number, status: number }>} [responses]
 * @returns {{ perKey: Record<string, { honoredAfterExpiryMs: number, verdict: 'grace-honored'|'hard-expired'|'unknown', samples: number }>,
 *   maxGraceMs: number|null, graceObserved: boolean, findings: string[] }}
 */
export function analyzeExpiredKeyGrace(responses = []) {
  const list = Array.isArray(responses) ? responses : [];
  const perKey = {};
  const findings = [];

  if (list.length === 0) {
    findings.push('No post-expiry observations supplied — grace behavior unknown.');
    return { perKey, maxGraceMs: null, graceObserved: false, findings };
  }

  for (const r of list) {
    const label = String(r.keyLabel || 'default');
    const expiredAt = Number(r.expiredAtMs);
    const requestedAt = Number(r.requestAtMs);
    if (!Number.isFinite(expiredAt) || !Number.isFinite(requestedAt)) continue;
    const afterMs = requestedAt - expiredAt;
    const honored = Number(r.status) < 400;
    if (!perKey[label]) perKey[label] = { honoredAfterExpiryMs: 0, verdict: 'unknown', samples: 0 };
    perKey[label].samples += 1;
    if (afterMs >= 0 && honored && afterMs > perKey[label].honoredAfterExpiryMs) {
      perKey[label].honoredAfterExpiryMs = afterMs;
    }
  }

  let maxGraceMs = null;
  let graceObserved = false;
  for (const [label, entry] of Object.entries(perKey)) {
    if (entry.honoredAfterExpiryMs > 0) {
      entry.verdict = 'grace-honored';
      graceObserved = true;
      maxGraceMs = maxGraceMs == null ? entry.honoredAfterExpiryMs : Math.max(maxGraceMs, entry.honoredAfterExpiryMs);
      findings.push(`${label}: expired key still honored ${entry.honoredAfterExpiryMs}ms after expiry — grace window active.`);
    } else if (entry.samples > 0) {
      entry.verdict = 'hard-expired';
      findings.push(`${label}: expired key rejected across ${entry.samples} sample(s) — no grace observed.`);
    }
  }

  if (graceObserved) {
    findings.unshift(`Grace window observed: up to ~${Math.round(maxGraceMs / 3600000 * 10) / 10}h of post-expiry access.`);
  } else {
    findings.unshift('No grace window observed — expired keys are rejected promptly.');
  }
  return { perKey, maxGraceMs, graceObserved, findings };
}

// ---------------------------------------------------------------- 1318 ----

const DEPRECATION_DATE_RE = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/;
const VERSION_RE = /\bv(\d+(?:\.\d+){0,2})\b/i;

/**
 * Parse deprecation notices from docs text and observed response headers into a timeline.
 *
 * Deprecation timelines prioritize which dead endpoints to retest: deprecated-but-
 * live endpoints are classic stale-surface targets. Parses RFC 8594
 * `Deprecation`/`Sunset` headers plus docs prose ("deprecated", "sunset",
 * "end-of-life") with dates and version numbers. Analysis only — no requests made.
 *
 * @param {string} [docsText] — documentation prose / changelog text
 * @param {Record<string,string>} [headers] — observed response headers (case-insensitive)
 * @returns {{ timeline: Array<{ source: 'header'|'docs', type: 'deprecation'|'sunset',
 *   context: string, date: string|null, raw: string }>, findings: string[] }}
 */
export function parseDeprecationNotices(docsText = '', headers = {}) {
  const timeline = [];
  const lower = {};
  for (const [k, v] of Object.entries(headers || {})) lower[String(k).toLowerCase()] = String(v);

  if (lower.deprecation) {
    const raw = lower.deprecation;
    const atMatch = raw.match(/@(\d+)/);
    timeline.push({
      source: 'header', type: 'deprecation', context: 'response headers',
      date: atMatch ? new Date(Number(atMatch[1]) * 1000).toISOString() : null, raw,
    });
  }
  if (lower.sunset) {
    const raw = lower.sunset;
    const parsed = Date.parse(raw);
    timeline.push({
      source: 'header', type: 'sunset', context: 'response headers',
      date: Number.isNaN(parsed) ? null : new Date(parsed).toISOString(), raw,
    });
  }

  const text = String(docsText || '');
  for (const line of text.split('\n')) {
    const l = line.toLowerCase();
    const mentions = l.includes('deprecat') || l.includes('sunset') || l.includes('end-of-life') || l.includes('end of life');
    if (!mentions) continue;
    const dateMatch = line.match(DEPRECATION_DATE_RE);
    const versionMatch = line.match(VERSION_RE);
    timeline.push({
      source: 'docs',
      type: l.includes('sunset') || l.includes('end-of-life') || l.includes('end of life') ? 'sunset' : 'deprecation',
      context: [versionMatch ? `version ${versionMatch[0]}` : null, line.trim().slice(0, 140)].filter(Boolean).join(' — ') || 'docs',
      date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00.000Z` : null,
      raw: line.trim().slice(0, 200),
    });
  }

  timeline.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  const findings = timeline.length === 0
    ? ['No deprecation or sunset notices found in docs text or headers.']
    : [
        `Parsed ${timeline.length} deprecation notice(s) into a timeline.`,
        ...timeline.map((t) => `${t.type.toUpperCase()} [${t.source}] ${t.context}${t.date ? ` — ${t.date.slice(0, 10)}` : ' — date unknown'}`),
      ];
  return { timeline, findings };
}

// ---------------------------------------------------------------- 1319 ----

const normalizeRoute = (r) => String(r || '').trim().replace(/\s+/g, ' ').replace(/^(get|post|put|patch|delete|head|options)\s+/i, (m) => `${m.trim().toUpperCase()} `).replace(/\/+$/, '') || '/';

/**
 * Diff old vs new SDK route lists to find stale-but-live endpoint candidates.
 *
 * Backends frequently keep serving endpoints that the latest SDKs dropped.
 * This function compares two OBSERVED route inventories (extracted from SDK
 * sources) and flags routes removed from the newest SDK as retest candidates —
 * list comparison only, no requests made.
 *
 * @param {string[]} [oldSdkRoutes] — routes present in the older SDK (e.g. "GET /v1/legacy")
 * @param {string[]} [newSdkRoutes] — routes present in the latest SDK
 * @returns {{ dropped: string[], added: string[], unchanged: string[],
 *   candidates: Array<{ route: string, reason: string, retestPriority: 'high'|'medium' }>, findings: string[] }}
 */
export function diffSdkVersions(oldSdkRoutes = [], newSdkRoutes = []) {
  const oldSet = new Set((Array.isArray(oldSdkRoutes) ? oldSdkRoutes : []).map(normalizeRoute));
  const newSet = new Set((Array.isArray(newSdkRoutes) ? newSdkRoutes : []).map(normalizeRoute));

  const dropped = [...oldSet].filter((r) => !newSet.has(r)).sort();
  const added = [...newSet].filter((r) => !oldSet.has(r)).sort();
  const unchanged = [...oldSet].filter((r) => newSet.has(r)).sort();

  const candidates = dropped.map((route) => ({
    route,
    reason: 'Removed from the latest SDK but may still be served by the backend — classic stale-but-live surface.',
    retestPriority: /admin|internal|debug|legacy|v1\b/i.test(route) ? 'high' : 'medium',
  }));

  const findings = [
    `Old SDK: ${oldSet.size} route(s); new SDK: ${newSet.size} route(s).`,
    dropped.length > 0
      ? `${dropped.length} route(s) dropped from the latest SDK — stale-but-live retest candidates.`
      : 'No routes dropped between SDK versions.',
    added.length > 0 ? `${added.length} new route(s) introduced in the latest SDK.` : 'No new routes introduced.',
  ];
  return { dropped, added, unchanged, candidates, findings };
}

// ---------------------------------------------------------------- 1320 ----

/**
 * Diff mobile vs web API route inventories to find mobile-only endpoints.
 *
 * Mobile apps frequently call API endpoints the web frontend never touches.
 * This function compares two OBSERVED route inventories (harvested from traffic
 * captures on an authorized test device/account) and surfaces mobile-only
 * routes as discovery candidates — list comparison only, no traffic generated.
 *
 * @param {string[]} [mobileRoutes] — routes observed in mobile app traffic
 * @param {string[]} [webRoutes] — routes observed in web app traffic
 * @returns {{ mobileOnly: string[], webOnly: string[], shared: string[],
 *   candidates: Array<{ route: string, reason: string }>, findings: string[] }}
 */
export function diffMobileWebApis(mobileRoutes = [], webRoutes = []) {
  const mobileSet = new Set((Array.isArray(mobileRoutes) ? mobileRoutes : []).map(normalizeRoute));
  const webSet = new Set((Array.isArray(webRoutes) ? webRoutes : []).map(normalizeRoute));

  const mobileOnly = [...mobileSet].filter((r) => !webSet.has(r)).sort();
  const webOnly = [...webSet].filter((r) => !mobileSet.has(r)).sort();
  const shared = [...mobileSet].filter((r) => webSet.has(r)).sort();

  const candidates = mobileOnly.map((route) => ({
    route,
    reason: 'Called by the mobile app but never by the web frontend — mobile-only endpoint worth inventorying on authorized scope.',
  }));

  const findings = [
    `Mobile: ${mobileSet.size} route(s); web: ${webSet.size} route(s); shared: ${shared.length}.`,
    mobileOnly.length > 0
      ? `${mobileOnly.length} mobile-only endpoint(s) discovered.`
      : 'No mobile-only endpoints — mobile and web surfaces match.',
  ];
  return { mobileOnly, webOnly, shared, candidates, findings };
}
