// Visible-desktop-first routing (27 Oct 2026, owner order).
//
// The brain did its work via headless shell curls — invisible —
// while the live desktop sat on the DVWA login page for hours.
// The gap was routing, not missing actions: shell is listed first
// and is the fastest path; the desktop was an option, never a rule;
// no per-turn heartbeat; the nudge fired only on exhausted
// surfaces; the counters did not see screen-seeing at all.
//
// Asserted here (pure, no network, no Meta):
//   - action-kind classification (desktop vs shell).
//   - shell-login detection (a curl login POST — the visible
//     browser stays logged out after one).
//   - the interactive-task heuristic (login/form/click/open is
//     interactive; a probe is not).
//   - the next-turn nudge: shell-only + interactive (or shell
//     login) earns it; a desktop turn, a research turn, or a
//     shell-only probe turn does not.
//   - the heartbeat block (capped, empty -> no block).
//   - loopCounters sees screen-seeing: see_screen,
//     desktop_click_at, desktop_terminal are counted, and the
//     DESKTOP line names them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_ACTION_KINDS,
  DESKTOP_FIRST_RULE,
  isDesktopAction,
  isShellAction,
  looksLikeShellLogin,
  isInteractiveTask,
  classifyTurn,
  desktopFirstNudge,
  heartbeatBlock,
} from './desktopFirst.js';
import { loopCounters, loopCounterLines } from './pageState.js';

test('classification: desktop actions are desktop, shell is shell, the rest is neither', () => {
  for (const kind of ['browser_open', 'browser_snapshot', 'browser_click', 'browser_type', 'screenshot', 'desktop_snapshot', 'desktop_click', 'desktop_key', 'desktop_screenshot', 'desktop_terminal', 'desktop_click_control', 'desktop_click_at', 'see_screen', 'use_saved_credential', 'save_credential', 'launch_tool']) {
    assert.ok(isDesktopAction(kind), `${kind} is a desktop action`);
    assert.ok(DESKTOP_ACTION_KINDS.has(kind), `${kind} is in the set`);
    assert.equal(isShellAction(kind), false);
  }
  assert.equal(isShellAction('shell'), true);
  assert.equal(isDesktopAction('shell'), false);
  assert.equal(isDesktopAction('search'), false);
  assert.equal(isShellAction('search'), false);
  assert.equal(isDesktopAction('note'), false);
  assert.equal(isDesktopAction('recall'), false);
});

test('DESKTOP_FIRST_RULE names the whole OS, the visible browser, and the shell boundary', () => {
  assert.match(DESKTOP_FIRST_RULE, /WHOLE Kali Linux OS/);
  assert.match(DESKTOP_FIRST_RULE, /browser is one app on the desktop/);
  assert.match(DESKTOP_FIRST_RULE, /curl login does NOT log the visible browser in/);
  assert.match(DESKTOP_FIRST_RULE, /shell only for work that needs no screen/);
  assert.match(DESKTOP_FIRST_RULE, /desktop_click_control/);
  assert.match(DESKTOP_FIRST_RULE, /see_screen/);
});

test('looksLikeShellLogin: a curl login POST is a login; a GET or a probe is not', () => {
  assert.equal(looksLikeShellLogin('curl -s -X POST http://172.17.0.1:3100/login.php -d "username=admin&password=password&Login=Login"'), true);
  assert.equal(looksLikeShellLogin("curl -s http://172.17.0.1:3100/login.php -d 'username=admin&password=password'"), true);
  assert.equal(looksLikeShellLogin('curl -s -u admin:password http://172.17.0.1:3100/login.php'), true);
  assert.equal(looksLikeShellLogin('wget --post-data="username=admin&password=x" http://172.17.0.1:3100/login.php'), true);
  assert.equal(looksLikeShellLogin('curl -s http://172.17.0.1:3100/login.php'), false);
  assert.equal(looksLikeShellLogin("curl -s 'http://172.17.0.1:3100/vulnerabilities/sqli/?id=1'"), false);
  assert.equal(looksLikeShellLogin('nmap -sV 172.17.0.1'), false);
  assert.equal(looksLikeShellLogin(''), false);
});

test('isInteractiveTask: login/form/click/open/explore is interactive; a probe is not', () => {
  assert.equal(isInteractiveTask('log into DVWA with default creds'), true);
  assert.equal(isInteractiveTask('DVWA login with default creds'), true);
  assert.equal(isInteractiveTask('fill the login form and click Login'), true);
  assert.equal(isInteractiveTask('open the vulnerabilities page and click around'), true);
  assert.equal(isInteractiveTask('explore the DVWA modules'), true);
  assert.equal(isInteractiveTask('browse to the security page and set level low'), true);
  assert.equal(isInteractiveTask('probe SQLi on /login.php'), false);
  assert.equal(isInteractiveTask('research XSS payloads for the search box'), false);
  assert.equal(isInteractiveTask('run nmap against the target'), false);
  assert.equal(isInteractiveTask(''), false);
});

