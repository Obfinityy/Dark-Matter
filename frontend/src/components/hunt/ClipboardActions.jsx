/**
 * ClipboardActions.jsx — wave 22 (ideas 50841–50880): copy-everywhere suite.
 *
 * Real, working clipboard components: a copy-state-machine hook with a
 * rate guard and clipboard-blocked fallback, the morphing CopyButton with
 * line-count toasts and accessible labels, a long-press copy-format
 * chooser, a clipboard history panel (last 20, re-copy), terminal copy
 * with timestamp toggle, masked-token copy with a 30s reveal window,
 * multi-block selection copy, and encoded-payload variants.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCopyState,
  copyStart,
  copyResolve,
  copyReset,
  lineCountToast,
  copyAriaLabel,
  copyRateGuard,
  historyPush,
  blockedFallbackState,
  formatCopyText,
  COPY_FORMATS,
  terminalCopyText,
  maskToken,
  isRevealWindowOpen,
  TOKEN_REVEAL_WINDOW_MS,
  encodePayload,
  PAYLOAD_VARIANTS,
  multiBlockCombine,
  prefersShareSheet,
  createAutoCopyState,
  toggleAutoCopy,
} from './clipboardCore.js';
import './Clipboard.css';

const LS_HISTORY = 'infinite.clipboard.history.v1';

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(h) {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(0, 20)));
  } catch {
    /* private mode */
  }
}

/* ------------------------------------------------------------------ */
/* Low-level copy with legacy fallback                                */
/* ------------------------------------------------------------------ */

async function writeToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(String(text));
      return { ok: true, blocked: false };
    } catch (err) {
      // Permission denied / blocked iframe → fallback modal.
      return { ok: false, blocked: /denied|not allowed/i.test(String(err && err.message)) };
    }
  }
  // Legacy fallback for non-secure contexts.
  try {
    const ta = document.createElement('textarea');
    ta.value = String(text);
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return { ok: !!ok, blocked: !ok };
  } catch {
    return { ok: false, blocked: true };
  }
}

/* ------------------------------------------------------------------ */
/* useCopy — the wave-22 copy hook (ideas 50841, 50869, 50879)        */
/* ------------------------------------------------------------------ */

const rateStamps = [];

export function useCopy({ toastMs = 1600 } = {}) {
  const [state, setState] = useState(createCopyState);
  const [toast, setToast] = useState('');
  const [blockedText, setBlockedText] = useState(null);
  const timer = useRef(null);

  const copy = useCallback(
    async (text, { label } = {}) => {
      const guard = copyRateGuard(rateStamps);
      if (!guard.allowed) {
        setToast(guard.note);
        return { ok: false, rateLimited: true };
      }
      setState(s => copyStart(s));
      const res = await writeToClipboard(text);
      rateStamps.push(Date.now());
      if (res.ok) {
        setState(s => copyResolve(s, true));
        setToast(`${lineCountToast(text)}${label ? ` — ${label}` : ''}`);
        // Record in history (idea 50859).
        saveHistory(historyPush(loadHistory(), { text, label }));
      } else if (res.blocked) {
        setState(s => copyResolve(s, false));
        setBlockedText(blockedFallbackState(text).text);
      } else {
        setState(s => copyResolve(s, false));
        setToast('Copy failed');
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setState(s => copyReset(s));
        setToast('');
      }, toastMs);
      return res;
    },
    [toastMs]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { state, toast, blockedText, dismissBlocked: () => setBlockedText(null), copy };
}

/* ------------------------------------------------------------------ */
/* CopyButton — morphs to a checkmark on success (ideas 50841, 50871)  */
/* ------------------------------------------------------------------ */

