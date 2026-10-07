/**
 * InfinityAI — your AI companion.
 *
 * Four modes, one brain:
 *   Chat     — ask anything, casual conversation, explain, debug
 *   Plan     — describe an idea → get a real step-by-step plan (numbered,
 *              with tools/apps needed). Planning only — never executes.
 *   Build    — the agent reads/writes REAL files inside a sandboxed
 *              workspace (backend/data/agent-workspace/).
 *   Control  — Infinity Control: natural-language desktop commands.
 *              NL → decomposed GUI plan → every step validated against the
 *              closed action schema → executed by the computer adapter.
 *
 * Same brain powers Hunt and Infinity AI.
 *
 * Design: Dark Matter "quiet luxury" system (dm-* classes + tokens below).
 * Simple, elegant, professional — no neon, no decoration.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send, Loader2, Bot, User, MessageCircle, ClipboardList,
  Hammer, SlidersHorizontal, Cpu, CheckCircle2, XCircle,
  FileCode2, Eye, MousePointerClick, Clock3, AppWindow,
  ShieldCheck, Play, Paperclip, FolderOpen, X, Plus,
  ChevronDown, Check, PanelRightOpen, PanelRightClose,
  Brain, CircleHelp, Ban, TriangleAlert, Volume2, VolumeX
} from 'lucide-react';
import { sendDirectChat, parseActionIntent, getComputerStatus, getInfiniteHistory } from '../../services/api';
import { planWithInfinity, buildWithInfinity, uploadBuildFiles, readWorkspaceFile } from '../../services/api';
import {
  createComputerTask, cancelComputerTask, answerComputerTask,
  subscribeToComputerTaskEvents, getBrainChain
} from '../../services/api';
import { recordConversation } from '../../services/chatHistory';
import { getBackendUrl } from '../../services/backendMode';
import { Avatar } from '../../components/fx/Avatar';
import { BrainGate } from '../../components/BrainGate';
import { CrewPanel } from '../../components/agent/CrewPanel';
import { speak, isVoiceReady } from '../../services/voice';
import { MicButton, VoiceModeToggle } from '../../components/agent/VoiceInput';
import { useVoiceConversation } from '../../hooks/useVoiceConversation';

/* ── Page-local styles: chat layout pieces the dm-* system doesn't cover.
 * Uses only dm- design tokens. Zero decorative animation. ─────────── */
