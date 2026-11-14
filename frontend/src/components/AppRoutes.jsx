// App shell routing — the layout + page switch, extracted from App.jsx
// (P6). Purely presentational: all state, effects and callbacks live in
// AppInner (App.jsx) and arrive as props. No behaviour change.
import React from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import ActivityDrawer from '../components/ActivityDrawer';
import UpiPayPage from '../pages/UpiPayPage';
import AdminPage from '../pages/AdminPage';
import ChatPage from '../pages/ChatPage';
import PluginsPage from '../pages/PluginsPage';
import ReportsPage from '../pages/ReportsPage';
import SelfPage from '../pages/SelfPage';
import LiveMachinesPage from '../pages/LiveMachinesPage';
import SettingsPage from '../pages/SettingsPage';
import AuthPage from '../pages/AuthPage';
import LegalPage from '../pages/LegalPage';
import AuthModal from '../components/AuthModal';
import ToastHost from '../components/ToastHost';

export default function AppRoutes({
  ready,
  page,
  navigate,
  setPage,
  sidebarOpen,
  setSidebarOpen,
  chats,
  runningHunts,
  activeChatId,
  setActiveChatId,
  hunter,
  huntModes,
  requestHuntModal,
  renameChat,
  deleteChat,
  activeChat,
  activityOpen,
  setActivityOpen,
  openHuntChat,
  reportHuntId,
  huntModalTrigger,
  appendMessage,
  updateMessage,
  createChat,
  recordHunt,
  updateHunt,
  openReports,
  authModal,
  setAuthModal,
  confirmingDelete,
  setConfirmingDelete,
  confirmDeleteChat,
  pickHunter,
}) {
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
        <AuthPage onDone={() => navigate('chat')} onNavigate={navigate} />
        <ToastHost />
      </div>
    );
  }

  if (page === 'admin') {
    return (
      <div className={`app${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        <Sidebar
          chats={chats}
          runningHunts={runningHunts}
          activeChatId={activeChatId}
          activePage={page}
          hunter={hunter}
          huntModes={huntModes}
          onSelectChat={setActiveChatId}
          onNewHunt={requestHuntModal}
          onNavigate={navigate}
          onRenameChat={renameChat}
          onDeleteChat={deleteChat}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        {/* Backdrop stays mounted so its fade transition can play on close. */}
        <button
          className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
        <main className="main">
          <TopBar
            onMenu={() => setSidebarOpen((v) => !v)}
            sidebarOpen={sidebarOpen}
            showShare={false}
            hunter={hunter}
            onPickHunter={pickHunter}
            onNavigate={navigate}
            onActivity={() => setActivityOpen(true)}
            onOpenHunt={openHuntChat}
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
        runningHunts={runningHunts}
        activeChatId={activeChatId}
        activePage={page}
        hunter={hunter}
        huntModes={huntModes}
        onSelectChat={setActiveChatId}
        onNewHunt={requestHuntModal}
        onNavigate={navigate}
        onRenameChat={renameChat}
        onDeleteChat={deleteChat}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {/* Backdrop stays mounted so its fade transition can play on close. */}
      <button
        className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
        aria-label="Close sidebar"
        onClick={() => setSidebarOpen(false)}
      />
      <main className="main">
        <TopBar
          onMenu={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
          showShare={page === 'chat' && !!activeChat && (activeChat.messages || []).length > 0}
          hunter={hunter}
          onPickHunter={pickHunter}
          onNavigate={navigate}
          onActivity={() => setActivityOpen(true)}
          onOpenHunt={openHuntChat}
        />
        <ActivityDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />
        {(page === 'privacy' || page === 'terms') && (
          <LegalPage type={page} onNavigate={navigate} />
        )}
        {page === 'chat' && (
          <ChatPage
            chat={activeChat}
            onAppendMessage={appendMessage}
            onUpdateMessage={updateMessage}
            onNewChat={createChat}
            onRecordHunt={recordHunt}
            onUpdateHunt={updateHunt}
            onOpenReports={openReports}
            onOpenHuntChat={openHuntChat}
            huntModalTrigger={huntModalTrigger}
          />
        )}
        {page === 'plugins' && <PluginsPage />}
        {page === 'self' && <SelfPage />}
        {page === 'reports' && <ReportsPage preselectedHuntId={reportHuntId} />}
        {page === 'machines' && <LiveMachinesPage onOpenHunt={openHuntChat} />}
        {page === 'pay' && <UpiPayPage />}
        {page === 'settings' && <SettingsPage onNavigate={navigate} />}
      </main>
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onDone={() => setPage('chat')}
          onNavigate={navigate}
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
