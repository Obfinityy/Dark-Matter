import React, { useEffect, useRef, useState } from 'react';
import ChatThread from '../components/ChatThread';
import ChatInput from '../components/ChatInput';
import NewHuntModal from '../components/NewHuntModal';
import { sendChat, startHunt } from '../lib/api';
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

  const messages = chat ? chat.messages : [];

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingId]);

  function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(next);
    try {
      localStorage.setItem('dm.speakerOn', String(next));
    } catch { /* ignore */ }
    toast(next ? 'Spoken replies enabled.' : 'Spoken replies muted.', 'info');
  }

  async function handleSend(text, speak) {
    const chatId = chat ? chat.id : onNewChat();
    const userMsg = { id: uid(), role: 'user', text };
    onAppendMessage(chatId, userMsg);
    setSending(true);

    // Give the assistant the most recent hunt in this chat for mid-hunt context.
    const lastHunt = [...messages].reverse().find((m) => m.role === 'hunt');
    const huntId = lastHunt ? lastHunt.hunt.huntId : undefined;

    const res = await sendChat(text, huntId);
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
    await streamReveal(reply, (chunk) => onUpdateMessage(chatId, assistantId, chunk));
    setStreamingId(null);
    setSending(false);

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

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-title">
          <h1>{chat ? chat.title : 'New chat'}</h1>
        </div>
        <div className="chat-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setHuntModalOpen(true)}>
            🎯 New hunt
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onNewChat}>
            ＋ New chat
          </button>
        </div>
      </header>

      <div className="chat-scroll">
        <ChatThread
          messages={messages}
          streaming={streamingId}
          onHuntStatusChange={handleHuntStatusChange}
          onOpenReports={onOpenReports}
        />
        <div ref={threadEndRef} />
      </div>

      <ChatInput
        onSend={handleSend}
        sending={sending}
        onStartHunt={() => setHuntModalOpen(true)}
        speakerOn={speakerOn}
        onToggleSpeaker={toggleSpeaker}
      />

      <NewHuntModal
        open={huntModalOpen}
        onClose={() => setHuntModalOpen(false)}
        onSubmit={handleStartHunt}
        launching={launching}
      />
    </div>
  );
}
