// Hunts tab — live status summary, hunter filter, hunt cards and the
// queue, extracted from AdminPage.jsx (P6).
import React from 'react';

// Hunter mode of an admin hunt row (owner order 4 Nov 2026).
// NOTE — backend gap: GET /api/v1/admin/hunts does NOT return brainMode
// yet. One line in backend/src/routes/admin.js (the GET /hunts map)
// enables the real separation:
//   brainMode: m.brainMode === 'scanner' ? 'scanner' : 'ai',
// Until that lands every row honestly reads 'unknown' and the AI /
// Autonomous tabs stay empty — no fake labels are shown meanwhile.
function huntHunter(h) {
  if (!h) return 'unknown';
  if (h.brainMode === 'scanner') return 'scanner';
  if (h.brainMode === 'ai') return 'ai';
  return 'unknown';
}

export default function AdminHuntsSection({
  hunts,
  queue,
  loading,
  huntFilter,
  setHuntFilter,
  onStopHunt,
  onResumeHunt,
  onDownloadMemory,
}) {
  const filteredHunts = huntFilter === 'all'
    ? hunts
    : hunts.filter((h) => huntHunter(h) === huntFilter);

  return (
    <section className="admin-section">
      <h2>All hunts</h2>
      <p className="page-sub">Monitor and control hunts across all users. Running hunts appear first.</p>
      {loading ? <p className="page-sub">Loading…</p> : (
        <>
          {/* Live status summary */}
          <div className="hunt-stats">
            <div className="stat-card">
              <div className="stat-num">{hunts.filter(h => h.state === 'running').length}</div>
              <div className="stat-label">🟢 Running</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{hunts.filter(h => h.state === 'paused').length}</div>
              <div className="stat-label">⏸️ Paused</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{hunts.filter(h => !['running','paused'].includes(h.state)).length}</div>
              <div className="stat-label">⚪ Finished</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{queue.length}</div>
              <div className="stat-label">📋 Queued</div>
            </div>
          </div>
          {/* Hunter filter — AI vs Autonomous (owner order 4 Nov 2026).
              Counts read h.brainMode; 'Unknown' rows appear until the
              admin hunts API returns brainMode (see huntHunter note). */}
          <div className="hunter-filter" role="tablist" aria-label="Filter hunts by hunter">
            {[
              { id: 'all', label: 'All', count: hunts.length },
              { id: 'ai', label: 'AI', count: hunts.filter((h) => huntHunter(h) === 'ai').length },
              { id: 'scanner', label: 'Autonomous', count: hunts.filter((h) => huntHunter(h) === 'scanner').length },
              { id: 'unknown', label: 'Unknown', count: hunts.filter((h) => huntHunter(h) === 'unknown').length },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={huntFilter === t.id}
                className={`hunter-pill${huntFilter === t.id ? ' active' : ''}`}
                onClick={() => setHuntFilter(t.id)}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
          <div className="admin-grid">
            {filteredHunts.length === 0 && (
              <p className="page-sub">
                {hunts.length === 0
                  ? 'No hunts yet.'
                  : 'No hunts match this hunter filter.'}
              </p>
            )}
            {filteredHunts.map((h) => {
              const elapsed = h.elapsedSec != null
                ? `${Math.floor(h.elapsedSec/3600)}h ${Math.floor((h.elapsedSec%3600)/60)}m`
                : '—';
              const hh = huntHunter(h);
              return (
                <div key={h.huntId} className={`admin-card hunt-card ${h.state}`}>
                  <div className="admin-card-header">
                    <div>
                      <div className="admin-username">
                        {h.state === 'running' ? '🟢 ' : h.state === 'paused' ? '⏸️ ' : '⚪ '}
                        {h.target || '(unknown target)'}
                        {' '}
                        <span
                          className={`hunter-badge hunter-${hh}`}
                          title={hh === 'scanner'
                            ? 'Infinity Autonomous hunt — rule-based scan, no AI'
                            : hh === 'ai'
                              ? 'Infinity AI hunt — AI agent'
                              : 'Hunter unknown — the admin hunts API does not return brainMode yet'}
                        >
                          {hh === 'scanner' ? 'Autonomous' : hh === 'ai' ? 'AI' : 'Unknown'}
                        </span>
                      </div>
                      <div className="admin-meta">
                        👤 {h.username || 'unknown'} · {h.mode || 'normal'} mode
                      </div>
                      <div className="admin-meta">
                        🆔 {h.huntId?.slice(0, 16)}… · 🔄 iter {h.iteration || 0} · ⏱️ {elapsed}
                      </div>
                      <div className="admin-meta">
                        📅 {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                      </div>
                      {h.state === 'running' && (
                        <div className="hunt-live-badge">● LIVE</div>
                      )}
                    </div>
                  </div>
                  <div className="admin-card-actions">
                    {(h.state === 'running' || h.state === 'paused') && (
                      <>
                        {h.state === 'running' ? (
                          <button
                            className="btn btn-ghost small danger"
                            onClick={() => onStopHunt(h.huntId)}
                          >
                            ⏹️ Stop Hunt
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost small"
                            onClick={() => onResumeHunt(h.huntId)}
                          >
                            ▶️ Resume Hunt
                          </button>
                        )}
                      </>
                    )}
                    <button
                      className="btn btn-ghost small"
                      onClick={() => onDownloadMemory(h.huntId)}
                    >
                      ⬇️ Memory
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Queue section */}
          {queue.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3>📋 Hunt Queue ({queue.length})</h3>
              <div className="admin-grid">
                {queue.map((q, i) => (
                  <div key={q.queueId || i} className="admin-card">
                    <div className="admin-username">#{i+1} {q.target}</div>
                    <div className="admin-meta">👤 {q.username || 'unknown'} · {q.mode}</div>
                    <div className="admin-meta">Priority: {q.priority || 'normal'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
