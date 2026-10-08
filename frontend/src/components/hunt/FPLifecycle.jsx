/**
 * FPLifecycle.jsx — Infinity AI · Dark-Matter · Wave 53
 * 20 working React components for the FP lifecycle round 3 ideas 52081–52100.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './fpLifecycleCore.js';

const NOW = 1700000000000;
const SAMPLE_DECISIONS = [
  { findingId: 'f1', title: 'Reflected XSS', reasonId: 'not-reproducible', reasonLabel: 'Not reproducible', markedBy: 'ria', markedAt: NOW + 1000, foundAt: NOW - 7200000, severity: 'medium', signature: 'xss-reflected', huntId: 'h1', target: 'shop', endpoint: '/search' },
  { findingId: 'f2', title: 'SQL error disclosure', reasonId: 'expected-behavior', reasonLabel: 'Expected behavior', markedBy: 'sam', markedAt: NOW + 2000, foundAt: NOW - 3600000, severity: 'low', signature: 'sqli-error', huntId: 'h1', target: 'shop', endpoint: '/api/users' },
  { findingId: 'f3', title: 'Reflected XSS', reasonId: 'not-reproducible', reasonLabel: 'Not reproducible', markedBy: 'ria', markedAt: NOW + 3000, foundAt: NOW - 1800000, severity: 'medium', signature: 'xss-reflected', huntId: 'h2', target: 'blog', endpoint: '/search' },
  { findingId: 'f4', title: 'Reflected XSS', reasonId: 'not-reproducible', reasonLabel: 'Not reproducible', markedBy: 'ria', markedAt: NOW + 4000, foundAt: NOW - 900000, severity: 'medium', signature: 'xss-reflected', huntId: 'h3', target: 'docs', endpoint: '/search' },
];
const SAMPLE_HUNTS = [
  { huntId: 'h1', totalFindings: 40, falsePositives: 12 },
  { huntId: 'h2', totalFindings: 50, falsePositives: 10 },
  { huntId: 'h3', totalFindings: 60, falsePositives: 6 },
];

/* 52081 — FP exclusion footnotes in reports. */
export function FpAppendix() {
  const [appendix] = useState(() => C.buildFpAppendix(SAMPLE_DECISIONS));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52081 · FP exclusion footnotes</h3>
      <p className="fpl53-note">{appendix.heading}</p>
      <ul>{appendix.rows.map((r) => <li key={r.footnote} className="fpl53-item">{r.text}</li>)}</ul>
    </div>
  );
}

/* 52082 — FP dispute workflow. */
export function FpDispute() {
  const [marking, setMarking] = useState({ findingId: 'f1', status: 'false-positive', reasonId: 'not-reproducible' });
  const [challenge, setChallenge] = useState('payload executed in retest');
  const dispute = () => setMarking(C.openDispute(marking, 'sam', challenge, NOW));
  const resolve = (v) => setMarking(C.resolveDispute(marking, v, 'ria', NOW + 60000));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52082 · FP dispute workflow</h3>
      <p className="fpl53-note">status: {marking.status}{marking.dispute ? ` · disputed by ${marking.dispute.challengedBy}` : ''}</p>
      {marking.status !== 'disputed' && (
        <div className="fpl53-row">
          <input className="fpl53-input" value={challenge} onChange={(e) => setChallenge(e.target.value)} placeholder="challenge reason" />
          <button className="fpl53-btn" onClick={dispute}>Dispute</button>
        </div>
      )}
      {marking.status === 'disputed' && (
        <div className="fpl53-row">
          <button className="fpl53-btn" onClick={() => resolve('upheld')}>Upheld</button>
          <button className="fpl53-btn" onClick={() => resolve('overturned')}>Overturned</button>
        </div>
      )}
    </div>
  );
}

/* 52083 — FP SLA tracking. */
export function FpSla() {
  const [summary] = useState(() => C.fpSlaSummary([
    { foundAt: NOW - 7200000, decidedAt: NOW, severity: 'medium' },
    { foundAt: NOW - 200 * 3600e3, decidedAt: NOW, severity: 'medium' },
  ]));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52083 · FP SLA tracking</h3>
      <p className="fpl53-note">met {summary.met}/{summary.total} · rate {(summary.metRate * 100).toFixed(0)}%</p>
      <ul>{summary.rows.map((r, i) => <li key={i} className="fpl53-item">{r.severity}: {Math.round(r.elapsedMs / 3600e3)}h / {r.targetMs / 3600e3}h target — {r.met ? 'met' : 'violated'}</li>)}</ul>
    </div>
  );
}

