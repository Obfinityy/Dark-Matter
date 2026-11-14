// Self (Hunter Self) mode — HTTP routes.
//
//   POST /api/v1/self/runs {target, confirmedAuthorized:true}
//   GET  /api/v1/self/runs                    -> the user's runs
//   GET  /api/v1/self/runs/:id               -> run state + checklist Yes/No + evidence per check
//   POST /api/v1/self/runs/:id/checks/:checkId/run   -> run one check (synchronous)
//   POST /api/v1/self/runs/:id/run-category {category} -> run one category (background, 202)
//   POST /api/v1/self/runs/:id/run-all               -> whole series (background, 202)
//   POST /api/v1/self/runs/:id/ai-consent {consent:true|false} -> the AI gate
//   GET  /api/v1/self/checklist              -> the 202-check config for the UI
//
// All routes requireAuth. Run creation requires confirmedAuthorized === true
// and the same SSRF check as POST /api/v1/hunts (LAB_TARGETS exception).
// Runs belong to their creator (admin may read any run).
//
// $0 Meta spend: no route calls the AI brain. The AI gate lives in
// seriesRunner.js; these handlers only forward the user's explicit
// consent decision to it.

import { Router } from 'express';
import { requireAuth } from './auth.js';
import { CHECKS, CATEGORIES, getCheck } from '../self/checklist.js';
import { readSelfRun, writeSelfRun, listSelfRuns } from '../self/store.js';
import {
  createRun, runSingleCheck, runCategory, runAll, applyAiConsent, publicRun,
} from '../self/seriesRunner.js';

const runningRuns = new Set();

