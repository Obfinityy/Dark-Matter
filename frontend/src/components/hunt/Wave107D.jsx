/**
 * Wave107D.jsx — Infinity AI · Wave 107 Group D
 * Score presentation + hunt queue, ideas 54271–54280.
 *
 * Demonstrates all 10 score-presentation and hunt-queue features on sample
 * Infinity AI hunt data. Branding: Infinity AI only.
 */
import React, { useMemo, useState } from 'react';
import {
  WAVE107_D_IDEAS,
  buildScoreTrend,
  applyManualOverride,
  confidenceIndicator,
  peerPercentile,
  applyProgramTierWeighting,
  applyClientSlaWeighting,
  orderHuntQueue,
  checkAutoHuntThresholds,
  decayHuntedDampener,
  boostOnNewChanges,
} from './wave107DCores.js';

const NOW = 1760064000000; // fixed sample anchor (Sat 2026-10-10 00:00:00 IST)
const H = 3_600_000;

const SAMPLE_TARGETS = [
  { id: 'api-acme', name: 'api.acme.example', score: 88, lastHuntedTs: NOW - 30 * H, huntedDampener: 18 },
  { id: 'shop-acme', name: 'shop.acme.example', score: 64, lastHuntedTs: NOW - 120 * H, huntedDampener: 12 },
  { id: 'admin-acme', name: 'admin.acme.example', score: 91, lastHuntedTs: NOW - 6 * H, huntedDampener: 22 },
  { id: 'docs-acme', name: 'docs.acme.example', score: 41, lastHuntedTs: NOW - 300 * H, huntedDampener: 8 },
  { id: 'pay-acme', name: 'pay.acme.example', score: 77, lastHuntedTs: NOW - 55 * H, huntedDampener: 15 },
];

const SAMPLE_HISTORY = [
  { ts: NOW - 96 * H, score: 62, annotation: 'Initial recon finished' },
  { ts: NOW - 72 * H, score: 71, annotation: 'SQLi candidate found' },
  { ts: NOW - 48 * H, score: 58, annotation: 'Finding confirmed as false positive' },
  { ts: NOW - 24 * H, score: 84, annotation: 'IDOR verified with PoC' },
  { ts: NOW - 6 * H, score: 88, annotation: null },
];

const SAMPLE_CHANGES = [
  { type: 'new-endpoint', interest: 0.9, detectedTs: NOW - 2 * H },
  { type: 'header-change', interest: 0.4, detectedTs: NOW - 30 * H },
];

const card = {
  border: '1px solid #2a2a3a',
  borderRadius: 12,
  padding: 16,
  background: '#12121c',
  marginBottom: 16,
};

const title = { color: '#f5c518', fontSize: 15, fontWeight: 700, margin: '0 0 8px' };
const sub = { color: '#8a8aa0', fontSize: 12, margin: '0 0 12px' };
const row = { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' };
const pill = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 999,
  fontSize: 12,
  background: '#23232f',
  color: '#e8e8f0',
  border: '1px solid #34344a',
};
const ideaTag = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 6,
  fontSize: 11,
  background: '#1d1d2b',
  color: '#9d9db8',
  border: '1px solid #2e2e44',
  marginRight: 8,
};
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th = { textAlign: 'left', color: '#8a8aa0', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid #2a2a3a' };
const td = { padding: '6px 8px', borderBottom: '1px solid #1e1e2a', color: '#e8e8f0' };
const input = {
  background: '#0d0d15',
  color: '#e8e8f0',
  border: '1px solid #2e2e44',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 13,
};
const button = {
  background: '#f5c518',
  color: '#111',
  border: 'none',
  borderRadius: 8,
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

function TrendSparkline({ trend }) {
  const pts = trend.points;
  if (pts.length < 2) return null;
  const W = 560;
  const Ht = 120;
  const min = Math.min(...pts.map((p) => p.score));
  const max = Math.max(...pts.map((p) => p.score));
  const span = Math.max(1, max - min);
  const t0 = pts[0].ts;
  const t1 = pts[pts.length - 1].ts;
  const tspan = Math.max(1, t1 - t0);
  const coords = pts.map((p) => ({
    x: 20 + ((p.ts - t0) / tspan) * (W - 40),
    y: Ht - 15 - ((p.score - min) / span) * (Ht - 30),
  }));
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={Ht} style={{ background: '#0d0d15', borderRadius: 8, maxWidth: '100%' }} role="img" aria-label="Score trend chart">
      <path d={line} fill="none" stroke="#f5c518" strokeWidth="2.5" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={4} fill={trend.annotations.some((a) => a.ts === pts[i].ts) ? '#7dd3fc' : '#f5c518'} />
      ))}
      {coords.map((c, i) => (
        <text key={`t${i}`} x={c.x} y={c.y - 9} fill="#8a8aa0" fontSize="10" textAnchor="middle">
          {pts[i].score}
        </text>
      ))}
    </svg>
  );
}

