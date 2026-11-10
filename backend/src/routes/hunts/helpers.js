// Split out of hunts.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; hunts.js re-exports the public names so callers are unchanged.

import { config } from '../../config.js';
import {
  EngineUnreachableError,
  EngineError,
  createEngineHunt,
  getEngineHunt,
  pauseEngineHunt,
  resumeEngineHunt,
  stopEngineHunt,
} from '../../engine.js';
import {
  appendHuntEvent,
  readHuntBehaviour,
  readHuntEvents,
  writeHuntMeta,
  writeHuntMetaCheckpoint,
  readHuntMeta,
  listHuntMetas,
} from '../../store.js';

/** Reject unless the hunt belongs to the authenticated user.
 *  Hunts without a userId are orphaned (pre-isolation) — admin only. */
export function requireHuntOwner(req, res) {
  const meta = readHuntMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ ok: false, error: 'hunt_not_found' });
    return null;
  }
  if (!meta.userId) {
    // FIX #128: Legacy hunts without userId — require admin, not any user.
    // Previously allowed any authenticated user (IDOR risk).
    if (req.user.role !== 'admin') {
      res.status(403).json({ ok: false, error: 'forbidden' });
      return null;
    }
    return meta;
  }
  if (meta.userId !== req.user.id && req.user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  return meta;
}

function hostOf(target) {
  try {
    const u = new URL(target);
    return u.hostname.toLowerCase();
  } catch {
    return String(target || '').toLowerCase();
  }
}

/**
 * Canonical identity of a hunt target, for duplicate detection. Two targets
 * are "the same hunt" when they differ only in scheme, a leading "www.",
 * a default port, letter case, or trailing slashes — e.g.
 * "https://thebhavesh.online", "http://www.thebhavesh.online/" and
 * "thebhavesh.online" all map to "thebhavesh.online".
 */
export function normalizeTargetKey(target) {
  const raw = String(target || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const port = u.port && !['80', '443'].includes(u.port) ? `:${u.port}` : '';
    const pathPart = u.pathname.replace(/\/+$/, '');
    return `${host}${port}${pathPart}`;
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '');
  }
}

const HUNT_STATE_RANK = {
  running: 0,
  starting: 1,
  created: 1,
  paused: 2,
  out_of_credits: 2,
  stopped: 3,
  finished: 4,
  failed: 5,
};

// When several hunts exist for one target (legacy duplicates), the one worth
// reopening is the live one; otherwise the paused one that can resume; a
// terminal hunt still wins over creating yet another duplicate. Ties break
// toward the most progress (iteration), then the most recently created.
export function pickExistingHunt(metas, userId, target, brainMode) {
  const key = normalizeTargetKey(target);
  if (!key || !userId) return null;
  // MODE-SCOPED DEDUP (3 Nov 2026): the dedup key is (user, target,
  // brainMode). An existing AI hunt for a target must not block a new
  // automation (scanner) hunt for the same target, and vice versa —
  // otherwise the "With AI / With Automation" choice in the New Hunt
  // dialog can never start a fresh hunt for an already-hunted target.
  // Hunts created before brainMode was recorded count as 'ai'.
  // brainMode omitted → legacy target-only match.
  const want = brainMode == null ? null : brainMode === 'scanner' ? 'scanner' : 'ai';
  const modeOf = (h) => (h && h.brainMode === 'scanner' ? 'scanner' : 'ai');
  const matches = (metas || []).filter(
    (h) =>
      h && h.userId && h.userId === userId &&
      normalizeTargetKey(h.target) === key &&
      (want === null || modeOf(h) === want)
  );
  if (!matches.length) return null;
  const rank = (h) =>
    HUNT_STATE_RANK[String(h.state || h.status || '').toLowerCase()] ?? 6;
  matches.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (Number(b.iteration) || 0) - (Number(a.iteration) || 0) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
  return matches[0];
}

