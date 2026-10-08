/**
 * cvssImpact.js — CVSS + Impact Engine (elite-hunter priority #9).
 *
 * The $500 vs $5,000 difference is presentation: triagers pay for findings
 * that arrive with a real CVSS 3.1 vector and a business-grounded impact
 * statement — not eyeballed scores and "theoretical" impact.
 *
 * Part 1 — CVSS scoring:
 *   scoreCVSS(metrics)  -> { score, severity, vector, impact, exploitability }
 *   suggestMetrics(finding) -> suggested CVSS 3.1 metrics for a vuln type
 *   parseVector(vector) -> metrics object from a CVSS:3.1/... string
 *
 * Part 2 — Impact:
 *   buildImpactStatement({...}) -> professional impact paragraph (slot-fill)
 *   impactMultipliers(finding)  -> bounty multipliers that apply
 *   buildSeverityRequest({...}) -> severity-request paragraph for disputes
 *
 * Complements riskScorer.js: riskScorer's 0-10 is internal prioritization;
 * this engine emits real CVSS vectors for submissions. Pure functions only.
 */

'use strict';

// ─── CVSS 3.1 metric weights (FIRST specification) ───────────────────────────

const AV_WEIGHT = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC_WEIGHT = { L: 0.77, H: 0.44 };
const PR_WEIGHT = { N: 0.85, L: 0.62, H: 0.27 };
// When Scope is Changed, PR:L and PR:H carry higher weights (spec rule).
const PR_WEIGHT_SCOPE_CHANGED = { N: 0.85, L: 0.68, H: 0.5 };
const UI_WEIGHT = { N: 0.85, R: 0.62 };
const CIA_WEIGHT = { H: 0.56, L: 0.22, N: 0 };

const METRIC_LABELS = {
  attackVector: { N: 'Network', A: 'Adjacent', L: 'Local', P: 'Physical' },
  attackComplexity: { L: 'Low', H: 'High' },
  privilegesRequired: { N: 'None', L: 'Low', H: 'High' },
  userInteraction: { N: 'None', R: 'Required' },
  scope: { U: 'Unchanged', C: 'Changed' },
  confidentiality: { H: 'High', L: 'Low', N: 'None' },
  integrity: { H: 'High', L: 'Low', N: 'None' },
  availability: { H: 'High', L: 'Low', N: 'None' },
};

export const SEVERITY_BANDS = [
  { min: 9.0, label: 'Critical' },
  { min: 7.0, label: 'High' },
  { min: 4.0, label: 'Medium' },
  { min: 0.1, label: 'Low' },
  { min: 0.0, label: 'None' },
];

/**
 * CVSS 3.1 Roundup: smallest number with one decimal place >= input.
 * (Spec pseudocode — NOT Math.ceil(v*10)/10, which over-rounds exact values.)
 */
export function cvssRoundUp(input) {
  const scaled = Math.round(input * 100000);
  if (scaled % 10000 === 0) return scaled / 100000;
  return (Math.floor(scaled / 10000) + 1) / 10;
}

/**
 * Compute a real CVSS 3.1 base score from base metrics.
 *
 * metrics: { attackVector: 'N'|'A'|'L'|'P', attackComplexity: 'L'|'H',
 *            privilegesRequired: 'N'|'L'|'H', userInteraction: 'N'|'R',
 *            scope: 'U'|'C', confidentiality: 'H'|'L'|'N',
 *            integrity: 'H'|'L'|'N', availability: 'H'|'L'|'N' }
 *
 * Returns { score, severity, vector, impact, exploitability, scopeChanged }.
 */
