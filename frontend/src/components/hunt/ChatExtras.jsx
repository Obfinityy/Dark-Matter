/**
 * ChatExtras.jsx — wave 26 (ideas 51001–51040): mid-hunt chat extras.
 * Threading, pins, export, commands, approvals and the remaining chat
 * components — all with real local state.
 *
 * No decorative animations, per the owner's zero-animation order.
 */
import React, { useMemo, useState } from 'react';
import {
  threadReply,
  threadMessages,
  pinAnswer,
  unpinAnswer,
  pinnedRail,
  exportTranscript,
  suggestFollowUps,
  parseSlashCommand,
  SLASH_COMMANDS,
  extractFindingIds,
  findingInlineCard,
  enqueueOfflineMessage,
  flushOfflineQueue,
  splitChatPanes,
  routeToPane,
  parseMentions,
  chatToReportNote,
  answerWithCitations,
  citeClaim,
  quietHoursActive,
  shouldDeliverMessage,
  testRequestWizard,
  confidenceMeter,
  timelineReplay,
  inviteTeammate,
  annotateScreenshot,
  needsClarification,
  clarifyingQuestion,
  translationJob,
  approvalCard,
  resolveApproval,
  parseScopeEdit,
  scopeEditConfirmation,
  chatDigest,
  tuneFromReactions,
  condenseAnswer,
  voiceNoteToMessage,
  attachFile,
  instantFocus,
  resizePlan,
  shouldRecalcResize,
  nextMessageId,
} from './chatCore.js';
import { MessageList } from './ChatDock.jsx';

/* ------------------------------------------------------------------ */
/* 51010 — ThreadView                                                   */
/* ------------------------------------------------------------------ */

