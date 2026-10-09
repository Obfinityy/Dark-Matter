import React, { useMemo, useState } from 'react';
import {
  WAVE107_B_IDEAS,
  CHANGE_TYPES,
  filterChangesByType,
  correlateCrossTarget,
  linkFindingsToChange,
  batchQuietHours,
  computeCompositeScore,
} from './wave107BCores';

// ---------------------------------------------------------------------------
// Wave107B — Change feed + risk scoring foundation (ideas 54251–54260).
// Infinity AI demonstration panel for the Hunt AI view.
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 10, 2, 30, 0); // 02:30 UTC — inside the quiet-hours window

const SAMPLE_CHANGES = [
  { id: 'c1', target: 'api.obfinity.example', type: 'dns', at: T0, summary: 'New A record api-staging-2' },
  { id: 'c2', target: 'api.obfinity.example', type: 'cert', at: T0 + 5 * 60 * 1000, summary: 'TLS cert renewed (wildcard)' },
  { id: 'c3', target: 'shop.obfinity.example', type: 'cert', at: T0 + 6 * 60 * 1000, summary: 'TLS cert renewed (wildcard)' },
  { id: 'c4', target: 'cdn.obfinity.example', type: 'cert', at: T0 + 8 * 60 * 1000, summary: 'TLS cert renewed (wildcard)' },
  { id: 'c5', target: 'shop.obfinity.example', type: 'content', at: T0 + 3 * HOUR, summary: 'Checkout page copy changed' },
  { id: 'c6', target: 'shop.obfinity.example', type: 'tech', at: T0 + 4 * HOUR, summary: 'X-Powered-By header removed' },
  { id: 'c7', target: 'api.obfinity.example', type: 'network', at: T0 + 5 * HOUR, summary: 'Port 8443 now open' },
];

const SAMPLE_FINDINGS = [
  { id: 'f1', target: 'shop.obfinity.example', foundAt: T0 + 4 * HOUR + 30 * 60 * 1000, title: 'Reflected XSS in checkout' },
  { id: 'f2', target: 'api.obfinity.example', foundAt: T0 + 10 * HOUR, title: 'Verbose error disclosure' },
];

const SAMPLE_TARGETS = [
  {
    name: 'shop.obfinity.example',
    surfaceSize: { subdomains: 210, endpoints: 1450, ports: 14 },
    technologyStack: [{ name: 'WordPress', version: '4.9', eol: true }, { name: 'PHP', version: '7.4', eol: '2022-11-28' }],
    exposure: { environment: 'production', internetFacing: true },
    dataSensitivity: { dataTypes: ['payments', 'identity'] },
    bountyValue: { rewardMin: 500, rewardMax: 15000 },
  },
  {
    name: 'docs.obfinity.example',
    surfaceSize: { subdomains: 4, endpoints: 60, ports: 3 },
    technologyStack: [{ name: 'Node', version: '20.11.0' }],
    exposure: { environment: 'staging', internetFacing: true },
    dataSensitivity: { dataTypes: ['analytics'] },
    bountyValue: { rewardMin: 100, rewardMax: 1000 },
  },
];

const panelStyle = {
  background: '#0b0e14',
  color: '#e8edf5',
  border: '1px solid #1e2635',
  borderRadius: 12,
  padding: 18,
  margin: '12px 0',
  fontFamily: 'inherit',
};

const chipStyle = {
  display: 'inline-block',
  padding: '3px 10px',
  margin: '2px 4px 2px 0',
  borderRadius: 999,
  border: '1px solid #2c3a52',
  fontSize: 12,
  background: '#141b29',
};

const selectStyle = {
  background: '#141b29',
  color: '#e8edf5',
  border: '1px solid #2c3a52',
  borderRadius: 8,
  padding: '6px 10px',
  marginRight: 8,
};

