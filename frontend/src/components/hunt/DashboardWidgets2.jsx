/**
 * DashboardWidgets2.jsx — wave 19 (ideas 50721–50729, 50744, 50747–50750):
 * second dashboard widget suite. Every widget is data-driven via
 * dashboardRound2Core.js model helpers; they accept data props and render
 * deterministic sample data when omitted.
 */
import { useMemo } from 'react';
import {
  recentReportsModel, watchlistModel, modelStatusModel, calendarMonth, huntsByDay,
  costUsageModel, webhookDeliveryModel, rankPayloadFamilies, retestQueueModel,
  unreadMentionsModel, findingsTickerModel, uptimeModel, chainsModel,
  coverageModel, comparativeCard, toastSeverityColor, checkThreshold,
} from './dashboardRound2Core.js';

/* Shared chrome --------------------------------------------------------- */

export function WidgetShell({ title, deepLink, children, className = '', actions = null }) {
  return (
    <section className={`dw2-widget ${className}`} aria-label={title}>
      <header className="dw2-widget-head">
        {deepLink ? (
          <a className="dw2-widget-title" href={deepLink}>{title}</a>
        ) : (
          <h3 className="dw2-widget-title">{title}</h3>
        )}
        {actions && <div className="dw2-widget-actions">{actions}</div>}
      </header>
      <div className="dw2-widget-body">{children}</div>
    </section>
  );
}

const SEV_CLASS = (sev) => `dw2-sev dw2-sev-${String(sev || 'none').toLowerCase()}`;

/* 50721 Recent reports ---------------------------------------------------- */

