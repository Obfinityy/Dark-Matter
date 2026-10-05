/**
 * Tests for the hunt triple-brain planner, live report, and PD tool runner.
 *
 * All external boundaries are mocked: the brain provider is a canned script,
 * and child_process.spawn is replaced with a fake that emits JSONL.
 * No network, no binaries, no model downloads.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { TripleBrainPlanner, PTT_STAGES } from '../src/hunt/planner.js';
import { LiveReport } from '../src/hunt/liveReport.js';
import { createToolRunner, runPipeline, sanitizeTarget } from '../src/hunt/toolRunner.js';
import { estimateTokens } from '../src/services/longContext/tokens.js';

// ---------------------------------------------------------------- helpers

async function tempDataDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hunt-test-'));
  return dir;
}

const quiet = { log: () => {}, warn: () => {}, info: () => {}, error: () => {} };

/**
 * Canned brain: inspects the system prompt to decide which session is being
 * called, then plays a scripted hunt: recon sweep → nuclei tool task →
 * validation → report.
 */
function scriptedBrain() {
  const proposals = [
    { title: 'Passive subdomain sweep', stage: 'recon', kind: 'sweep', rationale: 'start passive' },
    { title: 'Template vulnerability scan', stage: 'vuln', kind: 'tool', tool: 'nuclei', rationale: 'scan live hosts', advanceStage: true },
    { title: 'Validate findings safely', stage: 'poc', kind: 'validate', rationale: 'confirm evidence', advanceStage: true },
    { title: 'Assemble live report', stage: 'report', kind: 'report', rationale: 'build report', advanceStage: true },
  ];
  let reasonCalls = 0;
  return {
    calls: [],
    async generateStructured(messages, _schema, _opts) {
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const session = system.includes('REASONER session') ? 'REASONER'
        : system.includes('GENERATOR session') ? 'GENERATOR'
        : system.includes('PARSER session') ? 'PARSER' : 'UNKNOWN';
      this.calls.push(session);
      if (session === 'REASONER') {
        if (reasonCalls >= proposals.length) return { complete: true };
        return proposals[reasonCalls++];
      }
      if (session === 'GENERATOR') {
        const user = JSON.parse(messages.find((m) => m.role === 'user').content);
        if (user.task.kind === 'tool') return { tool: 'nuclei', targets: ['example.com'], profile: 'fast' };
        if (user.task.kind === 'validate') {
          return { checks: [{ findingId: 'f1', method: 'header evidence cross-check', safeEvidence: 'x-powered-by observed' }] };
        }
        return { note: 'scripted params' };
      }
      if (session === 'PARSER') {
        return {
          findings: [
            {
              title: 'Missing security headers',
              severity: 'low',
              target: 'example.com',
              description: 'Response lacks HSTS and frame-ancestors.',
              evidence: 'headers: {}',
              remediation: 'Deploy baseline security headers.',
              confidence: 'high',
            },
          ],
          summary: 'One low finding parsed.',
        };
      }
      throw new Error('unexpected session');
    },
    async generate(messages, _opts) {
      const system = messages.find((m) => m.role === 'system')?.content || '';
      if (system.includes('SUMMARIZER session')) return 'scripted summary';
      return '{}';
    },
  };
}

/** Fake child_process child for toolRunner tests. */
class FakeChild extends EventEmitter {
  constructor({ lines = [], exitCode = 0, errorOnSpawn = null } = {}) {
    super();
    this._lines = lines;
    this._exitCode = exitCode;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.stdin = { writable: true, write: () => true, end: () => {} };
    this.killed = null;
    if (errorOnSpawn) {
      // Emit on a real timer so listeners attached after spawn (as with a
      // real child process) still observe the events.
      setTimeout(() => this.emit('error', errorOnSpawn), 5);
    } else {
      setTimeout(() => {
        for (const line of this._lines) this.stdout.emit('data', `${line}\n`);
        this.emit('close', this._exitCode);
      }, 5);
    }
  }
  kill(sig) { this.killed = sig; return true; }
}

