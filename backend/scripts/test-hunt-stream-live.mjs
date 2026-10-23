// Test for Lane P, Defect 1a (23 Oct 2026) — an already-open hunt
// panel must receive new events LIVE, without a reload.
//
// Live evidence: the Ezviz hunt resumed and ran for ~12 minutes
// while the website's activity feed never advanced past the resume
// round, though the backend was writing new events to events.jsonl
// the whole time; a reload replayed everything. Root cause: the WS
// bridge in server.js replayed the cached log, then called the
// PentAGI engine for a status snapshot — the engine does not exist
// on this box, so it sent "engine_unreachable" and CLOSED the
// socket (1011). Every open panel was a connect-time snapshot.
// The fix bridges hunts that have a local meta (all host-side
// hunts) from their own record: replay + meta status snapshot +
// a tail of events.jsonl that pushes new events as they land and
// forwards meta progress (state/phase/iteration) changes.
//
// This suite boots the REAL backend (child process, tmp DATA_DIR),
// connects a WebSocket client, then appends an event + bumps the
// meta iteration exactly as the running loop does, and asserts the
// open socket receives both — no reconnect, no reload.
//
// Run: node backend/scripts/test-hunt-stream-live.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-stream-'));
const PORT = 4621;
const HUNT = 'h_stream_test';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const huntDir = path.join(tmp, 'hunts', HUNT);
fs.mkdirSync(huntDir, { recursive: true });
const metaFile = path.join(huntDir, 'meta.json');
const eventsFile = path.join(huntDir, 'events.jsonl');
const writeMeta = (iteration) => fs.writeFileSync(metaFile, JSON.stringify({
  huntId: HUNT, target: 'https://t.test', state: 'paused', phase: 'hunting',
  iteration, mode: 'human', humanMode: true,
}));
writeMeta(166);
fs.writeFileSync(eventsFile, [
  JSON.stringify({ type: 'thinking', text: 'Checkpoint resume — continuing from iteration 166', cachedAt: '2026-10-23T11:02:43.000Z' }),
  JSON.stringify({ type: 'tool_call', tool: 'browser_open', detail: 'https://t.test/', cachedAt: '2026-10-23T11:03:00.000Z' }),
].join('\n') + '\n');

const child = spawn(process.execPath, [path.join(here, '..', 'src', 'server.js')], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: tmp, STREAM_POLL_MS: '200' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let childLog = '';
child.stdout.on('data', (d) => { childLog += d; });
child.stderr.on('data', (d) => { childLog += d; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await fn()) return true;
    await sleep(250);
  }
  console.log(`  (timed out waiting for: ${label})`);
  return false;
}

let ws;
try {
  const healthy = await waitFor(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/v1/health`);
      return r.ok;
    } catch { return false; }
  }, 40000, 'backend health');
  check('backend booted and healthy', healthy);
  if (!healthy) console.log(childLog.slice(-1500));

  const messages = [];
  let closed = false;
  ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/v1/hunts/${HUNT}/stream`);
  ws.on('message', (d) => { try { messages.push(JSON.parse(String(d))); } catch { /* ignore */ } });
  ws.on('close', () => { closed = true; });
  await waitFor(() => messages.length >= 3, 8000, 'replay + status snapshot');

  check('replay delivered the 2 recorded events',
    messages.filter((m) => m.type === 'thinking' || m.type === 'tool_call').length >= 2);
  const snap = messages.find((m) => m.type === 'status' && typeof m.step === 'number');
  check('status snapshot came from meta (step 166, no engine)', Boolean(snap) && snap.step === 166);
  check('socket stayed OPEN after connect (no engine_unreachable close)',
    !closed && !messages.some((m) => m.state === 'engine_unreachable'));

  // Lane V, symptom 2: replayed events must keep their OWN recorded
  // time. The bridge used to strip cachedAt (stripCacheFields), so
  // the client stamped every history line with the page-load moment
  // and the whole feed rendered with one identical elapsed stamp —
  // the hunt's total elapsed at load, on every line.
  const replayThink = messages.find((m) => m.type === 'thinking');
  const replayTool = messages.find((m) => m.type === 'tool_call');
  check('replayed thinking kept its own cachedAt (not stripped by the bridge)',
    Boolean(replayThink) && replayThink.cachedAt === '2026-10-23T11:02:43.000Z');
  check('replayed tool_call kept its own, different cachedAt (per-event times survive)',
    Boolean(replayTool) && replayTool.cachedAt === '2026-10-23T11:03:00.000Z');

  // The running loop writes a new event and the iteration advances.
  fs.appendFileSync(eventsFile, JSON.stringify({
    type: 'thinking', text: 'LIVE-MARKER: probing the login form now', cachedAt: new Date().toISOString(),
  }) + '\n');
  writeMeta(167);

  const gotLive = await waitFor(
    () => messages.some((m) => m.type === 'thinking' && String(m.text || '').includes('LIVE-MARKER')),
    6000, 'live event over the open socket');
  check('new event pushed LIVE over the already-open socket (no reload)', gotLive);
  const gotStep = await waitFor(
    () => messages.some((m) => m.type === 'status' && m.step === 167),
    6000, 'meta progress forwarded');
  check('meta progress (iteration 167) forwarded over the same socket', gotStep);

  // Lane V, symptom 3 (bridge side): human-mode events must cross
  // the bridge untouched — tool + detail + via + their own stamp —
  // so the feed can render what the hunter actually did. (The
  // rendering half of that defect was in the frontend's feed
  // shaping; the bridge's job is to not lose the fields.)
  const hmStamp = new Date().toISOString();
  fs.appendFileSync(eventsFile,
    JSON.stringify({
      type: 'tool_call', tool: 'browser_open', detail: 'http://172.17.0.1:3000/ftp', via: 'human-mode', cachedAt: hmStamp,
    }) + '\n' + JSON.stringify({
      type: 'thinking', text: 'HUMAN-MARKER: I see the /ftp listing; the KeePass file is the prize', via: 'human-mode', cachedAt: hmStamp,
    }) + '\n');
  const gotHmTool = await waitFor(
    () => messages.some((m) => m.type === 'tool_call' && m.via === 'human-mode' && m.detail === 'http://172.17.0.1:3000/ftp'),
    6000, 'human-mode tool_call over the open socket');
  check('human-mode tool_call pushed LIVE with tool + detail intact', gotHmTool);
  const hmToolMsg = messages.find((m) => m.type === 'tool_call' && m.via === 'human-mode');
  check('human-mode tool_call kept its own cachedAt', Boolean(hmToolMsg) && hmToolMsg.cachedAt === hmStamp);
  const gotHmThink = await waitFor(
    () => messages.some((m) => m.type === 'thinking' && String(m.text || '').includes('HUMAN-MARKER')),
    6000, 'human-mode thinking over the open socket');
  check('human-mode thinking pushed LIVE', gotHmThink);
  check('socket still open at the end', !closed);
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  try { child.kill('SIGTERM'); } catch { /* ignore */ }
  await sleep(300);
  try { if (!child.killed) child.kill('SIGKILL'); } catch { /* ignore */ }
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
