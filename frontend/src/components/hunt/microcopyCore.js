/**
 * microcopyCore.js — Forge wave 11, ideas 50401–50440.
 *
 * Pure, testable logic behind the tooltips / help / microcopy suite:
 * every tooltip's words, every "why am I seeing this" explanation, the
 * huntability meter, the cron plain-English helper, fix-oriented
 * validation, glossary lookup, and an interactive CVSS 3.1 base-score
 * calculator (FIRST spec) for the CVSS breakdown popover.
 *
 * No DOM, no React — runnable under `node --test`.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* 50401 — pause-button tooltip                                          */
/* ------------------------------------------------------------------ */

export const PAUSE_TOOLTIP =
  'Pauses after the current step — nothing is lost. Resume anytime from the same spot.';

/* ------------------------------------------------------------------ */
/* 50402 — empty-PoC hint                                                */
/* ------------------------------------------------------------------ */

export const EMPTY_POC_HINT =
  'PoC steps appear here once validation finishes. They are generated from the confirmed finding, not a template.';

/* ------------------------------------------------------------------ */
/* 50403 — shortcut hints in tooltips                                   */
/* ------------------------------------------------------------------ */

export function shortcutTooltip(label, key) {
  if (!label) return '';
  return key ? `${label} (${key})` : label;
}

/* ------------------------------------------------------------------ */
/* 50404 — chain-icon tooltip                                            */
/* ------------------------------------------------------------------ */

export const CHAIN_ICON_TOOLTIP =
  'Findings are linked when one finding enables the next — e.g. an info-disclosure that leaks a session token, which then enables an account takeover. Chains are found by capability-graph reasoning over confirmed findings.';

/* ------------------------------------------------------------------ */
/* 50405 — per-page help panel (content model)                           */
/* ------------------------------------------------------------------ */

export const HELP_DOCS = {
  hunt: [
    { id: 'hunt-start', title: 'Starting a hunt', url: '/docs/hunt#start' },
    { id: 'hunt-phases', title: 'Hunt phases explained', url: '/docs/hunt#phases' },
    { id: 'hunt-pause', title: 'Pause and resume', url: '/docs/hunt#pause' },
  ],
  findings: [
    { id: 'find-sev', title: 'Severity levels', url: '/docs/findings#severity' },
    { id: 'find-triage', title: 'Triaging findings', url: '/docs/findings#triage' },
    { id: 'find-fp', title: 'False-positive handling', url: '/docs/findings#false-positives' },
  ],
  models: [
    {
      id: 'models-slots',
      title: 'Brain slots (Vision / Grounding / Hacking)',
      url: '/docs/models#slots',
    },
    { id: 'models-local', title: 'Running a local model', url: '/docs/models#local' },
  ],
  agent: [
    { id: 'agent-modes', title: 'Chat / Plan / Build / Control modes', url: '/docs/agent#modes' },
    { id: 'agent-voice', title: 'Infinity Voice setup', url: '/docs/agent#voice' },
  ],
  reports: [
    { id: 'reports-gen', title: 'Generating reports', url: '/docs/reports#generate' },
    { id: 'reports-share', title: 'Sharing and permissions', url: '/docs/reports#share' },
  ],
  dashboard: [
    { id: 'dash-widgets', title: 'Working with widgets', url: '/docs/dashboard#widgets' },
  ],
};

export function helpDocsFor(page) {
  return HELP_DOCS[page] ? [...HELP_DOCS[page]] : [];
}

/* ------------------------------------------------------------------ */
/* 50406 — ETA tooltip basis                                             */
/* ------------------------------------------------------------------ */

export function etaBasisText(huntsUsed) {
  const n = Number(huntsUsed);
  if (Number.isFinite(n) && n > 0) {
    return `Estimated from your last ${n} hunt${n === 1 ? '' : 's'}' phase speeds.`;
  }
  return 'Estimated from typical hunt phase speeds. It sharpens as you run more hunts.';
}

/* ------------------------------------------------------------------ */
/* 50407 — false-positive tag explainer                                  */
/* ------------------------------------------------------------------ */

const FP_SIGNAL_TEXT = {
  'duplicate-signature': 'Matches a known duplicate signature from a previous hunt.',
  'low-confidence': 'Detector confidence is below the auto-confirm threshold.',
  'scanner-artifact': 'Pattern matches a known scanner artifact, not real behavior.',
  'benign-header': 'Value appears in benign headers on this target class.',
  'test-data': 'Response body contains known test/seed data.',
  'rate-limit-noise': 'Finding coincided with rate-limiting, which distorts responses.',
};

export function fpTagExplainer(signals) {
  const list = Array.isArray(signals) ? signals : [];
  const explained = list.map(s => ({
    signal: s,
    text: FP_SIGNAL_TEXT[s] || 'Flagged by the false-positive filter.',
  }));
  return {
    title: 'Why is this a false-positive suspect?',
    signals: explained,
    footer: 'Review the signals — mark confirmed if the finding is real.',
  };
}

