// Finding-notification bell — extracted from TopBar.jsx (P6). Owns the
// 30s notification poll, the unread badge, and the dropdown. A toast fires
// only for ids first seen AFTER the initial poll (no backlog spam).
import React, { useEffect, useRef, useState } from 'react';
import { toast } from '../lib/toast';
import { getNotifications, markNotificationRead } from '../lib/api';

export default function TopBarNotificationBell({ user, onOpenHunt }) {
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
    if (!bellOpen) return;
    function onDocClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [bellOpen]);

  if (!user) return null;

  return (
    <div ref={bellRef} style={{ position: 'relative' }}>
      <button className="icon-btn" title="Finding notifications" aria-label="Finding notifications" onClick={() => setBellOpen((v) => !v)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, background: '#c00', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {bellOpen && (
        <div className="model-menu" role="menu" style={{ right: 0, left: 'auto', width: 340, maxWidth: '80vw' }}>
          {notes.length === 0 && (
            <div className="model-option-sub" style={{ padding: '10px 12px' }}>No verified findings yet — you will be told instantly when one lands.</div>
          )}
          {notes.slice(0, 10).map((n) => {
            const isUnread = !(n.readBy || []).includes(user.id);
            return (
              <button
                key={n.id}
                className="model-option"
                style={{ alignItems: 'flex-start', textAlign: 'left', opacity: isUnread ? 1 : 0.65 }}
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
  );
}
