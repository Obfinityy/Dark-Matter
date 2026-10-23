// Test for the human-mode INTERCEPT WORKFLOW (Lane U, 23 Oct 2026).
//
// Live evidence it answers: the owner ordered a Burp-style workflow
// at the hunter's own machine — open the intercept tool, browse
// through it, read a captured request, replay it changed. The old
// backend/src/proxyIntercept.js spawned mitmproxy on the HOST (where
// no hunt traffic flows) and was referenced nowhere. Lane U rebuilds
// it container-side: mitmweb + a JSONL capture addon inside the hunt
// container, Chromium re-routed through it, and four first-class
// humanLoop actions (proxy_start / intercept_list / intercept_read /
// intercept_replay).
//
// This suite covers, with fakes only (no Docker, no model):
//   - capture JSONL parsing with absolute indices (bad lines consume
//     an index but yield no entry — an index can never drift);
//   - list/read shaping + body caps;
//   - replay construction (header replace/remove/add, url/body
//     overrides, truncated-body refusal, hop-by-hop stripping, shell
//     quoting) and the replay signature the dedupe gate judges;
//   - container ops over a fake exec: not-installed honesty,
//     idempotent start, dashboard token URL, Chromium relaunch
//     through the proxy, tail-window index arithmetic;
//   - dispatch wiring through humanIteration: the four actions reach
//     the intercept machinery, replay is scope-checked on its FINAL
//     url (override AND captured third-party), paced/executed via
//     the pipeline exec, and dedupe-gated on its signature, while
//     proxy_start/list/read stay ungated.
// Run: node backend/scripts/test-intercept-workflow.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-intercept-'));
process.env.DATA_DIR = tmp;

const {
  parseCaptureLine,
  indexCaptureLines,
  parseCaptureJsonl,
  shapeInterceptList,
  shapeInterceptRead,
  buildReplayRequest,
  buildReplayCurl,
  replaySignature,
  startInterceptProxy,
  listIntercept,
  readInterceptEntry,
  readCaptureTail,
  CAPTURE_PATH,
  ADDON_PATH,
} = await import('../src/proxyIntercept.js');
const { humanIteration, buildActionHistory, actionSignature } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// ---------------------------------------------------------------------------
// Fixtures: flows exactly as the capture addon writes them
// ---------------------------------------------------------------------------
const FLOW_LOGIN = {
  ts: '2026-10-23T17:00:00Z', method: 'POST', scheme: 'http', host: 'target.test', port: 80,
  path: '/rest/user/login', url: 'http://target.test/rest/user/login', status: 200,
  req_headers: { Host: 'target.test', 'Content-Type': 'application/json', 'Content-Length': '34', Cookie: 'session=abc' },
  req_body: '{"email":"a@b.c","password":"pw"}', req_body_truncated: false, req_len: 34,
  resp_headers: { 'Content-Type': 'application/json' },
  resp_body: '{"token":"xyz"}', resp_body_truncated: false, resp_len: 15,
};
const FLOW_CDN = {
  ts: '2026-10-23T17:00:01Z', method: 'GET', scheme: 'http', host: 'cdn.example.net', port: 80,
  path: '/lib.js', url: 'http://cdn.example.net/lib.js', status: 200,
  req_headers: { Host: 'cdn.example.net' }, req_body: '', req_body_truncated: false, req_len: 0,
  resp_headers: { 'Content-Type': 'application/javascript' }, resp_body: 'var x=1;', resp_body_truncated: false, resp_len: 8,
};
const FLOW_BIG = {
  ts: '2026-10-23T17:00:02Z', method: 'POST', scheme: 'http', host: 'target.test', port: 80,
  path: '/upload', url: 'http://target.test/upload', status: 500,
  req_headers: { 'Content-Type': 'text/plain' },
  req_body: 'A'.repeat(4096), req_body_truncated: true, req_len: 9000,
  resp_headers: {}, resp_body: 'server error', resp_body_truncated: false, resp_len: 12,
};
const line = (f) => JSON.stringify(f);

// ---------------------------------------------------------------------------
// Capture parsing + indices
// ---------------------------------------------------------------------------
check('parse: valid line parses', parseCaptureLine(line(FLOW_LOGIN)).url === FLOW_LOGIN.url);
check('parse: garbage line -> null', parseCaptureLine('not json at all') === null);
check('parse: JSON without method/url -> null', parseCaptureLine('{"a":1}') === null);
check('parse: empty line -> null', parseCaptureLine('  ') === null);

