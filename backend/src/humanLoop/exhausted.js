// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { saveCredential, getCredential, generatePassword, generatePersonaUsername, scrubSecrets, touchCredential, markVerified, listCredentials, hostOf } from '../credentials.js';
import {
  emptyPageState,
  loadPageState,
  savePageState,
  mergePageState,
  markElementClicked,
  markTypedInto,
  pageStateLines,
  loopCounters,
  loopCounterLines,
  reconChecklist,
  coverageSummaryLines,
  normalisePageUrl,
  classifyPageType,
} from '../pageState.js';
import { claimClassFromTitle, claimGateCheck, classifyPayloadClass, probeProvesClaim, proofEndpointOfCommand, proofFileObservation, proofGateHit, proofSignatureFor, surfacePageOfUrl } from './claims.js';
import { GATED_TOOLS, GUI_CONTROL_KINDS, LOGIN_PAGE_RE, authGateHit, buildActionHistory, dedupeGateHit, exploredDigestLines, hasSelfAuthAttempt, repetitionLines, searchRepeatHit } from './gates.js';

// EXHAUSTED SURFACES (Infinity level, 26 Oct 2026)
//
// Root cause (Infomaniak hunt, live, iter 108): the dedupe gate keys
// on EXACT (tool, detail) and the auth gate on EXACT typed text, so
// the hunter varies the payload — plain XSS, then encoded XSS —
// and each variant is a NEW signature the gates pass, until the
// execution itself is refused by the auth gate or the driver's
// WRONG PAGE guard. Every refused variant burns a full turn
// (10-25 min of 8B generation), and nothing ever records that the
// (page, field, payload-class) combination is finished. The settled
// lines (Lane AD/AH) state the prohibition, but the hunter
// re-derives "signup not probed" because the payload was never
// SENT — a premise that is true in its own terms. Prompt text
// cannot fix a choice the brain re-derives; only state can.
//
// So the combination itself is tracked, deterministically, from
// the hunt's own record — auth_block + dedup_block + WRONG PAGE
// refusals grouped by (tool, page, payload class) — and at
// EXHAUSTED_MIN_BLOCKS blocks the surface is CLOSED: the gate
// below refuses ANY further attempt on it, whatever the payload
// wording. The brain still chooses everything else; the dead loop
// is simply no longer offered. The key carries the page, so a
// different page is a different surface — exhaustion lifts the
// moment the surface changes, exactly as the brief requires —
// and a login-form payload is judged against the LOGIN surface,
// never against the signup surface it was aimed at.
//
// This is a gate, in the Lane F/AJ shape — it stops traffic, never
// picks a replacement action (owner order 20 Oct stands).

export const EXHAUSTED_MIN_BLOCKS = 3; // blocks before a surface closes

/**
 * The authenticated-flow state for one target, from the vault +
 * the record: a credential saved for the target's host (latest),
 * whether it was ever used (use_saved_credential tool_calls for
 * its handle), and whether it verified. Null-safe; the vault read
 * is best-effort (a missing vault means "no credential").
 */
export function credentialStateFor({ events = [], target = '' } = {}) {
  let saved = null;
  try {
    const host = hostOfUrl(target);
    const all = listCredentials() || [];
    const mine = all.filter((c) => c && (String(c.host || '').toLowerCase() === host || (host && String(c.host || '').toLowerCase().endsWith(`.${host}`))));
    if (mine.length) saved = mine[mine.length - 1];
  } catch { /* vault read is best-effort */ }
  if (!saved) return { saved: false };
  let used = 0;
  for (const e of events || []) {
    if (e && e.type === 'tool_call' && String(e.tool || '').toLowerCase() === 'use_saved_credential' && String(e.detail || '') === saved.handle) used++;
  }
  return { saved: true, handle: saved.handle, verified: !!saved.verified, used };
}

function surfaceKey(tool, pageHost, pagePath, payloadClass) {
  return `${String(tool || '').toLowerCase()}|${String(pageHost || '').toLowerCase()}|${String(pagePath || '')}|${String(payloadClass || '')}`;
}

