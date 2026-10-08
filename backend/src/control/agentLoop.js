/**
 * Infinity control agent loop — the see → think → act loop that powers
 * Control mode.
 *
 * Each iteration:
 *   1. SEE      capture a screenshot through the bridge adapter
 *   2. THINK    the planner (Vision brain) looks at the screenshot + history
 *               and decides the next single step
 *   3. GROUND   for point actions, the grounder (Grounding brain, e.g. the
 *               UI-TARS-class model in the Grounding slot) turns a natural
 *               language element description into 0–1000 screen coordinates
 *   4. ACT      the action is validated (actions.js) and executed via the bridge
 *   5. VERIFY   a fresh screenshot is captured; the planner re-observes and
 *               either continues, replans, or declares the task done
 *
 * Architecture note: the loop is an original implementation. Its structure
 * (screenshot → VLM decision → coordinate grounding → action → re-observe) is
 * the standard perceive → reason → act → verify pattern used by modern
 * open-source GUI agents; see THIRD_PARTY_NOTICES.md for attributions.
 *
 * The loop is dependency-injected (planner, grounder, bridge) so it is fully
 * unit-testable without a screen or a model. Production wiring lives in
 * backend/src/services/infinityModes.js (runControlVision).
 *
 * All user-visible status strings are Infinity AI branded. Original project
 * names never appear in UI copy.
 */

import {
  CONTROL_ACTIONS,
  COORDINATE_ACTIONS,
  CONTROL_LIMITS,
  adaptLegacyBridge,
  executeControlAction,
  validateControlAction,
} from './actions.js';

/** Default step budget for one Control command. */
export const DEFAULT_MAX_STEPS = 25;

/** Consecutive planner failures before the loop gives up instead of spinning. */
const MAX_CONSECUTIVE_PLAN_FAILURES = 3;

/** User-visible status copy. Everything says Infinity AI. */
export const STATUS = Object.freeze({
  LOOKING: 'Infinity is looking at your screen…',
  THINKING: 'Infinity is deciding the next step…',
  FINDING: description => `Infinity is finding "${description}" on your screen…`,
  VERIFYING: 'Infinity is checking the result…',
  RETHINKING: 'Infinity is reconsidering the plan…',
  DONE: 'Infinity finished the task.',
});

/** Present-tense label for "Infinity is <label>…" status lines. */
export function actionLabel(action) {
  switch (action?.type) {
    case CONTROL_ACTIONS.CLICK:
      return 'clicking';
    case CONTROL_ACTIONS.DOUBLE_CLICK:
      return 'double-clicking';
    case CONTROL_ACTIONS.TYPE:
      return 'typing';
    case CONTROL_ACTIONS.PRESS:
      return 'pressing keys';
    case CONTROL_ACTIONS.SCROLL:
      return 'scrolling';
    case CONTROL_ACTIONS.DRAG:
      return 'dragging';
    case CONTROL_ACTIONS.WAIT:
      return 'waiting';
    case CONTROL_ACTIONS.SCREENSHOT:
      return 'taking a screenshot';
    default:
      return 'working';
  }
}

/**
 * Call a brain for structured JSON output. Accepts the provider contracts used
 * across the codebase: generateStructured(messages, schema) first, then
 * completeJson(messages), then generate()/complete() with a JSON-extraction
 * fallback.
 */
