/**
 * FPImpact.jsx — Infinity AI · Dark-Matter · Wave 54
 * 2 working React components for FP impact tooling, ideas 52121–52122.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './fpImpactCore.js';

const SAMPLE_OPEN = [
  { id: 'f-1', title: 'XSS on /search', severity: 'high', vulnClass: 'xss', target: 'shop' },
  { id: 'f-2', title: 'XSS on /profile', severity: 'medium', vulnClass: 'xss', target: 'shop' },
  { id: 'f-3', title: 'SQLi on /login', severity: 'critical', vulnClass: 'sqli', target: 'shop' },
  { id: 'f-4', title: 'Open redirect', severity: 'low', vulnClass: 'redirect', target: 'blog' },
];

const SAMPLE_MARKINGS = [
  {
    findingId: 'f-1',
    title: 'XSS on /search',
    markedBy: 'ria',
    markedAt: 1700000000000,
    reasonId: 'expected-behavior',
    justification: 'search box HTML-encodes output; verified by retest',
    evidence: [
      {
        kind: 'http',
        label: 'retest response',
        body: '200 OK — payload encoded as &lt;script&gt;',
      },
      { kind: 'note', label: 'reviewer note', body: 'confirmed on staging and production' },
    ],
  },
  { findingId: 'f-9', reasonId: 'not-reproducible', evidence: [] },
];

/* 52121 — FP rules impact simulator. */
export function FpImpactSimulator() {
  const [sim, setSim] = useState(null);
  const rule = {
    id: 'rule-52121',
    name: 'Dismiss all XSS on shop',
    matcher: { vulnClass: 'xss', target: 'shop' },
  };
  return (
    <div className="fpi54-card">
      <h3 className="fpi54-title">52121 · FP rules impact simulator</h3>
      <p className="fpi54-note">rule: {rule.name}</p>
      <button
        className="fpi54-btn"
        onClick={() => setSim(C.simulateFpRuleImpact(rule, SAMPLE_OPEN, 1700000000000))}
      >
        Preview impact
      </button>
      {sim && (
        <div className="fpi54-result">
          <p className="fpi54-note">
            {sim.affectedCount} of {sim.openCount} open findings affected ({sim.affectedPct}%)
          </p>
          <p className="fpi54-note">
            by class:{' '}
            {Object.entries(sim.byClass)
              .map(([k, v]) => `${k}:${v}`)
              .join(' ')}
          </p>
          <p className="fpi54-note">
            by severity:{' '}
            {Object.entries(sim.bySeverity)
              .map(([k, v]) => `${k}:${v}`)
              .join(' ')}
          </p>
          {sim.warning && <p className="fpi54-warning">{sim.warning}</p>}
        </div>
      )}
    </div>
  );
}

/* 52122 — FP decision export with evidence. */
export function FpDecisionExport() {
  const [exp, setExp] = useState(null);
  return (
    <div className="fpi54-card">
      <h3 className="fpi54-title">52122 · FP decision export with evidence</h3>
      <button
        className="fpi54-btn"
        onClick={() => setExp(C.exportFpBundle(SAMPLE_MARKINGS, 1700000000000))}
      >
        Export bundle
      </button>
      {exp && (
        <div className="fpi54-result">
          <p className="fpi54-note">{exp.summary}</p>
          {exp.bundles.map(b => (
            <p key={b.decision.findingId} className="fpi54-note">
              {b.decision.findingId}: {b.evidenceCount} evidence items · {b.decision.reasonId}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function FPImpactGallery() {
  return (
    <div className="fpi54-gallery">
      <FpImpactSimulator />
      <FpDecisionExport />
    </div>
  );
}
