/**
 * Ask-the-Agent tests — "agent se baat karo" (talk to the hunting agent).
 *
 * POST /api/v1/jobs/:id/ask answers from LIVE persisted job state only —
 * never from an LLM, never fabricated. These tests cover:
 *  - intent detection for Hinglish + English questions;
 *  - replies that reflect the real job state (status/phase/findings);
 *  - honest answers for unknown, queued and paused states;
 *  - the { reply, reaction, suggestions } response shape;
 *  - per-user isolation: another user's job -> 404 (JOB_NOT_FOUND).
 *
 * buildAskReply is pure/deterministic, so most tests run without any
 * database. The JobManager.ask integration tests use a fake job model.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JobManager } from '../src/jobs/jobManager.js';
import { buildAskReply, detectIntent } from '../src/services/askAgentService.js';

function makeJob(overrides = {}) {
  return {
    id: 'job_test1',
    userId: 'user_owner',
    assessmentId: 'assess_test1',
    target: 'example.com',
    status: 'running',
    phase: 'recon',
    currentObjective: 'Assess example.com',
    currentStep: 'Subdomain enumeration with subfinder',
    currentAction: null,
    stepCount: 7,
    brainStatus: 'acting',
    waitingReason: null,
    findingsCount: 0,
    evidenceCount: 0,
    errors: [],
    activity: [
      { id: 'a1', at: new Date().toISOString(), kind: 'brain', message: 'Starting subdomain enumeration' },
      { id: 'a2', at: new Date().toISOString(), kind: 'tool', message: 'subfinder found 14 subdomains' },
    ],
    plan: { phases: ['recon'], completedSteps: [{ title: 'DNS recon' }], pendingSteps: [{ title: 'Port scan' }, { title: 'Dir brute force' }] },
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
    ...overrides,
  };
}

const FINDINGS = [
  { id: 'f1', title: 'Reflected XSS in search', severity: 'critical' },
  { id: 'f2', title: 'Missing security headers', severity: 'low' },
  { id: 'f3', title: 'SQL injection in login', severity: 'high' },
];

// ── Intent detection ────────────────────────────────────────────────────

test('detectIntent: understands Hinglish questions', () => {
  assert.equal(detectIntent('kya kar raha hai?'), 'doing');
  assert.equal(detectIntent('ab tak kya mila?'), 'findings');
  assert.equal(detectIntent('kitna hua?'), 'progress');
  assert.equal(detectIntent('aage kya karega?'), 'next');
  assert.equal(detectIntent('ruk kyun gaya?'), 'whystopped');
  assert.equal(detectIntent('band kar de'), 'stop');
});

test('detectIntent: understands English questions', () => {
  assert.equal(detectIntent('what are you doing?'), 'doing');
  assert.equal(detectIntent('what did you find?'), 'findings');
  assert.equal(detectIntent('why did it stop?'), 'whystopped');
  assert.equal(detectIntent('what is the status?'), 'status');
});

test('detectIntent: "band kar de" beats "kyun ruka" (stop before whystopped)', () => {
  assert.equal(detectIntent('band kar de abhi'), 'stop');
});

test('detectIntent: unknown messages fall back to status', () => {
  assert.equal(detectIntent('hello bhai'), 'status');
  assert.equal(detectIntent(''), 'status');
});

// ── Reply content reflects real job state ───────────────────────────────

test('ask: "kya kar raha hai" describes the live phase and current step', () => {
  const answer = buildAskReply({ job: makeJob(), findings: [], question: 'kya kar raha hai?' });
  assert.equal(answer.intent, 'doing');
  assert.match(answer.reply, /recon/);
  assert.match(answer.reply, /Subdomain enumeration/);
  assert.match(answer.reply, /example\.com/);
  assert.equal(answer.reaction, '🔍');
});

test('ask: findings answer counts real severities, critical-first', () => {
  const answer = buildAskReply({ job: makeJob(), findings: FINDINGS, question: 'ab tak kya mila?' });
  assert.equal(answer.intent, 'findings');
  assert.match(answer.reply, /3 findings/);
  assert.match(answer.reply, /1 critical/);
  assert.match(answer.reply, /1 high/);
  assert.match(answer.reply, /Reflected XSS in search/); // top critical-first
});

test('ask: honest when nothing found yet', () => {
  const answer = buildAskReply({ job: makeJob(), findings: [], question: 'kya mila?' });
  assert.match(answer.reply, /koi pakki finding nahi mili/);
  assert.doesNotMatch(answer.reply, /critical/i);
});

test('ask: queued job answered honestly — not started', () => {
  const answer = buildAskReply({ job: makeJob({ status: 'queued', phase: 'initializing' }), findings: [], question: 'kya kar raha hai?' });
  assert.match(answer.reply, /shuru nahi kiya/);
  assert.equal(answer.reaction, '⏳');
});

test('ask: paused job answered honestly', () => {
  const answer = buildAskReply({ job: makeJob({ status: 'paused', pausedAt: new Date().toISOString() }), findings: [], question: 'kya kar raha hai?' });
  assert.match(answer.reply, /ruka hua/);
  assert.equal(answer.reaction, '⏸️');
});

test('ask: "band kar de" never cancels — guides to the Stop button', () => {
  const answer = buildAskReply({ job: makeJob(), findings: [], question: 'band kar de' });
  assert.equal(answer.intent, 'stop');
  assert.match(answer.reply, /Stop button/);
});

test('ask: waiting job explains plainly without internal jargon', () => {
  const job = makeJob({
    status: 'waiting', phase: 'waiting', brainStatus: 'waiting',
    waitingReason: 'LOCAL AI UNAVAILABLE — PHONE_AI_ENABLED is not true. Waiting to recover.',
    currentStep: 'LOCAL AI UNAVAILABLE — PHONE_AI_ENABLED is not true',
  });
  const answer = buildAskReply({ job, findings: [], question: 'kya kar raha hai?' });
  assert.doesNotMatch(answer.reply, /PHONE_AI_ENABLED/);
  assert.match(answer.reply, /local AI brain ke online aane/);
});

test('ask: "aage kya karega" lists real pending steps', () => {
  const answer = buildAskReply({ job: makeJob(), findings: [], question: 'aage kya karega?' });
  assert.equal(answer.intent, 'next');
  assert.match(answer.reply, /Port scan/);
});

test('ask: completed job reports honestly', () => {
  const answer = buildAskReply({ job: makeJob({ status: 'completed', phase: 'complete' }), findings: FINDINGS, question: 'kya kar raha hai?' });
  assert.match(answer.reply, /poora ho chuka/);
  assert.equal(answer.reaction, '🎉');
});

// ── Response shape ──────────────────────────────────────────────────────

test('ask: response always has reply + reaction + 3 suggestions', () => {
  for (const question of ['kya kar raha hai?', 'kitna hua?', 'hello', 'band kar de']) {
    const answer = buildAskReply({ job: makeJob(), findings: [], question });
    assert.ok(typeof answer.reply === 'string' && answer.reply.length > 10, `reply for "${question}"`);
    assert.ok(typeof answer.reaction === 'string' && answer.reaction.length > 0, `reaction for "${question}"`);
    assert.ok(Array.isArray(answer.suggestions) && answer.suggestions.length === 3, `suggestions for "${question}"`);
    assert.equal(answer.jobStatus, 'running');
  }
});

// ── JobManager.ask integration (per-user isolation) ──────────────────────

function makeManager() {
  const store = new Map();
  const jobModel = {
    async getForUser(userId, jobId) {
      const job = store.get(jobId);
      return job && job.userId === userId ? job : null;
    },
    __put(job) { store.set(job.id, job); },
  };
  const worker = {
    findingModel: { async list() { return []; } },
    reasoningCycleModel: { async recentSummaries() { return []; } },
    memory: { async rememberConversation() {} },
    brain: {},
  };
  const manager = new JobManager({ jobModel, assessmentModel: {}, worker, eventService: null });
  return { manager, jobModel };
}

test('JobManager.ask: owner gets a live-state answer', async () => {
  const { manager, jobModel } = makeManager();
  jobModel.__put(makeJob());
  const answer = await manager.ask('user_owner', 'job_test1', 'kya kar raha hai?');
  assert.equal(answer.intent, 'doing');
  assert.match(answer.reply, /recon/);
  assert.ok(answer.suggestions.length === 3);
});

test('JobManager.ask: another user\'s job -> 404 JOB_NOT_FOUND', async () => {
  const { manager, jobModel } = makeManager();
  jobModel.__put(makeJob());
  await assert.rejects(
    () => manager.ask('user_intruder', 'job_test1', 'kya kar raha hai?'),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'JOB_NOT_FOUND');
      return true;
    }
  );
});

test('JobManager.ask: unknown job id -> 404', async () => {
  const { manager } = makeManager();
  await assert.rejects(
    () => manager.ask('user_owner', 'job_nope', 'hello'),
    (error) => error.status === 404
  );
});
