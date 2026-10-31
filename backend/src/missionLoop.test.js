// Integration test: the full Mission loop — Plan → Act → Verify →
// Learn → Fallback — using the Stage 2/3/4 modules together.
//
// This exercises the component integration the mission's Stages 2-4
// built. A live e2e (real browser, real DVWA) requires deployment at
// an idle gap per the runbook; this proves the loop logic is sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpectation, verifyExpectation } from './actionVerify.js';
import { parsePlan, fallbackLine } from './actionPlan.js';

// Simulates the funnel-point logic from humanLoop.js for a single turn.
function simulateTurn({ action, observation, pageUrl }) {
  let obs = observation;
  const planParsed = parsePlan(action.plan);
  const plan = planParsed.valid ? planParsed.plan : null;
  if (plan) {
    const parts = [];
    if (plan.objective) parts.push(`objective: ${plan.objective}`);
    if (plan.state) parts.push(`state: ${plan.state}`);
    if (plan.risk) parts.push(`risk: ${plan.risk}`);
    if (parts.length > 0) obs = `${obs}\n[PLAN] ${parts.join(' | ')}`;
  }
  const expectText = action && typeof action.expect === 'string' ? action.expect.trim() : '';
  let verdict = null;
  if (expectText) {
    verdict = verifyExpectation({ expect: expectText, observation: obs, pageUrl });
    if (verdict.checked) {
      obs = `${obs}\n[EXPECTATION ${verdict.verified ? 'VERIFIED' : 'NOT VERIFIED'}] ${verdict.evidence}`;
      const actionLabel = `${action.action}${action.text ? ` '${action.text}'` : ''}`;
      obs = `${obs}\n[LEARNED] ${actionLabel}: ${verdict.verified ? 'premise CONFIRMED' : 'approach FAILED'} — ${verdict.evidence}`;
      if (!verdict.verified) {
        const fb = fallbackLine(plan);
        if (fb) obs = `${obs}\n${fb}`;
      }
    }
  }
  return { observation: obs, verdict, plan };
}

test('full loop: successful action produces PLAN + VERIFIED + LEARNED', () => {
  const { observation, verdict, plan } = simulateTurn({
    action: {
      action: 'browser_click',
      text: 'Login',
      expect: 'url contains /dashboard',
      plan: {
        objective: 'log in to DVWA',
        state: 'on login page',
        risk: 'low — lab target',
        fallback: 're-type password',
      },
    },
    observation: 'Clicked Login. Page loaded.',
    pageUrl: 'http://172.17.0.1:3100/dashboard',
  });
  assert.ok(plan);
  assert.equal(verdict.verified, true);
  assert.match(observation, /\[PLAN\] objective: log in to DVWA/);
  assert.match(observation, /\[EXPECTATION VERIFIED\]/);
  assert.match(observation, /\[LEARNED\] browser_click 'Login': premise CONFIRMED/);
  assert.doesNotMatch(observation, /\[FALLBACK\]/);
});

test('full loop: failed action produces NOT VERIFIED + LEARNED + FALLBACK', () => {
  const { observation, verdict } = simulateTurn({
    action: {
      action: 'browser_click',
      text: 'Login',
      expect: 'url contains /dashboard',
      plan: {
        objective: 'log in to DVWA',
        risk: 'low',
        fallback: 'read the error text and re-type the password',
      },
    },
    observation: 'Clicked Login. Still on login page.',
    pageUrl: 'http://172.17.0.1:3100/login.php',
  });
  assert.equal(verdict.verified, false);
  assert.match(observation, /\[EXPECTATION NOT VERIFIED\]/);
  assert.match(observation, /\[LEARNED\] browser_click 'Login': approach FAILED/);
  assert.match(observation, /\[FALLBACK\] read the error text/);
});

test('full loop: action without plan/expect passes through unchanged', () => {
  const { observation, verdict, plan } = simulateTurn({
    action: { action: 'browser_snapshot' },
    observation: 'Page text...',
    pageUrl: 'http://172.17.0.1:3100/',
  });
  assert.equal(observation, 'Page text...');
  assert.equal(verdict, null);
  assert.equal(plan, null);
});

test('full loop: scope-relevant expectation (url not) blocks off-target', () => {
  const { verdict } = simulateTurn({
    action: {
      action: 'browser_click',
      text: 'External link',
      expect: 'url not evil.com',
    },
    observation: 'Clicked.',
    pageUrl: 'http://evil.com/phish',
  });
  assert.equal(verdict.verified, false);
});
