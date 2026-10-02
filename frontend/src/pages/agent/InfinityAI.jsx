/**
 * InfinityAI — your AI companion, ChatGPT-style.
 *
 * Four modes, one brain:
 *   Chat     — ask anything, casual conversation, explain, debug
 *   Plan     — describe an idea → get a real step-by-step plan (numbered,
 *              with tools/apps needed). Planning only — never executes.
 *   Build    — the agent reads/writes REAL files inside a sandboxed
 *              workspace (backend/data/agent-workspace/). "Build me a
 *              portfolio page" creates index.html + styles.css + app.js.
 *   Control  — Infinity Control: natural-language desktop commands.
 *              NL → decomposed GUI plan → every step validated against the
 *              closed action schema → executed by the computer adapter.
 *              Runs simulated (mock adapter) by default — safe anywhere.
 *              On the user's own machine with the bridge installed, the
 *              simulation can be switched off for real desktop control.
 *
 * Same brain powers Hunt and Infinity AI. Switch modes with one tap.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send, Loader2, Bot, User, MessageCircle, ClipboardList,
  Hammer, SlidersHorizontal, Cpu, FileText, CheckCircle2, XCircle,
  FileCode2, Eye, MousePointerClick, Keyboard, Clock3, AppWindow,
  ShieldCheck, FlaskConical, Play
} from 'lucide-react';
import { sendDirectChat, getProviders, listJobs, getComputerStatus, getInfiniteHistory } from '../../services/api';
import { planWithInfinity, buildWithInfinity, readWorkspaceFile, controlComputer } from '../../services/api';
import { recordConversation } from '../../services/chatHistory';
import { getBackendMode, BACKEND_MODES } from '../../services/backendMode';
import './InfinityAI.css';

const MODES = [
  { id: 'chat', label: 'Chat', icon: MessageCircle, hint: 'Ask anything' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, hint: 'Turn ideas into plans' },
  { id: 'build', label: 'Build', icon: Hammer, hint: 'Agent builds for you' },
  { id: 'control', label: 'Control', icon: SlidersHorizontal, hint: 'Command the system' }
];

const WELCOME = {
  chat: "Hey! I'm Infinity AI. Ask me anything — explain code, debug, brainstorm, or just chat. What's on your mind?",
  plan: "Plan mode. Tell me your idea — an app, a feature, a project — and I'll return a numbered step-by-step plan with the tools each step needs. Planning only: nothing gets executed.",
  build: "Build mode. Tell me what to build and I'll create real files in my sandboxed workspace — for example, “build me a portfolio page for Rahul Sharma”. What are we making?",
  control: null // control renders its own panel
};

/** One stable conversation id per mode tab (backend creates the record on first message). */
function useConversationId(mode) {
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = `${mode}-${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))}`;
  }
  return ref.current;
}

