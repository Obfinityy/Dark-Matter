/**
 * wave72BCores.js — post-hunt Q&A round 3 (ideas 52861–52880).
 *
 * Pure logic for payment-flow risk filtering, real-world
 * exploitability ranking, agent learning recaps, reasoning-trace
 * browsing, devil's-advocate challenges, fix-option trade-offs,
 * cheapest mitigations, disclosure timelines, fix-owner picks,
 * scope eligibility, plain-language rewrites, exec slides,
 * remediation PR descriptions, detection and WAF suggestions,
 * chain membership, CVSS vector decoding, voice answers with an
 * avatar, evidence-cited answers, and per-hunt Q&A history. Every
 * helper takes explicit inputs, never mutates them, and returns
 * structured view models.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE72_B_IDEAS = [
  { id: 52861, title: 'Payment-flow risk Q&A', skip: false },
  { id: 52862, title: 'Real-world exploitability ranking', skip: false },
  { id: 52863, title: 'Agent learning recap', skip: false },
  { id: 52864, title: 'Reasoning-trace browser', skip: false },
  { id: 52865, title: 'Devil\'s-advocate challenge', skip: false },
  { id: 52866, title: 'Fix-option comparison', skip: false },
  { id: 52867, title: 'Cheapest-fix finder', skip: false },
  { id: 52868, title: 'Disclosure-timeline drafting', skip: false },
  { id: 52869, title: 'Fix-owner recommendation', skip: false },
  { id: 52870, title: 'Scope-eligibility check', skip: false },
  { id: 52871, title: 'Non-technical rewrite', skip: false },
  { id: 52872, title: 'Exec-slide generation', skip: false },
  { id: 52873, title: 'PR-description drafting', skip: false },
  { id: 52874, title: 'Detection-suggestion Q&A', skip: false },
  { id: 52875, title: 'WAF-rule suggestion', skip: false },
  { id: 52876, title: 'Chain-membership Q&A', skip: false },
  { id: 52877, title: 'CVSS vector breakdown', skip: false },
  { id: 52878, title: 'Voice Q&A with avatar', skip: false },
  { id: 52879, title: 'Evidence-cited answers', skip: false },
  { id: 52880, title: 'Q&A history per hunt', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SEVERITY_LADDER = ['info', 'low', 'medium', 'high', 'critical'];
const TERMINAL_STATES = ['closed', 'dismissed', 'duplicate'];
const FIX_DAYS_BY_SEVERITY = {
  critical: 7, high: 14, medium: 30, low: 60, info: 90,
};
const PAYMENT_SIGNALS = [
  { term: 'payment', points: 12 }, { term: 'checkout', points: 12 },
  { term: 'stripe', points: 10 }, { term: 'billing', points: 9 },
  { term: 'payout', points: 9 }, { term: 'refund', points: 8 },
  { term: 'chargeback', points: 8 }, { term: 'transaction', points: 7 },
  { term: 'invoice', points: 7 }, { term: 'wallet', points: 7 },
  { term: 'cart', points: 6 }, { term: 'price', points: 5 },
  { term: 'order', points: 5 }, { term: 'bank', points: 5 },
  { term: 'card', points: 4 },
];
const CWE_FIX_GUIDANCE = {
  'cwe-89': {
    weakness: 'SQL injection',
    fix: 'Use parameterized queries or a safe query builder for every '
      + 'database call; never concatenate input into SQL.',
    verification: 'Replay the original payloads and confirm no error-based '
      + 'or time-based behaviour remains.',
  },
  'cwe-79': {
    weakness: 'Cross-site scripting',
    fix: 'Encode output by context (HTML, attribute, JavaScript, URL) '
      + 'and add a strict content security policy.',
    verification: 'Replay stored and reflected payloads and confirm they '
      + 'render as inert text.',
  },
  'cwe-862': {
    weakness: 'Missing authorization',
    fix: 'Enforce server-side authorization checks on every protected '
      + 'object and action.',
    verification: 'Repeat the requests with a low-privilege account and '
      + 'confirm access is denied.',
  },
  'cwe-863': {
    weakness: 'Incorrect authorization',
    fix: 'Centralize authorization decisions and test every role '
      + 'against every protected route.',
    verification: 'Run the role matrix again and confirm only intended '
      + 'roles succeed.',
  },
  'cwe-639': {
    weakness: 'Authorization bypass through user-controlled key',
    fix: 'Never trust client-supplied object identifiers; resolve '
      + 'ownership server-side on every read and write.',
    verification: 'Swap identifiers between two test accounts and '
      + 'confirm cross-account access is denied.',
  },
  'cwe-352': {
    weakness: 'Cross-site request forgery',
    fix: 'Require unpredictable anti-CSRF tokens on state-changing '
      + 'requests and verify origin headers.',
    verification: 'Submit the forged request again and confirm it is '
      + 'rejected.',
  },
  'cwe-22': {
    weakness: 'Path traversal',
    fix: 'Canonicalize paths and enforce an allow-list of files or '
      + 'directories that may be served.',
    verification: 'Replay traversal sequences and confirm they cannot '
      + 'escape the allowed root.',
  },
  'cwe-918': {
    weakness: 'Server-side request forgery',
    fix: 'Allow-list outbound destinations, block private address '
      + 'ranges, and disable redirect following to internal hosts.',
    verification: 'Repeat the internal-address requests and confirm '
      + 'they are blocked.',
  },
};
const GENERIC_GUIDANCE = {
  weakness: 'Security weakness',
  fix: 'Identify the root cause in code, apply the smallest correct '
    + 'fix, and add a regression test for the reported behaviour.',
  verification: 'Replay the original proof of concept and confirm the '
    + 'behaviour is gone.',
};
const FIX_BASE_HOURS = {
  'cwe-89': 10, 'cwe-79': 8, 'cwe-862': 14, 'cwe-863': 14,
  'cwe-639': 12, 'cwe-352': 6, 'cwe-22': 8, 'cwe-918': 10,
};
const CWE_PLAIN = {
  'cwe-89': {
    weakness: 'a database trick',
    action: 'trick the database into revealing stored information',
  },
  'cwe-79': {
    weakness: 'a malicious script',
    action: 'run a harmful script in another visitor browser session',
  },
  'cwe-862': {
    weakness: 'a missing permission check',
    action: 'open records without proving they own them',
  },
  'cwe-863': {
    weakness: 'a wrong permission check',
    action: 'reach areas reserved for other roles',
  },
  'cwe-639': {
    weakness: 'a record mix-up',
    action: 'view or change another customer record by guessing its number',
  },
  'cwe-352': {
    weakness: 'a forged request',
    action: 'make a signed-in browser send an unintended request',
  },
  'cwe-22': {
    weakness: 'a file-path trick',
    action: 'read files outside the folder the site meant to share',
  },
  'cwe-918': {
    weakness: 'a server trick',
    action: 'make the server contact internal systems for them',
  },
};
const SEVERITY_PLAIN = {
  critical: 'very serious, fix before anything else',
  high: 'serious, schedule the fix this cycle',
  medium: 'moderate, plan the fix soon',
  low: 'minor, fix during routine maintenance',
  info: 'informational, no immediate action needed',
};
const CVSS_DECODE = {
  AV: {
    name: 'Attack vector',
    labels: {
      N: 'over the network from anywhere',
      A: 'from a nearby network',
      L: 'with local access to the device',
      P: 'with physical access to the device',
    },
  },
  AC: {
    name: 'Attack complexity',
    labels: {
      L: 'easy to repeat reliably',
      H: 'hard and dependent on outside conditions',
    },
  },
  PR: {
    name: 'Privileges required',
    labels: {
      N: 'no account or login needed',
      L: 'a basic signed-in account',
      H: 'an administrator-level account',
    },
  },
  UI: {
    name: 'User interaction',
    labels: {
      N: 'no victim action needed',
      R: 'a victim must click or open something',
    },
  },
  S: {
    name: 'Scope',
    labels: {
      U: 'damage stays inside the vulnerable part',
      C: 'damage spreads beyond the vulnerable part',
    },
  },
  C: {
    name: 'Confidentiality impact',
    labels: {
      N: 'no information is revealed',
      L: 'some information is revealed',
      H: 'all protected information can be revealed',
    },
  },
  I: {
    name: 'Integrity impact',
    labels: {
      N: 'no data can be changed',
      L: 'some data can be changed',
      H: 'data can be changed completely',
    },
  },
  A: {
    name: 'Availability impact',
    labels: {
      N: 'the service keeps running',
      L: 'the service slows or partly stops',
      H: 'the service can be stopped completely',
    },
  },
};
const DETECTION_TEMPLATES = {
  'cwe-89': [
    {
      name: 'Database error spike', logSource: 'application logs',
      query: 'event:"db_error" target:"{host}" count by source_ip',
    },
    {
      name: 'Injection pattern in requests', logSource: 'web access logs',
      query: 'uri_path:"{path}" query has union or select keywords',
    },
  ],
  'cwe-79': [
    {
      name: 'Script markup in input', logSource: 'web access logs',
      query: 'uri_path:"{path}" input has script tags or handlers',
    },
    {
      name: 'Policy violation reports', logSource: 'browser CSP reports',
      query: 'event:"csp_violation" target:"{host}" count by blocked_uri',
    },
  ],
  'cwe-862': [
    {
      name: 'Cross-account object access',
      logSource: 'application audit logs',
      query: 'event:"object_read" target:"{host}" owner differs from actor',
    },
    {
      name: 'Denied then allowed sequence',
      logSource: 'application audit logs',
      query: 'event:"access_denied" target:"{host}" count by actor',
    },
  ],
  'cwe-639': [
    {
      name: 'Identifier enumeration sweep', logSource: 'web access logs',
      query: 'uri_path:"{path}" distinct object ids by source_ip',
    },
    {
      name: 'Cross-account object access',
      logSource: 'application audit logs',
      query: 'event:"object_read" target:"{host}" owner differs from actor',
    },
  ],
};
const GENERIC_DETECTIONS = [
  {
    name: 'Edge rule matches', logSource: 'edge firewall logs',
    query: 'event:"waf_match" target:"{host}" count by rule_id',
  },
  {
    name: 'Repeated failed requests', logSource: 'web access logs',
    query: 'uri_path:"{path}" error status count by source_ip',
  },
];
const WAF_TEMPLATES = {
  'cwe-89': {
    target: 'ARGS',
    pattern: '(?i)(union[[:space:]]+select|or[[:space:]]+1=1)',
    label: 'SQL injection keywords',
  },
  'cwe-79': {
    target: 'ARGS',
    pattern: '(?i)(<script|onerror[[:space:]]*=|javascript:)',
    label: 'script markup in input',
  },
  'cwe-862': {
    target: 'REQUEST_URI',
    pattern: '/(admin|internal|manage)(/|$)',
    label: 'restricted area without a session gate',
  },
  'cwe-639': {
    target: 'REQUEST_URI',
    pattern: '/(invoice|order|account)/[0-9]+',
    label: 'direct object reference by number',
  },
  'cwe-22': {
    target: 'REQUEST_URI',
    pattern: '(\\.\\./|%2e%2e%2f|%2e%2e/)',
    label: 'path traversal sequence',
  },
  'cwe-918': {
    target: 'ARGS',
    pattern: '(?i)(169\\.254\\.|192\\.168\\.|localhost|127\\.0\\.0\\.1)',
    label: 'internal address in a URL parameter',
  },
};
const GENERIC_WAF = {
  target: 'REQUEST_URI',
  pattern: '(?i)(\\.\\./|<script|union[[:space:]]+select)',
  label: 'common attack pattern',
};
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'is', 'was',
  'with', 'by', 'for', 'this', 'that', 'it', 'as', 'at', 'from',
]);
const VOICE_BY_GENDER = { female: 'aria', male: 'kai' };

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

function sevKey(f) {
  return String((f && f.severity) || 'info').toLowerCase();
}

function riskOf(f) {
  const cvssPart = f && f.cvss && f.cvss.score != null
    ? f.cvss.score * 10 : NaN;
  const n = Number((f && (f.riskScore ?? cvssPart)));
  return Number.isFinite(n) ? n : severityRank(sevKey(f)) * 25;
}

function cweKey(f) {
  const raw = String((f && (f.cwe || f.cweId)) || '').toLowerCase();
  const match = raw.match(/cwe-\d+/);
  return match ? match[0] : raw;
}

function shortHash(text) {
  let hash = 0;
  const raw = String(text);
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function hostOf(value) {
  const match = String(value || '').match(/^(?:[a-z]+:\/\/)?([^/:?#]+)/i);
  return match ? match[1].toLowerCase() : '';
}

function pathOf(value) {
  const match = String(value || '').match(/^(?:[a-z]+:\/\/)?[^/]+(\/[^?#]*)?/i);
  return match && match[1] ? match[1] : '/';
}

function parseMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? null : ms;
}

function addDaysIso(iso, days) {
  const ms = parseMs(iso);
  if (ms === null) return null;
  return new Date(ms + days * 86400000).toISOString();
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function evidenceItems(finding) {
  const list = (finding && finding.evidence) || [];
  return list.map((e, i) => {
    if (typeof e === 'string') {
      return { id: `ev-${i + 1}`, text: e, source: (finding && finding.id) || null };
    }
    const text = (e && (e.text || e.note)) || '';
    return {
      id: (e && e.id) || `ev-${i + 1}`,
      text: String(text),
      source: (e && e.source) || (finding && finding.id) || null,
    };
  });
}

function tokenSet(text) {
  const out = new Set();
  for (const tok of String(text || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length > 2 && !STOPWORDS.has(tok)) out.add(tok);
  }
  return out;
}

function overlapCount(a, b) {
  let n = 0;
  for (const tok of a) if (b.has(tok)) n += 1;
  return n;
}

function stateOf(f) {
  return String((f && (f.status || f.state)) || 'new').toLowerCase().trim();
}

/**
 * Keep only the findings that touch money movement (idea 52861).
 * Title, target, impact, and tags are scored against weighted
 * payment signals; findings at or above the threshold answer the
 * question "which findings affect payments?" with their exposure.
 * @param {Array} findings - Hunt findings to filter.
 * @param {object} [options] - { threshold } minimum payment score.
 * @returns {object} { paymentFindings, count, total, excludedIds,
 *   exposure, answer }.
 */
