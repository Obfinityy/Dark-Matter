import React, { useMemo, useState } from 'react';
import {
  WAVE108_B_IDEAS,
  exploitabilityIndex,
  tagCrownJewel,
  untagCrownJewel,
  isCrownJewel,
  sortWithCrownJewels,
  applyComplianceBoost,
  factorDocLink,
  exportScoresCsv,
  buildSmartGroups,
  subscribeTopMovers,
  buildWeeklyMoversDigest,
  buildLeaderboard,
  correlationStats,
  patchCadenceScore,
  scoreBreakdown,
} from './wave108BCores.js';
import './Wave108B.css';

/**
 * Wave 108B — Risk scoring suite demo panel.
 * Infinity AI branding only. Demonstrates ideas 54291–54300.
 */

const DAYS = 86400000;
const NOW = Date.now();
const isoDaysAgo = (d) => new Date(NOW - d * DAYS).toISOString();

function makeTargets() {
  return [
    {
      id: 'acme-payments',
      name: 'Acme Payments API',
      score: 78,
      tags: [],
      frameworks: ['PCI-DSS'],
      likelihoodSignals: { attackSurface: 0.9, exposure: 0.85, vulnHistory: 0.7, techRisk: 0.6, exploitAvailability: 0.8 },
      impactSignals: { dataSensitivity: 0.95, revenueImpact: 0.9, userCount: 0.8, complianceWeight: 0.9, crownJewelWeight: 0.5 },
      deployHistory: [{ deployedAt: isoDaysAgo(2) }, { deployedAt: isoDaysAgo(9) }, { deployedAt: isoDaysAgo(16) }, { deployedAt: isoDaysAgo(23) }],
      findings: [{ id: 'f1', severity: 'high' }, { id: 'f2', severity: 'medium' }, { id: 'f3', severity: 'low' }],
    },
    {
      id: 'acme-web',
      name: 'Acme Web App',
      score: 64,
      tags: ['crown-jewel'],
      crownJewel: true,
      frameworks: ['SOC-2'],
      likelihoodSignals: { attackSurface: 0.8, exposure: 0.9, vulnHistory: 0.5, techRisk: 0.5, exploitAvailability: 0.6 },
      impactSignals: { dataSensitivity: 0.7, revenueImpact: 0.8, userCount: 0.9, complianceWeight: 0.6, crownJewelWeight: 1 },
      deployHistory: [{ deployedAt: isoDaysAgo(1) }, { deployedAt: isoDaysAgo(8) }, { deployedAt: isoDaysAgo(15) }],
      findings: [{ id: 'f4', severity: 'critical' }, { id: 'f5', severity: 'high' }],
    },
    {
      id: 'acme-docs',
      name: 'Acme Docs Site',
      score: 42,
      tags: [],
      frameworks: [],
      likelihoodSignals: { attackSurface: 0.6, exposure: 0.7, vulnHistory: 0.3, techRisk: 0.4, exploitAvailability: 0.4 },
      impactSignals: { dataSensitivity: 0.2, revenueImpact: 0.2, userCount: 0.5, complianceWeight: 0.1, crownJewelWeight: 0 },
      deployHistory: [{ deployedAt: isoDaysAgo(75) }, { deployedAt: isoDaysAgo(165) }],
      findings: [],
    },
    {
      id: 'acme-legacy',
      name: 'Acme Legacy Portal',
      score: 55,
      tags: [],
      frameworks: ['ISO-27001'],
      likelihoodSignals: { attackSurface: 0.5, exposure: 0.6, vulnHistory: 0.8, techRisk: 0.9, exploitAvailability: 0.7 },
      impactSignals: { dataSensitivity: 0.6, revenueImpact: 0.5, userCount: 0.3, complianceWeight: 0.8, crownJewelWeight: 0.2 },
      deployHistory: [{ deployedAt: isoDaysAgo(210) }, { deployedAt: isoDaysAgo(320) }],
      findings: [{ id: 'f6', severity: 'medium' }],
    },
  ];
}

const AUDIT_SCOPE = { framework: 'PCI-DSS', inScope: ['acme-payments'], note: 'Q4 certification audit' };
// Previous EFFECTIVE scores (what the leaderboard showed last review).
const PREV_WEEK = { 'acme-payments': 71, 'acme-web': 64, 'acme-docs': 48, 'acme-legacy': 55 };

