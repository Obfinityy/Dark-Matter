/**
 * PayloadLibrary — the self-learning payload library ("Libraries" section).
 *
 * Every payload the agent tries is recorded with its outcome; successes rise
 * to the top. This page shows the leaderboard: top payloads by technique /
 * category, with success rates — the agent's accumulated tradecraft, visible.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, Filter, Unplug, ShieldCheck } from 'lucide-react';
import './PayloadLibrary.css';
import { listPayloads, getPayloadLibraryStats, tryApi } from '../../services/api';
import { getApiBase, getBackendUrl } from '../../services/backendMode';

export function PayloadLibrary() {
  const [payloads, setPayloads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [technique, setTechnique] = useState('');
  const [category, setCategory] = useState('');
  const [backendDown, setBackendDown] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        tryApi(
          listPayloads({ technique: technique || null, category: category || null, limit: 50 })
        ),
        tryApi(getPayloadLibraryStats()),
      ]);
      const errors = [p.error, s.error].filter(Boolean);
      const allNetworkFailed =
        errors.length === 2 &&
        errors.every(e => e.status === 0 || e.code === 'BACKEND_UNAVAILABLE');
      const anyAuthFailed = errors.some(e => e.status === 401);
      setBackendDown(allNetworkFailed);
      setAuthExpired(!allNetworkFailed && anyAuthFailed);
      if (p.data?.payloads) setPayloads(p.data.payloads);
      if (s.data?.stats) setStats(s.data.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const techniqueOptions = [...new Set(payloads.map(p => p.technique).filter(Boolean))];

  const filterLabel = [
    technique && `technique “${technique}”`,
    category && `category “${category}”`,
  ]
    .filter(Boolean)
    .join(' and ');

  if (loading) {
    return (
      <div className="dm-page">
        <div className="dm-container">
          <header className="dm-page-head">
            <h1 className="dm-page-title">Payload library</h1>
            <p className="dm-page-sub">
              Self-learning: payloads that worked rise to the top and get suggested first in future
              hunts.
            </p>
          </header>
          <div className="dm-notice" role="status" aria-label="Loading payload library">
            <span className="dm-notice-icon" aria-hidden="true">
              <Loader2 size={18} aria-hidden="true" className="sg-spin" />
            </span>
            Loading the payload library…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-page">
      <div className="dm-container">
        <header className="dm-page-head">
          <h1 className="dm-page-title">Payload library</h1>
          <p className="dm-page-sub">
            Self-learning: payloads that worked rise to the top and get suggested first in future
            hunts.
          </p>
        </header>

        {authExpired && (
          <div className="dm-notice dm-pl-notice dm-pl-notice-alert" role="alert">
            <span className="dm-notice-icon" aria-hidden="true">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong className="dm-text-2 dm-pl-notice-title">Session expired</strong>
              <p className="dm-pl-notice-text">
                Your sign-in has expired. Please sign in again to load the payload library.
              </p>
              <button
                className="dm-btn dm-btn-primary dm-btn-sm"
                onClick={() => {
                  try {
                    localStorage.removeItem('dm_jwt');
                  } catch {
                    /* ignore */
                  }
                  window.location.href = '/login';
                }}
              >
                Sign in again
              </button>
            </div>
          </div>
        )}

        {backendDown && !authExpired && (
          <div className="dm-notice dm-pl-notice dm-pl-notice-alert" role="alert">
            <span className="dm-notice-icon" aria-hidden="true">
              <Unplug size={18} />
            </span>
            <div>
              <strong className="dm-text-2 dm-pl-notice-title">Backend unreachable</strong>
              <p className="dm-pl-notice-text">
                Payloads can't load because the backend isn't responding at{' '}
                <code>{getApiBase()}</code>. The backend is <code>{getBackendUrl()}</code> — set{' '}
                <code>VITE_BACKEND_URL</code> in <code>.env</code> to point elsewhere, or run{' '}
                <code>npm start</code> in <code>backend/</code> for localhost.
              </p>
              <button
                className="dm-btn dm-btn-primary dm-btn-sm"
                onClick={() => {
                  setBackendDown(false);
                  refresh();
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {stats && (
          <div className="dm-grid-4 dm-pl-stats" aria-label="Library statistics">
            <div className="dm-card dm-center">
              <div className="dm-pl-stat-value">{stats.totalPayloads ?? payloads.length}</div>
              <div className="dm-muted dm-pl-stat-label">payloads</div>
            </div>
            <div className="dm-card dm-center">
              <div className="dm-pl-stat-value">{stats.totalAttempts ?? '—'}</div>
              <div className="dm-muted dm-pl-stat-label">attempts</div>
            </div>
            <div className="dm-card dm-center">
              <div className="dm-pl-stat-value">
                {stats.successRate != null ? `${Math.round(stats.successRate * 100)}%` : '—'}
              </div>
              <div className="dm-muted dm-pl-stat-label">success rate</div>
            </div>
            <div className="dm-card dm-center">
              <div className="dm-pl-stat-value">{stats.techniques ?? '—'}</div>
              <div className="dm-muted dm-pl-stat-label">techniques</div>
            </div>
          </div>
        )}

        <div className="dm-card dm-pl-filters" role="search">
          <div className="dm-pl-filters-row">
            <span className="dm-muted dm-pl-filter-icon" aria-hidden="true">
              <Filter size={16} />
            </span>
            <div className="dm-field dm-pl-filter-field">
              <label className="dm-label" htmlFor="payload-filter-technique">
                Technique
              </label>
              <input
                id="payload-filter-technique"
                className="dm-input"
                list="payload-techniques"
                type="search"
                value={technique}
                onChange={e => setTechnique(e.target.value)}
                placeholder="e.g. xss"
              />
              <datalist id="payload-techniques">
                {techniqueOptions.map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="dm-field dm-pl-filter-field">
              <label className="dm-label" htmlFor="payload-filter-category">
                Category
              </label>
              <input
                id="payload-filter-category"
                className="dm-input"
                type="search"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. web"
              />
            </div>
            <button className="dm-btn dm-btn-secondary" onClick={refresh}>
              Apply
            </button>
          </div>
        </div>

        <p className="dm-muted dm-pl-result-count" role="status" aria-live="polite">
          {payloads.length === 0
            ? 'No payloads to show'
            : `Showing ${payloads.length} payload${payloads.length === 1 ? '' : 's'}${filterLabel ? ` matching ${filterLabel}` : ''}`}
        </p>

        {payloads.length === 0 ? (
          <div className="dm-empty">
            <div className="dm-empty-icon" aria-hidden="true">
              <TrendingUp size={28} />
            </div>
            <h3 className="dm-empty-title">Library is empty</h3>
            <p className="dm-empty-sub">
              No payloads recorded yet — the library learns as the agent hunts.
            </p>
          </div>
        ) : (
          <ul className="dm-pl-list" aria-label="Top payloads by success rate">
            {payloads.map((payload, i) => {
              const rate =
                payload.successRate != null ? Math.round(payload.successRate * 100) : null;
              return (
                <li key={payload.id || i} className="dm-row">
                  <span className="dm-muted dm-pl-rank" aria-hidden="true">
                    #{i + 1}
                  </span>
                  <div className="dm-row-main">
                    <code className="dm-pl-code">{payload.payload || payload.value}</code>
                    <div className="dm-pl-meta">
                      {payload.technique && <span className="dm-badge">{payload.technique}</span>}
                      {payload.category && (
                        <span className="dm-muted dm-pl-meta-text">{payload.category}</span>
                      )}
                      {rate != null && (
                        <span
                          className={rate >= 50 ? 'dm-badge dm-badge-green' : 'dm-badge'}
                          aria-label={`Success rate ${rate} percent`}
                        >
                          {rate}% success
                        </span>
                      )}
                      {payload.uses != null && (
                        <span className="dm-muted dm-pl-meta-text">{payload.uses} uses</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
