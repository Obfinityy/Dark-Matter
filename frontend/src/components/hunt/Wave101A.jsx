/**
 * Wave101A.jsx — Infinity AI · Wave 101
 * 20 working React components for debrief closeout and target onboarding, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X101A from './wave101ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w101a-card">
      <div className="w101a-title">{title}</div>
      {note ? <div className="w101a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w101a-badge w101a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w101a-kv">
      <span className="w101a-k">{k}</span>
      <span className="w101a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w101a-bar-row">
      <span className="w101a-k">{label}</span>
      <div className="w101a-bar"><div className="w101a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w101a-v">{value}</span>
    </div>
  );
}

export function DebriefMobileOptimization() {
  const data = [
    { debriefId: 'dbr-1', device: 'phone', viewportChecks: 5, passedChecks: 5 },
    { debriefId: 'dbr-2', device: 'tablet', viewportChecks: 5, passedChecks: 3 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X101A.optimizeDebriefMobile(data);
  const rows = readyOnly ? v.rows.filter(r => r.optimized) : v.rows;
  return (
    <Card title="DebriefMobileOptimization" note="Idea 54001">
      <Kv k="Mobile-ready" v={v.optimizedCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all debriefs' : 'Show mobile-ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} ${r.device}`} v={r.status} />)}
    </Card>
  );
}
export function DebriefPrintStylesheets() {
  const data = [
    { debriefId: 'dbr-1', pages: 12, printReadyPages: 12 },
    { debriefId: 'dbr-2', pages: 10, printReadyPages: 6 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X101A.buildDebriefPrintStylesheets(data);
  const rows = readyOnly ? v.rows.filter(r => r.printReady) : v.rows;
  return (
    <Card title="DebriefPrintStylesheets" note="Idea 54002">
      <Kv k="Print-ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all debriefs' : 'Show print-ready only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.debriefId} value={r.printCoverage} max={1} />)}
    </Card>
  );
}
export function DebriefDigitalSignatures() {
  const data = [
    { debriefId: 'dbr-1', signed: true, verified: true, signer: 'ana' },
    { debriefId: 'dbr-2', signed: true, verified: false, signer: 'bob' },
  ];
  const [validOnly, setValidOnly] = useState(false);
  const v = X101A.signDebriefDigitally(data);
  const rows = validOnly ? v.rows.filter(r => r.valid) : v.rows;
  return (
    <Card title="DebriefDigitalSignatures" note="Idea 54003">
      <Kv k="Valid signatures" v={v.validCount} />
      <button type="button" onClick={() => setValidOnly(f => !f)}>{validOnly ? 'Show all debriefs' : 'Show valid only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.debriefId} signer`} v={r.signer} />)}
    </Card>
  );
}
export function AnnualDebriefRetrospective() {
  const data = [
    { year: 2026, huntsCompleted: 40, findingsTotal: 320, goalsMet: 10 },
    { year: 2025, huntsCompleted: 30, findingsTotal: 180, goalsMet: 6 },
  ];
  const [doneOnly, setDoneOnly] = useState(false);
  const v = X101A.runAnnualDebriefRetrospective(data);
  const rows = doneOnly ? v.rows.filter(r => r.complete) : v.rows;
  return (
    <Card title="AnnualDebriefRetrospective" note="Idea 54004">
      <Kv k="Years wrapped" v={v.completeCount} />
      <button type="button" onClick={() => setDoneOnly(f => !f)}>{doneOnly ? 'Show all years' : 'Show wrapped only'}</button>
      {rows.map(r => <Kv key={r.key} k={`year ${r.year} per hunt`} v={r.findingsPerHunt} />)}
    </Card>
  );
}
export function SingleFieldQuickAddBar() {
  const data = [
    { input: 'example.com', detectedType: 'domain', normalized: 'https://example.com' },
    { input: '???', detectedType: 'unknown', normalized: '' },
  ];
  const [foundOnly, setFoundOnly] = useState(false);
  const v = X101A.runQuickAddBar(data);
  const rows = foundOnly ? v.rows.filter(r => r.detected) : v.rows;
  return (
    <Card title="SingleFieldQuickAddBar" note="Idea 54005">
      <Kv k="Recognized" v={v.detectedCount} />
      <button type="button" onClick={() => setFoundOnly(f => !f)}>{foundOnly ? 'Show all values' : 'Show recognized only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.input || 'blank'} v={r.status} />)}
    </Card>
  );
}
export function PasteAndDetectOnboarding() {
  const data = [
    { batchLabel: 'list-a', pastedUrls: 10, detectedTargets: 9, duplicatesRemoved: 1 },
    { batchLabel: 'list-b', pastedUrls: 8, detectedTargets: 4, duplicatesRemoved: 0 },
  ];
  const [pasted, setPasted] = useState(10);
  const v = X101A.detectPastedTargets([{ ...data[0], pastedUrls: pasted }, data[1]]);
  return (
    <Card title="PasteAndDetectOnboarding" note="Idea 54006">
      <Kv k="Import-ready" v={v.readyCount} />
      <label className="w101a-field">First list pasted links ({pasted})
        <input type="range" min="1" max="20" value={pasted} onChange={e => setPasted(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.batchLabel} rate`} v={r.detectionRate} />)}
    </Card>
  );
}
export function GuidedOnboardingWizard() {
  const data = [
    { userId: 'op-1', currentStep: 5, totalSteps: 5, completedWizard: true },
    { userId: 'op-2', currentStep: 2, totalSteps: 6, completedWizard: false },
  ];
  const [step, setStep] = useState(2);
  const v = X101A.runGuidedOnboardingWizard([data[0], { ...data[1], currentStep: step }]);
  return (
    <Card title="GuidedOnboardingWizard" note="Idea 54007">
      <Kv k="Finished" v={v.finishedCount} />
      <label className="w101a-field">Second operator step ({step})
        <input type="range" min="0" max="6" value={step} onChange={e => setStep(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.userId} value={r.progress} max={1} />)}
    </Card>
  );
}
export function DuplicateTargetDetector() {
  const data = [
    { target: 'a.example.com', normalizedHost: 'a.example.com', isDuplicate: false, existingId: '' },
    { target: 'www.a.example.com', normalizedHost: 'a.example.com', isDuplicate: true, existingId: 't-1' },
  ];
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const v = X101A.detectDuplicateTargets(data);
  const rows = uniqueOnly ? v.rows.filter(r => r.unique) : v.rows;
  return (
    <Card title="DuplicateTargetDetector" note="Idea 54008">
      <Kv k="Unique targets" v={v.uniqueCount} />
      <button type="button" onClick={() => setUniqueOnly(f => !f)}>{uniqueOnly ? 'Show all targets' : 'Show unique only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function TargetTypePresets() {
  const data = [
    { targetType: 'web', presetsAvailable: 4, presetsApplied: 4 },
    { targetType: 'api', presetsAvailable: 5, presetsApplied: 2 },
  ];
  const [applied, setApplied] = useState(2);
  const v = X101A.applyTargetTypePresets([data[0], { ...data[1], presetsApplied: applied }]);
  return (
    <Card title="TargetTypePresets" note="Idea 54009">
      <Kv k="Configured types" v={v.configuredCount} />
      <label className="w101a-field">Second type presets applied ({applied})
        <input type="range" min="0" max="5" value={applied} onChange={e => setApplied(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.targetType} coverage`} v={r.presetCoverage} />)}
    </Card>
  );
}
export function DraftTargetsQueue() {
  const data = [
    { draftId: 'draft-1', ageHours: 12, ownerAssigned: true },
    { draftId: 'draft-2', ageHours: 120, ownerAssigned: false },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X101A.manageDraftTargetsQueue(data);
  const rows = readyOnly ? v.rows.filter(r => r.ready) : v.rows;
  return (
    <Card title="DraftTargetsQueue" note="Idea 54010">
      <Kv k="Promotion-ready" v={v.readyCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all drafts' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.draftId} age`} v={r.ageHours} />)}
    </Card>
  );
}
export function OnboardingChecklistTracker() {
  const data = [
    { target: 'shop.example.com', checklistTotal: 8, checklistDone: 8, blocked: false },
    { target: 'blog.example.com', checklistTotal: 8, checklistDone: 4, blocked: true },
  ];
  const [done, setDone] = useState(4);
  const v = X101A.trackOnboardingChecklist([data[0], { ...data[1], checklistDone: done }]);
  return (
    <Card title="OnboardingChecklistTracker" note="Idea 54011">
      <Kv k="Complete" v={v.completeCount} />
      <label className="w101a-field">Second target steps done ({done})
        <input type="range" min="0" max="8" value={done} onChange={e => setDone(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.target} value={r.coverage} max={1} />)}
    </Card>
  );
}
export function SkipAndVerifyLaterMode() {
  const data = [
    { target: 'api.example.com', verificationDeferred: true, verificationDoneLater: false, daysDeferred: 3 },
    { target: 'web.example.com', verificationDeferred: true, verificationDoneLater: true, daysDeferred: 1 },
  ];
  const [pendingOnly, setPendingOnly] = useState(false);
  const v = X101A.manageSkipAndVerifyLater(data);
  const rows = pendingOnly ? v.rows.filter(r => r.pending) : v.rows;
  return (
    <Card title="SkipAndVerifyLaterMode" note="Idea 54012">
      <Kv k="Still pending" v={v.pendingCount} />
      <button type="button" onClick={() => setPendingOnly(f => !f)}>{pendingOnly ? 'Show all targets' : 'Show pending only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function DnsPreCheckOnAdd() {
  const data = [
    { domain: 'good.example.com', resolves: true, nxdomain: false, aRecords: 2 },
    { domain: 'gone.example.com', resolves: false, nxdomain: true, aRecords: 0 },
  ];
  const [okOnly, setOkOnly] = useState(false);
  const v = X101A.runDnsPreCheck(data);
  const rows = okOnly ? v.rows.filter(r => r.dnsOk) : v.rows;
  return (
    <Card title="DnsPreCheckOnAdd" note="Idea 54013">
      <Kv k="DNS confirmed" v={v.okCount} />
      <button type="button" onClick={() => setOkOnly(f => !f)}>{okOnly ? 'Show all domains' : 'Show resolved only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.domain} records`} v={r.aRecords} />)}
    </Card>
  );
}
export function LiveScreenshotCaptureOnAdd() {
  const data = [
    { target: 'shop.example.com', screenshotCaptured: true, screenshotKb: 140, loadedOk: true },
    { target: 'blank.example.com', screenshotCaptured: true, screenshotKb: 0, loadedOk: false },
  ];
  const [kb, setKb] = useState(140);
  const v = X101A.captureLiveScreenshotOnAdd([{ ...data[0], screenshotKb: kb }, data[1]]);
  return (
    <Card title="LiveScreenshotCaptureOnAdd" note="Idea 54014">
      <Kv k="Usable views" v={v.displayedCount} />
      <label className="w101a-field">First capture size in KB ({kb})
        <input type="range" min="0" max="300" step="10" value={kb} onChange={e => setKb(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} size`} v={r.screenshotKb} />)}
    </Card>
  );
}
export function TechnologyGuessPreview() {
  const data = [
    { target: 'shop.example.com', guesses: 4, confirmedGuesses: 3, topGuessConfidence: 0.9 },
    { target: 'blog.example.com', guesses: 4, confirmedGuesses: 1, topGuessConfidence: 0.5 },
  ];
  const [confirmed, setConfirmed] = useState(3);
  const v = X101A.previewTechnologyGuess([{ ...data[0], confirmedGuesses: confirmed }, data[1]]);
  return (
    <Card title="TechnologyGuessPreview" note="Idea 54015">
      <Kv k="Reliable" v={v.accurateCount} />
      <label className="w101a-field">First target confirmed guesses ({confirmed})
        <input type="range" min="0" max="4" value={confirmed} onChange={e => setConfirmed(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} accuracy`} v={r.accuracy} />)}
    </Card>
  );
}
export function RedirectChainPreview() {
  const data = [
    { target: 'shop.example.com', hops: 2, finalStatus: 200, loopDetected: false },
    { target: 'loop.example.com', hops: 9, finalStatus: 200, loopDetected: true },
  ];
  const [hops, setHops] = useState(2);
  const v = X101A.previewRedirectChain([{ ...data[0], hops }, data[1]]);
  return (
    <Card title="RedirectChainPreview" note="Idea 54016">
      <Kv k="Chain-safe" v={v.safeCount} />
      <label className="w101a-field">First target hops ({hops})
        <input type="range" min="0" max="10" value={hops} onChange={e => setHops(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} status`} v={r.status} />)}
    </Card>
  );
}
export function ProgramLinkingAtAddTime() {
  const data = [
    { target: 'shop.example.com', programId: 'prog-a', linked: true, inScopeCount: 5 },
    { target: 'orphan.example.com', programId: '', linked: false, inScopeCount: 0 },
  ];
  const [linkedOnly, setLinkedOnly] = useState(false);
  const v = X101A.linkProgramAtAddTime(data);
  const rows = linkedOnly ? v.rows.filter(r => r.linked) : v.rows;
  return (
    <Card title="ProgramLinkingAtAddTime" note="Idea 54017">
      <Kv k="Program-linked" v={v.linkedCount} />
      <button type="button" onClick={() => setLinkedOnly(f => !f)}>{linkedOnly ? 'Show all targets' : 'Show linked only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.target} in scope`} v={r.inScopeCount} />)}
    </Card>
  );
}
export function TeamAssignmentAtAddTime() {
  const data = [
    { target: 'shop.example.com', team: 'red', assignedMembers: 3, requiredMembers: 3 },
    { target: 'blog.example.com', team: 'blue', assignedMembers: 1, requiredMembers: 3 },
  ];
  const [assigned, setAssigned] = useState(1);
  const v = X101A.assignTeamAtAddTime([data[0], { ...data[1], assignedMembers: assigned }]);
  return (
    <Card title="TeamAssignmentAtAddTime" note="Idea 54018">
      <Kv k="Fully staffed" v={v.staffedCount} />
      <label className="w101a-field">Second target assigned members ({assigned})
        <input type="range" min="0" max="3" value={assigned} onChange={e => setAssigned(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.target} value={r.staffingCoverage} max={1} />)}
    </Card>
  );
}
export function TagAssignmentAtAddTime() {
  const data = [
    { target: 'shop.example.com', tagsAssigned: 4, tagsRequired: 4 },
    { target: 'blog.example.com', tagsAssigned: 2, tagsRequired: 5 },
  ];
  const [tags, setTags] = useState(2);
  const v = X101A.assignTagsAtAddTime([data[0], { ...data[1], tagsAssigned: tags }]);
  return (
    <Card title="TagAssignmentAtAddTime" note="Idea 54019">
      <Kv k="Tags complete" v={v.taggedCount} />
      <label className="w101a-field">Second target tags assigned ({tags})
        <input type="range" min="0" max="5" value={tags} onChange={e => setTags(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} coverage`} v={r.tagCoverage} />)}
    </Card>
  );
}
export function ClientAssociationAtAddTime() {
  const data = [
    { target: 'shop.example.com', client: 'acme', associated: true, clientTargets: 4 },
    { target: 'solo.example.com', client: '', associated: false, clientTargets: 0 },
  ];
  const [linkedOnly, setLinkedOnly] = useState(false);
  const v = X101A.associateClientAtAddTime(data);
  const rows = linkedOnly ? v.rows.filter(r => r.associated) : v.rows;
  return (
    <Card title="ClientAssociationAtAddTime" note="Idea 54020">
      <Kv k="Client-associated" v={v.associatedCount} />
      <button type="button" onClick={() => setLinkedOnly(f => !f)}>{linkedOnly ? 'Show all targets' : 'Show associated only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.target} client`} v={r.client || 'none'} />)}
      <div className="w101a-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE101_A_COMPONENTS = [DebriefMobileOptimization, DebriefPrintStylesheets, DebriefDigitalSignatures, AnnualDebriefRetrospective, SingleFieldQuickAddBar, PasteAndDetectOnboarding, GuidedOnboardingWizard, DuplicateTargetDetector, TargetTypePresets, DraftTargetsQueue, OnboardingChecklistTracker, SkipAndVerifyLaterMode, DnsPreCheckOnAdd, LiveScreenshotCaptureOnAdd, TechnologyGuessPreview, RedirectChainPreview, ProgramLinkingAtAddTime, TeamAssignmentAtAddTime, TagAssignmentAtAddTime, ClientAssociationAtAddTime];

export function Wave101AGallery() {
  return (
    <div className="w101a-gallery">
      {WAVE101_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
