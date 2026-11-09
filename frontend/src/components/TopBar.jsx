// Top bar — ChatGPT logged-out idiom: hamburger, "Dark Matter" wordmark +
// chevron (brand picker). Right: "Log in" black pill + "Sign up for free"
// outline pill when logged out; avatar + profile menu when logged in.
import React, { useEffect, useRef, useState } from 'react';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '../lib/auth';
import { toast } from '../lib/toast';
import { getTotalCosts, getNotifications, markNotificationRead } from '../lib/api';

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

function IconFlame() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export default function TopBar({ onMenu, sidebarOpen, showShare, onNavigate, onActivity, onOpenHunt, hunter = 'scanner', onPickHunter }) {
  const { user } = useAuth();
  const [modelOpen, setModelOpen] = useState(false);
  // Hunter picker (3 Nov 2026, owner order): "Dark Matter" opens two
  // hunters — Infinity AI and Infinity Autonomous. The choice lives in
  // App.jsx (single source of truth, persisted per device in
  // localStorage 'dm.hunter'); it is the default hunter for new hunts
  // (the New Hunt dialog re-reads the same key) and the sidebar's
  // hunter filter. This component only renders the picker UI.
  const activeHunter = hunter === 'ai' ? 'ai' : 'scanner';
  function pickHunter(h) {
    if (typeof onPickHunter === 'function') onPickHunter(h);
    setModelOpen(false);
  }
  const [profileOpen, setProfileOpen] = useState(false);
  const [burn, setBurn] = useState(null);
  const modelRef = useRef(null);
  const profileRef = useRef(null);
  // Instant finding notifications: bell polls every 30s; a toast fires
  // only for ids first seen AFTER the initial poll (no backlog spam).
  const [notes, setNotes] = useState([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const seenNotesRef = useRef(null);

  useEffect(() => {
    if (!user) { setNotes([]); setUnread(0); seenNotesRef.current = null; return; }
    let cancelled = false;
    const fetchNotes = () => {
      getNotifications().then((res) => {
        if (cancelled || !res.ok || !res.data) return;
        const list = res.data.notifications || [];
        if (seenNotesRef.current === null) {
          seenNotesRef.current = new Set(list.map((n) => n.id));
        } else {
          list.forEach((n) => {
            if (!seenNotesRef.current.has(n.id)) {
              seenNotesRef.current.add(n.id);
              toast(`Verified finding: ${n.title}`, 'success');
            }
          });
        }
        setNotes(list);
        setUnread(res.data.unreadCount || 0);
      }).catch(() => {});
    };
    fetchNotes();
    const t = setInterval(fetchNotes, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

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
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
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
      <div className="topbar-left" ref={modelRef}>
        <button className="icon-btn hamburger-btn" onClick={onMenu} aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
          <IconMenu />
        </button>
        <button
          className="brand-picker"
          onClick={() => setModelOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={modelOpen}
        >
          <img src="/dark-matter-symbol.png" alt="" className="brand-picker-symbol" aria-hidden="true" />
          Dark Matter
          <span
            className="hunter-badge"
            title={activeHunter === 'scanner' ? 'Infinity Autonomous — rule-based scan, no AI, $0' : 'Infinity AI — AI agent hunts autonomously'}
          >
            {activeHunter === 'scanner' ? 'Autonomous' : 'AI'}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {modelOpen && (
          <div className="model-menu" role="menu">
            <button
              className="model-option"
              role="menuitemradio"
              aria-checked={activeHunter === 'ai'}
              onClick={() => pickHunter('ai')}
            >
              <div>
                <div className="model-option-name">Infinity AI</div>
                <div className="model-option-sub">AI agent hunts like a human expert</div>
              </div>
              {activeHunter === 'ai' && (
                <svg className="model-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button
              className="model-option"
              role="menuitemradio"
              aria-checked={activeHunter === 'scanner'}
              onClick={() => pickHunter('scanner')}
            >
              <div>
                <div className="model-option-name">Infinity Autonomous</div>
                <div className="model-option-sub">Rule-based scan, no AI, $0 — results in minutes</div>
              </div>
              {activeHunter === 'scanner' && (
                <svg className="model-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
      <div className="topbar-right" ref={profileRef}>
        {user && burn !== null && burn > 0 && (
          <span className="burn-pill" title="Total AWS money burnt (Bedrock + EC2)">
            <IconFlame /> ${burn.toFixed(2)}
          </span>
        )}
        {onActivity && (
          <button className="icon-btn" title="Agent activity" aria-label="Agent activity" onClick={onActivity}>
            <IconActivity />
          </button>
        )}
        {user && (
          <div className="bell-wrap" ref={bellRef}>
            <button className="icon-btn" title="Finding notifications" aria-label="Finding notifications" onClick={() => setBellOpen((v) => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unread > 0 && (
                <span className="unread-badge">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="model-menu bell-menu" role="menu">
                {notes.length === 0 && (
                  <div className="model-option-sub bell-menu-empty">No verified findings yet — you will be told instantly when one lands.</div>
                )}
                {notes.slice(0, 10).map((n) => {
                  const isUnread = !(n.readBy || []).includes(user.id);
                  return (
                    <button
                      key={n.id}
                      className={`model-option bell-item${isUnread ? '' : ' read'}`}
                      onClick={() => {
                        markNotificationRead(n.id).catch(() => {});
                        setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, readBy: [...(x.readBy || []), user.id] } : x)));
                        setUnread((u) => Math.max(0, u - (isUnread ? 1 : 0)));
                        setBellOpen(false);
                        if (n.huntId && onOpenHunt) onOpenHunt(n.huntId);
                      }}
                    >
                      <div>
                        <div className="model-option-name">{isUnread ? '● ' : ''}{n.title}</div>
                        <div className="model-option-sub">{n.severity} · {n.target || n.huntId} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
