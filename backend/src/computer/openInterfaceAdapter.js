import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTER_ACTIONS, validateComputerAction } from './actionSchema.js';
import { diagnoseComputerSetup, repairComputerSetup } from './setupGuide.js';

/** Actions that require pyautogui on the host (input simulation / capture). */
const PYAUTOGUI_ACTIONS = new Set([
  COMPUTER_ACTIONS.SCREENSHOT,
  COMPUTER_ACTIONS.CLICK,
  COMPUTER_ACTIONS.DOUBLE_CLICK,
  COMPUTER_ACTIONS.MOVE_MOUSE,
  COMPUTER_ACTIONS.TYPE,
  COMPUTER_ACTIONS.PRESS_KEY,
  COMPUTER_ACTIONS.HOTKEY,
  COMPUTER_ACTIONS.SCROLL
]);

/**
 * Actions whose effect is only visible *after* they run — the autonomous
 * loop (issue #1) must re-observe the screen once they settle instead of
 * trusting the action echo.
 */
const MEANINGFUL_ACTIONS = new Set([
  COMPUTER_ACTIONS.CLICK,
  COMPUTER_ACTIONS.DOUBLE_CLICK,
  COMPUTER_ACTIONS.NAVIGATE,
  COMPUTER_ACTIONS.OPEN_APPLICATION,
  COMPUTER_ACTIONS.TYPE,
  COMPUTER_ACTIONS.PRESS_KEY,
  COMPUTER_ACTIONS.HOTKEY,
  COMPUTER_ACTIONS.SCROLL
]);

/**
 * OpenInterfaceAdapter — DARKMATTER's single boundary to the computer layer.
 *
 * Open-Interface (https://github.com/AmberSahdev/Open-Interface) is a Python
 * desktop app (pyautogui + tkinter). Its real, reusable parts are:
 *
 *   app/utils/screen.py       screenshot acquisition (pyautogui.screenshot)
 *   app/interpreter.py        action execution (press/write/hotkey/sleep)
 *   app/resources/context.txt the {"steps":[...],"done":...} action format
 *
 * Its non-reusable parts are:
 *   app/core.py + app/llm.py  a *second* planning loop with its own LLM call,
 *                             including cloud OpenAI/Gemini models.
 *
 * DARKMATTER keeps the first and refuses the second. This adapter therefore:
 *   • owns the process lifecycle of computer/openInterfaceBridge.py,
 *   • speaks a small newline-delimited JSON protocol to it,
 *   • validates every action against the closed whitelist BEFORE sending it,
 *   • never constructs an LLM request and never hands the brain a shell.
 *
 * When no runtime answers, the adapter reports computer_unavailable with a real
 * reason. It never simulates a click, a screenshot, or a browser.
 */

const BRIDGE_PATH = fileURLToPath(new URL('../../computer/openInterfaceBridge.py', import.meta.url));

/** Python interpreters to try, in order, when COMPUTER_PYTHON_BIN is unset. */
const PYTHON_CANDIDATES = ['python3', 'python', 'py'];
/**
 * Interpreter discovery. Overridable so the same adapter can drive a different
 * bridge runtime (the defaults are the real Python bridge).
 */
const PYTHON_PROBE =
  'import platform,sys;print("python-ok",platform.python_version())';

export class OpenInterfaceAdapter {
  constructor({
    config = {},
    state,
    events,
    logger = console,
    bridgePath = null,
    pythonBin = null
  } = {}) {
    this.config = config;
    this.state = state;
    this.events = events;
    this.logger = logger;
    this.bridgePath = bridgePath || config.bridgePath || BRIDGE_PATH;
    this.pythonBinOverride = pythonBin || config.pythonBin || '';
    this.pythonBin = null;
    this.child = null;
    this.pending = new Map();
    this.buffer = '';
    this.capabilities = null;
    this.capabilitiesCheckedAt = null;
    this.lastNavigationUrl = null;
    this.visionCapable = false;
    this.inputSimulation = null;
    this.lastError = null;
    this.starting = null;
    this.onceReady = null;
    this.enabled = config.enabled !== false;
  }