function Wave107D() {
  const [overrideInput, setOverrideInput] = useState('72');
  const [overrideReason, setOverrideReason] = useState('Analyst reviewed logs; model missed auth context.');
  const [overrideResult, setOverrideResult] = useState(null);
  const [threshold, setThreshold] = useState(75);

  const trend = useMemo(() => buildScoreTrend(SAMPLE_HISTORY), []);
  const queue = useMemo(() => orderHuntQueue(SAMPLE_TARGETS), []);
  const autoHunts = useMemo(
    () => checkAutoHuntThresholds(SAMPLE_TARGETS, { default: threshold }),
    [threshold],
  );
  const decayed = useMemo(
    () => SAMPLE_TARGETS.map((t) => decayHuntedDampener(t, NOW)),
    [],
  );
  const peered = useMemo(
    () => queue.map((t) => ({ ...t, peer: peerPercentile(t.score, SAMPLE_TARGETS.map((x) => x.score)) })),
    [queue],
  );
  const boosted = useMemo(
    () => ({ ...boostOnNewChanges(88, SAMPLE_CHANGES, NOW), target: 'api.acme.example' }),
    [],
  );

  const applyOverride = () => {
    const pinned = Number.parseFloat(overrideInput);
    setOverrideResult(
      applyManualOverride(SAMPLE_TARGETS[0], pinned, overrideReason, { analystId: 'infinity-analyst', at: NOW }),
    );
  };

  const programTier = applyProgramTierWeighting(78, 4500, { tier: 'elite' });
  const sla = applyClientSlaWeighting(64, 'acme-corp', { 'acme-corp': 1.35, 'globex': 1.0 });
  const conf = confidenceIndicator(88, [
    { source: 'recon', weight: 30 },
    { source: 'vuln-detector', weight: 35 },
    { source: 'poc-verified', weight: 25 },
  ]);
  const confThin = confidenceIndicator(41, [{ source: 'recon', weight: 15 }]);

  return (
    <div style={{ padding: 24, background: '#0a0a12', color: '#e8e8f0', minHeight: '100%' }}>
      <h1 style={{ color: '#f5c518', fontSize: 22, margin: '0 0 4px' }}>
        Infinity AI · Score Presentation + Hunt Queue
      </h1>
      <p style={sub}>
        Wave 107 · Group D · ideas {WAVE107_D_IDEAS[0].id}–{WAVE107_D_IDEAS[WAVE107_D_IDEAS.length - 1].id} ·
        all scoring computed locally by Infinity AI engines
      </p>

      {/* 54271 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54271</span>Score trend chart
        </div>
        <p style={sub}>Score movement over time, annotated with what drove each change. Net change: {trend.netChange > 0 ? '+' : ''}{trend.netChange} ({trend.trend}).</p>
        <TrendSparkline trend={trend} />
        <ul style={{ fontSize: 13, color: '#b9b9cc', marginTop: 12, paddingLeft: 18 }}>
          {trend.annotations.map((a, i) => (
            <li key={i}>
              <span style={{ color: '#7dd3fc' }}>{a.score}</span> — {a.text}
            </li>
          ))}
        </ul>
      </section>

      {/* 54272 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54272</span>Manual score override
        </div>
        <p style={sub}>Analysts can pin a score with a written justification when the model misses context.</p>
        <div style={row}>
          <input style={input} value={overrideInput} onChange={(e) => setOverrideInput(e.target.value)} aria-label="Override score" />
          <input style={{ ...input, width: 320 }} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} aria-label="Justification" />
          <button type="button" style={button} onClick={applyOverride}>Pin score</button>
        </div>
        {overrideResult && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <span style={pill}>pinned {overrideResult.score}</span>{' '}
            <span style={pill}>was {overrideResult.override.previousScore}</span>{' '}
            <span style={{ color: '#9d9db8' }}>by {overrideResult.override.analystId}: “{overrideResult.override.justification}”</span>
          </div>
        )}
      </section>

      {/* 54273 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54273</span>Score confidence indicator (targets)
        </div>
        <p style={sub}>How much evidence backs each score — thin-data scores are flagged so they are not overtrusted.</p>
        <div style={row}>
          <span style={pill}>api.acme.example · confidence {conf.confidence} ({conf.level}) — {conf.evidenceCount} evidence sources</span>
          <span style={pill}>docs.acme.example · confidence {confThin.confidence} ({confThin.level}){confThin.thinData ? ' — THIN DATA' : ''}</span>
        </div>
      </section>

      {/* 54274 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54274</span>Peer percentile ranking
        </div>
        <p style={sub}>Where each target sits versus the portfolio.</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Target</th>
              <th style={th}>Score</th>
              <th style={th}>Percentile</th>
            </tr>
          </thead>
          <tbody>
            {peered.map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.name}</td>
                <td style={td}>{t.score}</td>
                <td style={td}>{t.peer.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 54275 + 54276 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54275</span>Program tier weighting
        </div>
        <p style={sub}>Bounty value informs the score through the program's tier configuration.</p>
        <div style={row}>
          <span style={pill}>base {programTier.score}</span>
          <span style={pill}>tier {programTier.tier} · ${programTier.bountyValue} bounty</span>
          <span style={pill}>+{programTier.boost} → {programTier.finalScore}</span>
        </div>
      </section>
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54276</span>Client SLA weighting
        </div>
        <p style={sub}>Per-client importance multipliers for MSSP prioritization.</p>
        <div style={row}>
          <span style={pill}>base {sla.score}</span>
          <span style={pill}>client {sla.clientId} · ×{sla.multiplier}</span>
          <span style={pill}>→ {sla.finalScore}</span>
        </div>
      </section>

      {/* 54277 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54277</span>Score-based hunt queue
        </div>
        <p style={sub}>The hunt scheduler orders targets by risk score — juiciest first.</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Target</th>
              <th style={th}>Score</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((t) => (
              <tr key={t.id}>
                <td style={td}>{t.queueRank}</td>
                <td style={td}>{t.name}</td>
                <td style={td}>{t.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 54278 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54278</span>Auto-hunt score thresholds
        </div>
        <p style={sub}>Hunts trigger automatically when a target crosses the configured line.</p>
        <div style={row}>
          <label htmlFor="w107d-threshold" style={{ fontSize: 13, color: '#9d9db8' }}>Threshold:</label>
          <input
            id="w107d-threshold"
            style={{ ...input, width: 70 }}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 0)}
          />
        </div>
        <div style={{ ...row, marginTop: 12 }}>
          {autoHunts.length === 0 && <span style={{ fontSize: 13, color: '#8a8aa0' }}>No targets above the line.</span>}
          {autoHunts.map((a) => (
            <span key={a.id} style={pill}>⚡ auto-hunt {a.id} ({a.score} ≥ {a.line})</span>
          ))}
        </div>
      </section>

      {/* 54279 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54279</span>Recently-hunted dampener decay
        </div>
        <p style={sub}>The “just hunted” dampener fades with a 24-hour half-life so stale targets climb back up.</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Target</th>
              <th style={th}>Base</th>
              <th style={th}>Elapsed (h)</th>
              <th style={th}>Dampener left</th>
              <th style={th}>Effective</th>
            </tr>
          </thead>
          <tbody>
            {decayed.map((d) => (
              <tr key={d.id}>
                <td style={td}>{d.id}</td>
                <td style={td}>{d.baseScore}</td>
                <td style={td}>{d.elapsedHours}</td>
                <td style={td}>{d.remainingDampener}</td>
                <td style={td}>{d.effectiveScore}{d.fullyRecovered ? ' ✓ recovered' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 54280 */}
      <section style={card}>
        <div style={title}>
          <span style={ideaTag}>54280</span>Score boost on new changes
        </div>
        <p style={sub}>High-interest changes temporarily lift the score.</p>
        <div style={row}>
          <span style={pill}>{boosted.target} · base {boosted.score}</span>
          <span style={pill}>+{boosted.boost} from {boosted.contributingChanges} changes</span>
          <span style={pill}>→ {boosted.boostedScore}</span>
        </div>
      </section>
    </div>
  );
}

export default Wave107D;
