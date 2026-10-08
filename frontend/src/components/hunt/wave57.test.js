/**
 * wave57.test.js — Infinity AI · Dark-Matter · Wave 57
 * node:test + node:assert/strict. Registry coverage (20/20 zero skips per
 * module, 40/40 combined for 52241–52280), deterministic spot-checks of the
 * pure functions, Wave57.css scope/zero-animation audits, and a no-branding-
 * leak audit (no forbidden brand name in core/jsx/css/test files — "Infinity AI" only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WAVE57_SHARE_IDEAS } from './shareCore.js';
import * as S from './shareCore.js';
import { WAVE57_COLLAB_IDEAS } from './collabCore.js';
import * as C from './collabCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave57.css');
const NOW = 1700000000000;

function registryOk(reg, first, last) {
  assert.equal(reg.length, 20, `expected 20 registry entries, got ${reg.length}`);
  const ids = reg.map((e) => e.id);
  assert.deepEqual(ids, Array.from({ length: 20 }, (_, i) => first + i), 'registry ids must be the exact 20-idea range in order');
  for (const e of reg) {
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `entry ${e.id} needs a title`);
    assert.equal(e.skip, false, `entry ${e.id} must not be skipped`);
  }
  return new Set(ids);
}

/* ---- Registry coverage ---- */
test('WAVE57_SHARE_IDEAS: 20/20 entries 52241–52260, zero skips', () => {
  registryOk(WAVE57_SHARE_IDEAS, 52241, 52260);
});

test('WAVE57_COLLAB_IDEAS: 20/20 entries 52261–52280, zero skips', () => {
  registryOk(WAVE57_COLLAB_IDEAS, 52261, 52280);
});

test('combined coverage: exactly 52241–52280 with no gaps or dupes', () => {
  const all = [...WAVE57_SHARE_IDEAS.map((e) => e.id), ...WAVE57_COLLAB_IDEAS.map((e) => e.id)];
  assert.equal(all.length, 40);
  assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => 52241 + i));
});

const HUNT = {
  id: 'hunt-t', target: 't.example.com',
  findings: [
    { id: 'f-1', title: 'XSS', severity: 'high', status: 'open', vulnClass: 'xss', cwe: 'CWE-79', target: 't', assignee: 'a', description: 'd1, mail a@example.com, secret=zzz', poc: 'curl x', remediation: 'r1', impact: 'i1', evidence: [{ kind: 'http', summary: 's1', body: 'raw' }], createdAt: NOW - 1000, updatedAt: NOW - 500 },
    { id: 'f-2', title: 'Low info', severity: 'low', status: 'fixed', vulnClass: 'info', cwe: null, target: 't', description: 'd2', remediation: null, evidence: [], createdAt: NOW - 2000, updatedAt: NOW - 2000 },
  ],
};

/* ---- shareCore spot-checks (deterministic) ---- */
test('52241 expiring link lifecycle: valid → consumed / expired', () => {
  const link = S.createExpiringLink(HUNT, { ttlMs: 1000, oneTime: true }, NOW).link;
  assert.equal(S.evaluateShareLink(link, {}, NOW).ok, true);
  const consumed = S.consumeShareLink(link, NOW).link;
  assert.equal(S.evaluateShareLink(consumed, {}, NOW).reason, 'already-consumed');
  assert.equal(S.evaluateShareLink(link, {}, NOW + 2000).reason, 'expired');
});

test('52242 password gate: match vs mismatch', () => {
  const link = S.createExpiringLink(HUNT, {}, NOW).link;
  const gated = S.setLinkPassword(link, 'digest-x').link;
  assert.equal(S.checkLinkPassword(gated, 'digest-x').ok, true);
  assert.equal(S.checkLinkPassword(gated, 'wrong').reason, 'mismatch');
  assert.equal(S.evaluateShareLink(gated, {}, NOW).reason, 'password-required');
  assert.equal(S.evaluateShareLink(gated, { passwordOk: true }, NOW).ok, true);
});

