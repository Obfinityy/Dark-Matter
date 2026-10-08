/**
 * Agent S driver — Node.js side of the Agent S computer-control integration.
 *
 * Spawns `backend/computer/agentS/agent_service.py` (Simular Agent S loop)
 * and talks to it over newline-delimited JSON on stdin/stdout — the same
 * protocol as the Open-Interface bridge.
 *
 * The Python service runs the full Agent S observe→think→act loop:
 *   - vision brain (user's Kaggle model) SEES screenshots
 *   - UI-TARS grounding turns "the search bar" into x,y coordinates
 *   - pyautogui executes clicks/types on the real desktop
 *
 * Events from Python ("agent.thought", "agent.action", "agent.screenshot",
 * "agent.done", ...) are re-emitted here so the task worker can publish
 * them to the UI's live feed.
 *
 * Config (env):
 *   DM_VISION_URL / DM_VISION_MODEL / DM_VISION_API_KEY
 *   DM_GROUND_URL / DM_GROUND_MODEL
 *   DM_AGENT_S_PYTHON  python binary (default: auto-discover)
 */

import { spawn, execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AGENT_S_SERVICE_PATH = path.join(__dirname, '..', 'agentS', 'agent_service.py');

let _id = 0;
const nextId = () => `agents-${Date.now()}-${(_id += 1)}`;

/** Agent S Driver. */
export class AgentSDriver extends EventEmitter {
  constructor({ python = null, env = {} } = {}) {
    super();
    this.python = python || discoverPython();
    this.extraEnv = env;
    this.proc = null;
    this.pending = new Map();
    this.buffer = '';
    this.started = false;
  }

  /** Spawn the Python service. Resolves when service.ready arrives. */
  start() {
    if (this.proc) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(AGENT_S_SERVICE_PATH)) {
        return reject(new Error(`Agent S service not found: ${AGENT_S_SERVICE_PATH}`));
      }
      const proc = spawn(this.python, [AGENT_S_SERVICE_PATH], {
        env: { ...process.env, ...this.extraEnv },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.proc = proc;

      const onReady = msg => {
        if (msg?.event === 'service.ready') {
          this.started = true;
          this.off('__raw', onReady);
          resolve();
        }
      };
      this.on('__raw', onReady);

      proc.stdout.on('data', chunk => this._onData(chunk));
      proc.stderr.on('data', chunk => this.emit('stderr', String(chunk)));

      proc.on('error', err => {
        this.emit('error', err);
        if (!this.started) {
          this.off('__raw', onReady);
          reject(err);
        }
      });
      proc.on('exit', code => {
        this.emit('exit', code);
        for (const [, p] of this.pending) p.reject(new Error(`Agent S exited (code ${code})`));
        this.pending.clear();
        this.proc = null;
        this.started = false;
      });

      setTimeout(() => {
        if (!this.started) {
          this.off('__raw', onReady);
          reject(
            new Error(
              'Agent S service did not become ready in time. Is gui-agents installed? (pip install -r backend/computer/agentS/requirements.txt)'
            )
          );
        }
      }, 30000).unref?.();
    });
  }

  _onData(chunk) {
    this.buffer += String(chunk);
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      this.emit('__raw', msg);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.result);
        else
          p.reject(
            Object.assign(new Error(msg.error?.message || 'Agent S error'), {
              kind: msg.error?.kind,
            })
          );
      } else if (msg.event) {
        this.emit(msg.event, msg.data || {});
        this.emit('event', { type: msg.event, data: msg.data || {} });
      }
    }
  }

  _request(cmd, params = {}) {
    if (!this.proc) return Promise.reject(new Error('Agent S service not started'));
    const id = nextId();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ id, cmd, params }) + '\n', err => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  /** Capability probe — no side effects. */
  probe() {
    return this._request('probe');
  }

  /**
   * Run one natural-language desktop task through the full Agent S loop.
   * Streams agent.* events; resolves when the task completes.
   */
  runTask(instruction) {
    return this._request('run_task', { instruction });
  }

  /** Ask the running task to stop at the next observation boundary. */
  stop() {
    return this._request('stop').catch(() => ({}));
  }

  kill() {
    try {
      this.proc?.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    this.proc = null;
    this.started = false;
  }
}

function discoverPython() {
  // Same discovery order as the Open-Interface bridge.
  for (const bin of ['python3', 'python', 'py']) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore', timeout: 5000 });
      return bin;
    } catch {
      /* try next */
    }
  }
  return 'python3';
}

export default AgentSDriver;
