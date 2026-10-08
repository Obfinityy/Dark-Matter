/**
 * RetestSuite.jsx — Infinity AI · Dark-Matter · Wave 54
 * 38 working React components for the retest suite, ideas 52123–52160.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './retestCore.js';

const SAMPLE_FINDING = {
  id: 'f-101', title: 'Reflected XSS on /search', severity: 'high', vulnClass: 'xss',
  target: 'shop', status: 'open', evidenceStrength: 'strong', assignee: 'ria',
  endpoint: '/search', retestHistory: [],
};

function sampleRequest() {
  C.__resetRetestSeq();
  return C.requestRetest(SAMPLE_FINDING, { priority: 'normal' }, 1700000000000).request;
}

/* 52123 — Per-finding retest request. */
export function PerFindingRetestRequest() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52123 · Per-finding retest request</h3>
      <button className="rt54-btn" onClick={() => setRes(C.requestRetest(SAMPLE_FINDING, { requestedBy: 'ria' }, 1700000000000))}>
        Request retest for {SAMPLE_FINDING.id}
      </button>
      {res && res.ok && <p className="rt54-note">queued: {res.request.id} · priority {res.request.priority}</p>}
    </div>
  );
}

/* 52124 — Retest after fix deployed. */
export function RetestAfterFixDeployed() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52124 · Retest after fix deployed</h3>
      <button className="rt54-btn" onClick={() => setRes(C.autoQueueOnFixDeployed(SAMPLE_FINDING, { ref: 'deploy-42' }, 1700000000000))}>
        Mark fix deployed
      </button>
      {res && res.ok && <p className="rt54-note">auto-queued {res.request.id} · trigger {res.request.trigger}</p>}
    </div>
  );
}

/* 52125 — Retest with mutated payloads. */
export function RetestMutatedPayloads() {
  const [payloads, setPayloads] = useState([]);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52125 · Retest with mutated payloads</h3>
      <button className="rt54-btn" onClick={() => setPayloads(C.buildMutatedPayloads('<script>alert(1)</script>', 4))}>
        Generate mutations
      </button>
      <ul className="rt54-list">{payloads.map((p, i) => <li key={i} className="rt54-mono">{p}</li>)}</ul>
    </div>
  );
}

/* 52126 — Scheduled retest. */
export function ScheduledRetest() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52126 · Scheduled retest</h3>
      <button className="rt54-btn" onClick={() => setRes(C.scheduleRetest(sampleRequest(), 1700000000000 + 86400000, 1700000000000))}>
        Schedule +24h
      </button>
      {res && res.ok && <p className="rt54-note">scheduled at {new Date(res.request.scheduledAt).toISOString()} · {res.request.reminders.length} reminders</p>}
    </div>
  );
}

/* 52127 — Retest queue dashboard. */
export function RetestQueueDashboard() {
  const queue = [sampleRequest(), sampleRequest()].map((r, i) => ({ ...r, status: i === 0 ? 'running' : 'queued' }));
  const s = C.queueSummary(queue, 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52127 · Retest queue dashboard</h3>
      <p className="rt54-note">total {s.total} · pending {s.pending} · running {s.running} · ETA {Math.round(s.etaMs / 60000)} min</p>
      <p className="rt54-note">by status: {Object.entries(s.byStatus).map(([k, v]) => `${k}:${v}`).join(' ')}</p>
    </div>
  );
}

/* 52128 — Retest scope picker. */
export function RetestScopePicker() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52128 · Retest scope picker</h3>
      <button className="rt54-btn" onClick={() => setRes(C.applyScopePicker(sampleRequest(), { endpoints: ['/search', '/login'], payloadClasses: ['xss'] }))}>
        Apply scope
      </button>
      {res && res.ok && <p className="rt54-note">endpoints: {res.request.scope.endpoints.join(', ')}</p>}
    </div>
  );
}

/* 52129 — Retest report diff. */
export function RetestReportDiff() {
  const d = C.diffRetestReport(SAMPLE_FINDING, { stillVulnerable: false });
  const d2 = C.diffRetestReport(SAMPLE_FINDING, { stillVulnerable: true });
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52129 · Retest report diff</h3>
      <p className="rt54-note">fix scenario: {d.verdict} · {d.note}</p>
      <p className="rt54-note">persist scenario: {d2.verdict} · {d2.note}</p>
    </div>
  );
}

