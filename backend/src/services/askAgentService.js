/**
 * Ask-the-Agent — "agent se baat karo" (talk to the hunting agent).
 *
 * A deterministic conversational status endpoint. It answers ONLY from live
 * persisted job state — the job document, its findings, the reasoning-cycle
 * ledger and the activity feed. No LLM call, no new dependencies, so it works
 * on a plain local machine with zero config.
 *
 * Honesty contract (never fabricate):
 *  - every number comes from the job/findings collections;
 *  - "what is it doing right now" comes from the last activity entries and
 *    currentStep/currentAction — never invented;
 *  - when the hunt hasn't started or data is missing, the reply says so
 *    plainly instead of guessing.
 *
 * The reply language is warm Hinglish-friendly plain language (Roman script),
 * like a friendly assistant — never robotic. Intent detection understands
 * both Hinglish ("kya kar raha hai?") and English ("what are you doing?").
 */

import { sortFindingsCriticalFirst } from './huntDiary.js';

// ── Intent detection ──────────────────────────────────────────────────────
// Ordered: more specific intents first ("band kar de" must beat "kyun ruka").

const INTENT_RULES = [
  // destructive command — answered with guidance, never executed from chat
  { intent: 'stop', patterns: [/band kar ?de/, /rok de/, /^stop\b/, /cancel kar/, /\bstop the hunt\b/] },
  // why did it stop / get stuck
  { intent: 'whystopped', patterns: [/ruk kyun/, /kyun ruk/, /kyun band/, /kyun atka/, /atka hua/, /\bstuck\b/, /why.*(stop(ped)?|paused|stuck|waiting)/, /kya dikkat/] },
  // what is it doing right now
  { intent: 'doing', patterns: [/kya kar rh?[ae]/, /kya ho rh?[ae]/, /abhi kya/, /what.*doing/, /currently/, /\bkya chal rh?[ae]/] },
  // what did it find so far
  { intent: 'findings', patterns: [/kya mila/, /kitn[ie].*(vuln|kamzor|finding|bug)/, /findings?/, /vulnerabilit/, /kamzoriy/, /\bbugs?\b.*(mile|found)/, /what.*(found|find)\b/] },
  // how much is done
  { intent: 'progress', patterns: [/kitna hua/, /kitna.*(complete|baki|baaki|hua)/, /progress/, /percent/, /kitne step/] },
  // what happens next
  { intent: 'next', patterns: [/aage kya/, /agl[ae] kya/, /what.?s next/, /what next/, /next step/, /aage ka plan/] },
  // explicit status ask
  { intent: 'status', patterns: [/\bstatus\b/, /kya haal/, /haal chaal/, /how.*going/] },
];

/** Normalize a user message for keyword matching. */
export function normalizeMessage(message) {
  return String(message || '').toLowerCase().replace(/[?!.,।]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Detect the user's intent from a normalized message. Falls back to 'status'. */
export function detectIntent(message) {
  const text = normalizeMessage(message);
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.intent;
  }
  return 'status';
}

// ── Plain-language labels ────────────────────────────────────────────────

const PHASE_LABELS = {
  idle: 'taiyaari kar raha',
  initializing: 'taiyaari kar raha',
  recon: 'recon kar raha — target ki jaankari jama kar raha',
  enumeration: 'enumeration kar raha — chhipe hue raste dhoondh raha',
  probing: 'probing kar raha — endpoints ko halke se chhu kar dekh raha',
  verifying: 'verification kar raha — mile hue points ko pakka kar raha',
  exploitation: 'exploitation kar raha — kamzoriyon ko safely verify kar raha',
  chaining: 'chaining kar raha — kamzoriyon ko jod kar bada attack bana raha',
  reporting: 'report taiyaar kar raha',
  waiting: 'intezaar kar raha',
  paused: 'ruka hua',
  complete: 'poora ho gaya',
};

const STATUS_LABELS = {
  queued: 'queue mein hai — abhi shuru nahi hua',
  running: 'chal raha hai',
  waiting: 'intezaar kar raha hai',
  paused: 'ruka hua hai',
  cancelling: 'band ho raha hai',
  cancelled: 'band kar diya gaya hai',
  completed: 'poora ho gaya hai',
  failed: 'ruk gaya hai — koi error aaya tha',
};

// Internal jargon that must NEVER be quoted raw in a user-facing reply.
// (e.g. currentStep can hold "PHONE_AI_ENABLED is not true" — meaningless
// to the user, so we describe it plainly instead.)
const INTERNAL_JARGON = /PHONE_AI_ENABLED|UNAVAILABLE|Waiting to recover|no cloud fallback|\bError\b|\bException\b/i;

/** Pick a user-facing "what I'm doing" line, skipping internal jargon. */
function userFacingDoing(job) {
  const candidates = [job.currentStep, job.currentAction, lastActivityText(job)];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text && !INTERNAL_JARGON.test(text)) return text.slice(0, 220);
  }
  return null;
}

