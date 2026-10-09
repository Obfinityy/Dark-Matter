/**
 * Tests for botEcosystemIntel.js — GitHub bot duplicate-risk scoring
 * (VFS Global slot-bot scenario from the 10 Oct 2026 hunt).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractRepoSignals,
  scoreAutomationDuplicateRisk,
  automationClaimGuidance,
} from '../src/engines/botEcosystemIntel.js';

// Mirrors the real VFS bot ecosystem found on GitHub (names kept generic).
function vfsBotRepos() {
  return [
    {
      name: 'vfs-appointment-bot',
      stars: 402,
      description: 'Playwright booking automation for VFS appointment slots with CAPTCHA handling and email alerts',
    },
    {
      name: 'visa-slot-monitor',
      stars: 87,
      description: 'Polls the appointment slot-availability API and sends Telegram alerts on new slots',
    },
    {
      name: 'vfs-checker',
      stars: 12,
      description: 'Checks VFS slot availability and notifies via pushover',
    },
  ];
}

describe('extractRepoSignals', () => {
  it('detects slot-monitoring, booking, captcha-solving, notification signals', () => {
    const signals = extractRepoSignals(vfsBotRepos()[0]);
    assert.ok(signals.includes('slot-monitoring'), 'slot in name/desc');
    assert.ok(signals.includes('booking'), 'booking automation');
    assert.ok(signals.includes('captcha-solving'), 'CAPTCHA handling');
    assert.ok(signals.includes('notification'), 'email alerts');
  });

  it('detects login signals', () => {
    const signals = extractRepoSignals({
      name: 'vfs-login-bot',
      description: 'automates login with RSA-encrypted credentials',
    });
    assert.ok(signals.includes('login'));
  });

  it('returns empty array for unrelated repos', () => {
    assert.deepEqual(extractRepoSignals({ name: 'todo-app', description: 'a todo list' }), []);
  });
});

describe('scoreAutomationDuplicateRisk', () => {
  it('rates VFS scenario as HIGH (3 repos, one 402-star)', () => {
    const result = scoreAutomationDuplicateRisk({
      target: 'vfsglobal.com',
      botRepos: vfsBotRepos(),
    });
    assert.equal(result.risk, 'high');
    assert.match(result.reasoning, /duplicate/i);
    assert.equal(result.matchedRepos.length, 3);
    const leader = result.matchedRepos.find((r) => r.stars === 402);
    assert.ok(leader.signals.includes('slot-monitoring'));
  });

  it('rates high on a single 200+ star repo', () => {
    const result = scoreAutomationDuplicateRisk({
      target: 'example.com',
      botRepos: [{ name: 'mega-bot', stars: 250, description: 'slot monitor' }],
    });
    assert.equal(result.risk, 'high');
  });

  it('rates medium for 1-2 small repos', () => {
    const result = scoreAutomationDuplicateRisk({
      target: 'example.com',
      botRepos: [{ name: 'tiny-checker', stars: 5, description: 'checks slots' }],
    });
    assert.equal(result.risk, 'medium');
    assert.match(result.reasoning, /novel/i);
  });

  it('rates low when no bots exist', () => {
    const result = scoreAutomationDuplicateRisk({ target: 'example.com', botRepos: [] });
    assert.equal(result.risk, 'low');
    assert.equal(result.matchedRepos.length, 0);
  });

  it('handles missing input gracefully', () => {
    const result = scoreAutomationDuplicateRisk();
    assert.equal(result.risk, 'low');
  });
});

describe('automationClaimGuidance', () => {
  it('high risk → only novel vectors', () => {
    const g = automationClaimGuidance('high');
    assert.match(g, /Do NOT report generic automation/i);
    assert.match(g, /race conditions/i);
  });

  it('medium risk → novel technique required', () => {
    const g = automationClaimGuidance('medium');
    assert.match(g, /novel technique/i);
  });

  it('low risk → automation viable', () => {
    const g = automationClaimGuidance('low');
    assert.match(g, /viable/i);
  });
});
