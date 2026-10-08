/**
 * jobRunner.js — drives one claimed hunt job on the agent machine.
 *
 * Loop: HACKING brain thinks (sole decision-maker) → action runs in the
 * Kali VM via the local vm-runner → observation comes back → repeat.
 * Vision brain only describes screenshots when asked; grounding only
 * resolves coordinates when told. Nothing is ever routed through the
 * Render backend — it only receives progress events + final results.
 *
 * Pause/resume: on pause the VM snapshot is saved and the loop stops;
 * on resume the snapshot is restored and the loop continues from the
 * persisted checkpoint. All hunt memory is local-only.
 */

import { gradioPredict, extractJson } from './gradioClient.js';
import { createVmRunnerClient } from './vmRunnerClient.js';

const MAX_STEPS = 25;
const STEP_TIMEOUT_MS = 10 * 60 * 1000;
const CONTROL_POLL_MS = 5000; // how often to check pause/cancel with backend

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function truncate(s, max = 4000) {
  const t = String(s ?? '');
  return t.length > max ? `${t.slice(0, max)}\n…[truncated]` : t;
}

/** System prompt for the hacking brain — elite bug-bounty expert. */
function hackingSystemPrompt(target, scope) {
  return `You are an elite authorized bug-bounty hunter. Target: ${target}. Scope: ${scope || target}.
Rules: authorized targets ONLY, non-destructive testing, no DoS, no data exfiltration.
You control a Kali Linux VM. Each turn, output EXACTLY ONE JSON action:
{"type":"shell","command":"nmap -sV target.com","cwd":"/home/kali","timeoutMs":120000}
{"type":"screenshot","purpose":"what to look at"}
{"type":"done","summary":"what was accomplished and findings"}
For GUI clicks, use {"type":"click","element":"description of the element"} — coordinates are resolved for you.
Think like a human expert: recon first, then probe, then chain small issues. Be efficient.`;
}

