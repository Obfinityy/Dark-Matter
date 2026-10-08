/**
 * PlatformSubmit.jsx — Infinity AI · Dark-Matter · Wave 58
 * 21 working React components for bug-bounty platform submission, ideas 52300–52320.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as P from './platformSubmitCore.js';

const SAMPLE_FINDING = {
  id: 'f-60', title: 'Stored XSS in product reviews', severity: 'high', cvss: 8.2,
  vulnClass: 'xss', status: 'open', target: 'shop',
  endpoint: 'https://shop.example.com/reviews',
  description: 'The review body is rendered without output encoding, so attacker-supplied markup executes in victim browsers.',
  impact: null,
  poc: 'curl -X POST https://shop.example.com/reviews -d "body=<script>alert(1)</script>"',
  pocPython: 'import requests\nrequests.post("https://shop.example.com/reviews", data={"body": "<script>alert(1)</script>"})',
  pocTrace: ['Log in as any user', 'Post a review with body <script>alert(1)</script>', 'View the product page — the script executes'],
  evidence: [{ kind: 'screenshot', name: 'xss-alert.png', sizeBytes: 184320, caption: 'Alert box fired' }],
  remediation: 'Encode review output with a context-aware encoder and deploy a strict Content-Security-Policy.',
  references: ['https://owasp.org/www-community/attacks/xss/'],
};

const NOW = 1700000000000;

function Note({ children }) {
  return <p className="ps58-note">{children}</p>;
}

/* 52300 — HackerOne draft generator. */
export function HackerOneDraft() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52300 · HackerOne draft</h3>
      <button className="ps58-btn" onClick={() => setRes(P.buildHackerOneDraft(SAMPLE_FINDING))}>Build draft</button>
      {res && res.ok && <Note>{res.draft.title} · severity {res.draft.severity} · weakness {res.draft.weakness} · {res.draft.attachments.length} attachment(s)</Note>}
    </div>
  );
}

/* 52301 — Bugcrowd draft generator. */
export function BugcrowdDraft() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52301 · Bugcrowd draft</h3>
      <button className="ps58-btn" onClick={() => setRes(P.buildBugcrowdDraft(SAMPLE_FINDING))}>Build draft</button>
      {res && res.ok && <Note>{res.draft.title} · type {res.draft.vulnerability_type} · {res.draft.reproduction_steps.length} step(s) · refs {res.draft.references.length}</Note>}
    </div>
  );
}

/* 52302 — Intigriti draft generator. */
export function IntigritiDraft() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52302 · Intigriti draft</h3>
      <button className="ps58-btn" onClick={() => setRes(P.buildIntigritiDraft(SAMPLE_FINDING))}>Build draft</button>
      {res && res.ok && <Note>{res.draft.title} · severity {res.draft.severity} · endpoint {res.draft.affected_endpoint}</Note>}
    </div>
  );
}

/* 52303 — YesWeHack draft generator. */
export function YesWeHackDraft() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52303 · YesWeHack draft</h3>
      <button className="ps58-btn" onClick={() => setRes(P.buildYesWeHackDraft(SAMPLE_FINDING))}>Build draft</button>
      {res && res.ok && <Note>{res.draft.title} · criticality {res.draft.criticality} · remediation: {res.draft.remediation ? 'present' : 'missing'}</Note>}
    </div>
  );
}

/* 52304 — Per-platform field mapping table. */
export function PlatformFieldMapping() {
  const [platform, setPlatform] = useState('hackerone');
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52304 · Per-platform field mapping</h3>
      <div className="ps58-row">
        {P.PLATFORMS.map((p) => <button key={p} className="ps58-chip" onClick={() => { setPlatform(p); setRes(P.mapFindingFields(SAMPLE_FINDING, p)); }}>{p}</button>)}
      </div>
      {res && res.ok && <Note>{platform}: severity → “{res.mapping.severity}”, steps → “{res.mapping.steps}”, asset → “{res.mapping.asset}”</Note>}
    </div>
  );
}

/* 52305 — Platform severity auto-mapping. */
export function PlatformSeverityMapping() {
  const [platform, setPlatform] = useState('bugcrowd');
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52305 · Platform severity auto-mapping</h3>
      <div className="ps58-row">
        {P.PLATFORMS.map((p) => <button key={p} className="ps58-chip" onClick={() => setPlatform(p)}>{p}</button>)}
      </div>
      <Note>high / CVSS 8.2 → {platform}: {P.mapSeverity('high', 8.2, platform).label} · internal-only critical → {platform}: {P.mapSeverity('critical', null, platform).label}</Note>
    </div>
  );
}

/* 52306 — One-click copy formatted report. */
export function CopyableReport() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52306 · One-click copy report</h3>
      <button className="ps58-btn" onClick={() => setRes(P.buildCopyableReport(SAMPLE_FINDING))}>Build markdown</button>
      {res && res.ok && <pre className="ps58-mono">{res.markdown.slice(0, 220)}…</pre>}
      {res && <Note>{res.length} chars, markdown preserved</Note>}
    </div>
  );
}

