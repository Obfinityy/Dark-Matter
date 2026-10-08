/**
 * wave58.test.js — Infinity AI · Dark-Matter · Wave 58
 * node:test + node:assert/strict. Registry coverage (19/19 for 52281–52299,
 * 21/21 for 52300–52320, zero skips, 40/40 combined), deterministic
 * spot-checks of every pure function, Wave58.css scope/zero-animation audits,
 * a no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WAVE58_SR3_IDEAS } from './shareRound3Core.js';
import * as R from './shareRound3Core.js';
import { WAVE58_PS_IDEAS } from './platformSubmitCore.js';
import * as P from './platformSubmitCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave58.css');
const NOW = 1700000000000;

function registryOk(reg, first, count) {
  assert.equal(reg.length, count, `expected ${count} registry entries, got ${reg.length}`);
  const ids = reg.map(e => e.id);
  assert.deepEqual(
    ids,
    Array.from({ length: count }, (_, i) => first + i),
    'registry ids must be the exact idea range in order'
  );
  for (const e of reg) {
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `entry ${e.id} needs a title`);
    assert.equal(e.skip, false, `entry ${e.id} must not be skipped`);
  }
  return new Set(ids);
}

/* ---- Registry coverage ---- */
test('WAVE58_SR3_IDEAS: 19/19 entries 52281–52299, zero skips', () => {
  registryOk(WAVE58_SR3_IDEAS, 52281, 19);
});

test('WAVE58_PS_IDEAS: 21/21 entries 52300–52320, zero skips', () => {
  registryOk(WAVE58_PS_IDEAS, 52300, 21);
});

test('combined coverage: exactly 52281–52320 with no gaps or dupes', () => {
  const all = [...WAVE58_SR3_IDEAS.map(e => e.id), ...WAVE58_PS_IDEAS.map(e => e.id)];
  assert.equal(all.length, 40);
  assert.deepEqual(
    [...all].sort((a, b) => a - b),
    Array.from({ length: 40 }, (_, i) => 52281 + i)
  );
});

const HUNT = {
  id: 'hunt-t',
  target: 't.example.com',
  findings: [
    {
      id: 'f-1',
      title: 'Stored XSS',
      severity: 'high',
      status: 'open',
      vulnClass: 'xss',
      endpoint: 'https://t.example.com/reviews',
      description: 'review body not encoded',
      impact: 'session theft',
      poc: 'curl x',
      remediation: 'encode',
      evidence: [],
    },
    {
      id: 'f-2',
      title: 'IDOR',
      severity: 'critical',
      status: 'open',
      vulnClass: 'idor',
      endpoint: 'https://t.example.com/orders/1',
      description: 'ids enumerable',
      impact: 'data exposure',
      evidence: [],
    },
    {
      id: 'f-3',
      title: 'Missing CSP',
      severity: 'low',
      status: 'fixed',
      vulnClass: 'config',
      endpoint: 'https://t.example.com/',
      description: 'no csp',
      evidence: [],
    },
  ],
};

const FINDING = {
  id: 'f-60',
  title: 'Stored XSS in product reviews',
  severity: 'high',
  cvss: 8.2,
  vulnClass: 'xss',
  status: 'open',
  target: 'shop',
  endpoint: 'https://shop.example.com/reviews',
  description: 'The review body is rendered without output encoding.',
  impact: null,
  poc: 'curl -X POST https://shop.example.com/reviews -d "body=<script>alert(1)</script>"',
  pocPython:
    'import requests\nrequests.post("https://shop.example.com/reviews", data={"body": "x"})',
  pocTrace: [
    'Log in as any user',
    'Post a review with body <script>alert(1)</script>',
    'View the product page',
  ],
  evidence: [{ kind: 'screenshot', name: 'xss.png', sizeBytes: 184320, caption: 'alert fired' }],
  remediation: 'Encode review output.',
  references: ['https://owasp.org/www-community/attacks/xss/'],
};

