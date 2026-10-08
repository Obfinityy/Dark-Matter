/**
 * questionCore.js — wave 41 (ideas 51601–51620): question/interruption
 * management engine for Infinity AI.
 *
 * Pure logic for the agent's mid-hunt question layer: batching non-urgent
 * questions into digests, urgency labels, auto-answer rules, full question
 * history, response analytics, silent-mode queuing, voice delivery, mobile
 * cards, escalation, phase-boundary timing, answer previews, multi-option
 * questions, templates, fatigue guarding, an audit log, question-driven
 * learning, emergency breakthrough, delegation, confidence display, and
 * post-hunt decision review.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random(); time is
 * always passed in as an argument.
 */

export const WAVE41_QN_START = 51601;
export const WAVE41_QN_END = 51620;

/** Registry of the 20 question-management ideas — completeness is testable. */
export const WAVE41_QN_IDEAS = [
  [51601, 'question batching (mid-hunt)', 'Non-urgent questions grouped into a single digest'],
  [
    51602,
    'question urgency labels',
    'Every agent question marked fyi, decision-needed, or blocking',
  ],
  [
    51603,
    'auto-answer rules',
    'Predefine answers to recurring questions like "yes, always dig deeper"',
  ],
  [51604, 'question history', 'Review every question the agent asked and how you answered'],
  [
    51605,
    'question response analytics',
    'Which of your answers led to the best outcomes, tracked over time',
  ],
  [
    51606,
    'silent-mode questions',
    'In quiet mode, questions queue silently instead of interrupting',
  ],
  [51607, 'voice-asked questions', 'The avatar speaks important questions aloud'],
  [51608, 'mobile question cards', 'Proactive questions as swipeable cards on your phone'],
  [51609, 'question escalation', 'Unanswered blocking questions escalate to a teammate'],
  [51610, 'contextual question timing', 'Questions arrive at phase boundaries, not mid-thought'],
  [51611, 'question previews', 'See what the agent will do for each answer option before choosing'],
  [51612, 'multi-option questions', 'Questions with 3–4 concrete options instead of yes/no'],
  [51613, 'question templates', "The agent's question style adapts to your preferred format"],
  [51614, 'question fatigue guard', 'The agent limits how often it interrupts you per hour'],
  [51615, 'proactive question log', 'An auditable record of every question and decision'],
  [51616, 'question-driven learning', "Your answers fine-tune the agent's future judgment"],
  [51617, 'emergency questions', 'Critical questions break through quiet hours and do-not-disturb'],
  [51618, 'question delegation', 'Route specific question types to designated teammates'],
  [
    51619,
    'question confidence display',
    'The agent shows how strongly it leans toward each option',
  ],
  [51620, 'post-hunt question review', 'Revisit the key decisions the agent asked you to make'],
];

/** The three sanctioned urgency labels (idea 51602). */
export const URGENCY_LABELS = ['fyi', 'decision-needed', 'blocking'];

const URGENCY_RANK = { fyi: 0, 'decision-needed': 1, blocking: 2 };

/* --- shared helpers ---------------------------------------------------------- */

/** FNV-1a 32-bit hash, used for deterministic question/snapshot IDs. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function clamp(n, lo, hi) {
  const v = Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

export function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Deterministic question ID from kind + title + timestamp. */
export function questionId(kind, title, askedAtMs) {
  return (
    'Q-' +
    fnv1a(kind + '|' + title + '|' + String(askedAtMs))
      .toString(16)
      .padStart(8, '0')
  );
}

/** Validate an urgency label, defaulting to 'fyi'. */
export function labelUrgency(question) {
  const q = question || {};
  const label = URGENCY_LABELS.includes(q.urgency) ? q.urgency : 'fyi';
  return { ...q, urgency: label };
}

/* --- core question record (51601/51602 plumbing) ----------------------------- */

export function newQuestion(kind, title, body, options, urgency, askedAtMs) {
  const id = questionId(kind, title, askedAtMs);
  return labelUrgency({
    id,
    kind: String(kind || 'general'),
    urgency: String(urgency || 'fyi'),
    title: String(title || ''),
    body: String(body || ''),
    options: Array.isArray(options)
      ? options.map(o => ({
          key: String(o.key),
          label: String(o.label),
          detail: String(o.detail || ''),
        }))
      : [],
    status: 'open',
    answerKey: null,
    askedAtMs: Number(askedAtMs) || 0,
    answeredAtMs: null,
    escalated: false,
    delegatedTo: null,
    snoozedUntilMs: null,
  });
}

