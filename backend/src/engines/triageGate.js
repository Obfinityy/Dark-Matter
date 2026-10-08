/**
 * triageGate.js — The Triage Gate (elite-hunter validation pipeline).
 *
 * Research basis (research/elite-hunter/03-tooling-ai-gap.md, Part B):
 * Google paused its open-source VRP (Oct 2026) after AI flooded triage with
 * invalid reports. Curl's maintainer called them "slop". The bottleneck moved
 * from discovery to VALIDATION: reproduction, impact demonstration, and
 * exploit-path proof. Gap analysis priority #1 (05-gap-analysis.md): without
 * this gate, every new testing capability produces noise.
 *
 * Every finding must survive 5 checks before it becomes a report:
 *  1. Scope        — is the target in scope?
 *  2. Duplicate    — same vuln type + location + parameter already found?
 *  3. Evidence     — concrete response artifacts, not pattern-matching labels?
 *  4. Impact       — does this affect a real user right now? (kill weak fast)
 *  5. Reproducible — can the probe be re-run with the same result?
 *
 * Checks run cheap-first (scope/dup before anything that invokes a hook).
 * Score 0-100 lets triage sort: passed-but-weak findings rank below
 * passed-and-strong ones.
 *
 * Pure functions. The reproduce hook is caller-provided; when absent, the
 * check defers honestly to the replay pipeline instead of claiming proof.
 *
 * Finding shape (liberal — extra fields ignored):
 *   { type, url, param?, evidence?, confidence?, impact?, reproduced?, replay? }
 *
 * Context shape:
 *   {
 *     scope?: { allowedDomains?: string[], allowedPaths?: (string|RegExp)[],
 *               forbiddenPaths?: (string|RegExp)[] },
 *     target?: string,                 // base URL for resolving relative URLs
 *     existingFindings?: object[],     // already-accepted findings (dedupe)
 *     reproduce?: (finding) => boolean | { reproduced, note? }  // sync only
 *   }
 */

const CHECK_WEIGHTS = {
  scope: 10,
  duplicate: 10,
  evidence: 30,
  impact: 25,
  reproducibility: 25,
};

const GENERIC_EVIDENCE_LABELS = [
  /^sql error signature$/i,
  /^canary reflected$/i,
  /^xss detected$/i,
  /^vulnerability found$/i,
  /^pattern matched$/i,
  /^potential vulnerability$/i,
];

const THEORETICAL_PHRASES = [
  /\bcould be\b/i,
  /\bmight be\b/i,
  /\bmay be\b/i,
  /\blooks like\b/i,
  /\bappears to\b/i,
  /\bpotentially\b/i,
  /\btheoretical\b/i,
  /candidate$/i, // "SSRF candidate", "IDOR candidate" — hints, not findings
];

// Concrete artifacts that prove something actually happened.
const STRONG_EVIDENCE_SIGNALS = [
  /HTTP\/\d(\.\d)?\s+\d{3}/, // raw status line
  /status[:\s]+[1-5]\d{2}\b/i, // "status: 200"
  /set-cookie:/i, // header artifacts
  /location:/i,
  /\b\d{2,5}\s?ms\b/i, // timing proof (blind injection)
  /before[:\s].{0,40}after[:\s]/is, // state-change narrative
  /balance|refund|payment|charged/i, // business-state proof
];

// Findings that demonstrate real impact on a real user.
const DEMONSTRATED_IMPACT_SIGNALS = [
  /\brce\b|remote code execution|command executed/i,
  /arbitrary file (read|write|upload|delete)/i,
  /database (dump|access|extract)/i,
  /\b(auth|authentication|authorization) bypass/i,
  /admin(istrator)? access/i,
  /session (hijack|token|fixation)/i,
  /password|secret|api[-_ ]?key (leak|expos|retriev|dump)/i,
  /\b(ssn|credit card|pan|aadhaar)\b/i,
  /\bpii\b/i,
  /stored xss/i,
  /cross[- ]account|other user'?s data/i,
  /payment|balance|refund|charged/i,
  /account takeover/i,
];

// Real but plausibly-exploitable (needs chaining or context).
const PLAUSIBLE_IMPACT_SIGNALS = [
  /blind|time[- ]based|boolean[- ]based/i,
  /reflected.{0,40}executable context/i,
  /csrf.{0,40}state[- ]changing/i,
  /open redirect.{0,40}oauth/i,
];

