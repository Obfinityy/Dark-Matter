// Top bar — ChatGPT logged-out idiom: hamburger, "Dark Matter" wordmark +
// chevron (brand picker). Right: "Log in" black pill + "Sign up for free"
// outline pill when logged out; avatar + profile menu when logged in.
import React, { useEffect, useRef, useState } from 'react';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { getTotalCosts } from '../lib/api';

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 15V3M7 7l5-4 5 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v8h14v-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 12h4l3 8 4-16 3 8h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TopBar({ onMenu, sidebarOpen, showShare, onNavigate, onActivity }) {
  const { user } = useAuth();
  const [modelOpen, setModelOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [burn, setBurn] = useState(null);
  const modelRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!user) { setBurn(null); return; }
    let cancelled = false;
    const fetchBurn = () => {
      getTotalCosts().then((res) => {
        if (!cancelled && res.ok && res.data) setBurn(res.data.totalUsd);
      }).catch(() => {});
    };
    fetchBurn();
    const t = setInterval(fetchBurn, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  useEffect(() => {
    function onDocClick(e) {
      if (modelRef.current && !modelRef.current.contains(e.target)) setModelOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function share() {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast('Link copied to clipboard.', 'success'),
        () => toast('Could not copy the link.', 'error'),
      );
    } else {
      toast('Clipboard is not available.', 'error');
    }
  }

  const initial = user && (user.username || user.name) ? (user.username || user.name).trim().charAt(0).toUpperCase()
    : user && user.email ? user.email.trim().charAt(0).toUpperCase() : '•';

  return (
    <header className="topbar">
      <div className="topbar-left" ref={modelRef} style={{ position: 'relative' }}>
        <button className="icon-btn hamburger-btn" onClick={onMenu} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
          <IconMenu />
        </button>
        <button
          className="brand-picker"
          onClick={() => setModelOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={modelOpen}
        >
          Dark Matter
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {modelOpen && (
          <div className="model-menu" role="menu">
            <button className="model-option" role="menuitemradio" aria-checked="true" onClick={() => setModelOpen(false)}>
              <div>
                <div className="model-option-name">Dark Matter</div>
                <div className="model-option-sub">Infinity AI</div>
              </div>
              <svg className="model-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="topbar-right" ref={profileRef} style={{ position: 'relative' }}>
        {user && burn !== null && burn > 0 && (
          <span className="burn-pill" title="Total AWS money burnt (Bedrock + EC2)">
            🔥 ${burn.toFixed(2)}
          </span>
        )}
        {onActivity && (
          <button className="icon-btn" title="Agent activity" aria-label="Agent activity" onClick={onActivity}>
            <IconActivity />
          </button>
        )}
        {showShare && (
          <button className="icon-btn" title="Share chat" aria-label="Share chat" onClick={share}>
            <IconShare />
          </button>
        )}
        {user ? (
          <>
            <button className="avatar-btn" aria-label="Profile" aria-haspopup="menu" onClick={() => setProfileOpen((v) => !v)}>
              {initial}
            </button>
            {profileOpen && (
              <ProfileMenu positionClass="top-right" onNavigate={onNavigate} onClose={() => setProfileOpen(false)} />
            )}
          </>
        ) : (
          <button className="pill-btn pill-btn-solid" onClick={() => onNavigate('login')}>
            Log in
          </button>
        )}
      </div>
    </header>
  );
}