const DM_INF_CSS = `
.dm-inf-page { display: flex; flex-direction: column; gap: var(--dm-4); }
.dm-inf-layout { display: flex; gap: var(--dm-4); align-items: stretch; }
.dm-inf-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--dm-4); }
.dm-inf-side { width: 272px; flex-shrink: 0; }
@media (max-width: 900px) {
  .dm-inf-layout { flex-direction: column; }
  .dm-inf-side { width: 100%; }
}

/* ── Chat messages ── */
.dm-chat-messages { display: flex; flex-direction: column; gap: var(--dm-4); }
.dm-msg { display: flex; gap: var(--dm-3); max-width: 86%; }
.dm-msg-user { align-self: flex-end; flex-direction: row-reverse; }
.dm-msg-assistant { align-self: flex-start; }
@media (max-width: 600px) { .dm-msg { max-width: 96%; } }
.dm-msg-avatar {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: var(--dm-r-full);
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--dm-surface-2); border: 1px solid var(--dm-border);
  color: var(--dm-text-2); margin-top: 2px;
}
.dm-bubble {
  padding: var(--dm-3) var(--dm-4); border-radius: var(--dm-r-lg);
  font-size: var(--dm-text-base); line-height: 1.65; white-space: pre-wrap;
  overflow-wrap: break-word; color: var(--dm-text);
}
.dm-msg-user .dm-bubble { background: var(--dm-gold-glow); border: 1px solid var(--dm-gold-border); }
.dm-msg-assistant .dm-bubble { background: var(--dm-surface); border: 1px solid var(--dm-border); }

/* ── Composer: one clean row ── */
.dm-composer {
  display: flex; align-items: center; gap: var(--dm-2);
  background: var(--dm-surface); border: 1px solid var(--dm-border);
  border-radius: var(--dm-r-lg); padding: var(--dm-2) var(--dm-2) var(--dm-2) var(--dm-3);
}
.dm-composer:focus-within { border-color: var(--dm-gold-border); box-shadow: 0 0 0 3px var(--dm-gold-glow); }
.dm-composer input {
  flex: 1; min-width: 0; background: transparent; border: none; outline: none;
  font-family: var(--dm-font); font-size: var(--dm-text-base); color: var(--dm-text);
  padding: var(--dm-2) var(--dm-1);
}
.dm-composer input::placeholder { color: var(--dm-muted); }
.dm-composer input:disabled { opacity: 0.5; }
.dm-icon-btn {
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: var(--dm-r); border: 1px solid transparent;
  background: transparent; color: var(--dm-text-2); cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.dm-icon-btn:hover:not(:disabled) { background: var(--dm-surface-2); color: var(--dm-text); }
.dm-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dm-icon-btn-primary { background: var(--dm-gold); color: #16130a; }
.dm-icon-btn-primary:hover:not(:disabled) { background: var(--dm-gold-soft); color: #16130a; }

/* ── Mode dropdown (inside the composer) ── */
.dm-mode-dd { position: relative; flex-shrink: 0; }
.dm-mode-menu {
  position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 40;
  min-width: 240px; background: var(--dm-surface); border: 1px solid var(--dm-border);
  border-radius: var(--dm-r-lg); box-shadow: var(--dm-shadow-lg); padding: var(--dm-1);
}
.dm-mode-item {
  display: flex; align-items: center; gap: var(--dm-3); width: 100%;
  padding: var(--dm-2) var(--dm-3); border: none; border-radius: var(--dm-r);
  background: transparent; color: var(--dm-text); cursor: pointer; text-align: left;
  font-family: var(--dm-font);
}
.dm-mode-item:hover { background: var(--dm-surface-2); }
.dm-mode-item-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.dm-mode-item-text strong { font-size: var(--dm-text-sm); font-weight: 600; }
.dm-mode-item-text small { font-size: var(--dm-text-xs); color: var(--dm-muted); }
.dm-mode-item .dm-check { color: var(--dm-gold-soft); flex-shrink: 0; }
.dm-caret-up { transform: rotate(180deg); }

/* ── Attachment chips ── */
.dm-attach-chips { display: flex; flex-wrap: wrap; gap: var(--dm-2); margin-bottom: var(--dm-2); }
.dm-chip-x {
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--dm-muted); cursor: pointer;
  padding: 2px; border-radius: var(--dm-r-sm);
}
.dm-chip-x:hover { color: var(--dm-red); }

/* ── Typing indicator (functional) ── */
.dm-typing { display: inline-flex; gap: 5px; padding: 4px 2px; }
.dm-typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--dm-muted); }
.dm-spin { animation: dm-spin 0.9s linear infinite; }
@keyframes dm-spin { to { transform: rotate(360deg); } }

/* ── Voice status ── */
.dm-voice-status {
  display: flex; align-items: center; gap: var(--dm-2);
  font-size: var(--dm-text-sm); color: var(--dm-text-2);
  padding: var(--dm-2) var(--dm-1);
}
.dm-voice-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dm-red); flex-shrink: 0; }

/* ── Plan steps ── */
.dm-plan-steps { list-style: none; margin: var(--dm-4) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--dm-3); }
.dm-plan-step { display: flex; gap: var(--dm-4); }
.dm-plan-num {
  flex-shrink: 0; width: 30px; height: 30px; border-radius: var(--dm-r-full);
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--dm-gold-glow); border: 1px solid var(--dm-gold-border);
  color: var(--dm-gold-soft); font-size: var(--dm-text-sm); font-weight: 700;
}
.dm-plan-step-body { flex: 1; min-width: 0; }
.dm-plan-step-body strong { display: block; font-size: var(--dm-text-base); margin-bottom: 2px; }
.dm-plan-step-body p { margin: 0; font-size: var(--dm-text-sm); color: var(--dm-text-2); line-height: 1.6; }
.dm-plan-tools { display: flex; flex-wrap: wrap; gap: var(--dm-2); margin-top: var(--dm-2); }

/* ── Control feed ── */
.dm-feed { display: flex; flex-direction: column; gap: var(--dm-1); }
.dm-feed-row {
  display: flex; gap: var(--dm-3); align-items: flex-start;
  padding: var(--dm-2) var(--dm-3); border-radius: var(--dm-r);
  font-size: var(--dm-text-sm); line-height: 1.55; color: var(--dm-text-2);
}
.dm-feed-row.ok { color: var(--dm-green); }
.dm-feed-row.bad { color: var(--dm-red); }
.dm-feed-ico { flex-shrink: 0; margin-top: 2px; display: inline-flex; }

/* ── File preview ── */
.dm-code {
  margin: 0; padding: var(--dm-4); border-radius: var(--dm-r);
  background: var(--dm-bg-2); border: 1px solid var(--dm-border);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: var(--dm-text-sm); line-height: 1.6; color: var(--dm-text);
  overflow-x: auto; white-space: pre;
}

/* ── Error notice (red variant) ── */
.dm-notice-red { border-color: rgba(248, 113, 113, 0.3); background: rgba(248, 113, 113, 0.07); color: var(--dm-text); }

/* ── Loading row (functional) ── */
.dm-loading-row { display: flex; align-items: center; gap: var(--dm-3); padding: var(--dm-4); color: var(--dm-text-2); font-size: var(--dm-text-sm); }

/* ── Avatar panel bits ── */
.dm-side-state {
  display: inline-flex; align-items: center; gap: var(--dm-2);
  font-size: var(--dm-text-sm); color: var(--dm-text-2); font-weight: 600;
}
.dm-state-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dm-muted); }
.dm-state-thinking .dm-state-dot { background: var(--dm-amber); }
.dm-state-speaking .dm-state-dot { background: var(--dm-green); }
.dm-state-listening .dm-state-dot { background: var(--dm-blue); }
.dm-seg { display: flex; gap: var(--dm-1); flex-wrap: wrap; }
.dm-seg-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--dm-font); font-size: var(--dm-text-xs); font-weight: 600;
  padding: 7px 12px; border-radius: var(--dm-r-full);
  border: 1px solid var(--dm-border); background: var(--dm-surface-2);
  color: var(--dm-text-2); cursor: pointer;
}
.dm-seg-btn:hover { border-color: var(--dm-border-strong); color: var(--dm-text); }
.dm-seg-btn[aria-pressed="true"] {
  background: var(--dm-gold-glow); border-color: var(--dm-gold-border); color: var(--dm-gold-soft);
}

/* ── Small helpers ── */
.dm-row-between { display: flex; align-items: center; justify-content: space-between; gap: var(--dm-3); flex-wrap: wrap; }
.dm-clickable-badge { cursor: pointer; }
.dm-clickable-badge:hover { border-color: var(--dm-gold-border); color: var(--dm-gold-soft); }
.dm-ask-box { display: flex; flex-direction: column; gap: var(--dm-3); }
`;

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

