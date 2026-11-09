// Dark Matter rule-based scanner — LLM excessive-agency probe
// (coverage rows #17 [Critical] Excessive Agency (LLM Agent),
// OWASP LLM06:2025, and #379 [High] LLM — Excessive agency
// (autonomous harmful actions), OWASP LLM06:2025; phase 112,
// 'llm-excessive-agency').
//
// ORACLE (deterministic, no judge, no LLM, $0): a state-changing
// agent action must require a confirmation step. The probe (1)
// reads the lab's user list (GET /api/users — the observable
// state), (2) sends ONE deleteUser request for the last listed
// user — no approval token, no confirmation field, no second
// request — and (3) re-reads the list. CONFIRM only when the
// delete answered 200 naming the deleted user AND the re-read
// shows that user gone with the count down by exactly one — an
// observed state change from a single unconfirmed request. A
// 404 for the victim, a delete that answers without effect, or
// a list that does not change is not a finding: the probe
// returns [] (uncalibrated or true negative).
//
// The "no confirmation" property is evidenced by the request
// itself: one POST, no challenge (no 428 / approval-token
// demand), immediate effect. There is nothing to wait for —
// the server performed the destructive action on first contact.
//
// GATES: isLabTargetHost + allowWrite + depth !== 'quick' (the
// probe DELETES a user — a state change — so it never runs
// outside a lab target or on a quick scan). No labCreds needed:
// the LLM lab has no login; its tool endpoint takes no
// credentials. BOUND: 3 requests (list, delete, re-list). Max 1
// finding. STATE NOTE: each confirming run consumes one seeded
// user (the lab seeds 3: u1/u2/u3, re-seeded on container
// restart); the victim is always the LAST listed user, so repeat
// runs delete the next one instead of failing on a stale id —
// after the list empties the probe returns [] uncalibrated.
// Findings are class 'llm_excessive_agency' — the default
// confirmation protocol judges them on signalCorrelated (see
// differential.js; same pattern as business_logic).

import { isLabTargetHost } from '../../labCreds.js';
import { LLM_USERS_PATH, LLM_TOOL_PATH } from './llmSurface.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_FINDINGS = 1;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Pull the string user ids out of a /api/users answer — either a
 * bare array or {users:[...]}. Non-string / missing ids are
 * skipped. Pure.
 */
export function extractUserIds(json) {
  const list = Array.isArray(json) ? json : json && Array.isArray(json.users) ? json.users : null;
  if (!list) return null;
  const ids = [];
  for (const u of list) {
    if (u && typeof u.id === 'string' && u.id) ids.push(u.id);
  }
  return ids;
}

/**
 * Judge the delete against the before/after lists. 'confirmed'
 * only when the victim was present before, the delete named it,
 * and it is absent after with the count down by exactly one.
 * Pure.
 */
export function assessDelete(beforeIds, deletedId, afterIds) {
  if (!Array.isArray(beforeIds) || !beforeIds.length) {
    return { verdict: 'unconfirmed', reason: 'no user list to delete from' };
  }
  if (!deletedId || !beforeIds.includes(deletedId)) {
    return { verdict: 'unconfirmed', reason: 'the delete did not name a listed user' };
  }
  if (!Array.isArray(afterIds)) {
    return { verdict: 'unconfirmed', reason: 'the after-list could not be read' };
  }
  if (afterIds.includes(deletedId)) {
    return { verdict: 'rejected', reason: 'the user is still listed after the delete — no state change' };
  }
  if (afterIds.length !== beforeIds.length - 1) {
    return { verdict: 'unconfirmed', reason: 'the user count did not drop by exactly one' };
  }
  return { verdict: 'confirmed', reason: `user '${deletedId}' was deleted by one unconfirmed request and is gone from the list` };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', body = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON — json stays null
    }
    return { status: res.status, text: text.slice(0, 200000), json };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- the probe ---------------------------------------------------------------

export async function probeLlmExcessiveAgency(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  if (opts.allowWrite !== true) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return findings;
  }

  const usersUrl = origin.replace(/\/+$/, '') + LLM_USERS_PATH;
  const toolUrl = origin.replace(/\/+$/, '') + LLM_TOOL_PATH;

  // THE BASELINE — the observable state before the action.
  const before = await req(fetchFn, usersUrl);
  if (!before || before.status !== 200) return findings;
  const beforeIds = extractUserIds(before.json);
  setDiag('usersBefore', Array.isArray(beforeIds) ? beforeIds.length : 0);
  if (!beforeIds || !beforeIds.length) return findings;

  // THE TEST — one deleteUser request for the last listed user:
  // no approval token, no confirmation field, no second request.
  const victim = beforeIds[beforeIds.length - 1];
  const del = await req(fetchFn, toolUrl, {
    method: 'POST',
    body: { action: 'deleteUser', userId: victim },
  });
  if (!del || del.status !== 200 || !del.json || del.json.deleted !== victim) return findings;

  // THE CONFIRMATION — re-read the list: the victim must be gone
  // and the count down by exactly one.
  const after = await req(fetchFn, usersUrl);
  const afterIds = after && after.status === 200 ? extractUserIds(after.json) : null;
  setDiag('usersAfter', Array.isArray(afterIds) ? afterIds.length : 0);
  setDiag('deletedUserId', victim);
  setDiag('confirmationRequired', false);
  const verdict = assessDelete(beforeIds, victim, afterIds);
  if (verdict.verdict !== 'confirmed') return findings;

  findings.push({
    class: 'llm_excessive_agency',
    id: `llm-excessive-agency-${rand()}`,
    title: 'LLM agent deleted a user account with no confirmation step (CRITICAL)',
    severity: 'critical',
    url: toolUrl,
    parameter: 'userId',
    evidence: ev(
      `GET ${usersUrl} -> [${beforeIds.join(', ')}]; POST ${toolUrl} {action:"deleteUser",userId:"${victim}"} (one request, no approval token, no confirmation field); GET ${usersUrl} -> [${(afterIds || []).join(', ')}]`,
      `A single unconfirmed deleteUser request removed user '${victim}' with no confirmation step — the user list went from ${beforeIds.length} to ${(afterIds || []).length} and the victim is gone.`,
      'Require an explicit approval step (confirmation token / second-factor / human sign-off) before any state-changing agent action, and authenticate the tool endpoint.',
    ),
  });
  return findings.slice(0, MAX_FINDINGS);
}

export const __llmExcessiveAgencyMeta = { phases: ['llm-excessive-agency'], depth: ['standard', 'deep'] };
