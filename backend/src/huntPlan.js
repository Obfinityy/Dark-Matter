// Dark Matter — SELF-PLANNING (HUNTER-MIND lane, 26 Oct 2026).
//
// The owner's order (Devanagari, 26 Oct 2026): assume the agent IS a
// human AI — it has memory, it has a full computer (Kali is its
// device) — and make it infinity level so it KNOWS it is a bug bounty
// agent. Like it thinks "I will open BurpSuite" — it opens it itself,
// it makes its OWN instructions: "I will open BurpSuite, I will do
// this scan, I will extract this data" — then the data is saved into
// its own file, its memory remains. "Yes — this work is done, next
// time this work will not happen again."
//
// This module is the PLAN side, deterministically. The brain writes
// its own plan — its own steps, its own order, its own words — into
// the hunt's record (huntPlan.json, the pageState/coverage-ledger
// idiom: atomic tmp+rename write, tolerant read). The loop renders
// the plan on every screen and executes it step by step; a step is
// done only when the brain marks it done with its evidence, and a
// done step NEVER comes back as todo — the record is never rewritten
// as undone by a revised list. The loop never invents steps, never
// picks the next step, never chooses an action: the plan is the
// brain's own instructions, the loop is only the paper it is written
// on. What the loop DOES decide, in code: when there is no plan yet
// (turn 1), and when the hunter is stuck (its last 3 turns all ended
// in a gate block), the screen says so and asks the brain to write
// or revise its plan.

import fs from 'node:fs';
import path from 'node:path';

import { huntDir, ensureHuntDir } from './store.js';

export const HUNT_PLAN_VERSION = 1;
export const MAX_PLAN_STEPS = 12; // a hunter's plan is short; a list longer than this is a wishlist
export const MAX_STEP_TEXT = 200; // chars per step — one instruction, not a paragraph
export const PLAN_STUCK_TURNS = 3; // consecutive blocked turns before the screen calls the hunter stuck

export const PLAN_STATUSES = ['todo', 'doing', 'done', 'skipped'];

function normStepText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_STEP_TEXT);
}

function cleanStepText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_STEP_TEXT);
}

/** Empty plan record. */
export function emptyHuntPlan(target = '') {
  return {
    version: HUNT_PLAN_VERSION,
    target: String(target || ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [],
    revised: 0,
  };
}

function huntPlanFile(huntId) {
  return path.join(huntDir(String(huntId)), 'huntPlan.json');
}

export function loadHuntPlan(huntId) {
  try {
    const raw = fs.readFileSync(huntPlanFile(huntId), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.steps)) return emptyHuntPlan();
    return { ...emptyHuntPlan(), ...data, steps: data.steps.filter(Boolean) };
  } catch {
    return emptyHuntPlan();
  }
}

