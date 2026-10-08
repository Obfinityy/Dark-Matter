/**
 * wave73ACore.js — post-hunt Q&A and hunt reopen (ideas 52881–52900).
 *
 * Pure logic for Q&A export and sharing, follow-up suggestions,
 * conversation memory, multilingual answers, answer feedback,
 * archived-hunt Q&A, code-context answers, hunt statistics,
 * one-click reopen, reopen reasons, snapshot restore, reopen from
 * archive, notifications, audit logging, permission control,
 * reopen-vs-new guidance, re-indexing, extended scope, and
 * appending new findings. Every helper takes explicit inputs,
 * returns a structured view model, and never mutates its arguments.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE73_A_IDEAS = [
  { id: 52881, title: 'Q&A export', skip: false },
  { id: 52882, title: 'Q&A sharing', skip: false },
  { id: 52883, title: 'Suggested follow-up chips', skip: false },
  { id: 52884, title: 'Multi-turn context retention', skip: false },
  { id: 52885, title: 'Multilingual Q&A', skip: false },
  { id: 52886, title: 'Answer feedback buttons', skip: false },
  { id: 52887, title: 'Q&A over archived hunts', skip: false },
  { id: 52888, title: 'Code-context Q&A', skip: false },
  { id: 52889, title: 'Hunt-statistics Q&A', skip: false },
  { id: 52890, title: 'One-click hunt reopen', skip: false },
  { id: 52891, title: 'Reopen reason requirement', skip: false },
  { id: 52892, title: 'State-snapshot restore on reopen', skip: false },
  { id: 52893, title: 'Reopen from archive', skip: false },
  { id: 52894, title: 'Reopen notifications', skip: false },
  { id: 52895, title: 'Reopen audit log', skip: false },
  { id: 52896, title: 'Reopen permission control', skip: false },
  { id: 52897, title: 'Reopen-vs-new guidance', skip: false },
  { id: 52898, title: 'Re-index on reopen', skip: false },
  { id: 52899, title: 'Extended-scope reopen', skip: false },
  { id: 52900, title: 'Append-new-findings on reopen', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const LANG_PACKS = {
  es: { name: 'Spanish', greeting: 'Respuesta de Infinity AI', severity: { critical: 'crítica', high: 'alta', medium: 'media', low: 'baja', info: 'informativa' } },
  hi: { name: 'Hindi', greeting: 'Infinity AI ka jawab', severity: { critical: 'गंभीर', high: 'उच्च', medium: 'मध्यम', low: 'कम', info: 'जानकारी' } },
  hinglish: { name: 'Hinglish', greeting: 'Infinity AI reply', severity: { critical: 'bahut serious', high: 'serious', medium: 'medium', low: 'chhota', info: 'jaankari' } },
  fr: { name: 'French', greeting: 'Réponse Infinity AI', severity: { critical: 'critique', high: 'élevée', medium: 'moyenne', low: 'faible', info: 'information' } },
  en: { name: 'English', greeting: 'Infinity AI answer', severity: { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info' } },
};
const REOPENABLE_STATES = ['closed', 'archived', 'completed'];
const REOPEN_ROLES = ['lead', 'admin', 'hunt-owner', 'security-lead'];

function sevKey(f) {
  return String((f && f.severity) || 'info').toLowerCase();
}
function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}
function slug(text) {
  return String(text || 'qa').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'qa';
}
function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
}
function redact(text) {
  return String(text || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/bearer\s+[\w.-]+/gi, 'Bearer [token]');
}
function parseMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Export a Q&A transcript for meeting records (idea 52881).
 * Entries are rendered as Markdown or plain text with a header,
 * timestamps, and finding references preserved for audit.
 */
