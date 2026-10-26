// HUNTER-MIND lane (26 Oct 2026): the brain plans its own hunt,
// its outputs are saved, and a second pass recalls them instead of
// re-running — tested end-to-end through a stubbed humanIteration.
//
//   HM-I1  the brain writes its own plan; the plan file holds it;
//          the next screen shows the plan with marks + NEXT step.
//   HM-I2  a step marked done with evidence stays done; the screen
//          shows [x]; a revised list never resurrects it.
//   HM-I3  a shell output is saved; the same command a turn later
//          is answered from the record — 0 exec calls on the repeat
//          — and an output_recall event is recorded.
//   HM-I4  the same command WITH "force": true + "why" re-runs,
//          and the new output overwrites the saved one.
//   HM-I5  a repeated search is answered from its saved results
//          (0 search calls on the repeat).
//   HM-I6  the system prompt the brain actually receives carries
//          the ownership identity, the hunter-narration instruction,
//          and the hunt_plan action.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-huntermind-'));
process.env.DATA_DIR = tmpRoot;

const { humanIteration } = await import('./humanLoop.js');
const { loadHuntPlan } = await import('./huntPlan.js');
const { loadOutputs, findOutput } = await import('./outputMemory.js');

const TARGET = 'https://scanme.nmap.org';
const NMAP_CMD = 'nmap -sV scanme.nmap.org';
const NMAP_OUT = 'Nmap scan report for scanme.nmap.org\nPORT STATE SERVICE\n22/tcp open ssh\n80/tcp open http';

const SNAP = {
  url: TARGET,
  title: 'scanme',
  text: 'scanme.nmap.org',
  elements: [],
};

function stubSession(huntId, replies, { execImpl = null, searchImpl = null } = {}) {
  const recorded = [];
  const execCalls = [];
  const screens = [];
  const systems = [];
  const searchCalls = [];
  let n = 0;
  // NOTE: the shell branch runs through deps.exec (executeWithEvasion),
  // NOT deps.execRaw (the container exec used by the desktop and the
  // machine-state probes) — the harness stubs both channels.
  const execRaw = async (h, cmd) => {
    if (String(cmd || '').includes('nmap')) return { stdout: NMAP_OUT, stderr: '', code: 0 };
    return { stdout: '', stderr: '' };
  };
  const exec = execImpl || (async (h, t, cmd) => {
    execCalls.push(String(cmd || ''));
    if (String(cmd || '').includes('nmap')) return { stdout: NMAP_OUT, stderr: '', code: 0 };
    return { stdout: '', stderr: '' };
  });
  return {
    recorded, execCalls, screens, systems, searchCalls,
    run: () => humanIteration(huntId, TARGET, {
      turns: replies.length,
      deps: {
        chat: async (messages, system) => { screens.push(messages[0].text); systems.push(String(system || '')); return replies[n++]; },
        gui: {
          open: async () => ({ observation: 'opened', snapshot: SNAP }),
          snapshot: async () => ({ observation: `Page: ${TARGET}`, snapshot: SNAP }),
          click: async () => ({ ok: true, observation: 'clicked', snapshot: SNAP }),
          type: async () => ({ ok: true, observation: 'Typed.', snapshot: SNAP }),
          screenshot: async () => ({ observation: 'shot', snapshot: SNAP }),
        },
        execRaw,
        exec,
        search: searchImpl || (async (q) => { searchCalls.push(q); return `results for ${q}`; }),
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => ({}),
        readEvents: () => [],
        buildBriefing: async () => '',
        machineControlled: () => false,
        assess: null,
      },
    }),
  };
}

const planReply = (steps) => `abhi main apna plan banata hoon — pehle nmap, phir subdomains, phir BurpSuite.\n${JSON.stringify({ action: 'hunt_plan', steps })}`;

// HM-I1: the brain writes its own plan; the screen shows it.
test('HM-I1: the brain writes its own plan; the next screen shows it with NEXT', async () => {
  const huntId = 'h_hm_i1';
  const s = stubSession(huntId, [
    planReply(['run nmap on scanme.nmap.org', 'enumerate subdomains of scanme.nmap.org', 'open BurpSuite and proxy the traffic']),
    '{"action":"note","text":"plan written"}',
  ]);
  await s.run();
  const plan = loadHuntPlan(huntId);
  assert.equal(plan.steps.length, 3);
  assert.equal(plan.steps[0].text, 'run nmap on scanme.nmap.org');
  assert.equal(plan.steps[0].status, 'todo');
  assert.ok(s.screens[1].includes('YOUR HUNT PLAN'), 'the plan rides the next screen');
  assert.ok(s.screens[1].includes('[ ] run nmap on scanme.nmap.org'));
  assert.ok(s.screens[1].includes('NEXT: step 1'));
  assert.ok(!s.screens[1].includes('nmap, subdomains — then the tools'), 'the loop never hands the brain a template plan');
});

