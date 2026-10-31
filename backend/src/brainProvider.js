// Dark Matter — BRAIN PROVIDER (MODEL-SWITCHER lane, 26 Oct 2026).
//
// One brain-call interface with two providers, selectable per hunt at
// runtime, mid-hunt:
//
//   Dark Matter V1 — the local dm-hunter 8B (uncensored) via Ollama.
//     The DEFAULT hunt brain, unchanged. Selected unless the owner
//     picks a Meta model.
//   Meta Model API — Muse Spark / Muse Wonder text models via
//     https://api.meta.ai. Fast (seconds, not minutes), paid from the
//     owner's $150 hackathon credits. Key from env META_API_KEY only.
//
// MIXTURE (owner order 26 Oct ~20:39 IST): "when Meta isn't respond
// switch automatic to 8B, thats our working". When the active brain
// (Meta) does not respond — timeout, HTTP error, empty reply, or a
// safety refusal — the loop AUTOMATICALLY switches to the 8B for
// that turn and keeps hunting: no manual action, the hunt never
// stalls. The switch is recorded as a `model_switch` event in the
// hunt record (visible in the 10-min reports and the hunt feed).
// When Meta recovers, the loop switches back automatically — but
// only after META_SWITCHBACK_STREAK consecutive Meta successes, a
// deterministic flap guard: one lucky reply must not flip the hunt
// back onto a flapping provider.
//
// What the fallback NEVER does: choose the brain's actions. It
// changes WHICH brain answers, never what the brain decides
// (standing owner order, 20 Oct 2026). The prompt the loop builds
// is identical for either brain — state + history + memory are
// rebuilt fresh every turn, so a switch mid-hunt is seamless and
// memory never changes, only the brain does.
//
// The Meta client honours the Spark quirk, verified live 26 Oct
// 2026: Muse Spark reasons before it answers, so without a
// reasoning_effort setting and a generous max_tokens a short reply
// comes back empty (98 reasoning tokens consumed, finish_reason
// "length"). Every Meta call therefore sends reasoning_effort
// ('minimal' for chat, 'low' for brain turns) and a generous
// max_tokens. A refusal arrives in the message's `refusal` field,
// not as an error — it counts as a failed call and trips the
// fallback, same as a timeout.
//
// Key handling: META_API_KEY is read from the environment at call
// time and never logged, never hard-coded, never written to a
// committed file. With the env var absent the Meta provider reports
// unavailable: manual switches to Meta are refused, and a hunt
// whose selected brain is Meta runs on the 8B (its card is still
// NOT VERIFIED, so live Meta calls may fail until that clears —
// the fallback is what keeps the hunt alive meanwhile).
// The live key wiring on EC2 is a deploy-time job, not this lane's.

import { chatWithAI, sanitizeForModel } from './llm.js';
import { readHuntMeta, writeHuntMetaCheckpoint, appendHuntEvent } from './store.js';
import { recordCost } from './costTracker.js';

/** The default hunt brain — local dm-hunter 8B. Never changes. */
export const DEFAULT_BRAIN_MODEL = 'darkmatter-v1';

/**
 * Every brain the switcher can offer. `provider` is the call path
 * ('meta' = the Meta Model API, 'openrouter' = OpenRouter API).
 *
 * OWNER ORDER 1 Nov 2026: Local Ollama models (8B/1.5B) REMOVED from
 * selectable list. Testing uses parent-as-brain (file handoff lane).
 * Meta API reserved for final testing (owner activates personally).
 */