export function exportQaTranscript(entries = [], format = 'markdown', options = {}) {
  const fmt = String(format || 'markdown').toLowerCase();
  const list = (entries || []).map(e => ({ ...e }));
  const huntLabel = options.huntLabel || options.huntId || 'hunt';
  const title = `Q&A transcript — ${huntLabel}`;
  const lines = [];
  if (fmt === 'markdown') {
    lines.push(`# ${title}`, '', `Exported by Infinity AI · ${list.length} exchange(s)`, '');
    for (const e of list) {
      lines.push(`## ${e.question || 'Question'}`, '');
      lines.push(`*Asked by ${e.askedBy || 'unknown'}${e.at ? ` · ${e.at}` : ''}*`, '');
      lines.push(redact(e.answer || ''), '');
      if (e.findingId) lines.push(`> Finding: ${e.findingId}`, '');
    }
  } else {
    lines.push(title, '='.repeat(title.length), '');
    for (const e of list) {
      lines.push(`Q: ${e.question || ''}`, `A: ${redact(e.answer || '')}`, '');
    }
  }
  const content = lines.join('\n');
  return {
    format: fmt === 'pdf' ? 'pdf' : fmt,
    filename: `${slug(huntLabel)}-qa.${fmt === 'markdown' ? 'md' : fmt === 'pdf' ? 'pdf' : 'txt'}`,
    title,
    content,
    entryCount: list.length,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    generatedBy: 'Infinity AI',
  };
}

/**
 * Build a shareable link descriptor for a Q&A thread (idea 52882).
 * A deterministic slug, permission level, and expiry are computed
 * from the thread record without contacting any service.
 */
export function shareQaThread(thread = {}, options = {}) {
  const permission = String(options.permission || thread.permission || 'view').toLowerCase();
  const expiresInDays = Number(options.expiresInDays ?? 7);
  const base = options.baseUrl || 'https://app.infinity-ai.example';
  const tokenSource = `${thread.id || 'thread'}:${thread.huntId || ''}:${(thread.entries || []).length}`;
  let hash = 0;
  for (let i = 0; i < tokenSource.length; i++) hash = (hash * 31 + tokenSource.charCodeAt(i)) >>> 0;
  const slugPart = `${slug(thread.title || thread.id || 'qa')}-${hash.toString(36)}`;
  const url = `${base}/share/qa/${slugPart}`;
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const expiresAt = new Date(nowMs + expiresInDays * 86400000).toISOString();
  return {
    threadId: thread.id || null,
    url,
    permission: ['view', 'comment', 'edit'].includes(permission) ? permission : 'view',
    expiresAt,
    expiresInDays,
    entryCount: (thread.entries || []).length,
    requiresLogin: permission !== 'view',
    summary: `Infinity AI share link for ${thread.id || 'thread'} (${permission}, expires ${expiresAt.slice(0, 10)}).`,
  };
}

/**
 * Suggest contextual follow-up questions after an answer (idea 52883).
 * The last answer, its finding class, and unresolved topics produce
 * ordered chips that guide the next step of exploration.
 */
export function suggestFollowUpChips(context = {}, options = {}) {
  const limit = Number(options.limit || 4);
  const answer = String(context.answer || '');
  const finding = context.finding || {};
  const cwe = String(finding.cwe || '').toUpperCase();
  const chips = [];
  const add = (label, question, topic) => chips.push({ label, question, topic });
  if (cwe.includes('89')) add('Show fix steps', 'How do I fix this SQL issue step by step?', 'remediation');
  if (cwe.includes('79')) add('Show safe example', 'What does safe rendering look like for this case?', 'remediation');
  if (sevKey(finding) === 'critical' || sevKey(finding) === 'high') add('Who should fix it?', 'Who should own the fix for this finding?', 'ownership');
  if (/payment|checkout|billing/i.test(answer + ' ' + (finding.title || ''))) add('Payment impact', 'How does this affect payment flows?', 'payments');
  if ((finding.evidence || []).length) add('Show evidence', 'Which evidence supports this answer?', 'evidence');
  add('What next?', 'What should I check next after this?', 'next-steps');
  add('Plain summary', 'Explain this in plain language for leadership.', 'summary');
  add('Similar findings', 'Have we seen findings like this before?', 'history');
  const seen = new Set();
  const unique = chips.filter(c => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  }).slice(0, limit).map((c, i) => ({ ...c, rank: i + 1 }));
  return {
    chips: unique,
    count: unique.length,
    basedOn: finding.id || context.findingId || null,
    summary: `Infinity AI suggests ${unique.length} follow-up(s) for ${finding.id || 'this answer'}.`,
  };
}

/**
 * Retain multi-turn conversation context for deep dives (idea 52884).
 * Earlier questions, referenced findings, and open topics are folded
 * into a compact context window the next answer can build on.
 */