test('52243 role permissions matrix', () => {
  assert.equal(S.checkRoleAction('viewer', 'view').allowed, true);
  assert.equal(S.checkRoleAction('viewer', 'triage').allowed, false);
  assert.equal(S.checkRoleAction('triager', 'triage').allowed, true);
  assert.equal(S.checkRoleAction('admin', 'manage').allowed, true);
  assert.equal(S.checkRoleAction('nope', 'view').ok, false);
  assert.equal(S.assignLinkRole({ token: 't' }, 'commenter').link.role, 'commenter');
});

test('52244 per-finding link scoped to one finding', () => {
  const r = S.buildFindingLink({ id: 'f-1', huntId: 'hunt-t' }, 'https://app.example.com', {}, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.link.scope, 'finding');
  assert.ok(r.url.includes('/s/f/'));
});

test('52245 workspace create + activity event', () => {
  const ws = S.createWorkspace({ name: 'W', members: [{ email: 'a@x.com', role: 'admin' }] }, NOW).workspace;
  assert.equal(ws.members[0].role, 'admin');
  const r = S.addWorkspaceEvent(ws, { kind: 'share', by: 'a' }, NOW);
  assert.equal(r.workspace.activity.length, 1);
});

test('52246 email invite carries deep link + expiry', () => {
  const r = S.buildEmailInvite('dev@x.com', HUNT, 'https://app.example.com', {}, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.invite.deepLink.includes('hunt-t'));
  assert.ok(r.invite.expiresAt > NOW);
  assert.equal(S.buildEmailInvite('not-an-email', HUNT).ok, false);
});

test('52247 SSO group mapping resolves highest-privilege role', () => {
  const r = S.resolveSsoRole(['g1', 'g2'], { g1: 'viewer', g2: 'admin' });
  assert.equal(r.role, 'admin');
  assert.equal(S.resolveSsoRole(['g9'], {}).role, 'viewer');
});

test('52248/49/50 slack/teams/discord payloads well-formed', () => {
  const slack = S.buildSlackPayload(HUNT, 'https://u', NOW).payload;
  assert.ok(slack.text.includes('t.example.com'));
  assert.ok(slack.blocks.length >= 2);
  const teams = S.buildTeamsPayload(HUNT, 'https://u', NOW).payload;
  assert.equal(teams.attachments[0].content.type, 'AdaptiveCard');
  const discord = S.buildDiscordPayload(HUNT, null, NOW).payload;
  assert.ok(discord.embeds[0].description.includes('high: 1'));
});

test('52251 embeddable widget descriptor', () => {
  const r = S.buildEmbedWidget(HUNT, { baseUrl: 'https://app.example.com', token: 'tok' });
  assert.equal(r.ok, true);
  assert.ok(r.widget.html.includes('<iframe'));
  assert.ok(r.widget.src.includes('/embed/hunts/hunt-t'));
});

test('52252 public toggle carries warnings, internal does not', () => {
  const link = S.createExpiringLink(HUNT, {}, NOW).link;
  const pub = S.setLinkVisibility(link, 'public');
  assert.equal(pub.link.visibility, 'public');
  assert.ok(pub.warnings.length > 0);
  const priv = S.setLinkVisibility(link, 'internal');
  assert.equal(priv.warnings.length, 0);
  assert.equal(S.setLinkVisibility(link, 'everywhere').ok, false);
});

test('52253 access log + summary', () => {
  const link = S.createExpiringLink(HUNT, {}, NOW).link;
  let r = S.logLinkAccess([], link, { viewer: 'a', ip: '1.1.1.1' }, NOW);
  r = S.logLinkAccess(r.log, link, { viewer: 'b', ip: '2.2.2.2' }, NOW + 1);
  const sum = S.summarizeAccessLog(r.log);
  assert.equal(sum.opens, 2);
  assert.equal(sum.uniqueViewers, 2);
});

