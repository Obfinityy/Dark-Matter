import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Box,
  CreditCard,
  Loader2,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings,
  Sparkles,
  User
} from 'lucide-react';
import { SubscriptionModal } from '../modals/SubscriptionModal';
import { PluginsModal } from '../modals/PluginsModal';
import { apiClient, extractTargetUrl } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';

function formatHistoryDate(value) {
  if (!value) return 'Earlier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((startOfToday - startOfDate) / 86_400_000);
  if (daysAgo === 0) return 'Today';
  if (daysAgo <= 7) return 'Previous 7 days';
  return 'Earlier';
}

function formatHistoryLabel(scan) {
  if (scan?.targetUrl) return scan.targetUrl;
  const message = scan?.messages?.[0]?.content || '';
  const url = extractTargetUrl(message);
  if (url) return url;
  if (scan?.targetId) return scan.targetId;
  return scan?.toolId || 'Investigation';
}

export const ChatLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia?.('(max-width: 768px)').matches);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [scans, setScans] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    apiClient.getScans()
      .then((response) => {
        if (!cancelled) setScans(Array.isArray(response?.scans) ? response.scans : []);
      })
      .catch((error) => {
        if (!cancelled) setHistoryError(error.message || 'History is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const historyGroups = scans.reduce((groups, scan) => {
    const title = formatHistoryDate(scan.createdAt);
    const group = groups.find((item) => item.title === title);
    const historyItem = { ...scan, label: formatHistoryLabel(scan) };
    if (group) group.items.push(historyItem);
    else groups.push({ title, items: [historyItem] });
    return groups;
  }, []);

  const handleNewChat = () => {
    setShowUserMenu(false);
    navigate('/', { state: { newChat: Date.now() } });
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="app-container">
      <button className={`sidebar-backdrop ${sidebarOpen ? '' : 'hidden'}`} aria-label="Sidebar backdrop" />
      <aside className={`chat-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark"><Sparkles size={16} /></span>
          <span>DARK<span>MATTER</span></span>
          <span className="sidebar-brand-version">OPS</span>
        </div>
        <div className="sidebar-new-chat">
          <div className="sidebar-new-chat-row">
            <button className="btn sidebar-new-chat-button" onClick={handleNewChat}>
              <Plus size={18} />
              <span>New Chat</span>
            </button>
            <button className="btn sidebar-icon-button" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar" title="Collapse sidebar">
              <PanelLeftClose size={20} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        <div className="sidebar-history">
          {historyLoading && (
            <div className="sidebar-empty"><Loader2 size={15} className="animate-spin" /> Loading history</div>
          )}
          {!historyLoading && historyError && (
            <div className="sidebar-empty sidebar-error"><AlertCircle size={15} /> {historyError}</div>
          )}
          {!historyLoading && !historyError && historyGroups.length === 0 && (
            <div className="sidebar-empty">No investigations yet.</div>
          )}
          {!historyLoading && !historyError && historyGroups.map((group) => (
            <div key={group.title}>
              <div className="history-group-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink key={item.id} to={`/c/${item.id}`} className={({ isActive }) => `history-item ${isActive ? 'active' : ''}`} title={item.label}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn sidebar-action-button upgrade-action" onClick={() => setShowSubscription(true)}>
            <Sparkles size={18} />
            Upgrade to Pro
          </button>
          <button className="btn sidebar-action-button" onClick={() => setShowPlugins(true)}>
            <Box size={18} />
            Plugins
          </button>

          <div className="sidebar-user-menu">
            <button className="btn sidebar-user-button" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="sidebar-user-avatar">{user?.name?.slice(0, 1).toUpperCase() || <User size={14} />}</span>
              <span className="sidebar-user-name">{user?.name || 'Researcher'}</span>
              <MoreHorizontal size={16} color="var(--text-secondary)" />
            </button>

            {showUserMenu && (
              <div className="sidebar-popover">
                <button className="btn sidebar-popover-button" onClick={() => { setShowUserMenu(false); navigate('/settings'); }}>
                  <Settings size={16} /> Settings
                </button>
                <button className="btn sidebar-popover-button" onClick={() => { setShowUserMenu(false); navigate('/billing'); }}>
                  <CreditCard size={16} /> Billing
                </button>
                <div className="sidebar-popover-divider" />
                <button className="btn sidebar-popover-button logout-button" onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header-brand">
            {!sidebarOpen && (
              <button className="btn sidebar-icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" title="Open sidebar">
                <PanelLeft size={20} color="var(--text-secondary)" />
              </button>
            )}
            <button className="btn chat-brand-button">DarkMatter <span>/ Recon Console</span></button>
          </div>
          <div className="chat-header-status"><span className="status-pulse" /> Workspace online <span className="header-divider" /> <span className="header-mode">SUBDOMAIN TOOL</span></div>
        </header>

        <Outlet />
      </main>

      {showSubscription && <SubscriptionModal onClose={() => setShowSubscription(false)} />}
      {showPlugins && <PluginsModal onClose={() => setShowPlugins(false)} />}
    </div>
  );
};