export function scoreCVSS(metrics = {}) {
  const m = {
    attackVector: metrics.attackVector || 'N',
    attackComplexity: metrics.attackComplexity || 'L',
    privilegesRequired: metrics.privilegesRequired || 'N',
    userInteraction: metrics.userInteraction || 'N',
    scope: metrics.scope || 'U',
    confidentiality: metrics.confidentiality || 'N',
    integrity: metrics.integrity || 'N',
    availability: metrics.availability || 'N',
  };

  const scopeChanged = m.scope === 'C';
  const av = AV_WEIGHT[m.attackVector] ?? 0.85;
  const ac = AC_WEIGHT[m.attackComplexity] ?? 0.77;
  const prTable = scopeChanged ? PR_WEIGHT_SCOPE_CHANGED : PR_WEIGHT;
  const pr = prTable[m.privilegesRequired] ?? 0.85;
  const ui = UI_WEIGHT[m.userInteraction] ?? 0.85;
  const c = CIA_WEIGHT[m.confidentiality] ?? 0;
  const i = CIA_WEIGHT[m.integrity] ?? 0;
  const a = CIA_WEIGHT[m.availability] ?? 0;

  // Impact Sub-Score (ISCBase)
  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);

  let impact;
  if (scopeChanged) {
    impact = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15);
  } else {
    impact = 6.42 * iscBase;
  }

  const exploitability = 8.22 * av * ac * pr * ui;

  let score;
  if (impact <= 0) {
    score = 0.0;
  } else if (scopeChanged) {
    score = cvssRoundUp(Math.min(1.08 * (impact + exploitability), 10));
  } else {
    score = cvssRoundUp(Math.min(impact + exploitability, 10));
  }

  const severity = SEVERITY_BANDS.find(b => score >= b.min)?.label || 'None';
  const vector =
    `CVSS:3.1/AV:${m.attackVector}/AC:${m.attackComplexity}` +
    `/PR:${m.privilegesRequired}/UI:${m.userInteraction}/S:${m.scope}` +
    `/C:${m.confidentiality}/I:${m.integrity}/A:${m.availability}`;

  return {
    score,
    severity,
    vector,
    impact: Math.round(impact * 1000) / 1000,
    exploitability: Math.round(exploitability * 1000) / 1000,
    scopeChanged,
    metrics: m,
  };
}

/**
 * Parse a CVSS:3.1/... vector string back into a metrics object.
 * Returns null when the string is not a valid base vector.
 */
export function parseVector(vector = '') {
  const match = String(vector)
    .trim()
    .match(/^CVSS:3\.1\/((?:[A-Z]+:[A-Z]+\/?)+)$/i);
  if (!match) return null;
  const map = {
    AV: 'attackVector',
    AC: 'attackComplexity',
    PR: 'privilegesRequired',
    UI: 'userInteraction',
    S: 'scope',
    C: 'confidentiality',
    I: 'integrity',
    A: 'availability',
  };
  const metrics = {};
  for (const part of match[1].split('/')) {
    const [k, v] = part.split(':');
    const key = map[k.toUpperCase()];
    if (!key || !v) return null;
    metrics[key] = v.toUpperCase();
  }
  if (Object.keys(metrics).length !== 8) return null;
  return metrics;
}

/**
 * Human-readable breakdown of each metric, e.g. "Attack Vector: Network".
 */
export function describeMetrics(metrics = {}) {
  return Object.entries(METRIC_LABELS)
    .filter(([key]) => metrics[key])
    .map(([key, labels]) => {
      const pretty = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
      return `${pretty}: ${labels[metrics[key]] || metrics[key]}`;
    });
}

// ─── Metric suggestions per vulnerability class ──────────────────────────────
// Defaults follow the research reference ranges (04-reports-strategy.md §5).
// Discipline: suggest the metric that matches what was PROVED; rationales say
// exactly which evidence would raise or lower the score.