/* 52307 — Approval-gated API submission state machine. */
export function ApprovalGatedSubmission() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52307 · Approval-gated submission</h3>
      <button className="ps58-btn" onClick={() => {
        const payload = P.buildHackerOneDraft(SAMPLE_FINDING).draft;
        const sub = P.createSubmission({ platform: 'hackerone', finding: SAMPLE_FINDING, payload }, NOW).submission;
        const requested = P.submissionReducer(sub, { type: 'REQUEST_APPROVAL' }, NOW + 1).submission;
        const tampered = { ...requested, payload: { ...requested.payload, title: 'changed' } };
        const badApprove = P.submissionReducer(tampered, { type: 'APPROVE', payloadHash: requested.payloadHash }, NOW + 2);
        const goodApprove = P.submissionReducer(requested, { type: 'APPROVE', by: 'bhavesh', payloadHash: requested.payloadHash }, NOW + 2).submission;
        const sent = P.submissionReducer(goodApprove, { type: 'MARK_SENT', payloadHash: requested.payloadHash }, NOW + 3);
        setRes({ badApprove, sent, networkCalls: sent.submission.networkCalls });
      }}>Run gate flow</button>
      {res && <Note>tampered approve blocked: {res.badApprove.reason} · final state: {res.sent.submission.state} · network calls made: {res.networkCalls}</Note>}
    </div>
  );
}

/* 52308 — Submission draft status tracker. */
export function SubmissionStatusTracker() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52308 · Submission status tracker</h3>
      <button className="ps58-btn" onClick={() => {
        let t = P.createSubmissionTracker(SAMPLE_FINDING.id, 'bugcrowd', NOW).tracker;
        for (const to of ['submitted', 'triaged', 'resolved']) t = P.draftStatusReducer(t, { to }, NOW).tracker;
        const jump = P.draftStatusReducer(t, { to: 'draft' }, NOW);
        const paid = P.draftStatusReducer(t, { to: 'paid', payout: 750 }, NOW);
        setRes({ jump, paid });
      }}>Track to paid</button>
      {res && <Note>backward jump blocked: {res.jump.reason} · final: {res.paid.tracker.state} · payout ${res.paid.tracker.payout}</Note>}
    </div>
  );
}

/* 52309 — Pre-submission checklist per platform. */
export function PresubmissionChecklist() {
  const [platform, setPlatform] = useState('hackerone');
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52309 · Pre-submission checklist</h3>
      <div className="ps58-row">
        {P.PLATFORMS.map((p) => <button key={p} className="ps58-chip" onClick={() => { setPlatform(p); setRes(P.runChecklist(SAMPLE_FINDING, p)); }}>{p}</button>)}
      </div>
      {res && <Note>{platform}: {res.passed ? 'all checks passed' : `failed: ${res.failed.join(', ')}`} ({res.results.filter((r) => r.pass).length}/{res.results.length})</Note>}
    </div>
  );
}

/* 52310 — Duplicate check. */
export function DuplicateCheck() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52310 · Duplicate check</h3>
      <button className="ps58-btn" onClick={() => setRes(P.checkDuplicates(SAMPLE_FINDING,
        [{ id: 'f-01', title: 'Stored XSS in product reviews', description: 'review body not encoded', asset: 'shop.example.com' }],
        [{ id: 'd-9', title: 'Reflected XSS on search', description: 'search param reflected', asset: 'other.example.com' }],
      ))}>Check duplicates</button>
      {res && <Note>likely duplicate: {String(res.likelyDuplicate)} · {res.duplicates.length} candidate(s){res.duplicates[0] ? ` · top: ${res.duplicates[0].id} (${res.duplicates[0].source}, ${res.duplicates[0].score})` : ''}</Note>}
    </div>
  );
}

/* 52311 — Platform scope validation. */
export function PlatformScopeValidation() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52311 · Platform scope validation</h3>
      <button className="ps58-btn" onClick={() => setRes({
        inScope: P.validateScope(SAMPLE_FINDING, { inScope: ['shop.example.com'] }),
        out: P.validateScope(SAMPLE_FINDING, { inScope: ['shop.example.com'], outOfScope: ['shop.example.com/reviews'] }),
      })}>Validate scope</button>
      {res && <Note>in scope: {String(res.inScope.inScope)} ({res.inScope.asset}) · excluded path: {res.out.reason}</Note>}
    </div>
  );
}

/* 52312 — Bounty estimate display. */
export function BountyEstimate() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52312 · Bounty estimate</h3>
      <button className="ps58-btn" onClick={() => setRes(P.estimateBounty('xss', 'high'))}>Estimate XSS/high</button>
      {res && res.ok && <Note>{res.vulnClass}/{res.severity}: ${res.estimate.low}–${res.estimate.high} {res.estimate.currency} · {res.note}</Note>}
    </div>
  );
}