test('52254 revocation invalidates the link', () => {
  const link = S.createExpiringLink(HUNT, {}, NOW).link;
  const r = S.revokeShareLink(link, { reason: 'leak' }, NOW);
  assert.equal(r.link.revoked, true);
  assert.equal(r.sessionsInvalidated, true);
  assert.equal(S.evaluateShareLink(r.link, {}, NOW).reason, 'revoked');
});

test('52255 filtered-view sharing narrows to high+', () => {
  const r = S.buildFilteredShareView(HUNT, { minSeverity: 'high' });
  assert.deepEqual(r.view.findings, ['f-1']);
  assert.equal(r.view.counts.total, 1);
});

test('52256 client portal strips navigation + manage rights', () => {
  const r = S.buildClientPortal(HUNT, { name: 'Acme' });
  assert.equal(r.portal.navigation.length, 0);
  assert.equal(r.portal.permissions.manage, false);
  assert.equal(r.portal.brand.name, 'Acme');
});

test('52257 NDA gate requires acceptance by named viewer', () => {
  const link = S.createExpiringLink(HUNT, {}, NOW).link;
  const gate = S.ndaGate(link).gate;
  assert.equal(gate.screen, 'nda');
  const a = S.acceptNda(gate, 'client@x.com', NOW);
  assert.equal(a.acceptance.viewer, 'client@x.com');
  assert.equal(S.acceptNda(gate, '', NOW).ok, false);
});

test('52258 summary-only exposes zero finding details', () => {
  const r = S.buildSummaryOnly(HUNT, NOW);
  assert.equal(r.summary.total, 2);
  assert.equal(r.summary.findingDetails.length, 0);
  assert.equal(r.summary.remediation.fixed, 1);
  assert.ok(r.summary.riskScore > 0);
});

test('52259 redaction hides secrets, emails, PoC, evidence bodies', () => {
  const r = S.redactForSharing(HUNT.findings[0]);
  assert.equal(r.finding.poc, null);
  assert.equal(r.finding.evidence[0].body, '[redacted]');
  assert.ok(!r.finding.description.includes('a@example.com'));
  assert.ok(!r.finding.description.includes('secret=zzz'));
  assert.ok(r.finding.impact.length > 0); // impact narrative survives
});

test('52260 comment threads support replies + resolution', () => {
  let t = S.createCommentThread({ findingId: 'f-1' }, NOW).thread;
  t = S.addThreadComment(t, { author: 'ria', body: 'confirmed' }, NOW).thread;
  const r = S.addThreadComment(t, { author: 'dev', body: 'fixing', parentId: t.comments[0].id }, NOW);
  assert.equal(r.thread.comments.length, 2);
  assert.equal(r.thread.comments[1].parentId, r.thread.comments[0].id);
  assert.equal(S.resolveThread(r.thread, 'ria', NOW).thread.resolved, true);
});

/* ---- collabCore spot-checks (deterministic) ---- */
test('52261 mentions parsed deduped, notifications built', () => {
  assert.deepEqual(C.parseMentions('hi @ria and @dev, cc @ria'), ['ria', 'dev']);
  const n = C.buildMentionNotifications(['ria'], { author: 'aria', huntId: 'hunt-t', prefs: { ria: 'slack' } }, NOW);
  assert.equal(n.notifications[0].channel, 'slack');
});

test('52262 feed reducer orders newest first', () => {
  let f = C.feedReducer([], { type: 'ADD_EVENT', event: { kind: 'view', at: NOW } });
  f = C.feedReducer(f, { type: 'ADD_EVENT', event: { kind: 'comment', at: NOW + 5 } });
  assert.equal(f[0].kind, 'comment');
  assert.equal(C.feedReducer(f, { type: 'CLEAR' }).length, 0);
});

