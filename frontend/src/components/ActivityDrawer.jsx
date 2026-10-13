// Activity drawer — "what is the agent doing right now?"
// Small button in the top bar opens this: live agent logs (thinking,
// tool calls, findings, status) for the user's hunts.
import React, { useEffect, useState } from 'react';
import { listHunts, getHuntEvents } from '../lib/api';

function eventIcon(type) {
  if (type === 'thinking') return '🧠';
  if (type === 'tool_call') return '🔧';
  if (type === 'finding') return '🎯';
  if (type === 'status') return '📡';
  return '•';
}

function eventText(e) {
  if (!e || typeof e !== 'object') return String(e);
  if (e.type === 'thinking') return e.text || e.summary || 'thinking…';
  if (e.type === 'tool_call') return `${e.tool || e.name || 'tool'}${e.input ? ' — ' + String(e.input).slice(0, 120) : ''}`;
  if (e.type === 'finding') return `[${e.severity || e.level || 'info'}] ${e.title || e.name || e.type}`;
  if (e.type === 'status') return e.state || JSON.stringify(e).slice(0, 120);
  return JSON.stringify(e).slice(0, 160);
}

export default function ActivityDrawer({ open, onClose }) {
  const [hunts, setHunts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    listHunts().then((res) => {
      if (res.ok && res.data && Array.isArray(res.data.hunts)) {
        setHunts(res.data.hunts);
        if (res.data.hunts.length && !activeId) setActiveId(res.data.hunts[0].huntId);
      }
    }).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !activeId) return;
    setLoading(true);
    getHuntEvents(activeId, 200).then((res) => {
      setLoading(false);
      if (res.ok && res.data && Array.isArray(res.data.events)) {
        setEvents(res.data.events);
      }
    }).catch(() => setLoading(false));
    const t = setInterval(() => {
      getHuntEvents(activeId, 200).then((res) => {
        if (res.ok && res.data && Array.isArray(res.data.events)) setEvents(res.data.events);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [open, activeId]);

  if (!open) return null;
  return (
    <div className="activity-scrim" onClick={onClose}>
      <div className="activity-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Agent activity">
        <div className="activity-head">
          <h2>Agent activity</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {hunts.length > 1 && (
          <select
            className="text-input"
            value={activeId || ''}
            onChange={(e) => setActiveId(e.target.value)}
            aria-label="Select hunt"
          >
            {hunts.map((h) => (
              <option key={h.huntId} value={h.huntId}>
                {h.target} ({h.status})
              </option>
            ))}
          </select>
        )}
        <div className="activity-log">
          {loading && <div className="empty-hint">Loading…</div>}
          {!loading && events.length === 0 && (
            <div className="empty-hint">No activity yet. Start a hunt to watch the agent work.</div>
          )}
          {events.map((e, i) => (
            <div key={i} className={`activity-row activity-${e.type || 'other'}`}>
              <span className="activity-icon">{eventIcon(e.type)}</span>
              <span className="activity-text">{eventText(e)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