export default function Wave108B() {
  const [targets, setTargets] = useState(makeTargets);
  const [digest, setDigest] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [email, setEmail] = useState('security-lead@acme.example');
  const [csvPreview, setCsvPreview] = useState(null);

  const leaderboard = useMemo(() => buildLeaderboard(targets, PREV_WEEK, { auditScope: AUDIT_SCOPE }), [targets]);
  const groups = useMemo(() => buildSmartGroups(targets, { auditScope: AUDIT_SCOPE }), [targets]);
  const corr = useMemo(() => correlationStats(targets, { auditScope: AUDIT_SCOPE }), [targets]);
  const pinned = useMemo(() => sortWithCrownJewels(targets, (t) => scoreBreakdown(t, { auditScope: AUDIT_SCOPE }).total), [targets]);

  const toggleJewel = (id) => {
    setTargets((ts) => ts.map((t) => (t.id === id ? (isCrownJewel(t) ? untagCrownJewel(t) : tagCrownJewel(t, { reason: 'demo' })) : t)));
  };

  const matrixPoints = useMemo(
    () => targets.map((t) => ({ target: t, point: exploitabilityIndex(t.likelihoodSignals, t.impactSignals) })),
    [targets]
  );

  const maxHitRate = Math.max(0.01, ...corr.buckets.map((b) => b.hitRate));

  return (
    <div className="wave108b">
      <header className="wave108b-head">
        <h2 className="wave108b-title">Risk Scoring Suite — Infinity AI</h2>
        <p className="wave108b-sub">Wave 108B · ideas 54291–54300 · target prioritization and scoring</p>
      </header>

      {/* 54291 Exploitability index: likelihood vs impact matrix */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[0].title}</h3>
        <p className="wave108b-muted">Likelihood (x) vs impact (y). Separates &quot;likely to have bugs&quot; from &quot;bugs likely to matter&quot;.</p>
        <svg className="wave108b-matrix" viewBox="0 0 320 320" role="img" aria-label="Exploitability matrix">
          {[80, 160, 240].map((g) => (
            <g key={g}>
              <line x1={g} y1={10} x2={g} y2={310} className="wave108b-grid" />
              <line x1={10} y1={g} x2={310} y2={g} className="wave108b-grid" />
            </g>
          ))}
          <line x1={160} y1={10} x2={160} y2={310} className="wave108b-axis" />
          <line x1={10} y1={160} x2={310} y2={160} className="wave108b-axis" />
          <text x={300} y={305} className="wave108b-axislabel" textAnchor="end">likelihood →</text>
          <text x={14} y={22} className="wave108b-axislabel">↑ impact</text>
          {matrixPoints.map(({ target, point }) => (
            <g key={target.id}>
              <circle
                cx={10 + (point.likelihood / 100) * 300}
                cy={310 - (point.impact / 100) * 300}
                r={7}
                className={`wave108b-dot${isCrownJewel(target) ? ' wave108b-dot-jewel' : ''}`}
              />
              <text
                x={10 + (point.likelihood / 100) * 300 + 10}
                y={310 - (point.impact / 100) * 300 + 4}
                className="wave108b-dotlabel"
              >
                {target.name} · {point.index}
              </text>
            </g>
          ))}
        </svg>
      </section>

      {/* 54292 / 54293 Crown jewels + compliance boost */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[1].title} &amp; {WAVE108_B_IDEAS[2].title}</h3>
        <ul className="wave108b-list">
          {pinned.map((t) => {
            const boost = applyComplianceBoost(t, AUDIT_SCOPE);
            const b = scoreBreakdown(t, { auditScope: AUDIT_SCOPE });
            return (
              <li key={t.id} className="wave108b-target-row">
                <button className="wave108b-btn wave108b-btn-ghost" onClick={() => toggleJewel(t.id)} title="Toggle crown jewel">
                  {isCrownJewel(t) ? '◆' : '◇'}
                </button>
                <span className="wave108b-target-name">{t.name}</span>
                <span className="wave108b-muted">effective {b.total}</span>
                {isCrownJewel(t) && <span className="wave108b-badge wave108b-badge-jewel">crown jewel +10</span>}
                {boost.inScope && <span className="wave108b-badge wave108b-badge-compliance">audit scope +8 ({boost.framework})</span>}
              </li>
            );
          })}
        </ul>
        <p className="wave108b-muted">◆ marks a crown jewel — always pinned to the top regardless of raw score.</p>
      </section>

      {/* 54298 Leaderboard */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[7].title}</h3>
        <table className="wave108b-table">
          <thead>
            <tr><th>#</th><th>Target</th><th>Score</th><th>Band</th><th>Move</th><th>Δ</th></tr>
          </thead>
          <tbody>
            {leaderboard.map((r) => (
              <tr key={r.id} className={r.crownJewel ? 'wave108b-row-jewel' : ''}>
                <td>{r.rank}</td>
                <td>{r.crownJewel && '◆ '}{r.name}</td>
                <td>{r.score}</td>
                <td><span className={`wave108b-band wave108b-band-${r.band}`}>{r.band}</span></td>
                <td><span className={`wave108b-arrow wave108b-arrow-${r.movement}`}>{r.arrow}</span></td>
                <td>{r.delta === null ? 'new' : `${r.delta > 0 ? '+' : ''}${r.delta}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 54296 Smart groups */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[5].title}</h3>
        <div className="wave108b-groups">
          {['critical', 'high', 'medium', 'low'].map((name) => (
            <div key={name} className={`wave108b-group wave108b-group-${name}`}>
              <h4>{name} <span className="wave108b-count">{groups.counts[name]}</span></h4>
              <ul>
                {groups[name].map((t) => (
                  <li key={t.id}>{t.name} <span className="wave108b-muted">{t.effectiveScore}</span></li>
                ))}
                {groups[name].length === 0 && <li className="wave108b-muted">empty</li>}
              </ul>
            </div>
          ))}
        </div>
        <p className="wave108b-muted">Recomputed from current effective scores on every render — bands always stay current.</p>
      </section>

      {/* 54299 Score vs findings correlation */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[8].title}</h3>
        <svg className="wave108b-bars" viewBox="0 0 400 180" role="img" aria-label="Hit rate by score band">
          {corr.buckets.map((b, i) => {
            const x = 20 + i * 95;
            const h = Math.max(2, (b.hitRate / maxHitRate) * 120);
            return (
              <g key={b.band}>
                <rect x={x} y={140 - h} width={70} height={h} rx={4} className={`wave108b-bar wave108b-bar-${b.band}`} />
                <text x={x + 35} y={136 - h} textAnchor="middle" className="wave108b-barval">{Math.round(b.hitRate * 100)}%</text>
                <text x={x + 35} y={158} textAnchor="middle" className="wave108b-barlabel">{b.label}</text>
                <text x={x + 35} y={172} textAnchor="middle" className="wave108b-barsub">avg {b.avgFindings}</text>
              </g>
            );
          })}
        </svg>
        <p className="wave108b-muted">
          Calibration score: <b>{corr.calibrationScore}</b> · {corr.interpretation}
        </p>
      </section>

      {/* 54295 / 54294 Score export + docs links */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[4].title} &amp; {WAVE108_B_IDEAS[3].title}</h3>
        <button className="wave108b-btn" onClick={() => setCsvPreview(exportScoresCsv(targets, { auditScope: AUDIT_SCOPE }))}>
          Preview score export CSV
        </button>
        {csvPreview && <pre className="wave108b-pre">{csvPreview}</pre>}
        <ul className="wave108b-list">
          {['base-score', 'exploitability', 'crown-jewel', 'compliance', 'patch-cadence', 'smart-groups'].map((key) => {
            const doc = factorDocLink(key);
            return (
              <li key={key}>
                <a className="wave108b-doclink" href={doc.url}>{doc.label}</a>
                <span className="wave108b-muted"> — {doc.blurb}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 54297 Score notifications */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[6].title}</h3>
        <input className="wave108b-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="stakeholder email" />
        <button
          className="wave108b-btn"
          onClick={() => {
            setSubscription(subscribeTopMovers(email, { topN: 3 }));
            setDigest(buildWeeklyMoversDigest(targets, PREV_WEEK, { topN: 3 }));
          }}
        >
          Subscribe &amp; build digest
        </button>
        {subscription && <p className="wave108b-muted">Subscribed {subscription.email} · weekly · top {subscription.topN}</p>}
        {digest && (
          <div className="wave108b-digest">
            <p className="wave108b-muted">{digest.summary}</p>
            <ul className="wave108b-list">
              {digest.movers.map((m) => (
                <li key={m.targetId}>
                  <span className={`wave108b-arrow wave108b-arrow-${m.direction}`}>{m.direction === 'up' ? '▲' : '▼'}</span>{' '}
                  {m.targetName}: {m.prevScore} → {m.currentScore} ({m.delta > 0 ? '+' : ''}{m.delta})
                </li>
              ))}
              {digest.movers.length === 0 && <li className="wave108b-muted">No movers this week.</li>}
            </ul>
          </div>
        )}
      </section>

      {/* 54300 Patch cadence factor */}
      <section className="wave108b-card">
        <h3>{WAVE108_B_IDEAS[9].title}</h3>
        <ul className="wave108b-list">
          {targets.map((t) => {
            const s = patchCadenceScore(t.deployHistory);
            return (
              <li key={t.id}>
                {t.name}: <b>{s}</b>{' '}
                <span className={`wave108b-badge ${s >= 0.75 ? 'wave108b-badge-fast' : s >= 0.45 ? 'wave108b-badge-med' : 'wave108b-badge-stale'}`}>
                  {s >= 0.75 ? 'fast' : s >= 0.45 ? 'moderate' : 'stale'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