export const BRAIN_MODELS = [
  { id: 'muse-spark-1.3', label: 'Muse Spark 1.3', provider: 'meta', model: 'muse-spark-1.3', blurb: 'Meta fast brain — API, seconds per turn (final testing only)' },
  { id: 'muse-spark-1.2', label: 'Muse Spark 1.2', provider: 'meta', model: 'muse-spark-1.2', blurb: 'Meta fast brain — API, seconds per turn (final testing only)' },
  { id: 'muse-spark-1.1', label: 'Muse Spark 1.1', provider: 'meta', model: 'muse-spark-1.1', blurb: 'Meta fast brain — API, seconds per turn (final testing only)' },
  { id: 'muse-spark-1.3-contributor', label: 'Muse Spark 1.3 Contributor', provider: 'meta', model: 'muse-spark-1.3-contributor', blurb: 'Meta fast brain — API, contributor build (final testing only)' },
  { id: 'muse-spark-1.2-contributor', label: 'Muse Spark 1.2 Contributor', provider: 'meta', model: 'muse-spark-1.2-contributor', blurb: 'Meta fast brain — API, contributor build (final testing only)' },
  { id: 'muse-wonder-1.0', label: 'Muse Wonder 1.0', provider: 'meta', model: 'muse-wonder-1.0', blurb: 'Meta reasoning brain — API (final testing only)' },
  // API PROVIDERS (1 Nov 2026): OpenAI-compatible API brains.
  // Credentials via env vars only — never hardcoded.
  // Cost controls: see API_BUDGET_DEFAULTS below.
  { id: 'openrouter-free', label: 'OpenRouter (Free)', provider: 'openrouter', model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', blurb: 'OpenRouter free tier — API, no cost', capabilities: { contextWindow: 8192, vision: false, reliability: 'medium', costPer1kTokens: 0 } },
];

/**
 * API COST CONTROLS (1 Nov 2026)
 * Prevents uncontrolled spending. All limits configurable via env.
 */
export const API_BUDGET_DEFAULTS = {
  maxTokensPerRequest: parseInt(process.env.API_MAX_TOKENS_PER_REQUEST || '2000', 10),
  maxRequestsPerHunt: parseInt(process.env.API_MAX_REQUESTS_PER_HUNT || '500', 10),
  maxRequestsPerHour: parseInt(process.env.API_MAX_REQUESTS_PER_HOUR || '100', 10),
  maxRetries: parseInt(process.env.API_MAX_RETRIES || '2', 10),
  requestTimeoutMs: parseInt(process.env.API_REQUEST_TIMEOUT_MS || '120000', 10),
  // Spend ceiling in USD (0 = no limit, but logging still active)
  maxSpendUsdPerHunt: parseFloat(process.env.API_MAX_SPEND_USD_PER_HUNT || '5.00'),
};

/**
 * Check if OpenRouter API is configured (key present).
 * Never logs or returns the key value.
 */
export function openRouterAvailable() {
  return Boolean((process.env.OPENROUTER_API_KEY || '').trim());
}

export const META_API_BASE = 'https://api.meta.ai/v1';
/** Full Meta attempt for a brain turn (primary path, not in fallback). */
export const META_TIMEOUT_MS_DEFAULT = 120000;
/** Recovery probe while in fallback: only "is Meta answering?" — a
 *  hung probe must not stall the turn that follows it. */
export const META_PROBE_TIMEOUT_MS_DEFAULT = 30000;
/** Chat replies are short; they get a shorter deadline than turns. */
export const META_CHAT_TIMEOUT_MS_DEFAULT = 60000;
/**
 * FLAP GUARD: consecutive Meta successes required before the loop
 * switches back from the 8B after a fallback. Deterministic: a
 * single good reply answers the turn it came on, but the switch-back
 * (and its event) waits for the streak.
 */
export const META_SWITCHBACK_STREAK = 2;
/** Brain turns need room for reasoning + the JSON action reply. */
export const META_BRAIN_MAX_TOKENS = 2000;
export const META_BRAIN_REASONING_EFFORT = 'low';
/** Chat replies are short; minimal reasoning keeps them cheap. */
export const META_CHAT_MAX_TOKENS = 800;
export const META_CHAT_REASONING_EFFORT = 'minimal';

/** True when a Meta key is configured (read at call time). */
export function metaAvailable() {
  return Boolean((process.env.META_API_KEY || '').trim());
}

export function findBrainModel(id) {
  return BRAIN_MODELS.find((m) => m.id === String(id || '')) || null;
}

export function isMetaModel(id) {
  const m = findBrainModel(id);
  return Boolean(m && m.provider === 'meta');
}

/**
 * True if the model uses the OpenRouter API provider.
 */
export function isOpenRouterModel(id) {
  const m = findBrainModel(id);
  return Boolean(m && m.provider === 'openrouter');
}

/** The switcher list for the UI: each model with its availability. */
export function listBrainModels() {
  return BRAIN_MODELS.map((m) => ({ ...m, available: m.provider !== 'meta' || metaAvailable() }));
}

/**
 * FALLBACK POLICY (1 Nov 2026): When the primary 8B model fails (OOM,
 * timeout, no-response), fall back to the 1.5B model.
 *
 * Rules:
 * - Default remains darkmatter-v1 (8B). Never silently downgrade.
 * - Fallback triggers on: OOM kill, 3 consecutive timeouts, ai_no_reply pause.
 * - Fallback is logged as a `model_fallback` event with reason.
 * - UI shows the ACTIVE model, not just the selected one.
 * - Manual override: owner can select darkmatter-1.5b directly.
 *
 * @param {string} currentId - Currently selected model ID
 * @param {string} reason - Why fallback is needed (oom, timeout, no_reply)
 * @returns {object|null} Fallback model or null if none available
 */
export function getFallbackModel(currentId, reason) {
  if (currentId === 'darkmatter-v1' && ['oom', 'timeout', 'no_reply'].includes(reason)) {
    const fallback = findBrainModel('darkmatter-1.5b');
    if (fallback) {
      return { ...fallback, fallbackReason: reason, fallbackFrom: currentId };
    }
  }
  return null;
}

/**
 * A hunt's brain state, persisted in meta.json under `brain`:
 *   selected   — the model the owner picked (or the default V1)
 *   active     — the model actually answering right now (V1 while
 *                in fallback, even though `selected` is Meta)
 *   fallback   — true while the 8B is covering for a silent Meta
 *   metaStreak — consecutive Meta successes while in fallback
 *                (the flap-guard counter; 0 outside fallback)
 */
export function emptyBrainState() {
  return { selected: DEFAULT_BRAIN_MODEL, active: DEFAULT_BRAIN_MODEL, fallback: false, metaStreak: 0 };
}

export function getBrainState(huntId, { readMeta } = {}) {
  const read = readMeta || readHuntMeta;
  let stored = null;
  try {
    stored = (read(huntId) || {}).brain || null;
  } catch {
    stored = null;
  }
  const state = { ...emptyBrainState(), ...(stored && typeof stored === 'object' ? stored : {}) };
  if (!findBrainModel(state.selected)) state.selected = DEFAULT_BRAIN_MODEL;
  if (!findBrainModel(state.active)) state.active = DEFAULT_BRAIN_MODEL;
  state.fallback = state.fallback === true;
  state.metaStreak = Math.max(0, Number(state.metaStreak) || 0);
  return state;
}

function saveBrainState(huntId, state, { writeMeta } = {}) {
  const write = writeMeta || writeHuntMetaCheckpoint;
  try {
    write(huntId, { brain: { ...state } });
  } catch {
    /* the brain state is best-effort — the call still proceeds */
  }
  return state;
}

function recordSwitch(huntId, evt, { record } = {}) {
  const rec = record || appendHuntEvent;
  try {
    rec(huntId, { type: 'model_switch', ...evt, at: new Date().toISOString() });
  } catch {
    /* the event is best-effort — the switch itself already happened */
  }
}

/**
 * Manual switch (the "Change Model" control). Validates the model,
 * refuses a Meta model while no key is configured, resets the
 * fallback state, and records the switch. Returns
 * { ok: true, brain } or { ok: false, error }.
 * The new brain needs no preload step: the loop rebuilds its prompt
 * from live state + history + memory on every turn, so the next
 * turn already carries everything — memory never changes, only the
 * brain does.
 */
export function setBrainModel(huntId, modelId, { manual = false, readMeta, writeMeta, record } = {}) {
  const model = findBrainModel(modelId);
  if (!model) return { ok: false, error: 'unknown_model' };
  if (model.provider === 'meta' && !metaAvailable()) return { ok: false, error: 'meta_unavailable' };
  const prev = getBrainState(huntId, { readMeta });
  const next = { selected: model.id, active: model.id, fallback: false, metaStreak: 0 };
  saveBrainState(huntId, next, { writeMeta });
  if (prev.selected !== model.id || prev.fallback) {
    recordSwitch(huntId, { from: prev.active, to: model.id, reason: manual ? 'manual_switch' : 'switch', manual: Boolean(manual) }, { record });
  }
  return { ok: true, brain: { ...next, models: listBrainModels() } };
}

/**
 * One Meta Model API chat-completions call.
 * @returns {Promise<{ok:true,text:string}|{ok:false,reason:string}>}
 *   reason: 'no_key' | 'timeout' | 'http_<status>' | 'empty' |
 *   'refusal' | 'error'. The key is read from the environment at
 *   call time and never appears in a log, an error, or the result.
 *   The prompt is NOT sliced here (unlike the other providers):
 *   the loop owns the prompt budget, and slicing would silently cut
 *   the plan. The privacy gateway still runs over every message.
 */
export async function callMetaModel(messages, system, ctx, { model, maxTokens, reasoningEffort, timeoutMs, fetchFn } = {}) {
  const key = (process.env.META_API_KEY || '').trim();
  if (!key) return { ok: false, reason: 'no_key' };
  const fetchImpl = fetchFn || fetch;
  const clean = (t) => sanitizeForModel(String(t || ''));
  const apiMessages = [];
  if (system) apiMessages.push({ role: 'system', content: clean(system) });
  for (const m of messages || []) {
    apiMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: clean(m.text),
    });
  }
  const body = {
    model: model || 'muse-spark-1.3',
    messages: apiMessages,
    // SPARK QUIRK (verified live 26 Oct 2026): Muse Spark reasons
    // first — without reasoning_effort and a generous max_tokens a
    // short reply comes back empty with finish_reason "length".
    reasoning_effort: reasoningEffort || META_BRAIN_REASONING_EFFORT,
    max_tokens: maxTokens || META_BRAIN_MAX_TOKENS,
  };
  let res;
  try {
    res = await fetchImpl(`${META_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs ?? META_TIMEOUT_MS_DEFAULT),
      redirect: 'manual', // connector rule: redirects stay disabled on authenticated requests
    });
  } catch (err) {
    if (String(err && err.name) === 'TimeoutError' || /timed out|aborted/i.test(String((err && err.message) || ''))) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'error' };
  }
  if (!res || !res.ok) return { ok: false, reason: `http_${(res && res.status) || 0}` };
  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: 'error' };
  }
  const choice = (data.choices && data.choices[0]) || {};
  const msg = choice.message || {};
  // A safety refusal arrives in `refusal`, not as an error — and
  // the reply is empty. It counts as a failed call (fallback trips).
  if (String(msg.refusal || '')) return { ok: false, reason: 'refusal' };
  const text = String(msg.content || '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  try {
    const usage = data.usage || {};
    recordCost({
      userId: ctx && ctx.userId,
      huntId: ctx && ctx.huntId,
      kind: 'meta',
      model: body.model,
      inputTokens: usage.prompt_tokens || usage.inputTokens || 0,
      outputTokens: usage.completion_tokens || usage.outputTokens || 0,
      note: 'meta-model-api',
    });
  } catch {
    /* cost tracking must never break the call */
  }
  return { ok: true, text };
}

/**
 * THE brain call — the single interface the hunt loop uses.
 * Same signature as chatWithAI (messages, system, ctx), so it drops
 * into deps.chat and agentIteration unchanged.
 *
 *   selected V1            → the 8B, exactly as before (no Meta
 *                             call, no state change, no event).
 *   selected Meta, Meta up → Meta's reply.
 *   selected Meta, Meta down (timeout / HTTP error / empty /
 *     refusal / no key) → record ONE model_switch event, set
 *     fallback, and answer this turn from the 8B instead. The
 *     hunt never stalls on a silent Meta.
 *   in fallback, Meta probe succeeds → the probe's reply answers
 *     this turn; the switch-back (and its event) waits for
 *     META_SWITCHBACK_STREAK consecutive successes.
 *   in fallback, Meta probe fails → streak resets, the 8B answers,
 *     no new event (the hunt is already in fallback).
 *
 * `chatFn` (default chatWithAI) is the 8B path; `metaFn` (default
 * callMetaModel with brain settings) is the Meta path. Both are
 * injectable so the lab can mock Meta without burning credits.
 */
export async function callBrain(messages, system, ctx, { huntId, readMeta, writeMeta, record, chatFn, metaFn, advisory } = {}) {
  const chat = chatFn || chatWithAI;
  const meta = metaFn || ((m, s, c, o) => callMetaModel(m, s, c, o));
  // RULE #50 (30 Oct 2026): advisory calls (verifier advice, PoC drafting)
  // fail fast on the 8B path — a dead Ollama must not stall the pipeline.
  // The Meta path keeps its own probe timeouts (unchanged).
  const chatOpts = { advisory: Boolean(advisory) };
  const state = getBrainState(huntId, { readMeta });
  // OPENROUTER API PROVIDER (1 Nov 2026): If hunt selected an OpenRouter model,
  // route via providerOverride. Falls back to 8B if API key missing.
  if (isOpenRouterModel(state.selected)) {
    if (!openRouterAvailable()) {
      // No API key: fall back to 8B, record once
      if (!state.fallback) {
        saveBrainState(huntId, { ...state, active: DEFAULT_BRAIN_MODEL, fallback: true }, { writeMeta });
        recordSwitch(huntId, { from: state.selected, to: DEFAULT_BRAIN_MODEL, reason: 'openrouter_unavailable', manual: false }, { record });
      }
      return chat(messages, system, ctx, chatOpts);
    }
    // API key present: use OpenRouter via provider override.
    // The model ID from BRAIN_MODELS is passed through; chatWithOpenRouter
    // uses OPENROUTER_MODEL env or the default free model.
    // Record active provider for visibility.
    if (state.active !== state.selected) {
      saveBrainState(huntId, { ...state, active: state.selected }, { writeMeta });
    }
    return chat(messages, system, ctx, { ...chatOpts, providerOverride: 'openrouter' });
  }
  if (!isMetaModel(state.selected)) {
    return chat(messages, system, ctx, chatOpts);
  }
  // The selected brain is a Meta model.
  if (!metaAvailable()) {
    // No key configured: Meta can never answer (until a deploy
    // wires META_API_KEY). Fall back to the 8B and record the
    // transition once — not once per turn.
    if (!state.fallback) {
      saveBrainState(huntId, { ...state, active: DEFAULT_BRAIN_MODEL, fallback: true, metaStreak: 0 }, { writeMeta });
      recordSwitch(huntId, { from: state.active, to: DEFAULT_BRAIN_MODEL, reason: 'meta_unavailable', manual: false }, { record });
    }
    return chat(messages, system, ctx, chatOpts);
  }
  const probeTimeout = state.fallback ? META_PROBE_TIMEOUT_MS_DEFAULT : META_TIMEOUT_MS_DEFAULT;
  const attempt = await meta(messages, system, ctx, { model: state.selected, timeoutMs: probeTimeout });
  if (attempt && attempt.ok) {
    if (state.fallback) {
      const streak = state.metaStreak + 1;
      if (streak >= META_SWITCHBACK_STREAK) {
        saveBrainState(huntId, { ...state, active: state.selected, fallback: false, metaStreak: 0 }, { writeMeta });
        recordSwitch(huntId, { from: DEFAULT_BRAIN_MODEL, to: state.selected, reason: 'meta_recovered', manual: false }, { record });
      } else {
        saveBrainState(huntId, { ...state, metaStreak: streak }, { writeMeta });
      }
    }
    return attempt.text;
  }
  // Meta did not respond — automatic fallback to the 8B for this turn.
  const reason = (attempt && attempt.reason) || 'error';
  if (!state.fallback) {
    saveBrainState(huntId, { ...state, active: DEFAULT_BRAIN_MODEL, fallback: true, metaStreak: 0 }, { writeMeta });
    recordSwitch(huntId, { from: state.active, to: DEFAULT_BRAIN_MODEL, reason, manual: false }, { record });
  } else if (state.metaStreak !== 0) {
    saveBrainState(huntId, { ...state, metaStreak: 0 }, { writeMeta });
  }
  return chat(messages, system, ctx, chatOpts);
}

/**
 * The CHAT path — mid-hunt chat replies, permanently on the Meta
 * model (owner order, 26 Oct 2026). Meta only: the chat never waits
 * behind the hunt brain's 8B slot, and a chat answer never burns a
 * hunt turn. Returns the reply text, or null when Meta is
 * unavailable — the caller answers from the deterministic live
 * record instead (the honest fallback that already exists there).
 * The queued brain answers (a thinking question answered in the
 * brain's next turn) are NOT this path — they come from the brain
 * itself, through callBrain, and carry the live turn context the
 * queue was built for.
 */
export async function callChatMeta(messages, system, ctx, opts = {}) {
  const res = await callMetaModel(messages, system, ctx, {
    model: opts.model || 'muse-spark-1.3',
    maxTokens: opts.maxTokens || META_CHAT_MAX_TOKENS,
    reasoningEffort: opts.reasoningEffort || META_CHAT_REASONING_EFFORT,
    timeoutMs: opts.timeoutMs || META_CHAT_TIMEOUT_MS_DEFAULT,
    fetchFn: opts.fetchFn,
  });
  return res && res.ok ? res.text : null;
}