/* ---- shareRound3Core spot-checks (deterministic) ---- */
test('52281 agreement lifecycle: draft -> active on both accepts, scope enforced', () => {
  const agr = R.createCollabAgreement(
    {
      huntId: 'hunt-t',
      scope: 'findings-triage',
      parties: [{ email: 'a@x.com' }, { email: 'b@x.com' }],
      allowedSeverities: ['critical', 'high'],
    },
    NOW
  ).agreement;
  assert.equal(agr.status, 'draft');
  const a1 = R.acceptAgreement(agr, 'a@x.com', NOW).agreement;
  assert.equal(a1.status, 'draft');
  const a2 = R.acceptAgreement(a1, 'b@x.com', NOW + 1);
  assert.equal(a2.agreement.status, 'active');
  assert.equal(a2.allAccepted, true);
  assert.equal(R.checkAgreementScope(a2.agreement, HUNT.findings[0]).allowed, true);
  assert.equal(R.checkAgreementScope(a2.agreement, HUNT.findings[2]).allowed, false);
  assert.equal(
    R.createCollabAgreement({ huntId: 'hunt-t', parties: [{ email: 'a@x.com' }] }, NOW).ok,
    false
  );
});

test('52282 multi-team share: per-team filtered views + separate comment spaces', () => {
  const r = R.shareToTeams(
    HUNT,
    [
      { teamId: 'red', teamName: 'Red', minSeverity: 'high' },
      { teamId: 'blue', teamName: 'Blue' },
    ],
    NOW
  );
  assert.equal(r.ok, true);
  const red = R.getTeamView(r.share, 'red').team;
  const blue = R.getTeamView(r.share, 'blue').team;
  assert.deepEqual(red.view.findingIds.sort(), ['f-1', 'f-2']);
  assert.equal(blue.view.findingIds.length, 3);
  assert.notEqual(red.commentSpace.id, blue.commentSpace.id);
  assert.equal(R.getTeamView(r.share, 'nope').ok, false);
  assert.equal(R.shareToTeams(HUNT, [], NOW).ok, false);
});

test('52283 notification reducer: add, accept, decline, dismiss', () => {
  const n = R.createNotification(
    { to: 'd@x.com', type: 'share-invite', from: 'aria' },
    NOW
  ).notification;
  assert.equal(R.createNotification({ to: 'd@x.com', type: 'bogus' }, NOW).ok, false);
  let s = R.notificationReducer([], { type: 'NOTIF_ADD', notification: n });
  s = R.notificationReducer(s, { type: 'NOTIF_READ', id: n.id });
  assert.equal(s[0].status, 'read');
  s = R.notificationReducer(s, { type: 'NOTIF_ACCEPT', id: n.id }, NOW + 1);
  assert.equal(s[0].status, 'accepted');
  assert.equal(s[0].decidedAt, NOW + 1);
  const n2 = R.createNotification({ to: 'd@x.com', type: 'access-request' }, NOW + 2).notification;
  s = R.notificationReducer(s, { type: 'NOTIF_ADD', notification: n2 });
  s = R.notificationReducer(s, { type: 'NOTIF_DECLINE', id: n2.id });
  assert.equal(s[0].status, 'declined');
  s = R.notificationReducer(s, { type: 'NOTIF_DISMISS', id: n2.id });
  assert.equal(s.length, 1);
});

test('52284 link preview payload: title, severity counts, risk score', () => {
  const r = R.buildLinkPreview(HUNT, { token: 'tok', expiresAt: NOW + 1000 }, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.preview.title.includes('Infinity AI'));
  assert.deepEqual(r.preview.severityCounts, { high: 1, critical: 1, low: 1 });
  assert.ok(r.preview.riskScore > 0);
  assert.equal(r.preview.token, 'tok');
});

test('52285 notion/confluence live-embed descriptors', () => {
  const notion = R.buildLiveEmbed(
    HUNT,
    'notion',
    { baseUrl: 'https://app.example.com' },
    NOW
  ).embed;
  assert.equal(notion.kind, 'embed-block');
  assert.ok(notion.src.includes('/embed/hunts/hunt-t'));
  const conf = R.buildLiveEmbed(HUNT, 'confluence', {}, NOW).embed;
  assert.equal(conf.kind, 'html-macro');
  assert.equal(R.buildLiveEmbed(HUNT, 'sharepoint').ok, false);
});