export function filterPaymentFindings(findings = [], options = {}) {
  const threshold = Number(options.threshold ?? 10);
  const scored = (findings || []).map(f => {
    const hay = `${f.title || ''} ${f.target || ''} ${f.impact || ''}`
      + ` ${(f.tags || []).join(' ')}`.toLowerCase();
    let paymentScore = 0;
    const signals = [];
    for (const signal of PAYMENT_SIGNALS) {
      if (hay.includes(signal.term)) {
        paymentScore += signal.points;
        signals.push(signal.term);
      }
    }
    return { finding: f, paymentScore, signals };
  });
  const kept = scored.filter(x => x.paymentScore >= threshold);
  kept.sort((a, b) => b.paymentScore - a.paymentScore
    || riskOf(b.finding) - riskOf(a.finding));
  const paymentFindings = kept.map(x => ({
    id: x.finding.id,
    title: x.finding.title || null,
    severity: sevKey(x.finding),
    target: x.finding.target || null,
    paymentScore: x.paymentScore,
    signals: x.signals,
    riskScore: riskOf(x.finding),
  }));
  const excludedIds = scored
    .filter(x => x.paymentScore < threshold)
    .map(x => x.finding.id);
  const exposure = paymentFindings.reduce((sum, x) => sum + x.riskScore, 0);
  const answer = paymentFindings.length
    ? `Infinity AI: ${paymentFindings.length} of ${(findings || []).length} `
      + `findings touch payment flows (combined risk ${exposure}); `
      + `strongest signal is ${paymentFindings[0].id} `
      + `(${paymentFindings[0].signals.join(', ')}).`
    : `Infinity AI: none of the ${(findings || []).length} findings touch `
      + 'payment flows.';
  return {
    paymentFindings, count: paymentFindings.length,
    total: (findings || []).length, excludedIds, exposure, answer,
  };
}