/* 52084 — FP trend charts over hunts. */
export function FpTrend() {
  const [dir] = useState(() => C.fpTrendDirection(SAMPLE_HUNTS));
  const series = C.fpTrendOverHunts(SAMPLE_HUNTS);
  const max = Math.max(1, ...series.map((s) => s.fpRate));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52084 · FP trend over hunts</h3>
      <p className="fpl53-note">direction: {dir.direction} ({dir.first} → {dir.last})</p>
      {series.map((s) => (
        <div key={s.huntId} className="fpl53-row">
          <span className="fpl53-label">{s.huntId}</span>
          <div className="fpl53-bar"><div className="fpl53-fill" style={{ width: `${Math.round((s.fpRate / max) * 100)}%` }} /></div>
          <span className="fpl53-note">{(s.fpRate * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

/* 52085 — Per-finding FP probability badge. */
export function FpProbabilityBadge() {
  const [finding] = useState({ findingId: 'f9', signature: 'xss-reflected' });
  const history = [
    { signature: 'xss-reflected', isFalsePositive: true },
    { signature: 'xss-reflected', isFalsePositive: true },
    { signature: 'xss-reflected', isFalsePositive: true },
    { signature: 'xss-reflected', isFalsePositive: false },
  ];
  const b = C.fpProbabilityForSignature(finding.signature, history);
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52085 · FP probability badge</h3>
      <span className="fpl53-badge">{b.label}</span>
      <p className="fpl53-note">signature {b.signature} · sample {b.sample}</p>
    </div>
  );
}

/* 52086 — FP reason search. */
export function FpReasonSearch() {
  const [q, setQ] = useState('xss waf');
  const justifications = [
    { findingId: 'f1', justification: 'WAF blocked the reflected XSS payload on /search', reasonLabel: 'Not reproducible', reasonId: 'not-reproducible', findingTitle: 'Reflected XSS' },
    { findingId: 'f2', justification: 'SQL error message is expected for admin accounts', reasonLabel: 'Expected behavior', reasonId: 'expected-behavior', findingTitle: 'SQL error disclosure' },
  ];
  const results = C.searchFpReasons(justifications, q);
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52086 · FP reason search</h3>
      <input className="fpl53-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="search justifications…" />
      <ul>{results.map((r) => <li key={r.findingId} className="fpl53-item">{r.findingTitle}: {r.justification.slice(0, 60)}… (score {r.score.toFixed(2)})</li>)}</ul>
    </div>
  );
}

/* 52087 — Cross-hunt FP pattern detection. */
export function FpPatternDetect() {
  const [patterns] = useState(() => C.detectCrossHuntFpPatterns(SAMPLE_DECISIONS, 2));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52087 · Cross-hunt pattern detection</h3>
      <ul>{patterns.map((p) => <li key={p.signature} className="fpl53-item">{p.signature}: {p.huntCount} hunts, {p.occurrences} hits → propose “{p.proposedRuleName}”</li>)}</ul>
      {patterns.length === 0 && <p className="fpl53-note">no recurring patterns</p>}
    </div>
  );
}

/* 52088 — User-defined auto-FP rules. */
export function FpAutoRule() {
  const [rule] = useState(() => C.makeAutoFpRule('r1', 'JSON error field XSS', [
    { field: 'endpoint', op: 'contains', value: 'error' },
    { field: 'title', op: 'contains', value: 'xss' },
  ]));
  const [finding] = useState({ findingId: 'f7', endpoint: '/api/error', title: 'Reflected XSS in error field' });
  const m = C.matchAutoFpRule(rule, finding);
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52088 · Auto-FP rule</h3>
      <p className="fpl53-note">{rule.name}: {rule.conditions.length} conditions</p>
      <p className="fpl53-note">test finding: {m.matched ? 'would dismiss' : 'kept'} ({m.matchedConditions}/{m.totalConditions} conditions matched)</p>
    </div>
  );
}

/* 52089 — Per-target FP allowlist. */
export function FpAllowlist() {
  const [state, setState] = useState(() => C.addTargetAllowlistEntry([], 'shop', 'xss-reflected', 'test header reflected', 'ria', NOW));
  const hit = C.checkTargetAllowlist(state.allowlist, 'shop', 'xss-reflected');
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52089 · Per-target allowlist</h3>
      <p className="fpl53-note">entries: {state.allowlist.length} · lookup shop/xss-reflected: {String(hit)}</p>
      <button className="fpl53-btn" onClick={() => setState(C.addTargetAllowlistEntry(state.allowlist, 'blog', 'sqli-error', 'known benign', 'sam', NOW))}>Allowlist blog/sqli-error</button>
    </div>
  );
}

/* 52090 — FP rule versioning. */
export function FpRuleVersions() {
  const [rule, setRule] = useState(() => C.makeAutoFpRule('r1', 'v1 rule', [{ field: 'title', op: 'contains', value: 'xss' }]));
  const bump = () => setRule(C.versionAutoFpRule(rule, { conditions: [{ field: 'title', op: 'contains', value: 'xss' }, { field: 'endpoint', op: 'contains', value: '/search' }] }, 'ria', NOW));
  const rollback = () => setRule(C.rollbackAutoFpRule(rule, 1));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52090 · Rule versioning</h3>
      <p className="fpl53-note">version {rule.version} · history {(rule.history || []).length} entries · conditions {rule.conditions.length}</p>
      <div className="fpl53-row">
        <button className="fpl53-btn" onClick={bump}>Bump to v2</button>
        <button className="fpl53-btn" onClick={rollback}>Rollback to v1</button>
      </div>
    </div>
  );
}