const VULN_METRIC_PRESETS = [
  {
    match: ['sqli', 'sql_injection', 'sql injection', 'blind_sqli'],
    cwe: 'CWE-89',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'Unauthenticated SQLi with demonstrated data extraction. Raise Integrity to High when write access is proved (DELETE/UPDATE/ stacked queries) — score moves to ~9.1 Critical.',
  },
  {
    match: ['xss_stored', 'stored_xss', 'stored xss'],
    cwe: 'CWE-79',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'L',
      userInteraction: 'R',
      scope: 'C',
      confidentiality: 'L',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'Stored XSS reachable by victims; script executes in their session (Scope: Changed). Raise Integrity to High when session hijack or account takeover is demonstrated — score moves to ~7.4 High.',
  },
  {
    match: ['xss_reflected', 'reflected_xss', 'reflected xss', 'xss'],
    cwe: 'CWE-79',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'R',
      scope: 'C',
      confidentiality: 'L',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'Reflected XSS needs a victim to open a crafted link (UI: Required). Lower reach than stored; the UI metric is what separates it from stored.',
  },
  {
    match: ['idor_read', 'idor'],
    cwe: 'CWE-639',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'L',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'N',
      availability: 'N',
    },
    rationale:
      'IDOR exposing other users\u2019 data with only a self-registered account. Confidentiality: High applies to cross-tenant PII exposure.',
  },
  {
    match: ['idor_write', 'idor_delete'],
    cwe: 'CWE-639',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'L',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'N',
      integrity: 'H',
      availability: 'L',
    },
    rationale:
      'IDOR allowing modification or deletion of other users\u2019 objects. Availability: Low covers the delete path; drop it when only modification is proved.',
  },
  {
    match: ['ssrf'],
    cwe: 'CWE-918',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'C',
      confidentiality: 'H',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'SSRF reaching cloud metadata or internal credentials — the subsequent system (not the SSRF endpoint itself) is what carries Confidentiality: High.',
  },
  {
    match: ['auth_bypass', 'authentication_bypass', 'auth bypass', 'broken_auth'],
    cwe: 'CWE-287',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'C',
      confidentiality: 'H',
      integrity: 'H',
      availability: 'H',
    },
    rationale:
      'Authentication bypass to an admin session compromises a subsequent authorization domain (Scope: Changed) with full read/write impact.',
  },
  {
    match: ['jwt_none', 'jwt_alg_none', 'alg_none'],
    cwe: 'CWE-327',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'H',
      availability: 'N',
    },
    rationale:
      'JWT alg=none acceptance lets an attacker forge any identity the token format supports, including admin claims.',
  },
  {
    match: ['ssti', 'template_injection'],
    cwe: 'CWE-94',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'H',
      availability: 'H',
    },
    rationale:
      'Server-side template injection with demonstrated command execution is unauthenticated RCE.',
  },
  {
    match: ['cmdi', 'command_injection', 'os_command'],
    cwe: 'CWE-78',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'H',
      availability: 'H',
    },
    rationale: 'OS command injection with proved command output is unauthenticated RCE.',
  },
  {
    match: ['xxe', 'xml_external'],
    cwe: 'CWE-611',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'N',
      availability: 'N',
    },
    rationale:
      'XXE with local file disclosure proved via file contents in the response. Raise Integrity/Availability when SSRF-via-XXE or DoS is also demonstrated.',
  },
  {
    match: ['lfi', 'local_file', 'path_traversal', 'directory_traversal'],
    cwe: 'CWE-22',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'N',
      availability: 'N',
    },
    rationale:
      'Local file inclusion reading sensitive files (e.g. /etc/passwd, config with secrets). Score what the files actually expose.',
  },
  {
    match: ['open_redirect'],
    cwe: 'CWE-601',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'R',
      scope: 'U',
      confidentiality: 'L',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'Open redirect is a phishing enabler; impact stays bounded unless chained with token leakage or OAuth misconfiguration.',
  },
  {
    match: ['csrf', 'xsrf'],
    cwe: 'CWE-352',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'H',
      privilegesRequired: 'N',
      userInteraction: 'R',
      scope: 'U',
      confidentiality: 'N',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'CSRF on a non-critical action. Attack Complexity: High reflects the narrow exploit window; raise Integrity when the action is sensitive (e.g. password change, transfer).',
  },
  {
    match: ['default_cred', 'default_password', 'hardcoded_cred'],
    cwe: 'CWE-798',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'C',
      confidentiality: 'H',
      integrity: 'H',
      availability: 'H',
    },
    rationale:
      'Default or hardcoded credentials on an admin interface give full control of a subsequent system with zero attacker effort.',
  },
  {
    match: ['file_upload'],
    cwe: 'CWE-434',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'H',
      availability: 'H',
    },
    rationale:
      'Unrestricted file upload with demonstrated code execution. If only stored (no execution proved), lower Integrity to Low and re-score.',
  },
  {
    match: ['sensitive_exposure', 'pii_exposure', 'data_exposure'],
    cwe: 'CWE-200',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'H',
      integrity: 'N',
      availability: 'N',
    },
    rationale:
      'Direct exposure of other users\u2019 PII. Confidentiality: High when the data is names, emails, or identifiers at scale — not just the visitor\u2019s own data.',
  },
  {
    match: ['info_disclosure', 'information_disclosure', 'verbose_error'],
    cwe: 'CWE-200',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'L',
      integrity: 'N',
      availability: 'N',
    },
    rationale:
      'Non-PII information disclosure (stack traces, internal paths, version banners). Confidentiality: Low — useful to attackers but not user data.',
  },
  {
    match: ['subdomain_takeover', 'takeover'],
    cwe: 'CWE-829',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'H',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'N',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'Takeover of a dangling DNS record lets the attacker serve content under the victim brand (phishing, cookie theft on shared parent domains).',
  },
  {
    match: ['cors'],
    cwe: 'CWE-942',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'H',
      privilegesRequired: 'N',
      userInteraction: 'R',
      scope: 'U',
      confidentiality: 'L',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'Permissive CORS (reflected origin with credentials) leaks authenticated responses cross-origin; needs a victim visit, hence UI: Required.',
  },
  {
    match: ['clickjacking', 'ui_redress'],
    cwe: 'CWE-1021',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'H',
      privilegesRequired: 'N',
      userInteraction: 'R',
      scope: 'U',
      confidentiality: 'N',
      integrity: 'L',
      availability: 'N',
    },
    rationale:
      'Missing frame-ancestors protection on a non-sensitive page. Raise Integrity when a state-changing action can be framed with a working PoC.',
  },
  {
    match: ['mass_assignment', 'mass-assign'],
    cwe: 'CWE-915',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'L',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'N',
      integrity: 'H',
      availability: 'N',
    },
    rationale:
      'Mass assignment binding a privileged field (e.g. role=is_admin). Integrity: High when privilege escalation is proved via a follow-up request.',
  },
  {
    match: ['graphql_introspection'],
    cwe: 'CWE-200',
    metrics: {
      attackVector: 'N',
      attackComplexity: 'L',
      privilegesRequired: 'N',
      userInteraction: 'N',
      scope: 'U',
      confidentiality: 'L',
      integrity: 'N',
      availability: 'N',
    },
    rationale:
      'GraphQL introspection enabled in production leaks the full schema — an information disclosure that accelerates further attacks.',
  },
];

