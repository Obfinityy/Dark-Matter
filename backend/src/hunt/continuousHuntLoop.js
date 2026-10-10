/**
 * continuousHuntLoop.js — the continuous autonomous hunt state machine
 * (issue #298).
 *
 * A human elite hunter never "finishes": they understand the target, recon
 * it, test it, research what they don't know, test deeper, and when ideas
 * run out they REPLAN with a deeper angle — forever. This module is that
 * discipline as an explicit state machine:
 *
 *   UNDERSTANDING → RECON → TESTING → RESEARCH → DEEP_TESTING → REPLAN
 *         ↑                                                    ↓
 *         └────────────── (new angle / deeper pass) ───────────┘
 *
 * Pause/resume: PAUSE freezes the tick driver and persists the FULL machine
 * state (loop state, findings so far, current angle, tick count, trace) to
 * disk via loopStateStore.js. RESUME restores and continues.
 *
 * Termination: FORCE_STOP is the ONLY terminal state, and it is reachable
 * ONLY via the explicit user action forceStop({ confirmed: true }). There is
 * NO auto-complete and NO auto-quit transition — "no more ideas" triggers
 * REPLAN with a deeper strategy, never termination.
 *
 * Guards (always on):
 *   - authorized targets only: the declared target is gated through
 *     hunt/targetScope.js at start; every tool target is re-checked per tick
 *   - non-destructive defaults: tools run on the 'fast' profile, the planner
 *     strips payload content from generated params, no destructive flags
 *   - politeness throttle: a minimum delay between ticks (default 2000ms)
 *
 * Tick driver: each tick() runs the current state's action (planner.js /
 * toolRunner.js via DI) and advances exactly one transition. Production code
 * can use startDriver(intervalMs); tests drive tick() manually.
 *
 * Defensive framing only: findings + remediation. No exploit payloads.
 */

import { createTargetScope, hostOfTarget } from './targetScope.js';
import { tallyFor } from '../services/vulnTallyService.js';
import {
  newLoopState,
  saveLoopState,
  loadLoopState,
  hasLoopState,
} from './loopStateStore.js';

/** All machine states. PAUSED / FORCE_STOPPED are control states. */
export const LOOP_STATES = Object.freeze([
  'UNDERSTANDING',
  'RECON',
  'TESTING',
  'RESEARCH',
  'DEEP_TESTING',
  'REPLAN',
  'PAUSED',
  'FORCE_STOPPED',
]);

/** The one and only terminal state. */
export const TERMINAL_STATE = 'FORCE_STOPPED';

/**
 * Explicit transition table. FORCE_STOPPED has no outgoing transitions —
 * it is the only sink. Nothing transitions INTO it automatically.
 */
export const LOOP_TRANSITIONS = Object.freeze({
  UNDERSTANDING: Object.freeze(['RECON', 'PAUSED', 'FORCE_STOPPED']),
  RECON: Object.freeze(['TESTING', 'RESEARCH', 'PAUSED', 'FORCE_STOPPED']),
  TESTING: Object.freeze(['RESEARCH', 'DEEP_TESTING', 'REPLAN', 'PAUSED', 'FORCE_STOPPED']),
  RESEARCH: Object.freeze(['DEEP_TESTING', 'REPLAN', 'PAUSED', 'FORCE_STOPPED']),
  DEEP_TESTING: Object.freeze(['REPLAN', 'PAUSED', 'FORCE_STOPPED']),
  REPLAN: Object.freeze(['UNDERSTANDING', 'PAUSED', 'FORCE_STOPPED']),
  PAUSED: Object.freeze([
    'UNDERSTANDING',
    'RECON',
    'TESTING',
    'RESEARCH',
    'DEEP_TESTING',
    'REPLAN',
    'FORCE_STOPPED',
  ]),
  FORCE_STOPPED: Object.freeze([]),
});

/** True when `to` is a legal move out of `from`. */
export function isValidTransition(from, to) {
  return Boolean(LOOP_TRANSITIONS[from]?.includes(to));
}

/** True when no transition leaves the state. */
export function isTerminal(state) {
  return (LOOP_TRANSITIONS[state] || []).length === 0;
}

/**
 * Walk every reachable state from every start state and collect the sinks.
 * Used by tests (and operators) to prove FORCE_STOPPED is the only terminal.
 */
export function reachableTerminalStates() {
  const terminals = new Set();
  for (const start of LOOP_STATES) {
    const seen = new Set();
    const stack = [start];
    while (stack.length) {
      const s = stack.pop();
      if (seen.has(s)) continue;
      seen.add(s);
      const outs = LOOP_TRANSITIONS[s] || [];
      if (!outs.length) terminals.add(s);
      for (const t of outs) stack.push(t);
    }
  }
  return [...terminals];
}

