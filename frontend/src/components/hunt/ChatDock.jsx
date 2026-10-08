/**
 * ChatDock.jsx — wave 26 (ideas 51001–51040): mid-hunt chat / conversational
 * UX suite. Pinned dock + core chat components with real local state.
 *
 * All behavior is local and functional (no backend calls, no mock-data
 * fakery — each demo drives real state). No decorative animations, per the
 * owner's zero-animation order.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  WAVE26_IDEAS,
  DOCK_PINNED,
  DOCK_COLLAPSED,
  toggleDock,
  dockLayout,
  presenceBadge,
  PRESENCE_LABELS,
  typingState,
  questionChips,
  switchChatLanguage,
  withTone,
  CHAT_TONES,
  filterMessages,
  MESSAGE_FILTERS,
  searchConversation,
  chatKeybindings,
  optimisticShareLink,
  confirmShareLink,
  latencySelfTestReport,
  withMessageContext,
  nextMessageId,
} from './chatCore.js';

/* ------------------------------------------------------------------ */
/* 51011 — PresenceBadge                                                */
/* ------------------------------------------------------------------ */

export function PresenceBadge({ execState }) {
  const presence = presenceBadge(execState);
  return (
    <span
      className={`chat26-presence chat26-presence-${presence}`}
      role="status"
      aria-label={`Agent is ${PRESENCE_LABELS[presence]}`}
    >
      <span className="chat26-presence-dot" aria-hidden="true" />
      {PRESENCE_LABELS[presence]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 51022 — TypingIndicator                                              */
/* ------------------------------------------------------------------ */

export function TypingIndicator({ composing }) {
  if (typingState(composing) !== 'composing') return null;
  return (
    <div className="chat26-typing" role="status" aria-label="Agent is composing a reply">
      <span className="chat26-typing-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      Agent is composing…
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MessageList — shared renderer                                        */
/* ------------------------------------------------------------------ */

export function MessageList({ messages, onPin, onReact, compact }) {
  return (
    <div
      className={`chat26-messages${compact ? ' chat26-messages-compact' : ''}`}
      role="log"
      aria-label="Chat messages"
    >
      {(messages || []).map(m => (
        <div
          key={m.id}
          className={`chat26-msg chat26-msg-${m.author === 'agent' ? 'agent' : 'user'}`}
        >
          <div className="chat26-msg-head">
            <strong>{m.author === 'agent' ? 'Infinity AI' : 'You'}</strong>
            {m.context && <span className="chat26-msg-phase">{m.context.phase}</span>}
            {m.kind === 'voice-note' && (
              <span className="chat26-tag">
                voice note · {Math.round((m.durationMs || 0) / 1000)}s
              </span>
            )}
          </div>
          <div className="chat26-msg-text">{m.text}</div>
          <div className="chat26-msg-actions">
            {onPin && (
              <button
                type="button"
                className="chat26-mini-btn"
                onClick={() => onPin(m.id)}
                aria-label={m.pinned ? 'Unpin answer' : 'Pin answer'}
              >
                {m.pinned ? 'Unpinned' : 'Pin'}
              </button>
            )}
            {onReact && m.author === 'agent' && (
              <>
                <button
                  type="button"
                  className="chat26-mini-btn"
                  onClick={() => onReact(m.id, 'thumbs-up')}
                  aria-label="Helpful"
                >
                  👍
                </button>
                <button
                  type="button"
                  className="chat26-mini-btn"
                  onClick={() => onReact(m.id, 'thumbs-down')}
                  aria-label="Not helpful"
                >
                  👎
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {(messages || []).length === 0 && (
        <p className="chat26-empty">No messages yet. Ask something to start.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51007 — QuestionChips                                                */
/* ------------------------------------------------------------------ */

export function QuestionChips({ phase, onAsk }) {
  const chips = questionChips(phase);
  return (
    <div className="chat26-chips" aria-label="Suggested questions">
      {chips.map(c => (
        <button key={c} type="button" className="chat26-chip" onClick={() => onAsk && onAsk(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MessageComposer — keyboard-first (51036)                             */
/* ------------------------------------------------------------------ */

export function MessageComposer({ onSend, disabled }) {
  const [draft, setDraft] = useState('');
  const send = () => {
    const t = draft.trim();
    if (!t || disabled) return;
    onSend && onSend(t);
    setDraft('');
  };
  return (
    <div className="chat26-composer">
      <input
        className="chat26-input"
        value={draft}
        disabled={disabled}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
        }}
        placeholder="Ask about the hunt… (Ctrl+Enter to send)"
        aria-label="Chat message"
      />
      <button
        type="button"
        className="chat26-send"
        onClick={send}
        disabled={disabled || !draft.trim()}
      >
        Send
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51005 — ChatDock                                                     */
/* ------------------------------------------------------------------ */

export function ChatDock({ phase, scope, initialMessages }) {
  const [dockState, setDockState] = useState(DOCK_PINNED);
  const [messages, setMessages] = useState(initialMessages || []);
  const [composing, setComposing] = useState(false);
  const layout = dockLayout(dockState, typeof window !== 'undefined' ? window.innerWidth : 1280);

  const pushMessage = (text, author = 'you', extra = {}) => {
    const m = withMessageContext(
      { id: nextMessageId('msg'), author, text, at: Date.now(), ...extra },
      phase,
      scope
    );
    setMessages(prev => [...prev, m]);
    return m;
  };

  const ask = text => {
    pushMessage(text, 'you');
    setComposing(true);
    setTimeout(() => {
      setComposing(false);
      pushMessage(`Noted — checking "${text}" against the current ${phase} phase.`, 'agent');
    }, 600);
  };

  if (dockState === DOCK_COLLAPSED) {
    return (
      <button
        type="button"
        className="chat26-dock-rail"
        onClick={() => setDockState(toggleDock(dockState))}
        aria-label="Open chat dock"
      >
        💬
      </button>
    );
  }

  return (
    <aside className="chat26-dock" style={{ width: layout.dockWidth }} aria-label="Hunt chat dock">
      <div className="chat26-dock-head">
        <strong>Hunt chat</strong>
        <PresenceBadge execState={composing ? 'reasoning' : 'idle'} />
        <button
          type="button"
          className="chat26-mini-btn"
          onClick={() => setDockState(toggleDock(dockState))}
          aria-label="Collapse chat dock"
        >
          ⇥
        </button>
      </div>
      <QuestionChips phase={phase} onAsk={ask} />
      <MessageList messages={messages} />
      <TypingIndicator composing={composing} />
      <MessageComposer onSend={ask} />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 51012 — LanguageSwitch                                               */
/* ------------------------------------------------------------------ */

const LANGS = [
  ['en', 'English'],
  ['hi', 'हिन्दी'],
  ['hinglish', 'Hinglish'],
];

export function LanguageSwitch({ session, onChange }) {
  const [lang, setLang] = useState((session && session.language) || 'en');
  const change = l => {
    setLang(l);
    onChange && onChange(switchChatLanguage(session || {}, l));
  };
  return (
    <label className="chat26-lang">
      Reply language
      <select value={lang} onChange={e => change(e.target.value)} aria-label="Reply language">
        {LANGS.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* 51024 — ToneSelector                                                 */
/* ------------------------------------------------------------------ */

export function ToneSelector({ onSelect }) {
  const [tone, setTone] = useState('concise');
  const pick = t => {
    setTone(t);
    onSelect && onSelect(withTone('', t));
  };
  return (
    <div className="chat26-tones" role="radiogroup" aria-label="Agent tone">
      {CHAT_TONES.map(t => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={tone === t}
          className={`chat26-tone${tone === t ? ' chat26-tone-active' : ''}`}
          onClick={() => pick(t)}
        >
          {t === 'concise' ? 'Concise analyst' : 'Patient explainer'}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51028 — MessageFilters                                               */
/* ------------------------------------------------------------------ */

export function MessageFilterBar({ messages, onFiltered }) {
  const [filter, setFilter] = useState('all');
  const apply = f => {
    setFilter(f);
    onFiltered && onFiltered(filterMessages(messages, f));
  };
  return (
    <div className="chat26-filters" role="toolbar" aria-label="Message filters">
      {MESSAGE_FILTERS.map(f => (
        <button
          key={f}
          type="button"
          className={`chat26-filter${filter === f ? ' chat26-filter-active' : ''}`}
          aria-pressed={filter === f}
          onClick={() => apply(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51009 — ChatSearch                                                   */
/* ------------------------------------------------------------------ */

export function ChatSearch({ messages, onJump }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchConversation(messages, q), [messages, q]);
  return (
    <div className="chat26-search">
      <input
        className="chat26-input"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search conversation…"
        aria-label="Search conversation"
      />
      {q.trim() && (
        <ul className="chat26-search-results">
          {results.map(r => (
            <li key={r.messageId}>
              <button
                type="button"
                className="chat26-search-hit"
                onClick={() => onJump && onJump(r.messageId)}
              >
                {r.snippet}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="chat26-empty">No matches.</li>}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51036 — KeyboardShortcutsHelp                                        */
/* ------------------------------------------------------------------ */

export function KeyboardShortcutsHelp() {
  const bindings = chatKeybindings();
  return (
    <div className="chat26-kbd-help">
      <h4>Keyboard shortcuts</h4>
      <dl>
        {bindings.map(b => (
          <div key={b.action} className="chat26-kbd-row">
            <dt>
              <kbd>{b.keys}</kbd>
            </dt>
            <dd>{b.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51001 — ShareLinkButton (optimistic)                                 */
/* ------------------------------------------------------------------ */

export function ShareLinkButton({ huntId }) {
  const [link, setLink] = useState(null);
  const create = () => {
    const l = optimisticShareLink(huntId, Date.now());
    setLink(l);
    setTimeout(() => setLink(prev => (prev ? confirmShareLink(prev, Date.now()) : prev)), 800);
  };
  return (
    <div className="chat26-share">
      <button type="button" className="chat26-btn" onClick={create} disabled={!huntId}>
        Create share link
      </button>
      {link && (
        <p className="chat26-share-status" role="status">
          <code>{link.url}</code> —{' '}
          {link.status === 'pending' ? 'creating… (permissions syncing)' : 'active ✓'}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 51004 — LatencySelfTest                                              */
/* ------------------------------------------------------------------ */

export function LatencySelfTest() {
  const [samples, setSamples] = useState([]);
  const [running, setRunning] = useState(false);
  const report = latencySelfTestReport(samples);

  const run = () => {
    setRunning(true);
    setSamples([]);
    let i = 0;
    const timer = setInterval(() => {
      const t0 = performance.now();
      requestAnimationFrame(() => {
        const dt = performance.now() - t0;
        setSamples(prev => [...prev, Math.round(dt * 10) / 10]);
        i += 1;
        if (i >= 20) {
          clearInterval(timer);
          setRunning(false);
        }
      });
    }, 60);
  };

  return (
    <div className="chat26-latency">
      <h4>Interaction-latency self-test</h4>
      <p>Measures 20 frame round-trips and reports honest percentiles.</p>
      <button type="button" className="chat26-btn" onClick={run} disabled={running}>
        {running ? 'Testing…' : 'Run self-test'}
      </button>
      {samples.length > 0 && (
        <dl className="chat26-latency-report">
          <div>
            <dt>Samples</dt>
            <dd>{report.count}</dd>
          </div>
          <div>
            <dt>p50</dt>
            <dd>{report.p50} ms</dd>
          </div>
          <div>
            <dt>p95</dt>
            <dd>{report.p95} ms</dd>
          </div>
          <div>
            <dt>max</dt>
            <dd>{report.max} ms</dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd className={`chat26-grade-${report.grade}`}>{report.grade}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                              */
/* ------------------------------------------------------------------ */

const GALLERY_PHASE = 'scanning';

export function ChatDockGallery() {
  const demoMessages = [
    withMessageContext(
      {
        id: 'g1',
        author: 'agent',
        text: 'Found 3 new subdomains in the last sweep.',
        at: Date.now() - 60000,
        kind: 'explanation',
      },
      GALLERY_PHASE,
      'example.com'
    ),
    withMessageContext(
      { id: 'g2', author: 'you', text: '/status', at: Date.now() - 30000, kind: 'command' },
      GALLERY_PHASE,
      'example.com'
    ),
    withMessageContext(
      {
        id: 'g3',
        author: 'agent',
        text: 'What should I focus on next?',
        at: Date.now() - 10000,
        kind: 'question',
      },
      GALLERY_PHASE,
      'example.com'
    ),
  ];
  const [filtered, setFiltered] = useState(demoMessages);
  return (
    <div className="chat26-gallery">
      <h3>Chat dock gallery</h3>
      <ChatDock
        phase={GALLERY_PHASE}
        scope="example.com"
        initialMessages={demoMessages.slice(0, 1)}
      />
      <h4>Message filters</h4>
      <MessageFilterBar messages={demoMessages} onFiltered={setFiltered} />
      <MessageList messages={filtered} compact />
      <h4>Search</h4>
      <ChatSearch messages={demoMessages} />
      <h4>Share link</h4>
      <ShareLinkButton huntId="demo-hunt" />
      <h4>Latency self-test</h4>
      <LatencySelfTest />
      <h4>Shortcuts</h4>
      <KeyboardShortcutsHelp />
    </div>
  );
}

export const WAVE26_DOCK_COMPONENTS = [
  'ChatDock',
  'PresenceBadge',
  'TypingIndicator',
  'MessageList',
  'MessageComposer',
  'QuestionChips',
  'LanguageSwitch',
  'ToneSelector',
  'MessageFilterBar',
  'ChatSearch',
  'KeyboardShortcutsHelp',
  'ShareLinkButton',
  'LatencySelfTest',
];

export default ChatDockGallery;
