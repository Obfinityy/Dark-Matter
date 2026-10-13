// Hunt routes — authorized-targets-only creation, engine proxying, reports.
//
//   POST /api/v1/hunts {target, scope, confirmedAuthorized}
//   GET  /api/v1/hunts                    -> the user's hunts (re-attach after browser close)
//   POST /api/v1/hunts/:id/pause | /resume | /stop
//   GET  /api/v1/hunts/:id               -> engine status (502 if engine down)
//   GET  /api/v1/hunts/:id/report?format=md|pdf  (works any time, even mid-hunt)
//   GET  /api/v1/hunts/:id/analysis?goal=rce    -> infinity analysis (chains, confirmation)
//
// Authorization policy: a hunt is created ONLY when BOTH hold:
//   1. body.confirmedAuthorized === true  (frontend sends this after the user
//      confirms they own / are permitted to test the target), AND
//   2. `target` matches ALLOWED_TARGETS (env, comma-separated). Matching: the
//      target URL's hostname equals an entry or is a subdomain of it, or the
//      target string starts with an entry.
// Otherwise: HTTP 403 and the attempt is logged. No allowlist configured ->
// also 403 (secure default).

import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { config } from '../config.js';
import {
  EngineUnreachableError,
  EngineError,
  createEngineHunt,
  getEngineHunt,
  pauseEngineHunt,
  resumeEngineHunt,
  stopEngineHunt,
} from '../engine.js';
import {
  appendHuntEvent,
  readHuntEvents,
  writeHuntMeta,
  readHuntMeta,
  listHuntMetas,
} from '../store.js';
import { requireAuth } from './auth.js';
import { analyzeFindings, chainsMarkdown } from '../hunt-intel/index.js';

/** Reject unless the hunt belongs to the authenticated user. */
function requireHuntOwner(req, res) {
  const meta = readHuntMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: 'hunt_not_found' });
    return null;
  }
  if (meta.userId && meta.userId !== req.user.id) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  return meta;
}

const router = Router();

function hostOf(target) {
  try {
    const u = new URL(target);
    return u.hostname.toLowerCase();
  } catch {
    return String(target || '').toLowerCase();
  }
}

export function isTargetAllowed(target) {
  const list = config.allowedTargets;
  if (!list.length) return false;
  const t = String(target || '').trim().toLowerCase();
  if (!t) return false;
  const host = hostOf(t);
  return list.some((entry) => {
    const e = entry.toLowerCase();
    if (t.startsWith(e)) return true; // full-URL prefix match
    if (host === e) return true; // exact host match
    if (e && host.endsWith('.' + e)) return true; // subdomain match
    return false;
  });
}

// Hunt creation requires login (requireAuth) AND the existing authorized-
// target checks below. Everything else (chat, plugins, reports, health,
// browsing) stays public.
router.post('/', requireAuth, async (req, res) => {
  const { target, scope, confirmedAuthorized } = req.body || {};
  if (typeof target !== 'string' || !target.trim()) {
    return res.status(400).json({
      ok: false,
      error: 'missing_target',
      message: 'Provide {target} — a URL or host you are authorized to test.',
    });
  }
  if (confirmedAuthorized !== true) {
    console.warn(`[hunts] REJECTED create: confirmedAuthorized missing for target "${target}"`);
    return res.status(403).json({
      ok: false,
      error: 'authorization_not_confirmed',
      message:
        'Hunt creation requires explicit authorization: send {confirmedAuthorized: true} ' +
        'to confirm you own or are permitted to test this target.',
    });
  }
  if (!isTargetAllowed(target)) {
    console.warn(
      `[hunts] REJECTED create: target "${target}" is not in ALLOWED_TARGETS ` +
        `(${config.allowedTargets.length ? config.allowedTargets.join(', ') : 'allowlist empty'})`
    );
    return res.status(403).json({
      ok: false,
      error: 'target_not_allowed',
      message:
        'This target is not on the authorized allowlist (env ALLOWED_TARGETS). ' +
        'Hunts are permitted only against explicitly authorized targets.',
    });
  }
  try {
    const { huntId } = await createEngineHunt(target, scope);
    writeHuntMeta(huntId, {
      huntId,
      target,
      scope: scope || null,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
      authorized: true,
    });
    appendHuntEvent(huntId, { type: 'status', state: 'created', target });
    res.status(201).json({ ok: true, huntId });
  } catch (err) {
    engineErrorResponse(res, err);
  }
});