export function trackConversationContext(turns = [], options = {}) {
  const maxTurns = Number(options.maxTurns || 10);
  const list = (turns || []).map(t => ({ ...t }));
  const kept = list.slice(-maxTurns);
  const findingIds = [...new Set(kept.map(t => t.findingId).filter(Boolean).map(String))];
  const topics = [...new Set(kept.flatMap(t => tokenize(`${t.question || ''} ${t.answer || ''}`)).filter(w => !['the', 'and', 'for', 'this', 'that', 'with'].includes(w)))].slice(0, 12);
  const openQuestions = kept.filter(t => !t.answer).map(t => t.question).filter(Boolean);
  const lastTurn = kept[kept.length - 1] || null;
  return {
    turnsRetained: kept.length,
    turnsDropped: Math.max(0, list.length - kept.length),
    findingIds,
    topics,
    openQuestions,
    lastQuestion: lastTurn ? lastTurn.question || null : null,
    summary: `Infinity AI retains ${kept.length} turn(s) covering ${findingIds.length} finding(s).`,
  };
}

/**
 * Answer a Q&A prompt in the requested language (idea 52885).
 * Severity words and the answer frame are localized from built-in
 * tables; unsupported languages fall back with a clear note.
 */
export function translateQaAnswer(answer = {}, targetLanguage = 'en', options = {}) {
  const lang = String(targetLanguage || 'en').toLowerCase().slice(0, 8);
  const pack = LANG_PACKS[lang];
  const sev = sevKey(answer.finding || answer);
  if (!pack) {
    return {
      language: lang, supported: false, translatedText: '',
      note: `Language "${lang}" is not in the built-in table (en, es, hi, hinglish, fr).`,
      greeting: 'Infinity AI answer',
    };
  }
  const sevWord = pack.severity[sev] || sev;
  const body = String(answer.text || answer.answer || '');
  const translatedText = lang === 'en' ? body : `${pack.greeting}: [${sevWord}] ${body}`;
  return {
    language: lang,
    languageName: pack.name,
    supported: true,
    translatedText,
    severityWord: sevWord,
    greeting: pack.greeting,
    note: lang === 'hinglish' ? 'Hinglish mixes Hindi words in Latin script for informal teams.' : 'Severity and framing localized; technical terms preserved.',
    audience: options.audience || 'team',
  };
}

/**
 * Record helpful / not-helpful feedback on one answer (idea 52886).
 * The rating updates running totals and a quality score so weak
 * answers surface for review without rewriting history.
 */
export function recordAnswerFeedback(feedback = {}, existing = {}, options = {}) {
  const helpful = feedback.helpful === true || feedback.rating === 'helpful' || feedback.rating === 1;
  const notHelpful = feedback.helpful === false || feedback.rating === 'not-helpful' || feedback.rating === -1 || feedback.rating === 0;
  const prevHelpful = Number(existing.helpfulCount || 0);
  const prevNot = Number(existing.notHelpfulCount || 0);
  const helpfulCount = prevHelpful + (helpful ? 1 : 0);
  const notHelpfulCount = prevNot + (notHelpful ? 1 : 0);
  const total = helpfulCount + notHelpfulCount;
  const qualityScore = total ? Math.round((helpfulCount / total) * 100) : null;
  return {
    answerId: feedback.answerId || existing.answerId || null,
    recorded: helpful || notHelpful,
    helpfulCount,
    notHelpfulCount,
    total,
    qualityScore,
    needsReview: qualityScore !== null && qualityScore < 50 && total >= 3,
    comment: feedback.comment ? String(feedback.comment).slice(0, 200) : null,
    summary: `Infinity AI feedback for ${feedback.answerId || 'answer'}: ${helpfulCount} helpful, ${notHelpfulCount} not helpful.`,
  };
}

/**
 * Answer a question over an archived hunt (idea 52887).
 * The archive index (findings, Q&A, stats) is searched by keyword
 * and the best-matching records are cited as sources.
 */