function requireRunOwner(req, res) {
  const run = readSelfRun(req.params.id);
  if (!run) {
    res.status(404).json({ ok: false, error: 'self_run_not_found' });
    return null;
  }
  if (run.userId && run.userId !== req.user.id && req.user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  if (!run.userId && req.user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  return run;
}

async function validateTargetOrReject(req, res, target) {
  try {
    const { validateTargetAsync } = await import('../scopeParser.js');
    const labTargets = (process.env.LAB_TARGETS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const canonicalHost = (value) => {
      try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^\[|\]$/g, ''); }
      catch { return ''; }
    };
    const targetHost = canonicalHost(target);
    const isLabTarget = !!targetHost && labTargets.some((lab) => canonicalHost(lab) === targetHost);
    if (!isLabTarget) {
      const ssrfCheck = await validateTargetAsync(target);
      if (!ssrfCheck.valid) {
        res.status(403).json({ ok: false, error: 'ssrf_blocked', message: ssrfCheck.reason });
        return false;
      }
    }
    return true;
  } catch (err) {
    res.status(500).json({ ok: false, error: 'validation_error', message: 'Target validation failed. Please try again.' });
    return false;
  }
}

export function createSelfRouter({ execFn, aiExecutor } = {}) {
  const router = Router();

  // GET /api/v1/self/checklist — the 202-check config for the UI.
  router.get('/checklist', requireAuth, (req, res) => {
    res.json({
      ok: true,
      categories: CATEGORIES,
      checks: CHECKS,
      counts: {
        total: CHECKS.length,
        ruleBased: CHECKS.filter((c) => c.kind === 'rule-based').length,
        ai: CHECKS.filter((c) => c.kind === 'ai').length,
      },
    });
  });

  // POST /api/v1/self/runs — create a run for a pasted target URL.
  router.post('/runs', requireAuth, async (req, res) => {
    const { target, confirmedAuthorized } = req.body || {};
    if (typeof target !== 'string' || !target.trim()) {
      return res.status(400).json({ ok: false, error: 'missing_target', message: 'Provide {target} — a URL you are authorized to test.' });
    }
    if (confirmedAuthorized !== true) {
      return res.status(403).json({
        ok: false, error: 'authorization_not_confirmed',
        message: 'Self run creation requires explicit authorization: send {confirmedAuthorized: true} to confirm you own or are permitted to test this target.',
      });
    }
    if (!(await validateTargetOrReject(req, res, target))) return;
    const run = createRun({ target: target.trim(), userId: req.user.id, username: req.user.username });
    writeSelfRun(run);
    return res.status(201).json({ ok: true, run: publicRun(run) });
  });

  // GET /api/v1/self/runs — the user's runs (newest first).
  router.get('/runs', requireAuth, (req, res) => {
    const runs = listSelfRuns()
      .filter((r) => r.userId === req.user.id || req.user.role === 'admin')
      .map((r) => publicRun(r));
    res.json({ ok: true, runs });
  });

  // GET /api/v1/self/runs/:id
  router.get('/runs/:id', requireAuth, (req, res) => {
    const run = requireRunOwner(req, res);
    if (!run) return;
    res.json({ ok: true, run: publicRun(run) });
  });

  // POST /api/v1/self/runs/:id/checks/:checkId/run — one check, synchronous.
  router.post('/runs/:id/checks/:checkId/run', requireAuth, async (req, res) => {
    const run = requireRunOwner(req, res);
    if (!run) return;
    if (runningRuns.has(run.id)) {
      return res.status(409).json({ ok: false, error: 'already_running', message: 'This run is already executing.' });
    }
    const check = getCheck(req.params.checkId);
    if (!check) return res.status(404).json({ ok: false, error: 'unknown_check' });
    runningRuns.add(run.id);
    try {
      const out = await runSingleCheck(run, check.id, { execFn });
      writeSelfRun(run);
      if (out.gated) {
        return res.status(403).json({ ok: false, error: 'ai_gate', message: out.reason, run: publicRun(run) });
      }
      if (!out.ok) return res.status(400).json({ ok: false, error: out.error, run: publicRun(run) });
      return res.json({ ok: true, check: out.result, run: publicRun(run) });
    } finally {
      runningRuns.delete(run.id);
    }
  });

  // POST /api/v1/self/runs/:id/run-category {category} — background.
  router.post('/runs/:id/run-category', requireAuth, async (req, res) => {
    const run = requireRunOwner(req, res);
    if (!run) return;
    const { category } = req.body || {};
    if (!CATEGORIES.some((c) => c.code === category)) {
      return res.status(400).json({ ok: false, error: 'unknown_category', message: `Unknown category "${category}".` });
    }
    if (runningRuns.has(run.id)) {
      return res.status(409).json({ ok: false, error: 'already_running' });
    }
    runningRuns.add(run.id);
    runCategory(run, category, { execFn, onCheck: () => writeSelfRun(run) })
      .catch((err) => console.error('[self] run-category failed:', err && err.message))
      .finally(() => { writeSelfRun(run); runningRuns.delete(run.id); });
    return res.status(202).json({ ok: true, accepted: true, run: publicRun(run) });
  });

  // POST /api/v1/self/runs/:id/run-all — whole series, background.
  router.post('/runs/:id/run-all', requireAuth, async (req, res) => {
    const run = requireRunOwner(req, res);
    if (!run) return;
    if (runningRuns.has(run.id)) {
      return res.status(409).json({ ok: false, error: 'already_running' });
    }
    if (run.phase === 'done') {
      return res.status(409).json({ ok: false, error: 'already_done', message: 'This run is already complete.' });
    }
    runningRuns.add(run.id);
    runAll(run, { execFn, onCheck: () => writeSelfRun(run) })
      .catch((err) => console.error('[self] run-all failed:', err && err.message))
      .finally(() => { writeSelfRun(run); runningRuns.delete(run.id); });
    return res.status(202).json({ ok: true, accepted: true, run: publicRun(run) });
  });

  // POST /api/v1/self/runs/:id/ai-consent {consent:true|false} — the gate.
  router.post('/runs/:id/ai-consent', requireAuth, async (req, res) => {
    const run = requireRunOwner(req, res);
    if (!run) return;
    const { consent } = req.body || {};
    if (consent !== true && consent !== false) {
      return res.status(400).json({ ok: false, error: 'invalid_consent', message: 'Send {consent: true} or {consent: false}.' });
    }
    if (run.phase === 'done' && run.aiConsent !== null) {
      return res.status(409).json({ ok: false, error: 'already_decided', message: 'AI consent was already recorded for this run.' });
    }
    const out = await applyAiConsent(run, consent, { aiExecutor });
    writeSelfRun(run);
    if (!out.ok) return res.status(400).json({ ok: false, error: out.error, message: out.message, run: publicRun(run) });
    return res.json({ ok: true, phase: out.phase, aiConsent: run.aiConsent, skippedAi: out.skippedAi ?? null, aiBlocked: out.aiBlocked ?? null, aiExecutorConfigured: out.aiExecutorConfigured ?? false, run: publicRun(run) });
  });

  return router;
}

export default createSelfRouter();
