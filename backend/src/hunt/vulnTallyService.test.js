/**
 * vulnTallyService.test.js — finding telemetry tests (issue #298).
 *
 * Run: cd backend && node --test src/hunt/vulnTallyService.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createVulnTallyService, tallyFor } from '../services/vulnTallyService.js';

const quiet = { warn() {} };

describe('tallyFor', () => {
  it('counts severities with correct keys', () => {
    const t = tallyFor([
      { severity: 'critical' },
      { severity: 'HIGH' },
      { severity: 'medium' },
      { severity: 'low' },
      { severity: 'info' },
      { severity: 'bogus' },
    ]);
    assert.deepEqual(t, {
      critical: 1, high: 1, medium: 1, low: 1, informational: 2, total: 6,
    });
  });

  it('handles empty input', () => {
    assert.deepEqual(tallyFor([]), {
      critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: 0,
    });
  });
});

describe('createVulnTallyService', () => {
  it('emits vuln_tally + activity events on a finding', async () => {
    const published = [];
    const svc = createVulnTallyService({
      eventService: {
        async publish(scanId, input) {
          published.push({ scanId, ...input });
          return input;
        },
      },
      logger: quiet,
    });
    const all = [
      { title: 'SQLi', severity: 'critical' },
      { title: 'XSS', severity: 'high' },
      { title: 'Missing header', severity: 'low' },
    ];
    const { tally, published: ok } = await svc.emitFinding('hunt-1', all[1], all);
    assert.equal(ok, true);
    assert.deepEqual(tally, { critical: 1, high: 1, medium: 0, low: 1, informational: 0, total: 3 });

    const tallyEvt = published.find(p => p.type === 'vuln_tally');
    assert.ok(tallyEvt, 'vuln_tally event published');
    assert.equal(tallyEvt.scanId, 'hunt-1');
    assert.deepEqual(tallyEvt.data, tally);

    const actEvt = published.find(p => p.type === 'activity');
    assert.ok(actEvt, 'activity event published');
    assert.match(actEvt.message, /\[HIGH\] XSS/);
    assert.ok(actEvt.data.line);
    assert.ok(actEvt.data.ts);
  });

  it('works without an eventService (tally computed, nothing published)', async () => {
    const svc = createVulnTallyService({ logger: quiet });
    const { tally, published } = await svc.emitFinding('hunt-1', { title: 'x', severity: 'medium' }, [
      { title: 'x', severity: 'medium' },
    ]);
    assert.equal(published, false);
    assert.equal(tally.medium, 1);
  });
});
