// Brain-mode dispatch scope + claim-recording tests (#367).
// DATA_DIR points at a temp dir before import (brain-files writes
// land there, never in live hunts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-mode-367-'));
process.env.DATA_DIR = tmpRoot;

const { executeBrainAction } = await import('./brainMode.js');

const TARGET = 'https://target.example';
let seq = 0;

function setup({ currentUrl = null, guiSnapshot = true } = {}) {
  const events = [];
  const execCalls = [];
  const clickCalls = [];
  const gui = {
    open: async (h, url) => ({ ok: true, observation: `Opened ${url}` }),
    click: async (h, text) => { clickCalls.push(text); return { ok: true, observation: `Clicked "${text}"` }; },
    type: async (h, field, text) => { clickCalls.push(`${field}=${text}`); return { ok: true, observation: `Typed "${text}"` }; },
  };
  if (guiSnapshot) gui.snapshot = async () => ({ ok: true, snapshot: { url: currentUrl } });
  const deps = {
    readMeta: () => ({ target: TARGET, brainMode: 'parent', parsedScope: null }),
    writeMeta: () => {},
    record: (h, e) => { events.push(e); },
    recordNote: () => {},
    readEvents: () => events,
    readReasoning: () => [],
    exec: async (h, t, cmd) => { execCalls.push(cmd); return { stdout: 'ok', stderr: '', code: 0 }; },
    gui,
    assess: null,
  };
  return { events, execCalls, clickCalls, deps, huntId: `h367_${++seq}` };
}

const claimAction = (over = {}) => ({
  action: 'claim_finding',
  title: 'SQL Injection in login',
  command: 'curl -s https://target.example/login?id=1',
  evidence: 'dumped user rows from the database via UNION select',
  counterevidence: 'normal id=1 returns one row only',
  confidence: 'high',
  ...over,
});

test('shell: out-of-scope URL past the 4000-char cap is still blocked', async () => {
  const s = setup();
  const cmd = 'curl ' + 'a'.repeat(4000) + ' https://evil.example/steal';
  assert.ok(cmd.length > 4000, 'URL sits past the old truncation point');
  const res = await executeBrainAction(s.huntId, { action: 'shell', command: cmd }, s.deps);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'out_of_scope');
  assert.equal(s.execCalls.length, 0, 'nothing was executed');
  assert.ok(s.events.some((e) => e.type === 'scope_block' && e.tool === 'shell'));
});

test('shell: over-long in-scope command is refused, not silently truncated', async () => {
  const s = setup();
  const res = await executeBrainAction(s.huntId, { action: 'shell', command: 'echo ' + 'x'.repeat(5000) }, s.deps);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'command_too_long');
  assert.equal(s.execCalls.length, 0);
});

test('shell: normal in-scope command still executes in full', async () => {
  const s = setup();
  const res = await executeBrainAction(s.huntId, { action: 'shell', command: 'curl -s https://target.example/page' }, s.deps);
  assert.equal(res.ok, true);
  assert.equal(s.execCalls.length, 1);
  assert.equal(s.execCalls[0], 'curl -s https://target.example/page');
});

test('browser_click: off-target current page is blocked before clicking', async () => {
  const s = setup({ currentUrl: 'https://evil.example/page' });
  const res = await executeBrainAction(s.huntId, { action: 'browser_click', text: 'Sign in' }, s.deps);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'out_of_scope');
  assert.equal(s.clickCalls.length, 0, 'nothing was clicked');
  assert.ok(s.events.some((e) => e.type === 'scope_block' && e.tool === 'browser_click'));
});

test('browser_click: on-target current page clicks', async () => {
  const s = setup({ currentUrl: 'https://target.example/login' });
  const res = await executeBrainAction(s.huntId, { action: 'browser_click', text: 'Sign in' }, s.deps);
  assert.equal(res.ok, true);
  assert.equal(s.clickCalls.length, 1);
});

test('browser_click: gui without snapshot still clicks (CDP backstop applies)', async () => {
  const s = setup({ guiSnapshot: false });
  const res = await executeBrainAction(s.huntId, { action: 'browser_click', text: 'Sign in' }, s.deps);
  assert.equal(res.ok, true);
  assert.equal(s.clickCalls.length, 1);
});

test('claim without assessor: recorded severity/class reflect the claim', async () => {
  const s = setup();
  const res = await executeBrainAction(s.huntId, claimAction({ severity: 'critical', class: 'sqli' }), s.deps);
  assert.equal(res.ok, true);
  const finding = s.events.find((e) => e.type === 'finding');
  assert.ok(finding, 'a finding event was recorded');
  assert.equal(finding.severity, 'critical');
  assert.equal(finding.class, 'sqli');
  assert.equal(finding.verified, false);
});

test('claim without assessor: title-matched class is recorded, not agent_finding', async () => {
  const s = setup();
  const res = await executeBrainAction(s.huntId, claimAction({}), s.deps);
  assert.equal(res.ok, true);
  const finding = s.events.find((e) => e.type === 'finding');
  assert.equal(finding.class, 'sqli', 'title "SQL Injection in login" resolves to sqli');
  assert.equal(finding.severity, 'medium', 'no severity reported: medium fallback stands');
});

test('claim without assessor: truly classless claim still bounces at the gate (no fake class recorded)', async () => {
  const s = setup();
  const res = await executeBrainAction(s.huntId, claimAction({ title: 'Something utterly unclassifiable zzz', severity: 'nuclear' }), s.deps);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'claim_incomplete');
  assert.ok(res.missing.includes('class'));
  assert.equal(s.events.filter((e) => e.type === 'finding').length, 0, 'nothing was recorded');
  // Note: the agent_finding fallback in the record path is defensive
  // only — the gate above means a claim that reaches recording always
  // carries an explicit or title-matched class. The reachable fallback
  // is severity: an invalid/missing severity still records medium.
});