test('52286 digest composer: subject, body, top findings', () => {
  const r = R.composeDigest(HUNT, { to: 'cto@x.com', topN: 2 }, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.digest.subject.includes('3 findings'));
  assert.ok(r.digest.body.includes('Infinity AI'));
  assert.equal(r.digest.topFindings[0].id, 'f-2'); // critical first
  assert.equal(R.composeDigest(HUNT, { to: 'bad' }, NOW).ok, false);
});

test('52287 mobile view spec: stacked cards, touch targets, bottom-sheet comments', () => {
  const r = R.buildMobileViewSpec({ findings: ['f-1'] }, {});
  assert.equal(r.ok, true);
  assert.equal(r.spec.cardsStacked, true);
  assert.equal(r.spec.touchTargetsMinPx, 44);
  assert.equal(r.spec.commentInput, 'bottom-sheet');
  assert.equal(R.buildMobileViewSpec(null).ok, false);
});

test('52288 expiry extension keeps the token, revoked links rejected', () => {
  const link = { token: 'tok-88', expiresAt: NOW + 1000, revoked: false };
  const r = R.extendLinkExpiry(link, 3600000, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.tokenUnchanged, true);
  assert.equal(r.link.token, 'tok-88');
  assert.equal(r.link.expiresAt, NOW + 1000 + 3600000);
  assert.equal(R.extendLinkExpiry({ token: 't', revoked: true }, 1000, NOW).ok, false);
});

test('52289 approval workflow: approve, no double transition, expiry', () => {
  const req = R.createApprovalRequest(
    { huntId: 'hunt-t', requestedBy: 'aria', owner: 'bhavesh' },
    NOW
  ).request;
  assert.equal(req.state, 'requested');
  const ok = R.approvalReducer(req, { type: 'APPROVE', by: 'bhavesh' }, NOW + 1);
  assert.equal(ok.request.state, 'approved');
  assert.equal(R.approvalReducer(ok.request, { type: 'APPROVE' }, NOW + 2).ok, false);
  const stale = R.createApprovalRequest(
    { huntId: 'hunt-t', requestedBy: 'aria', owner: 'bhavesh', ttlMs: 0 },
    NOW - 1000
  ).request;
  const expired = R.approvalReducer(stale, { type: 'APPROVE' }, NOW);
  assert.equal(expired.request.state, 'expired');
});

test('52290 delegated sharing grants: granted actions allowed, others denied', () => {
  const g = R.grantDelegatedShare(
    {
      grantor: 'bhavesh',
      grantee: 'aria',
      actions: ['share-view'],
      expiresAt: NOW + 1000,
      huntIds: ['hunt-t'],
    },
    NOW
  ).grant;
  assert.equal(R.canDelegateShare(g, 'share-view', 'hunt-t', NOW).allowed, true);
  assert.equal(R.canDelegateShare(g, 'share-manage', 'hunt-t', NOW).allowed, false);
  assert.equal(R.canDelegateShare(g, 'share-view', 'other', NOW).allowed, false);
  assert.equal(R.canDelegateShare(g, 'share-view', 'hunt-t', NOW + 2000).allowed, false);
  assert.equal(
    R.grantDelegatedShare(
      { grantor: 'a', grantee: 'b', actions: ['delete-everything'], expiresAt: NOW + 1 },
      NOW
    ).ok,
    false
  );
});

test('52291 quota evaluator: remaining counts, exhaustion, unlimited', () => {
  const link = { token: 'tok-91', quota: { maxOpens: 5, maxOpensPerDay: 3 } };
  const dayKey = new Date(NOW).toISOString().slice(0, 10);
  const ok = R.evaluateQuota(link, { opens: 2, dailyOpens: { [dayKey]: 1 } }, NOW);
  assert.equal(ok.allowed, true);
  assert.equal(ok.remaining, 3);
  assert.equal(ok.dailyRemaining, 2);
  const out = R.evaluateQuota(link, { opens: 5 }, NOW);
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'quota-exhausted');
  const free = R.evaluateQuota({ token: 't' }, { opens: 999 }, NOW);
  assert.equal(free.unlimited, true);
});