export function queryArchivedHunt(archive = {}, question = '', options = {}) {
  const qTokens = new Set(tokenize(question));
  const findings = (archive.findings || []).map(f => ({ ...f }));
  const qa = (archive.qaHistory || archive.qa || []).map(e => ({ ...e }));
  const scored = [];
  for (const f of findings) {
    const text = `${f.title || ''} ${f.cwe || ''} ${f.target || ''} ${(f.evidence || []).join(' ')}`.toLowerCase();
    const hits = [...qTokens].filter(t => text.includes(t)).length;
    if (hits > 0) scored.push({ kind: 'finding', id: f.id, title: f.title || 'Untitled', score: hits, severity: sevKey(f) });
  }
  for (const e of qa) {
    const text = `${e.question || ''} ${e.answer || ''}`.toLowerCase();
    const hits = [...qTokens].filter(t => text.includes(t)).length;
    if (hits > 0) scored.push({ kind: 'qa', id: e.id, title: e.question || 'Q&A entry', score: hits, severity: 'info' });
  }
  scored.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  const top = scored.slice(0, Number(options.limit || 5));
  const answer = top.length
    ? `Infinity AI (archive ${archive.huntId || 'hunt'}): closest match is ${top[0].title} (${top[0].kind} ${top[0].id}).`
    : `Infinity AI: no archive record matches "${String(question).slice(0, 60)}" in ${archive.huntId || 'this hunt'}.`;
  return {
    huntId: archive.huntId || null,
    archived: true,
    answer,
    sources: top,
    sourceCount: top.length,
    summary: answer,
  };
}

/**
 * Show the vulnerable code pattern behind a finding (idea 52888).
 * Source snippets supplied by the caller are matched to the finding
 * class; line references and a short explanation are returned.
 */