/**
 * Reorder findings by how exploitable they are in the real world
 * (idea 52862). Severity is only the base: network reach, low
 * complexity, no privileges, no victim action, a recorded public
 * exploit, and solid evidence each move the score beyond CVSS.
 * @param {Array} findings - Findings to rank.
 * @param {object} [options] - Reserved for hunt context.
 * @returns {object} { ranked, topId, count } where ranked copies
 *   carry exploitabilityScore, exploitabilityTier, and factors.
 */
export function rankByExploitability(findings = [], options = {}) {
  const ranked = (findings || []).map(f => {
    const vector = String((f.cvss && f.cvss.vector) || '').toUpperCase();
    const factors = [];
    let score = severityRank(sevKey(f)) * 12;
    factors.push({
      factor: 'severity-base', points: severityRank(sevKey(f)) * 12,
      detail: `Recorded severity is ${sevKey(f)}.`,
    });
    const add = (factor, points, detail) => {
      score += points;
      factors.push({ factor, points, detail });
    };
    if (f.cvss && f.cvss.score != null) {
      add('cvss-score', Math.round(Number(f.cvss.score)),
        `CVSS base score is ${f.cvss.score}.`);
    }
    if (vector.includes('AV:N')) {
      add('network-reachable', 12, 'Reachable over the network (AV:N).');
    }
    if (vector.includes('AC:L')) {
      add('low-complexity', 8, 'Attack complexity is low (AC:L).');
    }
    const authFree = f.authRequired === false || vector.includes('PR:N');
    if (authFree) {
      add('no-privileges', 12, 'No login or privileges needed.');
    } else if (f.authRequired === true) {
      add('login-required', -8, 'A signed-in account is required first.');
    }
    if (vector.includes('UI:N')) {
      add('no-interaction', 6, 'No victim click is needed (UI:N).');
    }
    if (f.exploitAvailable || f.publicExploit) {
      add('public-exploit', 18, 'A working exploit is already recorded.');
    }
    if (((f.evidence) || []).length >= 2) {
      add('solid-evidence', 6, 'Multiple evidence items support it.');
    }
    if (f.verifiedBy || ['verified', 'closed'].includes(stateOf(f))) {
      add('independently-verified', 4, 'Independently verified.');
    }
    const finalScore = clampScore(score);
    const tier = finalScore >= 75 ? 'readily-exploitable'
      : finalScore >= 50 ? 'exploitable'
        : finalScore >= 30 ? 'conditional' : 'theoretical';
    return { ...f, exploitabilityScore: finalScore, exploitabilityTier: tier, factors };
  });
  ranked.sort((a, b) => b.exploitabilityScore - a.exploitabilityScore
    || riskOf(b) - riskOf(a) || String(a.id).localeCompare(String(b.id)));
  return {
    ranked, topId: ranked.length ? ranked[0].id : null,
    count: ranked.length,
    method: 'severity, reachability, privileges, interaction, '
      + 'public exploit, and evidence',
  };
}

/**
 * Recap what the agent learned during a hunt (idea 52863). Recorded
 * learnings are grouped by technology with their confidence; when a
 * hunt recorded none, observed weakness patterns are derived from
 * its findings so the recap still reflects the hunt itself.
 * @param {object} hunt - { huntId, learnings, findings }.
 * @param {object} [options] - { minConfidence } filter.
 * @returns {object} { huntId, patterns, patternCount, byTech,
 *   source, summary }.
 */
export function summarizeAgentLearnings(hunt = {}, options = {}) {
  const minConfidence = Number(options.minConfidence ?? 0);
  const recorded = ((hunt && hunt.learnings) || []).map(l => ({
    pattern: String((l && l.pattern) || 'observed pattern'),
    tech: String((l && (l.tech || l.techStack)) || 'general').toLowerCase(),
    confidence: Number((l && l.confidence) ?? 70),
    example: (l && (l.example || l.findingId)) || null,
    recordedAt: (l && l.recordedAt) || null,
  }));
  const usable = recorded.filter(l => l.confidence >= minConfidence);
  let patterns = usable;
  let source = 'recorded';
  if (!patterns.length) {
    source = 'derived-from-findings';
    const byPattern = new Map();
    for (const f of ((hunt && hunt.findings) || [])) {
      const cwe = cweKey(f);
      const guide = CWE_FIX_GUIDANCE[cwe] || GENERIC_GUIDANCE;
      const key = `${guide.weakness} on ${hostOf(f.target || '') || 'target'}`;
      const entry = byPattern.get(key) || {
        pattern: key, tech: hostOf(f.target || '') || 'general',
        confidence: 60, example: f.id, recordedAt: null, count: 0,
      };
      entry.count += 1;
      byPattern.set(key, entry);
    }
    patterns = [...byPattern.values()];
  }
  const withCounts = patterns.map(p => ({ count: 1, ...p }));
  const byTech = {};
  for (const p of withCounts) byTech[p.tech] = (byTech[p.tech] || 0) + 1;
  return {
    huntId: (hunt && hunt.huntId) || null,
    patterns: withCounts, patternCount: withCounts.length, byTech, source,
    summary: `Infinity AI recorded ${withCounts.length} learning `
      + `pattern(s) for this hunt across `
      + `${Object.keys(byTech).length} technology area(s).`,
  };
}

/**
 * Browse the decision trail behind one finding (idea 52864). A
 * recorded trace is normalized step by step; when no trace was
 * stored, the trail is reconstructed from proof steps, evidence,
 * and history so the reviewer still sees how it was found.
 * @param {object} finding - Finding with trace or proof fields.
 * @param {object} [options] - { query } keyword filter.
 * @returns {object} { findingId, steps, stepCount, totalSteps,
 *   source, keyDecisions, summary }.
 */
export function browseReasoningTrace(finding = {}, options = {}) {
  const recorded = finding.reasoningTrace || finding.trace
    || finding.decisionTrail || [];
  let steps = [];
  let source = 'recorded';
  if (recorded.length) {
    steps = recorded.map((s, i) => ({
      step: i + 1,
      action: String((s && (s.action || s.step)) || 'agent step'),
      observation: String((s && (s.observation || s.evidence)) || ''),
      decision: String((s && (s.decision || s.conclusion)) || ''),
      at: (s && s.at) || null,
    }));
  } else {
    source = 'reconstructed';
    const evidence = evidenceItems(finding);
    const proof = (finding.pocSteps || []).map(s => String(s));
    proof.forEach((text, i) => {
      steps.push({
        step: steps.length + 1, action: text,
        observation: evidence[i] ? evidence[i].text : '',
        decision: i === proof.length - 1
          ? 'Behaviour matched the reported weakness.' : '',
        at: null,
      });
    });
    for (const item of evidence.slice(proof.length)) {
      steps.push({
        step: steps.length + 1, action: 'Record supporting evidence',
        observation: item.text, decision: '', at: null,
      });
    }
    for (const h of ((finding.history) || [])) {
      steps.push({
        step: steps.length + 1,
        action: `State moved ${h.from || 'unknown'} to ${h.to || 'unknown'}`,
        observation: String(h.reason || ''),
        decision: h.actor ? `Confirmed by ${h.actor}.` : '',
        at: h.at || null,
      });
    }
    if (!steps.length) {
      steps.push({
        step: 1, action: `Reviewed finding ${finding.id || 'unknown'}`,
        observation: String(finding.title || 'No steps recorded yet.'),
        decision: '', at: finding.createdAt || null,
      });
    }
  }
  const totalSteps = steps.length;
  const query = String(options.query || '').toLowerCase().trim();
  const visible = query
    ? steps.filter(s => `${s.action} ${s.observation} ${s.decision}`
      .toLowerCase().includes(query))
    : steps;
  const keyDecisions = steps.filter(s => s.decision)
    .map(s => ({ step: s.step, decision: s.decision }));
  return {
    findingId: finding.id || null, steps: visible,
    stepCount: visible.length, totalSteps, source, keyDecisions,
    summary: `Infinity AI trail for ${finding.id || 'this finding'}: `
      + `${totalSteps} step(s), source ${source}.`,
  };
}