/* ------------------------------------------------------------------ */
/* 50408 — interactive CVSS 3.1 breakdown (FIRST spec)                   */
/* ------------------------------------------------------------------ */

const CVSS31 = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  C: { N: 0, L: 0.22, H: 0.56 },
  I: { N: 0, L: 0.22, H: 0.56 },
  A: { N: 0, L: 0.22, H: 0.56 },
};

function prValue(pr, scope) {
  if (pr === 'N') return 0.85;
  if (pr === 'L') return scope === 'C' ? 0.68 : 0.62;
  return scope === 'C' ? 0.5 : 0.27; // H
}

export const CVSS31_METRICS = {
  AV: {
    label: 'Attack Vector',
    options: ['N', 'A', 'L', 'P'],
    help: { N: 'Network', A: 'Adjacent network', L: 'Local', P: 'Physical' },
  },
  AC: { label: 'Attack Complexity', options: ['L', 'H'], help: { L: 'Low', H: 'High' } },
  PR: {
    label: 'Privileges Required',
    options: ['N', 'L', 'H'],
    help: { N: 'None', L: 'Low', H: 'High' },
  },
  UI: { label: 'User Interaction', options: ['N', 'R'], help: { N: 'None', R: 'Required' } },
  S: { label: 'Scope', options: ['U', 'C'], help: { U: 'Unchanged', C: 'Changed' } },
  C: {
    label: 'Confidentiality',
    options: ['N', 'L', 'H'],
    help: { N: 'None', L: 'Low', H: 'High' },
  },
  I: { label: 'Integrity', options: ['N', 'L', 'H'], help: { N: 'None', L: 'Low', H: 'High' } },
  A: { label: 'Availability', options: ['N', 'L', 'H'], help: { N: 'None', L: 'Low', H: 'High' } },
};

function roundUp1(n) {
  // FIRST "roundup": smallest 1-decimal number >= n. The spec's reference
  // implementation treats values within 1e-5 of a 1-decimal boundary as
  // exact (int_input % 10000 === 0 at 1e-5 granularity); mirror that here.
  return Math.ceil(n * 10 - 1e-5) / 10;
}

export function cvss31Score(m) {
  const scope = m.S;
  const c = CVSS31.C[m.C] ?? 0;
  const i = CVSS31.I[m.I] ?? 0;
  const a = CVSS31.A[m.A] ?? 0;
  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);
  if (iscBase === 0) return { score: 0.0, severity: 'None', vector: cvss31Vector(m) };

  let impact;
  if (scope === 'U') {
    impact = 6.42 * iscBase;
  } else {
    impact = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15);
  }
  const exploitability =
    8.22 *
    (CVSS31.AV[m.AV] ?? 0) *
    (CVSS31.AC[m.AC] ?? 0) *
    prValue(m.PR, scope) *
    (CVSS31.UI[m.UI] ?? 0);

  let base;
  if (scope === 'U') base = roundUp1(Math.min(impact + exploitability, 10));
  else base = roundUp1(Math.min(1.08 * (impact + exploitability), 10));

  return { score: base, severity: cvss31Severity(base), vector: cvss31Vector(m) };
}

export function cvss31Severity(score) {
  if (score >= 9.0) return 'Critical';
  if (score >= 7.0) return 'High';
  if (score >= 4.0) return 'Medium';
  if (score > 0) return 'Low';
  return 'None';
}

export function cvss31Vector(m) {
  return `CVSS:3.1/AV:${m.AV}/AC:${m.AC}/PR:${m.PR}/UI:${m.UI}/S:${m.S}/C:${m.C}/I:${m.I}/A:${m.A}`;
}

