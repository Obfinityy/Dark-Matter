import React from 'react';

const NAV = [
  { id: 'chat', label: 'Chat', icon: '✦' },
  { id: 'plugins', label: 'Plugins', icon: '◈' },
  { id: 'reports', label: 'Reports', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar({ chats, activeChatId, onSelectChat, onNewChat, onDeleteChat, page, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true" />
        <div className="brand-text">
          <div className="brand-name">Dark Matter</div>
          <div className="brand-sub">Infinity AI</div>
        </div>
      </div>

      <button className="btn btn-primary new-chat-btn" onClick={onNewChat}>
        <span aria-hidden="true">＋</span> New chat
      </button>

      <div className="sidebar-section-label">History</div>
      <div className="chat-history">
        {chats.length === 0 && <div className="empty-hint">No conversations yet.</div>}
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`history-item${chat.id === activeChatId && page === 'chat' ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              onNavigate('chat');
              onSelectChat(chat.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onNavigate('chat');
                onSelectChat(chat.id);
              }
            }}
          >
            <span className="history-title">{chat.title || 'Untitled chat'}</span>
            <button
              className="history-delete"
              title="Delete chat"
              aria-label="Delete chat"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(chat.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item${page === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
