// Chat page — ChatGPT logged-out layout: "Where should we begin?" empty state
// or thread + bottom pill composer. Hunts REQUIRE login: logged-out users get
// the auth modal + "Log in to start a hunt." toast. ■ stop aborts the reply
// stream and stops any running hunts in this chat. All chat/hunt logic unchanged.
import React, { useEffect, useRef, useState } from 'react';
import ChatThread from '../components/ChatThread';
import ChatInput from '../components/ChatInput';
import NewHuntModal from '../components/NewHuntModal';
import VoiceMode from '../components/VoiceMode';
import { sendChat, startHunt } from '../lib/api';
import { streamReveal } from '../lib/streaming';
import { useAuth, openAuthModal } from '../lib/auth';
import { toast } from '../lib/toast';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatPage({
  chat,
  onAppendMessage,
  onUpdateMessage,
  onNewChat,
  onRecordHunt,
  onUpdateHunt,
  onOpenReports,
  onOpenHuntChat,
  huntModalTrigger,
}) {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [huntModalOpen, setHuntModalOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Open hunt modal when triggered from Sidebar "New hunt".
  // The trigger is a counter in App state that only ever increases,
  // and this effect also runs on MOUNT — so after visiting another
  // page (e.g. Admin) and coming back, the remounted page saw the old
  // trigger value > 0 and reopened the "Start a new hunt" dialog
  // unprompted (owner's live QA, 23 Oct 2026). Only a CHANGE of the
  // counter is a real trigger; the mount-time value is remembered,
  // not acted on.
  const prevHuntModalTriggerRef = useRef(huntModalTrigger);
  useEffect(() => {
    if (huntModalTrigger === prevHuntModalTriggerRef.current) return;
    prevHuntModalTriggerRef.current = huntModalTrigger;
    if (huntModalTrigger > 0) {
      if (ensureHuntAuth()) setHuntModalOpen(true);
    }
  }, [huntModalTrigger]);
  // When "Talk with AI" is pressed on a specific hunt card, the voice
  // conversation is scoped to that hunt (works even when paused/idle).
  const [voiceHuntIdOverride, setVoiceHuntIdOverride] = useState(null);
  const [speakerOn, setSpeakerOn] = useState(() => {
    try {
      return localStorage.getItem('dm.speakerOn') === 'true';
    } catch {
      return false;
    }
  });
  const threadEndRef = useRef(null);
  const streamTokenRef = useRef(null);

  const messages = chat && Array.isArray(chat.messages) ? chat.messages : [];

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingId]);

  // Chat "generating" is ONLY about the chat reply stream — a running hunt must
  // never block sending chat messages. The hunt has its own Stop on its card.
  const generating = sending || streamingId !== null;

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    try {
      localStorage.setItem('dm.speakerOn', String(next));
    } catch { /* ignore */ }
    toast(next ? 'Spoken replies enabled.' : 'Spoken replies muted.', 'info');
  }

  /** Hunts require login — otherwise open the auth modal. */
  function ensureHuntAuth() {
    if (!user) {
      openAuthModal('login');
      toast('Log in to start a hunt.', 'info');
      return false;
    }
    return true;
  }

  /** ■ stop: abort the chat reply stream only. Hunts are stopped from their
      own Stop button on the hunt card — never from the chat stop. */
  function handleStop() {
    if (streamTokenRef.current) streamTokenRef.current.aborted = true;
    setSending(false);
    setStreamingId(null);
    toast('Stopped generating.', 'info');
  }

  async function handleSend(text, speak) {
    const chatId = chat ? chat.id : onNewChat();
    const userMsg = { id: uid(), role: 'user', text };
    onAppendMessage(chatId, userMsg);
    setSending(true);
    const token = { aborted: false };
    streamTokenRef.current = token;

    // Give the assistant the most recent hunt in this chat for mid-hunt context.
    const lastHunt = [...messages].reverse().find((m) => m.role === 'hunt');
    const huntId = lastHunt ? lastHunt.hunt.huntId : undefined;

    const res = await sendChat(text, huntId);
    if (token.aborted) {
      setSending(false);
      return;
    }
    if (!res.ok) {
      onAppendMessage(chatId, {
        id: uid(),
        role: 'assistant',
        text: 'I could not reach the backend just now. Check Settings → backend connection, then try again.',
      });
      toast(res.error || 'Backend unreachable.', 'error');
      setSending(false);
      return;
    }

    const reply = res.data.reply || '(empty reply)';
    // Steering actions (pause/resume/stop) change the hunt's state on the
    // backend — mirror it in the UI immediately so the chip and the
    // Pause/Resume/Stop buttons update without a reload.
    if (huntId && res.data && res.data.action) {
      const mapped = { pause: 'paused', resume: 'running', stop: 'stopped' }[res.data.action];
      if (mapped && typeof onUpdateHunt === 'function') onUpdateHunt(chatId, huntId, mapped);
    }
    const assistantId = uid();
    onAppendMessage(chatId, { id: assistantId, role: 'assistant', text: '' });
    setStreamingId(assistantId);
    await streamReveal(reply, (chunk) => onUpdateMessage(chatId, assistantId, chunk), { signal: token });
    setStreamingId(null);
    setSending(false);

    if (token.aborted) return;
    if (speakerOn && speak) {
      speak(reply);
    }
  }

  /** A finished voice turn: drop both sides into the thread (no re-send). */
  function handleVoiceExchange(userText, replyText) {
    const chatId = chat ? chat.id : onNewChat();
    onAppendMessage(chatId, { id: uid(), role: 'user', text: userText });
    onAppendMessage(chatId, { id: uid(), role: 'assistant', text: replyText });
  }

  /** "Talk with AI" on a hunt card: open voice mode scoped to that hunt.
   *  Works anytime — running, paused, or finished. */
  function handleTalkWithAI(huntId) {
    if (!ensureHuntAuth()) return;
    setVoiceHuntIdOverride(huntId || null);
    setVoiceOpen(true);
  }

  function handleGetReport(huntId) {
    if (!ensureHuntAuth()) return;
    // Open the professional bug bounty report in a new tab (markdown format)
    // The backend generates it from hunt memory + findings via the Head agent
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    window.open(`${apiBase}/api/v1/hunts/${huntId}/report?format=md`, '_blank', 'noopener');
  }

  function handleVoiceClose() {
    setVoiceOpen(false);
    setVoiceHuntIdOverride(null);
  }

  async function handleStartHunt(target, scope, mode, confirmed, forceNew = false) {
    if (!ensureHuntAuth()) return;
    // Dedup: if a hunt already exists for this target, go to its chat instead
    // of creating a duplicate. (The backend enforces the same rule on
    // POST /api/v1/hunts and is the authority; this pre-check just avoids a
    // needless round-trip. NOTE: the hunts API returns `status`, not
    // `state` — checking h.state here silently never matched.)
    if (!forceNew) {
      try {
        const { listHunts } = await import('../lib/api');
        const hr = await listHunts();
        const hunts = (hr && hr.data && hr.data.hunts) || [];
        const norm = (t) => String(t || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
        const stateOf = (h) => String(h.status || h.state || '').toLowerCase();
        const matches = hunts.filter((h) => norm(h.target) === norm(target));
        // Priority matters more than list order: a RUNNING hunt for this
        // target must win over a newer-but-paused duplicate (the list is
        // newest-first, so a plain find() can open a stale paused copy).
        const existing =
          matches.find((h) => stateOf(h) === 'running') ||
          matches.find((h) => stateOf(h) === 'starting') ||
          matches.find((h) => stateOf(h) === 'paused') ||
          matches[0];
        if (existing) {
          toast(`You already have a hunt for ${target} — opening it.`, 'info');
          setHuntModalOpen(false);
          // Find the chat for this hunt and navigate to it
          if (typeof onOpenHuntChat === 'function') onOpenHuntChat(existing.huntId);
          return;
        }
      } catch { /* best-effort, proceed to create */ }
    }
    setLaunching(true);
    const res = await startHunt(target, scope, mode, confirmed, forceNew);
    setLaunching(false);
    if (!res.ok || !res.data.huntId) {
      if (res.status === 401 || res.error === 'auth_required') {
        openAuthModal('login');
        toast('Log in to start a hunt.', 'info');
        return;
      }
      if (res.data && res.data.queued) {
        toast(res.data.message || 'Hunt queued — it will start automatically when the current hunt finishes.', 'info');
        setHuntModalOpen(false);
        return;
      }
      toast(res.error || 'Could not start the hunt.', 'error');
      return;
    }
    if (res.data.reused) {
      // The backend redirected us to the hunt that already exists for this
      // target (resuming it first if it was paused). Open THAT hunt's chat —
      // never append a second card for the same hunt here.
      toast(res.data.message || 'Opening your existing hunt for this target.', 'info');
      if (typeof onOpenHuntChat === 'function') onOpenHuntChat(res.data.huntId);
      setHuntModalOpen(false);
      return;
    }
    const chatId = chat ? chat.id : onNewChat();
    const hunt = {
      huntId: res.data.huntId,
      target,
      scope,
      status: 'idle',
      logs: [],
      findings: [],
      phase: '',
      createdAt: new Date().toISOString(),
    };
    onAppendMessage(chatId, { id: uid(), role: 'hunt', hunt });
    onRecordHunt(hunt);
    setHuntModalOpen(false);
    toast('Hunt started — it runs in the background. Keep chatting while it works.', 'success');
  }

  function handleHuntStatusChange(huntId, status) {
    if (!chat) return;
    onUpdateHunt(chat.id, huntId, status);
  }

  /** Re-run a stopped/finished hunt: start a fresh hunt against the same target. */
  async function handleRerunHunt(hunt) {
    if (!ensureHuntAuth()) return;
    // The target was already authorized when the original hunt was started.
    // forceNew is the explicit fresh-run bypass of the dedupe redirect.
    await handleStartHunt(hunt.target, hunt.scope || '', hunt.mode || 'normal', true, true);
  }

  const [editText, setEditText] = useState(null);

  const composer = (
    <ChatInput
      onSend={handleSend}
      sending={sending}
      generating={generating}
      onStop={handleStop}
      editText={editText}
      onStartHunt={() => {
        if (ensureHuntAuth()) setHuntModalOpen(true);
      }}
      speakerOn={speakerOn}
      onToggleSpeaker={toggleSpeaker}
      onOpenVoice={() => {
        if (ensureHuntAuth()) setVoiceOpen(true);
      }}
    />
  );

  // Most recent hunt in this chat — voice turns keep the same hunt context.
  const voiceHunt = [...messages].reverse().find((m) => m.role === 'hunt');
  const voiceHuntId = voiceHunt ? voiceHunt.hunt.huntId : undefined;

  return (
    <div className="chat-page">
      {messages.length === 0 ? (
        <>
          <div className="dm-hero-scroll">
            <div className="dm-hero">
              <div className="dm-emblem">
                <img src="/dark-matter-symbol.png" alt="Dark Matter" width="72" height="72" className="hero-symbol" />
              </div>
              <div className="dm-wordmark">DARK MATTER</div>
              <p className="dm-tagline">Elite autonomous bug-bounty hunter</p>
              <div className="dm-quick-actions">
                <button className="dm-action-card" onClick={() => { if (ensureHuntAuth()) setHuntModalOpen(true); }}>
                  <span className="dm-action-icon">🎯</span>
                  <span className="dm-action-title">Start a hunt</span>
                  <span className="dm-action-sub">Point the hunter at a target</span>
                </button>
                <button className="dm-action-card" onClick={() => onOpenReports && onOpenReports()}>
                  <span className="dm-action-icon">📋</span>
                  <span className="dm-action-title">Reports</span>
                  <span className="dm-action-sub">Findings & hunt history</span>
                </button>
                <button className="dm-action-card" onClick={() => document.querySelector('.chat-page .composer input, .chat-page .composer textarea')?.focus()}>
                  <span className="dm-action-icon">💬</span>
                  <span className="dm-action-title">Ask the AI</span>
                  <span className="dm-action-sub">Strategy, recon, technique</span>
                </button>
              </div>
            </div>
          </div>
          {composer}
          <p className="dm-disclaimer">Dark Matter hunts only targets you are authorized to test.</p>
        </>
      ) : (
        <>
          <div className="chat-scroll">
            <ChatThread
              messages={messages}
              streaming={streamingId}
              onHuntStatusChange={handleHuntStatusChange}
              onOpenReports={onOpenReports}
              onEditMessage={(msg) => setEditText(msg.text)}
              onRerunHunt={handleRerunHunt}
              onTalkWithAI={handleTalkWithAI}
              onGetReport={handleGetReport}
            />
            <div ref={threadEndRef} />
          </div>
          {composer}
        </>
      )}

      <NewHuntModal
        open={huntModalOpen}
        onClose={() => setHuntModalOpen(false)}
        onSubmit={handleStartHunt}
        launching={launching}
      />
      {voiceOpen && (
        <VoiceMode
          huntId={voiceHuntIdOverride || voiceHuntId}
          onExchange={handleVoiceExchange}
          onClose={handleVoiceClose}
        />
      )}
    </div>
  );
}