export function CopyButton({
  text,
  action = 'content',
  variant = 'ghost',
  className = '',
  onCopied,
}) {
  const { state, toast, blockedText, dismissBlocked, copy } = useCopy();
  const busy = state.status === 'copying';
  const done = state.status === 'success';

  return (
    <span className={`cb-wrap ${className}`}>
      <button
        type="button"
        className={`cb-btn cb-${variant}${done ? ' cb-done' : ''}`}
        aria-label={copyAriaLabel(action)}
        disabled={busy}
        onClick={async () => {
          const res = await copy(text, { label: action });
          if (res.ok && onCopied) onCopied(text);
        }}
      >
        {done ? (
          <svg className="cb-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.5 11.2 3 7.7l1.4-1.4 2.1 2.1 5.1-5.1L13 4.7z" fill="currentColor" />
          </svg>
        ) : (
          <svg className="cb-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M5 2h7v2H7v9H5z M9 4h4v10H9z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        )}
        <span className="cb-label">{done ? 'Copied' : 'Copy'}</span>
      </button>
      {toast && (
        <span className="cb-toast" role="status">
          {toast}
        </span>
      )}
      {blockedText !== null && (
        <ClipboardBlockedModal text={blockedText} onClose={dismissBlocked} />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ClipboardBlockedModal (idea 50870)                                   */
/* ------------------------------------------------------------------ */

export function ClipboardBlockedModal({ text, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, []);
  return (
    <div className="cb-modal-backdrop" onClick={onClose}>
      <div
        className="cb-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Clipboard blocked — copy manually"
        onClick={e => e.stopPropagation()}
      >
        <p className="cb-modal-title">Clipboard blocked — copy manually</p>
        <textarea ref={ref} className="cb-modal-text" readOnly value={text} rows={8} />
        <div className="cb-modal-actions">
          <button type="button" className="cb-btn cb-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CopyFormatChooser — long-press for plain/rich/markdown (50860)       */
/* ------------------------------------------------------------------ */

export function CopyFormatChooser({ text, action = 'content' }) {
  const { state, toast, copy } = useCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef(null);

  const doCopy = format => {
    setMenuOpen(false);
    copy(formatCopyText(text, format), { label: `${action} (${format})` });
  };

  const onPointerDown = () => {
    pressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <span className="cb-wrap">
      <button
        type="button"
        className="cb-btn cb-ghost"
        aria-label={copyAriaLabel(action)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onPointerDown={onPointerDown}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onClick={() => doCopy('plain')}
        onContextMenu={e => {
          e.preventDefault();
          setMenuOpen(true);
        }}
      >
        Copy{state.status === 'success' ? ' ✓' : ''}
      </button>
      {menuOpen && (
        <span className="cb-menu" role="menu" aria-label="Copy format">
          {COPY_FORMATS.map(f => (
            <button
              key={f}
              type="button"
              role="menuitem"
              className="cb-menu-item"
              onClick={() => doCopy(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </span>
      )}
      {toast && (
        <span className="cb-toast" role="status">
          {toast}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ClipboardHistoryPanel — last 20 copies with re-copy (idea 50859)     */
/* ------------------------------------------------------------------ */

export function ClipboardHistoryPanel() {
  const [history, setHistory] = useState(loadHistory);
  const { copy, toast } = useCopy();

  const refresh = () => setHistory(loadHistory());
  useEffect(() => {
    const onStorage = e => {
      if (e.key === LS_HISTORY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const clear = () => {
    saveHistory([]);
    setHistory([]);
  };

  if (history.length === 0) {
    return <p className="cb-empty">No copies yet — everything you copy appears here.</p>;
  }
  return (
    <div className="cb-history">
      <div className="cb-history-head">
        <strong>Clipboard history</strong>
        <button type="button" className="cb-btn cb-ghost cb-sm" onClick={clear}>
          Clear
        </button>
      </div>
      <ul className="cb-history-list">
        {history.map((h, i) => (
          <li key={`${h.at}-${i}`} className="cb-history-item">
            <span className="cb-history-label">{h.label || 'copy'}</span>
            <code className="cb-history-text">
              {String(h.text).slice(0, 80)}
              {String(h.text).length > 80 ? '…' : ''}
            </code>
            <button
              type="button"
              className="cb-btn cb-ghost cb-sm"
              aria-label={`Re-copy ${h.label || 'entry'}`}
              onClick={() => copy(h.text, { label: `re-copy ${h.label || ''}`.trim() })}
            >
              Re-copy
            </button>
          </li>
        ))}
      </ul>
      {toast && (
        <span className="cb-toast" role="status">
          {toast}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TerminalCopy — copy with/without timestamps (idea 50846)             */
/* ------------------------------------------------------------------ */

export function TerminalCopy({ logText }) {
  const [withTimestamps, setWithTimestamps] = useState(true);
  const preview = useMemo(
    () => terminalCopyText(logText, withTimestamps),
    [logText, withTimestamps]
  );
  return (
    <div className="cb-terminal">
      <label className="cb-toggle">
        <input
          type="checkbox"
          checked={withTimestamps}
          onChange={e => setWithTimestamps(e.target.checked)}
        />
        Include timestamps
      </label>
      <pre className="cb-pre">{String(preview).slice(0, 400)}</pre>
      <CopyButton text={preview} action="terminal output" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MaskedTokenCopy — 30s reveal window (idea 50850)                     */
/* ------------------------------------------------------------------ */

export function MaskedTokenCopy({ token }) {
  const [revealedAt, setRevealedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const open = isRevealWindowOpen(revealedAt, now);

  useEffect(() => {
    if (!revealedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [revealedAt]);

  return (
    <div className="cb-token">
      <code className="cb-token-text">{open ? token : maskToken(token)}</code>
      {!open && (
        <button
          type="button"
          className="cb-btn cb-ghost cb-sm"
          onClick={() => {
            setRevealedAt(Date.now());
            setNow(Date.now());
          }}
        >
          Reveal for 30s
        </button>
      )}
      {open && <CopyButton text={token} action="API token" />}
      {open && (
        <span className="cb-note" role="timer">
          Revealed — window closes in{' '}
          {Math.max(0, Math.ceil((TOKEN_REVEAL_WINDOW_MS - (now - revealedAt)) / 1000))}s
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MultiBlockCopy — checkboxes combine selections (idea 50877)          */
/* ------------------------------------------------------------------ */

export function MultiBlockCopy({ blocks }) {
  const [selected, setSelected] = useState(() =>
    Object.fromEntries((blocks || []).map((b, i) => [i, false]))
  );
  const chosen = (blocks || []).filter((_, i) => selected[i]);
  const combined = multiBlockCombine(
    (blocks || []).map((b, i) => ({ ...b, selected: !!selected[i] }))
  );

  return (
    <div className="cb-multiblock">
      {(blocks || []).map((b, i) => (
        <label key={i} className="cb-block">
          <input
            type="checkbox"
            checked={!!selected[i]}
            onChange={e => setSelected(s => ({ ...s, [i]: e.target.checked }))}
          />
          <span className="cb-block-title">{b.title || `Block ${i + 1}`}</span>
        </label>
      ))}
      {chosen.length > 0 && (
        <div className="cb-multiblock-actions">
          <span className="cb-note">
            {chosen.length} block{chosen.length === 1 ? '' : 's'} selected
          </span>
          <CopyButton text={combined} action={`${chosen.length} evidence blocks`} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PayloadVariantCopy — base64 / URL-encoded / raw (idea 50872)         */
/* ------------------------------------------------------------------ */

export function PayloadVariantCopy({ payload }) {
  const [variant, setVariant] = useState('base64');
  const encoded = useMemo(
    () => (variant === 'raw' ? String(payload || '') : encodePayload(payload, variant)),
    [payload, variant]
  );
  return (
    <div className="cb-payload">
      <div className="cb-segment" role="group" aria-label="Payload encoding">
        {PAYLOAD_VARIANTS.map(v => (
          <button
            key={v}
            type="button"
            className={`cb-btn cb-sm${variant === v ? ' cb-active' : ' cb-ghost'}`}
            aria-pressed={variant === v}
            onClick={() => setVariant(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <pre className="cb-pre">{encoded.slice(0, 300)}</pre>
      <CopyButton text={encoded} action={`payload (${variant})`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AutoCopyToggle (idea 50868)                                          */
/* ------------------------------------------------------------------ */

export function AutoCopyToggle({ onToggle }) {
  const [st, setSt] = useState(() => createAutoCopyState(false));
  return (
    <label className="cb-toggle">
      <input
        type="checkbox"
        checked={st.enabled}
        onChange={() => {
          const next = toggleAutoCopy(st);
          setSt(next);
          if (onToggle) onToggle(next.enabled);
        }}
      />
      Auto-copy selected evidence text
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                            */
/* ------------------------------------------------------------------ */

const SAMPLE_LOG = '[2026-10-07 18:00:01] hunt started\n[2026-10-07 18:00:02] found SQLi on /login';
const SAMPLE_BLOCKS = [
  { title: 'Request', text: 'GET /login?id=1 HTTP/1.1' },
  { title: 'Response', text: 'HTTP/1.1 500 Internal Server Error' },
  { title: 'Evidence', text: "SQL syntax error near '1'" },
];

export function ClipboardGallery() {
  return (
    <section className="cb-gallery" aria-label="Clipboard components gallery">
      <h2>Clipboard suite</h2>
      <div className="cb-demo">
        <h3>Copy button</h3>
        <CopyButton text={'example.com/login?id=1'} action="target URL" />
      </div>
      <div className="cb-demo">
        <h3>Format chooser (long-press)</h3>
        <CopyFormatChooser text={'**SQLi** on `/login`'} action="finding" />
      </div>
      <div className="cb-demo">
        <h3>Terminal copy</h3>
        <TerminalCopy logText={SAMPLE_LOG} />
      </div>
      <div className="cb-demo">
        <h3>Masked token</h3>
        <MaskedTokenCopy token="sk-live-9f8e7d6c5b4a3210" />
      </div>
      <div className="cb-demo">
        <h3>Multi-block copy</h3>
        <MultiBlockCopy blocks={SAMPLE_BLOCKS} />
      </div>
      <div className="cb-demo">
        <h3>Payload variants</h3>
        <PayloadVariantCopy payload={"' OR '1'='1"} />
      </div>
      <div className="cb-demo">
        <h3>Auto-copy</h3>
        <AutoCopyToggle />
      </div>
      <div className="cb-demo">
        <h3>History</h3>
        <ClipboardHistoryPanel />
      </div>
    </section>
  );
}
