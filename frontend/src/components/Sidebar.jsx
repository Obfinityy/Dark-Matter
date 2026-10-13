// Sidebar — ChatGPT idiom: New chat + search, grouped history, profile menu.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProfileMenu from './ProfileMenu';

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" />
    </svg>
  );
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days'];

function groupLabel(createdAt) {
  const d = createdAt ? new Date(createdAt) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Previous 30 days';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - d.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 days';
  return 'Previous 30 days';
}

function HistoryItem({ chat, active, onSelect, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(chat.title || 'Untitled chat');
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  function commitRename() {
    const t = draft.trim();
    setRenaming(false);
    if (t && t !== chat.title) onRename(chat.id, t);
    else setDraft(chat.title || 'Untitled chat');
  }

  return (
    <div
      className={`history-item${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect();
      }}
    >
      {renaming ? (
        <input
          ref={inputRef}
          className="history-rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setRenaming(false);
              setDraft(chat.title || 'Untitled chat');
            }
          }}
          onBlur={commitRename}
        />
      ) : (
        <span className="history-title">{chat.title || 'Untitled chat'}</span>
      )}
      {!renaming && (
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            className="history-dots"
            title="Chat options"
            aria-label="Chat options"
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            •••
          </button>
          {menuOpen && (
            <div className="history-menu" role="menu">
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setDraft(chat.title || 'Untitled chat');
                  setRenaming(true);
                }}
              >
                Rename
              </button>
              <button
                role="menuitem"
                className="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(chat.id);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistorySidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onNavigate,
  open,
  onClose,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    function onDocClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [profileOpen]);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen ]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? chats.filter((c) => String(c.title || '').toLowerCase().includes(q))
      : chats;
    const map = new Map();
    for (const c of list) {
      const g = q ? 'Results' : groupLabel(c.createdAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(c);
    }
    const order = q ? ['Results'] : GROUP_ORDER;
    return order.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g) }));
  }, [chats, query]);

  function selectChat(id) {
    onNavigate('chat');
    onSelectChat(id);
    onClose && onClose();
  }

  function newChat() {
    onNewChat();
    onClose && onClose();
  }

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Chat history">
      <div className="sidebar-top">
        <button className="new-chat-btn" onClick={newChat}>
          <IconPencil />
          New chat
        </button>
        <button
          className="icon-btn sidebar-search-btn"
          title="Search chats"
          aria-label="Search chats"
          onClick={() => {
            setSearchOpen((v) => !v);
            setQuery('');
          }}
        >
          <IconSearch />
        </button>
      </div>

      {searchOpen && (
        <div className="sidebar-search-box">
          <input
            ref={searchRef}
            placeholder="Search chats…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {!searchOpen && <div className="sidebar-section-label">Chats</div>}

      <div className="chat-history">
        {groups.length === 0 && (
          <div className="empty-hint">
            {query ? 'No chats match your search.' : 'No conversations yet.'}
          </div>
        )}
        {groups.map((g) => (
          <React.Fragment key={g.label}>
            {!query && <div className="history-group-label">{g.label}</div>}
            {g.items.map((chat) => (
              <HistoryItem
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                onSelect={() => selectChat(chat.id)}
                onRename={onRenameChat}
                onDelete={onDeleteChat}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="sidebar-user" ref={profileRef}>
        {profileOpen && (
          <ProfileMenu onNavigate={(p) => { onNavigate(p); onClose && onClose(); }} onClose={() => setProfileOpen(false)} />
        )}
        <button className="user-row" onClick={() => setProfileOpen((v) => !v)} aria-haspopup="menu">
          <span className="user-avatar" aria-hidden="true">
            <IconUser />
          </span>
          <span className="user-name">Guest</span>
          <span aria-hidden="true" style={{ color: 'var(--dm-faint)', fontSize: 15 }}>•••</span>
        </button>
      </div>
    </aside>
  );
}
