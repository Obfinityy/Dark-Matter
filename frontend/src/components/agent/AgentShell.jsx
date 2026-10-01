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
  Crosshair, Sparkles, Settings, LogOut
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { listJobs } from '../../services/api';

/**
 * v2 SIMPLIFIED NAVIGATION — only TWO main tabs:
 *   Hunt        — autonomous bug bounty agent
 *   Infinity AI — autonomous coding agent + chat
 *
 * Everything else (Models, Backend settings, Reports) lives under
 * the Settings gear or inside the Hunt view. Simple. Clean.
 */
const NAV = [
  { to: '/agent', label: 'Hunt', icon: Crosshair, end: true },
  { to: '/agent/infinity', label: 'Infinity AI', icon: Sparkles }
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

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const jobsBody = await listJobs({ status: 'running', limit: 50 }).catch(() => null);
        if (cancelled) return;
        const jobs = jobsBody?.jobs || [];
        setRunning(jobs.filter((j) => String(j.status).toLowerCase() === 'running').length);
      } catch { /* top bar degrades silently — never blocks the page */ }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return { running };
}

export function AgentShell({ children }) {
  const { user, logout } = useAuth();
  const { running } = useLiveStats();
  const initial = user?.username || user?.name || user?.email || '?';

  return (
    <div className="dm-shell">
      <aside className="dm-sidebar" aria-label="Agent console navigation">
        <Link to="/agent" className="dm-brand">
          <span className="dm-brand-mark"><Crosshair size={19} /></span>
          <span>
            <span className="dm-brand-name">DARKMATTER</span>
            <span className="dm-brand-sub">bug bounty agent</span>
          </span>
        </Link>

        <nav className="dm-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `dm-nav-item${isActive ? ' active' : ''}`}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
          <NavLink to="/agent/settings" className={({ isActive }) => `dm-nav-item${isActive ? ' active' : ''}`}>
            <Settings size={17} /> Settings
          </NavLink>
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
        </header>

        <nav className="dm-mobile-nav" aria-label="Agent console navigation">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={14} /> {label}
            </NavLink>
          ))}
          <NavLink to="/agent/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Settings size={14} /> Settings
          </NavLink>
        </nav>

        {children}
      </div>
    </div>
  );
}
