/**
 * DashboardWidgets.jsx — wave 18 (ideas 50705–50720): dashboard widget suite.
 * Each widget is a real component driven by dashboardCore.js pure logic.
 * Widgets accept data props and render deterministic demo data when omitted.
 */
import { useMemo } from 'react';
import {
  SEVERITIES,
  activeHuntsModel,
  severityDonutSegments,
  weeklyFindingsModel,
  throughputModel,
  needsReviewModel,
  topVulnerableTargetsModel,
  agentActivityHeatmap,
  timeToFirstFindingModel,
  fpRateModel,
  reportReadyModel,
  upcomingSchedulesModel,
  integrationHealthModel,
  learningAppliedModel,
  storageUsageModel,
  teamLeaderboardModel,
  slaRiskModel,
  normalizeSparkline,
  formatCountdown,
  weekOverWeekDelta,
} from './dashboardCore.js';

/* Shared chrome ------------------------------------------------------- */
function Widget({ title, id, action, children }) {
  return (
    <section className="dbw-widget" aria-label={`Widget: ${title}`}>
      <header className="dbw-head">
        <span className="dbw-id">{id}</span>
        <h4 className="dbw-title">{title}</h4>
        {action}
      </header>
      <div className="dbw-body">{children}</div>
    </section>
  );
}

function TrendArrow({ direction, goodWhenDown = false }) {
  const glyph = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '●';
  const good = direction === 'flat' ? 'flat' : (direction === 'up') !== goodWhenDown ? 'good' : 'bad';
  return <span className={`dbw-trend dbw-trend-${good}`} aria-label={`trend ${direction}`}>{glyph}</span>;
}

function Sparkline({ points, width = 120, height = 32, accent = 'var(--accent, #6e8efb)' }) {
  if (!points || points.length === 0) return <span className="dbw-muted">No data</span>;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - p * (height - 4) - 2).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sparkline">
      <path d={d} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* Deterministic demo fixtures ------------------------------------------ */
const DEMO = {
  hunts: [
    { id: 'h1', targetUrl: 'https://shop.example.com', status: 'running', phase: 'testing', progress: 0.62 },
    { id: 'h2', targetUrl: 'https://api.example.com', status: 'running', phase: 'recon', progress: 0.18 },
    { id: 'h3', targetUrl: 'https://blog.example.com', status: 'paused', phase: 'chaining', progress: 0.8 },
  ],
  findings: [
    { id: 'f1', title: 'SQL injection in login.php', severity: 'critical', url: 'https://shop.example.com/login.php', reviewed: false, engine: 'vulnDetector', createdAt: '2026-10-06T08:00:00Z' },
    { id: 'f2', title: 'Stored XSS in comments', severity: 'high', url: 'https://blog.example.com/comments', reviewed: false, engine: 'vulnDetector', createdAt: '2026-10-05T10:00:00Z' },
    { id: 'f3', title: 'Missing CSP header', severity: 'medium', url: 'https://shop.example.com/', reviewed: false, engine: 'eliteRecon', createdAt: '2026-10-04T09:00:00Z' },
    { id: 'f4', title: 'Verbose Server banner', severity: 'low', url: 'https://api.example.com/', reviewed: true, engine: 'eliteRecon', createdAt: '2026-10-03T09:00:00Z' },
    { id: 'f5', title: 'IDOR on /orders/{id}', severity: 'critical', url: 'https://shop.example.com/orders/12', reviewed: false, engine: 'vulnDetector', createdAt: '2026-10-06T20:00:00Z' },
    { id: 'f6', title: 'Reflected XSS in search', severity: 'medium', url: 'https://shop.example.com/search?q=', reviewed: false, engine: 'vulnDetector', createdAt: '2026-10-02T09:00:00Z', falsePositive: true },
  ],
  completedHunts: [
    { completedAt: '2026-10-07T06:00:00Z' }, { completedAt: '2026-10-06T09:00:00Z' },
    { completedAt: '2026-10-06T15:00:00Z' }, { completedAt: '2026-10-04T11:00:00Z' },
    { completedAt: '2026-09-28T10:00:00Z' },
  ],
  reportQueue: [
    { id: 'h9', targetUrl: 'https://shop.example.com', status: 'completed', reportGenerated: false, findingCount: 12, completedAt: '2026-10-07T05:30:00Z' },
  ],
  schedules: [
    { id: 's1', name: 'Nightly shop scan', targetUrl: 'https://shop.example.com', nextRunAt: new Date(Date.now() + 3 * 3600000).toISOString() },
    { id: 's2', name: 'API weekly', targetUrl: 'https://api.example.com', nextRunAt: new Date(Date.now() + 26 * 3600000).toISOString() },
  ],
  providers: [
    { name: 'Vision brain', status: 'healthy', latencyMs: 210 },
    { name: 'MongoDB', status: 'healthy', latencyMs: 42 },
    { name: 'Kaggle link', status: 'degraded', latencyMs: 1800 },
    { name: 'Voice TTS', status: 'down', since: '2026-10-06' },
  ],
  learning: [
    { rule: 'Skip static-asset 404s in recon', example: 'favicon.ico probes on 14 hunts', learnedAt: new Date(Date.now() - 2 * 86400000).toISOString(), huntsImproved: 14 },
    { rule: 'Rate-limit WAF probes to 1/s', example: 'Cloudflare 429 on shop.example.com', learnedAt: new Date(Date.now() - 5 * 86400000).toISOString(), huntsImproved: 6 },
  ],
  members: [
    { name: 'Aarav', confirmedFindings: 31, optIn: true },
    { name: 'Diya', confirmedFindings: 24, optIn: true },
    { name: 'Kabir', confirmedFindings: 18, optIn: false },
  ],
};

