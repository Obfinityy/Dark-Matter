// Page state + loop counters (Infinity level, 26 Oct 2026).
//
// The sense-act loop's record: every browser snapshot is parsed
// into a page-state record (current URL, page type, interactive
// elements with tried/untried marks), and the loop counters measure
// the loop itself — snapshots taken vs acted on, clicks, distinct
// pages/elements, payloads planned vs sent, no-reply turns, and the
// desktop equivalents — so the parent can check the loop with
// numbers instead of a claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPageType,
  normalisePageUrl,
  emptyPageState,
  parseSnapshot,
  mergePageState,
  markElementClicked,
  markTypedInto,
  pageStateLines,
  loopCounters,
  loopCounterLines,
  reconChecklist,
  coverageSummaryLines,
} from './pageState.js';

const LOGIN_SNAP = {
  url: 'https://login.infomaniak.com/login',
  title: 'Sign in',
  text: 'Sign in to your account Email Password',
  elements: [
    { label: 'Email', tag: 'input', type: 'email', id: 'email' },
    { label: 'Password', tag: 'input', type: 'password', id: 'password' },
    { label: 'Sign in', tag: 'button', id: 'submit' },
    { label: 'Create an account', tag: 'a', href: 'https://login.infomaniak.com/signup' },
  ],
};

test('classifyPageType: the URL wins; the text fallback covers SPAs', () => {
  assert.equal(classifyPageType('https://login.infomaniak.com/login'), 'login');
  assert.equal(classifyPageType('https://ksuite.infomaniak.com/signup'), 'signup');
  assert.equal(classifyPageType('https://ksuite.infomaniak.com/dashboard'), 'dashboard');
  assert.equal(classifyPageType('https://ksuite.infomaniak.com/pricing'), 'other');
  // A password field plus "sign in" means login even when the URL says nothing.
  assert.equal(classifyPageType('https://ksuite.infomaniak.com/', 'Sign in Password'), 'login');
  // A "create an account" call with NO password field is signup, not login.
  assert.equal(classifyPageType('https://ksuite.infomaniak.com/', 'Create an account'), 'signup');
});

test('normalisePageUrl strips query and fragment; host lowercased', () => {
  assert.equal(normalisePageUrl('https://Ksuite.Infomaniak.com/login?next=/x#frag'), 'https://ksuite.infomaniak.com/login');
});

test('parseSnapshot keeps the structured snapshot (URL, type, elements)', () => {
  const p = parseSnapshot(LOGIN_SNAP);
  assert.equal(p.url, 'https://login.infomaniak.com/login');
  assert.equal(p.pageType, 'login');
  assert.equal(p.elements.length, 4);
  assert.equal(p.elements[0].label, 'Email');
});

test('mergePageState unions elements across snapshots and keeps clicked counts', () => {
  let st = emptyPageState();
  st = mergePageState(st, LOGIN_SNAP);
  assert.equal(st.currentUrl, 'https://login.infomaniak.com/login');
  assert.equal(st.currentPageType, 'login');
  assert.equal(Object.keys(st.pages).length, 1);
  st = markElementClicked(st, LOGIN_SNAP.url, 'Sign in');
  const page = st.pages[st.currentUrl];
  assert.equal(page.elements['sign in'].clicked, 1);
  // A second snapshot of the same page unions (no duplicate elements) and keeps the click.
  st = mergePageState(st, LOGIN_SNAP);
  assert.equal(Object.keys(st.pages[st.currentUrl].elements).length, 4);
  assert.equal(st.pages[st.currentUrl].elements['sign in'].clicked, 1);
  assert.equal(st.pages[st.currentUrl].snapshots, 2);
});

test('markTypedInto counts types on the page', () => {
  let st = mergePageState(emptyPageState(), LOGIN_SNAP);
  st = markTypedInto(st, LOGIN_SNAP.url);
  assert.equal(st.pages[st.currentUrl].typedInto, 1);
});

test('pageStateLines marks untried elements first and names the true page', () => {
  let st = mergePageState(emptyPageState(), LOGIN_SNAP);
  st = markElementClicked(st, LOGIN_SNAP.url, 'Sign in');
  const lines = pageStateLines(st);
  assert.ok(lines.some((l) => l.includes('https://login.infomaniak.com/login')));
  assert.ok(lines.some((l) => l.includes('type: login')));
  assert.ok(lines.some((l) => l.includes('[x] clicked ×1') && l.includes('Sign in')));
  assert.ok(lines.some((l) => l.includes('[ ] not yet tried') && l.includes('Email')));
  // Untried elements come before tried ones.
  const emailIdx = lines.findIndex((l) => l.includes('"Email"'));
  const signInIdx = lines.findIndex((l) => l.includes('"Sign in"'));
  assert.ok(emailIdx !== -1 && signInIdx !== -1 && emailIdx < signInIdx);
});

test('pageStateLines is empty before any snapshot', () => {
  assert.deepEqual(pageStateLines(emptyPageState()), []);
});

