/**
 * wave72ACore.js — post-hunt Q&A round 2 (ideas 52841–52860).
 *
 * Pure logic for boss-friendly summaries, fix prioritization,
 * auth-requirement analysis, data-at-risk inventories, similar
 * past findings, false-positive justification recall, step-by-step
 * PoC narration, payload anatomy, next-step brainstorming,
 * regression checklists, ticket drafting, finding translation,
 * compliance mapping, bounty estimation, duplicate suspicion,
 * root-cause analysis, fix-verification guidance, test-case
 * suggestions, three-bullet hunt summaries, and the unauthenticated
 * findings list. Every helper takes explicit inputs, returns a
 * structured view model, and never mutates its arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE72_A_IDEAS = [
  { id: 52841, title: 'Boss-friendly summaries', skip: false },
  { id: 52842, title: 'Fix-prioritization advice', skip: false },
  { id: 52843, title: 'Auth-requirement analysis', skip: false },
  { id: 52844, title: 'Data-at-risk inventory', skip: false },
  { id: 52845, title: 'Similar past findings lookup', skip: false },
  { id: 52846, title: 'FP-justification recall', skip: false },
  { id: 52847, title: 'Step-by-step PoC narration', skip: false },
  { id: 52848, title: 'Payload anatomy Q&A', skip: false },
  { id: 52849, title: 'Next-step brainstorming', skip: false },
  { id: 52850, title: 'Regression-checklist generation', skip: false },
  { id: 52851, title: 'Ticket-text drafting', skip: false },
  { id: 52852, title: 'Finding translation', skip: false },
  { id: 52853, title: 'Compliance-mapping Q&A', skip: false },
  { id: 52854, title: 'Bounty-value estimation', skip: false },
  { id: 52855, title: 'Duplicate-suspicion Q&A', skip: false },
  { id: 52856, title: 'Root-cause analysis Q&A', skip: false },
  { id: 52857, title: 'Fix-verification guidance', skip: false },
  { id: 52858, title: 'Test-case suggestions', skip: false },
  { id: 52859, title: 'Three-bullet hunt summary', skip: false },
  { id: 52860, title: 'Unauthenticated-findings list', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SEVERITY_LABEL = {
  critical: 'very serious',
  high: 'serious',
  medium: 'moderate',
  low: 'minor',
  info: 'informational',
};
const DATA_PATTERNS = [
  { category: 'emails', sensitivity: 'medium', re: /[\w.+-]+@[\w-]+\.[\w.]+/i },
  { category: 'passwords/hashes', sensitivity: 'critical', re: /password|bcrypt/i },
  { category: 'tokens', sensitivity: 'critical', re: /bearer\s|api[_-]?key|jwt/i },
  { category: 'card data', sensitivity: 'critical', re: /card number|pan\b/i },
  { category: 'personal profiles', sensitivity: 'high', re: /profile|phone|dob\b/i },
  { category: 'financial records', sensitivity: 'high', re: /invoice|billing|bank/i },
  { category: 'system details', sensitivity: 'medium', re: /stack trace|hostname/i },
  { category: 'order records', sensitivity: 'high', re: /order id|customer|cart/i },
];
const COMPLIANCE_MAP = [
  { match: /auth|login|CWE-862|CWE-287/i, soc2: 'CC6.1 access', pci: 'PCI DSS 8.2',
    iso: 'A.5.15 access control' },
  { match: /sqli|CWE-89|CWE-79|xss/i, soc2: 'CC6.6 boundaries', pci: 'PCI DSS 6.2.4',
    iso: 'A.8.28 secure coding' },
  { match: /data|leak|pii|CWE-200/i, soc2: 'C1.1 confidentiality', pci: 'PCI DSS 3.3',
    iso: 'A.5.34 privacy and PII' },
  { match: /tls|crypto|CWE-327/i, soc2: 'CC6.7 transmission', pci: 'PCI DSS 4.2',
    iso: 'A.8.24 cryptography' },
  { match: /log|verbose|CWE-209/i, soc2: 'CC7.2 monitoring', pci: 'PCI DSS 10.2',
    iso: 'A.8.15 logging' },
];
const ROOT_CAUSES = [
  { match: /CWE-89|sqli/i, category: 'Unsanitised DB input',
    fix: 'Use parameterised queries and allow-lists.' },
  { match: /CWE-79|xss/i, category: 'Unescaped page output',
    fix: 'Encode output by context and add a CSP.' },
  { match: /CWE-862|idor|auth/i, category: 'Missing authorisation check',
    fix: 'Enforce server-side ownership and role checks.' },
  { match: /CWE-918|ssrf/i, category: 'Unvalidated URL fetching',
    fix: 'Allow-list destinations; block private ranges.' },
  { match: /CWE-22|traversal/i, category: 'Unvalidated file path',
    fix: 'Canonicalise and confine paths to one directory.' },
  { match: /CWE-327|tls|cipher/i, category: 'Weak TLS configuration',
    fix: 'Require modern TLS; disable legacy ciphers.' },
  { match: /CWE-209|verbose|error/i, category: 'Detailed error responses',
    fix: 'Return generic errors; log details server-side.' },
];

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

function sevKey(f) {
  return String((f && f.severity) || 'info').toLowerCase();
}

function textOf(f) {
  if (!f) return '';
  const bits = [f.title, f.description, f.summary, f.impact, f.cwe, f.category];
  bits.push(...(f.evidence || []), ...(f.tags || []), ...(f.dataTypes || []));
  return bits.filter(Boolean).join(' ');
}

function tokens(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter(t => t.length > 2);
}

function uniqueTokens(text) {
  return [...new Set(tokens(text))];
}

function overlapScore(aText, bText) {
  const a = new Set(uniqueTokens(aText));
  const b = new Set(uniqueTokens(bText));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return Math.round((shared / Math.max(a.size, b.size)) * 1000) / 10;
}

function redact(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/bearer\s+[\w.-]+/gi, 'Bearer [token]')
    .replace(/\b(?:\d[ -]?){13,16}\b/g, '[card]');
}

function plainWords(text) {
  return String(text || '')
    .replace(/SQL injection/gi, 'a database trick')
    .replace(/cross-site scripting|XSS/gi, 'injected page script')
    .replace(/IDOR|broken access control/gi, 'a missing permission check')
    .replace(/SSRF/gi, 'a server request trick')
    .replace(/payload/gi, 'test input')
    .replace(/endpoint/gi, 'page or service address')
    .replace(/CVE-\d+-\d+/gi, 'a known public flaw');
}

/**
 * Turn one finding into a non-technical summary for leadership (52841).
 * Jargon is replaced with plain words and the business effect is
 * stated first, so a reader with no security background can act.
 */
