// oneLoopBrain.js — backend brain provider: the deterministic one-loop brain,
// one subprocess call per hunt turn.
//
// Rule #40 (BACKEND-CALLABLE BRAIN). The backend's hunt loop calls brainTurn()
// once per iteration instead of chatWithAI(); the python one-loop brain
// (brain-turn.py -> brain-apiloop-v1.py) decides AND executes the turn's probes
// itself, keeps its own per-hunt 3-file memory on disk, and answers with ONE
// JSON summary line. The backend keeps zero in-memory brain state: turn N+1 is
// valid iff turn N's summary said ok:true.
//
// Drop-in: copy to backend/src/brain/oneLoopBrain.js (ESM, no dependencies).
// Wiring into humanLoop.js is a later rule; this file + brain-turn.py are the
// proven seam. Claims stay local-only in the memdir (backend claim bridge is
// a later rule).
//
// Env gate: BRAIN_PROVIDER=oneloop enables; anything else keeps the current
// LLM path. Default python timeout 10 min covers the 300s blind-sqli budget.

import { spawn } from 'node:child_process';

export const SUMMARY_PREFIX = 'TURNSUMMARY: ';
export const DEFAULT_TURN_TIMEOUT_MS = 600000; // 10 min > 300s blind-sqli probe

export function isOneLoopEnabled(env = process.env) {
  return env.BRAIN_PROVIDER === 'oneloop';
}

/**
 * Run exactly one brain turn.
 * @returns {Promise<object>} the TURNSUMMARY object: {ok:true, turn, task,
 *   action_type, verdict, completed, ...} or {ok:false, error, ...}.
 *   Fail-closed: timeout, spawn failure, missing/garbled summary all resolve
 *   ok:false — the caller must never advance the hunt on ok:false.
 */
export function brainTurn({
  pythonBin = 'python3',
  script,
  memdir,
  goal,
  targetBase,
  timeoutMs = DEFAULT_TURN_TIMEOUT_MS,
} = {}) {
  if (!script || !memdir || !goal || !targetBase || !String(targetBase).trim()) {
    return Promise.resolve({ ok: false, error: 'BRAIN_TURN_BAD_ARGS' });
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    let child;
    try {
      child = spawn(pythonBin, [
        script,
        '--memdir', String(memdir),
        '--goal', String(goal),
        '--target-base', String(targetBase).trim(),
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      done({ ok: false, error: 'BRAIN_TURN_SPAWN: ' + e.message });
      return;
    }
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.stderr.on('data', (d) => { err += String(d); });
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      done({ ok: false, error: 'BRAIN_TURN_TIMEOUT_MS=' + timeoutMs,
             stderrTail: err.slice(-500) });
    }, timeoutMs);
    // fail-closed: never hold the timer open after the promise settles
    if (typeof timer.unref === 'function') timer.unref();
    child.on('error', (e) => done({ ok: false, error: 'BRAIN_TURN_SPAWN: ' + e.message }));
    child.on('close', (code) => {
      const line = out.split('\n').reverse()
        .find((l) => l.startsWith(SUMMARY_PREFIX));
      if (!line) {
        done({ ok: false, error: 'BRAIN_TURN_NO_SUMMARY', exitCode: code,
               stderrTail: err.slice(-500), stdoutTail: out.slice(-500) });
        return;
      }
      let s;
      try {
        s = JSON.parse(line.slice(SUMMARY_PREFIX.length));
      } catch (e) {
        done({ ok: false, error: 'BRAIN_TURN_BAD_JSON: ' + e.message });
        return;
      }
      if (!s || typeof s !== 'object' || typeof s.ok !== 'boolean') {
        done({ ok: false, error: 'BRAIN_TURN_BAD_SHAPE' });
        return;
      }
      if (s.ok && (!Number.isInteger(s.turn) || s.turn < 1)) {
        done({ ok: false, error: 'BRAIN_TURN_BAD_TURN' });
        return;
      }
      s.exitCode = code;
      done(s);
    });
  });
}