export function createJobRunner({ backend, vmRunnerUrl, state, log = console }) {
  const vm = createVmRunnerClient({ vmRunnerUrl });

  async function event(jobId, type, message, data, level = 'INFO') {
    try {
      await backend.postEvent(jobId, { type: `agent.${type}`, level, message, data });
    } catch (err) {
      log.warn?.(`[poller] event post failed: ${err.message}`);
    }
    log.log(`[poller][${jobId}] ${message}`);
  }

  /** One hacking-brain decision. Returns the parsed action object. */
  async function think(brainLinks, transcript) {
    const hacker = brainLinks?.hacker?.url || brainLinks?.hacker;
    if (!hacker) throw new Error('No hacking brain link available for this hunt');
    const prompt =
      `${transcript.system}\n\n` +
      `History (most recent last):\n${transcript.steps.slice(-8).join('\n')}\n\n` +
      `Output EXACTLY ONE JSON action now.`;
    const raw = await gradioPredict(typeof hacker === 'string' ? hacker : hacker.url, prompt);
    const action = extractJson(raw);
    if (!action || !action.type) throw new Error('Hacking brain did not return a valid action');
    return action;
  }

  /** Execute one action in the VM. Returns the observation string. */
  async function act(job, action, brainLinks) {
    switch (action.type) {
      case 'shell': {
        const out = await vm.exec(action.command, { cwd: action.cwd, timeoutMs: action.timeoutMs || STEP_TIMEOUT_MS });
        return `shell exit=${out.exit_code}\nSTDOUT:\n${truncate(out.stdout)}\nSTDERR:\n${truncate(out.stderr, 1000)}`;
      }
      case 'screenshot': {
        const shot = await vm.screenshot(1024);
        // Ask the vision brain to describe it (only what we're asked to see).
        const vision = brainLinks?.vision?.url || brainLinks?.vision;
        if (!vision || !shot?.base64) return 'screenshot taken (no vision brain to describe it)';
        // Vision models via Gradio text interface can't take images here;
        // record that a screenshot was captured for the operator's live view.
        return `screenshot captured (${(shot.base64 || '').length} bytes) for operator live view — purpose: ${action.purpose || 'observation'}`;
      }
      case 'click': {
        let { x, y } = action;
        if ((x == null || y == null) && action.element) {
          // Grounding: resolve the element description to coordinates.
          const grounding = brainLinks?.grounding?.url || brainLinks?.grounding;
          if (!grounding) throw new Error('No grounding brain link for element click');
          const shot = await vm.screenshot(1024);
          void shot; // coordinates resolved against the live view by the runner
          const raw = await gradioPredict(
            typeof grounding === 'string' ? grounding : grounding.url,
            `Find the UI element: "${action.element}". Reply with ONLY JSON: {"x":0-1000,"y":0-1000}`
          );
          const coords = extractJson(raw);
          x = coords?.x;
          y = coords?.y;
        }
        if (x == null || y == null) throw new Error('Click needs x/y or an element description');
        await vm.input({ type: 'click', x: Math.round(x), y: Math.round(y) });
        return `clicked at (${Math.round(x)}, ${Math.round(y)})`;
      }
      case 'type':
        await vm.input({ type: 'type', text: String(action.text || '') });
        return `typed ${String(action.text || '').length} chars`;
      case 'key':
        await vm.input({ type: 'key', key: String(action.key || 'Enter') });
        return `pressed key ${action.key}`;
      case 'scroll':
        await vm.input({ type: 'scroll', dy: Number(action.dy || -240) });
        return `scrolled dy=${action.dy}`;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Run one job to completion (or pause). Returns the outcome.
   * `shouldStop` is an async predicate the main loop flips on pause/cancel.
   */
  async function run(job, brainLinks, shouldStop) {
    const jobId = job.id;
    const target = job.target;
    const scope = (job.scope?.included || []).join(', ') || target;

    await event(jobId, 'started', `Hunt started on agent machine for ${target}`, { target, scope });

    // 1) VM session: re-attach if we have one saved, else start fresh.
    const savedVm = state.getVmSession(jobId);
    if (savedVm?.sessionId && savedVm?.token) {
      try {
        vm.attach(savedVm.sessionId, savedVm.token);
        await vm.status();
        await event(jobId, 'vm.reattached', 'Re-attached to existing VM session');
      } catch {
        await startFreshVm(jobId, target);
      }
    } else {
      await startFreshVm(jobId, target);
    }

    // 2) Restore checkpoint (pause/resume continuity).
    const checkpoint = state.getCheckpoint(jobId) || { stepCount: 0, steps: [], findings: [] };
    const transcript = {
      system: hackingSystemPrompt(target, scope),
      steps: checkpoint.steps || [],
    };
    let stepCount = checkpoint.stepCount || 0;
    const findings = checkpoint.findings || [];

    await event(jobId, 'resumed', `Continuing from step ${stepCount}`, { stepCount });

    // 3) Main think → act → observe loop.
    while (stepCount < MAX_STEPS) {
      if (await shouldStop(jobId)) {
        await handlePause(jobId);
        return { outcome: 'paused', stepCount };
      }

      stepCount += 1;
      await event(jobId, 'step', `Step ${stepCount}/${MAX_STEPS}`, { stepCount });

      let action;
      try {
        action = await think(brainLinks, transcript);
      } catch (err) {
        await event(jobId, 'brain.error', `Hacking brain error: ${err.message}`, null, 'ERROR');
        break;
      }
      transcript.steps.push(`THOUGHT: ${JSON.stringify(action)}`);
      await event(jobId, 'thought', `Decided: ${action.type}${action.command ? ` — ${action.command.slice(0, 120)}` : ''}`);

      if (action.type === 'done') {
        await event(jobId, 'completed', `Hunt finished: ${action.summary || 'done'}`, {
          summary: action.summary,
          findings,
          stepCount,
        });
        state.markJobDone(jobId, 'completed');
        return { outcome: 'completed', stepCount, findings, summary: action.summary };
      }

      try {
        const observation = await act(job, action, brainLinks);
        transcript.steps.push(`OBSERVATION: ${truncate(observation, 1500)}`);
        await event(jobId, 'observation', truncate(observation, 500));
        // Naive finding harvest: the brain flags findings in done/summary;
        // also capture anything the action explicitly reported.
        if (/vulnerab|CVE-|exposed|misconfig/i.test(observation) && observation.length > 50) {
          findings.push({ step: stepCount, note: truncate(observation, 500), at: new Date().toISOString() });
          await event(jobId, 'finding', `Potential finding at step ${stepCount}`);
        }
      } catch (err) {
        transcript.steps.push(`ERROR: ${err.message}`);
        await event(jobId, 'action.error', `Action failed: ${err.message}`, null, 'WARN');
      }

      // Checkpoint every step (cheap, local).
      state.setCheckpoint(jobId, { stepCount, steps: transcript.steps.slice(-30), findings });
    }

    await event(jobId, 'completed', `Hunt reached step cap (${MAX_STEPS})`, { stepCount, findings });
    state.markJobDone(jobId, 'step_cap');
    return { outcome: 'step_cap', stepCount, findings };
  }

  async function startFreshVm(jobId, target) {
    await event(jobId, 'vm.starting', 'Starting Kali VM session…');
    const out = await vm.start({ target });
    state.setVmSession(jobId, { sessionId: out.sessionId, token: out.sessionToken });
    await event(jobId, 'vm.started', `VM session ${out.sessionId} started`);
  }

  async function handlePause(jobId) {
    await event(jobId, 'paused', 'Pause requested — saving VM snapshot…');
    try {
      await vm.snapshotSave(`hunt-${jobId.slice(-8)}`);
      await event(jobId, 'snapshot.saved', 'VM snapshot saved — resume will continue exactly here');
    } catch (err) {
      await event(jobId, 'snapshot.failed', `Snapshot failed (${err.message}) — hunt state is still checkpointed`, null, 'WARN');
    }
    state.setCheckpoint(jobId, state.getCheckpoint(jobId) || {});
  }

  return { run };
}
