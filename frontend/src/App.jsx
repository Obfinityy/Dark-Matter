import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import PluginsPage from './pages/PluginsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ToastHost from './components/ToastHost';

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

export default function App() {
  const [page, setPage] = useState('chat');
  const [reportHuntId, setReportHuntId] = useState(null);
  const [chats, setChats] = useState(() => loadJson(CHATS_KEY, []));
  const [activeChatId, setActiveChatId] = useState(() => {
    const list = loadJson(CHATS_KEY, []);
    return list.length > 0 ? list[0].id : null;
  });

  useEffect(() => saveJson(CHATS_KEY, chats), [chats]);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  const createChat = useCallback(() => {
    const chat = { id: uid(), title: 'New chat', messages: [], createdAt: new Date().toISOString() };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setPage('chat');
    return chat.id;
  }, []);

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

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={createChat}
        onDeleteChat={deleteChat}
        page={page}
        onNavigate={setPage}
      />
      <main className="main">
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
        {page === 'settings' && <SettingsPage />}
      </main>
      <ToastHost />
    </div>
  );
}
