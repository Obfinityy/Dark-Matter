/**
 * HuntDiary — the plain-language diary of what the agent did and learned.
 *
 * Each entry is a timestamped diary card: what the agent tried, what it saw,
 * what it concluded. Written for humans, not logs.
 *
 * Props: { entries, loading } — entries from GET /jobs/:id/diary
 */
import React from 'react';
import { BookOpen } from 'lucide-react';

export function HuntDiary({ entries = [], loading = false }) {
  if (loading) return <div className="dm-diary-loading">Opening the hunt diary…</div>;

  if (!entries.length) {
    return (
      <div className="dm-diary-empty">
        <BookOpen size={22} />
        <p>The diary is empty — entries appear as the agent works through the hunt.</p>
      </div>
    );
  }

  return (
    <div className="dm-diary">
      {entries.map((entry, i) => (
        <article key={entry.id || i} className="dm-diary-entry">
          <div className="dm-diary-rail">
            <span className="dm-diary-dot" />
            {i < entries.length - 1 && <span className="dm-diary-line" />}
          </div>
          <div className="dm-diary-card">
            <header>
              <span className="dm-diary-time">
                {entry.at ? new Date(entry.at).toLocaleString() : ''}
              </span>
              {entry.kind && <span className="dm-diary-kind">{entry.kind}</span>}
            </header>
            <h4>{entry.title || 'Diary entry'}</h4>
            {entry.body && <p>{entry.body}</p>}
            {entry.learned && (
              <p className="dm-diary-learned"><strong>Learned:</strong> {entry.learned}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
