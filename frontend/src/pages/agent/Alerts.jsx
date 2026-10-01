/**
 * Alerts — the alerts inbox.
 *
 * Critical findings, hunt completions, and scheduled-hunt starts land here.
 * Unread-first; mark individual alerts read or clear the whole inbox.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { listAlerts, markAlertRead, markAllAlertsRead } from '../../services/api';

const TYPE_LABEL = {
  critical_finding: 'Critical finding',
  hunt_complete: 'Hunt complete',
  hunt_started: 'Hunt started'
};

export function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const refresh = async () => {
    try {
      const body = await listAlerts(unreadOnly);
      setAlerts(body?.alerts || []);
    } catch { setAlerts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); refresh(); }, [unreadOnly]);

  const read = async (id) => {
    await markAlertRead(id).catch(() => {});
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  };

  const readAll = async () => {
    await markAllAlertsRead().catch(() => {});
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  };

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Loading alerts…</div>;

  return (
    <div className="dm-alerts">
      <header className="dm-page-head">
        <div>
          <h1><Bell size={22} /> Alerts</h1>
          <p>Critical findings and hunt lifecycle events, the moment they happen.</p>
        </div>
        <div className="dm-head-links">
          <label className="dm-check-inline">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
          <button className="dm-btn-ghost" onClick={readAll}>
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>
      </header>

      {alerts.length === 0 ? (
        <div className="dm-empty-state">
          <Bell size={28} />
          <p>{unreadOnly ? 'Nothing unread. All quiet.' : 'No alerts yet.'}</p>
        </div>
      ) : (
        <ul className="dm-alert-list">
          {alerts.map((alert) => (
            <li key={alert.id} className={`dm-alert ${alert.read ? 'read' : 'unread'} type-${alert.type}`}>
              <div className="dm-alert-main">
                <span className="dm-alert-type">{TYPE_LABEL[alert.type] || alert.type}</span>
                <strong>{alert.title}</strong>
                {alert.body && <p>{alert.body}</p>}
                <span className="dm-alert-time">
                  {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : ''}
                </span>
              </div>
              <div className="dm-alert-actions">
                {alert.jobId && (
                  <Link to={`/agent/hunt/${alert.jobId}`} className="dm-btn-ghost">
                    Open hunt <ChevronRight size={13} />
                  </Link>
                )}
                {!alert.read && (
                  <button className="dm-btn-ghost" onClick={() => read(alert.id)}>
                    <CheckCheck size={13} /> Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
