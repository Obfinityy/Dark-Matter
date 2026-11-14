// Self (Hunter Self) mode — series runner + the AI gate.
//
// Executes checks in sheet order (Recon -> A16). Predefined (rule-based)
// legs run first; on reaching the first AI-tagged check the run stops
// and transitions to 'awaiting-ai-consent' with NO AI call.
//
// THE AI GATE (server-side, must be real — standing $0 Meta spend order):
//   phase: 'predefined' | 'awaiting-ai-consent' | 'ai' | 'done'
//   aiConsent: null | true | false
//   - No code path may run an AI-kind check while aiConsent !== true.
//     runSingleCheck / runCategory / runAll all enforce this before
//     any tool or AI execution, and AI checks are never passed to
//     runCheck (which itself only runs predefined tools).
//   - POST ai-consent {consent:false} marks AI checks skipped and
//     completes the run.
//   - POST ai-consent {consent:true} resumes AI legs through an
//     injected `aiExecutor`. THIS BUILD SHIPS NO aiExecutor: there is
//     no brain call anywhere in backend/src/self/ (grep-verifiable),
//     so a consented AI leg is recorded 'blocked' with the reason
//     'ai-executor-not-configured' — honestly, never faked, never
//     auto-approved. Wiring a real executor is a separate, owner-
//     approved step; it must still go through applyAiConsent.
//   - The gate is enforced in this module, not the frontend: a client
//     cannot run an AI leg by calling the single-check endpoint, because
//     runSingleCheck checks aiConsent too.

import crypto from 'node:crypto';
import { CHECKS, CATEGORIES, getCheck, getCategoryChecks } from './checklist.js';
import { runCheck } from './toolRunner.js';

export const AI_EXECUTOR_NOT_CONFIGURED = 'ai-executor-not-configured';
export const AI_GATE_REASON =
  '(ai-executor-not-configured) AI leg blocked by the consent gate: no AI executor is configured in this build, so no brain call was made (standing $0 Meta spend order).';

export function newRunId() {
  return `self_${crypto.randomBytes(8).toString('hex')}`;
}

export function createRun({ target, userId, username }) {
  const now = new Date().toISOString();
  const checks = {};
  for (const check of CHECKS) {
    checks[check.id] = { checkId: check.id, category: check.category, kind: check.kind, status: 'pending', verdict: null, summary: null, counts: null, findings: [], tools: [], startedAt: null, finishedAt: null, durationMs: null };
  }
  return {
    id: newRunId(),
    target,
    userId: userId || null,
    username: username || null,
    phase: 'predefined',
    aiConsent: null,
    checks,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
    stoppedAtAiBoundary: false,
    aiBoundaryCheckId: null,
  };
}

export function runProgress(run) {
  const all = Object.values(run.checks);
  const byStatus = {};
  for (const c of all) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  const perCategory = {};
  for (const cat of CATEGORIES) {
    const list = all.filter((c) => c.category === cat.code);
    perCategory[cat.code] = {
      total: list.length,
      done: list.filter((c) => ['done', 'partial'].includes(c.status)).length,
      skipped: list.filter((c) => c.status === 'skipped').length,
      blocked: list.filter((c) => c.status === 'blocked').length,
      pending: list.filter((c) => c.status === 'pending').length,
    };
  }
  return {
    total: all.length,
    done: byStatus.done || 0,
    partial: byStatus.partial || 0,
    blocked: byStatus.blocked || 0,
    skipped: byStatus.skipped || 0,
    pending: byStatus.pending || 0,
    yes: all.filter((c) => c.verdict === 'yes').length,
    no: all.filter((c) => c.verdict === 'no').length,
    perCategory,
  };
}

function touch(run) {
  run.updatedAt = new Date().toISOString();
  return run;
}

function storeCheckResult(run, result) {
  run.checks[result.checkId] = {
    ...run.checks[result.checkId],
    ...result,
  };
  return run;
}

// --- Single check ----------------------------------------------------------
// Gate: an AI check with aiConsent !== true is NEVER executed. The caller
// gets { gated: true } and the check stays 'pending' — no tool runs,
// no brain call, nothing recorded as a result.

export async function runSingleCheck(run, checkId, { execFn } = {}) {
  const check = getCheck(checkId);
  if (!check) return { ok: false, error: 'unknown_check', gated: false };
  if (check.kind === 'ai' && run.aiConsent !== true) {
    return { ok: false, error: 'ai_gate', gated: true, reason: 'AI leg requires explicit consent (POST ai-consent {consent:true}) — no AI call was made.' };
  }
  const result = await runCheck(check, run.target, { execFn });
  storeCheckResult(run, result);
  touch(run);
  return { ok: true, result };
}

// --- Category / full series -------------------------------------------------

