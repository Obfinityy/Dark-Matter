/**
 * Hunt archival tests (hybrid storage: DB side).
 *
 * When a hunt completes, AgentWorker.archiveHuntRecord persists the final
 * report as a versioned hunt record: target fingerprint (from the
 * assessment's normalized URL), rendered Markdown, severity summary, and
 * structured findings. Re-hunting the same target creates a NEW version.
 * Archival must never throw — even for garbage target strings.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase } from '../src/models/database.js';
import { HuntRecordModel } from '../src/models/huntRecordModel.js';
import { AgentWorker } from '../src/jobs/agentWorker.js';
import { fingerprintTarget } from '../src/services/targetFingerprint.js';

function makeArchiver({ assessmentTargetUrl = 'https://example.com/app?utm_source=x' } = {}) {
  const database = new MemoryDatabase();
  const huntRecordModel = new HuntRecordModel(database);
  // Minimal worker: only the fields archiveHuntRecord touches.
  const worker = {
    assessmentModel: {
      async get(userId, assessmentId) {
        if (!assessmentTargetUrl) return null;
        return { id: assessmentId, userId, targetUrl: assessmentTargetUrl };
      }
    },
    huntRecordModel
  };
  return { worker, huntRecordModel };
}

const REPORT = {
  title: 'Bug Bounty Assessment Report',
  targetHostname: 'example.com',
  findingsSummary: { total: 2, critical: 1, high: 0, medium: 1, low: 0, informational: 0 },
  detailedFindings: [
    { id: 'f1', title: 'Stored XSS', severity: 'critical', category: 'stored-xss', affectedEndpoint: '/comments', confidence: 0.95, status: 'validated' },
    { id: 'f2', title: 'Verbose header', severity: 'medium', category: 'info-disclosure', affectedEndpoint: '/', status: 'validated' }
  ]
};

const JOB = { id: 'job_arc_1', userId: 'u1', assessmentId: 'a1', target: 'example.com', stepCount: 42, startedAt: new Date(Date.now() - 5000).toISOString() };

test('archiveHuntRecord: archives the report with fingerprint, summary, findings', async () => {
  const { worker, huntRecordModel } = makeArchiver();
  const record = await AgentWorker.prototype.archiveHuntRecord.call(worker, JOB, REPORT);

  assert.equal(record.version, 1);
  assert.equal(record.targetCanonical, 'https://example.com/app', 'tracking params stripped by fingerprint');
  assert.equal(record.targetHash, fingerprintTarget('https://example.com/app?utm_source=x').hash);
  assert.equal(record.summary.totalFindings, 2);
  assert.equal(record.summary.critical, 1);
  assert.equal(record.summary.steps, 42);
  assert.ok(record.summary.durationMs >= 0);
  assert.equal(record.findings.length, 2);
  assert.equal(record.findings[0].title, 'Stored XSS');

  const full = await huntRecordModel.findFullById('u1', record.id);
  assert.ok(full.reportMarkdown.startsWith('# '), 'rendered markdown archived');
  assert.ok(full.reportMarkdown.includes('**CVSS:**'), 'archived report carries CVSS ratings');
});

test('archiveHuntRecord: repeat hunts version — dedup then finds the latest', async () => {
  const { worker, huntRecordModel } = makeArchiver();
  await AgentWorker.prototype.archiveHuntRecord.call(worker, JOB, REPORT);
  const v2 = await AgentWorker.prototype.archiveHuntRecord.call(
    worker, { ...JOB, id: 'job_arc_2' }, { ...REPORT, findingsSummary: { total: 0 } }
  );
  assert.equal(v2.version, 2);

  const latest = await huntRecordModel.findLatestByTarget('u1', fingerprintTarget('https://example.com/app').hash);
  assert.equal(latest.id, v2.id);
  assert.equal(latest.version, 2);
});

test('archiveHuntRecord: garbage targets archive without throwing', async () => {
  const { worker } = makeArchiver({ assessmentTargetUrl: null });
  const job = { ...JOB, id: 'job_arc_3', target: 'not a url at all' };
  const record = await AgentWorker.prototype.archiveHuntRecord.call(worker, job, REPORT);
  assert.equal(record.version, 1);
  assert.ok(record.targetHash.startsWith('unparseable:'), 'stable non-dedupable key');
  assert.ok(record.targetCanonical.length > 0);
});