/** Plain-language description of what a waiting job is waiting for. */
function waitingText(job) {
  const reason = String(job.waitingReason || '');
  // The brain is online but its decisions were unusable — different from
  // the brain being offline. Say so plainly instead of "waiting for the
  // brain to come online".
  if (/no usable decision|unusable decision|violates the schema|malformed decision/i.test(reason)) {
    return 'local AI brain ke sahi decision de paane';
  }
  if (/PHONE_AI|LOCAL AI/i.test(reason)) return 'local AI brain ke online aane';
  if (reason && !INTERNAL_JARGON.test(reason)) return `"${reason.slice(0, 120)}"`;
  return 'zaroori cheez ke milne';
}

function phaseLabel(phase) {
  return PHASE_LABELS[String(phase || '').toLowerCase()] || String(phase || 'kaam');
}

function statusLabel(status) {
  return STATUS_LABELS[String(status || '').toLowerCase()] || String(status || 'unknown');
}

function elapsedText(job) {
  const start = new Date(job.startedAt || job.createdAt).getTime();
  const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 1) return 'ek minute se kam';
  if (minutes < 60) return `${minutes} minute`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ghante ${minutes % 60} minute`;
}

function lastActivityText(job) {
  const entries = Array.isArray(job.activity) ? job.activity : [];
  if (!entries.length) return null;
  return String(entries[entries.length - 1].message || '').slice(0, 220) || null;
}

function findingsSummary(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const finding of findings) {
    const severity = String(finding.severity || 'informational').toLowerCase();
    if (severity === 'info') counts.informational += 1;
    else if (counts[severity] !== undefined) counts[severity] += 1;
    else counts.informational += 1;
  }
  return { counts, total: findings.length };
}

function topFinding(findings) {
  const sorted = sortFindingsCriticalFirst(findings);
  return sorted.length ? sorted[0] : null;
}

// ── Reply builders (one per intent) ───────────────────────────────────────

function replyDoing(job, findingsInfo) {
  const target = job.target || 'target';
  if (job.status === 'queued') {
    return `Abhi maine ${target} par kaam shuru nahi kiya hai — hunt queue mein hai. Jaise hi slot milega, recon se shuru karunga.`;
  }
  if (job.status === 'waiting') {
    return `Main ruka nahi hun — bas ${waitingText(job)} ka intezaar kar raha hun. Jaise hi ye milega, hunt apne aap aage badhega.`;
  }
  if (job.status === 'paused') {
    return `Main abhi ruka hua hun (pause par hun). ${target} ka hunt wahin se resume hoga jahan ruka tha — kuch bhi khoya nahi hai.`;
  }
  if (job.status === 'completed') {
    return `Is target ka hunt poora ho chuka hai — ab main kuch nahi kar raha. Report taiyaar hai, dekhna ho toh batao.`;
  }
  if (job.status === 'cancelled' || job.status === 'cancelling') {
    return `Ye hunt band ho gaya hai, isliye ab main kuch nahi kar raha. Naya hunt shuru karna ho toh batao.`;
  }
  if (job.status === 'failed') {
    const error = (job.errors || []).slice(-1)[0];
    return `Main ruk gaya hun — aakhri step mein error aaya tha${error ? `: "${error.message}"` : ''}. Ise dekh kar theek karke dobara shuru kar sakte hain.`;
  }
  const doing = userFacingDoing(job);
  let text = `Abhi main ${target} par ${phaseLabel(job.phase)} hun.`;
  if (doing) text += ` Filhaal ye chal raha hai: "${doing}".`;
  else text += ` Ab tak ${job.stepCount || 0} steps ho chuke hain.`;
  if (findingsInfo.total > 0) {
    const { critical, high } = findingsInfo.counts;
    text += ` Ab tak ${findingsInfo.total} finding${critical + high > 0 ? ` mili hain (${critical} critical, ${high} high)` : ' mili hain'}.`;
  }
  return text;
}

function replyFindings(job, findingsInfo, findings) {
  if (findingsInfo.total === 0) {
    if (job.status === 'queued') return 'Abhi tak kuch nahi mila — hunt shuru bhi nahi hua hai. Shuru hote hi jo milega, yahin bataunga.';
    return 'Abhi tak koi pakki finding nahi mili hai. Main abhi bhi dhoondh raha hun — milte hi sabse pehle yahin dikhega.';
  }
  const { critical, high, medium, low } = findingsInfo.counts;
  let text = `Ab tak kul ${findingsInfo.total} findings mili hain — ${critical} critical, ${high} high, ${medium} medium, ${low} low.`;
  const top = topFinding(findings);
  if (top) text += ` Sabse serious: "${top.title}" [${String(top.severity).toUpperCase()}].`;
  return text;
}

function replyProgress(job) {
  const plan = job.plan || {};
  const done = (plan.completedSteps || []).length;
  const pending = (plan.pendingSteps || []).length;
  let text = `Hunt ${statusLabel(job.status)} — ${elapsedText(job)} ho gaye hain, ${job.stepCount || 0} steps complete.`;
  if (done || pending) text += ` Plan mein ${done} steps ho gaye, ${pending} baaki hain.`;
  const phases = plan.phases || [];
  if (phases.length) text += ` Abhi phase: ${phaseLabel(job.phase)}.`;
  return text;
}

function replyNext(job, recentCycles) {
  const plan = job.plan || {};
  const pending = plan.pendingSteps || [];
  if (job.status === 'completed') return 'Hunt poora ho gaya hai — aage kuch planned nahi hai. Report taiyaar hai.';
  if (job.status === 'paused') return 'Pehle hunt resume karna hoga — uske baad main wahin se aage badhunga jahan ruka tha.';
  if (pending.length) {
    const next = pending.slice(0, 3).map((step) => `"${String(step.title || step.name || step).slice(0, 80)}"`);
    return `Aage ye steps planned hain: ${next.join(', ')}${pending.length > 3 ? `, aur ${pending.length - 3} aur` : ''}.`;
  }
  const lastCycle = recentCycles[0];
  if (lastCycle?.nextObjective) return `Agla plan: ${String(lastCycle.nextObjective).slice(0, 200)}.`;
  if (job.status === 'queued') return 'Hunt shuru hote hi main pehle recon karunga — target ki poori mapping.';
  return 'Agla step abhi plan ho raha hai — thodi der mein clear ho jayega.';
}

function replyWhyStopped(job) {
  if (job.status === 'paused') {
    return `Tumne hi pause kiya tha${job.pausedAt ? ` (${new Date(job.pausedAt).toLocaleString('en-IN')})` : ''}. Koi error nahi hai — resume dabate hi wahin se shuru ho jayega.`;
  }
  if (job.status === 'failed') {
    const error = (job.errors || []).slice(-1)[0];
    return `Hunt error ki wajah se ruka hai${error ? `: "${error.message}"` : ''}. Ye meri taraf se ruka hai, tumhari wajah se nahi.`;
  }
  if (job.brainStatus === 'waiting' || job.phase === 'waiting' || job.status === 'waiting') {
    return `Main ruka nahi hun — bas ${waitingText(job)} ka intezaar kar raha hun. Jaise hi ye milega, aage badhunga.`;
  }
  if (job.status === 'running') {
    return 'Main ruka nahi hun — kaam chal raha hai, bas kuch steps mein waqt lagta hai (jaise bade scans). Terminal mein live dekh sakte ho.';
  }
  return `Hunt ${statusLabel(job.status)} — isliye aage nahi badh raha.`;
}

function replyStop(job) {
  // Never execute destructive actions from a chat message. Guide the user.
  if (job.status === 'cancelled' || job.status === 'completed') {
    return 'Ye hunt pehle hi khatm ho chuka hai — band karne ko kuch nahi bacha.';
  }
  return 'Main chat se seedha band nahi kar sakta (galti se band na ho jaye isliye). Hunt rokne ke liye HuntView mein Stop button dabao, ya pause karke baad mein resume kar lena.';
}

function replyStatus(job, findingsInfo) {
  let text = `${job.target || 'Is target'} ka hunt ${statusLabel(job.status)}.`;
  if (job.status === 'running') text += ` Abhi phase: ${phaseLabel(job.phase)}.`;
  if (findingsInfo.total > 0) {
    const { critical, high } = findingsInfo.counts;
    text += ` Ab tak ${findingsInfo.total} findings (${critical} critical, ${high} high).`;
  }
  return text;
}

// ── Reaction + suggestions ───────────────────────────────────────────────

function pickReaction(job, findingsInfo) {
  const status = String(job.status || '').toLowerCase();
  const recent = lastActivityText(job) || '';
  if (status === 'running' && /found|critical|high/i.test(recent) && findingsInfo.total > 0) return '🎉';
  switch (status) {
    case 'running': return '🔍';
    case 'waiting': return '⏳';
    case 'paused': return '⏸️';
    case 'queued': return '⏳';
    case 'completed': return findingsInfo.total > 0 ? '🎉' : '✅';
    case 'failed': return '⚠️';
    case 'cancelled':
    case 'cancelling': return '🛑';
    default: return '🤖';
  }
}

const SUGGESTIONS = {
  doing: ['Ab tak kya mila?', 'Kitna hua?', 'Aage kya karega?'],
  findings: ['Sabse serious kaun si hai?', 'Kitna hua?', 'Report kab milegi?'],
  progress: ['Ab tak kya mila?', 'Aage kya karega?', 'Kya kar raha hai?'],
  next: ['Kya kar raha hai?', 'Ab tak kya mila?', 'Kitna hua?'],
  whystopped: ['Resume kaise karun?', 'Kya kar raha hai?', 'Ab tak kya mila?'],
  stop: ['Pause kaise karun?', 'Kya kar raha hai?', 'Naya hunt shuru karun?'],
  status: ['Kya kar raha hai?', 'Ab tak kya mila?', 'Kitna hua?'],
};

/**
 * Build the full conversational answer from live job state.
 * Pure + deterministic — safe to unit test without a server or database.
 */
export function buildAskReply({ job, findings = [], recentCycles = [], question = '' }) {
  const intent = detectIntent(question);
  const findingsInfo = findingsSummary(findings);
  let reply;
  switch (intent) {
    case 'doing': reply = replyDoing(job, findingsInfo); break;
    case 'findings': reply = replyFindings(job, findingsInfo, findings); break;
    case 'progress': reply = replyProgress(job); break;
    case 'next': reply = replyNext(job, recentCycles); break;
    case 'whystopped': reply = replyWhyStopped(job); break;
    case 'stop': reply = replyStop(job); break;
    default: reply = replyStatus(job, findingsInfo);
  }
  return {
    intent,
    reply,
    reaction: pickReaction(job, findingsInfo),
    suggestions: SUGGESTIONS[intent] || SUGGESTIONS.status,
    jobStatus: job.status,
    phase: job.phase,
  };
}
