// Dark Matter — PARSED PAGE STATE + LOOP COUNTERS (Infinity level, 26 Oct 2026).
//
// The sense-act loop, root-caused live on the Infomaniak hunt
// (h_de4fc035049d, 44h, iter 108, 0 verified):
//
//   * Snapshots are EPHEMERAL. A snapshot observation reaches the
//     brain once — as lastObservation on the next screen — and is
//     then gone: note()/log keep 300 chars of it, the next action's
//     observation replaces it, and nothing ever parses it into
//     state. The brain must remember 40 element labels from one
//     4200-char glimpse, and its permanent record of the page is a
//     300-char stub. So it re-derives the wrong premise every turn
//     ("I am on the signup page") while standing on the login page.
//   * Clicks are 4 of 195 tool calls. Nothing ever listed which
//     interactive elements exist on the current page, let alone
//     which were tried — the brain cannot choose a click it cannot
//     see, and the record cannot tell a tried element from an
//     untried one.
//   * Breadth is 6 distinct browser URLs in 44h. Nothing tracked
//     pages visited, elements interacted with, or unauthenticated
//     recon surfaces tried, so the hunt could circle one page
//     forever with no counter moving.
//
// This module fixes the STATE side, deterministically. It never
// chooses an action and never writes a prompt hint: it parses
// every snapshot the driver returns into a page-state record
// (current URL, page type, interactive elements with tried/untried
// marks), persists it per hunt (pageState.json, the coverage-ledger
// idiom), and derives the loop counters from the record. The loop
// renders the record on screen; the brain still chooses — but from
// a state that shows the true page and its untried elements.
//
// Storage: backend/data/hunts/<hunt-id>/pageState.json, written
// atomically (tmp + rename, the store.js idiom). Reads are
// tolerant: a missing or corrupt file degrades to an empty record
// and never throws into the hunt loop.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteJson } from './atomicWrite.js';
import { huntDir, ensureHuntDir } from './store.js';

export const PAGE_STATE_VERSION = 1;
const MAX_PAGES = 12; // distinct pages kept, most-recent first
const MAX_ELEMENTS_PER_PAGE = 40; // same cap as the snapshot's element list
const MAX_ELEMENT_LINES = 12; // element lines on the screen block

