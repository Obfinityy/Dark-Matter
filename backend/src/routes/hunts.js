// Hunt routes — authorized-targets-only creation, engine proxying, reports.
//
//   POST /api/v1/hunts {target, scope, confirmedAuthorized}
//   GET  /api/v1/hunts                    -> the user's hunts (re-attach after browser close)
//   POST /api/v1/hunts/:id/pause | /resume | /stop
//   POST /api/v1/hunts/:id/budget {budgetUsd} — per-hunt spend cap (auto-pause)
//   POST /api/v1/hunts {fresh:true} — brand-new hunt for a hunted target
//   GET  /api/v1/hunts/:id               -> engine status (502 if engine down)
//   GET  /api/v1/hunts/:id/report?format=md|pdf  (works any time, even mid-hunt)
//   GET  /api/v1/hunts/:id/desktop.jpg   -> latest frame of the hunt machine's GUI (Live Machine)
//   GET  /api/v1/hunts/:id/analysis?goal=rce    -> infinity analysis (chains, confirmation)
//
// Authorization policy: a hunt is created ONLY when BOTH hold:
//   1. body.confirmedAuthorized === true  (frontend sends this after the user
//      confirms they own / are permitted to test the target), AND
//   2. the caller is admin (owner — may hunt any typed target) OR `target`
//      matches ALLOWED_TARGETS (env, comma-separated; applies to member
//      accounts). Matching: the target URL's hostname equals an entry or is
//      a subdomain of it, or the target string starts with an entry.
// Otherwise: HTTP 403 and the attempt is logged.
//
// The routes live in ./hunts/ (P3 split); this module only wires them up,
// in the original first-appearance order, and re-exports the helpers
// tests import — so no caller changes.

import { Router } from 'express';
import { registerCreateRoutes } from './hunts/create.js';
import { registerListRoutes } from './hunts/list.js';
import { registerControlRoutes } from './hunts/control.js';
import { registerReportRoutes } from './hunts/report.js';
export { buildReportMarkdown } from './hunts/report.js';
export { getCachedEvents, isTargetAllowed, mapListHunt, normalizeHuntCreate, normalizeTargetKey, pickExistingHunt, recordEngineEvent } from './hunts/helpers.js';

const router = Router();

registerCreateRoutes(router);
registerListRoutes(router);
registerControlRoutes(router);
registerReportRoutes(router);

export default router;