/**
 * Argue against a finding before anyone else does (idea 52865).
 * Thin evidence, a missing proof, no independent check, a vague
 * impact claim, and privilege preconditions each become a named
 * challenge with a strength, scored into a false-positive risk.
 * @param {object} finding - Finding to challenge.
 * @param {object} [options] - Reserved for reviewer context.
 * @returns {object} { findingId, challenges, challengeCount,
 *   strongestChallenge, falsePositiveRisk, verdict, summary }.
 */
export function challengeFinding(finding = {}, options = {}) {
  const challenges = [];
  const evidence = (finding.evidence || []);
  const hasProof = Boolean((finding.pocSteps || []).length)
    || (finding.reproductionSteps || []).length > 0;
  const add = (check, argument, strength) => {
    challenges.push({ check, argument, strength });
  };
  if (evidence.length < 2) {
    add('thin-evidence',
      `Only ${evidence.length} evidence item(s) support this finding; `
      + 'one observation can be a recording error.', 'strong');
  }
  if (!hasProof) {
    add('missing-proof',
      'No replayable proof is recorded, so nobody can re-run the '
      + 'exact behaviour that was reported.', 'strong');
  }
  if (!finding.verifiedBy && !['verified', 'closed'].includes(stateOf(finding))) {
    add('no-independent-check',
      'No second verifier has reproduced this; a single observation '
      + 'carries the whole claim.', 'moderate');
  }
  const impact = String(finding.impact || '');
  if (impact.length < 20 || !/data|account|payment|session|access|file/i.test(impact)) {
    add('vague-impact',
      'The stated impact does not name the data, account, or service '
      + 'an attacker actually gains.', 'moderate');
  }
  const vector = String((finding.cvss && finding.cvss.vector) || '').toUpperCase();
  if (finding.authRequired === true || vector.includes('PR:L') || vector.includes('PR:H')) {
    add('privilege-precondition',
      'Exploitation first needs a signed-in account, which shrinks '
      + 'the real attacker pool.', 'weak');
  }
  if (String(finding.title || '').toLowerCase().includes('without auth')
    && finding.authRequired === true) {
    add('claim-mismatch',
      'The title claims no authentication is needed, yet the record '
      + 'says a login is required.', 'strong');
  }
  const proofScore = (evidence.length >= 2 ? 30 : evidence.length * 15)
    + (hasProof ? 30 : 0)
    + ((finding.verifiedBy || ['verified', 'closed'].includes(stateOf(finding)))
      ? 25 : 0)
    + (impact.length >= 20 ? 15 : 5);
  const falsePositiveRisk = clampScore(100 - proofScore);
  const strengthRank = { strong: 3, moderate: 2, weak: 1 };
  const strongest = challenges.reduce((best, c) => (
    !best || strengthRank[c.strength] > strengthRank[best.strength] ? c : best
  ), null);
  const verdict = falsePositiveRisk >= 60 ? 'likely-false-positive'
    : falsePositiveRisk >= 35 ? 'needs-more-proof' : 'likely-valid';
  return {
    findingId: finding.id || null, challenges,
    challengeCount: challenges.length,
    strongestChallenge: strongest ? strongest.check : null,
    falsePositiveRisk, verdict,
    summary: `Infinity AI devil's-advocate review: ${challenges.length} `
      + `challenge(s), false-positive risk ${falsePositiveRisk}/100, `
      + `verdict ${verdict}.`,
  };
}

/**
 * Lay out three ways to fix one finding (idea 52866). A fast edge
 * containment, a targeted code fix, and a systemic hardening pass
 * are costed from the weakness base effort and scored for effort,
 * residual risk, and completeness so the trade-off is explicit.
 * @param {object} finding - Finding to fix.
 * @param {object} [options] - { teamHoursPerDay } reserved.
 * @returns {object} { findingId, cwe, weakness, options,
 *   recommendedId, summary }.
 */
export function compareFixOptions(finding = {}, options = {}) {
  const cwe = cweKey(finding);
  const guide = CWE_FIX_GUIDANCE[cwe] || GENERIC_GUIDANCE;
  const base = FIX_BASE_HOURS[cwe] || 10;
  const sev = sevKey(finding);
  const fixOptions = [
    {
      id: 'quick-containment', name: 'Quick containment',
      approach: `Block the reported pattern at the edge for `
        + `${guide.weakness.toLowerCase()} while the code fix is built.`,
      effortHours: Math.max(1, Math.ceil(base * 0.3)),
      completeness: 45, residualRisk: 'high',
      tradeOff: 'Fastest relief; the root cause stays in the code.',
    },
    {
      id: 'targeted-fix', name: 'Targeted code fix',
      approach: guide.fix,
      effortHours: base, completeness: 90, residualRisk: 'low',
      tradeOff: 'Removes the root cause on the reported route.',
    },
    {
      id: 'systemic-fix', name: 'Systemic hardening',
      approach: `${guide.fix} Then sweep sibling routes and add `
        + 'regression coverage for the whole pattern.',
      effortHours: base * 3, completeness: 100, residualRisk: 'minimal',
      tradeOff: 'Slowest; prevents the same weakness returning nearby.',
    },
  ];
  const wantsFullCoverage = Number(options.minCompleteness || 0) >= 100;
  const recommendedId = wantsFullCoverage || sev === 'critical'
    ? 'systemic-fix' : 'targeted-fix';
  const recommended = fixOptions.find(o => o.id === recommendedId);
  return {
    findingId: finding.id || null,
    cwe: cwe ? cwe.toUpperCase() : 'UNSPECIFIED',
    weakness: guide.weakness, options: fixOptions, recommendedId,
    summary: `Infinity AI compared 3 fix options for `
      + `${finding.id || 'the finding'}; recommended ${recommendedId} `
      + `at ${recommended.effortHours} hour(s) with retest: `
      + `${guide.verification}`,
  };
}

/**
 * Name the single fastest mitigation for a finding (idea 52867).
 * The cheapest credible containment is picked for the weakness,
 * costed in hours, and paired with its limits plus the permanent
 * fix that must still follow.
 * @param {object} finding - Finding needing containment.
 * @param {object} [options] - { edgeAvailable } edge control present.
 * @returns {object} { findingId, mitigation, steps, limitations,
 *   permanentFix, summary }.
 */