const NUCLEI_LINE = JSON.stringify({
  'template-id': 'http-missing-security-headers',
  info: { name: 'Missing Security Headers', severity: 'low' },
  'matched-at': 'https://example.com',
  'matcher-name': 'header',
});

// ---------------------------------------------------------------- planner

describe('TripleBrainPlanner', () => {
  let dataDir;
  beforeEach(async () => { dataDir = await tempDataDir(); });
  afterEach(async () => { await fs.rm(dataDir, { recursive: true, force: true }); });

  it('creates a hunt with a seeded recon task tree', async () => {
    const planner = new TripleBrainPlanner({ brain: scriptedBrain(), dataDir, logger: quiet });
    const hunt = await planner.createHunt({ id: 'h1', target: 'example.com' });
    assert.equal(hunt.stage, 'recon');
    assert.ok(hunt.tasks.length > 0);
    assert.ok(hunt.tasks.every((t) => t.stage === 'recon'));
    const raw = await fs.readFile(path.join(dataDir, 'h1', 'state.json'), 'utf8');
    assert.equal(JSON.parse(raw).id, 'h1');
  });

  it('advances the tree recon → vuln → poc → report with a mocked brain', async () => {
    const brain = scriptedBrain();
    const planner = new TripleBrainPlanner({ brain, dataDir, logger: quiet });
    const seenStages = new Set(['recon']);
    let hunt = await planner.createHunt({ id: 'h2', target: 'example.com' });

    // Scripted reasoner emits exactly one proposal per stage; each step
    // executes one task. Drive steps until the tree completes.
    for (let i = 0; i < 12; i++) {
      const { hunt: h, done } = await planner.step(hunt, { runTool: async () => 'mocked tool output' });
      hunt = h;
      seenStages.add(hunt.stage);
      if (done) break;
    }
    assert.ok(seenStages.has('vuln'), `stages seen: ${[...seenStages]}`);
    assert.ok(seenStages.has('poc'), `stages seen: ${[...seenStages]}`);
    assert.ok(seenStages.has('report'), `stages seen: ${[...seenStages]}`);
    assert.ok(hunt.findings.length > 0, 'parser findings land in the tree');
    assert.ok(brain.calls.some((c) => c.includes('REASONER')), 'reasoner session used');
    assert.ok(brain.calls.some((c) => c.includes('GENERATOR')), 'generator session used');
    assert.ok(brain.calls.some((c) => c.includes('PARSER')), 'parser session used');
  });

  it('resumes from persisted state with a fresh planner instance', async () => {
    const p1 = new TripleBrainPlanner({ brain: scriptedBrain(), dataDir, logger: quiet });
    let hunt = await p1.createHunt({ id: 'h3', target: 'example.com' });
    const r1 = await p1.step(hunt, { runTool: async () => 'x' });
    hunt = r1.hunt;
    const tasksBefore = hunt.tasks.length;

    const p2 = new TripleBrainPlanner({ brain: scriptedBrain(), dataDir, logger: quiet });
    const resumed = await p2.loadHunt('h3');
    assert.equal(resumed.stage, hunt.stage);
    assert.equal(resumed.tasks.length, tasksBefore);
    assert.equal(resumed.findings.length, hunt.findings.length);
    // And it can keep stepping after resume.
    const r2 = await p2.step(resumed, { runTool: async () => 'x' });
    assert.ok(r2.hunt.tasks.length >= tasksBefore);
  });

  it('summarizer caps output to the token budget (deterministic fallback)', async () => {
    const planner = new TripleBrainPlanner({ brain: null, dataDir, logger: quiet, maxEvidenceTokens: 200 });
    const big = `${'banner line\n'.repeat(200)}CRITICAL finding: exposed admin panel at /admin\n${'noise '.repeat(5000)}`;
    assert.ok(estimateTokens(big) > 200, 'fixture must exceed budget');
    const out = await planner.summarize(big, { maxTokens: 200 });
    assert.ok(estimateTokens(out) <= 260, `capped at ~200 tokens, got ${estimateTokens(out)}`);
    assert.ok(out.includes('CRITICAL'), 'keyword-dense lines survive compression');
  });

  it('falls back to deterministic tasks when the brain is unreachable', async () => {
    const planner = new TripleBrainPlanner({ brain: null, dataDir, logger: quiet });
    const hunt = await planner.createHunt({ id: 'h4', target: 'example.com' });
    const { hunt: h2, task } = await planner.step(hunt);
    assert.ok(task, 'deterministic task produced');
    assert.equal(task.status, 'done');
    assert.ok(['recon', 'vuln', 'poc', 'report'].includes(h2.stage));
  });

  it('keeps the huntStateMachine status in sync with PTT stages', async () => {
    const planner = new TripleBrainPlanner({ brain: scriptedBrain(), dataDir, logger: quiet });
    let hunt = await planner.createHunt({ id: 'h5', target: 'example.com' });
    assert.equal(hunt.huntState.status, 'recon');
    for (let i = 0; i < 12; i++) {
      const r = await planner.step(hunt, { runTool: async () => 'x' });
      hunt = r.hunt;
      if (r.done) break;
    }
    assert.equal(hunt.huntState.status, 'complete');
  });
});

