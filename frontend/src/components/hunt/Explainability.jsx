/**
 * Explainability.jsx — wave 35, part 2 (ideas 51397–51400): finding
 * explainability suite.
 * Real working components driving local state — no mocks, no demo-only
 * controls. All explanation text comes from explainabilityCore.js.
 */
import React, { useState } from 'react';
import {
  WAVE35B_IDEAS,
  explainFinding,
  executiveSummary,
  findingAnalogy,
  explainFindingAll,
} from './explainabilityCore.js';

const SAMPLE_FINDINGS = [
  {
    id: 'F-101',
    type: 'sql-injection',
    severity: 'critical',
    title: 'SQL injection in search endpoint',
    location: '/api/search?q=',
  },
  {
    id: 'F-102',
    type: 'xss',
    severity: 'high',
    title: 'Stored XSS in comment field',
    location: '/profile/comments',
  },
  {
    id: 'F-103',
    type: 'idor',
    severity: 'high',
    title: 'IDOR on order endpoint',
    location: '/api/orders/{id}',
  },
  {
    id: 'F-104',
    type: 'jwt-none-alg',
    severity: 'critical',
    title: 'JWT accepts none algorithm',
    location: 'Authorization header',
  },
];

function ideaNo(n) {
  const row = WAVE35B_IDEAS.find(([id]) => id === n);
  return row ? `#${row[0]}` : '';
}

function Card({ idea, title, children }) {
  return (
    <section className="ex35-card" aria-label={title}>
      <header className="ex35-card-head">
        <h3 className="ex35-card-title">{title}</h3>
        <span className="ex35-idea">{ideaNo(idea)}</span>
      </header>
      <div className="ex35-card-body">{children}</div>
    </section>
  );
}

function FindingPicker({ value, onChange }) {
  return (
    <select
      className="ex35-input"
      value={value.id}
      onChange={e => onChange(SAMPLE_FINDINGS.find(f => f.id === e.target.value))}
      aria-label="Finding"
    >
      {SAMPLE_FINDINGS.map(f => (
        <option key={f.id} value={f.id}>
          {f.id} — {f.title}
        </option>
      ))}
    </select>
  );
}

// --- 51397 explain-this-finding button -------------------------------------------------------
export function ExplainFindingButton() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[0]);
  const [shown, setShown] = useState(false);
  return (
    <Card idea={51397} title="Explain-this-finding button">
      <div className="ex35-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setShown(false);
          }}
        />
        <button className="ex35-btn" onClick={() => setShown(true)}>
          Explain this finding
        </button>
      </div>
      {shown && <p className="ex35-text">{explainFinding(finding)}</p>}
    </Card>
  );
}

// --- 51398 ELI5 mode --------------------------------------------------------------------------
export function Eli5Toggle() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  const [eli5, setEli5] = useState(false);
  const all = explainFindingAll(finding);
  return (
    <Card idea={51398} title="ELI5 mode">
      <div className="ex35-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <button className="ex35-btn" onClick={() => setEli5(!eli5)} aria-pressed={eli5}>
          {eli5 ? 'Show standard explanation' : "Explain like I'm five"}
        </button>
      </div>
      <p className="ex35-text">{eli5 ? all.eli5 : all.plain}</p>
    </Card>
  );
}

// --- 51399 executive summary toggle ----------------------------------------------------------------
export function ExecutiveSummaryToggle() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[2]);
  const [exec, setExec] = useState(false);
  return (
    <Card idea={51399} title="Executive summary toggle">
      <div className="ex35-row">
        <FindingPicker value={finding} onChange={setFinding} />
        <button className="ex35-btn" onClick={() => setExec(!exec)} aria-pressed={exec}>
          {exec ? 'Hide executive summary' : 'Show executive summary'}
        </button>
      </div>
      {exec && <p className="ex35-text ex35-exec">{executiveSummary(finding)}</p>}
    </Card>
  );
}

// --- 51400 analogy generator ---------------------------------------------------------------------------
export function AnalogyCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[3]);
  const [n, setN] = useState(0);
  return (
    <Card idea={51400} title="Analogy generator">
      <div className="ex35-row">
        <FindingPicker
          value={finding}
          onChange={f => {
            setFinding(f);
            setN(0);
          }}
        />
        <button className="ex35-btn" onClick={() => setN(n + 1)}>
          New analogy
        </button>
      </div>
      <p className="ex35-text ex35-analogy" key={n}>
        {findingAnalogy(finding)}
      </p>
    </Card>
  );
}

// --- gallery ---------------------------------------------------------------------------------------------------------------------------------
const ALL = [
  [ExplainFindingButton, 51397],
  [Eli5Toggle, 51398],
  [ExecutiveSummaryToggle, 51399],
  [AnalogyCard, 51400],
];

export function ExplainabilityGallery() {
  return (
    <div className="ex35-gallery" aria-label="Explainability gallery">
      {ALL.map(([C, id]) => (
        <C key={id} />
      ))}
    </div>
  );
}
