import React, { useCallback, useEffect, useState } from 'react';
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
  const [chats, setChats] = useState(() => loadJson(CHATS_KEY, []));
  const [activeChatId, setActiveChatId] = useState(() => {
    const list = loadJson(CHATS_KEY, []);
    return list.length > 0 ? list[0].id : null;
  });

  useEffect(() => saveJson(CHATS_KEY, chats), [chats]);

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

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  const createChat = useCallback(() => {
    // Reuse the active chat if it's still empty — avoids "New chat" spam
    // in history when New Hunt is clicked repeatedly.
    const active = chats.find((c) => c.id === activeChatId);
    if (active && active.messages.length === 0) {
      setPage('chat');
      return active.id;
    }
    const chat = { id: uid(), title: 'New chat', messages: [], createdAt: new Date().toISOString() };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setPage('chat');
    return chat.id;
  }, [chats, activeChatId]);

  const appendMessage = useCallback((chatId, message) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const messages = [...c.messages, message];
        let title = c.title;
        if (c.title === 'New chat' && message.role === 'user') {
          title = deriveTitle(message.text);
        } else if (c.title === 'New chat' && message.role === 'hunt') {
          title = deriveTitle(`Hunt: ${message.hunt.target}`);
        }
        return { ...c, title, messages };
      }),
    );
  }, []);

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
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
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