test('52292 slug validator rules + unique generator', () => {
  assert.equal(R.validateSlug('q3-hunt-results').ok, true);
  assert.equal(R.validateSlug('Bad Slug!!').ok, false);
  assert.equal(R.validateSlug('admin').reason, 'reserved slug');
  assert.equal(R.validateSlug('-lead').ok, false);
  const g = R.generateSlug('Q3 hunt results!', ['q3-hunt-results'], NOW);
  assert.equal(g.ok, true);
  assert.notEqual(g.slug, 'q3-hunt-results');
  assert.equal(R.validateSlug(g.slug).ok, true);
  assert.equal(R.generateSlug('').ok, false);
});

test('52293 branded page descriptor carries logo and colors', () => {
  const r = R.buildBrandedPage({
    name: 'Acme',
    primaryColor: '#e11d48',
    logo: 'https://ac.me/logo.png',
  });
  assert.equal(r.ok, true);
  assert.equal(r.page.brand.name, 'Acme');
  assert.equal(r.page.brand.primaryColor, '#e11d48');
  assert.ok(r.page.brand.footerText.includes('Infinity AI'));
  const def = R.buildBrandedPage({});
  assert.equal(def.page.brand.name, 'Infinity AI');
});

test('52294 team dashboard aggregates hunts, teams, findings', () => {
  const share = R.shareToTeams(
    HUNT,
    [{ teamId: 'red' }, { teamId: 'blue', minSeverity: 'high' }],
    NOW
  ).share;
  const r = R.aggregateTeamDashboard([share, share], NOW);
  assert.equal(r.ok, true);
  assert.equal(r.dashboard.totals.hunts, 2);
  assert.equal(r.dashboard.totals.teams, 4);
  assert.equal(r.dashboard.totals.findingsShared, 2 * (3 + 2));
  assert.equal(R.aggregateTeamDashboard('nope').ok, false);
});

test('52295 chat payloads for slack/teams/discord', () => {
  for (const channel of R.CHAT_CHANNELS) {
    const r = R.buildChatSharePayload(HUNT.findings[0], channel, 'https://u/x', NOW);
    assert.equal(r.ok, true);
    assert.equal(r.channel, channel);
    assert.ok(r.payload.sentAt === NOW);
  }
  assert.equal(R.buildChatSharePayload(HUNT.findings[0], 'irc').ok, false);
  assert.equal(R.buildChatSharePayload({}).ok, false);
});

test('52296 field permissions: viewer sees no poc, triager does', () => {
  assert.equal(R.checkFieldAccess('viewer', 'poc').allowed, false);
  assert.equal(R.checkFieldAccess('viewer', 'title').allowed, true);
  assert.equal(R.checkFieldAccess('commenter', 'impact').allowed, true);
  assert.equal(R.checkFieldAccess('commenter', 'evidence').allowed, false);
  assert.equal(R.checkFieldAccess('triager', 'poc').allowed, true);
  assert.equal(R.checkFieldAccess('owner', 'poc').allowed, true);
  assert.equal(R.checkFieldAccess('nope', 'poc').ok, false);
  assert.equal(R.checkFieldAccess('viewer', 'ssn').ok, false);
  assert.ok(R.visibleFields('viewer').fields.includes('title'));
  assert.ok(!R.visibleFields('viewer').fields.includes('poc'));
});

test('52297 email-code gate: correct code verifies, wrong code fails', () => {
  const gate = R.issueEmailCode({ token: 'tok-97' }, 'dev@x.com', NOW).gate;
  assert.equal(gate.code.length, 6);
  const ok = R.verifyEmailCode(gate, gate.code, NOW + 1000);
  assert.equal(ok.verified, true);
  const bad = R.verifyEmailCode(gate, '000000', NOW + 1000);
  assert.equal(bad.verified, false);
  assert.equal(bad.reason, 'mismatch');
  assert.equal(bad.gate.attempts, 1);
  assert.equal(R.verifyEmailCode(gate, gate.code, NOW + 11 * 60 * 1000).reason, 'code-expired');
  assert.equal(R.issueEmailCode({ token: 't' }, 'bad', NOW).ok, false);
});

test('52298 print spec excludes evidence bodies, paginates', () => {
  const r = R.buildPrintSpec({ findings: ['f-1'] }, { orientation: 'landscape' });
  assert.equal(r.ok, true);
  assert.equal(r.spec.page.orientation, 'landscape');
  assert.equal(r.spec.include.evidenceBodies, false);
  assert.equal(r.spec.footer.pageNumbers, true);
  assert.ok(r.spec.header.includes('Infinity AI'));
  assert.equal(R.buildPrintSpec(null).ok, false);
});

