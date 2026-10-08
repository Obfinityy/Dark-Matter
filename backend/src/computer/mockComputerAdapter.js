/**
 * MockComputerAdapter — a faithful stand-in for the OpenInterfaceAdapter.
 *
 * It implements the same execute()/status()/stop() surface, but instead of
 * driving a real desktop it LOGS every validated action and returns plausible
 * observations (active window changes after open_application, typed text is
 * recorded, screenshots report dimensions).
 *
 * Purpose: prove the full Infinity Control pipeline end-to-end —
 *   NL instruction → plan decomposition → schema validation → execution —
 * in environments without a GUI (CI, headless servers, this sandbox).
 * On a real user machine the production adapter (openInterfaceAdapter.js)
 * drives the actual desktop; this mock must NEVER be used for real control.
 *
 * Validation is NOT skipped: every action passes through validateComputerAction
 * exactly like the production adapter, so a rejected action fails here too.
 */

import { COMPUTER_ACTIONS, validateComputerAction } from './actionSchema.js';

const FRIENDLY_APP_TITLES = {
  winword: 'Document1 - Microsoft Word',
  write: 'Document - WordPad',
  notepad: 'Untitled - Notepad',
  msedge: 'New Tab - Microsoft Edge',
  chrome: 'New Tab - Google Chrome',
  firefox: 'New Tab - Mozilla Firefox',
  calc: 'Calculator',
  mspaint: 'Untitled - Paint',
  explorer: 'File Explorer',
};

export class MockComputerAdapter {
  constructor({ logger = console, screen = { width: 1920, height: 1080 } } = {}) {
    this.logger = logger;
    this.screen = screen;
    /** Every action handed to execute(), in order — the proof log. */
    this.actionLog = [];
    this.activeWindow = 'Program Manager';
    this.typedDocuments = [];
    this.clipboard = '';
    this.startedAt = new Date().toISOString();
    this.isMock = true;
  }

  /** Same result shape as OpenInterfaceAdapter.execute(). */
  async execute(action, { channel = null, scopeEngine = null } = {}) {
    const started = Date.now();

    const validation = validateComputerAction(action, { scopeEngine });
    if (!validation.valid) {
      const error = { message: validation.errors.join('; '), kind: 'rejected' };
      this.actionLog.push({
        at: new Date().toISOString(),
        requested: action || null,
        ok: false,
        error: error.message,
        rejected: true,
      });
      return {
        ok: false,
        action: null,
        output: null,
        observation: null,
        error,
        durationMs: Date.now() - started,
        rejected: true,
      };
    }

    const approved = validation.action;
    const output = this.#simulate(approved);
    const observation = this.#describe(approved, output);

    const entry = {
      at: new Date().toISOString(),
      action: approved,
      ok: true,
      observation: observation.summary,
      durationMs: Date.now() - started,
    };
    this.actionLog.push(entry);

    return {
      ok: true,
      action: approved,
      output,
      observation,
      error: null,
      durationMs: Date.now() - started,
      rejected: false,
      simulated: true,
    };
  }

