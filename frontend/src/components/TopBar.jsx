// Top bar — ChatGPT idiom: hamburger (mobile), "Dark Matter ▾" brand picker,
// Share + avatar on the right.
import React, { useEffect, useRef, useState } from 'react';
import ProfileMenu from './ProfileMenu';
import { toast } from '../lib/toast';

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

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" />
    </svg>
  );
}

export default function TopBar({ onMenu, sidebarOpen, showShare, onNavigate }) {
  const [modelOpen, setModelOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const modelRef = useRef(null);
  const profileRef = useRef(null);

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
        {showShare && (
          <button className="icon-btn" title="Share chat" aria-label="Share chat" onClick={share}>
            <IconShare />
          </button>
        )}
        <button className="avatar-btn" aria-label="Profile" aria-haspopup="menu" onClick={() => setProfileOpen((v) => !v)}>
          <IconUser />
        </button>
        {profileOpen && (
          <ProfileMenu positionClass="top-right" onNavigate={onNavigate} onClose={() => setProfileOpen(false)} />
        )}
      </div>
    </header>
  );
}
