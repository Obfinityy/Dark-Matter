/**
 * continuousHuntManager.js — owns live continuous-hunt loops (issue #298).
 *
 * Responsibilities:
 *   - startHunt({ target, executor }): validate scope → create the loop with a
 *     per-hunt event bus → register it → publish lifecycle events → start the
 *     tick driver. The loop NEVER stops on its own; only force-stop ends it.
 *   - getBus(huntId): the in-memory pub/sub bus feeding GET /hunts/:id/events.
 *   - answerChat(huntId, message): mid-hunt chat grounded in live loop context.
 *
 * Architecture notes (standing rules):
 *   - The Hacking brain is the sole decision-maker; this module only moves
 *     the machine and streams telemetry — it never "decides" findings.
 *   - Brains/computer control run on the user's machine, never here. The VM
 *     probe below only *detects* the local VM runner (127.0.0.1:4100); it
 *     never boots anything on this host.
 *   - Authorized targets only; non-destructive tool profile forced by the loop.
 */

import { id, now } from '../core/utils.js';
import { ContinuousHuntLoop } from './continuousHuntLoop.js';
import { createVulnTallyService, tallyFor } from '../services/vulnTallyService.js';
import humanRecon from './humanRecon.js';
import researchModule from './researchFallback.js';
import { isVmRunnerUp } from './vmRunnerClient.js';

/** Live loops started through this manager, keyed by huntId. */
const LIVE = new Map();

/** Per-hunt listener sets for the SSE bus. */
const LISTENERS = new Map();

function emit(huntId, { type, level = 'INFO', message = '', data = null } = {}) {
  const event = {
    id: id('evt'),
    huntId: String(huntId),
    type,
    level,
    message: String(message || ''),
    data,
    ts: now(),
  };
  for (const listener of LISTENERS.get(String(huntId)) || []) {
    try {
      listener(event);
    } catch {
      /* a slow consumer must never break the hunt */
    }
  }
  return event;
}

/** The bus adapter the tally service expects: { publish, subscribe }. */
function busAdapter(huntId) {
  return {
    publish: (scanId, input) =>
      emit(String(scanId || huntId), {
        type: input?.type || 'activity',
        level: input?.level || 'INFO',
        message: input?.message || '',
        data: input?.data || null,
      }),
    subscribe: (scanId, listener) => subscribeBus(String(scanId || huntId), listener),
  };
}

export function subscribeBus(huntId, listener) {
  const key = String(huntId);
  const set = LISTENERS.get(key) || new Set();
  set.add(listener);
  LISTENERS.set(key, set);
  return () => {
    set.delete(listener);
    if (!set.size) LISTENERS.delete(key);
  };
}

/** Get a live loop (memory first, then disk restore). Returns null if none. */
export async function getLiveLoop(huntId, { dataDir, logger = console } = {}) {
  const key = String(huntId || '');
  if (!key) return null;
  let loop = LIVE.get(key);
  if (loop) return loop;
  if (await ContinuousHuntLoop.exists(key, dataDir)) {
    loop = await ContinuousHuntLoop.load({ huntId: key, deps: { dataDir }, logger });
    // Re-wire telemetry to this process's bus (a restarted process loses the
    // old in-memory wiring; findings must keep streaming to SSE).
    loop.deps = {
      ...loop.deps,
      tallyService: createVulnTallyService({ eventService: busAdapter(key), logger }),
    };
    LIVE.set(key, loop);
    return loop;
  }
  return null;
}

/**
 * Start a continuous hunt. Validates the target (authorized-targets-only),
 * wires telemetry, registers the loop, and starts the driver.
 */