test('52299 access request: requested -> routed -> approved', () => {
  const req = R.requestAccess(
    { huntId: 'hunt-t', requester: 'client@x.com', owner: 'bhavesh' },
    NOW
  ).request;
  assert.equal(req.state, 'requested');
  const routed = R.accessRequestReducer(req, { type: 'ROUTE' }, NOW + 1).request;
  assert.equal(routed.state, 'routed');
  assert.equal(routed.routedTo, 'bhavesh');
  const done = R.accessRequestReducer(routed, { type: 'APPROVE', by: 'bhavesh' }, NOW + 2);
  assert.equal(done.request.state, 'approved');
  assert.equal(done.request.decidedBy, 'bhavesh');
  assert.equal(R.accessRequestReducer(req, { type: 'APPROVE' }, NOW + 1).ok, false); // must route first
  assert.equal(R.requestAccess({ huntId: 'hunt-t', requester: 'bad' }, NOW).ok, false);
});

/* ---- platformSubmitCore spot-checks (deterministic) ---- */
test('52300 hackerone draft: summary/steps/impact + weakness + severity', () => {
  const r = P.buildHackerOneDraft(FINDING);
  assert.equal(r.ok, true);
  assert.equal(r.platform, 'hackerone');
  assert.equal(r.draft.severity, 'High');
  assert.equal(r.draft.weakness, 'CWE-79');
  assert.equal(r.draft.steps_to_reproduce.length, 3);
  assert.ok(r.draft.vulnerability_information.includes('Impact'));
  assert.equal(r.draft.attachments.length, 3);
  assert.equal(P.buildHackerOneDraft({}).ok, false);
});

test('52301 bugcrowd draft: P-scale type + references', () => {
  const r = P.buildBugcrowdDraft(FINDING);
  assert.equal(r.draft.vulnerability_type, 'P2');
  assert.equal(r.draft.reproduction_steps.length, 3);
  assert.deepEqual(r.draft.references, FINDING.references);
  assert.equal(r.draft.cwe, 'CWE-79');
});

test('52302 intigriti draft: severity scale + affected endpoint', () => {
  const r = P.buildIntigritiDraft(FINDING);
  assert.equal(r.draft.severity, 'High');
  assert.equal(r.draft.affected_endpoint, 'https://shop.example.com/reviews');
  assert.ok(r.draft.poc.includes('1. Log in'));
});

test('52303 yeswehack draft: criticality + remediation', () => {
  const r = P.buildYesWeHackDraft(FINDING);
  assert.equal(r.draft.criticality, 'High');
  assert.equal(r.draft.remediation, 'Encode review output.');
});

test('52304 field mapping table maps severity/steps/asset per platform', () => {
  const h1 = P.mapFindingFields(FINDING, 'hackerone');
  assert.equal(h1.mapping.severity, 'severity');
  assert.equal(h1.mapping.steps, 'steps_to_reproduce');
  const bc = P.mapFindingFields(FINDING, 'bugcrowd');
  assert.equal(bc.mapping.severity, 'vulnerability_type');
  assert.equal(bc.mapping.asset, 'target_url');
  const yw = P.mapFindingFields(FINDING, 'yeswehack');
  assert.equal(yw.mapping.severity, 'criticality');
  assert.equal(P.mapFindingFields(FINDING, 'nope').ok, false);
  assert.equal(P.mapFindingFields({}, 'hackerone').ok, false);
});

test('52305 severity auto-mapping across all four platform scales', () => {
  assert.equal(P.mapSeverity('critical', null, 'hackerone').label, 'Critical');
  assert.equal(P.mapSeverity('critical', null, 'bugcrowd').label, 'P1');
  assert.equal(P.mapSeverity(null, 9.8, 'intigriti').label, 'Exceptional');
  assert.equal(P.mapSeverity(null, 9.8, 'hackerone').label, 'Critical');
  assert.equal(P.mapSeverity('medium', null, 'yeswehack').label, 'Medium');
  assert.equal(P.mapSeverity('critical', null, 'hackerone').fromInternal, true);
  assert.equal(P.mapSeverity('critical', 9.5, 'hackerone').fromInternal, false);
  assert.equal(P.mapSeverity('critical', null, 'nope').ok, false);
  assert.equal(P.mapSeverity(null, null, 'hackerone').ok, false);
});

