// History item — one chat row in the sidebar history list, extracted
// from Sidebar.jsx (P6). Owns its own options menu (rename / delete) and
// rename input; the hunter badge is labelled by the SAME resolved mode
// the sidebar hunter filter uses, so badge and filter can never disagree.
import React, { useEffect, useRef, useState } from 'react';

export default function HistoryItem({ chat, active, running, onSelect, onRename, onDelete, hunterMode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(chat.title || 'Untitled chat');
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  function commitRename() {
    const t = draft.trim();
    setRenaming(false);
    if (t && t !== chat.title) onRename(chat.id, t);
    else setDraft(chat.title || 'Untitled chat');
  }

  // Hunter badge (owner orders 3 Nov 2026 + 4 Nov 2026): labelled by the
  // SAME resolved mode the sidebar hunter filter uses, so the badge and
  // the filter can never disagree. Hunts created before brainMode was
  // recorded count as AI.
  const hunterBadge =
    hunterMode === 'scanner'
      ? { label: 'Autonomous', title: 'Infinity Autonomous hunt — rule-based scan, no AI' }
      : hunterMode === 'ai'
        ? { label: 'AI', title: 'Infinity AI hunt — AI agent' }
        : null;

  return (
    <div
      className={`history-item${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect();
      }}
    >
      {renaming ? (
        <input
          ref={inputRef}
          className="history-rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setRenaming(false);
              setDraft(chat.title || 'Untitled chat');
            }
          }}
          onBlur={commitRename}
        />
      ) : (
        <>
          {running && <span className="running-dot" aria-label="Running" title="Running" />}
          {hunterBadge && (
            <span
              title={hunterBadge.title}
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                border: '1px solid currentColor',
                borderRadius: 999,
                padding: '1px 6px',
                marginRight: 6,
                opacity: 0.6,
                flexShrink: 0,
              }}
            >
              {hunterBadge.label}
            </span>
          )}
          <span className="history-title">{chat.title || 'Untitled chat'}</span>
        </>
      )}
      {!renaming && (
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            className="history-dots"
            title="Chat options"
            aria-label="Chat options"
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            •••
          </button>
          {menuOpen && (
            <div className="history-menu" role="menu">
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setDraft(chat.title || 'Untitled chat');
                  setRenaming(true);
                }}
              >
                Rename
              </button>
              <button
                role="menuitem"
                className="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(chat.id);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