export function buildBossSummary(finding = {}, options = {}) {
  const sev = sevKey(finding);
  const label = SEVERITY_LABEL[sev] || 'informational';
  const title = plainWords(finding.title || 'Security issue');
  const auth = analyzeAuthRequirement(finding);
  const reach = auth.requiresAuth
    ? 'Someone would first need a valid account to use it.'
    : 'Anyone on the internet could use it, with no account needed.';
  const data = buildDataAtRiskInventory([finding]);
  const dataLine = data.inventory.length
    ? `It puts ${data.inventory.map(d => d.category).join(', ')} at risk.`
    : 'No customer data was shown to be exposed in the evidence.';
  const urgency = sev === 'critical' || sev === 'high'
    ? 'Fix before the next release; treat as a priority item.'
    : 'Schedule the fix in the normal planning cycle.';
  return {
    audience: options.audience || 'leadership',
    headline: `${title} — a ${label} issue on ${finding.target || 'the product'}`,
    plainSummary: `${title}. ${reach} ${dataLine}`,
    businessImpact: plainWords(finding.impact ||
      'Customers could be affected if this is used by an attacker.'),
    urgency,
    severity: sev,
    bullets: [
      `What happened: ${title}.`,
      `Who can use it: ${reach}`,
      'What is at risk: ' + (data.inventory.length
        ? data.inventory.map(d => d.category).join(', ')
        : 'no data confirmed exposed') + '.',
    ],
  };
}

/**
 * Rank findings into a fix-first order (idea 52842).
 * Severity, confirmed risk, no-login reachability and exposed data
 * raise a finding; estimated effort only breaks close calls.
 */
export function prioritizeFixes(findings = [], options = {}) {
  const effortById = options.effortById || {};
  const scored = (findings || []).map(f => {
    const auth = analyzeAuthRequirement(f);
    const data = buildDataAtRiskInventory([f]);
    let score = severityRank(f.severity) * 25;
    const reasons = [`${sevKey(f)} severity`];
    if (Number(f.riskScore)) {
      score += Math.min(20, Number(f.riskScore) / 5);
      reasons.push('confirmed risk score');
    }
    if (!auth.requiresAuth) { score += 15; reasons.push('reachable without login'); }
    if (data.inventory.length) {
      score += Math.min(15, data.inventory.length * 5);
      reasons.push('data exposed');
    }
    const effort = String(effortById[f.id] || f.effort || 'medium').toLowerCase();
    if (effort === 'low') score += 4;
    if (effort === 'high') score -= 4;
    return {
      id: f.id, title: f.title || 'Untitled', severity: sevKey(f),
      score: Math.round(score * 10) / 10, effort,
      requiresAuth: auth.requiresAuth, reasons,
    };
  });
  scored.sort((a, b) => (b.score - a.score) || String(a.id).localeCompare(String(b.id)));
  const ranked = scored.map((row, i) => ({ ...row, rank: i + 1 }));
  return {
    ranked,
    topPick: ranked[0] || null,
    summary: ranked.length
      ? `Fix first: ${ranked[0].title} (${ranked[0].severity}, score ${ranked[0].score}).`
      : 'No findings to prioritise.',
  };
}