// Weak findings — kill fast. Real observations, but not vulnerabilities.
const WEAK_FINDING_SIGNALS = [
  /self[- ]xss/i,
  /missing (x-frame-options|csp|content-security-policy|hsts|security headers?)/i,
  /\bclickjacking\b.{0,60}no sensitive/i,
  /verbose error|stack trace/i,
];

/* ── URL helpers ─────────────────────────────────────────────── */

function parseUrl(raw, base) {
  if (!raw) return null;
  try {
    return new URL(raw, base || undefined);
  } catch {
    return null;
  }
}

function normalizeLocation(url) {
  // host + path, lowercased, no trailing slash, no default port.
  let host = url.hostname.toLowerCase();
  let path = url.pathname || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return `${host}${path}`;
}

function hostInAllowedDomains(host, allowedDomains) {
  const h = host.toLowerCase();
  return allowedDomains.some(d => {
    const domain = String(d).toLowerCase().replace(/^\*\./, '');
    return h === domain || h.endsWith(`.${domain}`);
  });
}

function pathMatches(path, patterns) {
  return (patterns || []).some(p =>
    p instanceof RegExp ? p.test(path) : String(path).startsWith(String(p))
  );
}

/* ── Individual checks ───────────────────────────────────────── */

function checkScope(finding, context) {
  const scope = context.scope;
  if (!scope || !scope.allowedDomains || scope.allowedDomains.length === 0) {
    return {
      name: 'scope',
      passed: true,
      reason: 'no scope configured — assumed in scope',
      score: 5,
    };
  }
  const url = parseUrl(finding.url, context.target);
  if (!url) {
    return { name: 'scope', passed: false, reason: 'no parseable target URL', score: 0 };
  }
  if (!hostInAllowedDomains(url.hostname, scope.allowedDomains)) {
    return {
      name: 'scope',
      passed: false,
      reason: `host "${url.hostname}" not in allowed scope`,
      score: 0,
    };
  }
  if (pathMatches(url.pathname, scope.forbiddenPaths)) {
    return {
      name: 'scope',
      passed: false,
      reason: `path "${url.pathname}" is explicitly forbidden`,
      score: 0,
    };
  }
  if (
    scope.allowedPaths &&
    scope.allowedPaths.length > 0 &&
    !pathMatches(url.pathname, scope.allowedPaths)
  ) {
    return {
      name: 'scope',
      passed: false,
      reason: `path "${url.pathname}" outside allowed paths`,
      score: 0,
    };
  }
  return { name: 'scope', passed: true, reason: 'target in scope', score: CHECK_WEIGHTS.scope };
}

function dedupeKey(finding) {
  const type = String(finding.type || 'unknown')
    .toLowerCase()
    .trim();
  const url = parseUrl(finding.url);
  const location = url ? normalizeLocation(url) : String(finding.url || 'unknown').toLowerCase();
  const param = String(finding.param || finding.parameter || '')
    .toLowerCase()
    .trim();
  return `${type}|${location}|${param}`;
}

function checkDuplicate(finding, context) {
  const existing = context.existingFindings || [];
  const key = dedupeKey(finding);
  const dup = existing.find(e => dedupeKey(e) === key);
  if (dup) {
    return {
      name: 'duplicate',
      passed: false,
      reason: `duplicate of existing finding (${key})`,
      score: 0,
    };
  }
  return {
    name: 'duplicate',
    passed: true,
    reason: 'unique finding',
    score: CHECK_WEIGHTS.duplicate,
  };
}

function checkEvidence(finding) {
  const evidence = String(finding.evidence || '').trim();
  if (evidence.length < 30) {
    return {
      name: 'evidence',
      passed: false,
      reason: `evidence too thin (${evidence.length} chars) — need concrete response artifacts`,
      score: 0,
    };
  }
  if (GENERIC_EVIDENCE_LABELS.some(p => p.test(evidence))) {
    return {
      name: 'evidence',
      passed: false,
      reason: 'evidence is a generic label, not a response artifact',
      score: 0,
    };
  }
  const strongHits = STRONG_EVIDENCE_SIGNALS.filter(p => p.test(evidence)).length;
  if (strongHits >= 1 && evidence.length >= 80) {
    return {
      name: 'evidence',
      passed: true,
      reason: `concrete artifacts captured (${strongHits} signal${strongHits > 1 ? 's' : ''})`,
      score: CHECK_WEIGHTS.evidence,
    };
  }
  return {
    name: 'evidence',
    passed: true,
    reason: 'evidence present but thin — strengthen before submission',
    score: 15,
  };
}

