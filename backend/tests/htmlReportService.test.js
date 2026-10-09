/**
 * htmlReportService.test.js — chunked, brain-written HTML reports.
 *
 * The hunting brain is a small model: it writes ONE section per call
 * (small prompt, small output) and the service assembles the document.
 * Brain fragments are sanitized — no scripts or event handlers survive.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { HtmlReportService, sanitizeFragment } = await import(
  '../src/services/htmlReportService.js'
);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'htmlrep-'));

const findings = [
  { id: 'f1', title: 'SQL Injection in search', severity: 'critical', category: 'sqli', affectedAsset: 'https://target.com', description: 'Unsanitized input.' },
  { id: 'f2', title: 'Reflected XSS', severity: 'high', category: 'xss', description: 'Alert popup.' },
  { id: 'f3', title: 'Missing header', severity: 'low', category: 'misconfig', description: 'No CSP.' },
];

/** Fake brain: returns a small HTML fragment per section. */
function fakeBrain() {
  return {
    calls: [],
    async generate(messages) {
      const user = messages.find(m => m.role === 'user')?.content || '';
      this.calls.push(user.slice(0, 60));
      return `<h2>Section</h2><p>Brain-written narrative for: ${user.slice(0, 40)}…</p>`;
    },
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(id, svc, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = svc.getStatus(id);
    if (s.status === 'done' || s.status === 'failed') return s;
    await sleep(100);
  }
  throw new Error('generation timed out');
}

describe('HtmlReportService', () => {
  test('generates a complete HTML report section-by-section', async () => {
    const svc = new HtmlReportService({ reportDir: tmpDir, logger: { info() {}, warn() {}, error() {} } });
    const brain = fakeBrain();
    const id = svc.startGeneration({
      jobId: 'job1', userId: 'u1', target: 'https://target.com', findings, brain,
    });
    const status = await waitFor(id, svc);
    assert.equal(status.status, 'done');
    assert.ok(status.progress.done > 0);
    assert.equal(status.progress.done, status.progress.total);
    // Brain wrote one section per narrative chunk (not one giant call).
    assert.ok(brain.calls.length >= 4, `expected >=4 brain calls, got ${brain.calls.length}`);
    const html = await svc.getHtml(id);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('https://target.com'));
    assert.ok(html.includes('SQL Injection in search'));
    assert.ok(html.includes('critical: 1'));
  });

  test('works without a brain (deterministic fallback)', async () => {
    const svc = new HtmlReportService({ reportDir: tmpDir, logger: { info() {}, warn() {}, error() {} } });
    const id = svc.startGeneration({
      jobId: 'job2', userId: 'u1', target: 'https://target.com', findings, brain: null,
    });
    const status = await waitFor(id, svc);
    assert.equal(status.status, 'done');
    const html = await svc.getHtml(id);
    assert.ok(html.includes('SQL Injection in search'));
  });

  test('sanitizeFragment strips scripts and event handlers', () => {
    const dirty = `<h2>Hi</h2><script>alert(1)</script><p onclick="evil()">x</p><iframe src="x"></iframe><a href="javascript:alert(1)">y</a>`;
    const clean = sanitizeFragment(dirty);
    assert.ok(!clean.includes('<script'));
    assert.ok(!clean.includes('onclick'));
    assert.ok(!clean.includes('<iframe'));
    assert.ok(!clean.includes('javascript:'));
    assert.ok(clean.includes('<h2>Hi</h2>'));
  });

  test('critical/high findings get their own deep-dive sections', async () => {
    const svc = new HtmlReportService({ reportDir: tmpDir, logger: { info() {}, warn() {}, error() {} } });
    const brain = fakeBrain();
    const id = svc.startGeneration({
      jobId: 'job3', userId: 'u1', target: 't', findings, brain,
    });
    const status = await waitFor(id, svc);
    assert.equal(status.status, 'done');
    // sections: summary + methodology + overview + 3 finding groups + chains + remediation + appendix = 9
    assert.equal(status.progress.total, 9);
  });

  test('unknown generation id returns not_found', async () => {
    const svc = new HtmlReportService({ reportDir: tmpDir });
    assert.equal(svc.getStatus('nope').status, 'not_found');
    assert.equal(await svc.getHtml('nope'), null);
  });
});
