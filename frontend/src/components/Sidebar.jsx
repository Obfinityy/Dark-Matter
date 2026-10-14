// Sidebar — ChatGPT logged-out idiom: wordmark + close button, nav items
// (New hunt / Plugins / Reports / Settings), chat history, then a login
// promo card (logged out) or the user row (logged in).
// Auto-close on navigation applies to MOBILE (<=768px) only.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProfileMenu from './ProfileMenu';
import { useAuth, openAuthModal } from '../lib/auth';

function isMobile() {
  try {
    return window.innerWidth <= 768;
  } catch {
    return false;
  }
}

function IconPencilSquare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconHexagon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 2.7 20.1 7.4v9.2L12 21.3 3.9 16.6V7.4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" strokeLinecap="round" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95A7 7 0 0 0 14 5.1L13.7 2.6h-3.4L10 5.1a7 7 0 0 0-2.5 1.44l-2.36-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.5 1.44l.3 2.5h3.4l.3-2.5a7 7 0 0 0 2.5-1.44l2.36.95 2-3.46-2-1.55c.1-.46.14-.93.14-1.4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
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

export default function Sidebar({
  chats,
  activeChatId,
  activePage,
  onSelectChat,
  onNewHunt,
  onRenameChat,
  onDeleteChat,
  onNavigate,
  open,
  onClose,
}) {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [balanceText, setBalanceText] = useState('');
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  // Credit balance pill next to "Top up" (logged in only; silent on failure).
  useEffect(() => {
    if (!user) { setBalanceText(''); return; }
    let cancelled = false;
    (async () => {
      try {
        const { billingStatus } = await import('../lib/api');
        const res = await billingStatus();
        if (!cancelled && res.ok && res.data && typeof res.data.balanceUsd === 'number') {
          setBalanceText(`$${res.data.balanceUsd.toFixed(2)}`);
        }
      } catch { /* offline — no pill */ }
    })();
    return () => { cancelled = true; };
  }, [user, activePage]);

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
  }, [searchOpen]);

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

  // Auto-close the sidebar on navigation — mobile only (<=768px).
  function closeIfMobile() {
    if (isMobile() && onClose) onClose();
  }

  function selectChat(id) {
    onNavigate('chat');
    onSelectChat(id);
    closeIfMobile();
  }

  function go(page) {
    onNavigate(page);
    closeIfMobile();
  }

  function newHunt() {
    onNewHunt && onNewHunt();
    closeIfMobile();
  }

  const initial = user && (user.username || user.name) ? (user.username || user.name).trim().charAt(0).toUpperCase() : '•';

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Navigation">
      <div className="sidebar-top">
        <img src="/dark-matter-symbol.png" alt="Dark Matter" className="brand-symbol" />
        <span className="wordmark">Dark Matter</span>
        <button
          className="close-sidebar-btn"
          title="Close sidebar"
          aria-label="Close sidebar"
          onClick={() => onClose && onClose()}
        >
          <IconClose />
        </button>
      </div>

      <nav aria-label="Primary">
        <button className="nav-item" onClick={newHunt}>
          <IconPencilSquare /> New hunt
        </button>
        <button className={`nav-item${activePage === 'plugins' ? ' active' : ''}`} onClick={() => go('plugins')}>
          <IconHexagon /> Plugins
        </button>
        <button className={`nav-item${activePage === 'reports' ? ' active' : ''}`} onClick={() => go('reports')}>
          <IconChart /> Reports
        </button>
        <button className={`nav-item${activePage === 'topup' ? ' active' : ''}`} onClick={() => go('topup')}>
          <IconHexagon /> Top up{balanceText ? ` · ${balanceText}` : ''}
        </button>
        <button className={`nav-item${activePage === 'settings' ? ' active' : ''}`} onClick={() => go('settings')}>
          <IconGear /> Settings
        </button>
        {user && user.role === 'admin' && (
          <button className={`nav-item${activePage === 'admin' ? ' active' : ''}`} onClick={() => go('admin')}>
            <IconGear /> Admin
          </button>
        )}
      </nav>

      <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Chats</span>
        <button
          className="icon-btn sidebar-search-btn"
          style={{ width: 30, height: 30 }}
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
        {user ? (
          <>
            {profileOpen && (
              <ProfileMenu onNavigate={(p) => { go(p); }} onClose={() => setProfileOpen(false)} />
            )}
            <button className="user-row" onClick={() => setProfileOpen((v) => !v)} aria-haspopup="menu">
              <span className="user-avatar" aria-hidden="true">{initial}</span>
              <span className="user-name">{user.name || user.email}</span>
            </button>
          </>
        ) : (
          <div className="promo-card">
            <div className="promo-title">Log in to start hunting</div>
            <div className="promo-sub">Create an account to launch hunts and sync your setup.</div>
            <button className="pill-btn pill-btn-outline" onClick={() => openAuthModal('login')}>
              Log in
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
