/**
 * HelpPanel.jsx — Forge wave 11, ideas 50405 + 50437.
 *
 * 50405 — per-page help panel: a slide-over panel offering contextual docs
 * links for every page (content model lives in microcopyCore.HELP_DOCS).
 * 50437 — helpful-vote thumbs: every help article asks "did this help?",
 * votes persist to localStorage and feed documentation improvement
 * (vote store logic is microcopyCore.recordHelpVote / voteRatio).
 *
 * Shared mc-* styling lives in TooltipHelp.css (also used by
 * MicrocopyTooltips.jsx) — HelpPanel-specific polish is in HelpPanel.css.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { helpDocsFor, recordHelpVote, voteRatio } from './microcopyCore.js';
import './TooltipHelp.css';
import './HelpPanel.css';

const VOTE_KEY = 'dm_help_votes_v1';

function loadVotes() {
  try {
    return JSON.parse(localStorage.getItem(VOTE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveVotes(store) {
  try {
    localStorage.setItem(VOTE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable — votes stay in memory for this session */
  }
}

/* 50437 — helpful-vote thumbs ------------------------------------------------- */

export function HelpfulVote({ docId }) {
  const [store, setStore] = useState(loadVotes);
  const [voted, setVoted] = useState(null);
  const votes = store[docId];
  const ratio = voteRatio(votes);

  const cast = helpful => {
    const next = recordHelpVote(store, docId, helpful);
    setStore(next);
    saveVotes(next);
    setVoted(helpful ? 'yes' : 'no');
  };

  return (
    <div className="mc-vote">
      <span className="mc-vote-q">Did this help?</span>
      <button
        type="button"
        className={`mc-vote-btn ${voted === 'yes' ? 'mc-vote-yes' : ''}`}
        onClick={() => cast(true)}
        aria-pressed={voted === 'yes'}
        aria-label="Yes, this helped"
      >
        👍
      </button>
      <button
        type="button"
        className={`mc-vote-btn ${voted === 'no' ? 'mc-vote-no' : ''}`}
        onClick={() => cast(false)}
        aria-pressed={voted === 'no'}
        aria-label="No, this did not help"
      >
        👎
      </button>
      {ratio !== null && <span className="mc-vote-ratio">{ratio}% found this helpful</span>}
    </div>
  );
}

/* 50405 — per-page help panel --------------------------------------------------- */

export function HelpPanel({ page = 'hunt', open: controlledOpen, onClose }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const closeBtnRef = useRef(null);
  const openerRef = useRef(null);

  const close = useCallback(() => {
    if (onClose) onClose();
    else setInternalOpen(false);
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    // Lock background scroll while the panel is open; restore on cleanup.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the panel so keyboard users land on the close action.
    if (closeBtnRef.current) closeBtnRef.current.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (openerRef.current) openerRef.current.focus();
    };
  }, [open, close]);

  const docs = helpDocsFor(page);

  return (
    <>
      {controlledOpen === undefined && (
        <button
          ref={openerRef}
          type="button"
          className="mc-btn mc-help-fab"
          onClick={() => setInternalOpen(true)}
          aria-label="Open help"
          aria-haspopup="dialog"
        >
          ? Help
        </button>
      )}
      {open && (
        <div className="mc-help-overlay" onClick={close}>
          <aside
            className="mc-help-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Help for ${page}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="mc-help-head">
              <strong>Help — {page}</strong>
              <button
                ref={closeBtnRef}
                type="button"
                className="mc-pop-x"
                onClick={close}
                aria-label="Close help"
              >
                ×
              </button>
            </div>
            {docs.length === 0 ? (
              <p className="mc-hint">No help articles for this page yet.</p>
            ) : (
              <ul className="mc-help-list">
                {docs.map(d => (
                  <li key={d.id} className="mc-help-item">
                    <a href={d.url} className="mc-help-link">
                      {d.title}
                    </a>
                    <HelpfulVote docId={d.id} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mc-hint">
              Votes feed documentation improvements — the least-helpful articles get rewritten
              first.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
