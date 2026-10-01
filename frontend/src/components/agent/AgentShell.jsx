/**
 * AgentShell — DarkMatter "Singularity" app chrome.
 *
 * Slim icon-rail sidebar (desktop) + minimal top bar. Only TWO primary
 * destinations: Hunt and Infinity AI. Everything else (Reports, Models,
 * Backend) lives under the Settings gear. Mobile gets a bottom tab bar.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Crosshair, Sparkles, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { listJobs } from '../../services/api';
import Logo from '../brand/Logo';
import './AgentShell.css';

const NAV = [
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

const TITLES = {
  '/agent': 'Hunt',
  '/agent/infinity': 'Infinity AI',
  '/agent/settings': 'Settings',
  '/agent/reports': 'Reports',
  '/agent/models': 'Models',
};

export function AgentShell({ children }) {
  const { user, logout } = useAuth();
  const { running } = useLiveStats();
  const location = useLocation();
  const initial = user?.username || user?.name || user?.email || '?';

  const title = React.useMemo(() => {
    if (location.pathname.startsWith('/agent/hunt/')) return 'Active Hunt';
    if (location.pathname.startsWith('/agent/reports/')) return 'Report';
    return TITLES[location.pathname] || 'DarkMatter';
  }, [location.pathname]);

  return (
    <div className="sg-app sg-shell">
      <aside className="sg-rail" aria-label="Primary">
        <Link to="/agent" className="sg-rail-brand" title="DarkMatter home">
          <Logo size={34} />
        </Link>

        <nav className="sg-rail-nav">
          {NAV.map(({ to, label, icon: Icon, end, hint }) => (
            <NavLink
              key={to} to={to} end={end} title={`${label} — ${hint}`}
              className={({ isActive }) => `sg-rail-item${isActive ? ' active' : ''}`}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sg-rail-foot">
          <NavLink
            to="/agent/settings" title="Settings"
            className={({ isActive }) => `sg-rail-item${isActive ? ' active' : ''}`}
          >
            <Settings size={20} strokeWidth={1.8} />
            <span>Settings</span>
          </NavLink>
          <button className="sg-rail-avatar" title={`${user?.username || user?.email} — sign out`} onClick={logout}>
            {String(initial).charAt(0).toUpperCase()}
            <span className="sg-rail-logout"><LogOut size={13} /></span>
          </button>
        </div>
      </aside>

      <div className="sg-main">
        <header className="sg-topbar">
          <h1 className="sg-topbar-title">{title}</h1>
          <span className={`sg-pill ${running > 0 ? 'sg-pill-go' : ''}`} title={running > 0 ? `${running} hunt(s) running` : 'No hunts running'}>
            {running > 0 && <span className="dot" />}
            {running > 0 ? `${running} hunt${running === 1 ? '' : 's'} live` : 'Agent idle'}
          </span>
        </header>

        <main className="sg-content">{children}</main>

        <nav className="sg-tabbar" aria-label="Primary">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `sg-tab${isActive ? ' active' : ''}`}>
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/agent/settings" className={({ isActive }) => `sg-tab${isActive ? ' active' : ''}`}>
            <Settings size={20} strokeWidth={1.8} />
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
