// HUNTER-MIND lane (26 Oct 2026): the brain writes its own plan.
//
//   HM-1  a revised steps list never resurrects a done step as todo
//   HM-2  mark done/skipped by number or id, with evidence; done stays done
//   HM-3  the screen shows the plan with marks + next step; without a
//         plan it shows the write-your-plan instruction, never a template
//   HM-4  stuck is the last 3 turns all blocked, and the screen says so
//   HM-5  save/load round-trip; a corrupt plan file degrades to empty
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE the store is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-hunterplan-'));
process.env.DATA_DIR = tmpRoot;

const {
  emptyHuntPlan,
  loadHuntPlan,
  saveHuntPlan,
  setPlanSteps,
  findPlanStep,
  markPlanStep,
  nextPlanStep,
  hasPlan,
  planStuck,
  huntPlanLines,
} = await import('./huntPlan.js');

const HUNT = 'h_plan_test';

// HM-1: a revised list never resurrects a done step as todo.
test('HM-1: a done step stays done when the brain revises its plan', () => {
  let plan = emptyHuntPlan('https://example.test');
  plan = setPlanSteps(plan, ['run nmap on the target', 'enumerate subdomains', 'open BurpSuite']);
  assert.equal(plan.steps.length, 3);
  ({ plan } = markPlanStep(plan, 1, 'done', 'nmap output saved as output-1.log'));
  assert.equal(plan.steps[0].status, 'done');
  // The brain revises: same first step (new wording, same meaning), a new third step.
  plan = setPlanSteps(plan, ['run nmap on the target', 'enumerate subdomains', 'probe the login form']);
  assert.equal(plan.steps.length, 3);
  assert.equal(plan.steps[0].status, 'done', 'a finished step must never come back as todo');
  assert.equal(plan.steps[0].evidence, 'nmap output saved as output-1.log');
  assert.equal(plan.steps[2].text, 'probe the login form');
  assert.equal(plan.steps[2].status, 'todo');
});

// HM-2: mark by number or id, with evidence; done stays done.
test('HM-2: steps are marked done/skipped by number or id', () => {
  let plan = emptyHuntPlan();
  plan = setPlanSteps(plan, ['recon the target', 'run nmap', 'check the API docs']);
  let out = markPlanStep(plan, 's2', 'done', 'nmap -sV output saved');
  assert.equal(out.step.text, 'run nmap');
  assert.equal(out.step.status, 'done');
  plan = out.plan;
  out = markPlanStep(plan, 3, 'skipped', 'no API docs exist for this target');
  assert.equal(out.step.status, 'skipped');
  plan = out.plan;
  // Marking the same step done again only refreshes the evidence.
  out = markPlanStep(plan, 2, 'done', 'nmap output, second pass');
  assert.equal(out.step.status, 'done');
  assert.equal(out.step.evidence, 'nmap output, second pass');
  // An unknown reference marks nothing.
  out = markPlanStep(plan, 99, 'done', 'x');
  assert.equal(out.step, null);
  assert.equal(findPlanStep(plan, 's9'), null);
  assert.equal(nextPlanStep(plan).text, 'recon the target');
});

// HM-3: the screen shows the plan; without one it instructs, never templates.
test('HM-3: plan lines carry marks + next step; no plan means write-your-plan', () => {
  const empty = huntPlanLines(emptyHuntPlan());
  assert.ok(empty.join('\n').includes('YOU HAVE NONE YET'));
  assert.ok(empty.join('\n').includes('hunt_plan'));
  // No template steps are ever offered: the instruction names no tool, no order.
  assert.ok(!empty.join('\n').includes('nmap'), 'the loop must never write the plan for the brain');
  // The instruction meets the brain where it is: a hunter that
  // already probed plans FROM what the probes found (lab 26 Oct:
  // "before your first probe" went stale after the first probe).
  assert.ok(empty.join('\n').includes('what your probes already found'));
  let plan = emptyHuntPlan();
  plan = setPlanSteps(plan, ['run nmap', 'enumerate subdomains']);
  ({ plan } = markPlanStep(plan, 1, 'done', 'nmap saved'));
  const lines = huntPlanLines(plan, { outputsSaved: 2 });
  const text = lines.join('\n');
  assert.ok(text.includes('[x] run nmap'));
  assert.ok(text.includes('[ ] enumerate subdomains'));
  assert.ok(text.includes('1/2 steps done'));
  assert.ok(text.includes('2 output(s) saved'));
  assert.ok(text.includes('NEXT: step 2'));
  assert.ok(!text.includes('STUCK'));
  const stuckLines = huntPlanLines(plan, { stuck: true });
  assert.ok(stuckLines.join('\n').includes('STUCK'));
});

// HM-4: stuck is the last 3 turns all blocked.
test('HM-4: stuck needs 3 consecutive blocked turns', () => {
  const blocked = (obs) => ({ turn: 1, action: 'search', detail: 'x', observation: obs });
  assert.equal(planStuck([]), false);
  assert.equal(planStuck([blocked('BLOCKED — ALREADY DONE: x'), blocked('BLOCKED — ALREADY SEARCHED: y')]), false);
  assert.equal(planStuck([
    blocked('BLOCKED — ALREADY DONE: x'),
    blocked('BLOCKED — ALREADY SEARCHED: y'),
    blocked('PAUSED — THE OWNER IS CONTROLLING THE MACHINE'),
  ]), true);
  assert.equal(planStuck([
    blocked('BLOCKED — ALREADY DONE: x'),
    { turn: 2, action: 'shell', detail: 'nmap', observation: 'open ports: 80, 443' },
    blocked('BLOCKED — ALREADY DONE: y'),
  ]), false, 'one executed action between blocks means not stuck');
});

// HM-5: save/load round-trip; corrupt file degrades to empty.
test('HM-5: plan persists per hunt; corrupt file degrades to empty', () => {
  let plan = emptyHuntPlan('https://example.test');
  plan = setPlanSteps(plan, ['run nmap', 'open BurpSuite']);
  assert.equal(saveHuntPlan(HUNT, plan), true);
  const loaded = loadHuntPlan(HUNT);
  assert.equal(loaded.steps.length, 2);
  assert.equal(loaded.steps[1].text, 'open BurpSuite');
  assert.equal(loaded.target, 'https://example.test');
  // A missing hunt has no plan; a corrupt file degrades to empty, never throws.
  assert.equal(hasPlan(loadHuntPlan('h_no_such_hunt')), false);
  fs.writeFileSync(path.join(tmpRoot, 'hunts', HUNT, 'huntPlan.json'), '{not json');
  assert.equal(hasPlan(loadHuntPlan(HUNT)), false);
});
