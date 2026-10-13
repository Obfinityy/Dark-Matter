// Mid-hunt chat.
//
//   POST /api/v1/chat {message, huntId?} -> {reply}
//
// If huntId is given, the reply is enriched with live hunt status context from
// the engine plus cached findings. Steering commands in plain text are mapped
// to hunt actions:
//   "pause the hunt" / "pause"     -> pauseEngineHunt
//   "resume" / "continue the hunt" -> resumeEngineHunt
//   "stop" / "stop the hunt"       -> stopEngineHunt
//   "what did you find" / "findings" / "status" / "what are you doing"
//                                  -> summary of cached + live hunt state
// Anything else gets a context-aware acknowledgement (no external LLM key is
// required for this endpoint; richer generation is a frontend/plugin concern).

import { Router } from 'express';
import {
  EngineUnreachableError,
  getEngineHunt,
  getEngineEvents,
  pauseEngineHunt,
  resumeEngineHunt,
  stopEngineHunt,
} from '../engine.js';
import { readHuntEvents, readHuntMeta } from '../store.js';
import { recordEngineEvent } from './hunts.js';

const router = Router();

function detectSteering(message) {
  const m = String(message || '').toLowerCase();
  if (/\b(pause|hold|freeze)\b/.test(m) && /\b(hunt|it|scan)\b|\bpause\b/.test(m)) return 'pause';
  if (/\b(resume|continue|carry on)\b/.test(m)) return 'resume';
  if (/\b(stop|abort|cancel|kill)\b/.test(m) && /\b(hunt|scan|it)\b/.test(m)) return 'stop';
  if (/\b(what did you find|findings?|what('s| is) the status|status|progress|what are you (doing|up to)|summary)\b/.test(m))
    return 'summary';
  return null;
}

router.post('/', async (req, res) => {
  const { message, huntId } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'missing_message' });
  }

  const action = detectSteering(message);

  // No hunt context: answer steering only generically.
  if (!huntId) {
    if (action === 'pause' || action === 'resume' || action === 'stop') {
      return res.json({
        ok: true,
        reply:
          `I don't have a hunt attached to this chat. Open a hunt and chat from its view ` +
          `to ${action} it mid-hunt.`,
      });
    }
    if (action === 'summary') {
      return res.json({
        ok: true,
        reply: 'There is no hunt in context for this chat. Start a hunt first, then ask me about it.',
      });
    }
    return res.json({
      ok: true,
      reply:
        'Noted. Start or open a hunt and I can answer mid-hunt — ask "what did you find", ' +
        'or tell me to "pause the hunt" / "stop the hunt" while one is running.',
    });
  }

  // Hunt context: enrich with live status + live findings + cached events.
  let live = null;
  let liveError = null;
  let events = readHuntEvents(huntId);
  try {
    live = await getEngineHunt(huntId);
    // Pull fresh engine events so mid-hunt summaries see findings even when
    // no WS client has been caching the stream.
    try {
      const fresh = await getEngineEvents(huntId, 0);
      const seen = new Set(events.map((e) => e.seq).filter((s) => typeof s === 'number'));
      for (const ev of fresh) {
        if (typeof ev.seq === 'number' && seen.has(ev.seq)) continue;
        recordEngineEvent(huntId, ev);
        events.push(ev);
        if (typeof ev.seq === 'number') seen.add(ev.seq);
      }
    } catch {
      // event pull is best-effort; the status snapshot above is what matters
    }
  } catch (err) {
    liveError = err instanceof EngineUnreachableError ? err.message : String(err.message || err);
  }
  const cached = events;
  const meta = readHuntMeta(huntId);
  const findings = cached.filter((e) => e.type === 'finding');

  const ctx = huntContextLine({ huntId, meta, live, liveError, cached, findings });

  try {
    if (action === 'pause') {
      await pauseEngineHunt(huntId);
      return res.json({ ok: true, action: 'pause', reply: `Hunt paused. ${ctx}` });
    }
    if (action === 'resume') {
      await resumeEngineHunt(huntId);
      return res.json({ ok: true, action: 'resume', reply: `Hunt resumed. ${ctx}` });
    }
    if (action === 'stop') {
      await stopEngineHunt(huntId);
      return res.json({ ok: true, action: 'stop', reply: `Hunt stopped. ${ctx}` });
    }
    if (action === 'summary') {
      return res.json({ ok: true, reply: summaryReply({ ctx, live, liveError, cached, findings }) });
    }
    return res.json({
      ok: true,
      reply: `On it. ${ctx} You can ask "what did you find", or say "pause the hunt" / "stop the hunt".`,
    });
  } catch (err) {
    if (err instanceof EngineUnreachableError) {
      return res.status(502).json({
        ok: false,
        error: 'engine_unreachable',
        message: `Could not ${action} the hunt: ${err.message}`,
      });
    }
    return res.status(500).json({ ok: false, error: 'internal_error', message: String(err.message || err) });
  }
});

function huntContextLine({ huntId, meta, live, liveError, cached, findings }) {
  const target = (live && live.target) || (meta && meta.target) || 'unknown target';
  const state = (live && (live.state || live.status)) || 'unknown';
  const step = live && (live.stepCount ?? live.step_count);
  const phase = live && live.phase;
  let line = `Hunt ${huntId} on ${target}: state=${state}`;
  if (phase) line += `, phase=${phase}`;
  if (step !== undefined && step !== null) line += `, step=${step}`;
  line += `, ${findings.length} finding(s) and ${cached.length} event(s) cached locally`;
  if (liveError) line += `. Live engine unreachable (${liveError}) — showing cached data only`;
  return line + '.';
}

function summaryReply({ ctx, live, liveError, cached, findings }) {
  const thinking = cached.filter((e) => e.type === 'thinking');
  const lastThink = thinking.length ? thinking[thinking.length - 1] : null;
  let reply = ctx;
  if (findings.length) {
    reply += ` Top findings so far: ` + findings.slice(0, 5).map((f, i) => {
      const sev = f.severity || f.level || 'info';
      const title = f.title || f.name || f.type || 'finding';
      return `${i + 1}. [${sev}] ${title}`;
    }).join('; ');
    if (findings.length > 5) reply += ` (+${findings.length - 5} more — ask for the full report)`;
  } else {
    reply += ' No findings recorded yet.';
  }
  if (lastThink && (lastThink.text || lastThink.summary)) {
    reply += ` Latest thinking: ${String(lastThink.text || lastThink.summary).slice(0, 280)}`;
  }
  if (liveError) reply += ' (live engine unreachable — cached snapshot only).';
  return reply;
}

export default router;
