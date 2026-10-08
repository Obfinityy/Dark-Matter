/**
 * Computer Action Schema — the ONLY computer actions the local AI may request.
 *
 * Derived from the real capability surface of Open-Interface
 * (https://github.com/AmberSahdev/Open-Interface):
 *
 *   app/interpreter.py  → execute_function() dispatches sleep() and *any*
 *                         pyautogui attribute by name.
 *   app/utils/screen.py → pyautogui.screenshot() → base64 PNG / temp file.
 *   app/resources/context.txt → the action format
 *                         {"steps":[{"function","parameters","human_readable_justification"}],"done"}
 *
 * Open-Interface is intentionally permissive: the model names a pyautogui
 * function and it is called via getattr(). That is the Python equivalent of
 * handing the LLM a raw shell. DARKMATTER must NOT do that.
 *
 * So we keep Open-Interface's *executor semantics* (press/write/hotkey/sleep/
 * screenshot) but replace the open `getattr` dispatch with a closed whitelist
 * that is enforced in BOTH places:
 *   1. here (Node, before an action leaves the orchestrator), and
 *   2. in the Python bridge (ALLOWED_FUNCTIONS), so a compromised prompt
 *      cannot reach an unlisted pyautogui call.
 *
 * No action in this file executes a shell command. Terminal/tool work goes
 * through the DARKMATTER tool registry instead.
 */

/** Actions the local AI may request, mapped to the bridge command name. */
export const COMPUTER_ACTIONS = Object.freeze({
  SCREENSHOT: 'screenshot',
  CLICK: 'click',
  DOUBLE_CLICK: 'double_click',
  MOVE_MOUSE: 'move_mouse',
  TYPE: 'type',
  PRESS_KEY: 'press_key',
  HOTKEY: 'hotkey',
  SCROLL: 'scroll',
  SLEEP: 'sleep',
  OPEN_APPLICATION: 'open_application',
  NAVIGATE: 'navigate',
  GET_ACTIVE_WINDOW: 'get_active_window',
  GET_BROWSER_STATE: 'get_browser_state',
  CLIPBOARD_SET: 'clipboard_set',
});

export const ACTION_TYPES = Object.freeze(Object.values(COMPUTER_ACTIONS));

/** Actions that touch the target over the network → must pass the scope engine. */
export const SCOPE_BEARING_ACTIONS = Object.freeze([
  COMPUTER_ACTIONS.NAVIGATE,
  COMPUTER_ACTIONS.OPEN_APPLICATION,
]);

/** Characters pyautogui.write() can emit. Control keys must use press/hotkey. */
const TYPEABLE = /^[\x20-\x7E\n\r\t\u00A0-\u024F\u0900-\u097F ]*$/;

/**
 * pyautogui KEYBOARD_KEYS (verbatim from Open-Interface's context.txt) — the
 * only key names the bridge will accept.
 */
export const ALLOWED_KEYS = new Set([
  '\t',
  '\n',
  '\r',
  ' ',
  '!',
  '"',
  '#',
  '$',
  '%',
  '&',
  "'",
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  '/',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  ':',
  ';',
  '<',
  '=',
  '>',
  '?',
  '@',
  '[',
  '\\',
  ']',
  '^',
  '_',
  '`',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '{',
  '|',
  '}',
  '~',
  'accept',
  'add',
  'alt',
  'altleft',
  'altright',
  'apps',
  'backspace',
  'browserback',
  'browserfavorites',
  'browserforward',
  'browserhome',
  'browserrefresh',
  'browsersearch',
  'browserstop',
  'capslock',
  'clear',
  'convert',
  'ctrl',
  'ctrlleft',
  'ctrlright',
  'decimal',
  'del',
  'delete',
  'divide',
  'down',
  'end',
  'enter',
  'esc',
  'escape',
  'execute',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
  'f13',
  'f14',
  'f15',
  'f16',
  'f17',
  'f18',
  'f19',
  'f20',
  'f21',
  'f22',
  'f23',
  'f24',
  'final',
  'fn',
  'hanguel',
  'hangul',
  'hanja',
  'help',
  'home',
  'insert',
  'junja',
  'kana',
  'kanji',
  'launchapp1',
  'launchapp2',
  'launchmail',
  'launchmediaselect',
  'left',
  'modechange',
  'multiply',
  'nexttrack',
  'nonconvert',
  'num0',
  'num1',
  'num2',
  'num3',
  'num4',
  'num5',
  'num6',
  'num7',
  'num8',
  'num9',
  'numlock',
  'pagedown',
  'pageup',
  'paste',
  'pause',
  'pgdn',
  'pgup',
  'playpause',
  'prevtrack',
  'print',
  'printscreen',
  'prntscrn',
  'prtsc',
  'prtscr',
  'return',
  'right',
  'scrolllock',
  'select',
  'separator',
  'shift',
  'shiftleft',
  'shiftright',
  'sleep',
  'space',
  'stop',
  'subtract',
  'tab',
  'up',
  'volumedown',
  'volumemute',
  'volumeup',
  'win',
  'winleft',
  'winright',
  'yen',
  'command',
  'option',
  'optionleft',
  'optionright',
]);

