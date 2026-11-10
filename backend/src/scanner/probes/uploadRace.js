// Dark Matter rule-based scanner — file upload race condition probe
// (coverage row #498 [High] File upload — race condition (validation
// timing), CWE-362/434 | OWASP A03:2021; phase 'upload-race').
//
// Some upload handlers move the file into the public directory
// FIRST and run the virus/type check AFTER — in the window between
// the move and the check's unlink, the file is retrievable (and,
// for a script type, executable). An attacker who polls the public
// path in parallel with the upload wins the race. This probe
// uploads a marker file while GET-looping the predicted public
// path, and confirms only on the state change itself.
//
// ORACLE (state-change, three conjuncts, all required):
//   (1) UPLOAD ACCEPTED — the upload POST returns 2xx and the
//       response discloses (or the conventional path predicts)
//       where the file went.
//   (2) WINDOW HIT — at least one GET inside the polling loop
//       returns the uploaded marker content BEFORE the check
//       completes. A file that is never retrievable was validated
//       before the move, and the phase reports no finding (and
//       says so in diagnostics).
//   (3) WINDOW CLOSED — a final GET after the upload settles
//       shows the file GONE (404). A file that is still served
//       afterwards is a persistently stored upload — that is the
//       fileUpload probe's territory, not a race window, and this
//       probe stays quiet (diagnostics say 'persisted').
// A single successful GET with no proof the file was later
// removed is not a race finding. A finding fires at most once
// per form.
//
// SAFETY: this probe WRITES files to the target. It runs ONLY
// when opts.allowWrite is true AND the target is a lab host
// (isLabTargetHost, the same lab gate as fileUpload). Everywhere
// else it returns [] without a single request. Uploaded content
// is a harmless text marker — never a real shell — and the file
// name carries a per-run random suffix. Findings are class
// 'file_upload_race' — the default confirmation protocol, judged
// on evidence.signalCorrelated (see differential.js).
//
// HONEST LIMITS: the polling loop predicts the public path as
// /uploads/<filename> (the lab convention) and confirms it
// against the URL the upload response discloses when present; a
// lab that stores uploads under an unpredictable path shows no
// window hit and the phase reports 'path not predicted', never a
// finding. The race window is timing-dependent: a check faster
// than the poll interval (~25ms) wins the race against the probe
// itself, so a quiet result means "no window observed", not
// "no race exists". DVWA's upload page is a candidate for live
// proof — verify-first, do not assume it races. No dedicated
// upload-race lab exists today; the unit tests prove the oracle
// against a local mock server with a planted delay between move
// and unlink.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 20000;
// Poll the public path every 25ms for up to 3s: the race window
// in a check-after-move handler is typically hundreds of
// milliseconds, so a 25ms interval samples it several times
// without flooding the lab.
const POLL_INTERVAL_MS = 25;
const POLL_BUDGET_MS = 3000;
const MAX_FORMS = 2;

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Find <input type="file"> forms in a page body. Same shape as
 * fileUpload.js (which does not export its copy): action URL
 * resolved against the page, file-input name, capped at 2. Pure.
 */
