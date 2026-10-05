/**
 * Infinity Control actions — the validated action layer for the see → think → act
 * control loop (backend/src/control/agentLoop.js).
 *
 * The loop's planner (Vision brain) and grounder (Grounding brain) work in
 * NORMALIZED screen coordinates (0–1000 on each axis, origin top-left), the same
 * convention used by modern GUI grounding models. Every action the loop wants to
 * run passes through validateControlAction() first, is converted to absolute
 * pixels for the current screen, and is then dispatched to the injected bridge
 * adapter as one of the CLOSED computer actions from
 * backend/src/computer/actionSchema.js. There is deliberately no shell action.
 *
 * Professional English throughout; all user-visible strings are Infinity AI
 * branded (see agentLoop.js for the status copy).
 */

import {
  ALLOWED_KEYS,
  COMPUTER_ACTIONS,
  normalizeKeyName
} from '../computer/actionSchema.js';

/** Actions the control loop may request. */
export const CONTROL_ACTIONS = Object.freeze({
  CLICK: 'click',
  DOUBLE_CLICK: 'doubleClick',
  TYPE: 'type',
  PRESS: 'press',
  SCROLL: 'scroll',
  DRAG: 'drag',
  WAIT: 'wait',
  SCREENSHOT: 'screenshot'
});

export const CONTROL_ACTION_TYPES = Object.freeze(Object.values(CONTROL_ACTIONS));

/** Actions whose target is a screen point the grounder must locate (0–1000 space). */
export const COORDINATE_ACTIONS = Object.freeze([
  CONTROL_ACTIONS.CLICK,
  CONTROL_ACTIONS.DOUBLE_CLICK
]);

/** Defensive limits applied before anything reaches the bridge. */
export const CONTROL_LIMITS = Object.freeze({
  /** Normalized coordinate space shared with the grounding brain. */
  COORD_MIN: 0,
  COORD_MAX: 1000,
  /** Longest text typed in a single action (prevents runaway paste loops). */
  MAX_TYPE_CHARS: 2000,
  /** Scroll wheel clicks per action. */
  MAX_SCROLL_AMOUNT: 100,
  /** Longest single wait. */
  MAX_WAIT_MS: 30_000,
  /** Longest key chord (e.g. ctrl+shift+t). */
  MAX_KEYS: 4
});

/** Characters type() may emit; control keys must go through press(). */
const TYPEABLE = /^[\x20-\x7E\n\r\t\u00A0-\u024F\u0900-\u097F ]*$/;

function isNormalizedCoord(value) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= CONTROL_LIMITS.COORD_MIN &&
    value <= CONTROL_LIMITS.COORD_MAX;
}

function checkCoords(params, keys, errors) {
  for (const key of keys) {
    const value = params[key];
    if (!isNormalizedCoord(value)) {
      errors.push(
        `"${key}" must be a number between ${CONTROL_LIMITS.COORD_MIN} and ` +
        `${CONTROL_LIMITS.COORD_MAX} (normalized screen coordinates); ` +
        `received ${JSON.stringify(value)}`
      );
    }
  }
}

/**
 * Validate one control-loop action.
 *
 * Coordinates are REQUIRED to be inside the 0–1000 normalized space; anything
 * outside (including Infinity, NaN or non-numbers) is rejected here, before
 * the grounder's output can ever reach the desktop.
 *
 * Point actions (click/doubleClick) may alternatively arrive with a
 * natural-language `description` and no coordinates at all — the loop's
 * grounder fills the coordinates in before execution. Partial coordinates
 * (x without y) are still rejected.
 *
 * @param {object} action { type, params?, description? }
 * @returns {{ valid: boolean, errors: string[], action: object|null }}
 */