/**
 * Decide whether a finding needs a login to exploit (idea 52843).
 * Explicit flags win; otherwise the proof steps and evidence text
 * are read for session cookies, tokens, or no-auth markers.
 */
export function analyzeAuthRequirement(finding = {}, options = {}) {
  const evidence = [];
  let requiresAuth = null;
  if (typeof finding.authRequired === 'boolean') {
    requiresAuth = finding.authRequired;
    evidence.push('finding records an explicit auth requirement flag');
  }
  if (typeof finding.requiresAuth === 'boolean') {
    requiresAuth = finding.requiresAuth;
    evidence.push('finding records an explicit requires-auth flag');
  }
  const text = textOf(finding) + ' ' + (finding.poc || '') + ' ' +
    (finding.payload || '') + ' ' +
    (finding.pocSteps || []).map(s => (s && (s.action || s.request)) || '').join(' ');
  if (/unauthenticated|without (a )?login|no login|no auth|anonymous/i.test(text)) {
    requiresAuth = false;
    evidence.push('evidence describes access without a login');
  }
  if (/cookie:|authorization:|bearer\s|session cookie|logged in as|authenticated as/i.test(text)) {
    if (requiresAuth === null) requiresAuth = true;
    evidence.push('proof steps carry a session cookie or auth header');
  }
  if (finding.authContext) {
    evidence.push(`auth context recorded: ${finding.authContext}`);
    if (/none|anonymous|guest/i.test(String(finding.authContext))) requiresAuth = false;
    if (/user|admin|member|logged/i.test(String(finding.authContext))) {
      if (requiresAuth === null) requiresAuth = true;
    }
  }
  if (requiresAuth === null) {
    requiresAuth = options.defaultRequiresAuth !== false;
    evidence.push('no auth signal in evidence; assuming login required');
  }
  const strong = evidence.some(e => e.includes('explicit') ||
    e.includes('without a login') || e.includes('auth context'));
  return {
    requiresAuth,
    exploitableWithoutLogin: !requiresAuth,
    confidence: strong ? 'high' : 'low',
    evidence,
    verdict: requiresAuth
      ? 'A valid login is needed before this can be used.'
      : 'This can be used without any login.',
  };
}

/**
 * Inventory the data a set of findings puts at risk (idea 52844).
 * Declared data types are merged with types detected in evidence,
 * each with a sensitivity level and a redacted example.
 */
export function buildDataAtRiskInventory(findings = [], options = {}) {
  const byCategory = new Map();
  const add = (category, sensitivity, findingId, example) => {
    if (!byCategory.has(category)) {
      byCategory.set(category, { category, sensitivity, findingIds: [], examples: [] });
    }
    const row = byCategory.get(category);
    if (findingId && !row.findingIds.includes(findingId)) row.findingIds.push(findingId);
    if (example && row.examples.length < 2) row.examples.push(redact(example).slice(0, 80));
    if (severityRank(sensitivity) > severityRank(row.sensitivity)) {
      row.sensitivity = sensitivity;
    }
  };
  for (const f of findings || []) {
    for (const declared of f.dataTypes || []) {
      add(String(declared), 'high', f.id, String(declared));
    }
    if (options.includeDeclaredOnly) continue;
    const text = textOf(f);
    for (const pattern of DATA_PATTERNS) {
      if (pattern.re.test(text)) add(pattern.category, pattern.sensitivity, f.id, text);
    }
  }
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const inventory = [...byCategory.values()]
    .sort((a, b) => (order[a.sensitivity] - order[b.sensitivity]) ||
      a.category.localeCompare(b.category));
  return {
    inventory,
    totalFindings: (findings || []).length,
    highestSensitivity: inventory.length ? inventory[0].sensitivity : 'none',
    summary: inventory.length
      ? `${inventory.length} data type(s) at risk across ${(findings || []).length} finding(s).`
      : 'No exposed data types detected in the supplied evidence.',
  };
}

/**
 * Find earlier findings that resemble the current one (idea 52845).
 * Shared classification, wording, target, and tags score the match;
 * recorded outcomes travel with each match for context.
 */
export function findSimilarPastFindings(finding = {}, pastFindings = [], options = {}) {
  const limit = Number(options.limit || 5);
  const minScore = Number(options.minScore || 10);
  const matches = [];
  for (const past of pastFindings || []) {
    if (past.id && finding.id && past.id === finding.id) continue;
    let score = overlapScore(textOf(finding), textOf(past));
    const reasons = [];
    if (score > 0) reasons.push('similar wording and evidence');
    if (finding.cwe && past.cwe && finding.cwe === past.cwe) {
      score += 40; reasons.push(`same classification ${finding.cwe}`);
    }
    if (finding.target && past.target && finding.target === past.target) {
      score += 15; reasons.push('same target');
    }
    const sharedTags = (finding.tags || []).filter(t => (past.tags || []).includes(t));
    if (sharedTags.length) { score += sharedTags.length * 5; reasons.push('shared tags'); }
    if (score >= minScore) {
      matches.push({
        id: past.id, title: past.title || 'Untitled',
        score: Math.round(score * 10) / 10, reasons,
        outcome: past.outcome || past.status || 'unknown',
        severity: sevKey(past),
      });
    }
  }
  matches.sort((a, b) => (b.score - a.score) || String(a.id).localeCompare(String(b.id)));
  const top = matches.slice(0, limit);
  return {
    matches: top,
    count: top.length,
    summary: top.length
      ? `${top.length} similar past finding(s); closest is ${top[0].title}.`
      : 'No similar past findings above the match threshold.',
  };
}