  /** Deterministic, side-effect-free simulation of each whitelisted action. */
  #simulate(action) {
    switch (action.type) {
      case COMPUTER_ACTIONS.OPEN_APPLICATION: {
        const name = String(action.params.name || '')
          .toLowerCase()
          .trim();
        const launched = action.params.name;
        this.activeWindow = FRIENDLY_APP_TITLES[name] || `${launched} - Window`;
        return { launched, activeWindow: this.activeWindow };
      }
      case COMPUTER_ACTIONS.GET_ACTIVE_WINDOW:
        return { title: this.activeWindow, supported: true };
      case COMPUTER_ACTIONS.SCREENSHOT:
        return {
          width: this.screen.width,
          height: this.screen.height,
          bytes: this.screen.width * this.screen.height,
          sha256: 'mock-' + '0'.repeat(59),
          path: null,
        };
      case COMPUTER_ACTIONS.TYPE: {
        const text = action.params.text ?? '';
        this.typedDocuments.push({ text, into: this.activeWindow, at: new Date().toISOString() });
        return { typed: text.length };
      }
      case COMPUTER_ACTIONS.CLICK:
      case COMPUTER_ACTIONS.DOUBLE_CLICK:
        return { x: action.params.x, y: action.params.y };
      case COMPUTER_ACTIONS.MOVE_MOUSE:
        return {
          x: action.params.x ?? null,
          y: action.params.y ?? null,
          to: action.params.to ?? null,
        };
      case COMPUTER_ACTIONS.PRESS_KEY:
        return { keys: action.params.keys, presses: action.params.presses || 1 };
      case COMPUTER_ACTIONS.HOTKEY:
        return { keys: action.params.keys };
      case COMPUTER_ACTIONS.SCROLL:
        return { amount: action.params.amount };
      case COMPUTER_ACTIONS.SLEEP:
        return { slept: action.params.seconds };
      case COMPUTER_ACTIONS.NAVIGATE:
        this.activeWindow = `Mock Browser - ${action.params.url}`;
        return { navigatedTo: action.params.url };
      case COMPUTER_ACTIONS.GET_BROWSER_STATE:
        return { activeWindowTitle: this.activeWindow, rememberedUrl: null };
      case COMPUTER_ACTIONS.CLIPBOARD_SET: {
        this.clipboard = action.params.text ?? '';
        return { clipboardChars: this.clipboard.length };
      }
      default:
        return {};
    }
  }

  #describe(action, output) {
    const base = {
      actionType: action.type,
      at: new Date().toISOString(),
      raw: output,
      visionUsed: false,
      simulated: true,
    };
    switch (action.type) {
      case COMPUTER_ACTIONS.OPEN_APPLICATION:
        return {
          ...base,
          kind: 'application_launch',
          summary: `Launched application: ${output.launched} (active window: "${output.activeWindow}")`,
          application: output.launched,
        };
      case COMPUTER_ACTIONS.GET_ACTIVE_WINDOW:
        return {
          ...base,
          kind: 'active_window',
          summary: `Active window: ${output.title}`,
          title: output.title,
          supported: true,
        };
      case COMPUTER_ACTIONS.SCREENSHOT:
        return {
          ...base,
          kind: 'screenshot',
          summary: `Screenshot captured (${output.width}x${output.height}) — simulated`,
          width: output.width,
          height: output.height,
        };
      case COMPUTER_ACTIONS.TYPE:
        return {
          ...base,
          kind: 'input',
          summary: `Typed ${output.typed} character(s) into "${this.activeWindow}" — simulated`,
        };
      case COMPUTER_ACTIONS.SLEEP:
        return {
          ...base,
          kind: 'wait',
          summary: `Waited ${output.slept}s (simulated, no actual delay)`,
          seconds: output.slept,
        };
      case COMPUTER_ACTIONS.NAVIGATE:
        return {
          ...base,
          kind: 'navigation',
          summary: `Navigated to ${output.navigatedTo} — simulated`,
          url: output.navigatedTo,
        };
      case COMPUTER_ACTIONS.CLIPBOARD_SET:
        return {
          ...base,
          kind: 'clipboard',
          summary: `Clipboard set (${output.clipboardChars} chars) — simulated`,
        };
      default:
        return {
          ...base,
          kind: 'action_result',
          summary: `Computer action ${action.type} completed — simulated`,
        };
    }
  }

  /** The full typed text across the session (useful for assertions). */
  get typedText() {
    return this.typedDocuments.map(d => d.text).join('\n');
  }

  status() {
    return {
      available: true,
      simulated: true,
      activeWindow: this.activeWindow,
      actionsExecuted: this.actionLog.length,
      screen: this.screen,
      startedAt: this.startedAt,
    };
  }

  reset() {
    this.actionLog = [];
    this.typedDocuments = [];
    this.clipboard = '';
    this.activeWindow = 'Program Manager';
  }

  stop() {
    /* nothing to tear down — no child process */
  }
}