/* 52091 — FP rule sandbox testing. */
export function FpSandbox() {
  const rule = C.makeAutoFpRule('r1', 'sandbox rule', [{ field: 'endpoint', op: 'contains', value: '/search' }]);
  const findings = [
    { findingId: 'f1', endpoint: '/search', title: 'XSS', severity: 'medium' },
    { findingId: 'f2', endpoint: '/login', title: 'CSRF', severity: 'high' },
  ];
  const res = C.sandboxTestRule(rule, findings);
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52091 · Rule sandbox</h3>
      <p className="fpl53-note">scanned {res.scanned} → would dismiss {res.wouldDismiss}, keep {res.wouldKeep}</p>
      <ul>{res.sample.map((s) => <li key={s.findingId} className="fpl53-item">{s.findingId}: {s.title} ({s.severity})</li>)}</ul>
    </div>
  );
}

/* 52092 — Shared team FP rules. */
export function FpTeamRules() {
  const rule = C.makeAutoFpRule('r1', 'shared rule', [{ field: 'title', op: 'contains', value: 'xss' }]);
  const pub = C.publishTeamRule(rule, 'ria', 'team-alpha', NOW);
  const status = C.teamRuleReviewStatus(pub.libraryEntry, NOW + 100 * 86400e3);
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52092 · Shared team rules</h3>
      <p className="fpl53-note">owner {pub.libraryEntry.owner} · team {pub.libraryEntry.teamId} · review {status.overdue ? 'OVERDUE' : `${status.daysLeft}d left`}</p>
    </div>
  );
}

/* 52093 — FP false-negative guard. */
export function FpGuard() {
  const dismissed = Array.from({ length: 40 }, (_, i) => ({ findingId: `auto-${i + 1}` }));
  const [summary] = useState(() => C.guardSampleSummary(dismissed, 5));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52093 · False-negative guard</h3>
      <p className="fpl53-note">sampled {summary.sampled}/{summary.total} auto-dismissals at {summary.ratePercent}%</p>
      <ul>{summary.sample.slice(0, 4).map((s) => <li key={s.findingId} className="fpl53-item">{s.findingId} — spot-check</li>)}</ul>
    </div>
  );
}

/* 52094 — FP confidence threshold setting. */
export function FpThresholds() {
  const sev = 'high';
  const allow = C.canAutoDismiss(sev, 0.95);
  const block = C.canAutoDismiss('critical', 0.99);
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52094 · Confidence thresholds</h3>
      <p className="fpl53-note">high @0.95: {String(allow.allowed)} (threshold {allow.threshold})</p>
      <p className="fpl53-note">critical @0.99: {String(block.allowed)} — {block.reason}</p>
    </div>
  );
}

