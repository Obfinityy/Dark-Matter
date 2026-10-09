/**
 * vmControlLoop.js — Infinity AI VM control loop: think → act → observe.
 *
 * Runs in the BROWSER (frontend page). The loop drives the user's Kali VM
 * through the local VM Runner (http://127.0.0.1:4100) while all three brains
 * infer BROWSER-DIRECT against the user's own models (Kaggle Gradio links or
 * local model slots). NOTHING — inference, screenshots, or control commands —
 * is ever routed through the Render backend.
 *
 * Brain hierarchy (standing order):
 *   - HACKING brain is the SOLE decision-maker. It emits exactly ONE action
 *     per step (design §4 protocol, below).
 *   - VISION brain only describes what it is asked to see (a screenshot is a
 *     request attachment: fed to the single vision call, never stored in the
 *     transcript, never logged).
 *   - GROUNDING brain only emits 0–1000 normalized coordinates for the element
 *     it is told to find. The runner maps those to VM pixels.
 *
 * Brain→VM action protocol (design §4):
 *   { "type": "shell",      "command": "nmap -sV -p- 10.0.2.15", "cwd": "/home/kali", "timeoutMs": 300000 }
 *   { "type": "shellBg",    "command": "sqlmap -u http://target/ --batch" }   // long-running, polled
 *   { "type": "click",      "x": 512, "y": 300, "button": "left" }            // 0–1000 normalized
 *   { "type": "click",      "element": "the Submit button" }                  // loop resolves via grounding
 *   { "type": "type",       "text": "admin' OR '1'='1" }
 *   { "type": "key",        "key": "Enter" }                                  // "ctrl+l", "Tab", ...
 *   { "type": "scroll",     "dy": -240 }
 *   { "type": "screenshot", "purpose": "check the scan results on screen" }
 *   { "type": "done",       "summary": "what was accomplished" }              // loop control signal
 *
 * Provider contract (what the UI workstream passes as `brains`):
 *   brains.hacker    { generate(messages, { timeoutMs }) } -> Promise<string>
 *                      messages: [{ role: 'system'|'user', content: string }]
 *   brains.vision    { generate(messages, { timeoutMs }) } -> Promise<string>
 *                      may carry image parts:
 *                      { role:'user', content:[
 *                        { type:'text', text:'...' },
 *                        { type:'image_url', image_url:{ url:'data:image/jpeg;base64,...' } } ] }
 *   brains.grounding { generateStructured(messages, schema, { timeoutMs }) }
 *                      -> Promise<{ x, y, confidence? }>  (0–1000 space)
 *                      OPTIONAL: when absent, the Vision brain doubles as
 *                      grounder (source reported as 'vision-fallback').
 *
 * Runner API contract (what the UI workstream passes as `runnerApi`):
 *   exec({ sessionId, command, cwd?, timeoutMs? })
 *     -> Promise<{ exit_code, stdout, stderr, timed_out }>
 *   execStart({ sessionId, command, cwd? }) -> Promise<{ execId }>
 *   execPoll({ sessionId, execId })
 *     -> Promise<{ done, exit_code?, outputDelta?, stdout?, stderr? }>
 *   execKill({ sessionId, execId }) -> Promise<{ ok }>
 *   input({ sessionId, action }) -> Promise<{ ok }>
 *     action uses the §4 protocol; click x/y stay 0–1000 normalized,
 *     the runner maps them to VM pixels.
 *   screenshot({ sessionId, width? }) -> Promise<{ base64, mime }>
 *     JPEG base64 — kept in browser memory only, never persisted.
 *   saveMemory?({ sessionId, kind, record }) -> Promise<void>  (optional;
 *     used when the runner exposes a memory endpoint, otherwise the loop
 *     falls back to appending JSONL inside the guest session dir)
 *
 * Per-session memory: the runner owns %USERPROFILE%/DarkMatter/vm-sessions/<sessionId>/
 * (host-local files only). This loop keeps an in-memory transcript and asks the
 * runner to persist notes/findings.
 *
 * Events (via onEvent): started | step | thought | action | observation |
 *   gate.blocked | brain.error | screenshot | finding | memory.saved |
 *   paused | resumed | stopped | completed | ask.answered
 */

import { chatWithGradio } from '../services/gradioDirect.js';

/** Brain→VM action types (design §4). `done` is a loop control signal, not a VM action. */
export const ACTION_TYPES = Object.freeze(['shell', 'shellBg', 'click', 'type', 'key', 'scroll', 'screenshot']);

/** Normalized coordinate space used by grounding models (UI-TARS convention). */
export const GROUNDING_SPACE = 1000;