export function answerQuestion(question, answerKey, answeredAtMs) {
  const q = question || {};
  const valid = (q.options || []).some(o => o.key === answerKey);
  if (!valid) return { ...q };
  return { ...q, status: 'answered', answerKey, answeredAtMs: Number(answeredAtMs) || 0 };
}

/* --- 51601 question batching (mid-hunt) ---------------------------------------- */

/**
 * Group non-urgent questions into a single digest; blocking questions stay
 * standalone. Returns { digest, standalone }.
 */
export function batchQuestions(questions, nowMs) {
  const list = Array.isArray(questions) ? questions : [];
  const standalone = [];
  const digestible = [];
  for (const q of list) {
    if ((q.urgency || 'fyi') === 'blocking' || q.status !== 'open') standalone.push(q);
    else digestible.push(q);
  }
  const digest = digestible.length
    ? {
        id: 'DIGEST-' + fnv1a(digestible.map(q => q.id).join(',')).toString(16),
        kind: 'digest',
        title: digestible.length + ' questions need your input',
        body: digestible.map(q => '• ' + q.title).join('\n'),
        items: digestible.map(q => q.id),
        urgency: digestible.some(q => q.urgency === 'decision-needed') ? 'decision-needed' : 'fyi',
        createdAtMs: Number(nowMs) || 0,
      }
    : null;
  return { digest, standalone };
}

/* --- 51603 auto-answer rules ---------------------------------------------------- */

export function createAutoAnswerRule(pattern, answerKey, reason) {
  return {
    id: 'RULE-' + fnv1a(String(pattern) + '|' + String(answerKey)).toString(16),
    pattern: String(pattern || ''),
    answerKey: String(answerKey || ''),
    reason: String(reason || ''),
    hits: 0,
    enabled: true,
  };
}

/**
 * If a rule's pattern (substring of kind or title, case-insensitive) matches
 * an open question, the rule answers it. Returns { question, ruleId } —
 * ruleId is null when nothing matched.
 */
export function applyAutoAnswerRules(question, rules, answeredAtMs) {
  const q = question || {};
  const list = Array.isArray(rules) ? rules : [];
  for (const rule of list) {
    if (!rule || !rule.enabled) continue;
    const hay = (q.kind + ' ' + q.title).toLowerCase();
    const needle = String(rule.pattern || '').toLowerCase();
    if (needle && hay.includes(needle)) {
      const hit = (q.options || []).some(o => o.key === rule.answerKey);
      const ans = hit
        ? answerQuestion(q, rule.answerKey, answeredAtMs)
        : {
            ...q,
            status: 'answered',
            answerKey: rule.answerKey,
            answeredAtMs: Number(answeredAtMs) || 0,
          };
      return {
        question: { ...ans, autoAnswered: true, autoAnswerRuleId: rule.id },
        ruleId: rule.id,
      };
    }
  }
  return { question: { ...q }, ruleId: null };
}

/* --- 51604 question history ------------------------------------------------------ */

export function recordQuestion(store, question, askedAtMs) {
  const s = store && Array.isArray(store.questions) ? store : { questions: [] };
  const q = question || newQuestion('general', 'untitled', '', [], 'fyi', askedAtMs);
  return { questions: s.questions.concat([{ ...q, askedAtMs: Number(askedAtMs) || 0 }]) };
}

export function questionHistory(store) {
  const s = store || { questions: [] };
  return s.questions.slice().sort((a, b) => (b.askedAtMs || 0) - (a.askedAtMs || 0));
}

/* --- 51605 question response analytics -------------------------------------------- */

export function recordAnswerOutcome(store, questionIdArg, answerKey, outcomeScore, answeredAtMs) {
  const s = store && Array.isArray(store.outcomes) ? store : { outcomes: [] };
  return {
    outcomes: s.outcomes.concat([
      {
        questionId: String(questionIdArg),
        answerKey: String(answerKey),
        outcomeScore: clamp(outcomeScore, 0, 100),
        answeredAtMs: Number(answeredAtMs) || 0,
      },
    ]),
  };
}

