// Keyword-Index Memory (27 Oct 2026, owner order) — structured
// reply: the task block beside the action.
//
// Asserted here (pure parser):
//   - parseHumanAction returns the task block with the action.
//   - nested {"task": {...}} form and sibling-fields form both work.
//   - status defaults to in_progress; "complete" is kept.
//   - a malformed block (no usable field) yields task null and never
//     breaks the action.
//   - no task block at all → task null, action parses as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHumanAction, extractTaskBlock } from './humanLoop.js';

test('parseHumanAction returns the nested task block with the action', () => {
  const reply = 'I will open the login page.\n{"action":"browser_open","url":"https://x.com/login","task":{"task":"Probe the login form for SQLi","goal":"Find whether the login query is injectable","progress":"login page open, first probe pending","status":"in_progress"}}';
  const parsed = parseHumanAction(reply);
  assert.equal(parsed.action.action, 'browser_open');
  assert.deepEqual(parsed.task, {
    task: 'Probe the login form for SQLi',
    goal: 'Find whether the login query is injectable',
    progress: 'login page open, first probe pending',
    status: 'in_progress',
  });
});

test('parseHumanAction keeps a complete task block with its summary', () => {
  const reply = '{"action":"search","query":"x","task":{"task":"Map the login surface","goal":"Know every input on the login page","progress":"3 inputs found","status":"complete","summary":"login takes email + password, no CSRF token seen"}}';
  const parsed = parseHumanAction(reply);
  assert.equal(parsed.task.status, 'complete');
  assert.equal(parsed.task.summary, 'login takes email + password, no CSRF token seen');
});

test('parseHumanAction accepts the task as a plain string', () => {
  const parsed = parseHumanAction('{"action":"search","query":"x","task":"Probe the login form"}');
  assert.deepEqual(parsed.task, { task: 'Probe the login form', status: 'in_progress' });
});

test('parseHumanAction accepts sibling fields when there is no nested task object', () => {
  const parsed = parseHumanAction('{"action":"search","query":"x","goal":"Find the admin panel","progress":"halfway","status":"in_progress"}');
  assert.equal(parsed.task.goal, 'Find the admin panel');
  assert.equal(parsed.task.progress, 'halfway');
  assert.equal(parsed.task.status, 'in_progress');
});

test('parseHumanAction yields task null when no block is sent', () => {
  const parsed = parseHumanAction('{"action":"search","query":"x"}');
  assert.equal(parsed.action.action, 'search');
  assert.equal(parsed.task, null);
});

test('extractTaskBlock ignores an unusable block and an invalid status', () => {
  assert.equal(extractTaskBlock({ action: 'search', task: {} }), null);
  assert.equal(extractTaskBlock({ action: 'search', task: 42 }), null);
  assert.equal(extractTaskBlock(null), null);
  const done = extractTaskBlock({ task: { task: 'Map it', status: 'done' } });
  assert.equal(done.status, 'in_progress');
  assert.equal(done.task, 'Map it');
});

test('extractTaskBlock clips over-long fields to 300 chars', () => {
  const long = 'x'.repeat(500);
  const out = extractTaskBlock({ task: { task: long, goal: long } });
  assert.equal(out.task.length, 300);
  assert.equal(out.goal.length, 300);
});
