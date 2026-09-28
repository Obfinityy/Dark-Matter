import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Box, ChevronRight, Clock, CreditCard,
  Globe, LayoutDashboard, Loader2, MoreHorizontal,
  PanelLeft, PanelLeftClose, Plus, Search, Settings,
  Shield, Sparkles, User, Zap
} from 'lucide-react';
import { SubscriptionModal } from '../modals/SubscriptionModal';
import { PluginsModal } from '../modals/PluginsModal';
import { listAssessments } from '../../services/api';
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

function statusDot(status) {
  const colors = {
    running: 'var(--success)',
    paused: 'var(--warning)',
    completed: 'var(--success)',
    failed: 'var(--danger)',
    stopped: 'var(--text-muted)'
  };
  return <span className="sidebar-status-dot" style={{ background: colors[status] || 'var(--accent)' }} />;
}

export const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia?.('(max-width: 768px)').matches);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [assessments, setAssessments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    listAssessments()
      .then(res => {
        if (!cancelled) setAssessments(Array.isArray(res?.assessments) ? res.assessments : []);
      })
      .catch(err => {
        if (!cancelled) setHistoryError(err.message || 'History is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [location.pathname]);

  const historyGroups = assessments.reduce((groups, assessment) => {
    const title = formatHistoryDate(assessment.createdAt);
    const group = groups.find(g => g.title === title);
    if (group) group.items.push(assessment);
    else groups.push({ title, items: [assessment] });
    return groups;
  }, []);

  const handleNewAssessment = () => {
    setShowUserMenu(false);
    navigate('/new');
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
      <button className={`sidebar-backdrop ${sidebarOpen ? '' : 'hidden'}`} aria-label="Sidebar backdrop" onClick={() => setSidebarOpen(false)} />
      <aside className={`chat-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark"><Shield size={16} /></span>
          <span>DARK<span>MATTER</span></span>
          <span className="sidebar-brand-version">SEC</span>
        </div>

        <div className="sidebar-new-chat">
          <div className="sidebar-new-chat-row">
            <button className="btn sidebar-new-chat-button" onClick={handleNewAssessment}>
              <Plus size={18} />
              <span>New Assessment</span>
            </button>
            <button className="btn sidebar-icon-button" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar" title="Collapse sidebar">
              <PanelLeftClose size={20} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        {/* Navigation links */}
        <div className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>
          <NavLink to="/new" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
            <Shield size={16} /> New Assessment
          </NavLink>
        </div>

        {/* Assessment history */}
        <div className="sidebar-history">
          <div className="sidebar-section-title">Assessments</div>
          {historyLoading && (
            <div className="sidebar-empty"><Loader2 size={15} className="animate-spin" /> Loading</div>
          )}
          {!historyLoading && historyError && (
            <div className="sidebar-empty sidebar-error">{historyError}</div>
          )}
          {!historyLoading && !historyError && assessments.length === 0 && (
            <div className="sidebar-empty">No assessments yet.</div>
          )}
          {!historyLoading && !historyError && historyGroups.map(group => (
            <div key={group.title}>
              <div className="history-group-title">{group.title}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.id}
                  to={`/assessment/${item.id}`}
                  className={({ isActive }) => `history-item ${isActive ? 'active' : ''}`}
                  title={item.targetHostname || item.targetUrl}
                >
                  {statusDot(item.status)}
                  <span className="history-item-label">{item.targetHostname || item.targetUrl || 'Assessment'}</span>
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

      <main className="app-main">
        <header className="app-header">
          <div className="app-header-left">
            {!sidebarOpen && (
              <button className="btn sidebar-icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" title="Open sidebar">
                <PanelLeft size={20} color="var(--text-secondary)" />
              </button>
            )}
            <div className="app-header-brand">
              <Shield size={16} /> DarkMatter <span>/ Security Platform</span>
            </div>
          </div>
          <div className="app-header-right">
            <span className="status-pulse" /> Platform online
          </div>
        </header>

        <div className="app-content">
          <Outlet />
        </div>
      </main>

      {showSubscription && <SubscriptionModal onClose={() => setShowSubscription(false)} />}
      {showPlugins && <PluginsModal onClose={() => setShowPlugins(false)} />}
    </div>
  );
};
