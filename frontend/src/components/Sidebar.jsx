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

function HistoryItem({ chat, active, running, onSelect, onRename, onDelete, hunterMode }) {
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

  // Hunter badge (owner orders 3 Nov 2026 + 4 Nov 2026): labelled by the
  // SAME resolved mode the sidebar hunter filter uses, so the badge and
  // the filter can never disagree. Hunts created before brainMode was
  // recorded count as AI.
  const hunterBadge =
    hunterMode === 'scanner'
      ? { label: 'Autonomous', title: 'Infinity Autonomous hunt — rule-based scan, no AI' }
      : hunterMode === 'ai'
        ? { label: 'AI', title: 'Infinity AI hunt — AI agent' }
        : null;

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
        <>
          {running && <span className="running-dot" aria-label="Running" title="Running" />}
          {hunterBadge && (
            <span
              title={hunterBadge.title}
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                border: '1px solid currentColor',
                borderRadius: 999,
                padding: '1px 6px',
                marginRight: 6,
                opacity: 0.6,
                flexShrink: 0,
              }}
            >
              {hunterBadge.label}
            </span>
          )}
          <span className="history-title">{chat.title || 'Untitled chat'}</span>
        </>
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
  runningHunts = [],
  activeChatId,
  activePage,
  hunter = 'scanner',
  huntModes = {},
  onSelectChat,
  onNewHunt,
  onRenameChat,
  onDeleteChat,
  onNavigate,
  open,
  onClose,
}) {
  const { user, ready } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [balanceText, setBalanceText] = useState('');
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  // ---- Resizable sidebar (owner order 4 Nov 2026) ----
  // Width in px, persisted per device. Drag the right edge to resize.
  const MIN_W = 220;
  const MAX_W = 480;
  const [sideWidth, setSideWidth] = useState(() => {
    try {
      const v = parseInt(window.localStorage.getItem('dm.sidebarWidth'), 10);
      if (Number.isFinite(v)) return Math.min(MAX_W, Math.max(MIN_W, v));
    } catch { /* ignore */ }
    return 276;
  });
  function clampW(w) {
    const cap = Math.min(MAX_W, Math.floor(window.innerWidth * 0.6));
    return Math.min(cap, Math.max(MIN_W, Math.round(w)));
  }
  function onResizeStart(e) {
    if (isMobile()) return; // overlay sidebar on mobile — no resize
    e.preventDefault();
    const startX = e.clientX;
    const startW = sideWidth;
    function onMove(ev) {
      setSideWidth(clampW(startW + (ev.clientX - startX)));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setSideWidth((w) => {
        try { window.localStorage.setItem('dm.sidebarWidth', String(w)); } catch { /* ignore */ }
        return w;
      });
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Access pill for the Premium account-menu item (logged in only;
  // silent on failure). Shows the paid access window when active, else
  // the credit balance. (Moved from the sidebar nav into the Account
  // menu — owner order 4 Nov 2026.)
  useEffect(() => {
    if (!user) { setBalanceText(''); return; }
    let cancelled = false;
    (async () => {
      try {
        const { getPaymentStatus } = await import('../lib/api');
        const res = await getPaymentStatus();
        if (!cancelled && res.ok && res.data) {
          if (res.data.accessActive && res.data.accessUntil) {
            const until = new Date(res.data.accessUntil);
            setBalanceText(`Access till ${until.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
          } else if (typeof res.data.balanceUsd === 'number' && res.data.balanceUsd > 0) {
            setBalanceText(`$${res.data.balanceUsd.toFixed(2)}`);
          } else {
            setBalanceText('');
          }
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

  // Hunter mode of a chat for the sidebar hunter filter (owner order
  // 4 Nov 2026): the top-bar hunter picker (Infinity AI vs Infinity
  // Autonomous) filters the chat list. Returns 'ai' | 'scanner' | null
  // (null = plain chat, hunter-agnostic — always visible).
  // Sources, in order: the chat's hunt message brainMode (set at hunt
  // creation), the huntModes lookup (huntId / target keys from
  // GET /api/v1/hunts — covers restored and title-pulled chats), and the
  // app-wide convention that hunts created before brainMode was recorded
  // count as AI.
  function chatHunterMode(c) {
    if (!c) return null;
    const huntMsg = (c.messages || []).find((m) => m && m.role === 'hunt' && m.hunt);
    if (huntMsg) {
      const bm = huntMsg.hunt.brainMode;
      if (bm === 'scanner' || bm === 'ai') return bm;
      if (huntMsg.hunt.huntId && huntModes[huntMsg.hunt.huntId]) return huntModes[huntMsg.hunt.huntId];
      return 'ai';
    }
    const id = c.id;
    if (typeof id === 'string' && id.startsWith('hunt-')) {
      return huntModes[id.slice('hunt-'.length)] || 'ai';
    }
    const t = c.title || '';
    if (t.startsWith('Hunt: ')) {
      return huntModes[`target:${t.slice('Hunt: '.length).trim().toLowerCase()}`] || 'ai';
    }
    return null;
  }

  // "Currently Running" (owner order 27 Oct 2026): hunts whose LIVE
  // backend state is running sit at the very top, above the date groups,
  // and must NOT also appear under Today/Yesterday/Previous — no
  // duplication. Matching: deterministic chat id `hunt-<huntId>`, the
  // hunt card in the chat's messages, or the `Hunt: <target>` title.
  // Chat activity or message timestamps are NEVER the signal.
  const groups = useMemo(() => {
    // Hunter filter (owner order 4 Nov 2026): with 'Autonomous' selected
    // only autonomous hunt chats show; with 'AI' only AI hunt chats.
    // The currently-open chat is ALWAYS kept visible so the user is never
    // stranded; plain (non-hunt) chats are hunter-agnostic and stay.
    const hunterOk = (c) => {
      if (!c || c.id === activeChatId) return true;
      const m = chatHunterMode(c);
      return !m || m === hunter;
    };
    const q = query.trim().toLowerCase();
    const list = (q
      ? chats.filter((c) => String(c.title || '').toLowerCase().includes(q))
      : chats
    ).filter(hunterOk);
    if (q) return [{ label: 'Results', items: list }];
    const isRunningChat = (c) => {
      if (!c) return false;
      if (typeof c.id === 'string' && c.id.startsWith('hunt-')) {
        if (runningHunts.some((h) => h.huntId === c.id.slice('hunt-'.length))) return true;
      }
      if ((c.messages || []).some(
        (m) => m && m.role === 'hunt' && m.hunt && runningHunts.some((h) => h.huntId === m.hunt.huntId),
      )) return true;
      return runningHunts.some((h) => h.target && c.title === `Hunt: ${h.target}`);
    };
    const running = list.filter(isRunningChat);
    const rest = list.filter((c) => !isRunningChat(c));
    const map = new Map();
    for (const c of rest) {
      const g = groupLabel(c.updatedAt || c.createdAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(c);
    }
    const out = [];
    if (running.length > 0) out.push({ label: 'Currently Running', items: running, running: true });
    for (const g of GROUP_ORDER) {
      if (map.has(g)) out.push({ label: g, items: map.get(g) });
    }
    return out;
  }, [chats, query, runningHunts, hunter, huntModes, activeChatId]);

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

  const displayName = user?.displayName || user?.name || user?.fullName || user?.firstName || user?.email || user?.username || 'Signed in';
  const usernameText = user?.username ? `@${String(user.username).replace(/^@/, '')}` : (user?.email ? `@${String(user.email).split('@')[0]}` : '');
  const initial = displayName ? String(displayName).trim().charAt(0).toUpperCase() : '•';

  return (
    <aside
      className={`sidebar${open ? ' open' : ''}`}
      style={{ '--sidebar-width': `${sideWidth}px` }}
      aria-label="Navigation"
    >
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

      {/* Sticky "New hunt" — never scrolls away (owner order 4 Nov 2026). */}
      <div className="sidebar-newhunt">
        <button className="nav-item new-hunt-btn" onClick={newHunt}>
          <IconPencilSquare /> New hunt
        </button>
      </div>

      {/* One shared scroll region: nav items + chats scroll together. */}
      <div className="sidebar-scroll">
        <nav aria-label="Primary">
          <button className={`nav-item${activePage === 'plugins' ? ' active' : ''}`} onClick={() => go('plugins')}>
            <IconHexagon /> Plugins
          </button>
          <button className={`nav-item${activePage === 'reports' ? ' active' : ''}`} onClick={() => go('reports')}>
            <IconChart /> Reports
          </button>
          <button className={`nav-item${activePage === 'machines' ? ' active' : ''}`} onClick={() => go('machines')}>
            <IconHexagon /> Live machines
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
                  running={!!g.running}
                  hunterMode={chatHunterMode(chat)}
                  onSelect={() => selectChat(chat.id)}
                  onRename={onRenameChat}
                  onDelete={onDeleteChat}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="sidebar-user" ref={profileRef}>
        {!ready && !user ? (
          <div className="sidebar-user-skeleton" aria-label="Loading profile">
            <span className="user-avatar skeleton" />
            <span className="user-meta skeleton-block" />
          </div>
        ) : user ? (
          <>
            {profileOpen && (
              <ProfileMenu onNavigate={(p) => { go(p); }} onClose={() => setProfileOpen(false)} premiumSuffix={balanceText} />
            )}
            <button className="user-row" onClick={() => setProfileOpen((v) => !v)} aria-haspopup="menu" aria-label={`Open profile menu for ${displayName}`}>
              <span className="user-avatar" aria-hidden="true">{initial}</span>
              <span className="user-meta">
                <span className="user-name">{displayName}</span>
                {usernameText && <span className="user-username">{usernameText}</span>}
              </span>
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
      {/* Drag handle — resize the sidebar (owner order 4 Nov 2026). */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={onResizeStart}
        title="Drag to resize the sidebar"
        aria-hidden="true"
      />
    </aside>
  );
}
