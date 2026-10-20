// Test for Job 6 stage 6 — code-owned plan tree.
// Run: node backend/scripts/test-plan-tree.mjs
//
// Proves: (1) seeding creates goal + phases exactly once, (2) a verified
// outcome closes its leaf, (3) two failures park a leaf and two parked
// leaves in one phase fire the counter-based RE-PLAN trigger, (4) when
// every leaf of the active phase resolves, the phase closes and the next
// activates, (5) the rendered checklist carries the marks and the
// trigger, within budget.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-plantree-'));
process.env.DATA_DIR = tmp;

const pt = await import('../src/planTree.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const H = 'h_plan_test';
check('plan tree enabled on this runtime', pt.planTreeEnabled());
const goalId = pt.ensurePlanTree(H, { target: 'http://172.17.0.1:3000', phases: ['Recon', 'Auth', 'Files'] });
check('seeds a goal', !!goalId);
check('seeds 3 phases', pt.getPhases(H).length === 3);
const again = pt.ensurePlanTree(H, { target: 'http://172.17.0.1:3000', phases: ['Recon', 'Auth', 'Files'] });
check('seeding is idempotent', again === goalId && pt.getPhases(H).length === 3);

// Outcomes: verified closes; dedupe by normalised text.
pt.recordPlanOutcome(H, 'Map open ports', 'verified');
pt.recordPlanOutcome(H, 'map   open ports', 'verified');
let leaves = pt.getLeaves(H);
check('same plan text dedupes to one leaf', leaves.length === 1);
check('verified outcome closes the leaf', leaves[0].status === 'done');

// Phase advancement: the only leaf of phase 1 resolved -> phase 1 done, phase 2 active.
let phases = pt.getPhases(H);
check('phase 1 closed and phase 2 activated', phases[0].status === 'done' && phases[1].status === 'active');

// Failures: park at 2, trigger at 2 parked leaves in the active phase.
pt.recordPlanOutcome(H, 'SQLi timing probe', 'rejected');
let sqlLeaf = pt.getLeaves(H).find((l) => /timing/.test(l.text));
check('first failure keeps the leaf active with fail_count 1', sqlLeaf.status === 'active' && sqlLeaf.fail_count === 1);
pt.recordPlanOutcome(H, 'SQLi timing probe', 'no-assessment');
sqlLeaf = pt.getLeaves(H).find((l) => /timing/.test(l.text));
check('second failure parks the leaf', sqlLeaf.status === 'failed' && sqlLeaf.fail_count === 2);
pt.recordPlanOutcome(H, 'NoSQL operator probe', 'rejected');
pt.recordPlanOutcome(H, 'NoSQL operator probe', 'rejected');
const triggers = pt.getReplanTriggers(H);
check('two parked leaves fire the RE-PLAN trigger for the phase', triggers.some((t) => t.phase === 'Auth' && /NEW angle/.test(t.reason)));

// Rendering.
const text = pt.renderPlanTree(H);
check('checklist renders the goal', /GOAL: Hunt http:\/\/172\.17\.0\.1:3000/.test(text));
check('checklist marks done + parked leaves', /\[x\] Map open ports — VERIFIED/.test(text) && /\[!\] SQLi timing probe — failed ×2 \(parked\)/.test(text));
check('checklist carries the RE-PLAN line', /⚠ RE-PLAN \(Auth\)/.test(text));
check('rendering respects the budget', text.length <= 1800 + 200);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
