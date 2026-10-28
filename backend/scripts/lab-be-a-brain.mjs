// Lab: Be a Brain — full flow through the REAL routes/handlers.
//
//   set parent mode -> submit an action -> verify it is recorded with
//   a hash -> fetch the output by that hash -> verify the live process
//   state -> hand back to AI -> verify a parent action is now refused.
//
// Against a local mock backend (express + the real hunts router, real
// store in a temp DATA_DIR) and a FAKE container shim — there is no
// docker in this sandbox, so no real hunt container exists; the shim
// stands in for execInHuntContainer / the GUI tools / the verifier.
// The engine is unreachable here too, so pause/resume exercise the
// real host-side fallback (meta flags + status event), exactly as a
// host-side hunt does live. No Meta calls, $0 spend, no live hunt
// touched. Exit 0 + ALL CHECKS PASSED on success, non-zero otherwise.
//
//   node backend/scripts/lab-be-a-brain.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-be-a-brain-'));
process.env.DATA_DIR = tmpRoot;
process.env.JWT_SECRET = 'lab-be-a-brain-test-secret-1234';
process.env.ENGINE_URL = 'http://127.0.0.1:9'; // nothing listens: engine unreachable, fast fail

const express = (await import('express')).default;
const huntsRouter = (await import('../src/routes/hunts.js')).default;
const { issueToken } = await import('../src/routes/auth.js');
const { writeHuntMeta, appendHuntEvent, readHuntEvents } = await import('../src/store.js');
const { recordReasoning } = await import('../src/reasoningMemory.js');
const { configureBrainActionDeps, configureBrainModeDeps } = await import('../src/brainMode.js');

const HUNT_ID = 'h_lab_beabrain';
const TARGET = 'http://172.17.0.1:3100/';
const OWNER = { id: 'owner-1', username: 'owner', role: 'admin' };