async function callStructuredJson(brain, messages, schema, label) {
  const schemaText = JSON.stringify(schema);
  if (typeof brain?.generateStructured === 'function') {
    return brain.generateStructured(messages, schemaText);
  }
  if (typeof brain?.completeJson === 'function') {
    return brain.completeJson([
      ...messages,
      {
        role: 'system',
        content: `Respond with ONLY valid JSON matching this schema, no prose:\n${schemaText}`,
      },
    ]);
  }
  const generate = brain?.generate || brain?.complete;
  if (typeof generate !== 'function') {
    throw new Error(`${label}: brain exposes no structured generation method`);
  }
  const raw = await generate.call(brain, [
    ...messages,
    {
      role: 'system',
      content: `Respond with ONLY valid JSON matching this schema:\n${schemaText}`,
    },
  ]);
  const text = typeof raw === 'string' ? raw : String(raw?.text ?? raw ?? '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`${label}: brain did not return JSON`);
  return JSON.parse(match[0]);
}

const PLANNER_SCHEMA = {
  decision: 'one of: "act" | "done" | "abort"',
  action: {
    type: 'click | doubleClick | type | press | scroll | drag | wait | screenshot',
    params: 'action parameters; point actions use 0–1000 normalized x/y',
    description: 'for point actions: natural-language description of the target element',
  },
  summary: 'when done: one sentence on what was accomplished',
  reason: 'when aborting, or why this action was chosen',
};

const PLANNER_SYSTEM = `You are Infinity AI's control planner. You see the user's screen and decide the NEXT SINGLE desktop action to move toward the instruction.
Rules:
- Reply with ONLY the JSON decision object. No prose.
- decision "act": choose exactly one action from the schema. For click/doubleClick on a UI element, give "description" (e.g. "the Chrome address bar") and 0–1000 x/y if you are confident; otherwise omit x/y and only give the description — a dedicated grounding model will locate it.
- decision "done": the instruction is fully complete; include "summary".
- decision "abort": the task is impossible or unsafe; include "reason".
- Prefer keyboard actions (type/press) over mouse clicks when text can be entered directly.
- Never invent shell commands; the action set is closed.`;

/**
 * Build a planner from a Vision-slot brain (Qwen2.5-VL-class on Kaggle or a
 * local vision model). The brain must implement generateStructured,
 * completeJson, or generate/complete.
 *
 * @returns {{ plan({instruction, screenshot, history, stepIndex}): Promise<object> }}
 */
export function createVisionPlanner(brain) {
  return {
    async plan({ instruction, screenshot, history, stepIndex }) {
      const imagePart = screenshot?.imageBase64
        ? [{ type: 'image', image: `data:image/png;base64,${screenshot.imageBase64}` }]
        : [];
      const historyText = (history || [])
        .slice(-8)
        .map(
          s =>
            `step ${s.index + 1}: ${s.action?.type} ${s.ok ? 'OK' : 'FAILED'}${s.error ? ` (${s.error})` : ''}`
        )
        .join('\n');
      const messages = [
        { role: 'system', content: PLANNER_SYSTEM },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Instruction: ${instruction}\nStep ${stepIndex + 1}.\nRecent history:\n${historyText || '(none yet)'}\nDecide the next single action.`,
            },
            ...imagePart,
          ],
        },
      ];
      const raw = await callStructuredJson(brain, messages, PLANNER_SCHEMA, 'planner');
      return normalizePlannerDecision(raw);
    },
  };
}

/**
 * Normalize a planner reply into the loop's decision contract.
 * Anything malformed becomes an abort with a clear reason — the loop never
 * acts on a decision it cannot understand.
 */
export function normalizePlannerDecision(raw) {
  if (!raw || typeof raw !== 'object') {
    return { decision: 'abort', reason: 'The planner returned an unreadable decision.' };
  }
  const decision = String(raw.decision || '')
    .toLowerCase()
    .trim();
  if (decision === 'done') {
    return { decision: 'done', summary: String(raw.summary || 'Task completed.').slice(0, 500) };
  }
  if (decision === 'abort') {
    return {
      decision: 'abort',
      reason: String(raw.reason || 'The planner aborted the task.').slice(0, 500),
    };
  }
  if (decision === 'act' && raw.action && typeof raw.action === 'object') {
    return { decision: 'act', action: raw.action, reason: String(raw.reason || '').slice(0, 500) };
  }
  return { decision: 'abort', reason: 'The planner returned a malformed decision.' };
}

const GROUNDER_SCHEMA = {
  x: 'number 0–1000, horizontal position of the element center (origin top-left)',
  y: 'number 0–1000, vertical position of the element center (origin top-left)',
  confidence: 'low | medium | high',
};

const GROUNDER_SYSTEM = `You are Infinity AI's grounding model. Given a screenshot and a natural-language description of a UI element, return ONLY JSON {x, y, confidence} with the element center in 0–1000 normalized coordinates (origin top-left). If the element is not visible, return {"x": -1, "y": -1, "confidence": "low"}.`;

/**
 * Build a grounder from a Grounding-slot brain (UI-TARS-class model). Returns
 * {x, y} in 0–1000 space, or null when the element cannot be located.
 */
export function createGroundingGrounder(brain) {
  return {
    async ground({ description, screenshot }) {
      const imagePart = screenshot?.imageBase64
        ? [{ type: 'image', image: `data:image/png;base64,${screenshot.imageBase64}` }]
        : [];
      const messages = [
        { role: 'system', content: GROUNDER_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Locate this UI element: "${description}"` },
            ...imagePart,
          ],
        },
      ];
      const raw = await callStructuredJson(brain, messages, GROUNDER_SCHEMA, 'grounder');
      const x = Number(raw?.x);
      const y = Number(raw?.y);
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0 ||
        x > CONTROL_LIMITS.COORD_MAX ||
        y > CONTROL_LIMITS.COORD_MAX
      ) {
        return null;
      }
      return { x: Math.round(x), y: Math.round(y) };
    },
  };
}

/**
 * Run the see → think → act loop for one Control instruction.
 *
 * @param {string} instruction natural-language desktop command
 * @param {object} deps
 * @param {object} deps.planner  { plan({instruction, screenshot, history, stepIndex}) }
 * @param {object} deps.grounder { ground({description, screenshot}) → {x,y}|null }
 * @param {object} deps.bridge   { screenshot() → {width,height,imageBase64}, execute(action) }
 *                               or any legacy adapter exposing execute() (auto-adapted)
 * @param {function} [deps.onEvent] receives { type, message, ... } — wire to SSE
 * @param {number} [deps.maxSteps] step budget (default 25)
 * @param {AbortSignal} [deps.signal] aborts the loop when triggered (Stop button)
 * @returns {Promise<object>} { ok, instruction, summary, steps, events, ... }
 */
export async function runControlAgent(
  instruction,
  {
    planner = null,
    grounder = null,
    bridge = null,
    onEvent = () => {},
    maxSteps = DEFAULT_MAX_STEPS,
    signal = null,
  } = {}
) {
  const started = Date.now();
  const events = [];
  const steps = [];
  const text = String(instruction || '').trim();

  const emit = (type, message, extra = {}) => {
    const event = { type, message, at: new Date().toISOString(), ...extra };
    events.push(event);
    try {
      onEvent(event);
    } catch {
      /* listener errors must not break the loop */
    }
  };

  const finish = (ok, summary, extra = {}) => ({
    ok,
    instruction: text,
    summary,
    steps,
    events,
    screenshotsTaken: extra.screenshotsTaken ?? 1,
    durationMs: Date.now() - started,
    stoppedEarly: !ok,
    maxStepsHit: Boolean(extra.maxStepsHit),
    simulated: Boolean(extra.simulated),
  });

  if (!text) {
    emit('error', 'Infinity needs an instruction to act on.');
    return finish(false, 'Empty instruction — nothing to do.');
  }
  if (!planner || !grounder || !bridge) {
    emit('error', 'Infinity is not fully connected yet.');
    return finish(false, 'Control needs a planner brain, a grounding brain and a screen bridge.');
  }

  const screen =
    typeof bridge.screenshot === 'function' && typeof bridge.execute === 'function'
      ? bridge
      : adaptLegacyBridge(bridge);

  let shots = 0;
  let screenshot;
  emit('status', STATUS.LOOKING);
  try {
    screenshot = await screen.screenshot();
    shots += 1;
  } catch (err) {
    const message = `Infinity could not see the screen: ${err?.message || 'capture failed'}.`;
    emit('error', message);
    return finish(false, message, { screenshotsTaken: 0 });
  }

  let consecutivePlanFailures = 0;

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    if (signal?.aborted) {
      emit('status', 'Infinity stopped.');
      return finish(false, 'Stopped by the user.', { screenshotsTaken: shots });
    }

    // ── THINK ──
    emit('status', STATUS.THINKING);
    let decision;
    try {
      decision = await planner.plan({ instruction: text, screenshot, history: steps, stepIndex });
      consecutivePlanFailures = 0;
    } catch (err) {
      consecutivePlanFailures += 1;
      if (consecutivePlanFailures >= MAX_CONSECUTIVE_PLAN_FAILURES) {
        const message = `Infinity lost its train of thought: ${err?.message || 'planner failed repeatedly'}.`;
        emit('error', message);
        return finish(false, message, { screenshotsTaken: shots });
      }
      emit('status', 'Infinity hit a snag while thinking — retrying…');
      continue;
    }

    if (!decision || decision.decision === 'abort') {
      const message = decision?.reason || 'Infinity stopped the task.';
      emit('error', message);
      return finish(false, message, { screenshotsTaken: shots });
    }
    if (decision.decision === 'done') {
      emit('status', STATUS.DONE);
      return finish(true, decision.summary || 'Task completed.', {
        screenshotsTaken: shots,
        simulated: screenshot.simulated,
      });
    }

    // ── VALIDATE ──
    const validation = validateControlAction(decision.action || {});
    if (!validation.valid) {
      steps.push({
        index: stepIndex,
        action: decision.action || null,
        ok: false,
        error: validation.errors.join('; '),
        observation: null,
      });
      emit('status', STATUS.RETHINKING, { step: stepIndex, error: validation.errors.join('; ') });
      continue; // replan next iteration with the failure in history
    }
    let action = validation.action;

    // ── GROUND ── point actions described in words need 0–1000 coordinates
    if (
      COORDINATE_ACTIONS.includes(action.type) &&
      (action.params.x == null || action.params.y == null)
    ) {
      const description = action.description || 'the target element';
      emit('status', STATUS.FINDING(description));
      let coords = null;
      try {
        coords = await grounder.ground({ description, screenshot });
      } catch {
        /* treated as a miss below */
      }
      if (!coords) {
        steps.push({
          index: stepIndex,
          action,
          ok: false,
          error: `Grounding failed: "${description}" is not visible on screen`,
          observation: null,
        });
        emit('status', `Infinity could not find "${description}" — trying a different approach…`, {
          step: stepIndex,
        });
        continue; // replan: the planner sees the miss and picks another strategy
      }
      action = { ...action, params: { ...action.params, x: coords.x, y: coords.y } };
    }

    // ── ACT ──
    emit('status', `Infinity is ${actionLabel(action)}…`, { step: stepIndex, action: action.type });
    let result;
    try {
      result = await executeControlAction(action, screen, {
        width: screenshot.width,
        height: screenshot.height,
      });
    } catch (err) {
      result = { ok: false, error: { message: err?.message || 'execution threw' } };
    }

    steps.push({
      index: stepIndex,
      action,
      ok: result.ok === true,
      error: result.error?.message || null,
      observation: result.observation?.summary || null,
    });
    emit(
      'step',
      result.ok === true
        ? `Infinity completed step ${stepIndex + 1}.`
        : `Step ${stepIndex + 1} did not work — Infinity will try another way.`,
      { step: stepIndex, ok: result.ok === true }
    );

    // ── VERIFY (re-observe) ── the next THINK sees this fresh screenshot
    emit('status', STATUS.VERIFYING);
    try {
      screenshot = await screen.screenshot();
      shots += 1;
    } catch {
      // Keep the last good screenshot; the planner can still reason from it.
    }
  }

  const message = `Infinity stopped after ${maxSteps} steps without finishing. Try a smaller instruction.`;
  emit('error', message);
  return finish(false, message, { screenshotsTaken: shots, maxStepsHit: true });
}
