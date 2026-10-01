/**
 * AgentShell — the agent console chrome: slim sidebar + top bar.
 *
 * Sidebar (desktop): Hunt, Reports, Models, Queues, Schedules, Alerts,
 * Payloads + user chip / sign-out at the bottom. Top bar: live agent
 * status pill (polls running hunts), alerts bell with unread badge.
 * On small screens the sidebar is replaced by a horizontal nav row.
 *
 * Also exports StatusPill — job statuses rendered in plain language
 * (Hunting / Thinking / Paused / Done …), never raw backend enums.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Crosshair, FileText, Cpu, Layers, CalendarClock, Bell, LibraryBig,
  Shield, LogOut
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { listJobs, listAlerts } from '../../services/api';

const NAV = [
  { to: '/agent', label: 'Hunt', icon: Crosshair, end: true },
  { to: '/agent/reports', label: 'Reports', icon: FileText },
  { to: '/agent/models', label: 'Models', icon: Cpu },
  { to: '/agent/queues', label: 'Queues', icon: Layers },
  { to: '/agent/schedules', label: 'Schedules', icon: CalendarClock },
  { to: '/agent/alerts', label: 'Alerts', icon: Bell },
  { to: '/agent/libraries', label: 'Payloads', icon: LibraryBig }
];

/** Plain-language status pill. `thinking` overrides a running job's label. */
export function StatusPill({ status, thinking = false }) {
  const s = String(status || 'unknown').toLowerCase();
  let label = s.charAt(0).toUpperCase() + s.slice(1);
  let cls = s;
  if (s === 'running' && thinking) { label = 'Thinking'; cls = 'thinking'; }
  else if (s === 'running') { label = 'Hunting'; }
  else if (s === 'completed') { label = 'Done'; }
  else if (s === 'queued') { label = 'Queued'; }
  else if (s === 'paused') { label = 'Paused'; }
  else if (s === 'failed') { label = 'Failed'; }
  else if (s === 'cancelled') { label = 'Cancelled'; }
  return <span className={`dm-status-pill st-${cls}`}>{label}</span>;
}

function useLiveStats() {
  const [running, setRunning] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [jobsBody, alertsBody] = await Promise.all([
          listJobs({ status: 'running', limit: 50 }).catch(() => null),
          listAlerts(true).catch(() => null)
        ]);
        if (cancelled) return;
        const jobs = jobsBody?.jobs || [];
        setRunning(jobs.filter((j) => String(j.status).toLowerCase() === 'running').length);
        setUnread((alertsBody?.alerts || []).filter((a) => !a.read).length);
      } catch { /* top bar degrades silently — never blocks the page */ }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { running, unread };
}

export function AgentShell({ children }) {
  const { user, logout } = useAuth();
  const { running, unread } = useLiveStats();
  const initial = user?.username || user?.name || user?.email || '?';

  return (
    <div className="dm-shell">
      <aside className="dm-sidebar" aria-label="Agent console navigation">
        <Link to="/agent" className="dm-brand">
          <span className="dm-brand-mark"><Shield size={19} /></span>
          <span>
            <span className="dm-brand-name">DARKMATTER</span>
            <span className="dm-brand-sub">bug bounty agent</span>
          </span>
        </Link>

        <nav className="dm-nav">
          <div className="dm-nav-label">Console</div>
          {NAV.slice(0, 1).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `dm-nav-item${isActive ? ' active' : ''}`}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
          <div className="dm-nav-label">Manage</div>
          {NAV.slice(1).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `dm-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={17} /> {label}
              {to === '/agent/alerts' && unread > 0 && (
                <span className="dm-nav-badge">{unread > 99 ? '99+' : unread}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="dm-side-foot">
          <span className="dm-side-user">{String(initial).charAt(0).toUpperCase()}</span>
          <span className="dm-side-user-name">{user?.username || user?.name || user?.email}</span>
          <button className="dm-side-logout" onClick={logout} title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="dm-main">
        <header className="dm-topbar">
          <span className="dm-topbar-title">Agent console</span>
          <span className={`dm-live-pill${running > 0 ? ' hunting' : ''}`} title={running > 0 ? `${running} hunt(s) running` : 'No hunts running'}>
            <span className="dm-live-dot" />
            {running > 0 ? `${running} hunt${running === 1 ? '' : 's'} live` : 'Agent idle'}
          </span>
          <span className="dm-topbar-spacer" />
          <Link to="/agent/alerts" className="dm-topbar-bell" title="Alerts" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}>
            <Bell size={17} />
            {unread > 0 && <span className="dm-nav-badge">{unread > 99 ? '99+' : unread}</span>}
          </Link>
        </header>

        <nav className="dm-mobile-nav" aria-label="Agent console navigation">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={14} /> {label}
            </NavLink>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
