import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ActivityDrawer from './components/ActivityDrawer';
import TopUpPage from './pages/TopUpPage';
import AdminPage from './pages/AdminPage';
import ChatPage from './pages/ChatPage';
import PluginsPage from './pages/PluginsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import AuthPage from './pages/AuthPage';
import AuthModal from './components/AuthModal';
import ToastHost from './components/ToastHost';
import { AuthProvider, useAuth } from './lib/auth';

const CHATS_KEY = 'dm.chats';
const CHAT_WIPE_VERSION = '2026-10-16-wipe2';
(function wipeStaleChatsOnce() {
  try {
    if (localStorage.getItem('dm.chatWipe') === CHAT_WIPE_VERSION) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CHATS_KEY)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    // Also clear per-user deleted-chat tracking so resurrected IDs can't return.
    const delKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('dm.deleted.')) delKeys.push(k);
    }
    delKeys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('dm.chatWipe', CHAT_WIPE_VERSION);
  } catch { /* never break app load */ }
})();
// Per-user storage key — User A's chats must NEVER be visible to User B,
// even on the same device. Logged-out state uses the legacy shared key
// only as a migration source, never as the live store.
function chatsKeyFor(user) {
  const uid = user && (user.id || user.username);
  return uid ? `${CHATS_KEY}.${String(uid)}` : CHATS_KEY;
}
const HUNTS_KEY = 'dm.hunts';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}

function deriveTitle(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  return t.length > 42 ? `${t.slice(0, 42)}…` : t || 'Untitled chat';
}

function routeFromPath() {
  try {
    const p = window.location.pathname.replace(/\/+$/, '') || '/';
    if (p === '/login') return 'login';
    if (p === '/admin') return 'admin';
  } catch { /* ignore */ }
  return 'chat';
}