test('classifyTurn: shell-only is shell with no desktop; anything else is not', () => {
  assert.deepEqual(classifyTurn(['shell']), { desktopUsed: false, shellUsed: true, shellOnly: true });
  assert.deepEqual(classifyTurn(['shell', 'search']), { desktopUsed: false, shellUsed: true, shellOnly: true });
  assert.deepEqual(classifyTurn(['shell', 'browser_open']), { desktopUsed: true, shellUsed: true, shellOnly: false });
  assert.deepEqual(classifyTurn(['see_screen', 'desktop_click_at']), { desktopUsed: true, shellUsed: false, shellOnly: false });
  assert.deepEqual(classifyTurn(['search']), { desktopUsed: false, shellUsed: false, shellOnly: false });
  assert.deepEqual(classifyTurn(['note']), { desktopUsed: false, shellUsed: false, shellOnly: false });
  assert.deepEqual(classifyTurn([]), { desktopUsed: false, shellUsed: false, shellOnly: false });
});

test('desktopFirstNudge: shell-only interactive turn earns the nudge; the rest do not', () => {
  const nudge = desktopFirstNudge({ kinds: ['shell'], task: 'log into DVWA with default creds', shellLogin: false });
  assert.match(nudge, /visible desktop/);
  assert.match(nudge, /could not see it/);
  // A shell login earns the stronger nudge: the visible browser is still logged out.
  const loginNudge = desktopFirstNudge({ kinds: ['shell'], task: 'probe the login page', shellLogin: true });
  assert.match(loginNudge, /STILL LOGGED OUT/);
  assert.match(loginNudge, /browser_open the login page/);
  // No nudge: a desktop turn, a research turn, a shell-only probe turn, an empty turn.
  assert.equal(desktopFirstNudge({ kinds: ['shell', 'browser_open'], task: 'log into DVWA', shellLogin: false }), '');
  assert.equal(desktopFirstNudge({ kinds: ['search'], task: 'research XSS payloads', shellLogin: false }), '');
  assert.equal(desktopFirstNudge({ kinds: ['shell'], task: 'probe SQLi on /login.php', shellLogin: false }), '');
  assert.equal(desktopFirstNudge({ kinds: [], task: '', shellLogin: false }), '');
  assert.equal(desktopFirstNudge(null), '');
});

test('heartbeatBlock: a fresh screen read, capped; empty observation means no block', () => {
  const block = heartbeatBlock('Page: Login :: DVWA — Username Password Login');
  assert.equal(block[0], '=== WHAT IS ON YOUR SCREEN RIGHT NOW (your browser) ===');
  assert.ok(block.join('\n').includes('Username Password Login'));
  const long = heartbeatBlock('x'.repeat(5000));
  assert.ok(long.join('\n').length < 1000, 'the block is capped');
  assert.ok(long.join('\n').includes('…'));
  assert.deepEqual(heartbeatBlock(''), []);
  assert.deepEqual(heartbeatBlock('   '), []);
  assert.deepEqual(heartbeatBlock(null), []);
});

test('loopCounters sees screen-seeing: see_screen, desktop_click_at, desktop_terminal count', () => {
  const events = [
    { type: 'tool_call', tool: 'see_screen', detail: '' },
    { type: 'tool_call', tool: 'see_screen', detail: '' },
    { type: 'tool_call', tool: 'desktop_click_at', detail: '1240,310' },
    { type: 'tool_call', tool: 'desktop_terminal', detail: 'nmap -sV 172.17.0.1' },
    { type: 'tool_call', tool: 'desktop_click', detail: 'Burp Suite' },
    { type: 'tool_call', tool: 'shell', detail: 'curl http://172.17.0.1:3100/' },
  ];
  const c = loopCounters({ events });
  assert.equal(c.seeScreens, 2);
  assert.equal(c.desktopClickAts, 1);
  assert.equal(c.desktopTerminals, 1);
  assert.equal(c.desktopClicks, 1);
  const lines = loopCounterLines(c).join('\n');
  assert.match(lines, /screen reads 2/);
  assert.match(lines, /coordinate clicks 1/);
  assert.match(lines, /visible terminal runs 1/);
  // A hunt that only ever looked at the screen still counts as desktop-used.
  const used = (c.desktopClicks || 0) + (c.desktopKeys || 0) + (c.desktopClickControls || 0) + (c.seeScreens || 0) + (c.desktopClickAts || 0) + (c.desktopTerminals || 0) > 0;
  assert.equal(used, true);
});