const indexed = indexCaptureLines([line(FLOW_LOGIN), 'garbage', line(FLOW_CDN)], 0);
check('index: bad line consumes its index (entries at 0 and 2)',
  indexed.length === 2 && indexed[0].index === 0 && indexed[1].index === 2);
const offset = parseCaptureJsonl(`${line(FLOW_LOGIN)}\n${line(FLOW_CDN)}`, 40);
check('index: tail-window startIndex honoured', offset[0].index === 40 && offset[1].index === 41);

// ---------------------------------------------------------------------------
// List / read shaping + caps
// ---------------------------------------------------------------------------
check('list: empty capture says so and points at proxy_start',
  shapeInterceptList([], { total: 0 }).includes('proxy_start'));
const many = Array.from({ length: 20 }, (_, i) => ({ index: i, flow: { ...FLOW_LOGIN, url: `http://target.test/p${i}` } }));
const listText = shapeInterceptList(many, { total: 20 });
check('list: shows the last 15 with absolute indices',
  listText.includes('#19 ') && listText.includes('#5 ') && !listText.includes('#4 ') && listText.includes('20 captured'));
check('list: line carries method, status, url',
  listText.includes('POST 200 http://target.test/p19'));

const readText = shapeInterceptRead({ index: 0, flow: FLOW_LOGIN });
check('read: shows request line, headers, bodies, response',
  readText.includes('POST http://target.test/rest/user/login → HTTP 200') &&
  readText.includes('Cookie: session=abc') &&
  readText.includes('"password":"pw"') &&
  readText.includes('{"token":"xyz"}'));
const bigRead = shapeInterceptRead({ index: 2, flow: { ...FLOW_BIG, resp_body: 'B'.repeat(5000), resp_body_truncated: true, resp_len: 5000 } });
check('read: response body capped at 1500 chars',
  bigRead.includes('B'.repeat(1500)) && !bigRead.includes('B'.repeat(1501)));
check('read: truncated request body is flagged',
  shapeInterceptRead({ index: 2, flow: FLOW_BIG }).includes('capture holds the first 4096 chars'));

// ---------------------------------------------------------------------------
// Replay construction
// ---------------------------------------------------------------------------
const plain = buildReplayRequest(FLOW_LOGIN, {});
check('replay: verbatim build keeps method/url/body',
  plain.ok && plain.method === 'POST' && plain.url === FLOW_LOGIN.url && plain.body === FLOW_LOGIN.req_body);
check('replay: verbatim build keeps the Cookie header',
  plain.headers.some(([k, v]) => k === 'Cookie' && v === 'session=abc'));

const replaced = buildReplayRequest(FLOW_LOGIN, { headers: { 'content-type': 'text/plain' } });
check('replay: header replace is case-insensitive and single',
  replaced.headers.filter(([k]) => k.toLowerCase() === 'content-type').length === 1 &&
  replaced.headers.some(([k, v]) => k === 'content-type' && v === 'text/plain'));
const removed = buildReplayRequest(FLOW_LOGIN, { headers: { Cookie: null } });
check('replay: null header value removes the header',
  !removed.headers.some(([k]) => k.toLowerCase() === 'cookie'));
const added = buildReplayRequest(FLOW_LOGIN, { headers: { 'X-Test': '1' }, url: 'http://target.test/other', body: 'changed=1' });
check('replay: header add + url override + body override',
  added.headers.some(([k, v]) => k === 'X-Test' && v === '1') && added.url === 'http://target.test/other' && added.body === 'changed=1');

const truncNoBody = buildReplayRequest(FLOW_BIG, {});
check('replay: truncated captured body refuses verbatim replay',
  !truncNoBody.ok && /truncated|first 4096/.test(truncNoBody.error));
const truncWithBody = buildReplayRequest(FLOW_BIG, { body: 'full body here' });
check('replay: explicit body overrides the truncated capture',
  truncWithBody.ok && truncWithBody.body === 'full body here');
check('replay: GET without body builds with body null',
  buildReplayRequest(FLOW_CDN, {}).body === null);

const curl = buildReplayCurl(plain);
check('curl: method + url + data-raw present',
  curl.includes('-X POST') && curl.includes(`'${FLOW_LOGIN.url}'`) && curl.includes('--data-raw'));