/* 52130 — Retest cost estimate. */
export function RetestCostEstimate() {
  const e = C.estimateRetestCost({ ...sampleRequest(), options: { depth: 'deep', brain: 'vision' } });
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52130 · Retest cost estimate</h3>
      <p className="rt54-note">{e.computeUnits} compute units · ~{e.estimatedMinutes} min</p>
    </div>
  );
}

/* 52131 — Retest priority levels. */
export function RetestPriorityLevels() {
  const [order, setOrder] = useState([]);
  const run = () => {
    const q = ['low', 'urgent', 'normal'].map((p, i) => ({ ...sampleRequest(), id: `rt-p${i}`, priority: p, requestedAt: 1700000000000 + i }));
    setOrder(C.prioritizeQueue(q).map((r) => r.priority));
  };
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52131 · Retest priority levels</h3>
      <button className="rt54-btn" onClick={run}>Prioritize</button>
      {order.length > 0 && <p className="rt54-note">order: {order.join(' → ')}</p>}
    </div>
  );
}

/* 52132 — One-click retest from triage. */
export function TriageQuickRetest() {
  const [res, setRes] = useState(null);
  const thin = { ...SAMPLE_FINDING, evidenceStrength: 'thin' };
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52132 · One-click retest from triage</h3>
      <button className="rt54-btn" onClick={() => setRes(C.triageQuickRetest(thin, 1700000000000))}>Quick retest</button>
      {res && res.ok && <p className="rt54-note">trigger: {res.request.trigger} · {res.request.id}</p>}
    </div>
  );
}

/* 52133 — "Needs more evidence" auto-retest. */
export function ThinEvidenceAutoRetest() {
  const r = C.autoRetestThinEvidence(
    [{ ...SAMPLE_FINDING, evidenceStrength: 'thin' }, SAMPLE_FINDING], 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52133 · Thin-evidence auto-retest</h3>
      <p className="rt54-note">{r.queued.length} auto-queued · {r.skipped} skipped</p>
    </div>
  );
}

/* 52134 — Retest with a different brain. */
export function RetestDifferentBrain() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52134 · Retest with a different brain</h3>
      {C.RETEST_BRAINS.filter((b) => b.id !== 'default').map((b) => (
        <button key={b.id} className="rt54-btn" onClick={() => setRes(C.retestWithBrain(sampleRequest(), b.id))}>{b.label}</button>
      ))}
      {res && res.ok && <p className="rt54-note">second opinion via {res.request.options.brain}</p>}
    </div>
  );
}

/* 52135 — Retest stealth-mode toggle. */
export function RetestStealthToggle() {
  const [on, setOn] = useState(false);
  const r = C.setStealthMode(sampleRequest(), on).request;
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52135 · Retest stealth-mode toggle</h3>
      <button className="rt54-btn" onClick={() => setOn(!on)}>{on ? 'Disable stealth' : 'Enable stealth'}</button>
      <p className="rt54-note">stealth: {String(r.options.stealth)}</p>
    </div>
  );
}

/* 52136 — Retest concurrency limits. */
export function RetestConcurrencyLimits() {
  const c = C.checkConcurrency('shop', [
    { target: 'shop', status: 'running' }, { target: 'shop', status: 'running' }, { target: 'blog', status: 'running' },
  ], 2);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52136 · Retest concurrency limits</h3>
      <p className="rt54-note">{c.active}/{c.cap} active on {c.target} · allowed: {String(c.allowed)}</p>
      {c.reason && <p className="rt54-note">{c.reason}</p>}
    </div>
  );
}

/* 52137 — Retest completion notifications. */
export function RetestCompletionNotifications() {
  const n = C.buildCompletionNotification(sampleRequest(), 'fixed', ['ria', 'sam'], 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52137 · Retest completion notifications</h3>
      <p className="rt54-note">{n.subject}</p>
      <p className="rt54-note">to: {n.to.join(', ')}</p>
    </div>
  );
}