export default function Wave107B() {
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(
    () => (typeFilter === 'all' ? SAMPLE_CHANGES : filterChangesByType(SAMPLE_CHANGES, typeFilter)),
    [typeFilter],
  );

  const correlations = useMemo(() => correlateCrossTarget(SAMPLE_CHANGES, 15 * 60 * 1000), []);

  const linked = useMemo(() => linkFindingsToChange(SAMPLE_FINDINGS, SAMPLE_CHANGES), []);

  const batched = useMemo(
    () =>
      batchQuietHours(
        SAMPLE_CHANGES.map((c) => ({ id: c.id, severity: 'low', at: c.at, type: c.type, summary: c.summary })),
        { quietStartHour: 22, quietEndHour: 7, now: T0 + 6 * HOUR },
      ),
    [],
  );

  const scored = useMemo(
    () =>
      SAMPLE_TARGETS.map((t) => ({ name: t.name, ...computeCompositeScore(t) })).sort(
        (a, b) => b.score - a.score,
      ),
    [],
  );

  return (
    <div style={panelStyle} data-testid="wave107b">
      <h3 style={{ margin: '0 0 4px' }}>Infinity AI · Change Feed + Risk Scoring</h3>
      <p style={{ color: '#9aa7bd', fontSize: 13, margin: '0 0 14px' }}>
        Ideas 54251–54260 · Change filters, cross-target correlation, and composite target risk scores.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {/* 54251 */}
        <section style={{ border: '1px solid #1e2635', borderRadius: 10, padding: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Change filters by type</h4>
          <select
            style={selectStyle}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter changes by type"
          >
            <option value="all">All types</option>
            {CHANGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ul style={{ paddingLeft: 18, fontSize: 13 }}>
            {filtered.map((c) => (
              <li key={c.id}>{c.target} · {c.summary}</li>
            ))}
          </ul>
        </section>

        {/* 54252 */}
        <section style={{ border: '1px solid #1e2635', borderRadius: 10, padding: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Cross-target change correlation</h4>
          {correlations.length === 0 && <p style={{ fontSize: 13, color: '#9aa7bd' }}>No platform-wide deploys detected.</p>}
          {correlations.map((g) => (
            <div key={g.key} style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={chipStyle}>{g.type}</span>
              <span>likely platform deploy across {g.targets.length} targets: {g.targets.join(', ')}</span>
            </div>
          ))}
        </section>

        {/* 54253 */}
        <section style={{ border: '1px solid #1e2635', borderRadius: 10, padding: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Change-to-finding linkage</h4>
          {linked.map((f) => (
            <div key={f.id} style={{ fontSize: 13, marginBottom: 6 }}>
              <div>{f.title}</div>
              <div style={{ color: '#9aa7bd' }}>
                linked changes: {f.linkedChangeIds.length ? f.linkedChangeIds.join(', ') : 'none'}
              </div>
            </div>
          ))}
        </section>

        {/* 54254 */}
        <section style={{ border: '1px solid #1e2635', borderRadius: 10, padding: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>Quiet-hours change batching</h4>
          <div style={{ fontSize: 13 }}>
            <div>Immediate: {batched.immediate.length}</div>
            <div>Held overnight: {batched.held.length}</div>
            {batched.morningSummary && (
              <div style={{ color: '#9aa7bd', marginTop: 6 }}>
                Morning summary: {batched.morningSummary.count} low-severity changes held (
                {Object.entries(batched.morningSummary.byType).map(([t, n]) => `${t}: ${n}`).join(', ')}
              </div>
            )}
          </div>
        </section>

        {/* 54255–54260 */}
        <section style={{ border: '1px solid #1e2635', borderRadius: 10, padding: 12, gridColumn: '1 / -1' }}>
          <h4 style={{ margin: '0 0 8px' }}>Composite risk score (0–100) per target</h4>
          {scored.map((t) => (
            <div key={t.name} style={{ marginBottom: 10, fontSize: 13 }}>
              <div>
                <strong>{t.name}</strong> · <span style={chipStyle}>{t.score}/100</span>
                <span style={{ color: '#9aa7bd' }}>{t.band}</span>
              </div>
              <div style={{ color: '#9aa7bd', fontSize: 12 }}>
                surface {t.factors.surface} · tech {t.factors.technology} · exposure {t.factors.exposure} ·
                sensitivity {t.factors.sensitivity} · bounty {t.factors.bounty}
              </div>
            </div>
          ))}
        </section>
      </div>

      <details style={{ marginTop: 12, fontSize: 12, color: '#9aa7bd' }}>
        <summary>Ideas covered in this panel</summary>
        <ul>
          {WAVE107_B_IDEAS.map((i) => (
            <li key={i.id}>{i.id} · {i.title}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