export function answerOutcomeAnalytics(store) {
  const s = store || { outcomes: [] };
  const byKey = {};
  for (const o of s.outcomes) {
    const k = o.answerKey;
    byKey[k] = byKey[k] || { answerKey: k, count: 0, total: 0 };
    byKey[k].count += 1;
    byKey[k].total += o.outcomeScore;
  }
  return Object.values(byKey)
    .map(b => ({
      answerKey: b.answerKey,
      count: b.count,
      avgScore: Math.round((b.total / b.count) * 10) / 10,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

/* --- 51606 silent-mode questions -------------------------------------------------- */

export function quietModeQueue(queue, question) {
  const q = Array.isArray(queue) ? queue : [];
  const qq = labelUrgency(question || {});
  return q.concat([{ ...qq, delivered: false, queuedSilently: true }]);
}

export function deliverQuietQueue(queue) {
  const q = Array.isArray(queue) ? queue : [];
  return {
    delivered: q.map(item => ({ ...item, delivered: true, queuedSilently: false })),
    queue: [],
  };
}

/* --- 51607 voice-asked questions ---------------------------------------------------- */

export function voiceAskedDescriptor(question, voice) {
  const q = labelUrgency(question || {});
  const priority = q.urgency === 'blocking' ? 'high' : 'normal';
  return {
    questionId: q.id || null,
    speakText: (q.title || '') + '. ' + (q.body || ''),
    voice: String(voice || 'aria'),
    priority,
    spokenAtMs: null,
  };
}

/* --- 51608 mobile question cards ------------------------------------------------------ */

export function mobileQuestionCard(question) {
  const q = labelUrgency(question || {});
  return {
    cardId: 'CARD-' + (q.id || 'none'),
    title: q.title || '',
    body: q.body || '',
    urgency: q.urgency,
    swipeActions: (q.options || []).slice(0, 4).map(o => ({ key: o.key, label: o.label })),
    compact: true,
  };
}

/* --- 51609 question escalation --------------------------------------------------------- */

export function escalateQuestion(question, teammate, nowMs) {
  const q = labelUrgency(question || {});
  if (q.urgency !== 'blocking' || q.status !== 'open') return { ...q, escalated: false };
  return {
    ...q,
    escalated: true,
    escalatedTo: String(teammate || 'on-call'),
    escalatedAtMs: Number(nowMs) || 0,
  };
}

/* --- 51610 contextual question timing --------------------------------------------------- */

const PHASE_BOUNDARIES = ['recon-complete', 'scan-complete', 'triage-complete', 'report-ready'];

/**
 * Questions arrive at phase boundaries, not mid-thought. Returns a timing
 * recommendation: ask now when at a boundary or the question is blocking,
 * otherwise hold until the next boundary.
 */
export function questionTiming(question, huntPhase, nowMs) {
  const q = labelUrgency(question || {});
  const atBoundary = PHASE_BOUNDARIES.includes(String(huntPhase || ''));
  const askNow = atBoundary || q.urgency === 'blocking';
  return {
    questionId: q.id || null,
    huntPhase: String(huntPhase || ''),
    atBoundary,
    askNow,
    holdUntilPhase: askNow ? null : PHASE_BOUNDARIES[0] || null,
    evaluatedAtMs: Number(nowMs) || 0,
  };
}

/* --- 51611 question previews ------------------------------------------------------------- */

export function questionPreview(question, outcomeHints) {
  const q = question || {};
  const hints = outcomeHints || {};
  return {
    questionId: q.id || null,
    options: (q.options || []).map(o => ({
      optionKey: o.key,
      label: o.label,
      previewText: hints[o.key] || 'The agent will continue based on your choice.',
    })),
  };
}

/* --- 51612 multi-option questions ---------------------------------------------------------- */

export function multiOptionQuestion(title, body, options, urgency) {
  const opts = Array.isArray(options) ? options : [];
  if (opts.length < 3 || opts.length > 4) {
    throw new Error('multi-option questions require 3–4 options (got ' + opts.length + ')');
  }
  const q = newQuestion('multi-option', title, body, opts, urgency, 0);
  return { ...q, kind: 'multi-option' };
}

/* --- 51613 question templates ---------------------------------------------------------------- */

export const QUESTION_TEMPLATES = {
  concise: { intro: '', closing: 'One-tap answer preferred.' },
  detailed: { intro: 'Context: ', closing: 'Take your time — detail included above.' },
  socratic: { intro: 'Before I continue: ', closing: 'Your call shapes the next phase.' },
};

export function applyQuestionTemplate(templateKey, fields) {
  const t = QUESTION_TEMPLATES[String(templateKey)] || QUESTION_TEMPLATES.concise;
  const f = fields || {};
  return {
    title: String(f.title || ''),
    body: (t.intro + String(f.context || '') + ' ' + String(f.ask || '')).trim() + ' ' + t.closing,
    template: String(templateKey || 'concise'),
  };
}

/* --- 51614 question fatigue guard --------------------------------------------------------------- */

export function fatigueGuard(askedThisHour, limitPerHour) {
  const asked = Math.max(0, Number(askedThisHour) || 0);
  const limit = Math.max(1, Number(limitPerHour) || 5);
  return {
    askedThisHour: asked,
    limitPerHour: limit,
    allowed: asked < limit,
    remaining: Math.max(0, limit - asked),
  };
}

/* --- 51615 proactive question log ----------------------------------------------------------------- */

export function logQuestion(log, entry) {
  const l = Array.isArray(log) ? log : [];
  const e = entry || {};
  return l.concat([
    {
      id: String(e.id || 'log-' + l.length),
      questionId: String(e.questionId || ''),
      action: String(e.action || 'asked'),
      detail: String(e.detail || ''),
      atMs: Number(e.atMs) || 0,
    },
  ]);
}

export function questionAuditLog(log) {
  const l = Array.isArray(log) ? log : [];
  return l
    .slice()
    .sort((a, b) => (a.atMs || 0) - (b.atMs || 0))
    .map(e => ({
      ...e,
      line:
        '[' + e.atMs + '] ' + e.action + ' — ' + e.questionId + (e.detail ? ': ' + e.detail : ''),
    }));
}

/* --- 51616 question-driven learning ------------------------------------------------------------------ */

export function learnFromAnswer(profile, answerKey, contextTags) {
  const p = profile && typeof profile === 'object' ? profile : { weights: {} };
  const weights = { ...(p.weights || {}) };
  const tags = Array.isArray(contextTags) ? contextTags : [];
  for (const tag of tags) {
    const k = String(tag) + ':' + String(answerKey);
    weights[k] = (weights[k] || 0) + 1;
  }
  return { ...p, weights, learnedAt: tags.length };
}

export function learningConfidence(profile, contextTag, answerKey) {
  const weights = (profile && profile.weights) || {};
  const k = String(contextTag) + ':' + String(answerKey);
  const total = Object.keys(weights)
    .filter(key => key.startsWith(String(contextTag) + ':'))
    .reduce((sum, key) => sum + weights[key], 0);
  if (!total) return 0;
  return Math.round(((weights[k] || 0) / total) * 100);
}

/* --- 51617 emergency questions -------------------------------------------------------------------------- */

export function emergencyBreakthrough(question, nowMs, quietHours) {
  const q = labelUrgency(question || {});
  const hours = quietHours || {};
  const isQuietHour =
    hours.start != null &&
    hours.end != null &&
    isWithinQuietHour(Number(nowMs) || 0, hours.start, hours.end);
  const breaksThrough = q.urgency === 'blocking' && q.kind === 'emergency';
  return {
    questionId: q.id || null,
    isQuietHour,
    breaksThrough,
    delivery: breaksThrough ? 'interrupt' : isQuietHour ? 'silent-queue' : 'normal',
  };
}

function isWithinQuietHour(nowMs, startHour, endHour) {
  const d = new Date(nowMs);
  const h = d.getUTCHours();
  if (startHour <= endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}

/* --- 51618 question delegation -------------------------------------------------------------------------------- */

export function delegateQuestion(question, teammate, reason) {
  const q = labelUrgency(question || {});
  return {
    ...q,
    delegatedTo: String(teammate || ''),
    delegationReason: String(reason || ''),
    status: q.status === 'open' ? 'delegated' : q.status,
  };
}

/* --- 51619 question confidence display ---------------------------------------------------------------------------- */

export function confidenceDisplay(options) {
  const opts = Array.isArray(options) ? options : [];
  const total = opts.reduce((sum, o) => sum + (Number(o.confidence) || 0), 0);
  const normalized = opts.map(o => ({
    key: String(o.key),
    label: String(o.label),
    confidence: Number(o.confidence) || 0,
    bar: total > 0 ? Math.round(((Number(o.confidence) || 0) / total) * 100) : 0,
  }));
  const lean = normalized.slice().sort((a, b) => b.confidence - a.confidence)[0] || null;
  return { options: normalized, agentLean: lean ? lean.key : null };
}

/* --- 51620 post-hunt question review ---------------------------------------------------------------------------------- */

export function postHuntReview(store) {
  const s = store || { questions: [] };
  const decided = s.questions.filter(q => q.status === 'answered' || q.status === 'delegated');
  const blocking = decided.filter(q => q.urgency === 'blocking');
  return {
    totalQuestions: s.questions.length,
    decisionsMade: decided.length,
    blockingDecisions: blocking.length,
    keyDecisions: decided.slice(0, 10).map(q => ({
      id: q.id,
      title: q.title,
      urgency: q.urgency,
      answerKey: q.answerKey || null,
      delegatedTo: q.delegatedTo || null,
      autoAnswered: !!q.autoAnswered,
    })),
  };
}
