// Hunter picker menu — the "Dark Matter" brand picker in the top bar,
// extracted from TopBar.jsx (P6). Owns its open state and outside-click
// close; the choice itself lives in App.jsx (single source of truth,
// persisted per device in localStorage 'dm.hunter').
import React, { useEffect, useRef, useState } from 'react';

export default function TopBarHunterMenu({ hunter = 'scanner', onPickHunter }) {
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef(null);
  // Hunter picker (3 Nov 2026, owner order): "Dark Matter" opens two
  // hunters — Infinity AI and Infinity Autonomous. This component only
  // renders the picker UI.
  const activeHunter = hunter === 'ai' ? 'ai' : 'scanner';
  function pickHunter(h) {
    if (typeof onPickHunter === 'function') onPickHunter(h);
    setModelOpen(false);
  }

  useEffect(() => {
    if (!modelOpen) return;
    function onDocClick(e) {
      if (modelRef.current && !modelRef.current.contains(e.target)) setModelOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [modelOpen]);

  return (
    <div ref={modelRef} style={{ position: 'relative' }}>
      <button
        className="brand-picker"
        onClick={() => setModelOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={modelOpen}
      >
        <img src="/dark-matter-symbol.png" alt="" className="brand-picker-symbol" aria-hidden="true" />
        Dark Matter
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            opacity: 0.55,
            border: '1px solid currentColor',
            borderRadius: 999,
            padding: '1px 7px',
            marginLeft: 2,
            whiteSpace: 'nowrap',
          }}
          title={activeHunter === 'scanner' ? 'Infinity Autonomous — rule-based scan, no AI, $0' : 'Infinity AI — AI agent hunts autonomously'}
        >
          {activeHunter === 'scanner' ? 'Autonomous' : 'AI'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {modelOpen && (
        <div className="model-menu" role="menu">
          <button
            className="model-option"
            role="menuitemradio"
            aria-checked={activeHunter === 'ai'}
            onClick={() => pickHunter('ai')}
          >
            <div>
              <div className="model-option-name">Infinity AI</div>
              <div className="model-option-sub">AI agent hunts like a human expert</div>
            </div>
            {activeHunter === 'ai' && (
              <svg className="model-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <button
            className="model-option"
            role="menuitemradio"
            aria-checked={activeHunter === 'scanner'}
            onClick={() => pickHunter('scanner')}
          >
            <div>
              <div className="model-option-name">Infinity Autonomous</div>
              <div className="model-option-sub">Rule-based scan, no AI, $0 — results in minutes</div>
            </div>
            {activeHunter === 'scanner' && (
              <svg className="model-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