function normalizeType(type = '') {
  return String(type)
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

/**
 * Suggest CVSS 3.1 metrics for a finding based on its vulnerability class.
 *
 * finding: { type, url, confidence, ... } — type matched fuzzily against
 * the preset table. Unknown types get a conservative read-only default.
 *
 * Returns { metrics, cwe, rationale, computed } where computed is the
 * full scoreCVSS() result for the suggested metrics.
 */
export function suggestMetrics(finding = {}) {
  const normalized = normalizeType(finding.type || '');

  for (const preset of VULN_METRIC_PRESETS) {
    if (preset.match.some(key => normalized.includes(key))) {
      return {
        metrics: { ...preset.metrics },
        cwe: preset.cwe,
        rationale: preset.rationale,
        computed: scoreCVSS(preset.metrics),
      };
    }
  }

  // Conservative default: unauthenticated read of non-sensitive data.
  const metrics = {
    attackVector: 'N',
    attackComplexity: 'L',
    privilegesRequired: 'N',
    userInteraction: 'N',
    scope: 'U',
    confidentiality: 'L',
    integrity: 'N',
    availability: 'N',
  };
  return {
    metrics,
    cwe: 'CWE-200',
    rationale:
      'No preset matched this vulnerability class — scored conservatively as low-impact information disclosure. Adjust the metrics to match what was actually proved.',
    computed: scoreCVSS(metrics),
  };
}

// ─── Part 2 — Impact statements ──────────────────────────────────────────────

const VULN_ACTION_PHRASES = [
  {
    match: ['sqli', 'sql_injection', 'sql injection', 'blind_sqli'],
    phrase: 'execute arbitrary SQL queries against the backend database',
  },
  {
    match: ['xss_stored'],
    phrase: 'inject persistent JavaScript that executes in every victim\u2019s browser session',
  },
  { match: ['xss'], phrase: 'execute arbitrary JavaScript in a victim\u2019s browser session' },
  {
    match: ['idor'],
    phrase: 'access and manipulate objects belonging to other users by swapping identifiers',
  },
  {
    match: ['ssrf'],
    phrase: 'force the server to issue requests to internal systems and cloud metadata endpoints',
  },
  {
    match: ['auth_bypass', 'broken_auth'],
    phrase:
      'bypass authentication and operate inside other users\u2019 accounts, including administrators',
  },
  {
    match: ['jwt_none'],
    phrase: 'forge authentication tokens for any identity, including administrators',
  },
  {
    match: ['ssti', 'cmdi'],
    phrase: 'execute arbitrary operating-system commands on the application server',
  },
  { match: ['xxe'], phrase: 'read arbitrary local files from the application server' },
  {
    match: ['lfi', 'path_traversal'],
    phrase: 'read arbitrary local files from the application server',
  },
  {
    match: ['open_redirect'],
    phrase: 'redirect victims to attacker-controlled pages from a trusted domain',
  },
  {
    match: ['csrf'],
    phrase: 'trigger state-changing actions in a victim\u2019s authenticated session',
  },
  {
    match: ['default_cred'],
    phrase: 'log in with publicly known credentials and take full administrative control',
  },
  { match: ['file_upload'], phrase: 'upload and execute arbitrary code on the application server' },
  {
    match: ['subdomain_takeover'],
    phrase: 'serve attacker-controlled content under the organization\u2019s own domain name',
  },
  {
    match: ['cors'],
    phrase: 'read authenticated API responses cross-origin from any malicious website',
  },
  {
    match: ['clickjacking'],
    phrase: 'trick victims into performing unintended actions through an invisible framed page',
  },
  {
    match: ['mass_assignment'],
    phrase: 'escalate privileges by binding protected fields such as user roles',
  },
];

function actionPhraseFor(vulnType = '') {
  const normalized = normalizeType(vulnType);
  for (const entry of VULN_ACTION_PHRASES) {
    if (entry.match.some(key => normalized.includes(key))) return entry.phrase;
  }
  return 'exploit the identified vulnerability against the application';
}

function formatUsers(n) {
  if (n == null || n === '') return null;
  const num = Number(String(n).replace(/[^0-9]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;
  return num.toLocaleString('en-US');
}

/**
 * Build a professional impact paragraph from evidence slots.
 *
 * Slots (all optional, but more slots = stronger statement):
 *   vulnType        — e.g. 'SQL Injection'
 *   affectedUsers   — number or string, e.g. 120000
 *   dataExposed     — e.g. 'names, email addresses and password hashes'
 *   businessContext — e.g. 'the checkout flow of a live e-commerce store'
 *
 * Returns a 3–5 sentence paragraph in professional English.
 */
export function buildImpactStatement({
  vulnType = '',
  affectedUsers = null,
  dataExposed = '',
  businessContext = '',
} = {}) {
  const action = actionPhraseFor(vulnType);
  const users = formatUsers(affectedUsers);
  const sentences = [];

  // Sentence 1: what the attacker can do.
  sentences.push(`An attacker can ${action}.`);

  // Sentence 2: scale.
  if (users) {
    sentences.push(
      `The exposed surface covers approximately ${users} registered users${businessContext ? ` on ${businessContext}` : ''}.`
    );
  } else if (businessContext) {
    sentences.push(
      `The vulnerable endpoint sits on ${businessContext}, where exploitation is directly reachable.`
    );
  }

  // Sentence 3: data.
  if (dataExposed && String(dataExposed).trim()) {
    sentences.push(
      `Successful exploitation discloses ${String(dataExposed).trim().replace(/\.$/, '')}.`
    );
  }

  // Sentence 4: business consequence.
  const normalized = normalizeType(vulnType);
  let consequence;
  if (/sql|ssrf|xxe|lfi|sensitive_exposure|idor|data_exposure/.test(normalized)) {
    consequence =
      'Beyond direct data theft, this creates regulatory exposure (breach-notification duties and fines under regimes such as GDPR), mandatory incident response, and lasting reputational damage once customer data is involved.';
  } else if (/xss|csrf|clickjacking|cors|open_redirect/.test(normalized)) {
    consequence =
      'Because exploitation runs inside real user sessions, it enables account takeover, session theft, and phishing that inherits the organization\u2019s own domain trust — the kind of incident that erodes user confidence at scale.';
  } else if (/ssti|cmdi|file_upload|auth_bypass|default_cred|jwt_none/.test(normalized)) {
    consequence =
      'Full server or account compromise turns a single endpoint into a foothold for lateral movement, data destruction, and supply-chain abuse against the organization\u2019s own customers.';
  } else {
    consequence =
      'Left unpatched, this gives attackers a reliable primitive they can combine with other weaknesses to escalate impact over time.';
  }
  sentences.push(consequence);

  return sentences.join(' ');
}

// ─── Bounty multipliers ──────────────────────────────────────────────────────

const MULTIPLIER_RULES = [
  {
    id: 'chained',
    label: 'Chained vulnerability',
    range: '2–5×',
    test: f =>
      f.partOfChain === true ||
      (Number(f.chainLength) || 0) > 1 ||
      /chain/i.test(String(f.type || '')),
    reason:
      'Findings demonstrated as part of a working exploit chain pay multiples of single-issue reports.',
  },
  {
    id: 'high_value_target',
    label: 'High-value target',
    range: '3–10×',
    test: f =>
      f.adminTarget === true || /admin|internal|prod|dashboard|console/i.test(String(f.url || '')),
    reason:
      'Vulnerabilities on admin, internal, or production systems carry outsized business risk.',
  },
  {
    id: 'auth_bypass',
    label: 'Authentication bypass',
    range: 'escalates severity',
    test: f => {
      const t = String(f.type || '')
        .toLowerCase()
        .replace(/[\s_-]+/g, '_');
      return (
        /auth.*bypass|bypass.*auth|broken_auth|jwt_none|default_cred/.test(t) ||
        f.authBypassed === true
      );
    },
    reason:
      'Bypassing authentication collapses the trust boundary — triagers rate this above the raw CVSS.',
  },
  {
    id: 'account_takeover',
    label: 'Account takeover demonstrated',
    range: '2–4×',
    test: f =>
      f.accountTakeover === true ||
      /account.?takeover|\bato\b/i.test(String(f.evidence || '') + ' ' + String(f.type || '')),
    reason: 'A proved victim-account takeover is the clearest possible impact statement.',
  },
  {
    id: 'rce',
    label: 'Remote code execution',
    range: '3–10×',
    test: f =>
      /rce|remote.?code|ssti|cmdi|command.?injection|template.?injection/i.test(
        String(f.type || '')
      ),
    reason: 'RCE is the top of the impact ladder on virtually every program.',
  },
  {
    id: 'mass_impact',
    label: 'Mass user impact',
    range: '2–5×',
    test: f => (Number(String(f.affectedUsers || '').replace(/[^0-9]/g, '')) || 0) >= 10000,
    reason: 'Findings affecting 10,000+ users multiply both real-world harm and program liability.',
  },
  {
    id: 'regulated_data',
    label: 'Regulated data exposure',
    range: '2–4×',
    test: f =>
      /pii|gdpr|hipaa|pci|health|ssn|passport|financial/i.test(
        String(f.dataExposed || '') + ' ' + String(f.type || '')
      ),
    reason:
      'PII, health, or financial data triggers breach-notification duties and regulatory fines.',
  },
  {
    id: 'financial_tx',
    label: 'Financial transaction impact',
    range: '2–5×',
    test: f =>
      /payment|price|balance|checkout|billing|transaction|wallet/i.test(
        String(f.type || '') + ' ' + String(f.url || '') + ' ' + String(f.businessContext || '')
      ),
    reason:
      'Direct money movement or price manipulation is priced against fraud loss, not just CVSS.',
  },
  {
    id: 'zero_interaction_wormable',
    label: 'Unauthenticated, no user interaction',
    range: 'scalable / wormable premium',
    test: f => {
      const m = f.suggestedMetrics?.metrics || f.cvssMetrics;
      return m && m.privilegesRequired === 'N' && m.userInteraction === 'N';
    },
    reason:
      'Zero-click, unauthenticated flaws can be automated against every deployment — programs pay for that scale.',
  },
];

/**
 * Detect which bounty multipliers apply to a finding.
 *
 * finding may carry: { type, url, evidence, affectedUsers, dataExposed,
 *   businessContext, partOfChain, chainLength, adminTarget, authBypassed,
 *   accountTakeover, suggestedMetrics }
 *
 * Returns [{ id, label, range, reason }] for each rule that fires.
 */
export function impactMultipliers(finding = {}) {
  return MULTIPLIER_RULES.filter(rule => {
    try {
      return rule.test(finding);
    } catch {
      return false;
    }
  }).map(({ id, label, range, reason }) => ({ id, label, range, reason }));
}

// ─── Severity-request paragraph (for triage disputes) ───────────────────────

/**
 * Draft the severity-request paragraph the research prescribes when a
 * platform's default severity sits below the computed CVSS severity.
 *
 * From 04-reports-strategy.md: grounded in the vector string + business
 * impact, never in feelings. Placed as the first body section of the report.
 */
export function buildSeverityRequest({ cvss, platformDefault = '', businessAnchor = '' } = {}) {
  if (!cvss || typeof cvss.score !== 'number') {
    throw new Error('buildSeverityRequest requires a cvss { score, severity, vector } object');
  }
  const anchor =
    businessAnchor && String(businessAnchor).trim()
      ? ` ${String(businessAnchor).trim().replace(/\.$/, '')}.`
      : '';
  const platform =
    platformDefault && String(platformDefault).trim()
      ? ` The platform default of ${String(platformDefault).trim()} understates this finding.`
      : '';
  return (
    `Severity assessment: CVSS 3.1 ${cvss.vector} = ${cvss.score} ${cvss.severity}.${platform}` +
    ` This rating follows directly from the demonstrated metrics — not from assumed worst cases.${anchor}`
  );
}

/**
 * One-call convenience: suggest metrics, score them, build the impact
 * statement, and list multipliers for a finding.
 */
export function assessFinding(finding = {}) {
  const suggestion = suggestMetrics(finding);
  const cvss = suggestion.computed;
  const withMetrics = { ...finding, suggestedMetrics: suggestion };
  return {
    cvss,
    cwe: suggestion.cwe,
    metricRationale: suggestion.rationale,
    impactStatement: buildImpactStatement({
      vulnType: finding.type,
      affectedUsers: finding.affectedUsers,
      dataExposed: finding.dataExposed,
      businessContext: finding.businessContext,
    }),
    multipliers: impactMultipliers(withMetrics),
  };
}

export const CVSS_IMPACT = {
  scoreCVSS,
  cvssRoundUp,
  parseVector,
  describeMetrics,
  suggestMetrics,
  buildImpactStatement,
  impactMultipliers,
  buildSeverityRequest,
  assessFinding,
  SEVERITY_BANDS,
  METRIC_LABELS,
};

export default CVSS_IMPACT;
