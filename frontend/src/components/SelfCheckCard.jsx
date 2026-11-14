// SelfCheckCard — one Go.xlsx check: URL input + Run, short filtered
// result, Yes/No checklist tick with evidence. No raw dumps: the result
// shown here is the `shortResult` shape (counts + top findings +
// evidence lines, capped). The URL input defaults to the run's target;
// running a different URL starts a fresh run for that URL (the parent
// owns that decision — this card only reports the URL it was given).
import React, { useState } from 'react';
import { checkVerdict, shortResult } from '../lib/selfApi';

const VERDICT_LABEL = {
  yes: 'Yes',
  no: 'No',
  running: 'Running…',
  pending: 'Pending',
  skipped: 'Skipped',
  blocked: 'Blocked',
  failed: 'Failed',
};

export default function SelfCheckCard({ check, result, target, busy, disabled, onRun }) {
  const [url, setUrl] = useState(target || '');
  // Keep the input in step when the run target changes (new run created).
  const [lastTarget, setLastTarget] = useState(target || '');
  if (target !== lastTarget) {
    setLastTarget(target || '');
    setUrl(target || '');
  }
  const verdict = checkVerdict(result);
  const short = shortResult(result);
  const counts = short.counts;
  const countsLine = counts
    ? Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')
    : null;

  return (
    <div className="self-check-card" data-check-id={check.id}>
      <div className="self-check-head">
        <div className="self-check-title">
          <span className="self-check-id">{check.id}</span>
          <span className="self-check-name">{check.name}</span>
        </div>
        <div className="self-check-badges">
          {check.kind === 'ai' && <span className="self-badge self-badge-ai" title="Needs the AI step — runs only after you approve it">AI</span>}
          {verdict && <span className={`self-badge self-verdict-${verdict}`}>{VERDICT_LABEL[verdict] || verdict}</span>}
        </div>
      </div>
      {check.description && <div className="self-check-desc">{check.description}</div>}
      <div className="inline-row self-check-run-row">
        <input
          className="text-input"
          type="url"
          placeholder="https://target.example.com"
          aria-label={`Target URL for ${check.id}`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy || disabled}
        />
        <button
          className="btn btn-sm"
          onClick={() => onRun && onRun(check, url.trim())}
          disabled={busy || disabled || !url.trim()}
        >
          {busy ? 'Running…' : 'Run'}
        </button>
      </div>
      {result && (
        <div className="self-check-result">
          {countsLine && <div className="self-result-counts">{countsLine}</div>}
          {short.topFindings.length > 0 && (
            <ul className="self-result-list">
              {short.topFindings.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
          {short.topFindings.length === 0 && result.summary && (
            <div className="self-result-summary">{result.summary}</div>
          )}
          {short.evidence.length > 0 && (
            <div className="self-result-evidence">
              {short.evidence.map((line, i) => <div key={i} className="self-evidence-line">{line}</div>)}
            </div>
          )}
          {short.error && <div className="self-result-error">{short.error}</div>}
          {short.topFindings.length === 0 && !result.summary && !short.error && (
            <div className="empty-hint">No findings — nothing to show for this check yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