/* 52138 — Retest history per finding. */
export function RetestHistoryPerFinding() {
  const f = C.appendRetestHistory(SAMPLE_FINDING, { id: 'att-1', at: 1700000000000, payload: '<script>', outcome: 'ok', verdict: 'fixed' });
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52138 · Retest history per finding</h3>
      <ul className="rt54-list">{f.retestHistory.map((h) => <li key={h.attemptId} className="rt54-note">{h.attemptId} · {h.verdict}</li>)}</ul>
    </div>
  );
}

/* 52139 — Retest SLA tracking. */
export function RetestSlaTracking() {
  const r = { ...sampleRequest(), requestedAt: 1700000000000 - 5 * 3600000, status: 'running' };
  const s = C.slaStatus(r, SAMPLE_FINDING, 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52139 · Retest SLA tracking</h3>
      <p className="rt54-note">target {s.targetMs / 3600000}h · elapsed {(s.elapsedMs / 3600000).toFixed(1)}h · breached: {String(s.breached)}</p>
    </div>
  );
}

/* 52140 — Bulk retest requests. */
export function BulkRetestRequests() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52140 · Bulk retest requests</h3>
      <button className="rt54-btn" onClick={() => setRes(C.bulkRequestRetests([SAMPLE_FINDING, { ...SAMPLE_FINDING, id: 'f-102' }], { priority: 'urgent' }, 1700000000000))}>
        Queue 2 retests
      </button>
      {res && <p className="rt54-note">{res.count} requests queued</p>}
    </div>
  );
}

/* 52141 — Retest request templates. */
export function RetestRequestTemplates() {
  const [res, setRes] = useState(null);
  const run = () => {
    const saved = C.saveRetestTemplate([], 'Prod stealth', { stealth: true, priority: 'urgent' }, 1700000000000);
    setRes(C.applyRetestTemplate(SAMPLE_FINDING, saved.template, {}, 1700000000000));
  };
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52141 · Retest request templates</h3>
      <button className="rt54-btn" onClick={run}>Save + apply template</button>
      {res && res.ok && <p className="rt54-note">template {res.request.templateId} → {res.request.id}</p>}
    </div>
  );
}

/* 52142 — Retest on deploy webhook. */
export function RetestDeployWebhook() {
  const r = C.deployWebhookTrigger([SAMPLE_FINDING], { id: 'dep-1', target: 'shop', ref: 'abc123' }, 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52142 · Retest on deploy webhook</h3>
      <p className="rt54-note">deploy dep-1 matched {r.matched} findings → {r.requests.length} retests</p>
    </div>
  );
}

/* 52143 — Retest approval workflow. */
export function RetestApprovalWorkflow() {
  const [res, setRes] = useState(null);
  const run = () => {
    const pending = C.requestRetestApproval(sampleRequest(), 'lead-rao', 1700000000000);
    setRes(C.decideRetestApproval(pending, true, 1700000000000));
  };
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52143 · Retest approval workflow</h3>
      <button className="rt54-btn" onClick={run}>Request + approve</button>
      {res && <p className="rt54-note">decision: {res.approval.decision} · status {res.request.status}</p>}
    </div>
  );
}

/* 52144 — Retest budget caps. */
export function RetestBudgetCaps() {
  const ok = C.checkRetestBudget(40, 100, 1700000000000);
  const warn = C.checkRetestBudget(85, 100, 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52144 · Retest budget caps</h3>
      <p className="rt54-note">40/100: {ok.state} · {ok.message}</p>
      <p className="rt54-note">85/100: {warn.state} · {warn.message}</p>
    </div>
  );
}

/* 52145 — Retest evidence refresh. */
export function RetestEvidenceRefresh() {
  const a = C.refreshRetestEvidence({ id: 'att-1', evidence: [{ kind: 'snippet', body: 'old' }] },
    [{ kind: 'http', label: 'fresh response', body: '200 OK — no reflection' }]);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52145 · Retest evidence refresh</h3>
      <p className="rt54-note">{a.evidence.length} fresh items · stale PoC replaced: {String(a.stalePoCReplaced)}</p>
    </div>
  );
}

