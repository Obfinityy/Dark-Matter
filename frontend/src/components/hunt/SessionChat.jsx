/**
 * SessionChat.jsx — wave 27 (ideas 51041–51060): chat session persistence
 * layer components with real local state.
 *
 * All behavior is local and functional (no backend calls, no mock-data
 * fakery — each demo drives real state). No decorative animations, per the
 * owner's zero-animation order.
 */
import React, { useMemo, useState } from 'react';
import {
  WAVE27_IDEAS,
  serializeSession, restoreSession,
  markRead, unreadAlerts,
  pinMemoryNote, unpinMemoryNote,
  compareHunts,
  detectStopPhrase, STOP_PHRASE_DEFAULT,
  pacingLevel, shouldReduceProactivity, PACING_NORMAL,
  handoffBrief,
  QUESTION_TEMPLATES, applyTemplate,
  REPLY_LENGTHS, REPLY_TERSE, REPLY_BALANCED, REPLY_DETAILED, applyReplyLength,
  unfurlUrl,
  pushHistory, recallHistory,
  appendWorkingNote,
  parseTriageCommand, TRIAGE_FALSE_POSITIVE,
  CHECKIN_INTERVALS_MIN, nextCheckin,
  escalateAnswer, resolveEscalation, ESCALATION_OPEN,
  TECH_MODE, PLAIN_MODE, toggleTechMode,
  footnoteEvidence,
  agentTabs, routeToAgentTab, COORDINATOR_TAB,
  auditLogAppend, verifyAuditLog,
  HUNT_TONES, HUNT_TONE_PROFESSIONAL, withHuntTone,
} from './sessionCore.js';