function checkImpact(finding) {
  const explicit = String(finding.impact || '')
    .toLowerCase()
    .trim();
  if (explicit === 'theoretical' || explicit === 'none') {
    return {
      name: 'impact',
      passed: false,
      reason: `declared impact "${explicit}" — theoretical findings do not advance`,
      score: 0,
    };
  }
  if (['critical', 'high'].includes(explicit)) {
    return {
      name: 'impact',
      passed: true,
      reason: `declared impact "${explicit}"`,
      score: CHECK_WEIGHTS.impact,
    };
  }
  if (explicit === 'medium') {
    return { name: 'impact', passed: true, reason: 'declared impact "medium"', score: 15 };
  }
  if (explicit === 'low') {
    return {
      name: 'impact',
      passed: true,
      reason: 'declared impact "low" — real but minor',
      score: 8,
    };
  }

  const haystack = `${finding.title || ''} ${finding.evidence || ''} ${finding.type || ''}`;
  if (
    WEAK_FINDING_SIGNALS.some(p => p.test(haystack)) &&
    !DEMONSTRATED_IMPACT_SIGNALS.some(p => p.test(haystack))
  ) {
    return {
      name: 'impact',
      passed: false,
      reason: 'weak finding class (hardening note / self-only) with no demonstrated impact',
      score: 0,
    };
  }
  if (
    DEMONSTRATED_IMPACT_SIGNALS.some(p => p.test(haystack)) &&
    !THEORETICAL_PHRASES.some(p => p.test(haystack))
  ) {
    return {
      name: 'impact',
      passed: true,
      reason: 'real-user impact demonstrated in evidence',
      score: CHECK_WEIGHTS.impact,
    };
  }
  if (PLAUSIBLE_IMPACT_SIGNALS.some(p => p.test(haystack))) {
    return {
      name: 'impact',
      passed: true,
      reason: 'plausible impact — exploitable with context or chaining',
      score: 15,
    };
  }
  if (
    THEORETICAL_PHRASES.some(p => p.test(haystack)) &&
    !DEMONSTRATED_IMPACT_SIGNALS.some(p => p.test(haystack))
  ) {
    return {
      name: 'impact',
      passed: false,
      reason: 'theoretical only — pattern hint without demonstrated impact',
      score: 0,
    };
  }
  return {
    name: 'impact',
    passed: true,
    reason: 'impact not disproven — manual review recommended',
    score: 12,
  };
}

function checkReproducibility(finding, context) {
  if (typeof context.reproduce === 'function') {
    try {
      const result = context.reproduce(finding);
      if (result && typeof result.then === 'function') {
        return {
          name: 'reproducibility',
          passed: true,
          deferred: true,
          reason: 'async reproduce hook — use triageFindingAsync for a verdict',
          score: 12,
        };
      }
      const reproduced = result === true || (result && result.reproduced === true);
      if (reproduced) {
        const note = result && result.note ? ` — ${result.note}` : '';
        return {
          name: 'reproducibility',
          passed: true,
          reason: `probe re-run reproduced the finding${note}`,
          score: CHECK_WEIGHTS.reproducibility,
        };
      }
      return {
        name: 'reproducibility',
        passed: false,
        reason: 're-run of the probe did NOT reproduce the finding',
        score: 0,
      };
    } catch (err) {
      return {
        name: 'reproducibility',
        passed: false,
        reason: `reproduce hook threw: ${err && err.message ? err.message : 'unknown error'}`,
        score: 0,
      };
    }
  }
  if (finding.reproduced === true) {
    return {
      name: 'reproducibility',
      passed: true,
      reason: 'reproduction already recorded (replay artifact present)',
      score: CHECK_WEIGHTS.reproducibility,
    };
  }
  const replay = finding.replay;
  if (replay && (replay.curl || replay.steps || replay.python)) {
    return {
      name: 'reproducibility',
      passed: true,
      reason: 'replay artifact present (curl/steps) — re-runnable by triager',
      score: 20,
    };
  }
  return {
    name: 'reproducibility',
    passed: true,
    deferred: true,
    reason: 'reproduction not yet attempted — route to replay pipeline',
    score: 10,
  };
}

