/**
 * HuntDiary — the plain-language diary of what the agent did and learned.
 *
 * Each entry is a timestamped diary card: what the agent tried, what it saw,
 * what it concluded. Written for humans, not logs.
 *
 * Props: { entries, loading } — entries from GET /jobs/:id/diary
 */
import React from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import './HuntDiary.css';

// Accent color per diary-entry kind — the rail dot and badge tint pick it up
// via the --diary-kind CSS variable (purely visual, no behavior change).
const KIND_ACCENT = {
  finding: 'var(--dm-danger)',
  hypothesis: '#a78bfa',
  observation: 'var(--dm-info)',
  decision: 'var(--dm-accent-bright)',
  plan: 'var(--dm-accent-bright)',
  tool: 'var(--dm-warn)',
};

function accentStyle(kind) {
  if (!kind) return undefined;
  const accent = KIND_ACCENT[String(kind).toLowerCase()];
  return accent ? { '--diary-kind': accent } : undefined;
}

export function HuntDiary({ entries = [], loading = false }) {
  if (loading)
    return (
      <div className="dm-diary-loading" role="status">
        <Loader2 size={20} className="sg-spin dm-diary-spinner" aria-hidden="true" />
        Opening the hunt diary…
      </div>
    );

  if (!entries.length) {
    return (
      <div className="dm-diary-empty">
        <BookOpen size={22} aria-hidden="true" />
        <p>The diary is empty — entries appear as the agent works through the hunt.</p>
      </div>
    );
  }

  const fmtTime = at => {
    if (!at) return '';
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  };

  return (
    <div className="dm-diary" role="log" aria-label="Hunt diary">
      {entries.map((entry, i) => {
        const accent = accentStyle(entry.kind) || {};
        return (
          <article
            key={entry.id || i}
            className="dm-diary-entry dm-diary-in"
            style={{ ...accent, animationDelay: `${Math.min(i * 45, 450)}ms` }}
            aria-label={entry.title || 'Diary entry'}
          >
            <div className="dm-diary-rail" aria-hidden="true">
              <span className="dm-diary-dot" />
              {i < entries.length - 1 && <span className="dm-diary-line" />}
            </div>
            <div className="dm-diary-card">
              <header>
                <span className="dm-diary-time">{fmtTime(entry.at)}</span>
                {entry.kind && <span className="dm-diary-kind">{entry.kind}</span>}
              </header>
              <h4>{entry.title || 'Diary entry'}</h4>
              {entry.body && <p>{entry.body}</p>}
              {entry.learned && (
                <p className="dm-diary-learned">
                  <strong>Learned:</strong> {entry.learned}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
