/**
 * AgentShell — DarkMatter "Singularity" app chrome.
 *
 * Top navbar: ONLY the two primary destinations — Hunt and Infinity AI
 * (+ live status pill). Per-mode LEFT SIDEBAR below it:
 *
 *   Hunt mode      → New Hunt · Library · Plugins · hunt history ·
 *                     Premium · Settings · Account
 *   Infinity AI    → New Chat · Library · Plugins · chat history ·
 *                     Premium · Settings · Account
 *
 * Other routes (Reports, Models, …) keep working but are no longer
 * top-level nav — they're reached from inside their pages.
 *
 * On narrow screens (≤760px) the sidebar collapses into a slide-in
 * drawer opened by the hamburger button in the top bar.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Crosshair, Sparkles, Settings, Plus, LibraryBig, Blocks, Crown,
  UserRound, Menu, X, MessageSquare, RefreshCw, Bell, GitCompareArrows
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { listJobs, listAlerts } from '../../services/api';
import { listConversations, CONVERSATIONS_CHANGED_EVENT } from '../../services/chatHistory';
import Logo from '../brand/Logo';
import './AgentShell.css';

const TOP_TABS = [
  { to: '/agent', label: 'Hunt', icon: Crosshair, end: true, hint: 'Autonomous bug-bounty agent' },
  { to: '/agent/infinity', label: 'Infinity AI', icon: Sparkles, hint: 'Autonomous coding agent' },
];

export function StatusPill({ status, thinking = false }) {
  const s = String(status || 'unknown').toLowerCase();
  let label = s.charAt(0).toUpperCase() + s.slice(1);
  let cls = '';
  if (s === 'running' && thinking) { label = 'Thinking'; cls = 'sg-pill-info'; }
  else if (s === 'running') { label = 'Hunting'; cls = 'sg-pill-go'; }
  else if (s === 'completed') { label = 'Done'; cls = ''; }
  else if (s === 'queued') { label = 'Queued'; cls = 'sg-pill-info'; }
  else if (s === 'paused') { label = 'Paused'; cls = 'sg-pill-warn'; }
  else if (s === 'failed') { label = 'Failed'; cls = 'sg-pill-danger'; }
  else if (s === 'cancelled') { label = 'Cancelled'; cls = ''; }
  return <span className={`sg-pill ${cls}`}>{(s === 'running') && <span className="dot" />} {label}</span>;
}

function useLiveStats() {
  const [running, setRunning] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const jobsBody = await listJobs({ status: 'running', limit: 50 }).catch(() => null);
        if (cancelled) return;
        const jobs = jobsBody?.jobs || [];
        setRunning(jobs.filter((j) => String(j.status).toLowerCase() === 'running').length);
      } catch { /* degrades silently */ }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return { running };
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_DOT = {
  running: 'sg-dot-go',
  completed: 'sg-dot-done',
  failed: 'sg-dot-danger',
  paused: 'sg-dot-warn',
  queued: 'sg-dot-info',
  cancelled: 'sg-dot-done',
};

const TITLES = {
  '/agent': 'Hunt',
  '/agent/infinity': 'Infinity AI',
  '/agent/settings': 'Settings',
  '/agent/reports': 'Reports',
  '/agent/models': 'Models',
  '/agent/library': 'Library',
  '/agent/plugins': 'Plugins',
  '/agent/premium': 'Premium',
  '/agent/account': 'Account',
  '/agent/alerts': 'Alerts',
  '/agent/compare': 'Compare hunts',
  '/agent/queues': 'Target queues',
  '/agent/schedules': 'Scheduled hunts',
};

