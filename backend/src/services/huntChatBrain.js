/**
 * huntChatBrain.js — mid-hunt chat answered by the HACKING brain.
 *
 * Both mid-hunt chat paths (POST /api/v1/jobs/:id/ask and
 * POST /api/v1/hunts/:id/chat) route the user's question to the hacking
 * brain with LIVE hunt context — never to string templates. The brain is
 * resolved exactly like the hunt's own brain: the user's per-account slot
 * sources (Kaggle link or local model per brain-links), so a Kaggle
 * Gradio endpoint funnels through the same per-endpoint FIFO queue the
 * hunt loop uses (see agent/providers/gradioProvider.js).
 *
 * Honesty contract:
 *  - every number/status in the prompt comes from live state passed in by
 *    the caller (job doc / loop snapshot) — nothing is invented here;
 *  - when the hacking brain is not configured or unreachable, callers get a
 *    BrainUnreachableError and must return BRAIN_UNAVAILABLE_REPLY — a
 *    plain-language Hinglish message, NEVER a template.
 *
 * Standing rules: the hacking brain is the sole decision-maker; this module
 * only assembles context and delivers the reply. Brains run on the user's
 * own hardware (their Kaggle notebook / local model) — never on this host
 * as a substitute.
 */

import { GradioProvider } from '../agent/providers/gradioProvider.js';
import { LocalLlamaProvider } from '../agent/providers/localLlamaProvider.js';
import { stripThinkingTags } from '../agent/providers/phoneLocalProvider.js';

/** Thrown when the hacking brain cannot be reached. Callers must answer honestly. */
export class BrainUnreachableError extends Error {
  constructor(message = 'hacking brain unreachable') {
    super(message);
    this.name = 'BrainUnreachableError';
    this.code = 'BRAIN_UNREACHABLE';
  }
}

/**
 * Honest plain-language reply (Hinglish, the owner's register) when the
 * hacking brain isn't reachable. Deliberately NOT a status template: it
 * says what is wrong and what the user can do about it.
 */
export const BRAIN_UNAVAILABLE_REPLY =
  'Tumhara hacking brain abhi reachable nahi hai, isliye main tumhare sawaal ka jawab ' +
  'apne dimaag se nahi de pa raha. Models page kholo aur apna brain check karo — Kaggle ' +
  'link expire ho gaya ho toh notebook dobara chalao aur naya link connect karo, ya local ' +
  'model Run karo. Brain ke online aate hi main hunt ke live haal ke saath jawab dunga.';

/**
 * Which source backs a brain slot right now: 'kaggle' | 'local' | 'missing'.
 * Mirrors the resolution order used by the hunt itself (explicit per-account
 * slot source → running local slot server → legacy single-brain selection).
 */
export function slotBrainStatus(slot, { selection = {}, runner = null } = {}) {
  const src = selection?.slotSources?.[slot];
  if (src?.source === 'kaggle' && src?.kaggleUrl) return 'kaggle';
  if (src?.source === 'local' && (src?.modelId || selection?.slotAssignments?.[slot]))
    return 'local';
  // Legacy single-brain selection (kept for accounts set before slot sources).
  if (slot === 'hacker') {
    if (selection?.provider === 'gradio' && selection?.endpointUrl) return 'kaggle';
    if (selection?.provider === 'local' && selection?.modelId) return 'local';
  }
  try {
    if (runner?.getSlotServer?.(slot)?.baseUrl) return 'local';
  } catch {
    /* runner unavailable — treat as missing */
  }
  return 'missing';
}

/**
 * Brain-slot statuses for the GET /api/v1/agent/status contract.
 * When no grounding brain is configured but vision is present, grounding is
 * reported as 'vision-driven' — the triple-brain orchestrator routes
 * click/ground actions through the vision brain's grounding capability.
 */
export function brainStatusesForUser({ selection = {}, runner = null } = {}) {
  const vision = slotBrainStatus('vision', { selection, runner });
  const hacking = slotBrainStatus('hacker', { selection, runner });
  let grounding = slotBrainStatus('grounding', { selection, runner });
  if (grounding === 'missing' && vision !== 'missing') grounding = 'vision-driven';
  return { vision, hacking, grounding };
}