export function SessionRestoreBanner({ snapshot, onRestore, onDismiss }) {
  const restored = snapshot ? restoreSession(snapshot) : null;
  if (!restored) return null;
  return (
    <div className="sess27-card" data-testid="restore-banner">
      <strong>Previous session found</strong>
      <p>{restored.messages.length} messages from hunt {restored.huntId || 'unknown'} — resume where you left off?</p>
      <button type="button" onClick={() => onRestore && onRestore(restored)}>Restore session</button>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

export function ReadReceipts({ messages }) {
  const [readIds, setReadIds] = useState([]);
  const unread = unreadAlerts(messages, readIds);
  return (
    <div className="sess27-card" data-testid="read-receipts">
      <strong>Read receipts</strong>
      <p>{unread.length} unread alert{unread.length === 1 ? '' : 's'}</p>
      <ul>
        {(messages || []).map((m) => (
          <li key={m.id}>
            <span>{readIds.includes(m.id) ? '✓' : '○'} {m.text}</span>
            {!readIds.includes(m.id) && (
              <button type="button" onClick={() => setReadIds(markRead(readIds, m.id))}>Mark read</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MemoryNotesPanel() {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  return (
    <div className="sess27-card" data-testid="memory-notes">
      <strong>Agent memory notes</strong>
      <div>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder='e.g. remember this for later: admin panel at /admin' aria-label="Memory note" />
        <button type="button" onClick={() => { setNotes(pinMemoryNote(notes, draft, 0)); setDraft(''); }}>Pin note</button>
      </div>
      <ul>{notes.map((n) => (
        <li key={n.id}>{n.text} <button type="button" onClick={() => setNotes(unpinMemoryNote(notes, n.id))}>Unpin</button></li>
      ))}</ul>
    </div>
  );
}

export function CrossHuntCompare() {
  const [result, setResult] = useState(null);
  const run = () => setResult(compareHunts(
    { findings: 14, criticals: 3, coverage: 72, durationMin: 95 },
    { findings: 11, criticals: 2, coverage: 64, durationMin: 110 },
  ));
  return (
    <div className="sess27-card" data-testid="cross-hunt">
      <strong>Cross-hunt comparison</strong>
      <button type="button" onClick={run}>Compare with previous hunt</button>
      {result && <p>{result.summary}</p>}
    </div>
  );
}

export function EmergencyStop({ phrase = STOP_PHRASE_DEFAULT, onStop }) {
  const [input, setInput] = useState('');
  const [stopped, setStopped] = useState(false);
  const check = () => {
    if (detectStopPhrase(input, phrase)) { setStopped(true); onStop && onStop(); }
  };
  return (
    <div className="sess27-card" data-testid="emergency-stop">
      <strong>Emergency stop</strong>
      <p>Phrase: <code>{phrase}</code></p>
      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()} placeholder="Type here…" aria-label="Stop phrase input" />
      <button type="button" onClick={check}>Send</button>
      {stopped && <p role="alert">Hunt paused instantly.</p>}
    </div>
  );
}

export function PacingIndicator() {
  const [replies, setReplies] = useState([]);
  const [draft, setDraft] = useState('');
  const level = pacingLevel(replies);
  return (
    <div className="sess27-card" data-testid="pacing">
      <strong>Pacing awareness</strong>
      <p>Current pacing: <code>{level}</code>{shouldReduceProactivity(level) ? ' — proactivity reduced' : ''}</p>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Simulate your reply…" aria-label="Reply simulator" />
      <button type="button" onClick={() => { setReplies([...replies, draft]); setDraft(''); }}>Add reply</button>
    </div>
  );
}

export function HandoffBriefCard({ huntId, phase }) {
  const [brief, setBrief] = useState('');
  return (
    <div className="sess27-card" data-testid="handoff-brief">
      <strong>Handoff brief generator</strong>
      <button type="button" onClick={() => setBrief(handoffBrief({
        huntId, phase, findings: 14,
        openBlockers: ['WAF blocking /admin fuzzing'],
        memoryNotes: ['admin panel at /admin-console'],
        nextSteps: ['Finish authenticated crawl', 'Verify SSRF candidate'],
      }))}>Generate brief</button>
      {brief && <pre>{brief}</pre>}
    </div>
  );
}

export function QuestionTemplates({ onUse }) {
  return (
    <div className="sess27-card" data-testid="question-templates">
      <strong>Saved question templates</strong>
      <ul>{QUESTION_TEMPLATES.map((t) => (
        <li key={t.id}><button type="button" onClick={() => onUse && onUse(applyTemplate(t.id))}>{t.label}</button></li>
      ))}</ul>
    </div>
  );
}

export function ReplyLengthSlider() {
  const [mode, setMode] = useState(REPLY_BALANCED);
  const sample = 'Found 3 critical issues. The admin panel leaks version info. Recommend immediate patching of the auth bypass.';
  return (
    <div className="sess27-card" data-testid="reply-length">
      <strong>Reply length</strong>
      <div role="radiogroup" aria-label="Reply length">
        {REPLY_LENGTHS.map((m) => (
          <label key={m}><input type="radio" name="replylen" checked={mode === m} onChange={() => setMode(m)} /> {m}</label>
        ))}
      </div>
      <p>{applyReplyLength(sample, mode)}</p>
    </div>
  );
}

export function UrlUnfurlCard() {
  const [url, setUrl] = useState('https://app.example.com/login');
  const info = useMemo(() => unfurlUrl(url, ['example.com']), [url]);
  return (
    <div className="sess27-card" data-testid="url-unfurl">
      <strong>URL unfurling</strong>
      <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL to unfurl" />
      <p>Host: <code>{info.host || '—'}</code> · {info.valid ? (info.inScope ? 'in scope ✅' : 'out of scope ⚠️') : 'invalid URL'}</p>
    </div>
  );
}

export function CommandHistoryDemo() {
  const [history, setHistory] = useState(['status', '/pause', 'focus on auth']);
  const [idx, setIdx] = useState(-1);
  const [draft, setDraft] = useState('');
  return (
    <div className="sess27-card" data-testid="cmd-history">
      <strong>Command history recall</strong>
      <input
        value={idx >= 0 ? recallHistory(history, idx) : draft}
        onChange={(e) => { setDraft(e.target.value); setIdx(-1); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.min(idx + 1, history.length - 1)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(Math.max(idx - 1, -1)); }
          if (e.key === 'Enter' && draft.trim()) { setHistory(pushHistory(history, draft)); setDraft(''); setIdx(-1); }
        }}
        placeholder="Type, Enter to send, ↑ for history"
        aria-label="Command input with history"
      />
      <p className="sess27-hint">↑ cycles previous commands</p>
    </div>
  );
}

export function WorkingNotesStream() {
  const [notes, setNotes] = useState([
    { id: 'wn-1', text: 'Considering auth bypass via header injection…', ts: 0 },
  ]);
  return (
    <div className="sess27-card" data-testid="working-notes">
      <strong>Working notes (read-only)</strong>
      <ul>{notes.map((n) => <li key={n.id}>{n.text}</li>)}</ul>
      <button type="button" onClick={() => setNotes(appendWorkingNote(notes, 'New reasoning trace appended…', 0))}>Simulate trace</button>
    </div>
  );
}

export function TriageCommandBar({ onTriage }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const send = () => {
    const r = parseTriageCommand(input);
    setResult(r);
    if (r && onTriage) onTriage(r);
  };
  return (
    <div className="sess27-card" data-testid="triage-bar">
      <strong>Chat triage commands</strong>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='e.g. mark as false positive' aria-label="Triage command" />
      <button type="button" onClick={send}>Apply</button>
      {result && <p>Finding marked: <code>{result}</code></p>}
      {input && !result && <p className="sess27-hint">No triage command detected.</p>}
    </div>
  );
}

export function CheckinScheduler() {
  const [intervalMin, setIntervalMin] = useState(15);
  const [last, setLast] = useState(0);
  const [now, setNow] = useState(20 * 60000);
  const { due, nextAtMs } = nextCheckin(last, intervalMin, now);
  return (
    <div className="sess27-card" data-testid="checkin-scheduler">
      <strong>Scheduled chat check-ins</strong>
      <label>Every <select value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))} aria-label="Check-in interval">
        {CHECKIN_INTERVALS_MIN.map((m) => <option key={m} value={m}>{m} min</option>)}
      </select></label>
      <p>{due ? 'Check-in due now ✅' : `Next check-in in ${Math.max(0, Math.round((nextAtMs - now) / 60000))}m`}</p>
      <button type="button" onClick={() => setLast(now)}>Simulate check-in sent</button>
      <button type="button" onClick={() => setNow(now + 10 * 60000)}>+10 min</button>
    </div>
  );
}

export function EscalationButton({ messageId }) {
  const [escalations, setEscalations] = useState([]);
  const open = escalations.find((e) => e.messageId === messageId);
  return (
    <div className="sess27-card" data-testid="escalation">
      <strong>Answer escalation</strong>
      {!open && <button type="button" onClick={() => setEscalations(escalateAnswer(escalations, messageId, 'Needs expert review'))}>Flag for expert review</button>}
      {open && open.state === ESCALATION_OPEN && (
        <p>Escalated — awaiting review. <button type="button" onClick={() => setEscalations(resolveEscalation(escalations, messageId, 'Confirmed accurate'))}>Mark reviewed</button></p>
      )}
      {open && open.state !== ESCALATION_OPEN && <p>Resolved: {open.outcome}</p>}
    </div>
  );
}

export function TechPlainToggle() {
  const [mode, setMode] = useState(TECH_MODE);
  return (
    <div className="sess27-card" data-testid="tech-plain">
      <strong>Technical / plain toggle</strong>
      <button type="button" onClick={() => setMode(toggleTechMode(mode))}>
        Switch to {mode === TECH_MODE ? 'plain language' : 'technical'}
      </button>
      <p>Current mode: <code>{mode}</code></p>
    </div>
  );
}

export function EvidenceFootnotesDemo() {
  const { body, footnotes } = useMemo(() => footnoteEvidence([
    { text: 'Admin panel exposes version 2.4.1', label: 'HTTP response', url: 'https://app.example.com/admin' },
    { text: 'Auth bypass via X-Forwarded-For', label: 'PoC log', url: 'https://app.example.com/poc/12' },
  ]), []);
  return (
    <div className="sess27-card" data-testid="evidence-footnotes">
      <strong>Evidence footnotes</strong>
      <pre>{body}</pre>
      <ol>{footnotes.map((f) => <li key={f.n}>{f.label}: {f.url}</li>)}</ol>
    </div>
  );
}

export function SubAgentTabsDemo() {
  const agents = ['recon-1', 'fuzz-2'];
  const tabs = agentTabs(agents);
  const [active, setActive] = useState(COORDINATOR_TAB);
  const [messages] = useState([
    { agentId: null, text: 'Coordinator: hunt plan ready.' },
    { agentId: 'recon-1', text: 'recon-1: 42 subdomains found.' },
    { agentId: 'fuzz-2', text: 'fuzz-2: testing /api params.' },
  ]);
  const visible = messages.filter((m) => routeToAgentTab(m) === active);
  return (
    <div className="sess27-card" data-testid="subagent-tabs">
      <strong>Sub-agent chat tabs</strong>
      <div role="tablist">{tabs.map((t) => (
        <button key={t} role="tab" aria-selected={active === t} onClick={() => setActive(t)}>{t}</button>
      ))}</div>
      <ul>{visible.map((m, i) => <li key={i}>{m.text}</li>)}</ul>
    </div>
  );
}

export function AuditLogView() {
  const [log, setLog] = useState(() => auditLogAppend([], { actor: 'user', action: 'start hunt', ts: 1000 }));
  const verification = verifyAuditLog(log);
  return (
    <div className="sess27-card" data-testid="audit-log">
      <strong>Immutable chat audit log</strong>
      <button type="button" onClick={() => setLog(auditLogAppend(log, { actor: 'agent', action: `status update ${log.length}`, ts: 1000 + log.length }))}>Append entry</button>
      <p>Chain valid: {verification.ok ? `✅ (${verification.entries} entries)` : `❌ broken at seq ${verification.at}`}</p>
      <ol>{log.map((e) => <li key={e.seq}>#{e.seq} {e.actor}: {e.action} <code>{e.hash}</code></li>)}</ol>
    </div>
  );
}

export function PersonalityToggle() {
  const [tone, setTone] = useState(HUNT_TONE_PROFESSIONAL);
  return (
    <div className="sess27-card" data-testid="personality">
      <strong>Long-hunt personality</strong>
      <div role="radiogroup" aria-label="Hunt tone">
        {HUNT_TONES.map((t) => (
          <label key={t}><input type="radio" name="hunttone" checked={tone === t} onChange={() => setTone(t)} /> {t}</label>
        ))}
      </div>
      <p>{withHuntTone('Recon phase complete.', tone)}</p>
    </div>
  );
}

/* Gallery                                                              */

export function SessionChatGallery() {
  const demoMessages = [
    { id: 'm1', text: 'Critical: SQLi in /search', alert: true },
    { id: 'm2', text: 'Recon finished', alert: false },
  ];
  const demoSnapshot = serializeSession({ huntId: 'h-1', messages: demoMessages, savedAtMs: 5000 });
  return (
    <div className="sess27-gallery" data-testid="session-gallery">
      <h3>Session layer gallery (51041–51060)</h3>
      <SessionRestoreBanner snapshot={demoSnapshot} onRestore={() => {}} onDismiss={() => {}} />
      <ReadReceipts messages={demoMessages} />
      <MemoryNotesPanel />
      <CrossHuntCompare />
      <EmergencyStop onStop={() => {}} />
      <PacingIndicator />
      <HandoffBriefCard huntId="h-1" phase="exploitation" />
      <QuestionTemplates onUse={() => {}} />
      <ReplyLengthSlider />
      <UrlUnfurlCard />
      <CommandHistoryDemo />
      <WorkingNotesStream />
      <TriageCommandBar onTriage={() => {}} />
      <CheckinScheduler />
      <EscalationButton messageId="m1" />
      <TechPlainToggle />
      <EvidenceFootnotesDemo />
      <SubAgentTabsDemo />
      <AuditLogView />
      <PersonalityToggle />
    </div>
  );
}

export const WAVE27_SESSION_COMPONENTS = [
  'SessionRestoreBanner', 'ReadReceipts', 'MemoryNotesPanel', 'CrossHuntCompare',
  'EmergencyStop', 'PacingIndicator', 'HandoffBriefCard', 'QuestionTemplates',
  'ReplyLengthSlider', 'UrlUnfurlCard', 'CommandHistoryDemo', 'WorkingNotesStream',
  'TriageCommandBar', 'CheckinScheduler', 'EscalationButton', 'TechPlainToggle',
  'EvidenceFootnotes', 'SubAgentTabsDemo', 'AuditLogView', 'PersonalityToggle',
];

export default SessionChatGallery;