export function RecentReportsWidget({ reports, deepLink }) {
  const rows = useMemo(() => recentReportsModel(reports), [reports]);
  return (
    <WidgetShell title="Recent reports" deepLink={deepLink}>
      <ul className="dw2-list">
        {rows.map((r) => (
          <li key={r.id} className="dw2-report-row">
            <div className="dw2-report-thumb" aria-hidden="true">{r.findingsCount}</div>
            <div className="dw2-report-meta">
              <div className="dw2-report-title">{r.title}</div>
              <div className="dw2-report-sub">{r.target} · {r.dateLabel}</div>
            </div>
            {r.downloadUrl ? (
              <a className="dw2-btn" href={r.downloadUrl} download>Download</a>
            ) : (
              <button className="dw2-btn" disabled>No file</button>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/* 50722 Watchlist --------------------------------------------------------- */

export function WatchlistWidget({ targets, deepLink }) {
  const rows = useMemo(() => watchlistModel(targets), [targets]);
  return (
    <WidgetShell title="Watchlist" deepLink={deepLink}>
      <ul className="dw2-list">
        {rows.map((t) => (
          <li key={t.id} className="dw2-watch-row">
            <span className={SEV_CLASS(t.severityMax)} role="img" aria-label={`max severity ${t.severityMax}`} />
            <span className="dw2-watch-host">{t.host}</span>
            {t.newFindings > 0 ? (
              <span className="dw2-badge dw2-badge-new" title="new findings since last visit">
                {t.newFindings} new
              </span>
            ) : (
              <span className="dw2-muted">quiet</span>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/* 50723 Model status ------------------------------------------------------ */

export function ModelStatusWidget({ slots, deepLink }) {
  const model = useMemo(() => modelStatusModel(slots), [slots]);
  return (
    <WidgetShell title="Model status" deepLink={deepLink}>
      <ul className="dw2-list">
        {model.slots.map((s) => (
          <li key={s.slot} className="dw2-model-row">
            <span className={`dw2-health dw2-health-${s.health}`} role="img" aria-label={s.health} />
            <span className="dw2-model-slot">{s.slot}</span>
            <span className="dw2-model-name">{s.name}</span>
            <span className="dw2-muted">{s.version}</span>
            <span className="dw2-chip">{s.location}</span>
          </li>
        ))}
      </ul>
      <div className={`dw2-summary dw2-summary-${model.summary}`}>Brain: {model.summary}</div>
    </WidgetShell>
  );
}

/* 50724 Hunt calendar ----------------------------------------------------- */

export function HuntCalendarWidget({ hunts, year, month, deepLink }) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  const weeks = useMemo(() => calendarMonth(y, m), [y, m]);
  const byDay = useMemo(() => huntsByDay(hunts, y, m), [hunts, y, m]);
  const monthLabel = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <WidgetShell title="Hunt calendar" deepLink={deepLink}>
      <div className="dw2-cal-label">{monthLabel}</div>
      <table className="dw2-cal" aria-label="hunt calendar">
        <thead><tr>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <th key={i} scope="col">{d}</th>)}</tr></thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((cell, ci) => {
                const dayHunts = cell.date ? (byDay[cell.date] || []) : [];
                return (
                  <td key={ci} className={cell.inMonth ? 'dw2-cal-day' : 'dw2-cal-pad'}>
                    {cell.inMonth && (
                      <span className={`dw2-cal-num ${dayHunts.length ? 'dw2-cal-busy' : ''}`}
                            title={dayHunts.length ? `${dayHunts.length} hunt(s)` : 'no hunts'}>
                        {cell.date}
                        {dayHunts.length > 0 && <i className="dw2-cal-dot" />}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </WidgetShell>
  );
}

/* 50725 Cost usage -------------------------------------------------------- */

export function CostUsageWidget({ spent = 0, tier = { name: 'Free', limit: 0 }, dayOfMonth, daysInMonth, deepLink }) {
  const model = useMemo(() => {
    const now = new Date();
    return costUsageModel(spent, tier, dayOfMonth ?? now.getDate(), daysInMonth ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  }, [spent, tier, dayOfMonth, daysInMonth]);
  return (
    <WidgetShell title="Cost usage" deepLink={deepLink}>
      <div className="dw2-cost-label">{model.label}</div>
      <div className="dw2-meter" role="progressbar" aria-valuenow={Math.round(model.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={model.label}>
        <span style={{ width: `${model.pct}%` }} className={model.overProjection ? 'dw2-meter-over' : ''} />
      </div>
      <div className={`dw2-cost-proj ${model.overProjection ? 'dw2-warn' : 'dw2-muted'}`}>{model.projectedLabel}</div>
    </WidgetShell>
  );
}

/* 50726 Webhook deliveries ------------------------------------------------ */

export function WebhookDeliveryWidget({ deliveries, onRetry, deepLink }) {
  const rows = useMemo(() => webhookDeliveryModel(deliveries), [deliveries]);
  return (
    <WidgetShell title="Webhook deliveries" deepLink={deepLink}>
      <ul className="dw2-list">
        {rows.map((d) => (
          <li key={d.id} className="dw2-hook-row">
            <span className={`dw2-dot dw2-dot-${d.dot}`} aria-label={d.status} />
            <span className="dw2-hook-event">{d.event}</span>
            <span className="dw2-muted dw2-hook-target">{d.target}</span>
            {d.retryable && onRetry && (
              <button className="dw2-btn dw2-btn-sm" onClick={() => onRetry(d.id)}>Retry</button>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/* 50727 Payload families -------------------------------------------------- */

export function PayloadFamilyWidget({ runs, deepLink }) {
  const rows = useMemo(() => rankPayloadFamilies(runs), [runs]);
  const max = Math.max(1, ...rows.map((r) => r.confirmed));
  return (
    <WidgetShell title="Payload families" deepLink={deepLink}>
      <ul className="dw2-bars">
        {rows.map((r) => (
          <li key={r.family} className="dw2-bar-row">
            <span className="dw2-bar-label">{r.family}</span>
            <span className="dw2-bar-track"><span className="dw2-bar-fill" style={{ width: `${(r.confirmed / max) * 100}%` }} /></span>
            <span className="dw2-muted">{r.confirmed}/{r.hits}</span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/* 50728 Retest queue ------------------------------------------------------ */

export function RetestQueueWidget({ findings, onRunAll, onRetest, deepLink }) {
  const model = useMemo(() => retestQueueModel(findings), [findings]);
  return (
    <WidgetShell
      title="Retest queue"
      deepLink={deepLink}
      actions={<button className="dw2-btn" disabled={!model.runAllEnabled} onClick={onRunAll}>Run all</button>}
    >
      <ul className="dw2-list">
        {model.items.map((f) => (
          <li key={f.id} className="dw2-retest-row">
            <span className={SEV_CLASS(f.severity)} />
            <span className="dw2-retest-title">{f.title}</span>
            {onRetest && <button className="dw2-btn dw2-btn-sm" onClick={() => onRetest(f.id)}>Retest</button>}
          </li>
        ))}
      </ul>
      {model.count === 0 && <p className="dw2-muted">Queue empty — everything verified.</p>}
    </WidgetShell>
  );
}

/* 50729 Mentions ---------------------------------------------------------- */

export function MentionsWidget({ mentions, onMarkRead, deepLink }) {
  const model = useMemo(() => unreadMentionsModel(mentions), [mentions]);
  return (
    <WidgetShell title={`Mentions${model.count ? ` (${model.count})` : ''}`} deepLink={deepLink}>
      <ul className="dw2-list">
        {model.items.map((m) => (
          <li key={m.id} className="dw2-mention-row">
            <strong className="dw2-mention-author">{m.author}</strong>
            <span className="dw2-mention-text">{m.text}</span>
            {onMarkRead && <button className="dw2-btn dw2-btn-sm" onClick={() => onMarkRead(m.id)}>Mark read</button>}
          </li>
        ))}
      </ul>
      {model.count === 0 && <p className="dw2-muted">Inbox zero — no unread mentions.</p>}
    </WidgetShell>
  );
}

/* 50744 Comparative mini cards -------------------------------------------- */

export function ComparativeCard({ label, current, average, higherIsBetter = true, unit = '' }) {
  const model = useMemo(() => comparativeCard(current, average, higherIsBetter), [current, average, higherIsBetter]);
  return (
    <div className={`dw2-compare ${model.good ? 'dw2-compare-good' : 'dw2-compare-bad'}`}>
      <div className="dw2-compare-label">{label}</div>
      <div className="dw2-compare-nums">
        <span className="dw2-compare-cur">{model.current}{unit}</span>
        <span className="dw2-muted">vs avg {model.average}{unit}</span>
      </div>
      <div className="dw2-compare-delta" aria-label={model.good ? 'better than average' : 'worse than average'}>
        {model.delta >= 0 ? '+' : ''}{model.delta.toFixed(1)}{unit} ({model.pct >= 0 ? '+' : ''}{model.pct.toFixed(0)}%)
      </div>
    </div>
  );
}

/* 50747 Findings ticker --------------------------------------------------- */

export function FindingsTickerWidget({ findings }) {
  const items = useMemo(() => findingsTickerModel(findings), [findings]);
  return (
    <div className="dw2-ticker" role="marquee" aria-label="latest findings ticker">
      <div className="dw2-ticker-track">
        {[...items, ...items].map((f, i) => (
          <span key={`${f.id}-${i}`} className="dw2-ticker-item">
            <i className="dw2-dot" style={{ background: toastSeverityColor(f.severity) }} aria-hidden="true" />
            {f.title}
          </span>
        ))}
      </div>
    </div>
  );
}

/* 50748 Uptime ------------------------------------------------------------ */

export function UptimeWidget({ services = [] }) {
  return (
    <WidgetShell title="Uptime">
      <ul className="dw2-list">
        {services.map((s) => {
          const model = uptimeModel(s.events, s.windowMs || 30 * 24 * 3600 * 1000);
          const level = checkThreshold(100 - model.pct, { warn: 1, crit: 5 });
          return (
            <li key={s.name} className="dw2-uptime-row">
              <span className="dw2-uptime-name">{s.name}</span>
              <span className={`dw2-uptime-pct dw2-uptime-${level}`}>{model.pct.toFixed(2)}%</span>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

/* 50749 Chains ------------------------------------------------------------ */

export function ChainsWidget({ chains, deepLink }) {
  const model = useMemo(() => chainsModel(chains), [chains]);
  return (
    <WidgetShell title="Chains" deepLink={deepLink}>
      <div className="dw2-chains-count">{model.count} chained finding set{model.count === 1 ? '' : 's'}</div>
      <ul className="dw2-list">
        {model.top.map((c) => (
          <li key={c.id} className="dw2-chain-row">
            <span className="dw2-chain-title">{c.title}</span>
            <span className="dw2-chip">{c.hops} hops</span>
            <span className="dw2-muted">sev {c.severityScore.toFixed(1)}</span>
            <svg className="dw2-chain-mini" viewBox="0 0 60 16" aria-hidden="true">
              {Array.from({ length: c.hops }).map((_, i) => (
                <g key={i}>
                  <circle cx={8 + i * 22} cy={8} r={5} className="dw2-chain-node" />
                  {i > 0 && <line x1={13 + (i - 1) * 22} y1={8} x2={8 + i * 22 - 5} y2={8} className="dw2-chain-edge" />}
                </g>
              ))}
            </svg>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/* 50750 Coverage ---------------------------------------------------------- */

export function CoverageWidget({ tested = 0, total = 0, deepLink }) {
  const model = useMemo(() => coverageModel(tested, total), [tested, total]);
  return (
    <WidgetShell title="Coverage" deepLink={deepLink}>
      <div className="dw2-coverage-ring" role="img" aria-label={`${model.pct.toFixed(1)} percent of attack surface tested`}>
        <svg viewBox="0 0 64 64" className="dw2-ring">
          <circle cx={32} cy={32} r={26} className="dw2-ring-bg" />
          <circle cx={32} cy={32} r={26} className="dw2-ring-fg"
            strokeDasharray={`${(model.pct / 100) * 163.4} 163.4`} />
        </svg>
        <span className="dw2-coverage-pct">{model.pct.toFixed(0)}%</span>
      </div>
      <div className="dw2-muted">{model.tested} of {model.total} endpoints tested</div>
    </WidgetShell>
  );
}

/* Gallery — reference showcase --------------------------------------------- */

export function DashboardWidgets2Gallery(props) {
  const sampleReports = [{ id: 'r1', title: 'Q3 bounty report', target: 'shop.example.com', createdAt: Date.now() - 86400000, findingsCount: 14, downloadUrl: '#dl' }];
  const sampleTargets = [{ id: 't1', host: 'app.example.com', newFindings: 3, severityMax: 'high' }];
  const sampleSlots = [{ slot: 'hacker', name: 'qwen-2.5-coder', version: '32b-q4', location: 'local', health: 'healthy' }];
  return (
    <div className="dw2-gallery">
      <RecentReportsWidget reports={sampleReports} deepLink="/agent/reports" />
      <WatchlistWidget targets={sampleTargets} />
      <ModelStatusWidget slots={sampleSlots} />
      <HuntCalendarWidget hunts={[{ startedAt: Date.now() }]} />
      <CostUsageWidget spent={12.5} tier={{ name: 'Pro', limit: 29 }} />
      <WebhookDeliveryWidget deliveries={[{ id: 'w1', event: 'finding.created', target: 'slack', status: 'failed', attemptedAt: Date.now() }]} />
      <PayloadFamilyWidget runs={[{ family: 'xss', confirmed: true }, { family: 'xss', confirmed: false }, { family: 'sqli', confirmed: true }]} />
      <RetestQueueWidget findings={[{ id: 'f1', title: 'Stored XSS in comments', severity: 'high', needsRetest: true }]} />
      <MentionsWidget mentions={[{ id: 'm1', author: 'one', text: '@two check the PoC', read: false }]} />
      <ComparativeCard label="Findings per hunt" current={18} average={12.4} />
      <FindingsTickerWidget findings={[{ id: 'f9', title: 'IDOR in /api/user', severity: 'high' }, { id: 'f8', title: 'Open redirect', severity: 'medium' }]} />
      <UptimeWidget services={[{ name: 'API', events: [] }, { name: 'Agent service', events: [{ at: Date.now() - 3600000, type: 'down' }, { at: Date.now() - 3500000, type: 'up' }], windowMs: 7 * 86400000 }]} />
      <ChainsWidget chains={[{ id: 'c1', title: 'SSRF → metadata → creds', severityScore: 9.2, findings: [{}, {}, {}] }]} />
      <CoverageWidget tested={142} total={230} />
    </div>
  );
}

export default DashboardWidgets2Gallery;