/* 52146 — Retest across environments. */
export function RetestCrossEnvironment() {
  const c = C.compareEnvironments({
    staging: { verdict: 'fixed' },
    production: { verdict: 'fixed' },
  });
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52146 · Retest across environments</h3>
      <p className="rt54-note">{c.verdict}: {c.note}</p>
    </div>
  );
}

/* 52147 — Off-hours retest windows. */
export function OffHoursRetestWindows() {
  const windows = [{ days: [6, 0], startHour: 1, endHour: 5 }];
  const inside = C.inRetestWindow(Date.UTC(2023, 10, 18, 2, 30), windows);
  const outside = C.inRetestWindow(Date.UTC(2023, 10, 15, 12, 0), windows);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52147 · Off-hours retest windows</h3>
      <p className="rt54-note">Sat 02:30 UTC in window: {String(inside)} · Wed 12:00 UTC in window: {String(outside)}</p>
    </div>
  );
}

/* 52148 — Retest rate-limit awareness. */
export function RetestRateLimitAwareness() {
  const b = C.backoffForRetest(3);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52148 · Retest rate-limit awareness</h3>
      <p className="rt54-note">backoff {b.delayMs} ms · {b.reason}</p>
    </div>
  );
}

/* 52149 — Retest dry-run preview. */
export function RetestDryRunPreview() {
  const r = { ...sampleRequest(), originalPayload: '<img src=x onerror=alert(1)>', scope: { endpoints: ['/search'] } };
  const p = C.dryRunPreview(r);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52149 · Retest dry-run preview</h3>
      <p className="rt54-note">{p.totalRequests} requests would be sent · nothing executed</p>
    </div>
  );
}

/* 52150 — Retest with authenticated session. */
export function RetestAuthenticatedSession() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52150 · Retest with authenticated session</h3>
      <button className="rt54-btn" onClick={() => setRes(C.attachAuthSession(sampleRequest(), { id: 'sess-7', principal: 'tester' }))}>
        Attach session sess-7
      </button>
      {res && res.ok && <p className="rt54-note">session {res.request.auth.sessionId} · {res.request.auth.principal}</p>}
    </div>
  );
}

/* 52151 — Retest session replay. */
export function RetestSessionReplay() {
  const plan = C.buildReplayPlan([
    { method: 'GET', url: '/search?q=1' },
    { method: 'GET', url: '/search?q=<script>' },
  ]);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52151 · Retest session replay</h3>
      <p className="rt54-note">{plan.total} steps · deterministic: {String(plan.deterministic)}</p>
      <ul className="rt54-list">{plan.steps.map((s) => <li key={s.order} className="rt54-mono">{s.order}. {s.method} {s.url}</li>)}</ul>
    </div>
  );
}

/* 52152 — Retest parameter sweep. */
export function RetestParameterSweep() {
  const s = C.parameterSweep('q', ['query', 'keyword', 'q']);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52152 · Retest parameter sweep</h3>
      <p className="rt54-note">sweeping {s.count} params: {s.swept.join(', ')}</p>
    </div>
  );
}

/* 52153 — Retest depth setting. */
export function RetestDepthSetting() {
  const [mode, setMode] = useState('shallow');
  const cfg = C.depthConfig(mode);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52153 · Retest depth setting</h3>
      {Object.keys(C.RETEST_DEPTHS).map((m) => (
        <button key={m} className="rt54-btn" onClick={() => setMode(m)}>{m}</button>
      ))}
      {cfg.ok && <p className="rt54-note">{cfg.config.label} · max {cfg.config.maxRequests} requests</p>}
    </div>
  );
}

/* 52154 — Retest engine selection. */
export function RetestEngineSelection() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52154 · Retest engine selection</h3>
      <button className="rt54-btn" onClick={() => setRes(C.selectRetestEngines(sampleRequest(), ['vulnDetector'], ['vulnDetector', 'chainBuilder']))}>
        Use vulnDetector only
      </button>
      {res && res.ok && <p className="rt54-note">engines: {res.request.engines.join(', ')}</p>}
    </div>
  );
}