export function findCheapestFix(finding = {}, options = {}) {
  const cwe = cweKey(finding);
  const guide = CWE_FIX_GUIDANCE[cwe] || GENERIC_GUIDANCE;
  const edge = options.edgeAvailable !== false;
  const byCwe = {
    'cwe-89': {
      action: 'Reject requests carrying database keywords in the '
        + 'vulnerable parameter at the edge.',
      kind: 'edge-rule', effortHours: 2,
    },
    'cwe-79': {
      action: 'Strip script markup from the reflected field at the '
        + 'edge and serve a strict content security policy.',
      kind: 'edge-rule', effortHours: 2,
    },
    'cwe-862': {
      action: 'Gate the affected route behind a session and role '
        + 'check at the gateway.',
      kind: 'gateway-gate', effortHours: 3,
    },
    'cwe-639': {
      action: 'Gate record routes behind a session and role check '
        + 'at the gateway until ownership checks ship.',
      kind: 'gateway-gate', effortHours: 3,
    },
  };
  const picked = byCwe[cwe] || {
    action: edge
      ? 'Gate the affected route at the edge until the code fix ships.'
      : 'Disable the affected feature flag until the code fix ships.',
    kind: edge ? 'gateway-gate' : 'feature-flag', effortHours: 3,
  };
  const steps = [
    `Apply the containment: ${picked.action}`,
    'Replay the recorded proof of concept and confirm it is blocked.',
    'Watch edge and application logs for blocked attempts for 24 hours.',
    `Schedule the permanent fix: ${guide.fix}`,
  ];
  const limitations = [
    'Containment reduces exposure; it does not remove the root cause.',
    'Determined attackers may find a route the containment misses.',
    `Retest stays mandatory: ${guide.verification}`,
  ];
  return {
    findingId: finding.id || null,
    mitigation: { ...picked, target: finding.target || null },
    steps, limitations, permanentFix: guide.fix,
    summary: `Infinity AI cheapest mitigation for `
      + `${finding.id || 'the finding'}: ${picked.effortHours} hour(s), `
      + `kind ${picked.kind}.`,
  };
}

/**
 * Draft a coordinated disclosure timeline (idea 52868). Acknowledgement,
 * fix, verification, and public disclosure dates derive from the
 * discovery date, the severity fix window, and the program policy
 * buffer, so the draft can be pasted into a report as-is.
 * @param {object} finding - Finding with createdAt and severity.
 * @param {object} [policy] - { ackDays, verifyDays, bufferDays }.
 * @param {object} [options] - { fixEstimateDays, discoveredAt }.
 * @returns {object} { findingId, milestones, disclosureDate,
 *   totalDays, policyUsed, summary }.
 */
export function draftDisclosureTimeline(finding = {}, policy = {}, options = {}) {
  const sev = sevKey(finding);
  const ackDays = Number(policy.ackDays ?? 3);
  const verifyDays = Number(policy.verifyDays ?? 3);
  const bufferDays = Number(policy.bufferDays ?? 7);
  const fixDays = Number(
    finding.fixEstimateDays ?? options.fixEstimateDays
      ?? FIX_DAYS_BY_SEVERITY[sev] ?? 30,
  );
  const start = finding.createdAt || options.discoveredAt || null;
  const milestones = [
    {
      name: 'Finding discovered',
      date: start,
      description: `Infinity AI recorded ${finding.id || 'the finding'} `
        + `on ${finding.target || 'the target'}.`,
    },
    {
      name: 'Vendor acknowledgement due',
      date: addDaysIso(start, ackDays),
      description: `Program acknowledges the report within ${ackDays} day(s).`,
    },
    {
      name: 'Fix ready for retest',
      date: addDaysIso(start, fixDays),
      description: `Fix window for ${sev} severity is ${fixDays} day(s).`,
    },
    {
      name: 'Fix verified',
      date: addDaysIso(start, fixDays + verifyDays),
      description: 'Original proof is replayed and the fix confirmed.',
    },
    {
      name: 'Coordinated public disclosure',
      date: addDaysIso(start, fixDays + verifyDays + bufferDays),
      description: `Details publish ${bufferDays} day(s) after verification.`,
    },
  ];
  const totalDays = fixDays + verifyDays + bufferDays;
  return {
    findingId: finding.id || null, milestones,
    disclosureDate: milestones[milestones.length - 1].date,
    totalDays,
    policyUsed: { ackDays, fixDays, verifyDays, bufferDays },
    summary: `Infinity AI disclosure draft for ${finding.id || 'the finding'}: `
      + `${totalDays} day(s) from discovery to public disclosure.`,
  };
}

/**
 * Recommend who should own a fix (idea 52869). Assets are scored by
 * host match, shared services, and recorded expertise for the
 * weakness; the best owner wins with the runners-up kept for review.
 * @param {object} finding - Finding needing an owner.
 * @param {Array} assets - [{ id, host, owner, team, expertise,
 *   sharedServices }].
 * @param {object} [options] - Reserved for routing rules.
 * @returns {object} { findingId, recommended, alternatives,
 *   candidateCount, summary }.
 */
export function recommendFixOwner(finding = {}, assets = [], options = {}) {
  const cwe = cweKey(finding);
  const targetHost = hostOf(finding.target || finding.asset || '');
  const services = new Set(
    ((finding.sharedServices) || []).map(s => String(s).toLowerCase()),
  );
  const tags = new Set(((finding.tags) || []).map(t => String(t).toLowerCase()));
  const scored = (assets || []).map(a => {
    const rationale = [];
    let score = 0;
    const assetHost = hostOf(a.host || a.id || '');
    if (targetHost && assetHost && targetHost === assetHost) {
      score += 45;
      rationale.push(`Owns the target host ${assetHost}.`);
    }
    const shared = ((a.sharedServices) || [])
      .filter(s => services.has(String(s).toLowerCase()));
    if (shared.length) {
      score += Math.min(30, shared.length * 15);
      rationale.push(`Shares service(s): ${shared.join(', ')}.`);
    }
    const expertise = ((a.expertise) || []).map(s => String(s).toLowerCase());
    if (cwe && expertise.includes(cwe)) {
      score += 25;
      rationale.push(`Recorded expertise for ${cwe.toUpperCase()}.`);
    }
    for (const tag of tags) {
      if (expertise.includes(tag)) {
        score += 5;
        rationale.push(`Recorded expertise for ${tag}.`);
      }
    }
    return {
      assetId: a.id || a.host || null,
      owner: a.owner || null, team: a.team || null,
      score, rationale,
    };
  });
  scored.sort((a, b) => b.score - a.score
    || String(a.owner || '').localeCompare(String(b.owner || '')));
  const recommended = scored.length && scored[0].score > 0 ? scored[0] : null;
  return {
    findingId: finding.id || null, recommended,
    alternatives: scored.slice(1, 3), candidateCount: scored.length,
    summary: recommended
      ? `Infinity AI recommends ${recommended.owner || 'the asset owner'} `
        + `(${recommended.team || 'team unknown'}) for `
        + `${finding.id || 'the finding'} with score ${recommended.score}.`
      : `Infinity AI found no confident owner for `
        + `${finding.id || 'the finding'}; route it to triage.`,
  };
}

/**
 * Check a finding against the live program scope (idea 52870).
 * Out-of-scope patterns deny first, then in-scope patterns allow;
 * anything unmatched needs human review instead of a guessed call.
 * @param {object} finding - Finding with target.
 * @param {object} scope - { program, inScope, outOfScope }.
 * @param {object} [options] - Reserved for program rules.
 * @returns {object} { findingId, target, eligible, decision,
 *   matchedPattern, program, reason, summary }.
 */