/**
 * Resolve the HACKING brain provider for a user.
 * @returns {{ provider, source: 'kaggle'|'local' } | null} — null when the
 *   hacking brain is not configured anywhere.
 */
export function resolveHackingBrain({ selection = {}, runner = null } = {}) {
  const src = selection?.slotSources?.hacker;
  if (src?.source === 'kaggle' && src?.kaggleUrl) {
    return {
      provider: new GradioProvider({ baseUrl: src.kaggleUrl, model: src.kaggleName || 'hacker' }),
      source: 'kaggle',
    };
  }
  if (src?.source === 'local' && runner && (src?.modelId || selection?.slotAssignments?.hacker)) {
    return { provider: new LocalLlamaProvider({ runner, slot: 'hacker' }), source: 'local' };
  }
  // A running local slot server is usable even without an explicit assignment.
  try {
    if (runner?.getSlotServer?.('hacker')?.baseUrl) {
      return { provider: new LocalLlamaProvider({ runner, slot: 'hacker' }), source: 'local' };
    }
  } catch {
    /* runner unavailable */
  }
  // Legacy single-brain selection.
  if (selection?.provider === 'gradio' && selection?.endpointUrl) {
    return { provider: new GradioProvider({ baseUrl: selection.endpointUrl }), source: 'kaggle' };
  }
  if (selection?.provider === 'local' && selection?.modelId && runner) {
    return { provider: new LocalLlamaProvider({ runner, slot: 'hacker' }), source: 'local' };
  }
  return null;
}

/** Load the user's selection and resolve their hacking brain. */
export async function resolveHackingBrainForUser({
  userId = null,
  brainProviderModel = null,
  modelRunnerService = null,
} = {}) {
  let selection = {};
  if (brainProviderModel && userId) {
    try {
      selection = (await brainProviderModel.getSelection(userId)) || {};
    } catch {
      selection = {};
    }
  }
  return resolveHackingBrain({ selection, runner: modelRunnerService || null });
}

// ── Live-context builders ────────────────────────────────────────────────

function tallyOf(findings = []) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const f of findings) {
    const s = String(f?.severity || 'informational').toLowerCase();
    if (s === 'info') counts.informational += 1;
    else if (counts[s] !== undefined) counts[s] += 1;
    else counts.informational += 1;
  }
  return { ...counts, total: findings.length };
}

function topOf(findings = [], n = 5) {
  const rank = { critical: 0, high: 1, medium: 2, low: 3, informational: 4, info: 4 };
  return [...findings]
    .sort((a, b) => (rank[String(a?.severity).toLowerCase()] ?? 5) - (rank[String(b?.severity).toLowerCase()] ?? 5))
    .slice(0, n)
    .map(f => ({ severity: String(f?.severity || 'info'), title: String(f?.title || 'untitled') }));
}

/**
 * Shared live-context shape both chat paths feed to the brain.
 * { target, status, tick, currentActivity, findings: { total, critical, high,
 *   medium, low, informational, top: [{severity,title}] }, trace: [string] }
 */
export function buildJobChatContext({ job = {}, findings = [], recentCycles = [] } = {}) {
  const activity = Array.isArray(job.activity) ? job.activity : [];
  const trace = [
    ...activity.slice(-4).map(a => String(a?.message || a?.text || '').slice(0, 220)),
    ...recentCycles
      .slice(0, 2)
      .map(c => String(c?.summary || c?.nextObjective || '').slice(0, 220)),
  ].filter(Boolean);
  return {
    target: job.target || job.targetHostname || 'the target',
    status: String(job.status || 'unknown'),
    tick: Number(job.stepCount || 0),
    currentActivity:
      String(job.currentAction || job.currentStep || activity[activity.length - 1]?.message || '').slice(0, 220) ||
      'no activity recorded yet',
    findings: { ...tallyOf(findings), top: topOf(findings) },
    trace,
  };
}