test('52306 copyable report preserves markdown structure', () => {
  const r = P.buildCopyableReport(FINDING);
  assert.equal(r.ok, true);
  assert.ok(r.markdown.startsWith('# Stored XSS in product reviews'));
  assert.ok(r.markdown.includes('## Steps to reproduce'));
  assert.ok(r.markdown.includes('## Impact'));
  assert.ok(r.markdown.includes('CWE-79'));
  assert.ok(r.markdown.includes('Infinity AI'));
  assert.equal(r.length, r.markdown.length);
});

test('52307 approval gate: exact-payload hash check, tamper blocked, zero sends', () => {
  const payload = P.buildHackerOneDraft(FINDING).draft;
  const sub = P.createSubmission(
    { platform: 'hackerone', finding: FINDING, payload },
    NOW
  ).submission;
  assert.equal(sub.state, 'draft');
  assert.equal(sub.networkCalls, 0);
  const pending = P.submissionReducer(sub, { type: 'REQUEST_APPROVAL' }, NOW + 1).submission;
  assert.equal(pending.state, 'pending-approval');
  const tampered = { ...pending, payload: { ...pending.payload, title: 'changed' } };
  assert.equal(
    P.submissionReducer(tampered, { type: 'APPROVE', payloadHash: pending.payloadHash }, NOW + 2)
      .reason,
    'payload mutated after review was requested — re-request approval'
  );
  const approved = P.submissionReducer(
    pending,
    { type: 'APPROVE', by: 'bhavesh', payloadHash: pending.payloadHash },
    NOW + 2
  ).submission;
  assert.equal(approved.state, 'approved');
  assert.equal(approved.approvals[0].by, 'bhavesh');
  const sent = P.submissionReducer(
    approved,
    { type: 'MARK_SENT', payloadHash: pending.payloadHash },
    NOW + 3
  ).submission;
  assert.equal(sent.state, 'submitted');
  assert.equal(sent.networkCalls, 0);
  assert.equal(P.createSubmission({ platform: 'nope', finding: FINDING, payload }, NOW).ok, false);
});

test('52308 status tracker: draft to paid in order, illegal jumps blocked', () => {
  let t = P.createSubmissionTracker('f-60', 'bugcrowd', NOW).tracker;
  assert.equal(t.state, 'draft');
  assert.equal(P.draftStatusReducer(t, { to: 'triaged' }, NOW).ok, false); // no skip
  for (const to of ['submitted', 'triaged', 'resolved'])
    t = P.draftStatusReducer(t, { to }, NOW).tracker;
  assert.equal(t.state, 'resolved');
  assert.equal(t.history.length, 4);
  const paid = P.draftStatusReducer(t, { to: 'paid', payout: 750 }, NOW).tracker;
  assert.equal(paid.state, 'paid');
  assert.equal(paid.payout, 750);
  assert.equal(P.draftStatusReducer(paid, { to: 'paid' }, NOW).ok, false); // terminal
  assert.equal(P.createSubmissionTracker('f-60', 'nope', NOW).ok, false);
});

test('52309 checklist passes complete finding, flags missing title', () => {
  const r = P.runChecklist(FINDING, 'hackerone');
  assert.equal(r.ok, true);
  assert.equal(r.passed, true);
  assert.deepEqual(r.failed, []);
  const bad = P.runChecklist({ ...FINDING, title: '' }, 'hackerone');
  assert.equal(bad.passed, false);
  assert.ok(bad.failed.includes('title-under-140-chars'));
  assert.equal(P.runChecklist(FINDING, 'nope').ok, false);
  for (const p of P.PLATFORMS)
    assert.ok(P.runChecklist(FINDING, p).results.length > 0, `${p} needs checks`);
});