function AppInner() {
  const { ready, user } = useAuth();
  const [page, setPage] = useState(routeFromPath);
  const [reportHuntId, setReportHuntId] = useState(null);
  const [authModal, setAuthModal] = useState(null); // null | 'login'
  const [huntModalTrigger, setHuntModalTrigger] = useState(0); // increment to open hunt modal
  // Agent activity drawer (top-bar button).
  const [activityOpen, setActivityOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > 768,
  );
  const [chats, setChats] = useState([]);
  const [chatsKey, setChatsKey] = useState(() => chatsKeyFor(user));
  // Draft chat: "New hunt" opens a fresh page WITHOUT creating a history
  // entry. The entry is committed to history only when the user sends their
  // first message or starts a hunt (ChatGPT-style).
  const [draftChat, setDraftChat] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);

  // CHATS: Backend is the single source of truth. On login/account change,
  // fetch the chat list fresh from the backend. localStorage is NOT used for
  // chats anymore. Deleting a chat sends a tombstone to the backend immediately.
  // A logged-out session sees NO chats at all.
  useEffect(() => {
    const key = chatsKeyFor(user);
    setChatsKey(key);
    if (!user) {
      setChats([]);
      setDraftChat(null);
      setActiveChatId(null);
      return;
    }
    // Clear any stale localStorage chat data (migration to backend-only).
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(CHATS_KEY);
      localStorage.removeItem(`dm.deleted.${user.id}`);
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      try {
        const { getChatTitles } = await import('./lib/api');
        const res = await getChatTitles();
        if (cancelled) return;
        if (res.ok && res.data && Array.isArray(res.data.chats)) {
          const chats = res.data.chats.map((c) => ({
            id: c.id,
            title: c.title || 'Untitled chat',
            updatedAt: c.updatedAt,
            createdAt: c.updatedAt,
            messages: [],
          }));
          setChats(chats);
          setDraftChat(null);
          setActiveChatId(chats.length > 0 ? chats[0].id : null);
        } else {
          setChats([]);
          setDraftChat(null);
          setActiveChatId(null);
        }
      } catch {
        if (!cancelled) {
          setChats([]);
          setDraftChat(null);
          setActiveChatId(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user && (user.id || user.username)]); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: chats are NOT persisted to localStorage anymore — backend is the
  // single source of truth. Messages are pushed to the backend via the sync
  // effect below.

  // ---- Full chat-message sync: history follows the account across devices ----
  // Push: whenever a chat's messages change, debounced-push to the backend.
  // Only chats whose content actually changed are pushed (signature check).
  const lastPushedRef = useRef({});
  const chatsRef = useRef([]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => {
    if (!ready || !user) return;
    for (const chat of chats) {
      if (!chat || !chat.id) continue;
      // NEVER push an empty message list: chats pulled by title from the
      // backend arrive with no local messages, and pushing [] for them
      // overwrites (wipes) the server-side history that simply hasn't been
      // opened on this device yet. An empty local list has nothing to save.
      if (!chat.messages || chat.messages.length === 0) continue;
      const sig = JSON.stringify(chat.messages || []);
      if (lastPushedRef.current[chat.id] === sig) continue;
      // Save immediately (no debounce) — user reported losing messages on quick refresh.
      (async () => {
        try {
          const { saveChatMessages } = await import('./lib/api');
          const r = await saveChatMessages(chat.id, chat.messages || []);
          if (r && r.ok) lastPushedRef.current[chat.id] = sig;
        } catch { /* offline — will retry on next change */ }
      })();
    }
    return () => {};
  }, [chats, ready, user]);

  // Pull: when the active chat opens (or on login), fetch remote messages and
  // fill in anything missing locally. Local messages win on id conflicts (they
  // may carry live hunt state); remote-only messages are appended.
  useEffect(() => {
    if (!ready || !user || !activeChatId) return;
    let cancelled = false;
    (async () => {
      try {
        const { getChatMessages } = await import('./lib/api');
        const res = await getChatMessages(activeChatId);
        if (cancelled || !res.ok || !res.data || !Array.isArray(res.data.messages)) return;
        const remote = res.data.messages;
        if (remote.length === 0) return;
        setChats((prev) => prev.map((c) => {
          if (c.id !== activeChatId) return c;
          const localIds = new Set((c.messages || []).map((m) => m && m.id));
          const missing = remote.filter((m) => m && m.id && !localIds.has(m.id));
          if (missing.length === 0) return c;
          return { ...c, messages: [...(c.messages || []), ...missing] };
        }));
      } catch { /* offline — local chats still work */ }
    })();
    return () => { cancelled = true; };
  }, [activeChatId, ready, user]);

  // Re-attach backend hunts on login: hunts keep running on the backend even
  // if the browser is closed. Any hunt missing from the local chats gets its
  // own chat card so it is never "gone". Also re-syncs when the tab regains
  // focus, so a hunt started from another browser/device appears without a
  // manual reload.
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    let lastSync = 0;
    async function syncHunts() {
      const now = Date.now();
      if (now - lastSync < 15000) return; // don't hammer the backend on rapid focus flips
      lastSync = now;
      try {
        const { listHunts, getChatMessages, getChatTitles } = await import('./lib/api');
        const res = await listHunts();
        if (cancelled || !res.ok || !res.data || !Array.isArray(res.data.hunts)) return;
        // Respect user deletions: don't restore chats for hunts whose chat was deleted.
        let deletedHuntIds = new Set();
        try {
          const raw = localStorage.getItem(`dm.deletedHunts.${user.id}`);
          if (raw) deletedHuntIds = new Set(JSON.parse(raw));
        } catch { /* none */ }
        // Which hunts already have a chat? A hunt counts as covered when a
        // local chat carries its hunt card, or when the deterministic
        // restored-chat id for it exists (the title pull brings restored
        // chats back without their messages, so the card alone can't be
        // the only signal — that false "missing" minted a fresh duplicate
        // chat on every new browser/device).
        const current = chatsRef.current || [];
        const known = new Set();
        current.forEach((c) => {
          (c.messages || []).forEach((m) => {
            if (m.role === 'hunt' && m.hunt && m.hunt.huntId) known.add(m.hunt.huntId);
          });
          if (c.id && c.id.startsWith('hunt-')) known.add(c.id.slice('hunt-'.length));
        });
        const missing = res.data.hunts.filter(
          (h) => h && h.huntId && !known.has(h.huntId) && !deletedHuntIds.has(h.huntId)
        );
        if (missing.length === 0) return;
        // A hunt may already have a chat created on ANOTHER device: locally
        // (and in the server title list) it appears as a bare title with no
        // messages loaded. Check the server-side messages of title-matching
        // chats before minting a duplicate.
        let serverTitles = [];
        try {
          const tr = await getChatTitles();
          if (tr && tr.ok && tr.data && Array.isArray(tr.data.chats)) serverTitles = tr.data.chats;
        } catch { /* best-effort */ }
        const candidateIdsByTitle = new Map();
        const addCandidate = (title, id) => {
          if (!title || !id) return;
          if (!candidateIdsByTitle.has(title)) candidateIdsByTitle.set(title, new Set());
          candidateIdsByTitle.get(title).add(id);
        };
        current.forEach((c) => addCandidate(c.title, c.id));
        serverTitles.forEach((c) => addCandidate(c.title, c.id));
        const stillMissing = [];
        for (const h of missing) {
          const title = `Hunt: ${h.target || h.huntId}`;
          const candidates = candidateIdsByTitle.get(title) || new Set();
          let covered = false;
          for (const chatId of candidates) {
            try {
              const mr = await getChatMessages(chatId);
              const msgs = mr && mr.data && Array.isArray(mr.data.messages) ? mr.data.messages : [];
              if (msgs.some((m) => m && m.role === 'hunt' && m.hunt && m.hunt.huntId === h.huntId)) {
                covered = true;
                // Hydrate the local copy so the chat opens with its card.
                if (msgs.length > 0) {
                  setChats((prev) => prev.map((x) =>
                    x.id === chatId && !(x.messages && x.messages.length) ? { ...x, messages: msgs } : x
                  ));
                }
                break;
              }
            } catch { /* best-effort — fall through to restore */ }
          }
          if (!covered) stillMissing.push(h);
        }
        if (cancelled || stillMissing.length === 0) return;
        setChats((prev) => {
          // Re-check against fresh state: another pass may have restored
          // these hunts (or their chats arrived via title pull) meanwhile.
          const have = new Set();
          prev.forEach((c) => {
            (c.messages || []).forEach((m) => {
              if (m.role === 'hunt' && m.hunt && m.hunt.huntId) have.add(m.hunt.huntId);
            });
            if (c.id && c.id.startsWith('hunt-')) have.add(c.id.slice('hunt-'.length));
          });
          const fresh = stillMissing.filter((h) => !have.has(h.huntId));
          if (fresh.length === 0) return prev;
          const restored = fresh.map((h) => ({
            id: `hunt-${h.huntId}`,
            title: `Hunt: ${h.target || h.huntId}`,
            createdAt: h.createdAt || new Date().toISOString(),
            restored: true,
            messages: [
              {
                id: uid(),
                role: 'hunt',
                hunt: { huntId: h.huntId, target: h.target, scope: h.scope || '', status: h.status || 'unknown', createdAt: h.createdAt },
              },
            ],
          }));
          return [...restored, ...prev];
        });
      } catch { /* offline — local chats still work */ }
    }
    syncHunts();
    window.addEventListener('focus', syncHunts);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', syncHunts);
    };
  }, [ready, user]);

  // Chat title sync: renames follow the account across browsers/devices.
  // Pull on login; push (debounced) whenever local titles change.
  // NOTE: This pull NEVER deletes local chats. Deletions are handled via
  // tombstones (explicit user delete action). A backend list that is missing
  // a local chat may mean it hasn't synced yet — deleting it would be data loss.
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { getChatTitles } = await import('./lib/api');
        const res = await getChatTitles();
        if (cancelled || !res.ok || !res.data || !Array.isArray(res.data.chats)) return;
        const remote = new Map(res.data.chats.map((c) => [c.id, c]));
        // Only ADD new remote chats and UPDATE titles — never remove local chats here.
        // Apply backend tombstones: filter out any local chat the backend says is deleted.
        let tombstoneIds = new Set();
        try {
          const tRes = await (await import('./lib/api')).getChatTombstones();
          if (tRes.ok && Array.isArray(tRes.data?.tombstones)) {
            tombstoneIds = new Set(tRes.data.tombstones.map((t) => t.id));
          }
        } catch { /* best-effort */ }
        setChats((prev) => {
          // Remove chats that backend has tombstoned
          let next = prev.filter((c) => !tombstoneIds.has(c.id));
          // Add remote chats not present locally
          const localIds = new Set(next.map((c) => c.id));
          for (const [id, r] of remote) {
            if (!localIds.has(id) && !tombstoneIds.has(id)) {
              next.push({ id: r.id, title: r.title, updatedAt: r.updatedAt, createdAt: r.updatedAt });
            }
          }
          // Update titles for existing
          return next.map((c) => {
            const r = remote.get(c.id);
            if (r && String(r.updatedAt || '') > String(c.updatedAt || '')) {
              return { ...c, title: r.title, updatedAt: r.updatedAt };
            }
            return c;
          });
        });
      } catch { /* offline — local titles still work */ }
    })();
    return () => { cancelled = true; };
  }, [ready, user]);

  // Push title changes (debounced 4s so renames don't spam the backend).
  useEffect(() => {
    if (!ready || !user) return;
    const t = setTimeout(() => {
      import('./lib/api').then(({ syncChatTitles }) => {
        const titles = chats.map((c) => ({
          id: c.id,
          title: c.title,
          // NEVER generate a fresh timestamp here — a "now" updatedAt would be
          // newer than a delete tombstone and resurrect deleted chats.
          // If the chat has no timestamp, omit it (backend keeps existing).
          ...(c.updatedAt ? { updatedAt: c.updatedAt } : {}),
          ...(c.createdAt ? { createdAt: c.createdAt } : {}),
        }));
        let deleted = [];
        try {
          const raw = localStorage.getItem(`dm.deleted.${user.id}`);
          deleted = raw ? JSON.parse(raw) : [];
        } catch { /* none */ }
        syncChatTitles(titles, deleted).catch(() => {});
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [chats, ready, user]);

  // Deep components can request the auth modal.
  useEffect(() => {
    function onOpenAuth() {
      setAuthModal('login');
    }
    window.addEventListener('dm:open-auth', onOpenAuth);
    return () => window.removeEventListener('dm:open-auth', onOpenAuth);
  }, []);

  // Back/forward button support for /login and /admin.
  useEffect(() => {
    function onPop() {
      setPage(routeFromPath());
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const activeChat =
    chats.find((c) => c.id === activeChatId) ||
    (draftChat && draftChat.id === activeChatId ? draftChat : null);

  const createChat = useCallback(() => {
    // If there's already an untouched draft, just go back to it —
    // never stack up blank entries in history.
    if (draftChat && (draftChat.messages || []).length === 0) {
      setActiveChatId(draftChat.id);
      setPage('chat');
      return draftChat.id;
    }
    // Reuse any existing empty committed chat instead of making another.
    const empty = chats.find((c) => (c.messages || []).length === 0);
    if (empty) {
      setDraftChat(null);
      setActiveChatId(empty.id);
      setPage('chat');
      return empty.id;
    }
    // Fresh draft: NOT added to history yet. It gets committed when the
    // first message is sent or a hunt is started.
    const chat = {
      id: uid(),
      title: 'New chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDraftChat(chat);
    setActiveChatId(chat.id);
    setPage('chat');
    return chat.id;
  }, [chats, draftChat]);

  const appendMessage = useCallback((chatId, message) => {
    // Every message gets a timestamp if it doesn't have one.
    const stamped = message.createdAt ? message : { ...message, createdAt: new Date().toISOString() };
    // First message in a draft chat commits it to history.
    if (draftChat && draftChat.id === chatId) {
      const messages = [stamped];
      let title = draftChat.title;
      if (stamped.role === 'user') title = deriveTitle(stamped.text);
      else if (stamped.role === 'hunt') title = deriveTitle(`Hunt: ${stamped.hunt.target}`);
      const committed = { ...draftChat, title, messages, updatedAt: new Date().toISOString() };
      setDraftChat(null);
      setChats((prev) => [committed, ...prev]);
      return;
    }
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const messages = [...c.messages, stamped];
        let title = c.title;
        if (c.title === 'New chat' && message.role === 'user') {
          title = deriveTitle(message.text);
        } else if (c.title === 'New chat' && message.role === 'hunt') {
          title = deriveTitle(`Hunt: ${message.hunt.target}`);
        }
        return { ...c, title, messages, updatedAt: new Date().toISOString() };
      }),
    );
  }, [draftChat]);

  const updateMessage = useCallback((chatId, messageId, text) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, text } : m)) }
          : c,
      ),
    );
  }, []);

  const renameChat = useCallback((chatId, title) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, title, updatedAt: new Date().toISOString() } : c
      )
    );
  }, []);

  const [confirmingDelete, setConfirmingDelete] = useState(null);

  const deleteChat = useCallback(
    (chatId) => {
      console.log('[delete] deleteChat called for:', chatId);
      // Show confirmation dialog first — user asked for explicit confirm
      setConfirmingDelete(chatId);
    },
    [],
  );

  const confirmDeleteChat = useCallback(
    (chatId) => {
      console.log('[delete] confirmDeleteChat called for:', chatId);
      setConfirmingDelete(null);
      // Record a tombstone so the delete syncs to the backend and the chat
      // doesn't resurrect on refresh/other devices.
      const tombstone = { id: chatId, deletedAt: new Date().toISOString() };
      try {
        const key = `dm.deleted.${user?.id || 'anon'}`;
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        arr.push(tombstone);
        localStorage.setItem(key, JSON.stringify(arr.slice(-500)));
      } catch { /* best-effort */ }
      // Send the tombstone IMMEDIATELY — don't wait for the debounced sync,
      // or a quick refresh loses the delete.
      import('./lib/api').then(({ syncChatTitles }) => {
        syncChatTitles([], [tombstone]).catch(() => {});
      });
      setChats((prev) => {
        // If this was a hunt chat, record the hunt ID so auto-restore doesn't bring it back.
        const doomed = prev.find((c) => c.id === chatId);
        const huntMsg = doomed && doomed.messages && doomed.messages.find((m) => m.role === 'hunt' && m.hunt && m.hunt.huntId);
        if (huntMsg) {
          try {
            const hk = `dm.deletedHunts.${user?.id || 'anon'}`;
            const hraw = localStorage.getItem(hk);
            const harr = hraw ? JSON.parse(hraw) : [];
            harr.push(huntMsg.hunt.huntId);
            localStorage.setItem(hk, JSON.stringify(harr.slice(-200)));
          } catch { /* best-effort */ }
        }
        const next = prev.filter((c) => c.id !== chatId);
        if (chatId === activeChatId) {
          setActiveChatId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    },
    [activeChatId, user],
  );

  // Hunts are NEVER stored in localStorage — backend is the single source
  // of truth. Always fetch fresh via listHunts().
  const recordHunt = useCallback((hunt) => {
    // No-op: backend stores hunts. Kept for API compatibility.
  }, []);

  const updateHunt = useCallback(
    (chatId, huntId, status) => {
      // Update in-memory chat messages only. Hunt state lives on the backend.
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: (c.messages || []).map((m) =>
                  m.role === 'hunt' && m.hunt.huntId === huntId
                    ? { ...m, hunt: { ...m.hunt, status } }
                    : m,
                ),
              }
            : c,
        ),
      );
    },
    [],
  );

  function openReports(huntId) {
    setReportHuntId(huntId || null);
    setPage('reports');
  }

  function navigate(p) {
    setPage(p);
    try {
      const path = p === 'login' ? '/login' : p === 'admin' ? '/admin' : '/';
      window.history.replaceState(null, '', path);
    } catch { /* ignore */ }
    // Opening the auth pages from the app shell should not leave the modal up.
    if (p === 'login') setAuthModal(null);
  }

  // Sidebar "New hunt" — fresh front page, like the first open.
  // Creates a new empty chat and shows the clean "Where should we begin?"
  // view. The hunt setup opens only when the user explicitly starts one
  // (composer hunt button) — never automatically.
  function requestHuntModal() {
    createChat();
    setPage('chat');
    // Trigger the hunt creation dialog to open automatically
    setHuntModalTrigger((t) => t + 1);
    try {
      window.history.replaceState(null, '', '/');
    } catch { /* ignore */ }
  }

  if (!ready) {
    return (
      <div className="app">
        <main className="main" />
        <ToastHost />
      </div>
    );
  }

  if (page === 'login') {
    return (
      <div className="app">
        <AuthPage onDone={() => navigate('chat')} />
        <ToastHost />
      </div>
    );
  }

  if (page === 'admin') {
    return (
      <div className={`app${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          activePage={page}
          onSelectChat={setActiveChatId}
          onNewHunt={requestHuntModal}
          onNavigate={navigate}
          onRenameChat={renameChat}
          onDeleteChat={deleteChat}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="main">
          <TopBar
            onMenu={() => setSidebarOpen((v) => !v)}
            sidebarOpen={sidebarOpen}
            showShare={false}
            onNavigate={navigate}
            onActivity={() => setActivityOpen(true)}
          />
          <AdminPage />
        </main>
        <ToastHost />
      </div>
    );
  }

  return (
    <div className={`app${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        activePage={page}
        onSelectChat={setActiveChatId}
        onNewHunt={requestHuntModal}
        onNavigate={navigate}
        onRenameChat={renameChat}
        onDeleteChat={deleteChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <button className="sidebar-backdrop" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="main">
        <TopBar
          onMenu={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
          showShare={page === 'chat' && !!activeChat && (activeChat.messages || []).length > 0}
          onNavigate={navigate}
          onActivity={() => setActivityOpen(true)}
        />
        <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />
        {page === 'chat' && (
          <ChatPage
            chat={activeChat}
            onAppendMessage={appendMessage}
            onUpdateMessage={updateMessage}
            onNewChat={createChat}
            onRecordHunt={recordHunt}
            onUpdateHunt={updateHunt}
            onOpenReports={openReports}
            onOpenHuntChat={(huntId) => {
              // Find the chat containing this hunt and navigate to it — and
              // bring it to the TOP of the history. One hunt = one chat, for
              // life: re-hunting a target re-opens its existing chat (never
              // a duplicate), and that chat rises to first place.
              const found = chats.find((c) =>
                (c.messages || []).some((m) => m.role === 'hunt' && m.hunt && m.hunt.huntId === huntId)
              );
              if (found) {
                setActiveChatId(found.id);
                setChats((prev) => {
                  const target = prev.find((c) => c.id === found.id);
                  if (!target) return prev;
                  const bumped = { ...target, updatedAt: new Date().toISOString() };
                  return [bumped, ...prev.filter((c) => c.id !== found.id)];
                });
              }
            }}
            huntModalTrigger={huntModalTrigger}
          />
        )}
        {page === 'plugins' && <PluginsPage />}
        {page === 'reports' && <ReportsPage preselectedHuntId={reportHuntId} />}
        {page === 'topup' && <TopUpPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onDone={() => setPage('chat')}
        />
      )}
      <ToastHost />
      {confirmingDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmingDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete chat?</h3>
            <p className="modal-text">
              This will permanently delete this chat from your view on all devices.
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setConfirmingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => confirmDeleteChat(confirmingDelete)}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
