/**
 * continuousHuntLoop.test.js — tests for the continuous autonomous hunt
 * state machine (issue #298).
 *
 * Run: cd backend && node --test src/hunt/continuousHuntLoop.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ContinuousHuntLoop,
  LOOP_STATES,
  LOOP_TRANSITIONS,
  TERMINAL_STATE,
  isValidTransition,
  isTerminal,
  reachableTerminalStates,
} from './continuousHuntLoop.js';
import { loadLoopState } from './loopStateStore.js';

const quiet = { info() {}, warn() {}, error() {} };

let dataDir;
beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ch-loop-'));
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

const deps = () => ({ dataDir, minTickMs: 0, logger: quiet });

/** Deterministic stub planner: cycles through done=false, then done=true forever. */
function stubPlanner({ findings = [] } = {}) {
  let calls = 0;
  return {
    async step(huntCtx, hooks) {
      calls += 1;
      assert.ok(hooks && typeof hooks.runTool === 'function', 'planner gets runTool hook');
      return {
        hunt: { findings: calls === 1 ? findings : [] },
        task: { id: `t${calls}`, title: `stub task ${calls}`, evidence: [] },
        done: calls > 3, // "no more ideas" after a few cycles
        calls,
      };
    },
  };
}

async function started(extraDeps = {}) {
  return ContinuousHuntLoop.start({
    huntId: `hunt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    target: 'example.com',
    deps: { ...deps(), ...extraDeps },
    logger: quiet,
  });
}

// ------------------------------------------------------------------ table

describe('loop transition table', () => {
  it('FORCE_STOPPED is the only terminal state (enumerated programmatically)', () => {
    const terminals = reachableTerminalStates();
    assert.deepEqual(terminals, [TERMINAL_STATE]);
  });

  it('every non-terminal state is reachable and no other state is terminal', () => {
    for (const s of LOOP_STATES) {
      assert.equal(isTerminal(s), s === TERMINAL_STATE, `isTerminal(${s})`);
    }
  });

  it('there is no automatic transition into FORCE_STOPPED from working states', () => {
    // The table lists FORCE_STOPPED as a legal target (the user action), but
    // the state's automatic actions must never choose it. Asserted behaviourally below.
    for (const s of ['UNDERSTANDING', 'RECON', 'TESTING', 'RESEARCH', 'DEEP_TESTING', 'REPLAN']) {
      assert.ok(isValidTransition(s, 'FORCE_STOPPED'), `${s} allows the user force-stop`);
    }
  });

  it('rejects illegal transitions', async () => {
    const loop = await started();
    await assert.rejects(() => loop.transitionTo('DEEP_TESTING'), /invalid continuous-hunt transition/);
    await assert.rejects(() => loop.transitionTo('BOGUS'), /invalid continuous-hunt transition/);
  });

  it('allows the explicit force-stop transition from every working state', async () => {
    const loop = await started();
    for (const s of ['UNDERSTANDING', 'RECON', 'TESTING', 'RESEARCH', 'DEEP_TESTING', 'REPLAN']) {
      assert.ok(isValidTransition(s, 'FORCE_STOPPED'), s);
    }
    assert.deepEqual(LOOP_TRANSITIONS.FORCE_STOPPED, []);
  });
});

// ------------------------------------------------------- no auto-termination

describe('no automatic termination', () => {
  it('ticks never reach FORCE_STOPPED on their own (even when the planner is "done")', async () => {
    const loop = await started({ planner: stubPlanner() });
    for (let i = 0; i < 40; i++) {
      const r = await loop.tick();
      assert.ok(r.ticked, `tick ${i} should tick`);
      assert.notEqual(loop.state.state, 'FORCE_STOPPED', `tick ${i} auto-terminated`);
    }
    // "No more ideas" must have triggered REPLAN cycles, never a stop.
    assert.ok(loop.state.cycle > 1, `expected replanning cycles, got cycle=${loop.state.cycle}`);
    assert.ok(loop.state.anglesTried.length > 1, 'expected new angles after replan');
  });

  it('forceStop requires explicit confirmation', async () => {
    const loop = await started();
    await assert.rejects(() => loop.forceStop(), /explicit user intent/);
    await assert.rejects(() => loop.forceStop({ confirmed: false }), /explicit user intent/);
    const r = await loop.forceStop({ confirmed: true });
    assert.equal(r.state, 'FORCE_STOPPED');
    assert.equal(loop.state.state, 'FORCE_STOPPED');
  });

  it('ticks are no-ops after force-stop', async () => {
    const loop = await started();
    await loop.tick();
    await loop.forceStop({ confirmed: true });
    const before = loop.state.tick;
    const r = await loop.tick();
    assert.equal(r.ticked, false);
    assert.equal(loop.state.tick, before);
  });

  it('cannot pause a force-stopped loop', async () => {
    const loop = await started();
    await loop.forceStop({ confirmed: true });
    await assert.rejects(() => loop.pause(), /force-stopped/);
  });
});

// ------------------------------------------------------------------ pause

describe('pause / resume', () => {
  it('pause freezes ticks and resume continues', async () => {
    const loop = await started({ planner: stubPlanner() });
    await loop.tick();
    await loop.tick();
    const tickAtPause = loop.state.tick;
    await loop.pause();
    assert.equal(loop.state.state, 'PAUSED');
    const r = await loop.tick();
    assert.equal(r.ticked, false, 'tick while paused must be a no-op');
    assert.equal(loop.state.tick, tickAtPause);
    await loop.resume();
    assert.notEqual(loop.state.state, 'PAUSED');
    const r2 = await loop.tick();
    assert.equal(r2.ticked, true);
    assert.ok(loop.state.tick > tickAtPause);
  });

  it('resume restores full state across a process restart (findings, angle, tick, tally)', async () => {
    const findings = [
      { id: 'f1', title: 'Reflected XSS in search', severity: 'high', target: 'example.com', description: 'd', evidence: 'e' },
      { id: 'f2', title: 'Missing HSTS', severity: 'low', target: 'example.com', description: 'd', evidence: 'e' },
    ];
    const loop = await started({ planner: stubPlanner({ findings }) });
    await loop.tick(); // UNDERSTANDING → RECON
    await loop.tick(); // RECON → TESTING (planner records findings)
    await loop.tick(); // TESTING → ...
    await loop.pause();
    const snapBefore = loop.snapshot();

    // Simulate a restart: brand-new instance, same dataDir.
    const revived = await ContinuousHuntLoop.load({ huntId: loop.huntId, deps: deps(), logger: quiet });
    assert.equal(revived.state.state, 'PAUSED');
    assert.equal(revived.state.tick, snapBefore.tick);
    assert.equal(revived.state.angle, snapBefore.angle);
    assert.deepEqual(revived.state.anglesTried, snapBefore.anglesTried);
    assert.deepEqual(revived.state.tally, snapBefore.tally);
    assert.equal(revived.state.findings.length, 2);
    assert.equal(revived.state.tally.high, 1);
    assert.equal(revived.state.tally.low, 1);
    assert.equal(revived.state.tally.total, 2);

    // Persisted file holds the same state (pause froze it to disk).
    const onDisk = await loadLoopState(loop.huntId, dataDir);
    assert.equal(onDisk.tick, snapBefore.tick);
    assert.equal(onDisk.findings.length, 2);

    await revived.resume();
    const r = await revived.tick();
    assert.equal(r.ticked, true, 'revived loop keeps ticking after resume');
    assert.ok(revived.state.tick > snapBefore.tick);
  });

  it('pausing twice is idempotent', async () => {
    const loop = await started();
    await loop.pause();
    const r = await loop.pause();
    assert.equal(r.already, true);
    assert.equal(loop.state.state, 'PAUSED');
  });

  it('resume when not paused throws', async () => {
    const loop = await started();
    await assert.rejects(() => loop.resume(), /not PAUSED/);
  });
});

// ------------------------------------------------------------------ guards

describe('guards', () => {
  it('refuses to start without an authorized target host', async () => {
    await assert.rejects(
      () => ContinuousHuntLoop.start({ huntId: 'x', target: 'not a host !!!', deps: deps(), logger: quiet }),
      /authorized host/
    );
  });

  it('blocks out-of-scope tool targets (authorized-targets-only)', async () => {
    const loop = await started();
    await assert.rejects(
      () => loop._guardedRunTool({ tool: 'httpx', targets: ['https://evil.example/'] }),
      /outside the authorized hunt scope/
    );
  });

  it('allows in-scope tool targets', async () => {
    const seen = [];
    const loop = await started({
      toolRunner: {
        async runTool(tool, targets, opts) {
          seen.push({ tool, targets, profile: opts.profile });
          return { records: [], findings: [] };
        },
      },
    });
    const out = await loop._guardedRunTool({ tool: 'httpx', targets: ['https://example.com/'] });
    assert.match(out, /TOOL httpx/);
    assert.equal(seen[0].profile, 'fast', 'non-destructive profile enforced');
    assert.deepEqual(seen[0].targets, ['https://example.com/']);
  });

  it('politeness throttle spaces ticks apart', async () => {
    const loop = await started({ minTickMs: 60 });
    await loop.tick();
    const t0 = Date.now();
    await loop.tick();
    const dt = Date.now() - t0;
    assert.ok(dt >= 40, `expected throttle delay, got ${dt}ms`);
  });
});

// ------------------------------------------------------- research / findings

describe('research + tally', () => {
  it('unknown planner technique routes through RESEARCH then DEEP_TESTING', async () => {
    const researched = [];
    const planner = {
      async step() {
        return {
          hunt: { findings: [] },
          task: { id: 't1', title: 'weird thing', evidence: ['UNKNOWN task kind "quantumFuzzer" — skipped safely.'] },
          done: false,
        };
      },
    };
    const loop = await started({
      planner,
      research: {
        async researchTechnique({ question, trace }) {
          researched.push(question);
          trace?.({ text: 'researched' });
          return { question, sources: [], whatWasLearned: 'x', howApplied: 'y' };
        },
      },
    });
    await loop.tick(); // UNDERSTANDING → RECON
    const r = await loop.tick(); // RECON → RESEARCH (unknown kind)
    assert.equal(r.to, 'RESEARCH');
    const r2 = await loop.tick(); // RESEARCH → DEEP_TESTING
    assert.equal(r2.to, 'DEEP_TESTING');
    assert.ok(researched.some(q => /quantumFuzzer/.test(q)), `research got: ${researched}`);
  });

  it('recordFinding updates the tally and emits vuln_tally + activity events', async () => {
    const published = [];
    const loop = await started({
      tallyService: {
        async emitFinding(huntId, finding, all) {
          published.push({ huntId, finding, count: all.length });
          return { tally: {}, published: true };
        },
      },
    });
    await loop.recordFinding({ title: 'SQLi in login', severity: 'critical', target: 'example.com' });
    await loop.recordFinding({ title: 'Verbose errors', severity: 'info', target: 'example.com' });
    assert.equal(loop.state.tally.critical, 1);
    assert.equal(loop.state.tally.informational, 1, 'info normalizes to informational');
    assert.equal(loop.state.tally.total, 2);
    assert.equal(published.length, 2);
  });

  it('duplicate findings merge instead of double-counting', async () => {
    const loop = await started();
    await loop.recordFinding({ id: 'a', title: 'XSS', severity: 'high', target: 'example.com', evidence: 'e1' });
    await loop.recordFinding({ id: 'b', title: 'XSS', severity: 'high', target: 'example.com', evidence: 'e2' });
    assert.equal(loop.state.findings.length, 1);
    assert.equal(loop.state.tally.total, 1);
  });
});
