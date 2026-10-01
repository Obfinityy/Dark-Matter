/**
 * Target dedup + hunt records tests.
 *
 * The hybrid storage contract:
 *   - Fingerprinting normalizes pasted target links (tracking params, case,
 *     trailing slashes, fragments, param order) so the same target always
 *     hashes the same.
 *   - Completed hunts archive their final report in the DB (hunt_records);
 *     re-hunting the same target creates a NEW version, never overwrites.
 *   - findLatestByTarget returns the newest version — the dedup-hit path
 *     POST /jobs uses to return an existing report instantly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase } from '../src/models/database.js';
import { HuntRecordModel } from '../src/models/huntRecordModel.js';
import { fingerprintTarget, canonicalTargetUrl } from '../src/services/targetFingerprint.js';

function makeModel() {
  const database = new MemoryDatabase();
  return new HuntRecordModel(database);
}

const REPORT_V1 = '# Report v1\n\n## Findings summary\n\n| Severity | Count |\n|---|---|\n| Critical | 1 |\n';

test('fingerprint: equivalent URLs hash identically', async () => {
  const a = fingerprintTarget('https://example.com/app?id=1');
  const b = fingerprintTarget('https://example.com/app/?id=1&utm_source=google&utm_medium=cpc');
  const c = fingerprintTarget('https://EXAMPLE.com/app?id=1#section');
  const d = fingerprintTarget('https://example.com/app?utm_campaign=x&id=1&fbclid=abc');
  assert.equal(a.hash, b.hash, 'tracking params ignored');
  assert.equal(a.hash, c.hash, 'case + fragment ignored');
  assert.equal(a.hash, d.hash, 'param order ignored after sorting');
  assert.equal(a.canonical, 'https://example.com/app?id=1');
});

test('fingerprint: genuinely different targets hash differently', async () => {
  const a = fingerprintTarget('https://example.com/app?id=1');
  const b = fingerprintTarget('https://example.com/app?id=2');
  const c = fingerprintTarget('http://example.com/app?id=1');
  const d = fingerprintTarget('https://other.com/app?id=1');
  assert.notEqual(a.hash, b.hash, 'query value matters');
  assert.notEqual(a.hash, c.hash, 'scheme matters');
  assert.notEqual(a.hash, d.hash, 'host matters');
});

test('fingerprint: invalid URLs throw (caller skips dedup, normal flow validates)', async () => {
  assert.throws(() => canonicalTargetUrl('not a url at all'), /Target must be a valid URL/);
  assert.throws(() => canonicalTargetUrl(''), /Target must be a valid URL/);
  // Non-http(s) input is mangled the same way the assessment system's own
  // normalizer mangles it — stable (same input → same hash), just never
  // equal to the http(s) target. That is correct: scheme is identity.
  const ftp = fingerprintTarget('ftp://example.com/x');
  assert.equal(ftp.hash, fingerprintTarget('ftp://example.com/x').hash);
  assert.notEqual(ftp.hash, fingerprintTarget('https://example.com/x').hash);
});

test('hunt records: create → findLatestByTarget returns the newest version', async () => {
  const model = makeModel();
  const { canonical, hash } = fingerprintTarget('https://example.com/?utm_source=x');

  const v1 = await model.create({
    userId: 'u1', target: 'https://example.com/?utm_source=x',
    targetCanonical: canonical, targetHash: hash,
    jobId: 'job_1', reportMarkdown: REPORT_V1,
    summary: { totalFindings: 1, critical: 1 },
    findings: [{ id: 'f1', title: 'XSS', severity: 'critical' }]
  });
  assert.equal(v1.version, 1);

  const v2 = await model.create({
    userId: 'u1', target: 'https://example.com/',
    targetCanonical: canonical, targetHash: hash,
    jobId: 'job_2', reportMarkdown: '# Report v2',
    summary: { totalFindings: 0 },
    findings: []
  });
  assert.equal(v2.version, 2, 'repeat hunts version, never overwrite');

  // Dedup lookup uses the fingerprint of the PASTED url (with tracking junk).
  const latest = await model.findLatestByTarget('u1', fingerprintTarget('https://example.com?utm_medium=email').hash);
  assert.equal(latest.version, 2);
  assert.equal(latest.jobId, 'job_2');
  assert.ok(!('reportMarkdown' in latest), 'list view excludes the heavy markdown');

  const full = await model.findFullById('u1', latest.id);
  assert.equal(full.reportMarkdown, '# Report v2', 'full view carries the report');

  // Another user never sees this user's records (per-user isolation).
  assert.equal(await model.findLatestByTarget('u2', hash), null);
  assert.equal(await model.findFullById('u2', latest.id), null);
});

test('hunt records: listByUser returns history newest-first', async () => {
  const model = makeModel();
  const mk = (target) => {
    const { canonical, hash } = fingerprintTarget(target);
    return model.create({ userId: 'u1', target, targetCanonical: canonical, targetHash: hash, reportMarkdown: '# r' });
  };
  await mk('https://a.example/');
  // Space the creates apart: listByUser orders by completion time, and two
  // records created in the same millisecond would tie.
  await new Promise((resolve) => setTimeout(resolve, 5));
  await mk('https://b.example/');
  const list = await model.listByUser('u1');
  assert.equal(list.length, 2);
  assert.equal(list[0].target, 'https://b.example/');
  assert.ok(!('reportMarkdown' in list[0]), 'history view is lightweight');
});