function isAiBoundary(run, check) {
  return check.kind === 'ai' && run.aiConsent !== true;
}

function hitAiBoundary(run, check) {
  run.phase = 'awaiting-ai-consent';
  run.stoppedAtAiBoundary = true;
  run.aiBoundaryCheckId = check.id;
  touch(run);
  return { stoppedAtAiBoundary: true, boundaryCheckId: check.id };
}

export async function runCategory(run, categoryCode, { execFn, onCheck } = {}) {
  const checks = getCategoryChecks(categoryCode);
  if (!checks.length) return { ok: false, error: 'unknown_category' };
  if (!run.startedAt) run.startedAt = new Date().toISOString();
  for (const check of checks) {
    const state = run.checks[check.id];
    if (state && state.status !== 'pending') continue; // resume-safe: never re-run a finished check
    if (isAiBoundary(run, check)) return hitAiBoundary(run, check);
    const result = await runCheck(check, run.target, { execFn });
    storeCheckResult(run, result);
    touch(run);
    if (onCheck) onCheck(result);
  }
  touch(run);
  return { ok: true, stoppedAtAiBoundary: false };
}

export async function runAll(run, { execFn, onCheck } = {}) {
  if (!run.startedAt) run.startedAt = new Date().toISOString();
  for (const cat of CATEGORIES) {
    const res = await runCategory(run, cat.code, { execFn, onCheck });
    if (!res.ok) return res;
    if (res.stoppedAtAiBoundary) return { ok: true, stoppedAtAiBoundary: true, boundaryCheckId: res.boundaryCheckId };
  }
  run.phase = 'done';
  run.finishedAt = new Date().toISOString();
  touch(run);
  return { ok: true, stoppedAtAiBoundary: false };
}

// --- AI consent ------------------------------------------------------------
// consent:false -> AI checks skipped, run completes.
// consent:true  -> AI legs resume through aiExecutor (if any). With no
// executor configured, AI checks are recorded 'blocked' with the
// not-configured reason — the run still completes, and NO brain call
// is made. Either way the run only leaves 'awaiting-ai-consent' via
// this function, never automatically.

export async function applyAiConsent(run, consent, { aiExecutor = null, onCheck } = {}) {
  if (run.aiConsent !== null && run.phase === 'done') {
    return { ok: false, error: 'already_decided', message: 'AI consent was already recorded for this run.' };
  }
  if (consent === false) {
    run.aiConsent = false;
    for (const check of CHECKS) {
      if (check.kind !== 'ai') continue;
      const state = run.checks[check.id];
      if (state.status === 'pending') {
        run.checks[check.id] = {
          ...state, status: 'skipped', verdict: null,
          summary: 'Skipped: AI consent declined by the user. No AI call was made.',
          finishedAt: new Date().toISOString(),
        };
      }
    }
    run.phase = 'done';
    run.stoppedAtAiBoundary = false;
    run.finishedAt = new Date().toISOString();
    touch(run);
    return { ok: true, phase: 'done', skippedAi: CHECKS.filter((c) => c.kind === 'ai').length };
  }
  if (consent === true) {
    run.aiConsent = true;
    run.phase = 'ai';
    run.stoppedAtAiBoundary = false;
    touch(run);
    let ran = 0;
    let blocked = 0;
    for (const check of CHECKS) {
      if (check.kind !== 'ai') continue;
      const state = run.checks[check.id];
      if (state.status !== 'pending') continue;
      if (typeof aiExecutor === 'function') {
        const result = await aiExecutor(check, run);
        if (result && result.checkId) storeCheckResult(run, result);
        ran += 1;
      } else {
        run.checks[check.id] = {
          ...state, status: 'blocked', verdict: 'unknown',
          summary: AI_GATE_REASON,
          counts: { toolsRun: 0, toolsFailed: 0, toolsBlocked: 0, findings: 0, items: 0 },
          finishedAt: new Date().toISOString(),
        };
        blocked += 1;
      }
      touch(run);
      if (onCheck) onCheck(run.checks[check.id]);
    }
    run.phase = 'done';
    run.finishedAt = new Date().toISOString();
    touch(run);
    return { ok: true, phase: 'done', aiRan: ran, aiBlocked: blocked, aiExecutorConfigured: typeof aiExecutor === 'function' };
  }
  return { ok: false, error: 'invalid_consent', message: 'consent must be true or false' };
}

// Public view of a run for GET responses: run state + checklist Yes/No +
// evidence per check, without internal fields.
export function publicRun(run) {
  return {
    id: run.id,
    target: run.target,
    phase: run.phase,
    aiConsent: run.aiConsent,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    stoppedAtAiBoundary: run.stoppedAtAiBoundary,
    aiBoundaryCheckId: run.aiBoundaryCheckId,
    progress: runProgress(run),
    checks: Object.values(run.checks),
  };
}