export function validateControlAction(action) {
  if (!action || typeof action !== 'object') {
    return { valid: false, errors: ['Control action must be a non-null object'], action: null };
  }
  if (!CONTROL_ACTION_TYPES.includes(action.type)) {
    return {
      valid: false,
      errors: [`Unknown control action "${action.type}". Allowed: ${CONTROL_ACTION_TYPES.join(', ')}`],
      action: null
    };
  }

  const params = action.params && typeof action.params === 'object' ? action.params : {};
  const errors = [];
  const out = { x: 0, y: 0 };

  switch (action.type) {
    case CONTROL_ACTIONS.CLICK:
    case CONTROL_ACTIONS.DOUBLE_CLICK: {
      const wantsGrounding = (params.x == null && params.y == null) &&
        typeof action.description === 'string' && action.description.trim().length > 0;
      if (wantsGrounding) {
        // Description-only: the loop's grounder resolves 0–1000 coordinates.
        out.params = {};
      } else {
        checkCoords(params, ['x', 'y'], errors);
        if (!errors.length) {
          out.params = { x: Math.round(params.x), y: Math.round(params.y) };
        }
      }
      break;
    }

    case CONTROL_ACTIONS.TYPE: {
      const text = params.text ?? params.string;
      if (typeof text !== 'string' || text.length === 0) {
        errors.push('type requires non-empty text');
      } else if (text.length > CONTROL_LIMITS.MAX_TYPE_CHARS) {
        errors.push(`type text exceeds ${CONTROL_LIMITS.MAX_TYPE_CHARS} characters`);
      } else if (!TYPEABLE.test(text)) {
        errors.push('type text contains characters that must go through press() instead');
      }
      if (!errors.length) out.params = { text };
      break;
    }

    case CONTROL_ACTIONS.PRESS: {
      const raw = params.keys ?? params.key;
      const list = Array.isArray(raw) ? raw : [raw];
      if (list.length === 0 || list.length > CONTROL_LIMITS.MAX_KEYS) {
        errors.push(`press requires 1–${CONTROL_LIMITS.MAX_KEYS} key names`);
      } else if (list.some((k) => typeof k !== 'string' || !k.trim())) {
        errors.push('press key names must be non-empty strings');
      } else {
        const bad = list
          .map(normalizeKeyName)
          .filter((k) => !ALLOWED_KEYS.has(k));
        if (bad.length) errors.push(`press received unsupported key(s): ${bad.join(', ')}`);
      }
      if (!errors.length) out.params = { keys: list.map(normalizeKeyName) };
      break;
    }

    case CONTROL_ACTIONS.SCROLL: {
      const amount = params.amount ?? params.clicks;
      if (!Number.isFinite(amount) || amount === 0) {
        errors.push('scroll requires a non-zero numeric amount');
      } else if (Math.abs(amount) > CONTROL_LIMITS.MAX_SCROLL_AMOUNT) {
        errors.push(`scroll amount exceeds ${CONTROL_LIMITS.MAX_SCROLL_AMOUNT} clicks`);
      }
      if (!errors.length) out.params = { amount: Math.trunc(amount) };
      break;
    }

    case CONTROL_ACTIONS.DRAG: {
      // Drag needs the full path up front: the grounder resolves single
      // points, so multi-point gestures come from the planner explicitly.
      checkCoords(params, ['fromX', 'fromY', 'toX', 'toY'], errors);
      if (!errors.length) {
        out.params = {
          fromX: Math.round(params.fromX),
          fromY: Math.round(params.fromY),
          toX: Math.round(params.toX),
          toY: Math.round(params.toY)
        };
      }
      break;
    }

    case CONTROL_ACTIONS.WAIT: {
      const ms = params.ms ?? (params.seconds != null ? params.seconds * 1000 : undefined);
      if (!Number.isFinite(ms) || ms < 0) {
        errors.push('wait requires a non-negative duration');
      } else if (ms > CONTROL_LIMITS.MAX_WAIT_MS) {
        errors.push(`wait is capped at ${CONTROL_LIMITS.MAX_WAIT_MS} ms per action`);
      }
      if (!errors.length) out.params = { ms: Math.round(ms) };
      break;
    }

    case CONTROL_ACTIONS.SCREENSHOT: {
      out.params = {};
      break;
    }

    default:
      errors.push(`Unhandled control action "${action.type}"`);
  }

  if (typeof action.description === 'string' && action.description.trim()) {
    out.description = action.description.trim().slice(0, 300);
  }
  if (action.reason) out.reason = String(action.reason).slice(0, 500);

  if (errors.length) return { valid: false, errors, action: null };
  return { valid: true, errors: [], action: { type: action.type, ...out } };
}

/**
 * Convert normalized 0–1000 coordinates to absolute pixels for the given
 * screen, clamped to the visible area.
 */
export function coordsToPixels(x, y, width, height) {
  const w = Number.isFinite(width) && width > 0 ? width : 1920;
  const h = Number.isFinite(height) && height > 0 ? height : 1080;
  const clamp = (v, max) => Math.min(Math.max(Math.round(v), 0), max);
  return {
    x: clamp((x / CONTROL_LIMITS.COORD_MAX) * w, w - 1),
    y: clamp((y / CONTROL_LIMITS.COORD_MAX) * h, h - 1)
  };
}