function hostOfUrl(u) {
  try {
    return new URL(String(u || '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Block counts per (tool, page, payload class), purely from
 * the hunt's record. Page attribution walks the event stream in
 * order, tracking the live page from browser_open URLs; a WRONG
 * PAGE execution names its own page in the paired reasoning row.
 * Pairing follows the Lane T discipline: an executed browser_type
 * writes exactly one reasoning row, in order, so the Nth
 * browser_type row pairs with the Nth browser_type tool_call
 * (gate-block rows carry no tool_call and consume nothing).
 */
export function surfaceBlockCounts({ events = [], reasoningRows = [] } = {}) {
  const counts = new Map();
  const bump = (tool, pageHost, pagePath, payloadClass) => {
    if (!pageHost) return;
    const key = surfaceKey(tool, pageHost, pagePath, payloadClass);
    const cur = counts.get(key) || { tool: String(tool).toLowerCase(), pageHost, pagePath, page: pageHost + pagePath, payloadClass, count: 0 };
    cur.count++;
    counts.set(key, cur);
  };
  // Index executed browser_type calls in stream order for pairing.
  const typeCalls = [];
  for (const e of events || []) {
    if (e && e.type === 'tool_call' && String(e.tool || '').toLowerCase() === 'browser_type') typeCalls.push(e);
  }
  let typeIdx = 0;
  let currentPage = { host: '', path: '' };
  for (const e of events || []) {
    if (!e) continue;
    if (e.type === 'tool_call' && String(e.tool || '').toLowerCase() === 'browser_open') {
      const pg = surfacePageOfUrl(e.detail);
      if (pg.host) currentPage = pg;
      continue;
    }
    if (e.type === 'auth_block' && String(e.tool || '').toLowerCase() === 'browser_type') {
      bump('browser_type', currentPage.host, currentPage.path, classifyPayloadClass(e.detail));
      continue;
    }
    if (e.type === 'dedup_block' && String(e.tool || '').toLowerCase() === 'browser_type') {
      bump('browser_type', currentPage.host, currentPage.path, classifyPayloadClass(e.detail));
      continue;
    }
  }
  // WRONG PAGE executions: the reasoning row names the page.
  for (const r of reasoningRows || []) {
    if (!r || r.action !== 'browser_type') continue;
    const result = String(r.result || '');
    if (!result.startsWith('WRONG PAGE')) continue;
    const m = /WRONG PAGE — you are on (\S+),/.exec(result);
    const pg = m ? surfacePageOfUrl(m[1]) : currentPage;
    const call = typeCalls[typeIdx];
    typeIdx++;
    if (call) bump('browser_type', pg.host, pg.path, classifyPayloadClass(call.detail));
  }
  return counts;
}

/**
 * Gate verdict for one parsed browser_type against the surface
 * record: { tool, pageHost, payloadClass, count, key } when the
 * (page, class) combination has already been blocked >=
 * EXHAUSTED_MIN_BLOCKS times, else null. The candidate's page is
 * the live page (currentPageUrl, falling back to the parsed page
 * state) — the page the action would actually land on, never the
 * page the hunter believes it is on.
 */
export function exhaustedSurfaceHit(kind, action, currentPage, counts, pageState = null) {
  if (String(kind || '').toLowerCase() !== 'browser_type') return null;
  const page = String(currentPage || (pageState && pageState.currentUrl) || '');
  const { host: pageHost, path: pagePath } = surfacePageOfUrl(page);
  if (!pageHost) return null;
  const cls = classifyPayloadClass(action && action.text);
  const key = surfaceKey('browser_type', pageHost, pagePath, cls);
  const entry = (counts || new Map()).get(key);
  if (!entry || entry.count < EXHAUSTED_MIN_BLOCKS) return null;
  return { tool: 'browser_type', pageHost, pagePath, page: pageHost + pagePath, payloadClass: cls, count: entry.count, key };
}

function isAuthSurface(pageHost, pageType) {
  if (pageType === 'login' || pageType === 'signup') return true;
  return LOGIN_PAGE_RE.test(String(pageHost || ''));
}

/**
 * The EXHAUSTED block for the screen's never-trimmed region: every
 * closed surface (most-blocked first, top 5), and — when an auth
 * surface is among them — the auth-wall block naming the two
 * routes that remain open: the account path (save_credential,
 * already-saved state included) and unauthenticated recon
 * (target-derived URLs, with the tried/untried marks from the
 * record). Facts only; the brain still chooses.
 */
export function exhaustedSurfaceLines({ counts = null, target = '', credential = null, events = [] } = {}) {
  const rows = [...(counts || new Map()).values()]
    .filter((r) => r.count >= EXHAUSTED_MIN_BLOCKS)
    .sort((a, b) => b.count - a.count || a.pageHost.localeCompare(b.pageHost));
  if (!rows.length) return [];
  const lines = ['=== EXHAUSTED — THESE SURFACES ARE CLOSED (your own record) ==='];
  for (const r of rows.slice(0, 5)) {
    lines.push(`- EXHAUSTED: typing ${r.payloadClass === 'credential' ? 'credentials' : `${r.payloadClass.toUpperCase()} payloads`} on ${r.page || r.pageHost} — blocked ×${r.count} (auth/dedupe/wrong-page). Closed: the gate refuses any further attempt here, whatever the payload wording.`);
  }
  const authRows = rows.filter((r) => isAuthSurface(r.page || r.pageHost));
  if (authRows.length) {
    const total = authRows.reduce((n, r) => n + r.count, 0);
    lines.push('=== AUTH WALL — LOGIN/SIGNUP SURFACE EXHAUSTED ===');
    lines.push(`- The login surface is closed after ${total} blocks. Typing payloads or credentials into it again changes nothing.`);
    if (credential && credential.saved) {
      lines.push(`- Account route: a credential is already saved for this target (${credential.handle}${credential.verified ? ', verified' : ', not yet verified'}) — use_saved_credential with the field labels from a snapshot, then browser_click the submit button. Do not save another one.`);
    } else {
      lines.push(`- Account route: save_credential for ${target} (vaults a login + provisions temp mail), then use_saved_credential + fetch_verification_code. That is the way through the wall.`);
    }
    const recon = reconChecklist({ events, target });
    const open = recon.filter((r) => !r.tried).map((r) => r.url);
    const done = recon.filter((r) => r.tried).map((r) => r.label);
    lines.push(`- Unauthenticated recon (no login needed)${done.length ? ` — done: ${done.join(', ')}` : ''}${open.length ? ` — still open: ${open.join(', ')}` : ' — all five surfaces tried'}.`);
  }
  return lines;
}

/** The observation a blocked exhausted-surface attempt gets: what closed, how many blocks, and the routes that are still open (auth wall → account route + recon; anything else → a different page/class, or act on what is already known). */
export function exhaustedBlockObservation(hit, { target = '', credential = null, events = [] } = {}) {
  const kind = hit.payloadClass === 'credential' ? 'credentials' : `${hit.payloadClass.toUpperCase()} payloads`;
  let out = `BLOCKED — EXHAUSTED SURFACE: typing ${kind} on ${hit.page || hit.pageHost} has already been blocked ×${hit.count} (auth/dedupe/wrong-page). This surface is closed — the gate refuses any further attempt here, whatever the payload wording. `;
  if (isAuthSurface(hit.page || hit.pageHost)) {
    if (credential && credential.saved) {
      out += `The way through is the saved credential (${credential.handle}${credential.verified ? ', verified' : ', not yet verified'}) — use_saved_credential with the field labels from a snapshot, then browser_click the submit button. `;
    } else {
      out += `The way through is an account: save_credential for ${target}, then use_saved_credential + fetch_verification_code. `;
    }
    const recon = reconChecklist({ events, target });
    const open = recon.filter((r) => !r.tried).map((r) => r.url);
    if (open.length) out += `Or work without a login — still open: ${open.join(', ')}.`;
    else out += 'Or work without a login — the five recon surfaces are all tried; find the next unauthenticated surface yourself.';
  } else {
    out += 'Pick a different page, a different payload class, or act on what the snapshots already show.';
  }
  return out;
}