test('52263 share analytics: opens, uniques, top findings', () => {
  const a = C.computeShareAnalytics([
    { viewer: 'a', at: NOW, findingId: 'f-1' },
    { viewer: 'a', at: NOW + 1, findingId: 'f-1' },
    { viewer: 'b', at: NOW + 2, findingId: 'f-2' },
  ]);
  assert.equal(a.opens, 3);
  assert.equal(a.uniqueViewers, 2);
  assert.equal(a.mostViewedFindings[0].findingId, 'f-1');
});

test('52264 copy-link payload summarizes permissions + expiry', () => {
  const link = S.setLinkPassword(S.createExpiringLink(HUNT, { ttlMs: 1000 }, NOW).link, 'd').link;
  const r = C.buildCopyLinkPayload(link, 'https://app.example.com');
  assert.ok(r.payload.text.startsWith('https://'));
  assert.ok(r.payload.summary.includes('password-protected'));
});

test('52265 QR descriptor carries the URL value', () => {
  const r = C.buildQrDescriptor('https://u/x', { size: 128 });
  assert.equal(r.qr.value, 'https://u/x');
  assert.equal(r.qr.size, 128);
});

test('52266 email composer includes summary + optional PDF', () => {
  const r = C.buildEmailComposer(HUNT, { to: 'cto@x.com', attachPdf: true }, NOW);
  assert.ok(r.composer.body.includes('Total findings: 2'));
  assert.equal(r.composer.attachments.length, 1);
});

test('52267 role templates grant expected rights', () => {
  assert.equal(C.applyRoleTemplate('Viewer').permissions.share, false);
  assert.equal(C.applyRoleTemplate('Remediator').permissions.share, true);
  assert.equal(C.applyRoleTemplate('Admin').permissions.manage, true);
  assert.equal(C.applyRoleTemplate('Nobody').ok, false);
});

test('52268 guest grant active until expiry', () => {
  const g = C.grantGuestAccess('hunt-t', 'g@x.com', NOW + 1000, NOW).grant;
  assert.equal(C.isGuestGrantActive(g, NOW + 500).active, true);
  assert.equal(C.isGuestGrantActive(g, NOW + 2000).active, false);
  assert.equal(C.grantGuestAccess('hunt-t', 'bad', NOW + 1000, NOW).ok, false);
});

test('52269 IP allowlist: corp allowed, external denied', () => {
  const link = S.createExpiringLink(HUNT, {}, NOW).link;
  const r = C.restrictLinkToIps(link, ['10.0.0.0/8']).link;
  assert.equal(C.checkIpAllowed(r, '10.9.9.9').allowed, true);
  assert.equal(C.checkIpAllowed(r, '8.8.8.8').allowed, false);
  assert.equal(C.checkIpAllowed(link, '8.8.8.8').reason, 'no-restriction');
});

test('52270 comparison share diffs two runs', () => {
  const r = C.buildComparisonShare(
    { id: 'a', findings: HUNT.findings },
    { id: 'b', findings: [{ id: 'f-1' }, { id: 'f-3' }] },
    'https://app.example.com', NOW,
  );
  assert.deepEqual(r.share.delta.newFindings, ['f-3']);
  assert.deepEqual(r.share.delta.fixedFindings, ['f-2']);
  assert.ok(r.share.url.includes('/s/compare/'));
});

test('52271 remediation board share excludes finding detail', () => {
  const r = C.buildRemediationBoardShare({ id: 'b1', columns: [{ name: 'Fix', cards: [{ id: 'c1', title: 'XSS', assignee: 'd' }] }] });
  assert.equal(r.share.columns[0].cards[0].title, 'XSS');
  assert.equal(r.share.columns[0].cards[0].poc, undefined);
});

test('52272/52273 triage session + presence reducers', () => {
  let s = C.createTriageSession('hunt-t', ['ria'], NOW).session;
  s = C.joinTriageSession(s, 'dev', NOW).session;
  s = C.leaveTriageSession(s, 'ria').session;
  assert.deepEqual(s.participants.map((p) => p.handle), ['dev']);
  let v = C.presenceReducer([], { type: 'JOIN', handle: 'ria' }, NOW);
  v = C.presenceReducer(v, { type: 'LEAVE', handle: 'ria' }, NOW);
  assert.equal(v.length, 0);
});

