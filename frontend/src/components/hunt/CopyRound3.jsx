/**
 * CopyRound3.jsx — wave 23 (ideas 50881–50884): copy round 3 components.
 *
 * Reuses wave-22's `useCopy` hook. Pure logic lives in copyRound3Core.js.
 */
import { useState } from 'react';
import { useCopy } from './ClipboardActions.jsx';
import {
  versionInfoString,
  filtersToApiQuery,
  canCopyImageBytes,
  validateImageCopyBlob,
  imageCopyPayload,
  isSecretField,
  secretCopyGate,
  SECRET_REVEAL_WINDOW_MS,
} from './copyRound3Core.js';

/* 50881 — Copy version info --------------------------------------------- */

export function VersionCopyButton({ version = '2.4.1', build = '8812' }) {
  const { copy, status } = useCopy();
  const text = versionInfoString({ version, build }) || 'Dark-Matter';
  return (
    <button
      type="button"
      className="cr3-btn pr-no-print"
      data-idea="50881"
      onClick={() => copy(text)}
      aria-label={`Copy version info: ${text}`}
    >
      {status === 'copied' ? 'Copied ✓' : 'Copy version info'}
      <span className="cr3-sub">{text}</span>
    </button>
  );
}

/* 50882 — Copy as API query --------------------------------------------- */

export function ApiQueryCopyButton({ filters = {} }) {
  const { copy, status } = useCopy();
  const query = filtersToApiQuery(filters);
  return (
    <button
      type="button"
      className="cr3-btn pr-no-print"
      data-idea="50882"
      disabled={!query}
      onClick={() => query && copy(query)}
      aria-label="Copy filters as API query params"
      title={query || 'No active filters'}
    >
      {status === 'copied' ? 'Copied ✓' : 'Copy as API query'}
      {query ? <code className="cr3-sub">{query}</code> : null}
    </button>
  );
}

/* 50883 — Copy image bytes ---------------------------------------------- */

export function ImageBytesCopyButton({ blob, label = 'Copy image bytes' }) {
  const [status, setStatus] = useState('idle');
  const supported = typeof window !== 'undefined'
    ? canCopyImageBytes({ navigator: window.navigator, ClipboardItem: window.ClipboardItem })
    : false;
  const validation = validateImageCopyBlob(blob);

  const onCopy = async () => {
    const payload = imageCopyPayload(blob);
    if (!payload.ok || !supported) {
      setStatus('unsupported');
      return;
    }
    try {
      setStatus('copying');
      await window.navigator.clipboard.write([new window.ClipboardItem(payload.payload)]);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    setTimeout(() => setStatus('idle'), 1600);
  };

  if (!supported) {
    return (
      <p className="cr3-note" data-idea="50883">
        Image-bytes copy isn't supported in this browser — use download instead.
      </p>
    );
  }
  return (
    <button
      type="button"
      className="cr3-btn pr-no-print"
      data-idea="50883"
      disabled={!validation.ok || status === 'copying'}
      onClick={onCopy}
      aria-label={label}
    >
      {status === 'copied' ? 'Image copied ✓' : status === 'failed' ? 'Copy failed' : label}
      {!validation.ok && validation.reason ? (
        <span className="cr3-sub">({validation.reason})</span>
      ) : null}
    </button>
  );
}

/* 50884 — No copy on secrets -------------------------------------------- */

export function SecretCopyGuard({ fieldName = 'api_key', value = '' }) {
  const { copy, status } = useCopy();
  const [revealedAt, setRevealedAt] = useState(null);
  const secret = isSecretField(fieldName);
  const gate = secretCopyGate({ fieldName, revealedAt, now: Date.now() });
  const revealed = gate.allowed && gate.reason === 'revealed';

  return (
    <div className="cr3-secret" data-idea="50884">
      <div className="cr3-secret-row">
        <span className="cr3-secret-name">{fieldName}</span>
        <span className="cr3-secret-value" aria-live="polite">
          {revealed ? value : '••••••••••'}
        </span>
      </div>
      <div className="cr3-secret-actions pr-no-print">
        {!revealed ? (
          <button
            type="button"
            className="cr3-btn cr3-btn-small"
            onClick={() => setRevealedAt(Date.now())}
          >
            Reveal to copy
          </button>
        ) : (
          <>
            <span className="cr3-note">
              Reveal window: {Math.round(SECRET_REVEAL_WINDOW_MS / 1000)}s
            </span>
            <button
              type="button"
              className="cr3-btn cr3-btn-small"
              onClick={() => copy(String(value))}
            >
              {status === 'copied' ? 'Copied ✓' : 'Copy secret'}
            </button>
            <button
              type="button"
              className="cr3-btn cr3-btn-small"
              onClick={() => setRevealedAt(null)}
            >
              Hide
            </button>
          </>
        )}
      </div>
      {!secret ? (
        <p className="cr3-note">Field doesn't look secret — normal copy applies.</p>
      ) : null}
    </div>
  );
}

/* Gallery ---------------------------------------------------------------- */

const DEMO_FINDINGS = [
  { title: 'Reflected XSS in /search', type: 'XSS', tags: ['XSS', 'CWE-79'] },
  { title: 'SQLi in login form', type: 'SQLI', tags: ['SQLI', 'RCE'] },
];

export function CopyRound3Gallery() {
  const [blob] = useState(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  });
  const [resolvedBlob, setResolvedBlob] = useState(null);
  if (blob && typeof blob.then === 'function') {
    blob.then(setResolvedBlob).catch(() => setResolvedBlob(null));
  }
  return (
    <section className="cr3-gallery" aria-label="Copy round 3 demos">
      <h3>Copy round 3 (50881–50884)</h3>
      <div className="cr3-grid">
        <div className="cr3-demo" data-idea="50881">
          <h4>50881 · Version info</h4>
          <VersionCopyButton version="2.4.1" build="8812" />
        </div>
        <div className="cr3-demo" data-idea="50882">
          <h4>50882 · Filters as API query</h4>
          <ApiQueryCopyButton filters={{ severity: ['high', 'critical'], status: 'open', q: 'xss', sort: 'severity' }} />
        </div>
        <div className="cr3-demo" data-idea="50883">
          <h4>50883 · Image bytes</h4>
          <ImageBytesCopyButton blob={resolvedBlob} />
        </div>
        <div className="cr3-demo" data-idea="50884">
          <h4>50884 · Secret copy gate</h4>
          <SecretCopyGuard fieldName="api_key" value="dm_live_9f2KqZ…" />
        </div>
      </div>
      <p className="cr3-note">Demo findings for glossary context: {DEMO_FINDINGS.map((f) => f.title).join(' · ')}</p>
    </section>
  );
}

export { DEMO_FINDINGS };