  // ── Runtime discovery ─────────────────────────────────────────────────
  /** Find a working Python interpreter. Returns {bin, version} or null. */
  get verifyArgs() {
    return this.config.verifyArgs || ['-c', PYTHON_PROBE];
  }

  get spawnArgs() {
    // `-u` keeps the Python bridge's stdout unbuffered. Other runtimes just
    // pass an empty list.
    return this.config.spawnArgs || ['-u'];
  }

  /**
   * A project-local virtualenv next to the bridge is preferred: it keeps
   * pyautogui out of the system Python and is exactly where `python -m venv
   * backend/computer/.venv` puts it.
   */
  localVenvPython() {
    const dir = path.dirname(this.bridgePath);
    const candidates = process.platform === 'win32'
      ? [path.join(dir, '.venv', 'Scripts', 'python.exe')]
      : [path.join(dir, '.venv', 'bin', 'python3'), path.join(dir, '.venv', 'bin', 'python')];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  discoverPython() {
    const venv = this.localVenvPython();
    const candidates = this.pythonBinOverride
      ? [this.pythonBinOverride]
      : [...(venv ? [venv] : []), ...PYTHON_CANDIDATES];
    const tried = [];
    for (const bin of candidates) {
      try {
        const result = spawnSync(bin, this.verifyArgs, {
          encoding: 'utf8',
          timeout: 10_000,
          windowsHide: true
        });
        if (result.status === 0 && /python-ok/.test(result.stdout || '')) {
          const version = (result.stdout.match(/python-ok\s+(\S+)/) || [, 'unknown'])[1];
          return { bin, version, tried };
        }
        tried.push({ bin, status: result.status, error: (result.stderr || '').slice(0, 200) });
      } catch (error) {
        tried.push({ bin, error: error.message });
      }
    }
    return { bin: null, version: null, tried };
  }

  /**
   * Capability probe — a short-lived process (`--probe`), not the daemon, so a
   * status endpoint can be called often without side effects.
   * @returns {{available: boolean, capabilities: object|null, reason: string|null, python: object}}
   */
  probe() {
    if (!fs.existsSync(this.bridgePath)) {
      const reason = `computer bridge not found at ${this.bridgePath}`;
      this.lastError = reason;
      return { available: false, capabilities: null, reason, python: { bin: null, tried: [] } };
    }

    const python = this.discoverPython();
    if (!python.bin) {
      const reason = 'no working Python interpreter found (tried: python3, python, py)';
      this.lastError = reason;
      this.state.setCapabilities(null, { available: false, reason });
      return { available: false, capabilities: null, reason, python };
    }

    const result = spawnSync(python.bin, [this.bridgePath, '--probe'], {
      encoding: 'utf8',
      timeout: this.config.probeTimeoutMs || 20_000,
      windowsHide: true
    });

    if (result.error) {
      const reason = `probe failed to run: ${result.error.message}`;
      this.lastError = reason;
      this.state.setCapabilities(null, { available: false, reason });
      return { available: false, capabilities: null, reason, python };
    }

    const line = String(result.stdout || '').trim().split('\n').filter(Boolean).pop();
    let payload = null;
    try {
      payload = JSON.parse(line);
    } catch {
      const reason = `probe returned unparsable output: ${String(result.stdout || result.stderr || '').slice(0, 200)}`;
      this.lastError = reason;
      this.state.setCapabilities(null, { available: false, reason });
      return { available: false, capabilities: null, reason, python };
    }

    const capabilities = payload.result || null;
    this.capabilities = capabilities;
    this.capabilitiesCheckedAt = new Date().toISOString();

    // The bridge process is reachable (so observation/navigation still work),
    // but pyautogui may be missing — in which case input simulation is honestly
    // reported as degraded rather than silently simulated.
    const reachable = Boolean(capabilities);
    this.inputSimulation = Boolean(capabilities?.pyautoguiAvailable);
    const available = reachable;
    const reason = reachable
      ? null
      : capabilities?.pyautoguiError || 'computer bridge produced no capabilities';

    this.visionCapable = false; // text-only local model: screenshots are evidence, not brain input
    this.state.setCapabilities(capabilities, { available, reason });
    this.lastError = available ? null : reason;

    return { available, capabilities, reason, python, inputSimulation: this.inputSimulation };
  }

  /** True when the bridge process is alive. */
  get running() {
    return Boolean(this.child && this.child.exitCode === null && !this.child.killed);
  }

  get available() {
    return this.state.isAvailable() && this.running;
  }

  /** Lazily start the long-lived bridge daemon. */
  async ensureStarted() {
    if (this.running) return true;
    if (this.starting) return this.starting;
    this.starting = this.#start().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async #start() {
    if (!this.enabled) {
      this.state.markDisconnected('computer control is disabled (COMPUTER_CONTROL_ENABLED=false)');
      return false;
    }
    const probe = this.probe();
    if (!probe.available) return false;

    const pythonBin = probe.python.bin;
    this.pythonBin = pythonBin;

    const child = spawn(pythonBin, [...this.spawnArgs, this.bridgePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env }
    });
    this.child = child;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this.#onStdout(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      const text = String(chunk).trim();
      if (text) this.logger.warn?.(`[computer-bridge] ${text.slice(0, 400)}`);
    });
    child.on('exit', (code, signal) => {
      this.#failPending(new Error(`computer bridge exited (code=${code} signal=${signal})`));
      this.child = null;
      if (this.state.isAvailable()) {
        this.state.markDisconnected(`computer bridge exited (code=${code})`);
      }
    });
    child.on('error', (error) => {
      this.lastError = error.message;
      this.#failPending(error);
      this.state.markDisconnected(`computer bridge error: ${error.message}`);
    });

    // The bridge announces readiness itself; wait for that line.
    const ready = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), this.config.probeTimeoutMs || 20_000);
      this.onceReady = (payload) => {
        clearTimeout(timer);
        this.capabilities = payload.result || this.capabilities;
        resolve(true);
      };
    });

    if (!ready) {
      this.state.markDisconnected('computer bridge did not announce readiness');
      this.stop();
      return false;
    }

    await this.events?.publish?.(null, {
      type: 'probe',
      message: `Computer runtime connected (${this.capabilities?.platform} / Python ${this.capabilities?.pythonVersion})`,
      data: { capabilities: this.capabilities }
    });
    this.state.markReady({ platform: this.capabilities?.platform });
    return true;
  }

  // ── Protocol plumbing ─────────────────────────────────────────────────
  #onStdout(chunk) {
    this.buffer += chunk;
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.logger.warn?.(`[computer-bridge] unparsable line: ${line.slice(0, 200)}`);
        continue;
      }
      if (message.type === 'ready') {
        this.capabilities = message.result || this.capabilities;
        if (typeof this.onceReady === 'function') {
          const cb = this.onceReady;
          this.onceReady = null;
          cb(message);
        }
        continue;
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timer);
        if (message.ok) resolve(message);
        else reject(Object.assign(new Error(message.error?.message || 'bridge error'), { kind: message.error?.kind }));
      }
    }
  }

  #failPending(error) {
    for (const [, { reject, timer }] of this.pending) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  /** Send one request over the bridge and await its reply. */
  send(cmd, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.running) {
        reject(Object.assign(new Error('computer bridge is not running'), { kind: 'unavailable' }));
        return;
      }
      const id = crypto.randomUUID();
      const timeoutMs = this.config.actionTimeoutMs || 60_000;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error(`computer action '${cmd}' timed out after ${timeoutMs}ms`), { kind: 'timeout' }));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child.stdin.write(`${JSON.stringify({ id, cmd, params })}\n`);
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  // ── Public capability surface (generic DARKMATTER vocabulary) ─────────
  async getScreen(channel = null) {
    return this.execute({ type: COMPUTER_ACTIONS.SCREENSHOT, reason: 'capture current screen state' }, { channel });
  }

  async getActiveWindow(channel = null) {
    return this.execute({ type: COMPUTER_ACTIONS.GET_ACTIVE_WINDOW, reason: 'identify active application/window' }, { channel });
  }

  async getBrowserState(channel = null) {
    return this.execute({
      type: COMPUTER_ACTIONS.GET_BROWSER_STATE,
      params: { lastUrl: this.lastNavigationUrl },
      reason: 'read browser state'
    }, { channel });
  }

  async click(x, y, { channel = null, reason = 'click at coordinates' } = {}) {
    return this.execute({ type: COMPUTER_ACTIONS.CLICK, params: { x, y }, reason }, { channel });
  }

  async type(text, { channel = null, reason = 'type text' } = {}) {
    return this.execute({ type: COMPUTER_ACTIONS.TYPE, params: { text }, reason }, { channel });
  }

  async pressKey(keys, { channel = null, presses = 1, reason = 'press key' } = {}) {
    return this.execute({ type: COMPUTER_ACTIONS.PRESS_KEY, params: { keys, presses }, reason }, { channel });
  }

  async moveMouse(x, y, { channel = null, reason = 'move mouse' } = {}) {
    return this.execute({ type: COMPUTER_ACTIONS.MOVE_MOUSE, params: { x, y }, reason }, { channel });
  }

  async scroll(amount, { channel = null, reason = 'scroll' } = {}) {
    return this.execute({ type: COMPUTER_ACTIONS.SCROLL, params: { amount }, reason }, { channel });
  }

  async openApplication(name, { channel = null, reason = 'open application' } = {}) {
    return this.execute({ type: COMPUTER_ACTIONS.OPEN_APPLICATION, params: { name }, reason }, { channel });
  }

  async navigate(url, { channel = null, reason = 'navigate to url', scopeEngine = null } = {}) {
    const result = await this.execute(
      { type: COMPUTER_ACTIONS.NAVIGATE, params: { url }, reason, expectedOutcome: 'target page loads' },
      { channel, scopeEngine }
    );
    if (result.ok) this.lastNavigationUrl = url;
    return result;
  }

  /**
   * Execute a validated computer action.
   *
   * @param {object} [opts.markAsObservation] treat failures as observation
   *   failures (OBSERVATION_FAILED) rather than action failures — used by the
   *   post-action re-observe pass.
   * @returns {{ok: boolean, action: object|null, output: object|null, observation: object|null,
   *            error: {message: string, kind: string}|null, durationMs: number, rejected: boolean}}
   */
  async execute(action, { channel = null, scopeEngine = null, approvalGranted = true, markAsObservation = false } = {}) {
    const started = Date.now();

    // 1. Whitelist + parameter + scope validation (never bypassed).
    const validation = validateComputerAction(action, { scopeEngine });
    if (!validation.valid) {
      await this.events?.publish?.(channel, {
        type: 'action',
        level: 'WARN',
        message: `Computer action rejected: ${validation.errors.join('; ')}`,
        data: { action, errors: validation.errors }
      });
      return {
        ok: false,
        action: null,
        output: null,
        observation: null,
        error: { message: validation.errors.join('; '), kind: 'rejected' },
        durationMs: Date.now() - started,
        rejected: true
      };
    }

    if (this.config.requireApproval && approvalGranted !== true) {
      this.state.markPermissionRequired(validation.action);
      await this.events?.publish?.(channel, {
        type: 'permission',
        level: 'WARN',
        message: `Computer action needs explicit approval: ${validation.action.type}`,
        data: { action: validation.action }
      });
      return {
        ok: false,
        action: validation.action,
        output: null,
        observation: null,
        error: { message: 'computer action requires explicit approval', kind: 'awaiting_approval' },
        durationMs: Date.now() - started,
        rejected: true
      };
    }

    // 2. Runtime availability — report honestly, do not simulate.
    const startedOk = await this.ensureStarted();
    if (!startedOk) {
      // Prefer the concrete probe failure (e.g. "bridge not found at …") over
      // the generic state reason so diagnostics name the real layer (#44).
      const reason = this.lastError || this.state.unavailableReason || 'computer runtime unavailable';
      return {
        ok: false,
        action: validation.action,
        output: null,
        observation: null,
        error: { message: reason, kind: 'unavailable' },
        durationMs: Date.now() - started,
        rejected: false
      };
    }

    // 2b. Precise degradation: an action that needs pyautogui must say so now.
    if (PYAUTOGUI_ACTIONS.has(validation.action.type) && this.inputSimulation === false) {
      const detail = this.capabilities?.pyautoguiError || 'pyautogui is not installed on this host';
      const message = `computer input simulation unavailable — ${detail}`;
      await this.events?.publish?.(channel, {
        type: 'error',
        level: 'WARN',
        message: `Computer action unavailable: ${message}`,
        data: { action: validation.action, kind: 'unavailable' }
      });
      return {
        ok: false,
        action: validation.action,
        output: null,
        observation: null,
        error: { message, kind: 'unavailable' },
        durationMs: Date.now() - started,
        rejected: false
      };
    }

    // 3. Run it.
    const approved = validation.action;
    this.state.markActionStarted(approved);
    await this.events?.publish?.(channel, {
      type: 'action',
      level: 'INFO',
      message: `Computer action: ${approved.type}${approved.params?.url ? ` → ${approved.params.url}` : ''}`,
      data: { action: approved, reason: approved.reason || null }
    });

    try {
      const reply = await this.send(approved.type, approved.params);
      const output = reply.output || {};
      const observation = this.describeObservation(approved, output);
      this.state.markActionFinished(approved, { ok: true, observation });

      await this.events?.publish?.(channel, {
        type: 'observation',
        level: 'INFO',
        message: observation.summary,
        data: observation
      });

      return {
        ok: true,
        action: approved,
        output,
        observation,
        error: null,
        durationMs: Date.now() - started,
        rejected: false
      };
    } catch (error) {
      const kind = error.kind || 'error';
      // A transport-level failure while the daemon is gone is a disconnect,
      // not a failed action — the worker must wait, not replan.
      if ((kind === 'unavailable' || kind === 'timeout') && this.running !== true) {
        this.state.markDisconnected(`computer runtime unreachable during ${approved.type}: ${error.message}`);
      } else if (markAsObservation) {
        this.state.markObservationFailed(error.message);
      } else {
        this.state.markActionFinished(approved, { ok: false, error: error.message });
      }
      await this.events?.publish?.(channel, {
        type: 'error',
        level: 'ERROR',
        message: `Computer action failed: ${error.message}`,
        data: { action: approved, kind }
      });
      return {
        ok: false,
        action: approved,
        output: null,
        observation: null,
        error: { message: error.message, kind },
        durationMs: Date.now() - started,
        rejected: false
      };
    }
  }

  /**
   * The "observe" half of observe → decide → act → observe (issue #1).
   *
   * After a *meaningful* action (a click, a navigation, an app launch…), the
   * screen needs a moment to settle and the brain needs to see what actually
   * changed — the action echo alone is not an observation. This waits for the
   * UI to settle, then captures the active window as a follow-up observation.
   *
   * @returns {object|null} the follow-up observation, or null when there is
   *   nothing meaningful to re-observe or the capture failed.
   */
  async observeAfterAction(action, { channel = null } = {}) {
    if (!action || !MEANINGFUL_ACTIONS.has(action.type)) return null;
    this.state.markObserving({ after: action.type });
    const settleMs = Number(this.config.observeSettleMs || 800);
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    try {
      const result = await this.execute(
        { type: COMPUTER_ACTIONS.GET_ACTIVE_WINDOW, reason: `re-observe after ${action.type}` },
        { channel, markAsObservation: true }
      );
      if (result.ok && result.observation) {
        // execute() already moved the state machine to OBSERVATION_READY via
        // markActionFinished; just announce the follow-up observation.
        await this.events?.publish?.(channel, {
          type: 'observation',
          level: 'INFO',
          message: `Post-action observation: ${result.observation.summary}`,
          data: { ...result.observation, followUp: true, afterAction: action.type }
        });
        return result.observation;
      }
      return null;
    } catch (error) {
      this.state.markObservationFailed(error.message);
      return null;
    }
  }

  /** Setup diagnostics for the dashboard / setup endpoint (issue #1). */
  diagnose() {
    return diagnoseComputerSetup(this);
  }

  /**
   * Run one explicitly-authorized safe repair (see setupGuide.js). Without
   * `userAuthorized: true` this only returns instructions — it never acts.
   */
  repair({ repair, userAuthorized = false } = {}) {
    return repairComputerSetup(this, { repair, userAuthorized });
  }

  /**
   * Turn a raw bridge result into a *textual* observation the local brain can
   * actually reason over.
   *
   * This is deliberately honest: the phone-hosted Gemma configured for
   * DARKMATTER is text-only, so a screenshot is captured, hashed and stored as
   * an evidence artifact — it is NOT described as if the model had "seen" it.
   * Structured state (active window title, navigation, action echo) is what the
   * brain receives.
   */
  describeObservation(action, output) {
    const base = {
      actionType: action.type,
      at: new Date().toISOString(),
      raw: output,
      visionUsed: false
    };

    switch (action.type) {
      case COMPUTER_ACTIONS.SCREENSHOT:
        return {
          ...base,
          kind: 'screenshot',
          summary: `Screenshot captured (${output.width}x${output.height}, ${output.bytes} bytes, sha256 ${String(output.sha256 || '').slice(0, 12)})`,
          width: output.width,
          height: output.height,
          bytes: output.bytes,
          sha256: output.sha256,
          path: output.path
        };
      case COMPUTER_ACTIONS.GET_ACTIVE_WINDOW:
        return {
          ...base,
          kind: 'active_window',
          summary: output.title
            ? `Active window: ${output.title}`
            : `Active window unavailable${output.reason ? ` (${output.reason})` : ''}`,
          title: output.title || null,
          supported: Boolean(output.supported)
        };
      case COMPUTER_ACTIONS.GET_BROWSER_STATE:
        return {
          ...base,
          kind: 'browser_state',
          summary: output.activeWindowTitle
            ? `Browser state: title "${output.activeWindowTitle}"${output.rememberedUrl ? `, last navigated URL ${output.rememberedUrl}` : ''}`
            : 'Browser state unavailable',
          browser: output
        };
      case COMPUTER_ACTIONS.NAVIGATE:
        return {
          ...base,
          kind: 'navigation',
          summary: `Navigated to ${output.navigatedTo || action.params.url}`,
          url: output.navigatedTo || action.params.url
        };
      case COMPUTER_ACTIONS.OPEN_APPLICATION:
        return {
          ...base,
          kind: 'application_launch',
          summary: `Launched application: ${output.launched || action.params.name}`,
          application: output.launched || action.params.name
        };
      case COMPUTER_ACTIONS.SLEEP:
        return { ...base, kind: 'wait', summary: `Waited ${output.slept}s`, seconds: output.slept };
      case COMPUTER_ACTIONS.TYPE:
        return {
          ...base,
          kind: 'input',
          // Never echo typed secrets into the persisted observation.
          summary: `Typed ${output.typed} character(s)`
        };
      default:
        return { ...base, kind: 'action_result', summary: `Computer action ${action.type} completed` };
    }
  }

  /** Status snapshot for the dashboard and for job state persistence. */
  status() {
    return {
      ...this.state.snapshot(),
      bridgePath: this.bridgePath,
      pythonBin: this.pythonBin,
      processRunning: this.running,
      capabilitiesCheckedAt: this.capabilitiesCheckedAt,
      capabilities: this.capabilities,
      visionCapable: this.visionCapable,
      inputSimulation: Boolean(this.inputSimulation),
      degradedActions: this.inputSimulation === false
        ? (this.capabilities?.pyautoguiActions || [...PYAUTOGUI_ACTIONS])
        : [],
      lastNavigationUrl: this.lastNavigationUrl,
      lastError: this.lastError,
      pendingActions: this.pending.size
    };
  }

  /** Stop the bridge daemon without leaving zombies. */
  stop() {
    if (this.child) {
      try {
        this.child.stdin.write(`${JSON.stringify({ cmd: '__shutdown__' })}\n`);
      } catch {
        /* pipe may already be closed */
      }
      const child = this.child;
      setTimeout(() => {
        if (child.exitCode === null) child.kill();
      }, 1500).unref?.();
      this.child = null;
    }
    this.#failPending(new Error('computer bridge stopped'));
    if (this.state && typeof this.state.markDisconnected === 'function') {
      this.state.markDisconnected('computer bridge stopped');
    }
  }

  /** Absolute path of the bridge (used by diagnostics + tests). */
  static get defaultBridgePath() {
    return BRIDGE_PATH;
  }

  static get bridgeDirectory() {
    return path.dirname(BRIDGE_PATH);
  }
}

export { BRIDGE_PATH };
