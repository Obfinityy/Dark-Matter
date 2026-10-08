/**
 * VoiceRound2.jsx — Infinity AI · Dark-Matter · Wave 49
 * 30 working React components for voice ideas 51921–51950 (voice round 2).
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './voiceRound2Core.js';

/* 51921 — Voice command permissions: enrolled voice required for destructive commands. */
export function VoiceCommandPermissions() {
  const [command, setCommand] = useState('stop hunt');
  const [enrolled, setEnrolled] = useState(false);
  const check = C.checkVoicePermission(command, { enrolled });
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51921 · Voice command permissions</h3>
      <input
        className="vr2-input"
        value={command}
        onChange={e => setCommand(e.target.value)}
        aria-label="command"
      />
      <label className="vr2-check">
        <input type="checkbox" checked={enrolled} onChange={e => setEnrolled(e.target.checked)} />{' '}
        voice enrolled
      </label>
      <p className="vr2-result">
        {check.allowed ? 'Allowed' : 'Blocked'} — {check.reason}
      </p>
    </div>
  );
}

/* 51922 — Voice audit trail: voice commands recorded in the immutable hunt log. */
export function VoiceAuditTrail() {
  const [log, setLog] = useState([]);
  const add = () => {
    const { log: next } = C.appendVoiceAuditEntry(
      log,
      'pause hunt',
      { name: 'owner', enrolled: true },
      'paused'
    );
    setLog(next);
  };
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51922 · Voice audit trail</h3>
      <button className="vr2-btn" onClick={add}>
        Log sample voice command
      </button>
      <ul className="vr2-list">
        {log.map((e, i) => (
          <li key={i} className="vr2-item">
            {e.ts} · {e.speaker} · “{e.command}” → {e.result}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51923 — Noisy-environment recognition tuning. */
export function VoiceNoisyEnvironments() {
  const [db, setDb] = useState(60);
  const profile = C.selectNoiseProfile(db);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51923 · Voice in noisy environments</h3>
      <input
        className="vr2-input"
        type="number"
        value={db}
        onChange={e => setDb(Number(e.target.value))}
        aria-label="ambient db"
      />
      <p className="vr2-result">
        {profile.profile} · +{profile.gainDb}dB · {profile.note}
      </p>
    </div>
  );
}

/* 51924 — Voice offline mode: on-device recognition for core commands. */
export function VoiceOfflineMode() {
  const [text, setText] = useState('pause hunt');
  const r = C.offlineRecognize(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51924 · Voice offline mode</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="transcript"
      />
      <p className="vr2-result">
        {r.recognized ? `Recognized on-device: ${r.command}` : 'Not a core command — needs network'}
      </p>
    </div>
  );
}

/* 51925 — Voice command chaining. */
export function VoiceCommandChaining() {
  const [text, setText] = useState('pause the hunt and take a snapshot');
  const steps = C.parseChainedCommand(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51925 · Voice command chaining</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="chained command"
      />
      <ol className="vr2-list">
        {steps.map(s => (
          <li key={s.order} className="vr2-item">
            {s.order}. {s.step}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* 51926 — Voice timers. */
export function VoiceTimers() {
  const [text, setText] = useState('pause for ten minutes, then resume');
  const t = C.parseVoiceTimer(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51926 · Voice timers</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="timer phrase"
      />
      <p className="vr2-result">
        {t.valid
          ? `Timer: ${t.minutes} min (${t.seconds}s) → ${t.action}`
          : 'Could not parse a timer'}
      </p>
    </div>
  );
}

/* 51927 — Voice during screen share. */
export function VoiceScreenShare() {
  const tokens = C.buildScreenShareTokens('dark-matter hunt');
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51927 · Voice during screen share</h3>
      <ul className="vr2-list">
        {tokens.map(t => (
          <li key={t.phrase} className="vr2-item">
            “{t.phrase}” — {t.effect}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51928 — Voice accessibility mode. */
export function VoiceAccessibilityMode() {
  const map = C.buildAccessibilityCommandMap();
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51928 · Voice accessibility mode</h3>
      <ul className="vr2-list">
        {map.map(m => (
          <li key={m.action} className="vr2-item">
            {m.action}: {m.phrases.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51929 — Voice command discovery from habits. */
export function VoiceCommandDiscovery() {
  const history = ['pause hunt', 'pause hunt', 'take snapshot', 'pause hunt', 'hunt status'];
  const suggestions = C.suggestCommands(history);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51929 · Voice command discovery</h3>
      <p className="vr2-result">Based on your habits, try:</p>
      <ul className="vr2-list">
        {suggestions.map(s => (
          <li key={s} className="vr2-item">
            “{s}”
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51930 — Voice feedback collection. */
export function VoiceFeedbackCollection() {
  const [state, setState] = useState({ log: [], accuracy: 1 });
  const vote = right => setState(C.recordVoiceFeedback(state.log, 'pause hunt', right));
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51930 · Voice feedback collection</h3>
      <p className="vr2-result">Was “pause hunt” recognized right?</p>
      <button className="vr2-btn" onClick={() => vote(true)}>
        Yes
      </button>
      <button className="vr2-btn" onClick={() => vote(false)}>
        No
      </button>
      <p className="vr2-result">
        Accuracy: {Math.round(state.accuracy * 100)}% ({state.log.length} votes)
      </p>
    </div>
  );
}

/* 51931 — Voice emergency stop. */
export function VoiceEmergencyStop() {
  const [text, setText] = useState('');
  const m = C.matchEmergencyStop(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51931 · Voice emergency stop</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="say: stop everything now"
        aria-label="kill phrase"
      />
      <p className="vr2-result">
        {m.triggered
          ? `EMERGENCY STOP — halting: ${m.halt.join(', ')}`
          : 'Kill phrase not detected'}
      </p>
    </div>
  );
}

/* 51932 — Voice whisper mode. */
export function VoiceWhisperMode() {
  const [energy, setEnergy] = useState(0.1);
  const w = C.applyWhisperMode(energy);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51932 · Voice whisper mode</h3>
      <input
        className="vr2-input"
        type="number"
        step="0.05"
        min="0"
        max="1"
        value={energy}
        onChange={e => setEnergy(Number(e.target.value))}
        aria-label="voice energy"
      />
      <p className="vr2-result">
        {w.whisper
          ? `Whisper detected — gain +${w.gainDb}dB, ${w.vocabulary}`
          : 'Normal voice level'}
      </p>
    </div>
  );
}

/* 51933 — Voice over phone call. */
export function VoicePhoneCall() {
  const menu = C.buildPhoneCallMenu();
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51933 · Voice over phone call</h3>
      <ul className="vr2-list">
        {menu.map(m => (
          <li key={m.key} className="vr2-item">
            Press {m.key} or say “{m.spoken}” — {m.action}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51934 — Voice smart-speaker integration. */
export function VoiceSmartSpeaker() {
  const intents = C.buildSmartSpeakerIntents();
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51934 · Voice smart-speaker integration</h3>
      <ul className="vr2-list">
        {intents.map(i => (
          <li key={i.intent} className="vr2-item">
            “{i.intent}” → {i.response}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51935 — Voice car mode. */
export function VoiceCarMode() {
  const cmds = C.buildCarModeCommands();
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51935 · Voice car mode</h3>
      <p className="vr2-result">Driver-safe minimal set:</p>
      <ul className="vr2-list">
        {cmds.map(c => (
          <li key={c} className="vr2-item">
            “{c}”
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51936 — Voice meeting mode. */
export function VoiceMeetingMode() {
  const update = C.buildMeetingModeUpdate({
    name: 'dark-matter hunt',
    status: 'running',
    findingsCount: 3,
    eta: '2h',
  });
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51936 · Voice meeting mode</h3>
      <p className="vr2-result">{update.discreetText}</p>
      <p className="vr2-note">Discreet: text only, vibration “{update.vibration}”</p>
    </div>
  );
}

/* 51937 — Voice command analytics. */
export function VoiceCommandAnalytics() {
  const ranking = C.rankVoiceCommands([
    'pause hunt',
    'pause hunt',
    'hunt status',
    'take snapshot',
    'pause hunt',
  ]);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51937 · Voice command analytics</h3>
      <ul className="vr2-list">
        {ranking.map(r => (
          <li key={r.command} className="vr2-item">
            {r.command} — {r.count}×
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51938 — Voice latency display. */
export function VoiceLatencyDisplay() {
  const now = Date.now();
  const l = C.computeVoiceLatency(now - 900, now - 300, now);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51938 · Voice latency display</h3>
      <p className="vr2-result">
        Recognition {l.recognitionMs}ms · Execution {l.executionMs}ms · Total {l.totalMs}ms
      </p>
    </div>
  );
}

/* 51939 — Voice fallback to text. */
export function VoiceTextFallback() {
  const [text, setText] = useState('pause hunt');
  const f = C.voiceToTextFallback(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51939 · Voice fallback to text</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="typed fallback"
      />
      <p className="vr2-result">{f.hint}</p>
    </div>
  );
}

/* 51940 — Voice bilingual commands (Hindi/English). */
export function VoiceBilingualCommands() {
  const [text, setText] = useState('hunt roko aur snapshot le lo');
  const n = C.normalizeBilingualCommand(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51940 · Voice bilingual commands</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="bilingual command"
      />
      <p className="vr2-result">
        Normalized: “{n.normalized}” ({n.language})
      </p>
    </div>
  );
}

/* 51941 — Voice finding triage. */
export function VoiceFindingTriage() {
  const [text, setText] = useState('mark that as false positive');
  const a = C.buildTriageAction(text, 'finding-123');
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51941 · Voice finding triage</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="triage phrase"
      />
      <p className="vr2-result">
        {a.findingId} → verdict: {a.verdict}
      </p>
    </div>
  );
}

/* 51942 — Voice approval delegation. */
export function VoiceApprovalDelegation() {
  const [text, setText] = useState('let Priya approve the next request');
  const d = C.parseDelegationCommand(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51942 · Voice approval delegation</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="delegation phrase"
      />
      <p className="vr2-result">
        {d.valid ? `Delegated to ${d.delegate} — scope: ${d.scope}` : 'Name not recognized'}
      </p>
    </div>
  );
}

/* 51943 — Voice hunt creation. */
export function VoiceHuntCreation() {
  const [text, setText] = useState('start a hunt on example.com');
  const h = C.parseHuntCreationCommand(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51943 · Voice hunt creation</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="hunt creation phrase"
      />
      <p className="vr2-result">
        {h.valid ? `Target: ${h.target} — confirm before start: yes` : 'No target found'}
      </p>
    </div>
  );
}

/* 51944 — Voice report narration. */
export function VoiceReportNarration() {
  const script = C.buildNarrationScript([
    { heading: 'Summary', summary: 'Three high-severity findings were verified.' },
    { heading: 'Findings', summary: 'XSS on the search endpoint is confirmed.' },
  ]);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51944 · Voice report narration</h3>
      <ol className="vr2-list">
        {script.map(s => (
          <li key={s.section} className="vr2-item">
            {s.heading}: {s.spoken}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* 51945 — Voice Q&A on logs. */
export function VoiceLogQA() {
  const [q, setQ] = useState('why did that test fail?');
  const logs = [{ message: 'test started' }, { message: 'Error: connection timed out on probe 7' }];
  const a = C.answerLogQuestion(logs, q);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51945 · Voice Q&A on logs</h3>
      <input
        className="vr2-input"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="log question"
      />
      <p className="vr2-result">{a.answer}</p>
    </div>
  );
}

/* 51946 — Voice confidence checks. */
export function VoiceConfidenceChecks() {
  const a = C.answerConfidenceQuestion({ confidence: 0.82, basis: 'verified exploit chain' });
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51946 · Voice confidence checks</h3>
      <p className="vr2-result">{a.spoken}</p>
    </div>
  );
}

/* 51947 — Voice resource queries. */
export function VoiceResourceQueries() {
  const [q, setQ] = useState('how much have we spent?');
  const a = C.answerResourceQuery(
    { spend: 12.4, budget: 50, elapsedMinutes: 90, apiCalls: 311 },
    q
  );
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51947 · Voice resource queries</h3>
      <input
        className="vr2-input"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="resource question"
      />
      <p className="vr2-result">{a.spoken}</p>
    </div>
  );
}

/* 51948 — Voice team coordination. */
export function VoiceTeamCoordination() {
  const [events, setEvents] = useState([
    { id: 'evt-1', name: 'finding verified', voiceMessages: [] },
  ]);
  const attach = () => {
    const { events: next } = C.attachVoiceMessage(
      events,
      'evt-1',
      'Priya, please double-check the XSS payload.'
    );
    setEvents(next);
  };
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51948 · Voice team coordination</h3>
      <button className="vr2-btn" onClick={attach}>
        Attach voice note to event
      </button>
      <ul className="vr2-list">
        {events.map(e => (
          <li key={e.id} className="vr2-item">
            {e.name}: {e.voiceMessages.length} voice note(s)
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51949 — Voice command sandbox: practice commands on a safe practice hunt. */
export function VoiceCommandSandbox() {
  const [cmd, setCmd] = useState('stop hunt');
  const r = C.sandboxCommand(cmd);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51949 · Voice command sandbox</h3>
      <input
        className="vr2-input"
        value={cmd}
        onChange={e => setCmd(e.target.value)}
        aria-label="sandbox command"
      />
      <p className="vr2-result">
        {r.command} → {r.result} (target: {r.executedOn})
      </p>
    </div>
  );
}

/* 51950 — Voice privacy mode. */
export function VoicePrivacyMode() {
  const [text, setText] = useState('the api key is abc123');
  const r = C.routePrivacyOutput(text);
  return (
    <div className="vr2-card">
      <h3 className="vr2-title">51950 · Voice privacy mode</h3>
      <input
        className="vr2-input"
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="readout text"
      />
      <p className="vr2-result">
        Routed to: {r.channel} ({r.reason})
      </p>
    </div>
  );
}

/* Gallery of all 30 voice round-2 components. */
export function VoiceRound2Gallery() {
  return (
    <div className="vr2-gallery">
      <VoiceCommandPermissions />
      <VoiceAuditTrail />
      <VoiceNoisyEnvironments />
      <VoiceOfflineMode />
      <VoiceCommandChaining />
      <VoiceTimers />
      <VoiceScreenShare />
      <VoiceAccessibilityMode />
      <VoiceCommandDiscovery />
      <VoiceFeedbackCollection />
      <VoiceEmergencyStop />
      <VoiceWhisperMode />
      <VoicePhoneCall />
      <VoiceSmartSpeaker />
      <VoiceCarMode />
      <VoiceMeetingMode />
      <VoiceCommandAnalytics />
      <VoiceLatencyDisplay />
      <VoiceTextFallback />
      <VoiceBilingualCommands />
      <VoiceFindingTriage />
      <VoiceApprovalDelegation />
      <VoiceHuntCreation />
      <VoiceReportNarration />
      <VoiceLogQA />
      <VoiceConfidenceChecks />
      <VoiceResourceQueries />
      <VoiceTeamCoordination />
      <VoiceCommandSandbox />
      <VoicePrivacyMode />
    </div>
  );
}