// List the authenticated user's hunts (newest first). This is what powers
// "close the browser, come back days later": hunts live on the engine +
// backend, not in the browser, so the user re-attaches to them here.
router.get('/', requireAuth, async (req, res) => {
  const mine = listHuntMetas().filter(
    (m) => !m.userId || m.userId === req.user.id
  );
  // Enrich with live engine status where reachable; fall back to cached meta.
  const hunts = await Promise.all(
    mine.map(async (m) => {
      let status = m.status || 'unknown';
      try {
        const live = await getEngineHunt(m.huntId);
        if (live && live.status) status = live.status;
      } catch {
        // engine down — cached status still shows
      }
      return {
        huntId: m.huntId,
        target: m.target,
        scope: m.scope || null,
        createdAt: m.createdAt || null,
        status,
      };
    })
  );
  res.json({ ok: true, hunts });
});

router.get('/:id', requireAuth, async (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  try {
    const data = await getEngineHunt(req.params.id);
    res.json({ ok: true, hunt: data });
  } catch (err) {
    engineErrorResponse(res, err);
  }
});

for (const [route, fn, verb] of [
  ['pause', pauseEngineHunt, 'paused'],
  ['resume', resumeEngineHunt, 'resumed'],
  ['stop', stopEngineHunt, 'stopped'],
]) {
  router.post(`/:id/${route}`, requireAuth, async (req, res) => {
    const huntId = req.params.id;
    const meta = requireHuntOwner(req, res);
    if (!meta) return;
    try {
      const data = await fn(huntId);
      // resume-via-recreate returns a NEW hunt id (a stopped flow can never be
      // resumed in place) — report the new id so the client follows it.
      const effectiveId =
        data && typeof data.huntId === 'string' && data.huntId !== huntId ? data.huntId : huntId;
      appendHuntEvent(huntId, {
        type: 'status',
        state: verb,
        at: new Date().toISOString(),
        ...(effectiveId !== huntId ? { newHuntId: effectiveId } : {}),
      });
      if (effectiveId !== huntId) {
        appendHuntEvent(effectiveId, {
          type: 'status',
          state: 'created',
          resumedFrom: huntId,
          at: new Date().toISOString(),
        });
      }
      res.json({ ok: true, action: route, huntId: effectiveId, engine: data ?? null });
    } catch (err) {
      engineErrorResponse(res, err);
    }
  });
}

// ---- Report: works ANY time, even mid-hunt --------------------------------
// Assembled from the locally cached event stream (see WS bridge + engine
// polls). Markdown is always available; PDF is rendered with pdfkit (bundled
// dependency). If pdfkit were ever missing, we fall back to markdown with a
// clear note instead of failing.