/* 52155 — Retest execution logs. */
export function RetestExecutionLogs() {
  const a = C.appendRetestLog({ id: 'att-1' }, { step: 'send', detail: 'GET /search?q=<script>' }, 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52155 · Retest execution logs</h3>
      <pre className="rt54-mono">{C.formatRetestLog(a)}</pre>
    </div>
  );
}

/* 52156 — Retest failure alerts. */
export function RetestFailureAlerts() {
  const a = C.buildFailureAlert(sampleRequest(), { kind: 'target-down', message: 'connection refused' }, ['ria'], 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52156 · Retest failure alerts</h3>
      <p className="rt54-note">{a.subject}</p>
      <p className="rt54-note">{a.body}</p>
    </div>
  );
}

/* 52157 — Retest assignment. */
export function RetestAssignment() {
  const [res, setRes] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52157 · Retest assignment</h3>
      <button className="rt54-btn" onClick={() => setRes(C.assignRetest(sampleRequest(), 'sam', 1700000000000 + 86400000, 1700000000000))}>
        Assign to sam
      </button>
      {res && res.ok && <p className="rt54-note">assignee {res.request.assignee} · due {new Date(res.request.dueAt).toISOString().slice(0, 10)}</p>}
    </div>
  );
}

/* 52158 — Retest vs regression distinction. */
export function RetestVsRegression() {
  const a = C.classifyRetestWork(sampleRequest());
  const b = C.classifyRetestWork({ ...sampleRequest(), kind: 'regression' });
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52158 · Retest vs regression distinction</h3>
      <p className="rt54-note">{a.label} → {a.workflow}</p>
      <p className="rt54-note">{b.label} → {b.workflow}</p>
    </div>
  );
}

/* 52159 — "Still vulnerable" escalation. */
export function StillVulnerableEscalation() {
  const e = C.escalateStillVulnerable(sampleRequest(), { ...SAMPLE_FINDING, assignee: 'ria' }, 'mgr-dev', 1700000000000);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52159 · "Still vulnerable" escalation</h3>
      {e.ok && <p className="rt54-note">{e.escalation.reason} → {e.escalation.escalatedTo.join(', ')}</p>}
    </div>
  );
}

/* 52160 — Verification certificate. */
export function VerificationCertificate() {
  const [cert, setCert] = useState(null);
  return (
    <div className="rt54-card">
      <h3 className="rt54-title">52160 · Verification certificate</h3>
      <button className="rt54-btn" onClick={() => setCert(C.issueVerificationCertificate(SAMPLE_FINDING, 'fixed', 'infinity-ai', 1700000000000))}>
        Issue certificate
      </button>
      {cert && cert.ok && (
        <p className="rt54-note">verified fixed on {cert.certificate.verifiedFixedOn} · sig {cert.certificate.signature}</p>
      )}
    </div>
  );
}

export function RetestSuiteGallery() {
  return (
    <div className="rt54-gallery">
      <PerFindingRetestRequest />
      <RetestAfterFixDeployed />
      <RetestMutatedPayloads />
      <ScheduledRetest />
      <RetestQueueDashboard />
      <RetestScopePicker />
      <RetestReportDiff />
      <RetestCostEstimate />
      <RetestPriorityLevels />
      <TriageQuickRetest />
      <ThinEvidenceAutoRetest />
      <RetestDifferentBrain />
      <RetestStealthToggle />
      <RetestConcurrencyLimits />
      <RetestCompletionNotifications />
      <RetestHistoryPerFinding />
      <RetestSlaTracking />
      <BulkRetestRequests />
      <RetestRequestTemplates />
      <RetestDeployWebhook />
      <RetestApprovalWorkflow />
      <RetestBudgetCaps />
      <RetestEvidenceRefresh />
      <RetestCrossEnvironment />
      <OffHoursRetestWindows />
      <RetestRateLimitAwareness />
      <RetestDryRunPreview />
      <RetestAuthenticatedSession />
      <RetestSessionReplay />
      <RetestParameterSweep />
      <RetestDepthSetting />
      <RetestEngineSelection />
      <RetestExecutionLogs />
      <RetestFailureAlerts />
      <RetestAssignment />
      <RetestVsRegression />
      <StillVulnerableEscalation />
      <VerificationCertificate />
    </div>
  );
}