export function checkScopeEligibility(finding = {}, scope = {}, options = {}) {
  const target = String(finding.target || finding.asset || '');
  const host = hostOf(target);
  const matches = pattern => {
    const pat = String(pattern || '').toLowerCase().trim();
    if (!pat) return false;
    const body = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp(`^${body}$`, 'i');
    return re.test(target.toLowerCase()) || re.test(host);
  };
  const outHit = ((scope && scope.outOfScope) || []).find(p => matches(p));
  const inHit = ((scope && scope.inScope) || []).find(p => matches(p));
  let eligible = null;
  let decision = 'needs-review';
  let matchedPattern = null;
  let reason = 'The target matches no recorded scope pattern.';
  if (outHit) {
    eligible = false;
    decision = 'out-of-scope';
    matchedPattern = outHit;
    reason = `Target matches the exclusion ${outHit}.`;
  } else if (inHit) {
    eligible = true;
    decision = 'in-scope';
    matchedPattern = inHit;
    reason = `Target matches the allowance ${inHit}.`;
  }
  const bountyHint = eligible
    ? `Severity ${sevKey(finding)} is normally rewarded on this program.`
    : 'Confirm eligibility with the program before submitting.';
  return {
    findingId: finding.id || null, target: target || null,
    eligible, decision, matchedPattern,
    program: (scope && scope.program) || null, reason,
    summary: `Infinity AI scope check for ${finding.id || 'the finding'}: `
      + `${decision}. ${bountyHint}`,
  };
}

/**
 * Rewrite a finding for a reader with no security background
 * (idea 52871). Weakness names and severity become plain words, the
 * impact is told as a short story, and the swaps actually made are
 * listed so nothing is silently softened.
 * @param {object} finding - Finding to rewrite.
 * @param {object} [options] - Reserved for audience tuning.
 * @returns {object} { findingId, plainTitle, plainSummary,
 *   plainImpact, severityPlain, jargonReplaced }.
 */
export function rewriteForNonTechnical(finding = {}, options = {}) {
  const cwe = cweKey(finding);
  const plain = CWE_PLAIN[cwe];
  const guide = CWE_FIX_GUIDANCE[cwe] || GENERIC_GUIDANCE;
  const swaps = [
    [/sql injection|sqli/gi, 'database trick'],
    [/cross-site scripting|xss/gi, 'malicious script'],
    [/idor/gi, 'record mix-up'],
    [/ssrf/gi, 'server trick'],
    [/csrf/gi, 'forged request'],
  ];
  const jargonReplaced = [];
  let plainTitle = String(finding.title || 'Security issue');
  for (const [pattern, replacement] of swaps) {
    if (pattern.test(plainTitle)) {
      jargonReplaced.push(replacement);
      plainTitle = plainTitle.replace(pattern, replacement);
    }
    pattern.lastIndex = 0;
  }
  if (plain && !jargonReplaced.length) jargonReplaced.push(plain.weakness);
  const weakness = plain ? plain.weakness : 'a security weakness';
  const action = plain
    ? plain.action
    : 'abuse the weakness described in the technical record';
  return {
    findingId: finding.id || null, plainTitle,
    plainSummary: `On ${finding.target || 'the site'}, Infinity AI found `
      + `${weakness}. An attacker could ${action}.`,
    plainImpact: finding.impact
      ? `In plain terms: ${String(finding.impact)}`
      : 'The team is still confirming how much harm this could cause.',
    severityPlain: SEVERITY_PLAIN[sevKey(finding)],
    recommendedAction: `Ask the team to fix it and retest it: `
      + `${guide.verification}`,
    jargonReplaced,
  };
}

/**
 * Draft one executive slide for a hunt (idea 52872). Headline counts,
 * the three riskiest findings, and a severity chart are computed
 * from the hunt record; the slide stays honest when a hunt is empty.
 * @param {object} hunt - { huntId, target, findings }.
 * @param {object} [options] - { presenter }.
 * @returns {object} { huntId, title, subtitle, headline, bullets,
 *   chart, topFindings, footer }.
 */
export function generateExecSlide(hunt = {}, options = {}) {
  const findings = ((hunt && hunt.findings) || []).slice();
  const bySeverity = {};
  for (const f of findings) {
    bySeverity[sevKey(f)] = (bySeverity[sevKey(f)] || 0) + 1;
  }
  const ranked = findings.sort((a, b) => riskOf(b) - riskOf(a));
  const topFindings = ranked.slice(0, 3).map(f => ({
    id: f.id, title: f.title || null, severity: sevKey(f),
    riskScore: riskOf(f),
  }));
  const payments = filterPaymentFindings(findings, {});
  const openCount = findings
    .filter(f => !TERMINAL_STATES.includes(stateOf(f))).length;
  const bullets = [
    `${findings.length} findings recorded `
      + `(${bySeverity.critical || 0} critical, ${bySeverity.high || 0} high).`,
    topFindings.length
      ? `Highest risk: ${topFindings[0].id} ${topFindings[0].title || ''} `
        + `(risk ${topFindings[0].riskScore}).`
      : 'No findings recorded in this hunt yet.',
    `${payments.count} finding(s) touch payment flows; `
      + `combined payment risk ${payments.exposure}.`,
    `${openCount} finding(s) still open and needing an owner.`,
  ];
  const chartData = SEVERITY_LADDER
    .filter(sev => bySeverity[sev])
    .map(sev => ({ label: sev, value: bySeverity[sev] }));
  return {
    huntId: (hunt && hunt.huntId) || null,
    title: `Security hunt: ${(hunt && hunt.target) || 'target'}`,
    subtitle: `Infinity AI hunt ${(hunt && hunt.huntId) || ''} summary`,
    headline: `${findings.length} findings, `
      + `${bySeverity.critical || 0} critical`,
    bullets, topFindings,
    chart: {
      type: 'donut', data: chartData,
      caption: 'Findings by severity; the largest slice is the fix queue.',
    },
    footer: `Prepared by Infinity AI${options.presenter
      ? ` for ${options.presenter}` : ''}.`,
  };
}

/**
 * Draft the pull-request description for a remediation (idea 52873).
 * Summary, linked finding, root cause, changed files, recorded
 * tests, and the retest checklist are assembled as Markdown; gaps
 * are listed instead of being hidden behind confident prose.
 * @param {object} finding - Finding being fixed.
 * @param {object} [fix] - { branch, commits, files, tests }.
 * @param {object} [options] - { author, reviewer }.
 * @returns {object} { findingId, title, body, labels, checklist,
 *   missing, ready, wordCount }.
 */