/**
 * Validate a control action, convert its coordinates to pixels, and dispatch
 * it to the bridge adapter using only the closed computer-action schema.
 *
 * @param {object} action control action ({ type, params })
 * @param {object} bridge adapter exposing execute({ type, params, reason })
 * @param {{ width?: number, height?: number }} [screen]
 * @returns {Promise<object>} the bridge result, or a rejection-shaped result
 */
export async function executeControlAction(action, bridge, screen = {}) {
  const validation = validateControlAction(action);
  if (!validation.valid) {
    return {
      ok: false,
      action: null,
      output: null,
      observation: null,
      error: { message: validation.errors.join('; '), kind: 'rejected' },
      rejected: true
    };
  }

  const { type, params, reason } = validation.action;
  const { width, height } = screen;

  // Description-only point actions must be grounded before dispatch; the loop
  // does this, but a direct caller might not — never send NaN to the desktop.
  if (COORDINATE_ACTIONS.includes(type) && (params.x == null || params.y == null)) {
    return {
      ok: false,
      action: null,
      output: null,
      observation: null,
      error: { message: `${type} has no coordinates — ground its description first`, kind: 'rejected' },
      rejected: true
    };
  }

  const dispatch = (computerAction) =>
    bridge.execute({ ...computerAction, reason: reason || computerAction.reason });

  try {
    switch (type) {
      case CONTROL_ACTIONS.CLICK: {
        const p = coordsToPixels(params.x, params.y, width, height);
        return await dispatch({ type: COMPUTER_ACTIONS.CLICK, params: p });
      }
      case CONTROL_ACTIONS.DOUBLE_CLICK: {
        const p = coordsToPixels(params.x, params.y, width, height);
        return await dispatch({ type: COMPUTER_ACTIONS.DOUBLE_CLICK, params: p });
      }
      case CONTROL_ACTIONS.TYPE:
        return await dispatch({ type: COMPUTER_ACTIONS.TYPE, params: { text: params.text } });
      case CONTROL_ACTIONS.PRESS:
        return await dispatch({
          type: params.keys.length === 1 ? COMPUTER_ACTIONS.PRESS_KEY : COMPUTER_ACTIONS.HOTKEY,
          params: { keys: params.keys }
        });
      case CONTROL_ACTIONS.SCROLL:
        return await dispatch({ type: COMPUTER_ACTIONS.SCROLL, params: { amount: params.amount } });
      case CONTROL_ACTIONS.DRAG: {
        // The closed schema has no drag primitive yet, so the loop emulates it
        // as a press-and-hold path: move to the start, then move to the end.
        // A future bridge can add a native drag primitive and this case can
        // dispatch it directly without changing the loop.
        const from = coordsToPixels(params.fromX, params.fromY, width, height);
        const to = coordsToPixels(params.toX, params.toY, width, height);
        const first = await dispatch({ type: COMPUTER_ACTIONS.MOVE_MOUSE, params: from });
        if (!first.ok) return first;
        return await dispatch({ type: COMPUTER_ACTIONS.MOVE_MOUSE, params: to });
      }
      case CONTROL_ACTIONS.WAIT:
        return await dispatch({ type: COMPUTER_ACTIONS.SLEEP, params: { seconds: params.ms / 1000 } });
      case CONTROL_ACTIONS.SCREENSHOT:
        return await dispatch({ type: COMPUTER_ACTIONS.SCREENSHOT, params: {} });
      default:
        return {
          ok: false,
          action: null,
          output: null,
          observation: null,
          error: { message: `Unsupported control action "${type}"`, kind: 'rejected' },
          rejected: true
        };
    }
  } catch (err) {
    return {
      ok: false,
      action: null,
      output: null,
      observation: null,
      error: { message: err?.message || 'bridge threw', kind: 'error' },
      rejected: false
    };
  }
}

/**
 * Adapt a legacy computer adapter (MockComputerAdapter / OpenInterfaceAdapter,
 * which only expose execute()) to the loop's bridge contract:
 * { screenshot() → { width, height, imageBase64 }, execute(action) }.
 */
export function adaptLegacyBridge(adapter) {
  return {
    async screenshot() {
      const res = await adapter.execute({ type: COMPUTER_ACTIONS.SCREENSHOT, params: {} });
      if (!res || res.ok !== true) {
        throw new Error(res?.error?.message || 'Screenshot capture failed');
      }
      const output = res.output || {};
      return {
        width: Number.isFinite(output.width) ? output.width : 1920,
        height: Number.isFinite(output.height) ? output.height : 1080,
        imageBase64: output.imageBase64 || output.base64Png || output.pngBase64 || null,
        simulated: Boolean(res.simulated)
      };
    },
    async execute(action) {
      return adapter.execute(action);
    }
  };
}