/** Live-context shape from a continuous-hunt loop snapshot. */
export function buildLoopChatContext(snap = {}) {
  const tally = snap.tally || tallyOf(snap.findings || []);
  const trace = (snap.trace || []).slice(-4).map(t => String(t?.text || '').slice(0, 220));
  return {
    target: snap.target || 'the target',
    status: String(snap.state || 'unknown'),
    tick: Number(snap.tick ?? 0),
    currentActivity:
      trace[trace.length - 1] || `loop state ${snap.state || 'unknown'}`,
    findings: { ...tally, top: topOf(snap.findings || []) },
    trace,
  };
}

// ── Prompt ───────────────────────────────────────────────────────────────

const HUNT_CHAT_SYSTEM = [
  "You are Dark Matter's hacking brain — an elite bug-bounty hunter thinking for the Hunt AI agent.",
  'The user is chatting with you in the middle of a live hunt.',
  '',
  'RULES (follow strictly):',
  '- Reply in Hinglish (Roman script, plain everyday language — the way the user speaks).',
  '- No internal jargon: never quote tool names, phase names, error strings, or system internals raw; describe everything in plain words.',
  "- Answer the user's actual question. Base EVERY number, status, and claim ONLY on the LIVE HUNT CONTEXT below.",
  '- Never invent findings, steps, tools, or progress. If the context does not contain what they asked about, say so plainly and say what you CAN see.',
  '- Be direct and concrete. No fluff, no filler intros.',
].join('\n');

export function buildHuntChatPrompt({ question = '', context = {} } = {}) {
  const f = context.findings || {};
  const top = (f.top || []).map(t => `  - [${t.severity}] ${t.title}`).join('\n') || '  (none yet)';
  const trace = (context.trace || []).map(t => `  > ${t}`).join('\n') || '  (nothing yet)';
  return [
    "USER'S QUESTION:",
    `"${String(question).slice(0, 1000)}"`,
    '',
    'LIVE HUNT CONTEXT (real, current state — treat it as ground truth):',
    `- Target: ${context.target || 'unknown'}`,
    `- Status: ${context.status || 'unknown'} (step/tick ${context.tick ?? 0})`,
    `- Right now: ${context.currentActivity || 'no activity recorded yet'}`,
    `- Findings so far: ${f.total ?? 0} total (${f.critical ?? 0} critical, ${f.high ?? 0} high, ${f.medium ?? 0} medium, ${f.low ?? 0} low)`,
    '- Top findings:',
    top,
    '- Recent thinking:',
    trace,
  ].join('\n');
}

/**
 * Ask the hacking brain. Resolves the user's brain, builds the prompt with
 * live context, and generates.
 * @returns {Promise<{ reply: string, brainSource: 'kaggle'|'local' }>}
 * @throws {BrainUnreachableError} when no brain is configured or it fails.
 */
export async function answerWithHackingBrain({
  userId = null,
  question = '',
  context = {},
  brainProviderModel = null,
  modelRunnerService = null,
  logger = null,
} = {}) {
  const q = String(question || '').trim();
  if (!q) throw new Error('answerWithHackingBrain requires a question');
  const resolved = await resolveHackingBrainForUser({
    userId,
    brainProviderModel,
    modelRunnerService,
  });
  if (!resolved) {
    throw new BrainUnreachableError('hacking brain not configured for this account');
  }
  const prompt = buildHuntChatPrompt({ question: q, context });
  let reply;
  try {
    reply = await resolved.provider.generate(
      [
        { role: 'system', content: HUNT_CHAT_SYSTEM },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 1500, timeout: 120_000 }
    );
  } catch (err) {
    logger?.warn?.(`[hunt-chat-brain] ${resolved.source} brain failed: ${err?.message}`);
    throw new BrainUnreachableError(`hacking brain unreachable: ${err?.message || err}`);
  }
  const clean = stripThinkingTags(String(reply || '')).trim();
  if (!clean) throw new BrainUnreachableError('hacking brain returned an empty reply');
  return { reply: clean, brainSource: resolved.source };
}