test('52274 saved filters publish + list newest first', () => {
  const r = C.publishSavedFilter([], { name: 'n1', filters: { severity: 'high' } }, NOW);
  const r2 = C.publishSavedFilter(r.library, { name: 'n2', filters: {} }, NOW + 1);
  assert.equal(C.listPublishedFilters(r2.library)[0].name, 'n2');
});

test('52275 FP rule library flags due reviews', () => {
  const r = C.addFpRule([], { pattern: 'p1', reviewInDays: 0 }, NOW - 1000).library;
  assert.equal(C.dueFpRules(r, NOW).length, 1);
  assert.equal(C.addFpRule([], {}).ok, false);
});

test('52276 hunt templates publish + instantiate', () => {
  const t = C.publishHuntTemplate({ name: 'T', config: { depth: 'quick' } }, NOW).template;
  const h = C.instantiateTemplate(t, 'x.example.com');
  assert.equal(h.hunt.target, 'x.example.com');
  assert.equal(h.hunt.templateId, t.id);
});

test('52277 ticket payloads for jira/asana/linear with deep link', () => {
  for (const sys of ['jira', 'asana', 'linear']) {
    const r = C.buildTicketPayload(HUNT.findings[0], sys, 'https://app.example.com');
    assert.equal(r.ticket.system, sys);
    assert.ok(r.ticket.deepLink.includes('f-1'));
  }
  assert.equal(C.buildTicketPayload(HUNT.findings[0], 'trello').ok, false);
});

test('52278 share manifest lists what/with-whom/when/permission', () => {
  const r = C.buildShareManifest([{ token: 't1', withWhom: 'a@x.com', when: NOW, role: 'viewer' }], NOW);
  assert.equal(r.manifest.entries[0].withWhom, 'a@x.com');
  assert.equal(r.manifest.entries[0].permission, 'viewer');
});

test('52279/52280 watermark + screenshot notice', () => {
  const w = C.buildWatermark('dev@x.com');
  assert.equal(w.watermark.text, 'dev@x.com');
  assert.equal(C.buildWatermark('bad').ok, false);
  const n = C.screenshotNotice('strict');
  assert.ok(n.notice.text.toLowerCase().includes('prohibited'));
});

/* ---- Wave57.css audits: scoped prefixes, zero keyframes ---- */
test('Wave57.css exists, uses only sh57-/cb57- classes, zero keyframes', () => {
  assert.ok(existsSync(CSS), 'Wave57.css missing');
  const css = readFileSync(CSS, 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero-animation order: no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'zero-animation order: no animation declarations allowed');
  const selectors = [...css.matchAll(/\.([a-zA-Z0-9_-]+)\s*[{,]/g)].map((m) => m[1]);
  const classSelectors = [...css.matchAll(/^\.([a-z0-9][a-z0-9-]*)/gim)].map((m) => m[1]);
  const all = new Set([...selectors, ...classSelectors].filter((s) => /^[a-z]/.test(s)));
  assert.ok(all.size > 0, 'no class selectors found');
  for (const s of all) {
    assert.ok(s.startsWith('sh57-') || s.startsWith('cb57-'), `unscoped selector: .${s}`);
  }
});

/* ---- Branding-leak audit: no forbidden brand name in wave-57 files ---- */
test('no branding leak in wave-57 files', () => {
  const files = ['shareCore.js', 'collabCore.js', 'ShareSuite.jsx', 'CollabSuite.jsx', 'Wave57.css', 'wave57.test.js'];
  const probe = 'M' + 'use'; // self-reference would fail the audit itself
  for (const f of files) {
    const p = join(DIR, f);
    assert.ok(existsSync(p), `${f} missing`);
    const body = readFileSync(p, 'utf8');
    assert.ok(!body.includes(probe), `branding leak in ${f}`);
  }
});
