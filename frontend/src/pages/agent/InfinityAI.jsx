/**
 * InfinityAI — your AI companion, ChatGPT-style.
 *
 * Four modes, one brain:
 *   💬 Chat     — ask anything, casual conversation, explain, debug
 *   📋 Plan     — describe an idea → get a step-by-step build plan
 *   🔨 Build    — the agent works with real workspace files
 *   🎛️ Control  — Infinity Control: command the whole system
 *
 * Same brain powers Hunt and Infinity AI. Switch modes with one tap.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Loader2, Bot, User, MessageCircle, ClipboardList,
  Hammer, SlidersHorizontal, Cpu, Cloud, Monitor,
  Crosshair, FileText, CheckCircle2, XCircle, RefreshCw
} from 'lucide-react';
import { sendDirectChat, getProviders, listJobs, getComputerStatus } from '../../services/api';
import { getBackendMode, BACKEND_MODES } from '../../services/backendMode';

const MODES = [
  { id: 'chat', label: 'Chat', icon: MessageCircle, hint: 'Ask anything' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, hint: 'Turn ideas into plans' },
  { id: 'build', label: 'Build', icon: Hammer, hint: 'Agent builds for you' },
  { id: 'control', label: 'Control', icon: SlidersHorizontal, hint: 'Command the system' }
];

const MODE_SYSTEM_PROMPT = {
  chat: 'You are Infinity AI, a friendly and sharp AI assistant. Answer clearly and concisely.',
  plan: 'You are Infinity AI in PLAN mode. The user describes an idea or project. Respond with a clear, numbered step-by-step plan: goal, milestones, tech choices, and first action. Be practical and specific.',
  build: 'You are Infinity AI in BUILD mode. The user wants something built. Break the work into concrete file-by-file steps, show the key code, and explain what each part does. Be the senior dev on their team.'
};

const WELCOME = {
  chat: "Hey! I'm Infinity AI. Ask me anything — explain code, debug, brainstorm, or just chat. What's on your mind?",
  plan: "Plan mode. 🎯 Tell me your idea — an app, a feature, a project — and I'll turn it into a step-by-step plan you can actually follow.",
  build: "Build mode. 🔨 Tell me what to build and I'll break it into concrete steps with real code. What are we making?",
  control: null // control renders its own panel
};

function ChatPane({ mode }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: WELCOME[mode] }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: 'assistant', text: WELCOME[mode] }]);
  }, [mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const prompt = `[${mode.toUpperCase()} MODE] ${MODE_SYSTEM_PROMPT[mode]}\n\nUser: ${text}`;
      const res = await sendDirectChat(prompt);
      const reply = res?.reply || res?.message || res?.text || 'Hmm, empty reply. Try again?';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant',
        text: `Couldn't reach the brain: ${err.message || 'connection failed'}. Check Models in Settings.`
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="dm-inf-messages">
        {messages.map((m, i) => (
          <div key={i} className={`dm-inf-msg ${m.role}`}>
            <span className="dm-inf-avatar">
              {m.role === 'assistant' ? <Bot size={15} /> : <User size={15} />}
            </span>
            <div className="dm-inf-bubble">{m.text}</div>
          </div>
        ))}
        {sending && (
          <div className="dm-inf-msg assistant">
            <span className="dm-inf-avatar"><Bot size={15} /></span>
            <div className="dm-inf-bubble dm-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="dm-inf-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={
            mode === 'chat' ? 'Message Infinity AI…' :
            mode === 'plan' ? 'Describe your idea…' :
            'What should I build?…'
          }
          disabled={sending}
        />
        <button onClick={send} disabled={sending || !input.trim()} aria-label="Send">
          {sending ? <Loader2 size={17} className="dm-spin" /> : <Send size={17} />}
        </button>
      </div>
    </>
  );
}

/** Infinity Control — command center for the whole system. */
function ControlPane() {
  const [loading, setLoading] = useState(true);
  const [brain, setBrain] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [computer, setComputer] = useState(null);
  const backendMode = getBackendMode();

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, j, c] = await Promise.all([
        getProviders().catch(() => null),
        listJobs({ limit: 20 }).catch(() => null),
        getComputerStatus().catch(() => null)
      ]);
      setBrain(p);
      setJobs(j?.jobs || []);
      setComputer(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const running = jobs.filter((j) => String(j.status).toLowerCase() === 'running');

  const rows = [
    {
      icon: backendMode === BACKEND_MODES.VERCEL ? Cloud : Monitor,
      label: 'Backend',
      value: backendMode === BACKEND_MODES.VERCEL ? 'Cloud' : 'Localhost',
      detail: backendMode === BACKEND_MODES.VERCEL
        ? 'Hosted API — switch to Localhost in Settings for full power'
        : 'Your machine — hunts, computer control, local models',
      ok: true
    },
    {
      icon: Cpu,
      label: 'Brain',
      value: brain?.active || brain?.providers?.[0]?.name || 'Default',
      detail: 'Same brain powers Hunt and Infinity AI',
      ok: !!brain
    },
    {
      icon: Crosshair,
      label: 'Hunts',
      value: running.length > 0 ? `${running.length} live` : 'Idle',
      detail: `${jobs.length} total hunts on record`,
      ok: true
    },
    {
      icon: Monitor,
      label: 'Computer control',
      value: computer?.enabled === false ? 'Off' : 'Ready',
      detail: backendMode === BACKEND_MODES.LOCALHOST
        ? 'Live screen available on localhost'
        : 'Available when backend is Localhost',
      ok: backendMode === BACKEND_MODES.LOCALHOST
    }
  ];

  return (
    <div className="dm-control">
      <div className="dm-control-head">
        <h3>🎛️ Infinity Control</h3>
        <p>Everything, one glance. The whole system, under your command.</p>
        <button className="dm-test-btn" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'dm-spin' : ''} /> Refresh
        </button>
      </div>
      {loading ? (
        <div className="dm-control-loading"><Loader2 size={20} className="dm-spin" /> Reading system…</div>
      ) : (
        <div className="dm-control-grid">
          {rows.map((r, i) => (
            <div key={i} className="dm-control-card">
              <span className="dm-control-icon"><r.icon size={20} /></span>
              <div className="dm-control-body">
                <span className="dm-control-label">{r.label}</span>
                <span className="dm-control-value">
                  {r.ok ? <CheckCircle2 size={14} className="dm-ok" /> : <XCircle size={14} className="dm-bad" />}
                  {r.value}
                </span>
                <span className="dm-control-detail">{r.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="dm-control-links">
        <a href="/agent/models">🧠 Models</a>
        <a href="/agent/reports">📄 Reports</a>
        <a href="/agent/settings">⚙️ Settings</a>
        <a href="/agent">🎯 New hunt</a>
      </div>
    </div>
  );
}

export function InfinityAI() {
  const [mode, setMode] = useState('chat');
  const active = MODES.find((m) => m.id === mode);

  return (
    <div className="dm-inf">
      <div className="dm-inf-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`dm-inf-tab${mode === m.id ? ' active' : ''}`}
            onClick={() => setMode(m.id)}
            title={m.hint}
          >
            <m.icon size={16} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="dm-inf-sub">
        <active.icon size={13} /> {active.hint}
      </div>

      <div className="dm-inf-body">
        {mode === 'control' ? <ControlPane /> : <ChatPane mode={mode} />}
      </div>

      <div className="dm-inf-foot">
        <FileText size={12} />
        <span>Powered by your brain — the same one behind Hunt. Change it in Models.</span>
      </div>
    </div>
  );
}