/* ── Shared: mode-switcher dropdown that lives INSIDE each input row ───── */

function ModeDropdown({ mode, setMode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef({});
  const active = MODES.find((m) => m.id === mode) || MODES[0];

  // Close on outside click / Escape (Escape returns focus to the trigger).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  // Full listbox keyboard support: opening moves focus to the current
  // option; arrows/Home/End move between options; the trigger regains
  // focus when the menu closes via Escape.
  const focusOption = (id) => {
    optionRefs.current[id]?.focus();
  };

  const onMenuKeyDown = (e) => {
    const ids = MODES.map((m) => m.id);
    const i = ids.indexOf(document.activeElement?.dataset?.optionId ?? mode);
    let next = null;
    if (e.key === 'ArrowDown') next = ids[(i + 1) % ids.length];
    else if (e.key === 'ArrowUp') next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === 'Home') next = ids[0];
    else if (e.key === 'End') next = ids[ids.length - 1];
    else return;
    e.preventDefault();
    focusOption(next);
  };

  const openMenu = () => {
    setOpen(true);
    // Focus the current option once the menu is painted.
    requestAnimationFrame(() => focusOption(mode));
  };

  const ActiveIcon = active.icon;
  return (
    <div className="dm-mode-dd" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="dm-btn dm-btn-secondary dm-btn-sm"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch mode"
      >
        <ActiveIcon size={15} />
        <span>{active.label}</span>
        <ChevronDown size={14} className={open ? 'dm-caret-up' : ''} />
      </button>
      {open && (
        <div className="dm-mode-menu" role="listbox" aria-label="Switch mode" onKeyDown={onMenuKeyDown}>
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                ref={(el) => { if (el) optionRefs.current[m.id] = el; }}
                data-option-id={m.id}
                role="option"
                aria-selected={m.id === mode}
                tabIndex={-1}
                className="dm-mode-item"
                onClick={() => { setMode(m.id); setOpen(false); triggerRef.current?.focus(); }}
              >
                <Icon size={15} />
                <span className="dm-mode-item-text">
                  <strong>{m.label}</strong>
                  <small>{m.hint}</small>
                </span>
                {m.id === mode && <Check size={14} className="dm-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Shared: [+] attach button + removable file chips ──────────────────── */
/* MVP: files are stored in pane state and their names are appended to the
   outgoing message as "[Attached: a.png, b.pdf]". Real content upload comes
   later — except Build mode, which already uploads for real. */

function fileSuffix(files) {
  if (!files || !files.length) return '';
  return `\n[Attached: ${files.map((f) => f.name).join(', ')}]`;
}

function AttachButton({ onPick, title = 'Attach files', disabled = false, children }) {
  const inputRef = useRef(null);
  return (
    <>
      <button
        type="button"
        className="dm-icon-btn"
        onClick={() => inputRef.current?.click()}
        title={title}
        aria-label={title}
        disabled={disabled}
      >
        {children || <Plus size={17} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

function AttachChips({ files, onRemove }) {
  if (!files?.length) return null;
  return (
    <div className="dm-attach-chips" aria-label="Attached files">
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="dm-badge">
          <Paperclip size={12} />
          <span title={f.name}>{f.name}</span>
          {typeof f.size === 'number' && (
            <span className="dm-muted">{(f.size / 1024).toFixed(1)} KB</span>
          )}
          <button
            type="button"
            className="dm-chip-x"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${f.name}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

function ChatPane({ mode, setMode, initialConversationId, onAvatarState, onAvatarEmotion, avatarVoice, avatarVoiceName, onSpeakAmplitude }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: WELCOME[mode] }]);
  const [loadingHistory, setLoadingHistory] = useState(!!initialConversationId);
  // One conversation per pane — the backend creates it on first message.
  // When resumed from the sidebar, reuse the stored conversation id.
  const convRef = useRef(
    initialConversationId || `${mode}-${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))}`
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]); // MVP attachments (names appended to the message)
  const [voiceMode, setVoiceMode] = useState(false); // hands-free voice conversation
  const bottomRef = useRef(null);
  const voiceModeRef = useRef(false);
  const sendingRef = useRef(false);
  const ttsAbortRef = useRef(null);
  const sendTextRef = useRef(null);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []).filter((f) => f.size >= 0);
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked].slice(0, 10));
  };
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

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

  // Reduced-motion users jump straight to the bottom — no smooth scrolling.
  useEffect(() => {
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, [messages]);

  const sendText = async (rawText) => {
    const text = String(rawText ?? input).trim();
    const suffix = fileSuffix(files);
    if ((!text && !files.length) || sendingRef.current) return;
    sendingRef.current = true;
    const fullText = text + suffix;
    setInput('');
    setFiles([]);
    setMessages((m) => [...m, { role: 'user', text: fullText }]);
    // Index this conversation for the sidebar chat history.
    const titleBase = text || `${files.length} file(s) attached`;
    recordConversation({
      id: convRef.current,
      mode,
      title: titleBase.length > 48 ? `${titleBase.slice(0, 48)}…` : titleBase,
    });
    setSending(true);
    onAvatarState?.('thinking');
    onAvatarEmotion?.('thinking');
    try {
      // First: check if this is an ACTION command ("khol de") vs chat.
      let intent = null;
      try { intent = await parseActionIntent(fullText); } catch { /* fall through to chat */ }

      if (intent?.type === 'action') {
        // Safe action — tell the user we're doing it, then route to Control.
        const doingMsg = intent.message || 'Kar raha hoon…';
        setMessages((m) => [...m, { role: 'assistant', text: doingMsg }]);
        onAvatarState?.('speaking');
        setTimeout(() => onAvatarState?.('idle'), 2500);
        // Note: full Control-mode execution happens when the user switches
        // to the Control tab; here we acknowledge the intent.
        return;
      }
      if (intent?.type === 'action_blocked') {
        const blockedMsg = intent.message || 'Ye action main nahi kar sakta.';
        setMessages((m) => [...m, { role: 'assistant', text: blockedMsg }]);
        onAvatarState?.('speaking');
        setTimeout(() => onAvatarState?.('idle'), 2500);
        return;
      }

      // Chat intent — normal brain response.
      const res = await sendDirectChat(fullText, convRef.current);
      const reply = res?.reply || res?.message || res?.text || 'Hmm, empty reply. Try again?';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
      // The backend picks one emotion per reply (backend/src/avatar/emotionPicker.js).
      onAvatarEmotion?.(typeof res?.emotion === 'string' ? res.emotion : 'neutral');
      // Avatar SPEAKS the reply with a real voice + lip-sync, then idles.
      onAvatarState?.('speaking');
      // Voice mode implies spoken replies even if the voice toggle is muted.
      const speakVoice = voiceModeRef.current ? avatarVoiceName : avatarVoice;
      if (speakVoice) {
        try {
          ttsAbortRef.current = voiceModeRef.current ? new AbortController() : null;
          await speak(reply, {
            voice: speakVoice,
            onAmplitude: (amp) => onSpeakAmplitude?.(amp),
            signal: ttsAbortRef.current?.signal,
          });
        } catch {
          // Aborted mid-reply (voice mode stopped) — end silently.
          const aborted = ttsAbortRef.current?.signal.aborted;
          ttsAbortRef.current = null;
          if (!aborted) {
            // Voice failed — fall back to timed speaking animation.
            const speakMs = Math.min(8000, Math.max(1800, reply.length * 32));
            await new Promise((r) => setTimeout(r, speakMs));
          }
        }
      } else {
        // Voice muted — just animate.
        const speakMs = Math.min(8000, Math.max(1800, reply.length * 32));
        await new Promise((r) => setTimeout(r, speakMs));
      }
      onAvatarState?.('idle');
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant',
        text: `Couldn't reach the brain: ${(err.message || 'connection failed').replace(/\.+$/, '')}. Check Models in Settings.`
      }]);
      onAvatarState?.('idle');
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };
  sendTextRef.current = sendText;

  const send = () => sendText(input);

  // Hands-free voice conversation: mic → transcript auto-sends → reply is
  // spoken aloud → mic re-opens. The avatar mirrors listening/speaking.
  const toggleVoiceMode = () => {
    const next = !voiceMode;
    voiceModeRef.current = next;
    setVoiceMode(next);
    if (!next) {
      try { ttsAbortRef.current?.abort(); } catch { /* noop */ }
      onAvatarState?.('idle');
    }
  };

  const voiceConvo = useVoiceConversation({
    active: voiceMode,
    onTranscript: (text) => sendTextRef.current?.(text),
    onStateChange: (s) => onAvatarState?.(s),
  });

  return (
    <>
      <div className="dm-chat-messages">
        {loadingHistory ? (
          <div className="dm-msg dm-msg-assistant">
            <span className="dm-msg-avatar"><Bot size={15} /></span>
            <div className="dm-bubble"><Loader2 size={15} className="dm-spin" /> Loading conversation…</div>
          </div>
        ) : messages.map((m, i) => (
          <div key={i} className={`dm-msg ${m.role === 'user' ? 'dm-msg-user' : 'dm-msg-assistant'}`}>
            <span className="dm-msg-avatar">
              {m.role === 'assistant' ? <Bot size={15} /> : <User size={15} />}
            </span>
            <div className="dm-bubble">{m.text}</div>
          </div>
        ))}
        {sending && (
          <div className="dm-msg dm-msg-assistant">
            <span className="dm-msg-avatar"><Bot size={15} /></span>
            <div className="dm-bubble">
              <span className="dm-typing" aria-label="Typing"><span /><span /><span /></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <AttachChips files={files} onRemove={removeFile} />
      {voiceMode && (
        <div className="dm-voice-status" role="status" aria-live="polite">
          <span className="dm-voice-dot" aria-hidden="true" />
          {!voiceConvo.supported
            ? 'Voice input isn\u2019t supported in this browser \u2014 try Chrome or Edge'
            : voiceConvo.processing
            ? 'Replying…'
            : voiceConvo.listening
              ? (voiceConvo.interim ? `Heard: “${voiceConvo.interim}…”` : 'Listening — speak now')
              : 'Voice chat on'}
        </div>
      )}
      <div className="dm-composer">
        <ModeDropdown mode={mode} setMode={setMode} />
        <AttachButton onPick={addFiles} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message Infinity AI…"
          aria-label="Message Infinity AI"
          disabled={sending}
        />
        <MicButton
          onFinal={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
          className="dm-icon-btn"
          disabled={sending || voiceMode}
          onListeningChange={(listening) => { if (!voiceModeRef.current) onAvatarState?.(listening ? 'listening' : 'idle'); }}
        />
        <VoiceModeToggle active={voiceMode} onToggle={toggleVoiceMode} disabled={sending && !voiceMode} />
        <button
          type="button"
          className="dm-icon-btn dm-icon-btn-primary"
          onClick={send}
          disabled={sending || (!input.trim() && !files.length)}
          aria-label="Send"
        >
          {sending ? <Loader2 size={17} className="dm-spin" /> : <Send size={17} />}
        </button>
      </div>
    </>
  );
}

/* ── Plan mode ─────────────────────────────────────────────────────────── */

function PlanPane({ mode, setMode }) {
  const conversationId = useConversationId('plan');
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]); // MVP attachments (names appended to the instruction)

  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []).filter((f) => f.size >= 0);
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked].slice(0, 10));
  };
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const run = async () => {
    const instruction = input.trim();
    const suffix = fileSuffix(files);
    if ((!instruction && !files.length) || loading) return;
    const full = instruction + suffix;
    setLoading(true);
    setError('');
    try {
      const res = await planWithInfinity(full, conversationId);
      if (!res?.plan?.steps?.length) throw new Error('The planner returned no steps.');
      setPlan(res.plan);
      setFiles([]);
    } catch (err) {
      setError(err.message || 'Planning failed.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <AttachChips files={files} onRemove={removeFile} />
      <div className="dm-composer">
        <ModeDropdown mode={mode} setMode={setMode} />
        <AttachButton onPick={addFiles} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="Describe your idea… e.g. “a portfolio website for a photographer”"
          aria-label="Describe your idea"
          disabled={loading}
        />
        <MicButton onFinal={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
          className="dm-icon-btn" disabled={loading} />
        <button
          type="button"
          className="dm-icon-btn dm-icon-btn-primary"
          onClick={run}
          disabled={loading || (!input.trim() && !files.length)}
          aria-label="Make plan"
        >
          {loading ? <Loader2 size={17} className="dm-spin" /> : <ClipboardList size={17} />}
        </button>
      </div>
      <p className="dm-hint dm-center">Planning only — nothing is executed. Switch to Build to make it real.</p>

      {error && <div className="dm-notice dm-notice-red dm-mt-4" role="alert">{error}</div>}

      {loading && (
        <div className="dm-loading-row"><Loader2 size={20} className="dm-spin" /> Turning your idea into a plan…</div>
      )}

      {plan && !loading && (
        <div className="dm-card dm-mt-4">
          <div className="dm-row-between">
            <h3 className="dm-card-title">{plan.task}</h3>
            <span className="dm-badge dm-badge-gold">{plan.taskType}</span>
          </div>
          <ol className="dm-plan-steps">
            {plan.steps.map((s) => (
              <li key={s.n} className="dm-plan-step">
                <span className="dm-plan-num">{s.n}</span>
                <div className="dm-plan-step-body">
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                  {s.tools?.length > 0 && (
                    <div className="dm-plan-tools">
                      {s.tools.map((t, i) => <span key={i} className="dm-badge">{t}</span>)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {plan.refinedByBrain && <p className="dm-hint dm-mt-4">Refined by your local brain.</p>}
        </div>
      )}
    </div>
  );
}

/* ── Build mode ────────────────────────────────────────────────────────── */

function BuildPane({ mode, setMode }) {
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
    <div>
      {attached.length > 0 && (
        <div className="dm-attach-chips">
          {attached.map((a) => (
            <span key={a.path} className="dm-badge">
              <FileCode2 size={13} />
              <span title={a.path}>{a.name}</span>
              <span className="dm-muted">{(a.size / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                className="dm-chip-x"
                onClick={() => removeAttached(a.path)}
                aria-label={`Remove ${a.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="dm-composer">
        <ModeDropdown mode={mode} setMode={setMode} />
        <button
          type="button"
          className="dm-icon-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || loading}
          title="Attach files from your machine"
          aria-label="Attach files"
        >
          {uploading ? <Loader2 size={15} className="dm-spin" /> : <Plus size={17} />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="What should I build?… e.g. “a portfolio page for Rahul Sharma”"
          aria-label="Describe what to build"
          disabled={loading}
        />
        <MicButton onFinal={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
          className="dm-icon-btn" disabled={loading} />
        <button
          type="button"
          className="dm-icon-btn dm-icon-btn-primary"
          onClick={run}
          disabled={loading || uploading || !input.trim()}
          aria-label="Build"
        >
          {loading ? <Loader2 size={17} className="dm-spin" /> : <Hammer size={17} />}
        </button>
      </div>

      {/* ── Attach a whole folder as brain context ── */}
      <div className="dm-row-between dm-mt-2">
        <button
          type="button"
          className="dm-btn dm-btn-ghost dm-btn-sm"
          onClick={() => folderInputRef.current?.click()}
          disabled={uploading || loading}
          title="Attach a whole folder from your machine"
        >
          <FolderOpen size={14} />
          <span>Attach folder</span>
        </button>
        <span className="dm-hint">
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

      <p className="dm-hint dm-center dm-mt-2">
        <ShieldCheck size={12} style={{ verticalAlign: '-2px' }} /> Real files, sandboxed workspace only — the agent can never touch anything outside it.
        {build?.brainBuilt && <span className="dm-badge dm-badge-gold" style={{ marginLeft: 8 }}>Built by your active brain</span>}
      </p>

      {error && <div className="dm-notice dm-notice-red dm-mt-4" role="alert">{error}</div>}

      {loading && (
        <div className="dm-loading-row"><Loader2 size={20} className="dm-spin" /> Agent is writing files…</div>
      )}

      {build && !loading && (
        <div className="dm-card dm-mt-4">
          <div className="dm-row-between">
            <h3 className="dm-card-title">{build.projectDir}</h3>
            <span className="dm-badge dm-badge-gold">{build.files.length} files</span>
          </div>
          <p className="dm-card-sub">{build.note}</p>
          <div>
            {build.files.map((f) => (
              <button
                key={f.path}
                type="button"
                className="dm-row"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}
                onClick={() => openPreview(f.path)}
              >
                <FileCode2 size={16} style={{ flexShrink: 0, color: 'var(--dm-text-2)' }} />
                <span className="dm-row-main">
                  <span className="dm-row-title">{f.path}</span>
                </span>
                <span className="dm-muted" style={{ fontSize: 'var(--dm-text-xs)' }}>{(f.size / 1024).toFixed(1)} KB</span>
                <Eye size={14} style={{ flexShrink: 0, color: 'var(--dm-muted)' }} />
              </button>
            ))}
          </div>
          {(preview || previewLoading) && (
            <div className="dm-mt-4">
              <div className="dm-row-between" style={{ marginBottom: 'var(--dm-2)' }}>
                <span className="dm-badge"><FileCode2 size={12} /> {preview?.path || 'Loading…'}</span>
              </div>
              {previewLoading
                ? <div className="dm-loading-row"><Loader2 size={16} className="dm-spin" /></div>
                : <pre className="dm-code">{preview?.content}</pre>}
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

function ControlPane({ mode, setMode }) {
  const conversationId = useConversationId('control');
  const backendUrl = getBackendUrl();
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
  const [files, setFiles] = useState([]); // MVP attachments (names appended to the command)
  const unsubRef = useRef(null);
  const feedEndRef = useRef(null);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []).filter((f) => f.size >= 0);
    if (!picked.length) return;
    setFiles((prev) => [...prev, ...picked].slice(0, 10));
  };
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

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
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    feedEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
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
    const suffix = fileSuffix(files);
    if ((!instruction && !files.length) || running) return;
    const full = instruction + suffix;
    setError('');
    setFeed([]);
    setAskQ(null);
    setAnswer('');
    unsubRef.current?.(); unsubRef.current = null;
    try {
      const res = await createComputerTask(full, conversationId);
      setTaskId(res.taskId);
      setTaskStatus(res.taskStatus || 'running');
      setFiles([]);
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
    <>
      {/* Infinity Crew: persistent AI coworkers with their own computers.
          Rendered above the one-shot task panel — that flow is untouched. */}
      <CrewPanel />
      <div className="dm-card dm-mt-4">
        <div className="dm-row-between" style={{ marginBottom: 'var(--dm-4)' }}>
          <span className="dm-badge">
            <Cpu size={12} /> Backend: {backendUrl}
          </span>
          <span className="dm-badge">
            <AppWindow size={12} /> Desktop runtime: {runtimeLabel}
          </span>
          {brainName && (
            <span className="dm-badge" title="The brain thinking for Control mode — same as Hunt AI and Infinity AI">
              <Bot size={12} /> Brain: {brainName}
            </span>
          )}
        </div>

        <h3 className="dm-card-title">Tell me what to do on the computer</h3>
        <p className="dm-card-sub">
          For example: “MS Word me leave application likho”. Your active brain reasons it out
          step by step — opening the app, observing the screen, acting, and verifying —
          and you watch it think live below. Nothing is canned: the brain composes every word itself.
        </p>

        <AttachChips files={files} onRemove={removeFile} />
        <div className="dm-composer">
          <ModeDropdown mode={mode} setMode={setMode} />
          <AttachButton onPick={addFiles} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
            placeholder="Command the computer… e.g. “MS Word me leave application likho”"
            aria-label="Command for the computer"
            disabled={running}
          />
          <MicButton onFinal={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))}
            className="dm-icon-btn" disabled={running} />
          {running ? (
            <button
              type="button"
              className="dm-icon-btn"
              onClick={stop}
              aria-label="Stop the agent"
              title="Stop the agent"
            >
              <XCircle size={17} />
            </button>
          ) : (
            <button
              type="button"
              className="dm-icon-btn dm-icon-btn-primary"
              onClick={start}
              disabled={!input.trim() && !files.length}
              aria-label="Start"
            >
              <Play size={17} />
            </button>
          )}
        </div>

        {taskId && (
          <div className="dm-row-between dm-mt-4">
            <span className="dm-badge">
              {taskStatus === 'completed' ? <CheckCircle2 size={12} /> : taskStatus === 'failed' ? <XCircle size={12} /> : <Loader2 size={12} className="dm-spin" />}
              {taskStatus === 'waiting_ai' ? 'Waiting for the brain…' : taskStatus || 'running'}
            </span>
            {!running && (
              <button type="button" className="dm-btn dm-btn-ghost dm-btn-sm" onClick={reset}>New command</button>
            )}
          </div>
        )}

        {error && <div className="dm-notice dm-notice-red dm-mt-4" role="alert">{error}</div>}

        {askQ && running && (
          <div className="dm-card dm-mt-4" style={{ background: 'var(--dm-bg-2)' }}>
            <div className="dm-ask-box">
              <p style={{ margin: 0, fontSize: 'var(--dm-text-base)' }}>
                <strong>
                  <CircleHelp size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> The agent asks:
                </strong>{' '}{askQ}
              </p>
              <div className="dm-composer">
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendAnswer()}
                  placeholder="Your answer…"
                  aria-label="Answer the agent's question"
                />
                <button
                  type="button"
                  className="dm-icon-btn dm-icon-btn-primary"
                  onClick={sendAnswer}
                  disabled={!answer.trim()}
                  aria-label="Send answer"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {feed.length > 0 && (
          <div className="dm-feed dm-mt-4">
            {feed.map((ev, i) => (
              <FeedRow key={i} ev={ev} />
            ))}
            <div ref={feedEndRef} />
          </div>
        )}

        {!taskId && (
          <div className="dm-mt-4" style={{ display: 'flex', alignItems: 'center', gap: 'var(--dm-2)', flexWrap: 'wrap' }}>
            <span className="dm-hint">Try:</span>
            {[
              'MS Word me leave application likho',
              'Open calculator',
              'Notepad me shopping list likho'
            ].map((ex) => (
              <button
                key={ex}
                type="button"
                className="dm-badge dm-clickable-badge"
                onClick={() => setInput(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function FeedRow({ ev }) {
  const type = ev.__sseType || '';
  const level = ev.level || 'INFO';
  let icon = <Bot size={14} />;
  let cls = '';
  if (type.includes('decision')) icon = <Brain size={14} aria-hidden="true" />;
  else if (type.includes('action')) icon = <MousePointerClick size={14} />;
  else if (type.includes('observation')) icon = <Eye size={14} />;
  else if (type === 'task.ask_user') icon = <CircleHelp size={14} aria-hidden="true" />;
  else if (type === 'task.waiting_ai') icon = <Clock3 size={14} />;
  else if (type === 'task.completed') { icon = <CheckCircle2 size={14} />; cls = ' ok'; }
  else if (type === 'task.failed' || level === 'ERROR') { icon = <XCircle size={14} />; cls = ' bad'; }
  else if (type === 'task.cancelled') icon = <Ban size={14} aria-hidden="true" />;
  else if (level === 'WARN') icon = <TriangleAlert size={14} aria-hidden="true" />;
  return (
    <div className={`dm-feed-row${cls}`}>
      <span className="dm-feed-ico">{icon}</span>
      <span>{ev.message || type}</span>
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
  const backendUrl = getBackendUrl();

  // Avatar state: idle | thinking | speaking | listening
  const [avatarState, setAvatarState] = useState('idle');
  // Avatar emotion: happy | angry | surprised | thinking | neutral (backend-picked per reply)
  const [avatarEmotion, setAvatarEmotion] = useState('neutral');
  const [avatarGender, setAvatarGender] = useState('female');
  const [speakAmp, setSpeakAmp] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  // Voice follows gender: female → aria, male → kai
  const avatarVoice = avatarGender === 'female' ? 'aria' : 'kai';
  // Avatar side panel: open by default on desktop, closed on small screens.
  const [panelOpen, setPanelOpen] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth > 900 : true)
  );

  const avatarStatusLabel = {
    idle: 'Idle', thinking: 'Thinking…', speaking: 'Speaking…', listening: 'Listening…',
  }[avatarState] || 'Idle';

  // Real lip-sync comes from the audio amplitude via onSpeakAmplitude.
  // When voice is muted, fall back to a gentle simulated mouth motion.
  useEffect(() => {
    if (avatarState !== 'speaking' || voiceOn) return;
    const iv = setInterval(() => setSpeakAmp(0.2 + Math.random() * 0.8), 120);
    return () => clearInterval(iv);
  }, [avatarState, voiceOn]);

  return (
    <div className="dm-container dm-inf-page">
      <style>{DM_INF_CSS}</style>

      {/* Page header: title + current-mode hint + actions */}
      <div className="dm-page-head" style={{ marginBottom: 0 }}>
        <div className="dm-row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 className="dm-page-title">Infinity AI</h1>
            <p className="dm-page-sub">{active.hint}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--dm-2)', alignItems: 'center', flexShrink: 0 }}>
            <span className="dm-badge" title="Connected backend">
              <Cpu size={12} /> {backendUrl}
            </span>
            <button
              type="button"
              className="dm-btn dm-btn-ghost dm-btn-sm"
              onClick={() => setPanelOpen((o) => !o)}
              title={panelOpen ? 'Hide avatar panel' : 'Show avatar panel'}
              aria-label="Toggle avatar panel"
              aria-expanded={panelOpen}
            >
              {panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="dm-inf-layout">
        {/* Mode content — each mode gated on its required local brains */}
        <div className="dm-inf-body">
          {mode === 'control' ? (
            <BrainGate required={['vision', 'grounding']} featureName="Control mode">
              <ControlPane key="control" mode={mode} setMode={setMode} />
            </BrainGate>
          )
            : mode === 'plan' ? (
              <BrainGate required={['vision']} featureName="Plan mode">
                <PlanPane key="plan" mode={mode} setMode={setMode} />
              </BrainGate>
            )
            : mode === 'build' ? (
              <BrainGate required={['vision']} featureName="Build mode">
                <BuildPane key="build" mode={mode} setMode={setMode} />
              </BrainGate>
            )
            : (
              <BrainGate required={['vision']} featureName="Chat mode">
                <ChatPane key={paneKey} mode={mode} setMode={setMode} initialConversationId={navState.conversationId}
                  onAvatarState={setAvatarState} onAvatarEmotion={setAvatarEmotion} avatarVoice={voiceOn ? avatarVoice : null}
                  avatarVoiceName={avatarVoice} onSpeakAmplitude={setSpeakAmp} />
              </BrainGate>
            )}
        </div>

        {/* Collapsible avatar side panel. Note: the closed state keeps the
            avatar rail interactive (reopen buttons), so it must NOT be
            aria-hidden — focusable-but-hidden breaks keyboard users. */}
        {panelOpen && (
          <aside className="dm-inf-side" aria-label="Avatar panel">
            <div className="dm-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--dm-4)', textAlign: 'center' }}>
              <Avatar
                gender={avatarGender}
                state={avatarState}
                emotion={avatarEmotion}
                speakAmplitude={speakAmp}
                size={110}
              />
              <span className={`dm-side-state dm-state-${avatarState}`}>
                <span className="dm-state-dot" />
                {avatarStatusLabel}
              </span>
              <div className="dm-seg" role="group" aria-label="Avatar appearance" style={{ justifyContent: 'center' }}>
                {['female', 'male'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className="dm-seg-btn"
                    onClick={() => setAvatarGender(g)}
                    aria-pressed={avatarGender === g}
                  >
                    <User size={14} aria-hidden="true" /> {g}
                  </button>
                ))}
                <button
                  type="button"
                  className="dm-seg-btn"
                  onClick={() => setVoiceOn((v) => !v)}
                  title={voiceOn ? 'Mute voice' : 'Unmute voice'}
                  aria-pressed={voiceOn}
                >
                  {voiceOn
                    ? <Volume2 size={14} aria-hidden="true" />
                    : <VolumeX size={14} aria-hidden="true" />} voice
                </button>
              </div>
              <p className="dm-hint" style={{ margin: 0 }}>
                Your AI companion — it speaks every reply aloud, with live lip-sync.
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile: floating reopen button when the panel is closed */}
      {!panelOpen && (
        <button
          type="button"
          className="dm-btn dm-btn-secondary"
          style={{
            position: 'fixed', bottom: 'var(--dm-6)', right: 'var(--dm-6)', zIndex: 50,
            borderRadius: 'var(--dm-r-full)', padding: 'var(--dm-3)',
          }}
          onClick={() => setPanelOpen(true)}
          title="Show avatar panel"
          aria-label="Show avatar panel"
        >
          <Avatar
            gender={avatarGender}
            state={avatarState}
            emotion={avatarEmotion}
            speakAmplitude={speakAmp}
            size={32}
          />
        </button>
      )}
    </div>
  );
}
