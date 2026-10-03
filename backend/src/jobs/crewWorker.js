/**
 * CrewWorker — the per-crew think → act → observe loop for Infinity Crew.
 *
 * Each crew member runs an autonomous agent loop driven by the configured
 * AI brain (local model or remote link from the Models page). A run is
 * abortable via its AbortController; events stream to subscribers.
 *
 * No rate limiting, quotas or usage caps are applied here.
 *
 * @module jobs/crewWorker
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { validateComputerAction, ACTION_TYPES } from '../computer/actionSchema.js';

const execAsync = promisify(exec);

const MAX_ITERATIONS = 25;
const MAX_HISTORY_ENTRIES = 20;
const SHELL_TIMEOUT_MS = 30_000;
const OBSERVATION_LIMIT = 2000;

export const CREW_EVENT_TYPES = Object.freeze([
  'thinking',
  'action',
  'observation',
  'reply',
  'waiting',
  'done',
  'error',
  'stopped'
]);

/**
 * @typedef {object} CrewEvent
 * @property {'thinking'|'action'|'observation'|'reply'|'waiting'|'done'|'error'|'stopped'} type
 * @property {string} message
 * @property {any} [data]
 * @property {string} at  ISO timestamp
 */

/**
 * @typedef {object} CrewWorkerDeps
 * @property {import('../services/crewService.js').CrewService} crewService
 * @property {(userId: string) => Promise<any>} providerFor  Async factory: returns a brain
 *   provider with `.generate(messages, opts)`, or null when no brain is configured.
 * @property {any} [computerAdapter]  Adapter with `.execute({type, params, reason}, opts)`.
 * @property {{ info?: Function, warn?: Function, error?: Function }} [logger]
 */

export class CrewWorker {
  /**
   * @param {CrewWorkerDeps} deps
   */
  constructor({ crewService, providerFor, computerAdapter, logger } = {}) {
    if (!crewService) throw new Error('CrewWorker requires a crewService.');
    if (typeof providerFor !== 'function') throw new Error('CrewWorker requires a providerFor function.');
    this.crewService = crewService;
    this.providerFor = providerFor;
    this.computerAdapter = computerAdapter || null;
    this.logger = logger || console;
    /** @type {Map<string, object>} runId -> run state */
    this.runs = new Map();
  }

  // ------------------------------------------------------------------ public

  /**
   * Start a run for a crew member. The loop runs in the background;
   * subscribe to events to follow it.
   * @param {{ crewId: string, userId: string, message: string }} input
   * @returns {Promise<{ runId: string, status: string }>}
   * @throws {Error} With message 'Crew not found' when the crew member does not exist.
   */
  async startRun({ crewId, userId, message }) {
    const crew = await this.crewService.get(crewId);
    if (!crew) {
      const err = new Error('Crew not found');
      err.status = 404;
      throw err;
    }

    const runId = `run_${crypto.randomBytes(8).toString('hex')}`;
    const controller = new AbortController();
    const run = {
      runId,
      crewId: crew.id,
      userId,
      status: 'running',
      controller,
      events: [],
      listeners: new Set(),
      history: []
    };
    this.runs.set(runId, run);

    await this.crewService.setStatus(crew.id, 'running');

    // Fire-and-forget: the loop manages its own lifecycle.
    this._loop(run, crew, String(message ?? '')).catch((err) => {
      this.logger.error?.(`[crewWorker] run ${runId} loop threw:`, err);
    });

    return { runId, status: 'running' };
  }

  /**
   * @param {string} runId
   * @returns {boolean} True if the run existed and was aborted.
   */
  stopRun(runId) {
    const run = this.runs.get(runId);
    if (!run) return false;
    if (run.status === 'done' || run.status === 'stopped' || run.status === 'failed') return false;
    run.controller.abort();
    return true;
  }

  /**
   * @param {string} runId
   * @param {(event: CrewEvent) => void} cb
   * @returns {() => void} Unsubscribe function.
   */
  subscribe(runId, cb) {
    const run = this.runs.get(runId);
    if (!run) return () => {};
    run.listeners.add(cb);
    return () => run.listeners.delete(cb);
  }

