/**
 * RegressionSuite.jsx — Infinity AI · Dark-Matter · Wave 61
 * 29 working React components for the post-fix regression suite, ideas 52412–52440.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as RG from './regressCore.js';

const NOW = 1700000000000;
const DAY = 24 * 3600000;
const HOUR = 3600000;

const RF1 = { id: 'f-621', state: 'InProgress', severity: 'high', endpoint: 'https://acme.example/login', target: 'acme-prod', assetId: 'asset-1', assetOwner: 'aria', title: 'SQLi in login' };
const RF2 = { id: 'f-622', state: 'InRetest', severity: 'medium', endpoint: 'https://acme.example/search', target: 'acme-prod', assetId: 'asset-2', assetOwner: 'kai', title: 'XSS in search' };

function Note({ children }) { return <p className="rg61-note">{children}</p>; }
function Mono({ children }) { return <pre className="rg61-mono">{children}</pre>; }

/* 52412 — Fix assignment. */
export function FixAssignment() {
  const assetMap = { 'asset-1': { owner: 'aria', team: 'appsec', securityChampion: 'bhavesh' } };
  const result = RG.suggestFixOwners(RF1, assetMap);
  const suggestions = result.suggestions || [];
  const [assigned, setAssigned] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52412 · Fix assignment</h3>
      <Note>Owner candidates for f-621 drawn from the asset map.</Note>
      <ul className="rg61-list">
        {suggestions.map((s, i) => (
          <li key={i}>
            <span className="rg61-chip">{s.assignee || s.owner}</span>
            <span>{s.role} — {s.basis}</span>
            <div className="rg61-row">
              <button className="rg61-btn" onClick={() => setAssigned(RG.assignFixOwner('f-621', s.assignee || s.owner, NOW))}>Assign</button>
            </div>
          </li>
        ))}
      </ul>
      {assigned && <Mono>{JSON.stringify(assigned, null, 2)}</Mono>}
    </div>
  );
}

/* 52413 — Fix due dates. */
export function FixDueDates() {
  const [severity, setSeverity] = useState('high');
  const due = RG.fixDueDate(severity, NOW);
  const payload = RG.fixCalendarPayload('f-621', due.dueAt);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52413 · Fix due dates</h3>
      <Note>SLA-driven due date with a calendar payload for f-621.</Note>
      <div className="rg61-row">
        <select className="rg61-select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
          <option value="info">info</option>
        </select>
        <span className="rg61-chip">due: {new Date(due.dueAt).toISOString()}</span>
      </div>
      <Mono>{JSON.stringify(payload, null, 2)}</Mono>
    </div>
  );
}

