/**
 * PayloadLibrary — the self-learning payload library ("Libraries" section).
 *
 * Every payload the agent tries is recorded with its outcome; successes rise
 * to the top. This page shows the leaderboard: top payloads by technique /
 * category, with success rates — the agent's accumulated tradecraft, visible.
 */
import React, { useEffect, useState } from 'react';
import { LibraryBig, Loader2, TrendingUp, Filter } from 'lucide-react';
import { listPayloads, getPayloadLibraryStats } from '../../services/api';

export function PayloadLibrary() {
  const [payloads, setPayloads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [technique, setTechnique] = useState('');
  const [category, setCategory] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        listPayloads({ technique: technique || null, category: category || null, limit: 50 }).catch(() => null),
        getPayloadLibraryStats().catch(() => null)
      ]);
      if (p?.payloads) setPayloads(p.payloads);
      if (s?.stats) setStats(s.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Loading payload library…</div>;

  return (
    <div className="dm-payloads">
      <header className="dm-page-head">
        <div>
          <h1><LibraryBig size={22} /> Payload library</h1>
          <p>Self-learning: payloads that worked rise to the top and get suggested first in future hunts.</p>
        </div>
      </header>

      {stats && (
        <div className="dm-stat-row">
          <div className="dm-stat"><strong>{stats.totalPayloads ?? payloads.length}</strong><span>payloads</span></div>
          <div className="dm-stat"><strong>{stats.totalAttempts ?? '—'}</strong><span>attempts</span></div>
          <div className="dm-stat"><strong>{stats.successRate != null ? `${Math.round(stats.successRate * 100)}%` : '—'}</strong><span>success rate</span></div>
          <div className="dm-stat"><strong>{stats.techniques ?? '—'}</strong><span>techniques</span></div>
        </div>
      )}

      <div className="dm-filter-row">
        <Filter size={14} />
        <input value={technique} onChange={(e) => setTechnique(e.target.value)} placeholder="Filter by technique — e.g. xss" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Filter by category" />
        <button className="dm-btn-secondary" onClick={refresh}>Apply</button>
      </div>

      {payloads.length === 0 ? (
        <div className="dm-empty-state">
          <TrendingUp size={28} />
          <p>No payloads recorded yet — the library learns as the agent hunts.</p>
        </div>
      ) : (
        <ul className="dm-payload-list">
          {payloads.map((payload, i) => (
            <li key={payload.id || i} className="dm-payload-card">
              <div className="dm-payload-rank">#{i + 1}</div>
              <div className="dm-payload-main">
                <code className="dm-payload-text">{payload.payload || payload.value}</code>
                <div className="dm-payload-meta">
                  {payload.technique && <span className="dm-tech-chip">{payload.technique}</span>}
                  {payload.category && <span>{payload.category}</span>}
                  {payload.successRate != null && (
                    <span className="dm-payload-rate">{Math.round(payload.successRate * 100)}% success</span>
                  )}
                  {payload.uses != null && <span>{payload.uses} uses</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