function HuntHistory({ onNavigate, refreshKey }) {
  const [jobs, setJobs] = useState(null);
  useEffect(() => {
    let cancelled = false;
    listJobs().then((body) => {
      if (cancelled) return;
      const list = (body?.jobs || []).slice().sort(
        (a, b) => new Date(b.updatedAt || b.startedAt || 0) - new Date(a.updatedAt || a.startedAt || 0)
      );
      setJobs(list.slice(0, 15));
    }).catch(() => { if (!cancelled) setJobs([]); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (jobs === null) {
    return <div className="sg-side-empty">Loading hunts…</div>;
  }
  if (jobs.length === 0) {
    return <div className="sg-side-empty">No hunts yet - start your first one above.</div>;
  }
  return (
    <ul className="sg-side-list">
      {jobs.map((job) => {
        const status = String(job.status || 'unknown').toLowerCase();
        return (
          <li key={job.id}>
            <NavLink to={`/agent/hunt/${job.id}`} className="sg-side-hist" onClick={onNavigate}>
              <span className={`sg-dot ${STATUS_DOT[status] || ''}`} />
              <span className="sg-side-hist-main">
                <span className="sg-side-hist-target" title={job.target}>
                  {job.target || 'Untitled hunt'}
                </span>
                <span className="sg-side-hist-meta">
                  {status}{job.findingsCount ? ` · ${job.findingsCount} findings` : ''}
                  {job.startedAt ? ` · ${timeAgo(job.startedAt)}` : ''}
                </span>
              </span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function ChatHistory({ onNavigate, refreshKey }) {
  const [convs, setConvs] = useState([]);
  useEffect(() => {
    const reload = () => setConvs(listConversations());
    reload();
    // A new message in InfinityAI records the conversation without a
    // navigation — refresh the list live via the custom event.
    window.addEventListener(CONVERSATIONS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(CONVERSATIONS_CHANGED_EVENT, reload);
  }, [refreshKey]);

  if (convs.length === 0) {
    return <div className="sg-side-empty">No chats yet - say hello above.</div>;
  }
  return (
    <ul className="sg-side-list">
      {convs.map((c) => (
        <li key={c.id}>
          <Link
            to="/agent/infinity"
            state={{ conversationId: c.id, mode: c.mode }}
            className="sg-side-hist"
            onClick={onNavigate}
          >
            <MessageSquare size={14} className="sg-side-hist-icon" />
            <span className="sg-side-hist-main">
              <span className="sg-side-hist-target" title={c.title}>{c.title}</span>
              <span className="sg-side-hist-meta">{c.mode}{c.updatedAt ? ` · ${timeAgo(c.updatedAt)}` : ''}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SidebarSection({ label, action, children }) {
  return (
    <div className="sg-side-section">
      <div className="sg-side-label-row">
        <div className="sg-side-label">{label}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function useUnreadAlerts() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const body = await listAlerts(true).catch(() => null);
        if (cancelled) return;
        const alerts = body?.alerts || [];
        setUnread(alerts.filter((a) => !a.read).length);
      } catch { /* degrades silently */ }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return unread;
}

export function AgentShell({ children }) {
  const { logout } = useAuth();
  const { running } = useLiveStats();
  const unread = useUnreadAlerts();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarClosed, setSidebarClosed] = useState(false);
  const [histTick, setHistTick] = useState(0);

  const isInfinity = location.pathname === '/agent/infinity' ||
    location.pathname.startsWith('/agent/infinity/');
  const refreshKey = `${location.pathname}${location.key}:${histTick}`;

  // Close the drawer on every navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.key]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Keyboard shortcuts: Alt+1 Hunt, Alt+2 Infinity AI, Esc closes the drawer.
  // Never hijack keys while the user is typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setDrawerOpen(false); return; }
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.altKey && e.key === '1') { e.preventDefault(); navigate('/agent'); }
      if (e.altKey && e.key === '2') { e.preventDefault(); navigate('/agent/infinity'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const closeDrawer = () => setDrawerOpen(false);

  const title = React.useMemo(() => {
    if (location.pathname.startsWith('/agent/hunt/')) return 'Active Hunt';
    if (location.pathname.startsWith('/agent/reports/')) return 'Report';
    return TITLES[location.pathname] || 'DarkMatter';
  }, [location.pathname]);

  const huntLinks = [
    { to: '/agent', label: 'New Hunt', icon: Plus, end: true, primary: true },
    { to: '/agent/library', label: 'Library', icon: LibraryBig },
    { to: '/agent/plugins', label: 'Plugins', icon: Blocks },
  ];
  const infinityLinks = [
    {
      to: '/agent/infinity', label: 'New Chat', icon: Plus, primary: true,
      state: { fresh: Date.now() },
    },
    { to: '/agent/library', label: 'Library', icon: LibraryBig },
    { to: '/agent/plugins', label: 'Plugins', icon: Blocks },
  ];
  const modeLinks = isInfinity ? infinityLinks : huntLinks;

  const sidebar = (
    <div className="sg-side-inner">
      <div className="sg-side-head">
        <span className="sg-side-mode">{isInfinity ? 'Infinity AI' : 'Hunt'}</span>
        <button className="sg-side-close" onClick={closeDrawer} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sg-side-nav" aria-label={isInfinity ? 'Infinity AI' : 'Hunt'}>
        {modeLinks.map(({ to, label, icon: Icon, end, primary, state }) => (
          primary ? (
            <button
              key={label}
              className="sg-side-new"
              onClick={() => { navigate(to, state ? { state } : undefined); closeDrawer(); }}
            >
              <Icon size={16} strokeWidth={2.2} /> {label}
            </button>
          ) : (
            <NavLink
              key={to} to={to} end={end}
              onClick={closeDrawer}
              className={({ isActive }) => `sg-side-item${isActive ? ' active' : ''}`}
            >
              <Icon size={17} strokeWidth={1.9} /> <span>{label}</span>
            </NavLink>
          )
        ))}
      </nav>

      <SidebarSection
        label={isInfinity ? 'Recent chats' : 'Previous hunts'}
        action={
          <button
            className="sg-side-refresh"
            onClick={() => setHistTick((t) => t + 1)}
            title="Refresh list"
            aria-label="Refresh list"
          >
            <RefreshCw size={13} />
          </button>
        }
      >
        {isInfinity
          ? <ChatHistory onNavigate={closeDrawer} refreshKey={refreshKey} />
          : <HuntHistory onNavigate={closeDrawer} refreshKey={refreshKey} />}
        {!isInfinity && (
          <Link to="/agent/compare" className="sg-side-compare" onClick={closeDrawer}>
            <GitCompareArrows size={14} /> Compare hunts
          </Link>
        )}
      </SidebarSection>

      <div className="sg-side-foot">
        <NavLink
          to="/agent/premium" onClick={closeDrawer}
          className={({ isActive }) => `sg-side-item sg-side-premium${isActive ? ' active' : ''}`}
        >
          <Crown size={17} strokeWidth={1.9} /> <span>Premium</span>
        </NavLink>
        <NavLink
          to="/agent/settings" onClick={closeDrawer}
          className={({ isActive }) => `sg-side-item${isActive ? ' active' : ''}`}
        >
          <Settings size={17} strokeWidth={1.9} /> <span>Settings</span>
        </NavLink>
        <NavLink
          to="/agent/account" onClick={closeDrawer}
          className={({ isActive }) => `sg-side-item${isActive ? ' active' : ''}`}
        >
          <UserRound size={17} strokeWidth={1.9} /> <span>Account</span>
        </NavLink>
        <button className="sg-side-signout" onClick={logout}>Sign out</button>
        <div className="sg-side-hint" title="Keyboard shortcuts">Alt+1 Hunt · Alt+2 Infinity AI</div>
      </div>
    </div>
  );

  return (
    <div className={`sg-app sg-shell ${sidebarClosed ? 'sidebar-closed' : ''}`}>
      {/* Mobile drawer */}
      <div
        className={`sg-drawer-scrim${drawerOpen ? ' open' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside className={`sg-sidebar${drawerOpen ? ' open' : ''}${sidebarClosed ? ' closed-desktop' : ''}`} aria-label={isInfinity ? 'Infinity AI menu' : 'Hunt menu'}>
        {sidebar}
      </aside>

        <main className="sg-main">
        {/* Top navbar — ONLY the two primary destinations. */}
        <header className="sg-topbar">
          <div className="sg-topbar-left">
            <button
              className="sg-hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open mobile menu"
            >
              <Menu size={20} />
            </button>
            <button
              className="sg-sidebar-toggle"
              onClick={() => setSidebarClosed(!sidebarClosed)}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <Link to="/agent" className="sg-topbar-brand" title="DarkMatter home">
              <Logo size={30} />
            </Link>
            <nav className="sg-tabs" aria-label="Primary">
              {TOP_TABS.map(({ to, label, icon: Icon, end, hint }) => (
                <NavLink
                  key={to} to={to} end={end} title={hint}
                  className={({ isActive }) => `sg-tab${isActive ? ' active' : ''}`}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <span className="sg-topbar-title">{title}</span>
          </div>
          <div className="sg-topbar-right">
            <Link
              to="/agent/alerts" className="sg-bell" title="Alerts"
              aria-label={`Alerts${unread > 0 ? `, ${unread} unread` : ''}`}
            >
              <Bell size={18} strokeWidth={1.9} />
              {unread > 0 && <span className="sg-bell-badge">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <span
              className={`sg-pill ${running > 0 ? 'sg-pill-go' : ''}`}
              title={running > 0 ? `${running} hunt(s) running` : 'No hunts running'}
            >
              {running > 0 && <span className="dot" />}
              {running > 0 ? `${running} hunt${running === 1 ? '' : 's'} live` : 'Agent idle'}
            </span>
          </div>
        </header>

        <main className="sg-content">{children}</main>
      </div>
    </div>
  );
}