function ChatPane({ mode, initialConversationId }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: WELCOME[mode] }]);
  const [loadingHistory, setLoadingHistory] = useState(!!initialConversationId);
  // One conversation per pane — the backend creates it on first message.
  // When resumed from the sidebar, reuse the stored conversation id.
  const convRef = useRef(
    initialConversationId || `${mode}-${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))}`
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Resumed conversation: backfill messages from the backend.
  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    getInfiniteHistory(initialConversationId).then((res) => {
      if (cancelled) return;
      const stored = res?.chat?.messages || [];
      if (stored.length > 0) {
        setMessages(stored.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.content || m.text || '',
        })));
      }
    }).catch(() => { /* fall back to the welcome message */ })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [initialConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    // Index this conversation for the sidebar chat history.
    recordConversation({
      id: convRef.current,
      mode,
      title: text.length > 48 ? `${text.slice(0, 48)}…` : text,
    });
    setSending(true);
    try {
      const res = await sendDirectChat(text, convRef.current);
      const reply = res?.reply || res?.message || res?.text || 'Hmm, empty reply. Try again?';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant',
        text: `Couldn't reach the brain: ${(err.message || 'connection failed').replace(/\.+$/, '')}. Check Models in Settings.`
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="sg-chat-messages">
        {loadingHistory ? (
          <div className="sg-chat-msg assistant">
            <span className="sg-chat-avatar"><Bot size={15} /></span>
            <div className="sg-chat-bubble"><Loader2 size={15} className="sg-spin" /> Loading conversation…</div>
          </div>
        ) : messages.map((m, i) => (
          <div key={i} className={`sg-chat-msg ${m.role}`}>
            <span className="sg-chat-avatar">
              {m.role === 'assistant' ? <Bot size={15} /> : <User size={15} />}
            </span>
            <div className="sg-chat-bubble">{m.text}</div>
          </div>
        ))}
        {sending && (
          <div className="sg-chat-msg assistant">
            <span className="sg-chat-avatar"><Bot size={15} /></span>
            <div className="sg-chat-bubble sg-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="sg-chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message Infinity AI…"
          disabled={sending}
        />
        <button onClick={send} disabled={sending || !input.trim()} aria-label="Send">
          {sending ? <Loader2 size={17} className="sg-spin" /> : <Send size={17} />}
        </button>
      </div>
    </>
  );
}

/* ── Plan mode ─────────────────────────────────────────────────────────── */

function PlanPane() {
  const conversationId = useConversationId('plan');
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const instruction = input.trim();
    if (!instruction || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await planWithInfinity(instruction, conversationId);
      if (!res?.plan?.steps?.length) throw new Error('The planner returned no steps.');
      setPlan(res.plan);
    } catch (err) {
      setError(err.message || 'Planning failed.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sg-plan">
      <div className="sg-plan-input">
        <div className="sg-chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Describe your idea… e.g. “a portfolio website for a photographer”"
            disabled={loading}
          />
          <button onClick={run} disabled={loading || !input.trim()} aria-label="Make plan">
            {loading ? <Loader2 size={17} className="sg-spin" /> : <ClipboardList size={17} />}
          </button>
        </div>
        <p className="sg-small" style={{ textAlign: 'center' }}>Planning only — nothing is executed. Switch to Build to make it real.</p>
      </div>

      {error && <div className="sg-auth-error" role="alert">{error}</div>}

      {loading && (
        <div className="sg-loading-box"><Loader2 size={20} className="sg-spin" /> Turning your idea into a plan…</div>
      )}

      {plan && !loading && (
        <div className="sg-plan-result">
          <div className="sg-plan-head">
            <h3>{plan.task}</h3>
            <span className="sg-pill sg-pill-brand">{plan.taskType}</span>
          </div>
          <ol className="sg-plan-steps">
            {plan.steps.map((s) => (
              <li key={s.n} className="sg-plan-step">
                <span className="sg-plan-num">{s.n}</span>
                <div className="sg-plan-step-body">
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                  {s.tools?.length > 0 && (
                    <div className="sg-plan-tools">
                      {s.tools.map((t, i) => <span key={i} className="sg-chip">{t}</span>)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {plan.refinedByBrain && <p className="sg-small">Refined by your local brain.</p>}
        </div>
      )}
    </div>
  );
}

/* ── Build mode ────────────────────────────────────────────────────────── */

function BuildPane() {
  const conversationId = useConversationId('build');
  const [input, setInput] = useState('');
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const run = async () => {
    const brief = input.trim();
    if (!brief || loading) return;
    setLoading(true);
    setError('');
    setBuild(null);
    setPreview(null);
    try {
      const res = await buildWithInfinity(brief, conversationId);
      if (!res?.build?.files?.length) throw new Error('The builder created no files.');
      setBuild(res.build);
    } catch (err) {
      setError(err.message || 'Build failed.');
    } finally {
      setLoading(false);
    }
  };

  const openPreview = async (filePath) => {
    setPreviewLoading(true);
    try {
      const res = await readWorkspaceFile(filePath);
      setPreview({ path: filePath, content: res?.content ?? '' });
    } catch (err) {
      setError(err.message || 'Could not read the file.');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="sg-build">
      <div className="sg-chat-input" style={{ maxWidth: 760 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="What should I build?… e.g. “a portfolio page for Rahul Sharma”"
          disabled={loading}
        />
        <button onClick={run} disabled={loading || !input.trim()} aria-label="Build">
          {loading ? <Loader2 size={17} className="sg-spin" /> : <Hammer size={17} />}
        </button>
      </div>
      <p className="sg-small" style={{ textAlign: 'center' }}>
        <ShieldCheck size={12} style={{ verticalAlign: -1 }} /> Real files, sandboxed workspace only — the agent can never touch anything outside it.
      </p>

      {error && <div className="sg-auth-error" role="alert" style={{ maxWidth: 760, margin: '0 auto' }}>{error}</div>}

      {loading && (
        <div className="sg-loading-box"><Loader2 size={20} className="sg-spin" /> Agent is writing files…</div>
      )}

      {build && !loading && (
        <div className="sg-build-result">
          <div className="sg-plan-head">
            <h3>{build.projectDir}</h3>
            <span className="sg-pill sg-pill-brand">{build.files.length} files</span>
          </div>
          <p className="sg-small">{build.note}</p>
          <ul className="sg-file-list">
            {build.files.map((f) => (
              <li key={f.path}>
                <button className="sg-file-row" onClick={() => openPreview(f.path)}>
                  <FileCode2 size={16} />
                  <span className="sg-file-path">{f.path}</span>
                  <span className="sg-tiny">{(f.size / 1024).toFixed(1)} KB</span>
                  <Eye size={14} className="sg-file-eye" />
                </button>
              </li>
            ))}
          </ul>
          {(preview || previewLoading) && (
            <div className="sg-file-preview">
              <div className="sg-file-preview-head">
                <FileCode2 size={14} />
                <span>{preview?.path || 'Loading…'}</span>
              </div>
              {previewLoading
                ? <div className="sg-loading-box"><Loader2 size={16} className="sg-spin" /></div>
                : <pre className="sg-file-preview-body">{preview?.content}</pre>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Control mode ──────────────────────────────────────────────────────── */

const STEP_ICONS = {
  open_application: AppWindow,
  click: MousePointerClick,
  double_click: MousePointerClick,
  move_mouse: MousePointerClick,
  type: Keyboard,
  press_key: Keyboard,
  hotkey: Keyboard,
  scroll: MousePointerClick,
  sleep: Clock3,
  navigate: AppWindow,
  screenshot: Eye,
  get_active_window: Eye,
  get_browser_state: Eye
};

function stepSummary(step) {
  const p = step.params || {};
  const kind = step.kind || 'gui';
  if (kind === 'file') {
    if (step.op === 'write_file') return `📄 Write ${step.path} (${String(step.content || '').length} chars) — sandboxed workspace`;
    if (step.op === 'read_file') return `📖 Read ${step.path} — sandboxed workspace`;
    if (step.op === 'list_files') return `📁 List files — sandboxed workspace`;
    return `File: ${step.op}`;
  }
  if (kind === 'tool') {
    return `🧪 ${step.tool}: ${String(step.code || '').length} chars of code (validated, SIMULATED — never executed here)`;
  }
  switch (step.type) {
    case 'open_application': return `🖥️ Open ${p.name}`;
    case 'type': return `⌨️ Type ${String(p.text || '').length} chars`;
    case 'hotkey': return `⌨️ Hotkey ${(p.keys || []).join(' + ')}`;
    case 'press_key': return `⌨️ Press ${(p.keys || []).join(' + ')}`;
    case 'sleep': return `⏳ Wait ${p.seconds}s`;
    case 'click': case 'double_click': return `🖱️ ${step.type.replace('_', ' ')} at ${p.x}, ${p.y}`;
    case 'navigate': return `🌐 Go to ${p.url}`;
    case 'clipboard_set': return `📋 Set clipboard (${String(p.text || '').length} chars)`;
    case 'get_active_window': return `🪟 Verify active window`;
    default: return String(step.type || '').replace(/_/g, ' ');
  }
}

function stepKindBadge(step) {
  const kind = step.kind || 'gui';
  if (kind === 'file') return <span className="sg-pill">🗂 file</span>;
  if (kind === 'tool') return <span className="sg-pill">🧪 tool · simulated</span>;
  return <span className="sg-pill">🖥 gui</span>;
}

function ControlPane() {
  const conversationId = useConversationId('control');
  const backendMode = getBackendMode();
  const [computer, setComputer] = useState(null);
  // /computer status shape: { enabled, bridgePath, whitelist, runtime: { available, state, ... } }.
  // There is no top-level `simulated` flag — availability comes from runtime.available.
  const runtimeAvailable = Boolean(computer?.runtime?.available);
  const runtimeLabel = !computer
    ? 'Unavailable here'
    : runtimeAvailable
      ? (computer.simulated ? 'Simulated' : 'Connected')
      : `Unavailable (${computer.runtime?.state || 'bridge not connected'})`;
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | previewing | ready | running | done
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [simulate, setSimulate] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getComputerStatus().then(setComputer).catch(() => setComputer(null));
  }, []);

  const doPreview = async () => {
    const instruction = input.trim();
    if (!instruction || phase === 'previewing' || phase === 'running') return;
    setPhase('previewing');
    setError('');
    setResult(null);
    try {
      const res = await controlComputer(instruction, conversationId, { dryRun: true });
      if (!res?.control?.ok) throw new Error(res?.control?.reason || 'The planner could not decompose that instruction.');
      setPreview(res.control);
      setPhase('ready');
    } catch (err) {
      setError(err.message || 'Planning failed.');
      setPhase('idle');
    }
  };

  const doRun = async () => {
    if (!preview || phase === 'running') return;
    setPhase('running');
    setError('');
    try {
      const res = await controlComputer(input.trim(), conversationId, { dryRun: false, simulate });
      setResult(res?.control || null);
      if (!res?.control?.ok) {
        setError(res?.control?.reason || 'The run failed partway.');
      }
      setPhase('done');
    } catch (err) {
      setError(err.message || 'Execution failed.');
      setPhase('done');
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError('');
    setInput('');
    setPhase('idle');
  };

  return (
    <div className="sg-control-nl">
      <div className="sg-control-statusline">
        <span className="sg-chip">
          <Cpu size={12} /> Backend: {backendMode === BACKEND_MODES.VERCEL ? 'Cloud' : 'Localhost'}
        </span>
        <span className="sg-chip">
          <AppWindow size={12} /> Desktop runtime: {runtimeLabel}
        </span>
      </div>

      <h3 className="sg-control-title">Tell me what to do on the computer</h3>
      <p className="sg-small" style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 18px' }}>
        For example: “MS Word me leave application likho”. I turn it into GUI steps,
        validate every step against the action schema, then run them. I can also copy
        text to the clipboard, read/write files in my sandboxed workspace, and run
        Python snippets (validated but simulated here — never executed).
      </p>

      <div className="sg-chat-input" style={{ maxWidth: 760 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (phase === 'ready' ? doRun() : doPreview())}
          placeholder="Command the computer… e.g. “MS Word me leave application likho” or “run python: print(2+2)”"
          disabled={phase === 'previewing' || phase === 'running'}
        />
        <button
          onClick={phase === 'ready' ? doRun : doPreview}
          disabled={!input.trim() || phase === 'previewing' || phase === 'running'}
          aria-label={phase === 'ready' ? 'Run the plan' : 'Preview the plan'}
        >
          {phase === 'previewing' || phase === 'running'
            ? <Loader2 size={17} className="sg-spin" />
            : phase === 'ready' ? <Play size={17} /> : <SlidersHorizontal size={17} />}
        </button>
      </div>

      {phase !== 'idle' && phase !== 'previewing' && (
        <div className="sg-control-toggles">
          <label className="sg-toggle">
            <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} disabled={phase === 'running'} />
            <FlaskConical size={13} /> Simulate (mock desktop — safe anywhere)
          </label>
          {phase !== 'idle' && (
            <button className="sg-btn sg-btn-ghost sg-btn-sm" onClick={reset}>New command</button>
          )}
        </div>
      )}

      {error && <div className="sg-auth-error" role="alert" style={{ maxWidth: 760, margin: '14px auto 0' }}>{error}</div>}

      {phase === 'previewing' && (
        <div className="sg-loading-box"><Loader2 size={20} className="sg-spin" /> Decomposing your command into steps…</div>
      )}

      {preview && (phase === 'ready' || phase === 'running' || phase === 'done') && (
        <div className="sg-control-plan">
          <div className="sg-plan-head">
            <h3>Validated plan — {preview.application}</h3>
            <span className="sg-pill sg-pill-brand">
              <ShieldCheck size={12} /> {preview.steps.length} steps · schema-valid
            </span>
          </div>
          <ol className="sg-control-steps">
            {(result?.executed?.length ? result.executed : preview.steps).map((s, i) => {
              const kind = s.kind || 'gui';
              const Icon = kind === 'file' ? FileText : kind === 'tool' ? FlaskConical : (STEP_ICONS[s.type] || MousePointerClick);
              const done = result?.executed?.length > i;
              const ok = done ? result.executed[i].ok : null;
              return (
                <li key={i} className={`sg-control-step${ok === true ? ' ok' : ok === false ? ' bad' : ''}`}>
                  <span className="sg-control-step-num">{i + 1}</span>
                  <span className="sg-control-step-icon"><Icon size={15} /></span>
                  <div className="sg-control-step-body">
                    <strong>{stepSummary(s)}</strong> {stepKindBadge(s)}
                    <p>{s.reason}</p>
                    {done && result.executed[i].observation && (
                      <p className="sg-control-obs">→ {result.executed[i].observation}</p>
                    )}
                    {done && result.executed[i].error && (
                      <p className="sg-control-err">✕ {result.executed[i].error}</p>
                    )}
                    {done && (result.executed[i].sandboxed || result.executed[i].simulated) && (
                      <p className="sg-small" style={{ marginTop: 4, opacity: 0.75 }}>
                        {result.executed[i].sandboxed && '🔒 sandboxed — never touches files outside the agent workspace. '}
                        {result.executed[i].simulated && '🧪 simulated — nothing was really executed.'}
                      </p>
                    )}
                  </div>
                  {ok === true && <CheckCircle2 size={16} className="sg-ok" />}
                  {ok === false && <XCircle size={16} className="sg-bad" />}
                </li>
              );
            })}
          </ol>

          {phase === 'ready' && (
            <div className="sg-control-runbar">
              <button className="sg-btn sg-btn-primary" onClick={doRun}>
                <Play size={15} /> Run {simulate ? 'simulated' : 'on this machine'}
              </button>
              <span className="sg-small">
                {simulate
                  ? 'Simulation only — no real desktop is touched.'
                  : 'Real desktop control — make sure the bridge is installed.'}
              </span>
            </div>
          )}

          {phase === 'done' && result && (
            <div className={`sg-control-done${result.ok ? ' ok' : ' bad'}`}>
              {result.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>
                {result.ok
                  ? `Done — ${result.executed.length} actions executed${result.simulated ? ' (simulated)' : ''} in ${result.durationMs}ms.`
                  : `Stopped: ${result.reason || 'an action failed.'}`}
              </span>
            </div>
          )}
        </div>
      )}

      {phase === 'idle' && (
        <div className="sg-control-examples">
          <span className="sg-small">Try:</span>
          {[
            'MS Word me leave application likho',
            'Open calculator',
            'Copy "hello" to clipboard',
            'Write "meeting at 3pm" to reminder.txt',
            'Run python: print(2+2)'
          ].map((ex) => (
            <button key={ex} className="sg-chip sg-chip-btn" onClick={() => setInput(ex)}>{ex}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InfinityAI() {
  const location = useLocation();
  const navState = location.state || {};
  const [mode, setMode] = useState(
    () => (MODES.some((m) => m.id === navState.mode) ? navState.mode : 'chat')
  );
  const active = MODES.find((m) => m.id === mode);

  // Arriving from the sidebar (history resume or New Chat) re-syncs the pane.
  useEffect(() => {
    if (navState.conversationId && MODES.some((m) => m.id === navState.mode)) {
      setMode(navState.mode);
    } else if (navState.fresh) {
      setMode('chat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // location.key changes on every sidebar navigation (resume / new chat),
  // so the pane remounts with a fresh or resumed conversation.
  const paneKey = `${mode}|${location.key}`;

  return (
    <div className="sg-inf">
      <div className="sg-mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`sg-mode-tab${mode === m.id ? ' sg-active' : ''}`}
            onClick={() => setMode(m.id)}
            title={m.hint}
          >
            <m.icon size={16} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="sg-mode-sub">
        <active.icon size={13} /> {active.hint}
      </div>

      <div className="sg-inf-body">
        {mode === 'control' ? <ControlPane key="control" />
          : mode === 'plan' ? <PlanPane key="plan" />
          : mode === 'build' ? <BuildPane key="build" />
          : <ChatPane key={paneKey} mode={mode} initialConversationId={navState.conversationId} />}
      </div>

      <div className="sg-inf-foot">
        <FileText size={12} />
        <span>Powered by your brain — the same one behind Hunt. Change it in Models.</span>
      </div>
    </div>
  );
}