  /**
   * @param {string} runId
   * @returns {CrewEvent[]} All events emitted so far (empty array for unknown runs).
   */
  getEvents(runId) {
    const run = this.runs.get(runId);
    return run ? [...run.events] : [];
  }

  /**
   * @param {string} runId
   * @returns {{ runId: string, crewId: string, status: string } | null}
   */
  getRun(runId) {
    const run = this.runs.get(runId);
    if (!run) return null;
    return { runId: run.runId, crewId: run.crewId, status: run.status };
  }

  // ------------------------------------------------------------------ loop

  /**
   * The think → act → observe loop.
   * @private
   */
  async _loop(run, crew, userMessage) {
    const { controller } = run;
    const finish = async (status, finalEvent) => {
      run.status = status;
      if (finalEvent) this._emit(run, finalEvent.type, finalEvent.message, finalEvent.data);
      try {
        await this.crewService.setStatus(run.crewId, 'idle');
      } catch (err) {
        this.logger.warn?.(`[crewWorker] could not reset crew status: ${err.message}`);
      }
    };

    try {
      this._emit(run, 'thinking', `${crew.name} is thinking…`);

      // 1. Resolve the brain provider (async factory).
      let provider = null;
      try {
        provider = await this.providerFor(run.userId);
      } catch (err) {
        this.logger.warn?.(`[crewWorker] providerFor failed: ${err.message}`);
        provider = null;
      }

      if (!provider) {
        run.status = 'waiting';
        try {
          await this.crewService.setStatus(run.crewId, 'waiting_brain');
        } catch { /* best effort */ }
        this._emit(
          run,
          'waiting',
          `No brain configured yet — connect a model on the Models page or paste a Kaggle link. ${crew.name} is waiting and will start on your next message.`
        );
        return;
      }

      // 2. Build the system prompt and initial conversation.
      const system = this._buildSystemPrompt(crew);
      const messages = [
        { role: 'system', content: system },
        ...run.history,
        { role: 'user', content: userMessage }
      ];

      // 3. Iterate: think → act → observe.
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        controller.signal.throwIfAborted();

        this._emit(run, 'thinking', `${crew.name} is thinking… (step ${i + 1})`);

        const text = await provider.generate(messages, { maxTokens: 2000 });
        controller.signal.throwIfAborted();

        const parsed = this._parseBrainResponse(String(text ?? ''));

        if (!parsed.action) {
          // No action → reply and finish.
          const reply = parsed.reply || String(text ?? '');
          run.history.push({ role: 'assistant', content: reply });
          await finish('done', { type: 'reply', message: reply });
          return;
        }

        // 4. Execute the action.
        this._emit(run, 'action', `${crew.name} is using ${parsed.action.tool}…`, {
          action: parsed.action,
          thought: parsed.thought
        });

        const observation = await this._executeAction(run, crew, parsed.action, parsed.thought);
        controller.signal.throwIfAborted();

        this._emit(run, 'observation', 'Observation received.', { observation });

        messages.push({ role: 'assistant', content: JSON.stringify(parsed) });
        messages.push({ role: 'user', content: `[Observation]\n${observation}` });
        run.history.push({ role: 'assistant', content: JSON.stringify(parsed) });
        run.history.push({ role: 'user', content: `[Observation]\n${observation}` });
        if (run.history.length > MAX_HISTORY_ENTRIES) {
          run.history.splice(0, run.history.length - MAX_HISTORY_ENTRIES);
        }
        // Keep the message window bounded as well.
        while (messages.length > MAX_HISTORY_ENTRIES + 2) {
          messages.splice(1, 2);
        }
      }

      await finish('done', {
        type: 'done',
        message: `${crew.name} finished after ${MAX_ITERATIONS} steps. Send a follow-up message to continue.`
      });
    } catch (err) {
      if (controller.signal.aborted) {
        run.status = 'stopped';
        this._emit(run, 'stopped', `${crew.name} was stopped.`);
        try {
          await this.crewService.setStatus(run.crewId, 'idle');
        } catch { /* best effort */ }
      } else {
        run.status = 'failed';
        this._emit(run, 'error', err?.message || 'The run failed unexpectedly.', {
          error: err?.message
        });
        try {
          await this.crewService.setStatus(run.crewId, 'idle');
        } catch { /* best effort */ }
      }
    }
  }

  /** @private */
  _emit(run, type, message, data) {
    const event = { type, message, data: data ?? null, at: new Date().toISOString() };
    run.events.push(event);
    for (const cb of run.listeners) {
      try {
        cb(event);
      } catch (err) {
        this.logger.warn?.(`[crewWorker] subscriber threw: ${err.message}`);
      }
    }
  }

  // ------------------------------------------------------------ prompts

  /**
   * @private
   * @param {import('../services/crewService.js').CrewMember} crew
   */
  _buildSystemPrompt(crew) {
    const toolDocs = [];
    if (crew.toolsAllowed.includes('computer')) {
      toolDocs.push(
        `COMPUTER — control your own computer desktop. action = {"tool":"computer","action":{"type":"<one of: ${ACTION_TYPES.join(', ')}>","params":{...}}}. ` +
        `Examples: {"type":"screenshot","params":{}}, {"type":"click","params":{"x":640,"y":400}}, ` +
        `{"type":"type","params":{"text":"hello"}}, {"type":"press_key","params":{"key":"enter"}}, ` +
        `{"type":"hotkey","params":{"keys":["ctrl","c"]}}, {"type":"scroll","params":{"direction":"down","amount":3}}, ` +
        `{"type":"navigate","params":{"url":"https://example.com"}}, {"type":"open_application","params":{"application":"notepad"}}.`
      );
    }
    if (crew.toolsAllowed.includes('shell')) {
      toolDocs.push(
        `SHELL — run a command in your workspace directory (30 second timeout). action = {"tool":"shell","command":"<shell command>"}.`
      );
    }
    if (crew.toolsAllowed.includes('files')) {
      toolDocs.push(
        `FILES — read or write files inside your workspace directory only. ` +
        `action = {"tool":"file_read","path":"<relative path>"} or {"tool":"file_write","path":"<relative path>","content":"<text>"}.`
      );
    }

    return [
      `You are ${crew.name}, ${crew.role}.`,
      `Instructions: ${crew.instructions || '(none — use your best judgment)'}`,
      `You are an Infinity Crew coworker with your own computer. You work autonomously: think, take an action, observe the result, then continue until the task is done.`,
      ``,
      `YOUR TOOLS:`,
      ...toolDocs,
      ``,
      `RESPONSE FORMAT — respond with JSON only, exactly like this:`,
      `{"thought":"what you are about to do and why","action":{"tool":"computer","action":{"type":"screenshot","params":{}}} | {"tool":"shell","command":"..."} | {"tool":"file_read","path":"..."} | {"tool":"file_write","path":"...","content":"..."} | null,"reply":"..."}`,
      `Set "action" to null when you are done and just want to reply to the user; the reply is what the user sees.`
    ].join('\n');
  }

  /**
   * Parse the brain's response. Tolerates markdown code fences.
   * On parse failure the whole text is treated as a reply.
   * @private
   */
  _parseBrainResponse(text) {
    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    try {
      const obj = JSON.parse(cleaned);
      const action = obj && typeof obj.action === 'object' ? obj.action : null;
      return {
        thought: typeof obj?.thought === 'string' ? obj.thought : '',
        action,
        reply: typeof obj?.reply === 'string' ? obj.reply : ''
      };
    } catch {
      return { thought: '', action: null, reply: cleaned };
    }
  }

  // ------------------------------------------------------------ actions

  /**
   * Execute one brain-requested action and return the observation string.
   * @private
   */
  async _executeAction(run, crew, action, thought) {
    const tool = action?.tool;

    if (!tool || !['computer', 'shell', 'file_read', 'file_write'].includes(tool)) {
      return `Unknown or missing tool "${tool}". Use one of your allowed tools.`;
    }

    const requiredPermission = tool === 'computer' ? 'computer' : tool === 'shell' ? 'shell' : 'files';
    if (!crew.toolsAllowed.includes(requiredPermission)) {
      return 'Tool not permitted for this crew member.';
    }

    try {
      if (tool === 'computer') return await this._execComputer(run, action, thought);
      if (tool === 'shell') return await this._execShell(crew, action);
      if (tool === 'file_read') return await this._execFileRead(crew, action);
      return await this._execFileWrite(crew, action);
    } catch (err) {
      return `Action failed: ${err?.message || 'unknown error'}`;
    }
  }

  /** @private */
  async _execComputer(run, action, thought) {
    if (!this.computerAdapter || typeof this.computerAdapter.execute !== 'function') {
      return 'Computer control is not available on this server (no computer adapter).';
    }

    const raw = action.action;
    const validation = validateComputerAction(raw);
    if (!validation.valid) {
      return `Invalid computer action: ${validation.errors.join('; ')}`;
    }

    const { action: valid, reason } = validation;
    let result;
    try {
      // Mirrors the validated-computer-action call shape used in infinityModes.js.
      result = await this.computerAdapter.execute(
        {
          type: valid.type,
          params: valid.params,
          reason: reason || thought || 'crew action'
        },
        {}
      );
    } catch (err) {
      result = { ok: false, error: { message: err?.message || 'adapter threw' } };
    }

    const observation = result?.observation?.summary
      || JSON.stringify(result, null, 2)
      || '(no result)';
    return this._truncate(observation, OBSERVATION_LIMIT);
  }

  /** @private */
  async _execShell(crew, action) {
    const command = action?.command;
    if (typeof command !== 'string' || command.trim().length === 0) {
      return 'Shell action requires a non-empty "command" string.';
    }

    const cwd = crew.workspacePath;
    await fs.mkdir(cwd, { recursive: true });

    let out;
    try {
      out = await execAsync(command, { cwd, timeout: SHELL_TIMEOUT_MS, maxBuffer: 1024 * 1024 });
    } catch (err) {
      const stdout = err?.stdout ? `\nstdout:\n${err.stdout}` : '';
      const stderr = err?.stderr ? `\nstderr:\n${err.stderr}` : '';
      return this._truncate(
        `Command failed (exit ${err?.code ?? '?'}): ${err?.message}${stdout}${stderr}`,
        OBSERVATION_LIMIT
      );
    }
    return this._truncate(
      `exit 0\nstdout:\n${out.stdout || '(empty)'}\nstderr:\n${out.stderr || '(empty)'}`,
      OBSERVATION_LIMIT
    );
  }

  /** @private Resolve a relative path strictly inside the crew workspace. */
  _resolveWorkspacePath(crew, rel) {
    const root = path.resolve(crew.workspacePath);
    const target = path.resolve(root, String(rel ?? ''));
    const relToRoot = path.relative(root, target);
    if (relToRoot === '' || relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      return null;
    }
    return target;
  }

  /** @private */
  async _execFileRead(crew, action) {
    const target = this._resolveWorkspacePath(crew, action?.path);
    if (!target) return 'Path traversal is not allowed — paths must stay inside your workspace.';
    try {
      const content = await fs.readFile(target, 'utf8');
      return this._truncate(content, OBSERVATION_LIMIT);
    } catch (err) {
      return `Could not read file: ${err?.message || 'unknown error'}`;
    }
  }

  /** @private */
  async _execFileWrite(crew, action) {
    const target = this._resolveWorkspacePath(crew, action?.path);
    if (!target) return 'Path traversal is not allowed — paths must stay inside your workspace.';
    if (typeof action?.content !== 'string') return 'file_write requires a "content" string.';
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, action.content, 'utf8');
      return `Wrote ${action.content.length} characters to ${path.relative(path.resolve(crew.workspacePath), target)}.`;
    } catch (err) {
      return `Could not write file: ${err?.message || 'unknown error'}`;
    }
  }

  /** @private */
  _truncate(text, limit) {
    const s = String(text ?? '');
    return s.length > limit ? s.slice(0, limit) + '… [truncated]' : s;
  }
}

export default CrewWorker;
