/**
 * triageCore.js — Infinity AI · Dark-Matter · Wave 51
 * Pure logic (no React, no DOM, no network) backing the post-hunt triage suite:
 * idea-bank ideas 52005–52040. Every exported function is pure and deterministic;
 * time is injected via `now` parameters (defaults to Date.now()).
 */

export const WAVE51_TRIAGE_IDEAS = [
  { id: 52005, title: 'Keyboard-driven triage queue' },
  { id: 52006, title: 'Severity-ranked triage inbox' },
  { id: 52007, title: 'Progressive-disclosure reading cards' },
  { id: 52008, title: 'Vuln-class grouped inbox view' },
  { id: 52009, title: 'Affected-asset grouped triage' },
  { id: 52010, title: 'Inline evidence preview pane' },
  { id: 52011, title: 'AI-generated finding TL;DR' },
  { id: 52012, title: 'Read/unread tracking per finding' },
  { id: 52013, title: 'Saved triage filters' },
  { id: 52014, title: 'Triage checklist per finding' },
  { id: 52015, title: 'Confidence badges on findings' },
  { id: 52016, title: '"Needs more evidence" flag' },
  { id: 52017, title: 'Similar-findings sidebar' },
  { id: 52018, title: 'Triage timer with analytics' },
  { id: 52019, title: 'Quick-action hover bar' },
  { id: 52020, title: 'Review delegation (post-hunt)' },
  { id: 52021, title: 'Exploitability-first sorting' },
  { id: 52022, title: 'EPSS percentile badges' },
  { id: 52023, title: 'Data-sensitivity badges' },
  { id: 52024, title: 'Regulatory mapping tags' },
  { id: 52025, title: 'Reading-time estimates' },
  { id: 52026, title: 'Distraction-free reading mode' },
  { id: 52027, title: 'Swipe-to-triage on mobile' },
  { id: 52028, title: 'Voice notes on findings' },
  { id: 52029, title: 'Inline collaborator comments' },
  { id: 52030, title: 'Triage SLA countdown' },
  { id: 52031, title: 'Auto-prioritization rules' },
  { id: 52032, title: 'Custom triage columns' },
  { id: 52033, title: 'Pinned findings' },
  { id: 52034, title: 'Starred findings for follow-up' },
  { id: 52035, title: 'Handoff notes between reviewers' },
  { id: 52036, title: 'Severity override with audit log' },
  { id: 52037, title: 'Inline CVSS calculator' },
  { id: 52038, title: 'Impact estimator widget' },
  { id: 52039, title: 'Affected-user count estimate' },
  { id: 52040, title: 'Triage session autosave' },
];

// 52005 — Keyboard-driven triage queue: single-key navigation and decisions.
const KEY_ACTIONS = { j: 'next', k: 'prev', a: 'accept', d: 'dismiss', e: 'escalate', r: 'mark-read' };
export function applyKeyAction(state, key) {
  const s = state || {};
  const items = Array.isArray(s.items) ? s.items : [];
  const action = KEY_ACTIONS[String(key || '').toLowerCase()] || null;
  if (!action || items.length === 0) {
    return { items, index: Math.max(0, Number(s.index || 0)), action: null, applied: false };
  }
  let index = Math.min(Math.max(Number(s.index || 0), 0), items.length - 1);
  if (action === 'next') index = Math.min(index + 1, items.length - 1);
  else if (action === 'prev') index = Math.max(index - 1, 0);
  let nextItems = items;
  if (action === 'accept' || action === 'dismiss' || action === 'escalate') {
    const decision = action === 'accept' ? 'accepted' : action === 'dismiss' ? 'dismissed' : 'escalated';
    nextItems = items.map((f, i) => (i === index ? { ...f, triage: decision } : f));
  } else if (action === 'mark-read') {
    nextItems = items.map((f, i) => (i === index ? { ...f, read: true } : f));
  }
  return { items: nextItems, index, action, applied: true };
}

