/**
 * Tests for businessLogicMapper.js — developer-flow reconstruction and
 * assumption extraction (VFS-style booking flow scenario).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  defineFlow,
  extractAssumptions,
  prioritizeAssumptions,
  planTests,
} from '../src/engines/businessLogicMapper.js';

// VFS-style appointment booking flow, as the developer intended it.
function vfsFlow() {
  return defineFlow({
    name: 'visa-appointment-booking',
    steps: [
      { actor: 'applicant', action: 'register', input: ['email', 'password'], expectedState: 'account created' },
      { actor: 'applicant', action: 'fill application form', input: ['fullName', 'passportNo', 'dob'], expectedState: 'application draft saved' },
      { actor: 'applicant', action: 'pay fee', input: ['amount', 'cardToken'], expectedState: 'payment confirmed' },
      { actor: 'applicant', action: 'book appointment slot', input: ['slotId', 'centerId'], expectedState: 'slot reserved' },
      {
        actor: 'applicant',
        action: 'reschedule appointment',
        input: ['appointmentId', 'applicantName', 'newSlotId'],
        expectedState: 'appointment moved to new slot',
      },
      {
        actor: 'applicant',
        action: 'login with facial verification',
        input: ['email', 'password', 'faceScan'],
        expectedState: 'authenticated',
        verification: 'facial-verification',
      },
    ],
  });
}

describe('defineFlow', () => {
  it('normalizes steps and computes verification coverage', () => {
    const flow = vfsFlow();
    assert.equal(flow.name, 'visa-appointment-booking');
    assert.equal(flow.steps.length, 6);
    assert.equal(flow.steps[0].index, 0);
    assert.equal(flow.steps[4].action, 'reschedule appointment');
    // Only the login step carries verification → partial coverage.
    assert.equal(flow.verificationCoverage.total, 6);
    assert.equal(flow.verificationCoverage.verified, 1);
    assert.equal(flow.verificationCoverage.partial, true);
  });

  it('handles empty input gracefully', () => {
    const flow = defineFlow();
    assert.equal(flow.steps.length, 0);
    assert.equal(flow.verificationCoverage.partial, false);
  });
});

describe('extractAssumptions', () => {
  it('flags client-controlled identity on reschedule (name param)', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const identity = assumptions.filter((a) => a.assumption === 'client-controlled identity');
    assert.ok(identity.length >= 1, 'should flag identity fields');
    const reschedule = identity.find((a) => a.action === 'reschedule appointment');
    assert.ok(reschedule, 'reschedule step flagged — applicantName is client-controlled');
    assert.match(reschedule.attackIdea, /Tamper identity/i);
  });

  it('flags concurrency on slot booking', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const concurrency = assumptions.filter((a) => a.assumption === 'concurrency');
    assert.ok(concurrency.length >= 1, 'should flag slot booking');
    assert.match(concurrency[0].attackIdea, /Race/i);
  });

  it('flags client-trusted payment state on pay step', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const payment = assumptions.find((a) => a.assumption === 'client-trusted payment state');
    assert.ok(payment, 'pay fee step flagged');
    assert.equal(payment.action, 'pay fee');
  });

  it('flags inconsistent control when verification is partial', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const inconsistent = assumptions.find((a) => a.assumption === 'inconsistent control');
    assert.ok(inconsistent, 'partial verification → inconsistent control');
    assert.match(inconsistent.attackIdea, /unverified path/i);
  });

  it('does not flag inconsistent control when nothing is verified', () => {
    const flow = defineFlow({
      name: 'plain',
      steps: [{ actor: 'u', action: 'view page', input: [], expectedState: 'page shown' }],
    });
    const assumptions = extractAssumptions(flow);
    assert.equal(
      assumptions.filter((a) => a.assumption === 'inconsistent control').length,
      0
    );
  });
});

describe('prioritizeAssumptions', () => {
  it('boosts reschedule assumption to critical with bounty hints', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const ranked = prioritizeAssumptions(assumptions, {
      bountyHints: ['reschedule', 'tamper', 'payment'],
    });
    const reschedule = ranked.find(
      (a) => a.assumption === 'client-controlled identity' && a.action === 'reschedule appointment'
    );
    assert.ok(reschedule, 'reschedule identity assumption present');
    assert.equal(reschedule.priority, 'critical', 'high boosted to critical by bounty hints');
    assert.ok(reschedule.matchedHints.includes('reschedule'));
    // Ranked at the top (among criticals) and list sorted highest-first.
    assert.ok(ranked.indexOf(reschedule) <= 1, 'reschedule assumption is top-ranked');
    const order = { critical: 4, high: 3, medium: 2, low: 1 };
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(order[ranked[i - 1].priority] >= order[ranked[i].priority], 'sorted desc');
    }
  });

  it('leaves priorities untouched without hints', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const ranked = prioritizeAssumptions(assumptions, {});
    const reschedule = ranked.find(
      (a) => a.assumption === 'client-controlled identity' && a.action === 'reschedule appointment'
    );
    assert.equal(reschedule.priority, 'high');
    assert.deepEqual(reschedule.matchedHints, []);
  });
});

describe('planTests', () => {
  it('produces tamper/replay/remove tests for identity assumption', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const identity = assumptions.find((a) => a.assumption === 'client-controlled identity');
    const tests = planTests(identity);
    assert.ok(tests.length >= 3);
    const methods = tests.map((t) => t.method);
    assert.ok(methods.includes('parameter-tamper'));
    assert.ok(methods.includes('parameter-remove'));
    assert.ok(tests.every((t) => t.action && t.expected && t.note));
  });

  it('produces race tests for concurrency assumption', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const concurrency = assumptions.find((a) => a.assumption === 'concurrency');
    const tests = planTests(concurrency);
    assert.ok(tests.some((t) => t.method === 'race'));
  });

  it('produces path-swap tests for inconsistent control', () => {
    const assumptions = extractAssumptions(vfsFlow());
    const inconsistent = assumptions.find((a) => a.assumption === 'inconsistent control');
    const tests = planTests(inconsistent);
    assert.ok(tests.some((t) => t.method === 'path-swap'));
  });
});
