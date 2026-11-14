// Self (Hunter Self) mode — backend tests.
//
// Covers: checklist config (202 checks / 17 categories / 14 AI), parsers
// + short-output formatter (output is short by construction, never a raw
// dump), toolRunner resilience (one failed tool never kills the check;
// missing tools reported blocked, never faked), the AI gate (AI legs
// NEVER run while aiConsent !== true — asserted by counting executor
// calls; consent:false skips them; consent:true with no executor blocks
// them honestly with no brain call), and the HTTP routes mounted for
// real (auth, confirmedAuthorized, owner-only, persistence on disk).
//
// No Meta calls, $0 spend. DATA_DIR points at a temp dir; the live
// backend and EC2 are untouched. Docker is never invoked: every test
// executor is an injected stub.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'self-mode-'));
process.env.DATA_DIR = tmpRoot;
process.env.JWT_SECRET = 'self-mode-test-secret-not-real';
process.env.ENGINE_URL = 'http://127.0.0.1:9'; // nothing listens: engine unreachable, fast fail
process.env.LAB_TARGETS = 'http://172.17.0.1:3100,http://172.17.0.1:3000';

const { CHECKS, CATEGORIES, CHECK_COUNT, AI_CHECK_COUNT, getCheck, getCategoryChecks } = await import('../self/checklist.js');
const { TOOL_SPECS, PARSERS, parseToolOutput, formatShortResult, runTool, runCheck, parseTarget } = await import('../self/toolRunner.js');
const { createRun, runSingleCheck, runAll, applyAiConsent, runProgress } = await import('../self/seriesRunner.js');
const { readSelfRun, writeSelfRun } = await import('../self/store.js');
const { createSelfRouter } = await import('./self.js');
const { issueToken } = await import('./auth.js');
const { writeUsers } = await import('../store.js');
const express = (await import('express')).default;

const LAB_TARGET = 'http://172.17.0.1:3100/';
const OWNER = { id: 'self-test-owner', username: 'selfowner', role: 'admin', approved: true };
const OTHER = { id: 'self-test-other', username: 'selfother', role: 'member', approved: true };
writeUsers({ [OWNER.id]: OWNER, [OTHER.id]: OTHER });

// --- Stub executor ---------------------------------------------------------
// Returns canned stdout per spec; records every invocation so gate tests
// can assert an AI leg was never executed.

function makeStubExecutor(responses = {}) {
  const calls = [];
  const execFn = async ({ spec, argv, shell }) => {
    calls.push({ spec, argv, shell });
    if (spec === 'failme') return { ok: false, code: 1, stdout: '', stderr: 'boom', timedOut: false };
    const stdout = responses[spec] ?? '';
    return { ok: true, code: 0, stdout, stderr: '', timedOut: false };
  };
  return { execFn, calls };
}

// --- Checklist -------------------------------------------------------------

