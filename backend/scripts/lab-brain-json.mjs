// Lab: Brain JSON — full flow through the REAL routes/handlers.
//
//   set parent mode -> submit a JSON reply (shell action) -> verify
//   it executes and is recorded with a hash -> fetch the output by
//   that hash -> verify the live process state shows the reply's
//   task/goal/progress with the step complete -> verify the guards
//   (invalid JSON 400, scope refusal, claim bounce, 409 while AI)
//   and the titles (a UNION probe is titled, not a bare tool name).
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
//   node backend/scripts/lab-brain-json.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-brain-json-'));
process.env.DATA_DIR = tmpRoot;
process.env.JWT_SECRET = 'lab-brain-json-test-secret-1234';
process.env.ENGINE_URL = 'http://127.0.0.1:9'; // nothing listens: engine unreachable, fast fail

const express = (await import('express')).default;
const huntsRouter = (await import('../src/routes/hunts.js')).default;
const { issueToken } = await import('../src/routes/auth.js');
const { writeHuntMeta, appendHuntEvent, readHuntEvents } = await import('../src/store.js');
const { recordReasoning } = await import('../src/reasoningMemory.js');
const { configureBrainActionDeps, configureBrainModeDeps } = await import('../src/brainMode.js');

const HUNT_ID = 'h_lab_brainjson';
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
    if (command.includes('UNION')) {
      return { stdout: 'admin:5f4dcc3b5aa765d61d8327deb882cf99\nuser:098f6bcd4621d373cade4e832627b4f6', stderr: '', code: 0 };
    }
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
// Handing back to AI must NOT launch a real hunt loop in the sandbox.
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

const REPLY = {
  task: 'Dump DVWA users via UNION injection',
  goal: 'Prove SQL injection on DVWA',
  progress: 'Login done; single-quote probe returned a SQL error',
  action: {
    type: 'shell',
    command: "curl -s 'http://172.17.0.1:3100/vulnerabilities/sqli/?id=1%27%20UNION%20SELECT%20user,password%20FROM%20users--%20&Submit=Submit'",
  },
};