export function saveHuntPlan(huntId, plan) {
  try {
    ensureHuntDir(huntId);
    const file = huntPlanFile(huntId);
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(plan));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

function nextStepId(plan) {
  let n = 1;
  const used = new Set((plan.steps || []).map((s) => s.id));
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}

/**
 * Replace the plan's open steps with the brain's new list (its own
 * words, its own order). Done/skipped steps are PRESERVED by
 * normalised text — a revised list can never resurrect completed
 * work as todo. New steps start as todo. Pure — returns a fresh
 * plan (the caller saves it).
 */
export function setPlanSteps(prev, steps, { at = new Date().toISOString() } = {}) {
  const plan = prev && typeof prev === 'object' && Array.isArray(prev.steps)
    ? JSON.parse(JSON.stringify(prev))
    : emptyHuntPlan(prev && prev.target);
  const kept = new Map(); // normalised text -> finished step (done/skipped)
  for (const s of plan.steps || []) {
    if (!s || (s.status !== 'done' && s.status !== 'skipped')) continue;
    kept.set(normStepText(s.text), s);
  }
  const clean = (Array.isArray(steps) ? steps : [])
    .map((s) => cleanStepText(s))
    .filter(Boolean)
    .slice(0, MAX_PLAN_STEPS);
  const seen = new Set();
  const next = [];
  for (const text of clean) {
    const key = normStepText(text);
    if (seen.has(key)) continue; // one step per instruction — duplicates collapse
    seen.add(key);
    const done = kept.get(key);
    if (done) {
      next.push({ ...done });
      continue;
    }
    next.push({ id: nextStepId({ steps: [...(plan.steps || []), ...next] }), text, status: 'todo', doneAt: '', evidence: '' });
  }
  plan.steps = next;
  plan.updatedAt = at;
  plan.revised = (plan.revised || 0) + 1;
  return plan;
}

/** Resolve a step reference: 1-based position, or its id. Pure. */
export function findPlanStep(plan, ref) {
  const steps = (plan && Array.isArray(plan.steps) ? plan.steps : []);
  if (ref == null || ref === '') return null;
  if (typeof ref === 'number' || /^\d+$/.test(String(ref).trim())) {
    const idx = Number(ref) - 1;
    return steps[idx] || null;
  }
  const id = String(ref).trim();
  return steps.find((s) => s && s.id === id) || null;
}

/**
 * Mark one step done/skipped with its evidence (what output proves
 * it — a filename, a result line, a command). A done step stays
 * done; marking it again only refreshes the evidence. Pure —
 * returns a fresh plan (the caller saves it).
 */
export function markPlanStep(prev, ref, status, evidence = '', { at = new Date().toISOString() } = {}) {
  const plan = prev && typeof prev === 'object' && Array.isArray(prev.steps)
    ? JSON.parse(JSON.stringify(prev))
    : emptyHuntPlan(prev && prev.target);
  if (status !== 'done' && status !== 'skipped') return { plan, step: null };
  const step = findPlanStep(plan, ref);
  if (!step) return { plan, step: null };
  step.status = status;
  step.doneAt = at;
  if (String(evidence || '').trim()) step.evidence = String(evidence).slice(0, 300);
  plan.updatedAt = at;
  return { plan, step };
}

/** The first open step (todo first, then doing) — the plan's next move. Pure. */
export function nextPlanStep(plan) {
  const steps = (plan && Array.isArray(plan.steps) ? plan.steps : []);
  return steps.find((s) => s && s.status === 'todo')
    || steps.find((s) => s && s.status === 'doing')
    || null;
}

/** True when the plan has at least one step the brain wrote itself. Pure. */
export function hasPlan(plan) {
  return Boolean(plan && Array.isArray(plan.steps) && plan.steps.length > 0);
}

/**
 * Stuck, judged from the session's own log: the last
 * PLAN_STUCK_TURNS entries all ended in a gate block (the
 * observation starts BLOCKED or PAUSED) with no executed action
 * between them. Pure over the loop's log entries ({ observation }).
 * A hunter that keeps hitting the same wall is told to revise its
 * plan — the screen names the stuck state, never a new action.
 */
export function planStuck(logEntries) {
  const log = (logEntries || []).slice(-PLAN_STUCK_TURNS);
  if (log.length < PLAN_STUCK_TURNS) return false;
  return log.every((l) => {
    const obs = String((l && l.observation) || '').trim();
    return obs.startsWith('BLOCKED') || obs.startsWith('PAUSED');
  });
}

function stepMark(s) {
  if (!s) return '[ ]';
  if (s.status === 'done') return '[x]';
  if (s.status === 'skipped') return '[-]';
  if (s.status === 'doing') return '[>]';
  return '[ ]';
}

/**
 * The plan block for the screen's never-trimmed continuity region.
 * With a plan: the brain's own steps with done/todo marks, the
 * next step named, and the saved-output count (the recall ledger)
 * beside it — the record of what is done and what is next, in the
 * brain's own words. Without a plan: the write-your-plan
 * instruction (the brain's first move is to write its own plan,
 * never a probe) — no template steps are ever offered, because a
 * plan the loop wrote would be the loop choosing the hunt.
 * Empty when there is nothing to show is impossible here: a hunt
 * with no plan always shows the instruction, so the brain is never
 * left without its first move.
 */
export function huntPlanLines(plan, { stuck = false, outputsSaved = 0 } = {}) {
  if (!hasPlan(plan)) {
    return [
      '=== YOUR HUNT PLAN — YOU HAVE NONE YET ===',
      // HUNTER-MIND live finding (26 Oct 2026, lab): the first
      // version said "Before your first probe, write YOUR OWN plan"
      // — but the brain probes first and plans from what it finds,
      // like a real hunter, so that instruction went stale the
      // moment the first probe ran and the brain kept acting
      // directly (4 turns, no plan). The instruction now meets the
      // brain where it is: the plan starts from what the probes
      // already found. It still never names a tool or an order.
      'Write YOUR OWN plan — now, from what you already know about this target (your briefing, your leads, what your probes already found, what is still unprobed): your own steps, your own order, in your own words — what will you do first, in what order, and how will you know each step is done? If you already probed without a plan, the plan starts from what those probes found. The steps are yours to choose, nobody hands them to you.',
      'Send {"action":"hunt_plan","steps":["first step in your words","next step","..."]} — up to 12 steps, one instruction each. The plan is yours: the loop executes it step by step and checks steps off from the record. A step is done only when its output is saved in your record — never mark a step done you did not do.',
      'Mark a step done with {"action":"hunt_plan","done":2,"evidence":"the output that proves it, e.g. the saved file or result line"} (step number, or its id), or skip one with {"action":"hunt_plan","skip":2,"evidence":"why it does not apply"}. Revise the list any time by sending hunt_plan with a new "steps" list — finished steps stay finished.',
    ];
  }
  const steps = plan.steps || [];
  const done = steps.filter((s) => s.status === 'done').length;
  const lines = [
    '=== YOUR HUNT PLAN (your own instructions — you wrote these) ===',
    ...steps.map((s, i) => {
      const ev = s.status === 'done' && s.evidence ? ` — ${String(s.evidence).slice(0, 100)}` : '';
      const when = s.status === 'done' && s.doneAt ? '' : '';
      return `${i + 1}. ${stepMark(s)} ${s.text}${ev}${when}`;
    }),
    `- ${done}/${steps.length} steps done${outputsSaved > 0 ? ` · ${outputsSaved} output(s) saved in your record — the loop answers repeats from those, never re-runs them` : ''}`,
  ];
  const next = nextPlanStep(plan);
  if (next) {
    const idx = steps.indexOf(next) + 1;
    lines.push(`- NEXT: step ${idx} — "${next.text}". Work it now, or mark it done/skipped with its evidence when its output is in your record.`);
  } else {
    lines.push('- All steps are done or skipped — write the next phase of your plan with hunt_plan, or keep hunting from your leads.');
  }
  if (stuck) {
    lines.push('STUCK — your last 3 turns all ended blocked, with nothing executed. Do not repeat the blocked move: revise your plan with hunt_plan — drop the blocked step, pick a different route (a different surface, a different tool, the desktop), and say why in the step text.');
  }
  return lines;
}