// HM-I2: a step marked done stays done; the screen shows [x].
test('HM-I2: a done step stays done and shows [x]; a revision never resurrects it', async () => {
  const huntId = 'h_hm_i2';
  const s = stubSession(huntId, [
    planReply(['run nmap on scanme.nmap.org', 'enumerate subdomains of scanme.nmap.org']),
    `{"action":"hunt_plan","done":1,"evidence":"nmap output saved"}`,
    planReply(['run nmap on scanme.nmap.org', 'enumerate subdomains of scanme.nmap.org', 'probe the open ports']),
    '{"action":"note","text":"revised"}',
  ]);
  await s.run();
  const plan = loadHuntPlan(huntId);
  assert.equal(plan.steps.length, 3);
  assert.equal(plan.steps[0].status, 'done', 'a revised list never resurrects a finished step');
  assert.equal(plan.steps[0].evidence, 'nmap output saved');
  assert.equal(plan.steps[2].status, 'todo');
  assert.ok(s.screens[2].includes('[x] run nmap on scanme.nmap.org'));
  assert.ok(s.screens[2].includes('NEXT: step 2'));
});

// HM-I3: a shell output is saved and recalled — 0 exec calls on the repeat.
test('HM-I3: a repeated shell command is answered from the saved output, not re-run', async () => {
  const huntId = 'h_hm_i3';
  const s = stubSession(huntId, [
    `{"action":"shell","command":"${NMAP_CMD}"}`,
    `{"action":"shell","command":"${NMAP_CMD}"}`,
    '{"action":"note","text":"used the recalled output"}',
  ]);
  await s.run();
  assert.equal(s.execCalls.length, 1, 'the repeat must not execute');
  assert.ok(s.execCalls[0].includes('nmap -sV scanme.nmap.org'));
  const recall = s.recorded.find((e) => e.type === 'output_recall');
  assert.ok(recall, 'a recall event is recorded');
  assert.equal(recall.tool, 'shell');
  // The recall observation rides the NEXT screen as the last observation.
  assert.ok(s.screens[2].includes('RECALL — you already ran this'), 'the brain sees the saved output, not a re-run');
  assert.ok(s.screens[2].includes('22/tcp open ssh'), 'the saved output rides the observation');
  // And the ledger on disk holds it.
  const saved = findOutput(loadOutputs(huntId), `shell|${NMAP_CMD}`);
  assert.ok(saved);
  assert.equal(saved.runs, 1);
});

// HM-I4: force + why re-runs and overwrites.
test('HM-I4: a forced re-run with a reason executes and overwrites the saved output', async () => {
  const huntId = 'h_hm_i4';
  const NEW_OUT = 'Nmap scan report for scanme.nmap.org\nPORT STATE SERVICE\n22/tcp open ssh\n80/tcp open http\n443/tcp open https';
  let calls = 0;
  const s = stubSession(huntId, [
    `{"action":"shell","command":"${NMAP_CMD}"}`,
    JSON.stringify({ action: 'shell', command: NMAP_CMD, force: true, why: 'the target added port 443 since the first run' }),
    '{"action":"note","text":"used the new output"}',
  ], {
    execImpl: async (h, t, cmd) => {
      calls++;
      return { stdout: calls === 1 ? NMAP_OUT : NEW_OUT, stderr: '', code: 0 };
    },
  });
  await s.run();
  assert.equal(calls, 2, 'a forced re-run executes');
  assert.equal(s.recorded.filter((e) => e.type === 'output_recall').length, 0, 'a forced re-run is not a recall');
  const saved = findOutput(loadOutputs(huntId), `shell|${NMAP_CMD}`);
  assert.equal(saved.runs, 2);
  assert.equal(saved.forced, true);
  assert.ok(saved.output.includes('443/tcp open https'));
});

// HM-I5: a repeated search is answered from its saved results.
test('HM-I5: a repeated search returns its saved results — 0 search calls on the repeat', async () => {
  const huntId = 'h_hm_i5';
  const q = 'subdomain enumeration tools for bug bounty';
  const s = stubSession(huntId, [
    JSON.stringify({ action: 'search', query: q }),
    JSON.stringify({ action: 'search', query: q }),
    '{"action":"note","text":"used the recalled results"}',
  ]);
  await s.run();
  assert.equal(s.searchCalls.length, 1, 'the repeat search must not run');
  assert.ok(s.recorded.some((e) => e.type === 'output_recall' && e.tool === 'search'));
  assert.ok(s.screens[2].includes('RECALL — you already ran this'));
});

// HM-I6: the system prompt carries identity + narration + hunt_plan.
test('HM-I6: the brain receives the ownership identity, the narration rule, and hunt_plan', async () => {
  const huntId = 'h_hm_i6';
  const s = stubSession(huntId, ['{"action":"note","text":"hi"}']);
  await s.run();
  const system = s.systems[0];
  assert.ok(system.includes('This Kali machine is YOURS'), 'the identity paragraph reaches the brain');
  assert.ok(system.includes('think aloud like a hunter'), 'the narration instruction reaches the brain');
  assert.ok(system.includes('never a status template'), 'the anti-template rule reaches the brain');
  assert.ok(system.includes('"action":"hunt_plan"'), 'the plan action reaches the brain');
  assert.ok(system.includes('"force": true'), 'the redo mechanism reaches the brain');
  assert.ok(!system.includes('nmap, subdomains — then the tools'), 'no template plan is smuggled in the prompt');
});