// 52006 — Severity-ranked triage inbox: blended severity x exploitability x confidence.
const SEVERITY_WEIGHT = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25, info: 0.1 };
export function blendedTriageScore(finding) {
  const f = finding || {};
  const sev = SEVERITY_WEIGHT[String(f.severity || 'info').toLowerCase()] ?? 0.1;
  const exp = Math.min(1, Math.max(0, Number(f.exploitability ?? 0.5)));
  const conf = Math.min(1, Math.max(0, Number(f.confidence ?? 50) / 100));
  return Math.round((sev * 0.5 + exp * 0.3 + conf * 0.2) * 1000) / 1000;
}
export function rankInbox(findings) {
  return (Array.isArray(findings) ? findings : [])
    .map((f) => ({ ...f, triageScore: blendedTriageScore(f) }))
    .sort((a, b) => b.triageScore - a.triageScore);
}

// 52007 — Progressive-disclosure reading cards: collapsed -> summary -> evidence -> poc -> remediation.
const CARD_STAGES = ['collapsed', 'summary', 'evidence', 'poc', 'remediation'];
export function buildReadingCard(finding) {
  const f = finding || {};
  return {
    findingId: f.id || null,
    stage: 'collapsed',
    stages: CARD_STAGES,
    summary: String(f.summary || f.title || ''),
    evidence: f.evidence || null,
    poc: f.poc || null,
    remediation: f.remediation || null,
  };
}
export function expandCard(card, stage) {
  const c = card || {};
  const target = CARD_STAGES.includes(stage) ? stage : (c.stage || 'collapsed');
  return { ...c, stage: target };
}