function toolCall(tool, detail) {
  return { type: 'tool_call', tool, detail };
}

test('loopCounters measures the sense-act loop from the record', () => {
  const events = [
    toolCall('browser_open', 'https://login.infomaniak.com/login'),
    toolCall('browser_snapshot', ''),
    toolCall('browser_click', 'Sign in'),
    toolCall('browser_snapshot', ''),
    toolCall('browser_open', 'https://ksuite.infomaniak.com/dashboard'),
    toolCall('load_skill', 'sqli'),
    toolCall('shell', "curl -s ' OR 1=1--"),
    { type: 'thinking', text: 'Brain gave no reply this turn.' },
  ];
  const c = loopCounters({ events, isProbe: (d) => /OR 1=1/.test(d) });
  // "Snapshots taken" counts every browser sense-act action (open /
  // snapshot / click / type — each one returns a snapshot
  // observation), not just browser_snapshot calls.
  assert.equal(c.snapshotsTaken, 5);
  assert.equal(c.snapshotsActedOn, 1, 'only the snapshot followed by a click on the same host counts');
  assert.equal(c.clicks, 1);
  assert.equal(c.distinctPages, 2);
  assert.equal(c.payloadsPlanned, 1);
  assert.equal(c.payloadsSent, 1);
  assert.equal(c.noReplyTurns, 1);
});

test('loopCounters: a snapshot followed by navigation is NOT acted on', () => {
  const events = [
    toolCall('browser_open', 'https://a.example/'),
    toolCall('browser_snapshot', ''),
    toolCall('browser_open', 'https://b.example/'),
  ];
  const c = loopCounters({ events });
  assert.equal(c.snapshotsTaken, 3, 'open + snapshot + open all count as browser sense-act actions');
  assert.equal(c.snapshotsActedOn, 0);
});

test('loopCounters: desktop actions count separately (WHOLE-OS)', () => {
  const events = [
    toolCall('desktop_snapshot', ''),
    toolCall('desktop_click', 'Burp Suite'),
    toolCall('desktop_snapshot', ''),
    toolCall('desktop_key', 'ctrl+l'),
    toolCall('desktop_screenshot', ''),
    toolCall('desktop_click', 'Terminal'),
  ];
  const c = loopCounters({ events });
  assert.equal(c.desktopSnapshots, 2);
  assert.equal(c.desktopSnapshotsActedOn, 2, 'each snapshot is followed by a desktop action');
  assert.equal(c.desktopClicks, 2);
  assert.equal(c.desktopKeys, 1);
  assert.equal(c.desktopScreenshots, 1);
  assert.equal(c.distinctWindowsInteracted, 2);
  assert.equal(c.snapshotsTaken, 0, 'desktop snapshots do not inflate the browser count');
});

test('loopCounterLines renders the desktop line only when desktop actions exist', () => {
  const browserOnly = loopCounterLines(loopCounters({ events: [toolCall('browser_snapshot', '')] }));
  assert.equal(browserOnly.length, 1);
  assert.match(browserOnly[0], /LOOP:/);
  const withDesktop = loopCounterLines(loopCounters({
    events: [toolCall('desktop_snapshot', ''), toolCall('desktop_click', 'Burp Suite')],
  }));
  assert.equal(withDesktop.length, 2);
  assert.match(withDesktop[1], /DESKTOP: snapshots 1 \(acted on 1\)/);
  assert.match(withDesktop[1], /window clicks 1 \(1 windows\)/);
});

test('reconChecklist marks tried surfaces from shell events only', () => {
  const events = [
    toolCall('shell', 'curl -s https://ksuite.infomaniak.com/robots.txt'),
    toolCall('shell', 'curl -s -I https://ksuite.infomaniak.com/'),
  ];
  const list = reconChecklist({ events, target: 'https://ksuite.infomaniak.com' });
  assert.equal(list.find((r) => r.id === 'robots').tried, true);
  assert.equal(list.find((r) => r.id === 'headers').tried, true);
  assert.equal(list.find((r) => r.id === 'sitemap').tried, false);
  assert.equal(list.find((r) => r.id === 'sitemap').url, 'https://ksuite.infomaniak.com/sitemap.xml');
});

test('coverageSummaryLines names pages, recon, account and payloads', () => {
  const st = mergePageState(emptyPageState(), LOGIN_SNAP);
  const lines = coverageSummaryLines({
    events: [toolCall('browser_open', LOGIN_SNAP.url)],
    pageState: st,
    target: 'https://ksuite.infomaniak.com',
    credential: null,
    counters: loopCounters({ events: [toolCall('browser_open', LOGIN_SNAP.url)], pageState: st }),
  });
  assert.ok(lines.some((l) => l.includes('Pages visited: 1')));
  assert.ok(lines.some((l) => l.includes('robots.txt ○')));
  assert.ok(lines.some((l) => l.includes('no credential saved')));
  assert.ok(lines.some((l) => l.includes('Payloads: planned 0, sent 0')));
});