export function showCodeContext(finding = {}, codebase = {}, options = {}) {
  const files = (codebase.files || []).map(f => ({ ...f, lines: [...(f.lines || [])] }));
  const cwe = String(finding.cwe || '').toUpperCase();
  const patterns = [
    { match: /CWE-89|SQLI/i, re: /query\(|execute\(|SELECT|INSERT INTO/i, label: 'Database query built from input' },
    { match: /CWE-79|XSS/i, re: /innerHTML|document\.write|dangerouslySetInnerHTML/i, label: 'Unescaped output rendering' },
    { match: /CWE-862|CWE-639|IDOR/i, re: /req\.params|findById|getObject/i, label: 'Object lookup without ownership check' },
    { match: /CWE-918|SSRF/i, re: /fetch\(|axios\.get|http\.get/i, label: 'Server-side fetch of a supplied URL' },
    { match: /CWE-22|TRAVERSAL/i, re: /readFile|sendFile|path\.join/i, label: 'File path built from input' },
  ];
  const active = patterns.filter(p => p.match.test(`${cwe} ${finding.title || ''}`));
  const checks = active.length ? active : patterns;
  const snippets = [];
  for (const file of files) {
    file.lines.forEach((line, idx) => {
      for (const p of checks) {
        if (p.re.test(String(line))) {
          snippets.push({
            file: file.path || file.name || 'file',
            line: idx + 1,
            code: redact(String(line)).slice(0, 120),
            pattern: p.label,
          });
        }
      }
    });
  }
  const top = snippets.slice(0, Number(options.limit || 5));
  return {
    findingId: finding.id || null,
    cwe: cwe || 'UNSPECIFIED',
    snippets: top,
    snippetCount: top.length,
    hasSource: files.length > 0,
    summary: top.length
      ? `Infinity AI found ${top.length} code snippet(s) matching ${finding.id || 'the finding'}.`
      : 'Infinity AI: no matching code snippet in the supplied source.',
  };
}

/**
 * Answer operational questions about the hunt itself (idea 52889).
 * Request counts, duration, engine usage, and coverage are computed
 * from the hunt record the caller supplies.
 */
export function answerHuntStatistics(hunt = {}, question = '', options = {}) {
  const findings = hunt.findings || [];
  const requests = Number(hunt.stats?.requests ?? hunt.requestsSent ?? findings.reduce((s, f) => s + Number(f.requests || 0), 0));
  const durationMin = Number(hunt.stats?.durationMinutes ?? hunt.durationMinutes ?? 0);
  const engines = hunt.stats?.engines || hunt.enginesUsed || [...new Set(findings.map(f => f.engine).filter(Boolean))];
  const bySev = {};
  for (const f of findings) bySev[sevKey(f)] = (bySev[sevKey(f)] || 0) + 1;
  const q = String(question || '').toLowerCase();
  let focus = 'overview';
  if (/request|sent|hit/.test(q)) focus = 'requests';
  if (/long|duration|time|hour|minute/.test(q)) focus = 'duration';
  if (/engine|tool|scanner/.test(q)) focus = 'engines';
  if (/finding|found|issue/.test(q)) focus = 'findings';
  const values = {
    requests, durationMinutes: durationMin,
    findings: findings.length, engines: engines.length,
    critical: bySev.critical || 0, high: bySev.high || 0,
  };
  const answer = focus === 'requests'
    ? `Infinity AI sent ${requests} request(s) during ${hunt.huntId || 'this hunt'}.`
    : focus === 'duration'
      ? `Infinity AI ran ${hunt.huntId || 'this hunt'} for ${durationMin} minute(s).`
      : focus === 'engines'
        ? `Infinity AI used ${engines.length} engine(s): ${engines.join(', ') || 'none recorded'}.`
        : focus === 'findings'
          ? `Infinity AI recorded ${findings.length} finding(s) (${values.critical} critical, ${values.high} high).`
          : `Infinity AI hunt ${hunt.huntId || ''}: ${findings.length} finding(s), ${requests} request(s), ${durationMin} minute(s).`;
  return { huntId: hunt.huntId || null, focus, values, answer, summary: answer };
}

/**
 * Reopen a closed hunt in one action (idea 52890).
 * Eligibility, the state transition, and the restored surface are
 * computed from the hunt record; ineligible hunts are refused plainly.
 */
export function reopenHuntOneClick(hunt = {}, options = {}) {
  const state = String(hunt.status || hunt.state || '').toLowerCase();
  const eligible = REOPENABLE_STATES.includes(state);
  const reason = validateReopenReason(options.reason || hunt.reopenReason || 'New information requires another look.');
  return {
    huntId: hunt.huntId || hunt.id || null,
    previousState: state || 'unknown',
    eligible,
    newState: eligible ? 'open' : state,
    restored: eligible,
    reasonValid: reason.valid,
    steps: eligible
      ? ['Snapshot located', 'State restored', 'Hunt marked open', 'Watchers notified']
      : ['Reopen refused: hunt is not in a closed or archived state'],
    summary: eligible
      ? `Infinity AI reopened ${hunt.huntId || hunt.id || 'the hunt'} from ${state}.`
      : `Infinity AI cannot reopen a hunt in state "${state || 'unknown'}".`,
  };
}

/**
 * Enforce a documented reason before any reopen (idea 52891).
 * Blank, too-short, or placeholder reasons fail validation with the
 * specific gaps listed so the audit trail stays meaningful.
 */
export function validateReopenReason(reason = '', options = {}) {
  const text = String(reason || '').trim();
  const minLength = Number(options.minLength || 12);
  const placeholders = ['test', 'asdf', 'reopen', 'because', 'n/a', 'na', 'to-do', 'fix'];
  const missing = [];
  if (!text) missing.push('reason is blank');
  if (text.length < minLength) missing.push(`reason is shorter than ${minLength} characters`);
  if (placeholders.includes(text.toLowerCase())) missing.push('reason is a placeholder, not an explanation');
  if (text && !/[a-z]/i.test(text)) missing.push('reason contains no readable words');
  const category = /regression|broke again|returned/i.test(text) ? 'regression'
    : /intel|threat|cve|advisory/i.test(text) ? 'new-intel'
      : /scope|new endpoint|new subdomain|expanded/i.test(text) ? 'scope-change'
        : /dispute|appeal|false positive/i.test(text) ? 'dispute'
          : 'general';
  return {
    valid: missing.length === 0,
    reason: text,
    category,
    missing,
    summary: missing.length
      ? `Infinity AI reopen reason rejected: ${missing.join('; ')}.`
      : `Infinity AI reopen reason accepted (${category}).`,
  };
}

/**
 * Restore the exact state a hunt had when it closed (idea 52892).
 * Findings, triage decisions, and comments are counted from the
 * snapshot; the restored hunt is a copy, never the snapshot itself.
 */
export function restoreStateSnapshot(snapshot = {}, options = {}) {
  const findings = (snapshot.findings || []).map(f => ({ ...f }));
  const decisions = (snapshot.decisions || snapshot.triageDecisions || []).map(d => ({ ...d }));
  const comments = (snapshot.comments || []).map(c => ({ ...c }));
  const byStatus = {};
  for (const f of findings) byStatus[String(f.status || 'new').toLowerCase()] = (byStatus[String(f.status || 'new').toLowerCase()] || 0) + 1;
  return {
    huntId: snapshot.huntId || null,
    snapshotAt: snapshot.closedAt || snapshot.snapshotAt || null,
    restoredFindings: findings.length,
    restoredDecisions: decisions.length,
    restoredComments: comments.length,
    byStatus,
    findings,
    intact: findings.length === Number(snapshot.findingCount ?? findings.length),
    summary: `Infinity AI restored ${findings.length} finding(s), ${decisions.length} decision(s), ${comments.length} comment(s) for ${snapshot.huntId || 'the hunt'}.`,
  };
}

/**
 * Reopen an archived hunt in one restore-plus-reopen flow (idea 52893).
 * Archive integrity is checked first, then the snapshot is restored
 * and the hunt returns to the open state with its history intact.
 */
export function reopenFromArchive(archivedHunt = {}, options = {}) {
  const hasSnapshot = Boolean(archivedHunt.snapshot || archivedHunt.findings);
  const snapshot = archivedHunt.snapshot || archivedHunt;
  const restored = restoreStateSnapshot({
    huntId: archivedHunt.huntId || archivedHunt.id,
    closedAt: archivedHunt.archivedAt || archivedHunt.closedAt,
    findings: snapshot.findings || [],
    decisions: snapshot.decisions || snapshot.triageDecisions || [],
    comments: snapshot.comments || [],
    findingCount: snapshot.findingCount,
  }, options);
  const steps = [
    { step: 1, action: 'Locate archive record', done: true },
    { step: 2, action: 'Verify snapshot integrity', done: hasSnapshot },
    { step: 3, action: 'Restore findings, decisions, and comments', done: hasSnapshot },
    { step: 4, action: 'Mark hunt open and re-index', done: hasSnapshot },
  ];
  return {
    huntId: archivedHunt.huntId || archivedHunt.id || null,
    fromArchive: true,
    success: hasSnapshot,
    steps,
    restored,
    summary: hasSnapshot
      ? `Infinity AI reopened ${archivedHunt.huntId || 'the hunt'} from archive with ${restored.restoredFindings} finding(s).`
      : 'Infinity AI: archive snapshot missing; reopen from archive cannot proceed.',
  };
}

/**
 * Notify watchers and stakeholders that a hunt reopened (idea 52894).
 * Recipients are deduplicated from watchers, assignees, and owners;
 * each gets a channel-appropriate message with the reason attached.
 */
export function buildReopenNotifications(hunt = {}, reopenEvent = {}, options = {}) {
  const people = new Map();
  const add = (id, role) => {
    if (!id) return;
    const key = String(id);
    if (!people.has(key)) people.set(key, { recipient: key, roles: [] });
    people.get(key).roles.push(role);
  };
  for (const w of hunt.watchers || []) add(w, 'watcher');
  for (const a of hunt.assignees || []) add(a, 'assignee');
  if (hunt.owner) add(hunt.owner, 'owner');
  if (reopenEvent.requestedBy) add(reopenEvent.requestedBy, 'requester');
  const reason = String(reopenEvent.reason || 'No reason recorded.').slice(0, 120);
  const notifications = [...people.values()].map(p => ({
    recipient: p.recipient,
    roles: [...new Set(p.roles)],
    channel: p.roles.includes('owner') ? 'email+in-app' : 'in-app',
    message: `Infinity AI: hunt ${hunt.huntId || hunt.id || ''} reopened by ${reopenEvent.requestedBy || 'a teammate'}. Reason: ${reason}`,
  }));
  return {
    huntId: hunt.huntId || hunt.id || null,
    notifications,
    recipientCount: notifications.length,
    summary: `Infinity AI will notify ${notifications.length} recipient(s) about the reopen of ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Append an immutable entry to the reopen audit log (idea 52895).
 * Who, when, why, and the prior state are recorded; the previous
 * log is copied so history can never be rewritten in place.
 */
export function recordReopenAuditLog(event = {}, existingLog = [], options = {}) {
  const prior = (existingLog || []).map(e => ({ ...e }));
  const entry = {
    seq: prior.length + 1,
    huntId: event.huntId || null,
    actor: event.actor || event.requestedBy || 'unknown',
    at: event.at || options.now || '2026-10-09T00:00:00Z',
    action: 'reopen',
    reason: String(event.reason || '').slice(0, 200),
    previousState: event.previousState || 'closed',
    newState: 'open',
  };
  const log = [...prior, entry];
  return {
    entry,
    log,
    totalEntries: log.length,
    complianceReady: Boolean(entry.actor !== 'unknown' && entry.reason),
    summary: `Infinity AI audit #${entry.seq}: ${entry.actor} reopened ${entry.huntId || 'the hunt'} (${entry.previousState} → open).`,
  };
}

/**
 * Control which roles may reopen a hunt (idea 52896).
 * Role membership, hunt sensitivity, and ownership decide access;
 * denials name the exact gate that failed.
 */
export function checkReopenPermission(user = {}, hunt = {}, options = {}) {
  const role = String(user.role || '').toLowerCase();
  const allowedRoles = (options.allowedRoles || REOPEN_ROLES).map(r => String(r).toLowerCase());
  const isOwner = hunt.owner && user.id && String(hunt.owner) === String(user.id);
  const sensitive = Boolean(hunt.sensitive || hunt.requiresApproval);
  const roleAllowed = allowedRoles.includes(role) || Boolean(isOwner);
  const allowed = roleAllowed && (!sensitive || role === 'lead' || role === 'admin' || role === 'security-lead' || Boolean(isOwner));
  const reasons = [];
  if (!roleAllowed) reasons.push(`role "${role || 'unknown'}" cannot reopen hunts`);
  if (sensitive && roleAllowed && !allowed) reasons.push('sensitive hunt needs lead or admin approval');
  if (allowed) reasons.push(isOwner ? 'hunt owner may reopen' : `role "${role}" may reopen`);
  return {
    userId: user.id || null,
    role: role || 'unknown',
    huntId: hunt.huntId || hunt.id || null,
    allowed,
    needsApproval: sensitive && !allowed && roleAllowed,
    reasons,
    summary: allowed
      ? `Infinity AI: ${user.id || 'user'} may reopen ${hunt.huntId || 'the hunt'}.`
      : `Infinity AI: reopen denied for ${user.id || 'user'} — ${reasons[0] || 'not authorized'}.`,
  };
}

/**
 * Advise reopen versus starting a fresh hunt (idea 52897).
 * What changed since close — scope drift, time elapsed, and new
 * surface — scores the two paths with concrete reasons.
 */
export function guideReopenVsNew(hunt = {}, changes = {}, options = {}) {
  const closedMs = parseMs(hunt.closedAt);
  const nowMs = parseMs(options.now) || Date.parse('2026-10-09T00:00:00Z');
  const ageDays = closedMs !== null ? Math.max(0, Math.round((nowMs - closedMs) / 86400000)) : 0;
  const scopeDrift = Number(changes.scopeDriftPercent ?? changes.newEndpoints ?? 0);
  const newIntel = Boolean(changes.newIntel || changes.threatIntel);
  const regression = Boolean(changes.regressionSuspected);
  let reopenScore = 50;
  const reopenReasons = [];
  const newReasons = [];
  if (ageDays <= 90) { reopenScore += 15; reopenReasons.push('closed recently, context still fresh'); }
  if (ageDays > 180) { reopenScore -= 25; newReasons.push('closed long ago; a fresh baseline is cleaner'); }
  if (scopeDrift > 40) { reopenScore -= 20; newReasons.push('scope changed a lot since close'); }
  if (scopeDrift > 0 && scopeDrift <= 40) { reopenScore += 5; reopenReasons.push('modest scope change fits a reopen'); }
  if (newIntel) { reopenScore += 15; reopenReasons.push('new intel maps to the original target'); }
  if (regression) { reopenScore += 20; reopenReasons.push('a suspected regression belongs in the original hunt'); }
  const recommendReopen = reopenScore >= 50;
  return {
    huntId: hunt.huntId || hunt.id || null,
    recommendation: recommendReopen ? 'reopen' : 'new-hunt',
    reopenScore,
    ageDays,
    reopenReasons,
    newHuntReasons: newReasons,
    summary: `Infinity AI recommends ${recommendReopen ? 'reopening' : 'a new hunt'} for ${hunt.huntId || 'this target'} (score ${reopenScore}).`,
  };
}

/**
 * Re-index a reopened hunt for search and analytics (idea 52898).
 * Finding, Q&A, and metadata documents are rebuilt as index entries
 * so the hunt is discoverable everywhere again.
 */
export function reindexReopenedHunt(hunt = {}, index = {}, options = {}) {
  const findings = hunt.findings || [];
  const qa = hunt.qaHistory || hunt.qa || [];
  const entries = [];
  entries.push({ docId: `hunt:${hunt.huntId || hunt.id}`, kind: 'hunt', text: `${hunt.target || ''} ${hunt.title || ''}`.trim() });
  for (const f of findings) entries.push({ docId: `finding:${f.id}`, kind: 'finding', text: `${f.title || ''} ${f.cwe || ''} ${f.target || ''}`.trim() });
  for (const e of qa) entries.push({ docId: `qa:${e.id}`, kind: 'qa', text: `${e.question || ''} ${e.answer || ''}`.trim().slice(0, 120) });
  const priorCount = Number((index.entries || index.documents || []).length || index.count || 0);
  return {
    huntId: hunt.huntId || hunt.id || null,
    entries,
    documentsIndexed: entries.length,
    byKind: entries.reduce((acc, e) => { acc[e.kind] = (acc[e.kind] || 0) + 1; return acc; }, {}),
    priorIndexSize: priorCount,
    searchable: entries.length > 0,
    summary: `Infinity AI re-indexed ${entries.length} document(s) for ${hunt.huntId || 'the hunt'}.`,
  };
}

/**
 * Reopen with extra scope appended to the original (idea 52899).
 * New subdomains and endpoints merge with the original scope;
 * duplicates and exclusions are handled explicitly.
 */
export function planExtendedScopeReopen(hunt = {}, extensions = {}, options = {}) {
  const original = [...(hunt.scope?.include || hunt.scope || [])].map(String);
  const excluded = new Set([...(hunt.scope?.exclude || []), ...(extensions.exclude || [])].map(s => String(s).toLowerCase()));
  const added = [...(extensions.include || extensions.newSubdomains || []), ...(extensions.newEndpoints || [])].map(String);
  const merged = [...original];
  const addedKept = [];
  const skipped = [];
  for (const item of added) {
    if (excluded.has(item.toLowerCase())) { skipped.push({ item, why: 'excluded' }); continue; }
    if (merged.map(s => s.toLowerCase()).includes(item.toLowerCase())) { skipped.push({ item, why: 'duplicate' }); continue; }
    merged.push(item);
    addedKept.push(item);
  }
  return {
    huntId: hunt.huntId || hunt.id || null,
    originalCount: original.length,
    added: addedKept,
    addedCount: addedKept.length,
    skipped,
    mergedScope: merged,
    summary: `Infinity AI extended scope for ${hunt.huntId || 'the hunt'}: ${original.length} → ${merged.length} item(s).`,
  };
}

/**
 * Merge new discoveries into a reopened hunt (idea 52900).
 * Incoming findings are appended with fresh ids where they collide;
 * the original history and ordering stay untouched.
 */
export function appendNewFindings(reopenedHunt = {}, newFindings = [], options = {}) {
  const existing = (reopenedHunt.findings || []).map(f => ({ ...f }));
  const existingIds = new Set(existing.map(f => String(f.id)));
  const appended = [];
  const renamed = [];
  for (const f of newFindings || []) {
    const copy = { ...f };
    if (existingIds.has(String(copy.id))) {
      const freshId = `${copy.id}-r${existingIds.size + appended.length + 1}`;
      renamed.push({ from: copy.id, to: freshId });
      copy.id = freshId;
      copy.appendedOnReopen = true;
    } else {
      copy.appendedOnReopen = true;
    }
    existingIds.add(String(copy.id));
    appended.push(copy);
  }
  const merged = [...existing, ...appended];
  return {
    huntId: reopenedHunt.huntId || reopenedHunt.id || null,
    findings: merged,
    originalCount: existing.length,
    appendedCount: appended.length,
    totalCount: merged.length,
    renamed,
    summary: `Infinity AI appended ${appended.length} new finding(s) to ${reopenedHunt.huntId || 'the hunt'} (${merged.length} total).`,
  };
}
