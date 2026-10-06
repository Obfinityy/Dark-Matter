/**
 * PayloadLibrary — the self-learning payload library ("Libraries" section).
 *
 * Every payload the agent tries is recorded with its outcome; successes rise
 * to the top. This page shows the leaderboard: top payloads by technique /
 * category, with success rates — the agent's accumulated tradecraft, visible.
 */
import React, { useEffect, useState } from 'react';
import { LibraryBig, Loader2, TrendingUp, Filter, Unplug, Cloud } from 'lucide-react';
import { listPayloads, getPayloadLibraryStats } from '../../services/api';
import {
  getBackendMode, BACKEND_MODES, setBackendMode, getApiBase, getBackendModeLabel
} from '../../services/backendMode';

export function PayloadLibrary() {
  const [payloads, setPayloads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [technique, setTechnique] = useState('');
  const [category, setCategory] = useState('');
  const [backendDown, setBackendDown] = useState(false);
  const [backendMode, setBackendModeState] = useState(() => getBackendMode());

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        listPayloads({ technique: technique || null, category: category || null, limit: 50 }).catch(() => null),
        getPayloadLibraryStats().catch(() => null)
      ]);
      setBackendDown(p == null && s == null);
      setBackendModeState(getBackendMode());
      if (p?.payloads) setPayloads(p.payloads);
      if (s?.stats) setStats(s.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const techniqueOptions = [...new Set(payloads.map((p) => p.technique).filter(Boolean))];

  if (loading) {
    return (
      <div className="dm-payloads" role="status" aria-label="Loading payload library">
        <header className="dm-page-head">
          <div>
            <h1><LibraryBig size={22} /> Payload library</h1>
            <p>Self-learning: payloads that worked rise to the top and get suggested first in future hunts.</p>
          </div>
        </header>
        <ul className="dm-payload-list" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="dm-skeleton" style={{ height: 78 }} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="dm-payloads">
      <header className="dm-page-head">
        <div>
          <h1><LibraryBig size={22} /> Payload library</h1>
          <p>Self-learning: payloads that worked rise to the top and get suggested first in future hunts.</p>
        </div>
      </header>

      {backendDown && (
        <div className="sg-alert sg-auth-error" role="alert" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Unplug size={18} />
            <strong>Backend unreachable</strong>
          </div>
          <p className="sg-small" style={{ margin: '0 0 12px' }}>
            Payloads can't load because the selected backend ({getBackendModeLabel()}) isn't responding at{' '}
            <code>{getApiBase()}</code>.
            {backendMode === BACKEND_MODES.LOCALHOST
              ? ' Your local backend may not be running — or switch to Cloud.'
              : ' Check your connection, or try switching backend mode in Settings.'}
          </p>
          {backendMode === BACKEND_MODES.LOCALHOST && (
            <button
              className="sg-btn sg-btn-primary"
              onClick={() => { setBackendMode(BACKEND_MODES.VERCEL); setBackendDown(false); refresh(); }}
            >
              <Cloud size={14} /> Switch to Cloud backend
            </button>
          )}
        </div>
      )}

      {stats && (
        <div className="dm-stat-row" aria-label="Library statistics">
          <div className="dm-stat"><strong>{stats.totalPayloads ?? payloads.length}</strong><span>payloads</span></div>
          <div className="dm-stat"><strong>{stats.totalAttempts ?? '—'}</strong><span>attempts</span></div>
          <div className="dm-stat"><strong>{stats.successRate != null ? `${Math.round(stats.successRate * 100)}%` : '—'}</strong><span>success rate</span></div>
          <div className="dm-stat"><strong>{stats.techniques ?? '—'}</strong><span>techniques</span></div>
        </div>
      )}

      <div className="dm-filter-row" role="search">
        <Filter size={14} aria-hidden="true" />
        <label className="dm-filter-field">
          <span>Technique</span>
          <input
            list="payload-techniques"
            type="search"
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            placeholder="e.g. xss"
            aria-label="Filter by technique"
          />
          <datalist id="payload-techniques">
            {techniqueOptions.map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>
        <label className="dm-filter-field">
          <span>Category</span>
          <input
            type="search"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. web"
            aria-label="Filter by category"
          />
        </label>
        <button className="dm-btn-secondary" onClick={refresh}>Apply</button>
      </div>

      {payloads.length === 0 ? (
        <div className="dm-empty-state">
          <TrendingUp size={28} aria-hidden="true" />
          <strong>Library is empty</strong>
          <p>No payloads recorded yet — the library learns as the agent hunts.</p>
        </div>
      ) : (
        <ul className="dm-payload-list" aria-label="Top payloads by success rate">
          {payloads.map((payload, i) => {
            const rate = payload.successRate != null ? Math.round(payload.successRate * 100) : null;
            return (
              <li
                key={payload.id || i}
                className="dm-payload-card dm-list-in"
                style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
              >
                <div className="dm-payload-rank" aria-hidden="true">#{i + 1}</div>
                <div className="dm-payload-main">
                  <code className="dm-payload-text">{payload.payload || payload.value}</code>
                  <div className="dm-payload-meta">
                    {payload.technique && <span className="dm-tech-chip">{payload.technique}</span>}
                    {payload.category && <span>{payload.category}</span>}
                    {rate != null && (
                      <span className="dm-payload-rate" aria-label={`Success rate ${rate} percent`}>{rate}% success</span>
                    )}
                    {payload.uses != null && <span>{payload.uses} uses</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
