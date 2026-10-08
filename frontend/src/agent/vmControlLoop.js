/**
 * vmControlLoop.js — STUB (integration placeholder).
 *
 * Interface contract (from the VM Control design, §6):
 *   createVmControlLoop({ runnerApi, brains: { hacker, vision, grounding }, sessionId, onEvent })
 *     → { start(task), pause(), resume(), stop(), ask(question) }
 *
 *   runnerApi — the vmRunnerApi module (or a compatible object with
 *     startVm(sessionId), vmStatus(sessionId), stopVm(sessionId)) so the
 *     loop can own the VM lifecycle.
 *   brains    — { hacker, vision, grounding } brain slots; the UI passes
 *     whatever is configured, the loop decides how to call them.
 *   onEvent   — ({ type, message, at, sessionId, ... }) event sink for the UI feed.
 *
 * Workstream 3 owns the REAL think→act→observe brain loop. This stub keeps
 * the Control UI compiling and lets the VM lifecycle (start/stop/status) be
 * exercised against the runner without brains. It NEVER fakes a brain
 * decision: ask() and the loop body honestly report that the brain loop
 * module is still being integrated.
 *
 * The coordinator reconciles this file with workstream 3's module at merge.
 */

import { startVm as defaultStartVm, vmStatus as defaultVmStatus, stopVm as defaultStopVm } from '../services/vmRunnerApi';

function makeSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `vm-${crypto.randomUUID()}`;
  return `vm-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function createVmControlLoop({ runnerApi, brains, sessionId: providedId, onEvent } = {}) {
  const emit = typeof onEvent === 'function' ? onEvent : () => {};
  const api = runnerApi || {};
  const apiStartVm = api.startVm || defaultStartVm;
  const apiVmStatus = api.vmStatus || defaultVmStatus;
  const apiStopVm = api.stopVm || defaultStopVm;
  const sessionId = providedId || makeSessionId();
  const state = {
    phase: 'idle', // idle | starting | running | paused | stopping | stopped | error
    task: '',
    startedAt: null
  };

  const say = (type, message, extra = {}) => emit({ type, message, at: new Date().toISOString(), sessionId, ...extra });

  async function pollUntilRunning(timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let st;
      try {
        st = await apiVmStatus(sessionId);
      } catch (err) {
        say('loop.error', `Could not read VM status: ${err.message || err}`);
        throw err;
      }
      say('loop.vm', `VM state: ${st.state}${st.uptimeS != null ? ` (up ${Math.round(st.uptimeS)}s)` : ''}`, { vmState: st.state });
      if (st.state === 'running') return st;
      if (st.state === 'error') throw new Error(st.detail || 'VM reported an error state');
      if (Date.now() > deadline) throw new Error('VM did not reach running state in time');
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  return {
    /** Session id for this loop (so the UI can attach viewers). */
    sessionId,
    /** Current phase. */
    getPhase: () => state.phase,

    /**
     * Start: boots the VM via the runner. The brain think→act→observe loop
     * is provided by workstream 3's module — this stub stops after boot and
     * waits for that module.
     */
    async start(task) {
      if (state.phase === 'starting' || state.phase === 'running') return;
      state.phase = 'starting';
      state.task = task || '';
      state.startedAt = new Date().toISOString();
      say('loop.started', `Starting the Infinity VM${task ? ` — task: ${task}` : ''}…`);
      try {
        await apiStartVm(sessionId);
        say('loop.vm', 'VM is booting…');
        await pollUntilRunning();
        state.phase = 'running';
        say('loop.ready',
          'The VM is running. The autonomous brain loop module (workstream 3) is being ' +
          'integrated — once it lands, the Hacking brain will take over here. ' +
          'Meanwhile you can use the terminal and watch the screen.');
      } catch (err) {
        state.phase = 'error';
        say('loop.error', `Could not start the VM: ${err.message || err}`, { hint: err.hint });
        throw err;
      }
    },

    /** Pause: agent decisions freeze; VM keeps running. */
    pause() {
      if (state.phase !== 'running') return;
      state.phase = 'paused';
      say('loop.paused', 'Agent paused — the VM keeps running. Screen input is unlocked while paused.');
    },

    /** Resume after pause. */
    resume() {
      if (state.phase !== 'paused') return;
      state.phase = 'running';
      say('loop.resumed', 'Agent resumed.');
    },

    /** Stop: power off the VM and release the session token. */
    async stop() {
      if (state.phase === 'idle' || state.phase === 'stopping') return;
      state.phase = 'stopping';
      say('loop.stopping', 'Stopping the VM…');
      try {
        await apiStopVm(sessionId, { poweroff: true });
      } catch (err) {
        say('loop.error', `Stop reported a problem: ${err.message || err}`);
      }
      state.phase = 'stopped';
      say('loop.stopped', 'The VM is stopped. The session is closed.');
    },

    /**
     * Mid-session question → answered by the Hacking brain in the real
     * module. The stub answers honestly instead of inventing one.
     */
    async ask(question) {
      const q = (question || '').trim();
      if (!q) return '';
      say('loop.ask', `You asked: ${q}`);
      const answer =
        'The brain loop module is still being integrated, so I cannot answer ' +
        'from a live Hacking brain yet. The VM itself is reachable — check the ' +
        'terminal and status line for what it is doing.';
      say('loop.answer', answer);
      return answer;
    }
  };
}

export { makeSessionId };
