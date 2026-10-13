// Profile menu — Plugins, Reports, Settings, Log out.
// Shared by the sidebar user row and the top-bar avatar.
import React from 'react';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';

function IconPlugins() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 3v5.5L4.5 13a2.4 2.4 0 0 0 4.2 2.3L12 12l3.3 3.3a2.4 2.4 0 0 0 4.2-2.3L15 8.5V3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3v18" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6z" strokeLinejoin="round" />
      <path d="M9 12h7M9 16h7M9 8h3" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 0 0-.14-1.4l2-1.55-2-3.46-2.36.95A7 7 0 0 0 14 5.1L13.7 2.6h-3.4L10 5.1a7 7 0 0 0-2.5 1.44l-2.36-.95-2 3.46 2 1.55a7 7 0 0 0 0 2.8l-2 1.55 2 3.46 2.36-.95a7 7 0 0 0 2.5 1.44l.3 2.5h3.4l.3-2.5a7 7 0 0 0 2.5-1.44l2.36.95 2-3.46-2-1.55c.1-.46.14-.93.14-1.4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 4H6v16h8" strokeLinejoin="round" />
      <path d="M10 12h11M18 8l3 4-3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProfileMenu({ onNavigate, onClose, positionClass = '' }) {
  const { logout: authLogout } = useAuth();

  function go(page) {
    onClose && onClose();
    onNavigate(page);
  }

  function logout() {
    authLogout();
    onClose && onClose();
    toast('Signed out.', 'info');
  }

  return (
    <div className={`profile-menu ${positionClass}`} role="menu">
      <button className="profile-menu-item" onClick={() => go('plugins')} role="menuitem">
        <IconPlugins /> Plugins
      </button>
      <button className="profile-menu-item" onClick={() => go('reports')} role="menuitem">
        <IconReports /> Reports
      </button>
      <button className="profile-menu-item" onClick={() => go('settings')} role="menuitem">
        <IconSettings /> Settings
      </button>
      <div className="profile-menu-divider" />
      <button className="profile-menu-item" onClick={logout} role="menuitem">
        <IconLogout /> Log out
      </button>
    </div>
  );
}
