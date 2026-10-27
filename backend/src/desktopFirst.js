// Visible-desktop-first routing (27 Oct 2026, owner order).
//
// ROOT CAUSE (measured live, 22:56 IST 27 Oct 2026): the brain does
// its work via headless shell curls, which are INVISIBLE — the live
// desktop sat on the DVWA login page for hours while the owner
// watched the screen and saw nothing move. The brain HAS desktop
// actions (browser_open, see_screen, desktop_click_at,
// desktop_click_control, desktop_key, desktop_terminal) but barely
// uses them (0 see_screen / 0 desktop_click_at as of 21:19 IST).
// The gap was NOT missing actions — it was a routing gap:
//
//   1. Shell is listed FIRST in the action list ("run any shell
//      command... curl, nmap, python3, anything installed") and is
//      the fastest path: one curl returns a full page; the desktop
//      path needs open -> snapshot -> click -> type -> snapshot.
//      The desktop was described as an OPTION ("you CAN open
//      pages..."), never as a routing rule, so the brain's
//      economics rationally picked shell every time.
//   2. No per-turn desktop heartbeat: the loop snapshots the
//      browser ONCE per session and takes machine state via shell
//      `pwd; ls`; the DESKTOP block on the screen only updates when
//      the brain itself takes desktop_snapshot — which it never
//      does. The brain never gets a fresh picture of its screen.
//   3. The desktop nudge fired too late: only when a browser
//      surface was exhausted AND the desktop was never used — never
//      for the common case of interactive work done via shell turn
//      after turn.
//   4. The counters did not see screen-seeing: loopCounters counted
//      desktop clicks/keys/control-clicks but NOT see_screen,
//      desktop_click_at or desktop_terminal, so a brain that looked
//      at the screen and clicked coordinates still counted as
//      "desktop never used".
//   5. A shell login leaves the visible browser logged out: a curl
//      login stores cookies in curl's jar, not the container
//      Chromium's cookie jar. Nothing in the loop said so.
//
// FULL-OS CONTROL (owner clarification, 27 Oct ~23:08 IST): the
// agent controls the WHOLE Kali Linux OS, not just the browser —
// the browser is one app on the desktop. Commands/scripts may run
// in the background, but ALL interactive work happens on the
// visible desktop, exactly like a human: launching tools (Burp
// Suite, Wireshark, ZAP, any tool the brain wants), operating
// their GUIs, downloading/installing tools itself, opening any
// app, switching windows, using the whole OS.
//
// This module is the routing layer: pure helpers the human loop
// wires in. It routes HOW an action is performed, never WHICH
// vulnerability to try — the brain still chooses its targets and
// probes; nothing here is predefined. Shell probe paths (SQLi/XSS
// via curl) are untouched: the rule covers INTERACTIVE steps only.
//
//   DESKTOP_FIRST_RULE — the prompt section (whole-OS wording)
//   isDesktopAction / isShellAction — the action-kind classifier
//   looksLikeShellLogin — a curl/wget login POST (the visible
//     browser stays logged out after one)
//   isInteractiveTask — the task-text heuristic (login/form/click/
//     open/navigate/explore/browse/module)
//   classifyTurn — what the last turn did (desktop vs shell-only)
//   desktopFirstNudge — the next-turn nudge line (a nudge, never
//     a forced action choice — the brain still chooses)
//   heartbeatBlock — the per-turn screen read, capped
//
// No network, no Meta, no live hunts — pure functions, unit-tested
// in desktopFirst.test.js.

/** Action kinds that happen ON the visible desktop (the owner sees them). */
export const DESKTOP_ACTION_KINDS = new Set([
  'browser_open',
  'browser_snapshot',
  'browser_click',
  'browser_type',
  'screenshot',
  'desktop_snapshot',
  'desktop_click',
  'desktop_key',
  'desktop_screenshot',
  'desktop_terminal',
  'desktop_click_control',
  'desktop_click_at',
  'see_screen',
  'use_saved_credential',
  'save_credential',
  // TOOLS-AUTONOMY lane (feat/tools-autonomy, eb79a9c): launch_tool
  // opens a GUI tool on the desktop. It is not merged yet; listing
  // it here only classifies it once it lands — an unknown kind
  // before then is refused by the loop as "Unknown action".
  'launch_tool',
]);

