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

  // SECURITY: chats are strictly per-user. When the account changes (login,
  // logout, switch), wipe in-memory chats and load only that user's store.
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
    let list = loadJson(key, []);
    // One-time migration: pre-isolation chats lived under the shared key.
    // Move them into this user's private store, then delete the shared copy
    // so no other account can ever see them.
    if ((!Array.isArray(list) || list.length === 0)) {
      const legacy = loadJson(CHATS_KEY, []);
      if (Array.isArray(legacy) && legacy.length > 0) {
        list = legacy;
        saveJson(key, legacy);
        try { localStorage.removeItem(CHATS_KEY); } catch { /* ignore */ }
      }
    }
    setChats(Array.isArray(list) ? list : []);
    setDraftChat(null);
    setActiveChatId(list.length > 0 ? list[0].id : null);
  }, [user && (user.id || user.username)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return; // never persist chats without an owner
    saveJson(chatsKey, chats);
  }, [chats, chatsKey, user]);

  // ---- Full chat-message sync: history follows the account across devices ----
  // Push: whenever a chat's messages change, debounced-push to the backend.
  // Only chats whose content actually changed are pushed (signature check).
  const lastPushedRef = useRef({});
  useEffect(() => {
    if (!ready || !user) return;
    const timers = [];
    for (const chat of chats) {
      if (!chat || !chat.id) continue;
      const sig = JSON.stringify(chat.messages || []);
      if (lastPushedRef.current[chat.id] === sig) continue;
      const t = setTimeout(async () => {
        try {
          const { saveChatMessages } = await import('./lib/api');
          const r = await saveChatMessages(chat.id, chat.messages || []);
          if (r && r.ok) lastPushedRef.current[chat.id] = sig;
        } catch { /* offline — will retry on next change */ }
      }, 2500);
      timers.push(t);
    }
    return () => timers.forEach(clearTimeout);
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
        const { listHunts } = await import('./lib/api');
        const res = await listHunts();
        if (cancelled || !res.ok || !res.data || !Array.isArray(res.data.hunts)) return;
        const known = new Set();
        setChats((prev) => {
          prev.forEach((c) =>
            (c.messages || []).forEach((m) => {
              if (m.role === 'hunt' && m.hunt && m.hunt.huntId) known.add(m.hunt.huntId);
            })
          );
          const missing = res.data.hunts.filter((h) => h && h.huntId && !known.has(h.huntId));
          if (missing.length === 0) return prev;
          const restored = missing.map((h) => ({
            id: uid(),
            title: `Hunt: ${h.target || h.huntId}`,
            createdAt: h.createdAt || new Date().toISOString(),
            restored: true,
            messages: [
              {
                id: uid(),
                role: 'hunt',
                hunt: { huntId: h.huntId, target: h.target, scope: h.scope || '', status: h.status || 'unknown' },
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
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const { getChatTitles } = await import('./lib/api');
        const res = await getChatTitles();
        if (cancelled || !res.ok || !res.data || !Array.isArray(res.data.chats)) return;
        const remote = new Map(res.data.chats.map((c) => [c.id, c]));
        if (remote.size === 0) return;
        setChats((prev) =>
          prev.map((c) => {
            const r = remote.get(c.id);
            if (r && String(r.updatedAt || '') > String(c.updatedAt || '')) {
              return { ...c, title: r.title, updatedAt: r.updatedAt };
            }
            return c;
          })
        );
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
          updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
        }));
        syncChatTitles(titles).catch(() => {});
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
    if (draftChat && draftChat.messages.length === 0) {
      setActiveChatId(draftChat.id);
      setPage('chat');
      return draftChat.id;
    }
    // Reuse any existing empty committed chat instead of making another.
    const empty = chats.find((c) => c.messages.length === 0);
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

  const deleteChat = useCallback(
    (chatId) => {
      setChats((prev) => {
        const next = prev.filter((c) => c.id !== chatId);
        if (chatId === activeChatId) {
          setActiveChatId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    },
    [activeChatId],
  );

  const recordHunt = useCallback((hunt) => {
    const list = loadJson(HUNTS_KEY, []);
    saveJson(HUNTS_KEY, [
      { huntId: hunt.huntId, target: hunt.target, status: hunt.status, createdAt: hunt.createdAt },
      ...list.filter((h) => h.huntId !== hunt.huntId),
    ]);
  }, []);

  const updateHunt = useCallback(
    (chatId, huntId, status) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.role === 'hunt' && m.hunt.huntId === huntId
                    ? { ...m, hunt: { ...m.hunt, status } }
                    : m,
                ),
              }
            : c,
        ),
      );
      const list = loadJson(HUNTS_KEY, []);
      saveJson(
        HUNTS_KEY,
        list.map((h) => (h.huntId === huntId ? { ...h, status } : h)),
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
          showShare={page === 'chat' && !!activeChat && activeChat.messages.length > 0}
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