/* 52414 — Verify with retest. */
export function VerifyWithRetest() {
  const [action, setAction] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52414 · Verify with retest</h3>
      <Note>One-click action that opens the retest flow for f-621.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setAction(RG.verifyWithRetestAction('f-621', NOW))}>Open retest</button>
      </div>
      {action && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">{(action.action || {}).deeplink}</span>
          </div>
          <Mono>{JSON.stringify(action, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52415 — Remediation kanban. */
export function RemediationKanban() {
  const [board, setBoard] = useState({
    cards: [{ findingId: 'f-621', column: 'ToFix' }, { findingId: 'f-622', column: 'Fixing' }],
    wipLimits: { Fixing: 1 }
  });
  const columns = RG.KANBAN_COLUMNS || ['ToFix', 'Fixing', 'Verifying', 'Done'];
  const [blockedMsg, setBlockedMsg] = useState('');
  const move = (findingId, to) => {
    const r = RG.kanbanReducer(board, { type: 'move', findingId, to });
    if (r.ok) { setBoard({ ...board, cards: r.cards }); setBlockedMsg(''); }
    else setBlockedMsg(r.reason);
  };
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52415 · Remediation kanban</h3>
      <Note>WIP limit on Fixing is 1 and f-622 already occupies it, so moving f-621 into Fixing is blocked by the reducer.</Note>
      {blockedMsg && <Note>Move blocked: {blockedMsg}</Note>}
      {columns.map((col) => (
        <div key={col}>
          <div className="rg61-row">
            <span className="rg61-chip">{col}</span>
            {board.wipLimits && board.wipLimits[col] ? <span className="rg61-chip">WIP {board.wipLimits[col]}</span> : null}
          </div>
          <ul className="rg61-list">
            {board.cards.filter((c) => c.column === col).map((c) => (
              <li key={c.findingId}>
                <span className="rg61-chip">{c.findingId}</span>
                <div className="rg61-row">
                  {columns.filter((t) => t !== col).map((t) => (
                    <button key={t} className="rg61-btn" onClick={() => move(c.findingId, t)}>→ {t}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* 52416 — Per-finding fix notes. */
export function PerFindingFixNotes() {
  const [notes, setNotes] = useState([]);
  const [summary, setSummary] = useState('');
  const [files, setFiles] = useState('');
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52416 · Per-finding fix notes</h3>
      <Note>Append an engineer's fix note to f-621 with summary and touched files.</Note>
      <div className="rg61-row">
        <input className="rg61-input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary" />
        <input className="rg61-input" value={files} onChange={(e) => setFiles(e.target.value)} placeholder="Files, comma separated" />
        <button className="rg61-btn" onClick={() => { const r = RG.addFixNote(RF1, { summary, files: files.split(',').map((f) => f.trim()).filter(Boolean) }, NOW); if (r.ok) setNotes([...notes, r.note]); setSummary(''); setFiles(''); }}>Add note</button>
      </div>
      <ul className="rg61-list">
        {notes.map((n, i) => (
          <li key={i}><span className="rg61-chip">{new Date(n.at).toISOString()}</span> {n.summary} {(n.files || []).join(', ')}</li>
        ))}
      </ul>
    </div>
  );
}

/* 52417 — Code commit linking. */
export function CodeCommitLinking() {
  const linked = RG.linkCommit('f-621', { sha: 'abc1234', url: 'https://github.com/acme/app/commit/abc1234', filesChanged: 3, additions: 40, deletions: 12 }, NOW);
  const linkStats = (linked.link || {}).stats || {};
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52417 · Code commit linking</h3>
      <Note>Fix commit abc1234 linked to f-621.</Note>
      <div className="rg61-row">
        <span className="rg61-chip">provider: {(linked.link || {}).provider}</span>
        <span className="rg61-chip">{linkStats.filesChanged} files</span>
        <span className="rg61-chip">+{linkStats.additions}/−{linkStats.deletions}</span>
      </div>
      <Mono>{JSON.stringify(linked, null, 2)}</Mono>
    </div>
  );
}

/* 52418 — One-click regression hunt. */
export function OneClickRegressionHunt() {
  const [launch, setLaunch] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52418 · One-click regression hunt</h3>
      <Note>Launch a regression hunt for f-621 against its own endpoint.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setLaunch(RG.oneClickRegressionHunt(RF1, { endpoints: [RF1.endpoint] }, NOW))}>Launch regression hunt</button>
      </div>
      {launch && <Mono>{JSON.stringify(launch, null, 2)}</Mono>}
    </div>
  );
}

/* 52419 — Regression scope builder. */
export function RegressionScopeBuilder() {
  const [scope, setScope] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52419 · Regression scope builder</h3>
      <Note>Derive endpoints and finding ids for a regression run against acme-prod.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setScope(RG.buildRegressionScope([RF1, RF2], 'acme-prod', NOW))}>Build scope</button>
      </div>
      {scope && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">{(scope.endpoints || []).length} endpoints</span>
            <span className="rg61-chip">{(scope.findingIds || []).length} findings</span>
          </div>
          <Mono>{JSON.stringify(scope, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52420 — Deploy-triggered regression. */
export function DeployTriggeredRegression() {
  const deployEvent = { deployId: 'd-99', target: 'acme-prod', environment: 'production', ref: 'main' };
  const [hunt, setHunt] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52420 · Deploy-triggered regression</h3>
      <Note>Deploy d-99 to production on main can fire a regression hunt automatically.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setHunt(RG.deployTriggeredRegression(deployEvent, NOW))}>Trigger from deploy</button>
      </div>
      {hunt && <Mono>{JSON.stringify(hunt, null, 2)}</Mono>}
    </div>
  );
}

/* 52421 — Cron scheduled regression. */
export function CronScheduledRegression() {
  const [expr, setExpr] = useState('0 2 * * 1');
  const schedule = RG.cronRegressionSchedule(expr, 'acme-prod', { timezone: 'Asia/Kolkata', tzOffsetMin: 330 }, NOW);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52421 · Cron scheduled regression</h3>
      <Note>Recurring regression hunt on acme-prod, scheduled in Asia/Kolkata time.</Note>
      <div className="rg61-row">
        <input className="rg61-input" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="Cron expression" />
      </div>
      <div className="rg61-row">
        <span className="rg61-chip">next run: {new Date(schedule.nextRun).toISOString()}</span>
      </div>
      <Mono>{JSON.stringify(schedule, null, 2)}</Mono>
    </div>
  );
}

/* 52422 — Regression diff report. */
export function RegressionDiffReport() {
  const baseline = [{ id: 'f-621', status: 'open' }, { id: 'f-620', status: 'open' }];
  const current = [{ id: 'f-621', status: 'closed' }, { id: 'f-623', status: 'open' }];
  const report = RG.regressionDiffReport(baseline, current);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52422 · Regression diff report</h3>
      <Note>Baseline versus current findings after the regression run.</Note>
      <div className="rg61-row">
        <span className="rg61-chip">verdict: {report.verdict}</span>
      </div>
      <ul className="rg61-list">
        {(report.fixed || []).map((f, i) => <li key={'f' + i}><span className="rg61-chip">{f.id || f}</span> fixed</li>)}
        {(report.newFindings || report.new || []).map((f, i) => <li key={'n' + i}><span className="rg61-chip">{f.id || f}</span> new</li>)}
        {(report.stillVulnerable || []).map((f, i) => <li key={'o' + i}><span className="rg61-chip">{f.id || f}</span> still vulnerable</li>)}
      </ul>
      <Mono>{JSON.stringify(report, null, 2)}</Mono>
    </div>
  );
}

/* 52423 — Regression cadence presets. */
export function RegressionCadencePresets() {
  const [preset, setPreset] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52423 · Regression cadence presets</h3>
      <Note>Named schedules resolved to cron expressions for acme-prod.</Note>
      <div className="rg61-row">
        {['weekly', 'biweekly', 'monthly'].map((name) => (
          <button key={name} className="rg61-btn" onClick={() => setPreset(RG.regressionCadencePreset(name, 'acme-prod', NOW))}>{name}</button>
        ))}
      </div>
      {preset && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">{(preset.schedule || {}).expr}</span>
            <span className="rg61-chip">next: {new Date(preset.schedule.nextRun).toISOString()}</span>
          </div>
          <Mono>{JSON.stringify(preset, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52424 — Post-fix verification scheduling. */
export function PostFixVerificationScheduling() {
  const [schedule, setSchedule] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52424 · Post-fix verification scheduling</h3>
      <Note>Schedule the retest verification after f-621's fix deploys.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setSchedule(RG.schedulePostFixVerification('f-621', NOW))}>Schedule verification</button>
      </div>
      {schedule && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">verify at: {new Date(schedule.verifyAt).toISOString()}</span>
          </div>
          <Mono>{JSON.stringify(schedule, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52425 — Regression hunt templates. */
export function RegressionHuntTemplates() {
  const [template, setTemplate] = useState(null);
  const [launch, setLaunch] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52425 · Regression hunt templates</h3>
      <Note>Save a reusable hunt template, then apply it to acme-staging.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => { const t = RG.saveRegressionTemplate('weekly-depth-quick', { depth: 'quick', engines: ['vulnDetector'], scopeRules: ['recently-fixed'] }); if (t.ok) setTemplate(t.template); }}>Save template</button>
        <button className="rg61-btn" onClick={() => template && setLaunch(RG.applyRegressionTemplate(template, 'acme-staging', NOW))}>Apply to acme-staging</button>
      </div>
      {launch && <Mono>{JSON.stringify(launch, null, 2)}</Mono>}
    </div>
  );
}

/* 52426 — Regression notifications. */
export function RegressionNotifications() {
  const hunt = { id: 'rgh-1', target: 'acme-prod', owner: 'bhavesh' };
  const [eventType, setEventType] = useState('finish');
  const message = RG.regressionNotifications(hunt, { type: eventType }, NOW);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52426 · Regression notifications</h3>
      <Note>Notification text for lifecycle events on regression hunt rgh-1.</Note>
      <div className="rg61-row">
        <select className="rg61-select" value={eventType} onChange={(e) => setEventType(e.target.value)}>
          <option value="start">start</option>
          <option value="finish">finish</option>
          <option value="verdict">verdict</option>
        </select>
      </div>
      <Mono>{typeof message === 'string' ? message : JSON.stringify(message, null, 2)}</Mono>
    </div>
  );
}

/* 52427 — Regression auto-compare. */
export function RegressionAutoCompare() {
  const [diff, setDiff] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52427 · Regression auto-compare</h3>
      <Note>Compare regression run rg-2 against the original hunt h-1.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setDiff(RG.autoCompareRegression({ id: 'rg-2', findings: [{ id: 'f-621', status: 'open' }] }, { id: 'h-1', findings: [{ id: 'f-621', status: 'open' }, { id: 'f-620', status: 'open' }] }))}>Compare runs</button>
      </div>
      {diff && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">verdict: {(diff.diff || diff).verdict}</span>
          </div>
          <Mono>{JSON.stringify(diff, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52428 — Regression cost estimate. */
export function RegressionCostEstimate() {
  const [depth, setDepth] = useState('quick');
  const cost = RG.estimateRegressionCost({ scope: { endpoints: ['a', 'b', 'c'] }, depth });
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52428 · Regression cost estimate</h3>
      <Note>Estimated runtime for a three-endpoint regression run at the chosen depth.</Note>
      <div className="rg61-row">
        <select className="rg61-select" value={depth} onChange={(e) => setDepth(e.target.value)}>
          <option value="quick">quick</option>
          <option value="full">full</option>
        </select>
        <span className="rg61-chip">{cost.estimatedMinutes} minutes</span>
        <span className="rg61-chip">{cost.estimatedComputeUnits} units</span>
      </div>
      <Mono>{JSON.stringify(cost, null, 2)}</Mono>
    </div>
  );
}

/* 52429 — Quick vs full regression. */
export function QuickVsFullRegression() {
  const [depth, setDepth] = useState('quick');
  const config = RG.regressionDepthConfig(depth);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52429 · Quick vs full regression</h3>
      <Note>Depth presets expand into the engine checks each run will execute.</Note>
      <div className="rg61-row">
        {['quick', 'full'].map((d) => (
          <button key={d} className="rg61-btn" onClick={() => setDepth(d)}>{d}</button>
        ))}
      </div>
      <ul className="rg61-list">
        {(config.checks || []).map((c, i) => <li key={i}><span className="rg61-chip">{c}</span></li>)}
      </ul>
      <Mono>{JSON.stringify(config, null, 2)}</Mono>
    </div>
  );
}

/* 52430 — Engine-pinned regression. */
export function EnginePinnedRegression() {
  const [launch, setLaunch] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52430 · Engine-pinned regression</h3>
      <Note>Pin engine versions so the rg-3 rerun reproduces the original analysis.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setLaunch(RG.pinEngines({ id: 'rg-3' }, { vulnDetector: '3.1.0', riskScorer: '2.0.4' }))}>Pin engines</button>
      </div>
      {launch && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">vulnDetector 3.1.0</span>
            <span className="rg61-chip">riskScorer 2.0.4</span>
          </div>
          <Mono>{JSON.stringify(launch, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52431 — New engine regression. */
export function NewEngineRegression() {
  const [result, setResult] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52431 · New engine regression</h3>
      <Note>Fold newly released engines into an existing launch plan.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setResult(RG.includeNewEngines({ id: 'rg-3', engines: { vulnDetector: '3.1.0' } }, [{ name: 'secretScanner', version: '1.2.0' }]))}>Include new engines</button>
      </div>
      {result && (
        <>
          <div className="rg61-row">
            {((result.added || []).map((e) => e.name || e)).map((name, i) => <span key={i} className="rg61-chip">added: {name}</span>)}
          </div>
          <Mono>{JSON.stringify(result, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52432 — Cross-environment regression. */
export function CrossEnvironmentRegression() {
  const [result, setResult] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52432 · Cross-environment regression</h3>
      <Note>Replay the rg-3 regression plan against staging and production.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setResult(RG.crossEnvironmentRegression({ id: 'rg-3' }, ['staging', 'production']))}>Expand environments</button>
      </div>
      {result && (
        <>
          <div className="rg61-row">
            {((result.job || {}).environments || []).map((e, i) => <span key={i} className="rg61-chip">{e}</span>)}
          </div>
          <Mono>{JSON.stringify(result, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52433 — Regression queue. */
export function RegressionQueue() {
  const [queue, setQueue] = useState([]);
  const add = (hunt, opts) => { const r = RG.regressionQueueAdd(queue, hunt, opts); if (r.ok) setQueue(r.queue); };
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52433 · Regression queue</h3>
      <Note>Pending regression hunts ordered by priority.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => add({ id: 'rg-10', target: 'acme-prod' }, { priority: 'high', owner: 'aria' })}>Queue high-priority hunt</button>
        <button className="rg61-btn" onClick={() => add({ id: 'rg-11', target: 'acme-staging' }, { priority: 'normal', owner: 'kai' })}>Queue normal hunt</button>
      </div>
      <ul className="rg61-list">
        {queue.map((h, i) => (
          <li key={i}><span className="rg61-chip">{h.huntId}</span> {h.priority} — owner: {h.owner} ({h.status})</li>
        ))}
      </ul>
    </div>
  );
}

/* 52434 — Regression calendar view. */
export function RegressionCalendarView() {
  const hunts = [
    { id: 'c-1', target: 'acme-prod', nextRun: NOW + 2 * DAY, preset: 'weekly', owner: 'bhavesh' },
    { id: 'c-2', target: 'acme-staging', nextRun: NOW + DAY, expr: '0 2 * * 1' }
  ];
  const payload = RG.regressionCalendarPayload(hunts, NOW);
  const upcoming = payload.upcoming || payload.hunts || hunts;
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52434 · Regression calendar view</h3>
      <Note>Upcoming scheduled regression hunts with their next run times.</Note>
      <ul className="rg61-list">
        {upcoming.map((h, i) => (
          <li key={i}><span className="rg61-chip">{h.id}</span> {h.target} — {new Date(h.nextRun).toISOString()}</li>
        ))}
      </ul>
      <Mono>{JSON.stringify(payload, null, 2)}</Mono>
    </div>
  );
}

/* 52435 — Pause / resume scheduled hunts. */
export function PauseResumeScheduledHunts() {
  const initial = RG.cronRegressionSchedule('0 2 * * 1', 'acme-prod', {}, NOW);
  const [schedule, setSchedule] = useState(initial);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52435 · Pause / resume scheduled hunts</h3>
      <Note>Temporarily halt the weekly acme-prod regression without deleting its schedule.</Note>
      <div className="rg61-row">
        <span className="rg61-chip">paused: {String(schedule.paused)}</span>
        <button className="rg61-btn" onClick={() => setSchedule(RG.pauseScheduledHunt(schedule, NOW).schedule)}>Pause</button>
        <button className="rg61-btn" onClick={() => setSchedule(RG.resumeScheduledHunt(schedule, NOW).schedule)}>Resume</button>
      </div>
      <Mono>{JSON.stringify(schedule, null, 2)}</Mono>
    </div>
  );
}

/* 52436 — Skip if no change. */
export function SkipIfNoChange() {
  const [changed, setChanged] = useState(false);
  const [result, setResult] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52436 · Skip if no change</h3>
      <Note>Skip the scheduled c-1 run when the target fingerprint has not changed.</Note>
      <div className="rg61-row">
        <label>
          <input type="checkbox" checked={changed} onChange={(e) => setChanged(e.target.checked)} /> Target changed
        </label>
        <button className="rg61-btn" onClick={() => setResult(RG.skipIfNoChange({ id: 'c-1' }, { changed }))}>Evaluate skip</button>
      </div>
      {result && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">skipped: {String(result.skipped)}</span>
          </div>
          <Note>Reason: {result.reason}</Note>
          <Mono>{JSON.stringify(result, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52437 — Change detection trigger. */
export function ChangeDetectionTrigger() {
  const [result, setResult] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52437 · Change detection trigger</h3>
      <Note>Compare fingerprints: tech stack changed from nginx to nginx + waf.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setResult(RG.targetChangeTrigger({ tech: ['nginx'], contentHash: 'aaa' }, { tech: ['nginx', 'waf'], contentHash: 'aaa' }, 'acme-prod', NOW))}>Detect change</button>
      </div>
      {result && (
        <>
          <div className="rg61-row">
            <span className="rg61-chip">changed: {String(result.changed)}</span>
            <span className="rg61-chip">trigger: {result.trigger ? result.trigger.id : 'none'}</span>
          </div>
          <Mono>{JSON.stringify(result, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52438 — Git push regression trigger. */
export function GitPushRegressionTrigger() {
  const [result, setResult] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52438 · Git push regression trigger</h3>
      <Note>A push touching src/auth/login.js matches the watched src/auth/ path for acme/app.</Note>
      <div className="rg61-row">
        <button className="rg61-btn" onClick={() => setResult(RG.gitPushTrigger({ repo: 'acme/app', paths: ['src/auth/login.js', 'README.md'] }, { 'acme/app': ['src/auth/'] }))}>Evaluate push</button>
      </div>
      {result && (
        <>
          <div className="rg61-row">
            {(result.matchedPaths || []).map((p, i) => <span key={i} className="rg61-chip">{p}</span>)}
            <span className="rg61-chip">trigger: {String(result.trigger)}</span>
          </div>
          <Mono>{JSON.stringify(result, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52439 — CI pipeline regression trigger. */
export function CiPipelineRegressionTrigger() {
  const [provider, setProvider] = useState('jenkins');
  const [hunt, setHunt] = useState(null);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52439 · CI pipeline regression trigger</h3>
      <Note>Fire a regression hunt from the deploy-prod pipeline job.</Note>
      <div className="rg61-row">
        <select className="rg61-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="jenkins">jenkins</option>
          <option value="github-actions">github-actions</option>
          <option value="gitlab-ci">gitlab-ci</option>
        </select>
        <button className="rg61-btn" onClick={() => setHunt(RG.ciPipelineTrigger({ provider, job: 'deploy-prod', target: 'acme-prod' }, NOW))}>Trigger from CI</button>
      </div>
      {hunt && <Mono>{JSON.stringify(hunt, null, 2)}</Mono>}
    </div>
  );
}

/* 52440 — Scheduled hunt naming. */
export function ScheduledHuntNaming() {
  const [target, setTarget] = useState('acme-prod');
  const [cadence, setCadence] = useState('weekly');
  const [sequence, setSequence] = useState('7');
  const named = RG.autoNameScheduledHunt(target, cadence, Number(sequence) || 0, NOW);
  return (
    <div className="rg61-card">
      <h3 className="rg61-title">52440 · Scheduled hunt naming</h3>
      <Note>Auto-generate a deterministic name for a scheduled regression hunt.</Note>
      <div className="rg61-row">
        <input className="rg61-input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" />
        <input className="rg61-input" value={cadence} onChange={(e) => setCadence(e.target.value)} placeholder="Cadence" />
        <input className="rg61-input" value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="Sequence" />
      </div>
      <div className="rg61-row">
        <span className="rg61-chip">{named.name}</span>
      </div>
      <Mono>{JSON.stringify(named, null, 2)}</Mono>
    </div>
  );
}

export const RG61_GALLERY = [FixAssignment, FixDueDates, VerifyWithRetest, RemediationKanban, PerFindingFixNotes, CodeCommitLinking, OneClickRegressionHunt, RegressionScopeBuilder, DeployTriggeredRegression, CronScheduledRegression, RegressionDiffReport, RegressionCadencePresets, PostFixVerificationScheduling, RegressionHuntTemplates, RegressionNotifications, RegressionAutoCompare, RegressionCostEstimate, QuickVsFullRegression, EnginePinnedRegression, NewEngineRegression, CrossEnvironmentRegression, RegressionQueue, RegressionCalendarView, PauseResumeScheduledHunts, SkipIfNoChange, ChangeDetectionTrigger, GitPushRegressionTrigger, CiPipelineRegressionTrigger, ScheduledHuntNaming];

export function RegressionSuiteGallery() { return (<div className="rg61-gallery">{RG61_GALLERY.map((C, i) => <C key={i} />)}</div>); }