/** Hunt angles the REPLAN state rotates through, deeper each cycle. */
export const ANGLE_ROTATION = Object.freeze([
  'input validation & injection classes',
  'authentication & session management',
  'access control & IDOR',
  'business logic & workflow abuse',
  'client-side & DOM surface',
  'API & parameter discovery',
  'headers, cookies & transport security',
]);

function pickNextAngle(anglesTried) {
  const tried = anglesTried || [];
  const fresh = ANGLE_ROTATION.find(a => !tried.includes(a));
  if (fresh) return fresh;
  const depth = Math.floor(tried.length / ANGLE_ROTATION.length) + 1;
  return `${ANGLE_ROTATION[tried.length % ANGLE_ROTATION.length]} — deeper pass ${depth + 1}`;
}

function now() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'informational']);

function normalizeFinding(raw = {}, ctx = {}) {
  const sev = String(raw.severity || 'informational').toLowerCase();
  return {
    id:
      raw.id ||
      `clf-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    title: String(raw.title || 'Untitled finding').slice(0, 200),
    severity: SEVERITIES.has(sev) ? sev : 'informational',
    target: String(raw.target || raw.url || raw.host || ctx.target || '').slice(0, 200),
    description: String(raw.description || '').slice(0, 2000),
    evidence: String(raw.evidence || '').slice(0, 3000),
    remediation: String(raw.remediation || '').slice(0, 2000),
    source: String(raw.source || raw.kind || 'continuous-hunt-loop').slice(0, 60),
    confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium',
    angle: ctx.angle || '',
    tick: ctx.tick ?? 0,
    foundAt: now(),
  };
}

function dedupeKey(f) {
  return `${String(f.title || '').toLowerCase().trim()}|${String(f.target || '').toLowerCase().trim()}`;
}

function targetUrlOf(target) {
  const t = String(target || '').trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function unknownKindFrom(task) {
  const hay = [...(task?.evidence || []), String(task?.title || '')].join('\n');
  const m = hay.match(/UNKNOWN task kind "([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * The continuous hunt loop.
 *
 * @param {object} opts
 * @param {string} opts.huntId
 * @param {string} opts.target — declared authorized target
 * @param {object} [opts.deps]
 *   - dataDir: loop persistence root (default backend/data/hunts)
 *   - planner: TripleBrainPlanner or a stub { createHunt?, step(huntCtx, hooks) }
 *   - toolRunner: { runTool(tool, targets, opts) } (null → tools skipped safely)
 *   - humanRecon: { understandPage({ url }) } (null → basic think-aloud only)
 *   - research: { researchTechnique({ question, trace }) } (null → note + continue)
 *   - tallyService: createVulnTallyService() instance (null → tally computed, not emitted)
 *   - minTickMs: politeness throttle between ticks (default 2000; tests pass 0)
 * @param {object} [opts.logger]
 */
export class ContinuousHuntLoop {
  constructor({ huntId, target, deps = {}, logger = console } = {}) {
    if (!huntId || !target) throw new Error('ContinuousHuntLoop requires { huntId, target }');
    this.huntId = String(huntId);
    this.target = String(target);
    this.deps = { minTickMs: 2000, ...deps };
    this.logger = logger;
    this.state = null;
    this._scope = null;
    this._timer = null;
    this._lastTickAt = 0;
    this._plannerHunt = null; // planner-owned hunt object reused across ticks
    this._seen = new Set(); // finding ids already recorded (mirrors state.findingIds)
  }

  // ------------------------------------------------------------ lifecycle

  /**
   * Start a new loop. Validates the authorized target scope first — an
   * unparseable/empty target refuses to start (authorized-targets-only).
   */
  static async start({ huntId, target, deps = {}, logger = console } = {}) {
    const loop = new ContinuousHuntLoop({ huntId, target, deps, logger });
    loop._scope = createTargetScope(target);
    if (!loop._scope.hosts.length) {
      throw new Error('refusing to start: target does not resolve to an authorized host');
    }
    loop.state = newLoopState(huntId, target);
    loop.state.angle = ANGLE_ROTATION[0];
    loop.state.anglesTried = [ANGLE_ROTATION[0]];
    loop.think(
      `Continuous hunt started on ${target}. I never quit on my own — only you can stop me. First: understand the target like a human would.`,
      'start'
    );
    if (loop.deps.planner && typeof loop.deps.planner.createHunt === 'function') {
      try {
        loop._plannerHunt = await loop.deps.planner.createHunt({ id: huntId, target });
      } catch (error) {
        loop.logger.warn?.(`[continuousHuntLoop] planner.createHunt failed: ${error.message}`);
      }
    }
    await loop._persist();
    return loop;
  }

  /** Restore a paused/running loop from disk (e.g. after a restart). */
  static async load({ huntId, deps = {}, logger = console } = {}) {
    const loop = new ContinuousHuntLoop({ huntId, target: 'unknown', deps, logger });
    const stored = await loadLoopState(huntId, loop.deps.dataDir);
    if (!stored) throw new Error(`no continuous-hunt loop state for hunt ${huntId}`);
    loop.target = stored.target;
    loop.state = stored;
    loop._scope = createTargetScope(stored.target);
    for (const f of stored.findings || []) loop._seen.add(f.id);
    return loop;
  }

  static async exists(huntId, dataDir) {
    return hasLoopState(huntId, dataDir);
  }

  async _persist() {
    this.state = await saveLoopState(this.state, this.deps.dataDir);
  }

  /** Append a think-aloud trace entry (the agent's running commentary). */
  think(text, kind = 'thought') {
    const s = this.state;
    if (!s) return;
    s.trace.push({ ts: now(), tick: s.tick, state: s.state, kind, text: String(text).slice(0, 1200) });
    if (s.trace.length > 2000) s.trace.splice(0, s.trace.length - 2000);
  }

  // ------------------------------------------------------------ transitions

  /** Move the machine; throws on any illegal transition. */
  async transitionTo(to, reason = '') {
    const s = this.state;
    if (!s) throw new Error('loop not started');
    if (!isValidTransition(s.state, to)) {
      throw new Error(`invalid continuous-hunt transition: ${s.state} → ${to}`);
    }
    const from = s.state;
    s.state = to;
    this.think(`State ${from} → ${to}${reason ? ` — ${reason}` : ''}`, 'transition');
    await this._persist();
    return { from, to };
  }

  /**
   * PAUSE: freeze the tick driver and persist everything. Ticks while paused
   * are no-ops. Never a terminal state — resume() continues the hunt.
   */
  async pause() {
    const s = this.state;
    if (!s) throw new Error('loop not started');
    if (s.state === 'PAUSED') return { state: 'PAUSED', already: true };
    if (s.state === 'FORCE_STOPPED') throw new Error('cannot pause a force-stopped loop');
    s.prevState = s.state;
    await this.transitionTo('PAUSED', 'user paused — ticks frozen, full state persisted');
    return { state: 'PAUSED', prevState: s.prevState, tick: s.tick };
  }

  /** RESUME: restore the pre-pause state and keep hunting. */
  async resume() {
    const s = this.state;
    if (!s) throw new Error('loop not started');
    if (s.state !== 'PAUSED') throw new Error(`cannot resume: loop is ${s.state}, not PAUSED`);
    const back = s.prevState || 'UNDERSTANDING';
    if (!isValidTransition('PAUSED', back)) {
      throw new Error(`cannot resume into invalid state ${back}`);
    }
    s.prevState = null;
    await this.transitionTo(back, 'user resumed — continuing the hunt');
    return { state: back, tick: s.tick };
  }

  /**
   * FORCE_STOP: the ONLY terminal state, reachable ONLY through this explicit
   * user action. No automatic path in tick() ever calls it.
   */
  async forceStop({ confirmed = false } = {}) {
    if (confirmed !== true) {
      throw new Error('force-stop requires explicit user intent: { confirmed: true }');
    }
    const s = this.state;
    if (!s) throw new Error('loop not started');
    if (s.state === 'FORCE_STOPPED') return { state: 'FORCE_STOPPED', already: true };
    const from = s.state;
    this.stopDriver();
    s.prevState = null;
    await this.transitionTo('FORCE_STOPPED', 'user force-stopped the hunt (explicit)');
    return { state: 'FORCE_STOPPED', from };
  }

  // ------------------------------------------------------------ tick driver

  /** Run one machine tick: execute the current state's action, advance once. */
  async tick() {
    const s = this.state;
    if (!s) throw new Error('loop not started');
    if (s.state === 'PAUSED' || s.state === 'FORCE_STOPPED') {
      return { ticked: false, state: s.state, tick: s.tick };
    }
    // Politeness throttle: never hammer — minimum delay between ticks.
    const minMs = Number(this.deps.minTickMs ?? 2000);
    const wait = minMs - (Date.now() - this._lastTickAt);
    if (wait > 0) await sleep(wait);
    this._lastTickAt = Date.now();

    const action = STATE_ACTIONS[s.state];
    if (!action) throw new Error(`no action for loop state ${s.state}`);
    const from = s.state;
    const result = (await action.call(this, s)) || {};
    s.tick += 1;
    if (result.researchQuestion) s.pendingQuestion = String(result.researchQuestion).slice(0, 300);
    const next = result.next || from;
    await this.transitionTo(next, result.note || '');
    // transitionTo persisted; tick count + pendingQuestion need one more save.
    await this._persist();
    return { ticked: true, from, to: s.state, tick: s.tick };
  }

  /** Production driver: tick on an interval until paused/force-stopped. */
  startDriver(intervalMs = 8000) {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this.tick().catch(error =>
        this.logger.error?.(`[continuousHuntLoop] tick failed: ${error.message}`)
      );
    }, intervalMs);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  stopDriver() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  get running() {
    return Boolean(this._timer);
  }

  // ------------------------------------------------------------ state actions

  /** One planner cycle through the loop's runTool guard. */
  async _plannerCycle(phase) {
    const s = this.state;
    const planner = this.deps.planner;
    if (!planner || typeof planner.step !== 'function') {
      this.think(
        `[${phase}] no planner wired — running the deterministic surface checklist for angle "${s.angle}".`,
        phase
      );
      return { done: false, unknownKind: null, findings: [] };
    }
    const huntCtx =
      this._plannerHunt || {
        id: s.huntId,
        target: s.target,
        stage: phase,
        tasks: [],
        findings: [],
        huntState: {},
      };
    let res;
    try {
      res = await planner.step(huntCtx, { runTool: spec => this._guardedRunTool(spec) });
    } catch (error) {
      this.think(`[${phase}] planner step failed (${error.message}) — noting it and moving on like a human would.`, phase);
      return { done: false, unknownKind: null, findings: [], error: error.message };
    }
    if (res && res.hunt) this._plannerHunt = res.hunt;
    const task = res?.task || null;
    const unknownKind = task ? unknownKindFrom(task) : null;
    const fresh = [];
    for (const f of res?.hunt?.findings || task?.findings || []) {
      if (f && f.id && !this._seen.has(f.id)) fresh.push(f);
    }
    for (const f of fresh) await this.recordFinding(f);
    return { done: Boolean(res?.done), unknownKind, findings: fresh, task };
  }

  /**
   * Tool execution guard: authorized-targets-only (every target re-checked
   * against the hunt scope) + non-destructive 'fast' profile. Throws instead
   * of running when a target is out of scope.
   */
  async _guardedRunTool(spec = {}) {
    const s = this.state;
    const targets = (Array.isArray(spec.targets) ? spec.targets : [s.target]).map(t => String(t));
    for (const t of targets) {
      const host = hostOfTarget(t);
      if (!this._scope.allows(host)) {
        throw new Error(`blocked: target "${t}" is outside the authorized hunt scope`);
      }
    }
    const tool = String(spec.tool || 'unknown');
    this.think(`Running ${tool} against ${targets.join(', ')} (polite, non-destructive profile).`, 'tool');
    const runner = this.deps.toolRunner;
    if (!runner || typeof runner.runTool !== 'function') {
      return `TOOL ${tool} SKIPPED: no external runner wired for this loop.`;
    }
    const res = await runner.runTool(tool, targets, {
      profile: 'fast', // non-destructive default, always
      onFinding: rec => this.recordFinding({ ...rec, source: tool }),
    });
    return `TOOL ${tool}: ${res.records.length} records, ${res.findings.length} findings.`;
  }

  /** Record a finding: dedupe, tally, SSE emit, think-aloud, persist. */
  async recordFinding(raw) {
    const s = this.state;
    const finding = normalizeFinding(raw, { target: s.target, angle: s.angle, tick: s.tick });
    if (finding.id && this._seen.has(finding.id)) return null;
    const key = dedupeKey(finding);
    const existing = s.findings.find(f => dedupeKey(f) === key);
    if (existing) {
      if (finding.evidence && !existing.evidence.includes(finding.evidence.slice(0, 80))) {
        existing.evidence = `${existing.evidence}\n${finding.evidence}`.slice(0, 3000);
        await this._persist();
      }
      if (finding.id) this._seen.add(finding.id);
      return existing;
    }
    this._seen.add(finding.id);
    s.findings.push(finding);
    s.tally = tallyFor(s.findings);
    this.think(`Found: ${finding.title} [${finding.severity.toUpperCase()}] — tally now ${s.tally.total} (${s.tally.critical} critical).`, 'finding');
    if (this.deps.tallyService && typeof this.deps.tallyService.emitFinding === 'function') {
      await this.deps.tallyService.emitFinding(s.huntId, finding, s.findings);
    }
    await this._persist();
    return finding;
  }

  /** Read-only snapshot of the machine for APIs. */
  snapshot() {
    const s = this.state;
    if (!s) throw new Error('loop not started');
    return {
      huntId: s.huntId,
      target: s.target,
      state: s.state,
      prevState: s.prevState,
      tick: s.tick,
      cycle: s.cycle,
      angle: s.angle,
      anglesTried: [...(s.anglesTried || [])],
      findings: s.findings.length,
      tally: { ...s.tally },
      traceTail: (s.trace || []).slice(-10),
      updatedAt: s.updatedAt,
    };
  }
}

// ------------------------------------------------------------------ actions

const STATE_ACTIONS = {
  async UNDERSTANDING(s) {
    const recon = this.deps.humanRecon;
    if (s.cycle === 1 && !s._understood) {
      if (recon && typeof recon.understandPage === 'function') {
        try {
          const { summary, thinkAloud } = await recon.understandPage({
            url: targetUrlOf(s.target),
          });
          s.siteMap = summary;
          for (const line of thinkAloud || []) this.think(line, 'understanding');
        } catch (error) {
          this.think(`Could not fetch the target page directly (${error.message}) — proceeding from declared target info like a human would.`, 'understanding');
        }
      } else {
        this.think(
          `Cycle 1 on ${s.target}: reading the target like a human — purpose, forms, inputs, tech stack — before firing any tool.`,
          'understanding'
        );
      }
      s._understood = true;
    } else {
      this.think(
        `Cycle ${s.cycle}, new angle "${s.angle}": studying it the way a human hunter studies a fresh lead — what does this surface let me observe?`,
        'understanding'
      );
    }
    return { next: 'RECON', note: `understood angle "${s.angle}"` };
  },

  async RECON(s) {
    const { unknownKind, task } = await this._plannerCycle('recon');
    if (unknownKind) {
      return {
        next: 'RESEARCH',
        researchQuestion: unknownKind,
        note: `recon hit unknown technique "${unknownKind}" — researching`,
      };
    }
    void task;
    return { next: 'TESTING', note: 'recon sweep done' };
  },

  async TESTING(s) {
    const { done, unknownKind } = await this._plannerCycle('testing');
    // "No more ideas" NEVER terminates the loop — it triggers REPLAN.
    if (done) return { next: 'REPLAN', note: 'planner exhausted — replanning deeper, never quitting' };
    if (unknownKind) {
      return {
        next: 'RESEARCH',
        researchQuestion: unknownKind,
        note: `testing hit unknown technique "${unknownKind}" — researching`,
      };
    }
    return { next: 'DEEP_TESTING', note: 'initial testing done — going deeper' };
  },

  async RESEARCH(s) {
    const question = s.pendingQuestion || 'unfamiliar technique from the current angle';
    const research = this.deps.research;
    if (research && typeof research.researchTechnique === 'function') {
      try {
        const entry = await research.researchTechnique({
          question,
          trace: e => this.think(e.text, 'research'),
        });
        s.researchLog = [...(s.researchLog || []), entry];
        this.think(`Research on "${question}" complete — applying the concept with safe, non-destructive tests.`, 'research');
      } catch (error) {
        this.think(`Research on "${question}" failed (${error.message}) — continuing with built-in knowledge.`, 'research');
      }
    } else {
      this.think(`Technique gap on "${question}" but no research module wired — continuing with built-in knowledge.`, 'research');
    }
    s.pendingQuestion = null;
    return { next: 'DEEP_TESTING', note: `researched "${question}"` };
  },

  async DEEP_TESTING(s) {
    await this._plannerCycle('deep-testing');
    return { next: 'REPLAN', note: 'deep testing pass done' };
  },

  async REPLAN(s) {
    // The heart of "continuous": out of ideas → deeper strategy, never stop.
    const nextAngle = pickNextAngle(s.anglesTried);
    s.anglesTried.push(nextAngle);
    s.angle = nextAngle;
    s.cycle += 1;
    this.think(
      `Out of ideas on the old angle — a human elite hunter doesn't quit, they replan DEEPER. Cycle ${s.cycle}, new angle: "${nextAngle}".`,
      'replan'
    );
    return { next: 'UNDERSTANDING', note: `replanned to "${nextAngle}" (cycle ${s.cycle})` };
  },
};

export default {
  ContinuousHuntLoop,
  LOOP_STATES,
  LOOP_TRANSITIONS,
  TERMINAL_STATE,
  isValidTransition,
  isTerminal,
  reachableTerminalStates,
  ANGLE_ROTATION,
};