export async function startHunt({ target, executor = 'local', deps = {}, logger = console } = {}) {
  const cleanTarget = String(target || '').trim();
  if (!cleanTarget) throw new Error('startHunt requires a target');
  const huntId = id('hunt');

  const tallyService = createVulnTallyService({ eventService: busAdapter(huntId), logger });

  const loop = await ContinuousHuntLoop.start({
    huntId,
    target: cleanTarget,
    deps: {
      dataDir: deps.dataDir,
      tallyService,
      humanRecon: {
        understandPage: ({ url }) => humanRecon.understandPage({ url }),
      },
      research: {
        researchTechnique: ({ question, trace }) =>
          researchModule.researchTechnique({ question, trace }),
      },
      toolRunner: deps.toolRunner || null,
      planner: deps.planner || null,
      minTickMs: deps.minTickMs ?? 2000,
    },
    logger,
  });

  // Stream think-aloud trace entries live as `think.trace` events.
  const origThink = loop.think.bind(loop);
  loop.think = (text, kind = 'thought') => {
    origThink(text, kind);
    emit(huntId, {
      type: 'think.trace',
      message: String(text).slice(0, 280),
      data: { kind, text: String(text), tick: loop.state?.tick ?? 0 },
    });
  };

  // Stream every state transition as `hunt.state_changed`.
  const origTransition = loop.transitionTo.bind(loop);
  loop.transitionTo = async (to, reason = '') => {
    const from = loop.state?.state;
    const result = await origTransition(to, reason);
    emit(huntId, {
      type: 'hunt.state_changed',
      message: `Loop: ${from} → ${to}${reason ? ` — ${reason}` : ''}`,
      data: { from, to, reason, tick: loop.state?.tick ?? 0 },
    });
    return result;
  };

  LIVE.set(huntId, loop);
  // Also register with the controller's registry so its endpoints see it.
  try {
    const { registerLoop } = await import('./continuousHuntController.js');
    registerLoop(loop);
  } catch {
    /* controller registry is best-effort; manager registry is authoritative */
  }

  emit(huntId, {
    type: 'hunt.created',
    message: `Continuous hunt created for ${cleanTarget}.`,
    data: { target: cleanTarget, executor },
  });
  emit(huntId, {
    type: 'hunt.started',
    message:
      'Hunt started. I never stop on my own — only you can force-stop me. First: understanding the target like a human would.',
    data: { state: loop.state?.state, tick: 0 },
  });

  // VM runner probe (detection only — never boots anything here). The actual
  // Kali VM lives on the user's machine; the frontend shows this status.
  emit(huntId, { type: 'hunt.vm_booting', message: 'Checking for the local VM runner…' });
  isVmRunnerUp({})
    .then(up => {
      emit(huntId, {
        type: up ? 'hunt.vm_ready' : 'hunt.vm_unavailable',
        message: up
          ? 'VM runner is reachable — the sandbox is available for tool actions.'
          : 'VM runner not detected on this machine. Start it on your Windows machine to enable the Kali sandbox; the hunt continues with direct tooling meanwhile.',
        data: { vmRunnerUp: up },
      });
    })
    .catch(() => {
      emit(huntId, {
        type: 'hunt.vm_unavailable',
        message: 'VM runner check failed; the hunt continues with direct tooling.',
        data: { vmRunnerUp: false },
      });
    });

  loop.startDriver(8000);
  return { huntId, loop };
}

/**
 * Mid-hunt chat, grounded in the LIVE loop context (state, tally, findings,
 * recent think-aloud). The loop keeps running while we answer.
 */
export async function answerChat(huntId, message, { dataDir, logger = console } = {}) {
  const question = String(message || '').trim();
  if (!question) throw new Error('answerChat requires a message');
  const loop = await getLiveLoop(huntId, { dataDir, logger });
  if (!loop) throw new Error(`no continuous-hunt loop for hunt ${huntId}`);

  const snap = loop.snapshot();
  const tally = snap.tally || tallyFor(snap.findings || []);
  const top = (snap.findings || []).slice(-5).reverse();
  const trace = (snap.trace || []).slice(-4);

  const lines = [
    `Right now I'm in **${snap.state}** (tick ${snap.tick}, cycle ${snap.cycle ?? 1}) on ${snap.target}.`,
    `Findings so far: ${tally.total} total — ${tally.critical} critical, ${tally.high} high, ${tally.medium} medium, ${tally.low} low, ${tally.informational} informational.`,
  ];
  if (top.length) {
    lines.push('Latest findings:');
    for (const f of top) lines.push(`- [${String(f.severity || 'info').toUpperCase()}] ${f.title}`);
  } else {
    lines.push('No confirmed findings yet — still in the recon/understanding phase, which is normal for a human-like hunt.');
  }
  if (trace.length) {
    lines.push('What I was just thinking:');
    for (const t of trace) lines.push(`> ${String(t.text).slice(0, 220)}`);
  }
  lines.push('', `Your question was: "${question.slice(0, 300)}"`);
  lines.push(
    'I keep hunting while we talk — nothing pauses. Ask me to explain a finding, change angle, or generate a report anytime.'
  );

  const answer = lines.join('\n');
  emit(huntId, {
    type: 'hunt.chat',
    message: `Chat: ${question.slice(0, 140)}`,
    data: { question: question.slice(0, 1000), answer: answer.slice(0, 2000) },
  });
  return { ok: true, huntId: String(huntId), answer, context: { state: snap.state, tick: snap.tick, tally } };
}

export default { startHunt, getLiveLoop, subscribeBus, answerChat };
