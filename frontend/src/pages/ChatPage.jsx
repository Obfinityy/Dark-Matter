// Chat page — ChatGPT logged-out layout: "Where should we begin?" empty state
// or thread + bottom pill composer. Hunts REQUIRE login: logged-out users get
// the auth modal + "Log in to start a hunt." toast. ■ stop aborts the reply
// stream and stops any running hunts in this chat. All chat/hunt logic unchanged.
import React, { useEffect, useRef, useState } from 'react';
import ChatThread from '../components/ChatThread';
import ChatInput from '../components/ChatInput';
import DetailsRequestCard from '../components/DetailsRequestCard';
import NewHuntModal from '../components/NewHuntModal';
import VoiceMode from '../components/VoiceMode';
import { sendChat, startHunt, fetchReportMarkdown } from '../lib/api';
import { resolveHuntMode, resolveHuntBrainMode, resolveHuntScanDepth, resolveHuntScanScope } from '../lib/huntMode';
import { streamReveal } from '../lib/streaming';
import { useAuth, openAuthModal } from '../lib/auth';
import { toast } from '../lib/toast';
import { resolveApiBase } from '../config';

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
  // DUPLICATE PROMPT (5 Nov 2026, owner order: re-paste returns the saved
  // result, but 'Start new hunt' must start fresh): when a hunt already
  // exists for (target, brainMode), the New Hunt dialog offers the choice
  // instead of only opening the existing hunt. Holds the existing hunt
  // plus the pending submit args so 'Start new hunt anyway' can re-run
  // the submit with forceNew.
  const [duplicateHunt, setDuplicateHunt] = useState(null);
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
  // CHAT-ANSWERS (26 Oct 2026): the send queue. The composer no
  // longer locks while a reply is pending — a follow-up typed during
  // a generation is queued here and sent when the in-flight reply
  // lands, instead of being refused. sendingRef mirrors the `sending`
  // state for async closures (state reads go stale inside awaits).
  const sendQueueRef = useRef([]);
  const sendingRef = useRef(false);
  // AbortController for the in-flight chat fetch — Stop aborts the
  // request itself instead of letting it run and discarding the reply.
  const chatAbortRef = useRef(null);

  const messages = chat && Array.isArray(chat.messages) ? chat.messages : [];
  // Fresh-thread mirror for the queue pump: the render-scope `messages`
  // goes stale inside awaits, so the pump reads the latest thread here.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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
    // CHAT-ANSWERS: abort the in-flight fetch itself — the old code
    // only flagged the token, so the request kept running (and burning
    // the shared brain) until it resolved, then threw the reply away.
    if (chatAbortRef.current) chatAbortRef.current.abort();
    setSending(false);
    setStreamingId(null);
    toast('Stopped generating.', 'info');
    // NOTE: sendingRef stays true until the in-flight runSend lands
    // in its finally (reset + queue flush) — clearing it here would
    // let a queued send start concurrently with the aborting one.
    // A queued follow-up still gets its answer once that lands.
  }

  /** Send the next queued follow-up, if any and if nothing is in flight. */
  async function flushSendQueue() {
    if (sendingRef.current) return;
    const next = sendQueueRef.current.shift();
    if (!next) return;
    await runSend(next.text, next.speak, next.chatId, next.userMsgId);
  }

  async function handleSend(text, speak, editMessageId = null) {
    const chatId = chat ? chat.id : onNewChat();
    let userMsgId = editMessageId;
    if (editMessageId) {
      onUpdateMessage(chatId, editMessageId, text);
    } else {
      userMsgId = uid();
      const userMsg = { id: userMsgId, role: 'user', text };
      onAppendMessage(chatId, userMsg);
    }
    // A reply is in flight: queue the follow-up behind it instead of
    // refusing it. Its user bubble is already in the thread; the reply
    // arrives when its turn comes.
    if (sendingRef.current) {
      sendQueueRef.current.push({ text, speak, chatId, userMsgId });
      return;
    }
    await runSend(text, speak, chatId, userMsgId);
  }

  async function runSend(text, speak, chatId, userMsgId) {
    sendingRef.current = true;
    setSending(true);
    const token = { aborted: false };
    streamTokenRef.current = token;
    // AbortController for this request (see handleStop).
    const controller = new AbortController();
    chatAbortRef.current = controller;
    try {
      // Give the assistant the most recent hunt in this chat for mid-hunt context.
      const lastHunt = [...messagesRef.current].reverse().find((m) => m.role === 'hunt');
      const huntId = lastHunt ? lastHunt.hunt.huntId : undefined;
      // Conversation history for the LLM path (last ~6 thread turns,
      // excluding this message itself) — follow-ups are answered with
      // context instead of cold.
      const history = [...messagesRef.current]
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text && m.id !== userMsgId)
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await sendChat(text, huntId, history, { signal: controller.signal, chatId });
      if (token.aborted || res.aborted) {
        return;
      }
      if (!res.ok) {
        onAppendMessage(chatId, {
          id: uid(),
          role: 'assistant',
          text: 'I could not reach the backend just now. Check Settings → backend connection, then try again.',
        });
        toast(res.error || 'Backend unreachable.', 'error');
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

      if (token.aborted) return;
      if (speakerOn && speak) {
        speak(reply);
      }
    } finally {
      chatAbortRef.current = null;
      setSending(false);
      sendingRef.current = false;
      // A follow-up queued while this reply was in flight sends now.
      flushSendQueue();
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

  async function handleGetReport(huntId, brainMode) {
    if (!ensureHuntAuth()) return;
    // REPORT AUTH FIX (3 Nov 2026): the report routes need the Bearer token,
    // so window.open(url) alone gets auth_required. Fetch with auth, then
    // open the markdown as a blob URL in a new tab.
    // AGENT REPORT (3 Nov 2026, owner order): Autonomous hunts get the
    // AI-written report from the scanner's data (Meta API); AI hunts keep
    // the deterministic memory report.
    try {
      const r = await fetchReportMarkdown(huntId, brainMode);
      const md = r && r.ok && r.data && r.data.markdown;
      if (!md) {
        toast((r && r.error) || 'Report nahi mil payi — phir try karo.');
        return;
      }
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast('Report nahi mil payi — phir try karo.');
    }
  }

  function handleVoiceClose() {
    setVoiceOpen(false);
    setVoiceHuntIdOverride(null);
  }

  // HUNTER (3 Nov 2026, owner order): the 6th arg is scanDepth ('quick' |
  // 'standard' | 'deep') for the autonomous hunter — the New Hunt dialog
  // passes it positionally. forceNew / fresh stay 7th / 8th.
  async function handleStartHunt(target, scope, mode, confirmed, brainMode = 'ai', scanDepth = 'standard', scanScope = 'page', forceNew = false, fresh = false) {
    if (!ensureHuntAuth()) return;
    // Dedup: if a hunt already exists for this target AND brain mode, go to
    // its chat instead of creating a duplicate. (The backend enforces the
    // same rule on POST /api/v1/hunts and is the authority; this pre-check
    // just avoids a needless round-trip. NOTE: the hunts API returns
    // `status`, not `state` — checking h.state here silently never matched.)
    // fresh:true (Start from scratch) bypasses this like forceNew does.
    // MODE-SCOPED (3 Nov 2026): an existing AI hunt must not block a new
    // automation hunt for the same target, and vice versa. Hunts without a
    // recorded brainMode predate the "With AI / With Automation" choice and
    // count as 'ai'.
    if (!forceNew && !fresh) {
      try {
        const { listHunts } = await import('../lib/api');
        const hr = await listHunts();
        const hunts = (hr && hr.data && hr.data.hunts) || [];
        const norm = (t) => String(t || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
        const stateOf = (h) => String(h.status || h.state || '').toLowerCase();
        const reqMode = brainMode === 'scanner' ? 'scanner' : 'ai';
        const modeOf = (h) => (h && h.brainMode === 'scanner' ? 'scanner' : 'ai');
        const matches = hunts.filter((h) => norm(h.target) === norm(target) && modeOf(h) === reqMode);
        // Priority matters more than list order: a RUNNING hunt for this
        // target must win over a newer-but-paused duplicate (the list is
        // newest-first, so a plain find() can open a stale paused copy).
        const existing =
          matches.find((h) => stateOf(h) === 'running') ||
          matches.find((h) => stateOf(h) === 'starting') ||
          matches.find((h) => stateOf(h) === 'paused') ||
          matches[0];
        if (existing) {
          // DUPLICATE PROMPT (5 Nov 2026): do not just open the existing
          // hunt — offer the owner the choice the dialog was missing:
          // open the saved hunt, or start a fresh one anyway (forceNew).
          // The modal stays open on the prompt; the pending submit args
          // are kept so 'Start new hunt anyway' re-submits verbatim.
          setDuplicateHunt({
            existing: {
              huntId: existing.huntId,
              target,
              brainMode: modeOf(existing),
              state: stateOf(existing),
            },
            pending: { target, scope, mode, confirmed, brainMode, scanDepth, scanScope },
          });
          return;
        }
      } catch { /* best-effort, proceed to create */ }
    }
    setLaunching(true);
    const res = await startHunt(target, scope, mode, confirmed, brainMode, scanDepth, scanScope, forceNew, fresh);
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
      // target (resuming it first if it was paused). Same choice as the
      // frontend pre-check: open it, or start a fresh hunt anyway.
      // (Backend dedup is mode-scoped, so the existing hunt is in the
      // requested brainMode.)
      setDuplicateHunt({
        existing: {
          huntId: res.data.huntId,
          target,
          brainMode: brainMode === 'scanner' ? 'scanner' : 'ai',
          state: String(res.data.state || 'unknown'),
        },
        pending: { target, scope, mode, confirmed, brainMode, scanDepth, scanScope },
      });
      return;
    }
    const chatId = chat ? chat.id : onNewChat();
    const hunt = {
      huntId: res.data.huntId,
      target,
      scope,
      // MODE FIX (27 Oct 2026): carry the mode on the local card too —
      // without it, a "Start from scratch" on this card before the
      // next list sync would fall back to 'normal' and lose the mode.
      mode,
      // BRAIN MODE (3 Nov 2026): carry brainMode too — re-run / fresh
      // must inherit "Infinity AI" vs "Infinity Autonomous".
      brainMode: res.data.brainMode || brainMode,
      // SCAN DEPTH (3 Nov 2026): re-run / fresh inherit the depth.
      scanDepth: res.data.scanDepth || scanDepth || 'standard',
      // SCAN SCOPE (9 Nov 2026, /* owner order): re-run / fresh
      // inherit the scope — a whole-site hunt re-runs whole-site.
      scanScope: res.data.scanScope || scanScope || 'page',
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
    // MODE FIX (27 Oct 2026): inherit the old hunt's real mode — the
    // list used to omit mode, so this always fell back to 'normal'.
    // BRAIN-MODE FIX (5 Nov 2026): resolve the lane + depth
    // authoritatively — a restored card minted before the fix carries
    // neither, and `hunt.brainMode || 'ai'` silently re-created a
    // scanner hunt as AI. The resolvers read the card first, then
    // GET /:id/brain-mode (lane) / GET /:id (depth).
    await handleStartHunt(
      hunt.target,
      hunt.scope || '',
      await resolveHuntMode(hunt),
      true,
      await resolveHuntBrainMode(hunt),
      await resolveHuntScanDepth(hunt),
      await resolveHuntScanScope(hunt),
      true,
    );
  }

  /** Start from scratch (27 Oct 2026, budget cap): a brand-new hunt
   *  against the same target — new huntId, fresh memory. The paused
   *  hunt stays untouched with its checkpoint. fresh:true bypasses
   *  the dedupe redirect on the backend (and the frontend one here). */
  async function handleStartFreshHunt(hunt) {
    if (!ensureHuntAuth()) return;
    // MODE FIX (27 Oct 2026): inherit the old hunt's real mode (see
    // resolveHuntMode) — a human-mode hunt re-created in 'normal'
    // loses the whole human loop.
    // BRAIN-MODE FIX (5 Nov 2026): same authoritative lane + depth
    // resolution as Re-run (see handleRerunHunt).
    await handleStartHunt(
      hunt.target,
      hunt.scope || '',
      await resolveHuntMode(hunt),
      true,
      await resolveHuntBrainMode(hunt),
      await resolveHuntScanDepth(hunt),
      await resolveHuntScanScope(hunt),
      false,
      true,
    );
  }

  function handleRegenerateMessage(message) {
    const index = messages.findIndex((m) => m.id === message.id);
    const lastUser = [...messages].slice(0, index).reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      toast('There is no previous prompt to regenerate from.', 'error');
      return;
    }
    handleSend(lastUser.text, false);
  }

  const [editText, setEditText] = useState(null);

  const composer = (
    <ChatInput
      onSend={handleSend}
      sending={sending}
      generating={generating}
      onStop={handleStop}
      editText={editText}
      onCancelEdit={() => setEditText(null)}
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
              <h1 className="dm-wordmark">DARK MATTER</h1>
              <p className="dm-tagline">Autonomous AI bug bounty hunter — hack with AI to find and verify vulnerabilities before attackers do</p>
              <div className="dm-quick-actions">
                <button className="dm-action-card" onClick={() => { if (ensureHuntAuth()) setHuntModalOpen(true); }}>
                  <span className="dm-action-icon" aria-hidden="true">01</span>
                  <span className="dm-action-title">Start a hunt</span>
                  <span className="dm-action-sub">Point the hunter at a target</span>
                </button>
                <button className="dm-action-card" onClick={() => onOpenReports && onOpenReports()}>
                  <span className="dm-action-icon" aria-hidden="true">02</span>
                  <span className="dm-action-title">Reports</span>
                  <span className="dm-action-sub">Findings & hunt history</span>
                </button>
                <button className="dm-action-card" onClick={() => document.querySelector('.chat-page .composer input, .chat-page .composer textarea')?.focus()}>
                  <span className="dm-action-icon" aria-hidden="true">03</span>
                  <span className="dm-action-title">Ask the AI</span>
                  <span className="dm-action-sub">Strategy, recon, technique</span>
                </button>
              </div>
              {/* SEO landing copy (9 Nov 2026): visible, natural keyword
                  content for search engines — no hidden text, no stuffing.
                  The hero stays the ChatGPT-exact empty state; this section
                  sits below the quick actions in the same scroll area. */}
              <section className="dm-seo" aria-label="About Dark Matter">
                <h2>Hack with AI — an autonomous AI vulnerability scanner</h2>
                <p>
                  Dark Matter is an AI hacker built by Obfinity. Paste any link and the autonomous
                  hacking AI fingerprints the target, inventories every element on the page, and
                  probes each one with a full battery of checks — injection, cross-site scripting,
                  broken authentication, business-logic flaws and more. Every finding is verified
                  in a real browser before it reaches your screen, so what you see is real.
                  Automated penetration testing, in minutes.
                </p>
                <div className="dm-seo-grid">
                  <div className="dm-seo-item">
                    <h3>AI security scanner</h3>
                    <p>A predefined, rule-based scanner that runs the full A-to-Z battery on your target — no prompts, no guesswork.</p>
                  </div>
                  <div className="dm-seo-item">
                    <h3>Autonomous hacking AI</h3>
                    <p>The hunter drives the whole flow itself — recon, probing, verification and reporting — while you watch it live.</p>
                  </div>
                  <div className="dm-seo-item">
                    <h3>Verified findings, not noise</h3>
                    <p>Each vulnerability is confirmed with a control test before it is reported — false positives stay out of your report.</p>
                  </div>
                </div>
              </section>
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
              thinking={sending && streamingId === null}
              onHuntStatusChange={handleHuntStatusChange}
              onOpenReports={onOpenReports}
              onEditMessage={(msg) => setEditText({ id: msg.id, text: msg.text })}
              onRegenerateMessage={handleRegenerateMessage}
              onRerunHunt={handleRerunHunt}
              onStartFreshHunt={handleStartFreshHunt}
              onTalkWithAI={handleTalkWithAI}
              onGetReport={handleGetReport}
            />
            <div ref={threadEndRef} />
          </div>
          <DetailsRequestCard huntId={voiceHuntIdOverride || voiceHuntId} />
          {composer}
        </>
      )}

      <NewHuntModal
        open={huntModalOpen}
        onClose={() => { setDuplicateHunt(null); setHuntModalOpen(false); }}
        onSubmit={handleStartHunt}
        launching={launching}
        duplicate={duplicateHunt}
        onOpenDuplicate={(huntId) => {
          setDuplicateHunt(null);
          setHuntModalOpen(false);
          if (typeof onOpenHuntChat === 'function') onOpenHuntChat(huntId);
        }}
        onStartDuplicateAnyway={async () => {
          const p = duplicateHunt && duplicateHunt.pending;
          if (!p) return;
          setDuplicateHunt(null);
          await handleStartHunt(p.target, p.scope, p.mode, p.confirmed, p.brainMode, p.scanDepth, p.scanScope, true);
        }}
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