let checks = 0;
let failures = 0;
function check(name, cond, extra = '') {
  checks++;
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

// --- fake container shim (stands in for docker + the GUI + verifier) ---
const shimCalls = { exec: [], guiOpen: [], resumeLoop: [] };
configureBrainActionDeps({
  exec: async (huntId, target, command) => {
    shimCalls.exec.push(command);
    if (command.includes('3100/')) {
      return { stdout: '<html><body><h1>DVWA login</h1><form>username password</form></body></html>', stderr: '', code: 0 };
    }
    return { stdout: `shim output for: ${command}`, stderr: '', code: 0 };
  },
  gui: {
    open: async (huntId, url) => { shimCalls.guiOpen.push(url); return { ok: true, observation: `Opened ${url} — DVWA login page` }; },
    click: async (huntId, text) => ({ ok: true, observation: `Clicked "${text}"` }),
    type: async (huntId, text, submit) => ({ ok: true, observation: `Typed "${text}"` }),
  },
  assess: async (huntId, target, plan, result) => ({
    verified: true, title: plan.test, severity: 'high', verification: 'confirmed (all 4 steps passed)',
  }),
});
// Handing back to AI must NOT launch a real hunt loop in the sandbox:
// the resume machinery is still invoked (and asserted below), but the
// loop restart itself is stubbed.
configureBrainModeDeps({
  resumeInterruptedHunt: async (huntId) => { shimCalls.resumeLoop.push(huntId); return true; },
});

// --- seed a hunt with a little history, as the live DVWA hunt has ---
writeHuntMeta(HUNT_ID, {
  huntId: HUNT_ID, target: TARGET, userId: OWNER.id, state: 'running', paused: false,
  iteration: 247, mode: 'human',
  parsedScope: { domain: '172.17.0.1', inScope: ['172.17.0.1'], outOfScopeHosts: [], outOfScope: [] },
});
appendHuntEvent(HUNT_ID, { type: 'tool_call', tool: 'shell', detail: "curl -s 'http://172.17.0.1:3100/'", via: 'human-mode' });
recordReasoning(HUNT_ID, { action: "shell: curl -s 'http://172.17.0.1:3100/'", why: 'check the target', result: 'DVWA login page, 200 OK', learned: '' });

const app = express();
app.use(express.json());
app.use('/api/v1/hunts', huntsRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}/api/v1/hunts/${HUNT_ID}`;
const token = issueToken({ id: OWNER.id, username: OWNER.username, role: OWNER.role });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function call(method, url, body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

console.log('lab-be-a-brain: full flow through the real routes (fake container shim, no docker)');
try {
  // 1. Brain mode starts as AI.
  let r = await call('GET', `${base}/brain-mode`);
  check('GET brain-mode starts as ai', r.status === 200 && r.json.brainMode === 'ai', JSON.stringify(r.json));

  // 2. A parent action is refused while the AI is the brain.
  r = await call('POST', `${base}/brain-action`, { action: { action: 'shell', command: 'id' } });
  check('brain-action refused while brainMode is ai (409 brain_mode_ai)', r.status === 409 && r.json.error === 'brain_mode_ai', JSON.stringify(r.json));

  // 3. Switch to parent mode -> the AI loop pauses (host fallback: no engine).
  r = await call('POST', `${base}/brain-mode`, { mode: 'parent' });
  check('POST brain-mode parent ok', r.status === 200 && r.json.ok === true && r.json.brainMode === 'parent', JSON.stringify(r.json));
  check('hunt is paused while the parent is the brain', r.json.state === 'paused', JSON.stringify(r.json));

  // 4. Submit a shell action through the fake container shim.
  r = await call('POST', `${base}/brain-action`, { action: { action: 'shell', command: "curl -s 'http://172.17.0.1:3100/'" } });
  check('shell action ok with a hash + output', r.status === 200 && r.json.ok === true && typeof r.json.hash === 'string' && r.json.hash.length >= 8 && /DVWA login/.test(r.json.output), JSON.stringify(r.json).slice(0, 300));
  check('container shim was actually called', shimCalls.exec.length === 1 && shimCalls.exec[0].includes('3100/'));
  const hash = r.json.hash;

  // 5. The action is recorded in the index with that hash.
  r = await call('GET', `${base}/actions`);
  check('GET actions lists the parent action by hash', r.status === 200 && r.json.actions.some((a) => a.hash === hash && a.tool === 'shell' && a.status === 'done'), JSON.stringify(r.json).slice(0, 300));

  // 6. Fetch the stored output by hash ("hash se output ki file").
  r = await call('GET', `${base}/output/${hash}`);
  check('GET output/:hash returns the stored output', r.status === 200 && r.json.ok === true && /DVWA login/.test(r.json.output), JSON.stringify(r.json).slice(0, 300));
  r = await call('GET', `${base}/output/deadbeefdeadbeef`);
  check('GET output/:unknown-hash is 404 unknown_hash', r.status === 404 && r.json.error === 'unknown_hash', JSON.stringify(r.json));

  // 7. Live process state: paused, parent brain, done includes the action.
  r = await call('GET', `${base}/process`);
  check('GET process: running=false, brainMode=parent, state=paused', r.status === 200 && r.json.running === false && r.json.brainMode === 'parent' && r.json.state === 'paused', JSON.stringify(r.json).slice(0, 300));
  check('GET process: done lists the shell action', r.json.done.some((l) => l.startsWith('shell |')));

  // 8. A parent action carrying a task block updates the process state.
  r = await call('POST', `${base}/brain-action`, {
    action: { action: 'browser_open', url: TARGET, task: { task: 'Open the DVWA login page', goal: 'Get a foothold on DVWA', progress: 'opening login', status: 'in_progress' } },
  });
  check('browser_open with a task block ok', r.status === 200 && r.json.ok === true && /DVWA login/.test(r.json.output), JSON.stringify(r.json).slice(0, 300));
  check('GUI shim was called for browser_open', shimCalls.guiOpen.length === 1);
  r = await call('GET', `${base}/process`);
  check('GET process: task/goal/progress reflect the parent task block', r.json.task === 'Open the DVWA login page' && r.json.goal === 'Get a foothold on DVWA' && r.json.taskStatus === 'in_progress', JSON.stringify(r.json).slice(0, 300));

  // 9. Recall by id through the route, and a complete claim through the verifier shim.
  r = await call('POST', `${base}/brain-action`, { action: { action: 'recall', id: 1 } });
  check('recall #1 returns the full stored record', r.status === 200 && r.json.ok === true && /DVWA login page/.test(r.json.output), JSON.stringify(r.json).slice(0, 300));
  r = await call('POST', `${base}/brain-action`, {
    action: {
      action: 'claim_finding', title: 'Reflected XSS in search', class: 'xss',
      evidence: 'Hello <script>alert(1)</script> — marker QXZ7719 reflected in the page body, HTTP 200, long enough to count as real evidence here',
      command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test'",
      counterevidence: 'same request without the script tag shows no marker',
      confidence: 'high',
    },
  });
  check('complete parent claim goes to the verifier and verifies', r.status === 200 && r.json.ok === true && r.json.verified === true, JSON.stringify(r.json).slice(0, 300));
  r = await call('POST', `${base}/brain-action`, { action: { action: 'claim_finding', title: 'XSS?', class: 'xss' } });
  check('incomplete parent claim bounced (422 claim_incomplete)', r.status === 422 && r.json.error === 'claim_incomplete', JSON.stringify(r.json));

  // 10. Hand the brain back to AI -> resume machinery runs, hunt running again.
  r = await call('POST', `${base}/brain-mode`, { mode: 'ai' });
  check('POST brain-mode ai ok', r.status === 200 && r.json.ok === true && r.json.brainMode === 'ai', JSON.stringify(r.json));
  check('hunt is running again after handing back', r.json.state === 'running', JSON.stringify(r.json));
  check('resume-from-checkpoint machinery was invoked', shimCalls.resumeLoop.includes(HUNT_ID));

  // 11. And the parent can no longer submit actions.
  r = await call('POST', `${base}/brain-action`, { action: { action: 'shell', command: 'id' } });
  check('brain-action refused again after handing back (409)', r.status === 409 && r.json.error === 'brain_mode_ai', JSON.stringify(r.json));

  // 12. The event log shows the whole flow in one place.
  const events = readHuntEvents(HUNT_ID);
  check('event log carries brain_mode + be-a-brain tool_calls', events.some((e) => e.type === 'status' && e.state === 'brain_mode' && e.brainMode === 'parent') && events.filter((e) => e.type === 'tool_call' && e.via === 'be-a-brain').length >= 3);
} finally {
  await new Promise((resolve) => server.close(resolve));
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\nlab-be-a-brain: ${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log('lab-be-a-brain: FAILED');
  process.exit(1);
}
console.log('lab-be-a-brain: ALL CHECKS PASSED (fake container shim — no docker in this sandbox; live container path untested here)');