/**
 * Recall why a finding was marked a false positive (idea 52846).
 * The recorded reason, decider, and supporting evidence are pulled
 * from the finding and its history into one answer.
 */
export function recallFalsePositiveJustification(finding = {}, options = {}) {
  const status = String(finding.status || '').toLowerCase();
  const isFp = Boolean(finding.falsePositive) || status === 'false-positive' ||
    status === 'dismissed' || status === 'fp';
  const records = options.records || [];
  const record = records.find(r => r.findingId === finding.id) || {};
  const history = (finding.history || []).filter(h =>
    /false|dismiss|fp|not a/i.test(String((h && h.reason) || '')));
  const reason = finding.fpReason || finding.falsePositiveReason ||
    record.reason || (history[0] && history[0].reason) || '';
  const decidedBy = finding.fpDecidedBy || record.decidedBy ||
    (history[0] && history[0].actor) || null;
  const decidedAt = finding.fpDecidedAt || record.decidedAt ||
    (history[0] && history[0].at) || null;
  const evidence = [...(finding.fpEvidence || []), ...(record.evidence || [])];
  const missing = [];
  if (isFp && !reason) missing.push('no recorded reason');
  if (isFp && !evidence.length) missing.push('no supporting evidence recorded');
  if (isFp && !decidedBy) missing.push('no decider recorded');
  return {
    isFalsePositive: isFp,
    reason: reason || (isFp ? '' : 'This finding was not marked a false positive.'),
    decidedBy, decidedAt, evidence, missing,
    confidence: isFp && reason && evidence.length ? 'high' : (isFp ? 'low' : 'n/a'),
  };
}

/**
 * Narrate a proof of concept one step at a time (idea 52847).
 * Recorded steps, requests, or evidence lines become a slow walk:
 * what is sent, what to watch for, and what came back.
 */
export function narratePocSteps(finding = {}, options = {}) {
  const raw = [];
  if (Array.isArray(finding.pocSteps) && finding.pocSteps.length) {
    for (const s of finding.pocSteps) {
      raw.push({
        action: String((s && s.action) || (s && s.request) || 'Send the recorded request'),
        expected: String((s && s.expected) || 'Watch the response for a change'),
        observed: String((s && s.observed) || (s && s.result) || ''),
      });
    }
  } else if (Array.isArray(finding.requests) && finding.requests.length) {
    for (const r of finding.requests) {
      raw.push({
        action: typeof r === 'string' ? r : String((r && r.summary) || 'Send request'),
        expected: 'Compare the response with the normal baseline',
        observed: typeof r === 'string' ? '' : String((r && r.response) || ''),
      });
    }
  } else {
    for (const line of finding.evidence || []) {
      raw.push({
        action: `Review the recorded evidence: ${redact(line).slice(0, 90)}`,
        expected: 'Confirm the evidence matches the claimed effect',
        observed: redact(line).slice(0, 90),
      });
    }
  }
  if (!raw.length && finding.payload) {
    raw.push({
      action: `Send the working test input to ${finding.target || 'the target'}`,
      expected: 'The response should show the claimed effect',
      observed: '',
    });
  }
  const steps = raw.map((s, i) => ({
    step: i + 1,
    narration: `Step ${i + 1}: ${s.action}`,
    action: s.action, expected: s.expected, observed: s.observed,
  }));
  return {
    steps,
    stepCount: steps.length,
    pace: options.pace || 'slow, one request at a time',
    summary: steps.length
      ? `The proof runs in ${steps.length} step(s) on ${finding.target || 'the target'}.`
      : 'No proof steps were recorded for this finding yet.',
  };
}

/**
 * Break the working payload into parts and explain it (idea 52848).
 * Known technique markers are detected in the input, each segment
 * is labelled, and the evidence is cited for why it worked.
 */
