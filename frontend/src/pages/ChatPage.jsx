// Chat page — ChatGPT layout: empty state ("What can I help with?" + centered
// composer) or thread + bottom composer. ■ stop aborts the reply stream and
// stops any running hunts in this chat. All chat/hunt logic unchanged.
import React, { useEffect, useRef, useState } from 'react';
import ChatThread from '../components/ChatThread';
import ChatInput from '../components/ChatInput';
import NewHuntModal from '../components/NewHuntModal';
import { sendChat, startHunt, stopHunt } from '../lib/api';
import { streamReveal } from '../lib/streaming';
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
}) {
  const [sending, setSending] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [huntModalOpen, setHuntModalOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(() => {
    try {
      return localStorage.getItem('dm.speakerOn') === 'true';
    } catch {
      return false;
    }
  });
  const threadEndRef = useRef(null);
  const streamTokenRef = useRef(null);

  const messages = chat ? chat.messages : [];

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingId]);

  const runningHunts = messages.filter(
    (m) => m.role === 'hunt' && (m.hunt.status === 'running' || m.hunt.status === 'idle'),
  );
  const generating = sending || streamingId !== null || runningHunts.length > 0;

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    try {
      localStorage.setItem('dm.speakerOn', String(next));
    } catch { /* ignore */ }
    toast(next ? 'Spoken replies enabled.' : 'Spoken replies muted.', 'info');
  }

  /** ■ stop: abort the reply stream and stop any running hunts in this chat. */
  async function handleStop() {
    if (streamTokenRef.current) streamTokenRef.current.aborted = true;
    setSending(false);
    setStreamingId(null);
    const act = runningHunts;
    for (const m of act) {
      const res = await stopHunt(m.hunt.huntId);
      if (res.ok) {
        if (chat) onUpdateHunt(chat.id, m.hunt.huntId, 'stopped');
      } else {
        toast(res.error || 'Could not stop the hunt.', 'error');
      }
    }
    if (act.length > 0) {
      toast(`Stopped ${act.length} hunt${act.length === 1 ? '' : 's'}.`, 'info');
    }
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

  async function handleStartHunt(target, scope) {
    const chatId = chat ? chat.id : onNewChat();
    setLaunching(true);
    const res = await startHunt(target, scope);
    setLaunching(false);
    if (!res.ok || !res.data.huntId) {
      toast(res.error || 'Could not start the hunt.', 'error');
      return;
    }
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

  const composer = (
    <ChatInput
      onSend={handleSend}
      sending={sending}
      generating={generating}
      onStop={handleStop}
      onStartHunt={() => setHuntModalOpen(true)}
      speakerOn={speakerOn}
      onToggleSpeaker={toggleSpeaker}
    />
  );

  return (
    <div className="chat-page">
      {messages.length === 0 ? (
        <div className="empty-wrap">
          <h1>What can I help with?</h1>
          <div className="empty-composer">{composer}</div>
        </div>
      ) : (
        <>
          <div className="chat-scroll">
            <ChatThread
              messages={messages}
              streaming={streamingId}
              onHuntStatusChange={handleHuntStatusChange}
              onOpenReports={onOpenReports}
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
    </div>
  );
}