/** The headless shell action — invisible work. */
export function isShellAction(kind) {
  return String(kind || '').toLowerCase() === 'shell';
}

/** True when the action kind happens on the visible desktop. */
export function isDesktopAction(kind) {
  return DESKTOP_ACTION_KINDS.has(String(kind || '').toLowerCase());
}

// ---------------------------------------------------------------------------
// The prompt section — whole-OS desktop-first routing.
// ---------------------------------------------------------------------------

export const DESKTOP_FIRST_RULE =
  'VISIBLE DESKTOP FIRST — the owner watches your whole desktop live, and this is how he sees you hunt. You control the WHOLE Kali Linux OS, not just the browser — the browser is one app on the desktop. ALL interactive work happens ON the visible desktop, exactly like a human at the machine: opening pages, logging in, filling forms, clicking through the app, exploring modules, launching tools (Burp Suite, Wireshark, ZAP, any tool you want), operating their GUIs, switching windows, opening any app. Use shell only for work that needs no screen: probes (curl payloads), scans, scripts, downloads and installs — those may run in the background, but the moment you USE a tool, you use it on the desktop where the owner can see it. A curl login does NOT log the visible browser in — if you log in, do it in the browser so the owner sees the authenticated surface. Launch a tool\'s GUI with launch_tool when it is listed among your actions, otherwise start it in desktop_terminal so the owner watches it open; then see_screen to find its window, desktop_click / desktop_click_control to work it (named controls first, screen-map coordinates as the fallback), desktop_key to type. Look, then act, then look again — your thinking is visible through what you do on screen.';

// ---------------------------------------------------------------------------
// Shell-login detection — a curl/wget login POST.
// ---------------------------------------------------------------------------

const LOGIN_URL_RE = /(login|signin|sign-in|auth|session)/i;
const CREDENTIAL_FIELD_RE = /(user(name)?|pass(word)?|login|email)/i;

/**
 * True when a shell command looks like a login POST: a curl/wget
 * against a login-ish URL carrying credential fields (or -d/--data
 * with a user/pass pair). A plain GET of a login page is NOT a
 * login attempt — reading the form is fine. Pure.
 */
