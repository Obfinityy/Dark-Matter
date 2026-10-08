/**
 * Wave72B.jsx — Infinity AI · Dark-Matter · Wave 72
 * 20 working React components for post-hunt Q&A round 3,
 * ideas 52861–52880. Export-only module: components are not
 * mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XB from './wave72BCores.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'confirmed', target: 'shop.example.com/checkout', cwe: 'CWE-89', riskScore: 92, authRequired: false, cvss: { score: 9.8, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }, tags: ['checkout', 'payment'], evidence: ['Unauthenticated checkout query returned every order id and customer email', 'Database error page confirmed the query reaches the orders table'], pocSteps: ['Open the checkout search without a login', "Submit ' OR 1=1 -- and observe the full order list"], impact: 'Customer order and payment records could be read by anyone.', verifiedBy: 'verifier-1', createdAt: '2026-10-01T09:00:00Z', sharedServices: ['payments-db'], history: [{ from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-02T09:00:00Z', reason: 'reproduced' }] },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com/search', cwe: 'CWE-79', riskScore: 74, authRequired: true, cvss: { score: 6.1, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N' }, tags: ['search'], evidence: ['Reflected script executed in a shopper session'], pocSteps: ['Search with the recorded script input', 'Observe the script run in the results page'], impact: 'A shopper session could be hijacked from the search page.', createdAt: '2026-10-03T09:00:00Z', sharedServices: [] },
  { id: 'f3', title: 'IDOR in invoices', severity: 'high', status: 'triaged', target: 'api.example.com/invoices/1001', cwe: 'CWE-862', riskScore: 81, authRequired: true, tags: ['invoice', 'billing'], evidence: ['Invoice of another customer opened by changing the id; billing data shown'], pocSteps: ['Open own invoice', 'Change the invoice number and observe another customer record'], impact: 'Customers could read each others invoices and billing data.', createdAt: '2026-10-04T09:00:00Z', sharedServices: ['payments-db'] },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'verified', target: 'shop.example.com/profile', cwe: 'CWE-209', riskScore: 21, authRequired: true, tags: ['profile'], evidence: ['Stack trace in error screen'], impact: 'Internal paths were visible in error responses.', verifiedBy: 'verifier-1', createdAt: '2026-10-02T09:00:00Z', sharedServices: [] },
];

const DEMO_HUNT = {
  huntId: 'hunt-42',
  target: 'shop.example.com',
  findings: DEMO_FINDINGS,
  learnings: [
    { pattern: 'Checkout search reaches the orders table without a login', tech: 'shop.example.com', confidence: 90, findingId: 'f1', recordedAt: '2026-10-05T09:00:00Z' },
    { pattern: 'Invoice ids are sequential across customers', tech: 'api.example.com', confidence: 80, findingId: 'f3', recordedAt: '2026-10-05T10:00:00Z' },
  ],
  qaHistory: [
    { id: 'qa-1', question: 'Which checkout finding is critical?', answer: 'f1 is critical and touches payments.', findingId: 'f1', askedBy: 'lead-1', at: '2026-10-08T09:00:00Z' },
    { id: 'qa-2', question: 'Is the invoice issue in a chain?', answer: 'Not yet recorded in a chain.', findingId: 'f3', askedBy: 'analyst-1', at: '2026-10-08T10:00:00Z' },
  ],
};

const DEMO_ASSETS = [
  { id: 'asset-shop', host: 'shop.example.com', owner: 'meera', team: 'appsec', expertise: ['cwe-89', 'checkout'], sharedServices: ['payments-db'] },
  { id: 'asset-api', host: 'api.example.com', owner: 'aarav', team: 'platform', expertise: ['cwe-862'], sharedServices: ['payments-db'] },
];

const DEMO_CHAINS = [
  { id: 'chain-1', title: 'Search to checkout', findingIds: ['f2', 'f1'], combinedImpact: 'Session theft leads to checkout data access.' },
];

function Card({ title, note, children }) {
  return (
    <div className="w72b-card">
      <div className="w72b-title">{title}</div>
      {note ? <div className="w72b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w72b-badge w72b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w72b-kv">
      <span className="w72b-k">{k}</span>
      <span className="w72b-v">{String(v)}</span>
    </div>
  );
}

export function PaymentFlowRiskQa() {
  const v = XB.filterPaymentFindings(DEMO_FINDINGS, {});
  return (
    <Card title="Payment-flow risk Q&A" note="Idea 52861">
      <Kv k="Payment findings" v={v.count} />
      <Kv k="Combined risk" v={v.exposure} />
      <div className="w72b-note">{v.answer.slice(0, 72)}</div>
    </Card>
  );
}

export function RealWorldExploitabilityRanking() {
  const v = XB.rankByExploitability(DEMO_FINDINGS, {});
  return (
    <Card title="Real-world exploitability ranking" note="Idea 52862">
      <Kv k="Top" v={v.topId || 'none'} />
      <Kv k="Top score" v={v.ranked[0] ? v.ranked[0].exploitabilityScore : 0} />
      <Kv k="Tier" v={v.ranked[0] ? v.ranked[0].exploitabilityTier : 'none'} />
    </Card>
  );
}

export function AgentLearningRecap() {
  const v = XB.summarizeAgentLearnings(DEMO_HUNT, {});
  return (
    <Card title="Agent learning recap" note="Idea 52863">
      <Kv k="Patterns" v={v.patternCount} />
      <Kv k="Source" v={v.source} />
      <Kv k="Areas" v={Object.keys(v.byTech).length} />
    </Card>
  );
}

export function ReasoningTraceBrowser() {
  const v = XB.browseReasoningTrace(DEMO_FINDINGS[0], {});
  return (
    <Card title="Reasoning-trace browser" note="Idea 52864">
      <Kv k="Steps" v={v.totalSteps} />
      <Kv k="Source" v={v.source} />
      <Kv k="Key decisions" v={v.keyDecisions.length} />
    </Card>
  );
}

export function DevilsAdvocateChallenge() {
  const v = XB.challengeFinding(DEMO_FINDINGS[3], {});
  return (
    <Card title="Devil's-advocate challenge" note="Idea 52865">
      <Kv k="Challenges" v={v.challengeCount} />
      <Kv k="FP risk" v={v.falsePositiveRisk} />
      <div className="w72b-row"><Badge tone={v.verdict === 'likely-valid' ? 'ok' : 'warn'}>{v.verdict}</Badge></div>
    </Card>
  );
}

export function FixOptionComparison() {
  const v = XB.compareFixOptions(DEMO_FINDINGS[0], {});
  return (
    <Card title="Fix-option comparison" note="Idea 52866">
      <Kv k="Options" v={v.options.length} />
      <Kv k="Weakness" v={v.weakness} />
      <Kv k="Recommended" v={v.recommendedId} />
    </Card>
  );
}

export function CheapestFixFinder() {
  const v = XB.findCheapestFix(DEMO_FINDINGS[0], {});
  return (
    <Card title="Cheapest-fix finder" note="Idea 52867">
      <Kv k="Kind" v={v.mitigation.kind} />
      <Kv k="Hours" v={v.mitigation.effortHours} />
      <Kv k="Steps" v={v.steps.length} />
    </Card>
  );
}

export function DisclosureTimelineDrafting() {
  const v = XB.draftDisclosureTimeline(DEMO_FINDINGS[0], {}, {});
  return (
    <Card title="Disclosure-timeline drafting" note="Idea 52868">
      <Kv k="Milestones" v={v.milestones.length} />
      <Kv k="Total days" v={v.totalDays} />
      <Kv k="Disclosure" v={String(v.disclosureDate || '').slice(0, 10)} />
    </Card>
  );
}

export function FixOwnerRecommendation() {
  const v = XB.recommendFixOwner(DEMO_FINDINGS[0], DEMO_ASSETS, {});
  return (
    <Card title="Fix-owner recommendation" note="Idea 52869">
      <Kv k="Owner" v={v.recommended ? v.recommended.owner : 'triage'} />
      <Kv k="Team" v={v.recommended ? v.recommended.team : 'none'} />
      <Kv k="Score" v={v.recommended ? v.recommended.score : 0} />
    </Card>
  );
}

export function ScopeEligibilityCheck() {
  const v = XB.checkScopeEligibility(DEMO_FINDINGS[0], { program: 'shop program', inScope: ['*.example.com'], outOfScope: ['admin.example.com'] }, {});
  return (
    <Card title="Scope-eligibility check" note="Idea 52870">
      <Kv k="Decision" v={v.decision} />
      <Kv k="Program" v={v.program || 'none'} />
      <Kv k="Pattern" v={v.matchedPattern || 'none'} />
    </Card>
  );
}

export function NonTechnicalRewrite() {
  const v = XB.rewriteForNonTechnical(DEMO_FINDINGS[0], {});
  return (
    <Card title="Non-technical rewrite" note="Idea 52871">
      <Kv k="Title" v={v.plainTitle.slice(0, 40)} />
      <div className="w72b-note">{v.plainSummary.slice(0, 72)}</div>
      <Kv k="Severity" v={v.severityPlain.slice(0, 24)} />
    </Card>
  );
}

export function ExecSlideGeneration() {
  const v = XB.generateExecSlide(DEMO_HUNT, {});
  return (
    <Card title="Exec-slide generation" note="Idea 52872">
      <Kv k="Headline" v={v.headline} />
      <Kv k="Bullets" v={v.bullets.length} />
      <Kv k="Chart slices" v={v.chart.data.length} />
    </Card>
  );
}

export function PrDescriptionDrafting() {
  const v = XB.draftPrDescription(DEMO_FINDINGS[0], { branch: 'fix/f1-checkout-sqli', files: ['src/checkout/search.js'], tests: ['checkout search rejects the recorded proof'], commits: ['a1b2c3d'] }, { author: 'Infinity AI' });
  return (
    <Card title="PR-description drafting" note="Idea 52873">
      <Kv k="Ready" v={String(v.ready)} />
      <Kv k="Words" v={v.wordCount} />
      <Kv k="Labels" v={v.labels.join(', ')} />
    </Card>
  );
}

export function DetectionSuggestionQa() {
  const v = XB.suggestDetections(DEMO_FINDINGS[0], {});
  return (
    <Card title="Detection-suggestion Q&A" note="Idea 52874">
      <Kv k="Detections" v={v.detectionCount} />
      <Kv k="First" v={v.detections[0] ? v.detections[0].name : 'none'} />
      <Kv k="Class" v={v.cwe} />
    </Card>
  );
}

export function WafRuleSuggestion() {
  const v = XB.suggestWafRule(DEMO_FINDINGS[1], {});
  return (
    <Card title="WAF-rule suggestion" note="Idea 52875">
      <Kv k="Rule" v={v.ruleId} />
      <Kv k="Mode" v={v.startMode} />
      <Kv k="Syntax" v={v.syntax} />
      <div className="w72b-presig">{v.rule.slice(0, 64)}</div>
    </Card>
  );
}

export function ChainMembershipQa() {
  const v = XB.checkChainMembership(DEMO_FINDINGS[0], DEMO_CHAINS, DEMO_FINDINGS);
  return (
    <Card title="Chain-membership Q&A" note="Idea 52876">
      <Kv k="In chain" v={String(v.inChain)} />
      <Kv k="Chains" v={v.chainCount} />
      <Kv k="Host links" v={v.linkedIds.length} />
    </Card>
  );
}

export function CvssVectorBreakdown() {
  const v = XB.explainCvssVector(DEMO_FINDINGS[0], {});
  return (
    <Card title="CVSS vector breakdown" note="Idea 52877">
      <Kv k="Metrics" v={v.metricCount} />
      <Kv k="Score" v={v.score === null ? 'n/a' : v.score} />
      <Kv k="Version" v={v.version || 'n/a'} />
      <div className="w72b-note">{v.metrics[0] ? v.metrics[0].plainEnglish.slice(0, 56) : 'none'}</div>
    </Card>
  );
}

export function VoiceQaWithAvatar() {
  const v = XB.planVoiceAnswer({ question: 'What is the top priority?', finding: DEMO_FINDINGS[0], avatarGender: 'female' }, {});
  return (
    <Card title="Voice Q&A with avatar" note="Idea 52878">
      <Kv k="Voice" v={v.voice} />
      <Kv k="Seconds" v={v.estimatedSeconds} />
      <Kv k="Expression" v={v.avatar.expression} />
      <div className="w72b-note">{v.speakableText.slice(0, 60)}</div>
    </Card>
  );
}

export function EvidenceCitedAnswers() {
  const v = XB.citeEvidence({ answer: 'The checkout query returned every order id and customer email without a login.', finding: DEMO_FINDINGS[0] }, {});
  return (
    <Card title="Evidence-cited answers" note="Idea 52879">
      <Kv k="Claims" v={v.claimCount} />
      <Kv k="Cited" v={v.citationCount} />
      <Kv k="Coverage" v={`${v.coveragePercent}%`} />
    </Card>
  );
}

export function QaHistoryPerHunt() {
  const v = XB.searchQaHistory(DEMO_HUNT, 'checkout', {});
  return (
    <Card title="Q&A history per hunt" note="Idea 52880">
      <Kv k="Matches" v={v.total} />
      <Kv k="Hunt" v={v.huntId || 'none'} />
      <Kv k="Checked" v={NOW.slice(0, 10)} />
    </Card>
  );
}

/** Gallery list: all 20 idea-52861–52880 components, export-only. */
export const W72_B_GALLERY = [
  PaymentFlowRiskQa,
  RealWorldExploitabilityRanking,
  AgentLearningRecap,
  ReasoningTraceBrowser,
  DevilsAdvocateChallenge,
  FixOptionComparison,
  CheapestFixFinder,
  DisclosureTimelineDrafting,
  FixOwnerRecommendation,
  ScopeEligibilityCheck,
  NonTechnicalRewrite,
  ExecSlideGeneration,
  PrDescriptionDrafting,
  DetectionSuggestionQa,
  WafRuleSuggestion,
  ChainMembershipQa,
  CvssVectorBreakdown,
  VoiceQaWithAvatar,
  EvidenceCitedAnswers,
  QaHistoryPerHunt,
];

/** Gallery: renders every Wave 72B component, export-only. */
export function Wave72BGallery() {
  return (
    <div className="w72b-gallery">
      {W72_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