// ---------------------------------------------------------------- live report

describe('LiveReport', () => {
  let dataDir;
  beforeEach(async () => { dataDir = await tempDataDir(); });
  afterEach(async () => { await fs.rm(dataDir, { recursive: true, force: true }); });

  it('accumulates findings live and deduplicates repeats', async () => {
    const report = new LiveReport({ huntId: 'r1', target: 'example.com', dataDir, logger: quiet });
    const f1 = await report.addFinding({ title: 'Exposed .git', severity: 'high', target: 'example.com', description: 'd', evidence: 'e1' });
    assert.ok(f1);
    const dup = await report.addFinding({ title: 'exposed .git ', severity: 'high', target: 'example.com', description: 'd', evidence: 'e2' });
    assert.equal(dup, null, 'duplicate merged, not duplicated');
    assert.equal(report.findings.length, 1);
    assert.ok(report.findings[0].evidence.includes('e2'), 'evidence merged');
    const raw = await fs.readFile(path.join(dataDir, 'r1', 'report.json'), 'utf8');
    assert.equal(JSON.parse(raw).findings.length, 1, 'persisted incrementally');
  });

  it('ranks recommended fixes by impact-per-effort (highest value first)', async () => {
    const report = new LiveReport({ huntId: 'r2', target: 'example.com', dataDir, logger: quiet });
    await report.addFinding({ title: 'Verbose server banner', severity: 'low', target: 'example.com', description: 'd', evidence: 'e' });
    await report.addFinding({ title: 'SQL injection in search', severity: 'critical', target: 'example.com', description: 'd', evidence: 'e' });
    const fixes = report.rankedFixes();
    assert.ok(fixes.length >= 2);
    assert.ok(fixes[0].score >= fixes[fixes.length - 1].score, 'sorted desc by score');
    assert.match(fixes[0].findingTitle || fixes[0].fix, /sql/i, 'critical SQLi fix ranks first');
  });

  it('produces pdfReportWriter-compatible input mid-hunt', async () => {
    const report = new LiveReport({ huntId: 'r3', target: 'example.com', dataDir, logger: quiet });
    await report.addFinding({ title: 'Missing security headers', severity: 'low', target: 'example.com', description: 'd', evidence: 'e' });
    const input = report.toPdfInput();
    assert.ok(input.title.includes('Infinity AI'), 'rebranded');
    assert.equal(input.summary.total, 1);
    assert.ok(Array.isArray(input.findings) && input.findings[0].remediation.length > 0);
  });

  it('restores from disk on resume', async () => {
    const r1 = new LiveReport({ huntId: 'r4', target: 'example.com', dataDir, logger: quiet });
    await r1.addFinding({ title: 'Open redirect', severity: 'medium', target: 'example.com', description: 'd', evidence: 'e' });
    const r2 = await LiveReport.load({ huntId: 'r4', dataDir, logger: quiet });
    assert.equal(r2.findings.length, 1);
    const dup = await r2.addFinding({ title: 'Open redirect', severity: 'medium', target: 'example.com', description: 'd', evidence: 'e' });
    assert.equal(dup, null, 'dedupe set restored');
  });
});