/* 52095 — FP auto-expiry. */
export function FpExpiry() {
  const [marking, setMarking] = useState(() => C.scheduleFpExpiry({ findingId: 'f1', status: 'false-positive' }, 90, NOW));
  const status = C.fpExpiryStatus(marking, NOW + 100 * 86400e3);
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52095 · FP auto-expiry</h3>
      <p className="fpl53-note">valid {marking.validityDays}d · after 100d: {status.expired ? 'EXPIRED — resurface for re-review' : 'active'}</p>
      <button className="fpl53-btn" onClick={() => setMarking(C.scheduleFpExpiry(marking, 30, NOW))}>Re-box to 30d</button>
    </div>
  );
}

/* 52096 — FP tags. */
export function FpTags() {
  const [m, setM] = useState({ findingId: 'f1', tags: [] });
  const tag = () => setM(C.tagFpDismissal(m, ['waf-blocked', 'test-data', 'bogus-tag']));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52096 · FP tags</h3>
      <p className="fpl53-note">tags: {(m.tags || []).join(', ') || 'none'}{m.rejected && m.rejected.length ? ` · rejected: ${m.rejected.join(', ')}` : ''}</p>
      <button className="fpl53-btn" onClick={tag}>Tag dismissal</button>
    </div>
  );
}

/* 52097 — FP digest email. */
export function FpDigest() {
  const [d] = useState(() => C.buildFpDigestPayload(SAMPLE_DECISIONS, NOW - 7 * 86400e3, NOW));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52097 · FP digest email</h3>
      <p className="fpl53-note">{d.subject}</p>
      <ul>{Object.entries(d.byReason).map(([r, n]) => <li key={r} className="fpl53-item">{r}: {n}</li>)}</ul>
    </div>
  );
}

/* 52098 — FP reopen on target change. */
export function FpReopenOnChange() {
  const [flags] = useState(() => C.flagFpForRevalidation(
    SAMPLE_DECISIONS.map((d) => ({ ...d, expiresAt: NOW - 1000 })),
    { target: 'shop', scope: 'code', at: NOW },
  ));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52098 · Reopen on target change</h3>
      <ul>{flags.map((f) => <li key={f.findingId} className="fpl53-item">{f.findingId}: {f.flagged ? `FLAGGED — ${f.reason}` : 'clear'}</li>)}</ul>
    </div>
  );
}

/* 52099 — FP inheritance to future hunts. */
export function FpInherit() {
  const [inh] = useState(() => C.inheritFpPatterns(
    SAMPLE_DECISIONS.map((d) => ({ ...d, huntId: 'h1', status: 'false-positive' })),
    { huntId: 'h4', target: 'shop' },
  ));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52099 · Inheritance to future hunts</h3>
      <p className="fpl53-note">inherited {inh.inheritedCount} patterns into h4</p>
      <ul>{inh.inherited.map((p) => <li key={p.signature} className="fpl53-item">{p.signature} ({p.count}×, from {p.inheritedFrom})</li>)}</ul>
    </div>
  );
}

/* 52100 — FP heatmap by endpoint. */
export function FpHeatmap() {
  const [heat] = useState(() => C.fpHeatmapByEndpoint([
    ...SAMPLE_DECISIONS,
    ...SAMPLE_DECISIONS.map((d, i) => ({ ...d, findingId: `fx${i}` })),
  ]));
  return (
    <div className="fpl53-card">
      <h3 className="fpl53-title">52100 · FP heatmap by endpoint</h3>
      {heat.map((h) => (
        <div key={h.endpoint} className="fpl53-row">
          <span className="fpl53-label">{h.endpoint}</span>
          <div className={`fpl53-bar fpl53-${h.bucket}`}><div className="fpl53-fill" style={{ width: `${Math.round(h.intensity * 100)}%` }} /></div>
          <span className="fpl53-note">{h.count}</span>
        </div>
      ))}
    </div>
  );
}

export function FPLifecycleGallery() {
  return (
    <div className="fpl53-gallery">
      <FpAppendix /><FpDispute /><FpSla /><FpTrend />
      <FpProbabilityBadge /><FpReasonSearch /><FpPatternDetect /><FpAutoRule />
      <FpAllowlist /><FpRuleVersions /><FpSandbox /><FpTeamRules />
      <FpGuard /><FpThresholds /><FpExpiry /><FpTags />
      <FpDigest /><FpReopenOnChange /><FpInherit /><FpHeatmap />
    </div>
  );
}