export const MAX_STEPS_DEFAULT = 25;
export const IDLE_TIMEOUT_DEFAULT_MS = 10 * 60 * 1000;
export const BRAIN_TIMEOUT_DEFAULT_MS = 120_000;
export const STEP_TIMEOUT_DEFAULT_MS = 12 * 60 * 1000;
const POLL_INTERVAL_MS = 2500;
const MAX_OBSERVATION_CHARS = 6000;
const TRANSCRIPT_PROMPT_STEPS = 12;
const MEMORY_PERSIST_EVERY_STEPS = 3;

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function truncate(text, max = MAX_OBSERVATION_CHARS) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]` : s;
}

function clampCoord(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(GROUNDING_SPACE, Math.max(0, Math.round(v)));
}

/** Extract the first balanced {...} JSON object from model prose. */
export function extractJsonObject(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// action validation (design §4 — strict)
// ---------------------------------------------------------------------------

const KEY_RE = /^[A-Za-z0-9_+\-]{1,30}(\+[A-Za-z0-9_+\-]{1,30})*$/;

export function validateAction(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'action must be an object' };
  const { type } = raw;
  if (type === 'done') {
    return { ok: true, action: { type: 'done', summary: String(raw.summary || '').slice(0, 2000) } };
  }
  if (!ACTION_TYPES.includes(type)) {
    return { ok: false, error: `unknown action type "${type}" — expected one of ${ACTION_TYPES.join(', ')} or "done"` };
  }
  switch (type) {
    case 'shell':
    case 'shellBg': {
      const command = String(raw.command || '').trim();
      if (!command) return { ok: false, error: `${type} needs a "command"` };
      if (command.length > 4000) return { ok: false, error: 'command too long (max 4000 chars)' };
      return {
        ok: true,
        action: {
          type,
          command,
          cwd: raw.cwd ? String(raw.cwd).slice(0, 500) : undefined,
          timeoutMs: Number.isFinite(Number(raw.timeoutMs)) ? Math.min(1_800_000, Math.max(5000, Number(raw.timeoutMs))) : undefined,
        },
      };
    }
    case 'click': {
      const button = ['left', 'right', 'middle'].includes(raw.button) ? raw.button : 'left';
      if (raw.element && (raw.x == null || raw.y == null)) {
        return { ok: true, action: { type, element: String(raw.element).slice(0, 300), button } };
      }
      const x = clampCoord(raw.x);
      const y = clampCoord(raw.y);
      if (x === null || y === null) {
        return { ok: false, error: 'click needs x/y in 0–1000 space, or an "element" description for the grounding brain' };
      }
      return { ok: true, action: { type, x, y, button } };
    }
    case 'type': {
      const text = String(raw.text ?? '');
      if (!text) return { ok: false, error: 'type needs "text"' };
      if (text.length > 2000) return { ok: false, error: 'type text too long (max 2000 chars)' };
      return {
        ok: true,
        action: { type, text, element: raw.element ? String(raw.element).slice(0, 300) : undefined },
      };
    }
    case 'key': {
      const key = String(raw.key || '').trim();
      if (!KEY_RE.test(key)) return { ok: false, error: `key "${key.slice(0, 40)}" looks unsafe — use names like Enter, Tab, ctrl+l` };
      return { ok: true, action: { type, key } };
    }
    case 'scroll': {
      const dy = Number(raw.dy);
      if (!Number.isFinite(dy) || Math.abs(dy) > 5000) return { ok: false, error: 'scroll needs a numeric "dy" within ±5000' };
      return { ok: true, action: { type, dy: Math.round(dy) } };
    }
    case 'screenshot':
      return { ok: true, action: { type, purpose: raw.purpose ? String(raw.purpose).slice(0, 300) : undefined } };
    default:
      return { ok: false, error: `unhandled action type "${type}"` };
  }
}

// ---------------------------------------------------------------------------
// target-scope gate (design §7): only the declared scope may be touched
// ---------------------------------------------------------------------------

function extractHosts(text) {
  const hosts = new Set();
  const s = String(text || '');
  let m;
  const urlRe = /https?:\/\/([A-Za-z0-9_.\-]+|\[[0-9a-fA-F:]+\])(:\d+)?/gi;
  while ((m = urlRe.exec(s))) hosts.add(m[1].replace(/^\[|\]$/g, ''));
  const ipRe = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  while ((m = ipRe.exec(s))) hosts.add(m[0]);
  for (const tok of s.split(/\s+/)) {
    if (/^[-/]/.test(tok) || tok.includes('=') || tok.includes(',') || tok.includes('|')) continue;
    const bare = tok.replace(/:\d+$/, '');
    if (/^[A-Za-z0-9_.\-]+\.[A-Za-z]{2,}$/.test(bare) && bare.length <= 253) hosts.add(bare);
  }
  return [...hosts];
}

const SAFE_LOCAL_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$)/i;

export function hostInScope(host, scope) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '').trim();
  if (!h) return false;
  if (SAFE_LOCAL_RE.test(h)) return true; // VM sandbox networking is always in scope
  for (const entry of scope || []) {
    const e = String(entry || '').toLowerCase().trim();
    if (!e) continue;
    if (h === e || h.endsWith(`.${e}`)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// hacker prompts
// ---------------------------------------------------------------------------

function hackerSystemPrompt(scope) {
  const scopeLine = scope && scope.length
    ? `AUTHORIZED TARGET SCOPE: ${scope.join(', ')}. You may ONLY interact with hosts inside this scope (plus VM-local addresses). Never probe, scan, or attack anything else.`
    : 'AUTHORIZED TESTING ONLY: interact solely with the target the user gave you. Never probe third-party systems.';
  return [
    'You are the HACKING BRAIN of Infinity AI, an autonomous bug-bounty agent running on the USER\'S OWN machine inside a throwaway Kali Linux VM sandbox.',
    'You are the SOLE decision-maker. A vision brain describes screens for you; a grounding brain returns click coordinates for you. They decide nothing — you do.',
    scopeLine,
    'RULES:',
    '- Authorized security testing only. Non-destructive: no wiping, no ransomware, no harming out-of-scope systems.',
    '- The VM is a sandbox — commands run inside the guest, never on the user\'s real desktop.',
    '- Output EXACTLY one JSON object per turn with this shape:',
    '  { "thought": "one or two sentences of reasoning",',
    '    "visionInstruction": "optional concrete order for the vision brain, e.g. \'List every input field on this login page.\'",',
    '    "groundingInstruction": "optional concrete order for the grounding brain, e.g. \'Coordinates of the Submit button.\'",',
    '    "action": { ...ONE action from the protocol below... },',
    '    "finding": { "title": "...", "severity": "critical|high|medium|low|informational", "description": "...", "evidence": "..." } // optional, when you confirm something noteworthy',
    '  }',
    '- ACTION PROTOCOL (the ONLY actions you may emit):',
    '  { "type": "shell",   "command": "nmap -sV target", "cwd": "/home/kali", "timeoutMs": 120000 }',
    '  { "type": "shellBg", "command": "nmap -p- target" }                      // long scans; the loop polls until done',
    '  { "type": "click",   "x": 512, "y": 300, "button": "left" }              // x/y in 0–1000 normalized space',
    '  { "type": "click",   "element": "the Submit button" }                     // when you do NOT know coords — the grounding brain resolves them',
    '  { "type": "type",    "text": "text to type" }',
    '  { "type": "key",     "key": "Enter" }                                    // key names: Enter, Tab, Escape, ctrl+l, ...',
    '  { "type": "scroll",  "dy": -240 }',
    '  { "type": "screenshot", "purpose": "why you need eyes right now" }',
    '  { "type": "done",    "summary": "what was accomplished" }                // emit when the task is complete',
    '- After every click/type/key/scroll you automatically receive a fresh screenshot description — do not emit a bare "screenshot" right after an input action unless you need a closer look.',
    '- Prefer shell actions for recon/exploitation tooling (nmap, sqlmap, gobuster, nikto, curl); use the GUI (Firefox) only when a tool cannot do the job.',
    '- Keep commands bounded: always set timeouts, prefer targeted scans over full sweeps first.',
    '- No prose outside the JSON. No markdown fences.',
  ].join('\n');
}

function visionSystemPrompt() {
  return [
    'You are the VISION BRAIN of Infinity AI, an autonomous bug-bounty agent.',
    'You only describe what you are asked to see in a screenshot of a Kali Linux VM under AUTHORIZED security testing.',
    'Describe precisely what is visible: page structure, forms, buttons, terminal output, error messages, version banners, login states — anything a security analyst would note.',
    'Be concrete and terse. You decide nothing and take no actions.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// browser-direct brain adapters
// ---------------------------------------------------------------------------

function flattenMessages(messages) {
  return (messages || [])
    .map((m) => {
      const c = m?.content;
      const text = Array.isArray(c)
        ? c.filter((p) => p?.type === 'text').map((p) => p.text).join('\n')
        : String(c ?? '');
      return `${m?.role === 'system' ? '[system]' : '[user]'} ${text}`;
    })
    .join('\n\n');
}

function firstImageDataUrl(messages) {
  for (const m of messages || []) {
    const c = m?.content;
    if (!Array.isArray(c)) continue;
    for (const p of c) {
      const url = p?.type === 'image_url' ? p.image_url?.url : null;
      if (typeof url === 'string' && url.startsWith('data:image/')) return url;
    }
  }
  return null;
}

/**
 * Wrap a ready provider, a Gradio text slot, or a local OpenAI-compatible
 * chat slot into the text-generation contract.
 * spec: provider | { kind:'gradio', url } | { kind:'localChat', baseUrl, modelId }
 */
function adaptTextSlot(spec, slotName) {
  if (spec && typeof spec.generate === 'function') return spec;
  if (spec?.kind === 'gradio' && spec.url) {
    const url = String(spec.url);
    return {
      async generate(messages, { timeoutMs } = {}) {
        return chatWithGradio(url, flattenMessages(messages), { timeoutMs: timeoutMs || BRAIN_TIMEOUT_DEFAULT_MS });
      },
    };
  }
  if (spec?.kind === 'localChat' && spec.baseUrl) {
    const base = String(spec.baseUrl).replace(/\/+$/, '');
    const modelId = spec.modelId || '';
    return {
      async generate(messages, { timeoutMs } = {}) {
        const textMessages = (messages || []).map((m) => ({
          role: m.role === 'system' ? 'system' : 'user',
          content: Array.isArray(m.content)
            ? m.content.filter((p) => p?.type === 'text').map((p) => p.text).join('\n')
            : String(m.content ?? ''),
        }));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || BRAIN_TIMEOUT_DEFAULT_MS);
        try {
          const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ model: modelId, messages: textMessages, stream: false }),
          });
          if (!res.ok) throw new Error(`local ${slotName} slot HTTP ${res.status}`);
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content !== 'string' || !content.trim()) throw new Error(`local ${slotName} slot returned no text`);
          return content;
        } finally {
          clearTimeout(timer);
        }
      },
    };
  }
  return null;
}

function adaptVisionSlot(spec) {
  if (spec && typeof spec.generate === 'function') return spec;
  if (spec?.kind === 'localChat' && spec.baseUrl) {
    const base = String(spec.baseUrl).replace(/\/+$/, '');
    const modelId = spec.modelId || '';
    return {
      async generate(messages, { timeoutMs } = {}) {
        const imageUrl = firstImageDataUrl(messages);
        const text = flattenMessages(messages);
        const userContent = imageUrl
          ? [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: imageUrl } },
          ]
          : text;
        const chatMessages = [
          { role: 'system', content: visionSystemPrompt() },
          { role: 'user', content: userContent },
        ];
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || BRAIN_TIMEOUT_DEFAULT_MS);
        try {
          const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ model: modelId, messages: chatMessages, stream: false }),
          });
          if (!res.ok) throw new Error(`local vision slot HTTP ${res.status}`);
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content !== 'string' || !content.trim()) throw new Error('local vision slot returned no text');
          return content;
        } finally {
          clearTimeout(timer);
        }
      },
    };
  }
  if (spec?.kind === 'gradio' && spec.url) {
    // Text-only Gradio interfaces cannot carry screenshots — fail closed with a
    // clear instruction instead of hallucinating a screen description.
    return {
      async generate() {
        throw new Error(
          'Vision needs a multimodal slot: this Gradio link accepts text only and cannot receive screenshots. ' +
          'Connect a local vision model (Models page → Vision slot → Run) to enable screen sight.'
        );
      },
    };
  }
  return null;
}

function adaptGroundingSlot(spec) {
  if (spec && typeof spec.generateStructured === 'function') return spec;
  const textGen = adaptTextSlot(spec, 'grounding');
  if (!textGen) return null;
  return {
    source: 'grounding',
    async generateStructured(messages, _schema, { timeoutMs } = {}) {
      const prompt = `${flattenMessages(messages)}\n\nReply with ONLY a JSON object: {"x": <0-1000>, "y": <0-1000>, "confidence": <0-1>}.`;
      const raw = await textGen.generate([{ role: 'user', content: prompt }], { timeoutMs });
      const obj = extractJsonObject(raw);
      if (!obj) throw new Error(`grounding brain returned no coordinates: ${String(raw).slice(0, 200)}`);
      const x = clampCoord(obj.x);
      const y = clampCoord(obj.y);
      if (x === null || y === null) throw new Error(`grounding brain returned unusable coordinates: ${JSON.stringify(obj).slice(0, 200)}`);
      let confidence = Number(obj.confidence);
      if (!Number.isFinite(confidence)) confidence = null;
      return { x, y, confidence };
    },
  };
}

/**
 * Vision-fallback grounding adapter — used when the user has NOT connected a
 * dedicated Grounding brain. The Vision brain (Qwen2.5-VL class) returns
 * coordinates natively; precision is lower than a purpose-built grounding
 * model, but Control keeps working with two brains instead of three (and a
 * Kaggle setup burns ~1/3 less free GPU quota). Mirrors the backend fallback
 * in infinityModes.js (groundingBrain || visionBrain).
 */
function createVisionGroundingFallback(visionAdapter) {
  return {
    source: 'vision-fallback',
    async generateStructured(messages, _schema, { timeoutMs } = {}) {
      const raw = await visionAdapter.generate(messages, { timeoutMs });
      const obj = extractJsonObject(raw);
      if (!obj) throw new Error(`vision fallback returned no coordinates: ${String(raw).slice(0, 200)}`);
      const x = clampCoord(obj.x);
      const y = clampCoord(obj.y);
      if (x === null || y === null) throw new Error(`vision fallback returned unusable coordinates: ${JSON.stringify(obj).slice(0, 200)}`);
      let confidence = Number(obj.confidence);
      if (!Number.isFinite(confidence)) confidence = null;
      return { x, y, confidence };
    },
  };
}

/**
 * Build the brains contract from browser-direct slot specs.
 * Each slot: a ready provider | { kind:'gradio', url } | { kind:'localChat', baseUrl, modelId }.
 * The Grounding slot is OPTIONAL: a dedicated grounding brain wins, otherwise
 * the Vision brain doubles as grounder. Missing slots are null — the loop
 * degrades gracefully and reports it.
 */
export function createBrowserDirectBrains({ hacker, vision, grounding } = {}) {
  const visionAdapter = adaptVisionSlot(vision);
  const groundingAdapter =
    adaptGroundingSlot(grounding) || (visionAdapter ? createVisionGroundingFallback(visionAdapter) : null);
  return {
    hacker: adaptTextSlot(hacker, 'hacker'),
    vision: visionAdapter,
    grounding: groundingAdapter,
  };
}

// ---------------------------------------------------------------------------
// the loop
// ---------------------------------------------------------------------------

/**
 * Create a think → act → observe control loop for one VM session.
 *
 * @param {object} opts
 * @param {object} opts.runnerApi     — VM Runner client (contract above)
 * @param {object} opts.brains        — { hacker, vision, grounding } providers
 * @param {string} opts.sessionId
 * @param {function} [opts.onEvent]   — (event) => void
 * @param {object} [opts.options]
 * @param {number} [opts.options.maxSteps=25]
 * @param {number} [opts.options.idleTimeoutMs=600000]
 * @param {number} [opts.options.brainTimeoutMs=120000]
 * @param {number} [opts.options.stepTimeoutMs=720000]
 * @returns {{ start(task, opts?), pause(), resume(), stop(), ask(question),
 *            getState(), getTranscript() }}
 */
export function createVmControlLoop({ runnerApi, brains, sessionId, onEvent, options = {} }) {
  if (!runnerApi) throw new Error('createVmControlLoop: runnerApi is required');
  if (!sessionId) throw new Error('createVmControlLoop: sessionId is required');

  const maxSteps = options.maxSteps || MAX_STEPS_DEFAULT;
  const idleTimeoutMs = options.idleTimeoutMs || IDLE_TIMEOUT_DEFAULT_MS;
  const brainTimeoutMs = options.brainTimeoutMs || BRAIN_TIMEOUT_DEFAULT_MS;
  const stepTimeoutMs = options.stepTimeoutMs || STEP_TIMEOUT_DEFAULT_MS;

  const emit = (type, data = {}) => {
    try {
      onEvent?.({ type, sessionId, at: new Date().toISOString(), ...data });
    } catch {
      /* listener errors must not break the loop */
    }
  };

  const state = {
    status: 'idle', // idle | running | paused | stopped | completed | failed
    task: null,
    scope: [],
    step: 0,
    startedAt: null,
    finishedAt: null,
    finishReason: null,
    lastProgressAt: null,
    brainBusy: false,
  };
  const transcript = []; // text-only entries; NEVER screenshots
  const findings = [];
  const bgExecIds = new Set();
  let resumeResolve = null;
  let started = false;

  const note = (kind, text) => {
    transcript.push({ step: state.step, kind, text: truncate(String(text ?? ''), 2000), at: new Date().toISOString() });
  };

  function waitIfPaused() {
    if (state.status !== 'paused') return Promise.resolve();
    return new Promise((resolve) => {
      resumeResolve = resolve;
    });
  }

  // -- per-session memory ---------------------------------------------------

  function shQuote(s) {
    return `'${String(s).replace(/'/g, `'\\''`)}'`;
  }

  /** Ask the runner to persist a note/finding; falls back to guest-local JSONL. */
  async function persistMemory(kind, record) {
    const payload = { kind, at: new Date().toISOString(), step: state.step, ...record };
    try {
      if (typeof runnerApi.saveMemory === 'function') {
        await runnerApi.saveMemory({ sessionId, kind, record: payload });
      } else {
        // Fallback: append JSONL into the guest's session dir (Kali).
        const safeSession = String(sessionId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
        const line = JSON.stringify(payload);
        const cmd = `mkdir -p "$HOME/.infinity-ai/vm-sessions/${safeSession}" && printf '%s\\n' ${shQuote(line)} >> "$HOME/.infinity-ai/vm-sessions/${safeSession}/memory.jsonl"`;
        await runnerApi.exec({ sessionId, command: cmd, timeoutMs: 15000 });
      }
      emit('memory.saved', { kind });
    } catch (err) {
      // Memory persistence is best-effort — the in-memory transcript survives.
      emit('memory.saved', { kind, failed: true, error: err?.message || String(err) });
    }
  }

  // -- vision ---------------------------------------------------------------

  /** Take a screenshot and have the vision brain describe it. JPEG bytes never leave this function. */
  async function seeScreen(purpose, visionInstruction) {
    emit('screenshot', { purpose: purpose || null });
    const shot = await runnerApi.screenshot({ sessionId, width: 1280 });
    const base64 = shot?.base64;
    if (!base64) throw new Error('runner returned no screenshot bytes');
    const mime = shot.mime || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${base64}`;
    if (!brains?.vision) {
      return '(vision brain unavailable — screenshot captured but not described)';
    }
    const hint = visionInstruction || purpose || '';
    const description = await brains.vision.generate(
      [
        { role: 'system', content: visionSystemPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Describe this screenshot for a security analyst.${hint ? ` Focus: ${hint}` : ''}` },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      { timeoutMs: brainTimeoutMs }
    );
    // dataUrl goes out of scope here — never stored, never logged.
    return String(description || '').trim() || '(vision brain returned no description)';
  }

  // -- grounding ------------------------------------------------------------

  async function resolveClickCoords(action) {
    if (action.x != null && action.y != null) return { x: action.x, y: action.y, source: 'hacker' };
    if (!brains?.grounding) throw new Error('grounding unavailable: connect a Vision or Grounding brain on the Models page so clicks can be resolved');
    const shot = await runnerApi.screenshot({ sessionId, width: 1280 });
    if (!shot?.base64) throw new Error('runner returned no screenshot bytes for grounding');
    const dataUrl = `data:${shot.mime || 'image/jpeg'};base64,${shot.base64}`;
    const located = await brains.grounding.generateStructured(
      [
        { role: 'system', content: `You are the GROUNDING BRAIN of Infinity AI. Given a screenshot and a natural-language description of a UI element, return its center as normalized coordinates in a 0–${GROUNDING_SPACE} space (x: 0 = left edge, 1000 = right edge; y: 0 = top edge, 1000 = bottom edge). Answer with the requested JSON and nothing else.` },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Locate this UI element and return its center coordinates: "${action.element}"` },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, confidence: { type: 'number' } } },
      { timeoutMs: brainTimeoutMs }
    );
    return { x: located.x, y: located.y, source: brains.grounding.source || 'grounding', confidence: located.confidence ?? null };
  }

  // -- action execution -----------------------------------------------------

  function formatExecObservation(res) {
    const head = `exit_code=${res.exit_code}${res.timed_out ? ' (TIMED OUT)' : ''}`;
    const out = truncate(`STDOUT:\n${res.stdout || '(empty)'}\nSTDERR:\n${(res.stderr || '').slice(0, 1500)}`);
    return `${head}\n${out}`;
  }

  async function runShellBg(command, cwd, timeoutMs) {
    const { execId } = await runnerApi.execStart({ sessionId, command, cwd });
    bgExecIds.add(execId);
    const deadline = Date.now() + Math.min(timeoutMs || 120_000, stepTimeoutMs);
    let last = { done: false, stdout: '', stderr: '' };
    try {
      while (Date.now() < deadline) {
        if (state.status === 'stopped') break;
        await waitIfPaused();
        const poll = await runnerApi.execPoll({ sessionId, execId });
        last = { done: !!poll.done, stdout: String(poll.stdout ?? last.stdout), stderr: String(poll.stderr ?? last.stderr), exit_code: poll.exit_code };
        if (poll.done) {
          return { finished: true, observation: formatExecObservation({ exit_code: poll.exit_code ?? -1, stdout: last.stdout, stderr: last.stderr, timed_out: false }) };
        }
        await sleep(POLL_INTERVAL_MS);
      }
    } finally {
      bgExecIds.delete(execId);
      try {
        await runnerApi.execKill({ sessionId, execId });
      } catch {
        /* already finished */
      }
    }
    return {
      finished: false,
      observation: `(background command hit the step time budget and was stopped)\n${formatExecObservation({ exit_code: -1, stdout: last.stdout, stderr: last.stderr, timed_out: true })}`,
    };
  }

  /** Execute one validated action; returns the observation text. */
  async function executeAction(action, hackerOrders) {
    switch (action.type) {
      case 'shell': {
        const res = await runnerApi.exec({
          sessionId,
          command: action.command,
          cwd: action.cwd,
          timeoutMs: action.timeoutMs || 120_000,
        });
        return formatExecObservation(res);
      }
      case 'shellBg': {
        const r = await runShellBg(action.command, action.cwd, action.timeoutMs);
        return r.observation;
      }
      case 'click': {
        const coords = await resolveClickCoords(action);
        await runnerApi.input({ sessionId, action: { type: 'click', x: coords.x, y: coords.y, button: action.button || 'left' } });
        const seen = await seeScreen(`after clicking (${coords.x}, ${coords.y})`, hackerOrders?.visionInstruction);
        return `Clicked at (${coords.x}, ${coords.y}) [${coords.source}]. Screen now shows:\n${seen}`;
      }
      case 'type': {
        if (action.element) {
          const coords = await resolveClickCoords({ element: action.element });
          await runnerApi.input({ sessionId, action: { type: 'click', x: coords.x, y: coords.y, button: 'left' } });
          await sleep(400);
        }
        await runnerApi.input({ sessionId, action: { type: 'type', text: action.text } });
        const seen = await seeScreen('after typing', hackerOrders?.visionInstruction);
        return `Typed ${action.text.length} chars${action.element ? ` into "${action.element}"` : ''}. Screen now shows:\n${seen}`;
      }
      case 'key': {
        await runnerApi.input({ sessionId, action: { type: 'key', key: action.key } });
        const seen = await seeScreen(`after pressing ${action.key}`, hackerOrders?.visionInstruction);
        return `Pressed ${action.key}. Screen now shows:\n${seen}`;
      }
      case 'scroll': {
        await runnerApi.input({ sessionId, action: { type: 'scroll', dy: action.dy } });
        const seen = await seeScreen('after scrolling', hackerOrders?.visionInstruction);
        return `Scrolled by ${action.dy}. Screen now shows:\n${seen}`;
      }
      case 'screenshot': {
        return await seeScreen(action.purpose, hackerOrders?.visionInstruction);
      }
      default:
        throw new Error(`cannot execute action type "${action.type}"`);
    }
  }

  // -- the think step ---------------------------------------------------------

  function buildHackerContext(task, lastObservation) {
    const recent = transcript.slice(-TRANSCRIPT_PROMPT_STEPS).map((e) => `[step ${e.step} ${e.kind}] ${e.text}`).join('\n');
    return [
      `TASK: ${task}`,
      state.scope.length ? `SCOPE: ${state.scope.join(', ')}` : 'SCOPE: (not restricted — stay on the user\'s declared target)',
      `STEP: ${state.step + 1} of ${maxSteps}`,
      findings.length ? `CONFIRMED FINDINGS SO FAR:\n${findings.map((f) => `- [${f.severity}] ${f.title}`).join('\n')}` : 'CONFIRMED FINDINGS SO FAR: none',
      'RECENT HISTORY (latest last):',
      recent || '(no actions yet — this is the first step)',
      'LATEST OBSERVATION:',
      lastObservation || '(none yet)',
    ].join('\n\n');
  }

  async function think(task, lastObservation) {
    if (!brains?.hacker) throw new Error('hacking brain unavailable — connect a hacker brain to start the loop');
    state.brainBusy = true;
    try {
      const raw = await brains.hacker.generate(
        [
          { role: 'system', content: hackerSystemPrompt(state.scope) },
          { role: 'user', content: buildHackerContext(task, lastObservation) },
        ],
        { timeoutMs: brainTimeoutMs }
      );
      const parsed = extractJsonObject(raw);
      if (!parsed) throw new Error(`hacking brain did not return JSON: ${String(raw).slice(0, 300)}`);
      const validation = validateAction(parsed.action);
      if (!validation.ok) throw new Error(`hacking brain emitted an invalid action: ${validation.error}`);
      return {
        thought: String(parsed.thought || '').slice(0, 2000),
        visionInstruction: parsed.visionInstruction ? String(parsed.visionInstruction).slice(0, 500) : '',
        groundingInstruction: parsed.groundingInstruction ? String(parsed.groundingInstruction).slice(0, 500) : '',
        action: validation.action,
        finding: parsed.finding && typeof parsed.finding === 'object' ? parsed.finding : null,
      };
    } finally {
      state.brainBusy = false;
    }
  }

  // -- one loop step ----------------------------------------------------------

  async function runStep(task, lastObservation) {
    const stepNo = state.step + 1;
    emit('step', { step: stepNo, maxSteps });

    // Idle guard: no meaningful progress for too long → finish.
    if (state.lastProgressAt && Date.now() - state.lastProgressAt > idleTimeoutMs) {
      return { finished: true, reason: 'idle-timeout', summary: `No progress for ${Math.round(idleTimeoutMs / 60000)} minutes — loop stopped.` };
    }

    // 1. THINK (hacking brain decides ONE action)
    let decision;
    try {
      decision = await think(task, lastObservation);
    } catch (err) {
      emit('brain.error', { step: stepNo, brain: 'hacker', error: err?.message || String(err) });
      note('event', `Hacking brain error: ${err?.message || err} — retrying step`);
      await sleep(5000);
      decision = await think(task, lastObservation); // one retry, then it throws
    }
    if (decision.thought) {
      emit('thought', { step: stepNo, thought: decision.thought });
      note('thought', decision.thought);
    }
    emit('action', { step: stepNo, action: sanitizeActionForEvent(decision.action) });

    // 2. target-scope gate for shell actions (design §7)
    if ((decision.action.type === 'shell' || decision.action.type === 'shellBg') && state.scope.length) {
      const hosts = extractHosts(decision.action.command);
      const blocked = hosts.filter((h) => !hostInScope(h, state.scope));
      if (blocked.length) {
        const msg = `Blocked: command references out-of-scope host(s): ${blocked.join(', ')}`;
        emit('gate.blocked', { step: stepNo, hosts: blocked, command: decision.action.command.slice(0, 300) });
        note('event', msg);
        return { finished: false, observation: `${msg}. Stay inside the authorized scope: ${state.scope.join(', ')}. Choose a different action.` };
      }
    }

    // 3. record findings the hacker confirmed this step (even on the final "done" step)
    if (decision.finding?.title) {
      const finding = {
        title: String(decision.finding.title).slice(0, 300),
        severity: ['critical', 'high', 'medium', 'low', 'informational'].includes(String(decision.finding.severity).toLowerCase())
          ? String(decision.finding.severity).toLowerCase()
          : 'informational',
        description: String(decision.finding.description || '').slice(0, 2000),
        evidence: String(decision.finding.evidence || '').slice(0, 2000),
        step: stepNo,
        at: new Date().toISOString(),
      };
      findings.push(finding);
      emit('finding', { step: stepNo, finding });
      note('finding', `[${finding.severity}] ${finding.title}`);
      await persistMemory('finding', finding);
    }

    if (decision.action.type === 'done') {
      return { finished: true, reason: 'done', summary: decision.action.summary || 'Task completed.' };
    }

    // 4. ACT + 5. OBSERVE
    const observation = await executeAction(decision.action, decision);
    state.lastProgressAt = Date.now();
    emit('observation', { step: stepNo, observation: truncate(observation, 4000) });
    note('action', describeAction(decision.action));
    note('observation', observation);

    if (stepNo % MEMORY_PERSIST_EVERY_STEPS === 0) {
      await persistMemory('checkpoint', {
        task,
        step: stepNo,
        findings: findings.map((f) => ({ title: f.title, severity: f.severity })),
      });
    }

    return { finished: false, observation };
  }

  function describeAction(a) {
    switch (a.type) {
      case 'shell': return `shell: ${a.command.slice(0, 200)}`;
      case 'shellBg': return `shell (background): ${a.command.slice(0, 200)}`;
      case 'click': return a.element ? `click on "${a.element}"` : `click at (${a.x}, ${a.y})`;
      case 'type': return `type ${a.text.length} chars${a.element ? ` into "${a.element}"` : ''}`;
      case 'key': return `press ${a.key}`;
      case 'scroll': return `scroll ${a.dy}`;
      case 'screenshot': return `screenshot${a.purpose ? ` (${a.purpose})` : ''}`;
      case 'done': return 'done';
      default: return a.type;
    }
  }

  /** Strip anything sensitive from actions before emitting to listeners. */
  function sanitizeActionForEvent(a) {
    if (a.type === 'type') return { ...a, text: `[${a.text.length} chars]` };
    return a;
  }

  /** Run one step with a hard time budget; the budget timer is cancelled when the step wins. */
  function runStepWithTimeout(task, lastObservation, timeoutMs) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(
        () => resolve({ finished: true, reason: 'step-timeout', summary: 'A step exceeded its time budget.' }),
        timeoutMs
      );
    });
    return Promise.race([runStep(task, lastObservation), timeout]).finally(() => clearTimeout(timer));
  }

  // -- public API ---------------------------------------------------------------

  async function start(task, { authorizedTargets = [] } = {}) {
    if (started) throw new Error('loop already started for this session');
    started = true;
    state.task = String(task || '').trim();
    if (!state.task) throw new Error('start() needs a task description');
    state.scope = (authorizedTargets || []).map((t) => String(t).trim()).filter(Boolean);
    state.status = 'running';
    state.startedAt = new Date().toISOString();
    state.lastProgressAt = Date.now();

    emit('started', { task: state.task, scope: state.scope, maxSteps });
    note('event', `Task started: ${state.task}`);
    await persistMemory('session-start', { task: state.task, scope: state.scope });

    let lastObservation = '';
    try {
      while (state.status === 'running' && state.step < maxSteps) {
        await waitIfPaused();
        if (state.status !== 'running') break;
        const outcome = await runStepWithTimeout(state.task, lastObservation, stepTimeoutMs);
        if (outcome.finished) {
          return finish(outcome.reason, outcome.summary);
        }
        lastObservation = outcome.observation;
        state.step += 1;
      }
      if (state.step >= maxSteps) {
        return finish('max-steps', `Reached the ${maxSteps}-step budget. Task paused — resume to continue.`);
      }
      return finish(state.status === 'stopped' ? 'stopped' : 'unknown', 'Loop ended.');
    } catch (err) {
      state.status = 'failed';
      state.finishedAt = new Date().toISOString();
      state.finishReason = err?.message || String(err);
      emit('completed', { status: 'failed', reason: state.finishReason, steps: state.step });
      throw err;
    }
  }

  async function finish(reason, summary) {
    if (state.status === 'completed' || state.status === 'failed') {
      return { status: state.status, reason: state.finishReason, steps: state.step, findings };
    }
    state.status = reason === 'stopped' ? 'stopped' : 'completed';
    state.finishedAt = new Date().toISOString();
    state.finishReason = reason;
    // stop any background commands still polling
    for (const execId of [...bgExecIds]) {
      try {
        await runnerApi.execKill({ sessionId, execId });
      } catch {
        /* best effort */
      }
    }
    bgExecIds.clear();
    await persistMemory('session-end', {
      reason,
      summary,
      steps: state.step,
      findings: findings.map((f) => ({ title: f.title, severity: f.severity })),
    });
    emit('completed', { status: state.status, reason, summary, steps: state.step, findings: findings.length });
    return { status: state.status, reason, summary, steps: state.step, findings };
  }

  function pause() {
    if (state.status !== 'running') return false;
    state.status = 'paused';
    emit('paused', { step: state.step });
    note('event', `Paused at step ${state.step}`);
    return true;
  }

  function resume() {
    if (state.status !== 'paused') return false;
    state.status = 'running';
    state.lastProgressAt = Date.now();
    emit('resumed', { step: state.step });
    note('event', `Resumed at step ${state.step}`);
    if (resumeResolve) {
      resumeResolve();
      resumeResolve = null;
    }
    return true;
  }

  async function stop() {
    if (!['running', 'paused'].includes(state.status)) return false;
    if (resumeResolve) {
      resumeResolve();
      resumeResolve = null;
    }
    await finish('stopped', 'Stopped by the user.');
    emit('stopped', { step: state.step });
    return true;
  }

  /**
   * Mid-session chat: sends the question + a text-only session memory summary
   * to the HACKING brain and returns its answer. Works while running or paused.
   */
  async function ask(question) {
    const q = String(question || '').trim();
    if (!q) throw new Error('ask() needs a question');
    if (!brains?.hacker) throw new Error('hacking brain unavailable');
    const summary = buildSessionSummary();
    state.brainBusy = true;
    try {
      const answer = await brains.hacker.generate(
        [
          {
            role: 'system',
            content: [
              'You are the HACKING BRAIN of Infinity AI, an autonomous bug-bounty agent mid-session inside a Kali Linux VM sandbox.',
              'The user is watching the session and asks you a question. Answer directly and concisely using the session summary below.',
              'You are the sole decision-maker of this session; speak as the agent in charge. Professional English.',
            ].join('\n'),
          },
          { role: 'user', content: `SESSION SUMMARY:\n${summary}\n\nUSER QUESTION: ${q}` },
        ],
        { timeoutMs: brainTimeoutMs }
      );
      const text = String(answer || '').trim();
      emit('ask.answered', { question: q, answer: truncate(text, 2000) });
      note('event', `Q: ${q.slice(0, 200)}\nA: ${text.slice(0, 500)}`);
      return text;
    } finally {
      state.brainBusy = false;
    }
  }

  function buildSessionSummary() {
    const recentObs = transcript
      .filter((e) => e.kind === 'observation')
      .slice(-8)
      .map((e) => `[step ${e.step}] ${e.text.slice(0, 600)}`)
      .join('\n');
    return [
      `Task: ${state.task || '(none)'}`,
      `Status: ${state.status}, step ${state.step}/${maxSteps}`,
      state.scope.length ? `Authorized scope: ${state.scope.join(', ')}` : 'Authorized scope: (none declared)',
      findings.length
        ? `Findings (${findings.length}):\n${findings.map((f) => `- [${f.severity}] ${f.title}: ${f.description.slice(0, 200)}`).join('\n')}`
        : 'Findings: none yet',
      'Recent observations:',
      recentObs || '(none yet)',
    ].join('\n');
  }

  function getState() {
    return {
      status: state.status,
      sessionId,
      task: state.task,
      scope: [...state.scope],
      step: state.step,
      maxSteps,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      finishReason: state.finishReason,
      brainBusy: state.brainBusy,
      findings: findings.length,
    };
  }

  function getTranscript() {
    return transcript.map((e) => ({ ...e }));
  }

  return { start, pause, resume, stop, ask, getState, getTranscript };
}

export default { createVmControlLoop, createBrowserDirectBrains };