export function draftPrDescription(finding = {}, fix = {}, options = {}) {
  const cwe = cweKey(finding);
  const guide = CWE_FIX_GUIDANCE[cwe] || GENERIC_GUIDANCE;
  const files = ((fix && fix.files) || []).map(String);
  const tests = ((fix && fix.tests) || []).map(String);
  const commits = ((fix && fix.commits) || []).map(String);
  const missing = [];
  if (!fix || !fix.branch) missing.push('branch');
  if (!files.length) missing.push('changed files');
  if (!tests.length) missing.push('recorded tests');
  const title = `Fix ${finding.id || 'finding'}: `
    + `${finding.title || guide.weakness} (${sevKey(finding)})`;
  const body = [
    `## Summary`, '',
    `Remediates ${finding.id || 'the finding'} on `
      + `${finding.target || 'the target'}: `
      + `${finding.title || guide.weakness}.`, '',
    `## Linked finding`, '',
    `- Finding: ${finding.id || 'unknown'}`,
    `- Weakness: ${cwe ? cwe.toUpperCase() : 'UNSPECIFIED'} `
      + `(${guide.weakness})`,
    `- Severity: ${sevKey(finding)} (risk ${riskOf(finding)})`, '',
    `## Root cause and fix`, '', guide.fix, '',
    `## Changes`, '',
    ...(files.length ? files.map(f => `- ${f}`) : ['- To be listed.']),
    '', `## Testing`, '',
    ...(tests.length ? tests.map(t => `- ${t}`) : ['- To be recorded.']),
    '', `## Verification`, '', guide.verification, '',
    `Opened by ${options.author || 'Infinity AI'}`
      + `${options.reviewer ? `, review by ${options.reviewer}` : ''}.`,
  ].join('\n');
  return {
    findingId: finding.id || null, title, body,
    labels: ['fix', `severity:${sevKey(finding)}`,
      ...(cwe ? [cwe] : [])].filter(Boolean),
    commits,
    checklist: [
      { item: 'Original proof replayed after the fix', done: tests.length > 0 },
      { item: 'Regression test recorded', done: tests.length > 0 },
      { item: 'Finding linked for closure', done: Boolean(finding.id) },
    ],
    missing, ready: missing.length === 0,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Suggest monitoring that would catch this weakness (idea 52874).
 * Detections are picked for the recorded weakness with the target
 * host and path filled in, each carrying a log source, a SIEM-style
 * query, and an alert threshold tuned by severity.
 * @param {object} finding - Finding to detect.
 * @param {object} [options] - Reserved for SIEM platform choice.
 * @returns {object} { findingId, cwe, detections, detectionCount,
 *   summary }.
 */
export function suggestDetections(finding = {}, options = {}) {
  const cwe = cweKey(finding);
  const templates = DETECTION_TEMPLATES[cwe] || GENERIC_DETECTIONS;
  const host = hostOf(finding.target || '') || 'target';
  const path = pathOf(finding.target || '');
  const threshold = sevKey(finding) === 'critical'
    ? 'Alert on 3 matches in 10 minutes from one source.'
    : sevKey(finding) === 'high'
      ? 'Alert on 5 matches in 10 minutes from one source.'
      : 'Review 10 matches in one hour in the daily queue.';
  const detections = templates.map(t => ({
    name: t.name, logSource: t.logSource,
    query: t.query.split('{host}').join(host).split('{path}').join(path),
    threshold,
  }));
  return {
    findingId: finding.id || null,
    cwe: cwe ? cwe.toUpperCase() : 'UNSPECIFIED',
    detections, detectionCount: detections.length,
    summary: `Infinity AI suggests ${detections.length} detection(s) for `
      + `${finding.id || 'the finding'} on ${host}.`,
  };
}

/**
 * Suggest a WAF rule as a stopgap (idea 52875). The rule targets the
 * input that carries the weakness, starts in detection-only mode,
 * and ships with the false-positive and bypass caveats a stopgap
 * always carries.
 * @param {object} finding - Finding to shield.
 * @param {object} [options] - { startMode } detection-only or deny.
 * @returns {object} { findingId, ruleId, rule, syntax, startMode,
 *   caveats, summary }.
 */
export function suggestWafRule(finding = {}, options = {}) {
  const cwe = cweKey(finding);
  const template = WAF_TEMPLATES[cwe] || GENERIC_WAF;
  const ruleId = 942100 + (parseInt(shortHash(finding.id || 'f'), 36) % 800);
  const mode = String(options.startMode || 'detection-only').toLowerCase();
  const deny = mode === 'deny';
  const rule = `SecRule ${template.target} "@rx ${template.pattern}" `
    + `"id:${ruleId},phase:2,${deny ? 'deny,status:403,' : ''}`
    + `log,msg:'Infinity AI stopgap for ${finding.id || 'finding'} `
    + `(${template.label})'`;
  return {
    findingId: finding.id || null, ruleId, rule,
    syntax: 'ModSecurity', startMode: deny ? 'deny' : 'detection-only',
    matchedOn: template.target, patternLabel: template.label,
    caveats: [
      'Run in detection-only mode first and review matches for one day.',
      'A stopgap blocks known patterns; encoding tricks can still bypass it.',
      'Remove or narrow the rule once the permanent code fix is verified.',
    ],
    summary: `Infinity AI WAF stopgap ${ruleId} for `
      + `${finding.id || 'the finding'} starts in `
      + `${deny ? 'deny' : 'detection-only'} mode.`,
  };
}

/**
 * Answer whether a finding belongs to a bigger chain (idea 52876).
 * Recorded chains contribute their members and combined severity;
 * findings sharing the target host are surfaced as candidate links
 * even when no chain was recorded yet.
 * @param {object} finding - Finding in question.
 * @param {Array} [chains] - [{ id, title, findingIds,
 *   combinedImpact }].
 * @param {Array} [findings] - All hunt findings for context.
 * @returns {object} { findingId, inChain, chains, linkedIds,
 *   chainCount, answer }.
 */
export function checkChainMembership(finding = {}, chains = [], findings = []) {
  const byId = new Map((findings || []).map(f => [String(f.id), f]));
  const memberChains = ((chains) || [])
    .filter(c => ((c.findingIds || c.members) || []).map(String)
      .includes(String(finding.id)))
    .map(c => {
      const memberIds = ((c.findingIds || c.members) || []).map(String);
      const severities = memberIds
        .map(id => sevKey(byId.get(id) || {}));
      let top = severities.reduce((best, sev) => (
        severityRank(sev) > severityRank(best) ? sev : best
      ), 'info');
      if (memberIds.length >= 3) {
        const bumped = SEVERITY_LADDER[
          Math.min(SEVERITY_LADDER.length - 1, severityRank(top) + 1)
        ];
        if (bumped) top = bumped;
      }
      return {
        id: c.id || null, title: c.title || null, memberIds,
        combinedSeverity: memberIds.length ? top : 'info',
        combinedImpact: c.combinedImpact
          || memberIds.map(id => (byId.get(id) || {}).impact)
            .filter(Boolean).join('; '),
      };
    });
  const host = hostOf(finding.target || '');
  const linkedIds = (findings || [])
    .filter(f => String(f.id) !== String(finding.id))
    .filter(f => host && hostOf(f.target || '') === host)
    .map(f => f.id);
  const inChain = memberChains.length > 0;
  return {
    findingId: finding.id || null, inChain, chains: memberChains,
    linkedIds, chainCount: memberChains.length,
    answer: inChain
      ? `Infinity AI: yes, ${finding.id || 'this finding'} belongs to `
        + `${memberChains.length} chain(s); combined severity reaches `
        + `${memberChains[0].combinedSeverity}.`
      : `Infinity AI: no recorded chain contains `
        + `${finding.id || 'this finding'}; ${linkedIds.length} finding(s) `
        + 'share its host and are worth reviewing as links.',
  };
}

/**
 * Decode a CVSS vector into plain language (idea 52877). Each metric
 * becomes a short sentence tied to the finding, so "what does AV:N
 * mean here?" is answered without a lookup table.
 * @param {object|string} input - Vector string or a finding.
 * @param {object} [options] - Reserved for CVSS version choice.
 * @returns {object} { vector, version, metrics, metricCount,
 *   unknown, score, summary }.
 */
export function explainCvssVector(input = {}, options = {}) {
  const isString = typeof input === 'string';
  const finding = isString ? {} : (input || {});
  const vector = String(
    isString ? input : ((finding.cvss && finding.cvss.vector)
      || finding.vector || ''),
  ).trim();
  const score = isString ? null
    : (finding.cvss && finding.cvss.score != null
      ? Number(finding.cvss.score) : null);
  const versionMatch = vector.match(/^CVSS:(\d\.\d)\//i);
  const body = vector.replace(/^CVSS:\d\.\d\//i, '');
  const pairs = body ? body.split('/').map(part => part.trim())
    .filter(Boolean) : [];
  const metrics = [];
  const unknown = [];
  for (const pair of pairs) {
    const [codeRaw, valueRaw] = pair.split(':');
    const code = String(codeRaw || '').toUpperCase();
    const value = String(valueRaw || '').toUpperCase();
    const spec = CVSS_DECODE[code];
    if (!spec || !spec.labels[value]) { unknown.push(pair); continue; }
    metrics.push({
      metric: code, name: spec.name, value,
      plainEnglish: `${spec.name} is ${value}: an attacker acts `
        + `${spec.labels[value]}.`,
    });
  }
  return {
    vector: vector || null,
    version: versionMatch ? versionMatch[1] : null,
    metrics, metricCount: metrics.length, unknown, score,
    summary: vector
      ? `Infinity AI decoded ${metrics.length} metric(s) of ${vector}`
        + `${score != null && Number.isFinite(score)
          ? ` (base score ${score})` : ''}.`
      : 'Infinity AI: no CVSS vector is recorded for this finding yet.',
  };
}

/**
 * Prepare a spoken answer for the avatar (idea 52878). Markdown is
 * stripped, sentences are capped for listening, speaking time is
 * estimated at presentation pace, and each sentence becomes one
 * lip-sync chunk with its own duration.
 * @param {object} session - { question, answer, finding,
 *   avatarGender, voice }.
 * @param {object} [options] - { maxSentences, wordsPerMinute }.
 * @returns {object} { question, voice, speakableText, sentences,
 *   wordCount, estimatedSeconds, chunks, avatar }.
 */
export function planVoiceAnswer(session = {}, options = {}) {
  const finding = (session && session.finding) || {};
  const rawAnswer = String(
    (session && session.answer)
      || (finding.id
        ? `${finding.title || 'A finding'} on `
          + `${finding.target || 'the target'} is rated `
          + `${sevKey(finding)}. ${finding.impact || ''} `
          + `Infinity AI recommends fixing it and replaying the `
          + 'recorded proof to confirm.'
        : 'Infinity AI needs the hunt findings before answering aloud.'),
  );
  const cleaned = rawAnswer
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`]+/g, ' ')
    .replace(/\|/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  const found = cleaned.match(/[^.!?]+[.!?]+/g)
    || (cleaned ? [cleaned] : []);
  const maxSentences = Number(options.maxSentences ?? 4);
  const sentences = found.map(s => s.trim()).filter(Boolean)
    .slice(0, Math.max(1, maxSentences));
  const speakableText = sentences.join(' ');
  const words = speakableText.split(/\s+/).filter(Boolean);
  const wpm = Number(options.wordsPerMinute ?? 150);
  const chunks = sentences.map(text => {
    const count = text.split(/\s+/).filter(Boolean).length;
    return {
      text, seconds: Math.round((count / (wpm / 60)) * 10) / 10,
      lipSync: 'sentence-chunk',
    };
  });
  const estimatedSeconds = Math.round(
    chunks.reduce((sum, c) => sum + c.seconds, 0) * 10,
  ) / 10;
  const gender = String(
    (session && session.avatarGender) || 'female',
  ).toLowerCase();
  const voice = (session && session.voice)
    || VOICE_BY_GENDER[gender] || 'aria';
  return {
    question: String((session && session.question) || ''),
    voice, speakableText, sentences, wordCount: words.length,
    estimatedSeconds, chunks,
    avatar: {
      lipSync: 'sentence-chunks',
      expression: /critical/i.test(speakableText) ? 'serious' : 'neutral',
    },
  };
}

/**
 * Attach evidence to every claim in an answer (idea 52879). The
 * answer is split into claims, each claim is matched to evidence by
 * shared wording, and claims with no support are listed honestly
 * instead of being decorated with a citation.
 * @param {object} input - { answer, claims, finding, evidence }.
 * @param {object} [options] - { minOverlap } shared words required.
 * @returns {object} { cited, uncitedClaims, citationCount,
 *   claimCount, coveragePercent, citedAnswer, summary }.
 */
export function citeEvidence(input = {}, options = {}) {
  const finding = (input && input.finding) || {};
  const pool = evidenceItems(finding);
  for (const extra of ((input && input.evidence) || [])) {
    pool.push(typeof extra === 'string'
      ? { id: `ev-x${pool.length + 1}`, text: extra, source: null }
      : {
        id: (extra && extra.id) || `ev-x${pool.length + 1}`,
        text: String((extra && (extra.text || extra.note)) || ''),
        source: (extra && extra.source) || null,
      });
  }
  const answerText = String((input && input.answer) || '');
  const claims = ((input && input.claims) || []).length
    ? (input.claims || []).map(String)
    : (answerText.match(/[^.!?]+[.!?]+/g)
      || (answerText ? [answerText] : [])).map(s => s.trim())
      .filter(Boolean);
  const minOverlap = Number(options.minOverlap ?? 1);
  const cited = claims.map(claim => {
    const claimTokens = tokenSet(claim);
    const scored = pool.map(item => ({
      evidenceId: item.id, text: item.text,
      overlap: overlapCount(claimTokens, tokenSet(item.text)),
    })).filter(x => x.overlap >= minOverlap)
      .sort((a, b) => b.overlap - a.overlap);
    const best = scored.length ? scored[0] : null;
    return {
      claim, citations: best ? [best] : [],
      supported: Boolean(best),
    };
  });
  const supported = cited.filter(c => c.supported);
  const citedAnswer = cited.map(c => (c.supported
    ? `${c.claim} [${c.citations[0].evidenceId}]` : c.claim)).join(' ');
  return {
    cited,
    uncitedClaims: cited.filter(c => !c.supported).map(c => c.claim),
    citationCount: supported.length, claimCount: cited.length,
    coveragePercent: cited.length
      ? Math.round((supported.length / cited.length) * 1000) / 10 : 0,
    citedAnswer,
    summary: `Infinity AI cited evidence for ${supported.length} of `
      + `${cited.length} claim(s).`,
  };
}

/**
 * Search the saved questions for one hunt (idea 52880). Every stored
 * exchange stays beside its hunt; a plain query matches question,
 * answer, and finding wording, with finding facets and paging.
 * @param {object} hunt - { huntId, qaHistory }.
 * @param {string} [query] - Words that must all appear.
 * @param {object} [options] - { findingId, limit, offset }.
 * @returns {object} { huntId, query, results, total, returned,
 *   facets, summary }.
 */
export function searchQaHistory(hunt = {}, query = '', options = {}) {
  const entries = (
    (hunt && hunt.qaHistory) || (hunt && hunt.qa) || []
  ).map((e, i) => ({
    id: (e && e.id) || `qa-${i + 1}`,
    question: String((e && e.question) || ''),
    answer: String((e && e.answer) || ''),
    findingId: (e && e.findingId) || null,
    askedBy: (e && e.askedBy) || null,
    at: (e && e.at) || null,
  }));
  const wantedFinding = options.findingId || null;
  const tokens = String(query || '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean);
  const filtered = entries.filter(e => {
    if (wantedFinding && String(e.findingId) !== String(wantedFinding)) {
      return false;
    }
    const hay = `${e.question} ${e.answer} ${e.findingId || ''}`
      .toLowerCase();
    return tokens.every(tok => hay.includes(tok));
  });
  const sorted = filtered.slice().sort((a, b) => String(b.at || '')
    .localeCompare(String(a.at || '')));
  const byFinding = {};
  for (const e of filtered) {
    const key = e.findingId || 'general';
    byFinding[key] = (byFinding[key] || 0) + 1;
  }
  const offset = Math.max(0, Number(options.offset ?? 0));
  const limit = Math.max(1, Number(options.limit ?? 20));
  const results = sorted.slice(offset, offset + limit);
  return {
    huntId: (hunt && hunt.huntId) || null,
    query: String(query || ''), results,
    total: filtered.length, returned: results.length,
    facets: { byFinding },
    summary: `Infinity AI found ${filtered.length} saved exchange(s) `
      + `for hunt ${(hunt && hunt.huntId) || 'unknown'}`
      + `${query ? ` matching "${String(query)}"` : ''}.`,
  };
}
