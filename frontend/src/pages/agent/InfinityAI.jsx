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
  FileCode2, Eye, MousePointerClick, Clock3, AppWindow,
  ShieldCheck, Play, Paperclip, FolderOpen, X
} from 'lucide-react';
import { sendDirectChat, getProviders, listJobs, getComputerStatus, getInfiniteHistory } from '../../services/api';
import { planWithInfinity, buildWithInfinity, uploadBuildFiles, readWorkspaceFile } from '../../services/api';
import {
  createComputerTask, cancelComputerTask, answerComputerTask,
  subscribeToComputerTaskEvents, getBrainChain
} from '../../services/api';
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
  // Attached local files → uploaded to the workspace as brain context.
  const [attached, setAttached] = useState([]); // [{ path, name, size }]
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const MAX_FILE_BYTES = 2 * 1024 * 1024;

  const readAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

  const handlePickedFiles = async (fileList) => {
    const picked = Array.from(fileList || []).filter((f) => f.size > 0);
    if (!picked.length) return;
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is too big — max 2 MB per file.`);
      return;
    }
    if (attached.length + picked.length > 20) {
      setError('Max 20 attached files per build.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const payload = [];
      for (const f of picked) {
        payload.push({ name: f.name, type: f.type || '', content: await readAsBase64(f) });
      }
      const res = await uploadBuildFiles(conversationId, payload);
      const newly = (res?.uploaded || []).map((u) => ({ path: u.path, name: u.name, size: u.size }));
      // De-dupe by path (re-attaching the same file replaces it).
      setAttached((prev) => {
        const paths = new Set(newly.map((n) => n.path));
        return [...prev.filter((p) => !paths.has(p.path)), ...newly];
      });
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const removeAttached = (path) => {
    setAttached((prev) => prev.filter((a) => a.path !== path));
  };

  const run = async () => {
    const brief = input.trim();
    if (!brief || loading || uploading) return;
    setLoading(true);
    setError('');
    setBuild(null);
    setPreview(null);
    try {
      const res = await buildWithInfinity(brief, conversationId, {
        attachments: attached.map((a) => a.path)
      });
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
        <button onClick={run} disabled={loading || uploading || !input.trim()} aria-label="Build">
          {loading ? <Loader2 size={17} className="sg-spin" /> : <Hammer size={17} />}
        </button>
      </div>

      {/* ── Attach local files / folders as brain context ── */}
      <div className="sg-attach-row" style={{ maxWidth: 760, margin: '10px auto 0' }}>
        <button
          className="sg-btn sg-btn-ghost sg-btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || loading}
          title="Attach files from your machine"
        >
          {uploading ? <Loader2 size={14} className="sg-spin" /> : <Paperclip size={14} />}
          <span>Attach files</span>
        </button>
        <button
          className="sg-btn sg-btn-ghost sg-btn-sm"
          onClick={() => folderInputRef.current?.click()}
          disabled={uploading || loading}
          title="Attach a whole folder from your machine"
        >
          <FolderOpen size={14} />
          <span>Attach folder</span>
        </button>
        <span className="sg-tiny" style={{ alignSelf: 'center' }}>
          The brain reads these as context while building.
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => handlePickedFiles(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          hidden
          // Non-standard but supported by Chrome/Edge: picks a whole folder.
          {...{ webkitdirectory: '' }}
          onChange={(e) => handlePickedFiles(e.target.files)}
        />
      </div>

      {attached.length > 0 && (
        <div className="sg-attach-chips" style={{ maxWidth: 760, margin: '8px auto 0' }}>
          {attached.map((a) => (
            <span key={a.path} className="sg-chip">
              <FileCode2 size={13} />
              <span className="sg-chip-name" title={a.path}>{a.name}</span>
              <span className="sg-tiny">{(a.size / 1024).toFixed(1)} KB</span>
              <button
                className="sg-chip-x"
                onClick={() => removeAttached(a.path)}
                aria-label={`Remove ${a.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="sg-small" style={{ textAlign: 'center' }}>
        <ShieldCheck size={12} style={{ verticalAlign: -1 }} /> Real files, sandboxed workspace only — the agent can never touch anything outside it.
        {build?.brainBuilt && <span className="sg-pill sg-pill-brand" style={{ marginLeft: 8 }}>Built by your active brain</span>}
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
/* The agent loop lives server-side (POST /computer-tasks + SSE). The brain
   reasons one verified step at a time — no canned plans, no templates. */

function ControlPane() {
  const conversationId = useConversationId('control');
  const backendMode = getBackendMode();
  const [computer, setComputer] = useState(null);
  // /computer status shape: { enabled, bridgePath, whitelist, runtime: { available, state, ... } }.
  const runtimeAvailable = Boolean(computer?.runtime?.available);
  const runtimeLabel = !computer
    ? 'Unavailable here'
    : runtimeAvailable
      ? (computer.simulated ? 'Simulated' : 'Connected')
      : `Unavailable (${computer.runtime?.state || 'bridge not connected'})`;
  const [brainName, setBrainName] = useState('');
  const [input, setInput] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null); // running | waiting_ai | completed | failed | cancelled
  const [feed, setFeed] = useState([]); // live agent events (newest last)
  const [askQ, setAskQ] = useState(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const unsubRef = useRef(null);
  const feedEndRef = useRef(null);

  const running = Boolean(taskId) && !['completed', 'failed', 'cancelled'].includes(taskStatus);

  useEffect(() => {
    getComputerStatus().then(setComputer).catch(() => setComputer(null));
    getBrainChain().then((c) => {
      const active = c?.chain?.find?.((l) => l.active) || c?.chain?.[0];
      if (active?.name) setBrainName(active.name);
    }).catch(() => {});
    return () => { unsubRef.current?.(); unsubRef.current = null; };
  }, []);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [feed]);

  const pushFeed = (ev) => setFeed((prev) => [...prev.slice(-250), ev]);

  const handleEvent = (ev) => {
    const type = ev.__sseType;
    pushFeed(ev);
    if (type === 'task.ask_user') {
      setAskQ(ev.data?.question || ev.message || 'The agent has a question.');
    } else if (type === 'task.waiting_ai') {
      setTaskStatus('waiting_ai');
    } else if (type === 'task.completed') {
      setTaskStatus('completed');
      setAskQ(null);
      unsubRef.current?.(); unsubRef.current = null;
    } else if (type === 'task.failed') {
      setTaskStatus('failed');
      setAskQ(null);
      unsubRef.current?.(); unsubRef.current = null;
    } else if (type === 'task.cancelled') {
      setTaskStatus('cancelled');
      setAskQ(null);
      unsubRef.current?.(); unsubRef.current = null;
    } else if (type === 'task.resumed' || type === 'task.started') {
      setTaskStatus('running');
    }
  };

  const start = async () => {
    const instruction = input.trim();
    if (!instruction || running) return;
    setError('');
    setFeed([]);
    setAskQ(null);
    setAnswer('');
    unsubRef.current?.(); unsubRef.current = null;
    try {
      const res = await createComputerTask(instruction, conversationId);
      setTaskId(res.taskId);
      setTaskStatus(res.taskStatus || 'running');
      pushFeed({ __sseType: 'task.created', level: 'INFO', message: `Task accepted — the brain is thinking…` });
      unsubRef.current = subscribeToComputerTaskEvents(res.taskId, {
        onEvent: handleEvent,
        onError: () => {}
      });
    } catch (err) {
      setError(err.message || 'Could not start the computer task.');
    }
  };

  const stop = async () => {
    if (!taskId) return;
    try { await cancelComputerTask(taskId); } catch { /* task may already be done */ }
  };

  const sendAnswer = async () => {
    const msg = answer.trim();
    if (!msg || !taskId) return;
    try {
      await answerComputerTask(taskId, msg);
      pushFeed({ __sseType: 'task.answered', level: 'INFO', message: `You answered: ${msg}` });
      setAskQ(null);
      setAnswer('');
    } catch (err) {
      setError(err.message || 'Could not send the answer.');
    }
  };

  const reset = () => {
    unsubRef.current?.(); unsubRef.current = null;
    setTaskId(null);
    setTaskStatus(null);
    setFeed([]);
    setAskQ(null);
    setAnswer('');
    setError('');
    setInput('');
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
        {brainName && (
          <span className="sg-chip" title="The brain thinking for Control mode — same as Hunt and Infinity AI">
            <Bot size={12} /> Brain: {brainName}
          </span>
        )}
      </div>

      <h3 className="sg-control-title">Tell me what to do on the computer</h3>
      <p className="sg-small" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 18px' }}>
        For example: “MS Word me leave application likho”. Your active brain reasons it out
        step by step — opening the app, observing the screen, acting, and verifying —
        and you watch it think live below. Nothing is canned: the brain composes every word itself.
      </p>

      <div className="sg-chat-input" style={{ maxWidth: 760 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          placeholder="Command the computer… e.g. “MS Word me leave application likho”"
          disabled={running}
        />
        {running ? (
          <button onClick={stop} aria-label="Stop the agent" title="Stop the agent">
            <XCircle size={17} />
          </button>
        ) : (
          <button onClick={start} disabled={!input.trim()} aria-label="Start">
            <Play size={17} />
          </button>
        )}
      </div>

      {taskId && (
        <div className="sg-control-toggles">
          <span className="sg-chip">
            {taskStatus === 'completed' ? <CheckCircle2 size={12} /> : taskStatus === 'failed' ? <XCircle size={12} /> : <Loader2 size={12} className="sg-spin" />}
            {taskStatus === 'waiting_ai' ? 'Waiting for the brain…' : taskStatus || 'running'}
          </span>
          {!running && (
            <button className="sg-btn sg-btn-ghost sg-btn-sm" onClick={reset}>New command</button>
          )}
        </div>
      )}

      {error && <div className="sg-auth-error" role="alert" style={{ maxWidth: 760, margin: '14px auto 0' }}>{error}</div>}

      {askQ && running && (
        <div className="sg-control-ask" style={{ maxWidth: 760, margin: '14px auto 0' }}>
          <p><strong>❓ The agent asks:</strong> {askQ}</p>
          <div className="sg-chat-input">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendAnswer()}
              placeholder="Your answer…"
            />
            <button onClick={sendAnswer} disabled={!answer.trim()} aria-label="Send answer"><Send size={16} /></button>
          </div>
        </div>
      )}

      {feed.length > 0 && (
        <div className="sg-control-feed" style={{ maxWidth: 760, margin: '14px auto 0' }}>
          {feed.map((ev, i) => (
            <FeedRow key={i} ev={ev} />
          ))}
          <div ref={feedEndRef} />
        </div>
      )}

      {!taskId && (
        <div className="sg-control-examples">
          <span className="sg-small">Try:</span>
          {[
            'MS Word me leave application likho',
            'Open calculator',
            'Notepad me shopping list likho'
          ].map((ex) => (
            <button key={ex} className="sg-chip sg-chip-btn" onClick={() => setInput(ex)}>{ex}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedRow({ ev }) {
  const type = ev.__sseType || '';
  const level = ev.level || 'INFO';
  let icon = <Bot size={14} />;
  let cls = '';
  if (type.includes('decision')) icon = <span>🧠</span>;
  else if (type.includes('action')) icon = <MousePointerClick size={14} />;
  else if (type.includes('observation')) icon = <Eye size={14} />;
  else if (type === 'task.ask_user') icon = <span>❓</span>;
  else if (type === 'task.waiting_ai') icon = <Clock3 size={14} />;
  else if (type === 'task.completed') { icon = <CheckCircle2 size={14} />; cls = ' ok'; }
  else if (type === 'task.failed' || level === 'ERROR') { icon = <XCircle size={14} />; cls = ' bad'; }
  else if (type === 'task.cancelled') icon = <span>🛑</span>;
  else if (level === 'WARN') icon = <span>⚠️</span>;
  return (
    <div className={`sg-feed-row${cls}`}>
      <span className="sg-feed-ico">{icon}</span>
      <span className="sg-feed-msg">{ev.message || type}</span>
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