export function looksLikeShellLogin(command) {
  const cmd = String(command || '');
  if (!/^\s*(curl|wget)\b/i.test(cmd)) return false;
  if (!LOGIN_URL_RE.test(cmd)) return false;
  // A POST body (-d/--data/--data-*/--post-data) or a form post
  // (-F/--form) carrying credential fields, or basic auth (-u
  // user:pass). A plain GET of a login page is NOT a login
  // attempt — reading the form is fine.
  const hasBody = /(-d\b|--data(-\w+)?\b|--post-data\b)/i.test(cmd);
  const hasForm = /(-F\b|--form\b)/i.test(cmd);
  const hasBasicAuth = /\s-u\s+\S+:\S+/.test(cmd) || /--user\s+\S+:\S+/.test(cmd);
  if (hasBasicAuth) return true;
  if ((hasBody || hasForm) && CREDENTIAL_FIELD_RE.test(cmd)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Interactive-task heuristic — the task text, not the action.
// ---------------------------------------------------------------------------

const INTERACTIVE_TASK_RE = /\b(log ?in(?:to)?|sign ?in|sign ?up|log ?out|password|forms?|fill\w*|click\w*|open\w*|navigat\w*|explor\w*|brows\w*|module\w*|click through|walk through|poke around|look around)\b/i;
// A task that SAYS probe/test/scan is a probe task, even when it
// names a login endpoint ("probe SQLi on /login.php" mentions
// login, but it is a curl probe, not interactive work).
const PROBE_TASK_RE = /\b(probe|probing|test|testing|scan|scanning|fuzz|fuzzing|inject|payload|bypass|enumerat\w*)\b/i;

/**
 * True when the brain's current task is interactive work — the
 * kind a human does with eyes and hands on the desktop — rather
 * than a headless probe ("probe SQLi on /login.php" is a probe,
 * "log into DVWA" is interactive). The task text decides, never
 * the action kind: a shell curl CAN be the wrong tool for an
 * interactive task, and a browser_open CAN serve a probe. Pure.
 */
export function isInteractiveTask(task) {
  const t = String(task || '');
  if (PROBE_TASK_RE.test(t)) return false;
  return INTERACTIVE_TASK_RE.test(t);
}

// ---------------------------------------------------------------------------
// Turn classification + the next-turn nudge.
// ---------------------------------------------------------------------------

/**
 * Classify one turn's executed action kinds. shellOnly is true
 * when the turn ran at least one shell action and NO desktop
 * action — the invisible case. Research turns (search only, or
 * note/recall only) have no shell action and are not shell-only.
 * Pure.
 */
export function classifyTurn(kinds) {
  const list = (kinds || []).map((k) => String(k || '').toLowerCase());
  const desktopUsed = list.some((k) => isDesktopAction(k));
  const shellUsed = list.some((k) => isShellAction(k));
  return {
    desktopUsed,
    shellUsed,
    shellOnly: shellUsed && !desktopUsed,
  };
}

/**
 * The desktop nudge for the NEXT screen, from the PREVIOUS turn.
 * prev = { kinds: [...executed action kinds], task: current task
 * text, shellLogin: a shell login was attempted }. Returns '' when
 * no nudge is due. A nudge, never a forced action choice: the
 * brain still chooses what to try — the loop only says HOW the
 * interactive step should be done (on the visible desktop) and
 * WHY (the owner watches; a curl login leaves the visible
 * browser logged out). Pure.
 */
export function desktopFirstNudge(prev) {
  const kinds = (prev && prev.kinds) || [];
  const task = String((prev && prev.task) || '');
  const shellLogin = Boolean(prev && prev.shellLogin);
  const { shellOnly } = classifyTurn(kinds);
  if (!shellOnly) return '';
  if (!shellLogin && !isInteractiveTask(task)) return '';
  if (shellLogin) {
    return 'Your last turn logged in via shell (curl) — the owner could not see it, and the visible browser is STILL LOGGED OUT (a curl login does not log the browser in). Do the login in the visible browser next: browser_open the login page, browser_type the credentials, browser_click Login, then confirm the Logout link on screen.';
  }
  return `Your last turn did interactive work ("${task.slice(0, 80)}") via shell only — the owner could not see it. Do the next interactive step on the visible desktop (browser_open / browser_click / browser_type / see_screen / desktop_click_at), so he watches you hunt.`;
}

// ---------------------------------------------------------------------------
// Per-turn desktop heartbeat — the screen read every turn starts with.
// ---------------------------------------------------------------------------

export const DESKTOP_HEARTBEAT_BUDGET = 600; // chars of screen text per turn

/**
 * Format a fresh browser snapshot observation into the heartbeat
 * block: "WHAT IS ON YOUR SCREEN RIGHT NOW" — the freshest truth
 * about the visible browser, shown every turn so the brain never
 * acts blind. Capped (the snapshot itself is the full detail, and
 * the brain can browser_snapshot for more). Empty observation ->
 * no block. Pure.
 */
export function heartbeatBlock(observation) {
  const text = String(observation || '').trim();
  if (!text) return [];
  const clipped = text.length > DESKTOP_HEARTBEAT_BUDGET
    ? `${text.slice(0, DESKTOP_HEARTBEAT_BUDGET)}…`
    : text;
  return [
    '=== WHAT IS ON YOUR SCREEN RIGHT NOW (your browser) ===',
    clipped,
    '(Fresh this turn — act against what is actually on screen, not from memory. browser_snapshot for the full page.)',
  ];
}