check('curl: hop-by-hop headers stripped (Host, Content-Length)',
  !curl.includes('-H \'Host:') && !curl.includes('-H \'Content-Length:'));
check('curl: cookie header kept', curl.includes("-H 'Cookie: session=abc'"));
const getCurl = buildReplayCurl(buildReplayRequest(FLOW_CDN, {}));
check('curl: bodyless GET has no --data-raw', !getCurl.includes('--data-raw'));
const evilBody = buildReplayRequest(FLOW_LOGIN, { body: `{"x":"a'b $HOME \`id\`"}` });
const evilCurl = buildReplayCurl(evilBody);
check('curl: quotes/dollar/backticks in body are shell-escaped',
  evilCurl.includes(`'\\''`) && !/(^|\s)id(\s|$)/.test(evilCurl.replace(/'[^']*'/g, '')));

// ---------------------------------------------------------------------------
// Replay signature (the dedupe gate's identity)
// ---------------------------------------------------------------------------
const sigA = replaySignature({ action: 'intercept_replay', index: 3, headers: { B: '2', A: '1' }, body: 'x' });
const sigB = replaySignature({ action: 'intercept_replay', index: 3, headers: { A: '1', B: '2' }, body: 'x' });
check('sig: header key order does not change identity', sigA === sigB);
check('sig: different body differs', replaySignature({ index: 3, body: 'y' }) !== replaySignature({ index: 3, body: 'x' }));
check('sig: different index differs', replaySignature({ index: 4 }) !== replaySignature({ index: 3 }));
check('sig: header name case does not change identity',
  replaySignature({ index: 1, headers: { 'X-A': '1' } }) === replaySignature({ index: 1, headers: { 'x-a': '1' } }));

// ---------------------------------------------------------------------------
// Container ops over a fake exec
// ---------------------------------------------------------------------------
const ADDON_SIZE = fs.statSync(new URL('../src/intercept/mitm_capture_addon.py', import.meta.url)).size;

function makeFakeMachine({ installed = true, desktop = false, captureLines = [] } = {}) {
  const state = { started: false, addonWritten: false, commands: [] };
  const exec = async (h, cmd) => {
    state.commands.push(cmd);
    const out = (stdout) => ({ stdout, stderr: '', code: 0 });
    if (cmd.includes('command -v mitmweb')) return out(installed ? '/usr/bin/mitmweb\n' : '');
    if (cmd.includes('kill -0')) return out(state.started ? 'alive' : 'dead');
    // The addon write command also ENDS in a wc -c probe — match the
    // write first, or the probe branch swallows it.
    if (cmd.includes(`base64 -d > ${ADDON_PATH}`)) { state.addonWritten = true; return out(`${ADDON_SIZE}\n`); }
    if (cmd.includes(`wc -c < ${ADDON_PATH}`)) return out(state.addonWritten ? `${ADDON_SIZE}\n` : '0\n');
    if (cmd.includes('nohup mitmweb')) { state.started = true; return out('launched'); }
    if (cmd.includes("grep -oE")) return out('http://127.0.0.1:8081/?token=TESTTOKEN\n');
    if (cmd.includes('%{http_code}')) return out(state.started ? '200' : '000');
    if (cmd.includes('/json/version')) return out(desktop ? '{"Browser":"Chrome/120.0","webSocketDebuggerUrl":"ws://x"}' : '');
    if (cmd.includes('pkill')) return out('relaunched');
    // The tail read is ONE combined command (wc -l + tail) — match it
    // before the bare wc -l branch.
    if (cmd.includes('tail -n 60')) return out(`${captureLines.length}\n${captureLines.join('\n')}`);
    if (cmd.includes(`wc -l < ${CAPTURE_PATH}`)) return out(`${captureLines.length}\n`);
    const sed = /sed -n '(\d+)p'/.exec(cmd);
    if (sed) return out(captureLines[Number(sed[1]) - 1] || '');
    if (cmd.includes('tail -n 5')) return out('some mitm log line');
    return out('');
  };
  return { exec, state };
}

{
  const m = makeFakeMachine({ installed: false });
  const r = await startInterceptProxy('h_fake', { exec: m.exec, sleep: async () => {} });
  check('start: mitmproxy missing -> honest not-installed observation',
    !r.ok && r.installed === false && /NOT installed/.test(r.observation));
  check('start: not-installed never launches anything', !m.state.commands.some((c) => c.includes('nohup mitmweb')));
}
{
  const m = makeFakeMachine({ desktop: false });
  const r = await startInterceptProxy('h_fake', { exec: m.exec, sleep: async () => {} });
  check('start: proxy starts, dashboard URL carries the token from the log',
    r.ok && r.webUrl === 'http://127.0.0.1:8081/?token=TESTTOKEN' && r.observation.includes('token=TESTTOKEN'));
  check('start: addon injected into the container', m.state.addonWritten);
  check('start: mitmweb launched as one proxy+dashboard process on 8080/8081 with the addon',
    m.state.commands.some((c) => c.includes('nohup mitmweb') && c.includes('--listen-port 8080') && c.includes('--web-port 8081') && c.includes(`-s ${ADDON_PATH}`)));
  check('start: proxy marker written for future desktop launches',
    m.state.commands.some((c) => c.includes('proxy.on') && c.includes('http://127.0.0.1:8080')));
  check('start: no desktop -> no Chromium relaunch, note says proxy applies at desktop start',
    !m.state.commands.some((c) => c.includes('pkill')) && /desktop starts/.test(r.observation));

  const again = await startInterceptProxy('h_fake', { exec: m.exec, sleep: async () => {} });
  check('start: second call is idempotent (already running, no relaunch)',
    again.ok && again.alreadyRunning === true &&
    m.state.commands.filter((c) => c.includes('nohup mitmweb')).length === 1);
}
{
  const m = makeFakeMachine({ desktop: true });
  const r = await startInterceptProxy('h_fake', { exec: m.exec, sleep: async () => {} });
  check('start: live desktop browser is relaunched through the proxy',
    r.ok && m.state.commands.some((c) => c.includes('pkill') && c.includes('--proxy-server=http://127.0.0.1:8080')));
  check('start: relaunch note tells the hunter its tabs were closed',
    /restarted through the proxy/.test(r.observation));
}
{
  const lines = [line(FLOW_LOGIN), line(FLOW_CDN), line(FLOW_BIG)];
  const m = makeFakeMachine({ captureLines: lines });
  const lst = await listIntercept('h_fake', { exec: m.exec });
  check('list op: reads the capture and shapes it',
    lst.ok && lst.total === 3 && lst.observation.includes('#2 POST 500 http://target.test/upload'));
  const rd = await readInterceptEntry('h_fake', 1, { exec: m.exec });
  check('read op: returns the entry and the shaped read',
    rd.ok && rd.entry.flow.url === FLOW_CDN.url && rd.observation.includes(FLOW_CDN.url));
  const oob = await readInterceptEntry('h_fake', 9, { exec: m.exec });
  check('read op: out-of-range index refused with the real range', !oob.ok && /0\.\.2/.test(oob.observation));
  const neg = await readInterceptEntry('h_fake', -1, { exec: m.exec });
  check('read op: negative index refused', !neg.ok && /valid capture index/.test(neg.observation));
  const empty = makeFakeMachine({ captureLines: [] });
  const rdEmpty = await readInterceptEntry('h_fake', 0, { exec: empty.exec });
  check('read op: empty capture refused honestly', !rdEmpty.ok && /empty/.test(rdEmpty.observation));
}
{
  // Tail window: 100-line capture, tail returns the last 60 lines.
  const tailLines = Array.from({ length: 60 }, (_, i) => line({ ...FLOW_LOGIN, url: `http://target.test/p${i + 40}` }));
  const exec = async (h, cmd) => ({ stdout: `100\n${tailLines.join('\n')}`, stderr: '', code: 0 });
  const { total, entries } = await readCaptureTail('h_fake', exec);
  check('tail: absolute indices survive the window (first entry is #40)',
    total === 100 && entries.length === 60 && entries[0].index === 40 && entries[59].index === 99);
}

// ---------------------------------------------------------------------------
// Dispatch wiring through humanIteration (scripted brain, fake world)
// ---------------------------------------------------------------------------
const PS = { domain: 'target.test', inScope: ['target.test'], outOfScope: [], rules: { noDoS: true, noHeavyScan: true } };
const FLOWS = [FLOW_LOGIN, FLOW_CDN, FLOW_BIG];

function makeWorld({ replies, seedEvents = [] }) {
  const events = [];
  const execCommands = [];
  const interceptCalls = [];
  const screens = [];
  const systems = [];
  const queue = [...replies];
  const deps = {
    chat: async (messages, system) => {
      screens.push(messages[0].text);
      systems.push(system);
      return queue.length ? queue.shift() : null;
    },
    exec: async (h, t, command) => {
      execCommands.push(command);
      return { stdout: 'HTTP/1.1 401 Unauthorized\nContent-Type: application/json\n\n{"error":"invalid credentials"}', stderr: '', code: 0 };
    },
    execRaw: async () => ({ stdout: '/root\n---\nnotes.txt', stderr: '', code: 0 }),
    search: async () => [],
    writeFile: async (h, name, content) => ({ name, chars: content.length }),
    spill: () => 'spilled-output.log',
    record: (h, ev) => events.push(ev),
    readMeta: () => ({ huntId: 'h_intercept_test', parsedScope: PS }),
    writeMeta: () => {},
    readEvents: () => seedEvents,
    recordNote: () => {},
    assess: null,
    gui: {
      open: async () => ({ observation: 'opened' }),
      snapshot: async () => ({ observation: 'snap' }),
      click: async () => ({ observation: 'clicked' }),
      type: async () => ({ observation: 'typed' }),
      screenshot: async () => ({ observation: 'shot' }),
    },
    buildBriefing: async () => 'BRIEFING',
    intercept: {
      start: async () => { interceptCalls.push(['start']); return { ok: true, observation: 'Intercept proxy is LIVE. Dashboard: http://127.0.0.1:8081/?token=T' }; },
      list: async () => { interceptCalls.push(['list']); return { ok: true, observation: shapeInterceptList(FLOWS.map((flow, index) => ({ index, flow })), { total: 3 }) }; },
      read: async (h, index) => {
        interceptCalls.push(['read', index]);
        const flow = FLOWS[Number(index)];
        if (!flow) return { ok: false, observation: `Capture #${index} does not exist.` };
        const entry = { index: Number(index), flow };
        return { ok: true, entry, observation: shapeInterceptRead(entry) };
      },
    },
    sleep: async () => {},
    now: () => 1000000,
  };
  return { deps, events, execCommands, interceptCalls, screens, systems };
}
const brain = (obj) => `Thinking like a hunter.\n${JSON.stringify(obj)}`;

{
  const w = makeWorld({
    replies: [
      brain({ action: 'proxy_start' }),
      brain({ action: 'intercept_list' }),
      brain({ action: 'intercept_read', index: 0 }),
    ],
  });
  const res = await humanIteration('h_intercept_test', 'http://target.test', { turns: 3, deps: w.deps, parsedScope: PS });
  check('dispatch: proxy_start/list/read reach the intercept machinery in order',
    JSON.stringify(w.interceptCalls) === JSON.stringify([['start'], ['list'], ['read', 0]]));
  check('dispatch: tool_call events recorded for the three read/control actions',
    ['proxy_start', 'intercept_list', 'intercept_read'].every((t) => w.events.some((e) => e.type === 'tool_call' && e.tool === t)));
  check('dispatch: system prompt advertises the intercept actions',
    w.systems[0].includes('"action":"proxy_start"') && w.systems[0].includes('"action":"intercept_replay"'));
  check('dispatch: list observation lands in the session log',
    res.log[1].observation.includes('#2 POST 500 http://target.test/upload'));
  check('dispatch: read observation carries the full flow',
    res.log[2].observation.includes('Cookie: session=abc'));
}
{
  // Replay in scope, with modifications — the Repeater workflow.
  const w = makeWorld({
    replies: [brain({ action: 'intercept_replay', index: 0, headers: { 'X-Test': 'pwn' }, body: '{"email":"a@b.c","password":"\' OR 1=1"}' })],
  });
  const res = await humanIteration('h_intercept_test', 'http://target.test', { turns: 1, deps: w.deps, parsedScope: PS });
  check('dispatch replay: executed exactly once via the pipeline exec', w.execCommands.length === 1);
  const cmd = w.execCommands[0] || '';
  check('dispatch replay: built curl carries the header mod and the new body',
    cmd.includes("-H 'X-Test: pwn'") && cmd.includes('--data-raw') && cmd.includes(`OR 1=1`));
  check('dispatch replay: hop-by-hop headers from the capture are not resent',
    !cmd.includes("-H 'Host:") && !cmd.includes("-H 'Content-Length:"));
  check('dispatch replay: observation reports the replayed status line',
    res.log[0].observation.includes('Replayed capture #0 as POST http://target.test/rest/user/login') &&
    res.log[0].observation.includes('HTTP/1.1 401 Unauthorized'));
  check('dispatch replay: tool_call recorded under its signature detail',
    w.events.some((e) => e.type === 'tool_call' && e.tool === 'intercept_replay' &&
      e.detail === replaySignature({ index: 0, headers: { 'X-Test': 'pwn' }, body: '{"email":"a@b.c","password":"\' OR 1=1"}' })));
}
{
  // Replay with an out-of-scope URL override — refused before sending.
  const w = makeWorld({
    replies: [brain({ action: 'intercept_replay', index: 0, url: 'http://evil.example.com/x' })],
  });
  const res = await humanIteration('h_intercept_test', 'http://target.test', { turns: 1, deps: w.deps, parsedScope: PS });
  check('dispatch replay: out-of-scope override is BLOCKED and nothing is sent',
    w.execCommands.length === 0 && res.log[0].observation.includes('BLOCKED — OUT OF SCOPE'));
}
{
  // Verbatim replay of a captured third-party request (the page pulled
  // it in; the programme never authorised testing that host) — the
  // FINAL url is scope-checked, so this is refused too.
  const w = makeWorld({
    replies: [brain({ action: 'intercept_replay', index: 1 })],
  });
  const res = await humanIteration('h_intercept_test', 'http://target.test', { turns: 1, deps: w.deps, parsedScope: PS });
  check('dispatch replay: verbatim third-party capture is BLOCKED on its final url',
    w.execCommands.length === 0 && res.log[0].observation.includes('BLOCKED — OUT OF SCOPE') && res.log[0].observation.includes('cdn.example.net'));
}
{
  // Unknown capture index — honest refusal, nothing sent.
  const w = makeWorld({
    replies: [brain({ action: 'intercept_replay', index: 99 })],
  });
  const res = await humanIteration('h_intercept_test', 'http://target.test', { turns: 1, deps: w.deps, parsedScope: PS });
  check('dispatch replay: unknown index refused, nothing sent',
    w.execCommands.length === 0 && res.log[0].observation.includes('does not exist'));
}
{
  // Dedupe gate: the identical replay has already run twice in this
  // hunt — the third identical send is blocked by the record.
  const action = { action: 'intercept_replay', index: 0, headers: { 'X-Test': '1' } };
  const sig = replaySignature(action);
  const seed = [
    { type: 'tool_call', tool: 'intercept_replay', detail: sig },
    { type: 'tool_call', tool: 'intercept_replay', detail: sig },
  ];
  const hist = buildActionHistory(seed);
  check('gate: seeded replay history keys on the signature',
    hist.get(actionSignature('intercept_replay', sig)).count === 2);
  const w = makeWorld({ replies: [brain(action)], seedEvents: seed });
  const res = await humanIteration('h_intercept_test', 'http://target.test', { turns: 1, deps: w.deps, parsedScope: PS });
  check('gate: third identical replay is blocked by the already-done gate',
    w.execCommands.length === 0 &&
    res.log[0].observation.startsWith('BLOCKED — ALREADY DONE') &&
    w.events.some((e) => e.type === 'dedup_block' && e.tool === 'intercept_replay'));
  // …but a VARIED replay (different body) is a different action.
  const w2 = makeWorld({ replies: [brain({ ...action, body: 'different=1' })], seedEvents: seed });
  const res2 = await humanIteration('h_intercept_test', 'http://target.test', { turns: 1, deps: w2.deps, parsedScope: PS });
  check('gate: a varied replay passes the gate and sends',
    w2.execCommands.length === 1 && !res2.log[0].observation.startsWith('BLOCKED'));
}
{
  // proxy_start is NOT dedupe-gated: asking for state twice is fine.
  const w = makeWorld({
    replies: [brain({ action: 'proxy_start' }), brain({ action: 'proxy_start' }), brain({ action: 'proxy_start' })],
  });
  await humanIteration('h_intercept_test', 'http://target.test', { turns: 3, deps: w.deps, parsedScope: PS });
  check('gate: proxy_start is never dedupe-blocked (idempotent control)',
    w.interceptCalls.filter((c) => c[0] === 'start').length === 3 &&
    !w.events.some((e) => e.type === 'dedup_block'));
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