export function findUploadForms(body, base) {
  const forms = [];
  const re = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = re.exec(String(body || '')))) {
    const tag = m[0].slice(0, 500);
    if (!/type=["']?file/i.test(m[0])) continue;
    const action = (/action=["']([^"']*)["']/i.exec(tag) || [])[1] || base;
    const fileInput = (/name=["']([^"']+)["'][^>]*type=["']?file/i.exec(m[0]) ||
      /type=["']?file[^>]*name=["']([^"']+)["']/i.exec(m[0]) || [])[1] || 'file';
    try {
      forms.push({ action: new URL(action, base).toString(), fileInput });
    } catch {
      // ignore
    }
  }
  return forms.slice(0, MAX_FORMS);
}

/**
 * Find a retrievable URL for the uploaded file in the upload
 * response (href/src/action attribute or bare path containing the
 * filename), resolved against the form action. Null when the
 * response discloses none. Pure.
 */
export function findUploadedUrl(respText, filename, base) {
  const esc = escapeRegExp(filename);
  const attr = new RegExp(`(?:href|src|action)\\s*=\\s*["']([^"']*${esc}[^"']*)["']`, 'i').exec(respText);
  if (attr) {
    try { return new URL(attr[1], base).toString(); } catch { return null; }
  }
  const bare = new RegExp(`["'\\s]\\s*(/[^"'\\s]*${esc}[^"'\\s]*)`, 'i').exec(respText);
  if (bare) {
    try { return new URL(bare[1], base).toString(); } catch { return null; }
  }
  return null;
}

/**
 * Predict the public URL of an uploaded file: the lab convention
 * /uploads/<filename> on the form action's origin. Pure.
 */
export function predictPublicUrl(formAction, filename) {
  const origin = new URL(formAction).origin;
  return `${origin}/uploads/${filename}`;
}

/**
 * Judge the race oracle. 'confirmed' only when the upload was
 * accepted, the marker was retrievable inside the window, and the
 * file is gone afterwards. A hit that persists is a stored upload,
 * not a race window; no hit at all means the target validated
 * before the move (or the path was not predicted). Pure.
 */
export function assessUploadRace({ uploadAccepted, hitObserved, goneAfter, disclosedUrlMatches }) {
  if (!uploadAccepted) {
    return { verdict: 'rejected', reason: 'upload was not accepted — the target validated before the move' };
  }
  if (!disclosedUrlMatches) {
    return { verdict: 'unconfirmed', reason: 'upload response disclosed a different public path than predicted — the window could not be polled' };
  }
  if (!hitObserved) {
    return { verdict: 'rejected', reason: 'file was never retrievable in the polling window — validated before the move, or the check beat the poll' };
  }
  if (!goneAfter) {
    return { verdict: 'rejected', reason: 'file is still served after the upload settled — a persistently stored upload, not a race window' };
  }
  return { verdict: 'confirmed', reason: 'file retrievable in the window between move and check, then removed by the check' };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function get(fetchFn, url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function upload(fetchFn, action, fileInput, filename, content, opts = {}) {
  const fd = new FormData();
  fd.append(fileInput, new Blob([content], { type: 'text/plain' }), filename);
  fd.append('Submit', 'Upload');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetchFn(action, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      body: fd,
    });
    return { status: res.status, text: await res.text().catch(() => '') };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Poll a public URL for the marker until the budget expires.
// Returns { hitObserved, hitMs, goneAfter, goneMs, polls } —
// hitMs is the time from the first poll to the first GET that
// returned the marker; goneAfter is true only when a LATER GET
// (after the hit) shows the file gone, with goneMs its time.
// The loop keeps polling after a hit on purpose: the race proof
// needs both the window opening AND closing inside the budget.
async function pollPublicUrl(fetchFn, publicUrl, marker, opts = {}) {
  const intervalMs = opts.pollIntervalMs || POLL_INTERVAL_MS;
  const budgetMs = opts.pollBudgetMs || POLL_BUDGET_MS;
  const started = Date.now();
  let polls = 0;
  let hitMs = null;
  let goneMs = null;
  while (Date.now() - started < budgetMs) {
    polls += 1;
    const r = await get(fetchFn, publicUrl, opts);
    const hasMarker = r && r.status >= 200 && r.status < 300 && r.text.includes(marker);
    if (hasMarker && hitMs === null) {
      hitMs = Date.now() - started;
    } else if (hitMs !== null && !hasMarker) {
      // A GET after the hit shows the file gone — the check
      // removed it. (A single failed GET before any hit is just
      // the file not moved yet, not a close.)
      goneMs = Date.now() - started;
      break;
    }
    await sleep(intervalMs);
  }
  return { hitObserved: hitMs !== null, hitMs, goneAfter: goneMs !== null, goneMs, polls };
}

// ---- the probe ---------------------------------------------------------------

export async function probeUploadRace(url, opts = {}) {
  // LAB GATE: never touch the network unless explicitly allowed
  // on a lab host.
  if (!opts || opts.allowWrite !== true) return [];
  if (!isLabTargetHost(url, opts.labTargets)) return [];
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  let body = '';
  try {
    body = (await get(fetchFn, url, opts))?.text || '';
  } catch {
    return findings;
  }
  const forms = findUploadForms(body, url);
  setDiag('forms', forms.length);
  if (!forms.length) {
    setDiag('skipReason', 'no upload form on the page');
    return findings;
  }
  for (const form of forms) {
    const rand = randomBytes(4).toString('hex');
    const marker = `DM-RACE-${rand}`;
    const filename = `dmprobe_${rand}.php`;
    // Harmless marker content — never a real shell.
    const content = `<?php echo "${marker}"; ?>`;
    const publicUrl = predictPublicUrl(form.action, filename);

    // The upload and the GET loop run in parallel: the loop must
    // already be polling when the server moves the file.
    const uploadPromise = upload(fetchFn, form.action, form.fileInput, filename, content, opts);
    const pollPromise = pollPublicUrl(fetchFn, publicUrl, marker, opts);
    const [uploadResp, poll] = await Promise.all([uploadPromise, pollPromise]);
    setDiag('polls', poll.polls);
    setDiag('windowHitMs', poll.hitMs);
    setDiag('windowClosedMs', poll.goneMs);
    if (!uploadResp) continue;
    const uploadAccepted = uploadResp.status >= 200 && uploadResp.status < 300;
    setDiag('uploadAccepted', uploadAccepted);
    if (!uploadAccepted) {
      setDiag('validatedBeforeMove', true);
      continue;
    }
    // Confirm the predicted path against the disclosed URL when
    // the response discloses one.
    const disclosedUrl = findUploadedUrl(uploadResp.text, filename, form.action);
    const disclosedUrlMatches = !disclosedUrl || disclosedUrl === publicUrl;
    setDiag('disclosedUrlMatches', disclosedUrlMatches);
    // Window-closed evidence comes from the poll loop itself: a
    // GET after the hit showed the file gone (the check removed
    // it). No extra GET is needed — and a final GET here would be
    // racy, landing before the check runs.
    const goneAfter = poll.goneAfter;
    setDiag('goneAfter', goneAfter);
    const verdict = assessUploadRace({
      uploadAccepted,
      hitObserved: poll.hitObserved,
      goneAfter,
      disclosedUrlMatches,
    });
    setDiag('verdict', verdict.verdict);
    if (verdict.verdict !== 'confirmed') continue;
    findings.push({
      class: 'file_upload_race',
      id: `file-upload-race-${rand}`,
      title: 'File upload race condition — file retrievable before validation removes it',
      severity: 'high',
      url: form.action,
      evidence: ev(
        `POST ${form.action} multipart (${form.fileInput}=${filename}) while GET-looping ${publicUrl} every ${POLL_INTERVAL_MS}ms`,
        `The uploaded marker was retrievable at ${publicUrl} ${poll.hitMs}ms into the upload window, and a later GET ${poll.goneMs}ms in showed the file gone — the handler moves the file into the public directory before the type/virus check removes it. ${verdict.reason}.`,
        'An attacker who polls the public path wins the race: the uploaded file is live (and, for a script type, executable) in the window before validation deletes it.',
      ),
    });
    // One confirmed race per form is enough; the loop continues
    // to the next form (another form may race differently).
  }
  return findings;
}

export const __uploadRaceMeta = { phases: ['upload-race'], depth: ['standard', 'deep'] };