test('52310 duplicate check flags near-duplicate from history', () => {
  const r = P.checkDuplicates(
    FINDING,
    [
      {
        id: 'f-01',
        title: 'Stored XSS in product reviews',
        description: 'review body not encoded',
        asset: 'shop.example.com',
      },
    ],
    [
      {
        id: 'd-9',
        title: 'Reflected XSS on search',
        description: 'search param reflected',
        asset: 'other.example.com',
      },
    ]
  );
  assert.equal(r.ok, true);
  assert.equal(r.likelyDuplicate, true);
  assert.equal(r.duplicates[0].id, 'f-01');
  assert.equal(r.duplicates[0].source, 'history');
  const clean = P.checkDuplicates(FINDING, [], []);
  assert.equal(clean.likelyDuplicate, false);
  assert.equal(P.checkDuplicates({}, [], []).ok, false);
});

test('52311 scope validation: in-scope, out-of-scope exclusion', () => {
  const inScope = P.validateScope(FINDING, { inScope: ['shop.example.com'] });
  assert.equal(inScope.inScope, true);
  assert.equal(inScope.asset, 'https://shop.example.com/reviews');
  const out = P.validateScope(FINDING, {
    inScope: ['shop.example.com'],
    outOfScope: ['shop.example.com/reviews'],
  });
  assert.equal(out.inScope, false);
  const missing = P.validateScope(FINDING, { inScope: ['other.example.com'] });
  assert.equal(missing.inScope, false);
  assert.equal(P.validateScope(FINDING, {}).ok, false);
});

test('52312 bounty estimate returns historical range', () => {
  const r = P.estimateBounty('xss', 'high');
  assert.deepEqual([r.estimate.low, r.estimate.high], [500, 1500]);
  assert.equal(r.estimate.currency, 'USD');
  assert.ok(r.note.toLowerCase().includes('historical'));
  const rce = P.estimateBounty('rce', 'critical');
  assert.ok(rce.estimate.high >= 5000);
  const unknown = P.estimateBounty('weird-class', 'medium');
  assert.ok(unknown.estimate.high > 0);
});

test('52313 PoC manifest lists curl + python + evidence files', () => {
  const r = P.buildPocManifest(FINDING);
  assert.equal(r.ok, true);
  assert.equal(r.count, 3);
  assert.deepEqual(
    r.manifest.map(m => m.kind),
    ['curl', 'python', 'evidence']
  );
  assert.ok(r.manifest[0].name.includes('f-60'));
  const empty = P.buildPocManifest({ id: 'f-x' });
  assert.equal(empty.count, 0);
});

test('52314 screenshot pack totals size and enforces cap', () => {
  const r = P.collectScreenshots(FINDING.evidence, { maxTotalBytes: 1024 });
  assert.equal(r.ok, true);
  assert.equal(r.pack.count, 1);
  assert.equal(r.pack.totalBytes, 184320);
  assert.equal(r.pack.withinLimit, false);
  const big = P.collectScreenshots(FINDING.evidence);
  assert.equal(big.pack.withinLimit, true);
  const none = P.collectScreenshots([{ kind: 'http', summary: 'x' }]);
  assert.equal(none.pack.count, 0);
});

test('52315 video PoC descriptor flags oversize files', () => {
  const r = P.buildVideoPoC(
    { path: '/tmp/xss-poc.mp4', sizeBytes: 180 * 1024 * 1024, durationSec: 96 },
    { maxBytes: 100 * 1024 * 1024 }
  );
  assert.equal(r.ok, true);
  assert.equal(r.video.withinLimit, false);
  assert.equal(r.video.format, 'mp4');
  assert.ok(r.video.recommendation.includes('Compress'));
  const small = P.buildVideoPoC({ url: 'https://v.example.com/poc.mp4', sizeBytes: 1024 });
  assert.equal(small.video.withinLimit, true);
  assert.equal(P.buildVideoPoC({}).ok, false);
});

test('52316 CVSS translator maps score with explanation', () => {
  const r = P.translateCvss(9.8, 'intigriti');
  assert.equal(r.ok, true);
  assert.equal(r.label, 'Exceptional');
  assert.ok(r.explanation.includes('CVSS 9.8'));
  assert.equal(P.translateCvss(8.2, 'bugcrowd').label, 'P2');
  assert.equal(P.translateCvss(11, 'hackerone').ok, false);
  assert.equal(P.translateCvss('high', 'hackerone').ok, false);
});

