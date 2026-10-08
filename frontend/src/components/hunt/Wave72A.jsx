/**
 * Wave72A.jsx — Infinity AI · Dark-Matter · Wave 72
 * 20 working React components for post-hunt Q&A round 2,
 * ideas 52841–52860. Export-only module: components are not
 * mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XA from './wave72ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'confirmed', target: 'shop.example.com', cwe: 'CWE-89', riskScore: 92, effort: 'medium', authRequired: false, authContext: 'none', payload: "' OR 1=1 --", tags: ['checkout', 'sqli'], dataTypes: ['customer or order records'], evidence: ['Unauthenticated response listed order id and customer email admin@shop.example.com'], pocSteps: [{ action: 'Open checkout search without login', expected: 'Normal results only', observed: 'All orders returned' }, { action: "Submit ' OR 1=1 -- as the query", expected: 'Input treated as data', observed: 'Full order table returned' }], impact: 'Customer order and payment records could be read by anyone.' },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com', cwe: 'CWE-79', riskScore: 74, authRequired: true, payload: '<script>alert(1)</script>', tags: ['search'], evidence: ['Reflected script executed for a logged in user with Bearer session'], pocSteps: [{ action: 'Log in and open search', expected: 'Query shown as text', observed: 'Script executed' }], impact: 'A visitor session could be hijacked from search.' },
  { id: 'f3', title: 'IDOR in invoices', severity: 'high', status: 'triaged', target: 'api.example.com', cwe: 'CWE-862', riskScore: 81, authRequired: true, authContext: 'user', tags: ['invoice', 'auth'], dataTypes: ['financial records'], evidence: ['Invoice from another customer opened by changing the id; billing data shown'], impact: 'Customers could read each others invoices and billing data.' },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'dismissed', target: 'shop.example.com', cwe: 'CWE-209', riskScore: 21, falsePositive: true, fpReason: 'Stack trace only appears on the internal staging build, not production', fpDecidedBy: 'lead-1', fpDecidedAt: '2026-10-06T09:00:00Z', fpEvidence: ['Production profile returns a generic error page'], evidence: ['Stack trace in error screen on staging'], impact: 'Internal paths were visible on staging only.' },
  { id: 'f5', title: 'Open redirect on logout', severity: 'medium', status: 'confirmed', target: 'shop.example.com', cwe: 'CWE-601', riskScore: 44, authRequired: false, evidence: ['Unauthenticated logout link redirected to an external site without login'], impact: 'Users could be sent to a look-alike site after logout.' },
];

function Card({ title, note, children }) {
  return (
    <div className="w72a-card">
      <div className="w72a-title">{title}</div>
      {note ? <div className="w72a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w72a-badge w72a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w72a-kv">
      <span className="w72a-k">{k}</span>
      <span className="w72a-v">{String(v)}</span>
    </div>
  );
}

export function BossFriendlySummary() {
  const v = XA.buildBossSummary(DEMO_FINDINGS[0]);
  return (
    <Card title="Boss-friendly summaries" note="Idea 52841">
      <Kv k="Headline" v={v.headline.slice(0, 44)} />
      <Kv k="Urgency" v={v.urgency.slice(0, 32)} />
      <div className="w72a-note">{v.bullets[1]}</div>
    </Card>
  );
}

export function FixPrioritizationAdvice() {
  const v = XA.prioritizeFixes(DEMO_FINDINGS);
  return (
    <Card title="Fix-prioritization advice" note="Idea 52842">
      <Kv k="Top pick" v={v.topPick ? v.topPick.title : 'none'} />
      <Kv k="Score" v={v.topPick ? v.topPick.score : 0} />
      <Kv k="Ranked" v={v.ranked.length} />
    </Card>
  );
}

export function AuthRequirementAnalysis() {
  const v = XA.analyzeAuthRequirement(DEMO_FINDINGS[0]);
  return (
    <Card title="Auth-requirement analysis" note="Idea 52843">
      <Kv k="Needs login" v={String(v.requiresAuth)} />
      <Kv k="Confidence" v={v.confidence} />
      <div className="w72a-row"><Badge tone={v.requiresAuth ? 'warn' : 'ok'}>{v.verdict}</Badge></div>
    </Card>
  );
}

export function DataAtRiskInventory() {
  const v = XA.buildDataAtRiskInventory(DEMO_FINDINGS);
  return (
    <Card title="Data-at-risk inventory" note="Idea 52844">
      <Kv k="Data types" v={v.inventory.length} />
      <Kv k="Highest" v={v.highestSensitivity} />
      <Kv k="Top type" v={v.inventory[0] ? v.inventory[0].category : 'none'} />
    </Card>
  );
}

export function SimilarPastFindingsLookup() {
  const past = [{ id: 'p1', title: 'SQLi in product search', severity: 'high', status: 'paid', cwe: 'CWE-89', target: 'shop.example.com', tags: ['sqli'], evidence: ['search query returned all rows'], outcome: 'paid' }];
  const v = XA.findSimilarPastFindings(DEMO_FINDINGS[0], past);
  return (
    <Card title="Similar past findings lookup" note="Idea 52845">
      <Kv k="Matches" v={v.count} />
      <Kv k="Closest" v={v.matches[0] ? v.matches[0].title : 'none'} />
      <Kv k="Outcome" v={v.matches[0] ? v.matches[0].outcome : 'none'} />
    </Card>
  );
}

export function FpJustificationRecall() {
  const v = XA.recallFalsePositiveJustification(DEMO_FINDINGS[3]);
  return (
    <Card title="FP-justification recall" note="Idea 52846">
      <Kv k="False positive" v={String(v.isFalsePositive)} />
      <Kv k="Decided by" v={v.decidedBy || 'none'} />
      <div className="w72a-note">{v.reason.slice(0, 64)}</div>
    </Card>
  );
}

export function StepByStepPocNarration() {
  const v = XA.narratePocSteps(DEMO_FINDINGS[0]);
  return (
    <Card title="Step-by-step PoC narration" note="Idea 52847">
      <Kv k="Steps" v={v.stepCount} />
      <Kv k="Pace" v={v.pace} />
      <div className="w72a-note">{v.steps[0] ? v.steps[0].narration.slice(0, 56) : 'none'}</div>
    </Card>
  );
}

export function PayloadAnatomyQa() {
  const v = XA.analyzePayloadAnatomy(DEMO_FINDINGS[0]);
  return (
    <Card title="Payload anatomy Q&A" note="Idea 52848">
      <Kv k="Payload" v={v.payload} />
      <Kv k="Techniques" v={v.techniques.join(', ') || 'none'} />
      <Kv k="Segments" v={v.segments.length} />
    </Card>
  );
}

export function NextStepBrainstorming() {
  const v = XA.brainstormNextSteps(DEMO_FINDINGS[0]);
  return (
    <Card title="Next-step brainstorming" note="Idea 52849">
      <Kv k="Ideas" v={v.count} />
      <div className="w72a-note">{v.ideas[0] ? v.ideas[0].idea : 'none'}</div>
      <Kv k="First effort" v={v.ideas[0] ? v.ideas[0].effort : 'none'} />
    </Card>
  );
}

export function RegressionChecklistGeneration() {
  const v = XA.generateRegressionChecklist(DEMO_FINDINGS.slice(0, 3));
  return (
    <Card title="Regression-checklist generation" note="Idea 52850">
      <Kv k="Items" v={v.count} />
      <Kv k="Required" v={v.requiredCount} />
      <Kv k="First" v={v.items[0] ? v.items[0].id : 'none'} />
    </Card>
  );
}

export function TicketTextDrafting() {
  const v = XA.draftTicketText(DEMO_FINDINGS[0], { project: 'SEC' });
  return (
    <Card title="Ticket-text drafting" note="Idea 52851">
      <Kv k="Priority" v={v.priority} />
      <Kv k="Project" v={v.project} />
      <Kv k="Repro steps" v={v.reproSteps.length} />
      <div className="w72a-note">{v.summary.slice(0, 52)}</div>
    </Card>
  );
}

export function FindingTranslation() {
  const v = XA.translateFinding(DEMO_FINDINGS[0], 'es');
  return (
    <Card title="Finding translation" note="Idea 52852">
      <Kv k="Language" v={v.language} />
      <Kv k="Supported" v={String(v.supported)} />
      <Kv k="Severity word" v={v.labels.severity || 'none'} />
    </Card>
  );
}

export function ComplianceMappingQa() {
  const v = XA.mapComplianceControls(DEMO_FINDINGS[0]);
  return (
    <Card title="Compliance-mapping Q&A" note="Idea 52853">
      <Kv k="Mappings" v={v.mappings.length} />
      <Kv k="Frameworks" v={v.frameworksCovered.join(', ')} />
      <Kv k="SOC 2" v={v.mappings[0] ? v.mappings[0].soc2 || 'n/a' : 'none'} />
    </Card>
  );
}

export function BountyValueEstimation() {
  const history = [{ amount: 2000 }, { amount: 3000 }, { amount: 2500 }];
  const v = XA.estimateBountyValue(DEMO_FINDINGS[0], { history, currency: 'USD' });
  return (
    <Card title="Bounty-value estimation" note="Idea 52854">
      <Kv k="Range" v={`${v.estimateLow}-${v.estimateHigh} ${v.currency}`} />
      <Kv k="Midpoint" v={v.midpoint} />
      <Kv k="Confidence" v={v.confidence} />
    </Card>
  );
}

export function DuplicateSuspicionQa() {
  const other = { id: 'f9', title: 'SQLi in checkout search', severity: 'critical', cwe: 'CWE-89', target: 'shop.example.com', evidence: DEMO_FINDINGS[0].evidence };
  const v = XA.assessDuplicateSuspicion(DEMO_FINDINGS[0], other);
  return (
    <Card title="Duplicate-suspicion Q&A" note="Idea 52855">
      <Kv k="Likely duplicate" v={String(v.isLikelyDuplicate)} />
      <Kv k="Best match" v={v.bestMatch ? v.bestMatch.id : 'none'} />
      <Kv k="Score" v={v.bestMatch ? v.bestMatch.score : 0} />
    </Card>
  );
}

export function RootCauseAnalysisQa() {
  const v = XA.analyzeRootCause(DEMO_FINDINGS[0]);
  return (
    <Card title="Root-cause analysis Q&A" note="Idea 52856">
      <Kv k="Cause" v={v.primaryCause} />
      <Kv k="Class" v={v.category} />
      <Kv k="Confidence" v={v.confidence} />
    </Card>
  );
}

export function FixVerificationGuidance() {
  const v = XA.buildFixVerificationGuidance(DEMO_FINDINGS[0]);
  return (
    <Card title="Fix-verification guidance" note="Idea 52857">
      <Kv k="Steps" v={v.steps.length} />
      <Kv k="Pass criteria" v={v.passCriteria.length} />
      <div className="w72a-note">{v.steps[0] ? v.steps[0].expected : 'none'}</div>
    </Card>
  );
}

export function TestCaseSuggestions() {
  const v = XA.suggestTestCases(DEMO_FINDINGS[1]);
  return (
    <Card title="Test-case suggestions" note="Idea 52858">
      <Kv k="Cases" v={v.count} />
      <Kv k="Coverage" v={v.coverage.join(', ')} />
      <Kv k="First type" v={v.cases[0] ? v.cases[0].type : 'none'} />
    </Card>
  );
}

export function ThreeBulletHuntSummary() {
  const v = XA.summarizeHuntThreeBullets(DEMO_FINDINGS, { huntLabel: 'Hunt 42' });
  return (
    <Card title="Three-bullet hunt summary" note="Idea 52859">
      <Kv k="Bullets" v={v.bullets.length} />
      <Kv k="Total" v={v.counts.total} />
      <div className="w72a-note">{v.bullets[2]}</div>
    </Card>
  );
}

export function UnauthenticatedFindingsList() {
  const v = XA.listUnauthenticatedFindings(DEMO_FINDINGS);
  return (
    <Card title="Unauthenticated-findings list" note="Idea 52860">
      <Kv k="Open findings" v={v.count} />
      <Kv k="Top" v={v.findings[0] ? v.findings[0].title : 'none'} />
      <Kv k="Excluded" v={v.excludedIds.length} />
      <div className="w72a-row"><Badge tone="ok">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-52841–52860 components, export-only. */
export const W72_A_GALLERY = [
  BossFriendlySummary,
  FixPrioritizationAdvice,
  AuthRequirementAnalysis,
  DataAtRiskInventory,
  SimilarPastFindingsLookup,
  FpJustificationRecall,
  StepByStepPocNarration,
  PayloadAnatomyQa,
  NextStepBrainstorming,
  RegressionChecklistGeneration,
  TicketTextDrafting,
  FindingTranslation,
  ComplianceMappingQa,
  BountyValueEstimation,
  DuplicateSuspicionQa,
  RootCauseAnalysisQa,
  FixVerificationGuidance,
  TestCaseSuggestions,
  ThreeBulletHuntSummary,
  UnauthenticatedFindingsList,
];

/** Gallery: renders every Wave 72A component, export-only. */
export function Wave72AGallery() {
  return (
    <div className="w72a-gallery">
      {W72_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
