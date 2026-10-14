// Chat thread — ChatGPT idiom: user bubbles right, assistant full-width with
// hover action row (copy, thumbs up/down), hunts as assistant progress cards.
import React, { useState } from 'react';
import Markdown from './Markdown';
import HuntCard from './HuntCard';
import { toast } from '../lib/toast';

function IconCopy() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" />
    </svg>
  );
}

function IconThumbUp() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4.2-7.4A1.7 1.7 0 0 1 14.5 5v5h5.3a2 2 0 0 1 2 2.4l-1.4 6.6a2 2 0 0 1-2 1.6H7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconThumbDown() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4.2 7.4a1.7 1.7 0 0 1-3.3-1.4v-5H4.2a2 2 0 0 1-2-2.4l1.4-6.6a2 2 0 0 1 2-1.6H17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserActions({ text, onEdit }) {
  function copy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('Copied to clipboard.', 'success'),
        () => toast('Could not copy.', 'error'),
      );
    } else {
      toast('Clipboard is not available.', 'error');
    }
  }

  return (
    <div className="msg-actions msg-actions-user" aria-label="Message actions">
      <button className="msg-action-btn" onClick={copy} title="Copy message" aria-label="Copy message">
        <IconCopy />
      </button>
      <button className="msg-action-btn" onClick={onEdit} title="Edit and resend" aria-label="Edit message">
        <IconEdit />
      </button>
    </div>
  );
}

function IconHeart() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.2a5 5 0 1 1 7.5 6.4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AssistantActions({ text }) {
  const [vote, setVote] = useState(null); // 'up' | 'down' | null
  const [loved, setLoved] = useState(false);

  function copy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('Copied to clipboard.', 'success'),
        () => toast('Could not copy.', 'error'),
      );
    } else {
      toast('Clipboard is not available.', 'error');
    }
  }

  function rate(next) {
    setVote((v) => (v === next ? null : next));
    toast('Thanks for your feedback.', 'info');
  }

  return (
    <div className="msg-actions" aria-label="Message actions">
      <button className="msg-action-btn" title="Copy" aria-label="Copy message" onClick={copy}>
        <IconCopy />
      </button>
      <button
        className={`msg-action-btn${vote === 'up' ? ' voted' : ''}`}
        title="Good response"
        aria-label="Good response"
        aria-pressed={vote === 'up'}
        onClick={() => rate('up')}
      >
        <IconThumbUp />
      </button>
      <button
        className={`msg-action-btn${vote === 'down' ? ' voted' : ''}`}
        title="Bad response"
        aria-label="Bad response"
        aria-pressed={vote === 'down'}
        onClick={() => rate('down')}
      >
        <IconThumbDown />
      </button>
      <button
        className={`msg-action-btn${loved ? ' voted' : ''}`}
        title="Love this"
        aria-label="Love this response"
        aria-pressed={loved}
        onClick={() => {
          setLoved((v) => !v);
          toast(loved ? 'Removed love.' : 'Loved! ❤️', 'info');
        }}
      >
        <IconHeart />
      </button>
    </div>
  );
}

function formatMsgTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  } catch {
    return '';
  }
}

export default function ChatThread({ messages, streaming, onHuntStatusChange, onOpenReports, onEditMessage, onRerunHunt }) {
  return (
    <div className="chat-thread">
      {messages.map((msg) => {
        if (msg.role === 'hunt') {
          return (
            <div key={msg.id} className="message message-hunt">
              <HuntCard hunt={msg.hunt} onStatusChange={onHuntStatusChange} onRerun={onRerunHunt} />
              {msg.hunt.status === 'done' && (
                <button className="btn btn-ghost btn-sm report-link" onClick={() => onOpenReports(msg.hunt.huntId)}>
                  View report →
                </button>
              )}
            </div>
          );
        }
        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="message message-user">
              <div className="message-body">
                <div className="user-text">{msg.text}</div>
                <div className="msg-meta">
                  {formatMsgTime(msg.createdAt) && (
                    <span className="msg-time">{formatMsgTime(msg.createdAt)}</span>
                  )}
                  <UserActions text={msg.text} onEdit={() => onEditMessage && onEditMessage(msg)} />
                </div>
              </div>
            </div>
          );
        }
        return (
          <div key={msg.id} className="message message-assistant">
            <div className="message-body">
              <div className="assistant-text">
                <Markdown text={msg.text} />
                {streaming === msg.id && <span className="typing-caret" aria-hidden="true" />}
              </div>
              <div className="msg-meta">
                {formatMsgTime(msg.createdAt) && (
                  <span className="msg-time">{formatMsgTime(msg.createdAt)}</span>
                )}
                {msg.text && <AssistantActions text={msg.text} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
