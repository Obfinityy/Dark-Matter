/**
 * services.js — lifecycle manager for the two bundled local services.
 *
 *   vm-runner    (required)  Kali/QEMU sandbox API on 127.0.0.1:4100
 *   agent-poller (optional)  pulls hunt jobs from the backend and drives them
 *                            on the local VM. Only starts when the user has
 *                            signed in (a JWT exists in ~/.infinity-ai/poller.json).
 *
 * This module is Electron-agnostic: the caller injects `spawnService`, which in
 * production wraps `utilityProcess.fork()` (Electron's bundled Node — the user
 * never installs Node) and in tests is a fake.
 *
 * spawnService(entryPath, { env, onStdout, onStderr }) →
 *   { kill(), on(event, cb) }   // events: 'exit' (code), 'error' (err)
 */
const { EventEmitter } = require('node:events');
const path = require('node:path');

const RUNNER_PORT = 4100;
const RUNNER_HEALTH_URL = `http://127.0.0.1:${RUNNER_PORT}/health`;

const RESTART_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];
const MAX_RAPID_FAILURES = 5;
const RAPID_WINDOW_MS = 60000;

class ServiceManager extends EventEmitter {
  /**
   * @param {object} opts
   * @param {(entryPath: string, o: object) => object} opts.spawnService
   * @param {string} opts.resourcesDir   absolute dir holding vm-runner/ + agent-poller/
   * @param {(name: string) => object} opts.pollerEnv  env for the poller (token etc.)
   * @param {(url: string, o: object) => Promise<Response>} [opts.fetchImpl]
   */
  constructor({ spawnService, resourcesDir, pollerEnv, fetchImpl, restartDelays }) {
    super();
    this.restartDelays = restartDelays || RESTART_DELAYS_MS;
    this.spawnService = spawnService;
    this.resourcesDir = resourcesDir;
    this.pollerEnv = pollerEnv;
    this.fetchImpl = fetchImpl || fetch;
    this.services = new Map(); // name → { proc, state, failures: [ts], timer, wanted }
    this.defs = [
      { name: 'vm-runner', entry: path.join('vm-runner', 'src', 'index.js'), required: true },
      { name: 'agent-poller', entry: path.join('agent-poller', 'src', 'index.js'), required: false },
    ];
  }

  /** Start everything the user is entitled to run. */
  async start() {
    for (const def of this.defs) {
      if (def.name === 'agent-poller' && !this.pollerEnv().POLLER_TOKEN) {
        this.setState('agent-poller', 'waiting-signin');
        continue;
      }
      this.launch(def);
    }
    this.emitStatus();
  }

  /** Stop everything (for Quit / user Stop). No restarts after this. */
  async stop() {
    for (const def of this.defs) this.teardown(def.name);
    this.emitStatus();
  }

  /** (Re)launch one service definition. */
  launch(def) {
    this.teardown(def.name, { silent: true });
    const entry = path.join(this.resourcesDir, def.entry);
    const env = def.name === 'agent-poller' ? { ...process.env, ...this.pollerEnv() } : { ...process.env };
    let proc;
    try {
      proc = this.spawnService(entry, {
        env,
        onStdout: (d) => this.emit('log', { service: def.name, stream: 'out', data: String(d) }),
        onStderr: (d) => this.emit('log', { service: def.name, stream: 'err', data: String(d) }),
      });
    } catch (err) {
      this.setState(def.name, 'crashed', String(err?.message || err));
      return;
    }
    const startedAt = Date.now();
    this.services.set(def.name, { proc, state: 'running', wanted: true, failures: this.services.get(def.name)?.failures || [], timer: null, startedAt });
    proc.on('error', (err) => {
      this.setState(def.name, 'crashed', String(err?.message || err));
      this.scheduleRestart(def);
    });
    proc.on('exit', (code) => {
      const rec = this.services.get(def.name);
      if (!rec || rec.proc !== proc) return; // stale after manual teardown
      if (rec.wanted === false) {
        this.setState(def.name, 'stopped');
        return;
      }
      const now = Date.now();
      rec.failures = [...rec.failures.filter((t) => now - t < RAPID_WINDOW_MS), now];
      if (rec.failures.length >= MAX_RAPID_FAILURES) {
        this.setState(def.name, 'crashed', `exited ${code} repeatedly — giving up until you press Start`);
        return;
      }
      this.setState(def.name, 'restarting');
      this.scheduleRestart(def);
    });
    this.emitStatus();
  }

  scheduleRestart(def) {
    const rec = this.services.get(def.name) || { failures: [] };
    if (rec.wanted === false) return;
    const attempt = Math.min(rec.failures.length, this.restartDelays.length - 1);
    const delay = this.restartDelays[attempt];
    clearTimeout(rec.timer);
    rec.timer = setTimeout(() => this.launch(def), delay);
    this.services.set(def.name, { ...rec, timer: rec.timer });
  }

  teardown(name, { silent = false } = {}) {
    const rec = this.services.get(name);
    if (!rec) return;
    rec.wanted = false;
    clearTimeout(rec.timer);
    try { rec.proc?.kill(); } catch { /* already gone */ }
    this.services.set(name, { ...rec, proc: null, state: 'stopped', timer: null });
    if (!silent) this.emitStatus();
  }

  setState(name, state, detail = '') {
    const rec = this.services.get(name) || {};
    this.services.set(name, { ...rec, state, detail });
    this.emitStatus();
  }

  /** Called after sign-in/out so the poller starts/stops accordingly. */
  refreshPoller() {
    const hasToken = Boolean(this.pollerEnv().POLLER_TOKEN);
    const rec = this.services.get('agent-poller');
    const running = rec && (rec.state === 'running' || rec.state === 'restarting');
    if (hasToken && !running) this.launch(this.defs.find((d) => d.name === 'agent-poller'));
    if (!hasToken && running) this.teardown('agent-poller');
  }

  /** Probe the runner's HTTP health endpoint (what the website also checks). */
  async probeRunnerHealth(timeoutMs = 4000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await this.fetchImpl(RUNNER_HEALTH_URL, { signal: ctl.signal });
      if (!res.ok) return { up: false };
      const data = await res.json().catch(() => ({}));
      return { up: true, version: data.version || null, qemu: data.qemu || null };
    } catch {
      return { up: false };
    } finally {
      clearTimeout(timer);
    }
  }

  status() {
    const pick = (n) => this.services.get(n)?.state || 'stopped';
    return {
      runner: pick('vm-runner'),
      poller: pick('agent-poller'),
      pollerDetail: this.services.get('agent-poller')?.detail || '',
      runnerDetail: this.services.get('vm-runner')?.detail || '',
    };
  }

  emitStatus() {
    this.emit('status', this.status());
  }
}

module.exports = { ServiceManager, RUNNER_PORT, RUNNER_HEALTH_URL };
