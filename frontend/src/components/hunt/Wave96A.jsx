/**
 * Wave96A.jsx — Infinity AI · Wave 96
 * 20 working React components for knowledge forgetting operations, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X96A from './wave96ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w96a-card">
      <div className="w96a-title">{title}</div>
      {note ? <div className="w96a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w96a-badge w96a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w96a-kv">
      <span className="w96a-k">{k}</span>
      <span className="w96a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w96a-bar-row">
      <span className="w96a-k">{label}</span>
      <div className="w96a-bar"><div className="w96a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w96a-v">{value}</span>
    </div>
  );
}

export function ForgottenKnowledgeGraveyard() {
  const data = [{ entryId: 'legacy-xss-notes', title: 'XSS bypass notes', retiredReason: 'stale', forgottenDaysAgo: 500, restorable: true }, { entryId: 'old-ssrf-map', title: 'SSRF internal map', retiredReason: 'superseded', forgottenDaysAgo: 120, restorable: true }, { entryId: 'retired-payloads', title: 'Payload dump 2023', retiredReason: 'stale', forgottenDaysAgo: 40, restorable: false }];
  const [reason, setReason] = useState('all');
  const v = X96A.browseForgottenKnowledgeGraveyard(data);
  const rows = reason === 'all' ? v.rows : v.rows.filter(r => r.retiredReason === reason);
  return (
    <Card title="ForgottenKnowledgeGraveyard" note="Idea 53801">
      <Kv k="Archived" v={v.count} />
      <Kv k="Summary" v={v.summary} />
      <label className="w96a-field">Reason
        <select value={reason} onChange={e => setReason(e.target.value)}>
          <option value="all">all reasons</option>
          <option value="stale">stale</option>
          <option value="superseded">superseded</option>
        </select>
      </label>
      {rows.map(r => <Bar key={r.key} label={r.entryId} value={r.forgottenDaysAgo} max={500} />)}
    </Card>
  );
}
export function KnowledgeRefreshCampaigns() {
  const data = [
    { campaignId: 'refresh-q1', entriesScheduled: 40, entriesRefreshed: 40, startDay: 1, endDay: 30, today: 45 },
    { campaignId: 'refresh-q2', entriesScheduled: 30, entriesRefreshed: 12, startDay: 31, endDay: 60, today: 45 },
    { campaignId: 'refresh-q3', entriesScheduled: 25, entriesRefreshed: 5, startDay: 31, endDay: 40, today: 45 },
  ];
  const [today, setToday] = useState(45);
  const v = X96A.planKnowledgeRefreshCampaigns(data.map(d => ({ ...d, today })));
  return (
    <Card title="KnowledgeRefreshCampaigns" note="Idea 53802">
      <Kv k="Campaigns" v={v.count} />
      <Kv k="Summary" v={v.summary} />
      <label className="w96a-field">Today (day {today})
        <input type="range" min="1" max="90" value={today} onChange={e => setToday(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.campaignId} · ${r.status}`} v={`${Math.round(r.completionRate * 100)}%`} />)}
    </Card>
  );
}
export function CrossStackStalenessVariance() {
  const data = [
    { stack: 'web', lastVerifiedDaysAgo: 200 }, { stack: 'web', lastVerifiedDaysAgo: 300 }, { stack: 'web', lastVerifiedDaysAgo: 20 }, { stack: 'web', lastVerifiedDaysAgo: 400 },
    { stack: 'api', lastVerifiedDaysAgo: 40 }, { stack: 'api', lastVerifiedDaysAgo: 60 }, { stack: 'api', lastVerifiedDaysAgo: 90 },
    { stack: 'cloud', lastVerifiedDaysAgo: 200 }, { stack: 'cloud', lastVerifiedDaysAgo: 210 },
  ];
  const [ceiling, setCeiling] = useState(365);
  const rows = useMemo(() => data.filter(d => d.lastVerifiedDaysAgo <= ceiling), [ceiling]);
  const v = X96A.measureCrossStackStalenessVariance(rows);
  return (
    <Card title="CrossStackStalenessVariance" note="Idea 53803">
      <Kv k="Stacks" v={v.count} />
      <Kv k="Variance" v={v.variance} />
      <label className="w96a-field">Max age shown (days)
        <input type="number" value={ceiling} onChange={e => setCeiling(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.stack} value={r.staleShare} max={1} />)}
    </Card>
  );
}
export function ForgettingFairnessChecks() {
  const data = [{ stack: 'web', forgotten: 30, total: 300 }, { stack: 'niche-iot', forgotten: 25, total: 40 }, { stack: 'api', forgotten: 15, total: 260 }];
  const v = X96A.auditForgettingFairness(data);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const rows = onlyFlagged ? v.rows.filter(r => r.disproportionate) : v.rows;
  return (
    <Card title="ForgettingFairnessChecks" note="Idea 53804">
      <Kv k="Stacks" v={v.count} />
      <Kv k="Over-erased" v={v.disproportionateCount} />
      <button type="button" onClick={() => setOnlyFlagged(f => !f)}>{onlyFlagged ? 'Show all stacks' : 'Show over-erased only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.stack} parity`} v={r.parityRatio} />)}
    </Card>
  );
}
export function StaleLessonPruning() {
  const data = [
    { lessonId: 'lesson-ssl-always', contradictions: 3, daysSinceWin: 400, outcomeScore: 0.2 },
    { lessonId: 'lesson-recon-first', contradictions: 0, daysSinceWin: 10, outcomeScore: 0.9 },
    { lessonId: 'lesson-legacy-auth', contradictions: 1, daysSinceWin: 100, outcomeScore: 0.5 },
  ];
  const [minSeverity, setMinSeverity] = useState(0);
  const v = X96A.pruneStaleLessons(data);
  const rows = v.rows.filter(r => r.severity >= minSeverity);
  return (
    <Card title="StaleLessonPruning" note="Idea 53805">
      <Kv k="Prunable" v={v.prunableCount} />
      <label className="w96a-field">Min severity ({minSeverity})
        <input type="range" min="0" max="1" step="0.1" value={minSeverity} onChange={e => setMinSeverity(Number(e.target.value))} />
      </label>
      {rows.map(r => <Bar key={r.key} label={r.lessonId} value={r.severity} max={1} />)}
    </Card>
  );
}
export function KnowledgeDecayDashboards() {
  const data = [
    { entryId: 'jwt-notes', category: 'auth', confidence: 0.9, ageDays: 90, halfLifeDays: 90 },
    { entryId: 'cors-notes', category: 'web', confidence: 0.4, ageDays: 300, halfLifeDays: 60, quarantined: true },
    { entryId: 'compliance-basics', category: 'compliance', confidence: 0.8, ageDays: 500, halfLifeDays: 30, protected: true },
    { entryId: 'fresh-recon', category: 'recon', confidence: 0.85, ageDays: 5, halfLifeDays: 120 },
  ];
  const [state, setState] = useState('all');
  const v = X96A.buildKnowledgeDecayDashboard(data);
  const rows = state === 'all' ? v.rows : v.rows.filter(r => r.state === state);
  return (
    <Card title="KnowledgeDecayDashboards" note="Idea 53806">
      <Kv k="Entries" v={v.count} />
      <Kv k="Decayed" v={v.stateCounts.decayed} />
      <label className="w96a-field">State
        <select value={state} onChange={e => setState(e.target.value)}>
          <option value="all">all states</option>
          <option value="decayed">decayed</option>
          <option value="quarantined">quarantined</option>
          <option value="protected">protected</option>
          <option value="stable">stable</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.entryId} · ${r.state}`} v={r.decayedConfidence} />)}
    </Card>
  );
}
export function ForgettingNotificationFeeds() {
  const data = [
    { entryId: 'entry-a', contributor: 'r-a', daysUntilForget: 5 },
    { entryId: 'entry-b', contributor: 'r-b', daysUntilForget: 20 },
    { entryId: 'entry-c', contributor: 'r-c', daysUntilForget: 80 },
  ];
  const [urgency, setUrgency] = useState('all');
  const v = X96A.buildForgettingNotificationFeed(data);
  const rows = urgency === 'all' ? v.rows : v.rows.filter(r => r.urgency === urgency);
  return (
    <Card title="ForgettingNotificationFeeds" note="Idea 53807">
      <Kv k="Critical" v={v.urgencyCounts.critical} />
      <label className="w96a-field">Urgency
        <select value={urgency} onChange={e => setUrgency(e.target.value)}>
          <option value="all">all</option>
          <option value="critical">critical</option>
          <option value="warning">warning</option>
          <option value="gentle">gentle</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.entryId} → ${r.contributor}`} v={`${r.daysUntilForget}d (${r.urgency})`} />)}
    </Card>
  );
}
export function TimeCapsuleKnowledgeSnapshots() {
  const data = [
    { snapshotId: 'capsule-mar', capturedDay: 60, entryCount: 400, integrityScore: 0.95 },
    { snapshotId: 'capsule-jan', capturedDay: 1, entryCount: 350, integrityScore: 0.6 },
  ];
  const [today, setToday] = useState(90);
  const v = X96A.buildTimeCapsuleSnapshots(data, today);
  return (
    <Card title="TimeCapsuleKnowledgeSnapshots" note="Idea 53808">
      <Kv k="Snapshots" v={v.count} />
      <Kv k="Research ready" v={v.readyCount} />
      <label className="w96a-field">Today (day {today})
        <input type="range" min="1" max="400" value={today} onChange={e => setToday(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.snapshotId} age`} v={`${r.ageDays}d`} />)}
    </Card>
  );
}
export function ForgettingRollbackWindows() {
  const [forgotten, setForgotten] = useState(30);
  const v = X96A.planForgettingRollbackWindows([{ entryId: 'entry-x', forgottenDaysAgo: forgotten, rollbackWindowDays: 90 }, { entryId: 'entry-y', forgottenDaysAgo: 120, rollbackWindowDays: 90 }]);
  const row = v.rows.find(r => r.entryId === 'entry-x');
  return (
    <Card title="ForgettingRollbackWindows" note="Idea 53809">
      <Kv k="Restorable" v={v.restorableCount} />
      <label className="w96a-field">Days since forgotten ({forgotten})
        <input type="range" min="0" max="200" value={forgotten} onChange={e => setForgotten(Number(e.target.value))} />
      </label>
      <Kv k="entry-x status" v={row.status} />
      <Kv k="entry-x days left" v={row.daysRemaining} />
    </Card>
  );
}
export function StaleBenchmarkBaselines() {
  const data = [
    { baselineId: 'bench-recon-v1', referenceValue: 120, measuredDaysAgo: 200, driftPct: 18 },
    { baselineId: 'bench-auth-v2', referenceValue: 90, measuredDaysAgo: 10, driftPct: 2 },
  ];
  const [driftCap, setDriftCap] = useState(25);
  const v = X96A.refreshStaleBenchmarkBaselines(data);
  const rows = v.rows.filter(r => Math.abs(r.driftPct) <= driftCap);
  return (
    <Card title="StaleBenchmarkBaselines" note="Idea 53810">
      <Kv k="Refresh due" v={v.dueCount} />
      <label className="w96a-field">Max |drift| shown (%)
        <input type="number" value={driftCap} onChange={e => setDriftCap(Number(e.target.value))} />
      </label>
      {rows.map(r => <Bar key={r.key} label={r.baselineId} value={r.priority} max={1} />)}
    </Card>
  );
}
export function KnowledgeExpiryNotifications() {
  const data = [
    { entryId: 'playbook-old', owner: 'r-a', expiresInDays: -5, notified: false },
    { entryId: 'playbook-soon', owner: 'r-b', expiresInDays: 10, notified: true },
    { entryId: 'playbook-fresh', owner: 'r-c', expiresInDays: 200, notified: false },
  ];
  const [showPending, setShowPending] = useState(false);
  const v = X96A.notifyKnowledgeExpiry(data);
  const rows = showPending ? v.rows.filter(r => r.pending) : v.rows;
  return (
    <Card title="KnowledgeExpiryNotifications" note="Idea 53811">
      <Kv k="Pending alerts" v={v.pendingCount} />
      <button type="button" onClick={() => setShowPending(s => !s)}>{showPending ? 'Show all entries' : 'Show pending only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.entryId} → ${r.owner}`} v={`${r.alert} (${r.expiresInDays}d)`} />)}
    </Card>
  );
}
export function ForgettingDrivenRetraining() {
  const data = [
    { component: 'recommender', forgottenCount: 40, daysSinceLastTrain: 70 },
    { component: 'ranker', forgottenCount: 3, daysSinceLastTrain: 10 },
  ];
  const [events, setEvents] = useState(40);
  const v = X96A.planForgettingDrivenRetraining([{ component: 'recommender', forgottenCount: events, daysSinceLastTrain: 70 }, data[1]]);
  const row = v.rows.find(r => r.component === 'recommender');
  return (
    <Card title="ForgettingDrivenRetraining" note="Idea 53812">
      <Kv k="Due" v={v.dueCount} />
      <label className="w96a-field">Forgotten events ({events})
        <input type="range" min="0" max="60" value={events} onChange={e => setEvents(Number(e.target.value))} />
      </label>
      <Kv k="recommender due" v={String(row.due)} />
      <Bar label="trigger score" value={row.triggerScore} max={1} />
    </Card>
  );
}
export function DefenseChangelogMonitoring() {
  const data = [
    { component: 'oauth-library', changeSeverity: 0.9, entriesAffected: 40, daysSinceChange: 3 },
    { component: 'audit-logger', changeSeverity: 0.3, entriesAffected: 5, daysSinceChange: 30 },
  ];
  const [severity, setSeverity] = useState(0.9);
  const v = X96A.monitorDefenseChangelogs([{ ...data[0], changeSeverity: severity }, data[1]]);
  return (
    <Card title="DefenseChangelogMonitoring" note="Idea 53813">
      <Kv k="High risk" v={v.highRiskCount} />
      <label className="w96a-field">oauth-library severity ({severity})
        <input type="range" min="0" max="1" step="0.05" value={severity} onChange={e => setSeverity(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.component} value={r.risk} max={1} />)}
    </Card>
  );
}
export function StaleClusterDissolution() {
  const data = [
    { clusterId: 'cluster-old-xss', lastSeenDaysAgo: 600, memberCount: 14 },
    { clusterId: 'cluster-api-auth', lastSeenDaysAgo: 30, memberCount: 40 },
    { clusterId: 'cluster-mid', lastSeenDaysAgo: 400, memberCount: 8 },
  ];
  const [state, setState] = useState('all');
  const v = X96A.dissolveStaleClusters(data);
  const rows = state === 'all' ? v.rows : v.rows.filter(r => r.state === state);
  return (
    <Card title="StaleClusterDissolution" note="Idea 53814">
      <Kv k="Dissolve" v={v.dissolveCount} />
      <label className="w96a-field">State
        <select value={state} onChange={e => setState(e.target.value)}>
          <option value="all">all</option>
          <option value="dissolve">dissolve</option>
          <option value="dormant">dormant</option>
          <option value="active">active</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`${r.clusterId} · ${r.state}`} v={`${r.lastSeenDaysAgo}d`} />)}
    </Card>
  );
}
export function KnowledgeProvenanceTracking() {
  const data = [
    { entryId: 'entry-direct', source: 'verified-hunt', sourceTrust: 0.95, chainLength: 1 },
    { entryId: 'entry-forwarded', source: 'third-party-dump', sourceTrust: 0.5, chainLength: 6 },
  ];
  const [hops, setHops] = useState(1);
  const v = X96A.trackKnowledgeProvenance([{ ...data[0], chainLength: hops }, data[1]]);
  const row = v.rows.find(r => r.entryId === 'entry-direct');
  return (
    <Card title="KnowledgeProvenanceTracking" note="Idea 53815">
      <Kv k="Verified chains" v={v.verifiedCount} />
      <label className="w96a-field">Provenance hops ({hops})
        <input type="range" min="0" max="10" value={hops} onChange={e => setHops(Number(e.target.value))} />
      </label>
      <Kv k="entry-direct chain score" v={row.chainScore} />
      <Kv k="entry-direct risk" v={row.risk} />
    </Card>
  );
}
export function ForgettingThresholdTuning() {
  const data = [
    { category: 'payload', threshold: 0.5, falseForgetRate: 0.02, staleRetentionRate: 0.4 },
    { category: 'playbook', threshold: 0.5, falseForgetRate: 0.3, staleRetentionRate: 0.05 },
    { category: 'principle', threshold: 0.6, falseForgetRate: 0.05, staleRetentionRate: 0.1 },
  ];
  const [category, setCategory] = useState('payload');
  const v = X96A.tuneForgettingThresholds(data);
  const row = v.rows.find(r => r.category === category);
  return (
    <Card title="ForgettingThresholdTuning" note="Idea 53816">
      <Kv k="Need tuning" v={v.tuneCount} />
      <label className="w96a-field">Category
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="payload">payload</option>
          <option value="playbook">playbook</option>
          <option value="principle">principle</option>
        </select>
      </label>
      <Kv k="recommendation" v={row.recommendation} />
      <Kv k="recommended threshold" v={row.recommendedThreshold} />
    </Card>
  );
}
export function ExpertForgettingReviews() {
  const data = [
    { reviewId: 'review-q1', quarter: 'Q1', entriesReviewed: 100, entriesOverturned: 5 },
    { reviewId: 'review-q2', quarter: 'Q2', entriesReviewed: 80, entriesOverturned: 30 },
  ];
  const [quarter, setQuarter] = useState('Q1');
  const v = X96A.reviewExpertForgettingVerdicts(data);
  const row = v.rows.find(r => r.quarter === quarter);
  return (
    <Card title="ExpertForgettingReviews" note="Idea 53817">
      <Kv k="Avg overturn" v={v.averageOverturnRate} />
      <label className="w96a-field">Quarter
        <select value={quarter} onChange={e => setQuarter(e.target.value)}>
          <option value="Q1">Q1</option>
          <option value="Q2">Q2</option>
        </select>
      </label>
      <Kv k="overturn rate" v={row.overturnRate} />
      <Kv k="needs attention" v={String(row.needsAttention)} />
    </Card>
  );
}
export function ForgettingSimulationMode() {
  const entries = [
    { entryId: 'old-low-value', ageDays: 500, valueScore: 0.1, category: 'payload' },
    { entryId: 'compliance-core', ageDays: 900, valueScore: 0.05, category: 'compliance' },
    { entryId: 'fresh-note', ageDays: 20, valueScore: 0.9, category: 'playbook' },
  ];
  const [minValue, setMinValue] = useState(0.3);
  const v = X96A.simulateForgettingOutcomes(entries, { maxAgeDays: 365, minValue });
  return (
    <Card title="ForgettingSimulationMode" note="Idea 53818">
      <Kv k="Would forget" v={v.wouldForgetCount} />
      <Kv k="Applied" v={String(v.applied)} />
      <label className="w96a-field">Min value to keep ({minValue})
        <input type="range" min="0" max="1" step="0.05" value={minValue} onChange={e => setMinValue(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.entryId} v={r.wouldForget ? 'would forget' : 'would retain'} />)}
    </Card>
  );
}
export function KnowledgeRevalidationQueues() {
  const data = [
    { entryId: 'entry-critical-old', ageDays: 300, criticality: 0.9, requiresAuth: true },
    { entryId: 'entry-minor-fresh', ageDays: 10, criticality: 0.2 },
  ];
  const [age, setAge] = useState(300);
  const v = X96A.buildKnowledgeRevalidationQueue([{ ...data[0], ageDays: age }, data[1]]);
  const row = v.rows.find(r => r.entryId === 'entry-critical-old');
  return (
    <Card title="KnowledgeRevalidationQueues" note="Idea 53819">
      <Kv k="Queued" v={v.queuedCount} />
      <label className="w96a-field">Critical entry age (days {age})
        <input type="range" min="0" max="365" value={age} onChange={e => setAge(Number(e.target.value))} />
      </label>
      <Kv k="priority" v={row.priority} />
      <Kv k="queued" v={String(row.queued)} />
    </Card>
  );
}
export function StalePromptRetirement() {
  const data = [
    { promptId: 'prompt-legacy', accuracyBefore: 0.8, accuracyNow: 0.3, usesLast30d: 40 },
    { promptId: 'prompt-current', accuracyBefore: 0.8, accuracyNow: 0.78, usesLast30d: 120 },
  ];
  const [now, setNow] = useState(0.3);
  const v = X96A.retireStalePrompts([{ ...data[0], accuracyNow: now }, data[1]]);
  const row = v.rows.find(r => r.promptId === 'prompt-legacy');
  return (
    <Card title="StalePromptRetirement" note="Idea 53820">
      <Kv k="Retired" v={v.retireCount} />
      <label className="w96a-field">Legacy prompt accuracy now ({now})
        <input type="range" min="0" max="0.8" step="0.02" value={now} onChange={e => setNow(Number(e.target.value))} />
      </label>
      <Kv k="decline" v={row.decline} />
      <Kv k="retired" v={String(row.retire)} />
    </Card>
  );
}

export const WAVE96_A_COMPONENTS = [ForgottenKnowledgeGraveyard, KnowledgeRefreshCampaigns, CrossStackStalenessVariance, ForgettingFairnessChecks, StaleLessonPruning, KnowledgeDecayDashboards, ForgettingNotificationFeeds, TimeCapsuleKnowledgeSnapshots, ForgettingRollbackWindows, StaleBenchmarkBaselines, KnowledgeExpiryNotifications, ForgettingDrivenRetraining, DefenseChangelogMonitoring, StaleClusterDissolution, KnowledgeProvenanceTracking, ForgettingThresholdTuning, ExpertForgettingReviews, ForgettingSimulationMode, KnowledgeRevalidationQueues, StalePromptRetirement];

export function Wave96AGallery() {
  return (
    <div className="w96a-gallery">
      {WAVE96_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