console.log('lab-brain-json: full flow through the real routes (fake container shim, no docker)');
try {
  // 1. JSON replies are refused while the AI is the brain.
  let r = await call('POST', `${base}/brain-action-json`, { reply: REPLY });
  check('brain-action-json refused while brainMode is ai (409 brain_mode_ai)', r.status === 409 && r.json.error === 'brain_mode_ai', JSON.stringify(r.json));

  // 2. Switch to parent mode.
  r = await call('POST', `${base}/brain-mode`, { mode: 'parent' });
  check('POST brain-mode parent ok', r.status === 200 && r.json.ok === true && r.json.brainMode === 'parent', JSON.stringify(r.json));

  // 3. An invalid JSON reply is 400 and names the bad field; nothing runs.
  const execBefore = shimCalls.exec.length;
  r = await call('POST', `${base}/brain-action-json`, { reply: { ...REPLY, action: { type: 'shell' } } });
  check('invalid JSON rejected 400 naming action.command', r.status === 400 && r.json.error === 'invalid_reply' && r.json.errors.some((e) => e.field === 'action.command'), JSON.stringify(r.json).slice(0, 300));
  check('invalid JSON executed nothing', shimCalls.exec.length === execBefore);

  // 4. Submit the JSON reply (shell action) — with a recall of #1 first.
  r = await call('POST', `${base}/brain-action-json`, { reply: { ...REPLY, recall: { id: 1 } } });
  check('JSON shell reply ok with a hash + output', r.status === 200 && r.json.ok === true && typeof r.json.hash === 'string' && r.json.hash.length >= 8 && /5f4dcc3b5aa765d61d8327deb882cf99/.test(r.json.output), JSON.stringify(r.json).slice(0, 300));
  check('container shim was actually called', shimCalls.exec.length === execBefore + 1);
  check('recall was fetched first and returned as recalled', Boolean(r.json.recalled) && /DVWA login page/.test(r.json.recalled.output) && r.json.recalled.id === 1, JSON.stringify(r.json).slice(0, 300));
  const hash = r.json.hash;

  // 5. The action is in the index with that hash and an informative title.
  r = await call('GET', `${base}/actions`);
  const entry = (r.json.actions || []).find((a) => a.hash === hash);
  check('GET actions lists the JSON action by hash', r.status === 200 && Boolean(entry) && entry.tool === 'shell' && entry.status === 'done', JSON.stringify(r.json).slice(0, 300));
  check('UNION action titled "SQL Injection UNION dump", not a bare tool name', entry && entry.title === 'SQL Injection UNION dump' && entry.label === 'shell | 172.17.0.1:3100/vulnerabilities/sqli/ | UNION SELECT dump | done', entry ? entry.title : 'no entry');
  check('action entry carries number, hash, tool, label, date/time, variant', entry && typeof entry.n === 'number' && entry.hash && entry.tool && entry.label && entry.at && entry.variant, JSON.stringify(entry));

  // 6. Fetch the stored output by hash ("hash se output ki file").
  r = await call('GET', `${base}/output/${hash}`);
  check('GET output/:hash returns the full stored output', r.status === 200 && r.json.ok === true && /5f4dcc3b5aa765d61d8327deb882cf99/.test(r.json.output), JSON.stringify(r.json).slice(0, 300));
  r = await call('GET', `${base}/output/deadbeefdeadbeef`);
  check('GET output/:unknown-hash is 404 unknown_hash', r.status === 404 && r.json.error === 'unknown_hash', JSON.stringify(r.json));

  // 7. Live process state: the reply's task/goal/progress, step complete — and no full output embedded.
  r = await call('GET', `${base}/process`);
  check('GET process: task/goal/progress reflect the JSON reply', r.json.task === REPLY.task && r.json.goal === REPLY.goal && r.json.progress === REPLY.progress, JSON.stringify(r.json).slice(0, 300));
  check('GET process: step complete (taskStatus complete, processStatus done)', r.json.taskStatus === 'complete' && r.json.processStatus === 'done', JSON.stringify(r.json).slice(0, 300));
  check('GET process: done lists the UNION action label', (r.json.done || []).some((l) => l.startsWith('shell | 172.17.0.1:3100/vulnerabilities/sqli/')));
  check('GET process: no full output embedded (titles/labels only)', !r.text.includes('5f4dcc3b5aa765d61d8327deb882cf99'), r.text.slice(0, 300));

  // 8. Guards still apply to JSON replies: scope refusal + claim bounce, both recorded failed in the process.
  r = await call('POST', `${base}/brain-action-json`, {
    reply: { ...REPLY, task: 'Fetch the admin page', action: { type: 'shell', command: "curl -s 'https://evil.example/admin'" } },
  });
  check('out-of-scope JSON command refused (403 out_of_scope)', r.status === 403 && r.json.error === 'out_of_scope', JSON.stringify(r.json).slice(0, 200));
  r = await call('GET', `${base}/process`);
  check('refused step shows failed with its error', r.json.processStatus === 'failed' && r.json.taskStatus === 'failed' && r.json.error === 'out_of_scope' && r.json.task === 'Fetch the admin page', JSON.stringify(r.json).slice(0, 300));
  r = await call('POST', `${base}/brain-action-json`, {
    reply: { ...REPLY, task: 'File the XSS finding', action: { type: 'claim_finding', title: 'Reflected XSS in search', severity: 'high', command: 'curl x', evidence: 'too short', counterevidence: 'control', confidence: 'high' } },
  });
  check('gate-failing JSON claim bounced (422 claim_incomplete)', r.status === 422 && r.json.error === 'claim_incomplete', JSON.stringify(r.json).slice(0, 200));

  // 9. The form composer and the JSON route agree: the same shell action via brain-action returns the same shape.
  r = await call('POST', `${base}/brain-action`, { action: { action: 'shell', command: "curl -s 'http://172.17.0.1:3100/'" } });
  check('form-composer shell action returns the same shape (ok/hash/output/entry)', r.status === 200 && r.json.ok === true && typeof r.json.hash === 'string' && /DVWA login/.test(r.json.output) && r.json.entry.tool === 'shell', JSON.stringify(r.json).slice(0, 300));

  // 10. Hand the brain back to AI -> JSON replies are refused again.
  r = await call('POST', `${base}/brain-mode`, { mode: 'ai' });
  check('POST brain-mode ai ok', r.status === 200 && r.json.ok === true && r.json.brainMode === 'ai', JSON.stringify(r.json));
  check('resume-from-checkpoint machinery was invoked', shimCalls.resumeLoop.includes(HUNT_ID));
  r = await call('POST', `${base}/brain-action-json`, { reply: REPLY });
  check('brain-action-json refused again after handing back (409)', r.status === 409 && r.json.error === 'brain_mode_ai', JSON.stringify(r.json));

  // 11. The event log shows the whole flow in one place.
  const events = readHuntEvents(HUNT_ID);
  check('event log carries brain_mode + be-a-brain tool_calls + task_complete/task_failed', events.some((e) => e.type === 'status' && e.state === 'brain_mode' && e.brainMode === 'parent') && events.filter((e) => e.type === 'tool_call' && e.via === 'be-a-brain').length >= 2 && events.some((e) => e.type === 'task_complete' && e.via === 'brain-json') && events.some((e) => e.type === 'task_failed' && e.error === 'out_of_scope'));
} finally {
  await new Promise((resolve) => server.close(resolve));
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\nlab-brain-json: ${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log('lab-brain-json: FAILED');
  process.exit(1);
}
console.log('lab-brain-json: ALL CHECKS PASSED (fake container shim — no docker in this sandbox; live container path untested here)');