/* 50705 — Active hunts --------------------------------------------------- */
export function ActiveHuntsWidget({ hunts = DEMO.hunts }) {
  const rows = activeHuntsModel(hunts);
  return (
    <Widget id="50705" title="Active hunts">
      {rows.length === 0 ? <p className="dbw-muted">No hunts running.</p> : (
        <ul className="dbw-list">
          {rows.map((h) => (
            <li key={h.id} className="dbw-row">
              <span className="dbw-ring" style={{ '--pct': `${Math.round(h.progress * 100)}` }} aria-hidden="true" />
              <div>
                <div className="dbw-row-title">{h.host} <span className="dbw-chip">{h.status}</span></div>
                <div className="dbw-muted">Phase: {h.phase} · {Math.round(h.progress * 100)}%</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* 50706 — Clickable severity donut ---------------------------------------- */
export function SeverityDonutWidget({ findings = DEMO.findings, onSelect }) {
  const segs = severityDonutSegments(findings);
  const stops = [];
  let acc = 0;
  const colors = { critical: '#ff4d4d', high: '#ff9f43', medium: '#facc15', low: '#22c55e' };
  for (const s of segs) {
    stops.push(`${colors[s.severity]} ${acc.toFixed(1)}% ${(acc + s.pct).toFixed(1)}%`);
    acc += s.pct;
  }
  return (
    <Widget id="50706" title="Severity donut">
      <div className="dbw-donut-row">
        <button
          type="button"
          className="dbw-donut"
          style={{ background: `conic-gradient(${stops.join(', ')})` }}
          onClick={() => onSelect?.({})}
          aria-label="All findings — click to view"
        >
          <span className="dbw-donut-hole">{findings.length}</span>
        </button>
        <ul className="dbw-legend">
          {segs.map((s) => (
            <li key={s.severity}>
              <button type="button" className="dbw-legend-btn" onClick={() => onSelect?.(s.filter)} aria-label={`Show ${s.count} ${s.severity} findings`}>
                <span className="dbw-swatch" style={{ background: colors[s.severity] }} aria-hidden="true" />
                {s.severity} <strong>{s.count}</strong>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Widget>
  );
}

/* 50707 — Weekly findings sparkline ----------------------------------------- */
export function WeeklyFindingsWidget({ countsByDay }) {
  const days = countsByDay || Array.from({ length: 14 }, (_, i) => ({ day: `d${i}`, count: (i * 7 + 3) % 9 }));
  const m = weeklyFindingsModel(days);
  return (
    <Widget id="50707" title="Findings this week">
      <div className="dbw-big">{m.total} <TrendArrow direction={m.wow.direction} /></div>
      <Sparkline points={m.points} />
      <div className="dbw-muted">{m.wow.direction === 'flat' ? 'No change' : `${m.wow.deltaPct > 0 ? '+' : ''}${m.wow.deltaPct}%`} vs last week</div>
    </Widget>
  );
}

/* 50708 — Throughput ----------------------------------------------------------- */
export function ThroughputWidget({ hunts = DEMO.completedHunts }) {
  const m = throughputModel(hunts);
  return (
    <Widget id="50708" title="Throughput — hunts/day, 30 days">
      <div className="dbw-bars" role="img" aria-label={`${m.total} hunts in the last 30 days, average ${m.avgPerDay} per day`}>
        {m.buckets.map((c, i) => (
          <span key={i} className="dbw-bar" style={{ height: `${m.max ? Math.max(4, (c / m.max) * 48) : 4}px` }} title={`Day ${i + 1}: ${c}`} />
        ))}
      </div>
      <div className="dbw-muted">{m.total} total · avg {m.avgPerDay}/day</div>
    </Widget>
  );
}

/* 50709 — Needs review ------------------------------------------------------------ */
export function NeedsReviewWidget({ findings = DEMO.findings, onReview }) {
  const rows = needsReviewModel(findings);
  return (
    <Widget id="50709" title="Needs review">
      {rows.length === 0 ? <p className="dbw-muted">Inbox zero — nothing unreviewed.</p> : (
        <ul className="dbw-list">
          {rows.map((f) => (
            <li key={f.id} className="dbw-row">
              <span className={`dbw-sev dbw-sev-${f.severity}`} aria-hidden="true" />
              <div className="dbw-row-title">{f.title}<div className="dbw-muted">{f.host}</div></div>
              <button type="button" className="dbw-mini" onClick={() => onReview?.(f.id)}>Review</button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* 50710 — Top vulnerable targets ------------------------------------------------------ */
export function TopVulnerableTargetsWidget({ findings = DEMO.findings }) {
  const rows = topVulnerableTargetsModel(findings);
  const arrow = { up: '▲', down: '▼', flat: '●', new: '✦' };
  return (
    <Widget id="50710" title="Top vulnerable targets">
      <ol className="dbw-list">
        {rows.map((t) => (
          <li key={t.host} className="dbw-row">
            <span className="dbw-rank">{t.critical}</span>
            <div className="dbw-row-title">{t.host}<div className="dbw-muted">{t.total} findings total</div></div>
            <span className={`dbw-trend dbw-trend-${t.trend === 'up' ? 'bad' : 'good'}`} aria-label={`critical trend ${t.trend}`}>{arrow[t.trend]}</span>
          </li>
        ))}
      </ol>
    </Widget>
  );
}

/* 50711 — Agent activity heatmap ---------------------------------------------------------- */
export function AgentActivityHeatmapWidget({ events }) {
  const evts = events || Array.from({ length: 120 }, (_, i) => ({ at: new Date(Date.now() - i * 3600000 * 1.7).toISOString() }));
  const { grid, peak, max, days } = agentActivityHeatmap(evts);
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][peak.day];
  return (
    <Widget id="50711" title="Agent activity — 24×7">
      <div className="dbw-heat" role="img" aria-label={`Peak activity ${dayName} ${peak.hour}:00 with ${peak.count} events`}>
        {grid.map((row, d) => (
          <div key={d} className="dbw-heat-row" aria-hidden="true">
            <span className="dbw-heat-day">{days[d]}</span>
            {row.map((c, h) => (
              <span key={h} className="dbw-heat-cell" style={{ opacity: 0.12 + 0.88 * (c / max) }} title={`${days[d]} ${h}:00 — ${c}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="dbw-muted">Peak: {dayName} {peak.hour}:00 ({peak.count} events)</div>
    </Widget>
  );
}

/* 50712 — Time to first finding ---------------------------------------------------------------- */
export function TimeToFirstFindingWidget({ hunts }) {
  const list = hunts || [
    { startedAt: '2026-10-07T05:00:00Z', firstFindingAt: '2026-10-07T05:14:00Z' },
    { startedAt: '2026-10-06T08:00:00Z', firstFindingAt: '2026-10-06T08:22:00Z' },
    { startedAt: '2026-10-05T09:00:00Z', firstFindingAt: '2026-10-05T09:09:00Z' },
  ];
  const m = timeToFirstFindingModel(list);
  return (
    <Widget id="50712" title="Time to first finding">
      <div className="dbw-big">{m.avgMs == null ? '—' : formatCountdown(m.avgMs)} <TrendArrow direction={m.trend} goodWhenDown /></div>
      <div className="dbw-muted">Across {m.sample} hunts (down is better)</div>
    </Widget>
  );
}

/* 50713 — False-positive rate --------------------------------------------------------------------- */
export function FalsePositiveRateWidget({ findings = DEMO.findings }) {
  const rows = fpRateModel(findings);
  return (
    <Widget id="50713" title="False-positive rate per engine">
      <ul className="dbw-list">
        {rows.map((r) => (
          <li key={r.engine} className="dbw-row">
            <div className="dbw-row-title">{r.engine}<div className="dbw-muted">{r.total} findings</div></div>
            <Sparkline points={r.spark} width={90} height={24} />
            <strong>{r.fpRate}%</strong>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

/* 50714 — Report-ready -------------------------------------------------------------------------------- */
export function ReportReadyWidget({ hunts = DEMO.reportQueue, onGenerate }) {
  const rows = reportReadyModel(hunts);
  return (
    <Widget id="50714" title="Report-ready hunts">
      {rows.length === 0 ? <p className="dbw-muted">No hunts waiting for a report.</p> : (
        <ul className="dbw-list">
          {rows.map((h) => (
            <li key={h.id} className="dbw-row">
              <div className="dbw-row-title">{h.host}<div className="dbw-muted">{h.findings} findings</div></div>
              <button type="button" className="dbw-mini" onClick={() => onGenerate?.(h.id)}>Generate</button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* 50715 — Scheduled hunts --------------------------------------------------------------------------------- */
export function ScheduledHuntsWidget({ schedules = DEMO.schedules }) {
  const rows = upcomingSchedulesModel(schedules);
  return (
    <Widget id="50715" title="Scheduled hunts">
      {rows.length === 0 ? <p className="dbw-muted">No upcoming scheduled runs.</p> : (
        <ul className="dbw-list">
          {rows.map((s) => (
            <li key={s.id} className="dbw-row">
              <div className="dbw-row-title">{s.name}<div className="dbw-muted">{s.host}</div></div>
              <span className="dbw-countdown" aria-label={`Next run in ${s.countdown}`}>⏱ {s.countdown}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* 50716 — Integration health ---------------------------------------------------------------------------------- */
export function IntegrationHealthWidget({ providers = DEMO.providers }) {
  const rows = integrationHealthModel(providers);
  return (
    <Widget id="50716" title="Integration health">
      <ul className="dbw-list">
        {rows.map((p) => (
          <li key={p.name} className="dbw-row">
            <span className={`dbw-dot dbw-dot-${p.dot}`} aria-hidden="true" />
            <div className="dbw-row-title">{p.name}
              <div className="dbw-muted">{p.status}{p.latencyMs != null ? ` · ${p.latencyMs}ms` : ''}{p.since ? ` · since ${p.since}` : ''}</div>
            </div>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

/* 50717 — Learning applied ---------------------------------------------------------------------------------------- */
export function LearningAppliedWidget({ entries = DEMO.learning }) {
  const rows = learningAppliedModel(entries);
  return (
    <Widget id="50717" title="Learning applied — this week">
      {rows.length === 0 ? <p className="dbw-muted">No new learned rules this week.</p> : (
        <ul className="dbw-list">
          {rows.map((r, i) => (
            <li key={i} className="dbw-row">
              <span className="dbw-rank" aria-hidden="true">✦</span>
              <div className="dbw-row-title">{r.rule}<div className="dbw-muted">e.g. {r.example} · helped {r.huntsImproved} hunts</div></div>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* 50718 — Storage usage ------------------------------------------------------------------------------------------------ */
export function StorageUsageWidget({ usage }) {
  const m = storageUsageModel(usage || { evidenceBytes: 2.4 * 1024 ** 3, snapshotBytes: 0.9 * 1024 ** 3, quotaBytes: 5 * 1024 ** 3 });
  return (
    <Widget id="50718" title="Storage usage" action={<button type="button" className="dbw-mini">Clean up</button>}>
      <div className="dbw-barline" role="progressbar" aria-valuenow={m.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Storage ${m.pct}% used`}>
        <div className="dbw-barline-fill" style={{ width: `${Math.min(100, m.pct)}%` }} />
      </div>
      <div className="dbw-muted">{m.used} of {m.quota} ({m.pct}%) — evidence {m.evidence} · snapshots {m.snapshots}</div>
      <p className="dbw-note">{m.suggestion}</p>
    </Widget>
  );
}

/* 50719 — Team leaderboard --------------------------------------------------------------------------------------------------- */
export function TeamLeaderboardWidget({ members = DEMO.members }) {
  const rows = teamLeaderboardModel(members);
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <Widget id="50719" title="Team leaderboard (opt-in)">
      <ol className="dbw-list">
        {rows.map((m) => (
          <li key={m.name} className="dbw-row">
            <span className="dbw-rank" aria-hidden="true">{medals[m.rank - 1] || `#${m.rank}`}</span>
            <div className="dbw-row-title">{m.name}</div>
            <strong>{m.confirmedFindings}</strong>
          </li>
        ))}
      </ol>
      <div className="dbw-muted">Opt-in only — Kabir is excluded from the board.</div>
    </Widget>
  );
}

/* 50720 — SLA risk ----------------------------------------------------------------------------------------------------------------- */
export function SlaRiskWidget({ findings = DEMO.findings }) {
  const rows = slaRiskModel(findings).slice(0, 8);
  const cls = ['dbw-urg-overdue', 'dbw-urg-soon', 'dbw-urg-ok'];
  return (
    <Widget id="50720" title="SLA risk">
      {rows.length === 0 ? <p className="dbw-muted">No findings approaching SLA breach.</p> : (
        <ul className="dbw-list">
          {rows.map((f) => (
            <li key={f.id} className={`dbw-row ${cls[f.urgency]}`}>
              <span className={`dbw-sev dbw-sev-${f.severity}`} aria-hidden="true" />
              <div className="dbw-row-title">{f.title}<div className="dbw-muted">{f.severity}</div></div>
              <span className="dbw-countdown" aria-label={`SLA ${f.countdown}`}>⏱ {f.countdown}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* Dashboard grid --------------------------------------------------------------------------------------------------------------- */
export function DashboardWidgetsGrid() {
  return (
    <div className="dbw-grid" aria-label="Wave 18 dashboard widgets (50705–50720)">
      <ActiveHuntsWidget />
      <SeverityDonutWidget />
      <WeeklyFindingsWidget />
      <ThroughputWidget />
      <NeedsReviewWidget />
      <TopVulnerableTargetsWidget />
      <AgentActivityHeatmapWidget />
      <TimeToFirstFindingWidget />
      <FalsePositiveRateWidget />
      <ReportReadyWidget />
      <ScheduledHuntsWidget />
      <IntegrationHealthWidget />
      <LearningAppliedWidget />
      <StorageUsageWidget />
      <TeamLeaderboardWidget />
      <SlaRiskWidget />
    </div>
  );
}
