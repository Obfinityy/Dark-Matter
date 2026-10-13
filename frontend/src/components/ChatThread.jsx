import React from 'react';
import Markdown from './Markdown';
import HuntCard from './HuntCard';

export default function ChatThread({ messages, streaming, onHuntStatusChange, onOpenReports }) {
  return (
    <div className="chat-thread">
      {messages.length === 0 && (
        <div className="chat-empty">
          <div className="empty-logo" aria-hidden="true" />
          <h2>How can Infinity AI help?</h2>
          <p className="empty-sub">
            Chat with the assistant, or start a bug-bounty hunt — it runs in the background
            and you can keep talking while it works.
          </p>
        </div>
      )}
      {messages.map((msg) => {
        if (msg.role === 'hunt') {
          return (
            <div key={msg.id} className="message message-hunt">
              <HuntCard hunt={msg.hunt} onStatusChange={onHuntStatusChange} />
              {msg.hunt.status === 'done' && (
                <button className="btn btn-ghost btn-sm report-link" onClick={() => onOpenReports(msg.hunt.huntId)}>
                  View report →
                </button>
              )}
            </div>
          );
        }
        return (
          <div key={msg.id} className={`message message-${msg.role}`}>
            <div className="message-body">
              {msg.role === 'assistant' ? <Markdown text={msg.text} /> : <div className="user-text">{msg.text}</div>}
              {streaming === msg.id && <span className="typing-caret" aria-hidden="true" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