export function ThreadView({ parent, messages, onReply }) {
  const [draft, setDraft] = useState('');
  const thread = threadMessages(messages, parent.id);
  const send = () => {
    const r = threadReply(parent.id, draft.trim(), 'you', Date.now());
    if (r && onReply) onReply(r);
    setDraft('');
  };
  return (
    <div className="chat26-thread" aria-label={`Thread on: ${parent.text.slice(0, 40)}`}>
      <p className="chat26-thread-parent">
        <strong>Thread:</strong> {parent.text}
      </p>
      <MessageList messages={thread} compact />
      <div className="chat26-composer">
        <input
          className="chat26-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Reply in thread…"
          aria-label="Thread reply"
        />
        <button type="button" className="chat26-send" onClick={send} disabled={!draft.trim()}>
          Reply
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51016 — PinnedRail                                                   */
/* ------------------------------------------------------------------ */

export function PinnedRail({ messages, onUnpin }) {
  const pinned = pinnedRail(messages);
  if (!pinned.length) return <p className="chat26-empty">Pin key answers to keep them handy.</p>;
  return (
    <aside className="chat26-rail" aria-label="Pinned answers">
      <h4>Pinned answers</h4>
      {pinned.map(m => (
        <div key={m.id} className="chat26-rail-item">
          <p>{m.text}</p>
          <button
            type="button"
            className="chat26-mini-btn"
            onClick={() => onUnpin && onUnpin(m.id)}
          >
            Unpin
          </button>
        </div>
      ))}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 51015 — TranscriptExport                                             */
/* ------------------------------------------------------------------ */

export function TranscriptExport({ messages, huntMeta }) {
  const download = () => {
    const md = exportTranscript(messages, huntMeta);
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hunt-chat-${(huntMeta && huntMeta.huntId) || 'transcript'}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <button
      type="button"
      className="chat26-btn"
      onClick={download}
      disabled={!messages || !messages.length}
    >
      Export transcript (.md)
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 51017 — FollowUpPrompts                                              */
/* ------------------------------------------------------------------ */

export function FollowUpPrompts({ lastAnswer, onAsk }) {
  const suggestions = suggestFollowUps(lastAnswer);
  if (!suggestions.length) return null;
  return (
    <div className="chat26-followups" aria-label="Suggested follow-ups">
      <span>Try next:</span>
      {suggestions.map(s => (
        <button key={s} type="button" className="chat26-chip" onClick={() => onAsk && onAsk(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51019 — SlashCommandDemo                                             */
/* ------------------------------------------------------------------ */

export function SlashCommandDemo({ onExecute }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const run = () => {
    const parsed = parseSlashCommand(input);
    setResult(parsed);
    if (parsed && parsed.action !== 'unknown' && onExecute) onExecute(parsed);
  };
  return (
    <div className="chat26-slash">
      <div className="chat26-composer">
        <input
          className="chat26-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="/status, /pause, /focus F-123…"
          aria-label="Slash command"
        />
        <button type="button" className="chat26-send" onClick={run}>
          Run
        </button>
      </div>
      {result && (
        <p className="chat26-slash-result" role="status">
          {result.action === 'unknown'
            ? `Unknown command "${result.command}". Try ${Object.keys(SLASH_COMMANDS).join(', ')}.`
            : `→ ${result.action}${result.arg ? ` (${result.arg})` : ''}`}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51020 — FindingCard (deep-link expansion)                            */
/* ------------------------------------------------------------------ */

export function FindingCard({ text, baseUrl, huntId }) {
  const ids = extractFindingIds(text);
  if (!ids.length) return null;
  return (
    <div className="chat26-finding-cards">
      {ids.map(id => {
        const card = findingInlineCard(id, baseUrl, huntId);
        return (
          <a key={id} className="chat26-finding-card" href={card.href}>
            <strong>{id}</strong>
            <span>live status →</span>
          </a>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51021 — OfflineQueueBanner                                           */
/* ------------------------------------------------------------------ */

export function OfflineQueueBanner({ online }) {
  const [queue, setQueue] = useState([]);
  const [draft, setDraft] = useState('');
  const [log, setLog] = useState([]);

  const send = () => {
    if (online) {
      setLog(p => [...p, `sent: ${draft}`]);
    } else {
      setQueue(q => enqueueOfflineMessage(q, draft, Date.now()));
    }
    setDraft('');
  };

  React.useEffect(() => {
    if (online && queue.length) {
      const { deliverable, queue: rest } = flushOfflineQueue(queue);
      setLog(p => [...p, ...deliverable.map(m => `delivered: ${m.text}`)]);
      setQueue(rest);
    }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="chat26-offline">
      <p role="status">{online ? 'Online' : `Offline — ${queue.length} message(s) queued`}</p>
      <div className="chat26-composer">
        <input
          className="chat26-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Type a message…"
          aria-label="Offline-capable message"
        />
        <button type="button" className="chat26-send" onClick={send} disabled={!draft.trim()}>
          Send
        </button>
      </div>
      {log.length > 0 && (
        <ul className="chat26-log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51023 — SplitPanesView                                               */
/* ------------------------------------------------------------------ */

export function SplitPanesView() {
  const [panes, setPanes] = useState(splitChatPanes());
  const [drafts, setDrafts] = useState({ strategy: '', findings: '' });
  const send = paneId => {
    const text = (drafts[paneId] || '').trim();
    if (!text) return;
    setPanes(p =>
      routeToPane(p, paneId, { id: nextMessageId('msg'), author: 'you', text, at: Date.now() })
    );
    setDrafts(d => ({ ...d, [paneId]: '' }));
  };
  return (
    <div className="chat26-split">
      {panes.map(pane => (
        <div key={pane.id} className="chat26-pane" aria-label={`${pane.title} thread`}>
          <h4>{pane.title}</h4>
          <MessageList messages={pane.messages} compact />
          <div className="chat26-composer">
            <input
              className="chat26-input"
              value={drafts[pane.id]}
              onChange={e => setDrafts(d => ({ ...d, [pane.id]: e.target.value }))}
              placeholder={`Message ${pane.title.toLowerCase()}…`}
              aria-label={`${pane.title} message`}
            />
            <button type="button" className="chat26-send" onClick={() => send(pane.id)}>
              Send
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51025 — MentionInput                                                 */
/* ------------------------------------------------------------------ */

export function MentionInput({ onSend }) {
  const [text, setText] = useState('');
  const mentions = useMemo(() => parseMentions(text), [text]);
  const send = () => {
    if (text.trim() && onSend) onSend(text.trim(), mentions);
    setText('');
  };
  return (
    <div className="chat26-mentions">
      <input
        className="chat26-input"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Try @finding:F-123 or @tool:nuclei…"
        aria-label="Message with mentions"
      />
      {mentions.length > 0 && (
        <p className="chat26-mention-hits">
          Will pull in: {mentions.map(m => `${m.kind}:${m.ref}`).join(', ')}
        </p>
      )}
      <button type="button" className="chat26-send" onClick={send} disabled={!text.trim()}>
        Send
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51026 — ReportNotes                                                  */
/* ------------------------------------------------------------------ */

export function ReportNotes({ messages, huntId }) {
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState('');
  const toggle = id => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const append = () => {
    const picked = messages.filter(m => selected.includes(m.id));
    setNote(chatToReportNote(picked, huntId));
  };
  return (
    <div className="chat26-report-notes">
      <p>Select messages to append as annotated report notes:</p>
      <ul>
        {(messages || []).map(m => (
          <li key={m.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={() => toggle(m.id)}
              />
              {String(m.text).slice(0, 80)}
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="chat26-btn" onClick={append} disabled={!selected.length}>
        Append to report
      </button>
      {note && <pre className="chat26-note-preview">{note}</pre>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51027 — CitedAnswerView                                              */
/* ------------------------------------------------------------------ */

export function CitedAnswerView({ text, sources }) {
  const answer = answerWithCitations(
    text,
    (sources || []).map(s => citeClaim(s.claim, s.source))
  );
  return (
    <div className="chat26-cited">
      <p>{answer.text}</p>
      {answer.citations.length > 0 && (
        <ul className="chat26-citations">
          {answer.citations.map((c, i) => (
            <li key={i}>
              <em>{c.claim}</em> — <code>{c.source}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51029 — QuietHoursToggle                                             */
/* ------------------------------------------------------------------ */

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function QuietHoursToggle() {
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('07:00');
  const [enabled, setEnabled] = useState(true);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const active = enabled && quietHoursActive(nowMin, toMinutes(start), toMinutes(end));
  const demo = [
    { text: 'New subdomain found', proactive: true, priority: 'normal' },
    { text: 'CRITICAL: RCE confirmed', proactive: true, priority: 'critical' },
  ];
  return (
    <div className="chat26-quiet">
      <label>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />{' '}
        Quiet hours
      </label>
      <input
        type="time"
        value={start}
        onChange={e => setStart(e.target.value)}
        aria-label="Quiet hours start"
      />
      <input
        type="time"
        value={end}
        onChange={e => setEnd(e.target.value)}
        aria-label="Quiet hours end"
      />
      <p role="status">
        {active
          ? 'Quiet hours active — proactive messages muted, critical alerts still on.'
          : 'Quiet hours off.'}
      </p>
      <ul>
        {demo.map((m, i) => (
          <li key={i} className={shouldDeliverMessage(m, active) ? '' : 'chat26-muted'}>
            {m.text} {shouldDeliverMessage(m, active) ? '→ delivered' : '→ muted'}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51030 — TestRequestWizardView                                        */
/* ------------------------------------------------------------------ */

export function TestRequestWizardView({ onQueue }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const validate = () => {
    const r = testRequestWizard(input);
    setResult(r);
    if (r.valid && onQueue) onQueue(r);
  };
  return (
    <div className="chat26-wizard">
      <input
        className="chat26-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder='Try "try sqli on api.example.com/login"'
        aria-label="Test request"
      />
      <button type="button" className="chat26-btn" onClick={validate}>
        Validate & queue
      </button>
      {result && (
        <div role="status" className={result.valid ? 'chat26-ok' : 'chat26-err'}>
          {result.valid
            ? `Queued: ${result.action} → ${result.target}`
            : result.errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51031 — ConfidenceMeterView                                          */
/* ------------------------------------------------------------------ */

export function ConfidenceMeterView({ score, text }) {
  const meter = confidenceMeter(score);
  if (!meter.show) return <p>{text}</p>;
  return (
    <div className="chat26-confidence">
      <p>{text}</p>
      <span
        className={`chat26-conf-${meter.level}`}
        role="note"
        aria-label={`Answer confidence: ${meter.level}`}
      >
        confidence: {meter.level} ({Math.round(meter.score * 100)}%)
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51032 — TimelineReplayView                                           */
/* ------------------------------------------------------------------ */

export function TimelineReplayView({ messages, events }) {
  const [at, setAt] = useState(0);
  const items = useMemo(() => timelineReplay(messages, events), [messages, events]);
  const shown = items.filter(i => i.at <= at);
  const max = items.length ? items[items.length - 1].at : 1;
  return (
    <div className="chat26-replay">
      <input
        type="range"
        min={0}
        max={max}
        value={Math.min(at, max)}
        onChange={e => setAt(Number(e.target.value))}
        aria-label="Replay timeline scrubber"
      />
      <ol>
        {shown.map((i, idx) => (
          <li key={idx} className={`chat26-replay-${i.kind}`}>
            {i.kind === 'message'
              ? `${i.ref.author}: ${i.ref.text}`
              : `⚙ ${i.ref.label || 'event'}`}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51033 — TeammateInviteForm                                           */
/* ------------------------------------------------------------------ */

export function TeammateInviteForm({ onInvite }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [state, setState] = useState(null);
  const send = () => {
    const r = inviteTeammate(email, role);
    setState(r);
    if (r.ok && onInvite) onInvite(r.invite);
  };
  return (
    <div className="chat26-invite">
      <input
        className="chat26-input"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="teammate@example.com"
        aria-label="Teammate email"
      />
      <select value={role} onChange={e => setRole(e.target.value)} aria-label="Role">
        <option value="viewer">viewer</option>
        <option value="commenter">commenter</option>
        <option value="operator">operator</option>
      </select>
      <button type="button" className="chat26-btn" onClick={send}>
        Invite
      </button>
      {state && !state.ok && (
        <p className="chat26-err" role="alert">
          {state.error}
        </p>
      )}
      {state && state.ok && (
        <p className="chat26-ok" role="status">
          Invite sent to {state.invite.email} as {state.invite.role}.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51034 — ScreenshotAnnotator                                          */
/* ------------------------------------------------------------------ */

export function ScreenshotAnnotator({ onAnnotate }) {
  const [regions, setRegions] = useState([]);
  const [label, setLabel] = useState('');
  const add = () => {
    const r = {
      x: 0.1 + regions.length * 0.15,
      y: 0.2,
      w: 0.25,
      h: 0.2,
      label: label || `region ${regions.length + 1}`,
    };
    const next = [...regions, r];
    setRegions(next);
    setLabel('');
    if (onAnnotate) onAnnotate(annotateScreenshot(next));
  };
  return (
    <div className="chat26-annotator">
      <div className="chat26-shot" role="img" aria-label="Screenshot with annotated regions">
        {regions.map((r, i) => (
          <span
            key={i}
            className="chat26-region"
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
            }}
            title={r.label}
          />
        ))}
      </div>
      <div className="chat26-composer">
        <input
          className="chat26-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Region label…"
          aria-label="Region label"
        />
        <button type="button" className="chat26-send" onClick={add}>
          Mark region
        </button>
      </div>
      <p>{regions.length} region(s) marked — the agent factors them into reasoning.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51035 — ClarificationCard                                            */
/* ------------------------------------------------------------------ */

export function ClarificationCard({ request, onClarified }) {
  if (!needsClarification(request)) return null;
  const q = clarifyingQuestion(request);
  const [answer, setAnswer] = useState('');
  return (
    <div className="chat26-clarify" role="alert">
      <p>
        <strong>Quick check:</strong> {q}
      </p>
      <div className="chat26-composer">
        <input
          className="chat26-input"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          aria-label="Clarification answer"
        />
        <button
          type="button"
          className="chat26-send"
          onClick={() => onClarified && onClarified(answer)}
          disabled={!answer.trim()}
        >
          Answer
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51037 — TranslateButton                                              */
/* ------------------------------------------------------------------ */

export function TranslateButton({ messageId }) {
  const [job, setJob] = useState(null);
  return (
    <span className="chat26-translate">
      <button
        type="button"
        className="chat26-mini-btn"
        onClick={() => setJob(translationJob(messageId, 'hi'))}
      >
        Translate
      </button>
      {job && (
        <span role="status">
          {' '}
          translation {job.status} → {job.targetLang}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 51038 — ApprovalCardView                                             */
/* ------------------------------------------------------------------ */

export function ApprovalCardView({ action, detail, onResolve }) {
  const [card, setCard] = useState(() => approvalCard(action, detail));
  if (!card) return null;
  const decide = approved => {
    const resolved = resolveApproval(card, approved, Date.now());
    setCard(resolved);
    if (onResolve) onResolve(resolved);
  };
  return (
    <div
      className={`chat26-approval chat26-approval-${card.status}`}
      role="alertdialog"
      aria-label={`Approval needed: ${card.action}`}
    >
      <p>
        <strong>Approval needed:</strong> {card.action}
      </p>
      {card.detail && <p className="chat26-approval-detail">{card.detail}</p>}
      {card.status === 'pending' ? (
        <div>
          <button type="button" className="chat26-btn" onClick={() => decide(true)}>
            Approve
          </button>
          <button
            type="button"
            className="chat26-btn chat26-btn-danger"
            onClick={() => decide(false)}
          >
            Deny
          </button>
        </div>
      ) : (
        <p role="status">Decision: {card.status}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51039 — ScopeEditConfirm                                             */
/* ------------------------------------------------------------------ */

export function ScopeEditConfirm({ text, onConfirm }) {
  const edit = parseScopeEdit(text);
  const [done, setDone] = useState(false);
  if (!edit)
    return (
      <p className="chat26-empty">
        No scope change detected. Try "also include the API subdomain".
      </p>
    );
  return (
    <div className="chat26-scope-edit" role="alertdialog" aria-label="Confirm scope change">
      <p>{scopeEditConfirmation(edit)}</p>
      {!done ? (
        <div>
          <button
            type="button"
            className="chat26-btn"
            onClick={() => {
              setDone(true);
              onConfirm && onConfirm(edit);
            }}
          >
            Confirm
          </button>
          <button type="button" className="chat26-mini-btn" onClick={() => setDone(true)}>
            Cancel
          </button>
        </div>
      ) : (
        <p role="status">Scope change confirmed.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51040 — ChatDigestView                                               */
/* ------------------------------------------------------------------ */

export function ChatDigestView({ messages }) {
  const [digest, setDigest] = useState(null);
  const summarize = () => setDigest(chatDigest(messages, 3600000, Date.now()));
  return (
    <div className="chat26-digest">
      <button type="button" className="chat26-btn" onClick={summarize}>
        Summarize the last hour
      </button>
      {digest && (
        <div className="chat26-digest-result">
          <p>{digest.summary}</p>
          <ul>
            <li>Phases: {digest.phases.join(', ')}</li>
            <li>Findings referenced: {digest.findingsMentioned.join(', ') || 'none'}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51008 — ReactionTuner                                                */
/* ------------------------------------------------------------------ */

export function ReactionTuner() {
  const [reactions, setReactions] = useState([]);
  const tuning = tuneFromReactions(reactions);
  const react = r => setReactions(p => [...p, r]);
  return (
    <div className="chat26-tuner">
      <p>
        React to tune the agent (verbosity {tuning.verbosity}/2, depth {tuning.depth}/2):
      </p>
      {['thumbs-up', 'thumbs-down', 'eyes', 'yawn'].map(r => (
        <button key={r} type="button" className="chat26-mini-btn" onClick={() => react(r)}>
          {r}
        </button>
      ))}
      <button type="button" className="chat26-mini-btn" onClick={() => setReactions([])}>
        Reset
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51013 — VoiceNoteButton · 51014 — FileAttachButton                   */
/* ------------------------------------------------------------------ */

export function VoiceNoteButton({ onMessage }) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const finish = () => {
    const m = voiceNoteToMessage(transcript, 12000, Date.now());
    if (m && onMessage) onMessage(m);
    setRecording(false);
    setTranscript('');
  };
  if (!recording) {
    return (
      <button
        type="button"
        className="chat26-btn"
        onClick={() => setRecording(true)}
        aria-label="Record voice note"
      >
        🎤 Voice note
      </button>
    );
  }
  return (
    <div className="chat26-voice">
      <p role="status">Recording… (demo: type the transcript)</p>
      <input
        className="chat26-input"
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        aria-label="Voice transcript"
      />
      <button type="button" className="chat26-send" onClick={finish} disabled={!transcript.trim()}>
        Send as message
      </button>
    </div>
  );
}

export function FileAttachButton({ onAttach }) {
  const [file, setFile] = useState(null);
  const attach = () => {
    const a = attachFile(`screenshot-${Date.now()}.png`, 'screenshot', 184320, Date.now());
    setFile(a);
    if (onAttach) onAttach(a);
  };
  return (
    <div className="chat26-attach">
      <button type="button" className="chat26-btn" onClick={attach}>
        📎 Attach file
      </button>
      {file && <p role="status">{file.name} attached — referenced in next reasoning step.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51018 — CondenseDemo · 51003 — FocusDemo · 51002 — ResizeDemo        */
/* ------------------------------------------------------------------ */

export function CondenseDemo() {
  const [high, setHigh] = useState(false);
  const long =
    'The scan found three subdomains. Two expose admin panels. One leaks a version string. I recommend verifying the admin panels manually before we continue.';
  return (
    <div className="chat26-condense">
      <label>
        <input type="checkbox" checked={high} onChange={e => setHigh(e.target.checked)} /> High chat
        volume
      </label>
      <p>{condenseAnswer(long, high)}</p>
    </div>
  );
}

export function FocusDemo() {
  const [plan, setPlan] = useState(null);
  return (
    <div className="chat26-focus-demo">
      <button
        type="button"
        className="chat26-btn"
        onClick={() => setPlan(instantFocus('finding-card-7', false))}
      >
        Focus card 7 (detail loading)
      </button>
      {plan && (
        <p role="status">
          Focus moved {plan.moved} to {plan.target}; detail {plan.detail} → {plan.followUp}.
        </p>
      )}
    </div>
  );
}

export function ResizeDemo() {
  const plan = resizePlan(1280, 800);
  const recalc = shouldRecalcResize(Date.now() - 500, Date.now());
  return (
    <div className="chat26-resize-demo">
      <p>
        Breakpoint: <strong>{plan.breakpoint}</strong> · recalc {recalc ? 'due' : 'debounced'}{' '}
        (150ms)
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                              */
/* ------------------------------------------------------------------ */

export function ChatExtrasGallery() {
  const demoMessages = [
    {
      id: 'x1',
      author: 'agent',
      text: 'Recon found F-101 with a suspected SSRF.',
      at: Date.now() - 5000,
      kind: 'explanation',
    },
    { id: 'x2', author: 'you', text: 'drill into it', at: Date.now() - 4000, parentId: 'x1' },
    {
      id: 'x3',
      author: 'agent',
      text: 'On it — checking the parameter now.',
      at: Date.now() - 3000,
      parentId: 'x1',
    },
  ];
  const [threaded, setThreaded] = useState(demoMessages);
  const [pinnedIds, setPinnedIds] = useState([]);
  const withPins = demoMessages.map(m =>
    pinnedIds.includes(m.id) ? pinAnswer(m) : unpinAnswer(m)
  );

  return (
    <div className="chat26-gallery">
      <h3>Chat extras gallery</h3>

      <h4>Threaded follow-ups</h4>
      <ThreadView
        parent={demoMessages[0]}
        messages={threaded}
        onReply={r => setThreaded(p => [...p, r])}
      />

      <h4>Pinned rail</h4>
      <div className="chat26-composer">
        {demoMessages.map(m => (
          <button
            key={m.id}
            type="button"
            className="chat26-mini-btn"
            onClick={() =>
              setPinnedIds(p => (p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id]))
            }
          >
            {pinnedIds.includes(m.id) ? `Unpin ${m.id}` : `Pin ${m.id}`}
          </button>
        ))}
      </div>
      <PinnedRail messages={withPins} onUnpin={id => setPinnedIds(p => p.filter(x => x !== id))} />

      <h4>Transcript export</h4>
      <TranscriptExport
        messages={demoMessages}
        huntMeta={{ huntId: 'demo', phase: 'scanning', scope: 'example.com' }}
      />

      <h4>Follow-up prompts</h4>
      <FollowUpPrompts lastAnswer={{ text: 'Found a finding on the API scope.' }} />

      <h4>Slash commands</h4>
      <SlashCommandDemo />

      <h4>Finding deep links</h4>
      <FindingCard
        text="Check F-101 and finding-abc-9 for details."
        baseUrl="https://app.example.com"
        huntId="h1"
      />

      <h4>Offline queue (toggle Online in code to test flush)</h4>
      <OfflineQueueBanner online={false} />

      <h4>Split panes</h4>
      <SplitPanesView />

      <h4>@-mentions</h4>
      <MentionInput />

      <h4>Report notes</h4>
      <ReportNotes messages={demoMessages} huntId="demo" />

      <h4>Cited answer</h4>
      <CitedAnswerView
        text="The login endpoint reflects input."
        sources={[{ claim: 'input reflected', source: 'log line 412' }]}
      />

      <h4>Quiet hours</h4>
      <QuietHoursToggle />

      <h4>Test-request wizard</h4>
      <TestRequestWizardView />

      <h4>Confidence meter</h4>
      <ConfidenceMeterView score={0.42} text="This might be a stored XSS — verify manually." />

      <h4>Timeline replay</h4>
      <TimelineReplayView
        messages={demoMessages}
        events={[{ at: Date.now() - 4500, label: 'nuclei finished' }]}
      />

      <h4>Teammate invite</h4>
      <TeammateInviteForm />

      <h4>Screenshot annotation</h4>
      <ScreenshotAnnotator />

      <h4>Clarification-first</h4>
      <ClarificationCard request="do it" />

      <h4>Translate</h4>
      <TranslateButton messageId="x1" />

      <h4>Approval card</h4>
      <ApprovalCardView
        action="Run intrusive scan"
        detail="May trigger WAF alerts on the target."
      />

      <h4>Scope edit</h4>
      <ScopeEditConfirm text="also include the API subdomain" />

      <h4>Chat digest</h4>
      <ChatDigestView messages={demoMessages} />

      <h4>Reaction tuner</h4>
      <ReactionTuner />

      <h4>Voice note + file attach</h4>
      <VoiceNoteButton />
      <FileAttachButton />

      <h4>Condense / focus / resize</h4>
      <CondenseDemo />
      <FocusDemo />
      <ResizeDemo />
    </div>
  );
}

export const WAVE26_EXTRA_COMPONENTS = [
  'ThreadView',
  'PinnedRail',
  'TranscriptExport',
  'FollowUpPrompts',
  'SlashCommandDemo',
  'FindingCard',
  'OfflineQueueBanner',
  'SplitPanesView',
  'MentionInput',
  'ReportNotes',
  'CitedAnswerView',
  'QuietHoursToggle',
  'TestRequestWizardView',
  'ConfidenceMeterView',
  'TimelineReplayView',
  'TeammateInviteForm',
  'ScreenshotAnnotator',
  'ClarificationCard',
  'TranslateButton',
  'ApprovalCardView',
  'ScopeEditConfirm',
  'ChatDigestView',
  'ReactionTuner',
  'VoiceNoteButton',
  'FileAttachButton',
  'CondenseDemo',
  'FocusDemo',
  'ResizeDemo',
];

export default ChatExtrasGallery;