test('52317 CWE auto-tagging matches vuln class keywords', () => {
  const r = P.tagCwe(FINDING);
  assert.equal(r.ok, true);
  assert.ok(r.cwes.some(c => c.id === 'CWE-79'));
  const sqli = P.tagCwe({ id: 'f-y', title: 'Blind SQL injection in login', vulnClass: 'sqli' });
  assert.ok(sqli.cwes.some(c => c.id === 'CWE-89'));
  const none = P.tagCwe({ id: 'f-z', title: 'Typo in footer', description: 'cosmetic' });
  assert.equal(none.cwes.length, 0);
});

test('52318 asset auto-fill extracts host from endpoint', () => {
  const r = P.fillAsset(FINDING);
  assert.equal(r.ok, true);
  assert.equal(r.asset.host, 'shop.example.com');
  assert.equal(r.asset.type, 'web');
  assert.equal(r.asset.fromField, 'endpoint');
  const bare = P.fillAsset({ id: 'f-x', target: 'internal-db' });
  assert.equal(bare.asset.host, null);
});

test('52319 steps formatter numbers and trims the trace', () => {
  const r = P.formatSteps(FINDING.pocTrace);
  assert.equal(r.ok, true);
  assert.equal(r.steps.length, 3);
  assert.ok(r.steps[0].startsWith('1. '));
  assert.ok(r.text.includes('3. View the product page'));
  const single = P.formatSteps('just do it');
  assert.equal(single.steps.length, 1);
});

test('52320 impact generator uses vuln-class template', () => {
  const r = P.generateImpact(FINDING);
  assert.equal(r.ok, true);
  assert.equal(r.templated, true);
  assert.ok(r.impact.includes('JavaScript'));
  const generic = P.generateImpact({
    id: 'f-x',
    severity: 'medium',
    vulnClass: 'weird',
    endpoint: 'https://e/x',
  });
  assert.equal(generic.templated, false);
  assert.equal(P.generateImpact({}).ok, false);
});

/* ---- Wave58.css audits: scoped prefixes, zero keyframes ---- */
test('Wave58.css exists, uses only sr358-/ps58- classes, zero keyframes', () => {
  assert.ok(existsSync(CSS), 'Wave58.css missing');
  const css = readFileSync(CSS, 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero-animation order: no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'zero-animation order: no animation declarations allowed');
  const selectors = [...css.matchAll(/\.([a-zA-Z0-9_-]+)\s*[{,]/g)].map(m => m[1]);
  const classSelectors = [...css.matchAll(/^\.([a-z0-9][a-z0-9-]*)/gim)].map(m => m[1]);
  const all = new Set([...selectors, ...classSelectors].filter(s => /^[a-z]/.test(s)));
  assert.ok(all.size > 0, 'no class selectors found');
  for (const s of all) {
    assert.ok(s.startsWith('sr358-') || s.startsWith('ps58-'), `unscoped selector: .${s}`);
  }
});

/* ---- Branding-leak audit: no forbidden brand name in wave-58 files ---- */
test('no branding leak in wave-58 files', () => {
  const files = [
    'shareRound3Core.js',
    'platformSubmitCore.js',
    'ShareRound3.jsx',
    'PlatformSubmit.jsx',
    'Wave58.css',
    'wave58.test.js',
  ];
  const probe = 'M' + 'use'; // self-reference would fail the audit itself
  for (const f of files) {
    const p = join(DIR, f);
    assert.ok(existsSync(p), `${f} missing`);
    const body = readFileSync(p, 'utf8');
    assert.ok(!body.includes(probe), `branding leak in ${f}`);
  }
});

/* ---- No-debris audit: no leftover scaffolding words in wave-58 files ---- */
test('no debris markers in wave-58 files', () => {
  const files = [
    'shareRound3Core.js',
    'platformSubmitCore.js',
    'ShareRound3.jsx',
    'PlatformSubmit.jsx',
    'Wave58.css',
    'wave58.test.js',
  ];
  const debris = new RegExp(['T' + 'ODO', 'mo' + 'ck', 'lo' + 'rem'].join('|'), 'i');
  for (const f of files) {
    const body = readFileSync(join(DIR, f), 'utf8');
    assert.ok(!debris.test(body), `debris marker found in ${f}`);
  }
});