export function isTargetAllowed(target) {
  const list = config.allowedTargets;
  if (!list.length) return false;
  const t = String(target || '').trim().toLowerCase();
  if (!t) return false;
  const host = hostOf(t);
  return list.some((entry) => {
    const e = entry.toLowerCase().replace(/\/+$/, ''); // ignore trailing slashes
    if (!e) return false;
    // FIX (#338): the old full-string prefix match (`t.startsWith(e)`)
    // let `example.com.evil.com` and `https://example.com@evil.com`
    // pass an `example.com` entry. A prefix only counts on a URL
    // boundary — exact entry, or entry followed by `/`.
    if (t === e || t.startsWith(e + '/')) return true; // full-URL/path prefix match
    if (host === e) return true; // exact host match
    if (host.endsWith('.' + e)) return true; // subdomain match
    return false;
  });
}

// PURE HELPERS (5 Nov 2026, Re-run brainMode fix) — exported for tests.
//
// normalizeHuntCreate: the create handler's brainMode/scanDepth/
// scanScope rules in one place — 'scanner' stays scanner, anything
// else (incl. omitted) is 'ai'; scanDepth is quick/standard/deep,
// anything else is 'standard'; scanScope is 'site' (/* whole-site
// crawl) or 'page' (default — one page deep). The frontend's Re-run /
// Start-from-scratch sends the source hunt's values; the backend
// honours them verbatim here (stored on the meta and echoed in the
// 201 response).

// mapListHunt: the static fields of one GET / list item, from a hunt meta.
// SCAN DEPTH (5 Nov 2026): the list used to omit scanDepth, so a restored
// hunt card could never inherit the source hunt's depth — a Re-run of a
// Deep hunt silently fell back to Standard. Legacy metas (no scanDepth
// recorded) report 'standard', the historical default — same convention
// as mode ('normal') and brainMode ('ai').
export function normalizeHuntCreate(body) {
  const brainMode = body && body.brainMode === 'scanner' ? 'scanner' : 'ai';
  const scanDepth =
    body && (body.scanDepth === 'quick' || body.scanDepth === 'deep')
      ? body.scanDepth
      : 'standard';
  const scanScope = body && body.scanScope === 'site' ? 'site' : 'page';
  return { brainMode, scanDepth, scanScope };
}

export function mapListHunt(m) {
  const mm = m || {};
  return {
    huntId: mm.huntId,
    target: mm.target,
    scope: mm.scope || null,
    // MODE FIX (27 Oct 2026): the list used to omit mode, so the
    // frontend could never inherit a hunt's real mode — "Start
    // from scratch" on a human-mode hunt always fell back to
    // 'normal'. Hunts created before mode was recorded report
    // 'normal', the historical default.
    mode: mm.mode || 'normal',
    // BRAIN MODE (3 Nov 2026): the list used to omit brainMode, so the
    // frontend's dedup pre-check could not tell an AI hunt from an
    // automation hunt for the same target. Hunts created before
    // brainMode was recorded report 'ai', the historical default.
    brainMode: mm.brainMode === 'scanner' ? 'scanner' : 'ai',
    // SCAN DEPTH (5 Nov 2026): see header comment above.
    scanDepth:
      mm.scanDepth === 'quick' || mm.scanDepth === 'deep' ? mm.scanDepth : 'standard',
    // SCAN SCOPE (9 Nov 2026, /* owner order): 'site' runs the
    // recursive whole-site crawl, 'page' (default, incl. legacy
    // metas) scans the pasted page only. The list carries it so a
    // restored hunt card can inherit the source hunt's scope on
    // Re-run / Start-from-scratch.
    scanScope: mm.scanScope === 'site' ? 'site' : 'page',
    createdAt: mm.createdAt || null,
  };
}

// ---- Shared helpers (used by the WS stream bridge too) --------------------
export function recordEngineEvent(huntId, event) {
  appendHuntEvent(huntId, event);
}

export function getCachedEvents(huntId) {
  return readHuntEvents(huntId);
}

export function engineErrorResponse(res, err) {
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