// ---------------------------------------------------------------- tool runner

describe('toolRunner', () => {
  it('rejects unsafe targets (no shell injection)', () => {
    assert.throws(() => sanitizeTarget('example.com; rm -rf /'), /unsafe/);
    assert.throws(() => sanitizeTarget('$(whoami)'), /unsafe/);
    assert.equal(sanitizeTarget('https://example.com/path'), 'https://example.com/path');
    assert.equal(sanitizeTarget('sub.example.com'), 'sub.example.com');
  });

  it('streams nuclei JSONL lines into live findings', async () => {
    const seen = [];
    const spawnFn = (_bin, _argv, _opts) => new FakeChild({ lines: [NUCLEI_LINE, 'not json', NUCLEI_LINE] });
    const runner = createToolRunner({ spawnFn, logger: quiet });
    const res = await runner.runTool('nuclei', ['example.com'], {
      onFinding: (f) => seen.push(f),
    });
    assert.equal(res.skipped, false);
    assert.equal(res.findings.length, 2, 'both JSONL lines parsed as findings');
    assert.equal(res.records.length, 2);
    assert.equal(seen.length, 2, 'onFinding forwarded live per finding');
    assert.equal(seen[0].severity, 'low');
    assert.equal(seen[0].target, 'https://example.com');
  });

  it('skips gracefully when the binary is absent', async () => {
    const spawnFn = () => new FakeChild({ errorOnSpawn: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) });
    const runner = createToolRunner({ spawnFn, logger: quiet });
    const res = await runner.runTool('subfinder', ['example.com']);
    assert.equal(res.skipped, true);
    assert.equal(res.findings.length, 0);
  });

  it('pipeline chains stages and forwards findings live with mocked binaries', async () => {
    const subLine = JSON.stringify({ host: 'api.example.com', source: 'crtsh' });
    const dnsLine = JSON.stringify({ host: 'api.example.com', a: ['93.184.216.34'] });
    const httpxLine = JSON.stringify({ url: 'https://api.example.com', host: 'api.example.com', 'status-code': 200, tech: ['nginx'], title: 'API' });
    const katLine = JSON.stringify({ request: { method: 'GET', endpoint: 'https://api.example.com/users' } });
    const byBin = {
      subfinder: [subLine],
      dnsx: [dnsLine],
      httpx: [httpxLine],
      katana: [katLine],
      nuclei: [NUCLEI_LINE],
    };
    const spawnFn = (bin) => new FakeChild({ lines: byBin[bin] || [] });
    const live = [];
    const stagesSeen = [];
    const { findings, stages } = await runPipeline(['example.com'], {
      spawnFn,
      logger: quiet,
      onFinding: (f) => live.push(f),
      onStage: (s) => stagesSeen.push(`${s.tool}:${s.phase}`),
    });
    const names = stages.map((s) => s.tool);
    assert.ok(names.includes('subfinder') && names.includes('nuclei'), `stages: ${names}`);
    assert.ok(stagesSeen.includes('nuclei:start') && stagesSeen.includes('nuclei:done'));
    assert.equal(findings.length, 1);
    assert.equal(live.length, 1, 'finding forwarded live during the hunt');
  });

  it('pipeline continues when every binary is missing', async () => {
    const spawnFn = () => new FakeChild({ errorOnSpawn: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) });
    const { findings, stages } = await runPipeline(['example.com'], { spawnFn, logger: quiet });
    assert.equal(findings.length, 0);
    assert.ok(stages.every((s) => s.skipped), 'all stages skipped gracefully');
  });
});

describe('PTT constants', () => {
  it('exposes the four stages in order', () => {
    assert.deepEqual([...PTT_STAGES], ['recon', 'vuln', 'poc', 'report']);
  });
});