const MAX_TYPE_CHARS = 4000;
const MAX_COORD = 100_000;

function normalizeKeyName(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Validate one structured computer action.
 *
 * @param {object} action
 * @param {string} action.type one of ACTION_TYPES
 * @param {object} [action.params]
 * @param {{scopeEngine?: object, target?: string}} [context]
 * @returns {{valid: boolean, errors: string[], action?: object, reason?: string}}
 */
export function validateComputerAction(action, context = {}) {
  const errors = [];

  if (!action || typeof action !== 'object') {
    return { valid: false, errors: ['Computer action must be a non-null object'] };
  }
  if (!ACTION_TYPES.includes(action.type)) {
    return {
      valid: false,
      errors: [`Unknown computer action "${action.type}". Allowed: ${ACTION_TYPES.join(', ')}`],
    };
  }

  const params = action.params && typeof action.params === 'object' ? action.params : {};

  switch (action.type) {
    case COMPUTER_ACTIONS.SCREENSHOT:
    case COMPUTER_ACTIONS.GET_ACTIVE_WINDOW:
    case COMPUTER_ACTIONS.GET_BROWSER_STATE:
      break;

    case COMPUTER_ACTIONS.CLICK:
    case COMPUTER_ACTIONS.DOUBLE_CLICK: {
      const hasCoords = Number.isFinite(params.x) && Number.isFinite(params.y);
      if (!hasCoords) errors.push(`${action.type} requires numeric x and y coordinates`);
      if (hasCoords && (Math.abs(params.x) > MAX_COORD || Math.abs(params.y) > MAX_COORD)) {
        errors.push(`${action.type} coordinates out of range`);
      }
      break;
    }

    case COMPUTER_ACTIONS.MOVE_MOUSE: {
      const hasTarget =
        (Number.isFinite(params.x) && Number.isFinite(params.y)) || typeof params.to === 'string';
      if (!hasTarget) errors.push('move_mouse requires x/y coordinates or a "to" position');
      break;
    }

    case COMPUTER_ACTIONS.TYPE: {
      const text = params.text ?? params.string;
      if (typeof text !== 'string' || text.length === 0)
        errors.push('type requires non-empty text');
      else if (text.length > MAX_TYPE_CHARS)
        errors.push(`type text exceeds ${MAX_TYPE_CHARS} characters`);
      else if (!TYPEABLE.test(text))
        errors.push('type text contains characters that require press_key/hotkey');
      break;
    }

    case COMPUTER_ACTIONS.CLIPBOARD_SET: {
      // Write text to the OS clipboard (paste follows with hotkey ctrl+v).
      // Same character discipline as `type`: no control sequences, bounded size.
      // NOTE: the Python bridge allowlist must gain clipboard_set before the
      // real adapter can execute this — until then it validates but the bridge
      // reports unsupported (mock covers it in tests/simulation).
      const clipText = params.text ?? params.string;
      if (typeof clipText !== 'string' || clipText.length === 0)
        errors.push('clipboard_set requires non-empty text');
      else if (clipText.length > MAX_TYPE_CHARS)
        errors.push(`clipboard_set text exceeds ${MAX_TYPE_CHARS} characters`);
      else if (!TYPEABLE.test(clipText))
        errors.push('clipboard_set text contains unsupported characters');
      break;
    }

    case COMPUTER_ACTIONS.PRESS_KEY: {
      const keys = params.keys ?? params.key;
      const list = Array.isArray(keys) ? keys : [keys];
      if (list.length === 0 || list.some(k => typeof k !== 'string' || !k)) {
        errors.push('press_key requires a key name or list of key names');
      } else {
        const bad = list.map(normalizeKeyName).filter(k => !ALLOWED_KEYS.has(k));
        if (bad.length) errors.push(`press_key received unsupported key(s): ${bad.join(', ')}`);
      }
      const presses = params.presses;
      if (presses !== undefined && (!Number.isInteger(presses) || presses < 1 || presses > 50)) {
        errors.push('press_key presses must be an integer between 1 and 50');
      }
      break;
    }

    case COMPUTER_ACTIONS.HOTKEY: {
      const keys = params.keys ?? params.key;
      const list = Array.isArray(keys) ? keys : [keys];
      if (list.length < 2) errors.push('hotkey requires at least two key names');
      const bad = list.filter(k => typeof k !== 'string' || !ALLOWED_KEYS.has(normalizeKeyName(k)));
      if (bad.length) errors.push(`hotkey received unsupported key(s): ${bad.join(', ')}`);
      break;
    }

    case COMPUTER_ACTIONS.SCROLL: {
      const amount = params.amount ?? params.clicks;
      if (!Number.isFinite(amount) || amount === 0)
        errors.push('scroll requires a non-zero numeric amount');
      if (Number.isFinite(amount) && Math.abs(amount) > 100)
        errors.push('scroll amount exceeds 100 clicks');
      break;
    }

    case COMPUTER_ACTIONS.SLEEP: {
      const seconds = params.seconds ?? params.secs;
      if (!Number.isFinite(seconds) || seconds < 0)
        errors.push('sleep requires non-negative seconds');
      if (Number.isFinite(seconds) && seconds > 300)
        errors.push('sleep is capped at 300 seconds per action');
      break;
    }

    case COMPUTER_ACTIONS.OPEN_APPLICATION: {
      const name = params.name ?? params.application;
      if (typeof name !== 'string' || !name.trim()) errors.push('open_application requires a name');
      else if (name.length > 120) errors.push('open_application name is too long');
      break;
    }

    case COMPUTER_ACTIONS.NAVIGATE: {
      let url = params.url;
      if (typeof url !== 'string' || !url.trim()) {
        errors.push('navigate requires a url');
      } else {
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            errors.push('navigate only supports http/https');
          }
        } catch {
          errors.push(`navigate received an invalid url: ${params.url}`);
        }
      }
      break;
    }
  }

  // ── Scope gate: any action that can reach the target must pass the
  // ScopeEngine. Computer control NEVER bypasses authorization (#7).
  if (!errors.length && SCOPE_BEARING_ACTIONS.includes(action.type)) {
    const url =
      action.type === COMPUTER_ACTIONS.NAVIGATE
        ? params.url.startsWith('http')
          ? params.url
          : `https://${params.url}`
        : null;

    if (url) {
      const scopeEngine = context.scopeEngine;
      if (!scopeEngine) {
        errors.push('Scope engine unavailable — refusing a network-reaching computer action');
      } else if (!scopeEngine.isUrlInScope(url)) {
        errors.push(`Scope violation: ${url} is outside the authorized scope`);
      }
    }
  }

  if (errors.length) return { valid: false, errors };

  // Normalize into the exact shape the bridge accepts.
  const normalized = { type: action.type, params: { ...params } };
  if (action.reason) normalized.reason = String(action.reason).slice(0, 500);
  if (action.expectedOutcome)
    normalized.expectedOutcome = String(action.expectedOutcome).slice(0, 500);
  if (action.type === COMPUTER_ACTIONS.TYPE) normalized.params.text = params.text ?? params.string;
  if (action.type === COMPUTER_ACTIONS.PRESS_KEY) {
    const keys = params.keys ?? params.key;
    normalized.params.keys = (Array.isArray(keys) ? keys : [keys]).map(normalizeKeyName);
  }
  if (action.type === COMPUTER_ACTIONS.HOTKEY) {
    const keys = params.keys ?? params.key;
    normalized.params.keys = (Array.isArray(keys) ? keys : [keys]).map(normalizeKeyName);
  }
  if (action.type === COMPUTER_ACTIONS.SLEEP) {
    normalized.params.seconds = params.seconds ?? params.secs;
  }
  if (action.type === COMPUTER_ACTIONS.NAVIGATE && !/^https?:\/\//i.test(normalized.params.url)) {
    normalized.params.url = `https://${normalized.params.url}`;
  }

  return { valid: true, errors: [], action: normalized, reason: action.reason || null };
}