/* 52313 — Auto-attached PoC files manifest. */
export function PocFileManifest() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52313 · PoC files manifest</h3>
      <button className="ps58-btn" onClick={() => setRes(P.buildPocManifest(SAMPLE_FINDING))}>Build manifest</button>
      {res && res.ok && <Note>{res.count} file(s): {res.manifest.map((m) => `${m.name} (${m.kind})`).join(', ')}</Note>}
    </div>
  );
}

/* 52314 — Screenshot attachment pack collector. */
export function ScreenshotPack() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52314 · Screenshot pack</h3>
      <button className="ps58-btn" onClick={() => setRes(P.collectScreenshots(SAMPLE_FINDING.evidence, { maxTotalBytes: 1024 }))}>Collect (1KB cap)</button>
      {res && res.ok && <Note>{res.pack.count} screenshot(s) · {(res.pack.totalBytes / 1024).toFixed(1)}KB total · within limit: {String(res.pack.withinLimit)}</Note>}
    </div>
  );
}

/* 52315 — Video PoC attachment descriptor. */
export function VideoPoCDescriptor() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52315 · Video PoC descriptor</h3>
      <button className="ps58-btn" onClick={() => setRes(P.buildVideoPoC(
        { path: '/tmp/xss-poc.mp4', sizeBytes: 180 * 1024 * 1024, durationSec: 96 },
        { maxBytes: 100 * 1024 * 1024 },
      ))}>Describe oversize video</button>
      {res && res.ok && <Note>{res.video.format} · {(res.video.sizeBytes / 1048576).toFixed(0)}MB · within limit: {String(res.video.withinLimit)} · {res.video.recommendation || 'ok'}</Note>}
    </div>
  );
}

/* 52316 — CVSS-to-platform severity translator. */
export function CvssSeverityTranslator() {
  const [platform, setPlatform] = useState('intigriti');
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52316 · CVSS → platform translator</h3>
      <div className="ps58-row">
        {P.PLATFORMS.map((p) => <button key={p} className="ps58-chip" onClick={() => setPlatform(p)}>{p}</button>)}
      </div>
      <Note>{P.translateCvss(9.8, platform).explanation}</Note>
    </div>
  );
}

/* 52317 — CWE auto-tagging. */
export function CweAutoTagging() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52317 · CWE auto-tagging</h3>
      <button className="ps58-btn" onClick={() => setRes(P.tagCwe(SAMPLE_FINDING))}>Tag CWEs</button>
      {res && res.ok && <Note>{res.cwes.map((c) => `${c.id} ${c.name}`).join(' · ') || 'no CWE matched'}</Note>}
    </div>
  );
}

/* 52318 — Affected-asset auto-fill. */
export function AssetAutoFill() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52318 · Affected-asset auto-fill</h3>
      <button className="ps58-btn" onClick={() => setRes(P.fillAsset(SAMPLE_FINDING))}>Fill asset</button>
      {res && res.ok && <Note>url {res.asset.url} · host {res.asset.host} · type {res.asset.type} · from {res.asset.fromField}</Note>}
    </div>
  );
}

/* 52319 — Steps-to-reproduce formatter. */
export function StepsFormatter() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52319 · Steps formatter</h3>
      <button className="ps58-btn" onClick={() => setRes(P.formatSteps(SAMPLE_FINDING.pocTrace))}>Format steps</button>
      {res && <pre className="ps58-mono">{res.text}</pre>}
    </div>
  );
}

/* 52320 — Impact statement generator. */
export function ImpactStatementGenerator() {
  const [res, setRes] = useState(null);
  return (
    <div className="ps58-card">
      <h3 className="ps58-title">52320 · Impact statement generator</h3>
      <button className="ps58-btn" onClick={() => setRes(P.generateImpact(SAMPLE_FINDING))}>Generate impact</button>
      {res && res.ok && <Note>{res.impact} {res.templated ? '(from vuln-class template)' : '(generic fallback)'}</Note>}
    </div>
  );
}

export const PS_GALLERY = [
  HackerOneDraft, BugcrowdDraft, IntigritiDraft, YesWeHackDraft,
  PlatformFieldMapping, PlatformSeverityMapping, CopyableReport, ApprovalGatedSubmission,
  SubmissionStatusTracker, PresubmissionChecklist, DuplicateCheck, PlatformScopeValidation,
  BountyEstimate, PocFileManifest, ScreenshotPack, VideoPoCDescriptor,
  CvssSeverityTranslator, CweAutoTagging, AssetAutoFill, StepsFormatter,
  ImpactStatementGenerator,
];

export function PlatformSubmitGallery() {
  return (
    <div className="ps58-gallery">
      {PS_GALLERY.map((C, i) => <C key={i} />)}
    </div>
  );
}
