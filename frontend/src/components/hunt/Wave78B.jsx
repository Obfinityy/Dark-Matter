/**
 * Wave78B.jsx — Infinity AI · Dark-Matter · Wave 78
 * 20 working React components for stack operations and strategy analytics, ideas 53101–53120. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as XB from './wave78BCores.js';

const SAMPLE_ATTEMPTS = [
  { family: 'sqli', payload: 'union-select', stack: 'php-laravel', region: 'eu-west', proxy: 'nginx', reverseProxy: 'nginx', waf: 'cloudflare', evasion: 'comment-obfuscation', evasionTechnique: 'comment-obfuscation', quarter: '2026-Q1', sourceStack: 'php-laravel', targetStack: 'node-express', success: true },
  { family: 'sqli', payload: 'union-select', stack: 'php-laravel', region: 'us-east', proxy: 'nginx', reverseProxy: 'nginx', waf: 'cloudflare', evasion: 'comment-obfuscation', evasionTechnique: 'comment-obfuscation', quarter: '2026-Q1', sourceStack: 'php-laravel', targetStack: 'node-express', blocked: true, success: false },
  { family: 'xss', payload: 'dom-clobber', stack: 'node-express', region: 'us-east', proxy: 'haproxy', reverseProxy: 'haproxy', waf: 'aws-waf', evasion: 'case-swap', evasionTechnique: 'case-swap', quarter: '2026-Q2', sourceStack: 'node-express', targetStack: 'php-laravel', transformed: true, success: true },
  { family: 'xss', payload: 'dom-clobber', stack: 'node-express', region: 'ap-south', proxy: 'caddy', reverseProxy: 'caddy', waf: 'none', evasion: 'case-swap', evasionTechnique: 'case-swap', quarter: '2026-Q2', sourceStack: 'node-express', targetStack: 'django', success: false },
];
const SAMPLE_PAIRS = [
  { payloadId: 'p1', id: 'p1', family: 'sqli', originStatus: 200, edgeStatus: 403, originSuccess: true, edgeSuccess: false },
  { payloadId: 'p2', id: 'p2', family: 'xss', originStatus: 200, edgeStatus: 200, originSuccess: true, edgeSuccess: true },
];
const SAMPLE_FRAMEWORKS = [
  { framework: 'express', version: '4', defaults: { xPoweredBy: true, trustProxy: false }, hardened: { xPoweredBy: false } },
  { framework: 'django', version: '4.2', defaults: { debug: false }, hardened: {} },
];
const SAMPLE_PLANS = [
  { payload: 'union-select', family: 'sqli', stack: 'php-laravel', detectedStack: 'php-laravel' },
  { payload: 'legacy-probe', family: 'legacy', stack: 'node-express', detectedStack: 'node-express' },
];
const SAMPLE_STACKS = [
  { stack: 'rare-iot-stack', name: 'rare-iot-stack', dataPoints: 4, attempts: 4 },
  { stack: 'php-laravel', name: 'php-laravel', dataPoints: 120, attempts: 120 },
];
const SAMPLE_CORRECTIONS = [
  { huntId: 'h1', id: 'h1', fromStack: 'php', wrongStack: 'php', toStack: 'node', correctStack: 'node', lessons: 12, reattributed: 12 },
  { huntId: 'h2', id: 'h2', fromStack: 'java', toStack: 'go', lessons: 3 },
];
const SAMPLE_CONFIRMATIONS = [
  { findingType: 'sqli', stack: 'php-laravel', requests: 4, confirmRequests: 4, sequence: 'replay-then-blind' },
  { findingType: 'sqli', stack: 'php-laravel', requests: 6, confirmRequests: 6, sequence: 'replay-then-blind' },
  { findingType: 'xss', stack: 'node-express', requests: 2, confirmRequests: 2, sequence: 'dom-proof' },
];
const SAMPLE_FAMILIES = [
  { family: 'legacy-xss-vector', payload: 'legacy-xss-vector', attempts: 100, successes: 2 },
  { family: 'modern-sqli', payload: 'modern-sqli', attempts: 100, successes: 40 },
];
const SAMPLE_SNAPSHOTS = [
  { stack: 'php-laravel', at: '2026-07-01T00:00:00Z', hitRate: 0.5, rate: 0.5 },
  { stack: 'php-laravel', at: '2026-10-01T00:00:00Z', hitRate: 0.1, rate: 0.1 },
];
const SAMPLE_GROUPS = [
  { key: 'sqli @ php-laravel', payload: 'sqli', family: 'sqli', stack: 'php-laravel', attempts: 40, successes: 20 },
  { key: 'xss @ node-express', payload: 'xss', family: 'xss', stack: 'node-express', attempts: 4, successes: 1 },
];
const SAMPLE_HUNTS = [
  { strategy: 'auth-first', openingStrategy: 'auth-first', validatedFindings: 8, findings: 8, hours: 2, durationHours: 2, firstFindingMinutes: 30, minutesToFirstFinding: 30, firstHourFindings: 0, hourOneFindings: 0, recoveredFindings: 5, laterFindings: 5 },
  { strategy: 'breadth-first', openingStrategy: 'breadth-first', validatedFindings: 4, findings: 4, hours: 2, durationHours: 2, firstFindingMinutes: 90, minutesToFirstFinding: 90, firstHourFindings: 0, hourOneFindings: 0, recoveredFindings: 1, laterFindings: 1 },
  { strategy: 'deep-dive', openingStrategy: 'deep-dive', validatedFindings: 3, findings: 3, hours: 3, durationHours: 3, firstFindingMinutes: 45, minutesToFirstFinding: 45, firstHourFindings: 2, hourOneFindings: 2, recoveredFindings: 0, laterFindings: 0 },
];
const SAMPLE_FINDINGS = [
  { strategy: 'auth-first', severity: 'critical' },
  { strategy: 'auth-first', severity: 'high' },
  { strategy: 'breadth-first', severity: 'info' },
  { strategy: 'breadth-first', severity: 'low' },
];

function Card({ title, note, children }) {
  return (
    <div className="w78b-card">
      <div className="w78b-title">{title}</div>
      {note ? <div className="w78b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w78b-badge w78b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w78b-kv">
      <span className="w78b-k">{k}</span>
      <span className="w78b-v">{String(v)}</span>
    </div>
  );
}

export function RegionalHostingVariance() {
  const v = XB.compareRegionalHostingVariance(SAMPLE_ATTEMPTS);
  return (<Card title="Regional Hosting Variance" note="Idea 53101"><Kv k="Groups" v={v.count} /><Kv k="Spread" v={v.spread} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ReverseProxyBehaviorLedger() {
  const v = XB.buildReverseProxyBehaviorLedger(SAMPLE_ATTEMPTS);
  return (<Card title="Reverse Proxy Behavior Ledger" note="Idea 53102"><Kv k="Proxies" v={v.count} /><Kv k="Strictest" v={v.strictest ? v.strictest.key : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StackSpecificEvasionRatings() {
  const v = XB.rateStackSpecificEvasion(SAMPLE_ATTEMPTS);
  return (<Card title="Stack-Specific Evasion Ratings" note="Idea 53103"><Kv k="Groups" v={v.count} /><Kv k="Attempts" v={v.evasionAttempts} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function OriginVsEdgeResponseDiffs() {
  const v = XB.diffOriginVsEdgeResponses(SAMPLE_PAIRS);
  return (<Card title="Origin-vs-Edge Response Diffs" note="Idea 53104"><Kv k="Diffs" v={v.diffCount} /><Kv k="Payloads" v={v.count} /><div className="w78b-row"><Badge tone="warn">Infinity AI</Badge></div></Card>);
}

export function FrameworkDefaultConfigBaselines() {
  const v = XB.baselineFrameworkDefaultConfig(SAMPLE_FRAMEWORKS);
  return (<Card title="Framework Default Config Baselines" note="Idea 53105"><Kv k="Frameworks" v={v.count} /><Kv k="Hardened" v={v.hardenedCount} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StackAwarePayloadShortlists() {
  const v = XB.generateStackAwarePayloadShortlist(SAMPLE_ATTEMPTS, { stack: 'php-laravel', limit: 20 });
  return (<Card title="Stack-Aware Payload Shortlists" note="Idea 53106"><Kv k="Shortlisted" v={v.count} /><Kv k="Top" v={v.top ? v.top.payload : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function PayloadStackMismatchWarnings() {
  const v = XB.warnPayloadStackMismatch(SAMPLE_PLANS, SAMPLE_ATTEMPTS);
  return (<Card title="Payload-Stack Mismatch Warnings" note="Idea 53107"><Kv k="Warnings" v={v.warningCount} /><Kv k="Plans" v={v.count} /><div className="w78b-row"><Badge tone="warn">Infinity AI</Badge></div></Card>);
}

export function StackRarityResearchPrompts() {
  const v = XB.promptStackRarityResearch(SAMPLE_STACKS);
  return (<Card title="Stack Rarity Research Prompts" note="Idea 53108"><Kv k="Prompts" v={v.promptCount} /><Kv k="Rarest" v={v.rarest ? v.rarest.stack : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function QuarterlyStackEffectivenessReport() {
  const v = XB.buildQuarterlyStackEffectivenessReport(SAMPLE_ATTEMPTS);
  return (<Card title="Quarterly Stack Effectiveness Report" note="Idea 53109"><Kv k="Rows" v={v.count} /><Kv k="Quarters" v={v.quarters.length} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StackFingerprintCorrectionLoop() {
  const v = XB.runStackFingerprintCorrectionLoop(SAMPLE_CORRECTIONS);
  return (<Card title="Stack Fingerprint Correction Loop" note="Idea 53110"><Kv k="Corrections" v={v.appliedCount} /><Kv k="Lessons" v={v.reattributedLessons} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function CrossStackTransferScores() {
  const v = XB.scoreCrossStackTransfer(SAMPLE_ATTEMPTS);
  return (<Card title="Cross-Stack Transfer Scores" note="Idea 53111"><Kv k="Routes" v={v.count} /><Kv k="Attempts" v={v.transferAttempts} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StackSpecificConfirmationPlaybooks() {
  const v = XB.buildStackSpecificConfirmationPlaybooks(SAMPLE_CONFIRMATIONS);
  return (<Card title="Stack-Specific Confirmation Playbooks" note="Idea 53112"><Kv k="Playbooks" v={v.count} /><Kv k="Cheapest" v={v.cheapest ? v.cheapest.key : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function PayloadFamilyRetirementVotes() {
  const v = XB.votePayloadFamilyRetirement(SAMPLE_FAMILIES);
  return (<Card title="Payload Family Retirement Votes" note="Idea 53113"><Kv k="Retire" v={v.retireCount} /><Kv k="Families" v={v.count} /><div className="w78b-row"><Badge tone="warn">Infinity AI</Badge></div></Card>);
}

export function NewStackOnboardingChecklist() {
  const v = XB.buildNewStackOnboardingChecklist({ stack: 'fresh-edge-stack', name: 'fresh-edge-stack' });
  return (<Card title="New Stack Onboarding Checklist" note="Idea 53114"><Kv k="Steps" v={v.stepCount} /><Kv k="Stack" v={v.stack} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StackDriftDetection() {
  const v = XB.detectStackDrift(SAMPLE_SNAPSHOTS);
  return (<Card title="Stack Drift Detection" note="Idea 53115"><Kv k="Drifts" v={v.driftCount} /><Kv k="Comparisons" v={v.count} /><div className="w78b-row"><Badge tone="warn">Infinity AI</Badge></div></Card>);
}

export function EffectivenessConfidenceIntervals() {
  const v = XB.attachEffectivenessConfidenceIntervals(SAMPLE_GROUPS);
  return (<Card title="Effectiveness Confidence Intervals" note="Idea 53116"><Kv k="Scores" v={v.count} /><Kv k="Data-backed" v={v.dataBackedCount} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StrategyLeaderboardByFindings() {
  const v = XB.buildStrategyLeaderboardByFindings(SAMPLE_HUNTS);
  return (<Card title="Strategy Leaderboard by Findings" note="Idea 53117"><Kv k="Strategies" v={v.count} /><Kv k="Leader" v={v.leader ? v.leader.key : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function OpeningMoveWinRates() {
  const v = XB.trackOpeningMoveWinRates(SAMPLE_HUNTS);
  return (<Card title="Opening Move Win Rates" note="Idea 53118"><Kv k="Strategies" v={v.count} /><Kv k="Best" v={v.best ? v.best.key : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function StrategyVsSeverityMatrix() {
  const v = XB.buildStrategyVsSeverityMatrix(SAMPLE_FINDINGS);
  return (<Card title="Strategy-vs-Severity Matrix" note="Idea 53119"><Kv k="Strategies" v={v.count} /><Kv k="Best critical" v={v.bestCritical ? v.bestCritical.key : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

export function ComebackStrategyTracking() {
  const v = XB.trackComebackStrategy(SAMPLE_HUNTS);
  return (<Card title="Comeback Strategy Tracking" note="Idea 53120"><Kv k="Slow starts" v={v.slowStartCount} /><Kv k="Best" v={v.best ? v.best.key : 'none'} /><div className="w78b-row"><Badge tone="info">Infinity AI</Badge></div></Card>);
}

const W78_B_GALLERY = [
  RegionalHostingVariance,
  ReverseProxyBehaviorLedger,
  StackSpecificEvasionRatings,
  OriginVsEdgeResponseDiffs,
  FrameworkDefaultConfigBaselines,
  StackAwarePayloadShortlists,
  PayloadStackMismatchWarnings,
  StackRarityResearchPrompts,
  QuarterlyStackEffectivenessReport,
  StackFingerprintCorrectionLoop,
  CrossStackTransferScores,
  StackSpecificConfirmationPlaybooks,
  PayloadFamilyRetirementVotes,
  NewStackOnboardingChecklist,
  StackDriftDetection,
  EffectivenessConfidenceIntervals,
  StrategyLeaderboardByFindings,
  OpeningMoveWinRates,
  StrategyVsSeverityMatrix,
  ComebackStrategyTracking,
];

/** Gallery: renders every Wave 78B component, export-only. */
export function Wave78BGallery() {
  return (
    <div className="w78b-gallery">
      {W78_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