/**
 * Prompt fragment describing the computer-action contract to the local brain.
 * Kept in the same vocabulary as Open-Interface's context.txt so an
 * Open-Interface-trained model transfers cleanly — minus the open getattr.
 */
export const COMPUTER_ACTION_PROMPT = `COMPUTER ACTIONS (the "hands" layer — you request these, DARKMATTER validates and executes them):
{
  "type": "screenshot" | "click" | "double_click" | "move_mouse" | "type" | "press_key"
        | "hotkey" | "scroll" | "sleep" | "open_application" | "navigate"
        | "get_active_window" | "get_browser_state" | "clipboard_set",
  "params": { ...action specific... },
  "reason": "why this action",
  "expectedOutcome": "what the observation should show"
}
Examples:
  {"type":"navigate","params":{"url":"https://example.com"},"reason":"open the authorized target"}
  {"type":"type","params":{"text":"admin"},"reason":"fill the login field"}
  {"type":"press_key","params":{"keys":["enter"]},"reason":"submit the form"}
Rules:
- Use ONLY the actions above. There is no shell action — use the tool registry for terminal work.
- "navigate" and "open_application" are scope-checked. An out-of-scope URL will be rejected.
- Prefer keyboard actions over raw mouse coordinates when a page is reachable by URL.`;

export { normalizeKeyName };
