/**
 * Wave76A.jsx — Infinity AI · Dark-Matter · Wave 76
 * 20 working React components for template sharing and
 * hunt learning, ideas 53001–53020. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XA from './wave76ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const SAMPLE_TEMPLATE = {
  id: 'tpl-shop-baseline', templateId: 'tpl-shop-baseline', name: 'Shop baseline',
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  engines: [{ id: 'recon', version: '2.1' }, { id: 'vuln-scan', version: '4.0' }],
  uses: 7,
};

const SAMPLE_HUNT = { huntId: 'hunt-76', id: 'hunt-76', completedAt: '2026-10-09T00:00:00Z', anonymousFindings: 2, authenticatedFindings: 5 };

function Card({ title, note, children }) {
  return (
    <div className="w76a-card">
      <div className="w76a-title">{title}</div>
      {note ? <div className="w76a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w76a-badge w76a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w76a-kv">
      <span className="w76a-k">{k}</span>
      <span className="w76a-v">{String(v)}</span>
    </div>
  );
}

export function TemplateSharingViaLink() {
  const v = XA.createTemplateShareLink(SAMPLE_TEMPLATE, { expiresDays: 7, permission: 'view' });
  return (
    <Card title="Template sharing via link" note="Idea 53001">
      <Kv k="Code" v={v.code} />
      <Kv k="Expires d" v={v.expiresDays} />
      <div className="w76a-row"><Badge tone="info">Infinity AI link</Badge></div>
    </Card>
  );
}

export function TemplateScheduledReview() {
  const v = XA.scheduleTemplateReview(SAMPLE_TEMPLATE, SAMPLE_HUNT, { cadenceDays: 30 });
  return (
    <Card title="Template scheduled review (post-hunt)" note="Idea 53002">
      <Kv k="Due" v={v.dueAt.slice(0, 10)} />
      <Kv k="Cadence d" v={v.cadenceDays} />
    </Card>
  );
}

export function TemplateRetirementArchive() {
  const v = XA.archiveRetiredTemplate(SAMPLE_TEMPLATE, { uses: 7 }, { reason: 'manual retirement' });
  return (
    <Card title="Template retirement archive" note="Idea 53003">
      <Kv k="Archive" v={v.archiveId} />
      <Kv k="Reason" v={v.reason} />
    </Card>
  );
}

export function TemplateToPlaybookExport() {
  const v = XA.exportTemplateToPlaybook(SAMPLE_TEMPLATE, [{ id: 'f1', title: 'SQLi in checkout', target: 'shop.example.com/checkout' }], {});
  return (
    <Card title="Template-to-playbook export" note="Idea 53004">
      <Kv k="Playbook" v={v.playbookId} />
      <Kv k="Steps" v={v.stepCount} />
    </Card>
  );
}

export function PerHuntContributionBreakdown() {
  const v = XA.breakdownHuntContributions(SAMPLE_HUNT, [{ contributor: 'agent-a', findings: 3 }, { contributor: 'agent-b', findings: 1 }], {});
  return (
    <Card title="Per-Hunt Contribution Breakdown" note="Idea 53005">
      <Kv k="Contributors" v={v.count} />
      <Kv k="Top" v={v.top ? v.top.contributor : 'none'} />
    </Card>
  );
}

export function WinningPayloadRollOfHonor() {
  const v = XA.buildWinningPayloadHonorRoll(SAMPLE_HUNT, [{ id: 'p1', name: 'SQLi probe', score: 15, target: 'shop.example.com', success: true }, { id: 'p2', name: 'XSS probe', score: 5, target: 'shop.example.com', success: false }], {});
  return (
    <Card title="Winning Payload Roll of Honor" note="Idea 53006">
      <Kv k="Winners" v={v.winnerCount} />
      <Kv k="Top" v={v.top ? v.top.payloadId : 'none'} />
    </Card>
  );
}

export function FirstClickAnalysis() {
  const v = XA.analyzeFirstClick([{ at: '2026-10-09T00:00:00Z', type: 'start', label: 'start' }, { at: '2026-10-09T00:00:12Z', type: 'click', label: 'login', target: 'login' }], {});
  return (
    <Card title="First-Click Analysis" note="Idea 53007">
      <Kv k="First" v={v.firstAction || 'none'} />
      <Kv k="Delay s" v={v.delaySeconds} />
    </Card>
  );
}

export function StrategyAttributionLedger() {
  const v = XA.buildStrategyAttributionLedger(SAMPLE_HUNT, [{ id: 's1', name: 'Recon heavy', findings: 4, falsePositives: 1 }], {});
  return (
    <Card title="Strategy Attribution Ledger" note="Idea 53008">
      <Kv k="Strategies" v={v.count} />
      <Kv k="Net" v={v.totalNetYield} />
    </Card>
  );
}

export function ReconPayoffAudit() {
  const v = XA.auditReconPayoff(SAMPLE_HUNT, [{ id: 'r1', name: 'Subdomain sweep', costMinutes: 20, findings: 3 }], {});
  return (
    <Card title="Recon Payoff Audit" note="Idea 53009">
      <Kv k="Steps" v={v.stepCount} />
      <Kv k="Payoff" v={v.payoffRatio} />
    </Card>
  );
}

export function TechniqueYieldRanking() {
  const v = XA.rankTechniqueYield([{ id: 't1', name: 'SQLi', attempts: 10 }], [{ id: 'f1', techniqueId: 't1' }, { id: 'f2', techniqueId: 't1' }], {});
  return (
    <Card title="Technique Yield Ranking" note="Idea 53010">
      <Kv k="Techniques" v={v.count} />
      <Kv k="Best" v={v.best ? v.best.techniqueId : 'none'} />
    </Card>
  );
}

export function FalseStartCounter() {
  const v = XA.countFalseStarts([{ id: 'pr1', findings: 0, status: 'stopped' }, { id: 'pr2', findings: 2, status: 'done' }], {});
  return (
    <Card title="False-Start Counter" note="Idea 53011">
      <Kv k="Total" v={v.totalProbes} />
      <Kv k="False starts" v={v.falseStartCount} />
    </Card>
  );
}

export function LuckyHitSeparator() {
  const v = XA.separateLuckyHits([{ id: 'f1', techniqueId: 't1' }, { id: 'f2', techniqueId: 't1' }, { id: 'f3', techniqueId: 't2' }], { minHitsForPattern: 2 });
  return (
    <Card title="Lucky Hit Separator" note="Idea 53012">
      <Kv k="Lucky" v={v.luckyCount} />
      <Kv k="Systematic" v={v.systematicCount} />
    </Card>
  );
}

export function PivotingMomentLog() {
  const v = XA.logPivotingMoments([{ at: '2026-10-09T00:10:00Z', label: 'pivot to api', pivot: true }], {});
  return (
    <Card title="Pivoting Moment Log" note="Idea 53013">
      <Kv k="Pivots" v={v.pivotCount} />
      <div className="w76a-note">{v.pivots[0] ? v.pivots[0].label : 'none'}</div>
    </Card>
  );
}

export function HunchesValidatedRegister() {
  const v = XA.registerValidatedHunches([{ id: 'h1', guess: 'admin panel exposed', validated: true }], [{ id: 'f1' }], {});
  return (
    <Card title="Hunches-Validated Register" note="Idea 53014">
      <Kv k="Validated" v={v.validatedCount} />
      <Kv k="Accuracy" v={v.accuracy} />
    </Card>
  );
}

export function TimeboxingEffectivenessScore() {
  const v = XA.scoreTimeboxingEffectiveness([{ id: 'ph1', name: 'Recon', plannedMinutes: 30, actualMinutes: 32, findings: 2 }], {});
  return (
    <Card title="Timeboxing Effectiveness Score" note="Idea 53015">
      <Kv k="Score" v={v.score} />
      <Kv k="Phases" v={v.count} />
    </Card>
  );
}

export function DepthVsBreadthTradeoffAnalysis() {
  const v = XA.analyzeDepthVsBreadth([{ id: 'a', mode: 'deep', findings: 3 }, { id: 'b', mode: 'broad', findings: 1 }], {});
  return (
    <Card title="Depth-vs-Breadth Tradeoff Analysis" note="Idea 53016">
      <Kv k="Winner" v={v.winner} />
      <Kv k="Deep" v={v.deep.findings} />
    </Card>
  );
}

export function AuthenticationLiftMeasurement() {
  const v = XA.measureAuthLift(SAMPLE_HUNT, {});
  return (
    <Card title="Authentication Lift Measurement" note="Idea 53017">
      <Kv k="Lift pct" v={v.liftPct} />
      <Kv k="Authed" v={v.authenticatedFindings} />
    </Card>
  );
}

export function HumanTouchDelta() {
  const v = XA.measureHumanTouchDelta([{ huntId: 'h1', humanAssisted: true, findings: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, { huntId: 'h2', humanAssisted: false, findings: [{ id: 'd' }] }], {});
  return (
    <Card title="Human-Touch Delta" note="Idea 53018">
      <Kv k="Delta" v={v.delta} />
      <Kv k="Human avg" v={v.humanAvg} />
    </Card>
  );
}

export function ReRunReproducibilityCheck() {
  const v = XA.checkRerunReproducibility([{ findings: [{ id: 'f1' }, { id: 'f2' }] }, { findings: [{ id: 'f1' }, { id: 'f2' }] }], {});
  return (
    <Card title="Re-run Reproducibility Check" note="Idea 53019">
      <Kv k="Stable" v={String(v.stable)} />
      <Kv k="Overlap" v={v.overlapRatio} />
    </Card>
  );
}

export function DiminishingReturnsCurve() {
  const v = XA.computeDiminishingReturnsCurve([{ name: 'p1', order: 1, minutes: 10, findings: 5 }, { name: 'p2', order: 2, minutes: 10, findings: 1 }], {});
  return (
    <Card title="Diminishing Returns Curve" note="Idea 53020">
      <Kv k="Total" v={v.totalFindings} />
      <Kv k="Knee" v={v.kneeIndex} />
      <div className="w76a-row"><Badge tone="info">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-53001–53020 components, export-only. */
export const W76_A_GALLERY = [
  TemplateSharingViaLink,
  TemplateScheduledReview,
  TemplateRetirementArchive,
  TemplateToPlaybookExport,
  PerHuntContributionBreakdown,
  WinningPayloadRollOfHonor,
  FirstClickAnalysis,
  StrategyAttributionLedger,
  ReconPayoffAudit,
  TechniqueYieldRanking,
  FalseStartCounter,
  LuckyHitSeparator,
  PivotingMomentLog,
  HunchesValidatedRegister,
  TimeboxingEffectivenessScore,
  DepthVsBreadthTradeoffAnalysis,
  AuthenticationLiftMeasurement,
  HumanTouchDelta,
  ReRunReproducibilityCheck,
  DiminishingReturnsCurve,
];

/** Gallery: renders every Wave 76A component, export-only. */
export function Wave76AGallery() {
  return (
    <div className="w76a-gallery">
      {W76_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