export function parseCvss31Vector(vector) {
  const out = { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'N', I: 'N', A: 'N' };
  if (typeof vector !== 'string') return out;
  for (const part of vector.split('/')) {
    const [k, v] = part.split(':');
    if (k && v && k in out && CVSS31_METRICS[k].options.includes(v)) out[k] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 50409 — tier-badge tooltip                                            */
/* ------------------------------------------------------------------ */

export const TIER_BADGE_TOOLTIP =
  'Infinity tier: unlimited hunts, unlimited findings, priority brain queue, and full report exports. Usage is fair-use — sustained abuse of the brain queue may be throttled.';

/* ------------------------------------------------------------------ */
/* 50410 — scope-input guidance                                          */
/* ------------------------------------------------------------------ */

export const SCOPE_GUIDANCE = [
  { format: 'Domain', example: 'example.com', note: 'Covers the domain and its subdomains.' },
  {
    format: 'URL',
    example: 'https://app.example.com/admin',
    note: 'Limits the hunt to this path and below.',
  },
  {
    format: 'CIDR',
    example: '203.0.113.0/24',
    note: 'Covers the whole IP range — confirm you own it.',
  },
];

/* ------------------------------------------------------------------ */
/* 50411 — worker-lane tooltip                                           */
/* ------------------------------------------------------------------ */

export const WORKER_LANE_TOOLTIP =
  'Each lane is an isolated test worker: its own rate limits, its own session, its own findings. A crash in one lane never affects the others.';

/* ------------------------------------------------------------------ */
/* 50412 — notification why-link                                         */
/* ------------------------------------------------------------------ */

const TRIGGER_RULES = {
  'finding-critical': 'A critical finding was confirmed on a hunt you are watching.',
  'hunt-complete': 'A hunt you started finished running.',
  'hunt-stalled': 'A hunt made no progress for 10 minutes, so the agent paused it.',
  'report-ready': 'A report you requested finished generating.',
  'model-downloaded': 'A brain model you queued finished downloading.',
  'quota-warning': 'You used 80% of this month’s scan quota.',
  'comment-mention': 'Someone mentioned you in a hunt comment.',
  'share-revoked': 'A share link you created was revoked or expired.',
};

export function triggerRuleText(ruleId) {
  return TRIGGER_RULES[ruleId] || 'Triggered by a rule on your account.';
}

/* ------------------------------------------------------------------ */
/* 50413 — snapshot tooltip                                              */
/* ------------------------------------------------------------------ */

export function snapshotLabel(savedAtMs, nowMs = Date.now()) {
  const diff = Math.max(0, nowMs - Number(savedAtMs));
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hunt state saved just now.';
  if (mins < 60) return `Hunt state saved ${mins} min ago.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hunt state saved ${hours} h ago.`;
  return `Hunt state saved ${Math.floor(hours / 24)} d ago.`;
}

/* ------------------------------------------------------------------ */
/* 50414 — cron-expression helper                                        */
/* ------------------------------------------------------------------ */

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function cronToEnglish(cron) {
  if (typeof cron !== 'string') return 'No schedule set.';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return 'Custom schedule — expression kept as-is.';
  const [min, hr, dom, mon, dow] = parts;

  const atTime = (m, h) => {
    if (m === '*' || h === '*') return null;
    const mm = Number(m);
    const hh = Number(h);
    if (!Number.isInteger(mm) || !Number.isInteger(hh) || mm < 0 || mm > 59 || hh < 0 || hh > 23)
      return null;
    return `${pad2(hh)}:${pad2(mm)}`;
  };

  if (min.startsWith('*/') && hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    const every = Number(min.slice(2));
    if (Number.isInteger(every) && every > 0)
      return `Every ${every} minute${every === 1 ? '' : 's'}.`;
  }
  if (hr === '*' && dom === '*' && mon === '*' && dow === '*') {
    const mm = Number(min);
    if (Number.isInteger(mm) && mm >= 0 && mm < 60) return `Every hour at :${pad2(mm)}.`;
  }
  if (dom === '*' && mon === '*' && dow === '*') {
    const t = atTime(min, hr);
    if (t) return `Every day at ${t}.`;
  }
  if (dom === '*' && mon === '*') {
    const t = atTime(min, hr);
    if (t) {
      const days =
        dow === '*'
          ? null
          : String(dow)
              .split(',')
              .map(d => DOW_NAMES[Number(d)])
              .filter(Boolean);
      if (days && days.length) return `Every ${days.join(', ')} at ${t}.`;
      if (dow === '*') return `Every day at ${t}.`;
    }
  }
  if (dow === '*' && mon === '*') {
    const t = atTime(min, hr);
    if (t && dom !== '*') {
      const d = Number(dom);
      if (Number.isInteger(d) && d >= 1 && d <= 31) return `On day ${d} of every month at ${t}.`;
    }
  }
  if (dow === '*' && dom === '*') {
    const t = atTime(min, hr);
    if (t && mon !== '*') {
      const mo = Number(mon);
      if (Number.isInteger(mo) && mo >= 1 && mo <= 12)
        return `Every day in ${MONTH_NAMES[mo - 1]} at ${t}.`;
    }
  }
  return 'Custom schedule — expression kept as-is.';
}

/* ------------------------------------------------------------------ */
/* 50415 — dedup tooltip                                                 */
/* ------------------------------------------------------------------ */

export function dedupText(mergedCount, ruleName) {
  const n = Number(mergedCount) || 0;
  const rule = ruleName ? ` — rule: ${ruleName}` : '';
  return `Merged with ${n} similar finding${n === 1 ? '' : 's'}${rule}. The strongest evidence is kept; nothing is deleted.`;
}

/* ------------------------------------------------------------------ */
/* 50416 — scrubber help popover                                         */
/* ------------------------------------------------------------------ */

export const SCRUBBER_HELP = [
  { keys: 'Drag', text: 'Scrub the timeline to any moment.' },
  { keys: '← / →', text: 'Step one event backward or forward.' },
  { keys: 'Click event', text: 'Jump straight to that event.' },
  { keys: '[ / ]', text: 'Scrub by event without leaving the list.' },
];

/* ------------------------------------------------------------------ */
/* 50417 — model-slot tooltips                                           */
/* ------------------------------------------------------------------ */

export const MODEL_SLOT_TOOLTIPS = {
  vision: 'Vision brain: looks at the page — layout, forms, buttons — and describes what it sees.',
  grounding: 'Grounding brain: turns "click the login button" into exact screen coordinates.',
  hacking: 'Hacking brain: reasons about vulnerabilities, picks tools, and validates findings.',
};

/* ------------------------------------------------------------------ */
/* 50418 — tracking-param hint                                           */
/* ------------------------------------------------------------------ */

export function trackingParamHint(url) {
  if (typeof url !== 'string') return null;
  let params = [];
  try {
    params = [...new URL(url).searchParams.keys()];
  } catch {
    return null;
  }
  const tracking = params.filter(p => /^utm_|^fbclid$|^gclid$|^msclkid$|^mc_/i.test(p));
  if (!tracking.length) return null;
  return `We’ll strip ${tracking.length} tracking parameter${tracking.length === 1 ? '' : 's'} (${tracking.join(', ')}) automatically — they don’t change what the hunt sees.`;
}

/* ------------------------------------------------------------------ */
/* 50419 — ask-agent examples                                            */
/* ------------------------------------------------------------------ */

export const ASK_AGENT_EXAMPLES = [
  'What is the agent doing right now?',
  'Why is this finding marked critical?',
  'What should I fix first?',
];

/* ------------------------------------------------------------------ */
/* 50420 — fix-oriented validation                                       */
/* ------------------------------------------------------------------ */

export function validateTargetInput(value) {
  const v = String(value ?? '').trim();
  if (!v) {
    return {
      ok: false,
      error: 'Target is empty.',
      fix: 'Paste a full URL, e.g. https://example.com',
    };
  }
  if (/\s/.test(v)) {
    return {
      ok: false,
      error: 'Targets can’t contain spaces.',
      fix: 'Remove spaces — e.g. https://example.com/admin',
    };
  }
  const schemeMatch = v.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) {
    return { ok: false, error: 'Missing scheme.', fix: 'Add https:// — e.g. https://example.com' };
  }
  const scheme = schemeMatch[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    return {
      ok: false,
      error: `“${scheme}:” isn’t a huntable scheme.`,
      fix: 'Use http:// or https://',
    };
  }
  try {
    const u = new URL(v);
    if (!u.hostname || !u.hostname.includes('.')) {
      return {
        ok: false,
        error: 'That hostname looks incomplete.',
        fix: 'Check the domain spelling — e.g. https://example.com',
      };
    }
  } catch {
    return {
      ok: false,
      error: 'That URL doesn’t parse.',
      fix: 'Check for typos — e.g. https://example.com',
    };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 50421 — export-format tooltip                                         */
/* ------------------------------------------------------------------ */

export const EXPORT_FORMATS = [
  {
    format: 'PDF',
    tradeoff: 'Best for sharing with clients — fixed layout, includes evidence screenshots.',
  },
  {
    format: 'Markdown',
    tradeoff: 'Best for engineers — pastes into tickets and docs, easy to diff.',
  },
  {
    format: 'JSON',
    tradeoff: 'Best for tooling — full machine-readable finding data for pipelines.',
  },
];

/* ------------------------------------------------------------------ */
/* 50422 — compliance-badge links                                        */
/* ------------------------------------------------------------------ */

export const COMPLIANCE_REQUIREMENTS = {
  'OWASP-Top-10': 'Maps findings to the OWASP Top 10 categories they violate.',
  'PCI-DSS': 'Flags findings relevant to PCI DSS control objectives.',
  'SOC-2': 'Flags findings relevant to SOC 2 trust-service criteria.',
  GDPR: 'Flags findings that expose personal data handling risks.',
};

/* ------------------------------------------------------------------ */
/* 50423 — collaborator tooltips                                         */
/* ------------------------------------------------------------------ */

export function collaboratorLine(user) {
  const u = user || {};
  const name = u.name || 'Unknown';
  const role = u.role || 'viewer';
  const action = u.lastAction ? ` — last: ${u.lastAction}` : '';
  return `${name} (${role})${action}`;
}

/* ------------------------------------------------------------------ */
/* 50424 — confidence-slider help                                        */
/* ------------------------------------------------------------------ */

export function confidenceSliderHelp(confidence) {
  const c = Number(confidence);
  if (!Number.isFinite(c)) return 'Drag to set the minimum confidence for shown findings.';
  if (c < 60) return 'Below 60% usually needs human review — expect noise down here.';
  if (c < 85) return 'A balanced range — most real findings, little noise.';
  return 'Only high-confidence findings — you may miss real but subtle issues.';
}

/* ------------------------------------------------------------------ */
/* 50425 — findings-badge tooltip                                        */
/* ------------------------------------------------------------------ */

export function findingsBadgeText(newCount) {
  const n = Number(newCount) || 0;
  if (n <= 0) return 'No new findings since you last opened this hunt.';
  return `${n} new finding${n === 1 ? '' : 's'} since you last opened this hunt.`;
}

/* ------------------------------------------------------------------ */
/* 50426 — regenerate-button hint                                        */
/* ------------------------------------------------------------------ */

export const REGENERATE_HINT =
  'Regenerating rebuilds the report from current findings. It takes ~30 seconds and counts as one brain request on metered tiers.';

/* ------------------------------------------------------------------ */
/* 50427 — archived-hunt tooltip                                         */
/* ------------------------------------------------------------------ */

export const ARCHIVED_HUNT_TOOLTIP =
  'This hunt is archived and read-only. Duplicate it to re-run with fresh results.';

/* ------------------------------------------------------------------ */
/* 50428 — what-happens-next stepper                                     */
/* ------------------------------------------------------------------ */

export const HUNT_PHASE_PREVIEWS = [
  { phase: 'Recon', preview: 'Maps subdomains, tech stack, and attack surface.' },
  { phase: 'Scan', preview: 'Probes endpoints for known vulnerability patterns.' },
  { phase: 'Validate', preview: 'Confirms real findings and filters false positives.' },
  { phase: 'Report', preview: 'Writes the PoC-backed report you can share.' },
];

/* ------------------------------------------------------------------ */
/* 50429 — terminal-copy tooltip                                         */
/* ------------------------------------------------------------------ */

export function terminalCopyText(withTimestamps) {
  return withTimestamps
    ? 'Copies the terminal output including timestamps.'
    : 'Copies the terminal output without timestamps — cleaner for pasting.';
}

/* ------------------------------------------------------------------ */
/* 50430 — jargon glossary                                               */
/* ------------------------------------------------------------------ */

export const GLOSSARY = {
  SSRF: 'Server-Side Request Forgery — tricking the server into making requests it shouldn’t.',
  IDOR: 'Insecure Direct Object Reference — accessing other users’ objects by guessing IDs.',
  XSS: 'Cross-Site Scripting — injecting scripts that run in another user’s browser.',
  SQLi: 'SQL Injection — smuggling database commands through user input.',
  CSRF: 'Cross-Site Request Forgery — forcing a logged-in user’s browser to act for you.',
  RCE: 'Remote Code Execution — running commands on the target server.',
  LFI: 'Local File Inclusion — reading server files through a vulnerable parameter.',
  SSTI: 'Server-Side Template Injection — injecting template code that executes server-side.',
  JWT: 'JSON Web Token — a signed token carrying identity claims.',
  CORS: 'Cross-Origin Resource Sharing — rules for which sites may call an API.',
  WAF: 'Web Application Firewall — filters malicious traffic before it reaches the app.',
  CVE: 'A publicly catalogued vulnerability with a unique ID.',
  CVSS: 'A 0–10 score rating vulnerability severity.',
  PoC: 'Proof of Concept — a minimal demo that the bug is real.',
  FP: 'False Positive — a finding that looks like a bug but isn’t.',
  '2FA': 'Two-Factor Authentication — a second login check beyond the password.',
  OAuth: 'A protocol for “log in with” third-party identity providers.',
  SSO: 'Single Sign-On — one login for many apps.',
  SLA: 'Service-Level Agreement — the promised response/fix time policy.',
  CIDR: 'IP-range notation like 203.0.113.0/24.',
};

export function glossary(term) {
  if (!term) return null;
  const hit = GLOSSARY[String(term).toUpperCase()];
  return hit || null;
}

/* ------------------------------------------------------------------ */
/* 50431 — theme hover previews (data model)                             */
/* ------------------------------------------------------------------ */

export const THEME_PREVIEWS = [
  { name: 'Void', bg: '#0a0a12', fg: '#e8e8f0', accent: '#7c6cf0' },
  { name: 'Ember', bg: '#120a0a', fg: '#f0e8e8', accent: '#f06c6c' },
  { name: 'Abyss', bg: '#0a1012', fg: '#e8f0f0', accent: '#6cc8f0' },
];

/* ------------------------------------------------------------------ */
/* 50432 — bulk-action hint                                              */
/* ------------------------------------------------------------------ */

export function bulkHint(selectedCount) {
  const n = Number(selectedCount) || 0;
  return `Applies to the ${n} selected finding${n === 1 ? '' : 's'}. Nothing else is touched.`;
}

/* ------------------------------------------------------------------ */
/* 50433 — SLA-badge tooltip                                             */
/* ------------------------------------------------------------------ */

export function slaPolicyText(sla) {
  const s = sla || {};
  const parts = [];
  if (s.critical) parts.push(`critical: ${s.critical}`);
  if (s.high) parts.push(`high: ${s.high}`);
  if (s.medium) parts.push(`medium: ${s.medium}`);
  if (!parts.length)
    return 'SLA countdowns follow your workspace policy: critical 24h, high 72h, medium 7d.';
  return `SLA countdowns: ${parts.join(' · ')}. The clock pauses while a finding is in retest.`;
}

/* ------------------------------------------------------------------ */
/* 50434 — widget help affordance                                        */
/* ------------------------------------------------------------------ */

export const WIDGET_HELP =
  'A widget is a live card on your dashboard — e.g. “open criticals”, “hunt activity”, “brain queue”. Add widgets to see the numbers you care about at a glance.';

/* ------------------------------------------------------------------ */
/* 50435 — huntability meter                                             */
/* ------------------------------------------------------------------ */

export function huntabilityScore(target) {
  const reasons = [];
  let score = 50;
  const v = String(target ?? '').trim();

  if (!v) return { score: 0, label: 'No target', reasons: ['Paste a URL to score it.'] };

  const schemeMatch = v.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : '';
  if (scheme !== 'http' && scheme !== 'https') {
    return {
      score: 10,
      label: 'Unsupported',
      reasons: ['Only http:// and https:// targets can be hunted.'],
    };
  }

  let url = null;
  try {
    url = new URL(v);
  } catch {
    return { score: 15, label: 'Invalid', reasons: ['This URL doesn’t parse — check for typos.'] };
  }

  if (url.protocol === 'https:') {
    score += 15;
    reasons.push('HTTPS — encrypted transport, standard for real targets.');
  } else {
    score -= 5;
    reasons.push('Plain HTTP — huntable, but downgrade risks apply.');
  }

  const host = url.hostname;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isLocal =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.');
  if (isIp && !isLocal) {
    score += 5;
    reasons.push('Bare IP — direct infrastructure surface.');
  }
  if (isLocal) {
    score -= 5;
    reasons.push('Local target — huntable here, but results don’t transfer to prod.');
  }
  if (!isIp && host.includes('.')) {
    score += 5;
    reasons.push('Real domain — DNS, subdomains and certs are in scope.');
  }

  const depth = url.pathname.split('/').filter(Boolean).length;
  if (depth <= 2) {
    score += 5;
    reasons.push('Shallow path — broad surface to explore.');
  } else {
    score -= 3;
    reasons.push('Deep path — the hunt is scoped narrowly.');
  }

  const params = [...url.searchParams.keys()];
  if (params.length > 0) {
    score += 5;
    reasons.push(
      `${params.length} query parameter${params.length === 1 ? '' : 's'} — injection surface.`
    );
  }
  const tracking = trackingParamHint(v);
  if (tracking) {
    score += 3;
    reasons.push('Tracking params detected — we’ll strip them automatically.');
  }

  if (url.port) {
    score -= 5;
    reasons.push('Non-standard port — narrower service surface.');
  }
  if (v.length > 200) {
    score -= 5;
    reasons.push('Very long URL — consider trimming to the app root.');
  }

  score = Math.max(5, Math.min(100, Math.round(score)));
  const label =
    score >= 75
      ? 'Highly huntable'
      : score >= 50
        ? 'Huntable'
        : score >= 30
          ? 'Limited'
          : 'Barely huntable';
  return { score, label, reasons };
}

/* ------------------------------------------------------------------ */
/* 50436 — bell tooltip (grouped counts)                                 */
/* ------------------------------------------------------------------ */

export function groupNotifications(notifs) {
  const groups = {};
  for (const n of Array.isArray(notifs) ? notifs : []) {
    const cat = n.category || 'other';
    groups[cat] = (groups[cat] || 0) + 1;
  }
  return groups;
}

export function bellTooltip(notifs) {
  const groups = groupNotifications(notifs);
  const entries = Object.entries(groups);
  if (!entries.length) return 'No notifications.';
  const total = entries.reduce((s, [, c]) => s + c, 0);
  const breakdown = entries.map(([cat, c]) => `${c} ${cat}`).join(', ');
  return `${total} notification${total === 1 ? '' : 's'}: ${breakdown}.`;
}

/* ------------------------------------------------------------------ */
/* 50437 — helpful-vote thumbs (pure vote store)                         */
/* ------------------------------------------------------------------ */

export function recordHelpVote(store, docId, helpful) {
  const next = { ...(store || {}) };
  const cur = next[docId] || { helpful: 0, notHelpful: 0 };
  next[docId] = {
    helpful: cur.helpful + (helpful ? 1 : 0),
    notHelpful: cur.notHelpful + (helpful ? 0 : 1),
  };
  return next;
}

export function voteRatio(votes) {
  const v = votes || { helpful: 0, notHelpful: 0 };
  const total = v.helpful + v.notHelpful;
  if (!total) return null;
  return Math.round((v.helpful / total) * 100);
}

/* ------------------------------------------------------------------ */
/* 50438 — diff-legend tooltip                                           */
/* ------------------------------------------------------------------ */

export const DIFF_LEGEND = [
  { kind: 'added', color: '#34d399', text: 'Green — lines added by this change.' },
  { kind: 'removed', color: '#f87171', text: 'Red — lines removed by this change.' },
  { kind: 'moved', color: '#9ca3af', text: 'Gray — lines moved without changes.' },
];

/* ------------------------------------------------------------------ */
/* 50439 — drop-zone hints                                               */
/* ------------------------------------------------------------------ */

export function dropZoneHint(accept, maxBytes) {
  const a = Array.isArray(accept) && accept.length ? accept.join(', ') : 'any file';
  const mb = Number(maxBytes);
  const size = Number.isFinite(mb) && mb > 0 ? ` up to ${formatBytes(mb)}` : '';
  return `Drop files here — accepts ${a}${size}.`;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/* 50440 — avatar mood tooltip                                           */
/* ------------------------------------------------------------------ */

export const AVATAR_MOODS = {
  focused: 'Focused — the agent is actively working.',
  waiting: 'Waiting — the agent is idle, ready for your next instruction.',
  stuck: 'Stuck — the agent hit a blocker and may need your input.',
};

export function avatarMoodText(mood) {
  return AVATAR_MOODS[mood] || AVATAR_MOODS.waiting;
}

/* ------------------------------------------------------------------ */
/* Wave-11 idea registry (honesty: every idea 50401–50440 mapped)         */
/* ------------------------------------------------------------------ */

export const WAVE11_IDEAS = [
  {
    idea: 50401,
    name: 'pause-button-tooltip',
    in: 'microcopyCore.PAUSE_TOOLTIP + MicrocopyTooltips.PauseButtonTooltip',
  },
  {
    idea: 50402,
    name: 'empty-poc-hint',
    in: 'microcopyCore.EMPTY_POC_HINT + MicrocopyTooltips.EmptyPocHint',
  },
  {
    idea: 50403,
    name: 'shortcut-hints-in-tooltips',
    in: 'microcopyCore.shortcutTooltip + MicrocopyTooltips.ShortcutTooltip',
  },
  {
    idea: 50404,
    name: 'chain-icon-tooltip',
    in: 'microcopyCore.CHAIN_ICON_TOOLTIP + MicrocopyTooltips.ChainIconTooltip',
  },
  { idea: 50405, name: 'per-page-help-panel', in: 'HelpPanel.jsx (HELP_DOCS + slide-over)' },
  {
    idea: 50406,
    name: 'eta-tooltip',
    in: 'microcopyCore.etaBasisText + MicrocopyTooltips.EtaTooltip',
  },
  {
    idea: 50407,
    name: 'false-positive-tag-explainer',
    in: 'microcopyCore.fpTagExplainer + MicrocopyTooltips.FalsePositiveTagExplainer',
  },
  {
    idea: 50408,
    name: 'interactive-cvss-breakdown',
    in: 'microcopyCore.cvss31Score + MicrocopyTooltips.CvssBreakdown',
  },
  {
    idea: 50409,
    name: 'tier-badge-tooltip',
    in: 'microcopyCore.TIER_BADGE_TOOLTIP + MicrocopyTooltips.TierBadgeTooltip',
  },
  {
    idea: 50410,
    name: 'scope-input-guidance',
    in: 'microcopyCore.SCOPE_GUIDANCE + MicrocopyTooltips.ScopeInputGuidance',
  },
  {
    idea: 50411,
    name: 'worker-lane-tooltip',
    in: 'microcopyCore.WORKER_LANE_TOOLTIP + MicrocopyTooltips.WorkerLaneTooltip',
  },
  {
    idea: 50412,
    name: 'notification-why-link',
    in: 'microcopyCore.triggerRuleText + MicrocopyTooltips.WhyLink',
  },
  {
    idea: 50413,
    name: 'snapshot-tooltip',
    in: 'microcopyCore.snapshotLabel + MicrocopyTooltips.SnapshotTooltip',
  },
  {
    idea: 50414,
    name: 'cron-expression-helper',
    in: 'microcopyCore.cronToEnglish + MicrocopyTooltips.CronHelper',
  },
  {
    idea: 50415,
    name: 'dedup-tooltip',
    in: 'microcopyCore.dedupText + MicrocopyTooltips.DedupTooltip',
  },
  {
    idea: 50416,
    name: 'scrubber-help-popover',
    in: 'microcopyCore.SCRUBBER_HELP + MicrocopyTooltips.ScrubberHelpPopover',
  },
  {
    idea: 50417,
    name: 'model-slot-tooltips',
    in: 'microcopyCore.MODEL_SLOT_TOOLTIPS + MicrocopyTooltips.ModelSlotTooltips',
  },
  {
    idea: 50418,
    name: 'tracking-param-hint',
    in: 'microcopyCore.trackingParamHint + MicrocopyTooltips.TrackingParamHint',
  },
  {
    idea: 50419,
    name: 'ask-agent-examples',
    in: 'microcopyCore.ASK_AGENT_EXAMPLES + MicrocopyTooltips.AskAgentExamples',
  },
  {
    idea: 50420,
    name: 'fix-oriented-validation',
    in: 'microcopyCore.validateTargetInput + MicrocopyTooltips.TargetInputWithHelp',
  },
  {
    idea: 50421,
    name: 'export-format-tooltip',
    in: 'microcopyCore.EXPORT_FORMATS + MicrocopyTooltips.ExportFormatTooltip',
  },
  {
    idea: 50422,
    name: 'compliance-badge-links',
    in: 'microcopyCore.COMPLIANCE_REQUIREMENTS + MicrocopyTooltips.ComplianceBadge',
  },
  {
    idea: 50423,
    name: 'collaborator-tooltips',
    in: 'microcopyCore.collaboratorLine + MicrocopyTooltips.CollaboratorAvatar',
  },
  {
    idea: 50424,
    name: 'confidence-slider-help',
    in: 'microcopyCore.confidenceSliderHelp + MicrocopyTooltips.ConfidenceSlider',
  },
  {
    idea: 50425,
    name: 'findings-badge-tooltip',
    in: 'microcopyCore.findingsBadgeText + MicrocopyTooltips.FindingsBadgeTooltip',
  },
  {
    idea: 50426,
    name: 'regenerate-button-hint',
    in: 'microcopyCore.REGENERATE_HINT + MicrocopyTooltips.RegenerateHint',
  },
  {
    idea: 50427,
    name: 'archived-hunt-tooltip',
    in: 'microcopyCore.ARCHIVED_HUNT_TOOLTIP + MicrocopyTooltips.ArchivedHuntTooltip',
  },
  {
    idea: 50428,
    name: 'what-happens-next-stepper',
    in: 'microcopyCore.HUNT_PHASE_PREVIEWS + MicrocopyTooltips.WhatHappensNext',
  },
  {
    idea: 50429,
    name: 'terminal-copy-tooltip',
    in: 'microcopyCore.terminalCopyText + MicrocopyTooltips.TerminalCopyButton',
  },
  {
    idea: 50430,
    name: 'jargon-glossary-tooltips',
    in: 'microcopyCore.glossary + MicrocopyTooltips.GlossaryTerm',
  },
  {
    idea: 50431,
    name: 'theme-hover-previews',
    in: 'microcopyCore.THEME_PREVIEWS + MicrocopyTooltips.ThemeHoverPreviews',
  },
  {
    idea: 50432,
    name: 'bulk-action-hint',
    in: 'microcopyCore.bulkHint + MicrocopyTooltips.BulkActionHint',
  },
  {
    idea: 50433,
    name: 'sla-badge-tooltip',
    in: 'microcopyCore.slaPolicyText + MicrocopyTooltips.SlaBadgeTooltip',
  },
  {
    idea: 50434,
    name: 'widget-help-affordance',
    in: 'microcopyCore.WIDGET_HELP + MicrocopyTooltips.WidgetHelpAffordance',
  },
  {
    idea: 50435,
    name: 'huntability-meter',
    in: 'microcopyCore.huntabilityScore + MicrocopyTooltips.HuntabilityMeter',
  },
  {
    idea: 50436,
    name: 'bell-tooltip',
    in: 'microcopyCore.bellTooltip + MicrocopyTooltips.BellTooltip',
  },
  {
    idea: 50437,
    name: 'helpful-vote-thumbs',
    in: 'microcopyCore.recordHelpVote + HelpPanel.HelpfulVote',
  },
  {
    idea: 50438,
    name: 'diff-legend-tooltip',
    in: 'microcopyCore.DIFF_LEGEND + MicrocopyTooltips.DiffLegendTooltip',
  },
  {
    idea: 50439,
    name: 'drop-zone-hints',
    in: 'microcopyCore.dropZoneHint + MicrocopyTooltips.DropZoneHints',
  },
  {
    idea: 50440,
    name: 'avatar-mood-tooltip',
    in: 'microcopyCore.avatarMoodText + MicrocopyTooltips.AvatarMoodTooltip',
  },
];