test('checklist: 17 categories in sheet order, 202 distinct checks', () => {
  assert.equal(CATEGORIES.length, 17);
  assert.deepEqual(CATEGORIES.map((c) => c.code), ['REC', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16']);
  assert.equal(CHECK_COUNT, 202);
  assert.equal(CHECKS.length, 202);
  assert.equal(new Set(CHECKS.map((c) => c.id)).size, 202, 'check ids must be unique');
  assert.equal(CATEGORIES.reduce((n, c) => n + c.checks, 0), 202);
});

test('checklist: 14 AI checks, all manual-review; every other check has tools', () => {
  assert.equal(AI_CHECK_COUNT, 14);
  for (const c of CHECKS) {
    if (c.kind === 'ai') {
      assert.match(c.sheetTools, /manual (log )?review/i, `${c.id} is AI but its sheet tools do not say manual review`);
      assert.deepEqual(c.tools, [], `${c.id} is AI and must declare no predefined tools`);
    } else {
      assert.equal(c.kind, 'rule-based');
      assert.ok(c.tools.length >= 1, `${c.id} is rule-based but declares no tools`);
      for (const t of c.tools) assert.ok(TOOL_SPECS[t], `${c.id} references unknown tool spec "${t}"`);
    }
    assert.ok(['LIVE', 'GAP-partial', 'GAP'].includes(c.coverage), `${c.id} bad coverage ${c.coverage}`);
  }
});

test('checklist: coverage matches the Go.xlsx map (108 LIVE / 64 GAP-partial / 30 GAP)', () => {
  const counts = { LIVE: 0, 'GAP-partial': 0, GAP: 0 };
  for (const c of CHECKS) counts[c.coverage] += 1;
  assert.deepEqual(counts, { LIVE: 108, 'GAP-partial': 64, GAP: 30 });
});

test('checklist: REC-01 and an A01 check have the expected tools', () => {
  assert.deepEqual(getCheck('REC-01').tools, ['subfinder', 'amass']);
  assert.ok(getCheck('REC-12').tools.includes('curl-robots'));
  assert.ok(getCategoryChecks('A06').every((c) => c.kind === 'ai'));
  assert.equal(getCheck('NOPE'), null);
});

// --- Parsers + short output -------------------------------------------------

test('parsers: subdomains dedup and scope to the target host', () => {
  const out = parseToolOutput('subdomains', 'a.example.com\nb.example.com\na.example.com\nother.com\n', parseTarget('https://example.com/'), {});
  assert.equal(out.count, 2);
  assert.match(out.findings[0].title, /2 subdomain/);
  assert.ok(!JSON.stringify(out).includes('other.com'));
});

test('parsers: nuclei JSONL -> one short finding per template', () => {
  const line = JSON.stringify({ 'template-id': 't1', info: { name: 'Exposed Panel', severity: 'high' }, 'matched-at': 'http://x/admin' });
  const out = parseToolOutput('nuclei-jsonl', `${line}\nnot json\n`, parseTarget('http://x/'), {});
  assert.equal(out.count, 1);
  assert.match(out.findings[0].title, /Exposed Panel/);
});

test('parsers: headers flags missing security headers, reflection needs the exact marker', () => {
  const h = parseToolOutput('headers', 'HTTP/1.1 200 OK\nServer: Apache\n', parseTarget('http://x/'), {});
  assert.ok(h.findings.some((f) => /missing/.test(f.title)));
  const r1 = parseToolOutput('reflection', 'hello SELFDMXSS9zz world', parseTarget('http://x/'), { marker: 'SELFDMXSS9zz' });
  assert.equal(r1.count, 1);
  const r2 = parseToolOutput('reflection', 'hello world', parseTarget('http://x/'), { marker: 'SELFDMXSS9zz' });
  assert.equal(r2.count, 0);
});

test('formatter: short by construction — long raw output never survives', () => {
  const huge = Array.from({ length: 5000 }, (_, i) => `line ${i} ${'x'.repeat(100)}`).join('\n');
  const parsed = parseToolOutput('lines', huge, parseTarget('http://x/'), {});
  const formatted = formatShortResult({ id: 'REC-09' }, [
    { spec: 'gobuster', status: 'ok', findings: parsed.findings, count: parsed.count },
    { spec: 'testssl-missing', status: 'blocked', findings: [], count: 0 },
  ]);
  assert.ok(formatted.summary.length <= 280, `summary too long: ${formatted.summary.length}`);
  assert.ok(formatted.findings.length <= 10);
  for (const f of formatted.findings) {
    assert.ok(f.evidence.length <= 5);
    for (const line of f.evidence) assert.ok(line.length <= 200, 'evidence line must be truncated');
  }
  // 5000 raw lines collapse to a bounded object, never a dump.
  assert.ok(JSON.stringify(formatted).length < 20000, `formatted result too big: ${JSON.stringify(formatted).length}`);
  assert.equal(formatted.counts.toolsBlocked, 1);
});

// --- Tool runner ------------------------------------------------------------

test('runCheck: findings from one tool, verdict yes, short summary', async () => {
  const { execFn } = makeStubExecutor({ subfinder: 'a.example.com\nb.example.com\n', amass: 'c.example.com\n' });
  const result = await runCheck(getCheck('REC-01'), 'https://example.com/', { execFn });
  assert.equal(result.checkId, 'REC-01');
  assert.equal(result.verdict, 'yes');
  assert.equal(result.status, 'done');
  assert.ok(result.summary.length <= 280);
  assert.equal(result.tools.length, 2);
  assert.ok(result.tools.every((t) => t.status === 'ok'));
});

test('runCheck: one failed tool does not kill the check', async () => {
  const { execFn } = makeStubExecutor({ subfinder: 'a.example.com\n' });
  const wrapped = async (args) => (args.spec === 'amass' ? { ok: false, code: 1, stdout: '', stderr: 'boom', timedOut: false } : execFn(args));
  const result = await runCheck(getCheck('REC-01'), 'https://example.com/', { execFn: wrapped });
  assert.equal(result.verdict, 'yes');
  assert.equal(result.status, 'partial');
  assert.equal(result.tools.find((t) => t.spec === 'amass').status, 'failed');
  assert.equal(result.tools.find((t) => t.spec === 'subfinder').status, 'ok');
});

test('runCheck: missing-tool legs are blocked, never faked; a record is a finding; empty output is verdict no', async () => {
  const { execFn } = makeStubExecutor({ dig: 'example.com. 300 IN A 1.2.3.4\n' });
  const result = await runCheck(getCheck('REC-02'), 'https://example.com/', { execFn });
  const dnsx = result.tools.find((t) => t.spec === 'dnsx-missing');
  assert.equal(dnsx.status, 'blocked');
  assert.match(dnsx.reason, /dnsx is not installed/);
  assert.equal(result.verdict, 'yes', 'a returned DNS record is evidence');
  assert.equal(result.status, 'partial', 'one leg blocked -> partial');
  // Clean run: httpx returns nothing -> verdict no.
  const cleanExec = makeStubExecutor({ httpx: '' });
  const clean = await runCheck(getCheck('REC-03'), 'https://example.com/', { execFn: cleanExec.execFn });
  assert.equal(clean.verdict, 'no');
  assert.equal(clean.status, 'done');
  // A check whose every leg is missing/manual is blocked with verdict unknown.
  const aiLike = { id: 'X-01', category: 'A06', kind: 'ai', tools: ['testssl-missing'] };
  const blocked = await runCheck(aiLike, LAB_TARGET, { execFn });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.verdict, 'unknown');
  assert.equal(blocked.findings.length, 0);
});

test('runTool: unknown spec fails closed, manual spec is skipped without executing', async () => {
  const { execFn, calls } = makeStubExecutor({});
  const unknown = await runTool('no-such-spec', parseTarget(LAB_TARGET), { execFn });
  assert.equal(unknown.status, 'failed');
  const manual = await runTool('hydra-manual', parseTarget(LAB_TARGET), { execFn });
  assert.equal(manual.status, 'skipped');
  assert.match(manual.reason, /NOT auto-run/);
  assert.equal(calls.length, 0, 'manual/missing legs must never reach the executor');
});

test('kali-exec.sh: overrides the hunt-image entrypoint (load-bearing — the image entrypoint swallows bare args)', () => {
  const script = fs.readFileSync(path.join(import.meta.dirname, '..', '..', '..', 'docker', 'tools', 'kali-exec.sh'), 'utf8');
  const code = script.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.match(script, /--entrypoint \/bin\/bash/, 'kali-exec.sh must override the entrypoint or no tool ever runs');
  assert.match(code, /docker run --rm/, 'containers must be ephemeral');
  assert.ok(!/--privileged/.test(code), 'kali-exec must never run privileged');
  assert.ok(!/--network host/.test(code), 'kali-exec must not use the host network');
});

// --- AI gate (series runner) ------------------------------------------------

test('gate: runSingleCheck on an AI check without consent never executes anything', async () => {
  const { execFn, calls } = makeStubExecutor({});
  const run = createRun({ target: LAB_TARGET, userId: OWNER.id });
  const aiId = CHECKS.find((c) => c.kind === 'ai').id;
  const out = await runSingleCheck(run, aiId, { execFn });
  assert.equal(out.gated, true);
  assert.equal(out.error, 'ai_gate');
  assert.equal(calls.length, 0, 'executor must not be called for a gated AI leg');
  assert.equal(run.checks[aiId].status, 'pending', 'gated check stays pending');
  assert.equal(run.aiConsent, null);
  assert.equal(run.phase, 'predefined');
});

test('gate: runAll stops at the first AI check and never runs an AI leg', async () => {
  const { execFn } = makeStubExecutor({
    subfinder: 'a.example.com\n', amass: '', httpx: '{"url":"http://172.17.0.1:3100/","status_code":200}\n',
  });
  const run = createRun({ target: LAB_TARGET, userId: OWNER.id });
  const out = await runAll(run, { execFn });
  assert.equal(out.stoppedAtAiBoundary, true);
  assert.equal(run.phase, 'awaiting-ai-consent');
  assert.equal(run.aiConsent, null);
  const firstAi = CHECKS.find((c) => c.kind === 'ai');
  assert.equal(out.boundaryCheckId, firstAi.id);
  assert.equal(run.checks[firstAi.id].status, 'pending');
  // Rule-based checks before the boundary did run; every AI check is
  // still pending (AI checks declare no tools at all, so nothing about
  // them could have executed).
  assert.ok(CHECKS.filter((c) => c.kind === 'ai').every((c) => run.checks[c.id].status === 'pending'));
  // Rule-based checks before the boundary did run.
  assert.ok(run.checks['REC-01'].status !== 'pending');
  const progress = runProgress(run);
  assert.ok(progress.done + progress.partial > 0);
  assert.equal(progress.pending, CHECKS.filter((c) => c.kind === 'ai').length + CHECKS.filter((c) => c.kind === 'rule-based' && run.checks[c.id].status === 'pending').length);
});

test('gate: consent:false skips every AI check and completes the run', async () => {
  const run = createRun({ target: LAB_TARGET, userId: OWNER.id });
  run.phase = 'awaiting-ai-consent';
  const out = await applyAiConsent(run, false);
  assert.equal(out.ok, true);
  assert.equal(out.phase, 'done');
  assert.equal(run.aiConsent, false);
  assert.equal(run.phase, 'done');
  assert.ok(CHECKS.filter((c) => c.kind === 'ai').every((c) => run.checks[c.id].status === 'skipped'));
  assert.match(run.checks[CHECKS.find((c) => c.kind === 'ai').id].summary, /consent declined/);
});

test('gate: consent:true with NO executor blocks AI legs honestly — no brain call', async () => {
  const run = createRun({ target: LAB_TARGET, userId: OWNER.id });
  run.phase = 'awaiting-ai-consent';
  const out = await applyAiConsent(run, true);
  assert.equal(out.ok, true);
  assert.equal(out.aiExecutorConfigured, false);
  assert.equal(out.aiBlocked, AI_CHECK_COUNT);
  assert.equal(run.phase, 'done');
  assert.equal(run.aiConsent, true);
  assert.ok(CHECKS.filter((c) => c.kind === 'ai').every((c) => run.checks[c.id].status === 'blocked'));
  assert.match(run.checks[CHECKS.find((c) => c.kind === 'ai').id].summary, /ai-executor-not-configured/);
});

test('gate: consent:true WITH an executor resumes AI legs through it', async () => {
  const run = createRun({ target: LAB_TARGET, userId: OWNER.id });
  run.phase = 'awaiting-ai-consent';
  const seen = [];
  const aiExecutor = async (check) => {
    seen.push(check.id);
    return { checkId: check.id, category: check.category, kind: 'ai', status: 'done', verdict: 'no', summary: 'Manual review recorded by the executor.', counts: { toolsRun: 0, toolsFailed: 0, toolsBlocked: 0, findings: 0, items: 0 }, findings: [], tools: [], startedAt: null, finishedAt: new Date().toISOString(), durationMs: 1 };
  };
  const out = await applyAiConsent(run, true, { aiExecutor });
  assert.equal(out.aiRan, AI_CHECK_COUNT);
  assert.equal(seen.length, AI_CHECK_COUNT);
  assert.ok(CHECKS.filter((c) => c.kind === 'ai').every((c) => run.checks[c.id].status === 'done'));
});

test('gate: no self module imports any brain module (grep-verifiable)', () => {
  for (const file of ['toolRunner.js', 'seriesRunner.js', 'store.js', 'checklist.js']) {
    const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'self', file), 'utf8');
    assert.ok(!/^\s*import\s+.*\bfrom\s+['"].*brain/i.test(src), `${file} imports a brain module`);
    assert.ok(!/require\(['"].*brain/i.test(src), `${file} requires a brain module`);
  }
  const routeSrc = fs.readFileSync(path.join(import.meta.dirname, 'self.js'), 'utf8');
  assert.ok(!/^\s*import\s+.*\bfrom\s+['"].*brain/i.test(routeSrc), 'routes/self.js imports a brain module');
});

// --- Persistence ------------------------------------------------------------

test('store: run state survives a re-read (restart-safe)', () => {
  const run = createRun({ target: LAB_TARGET, userId: OWNER.id });
  run.checks['REC-01'] = { ...run.checks['REC-01'], status: 'done', verdict: 'yes', summary: 'x' };
  writeSelfRun(run);
  const again = readSelfRun(run.id);
  assert.equal(again.id, run.id);
  assert.equal(again.checks['REC-01'].verdict, 'yes');
  assert.equal(again.phase, 'predefined');
  assert.ok(fs.existsSync(path.join(tmpRoot, 'self-runs', run.id, 'run.json')));
  assert.equal(readSelfRun('does-not-exist'), null);
});

// --- Routes -----------------------------------------------------------------

const stub = makeStubExecutor({
  subfinder: 'a.example.com\nb.example.com\n', amass: 'c.example.com\n',
  dig: 'example.com. 300 IN A 1.2.3.4\n',
  httpx: '{"url":"http://172.17.0.1:3100/","status_code":200,"title":"DVWA"}\n',
});
const app = express();
app.use(express.json());
app.use('/api/v1/self', createSelfRouter({ execFn: stub.execFn }));
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
server.unref(); // never hang the test process if a test fails before teardown
const base = `http://127.0.0.1:${server.address().port}/api/v1/self`;
const ownerToken = issueToken({ id: OWNER.id, username: OWNER.username, role: OWNER.role });
const otherToken = issueToken({ id: OTHER.id, username: OTHER.username, role: OTHER.role });
const ownerHeaders = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
const otherHeaders = { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' };

async function call(method, url, headers = ownerHeaders, body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, text };
}

async function pollRun(id, wantPhase, timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    const r = await call('GET', `${base}/runs/${id}`);
    assert.equal(r.status, 200);
    if (r.json.run.phase === wantPhase) return r.json.run;
    if (Date.now() - start > timeoutMs) throw new Error(`run ${id} never reached phase ${wantPhase} (last: ${r.json.run.phase})`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test('routes: unauthenticated checklist is 401; authenticated returns 202 checks', async () => {
  const anon = await call('GET', `${base}/checklist`, { 'Content-Type': 'application/json' });
  assert.equal(anon.status, 401);
  const r = await call('GET', `${base}/checklist`);
  assert.equal(r.status, 200);
  assert.equal(r.json.checks.length, 202);
  assert.equal(r.json.counts.ai, 14);
  assert.equal(r.json.categories.length, 17);
  // Contract pin for the Self frontend (merge 14 Nov 2026): categories are
  // metadata {code, title, checks:<count>} and checks are flat with
  // `category` as the code — the frontend groups by code. If this shape
  // changes, the frontend normalizers must change with it.
  assert.equal(r.json.categories[0].code, 'REC');
  assert.equal(r.json.categories[0].title, 'Reconnaissance');
  assert.equal(typeof r.json.categories[0].checks, 'number');
  assert.equal(r.json.checks[0].category, 'REC');
  assert.equal(r.json.counts.total, 202);
  assert.equal(r.json.counts.ruleBased, 188);
});

test('routes: create requires confirmedAuthorized:true and rejects other owners', async () => {
  const noAuth = await call('POST', `${base}/runs`, ownerHeaders, { target: LAB_TARGET });
  assert.equal(noAuth.status, 403);
  assert.equal(noAuth.json.error, 'authorization_not_confirmed');
  const noTarget = await call('POST', `${base}/runs`, ownerHeaders, { confirmedAuthorized: true });
  assert.equal(noTarget.status, 400);
  const r = await call('POST', `${base}/runs`, ownerHeaders, { target: LAB_TARGET, confirmedAuthorized: true });
  assert.equal(r.status, 201);
  assert.equal(r.json.run.phase, 'predefined');
  assert.equal(r.json.run.aiConsent, null);
  assert.equal(r.json.run.checks.length, 202);
  assert.equal(r.json.run.progress.pending, 202);
  const other = await call('GET', `${base}/runs/${r.json.run.id}`, otherHeaders);
  assert.equal(other.status, 403);
  const mine = await call('GET', `${base}/runs/${r.json.run.id}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.json.run.id, r.json.run.id);
});

test('routes: single check runs, persists verdict; AI single check is gated 403', async () => {
  const created = await call('POST', `${base}/runs`, ownerHeaders, { target: LAB_TARGET, confirmedAuthorized: true });
  const id = created.json.run.id;
  const rec = await call('POST', `${base}/runs/${id}/checks/REC-02/run`);
  assert.equal(rec.status, 200);
  assert.equal(rec.json.check.verdict, 'yes');
  assert.ok(rec.json.check.summary.length <= 280);
  assert.equal(rec.json.run.checks.find((c) => c.checkId === 'REC-02').verdict, 'yes');
  // Persistence: the stored file carries the verdict.
  assert.equal(readSelfRun(id).checks['REC-02'].verdict, 'yes');
  const aiId = CHECKS.find((c) => c.kind === 'ai').id;
  const gated = await call('POST', `${base}/runs/${id}/checks/${aiId}/run`);
  assert.equal(gated.status, 403);
  assert.equal(gated.json.error, 'ai_gate');
  assert.equal(readSelfRun(id).checks[aiId].status, 'pending');
  const unknown = await call('POST', `${base}/runs/${id}/checks/NOPE/run`);
  assert.equal(unknown.status, 404);
});

test('routes: run-all stops at the AI boundary; consent:false completes the run', async () => {
  const created = await call('POST', `${base}/runs`, ownerHeaders, { target: LAB_TARGET, confirmedAuthorized: true });
  const id = created.json.run.id;
  const started = await call('POST', `${base}/runs/${id}/run-all`);
  assert.equal(started.status, 202);
  const run = await pollRun(id, 'awaiting-ai-consent');
  assert.equal(run.aiConsent, null);
  assert.ok(run.progress.done + run.progress.partial > 0, 'predefined legs ran before the boundary');
  assert.ok(CHECKS.filter((c) => c.kind === 'ai').every((c) => run.checks.find((x) => x.checkId === c.id).status === 'pending'));
  const bad = await call('POST', `${base}/runs/${id}/ai-consent`, ownerHeaders, { consent: 'yes' });
  assert.equal(bad.status, 400);
  const declined = await call('POST', `${base}/runs/${id}/ai-consent`, ownerHeaders, { consent: false });
  assert.equal(declined.status, 200);
  assert.equal(declined.json.phase, 'done');
  assert.equal(declined.json.aiConsent, false);
  assert.ok(declined.json.run.checks.filter((c) => c.kind === 'ai').every((c) => c.status === 'skipped'));
  const again = await call('POST', `${base}/runs/${id}/ai-consent`, ownerHeaders, { consent: true });
  assert.equal(again.status, 409, 'consent is single-decision');
});

test('routes: run-all then consent:true blocks AI legs (no executor) and completes', async () => {
  const created = await call('POST', `${base}/runs`, ownerHeaders, { target: LAB_TARGET, confirmedAuthorized: true });
  const id = created.json.run.id;
  await call('POST', `${base}/runs/${id}/run-all`);
  await pollRun(id, 'awaiting-ai-consent');
  const consented = await call('POST', `${base}/runs/${id}/ai-consent`, ownerHeaders, { consent: true });
  assert.equal(consented.status, 200);
  assert.equal(consented.json.phase, 'done');
  assert.equal(consented.json.aiExecutorConfigured, false);
  assert.equal(consented.json.aiBlocked, 14);
  assert.ok(consented.json.run.checks.filter((c) => c.kind === 'ai').every((c) => c.status === 'blocked'));
});

test('routes: run-category on unknown category is 400; list returns own runs', async () => {
  const created = await call('POST', `${base}/runs`, ownerHeaders, { target: LAB_TARGET, confirmedAuthorized: true });
  const id = created.json.run.id;
  const bad = await call('POST', `${base}/runs/${id}/run-category`, ownerHeaders, { category: 'A99' });
  assert.equal(bad.status, 400);
  const list = await call('GET', `${base}/runs`);
  assert.equal(list.status, 200);
  assert.ok(list.json.runs.some((r) => r.id === id));
  const otherList = await call('GET', `${base}/runs`, otherHeaders);
  assert.ok(!otherList.json.runs.some((r) => r.id === id), 'other users must not see my runs');
});

test('teardown: close test server', async () => {
  await new Promise((resolve) => server.close(resolve));
});