export function analyzePayloadAnatomy(finding = {}, options = {}) {
  const payload = String(options.payload || finding.payload || '');
  const techniques = [];
  const segments = [];
  const checks = [
    { re: /'\s*or|union\s+select|--/i, name: 'SQL logic injection',
      why: 'The database treated the input as query logic.' },
    { re: /<script|onerror\s*=|javascript:/i, name: 'Script injection',
      why: 'The page rendered the input as active script.' },
    { re: /\.\.\/|%2e%2e/i, name: 'Path traversal',
      why: 'The server used the input as an unconfined path.' },
    { re: /https?:\/\/|127\.0\.0\.1|localhost/i, name: 'SSRF target',
      why: 'The server fetched an address chosen by input.' },
    { re: /\{\{|\$\{|<%/i, name: 'Template expression',
      why: 'The template engine evaluated input as code.' },
    { re: /[<>"'&;|`$]/, name: 'Special-character breakout',
      why: 'Special characters escaped the data context.' },
  ];;
  for (const check of checks) {
    const hit = payload.match(check.re);
    if (hit) {
      techniques.push(check.name);
      segments.push({ text: hit[0].slice(0, 40), technique: check.name, role: check.why });
    }
  }
  if (!segments.length && payload) {
    segments.push({
      text: payload.slice(0, 40), technique: 'Plain input',
      role: 'No marker matched; the effect came from app logic.',
    });
  }
  const whyItWorked = techniques.length
    ? checks.filter(c => techniques.includes(c.name)).map(c => c.why)
    : ['No technique marker matched the recorded input.'];
  if ((finding.evidence || []).length) {
    whyItWorked.push(`Evidence on record: ${redact(finding.evidence[0]).slice(0, 80)}`);
  }
  return {
    payload: redact(payload),
    techniques,
    segments,
    whyItWorked,
    summary: payload
      ? `${techniques.length || 1} technique part(s) identified in the working input.`
      : 'No payload was recorded for this finding.',
  };
}

/**
 * Brainstorm what a tester should try next (idea 52849).
 * Suggestions follow the finding class, its reachability, and the
 * data involved, ordered so the cheapest high-value checks come first.
 */
export function brainstormNextSteps(finding = {}, options = {}) {
  const limit = Number(options.limit || 6);
  const text = textOf(finding);
  const auth = analyzeAuthRequirement(finding);
  const ideas = [];
  const add = (idea, rationale, effort) => ideas.push({ idea, rationale, effort });
  if (/CWE-89|sqli/i.test(text)) {
    add('Try the same input on sibling search and filter fields',
      'Shared query builders often repeat the same flaw', 'low');
  }
  if (/CWE-79|xss/i.test(text)) {
    add('Test stored and reflected variants in adjacent forms',
      'One rendering path is rarely the only unsafe one', 'low');
  }
  if (/idor|access|CWE-86/i.test(text)) {
    add('Swap object ids between two test accounts',
      'Confirms whether ownership checks exist at all', 'low');
  }
  if (/ssrf|CWE-918/i.test(text)) {
    add('Probe internal metadata and loopback addresses safely',
      'Shows how far the server-side request can reach', 'medium');
  }
  if (!auth.requiresAuth) {
    add('Repeat the proof from a clean network with no session',
      'Proves the issue is open to any internet visitor', 'low');
  }
  if (auth.requiresAuth) {
    add('Repeat the proof with the lowest-privilege account',
      'Shows whether ordinary users are affected', 'low');
  }
  add('Check the same pattern on the mobile and API surfaces',
    'Shared backends repeat findings across clients', 'medium');
  add('Look for a second finding that chains with this one',
    'A chain usually raises impact and payout', 'high');
  add('Capture a baseline response for later regression comparison',
    'A saved baseline makes fix verification fast', 'low');
  const top = ideas.slice(0, limit)
    .map((row, i) => ({ ...row, priority: i + 1 }));
  return {
    ideas: top,
    count: top.length,
    summary: top.length ? `Start with: ${top[0].idea}.` : 'No next steps generated.',
  };
}

/**
 * Generate a regression checklist covering every finding (idea 52850).
 * Each finding contributes its own retest, an auth variant, and a
 * neighbouring-surface check, grouped into one actionable list.
 */
export function generateRegressionChecklist(findings = [], options = {}) {
  const items = [];
  let seq = 0;
  const push = (finding, text, category, required) => {
    seq += 1;
    items.push({
      id: `chk-${seq}`, findingId: finding.id || 'unknown',
      text, category, required: Boolean(required), done: false,
    });
  };
  for (const f of findings || []) {
    const name = f.title || f.id || 'finding';
    push(f, `Re-run the original proof for ${name} and confirm it now fails`, 'retest', true);
    push(f, `Confirm normal use still works after the fix for ${name}`, 'no-regression', true);
    push(f, `Repeat the proof with and without a login for ${name}`, 'auth-variant', false);
    if (options.includeNeighbours !== false) {
      push(f, `Spot-check a neighbouring surface for ${name}`,
        'neighbours', false);
    }
  }
  const byCategory = {};
  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
  }
  return {
    items,
    count: items.length,
    requiredCount: items.filter(i => i.required).length,
    byCategory,
    summary: `${items.length} checklist item(s) for ${(findings || []).length} finding(s).`,
  };
}

/**
 * Draft ticket text for a finding (idea 52851).
 * Summary, reproduction, impact, and acceptance criteria are filled
 * from the finding so the ticket can be pasted as-is.
 */
export function draftTicketText(finding = {}, options = {}) {
  const sev = sevKey(finding);
  const priority = sev === 'critical' ? 'Highest' : sev === 'high' ? 'High'
    : sev === 'medium' ? 'Medium' : 'Low';
  const narration = narratePocSteps(finding);
  const reproSteps = narration.steps.length
    ? narration.steps.map(s => `${s.step}. ${s.action}`)
    : ['1. Open the affected page', '2. Submit the recorded test input',
      '3. Observe the effect described in the evidence'];
  const labels = [...new Set([
    'security', sev, ...(options.labels || []), ...(finding.tags || []),
  ].map(s => String(s).toLowerCase()))];
  const summary = `[Security][${sev}] ${finding.title || 'Untitled finding'}` +
    (finding.target ? ` on ${finding.target}` : '');
  const description = [
    `Impact: ${finding.impact || 'See the finding evidence for the demonstrated effect.'}`,
    `Evidence: ${(finding.evidence || []).map(e => redact(e)).join('; ') || 'see attached proof'}`,
    `Classification: ${finding.cwe || 'unclassified'}`,
  ].join('\n');
  return {
    project: options.project || 'SEC',
    summary,
    description,
    reproSteps,
    acceptanceCriteria: [
      'The original proof no longer produces the effect',
      'Normal behaviour for legitimate users is unchanged',
      'A regression test covering this case passes',
    ],
    priority,
    labels,
  };
}

const TRANSLATIONS = {
  es: {
    severity: {
      critical: 'crítica', high: 'alta', medium: 'media',
      low: 'baja', info: 'informativa',
    },
    template: (title, sev, target) =>
      `[${sev}] ${title} en ${target}. Consulte la evidencia adjunta para el efecto demostrado.`,
    impact: 'Impacto',
    evidence: 'Evidencia',
    glossary: { finding: 'hallazgo', severity: 'gravedad', target: 'objetivo' },
  },
  hi: {
    severity: {
      critical: 'गंभीर', high: 'उच्च', medium: 'मध्यम',
      low: 'कम', info: 'जानकारी',
    },
    template: (title, sev, target) =>
      `[${sev}] ${target} : ${title}`,
    impact: 'प्रभाव',
    evidence: 'साक्ष्य',
    glossary: { finding: 'खोज', severity: 'गंभीरता' },
  },
  fr: {
    severity: {
      critical: 'critique', high: 'élevée', medium: 'moyenne',
      low: 'faible', info: 'information',
    },
    template: (title, sev, target) =>
      `[${sev}] ${title} sur ${target}. Voir les preuves jointes pour l'effet démontré.`,
    impact: 'Impact',
    evidence: 'Preuve',
    glossary: { finding: 'résultat', severity: 'gravité', target: 'cible' },
  },
};

/**
 * Translate a finding summary for another language (idea 52852).
 * Severity words, labels, and the summary template are translated
 * from the built-in tables; unknown languages are reported plainly.
 */
export function translateFinding(finding = {}, targetLanguage = 'es', options = {}) {
  const lang = String(targetLanguage || 'es').toLowerCase().slice(0, 2);
  const pack = TRANSLATIONS[lang];
  const sev = sevKey(finding);
  if (!pack) {
    return {
      language: lang, supported: false,
      translatedSummary: '',
      labels: {},
      glossary: {},
      note: `Language "${lang}" is not in the built-in table (es, hi, fr).`,
      audience: options.audience || 'team',
    };
  }
  const sevWord = pack.severity[sev] || sev;
  return {
    language: lang,
    supported: true,
    translatedTitle: finding.title || 'Untitled',
    translatedSummary: pack.template(
      finding.title || 'Untitled', sevWord, finding.target || 'target'),
    translatedImpact: `${pack.impact}: ${finding.impact || sevWord}`,
    labels: { severity: sevWord, evidence: pack.evidence },
    glossary: pack.glossary,
    note: 'Title and impact terms are carried over; labels and severity are translated.',
  };
}

/**
 * Map a finding to compliance controls (idea 52853).
 * Classification, data, and theme matches produce SOC 2, ISO 27001,
 * and PCI DSS references with a short reason for each.
 */
export function mapComplianceControls(finding = {}, options = {}) {
  const text = textOf(finding);
  const wanted = (options.frameworks || ['SOC 2', 'ISO 27001', 'PCI DSS'])
    .map(s => String(s).toLowerCase());
  const mappings = [];
  for (const row of COMPLIANCE_MAP) {
    if (!row.match.test(text)) continue;
    const entry = { reason: `Matched theme in: ${finding.title || finding.cwe || 'finding'}` };
    if (wanted.some(w => w.includes('soc'))) entry.soc2 = row.soc2;
    if (wanted.some(w => w.includes('iso'))) entry.iso = row.iso;
    if (wanted.some(w => w.includes('pci'))) entry.pci = row.pci;
    mappings.push(entry);
  }
  if (!mappings.length) {
    mappings.push({
      soc2: 'CC7.1 system operations',
      iso: 'A.8.34 protection of information systems',
      pci: 'PCI DSS 6.5 secure development',
      reason: 'General control set; no specific theme matched',
    });
  }
  return {
    mappings,
    frameworksCovered: [...new Set(mappings.flatMap(m =>
      ['soc2' in m ? 'SOC 2' : '', 'iso' in m ? 'ISO 27001' : '',
        'pci' in m ? 'PCI DSS' : ''].filter(Boolean)))],
    summary: `${mappings.length} control mapping(s) for ${finding.title || 'the finding'}.`,
  };
}

/**
 * Estimate a bounty range for a finding (idea 52854).
 * A severity base is adjusted for no-login reach, exposed data, and
 * any program history supplied by the caller.
 */
export function estimateBountyValue(finding = {}, options = {}) {
  const base = { critical: 2500, high: 1000, medium: 350, low: 100, info: 0 };
  const sev = sevKey(finding);
  let mid = base[sev] ?? 0;
  const rationale = [`${sev} base of ${mid}`];
  const auth = analyzeAuthRequirement(finding);
  if (!auth.requiresAuth && mid > 0) {
    mid *= 1.4;
    rationale.push('reachable without login (+40%)');
  }
  const data = buildDataAtRiskInventory([finding]);
  if (data.inventory.length) {
    mid *= 1 + Math.min(0.5, data.inventory.length * 0.15);
    rationale.push('exposed data raises the value');
  }
  const history = (options.history || []).filter(h => Number(h.amount) > 0);
  if (history.length) {
    const amounts = history.map(h => Number(h.amount)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    mid = Math.round((mid + median) / 2);
    rationale.push(`blended with program median of ${median}`);
  }
  mid = Math.round(mid);
  return {
    estimateLow: Math.round(mid * 0.7),
    estimateHigh: Math.round(mid * 1.3),
    midpoint: mid,
    currency: options.currency || 'USD',
    rationale,
    confidence: history.length >= 3 ? 'high' : (history.length ? 'medium' : 'low'),
  };
}

/**
 * Judge whether two findings are likely duplicates (idea 52855).
 * Wording, classification, target, and shared evidence score the
 * suspicion, with the concrete overlaps listed for the reviewer.
 */
export function assessDuplicateSuspicion(finding = {}, other = [], options = {}) {
  const candidates = Array.isArray(other) ? other : [other];
  const threshold = Number(options.threshold || 55);
  const comparisons = [];
  for (const cand of candidates) {
    if (!cand) continue;
    let score = overlapScore(textOf(finding), textOf(cand));
    const shared = [];
    if (finding.cwe && cand.cwe && finding.cwe === cand.cwe) {
      score += 35; shared.push(`same classification ${finding.cwe}`);
    }
    if (finding.target && cand.target && finding.target === cand.target) {
      score += 15; shared.push('same target');
    }
    const sharedEvidence = (finding.evidence || [])
      .filter(e => (cand.evidence || []).includes(e));
    if (sharedEvidence.length) { score += 20; shared.push('identical evidence lines'); }
    comparisons.push({
      id: cand.id, title: cand.title || 'Untitled',
      score: Math.round(score * 10) / 10, shared,
    });
  }
  comparisons.sort((a, b) => b.score - a.score);
  const best = comparisons[0] || null;
  const isDup = Boolean(best && best.score >= threshold);
  return {
    isLikelyDuplicate: isDup,
    bestMatch: best,
    comparisons,
    recommendation: isDup
      ? `Likely duplicate of ${best.id}; merge evidence and close as duplicate.`
      : 'No candidate is close enough; keep as a separate finding.',
  };
}

/**
 * Trace a finding to its likely root cause (idea 52856).
 * Classification and wording select the cause family; the recorded
 * evidence is cited and a fix direction is attached.
 */
export function analyzeRootCause(finding = {}, options = {}) {
  const text = textOf(finding);
  const hit = ROOT_CAUSES.find(r => r.match.test(text));
  const factors = [];
  if (!analyzeAuthRequirement(finding).requiresAuth) {
    factors.push('the flaw is reachable without a login, widening exposure');
  }
  if ((finding.evidence || []).length >= 2) {
    factors.push('multiple evidence lines point at the same weak spot');
  }
  if (/legacy|old|deprecated/i.test(text)) {
    factors.push('a legacy component appears to be involved');
  }
  return {
    primaryCause: hit ? hit.category : 'Application logic did not validate a trust boundary',
    category: finding.cwe || 'unclassified',
    contributingFactors: factors,
    evidence: (finding.evidence || []).map(e => redact(e).slice(0, 80)),
    fixDirection: hit ? hit.fix :
      'Add server-side validation at the point where the input is trusted.',
    confidence: hit ? 'high' : 'medium',
    scope: options.scope || 'single finding',
  };
}

/**
 * Give concrete steps to verify a fix (idea 52857).
 * The original proof is replayed first, then auth variants and a
 * normal-use check confirm the fix without breaking the feature.
 */
export function buildFixVerificationGuidance(finding = {}, options = {}) {
  const narration = narratePocSteps(finding);
  const firstAction = narration.steps.length
    ? narration.steps[0].action : 'Re-run the recorded proof';
  const steps = [
    { step: 1, action: firstAction, expected: 'Proof fails safely' },
    {
      step: 2, action: 'Repeat the full proof end to end',
      expected: 'No step reproduces the original effect',
    },
    {
      step: 3, action: 'Use the feature normally as a user',
      expected: 'Legitimate behaviour is unchanged',
    },
  ];
  if (options.includeAuthVariants !== false) {
    steps.push({
      step: 4, action: 'Repeat the proof with and without a login',
      expected: 'Both variants are safely rejected',
    });
    steps.push({
      step: 5, action: 'Check a neighbouring surface',
      expected: 'No sibling surface shows the effect',
    });
  }
  return {
    steps,
    passCriteria: [
      'Original proof produces no effect',
      'Normal use passes',
      'No neighbouring surface reproduces the flaw',
    ],
    summary: `Verify ${finding.title || 'the finding'} in ${steps.length} step(s).`,
  };
}

/**
 * Suggest regression tests for a finding (idea 52858).
 * Negative, boundary, auth-variant, and happy-path cases are
 * generated from the finding class so coverage is systematic.
 */
export function suggestTestCases(finding = {}, options = {}) {
  const limit = Number(options.limit || 6);
  const name = finding.title || 'the finding';
  const cases = [
    { name: `Original proof for ${name} is rejected`, type: 'negative',
      setup: 'Use the recorded test input', expected: 'Blocked safely' },
    { name: `Normal input for ${name} still works`, type: 'happy-path',
      setup: 'Use a legitimate value', expected: 'Behaviour as before' },
    { name: `Boundary values around ${name}`, type: 'boundary',
      setup: 'Empty, long, and special-character inputs',
      expected: 'No error leaks and no unsafe effect' },
    { name: `Unauthenticated attempt at ${name}`, type: 'auth',
      setup: 'Repeat without any session', expected: 'Rejected' },
    { name: `Low-privilege attempt at ${name}`, type: 'auth',
      setup: 'Repeat as the lowest role', expected: 'Rejected' },
    { name: `Neighbouring surface check for ${name}`, type: 'coverage',
      setup: 'Same input on a sibling field', expected: 'Sibling safe' },
  ].slice(0, limit);
  return {
    cases,
    count: cases.length,
    coverage: [...new Set(cases.map(c => c.type))],
    summary: `${cases.length} test case(s) suggested for ${name}.`,
  };
}

/**
 * Summarise a whole hunt in exactly three bullets (idea 52859).
 * Scope, the most serious outcome, and the recommended next move
 * are each compressed into a single standup-ready line.
 */
export function summarizeHuntThreeBullets(findings = [], options = {}) {
  const list = findings || [];
  const bySev = {};
  for (const f of list) bySev[sevKey(f)] = (bySev[sevKey(f)] || 0) + 1;
  const ranked = prioritizeFixes(list);
  const unauth = listUnauthenticatedFindings(list);
  const top = ranked.topPick;
  const label = options.huntLabel || options.target || 'this hunt';
  const bullets = [
    `${label}: ${list.length} finding(s) recorded ` +
      `(${bySev.critical || 0} critical, ${bySev.high || 0} high).`,
    top
      ? `Most serious: ${top.title} (${top.severity}); fix this first.`
      : 'No findings were recorded in this hunt.',
    unauth.count
      ? `${unauth.count} finding(s) work without a login and should be patched first.`
      : 'Nothing found is reachable without a login; proceed in severity order.',
  ];
  return {
    bullets,
    counts: { total: list.length, bySeverity: bySev, unauthenticated: unauth.count },
    summary: bullets.join(' '),
  };
}

/**
 * List everything exploitable without a login (idea 52860).
 * Auth analysis runs over the set, matches are ranked by the same
 * fix-first scoring, and the rest are reported as excluded.
 */
export function listUnauthenticatedFindings(findings = [], options = {}) {
  const open = [];
  const excludedIds = [];
  for (const f of findings || []) {
    const auth = analyzeAuthRequirement(f);
    if (auth.exploitableWithoutLogin) {
      open.push({
        id: f.id, title: f.title || 'Untitled', severity: sevKey(f),
        target: f.target || '', confidence: auth.confidence,
        evidence: auth.evidence,
      });
    } else {
      excludedIds.push(f.id);
    }
  }
  const ranked = prioritizeFixes(
    (findings || []).filter(f => open.some(o => o.id === f.id)), options).ranked;
  const order = new Map(ranked.map(r => [r.id, r.rank]));
  open.sort((a, b) => (order.get(a.id) || 99) - (order.get(b.id) || 99));
  const prioritized = open.map((row, i) => ({ ...row, priority: i + 1 }));
  return {
    findings: prioritized,
    count: prioritized.length,
    excludedIds,
    summary: prioritized.length
      ? `${prioritized.length} finding(s) exploitable without ` +
        `a login; top: ${prioritized[0].title}.`
      : 'No findings are exploitable without a login.',
  };
}