router.get('/:id/report', requireAuth, async (req, res) => {
  const huntId = req.params.id;
  const meta0 = requireHuntOwner(req, res);
  if (!meta0) return;
  const format = String(req.query.format || 'md').toLowerCase();
  const events = readHuntEvents(huntId);
  const meta = readHuntMeta(huntId);
  if (!meta && events.length === 0) {
    return res.status(404).json({
      ok: false,
      error: 'unknown_hunt',
      message: `No cached data for hunt "${huntId}". Reports are generated from the local event cache.`,
    });
  }
  const md = buildReportMarkdown({ huntId, meta, events });
  if (format === 'pdf') {
    try {
      const pdf = await renderPdf(md, meta, huntId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="hunt-${huntId}.pdf"`);
      return res.send(pdf);
    } catch (err) {
      console.warn(`[hunts] pdf render failed for ${huntId}: ${err.message}; falling back to markdown`);
      res.setHeader('X-Report-Note', 'pdf-render-failed; markdown returned instead');
      return res.type('text/markdown').send(md);
    }
  }
  res.type('text/markdown').send(md);
});

// ---- Agent activity log: whatever the agent did, when --------------------------------
// Cached event stream (thinking, tool calls, findings, status). Works even
// when the engine is unreachable — this is the "what is the agent doing"
// view.
router.get('/:id/events', requireAuth, (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
  const events = readHuntEvents(req.params.id);
  res.json({ ok: true, huntId: req.params.id, events: events.slice(-limit) });
});

// ---- Infinity analysis: chains, confirmation, exploitability, variant probes.
// Pure logic over cached findings — no engine call needed. Powers the
// "what did you chain / what's next" view any time, even mid-hunt.
router.get('/:id/analysis', requireAuth, async (req, res) => {
  const meta = requireHuntOwner(req, res);
  if (!meta) return;
  const goal = String(req.query.goal || 'rce');
  const events = readHuntEvents(req.params.id);
  const findings = events.filter((e) => e.type === 'finding');
  res.json({ ok: true, huntId: req.params.id, analysis: analyzeFindings(findings, goal) });
});

// ---- Shared helpers (used by the WS stream bridge too) --------------------

export function recordEngineEvent(huntId, event) {
  appendHuntEvent(huntId, event);
}

export function getCachedEvents(huntId) {
  return readHuntEvents(huntId);
}

export function buildReportMarkdown({ huntId, meta, events }) {
  const target = (meta && meta.target) || 'unknown target';
  const createdAt = (meta && meta.createdAt) || 'unknown';
  const findings = events.filter((e) => e.type === 'finding');
  const toolCalls = events.filter((e) => e.type === 'tool_call');
  const thinking = events.filter((e) => e.type === 'thinking');
  const statuses = events.filter((e) => e.type === 'status');
  const lastStatus = statuses.length ? statuses[statuses.length - 1] : null;

  const lines = [];
  lines.push(`# Hunt Report — ${huntId}`);
  lines.push('');
  lines.push(`- **Target:** ${target}`);
  lines.push(`- **Created:** ${createdAt}`);
  lines.push(`- **Latest status:** ${lastStatus ? (lastStatus.state || JSON.stringify(lastStatus)) : 'n/a'}`);
  lines.push(`- **Events cached:** ${events.length} (${thinking.length} thinking, ${toolCalls.length} tool calls, ${findings.length} findings)`);
  lines.push(`- **Generated:** ${new Date().toISOString()} (report may reflect a mid-hunt snapshot)`);
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  if (!findings.length) {
    lines.push('_No findings recorded yet._');
  } else {
    // Infinity analysis: chains, confirmation, exploitability, variant probes.
    try {
      lines.push(chainsMarkdown(analyzeFindings(findings)));
    } catch {
      // intel layer is best-effort; raw findings still render below
    }
    for (const f of findings) {
      const sev = f.severity || f.level || 'info';
      const title = f.title || f.name || f.type || 'finding';
      lines.push(`### [${String(sev).toUpperCase()}] ${title}`);
      if (f.description) lines.push('', String(f.description));
      if (f.evidence) lines.push('', '**Evidence:**', '', '```', String(f.evidence).slice(0, 2000), '```');
      if (f.url) lines.push('', `**URL:** ${f.url}`);
      lines.push('');
    }
  }
  lines.push('## Tool activity');
  lines.push('');
  if (!toolCalls.length) {
    lines.push('_No tool calls recorded yet._');
  } else {
    for (const t of toolCalls.slice(0, 200)) {
      const name = t.tool || t.name || 'tool';
      lines.push(`- \`${name}\` ${t.input ? '— ' + String(t.input).slice(0, 160) : ''}`);
    }
    if (toolCalls.length > 200) lines.push(`- …and ${toolCalls.length - 200} more`);
  }
  lines.push('');
  lines.push('## Status timeline');
  lines.push('');
  for (const s of statuses) {
    lines.push(`- ${s.cachedAt || s.at || ''} — ${s.state || JSON.stringify(s)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderPdf(md, meta, huntId) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(20).text(`Hunt Report — ${huntId}`, { underline: true });
  doc.moveDown();
  doc.fontSize(10).fillColor('#555');
  doc.text(`Target: ${(meta && meta.target) || 'unknown'}`);
  doc.text(`Generated: ${new Date().toISOString()} (may be a mid-hunt snapshot)`);
  doc.moveDown();
  doc.fillColor('#000');

  // Simple markdown-ish rendering: headings, bullets, code blocks.
  let inCode = false;
  for (const rawLine of md.split('\n')) {
    const line = rawLine;
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      doc.font('Courier').fontSize(8).text(line);
      doc.font('Helvetica').fontSize(10);
      continue;
    }
    if (line.startsWith('# ')) doc.fontSize(16).text(line.slice(2));
    else if (line.startsWith('## ')) { doc.moveDown(0.5); doc.fontSize(13).text(line.slice(3)); }
    else if (line.startsWith('### ')) { doc.moveDown(0.25); doc.fontSize(11).text(line.slice(4)); }
    else if (line.startsWith('- ') || line.startsWith('* ')) doc.fontSize(10).text('• ' + line.slice(2));
    else if (line.trim() === '') doc.moveDown(0.5);
    else doc.fontSize(10).text(line.replace(/\*\*/g, ''));
  }
  doc.end();
  return done;
}

function engineErrorResponse(res, err) {
  if (err instanceof EngineUnreachableError) {
    return res.status(502).json({
      ok: false,
      error: 'engine_unreachable',
      message: err.message,
    });
  }
  if (err instanceof EngineError) {
    return res.status(err.status >= 500 ? 502 : err.status).json({
      ok: false,
      error: 'engine_error',
      message: err.message,
    });
  }
  return res.status(500).json({ ok: false, error: 'internal_error', message: String(err.message || err) });
}

export default router;