function hostOf(u) {
  try {
    return new URL(String(u || '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function pathOf(u) {
  try {
    return new URL(String(u || '')).pathname || '/';
  } catch {
    return '/';
  }
}

/** Canonical page identity: origin + path, no query/fragment. */
export function normalisePageUrl(u) {
  try {
    const x = new URL(String(u || ''));
    return `${x.protocol.toLowerCase()}//${x.hostname.toLowerCase()}${x.pathname || '/'}`;
  } catch {
    return String(u || '').trim().toLowerCase();
  }
}

function normLabel(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 80);
}

/**
 * Page type from the URL first, snapshot text second. The URL wins
 * when it names the surface; the text fallback exists for SPAs
 * whose routes all read '/' — a password field plus 'sign in'
 * means login even when the URL says nothing, and a page with a
 * 'create an account' call but no password field is a signup
 * page. A login page ALSO links to signup, so the password field
 * is the discriminator, never the link text.
 */
export function classifyPageType(url, text = '') {
  const p = pathOf(url).toLowerCase();
  if (/\/login|\/signin|\/sign-in|\/auth|\/authorize/.test(p)) return 'login';
  if (/\/signup|\/sign-up|\/register|\/registration/.test(p)) return 'signup';
  if (/\/dashboard|\/app(\/|$)|\/home|\/account/.test(p)) return 'dashboard';
  const t = String(text || '').toLowerCase();
  const hasPasswordField = /password/i.test(t);
  if (hasPasswordField && /sign[\s-]?in/.test(t)) return 'login';
  if (/create (an )?account|sign[\s-]?up|register (a|an|your|for)/.test(t) && !hasPasswordField) return 'signup';
  if (/dashboard/.test(t)) return 'dashboard';
  return 'other';
}

/** Empty page-state record. */
export function emptyPageState() {
  return { version: PAGE_STATE_VERSION, currentUrl: '', currentPageType: 'other', pages: {}, order: [] };
}

function pageStateFile(huntId) {
  return path.join(huntDir(huntId), 'pageState.json');
}

export function loadPageState(huntId) {
  try {
    const raw = fs.readFileSync(pageStateFile(huntId), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.pages || typeof data.pages !== 'object') return emptyPageState();
    return { ...emptyPageState(), ...data };
  } catch {
    return emptyPageState();
  }
}

export function savePageState(huntId, state) {
  try {
    ensureHuntDir(huntId);
    atomicWriteJson(pageStateFile(huntId), state, { space: 0 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse one structured snapshot ({url, title, text, elements} — the
 * shape the CDP driver and the headless fallback both return) into
 * a page-state fragment. Pure. Elements are keyed by normalised
 * label (what the brain clicks by); an untitled element falls back
 * to tag:id/name and is skipped when even that is empty, since the
 * brain could never reference it.
 */
export function parseSnapshot(snap) {
  const url = String((snap && snap.url) || '');
  const title = String((snap && snap.title) || '');
  const pageType = classifyPageType(url, (snap && snap.text) || '');
  const elements = [];
  const seen = new Set();
  for (const el of (snap && Array.isArray(snap.elements) ? snap.elements : []).slice(0, MAX_ELEMENTS_PER_PAGE)) {
    const label = String(el.label || '').trim().slice(0, 80);
    const id = String(el.id || '');
    const name = String(el.name || '');
    const key = normLabel(label) || normLabel(`${el.tag || 'el'}:${id || name}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    elements.push({
      key,
      label: label || `${el.tag || 'element'}${id ? ` #${id}` : ''}`,
      tag: String(el.tag || ''),
      type: String(el.type || ''),
      href: String(el.href || ''),
      name,
      id,
      clicked: 0,
    });
  }
  return { url: normalisePageUrl(url), rawUrl: url, title, pageType, elements };
}

/**
 * Merge a parsed snapshot into the accumulated record. Union of
 * elements (clicked counts preserved); the merged page becomes the
 * current page; pages cap at MAX_PAGES, most-recent first. Pure —
 * returns a fresh record.
 */
export function mergePageState(prev, snap, { at = new Date().toISOString() } = {}) {
  const state = prev && typeof prev === 'object' ? JSON.parse(JSON.stringify(prev)) : emptyPageState();
  if (!state.pages || typeof state.pages !== 'object') state.pages = {};
  if (!Array.isArray(state.order)) state.order = [];
  const parsed = parseSnapshot(snap);
  if (!parsed.url) return state;
  const existing = state.pages[parsed.url] || {
    url: parsed.url,
    pageType: parsed.pageType,
    title: parsed.title,
    lastSeenAt: at,
    snapshots: 0,
    typedInto: 0,
    elements: {},
  };
  existing.pageType = parsed.pageType;
  existing.title = parsed.title || existing.title;
  existing.lastSeenAt = at;
  existing.snapshots = (existing.snapshots || 0) + 1;
  if (!existing.elements || typeof existing.elements !== 'object') existing.elements = {};
  for (const el of parsed.elements) {
    if (!existing.elements[el.key]) existing.elements[el.key] = { ...el };
  }
  state.pages[parsed.url] = existing;
  state.order = [parsed.url, ...state.order.filter((u) => u !== parsed.url)].slice(0, MAX_PAGES);
  for (const u of Object.keys(state.pages)) {
    if (!state.order.includes(u)) delete state.pages[u];
  }
  state.currentUrl = parsed.url;
  state.currentPageType = parsed.pageType;
  return state;
}

/** Mark one element clicked (label matched as the driver matches it). Pure. */
export function markElementClicked(prev, url, label) {
  const state = prev && typeof prev === 'object' ? JSON.parse(JSON.stringify(prev)) : emptyPageState();
  const key = normalisePageUrl(url);
  const page = state.pages && state.pages[key];
  if (!page || !page.elements) return state;
  const el = page.elements[normLabel(label)];
  if (el) el.clicked = (el.clicked || 0) + 1;
  return state;
}

/** Mark a browser_type executed while on a page (page-level: the type action carries no field identity). Pure. */
export function markTypedInto(prev, url) {
  const state = prev && typeof prev === 'object' ? JSON.parse(JSON.stringify(prev)) : emptyPageState();
  const key = normalisePageUrl(url);
  const page = state.pages && state.pages[key];
  if (!page) return state;
  page.typedInto = (page.typedInto || 0) + 1;
  return state;
}

function elementCount(page) {
  return page && page.elements ? Object.keys(page.elements).length : 0;
}

function clickedCount(page) {
  if (!page || !page.elements) return 0;
  return Object.values(page.elements).filter((e) => (e.clicked || 0) > 0).length;
}

/**
 * The current-page block for the screen's never-trimmed perception
 * region: the true page (URL + type), its interactive elements
 * with tried [x] / untried [ ] marks (untried first — the choice
 * set an expert works from), and the hunt-wide page/element
 * totals. A click never tried is never shown as done: only a
 * recorded browser_click flips a mark.
 */
export function pageStateLines(state, { target = '' } = {}) {
  if (!state || !state.currentUrl) return [];
  const page = (state.pages || {})[state.currentUrl];
  const lines = [
    '=== CURRENT PAGE (parsed from your last snapshot — this is the page you are actually looking at) ===',
    `- ${state.currentUrl} — type: ${state.currentPageType}${page && page.title ? ` (${page.title})` : ''}`,
  ];
  const totalElements = Object.values(state.pages || {}).reduce((n, p) => n + elementCount(p), 0);
  const totalClicked = Object.values(state.pages || {}).reduce((n, p) => n + clickedCount(p), 0);
  const totalPages = Object.keys(state.pages || {}).length;
  if (page && page.elements) {
    const els = Object.values(page.elements);
    const untried = els.filter((e) => !(e.clicked > 0));
    const tried = els.filter((e) => e.clicked > 0);
    lines.push(`- Interactive elements on this page (${els.length} seen — untried first):`);
    const show = [...untried, ...tried].slice(0, MAX_ELEMENT_LINES);
    for (const el of show) {
      const mark = el.clicked > 0 ? `[x] clicked ×${el.clicked}` : '[ ] not yet tried';
      const bits = [`[${el.tag}${el.type ? ` type=${el.type}` : ''}]`, `"${el.label}"`];
      if (el.href) bits.push(`-> ${el.href}`);
      lines.push(`  ${mark} ${bits.join(' ')}`);
    }
    if (els.length > MAX_ELEMENT_LINES) lines.push(`  …and ${els.length - MAX_ELEMENT_LINES} more elements on this page (snapshot again for the full list)`);
  } else {
    lines.push('- No interactive elements parsed for this page yet — take a browser_snapshot to list them.');
  }
  lines.push(`- Pages seen so far: ${totalPages} · elements seen: ${totalElements} · interacted with: ${totalClicked}${target ? ` · target: ${target}` : ''}`);
  return lines;
}

// LOOP COUNTERS — the parent-checkable measurement of the sense-act
// loop. Pure over the hunt's record (+ the accumulated page state
// for elements-seen). Definitions, so the numbers can never be
// re-read as something else:
//   snapshotsTaken   — tool_calls that return a page snapshot
//     (browser_snapshot + browser_open + browser_click +
//     browser_type); each hands the brain a fresh look at a page.
//   snapshotsActedOn — of those, the ones whose NEXT tool_call is
//     a browser_click/browser_type on the SAME page host: the brain
//     used the snapshot's element list to interact, instead of
//     looking and then doing something unrelated.
//   clicks / distinctPages / distinctElements — literal counts.
//   payloadsPlanned — load_skill tool_calls (a plan to probe).
//   payloadsSent    — tool_calls whose detail matches a probe
//     signature (isProbe, supplied by the caller from
//     PROBE_TOPICS); a plan only counts when a payload actually
//     went to the target.
//   noReplyTurns    — 'Brain gave no reply this turn.' thinking
//     events: the brain's generation died, not its choice.

const SNAPSHOT_TOOLS = new Set(['browser_snapshot', 'browser_open', 'browser_click', 'browser_type']);
const PROBE_TOOLS = new Set(['shell', 'browser_type', 'intercept_replay', 'claim_finding']);

export function loopCounters({ events = [], reasoningRows = [], pageState = null, isProbe = null } = {}) {
  const toolCalls = (events || []).filter((e) => e && e.type === 'tool_call');
  let snapshotsTaken = 0;
  let snapshotsActedOn = 0;
  let clicks = 0;
  const clickedLabels = new Set();
  const pages = new Set();
  const elementsInteracted = new Set();
  let payloadsPlanned = 0;
  let payloadsSent = 0;
  // WHOLE-OS (26 Oct 2026): the desktop sense-act loop, counted the
  // same way as the browser one — a desktop_snapshot is acted on
  // when the NEXT action is a desktop_click/desktop_key (the
  // snapshot's window list used to act). Windows interacted with
  // come from desktop_click details (window titles).
  let desktopSnapshots = 0;
  let desktopSnapshotsActedOn = 0;
  let desktopClicks = 0;
  let desktopKeys = 0;
  let desktopScreenshots = 0;
  // REAL-HUMAN: in-app control clicks (AT-SPI) — counted beside
  // window clicks so the loop measures the whole desktop, not just
  // window focus.
  let desktopClickControls = 0;
  // VISIBLE-DESKTOP-FIRST (27 Oct 2026): screen-seeing was
  // invisible to the counters — a brain that looked at the screen
  // and clicked coordinates still counted as "desktop never used".
  // Count the screen reads, the coordinate clicks, and the
  // visible-terminal runs beside the window clicks.
  let seeScreens = 0;
  let desktopClickAts = 0;
  let desktopTerminals = 0;
  const windowsInteracted = new Set();
  let pendingDesktopSnapshot = false;
  // Track the live page host through the stream (browser_open sets
  // it); a snapshot is acted on when the next tool_call interacts
  // with the same host.
  let currentHost = '';
  let pendingSnapshotHost = null;
  const hostOfEvent = (e) => {
    if (e.tool === 'browser_open') {
      const h = hostOf(e.detail);
      if (h) currentHost = h;
      return h;
    }
    return currentHost;
  };
  for (const e of toolCalls) {
    const tool = String(e.tool || '').toLowerCase();
    const detail = String(e.detail || '');
    // A snapshot is acted on when the NEXT action interacts with
    // the SAME page the snapshot showed (browser_click /
    // browser_type — the snapshot's element list used to act).
    // Navigation (browser_open) is not acting on it, and an
    // interaction on a different host is not either. An unknown
    // page host never counts: '' === '' is not evidence.
    if (pendingSnapshotHost) {
      if ((tool === 'browser_click' || tool === 'browser_type') && currentHost === pendingSnapshotHost) {
        snapshotsActedOn++;
      }
      pendingSnapshotHost = null;
    }
    if (pendingDesktopSnapshot) {
      if (tool === 'desktop_click' || tool === 'desktop_key') desktopSnapshotsActedOn++;
      pendingDesktopSnapshot = false;
    }
    // WHOLE-OS: desktop actions count separately from browser ones.
    if (tool === 'desktop_snapshot') { desktopSnapshots++; pendingDesktopSnapshot = true; continue; }
    if (tool === 'desktop_click') { desktopClicks++; if (detail) windowsInteracted.add(detail); continue; }
    if (tool === 'desktop_key') { desktopKeys++; continue; }
    if (tool === 'desktop_screenshot') { desktopScreenshots++; continue; }
    if (tool === 'desktop_click_control') { desktopClickControls++; continue; }
    if (tool === 'see_screen') { seeScreens++; continue; }
    if (tool === 'desktop_click_at') { desktopClickAts++; continue; }
    if (tool === 'desktop_terminal') { desktopTerminals++; continue; }
    if (SNAPSHOT_TOOLS.has(tool)) {
      snapshotsTaken++;
      pendingSnapshotHost = hostOfEvent(e) || currentHost || '';
      if (tool === 'browser_click') {
        clicks++;
        const label = normLabel(detail);
        if (label) {
          clickedLabels.add(label);
          if (currentHost) elementsInteracted.add(`${currentHost}|${label}`);
        }
      }
      if (tool === 'browser_open' && detail) pages.add(normalisePageUrl(detail));
      continue;
    }
    hostOfEvent(e);
    if (tool === 'load_skill') payloadsPlanned++;
    if (PROBE_TOOLS.has(tool) && typeof isProbe === 'function' && isProbe(detail)) payloadsSent++;
  }
  let noReplyTurns = 0;
  for (const e of events || []) {
    if (e && e.type === 'thinking' && String(e.text || '').trim() === 'Brain gave no reply this turn.') noReplyTurns++;
  }
  const pagesSeen = pageState && pageState.pages ? Object.keys(pageState.pages).length : pages.size;
  let elementsSeen = 0;
  let elementsInteractedTotal = 0;
  if (pageState && pageState.pages) {
    for (const p of Object.values(pageState.pages)) {
      elementsSeen += elementCount(p);
      elementsInteractedTotal += clickedCount(p);
    }
  } else {
    elementsInteractedTotal = elementsInteracted.size;
  }
  return {
    snapshotsTaken,
    snapshotsActedOn,
    clicks,
    distinctClickedLabels: clickedLabels.size,
    distinctPages: Math.max(pages.size, pagesSeen),
    distinctElementsInteracted: Math.max(elementsInteracted.size, elementsInteractedTotal),
    elementsSeen,
    payloadsPlanned,
    payloadsSent,
    noReplyTurns,
    desktopSnapshots,
    desktopSnapshotsActedOn,
    desktopClicks,
    desktopKeys,
    desktopScreenshots,
    desktopClickControls,
    seeScreens,
    desktopClickAts,
    desktopTerminals,
    distinctWindowsInteracted: windowsInteracted.size,
  };
}

/** One compact counters line for the screen (rides the page-state block). */
export function loopCounterLines(counters) {
  if (!counters) return [];
  const lines = [
    `LOOP: snapshots ${counters.snapshotsTaken} (acted on ${counters.snapshotsActedOn}) · clicks ${counters.clicks} · pages ${counters.distinctPages} · elements seen ${counters.elementsSeen}, interacted ${counters.distinctElementsInteracted} · payloads planned ${counters.payloadsPlanned}, sent ${counters.payloadsSent} · no-reply turns ${counters.noReplyTurns}`,
  ];
  const desktopTotal = (counters.desktopSnapshots || 0) + (counters.desktopClicks || 0) + (counters.desktopKeys || 0) + (counters.desktopScreenshots || 0) + (counters.desktopClickControls || 0) + (counters.seeScreens || 0) + (counters.desktopClickAts || 0) + (counters.desktopTerminals || 0);
  if (desktopTotal > 0) {
    lines.push(`DESKTOP: snapshots ${counters.desktopSnapshots || 0} (acted on ${counters.desktopSnapshotsActedOn || 0}) · window clicks ${counters.desktopClicks || 0} (${counters.distinctWindowsInteracted || 0} windows) · keystrokes ${counters.desktopKeys || 0} · in-app control clicks ${counters.desktopClickControls || 0} · desktop screenshots ${counters.desktopScreenshots || 0} · screen reads ${counters.seeScreens || 0} · coordinate clicks ${counters.desktopClickAts || 0} · visible terminal runs ${counters.desktopTerminals || 0}`);
  }
  return lines;
}

// UNAUTHENTICATED RECON CHECKLIST — the open work that needs no
// login. Detected from shell tool_calls (a curl that ran), never
// from intent. Target-derived URLs; the loop lists the untried
// ones as the open path when the auth wall is exhausted.

export const RECON_SURFACES = [
  { id: 'robots', label: 'robots.txt', url: (t) => `${originOf(t)}/robots.txt`, re: /robots\.txt/ },
  { id: 'sitemap', label: 'sitemap.xml', url: (t) => `${originOf(t)}/sitemap.xml`, re: /sitemap\.xml/ },
  { id: 'securitytxt', label: 'security.txt', url: (t) => `${originOf(t)}/.well-known/security.txt`, re: /security\.txt/ },
  { id: 'headers', label: 'security headers (curl -I)', url: (t) => `${originOf(t)} (curl -s -I)`, re: /curl\s+[^\n|;&]*(-I\b|--head\b)/ },
  { id: 'jsbundles', label: 'JS bundles (fetch + read)', url: (t) => `${originOf(t)}/*.js`, re: /curl\s+[^\n|;&]*\.js\b/ },
];

function originOf(t) {
  try {
    const u = new URL(String(t || ''));
    return `${u.protocol}//${u.host}`;
  } catch {
    return String(t || '').replace(/\/+$/, '');
  }
}

export function reconChecklist({ events = [], target = '' } = {}) {
  const tried = new Set();
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call' || String(e.tool || '').toLowerCase() !== 'shell') continue;
    const cmd = String(e.detail || '');
    for (const s of RECON_SURFACES) if (s.re.test(cmd)) tried.add(s.id);
  }
  return RECON_SURFACES.map((s) => ({
    ...s,
    tried: tried.has(s.id),
    url: s.url(target),
  }));
}

/**
 * Coverage summary for STATE OF MIND (appended by the loop's
 * state-of-mind computer): pages/elements breadth, the
 * unauthenticated recon checklist, the authenticated-flow state,
 * and the plan-vs-send ledger. All facts from the record; an
 * untried surface is listed as untried, never as done.
 */
export function coverageSummaryLines({ events = [], pageState = null, target = '', credential = null, counters = null } = {}) {
  const c = counters || loopCounters({ events, pageState });
  const recon = reconChecklist({ events, target });
  const lines = ['COVERAGE — WHERE YOU STAND (from your own record):'];
  lines.push(`- Pages visited: ${c.distinctPages} · elements seen: ${c.elementsSeen}, interacted with: ${c.distinctElementsInteracted} · clicks: ${c.clicks}`);
  const reconBits = recon.map((r) => `${r.label} ${r.tried ? '✓' : '○'}`).join(', ');
  lines.push(`- Unauthenticated recon (no login needed): ${reconBits}`);
  if (credential && credential.saved) {
    lines.push(`- Account: credential saved for this target (${credential.handle}${credential.verified ? ', verified' : ', not yet verified'}${credential.used ? `, used ×${credential.used}` : ', never used yet'}) — the authenticated surface is open; use_saved_credential with the field labels from a snapshot.`);
  } else {
    lines.push('- Account: no credential saved for this target yet — save_credential opens the authenticated surface (vaults a login + provisions temp mail).');
  }
  lines.push(`- Payloads: planned ${c.payloadsPlanned}, sent ${c.payloadsSent}${c.payloadsPlanned > c.payloadsSent ? ' — a plan is not a probe until a payload reaches the target' : ''}`);
  return lines;
}