// 52008 — Vuln-class grouped inbox view: collapse findings by weakness class.
export function groupByVulnClass(findings) {
  const groups = {};
  for (const f of Array.isArray(findings) ? findings : []) {
    const cls = String((f && (f.vulnClass || f.cwe)) || 'uncategorized');
    if (!groups[cls]) groups[cls] = { vulnClass: cls, findings: [], count: 0 };
    groups[cls].findings.push(f);
    groups[cls].count += 1;
  }
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

// 52009 — Affected-asset grouped triage: pivot the inbox by asset or endpoint.
export function groupByAsset(findings) {
  const groups = {};
  for (const f of Array.isArray(findings) ? findings : []) {
    const asset = String((f && (f.asset || f.target)) || 'unknown-asset');
    if (!groups[asset]) groups[asset] = { asset, findings: [], count: 0 };
    groups[asset].findings.push(f);
    groups[asset].count += 1;
  }
  return Object.values(groups).sort((a, b) => b.count - a.count);
}

// 52010 — Inline evidence preview pane: HTTP pairs, screenshots, payloads in the list.
export function buildEvidencePreview(finding) {
  const f = finding || {};
  const http = Array.isArray(f.httpExchanges) ? f.httpExchanges : [];
  const screenshots = Array.isArray(f.screenshots) ? f.screenshots : [];
  const payloads = Array.isArray(f.payloads) ? f.payloads : [];
  return {
    findingId: f.id || null,
    http: http.slice(0, 3).map((x) => ({
      request: String((x && x.request) || ''),
      response: String((x && x.response) || '').slice(0, 500),
    })),
    screenshots: screenshots.slice(0, 3),
    payloads: payloads.slice(0, 3),
    inline: true,
    counts: { http: http.length, screenshots: screenshots.length, payloads: payloads.length },
  };
}

// 52011 — AI-generated finding TL;DR: extractive two-sentence summary.
const TLDR_STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'is', 'it', 'this', 'that', 'with', 'for', 'as', 'at', 'by', 'from']);
function tldrWordFreq(sentences) {
  const freq = {};
  for (const s of sentences) {
    for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w && !TLDR_STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
    }
  }
  return freq;
}
export function buildExtractiveTldr(finding) {
  const f = finding || {};
  const text = String(f.description || f.summary || f.title || '');
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 8);
  if (sentences.length === 0) {
    return { findingId: f.id || null, tldr: String(f.title || 'No description available.'), sentences: 0 };
  }
  const freq = tldrWordFreq(sentences);
  const keywords = new Set(Object.entries(freq).filter(([, n]) => n >= 2).map(([w]) => w));
  const scoreOf = (s) => {
    const words = s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !TLDR_STOPWORDS.has(w));
    let score = words.length * 0.01;
    for (const w of words) if (keywords.has(w)) score += 1;
    return score;
  };
  const ranked = sentences
    .map((s, i) => ({ s, i, score: scoreOf(s) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 2)
    .sort((a, b) => a.i - b.i);
  return { findingId: f.id || null, tldr: ranked.map((r) => r.s).join(' '), sentences: ranked.length };
}

// 52012 — Read/unread tracking per finding with a persistent progress label.
export function markRead(readIds, findingId, total) {
  const read = new Set(Array.isArray(readIds) ? readIds : []);
  if (findingId != null) read.add(findingId);
  const readCount = read.size;
  const totalCount = Number(total || 0);
  return {
    read: [...read],
    readCount,
    total: totalCount,
    reviewed: totalCount ? Math.round((readCount / totalCount) * 100) : 0,
    label: `${readCount} of ${totalCount} reviewed`,
  };
}

// 52013 — Saved triage filters: named, reusable filter combinations.
export function saveFilter(filters, name, criteria) {
  const list = Array.isArray(filters) ? filters.slice() : [];
  const entry = { name: String(name || 'untitled'), criteria: criteria || {} };
  const idx = list.findIndex((f) => f.name === entry.name);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  return list;
}
export function applySavedFilter(findings, filter) {
  const c = (filter && filter.criteria) || {};
  return (Array.isArray(findings) ? findings : []).filter((f) => {
    if (!f) return false;
    if (c.severity && String(f.severity || '').toLowerCase() !== String(c.severity).toLowerCase()) return false;
    if (c.authRequired != null && Boolean(f.authRequired) !== Boolean(c.authRequired)) return false;
    if (c.asset && String(f.asset || '') !== String(c.asset)) return false;
    if (c.minConfidence != null && Number(f.confidence || 0) < Number(c.minConfidence)) return false;
    if (c.vulnClass && String(f.vulnClass || '') !== String(c.vulnClass)) return false;
    return true;
  });
}

// 52014 — Triage checklist per finding: must be complete before marking reviewed.
const DEFAULT_CHECKLIST = ['reproduced', 'in-scope', 'impact-confirmed', 'false-positive-ruled-out'];
export function buildChecklist(config) {
  const items = Array.isArray(config) && config.length ? config : DEFAULT_CHECKLIST;
  return items.map((label) => ({ label: String(label), checked: false }));
}
export function toggleChecklistItem(checklist, label) {
  return (Array.isArray(checklist) ? checklist : []).map((it) =>
    it.label === label ? { ...it, checked: !it.checked } : it
  );
}
export function canMarkReviewed(checklist) {
  const list = Array.isArray(checklist) ? checklist : [];
  return list.length > 0 && list.every((it) => it.checked === true);
}

// 52015 — Confidence badges on findings: band plus the top two reasons.
export function confidenceBadge(finding) {
  const f = finding || {};
  const conf = Math.min(100, Math.max(0, Number(f.confidence ?? 50)));
  const reasons = Array.isArray(f.confidenceReasons) ? f.confidenceReasons.slice(0, 2) : [];
  const band = conf >= 80 ? 'High' : conf >= 50 ? 'Medium' : 'Low';
  return { band, confidence: conf, reasons };
}

// 52016 — "Needs more evidence" flag: send a thin finding back for another pass.
export function flagForEvidence(finding, reason, now = Date.now()) {
  return {
    ...(finding || {}),
    evidenceStatus: 'needs-evidence',
    evidenceFlag: {
      reason: String(reason || 'insufficient evidence'),
      flaggedAt: new Date(now).toISOString(),
      resolved: false,
    },
  };
}
export function resolveEvidenceFlag(finding, now = Date.now()) {
  const f = finding || {};
  const flag = f.evidenceFlag ? { ...f.evidenceFlag, resolved: true, resolvedAt: new Date(now).toISOString() } : null;
  return { ...f, evidenceStatus: 'gathered', evidenceFlag: flag };
}

// 52017 — Similar-findings sidebar: linked findings from this and past hunts.
export function findSimilar(finding, corpus, limit = 5) {
  const f = finding || {};
  const fWords = new Set(String(f.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const scored = (Array.isArray(corpus) ? corpus : [])
    .filter((c) => c && c.id !== f.id)
    .map((c) => {
      let score = 0;
      if (c.vulnClass && c.vulnClass === f.vulnClass) score += 3;
      if (c.asset && c.asset === f.asset) score += 2;
      if (c.severity && c.severity === f.severity) score += 1;
      const cWords = new Set(String(c.title || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      for (const w of fWords) if (w.length > 3 && cWords.has(w)) score += 0.5;
      return { finding: c, score: Math.round(score * 10) / 10 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(limit) || 5));
  return { findingId: f.id || null, similar: scored, count: scored.length };
}

// 52018 — Triage timer with analytics: seconds per finding plus team averages.
export function recordDwell(sessions, findingId, seconds, reviewer) {
  const list = Array.isArray(sessions) ? sessions.slice() : [];
  list.push({ findingId, seconds: Math.max(0, Number(seconds) || 0), reviewer: String(reviewer || 'reviewer') });
  return list;
}
function avgSeconds(values) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}
export function teamAverages(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const byFinding = {};
  const byReviewer = {};
  for (const s of list) {
    if (!s) continue;
    (byFinding[s.findingId] = byFinding[s.findingId] || []).push(s.seconds);
    (byReviewer[s.reviewer] = byReviewer[s.reviewer] || []).push(s.seconds);
  }
  return {
    overallAvgSeconds: avgSeconds(list.map((s) => s.seconds)),
    perFinding: Object.fromEntries(Object.entries(byFinding).map(([k, v]) => [k, avgSeconds(v)])),
    perReviewer: Object.fromEntries(Object.entries(byReviewer).map(([k, v]) => [k, avgSeconds(v)])),
    samples: list.length,
  };
}

// 52019 — Quick-action hover bar: one-click actions without opening the finding.
export function hoverActions(finding) {
  const f = finding || {};
  return [
    { id: 'accept', label: 'Accept' },
    { id: 'false-positive', label: 'False-positive' },
    { id: 'escalate', label: 'Escalate' },
    { id: 'assign', label: 'Assign' },
  ].map((a) => ({ ...a, findingId: f.id || null, enabled: true }));
}

// 52020 — Review delegation (post-hunt): reassign findings with an audit trail.
export function delegateFindings(findings, assignee, note, now = Date.now()) {
  const ids = (Array.isArray(findings) ? findings : [])
    .map((f) => (f && typeof f === 'object' ? f.id : f))
    .filter((id) => id != null);
  const at = new Date(now).toISOString();
  return {
    assignee: String(assignee || ''),
    findingIds: ids,
    note: String(note || ''),
    delegatedAt: at,
    audit: ids.map((id) => ({ findingId: id, from: 'triage-queue', to: String(assignee || ''), at })),
  };
}

// 52021 — Exploitability-first sorting: real-world exploitability before raw CVSS.
export function sortByExploitability(findings) {
  return (Array.isArray(findings) ? findings : [])
    .map((f) => ({ ...f, exploitability: Math.min(1, Math.max(0, Number((f && f.exploitability) ?? 0))) }))
    .sort((a, b) => b.exploitability - a.exploitability);
}

// 52022 — EPSS percentile badges: exploitation probability at a glance.
export function epssBadge(epssPercentile) {
  const p = Math.min(100, Math.max(0, Number(epssPercentile ?? 0)));
  const band = p >= 90 ? 'top-10%' : p >= 75 ? 'high' : p >= 50 ? 'medium' : 'low';
  return { percentile: Math.round(p * 100) / 100, band, label: `EPSS p${p} · ${band}` };
}

// 52023 — Data-sensitivity badges: PII, payment data, secrets, health data.
const SENSITIVITY_PATTERNS = [
  { key: 'secrets', label: 'Secrets', test: /(secret|api[_-]?key|token|password|credential)/i },
  { key: 'payment', label: 'Payment data', test: /(card|payment|cvv|iban|bank)/i },
  { key: 'pii', label: 'PII', test: /(pii|email|phone|ssn|address|dob)/i },
  { key: 'health', label: 'Health data', test: /(health|hipaa|medical|patient)/i },
];
export function sensitivityBadge(finding) {
  const f = finding || {};
  const haystack = [f.title, f.description, f.asset, (f.tags || []).join(' ')].filter(Boolean).join(' ');
  const matched = SENSITIVITY_PATTERNS.filter((p) => p.test.test(haystack));
  const level = matched.some((m) => m.key === 'secrets' || m.key === 'payment')
    ? 'high'
    : matched.length ? 'medium' : 'none';
  return { level, badges: matched.map((m) => m.label), dataAtRisk: matched.map((m) => m.key) };
}

// 52024 — Regulatory mapping tags: PCI DSS, HIPAA, GDPR, SOC 2.
const REGULATORY_MAP = [
  { framework: 'PCI DSS', test: /(card|payment|cvv|pci)/i },
  { framework: 'HIPAA', test: /(health|patient|medical|phi|hipaa)/i },
  { framework: 'GDPR', test: /(pii|email|personal|gdpr|consent)/i },
  { framework: 'SOC 2', test: /(credential|auth|sso|access)/i },
];
export function regulatoryTags(finding) {
  const f = finding || {};
  const haystack = [f.title, f.description, f.vulnClass, (f.tags || []).join(' ')].filter(Boolean).join(' ');
  const tags = REGULATORY_MAP.filter((r) => r.test.test(haystack)).map((r) => r.framework);
  return { findingId: f.id || null, tags, count: tags.length };
}

// 52025 — Reading-time estimates: plan triage sessions per finding.
export function estimateReadingTime(finding, wordsPerMinute = 200) {
  const f = finding || {};
  const text = [f.title, f.description, f.remediation].filter(Boolean).join(' ');
  const evidenceChars = JSON.stringify(f.evidence || '').length;
  const words = text.split(/\s+/).filter(Boolean).length + Math.floor(evidenceChars / 6);
  const minutes = Math.max(1, Math.ceil(words / Math.max(1, Number(wordsPerMinute) || 200)));
  return { words, minutes, label: `≈${minutes} min review` };
}

// 52026 — Distraction-free reading mode: one finding, minimal chrome.
export function buildFocusSpec(finding) {
  const f = finding || {};
  return {
    findingId: f.id || null,
    chrome: 'minimal',
    visible: ['title', 'severity', 'tldr', 'evidence', 'remediation'],
    hidden: ['sidebar', 'nav', 'notifications', 'related'],
    fontSize: 'comfortable',
    progress: 'inline',
  };
}

// 52027 — Swipe-to-triage on mobile: right accept, left dismiss, up escalate.
const SWIPE_DECISIONS = { 'swipe-right': 'accepted', 'swipe-left': 'dismissed', 'swipe-up': 'escalated' };
export function reduceSwipe(queue, action) {
  const items = Array.isArray(queue) ? queue.slice() : [];
  const a = action || {};
  const decision = SWIPE_DECISIONS[a.swipe] || null;
  if (!decision || a.findingId == null) return { queue: items, applied: false, decision: null };
  const next = items.map((f) => (f && f.id === a.findingId ? { ...f, triage: decision } : f));
  const remaining = next.filter((f) => !(f && f.triage)).length;
  return {
    queue: next,
    applied: true,
    decision: { findingId: a.findingId, swipe: a.swipe, decision },
    remaining,
  };
}

// 52028 — Voice notes on findings: spoken note stored with its transcript.
export function attachVoiceNote(finding, transcript, durationSeconds, now = Date.now()) {
  const f = finding || {};
  const notes = Array.isArray(f.voiceNotes) ? f.voiceNotes.slice() : [];
  notes.push({
    id: `vn-${notes.length + 1}`,
    transcript: String(transcript || ''),
    durationSeconds: Math.max(0, Number(durationSeconds) || 0),
    recordedAt: new Date(now).toISOString(),
  });
  return { ...f, voiceNotes: notes, voiceNoteCount: notes.length };
}

// 52029 — Inline collaborator comments: threaded, anchored, with @mentions.
export function addComment(finding, options, now = Date.now()) {
  const o = options || {};
  const f = finding || {};
  const comments = Array.isArray(f.comments) ? f.comments.slice() : [];
  comments.push({
    id: `cm-${comments.length + 1}`,
    author: String(o.author || 'Infinity AI'),
    body: String(o.body || ''),
    lineRef: o.lineRef || null,
    mentions: Array.isArray(o.mentions) ? o.mentions : [],
    createdAt: new Date(now).toISOString(),
  });
  return { ...f, comments, commentCount: comments.length };
}

// 52030 — Triage SLA countdown: severity-based review deadlines.
const SLA_HOURS = { critical: 4, high: 24, medium: 72, low: 168, info: 336 };
export function slaCountdown(finding, slaHours, now = Date.now()) {
  const f = finding || {};
  const sev = String(f.severity || 'info').toLowerCase();
  const hours = slaHours != null ? Number(slaHours) : (SLA_HOURS[sev] ?? 336);
  const openedAt = Number(f.openedAt || now);
  const remainingMs = openedAt + hours * 3600000 - now;
  const breached = remainingMs <= 0;
  const absMs = Math.abs(remainingMs);
  const h = Math.floor(absMs / 3600000);
  const m = Math.floor((absMs % 3600000) / 60000);
  return {
    findingId: f.id || null,
    severity: sev,
    slaHours: hours,
    remainingMs,
    breached,
    display: breached ? `breached by ${h}h ${m}m` : `${h}h ${m}m left`,
  };
}

// 52031 — Auto-prioritization rules: user rules auto-tag and route findings.
function priorityRank(p) {
  return { p0: 0, p1: 1, p2: 2, p3: 3 }[String(p || '').toLowerCase()] ?? 9;
}
function ruleMatches(finding, rule) {
  const r = rule || {};
  const cond = r.when || {};
  const f = finding || {};
  if (cond.vulnClass && String(f.vulnClass || '') !== String(cond.vulnClass)) return false;
  if (cond.severity && String(f.severity || '').toLowerCase() !== String(cond.severity).toLowerCase()) return false;
  if (cond.asset && String(f.asset || '') !== String(cond.asset)) return false;
  if (cond.authRequired != null && Boolean(f.authRequired) !== Boolean(cond.authRequired)) return false;
  return true;
}
export function applyPriorityRules(findings, rules) {
  const rs = Array.isArray(rules) ? rules : [];
  return (Array.isArray(findings) ? findings : []).map((f) => {
    const matched = rs.filter((r) => ruleMatches(f, r));
    const top = matched.slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))[0];
    return {
      ...f,
      autoPriority: top ? top.priority : ((f && f.autoPriority) || null),
      matchedRules: matched.map((r) => r.id || r.name || 'rule'),
    };
  });
}

// 52032 — Custom triage columns: add, reorder, resize, saved per user.
export function buildColumnSpec(columns) {
  const list = (Array.isArray(columns) ? columns : []).map((c, i) => ({
    id: String((c && c.id) || `col-${i + 1}`),
    label: String((c && c.label) || `Column ${i + 1}`),
    width: Math.max(60, Number((c && c.width) || 140)),
    visible: (c && c.visible) !== false,
    order: i,
  }));
  return { columns: list, count: list.length };
}
export function reorderColumns(spec, fromIndex, toIndex) {
  const cols = spec && Array.isArray(spec.columns) ? spec.columns.slice() : [];
  const [moved] = cols.splice(fromIndex, 1);
  if (!moved) return spec;
  cols.splice(Math.max(0, Math.min(toIndex, cols.length)), 0, moved);
  return { columns: cols.map((c, i) => ({ ...c, order: i })), count: cols.length };
}

// 52033 — Pinned findings: pinned rows stay on top of the queue.
export function pinFinding(pinnedIds, findingId) {
  const set = new Set(Array.isArray(pinnedIds) ? pinnedIds : []);
  if (findingId != null) set.add(findingId);
  return [...set];
}
export function unpinFinding(pinnedIds, findingId) {
  return (Array.isArray(pinnedIds) ? pinnedIds : []).filter((id) => id !== findingId);
}
export function pinnedFirst(findings, pinnedIds) {
  const pinned = new Set(Array.isArray(pinnedIds) ? pinnedIds : []);
  return (Array.isArray(findings) ? findings : [])
    .slice()
    .sort((a, b) => Number(pinned.has(b && b.id)) - Number(pinned.has(a && a.id)));
}

// 52034 — Starred findings for follow-up: personal revisit list, triage state untouched.
export function starFinding(starredIds, findingId) {
  const set = new Set(Array.isArray(starredIds) ? starredIds : []);
  if (findingId == null) return { starred: [...set], starredNow: false };
  const was = set.has(findingId);
  if (was) set.delete(findingId);
  else set.add(findingId);
  return { starred: [...set], starredNow: !was };
}

// 52035 — Handoff notes between reviewers: structured pass-off of a half-triaged hunt.
export function buildHandoff(options, now = Date.now()) {
  const o = options || {};
  const list = Array.isArray(o.findings) ? o.findings : [];
  const triaged = list.filter((f) => f && f.triage).length;
  return {
    from: String(o.from || ''),
    to: String(o.to || ''),
    createdAt: new Date(now).toISOString(),
    summary: String(o.summary || ''),
    progress: { total: list.length, triaged, remaining: list.length - triaged },
    openQuestions: Array.isArray(o.openQuestions) ? o.openQuestions : [],
    findingIds: list.map((f) => (f && typeof f === 'object' ? f.id : f)).filter((id) => id != null),
  };
}

// 52036 — Severity override with audit log: mandatory reason, history preserved.
export function overrideSeverity(finding, newSeverity, reason, reviewer, now = Date.now()) {
  const f = finding || {};
  if (!reason || !String(reason).trim()) {
    return { ...f, overrideApplied: false, overrideError: 'a reason is required to override severity' };
  }
  const audit = Array.isArray(f.severityAudit) ? f.severityAudit.slice() : [];
  audit.push({
    from: String(f.severity || 'info'),
    to: String(newSeverity || f.severity || 'info'),
    reason: String(reason),
    reviewer: String(reviewer || 'Infinity AI'),
    at: new Date(now).toISOString(),
  });
  return {
    ...f,
    severity: String(newSeverity || f.severity || 'info'),
    severityAudit: audit,
    overrideApplied: true,
  };
}

// 52037 — Inline CVSS calculator: real CVSS v3.1 base-score math, live on the finding.
const CVSS31 = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  PR: { N: 0.85, L: 0.62, H: 0.27 },
  PRS: { N: 0.85, L: 0.68, H: 0.5 }, // privileges required when scope is changed
  UI: { N: 0.85, R: 0.62 },
  CIA: { N: 0, L: 0.22, H: 0.56 },
};
function cvssRoundup(input) {
  const intInput = Math.round(input * 100000);
  if (intInput % 10000 === 0) return intInput / 100000;
  return (Math.floor(intInput / 10000) + 1) / 10;
}
function metricKey(table, value, fallback) {
  const k = String(value || fallback).toUpperCase();
  return table[k] != null ? k : fallback;
}
export function cvss31Score(metrics) {
  const m = metrics || {};
  const scope = metricKey({ U: 1, C: 1 }, m.scope, 'U');
  const scopeChanged = scope === 'C';
  const av = metricKey(CVSS31.AV, m.av, 'N');
  const ac = metricKey(CVSS31.AC, m.ac, 'L');
  const prTable = scopeChanged ? CVSS31.PRS : CVSS31.PR;
  const pr = metricKey(prTable, m.pr, 'N');
  const ui = metricKey(CVSS31.UI, m.ui, 'N');
  const c = metricKey(CVSS31.CIA, m.c, 'N');
  const i = metricKey(CVSS31.CIA, m.i, 'N');
  const a = metricKey(CVSS31.CIA, m.a, 'N');
  const iss = 1 - (1 - CVSS31.CIA[c]) * (1 - CVSS31.CIA[i]) * (1 - CVSS31.CIA[a]);
  const impact = scopeChanged
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  const exploitability = 8.22 * CVSS31.AV[av] * CVSS31.AC[ac] * prTable[pr] * CVSS31.UI[ui];
  let score = 0;
  if (impact > 0) {
    score = scopeChanged
      ? cvssRoundup(Math.min(1.08 * (impact + exploitability), 10))
      : cvssRoundup(Math.min(impact + exploitability, 10));
  }
  const severity = score === 0 ? 'none' : score < 4 ? 'low' : score < 7 ? 'medium' : score < 9 ? 'high' : 'critical';
  return {
    score,
    severity,
    impact: cvssRoundup(Math.max(0, impact)),
    exploitability: cvssRoundup(exploitability),
    vector: `CVSS:3.1/AV:${av}/AC:${ac}/PR:${pr}/UI:${ui}/S:${scope}/C:${c}/I:${i}/A:${a}`,
  };
}

// 52038 — Impact estimator widget: three questions, one plain-language statement.
export function estimateImpact(answers) {
  const o = answers || {};
  const data = Boolean(o.dataExposed);
  const auth = Boolean(o.authRequired);
  const ui = Boolean(o.userInteraction);
  let level = 'low';
  let statement = 'Limited impact: no sensitive data exposure.';
  if (data && !auth) {
    level = 'critical';
    statement = 'Critical impact: sensitive data is exposed without authentication.';
  } else if (data && auth && !ui) {
    level = 'high';
    statement = 'High impact: authenticated access exposes sensitive data with no user interaction.';
  } else if (data && auth && ui) {
    level = 'medium';
    statement = 'Medium impact: data exposure needs an authenticated session plus user interaction.';
  } else if (!data && !auth) {
    level = 'medium';
    statement = 'Medium impact: reachable without authentication, but no sensitive data exposure.';
  }
  return { level, statement, answers: { dataExposed: data, authRequired: auth, userInteraction: ui } };
}

// 52039 — Affected-user count estimate: derived from endpoint traffic hints.
export function estimateAffectedUsers(finding) {
  const f = finding || {};
  const traffic = f.traffic || {};
  const dailyUsers = Math.max(0, Number(traffic.dailyUsers || 0));
  const exposedRatio = Math.min(1, Math.max(0, Number(traffic.exposedRatio ?? (f.authRequired ? 0.05 : 0.5))));
  const estimatedUsers = Math.round(dailyUsers * exposedRatio);
  const band = estimatedUsers >= 100000 ? 'mass'
    : estimatedUsers >= 10000 ? 'large'
    : estimatedUsers >= 1000 ? 'moderate'
    : estimatedUsers > 0 ? 'small' : 'unknown';
  return {
    findingId: f.id || null,
    dailyUsers,
    exposedRatio,
    estimatedUsers,
    band,
    label: estimatedUsers > 0 ? `≈${estimatedUsers.toLocaleString('en-US')} users exposed` : 'exposure unknown',
  };
}

// 52040 — Triage session autosave: restore filters, scroll, open cards after logout or crash.
export function autosaveSession(session, now = Date.now()) {
  const s = session || {};
  return {
    version: 1,
    savedAt: new Date(now).toISOString(),
    filters: s.filters || null,
    scrollPosition: Number(s.scrollPosition || 0),
    openCards: Array.isArray(s.openCards) ? s.openCards.slice() : [],
    readIds: Array.isArray(s.readIds) ? s.readIds.slice() : [],
    queueIndex: Number(s.queueIndex || 0),
  };
}
export function restoreSession(saved) {
  const s = saved || {};
  return {
    restored: s.version === 1,
    filters: s.filters || null,
    scrollPosition: Number(s.scrollPosition || 0),
    openCards: Array.isArray(s.openCards) ? s.openCards : [],
    readIds: Array.isArray(s.readIds) ? s.readIds : [],
    queueIndex: Number(s.queueIndex || 0),
    savedAt: s.savedAt || null,
  };
}