/* ── Public API ──────────────────────────────────────────────── */

/**
 * Run the 5-check triage gate on one finding.
 * @param {object} finding
 * @param {object} context
 * @returns {{ passed: boolean, checks: Array, score: number }}
 */
export function triageFinding(finding = {}, context = {}) {
  const f = finding && typeof finding === 'object' ? finding : {};
  const ctx = context && typeof context === 'object' ? context : {};

  const checks = [
    checkScope(f, ctx),
    checkDuplicate(f, ctx),
    checkEvidence(f, ctx),
    checkImpact(f, ctx),
    checkReproducibility(f, ctx),
  ];
  const score = Math.max(
    0,
    Math.min(
      100,
      checks.reduce((n, c) => n + (c.score || 0), 0)
    )
  );
  return { passed: checks.every(c => c.passed), checks, score };
}

/**
 * Async variant: awaits an async context.reproduce hook.
 */
export async function triageFindingAsync(finding = {}, context = {}) {
  const f = finding && typeof finding === 'object' ? finding : {};
  const ctx = context && typeof context === 'object' ? context : {};

  const checks = [
    checkScope(f, ctx),
    checkDuplicate(f, ctx),
    checkEvidence(f, ctx),
    checkImpact(f, ctx),
  ];

  if (typeof ctx.reproduce === 'function') {
    try {
      const result = await ctx.reproduce(f);
      const reproduced = result === true || (result && result.reproduced === true);
      checks.push(
        reproduced
          ? {
              name: 'reproducibility',
              passed: true,
              reason: 'async re-run reproduced the finding',
              score: CHECK_WEIGHTS.reproducibility,
            }
          : {
              name: 'reproducibility',
              passed: false,
              reason: 'async re-run did NOT reproduce the finding',
              score: 0,
            }
      );
    } catch (err) {
      checks.push({
        name: 'reproducibility',
        passed: false,
        reason: `async reproduce hook threw: ${err && err.message ? err.message : 'unknown error'}`,
        score: 0,
      });
    }
  } else {
    checks.push(checkReproducibility(f, ctx));
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      checks.reduce((n, c) => n + (c.score || 0), 0)
    )
  );
  return { passed: checks.every(c => c.passed), checks, score };
}

/**
 * Triage a batch. Duplicates are detected progressively: a finding that
 * duplicates an earlier ACCEPTED finding in the same batch is rejected.
 * @returns {{ passed: object[], rejected: Array<{ finding, failedChecks }> }}
 */
export function triageBatch(findings = [], context = {}) {
  const list = Array.isArray(findings) ? findings : [];
  const ctx = context && typeof context === 'object' ? context : {};
  const passed = [];
  const rejected = [];
  const seen = [...(ctx.existingFindings || [])];

  for (const finding of list) {
    const result = triageFinding(finding, { ...ctx, existingFindings: seen });
    if (result.passed) {
      passed.push(finding);
      seen.push(finding);
    } else {
      rejected.push({ finding, failedChecks: result.checks.filter(c => !c.passed) });
    }
  }
  return { passed, rejected };
}

/**
 * Async batch variant.
 */
export async function triageBatchAsync(findings = [], context = {}) {
  const list = Array.isArray(findings) ? findings : [];
  const ctx = context && typeof context === 'object' ? context : {};
  const passed = [];
  const rejected = [];
  const seen = [...(ctx.existingFindings || [])];

  for (const finding of list) {
    const result = await triageFindingAsync(finding, { ...ctx, existingFindings: seen });
    if (result.passed) {
      passed.push(finding);
      seen.push(finding);
    } else {
      rejected.push({ finding, failedChecks: result.checks.filter(c => !c.passed) });
    }
  }
  return { passed, rejected };
}

export const TRIAGE_GATE = {
  triageFinding,
  triageFindingAsync,
  triageBatch,
  triageBatchAsync,
  CHECK_WEIGHTS,
};
export default TRIAGE_GATE;
