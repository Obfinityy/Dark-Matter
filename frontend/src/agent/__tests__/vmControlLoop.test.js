/**
 * vmControlLoop.test.js — Infinity AI VM control loop, pure logic.
 *
 * Covers what backend/tests/vmHuntWiring.test.js does NOT: the frontend
 * loop's own building blocks — extractJsonObject, validateAction (design §4
 * action protocol), hostInScope (design §7 scope gate), browser-direct brain
 * adapters, and the loop state machine (start/pause/resume/stop/ask) with
 * mocked brains + runner.
 *
 * Pure logic only: no VM, no models, no network. The scope-gate path is
 * verified to never call the runner for blocked commands.
 * Run: node --test frontend/src/agent/__tests__/vmControlLoop.test.js
 * (from the repo root)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

const {
  extractJsonObject,
  validateAction,
  hostInScope,
  createBrowserDirectBrains,
  createVmControlLoop,
  ACTION_TYPES,
  GROUNDING_SPACE,
  MAX_STEPS_DEFAULT,
} = await import('../vmControlLoop.js');

/* ------------------------------------------------------------------ */
/* extractJsonObject                                                    */
/* ------------------------------------------------------------------ */

describe('extractJsonObject', () => {
  test('parses a plain JSON object', () => {
    assert.deepEqual(extractJsonObject('{"a":1}'), { a: 1 });
  });

  test('extracts JSON embedded in model prose', () => {
    const raw = 'Here is the action:\n{"type":"shell","command":"nmap -sV 10.0.2.15"}\nGood luck.';
    assert.deepEqual(extractJsonObject(raw), { type: 'shell', command: 'nmap -sV 10.0.2.15' });
  });

  test('ignores braces inside JSON strings and markdown fences', () => {
    const raw = '```json\n{"text": "a } b { c", "n": 2}\n```';
    assert.deepEqual(extractJsonObject(raw), { text: 'a } b { c', n: 2 });
  });

  test('handles nested objects', () => {
    assert.deepEqual(extractJsonObject('x {"a": {"b": [1, {"c": "}"}]}} y'),
      { a: { b: [1, { c: '}' }] } });
  });

  test('returns null when there is no usable JSON', () => {
    assert.equal(extractJsonObject('no json here'), null);
    assert.equal(extractJsonObject('{"unclosed": true'), null);
    assert.equal(extractJsonObject('{"bad": tru}'), null);
    assert.equal(extractJsonObject(null), null);
    assert.equal(extractJsonObject(''), null);
  });

  test('returns the FIRST balanced object', () => {
    assert.deepEqual(extractJsonObject('{"first":1} {"second":2}'), { first: 1 });
  });
});

/* ------------------------------------------------------------------ */
/* validateAction (design §4)                                           */
/* ------------------------------------------------------------------ */

describe('validateAction', () => {
  test('ACTION_TYPES has the 7 VM actions, frozen, without done', () => {
    assert.deepEqual([...ACTION_TYPES], ['shell', 'shellBg', 'click', 'type', 'key', 'scroll', 'screenshot']);
    assert.ok(Object.isFrozen(ACTION_TYPES));
    assert.ok(!ACTION_TYPES.includes('done'));
    assert.equal(GROUNDING_SPACE, 1000);
  });

  test('shell: trims command, passes cwd, clamps timeoutMs', () => {
    const r = validateAction({ type: 'shell', command: '  nmap -sV 10.0.2.15  ', cwd: '/home/kali', timeoutMs: 60000 });
    assert.equal(r.ok, true);
    assert.equal(r.action.command, 'nmap -sV 10.0.2.15');
    assert.equal(r.action.cwd, '/home/kali');
    assert.equal(r.action.timeoutMs, 60000);
  });

  test('shell: timeoutMs clamps to [5000, 1800000]', () => {
    assert.equal(validateAction({ type: 'shell', command: 'ls', timeoutMs: 999 }).action.timeoutMs, 5000);
    assert.equal(validateAction({ type: 'shell', command: 'ls', timeoutMs: 99_999_999 }).action.timeoutMs, 1_800_000);
    assert.equal(validateAction({ type: 'shell', command: 'ls', timeoutMs: 'soon' }).action.timeoutMs, undefined);
    assert.equal(validateAction({ type: 'shell', command: 'ls' }).action.timeoutMs, undefined);
  });

  test('shell: rejects missing or over-long commands', () => {
    assert.match(validateAction({ type: 'shell', command: '   ' }).error, /needs a "command"/);
    assert.match(validateAction({ type: 'shell' }).error, /needs a "command"/);
    assert.match(validateAction({ type: 'shellBg', command: 'x'.repeat(4001) }).error, /too long/);
  });

  test('click: clamps x/y to 0–1000, defaults button to left', () => {
    const r = validateAction({ type: 'click', x: 1200, y: -5 });
    assert.equal(r.ok, true);
    assert.deepEqual(r.action, { type: 'click', x: 1000, y: 0, button: 'left' });
  });

  test('click: accepts an element description for the grounding brain', () => {
    const r = validateAction({ type: 'click', element: 'the Submit button' });
    assert.equal(r.ok, true);
    assert.equal(r.action.element, 'the Submit button');
  });

  test('click: rejects missing coordinates without an element', () => {
    assert.match(validateAction({ type: 'click' }).error, /needs x\/y/);
    assert.match(validateAction({ type: 'click', x: 'abc', y: 50 }).error, /needs x\/y/);
  });

  test('click: unknown buttons fall back to left', () => {
    assert.equal(validateAction({ type: 'click', x: 1, y: 1, button: 'weird' }).action.button, 'left');
    assert.equal(validateAction({ type: 'click', x: 1, y: 1, button: 'right' }).action.button, 'right');
  });

  test('type: requires text, caps at 2000 chars', () => {
    assert.equal(validateAction({ type: 'type', text: 'hello' }).ok, true);
    assert.match(validateAction({ type: 'type', text: '' }).error, /needs "text"/);
    assert.match(validateAction({ type: 'type', text: 'x'.repeat(2001) }).error, /too long/);
    const r = validateAction({ type: 'type', text: 'admin', element: 'username field' });
    assert.equal(r.action.element, 'username field');
  });

  test('key: allows key names and chords, rejects shell-ish input', () => {
    for (const k of ['Enter', 'Tab', 'Escape', 'F5', 'ctrl+l', 'alt+F4']) {
      assert.equal(validateAction({ type: 'key', key: k }).ok, true, k);
    }
    assert.match(validateAction({ type: 'key', key: 'rm -rf /' }).error, /looks unsafe/);
    assert.match(validateAction({ type: 'key', key: '' }).error, /looks unsafe/);
    assert.match(validateAction({ type: 'key', key: 'a'.repeat(31) }).error, /looks unsafe/);
  });

  test('scroll: requires numeric dy within ±5000, rounds', () => {
    assert.equal(validateAction({ type: 'scroll', dy: -240 }).action.dy, -240);
    assert.equal(validateAction({ type: 'scroll', dy: 10.7 }).action.dy, 11);
    assert.match(validateAction({ type: 'scroll', dy: 'down' }).error, /numeric/);
    assert.match(validateAction({ type: 'scroll', dy: 99999 }).error, /±5000/);
  });

  test('screenshot: accepts an optional purpose', () => {
    assert.equal(validateAction({ type: 'screenshot' }).ok, true);
    assert.equal(validateAction({ type: 'screenshot', purpose: 'check output' }).action.purpose, 'check output');
  });

  test('done: truncates long summaries', () => {
    const r = validateAction({ type: 'done', summary: 'x'.repeat(5000) });
    assert.equal(r.ok, true);
    assert.equal(r.action.summary.length, 2000);
  });

  test('rejects unknown types and non-objects', () => {
    const r = validateAction({ type: 'hack' });
    assert.equal(r.ok, false);
    assert.match(r.error, /unknown action type "hack"/);
    assert.match(r.error, /shell/);
    assert.match(validateAction({ type: 'DONE' }).error, /unknown action type/);
    assert.match(validateAction(null).error, /must be an object/);
    assert.match(validateAction('shell').error, /must be an object/);
  });
});

/* ------------------------------------------------------------------ */
/* hostInScope (design §7)                                               */
/* ------------------------------------------------------------------ */

describe('hostInScope', () => {
  test('allows the exact host and subdomains, case-insensitively', () => {
    assert.equal(hostInScope('example.com', ['example.com']), true);
    assert.equal(hostInScope('Example.COM', ['example.com']), true);
    assert.equal(hostInScope('sub.example.com', ['example.com']), true);
    assert.equal(hostInScope('deep.sub.example.com', ['example.com']), true);
  });

  test('denies lookalikes and unrelated hosts', () => {
    assert.equal(hostInScope('evil.com', ['example.com']), false);
    assert.equal(hostInScope('example.com.evil.com', ['example.com']), false);
    assert.equal(hostInScope('notexample.com', ['example.com']), false);
  });

  test('VM sandbox networking is always in scope', () => {
    for (const h of ['localhost', '127.0.0.1', '127.5.6.7', '10.0.2.15',
      '192.168.1.10', '172.16.5.5', '172.31.255.254', '::1', '[::1]']) {
      assert.equal(hostInScope(h, ['example.com']), true, h);
      assert.equal(hostInScope(h, []), true, `${h} with empty scope`);
    }
  });

  test('172.32+ is NOT a safe-local range', () => {
    assert.equal(hostInScope('172.32.0.1', []), false);
    assert.equal(hostInScope('172.15.0.1', []), false);
  });

  test('empty scope denies everything except safe-local', () => {
    assert.equal(hostInScope('example.com', []), false);
    assert.equal(hostInScope('example.com', null), false);
  });

  test('blank hosts are denied', () => {
    assert.equal(hostInScope('', ['example.com']), false);
    assert.equal(hostInScope(null, ['example.com']), false);
  });
});

/* ------------------------------------------------------------------ */
/* createBrowserDirectBrains                                             */
/* ------------------------------------------------------------------ */

describe('createBrowserDirectBrains', () => {
  test('passes ready providers through untouched', () => {
    const hacker = { generate: async () => 'x' };
    const grounding = { generateStructured: async () => ({ x: 1, y: 2 }) };
    const brains = createBrowserDirectBrains({ hacker, vision: null, grounding });
    assert.equal(brains.hacker, hacker);
    assert.equal(brains.grounding, grounding);
    assert.equal(brains.vision, null);
  });

  test('null specs degrade to null brains', () => {
    assert.deepEqual(createBrowserDirectBrains({}), { hacker: null, vision: null, grounding: null });
    assert.deepEqual(createBrowserDirectBrains(), { hacker: null, vision: null, grounding: null });
  });

  test('gradio vision slot fails closed with a multimodal hint', async () => {
    const brains = createBrowserDirectBrains({ vision: { kind: 'gradio', url: 'https://x.gradio.live' } });
    await assert.rejects(() => brains.vision.generate([]), /multimodal/);
  });

  test('grounding text adapter parses coordinates from prose', async () => {
    const brains = createBrowserDirectBrains({
      grounding: { generate: async () => 'Found it: {"x": 500, "y": 250, "confidence": 0.75}' },
    });
    const r = await brains.grounding.generateStructured([{ role: 'user', content: 'find it' }], {});
    assert.deepEqual(r, { x: 500, y: 250, confidence: 0.75 });
  });

  test('grounding text adapter defaults missing confidence to null', async () => {
    const brains = createBrowserDirectBrains({
      grounding: { generate: async () => '{"x": 10, "y": 20}' },
    });
    assert.deepEqual(await brains.grounding.generateStructured([], {}), { x: 10, y: 20, confidence: null });
  });

  test('grounding text adapter rejects prose without coordinates', async () => {
    const brains = createBrowserDirectBrains({
      grounding: { generate: async () => 'I see no button anywhere' },
    });
    await assert.rejects(() => brains.grounding.generateStructured([], {}), /no coordinates/);
  });

  test('gradio/localChat text slots produce a generate function without network calls', () => {
    const brains = createBrowserDirectBrains({
      hacker: { kind: 'gradio', url: 'https://x.gradio.live' },
      vision: { kind: 'localChat', baseUrl: 'http://127.0.0.1:8080', modelId: 'm' },
    });
    assert.equal(typeof brains.hacker.generate, 'function');
    assert.equal(typeof brains.vision.generate, 'function');
  });
});

/* ------------------------------------------------------------------ */
/* optional grounding: vision fallback                                   */
/* ------------------------------------------------------------------ */

describe('optional grounding (vision fallback)', () => {
  test('vision-only setup builds a vision-fallback grounding adapter', () => {
    const brains = createBrowserDirectBrains({
      vision: { generate: async () => '{"x": 400, "y": 300, "confidence": 0.8}' },
    });
    assert.ok(brains.vision, 'vision adapter present');
    assert.ok(brains.grounding, 'grounding falls back to vision');
    assert.equal(brains.grounding.source, 'vision-fallback');
  });

  test('fallback parses coordinates from vision prose', async () => {
    const brains = createBrowserDirectBrains({
      vision: { generate: async () => 'The button is at {"x": 500, "y": 250}' },
    });
    const r = await brains.grounding.generateStructured([{ role: 'user', content: 'find it' }], {});
    assert.deepEqual(r, { x: 500, y: 250, confidence: null });
  });

  test('fallback keeps confidence when the vision brain provides it', async () => {
    const brains = createBrowserDirectBrains({
      vision: { generate: async () => '{"x": 10, "y": 20, "confidence": 0.6}' },
    });
    const r = await brains.grounding.generateStructured([], {});
    assert.deepEqual(r, { x: 10, y: 20, confidence: 0.6 });
  });

  test('dedicated grounding wins when both brains are connected', () => {
    const brains = createBrowserDirectBrains({
      vision: { generate: async () => '{"x": 9, "y": 9}' },
      grounding: { generate: async () => '{"x": 1, "y": 2}' },
    });
    assert.equal(brains.grounding.source, 'grounding');
  });

  test('dedicated ready provider passes through untouched', () => {
    const grounding = { generateStructured: async () => ({ x: 1, y: 2 }) };
    const brains = createBrowserDirectBrains({
      vision: { generate: async () => '{"x": 9, "y": 9}' },
      grounding,
    });
    assert.equal(brains.grounding, grounding);
  });

  test('no vision and no grounding leaves grounding null', () => {
    const brains = createBrowserDirectBrains({ hacker: { generate: async () => 'x' } });
    assert.equal(brains.vision, null);
    assert.equal(brains.grounding, null);
  });

  test('fallback rejects vision prose without coordinates', async () => {
    const brains = createBrowserDirectBrains({
      vision: { generate: async () => 'I cannot see any button on this screen' },
    });
    await assert.rejects(() => brains.grounding.generateStructured([], {}), /no coordinates/);
  });

  test('fallback clamps out-of-range coordinates into 0-1000 space', async () => {
    const brains = createBrowserDirectBrains({
      vision: { generate: async () => '{"x": 5000, "y": -20}' },
    });
    const r = await brains.grounding.generateStructured([], {});
    assert.deepEqual(r, { x: 1000, y: 0, confidence: null });
  });
});

/* ------------------------------------------------------------------ */
/* createVmControlLoop state machine                                     */
/* ------------------------------------------------------------------ */

function scriptedHacker(script) {
  let i = 0;
  return {
    generate: async () => {
      const step = script[Math.min(i, script.length - 1)];
      i += 1;
      return JSON.stringify(step);
    },
  };
}

function mockRunnerApi(overrides = {}) {
  const calls = { exec: [], saveMemory: [] };
  return {
    calls,
    async exec(args) {
      calls.exec.push(args);
      return { exit_code: 0, stdout: 'open\n', stderr: '', timed_out: false };
    },
    async saveMemory(args) {
      calls.saveMemory.push(args);
      return undefined;
    },
    ...overrides,
  };
}

describe('createVmControlLoop', () => {
  test('requires runnerApi and sessionId', () => {
    assert.throws(() => createVmControlLoop({ sessionId: 's' }), /runnerApi is required/);
    assert.throws(() => createVmControlLoop({ runnerApi: {} }), /sessionId is required/);
  });

  test('starts idle with sane defaults', () => {
    const loop = createVmControlLoop({ runnerApi: mockRunnerApi(), sessionId: 's-0' });
    const st = loop.getState();
    assert.equal(st.status, 'idle');
    assert.equal(st.step, 0);
    assert.equal(st.maxSteps, MAX_STEPS_DEFAULT);
    assert.deepEqual(st.scope, []);
    assert.equal(st.findings, 0);
  });

  test('pause/resume/stop are no-ops while idle', () => {
    const loop = createVmControlLoop({ runnerApi: mockRunnerApi(), sessionId: 's-0' });
    assert.equal(loop.pause(), false);
    assert.equal(loop.resume(), false);
  });

  test('start rejects an empty task', async () => {
    const loop = createVmControlLoop({ runnerApi: mockRunnerApi(), sessionId: 's-0' });
    await assert.rejects(() => loop.start('   '), /needs a task description/);
  });

  test('start rejects a second start for the same session', async () => {
    const runnerApi = mockRunnerApi();
    const brains = { hacker: scriptedHacker([{ action: { type: 'done', summary: 'ok' } }]) };
    const loop = createVmControlLoop({ runnerApi, brains, sessionId: 's-dup', onEvent: () => {} });
    await loop.start('task');
    await assert.rejects(() => loop.start('task'), /already started/);
  });

  test('runs think→act→observe to a done action', async () => {
    const events = [];
    const runnerApi = mockRunnerApi();
    const brains = {
      hacker: scriptedHacker([
        { thought: 'scan the guest', action: { type: 'shell', command: 'nmap -sV 10.0.2.15' } },
        { thought: 'finished', action: { type: 'done', summary: 'port scan complete' } },
      ]),
    };
    const loop = createVmControlLoop({
      runnerApi, brains, sessionId: 's-run', onEvent: (e) => events.push(e),
      options: { maxSteps: 5 },
    });
    const result = await loop.start('Map open ports', { authorizedTargets: ['example.com'] });

    assert.equal(result.status, 'completed');
    assert.equal(result.reason, 'done');
    assert.equal(result.summary, 'port scan complete');
    assert.equal(runnerApi.calls.exec.length, 1);
    assert.equal(runnerApi.calls.exec[0].command, 'nmap -sV 10.0.2.15');
    const types = events.map((e) => e.type);
    for (const t of ['started', 'step', 'thought', 'action', 'observation', 'completed']) {
      assert.ok(types.includes(t), `missing event ${t}`);
    }
    assert.equal(events.find((e) => e.type === 'completed').findings, 0);
  });

  test('scope gate blocks out-of-scope shell commands without touching the runner', async () => {
    const events = [];
    const runnerApi = mockRunnerApi();
    const brains = {
      hacker: scriptedHacker([
        { thought: 'probe it', action: { type: 'shell', command: 'nmap -sV evil.com' } },
        { thought: 'staying in scope now', action: { type: 'done', summary: 'stayed in scope' } },
      ]),
    };
    const loop = createVmControlLoop({
      runnerApi, brains, sessionId: 's-gate', onEvent: (e) => events.push(e),
      options: { maxSteps: 5 },
    });
    const result = await loop.start('Test the target', { authorizedTargets: ['example.com'] });

    const blocked = events.find((e) => e.type === 'gate.blocked');
    assert.ok(blocked, 'gate.blocked event must fire');
    assert.deepEqual(blocked.hosts, ['evil.com']);
    assert.equal(runnerApi.calls.exec.length, 0, 'blocked command must never reach the runner');
    assert.equal(result.status, 'completed');
    assert.equal(result.reason, 'done');
  });

  test('records findings with severity normalization', async () => {
    const events = [];
    const runnerApi = mockRunnerApi();
    const brains = {
      hacker: scriptedHacker([
        {
          thought: 'found it',
          action: { type: 'done', summary: 'done' },
          finding: { title: 'SQLi in login', severity: 'CRITICAL', description: 'd', evidence: 'e' },
        },
      ]),
    };
    const loop = createVmControlLoop({
      runnerApi, brains, sessionId: 's-find', onEvent: (e) => events.push(e),
    });
    const result = await loop.start('Find vulns', { authorizedTargets: ['example.com'] });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].severity, 'critical');
    assert.equal(result.findings[0].title, 'SQLi in login');
    assert.ok(events.find((e) => e.type === 'finding'), 'finding event must fire');
  });

  test('unknown severity normalizes to informational', async () => {
    const runnerApi = mockRunnerApi();
    const brains = {
      hacker: scriptedHacker([
        {
          action: { type: 'done', summary: 'done' },
          finding: { title: 'weird', severity: 'catastrophic' },
        },
      ]),
    };
    const loop = createVmControlLoop({ runnerApi, brains, sessionId: 's-sev' });
    const result = await loop.start('t', { authorizedTargets: ['example.com'] });
    assert.equal(result.findings[0].severity, 'informational');
  });

  test('ask() answers from the hacking brain mid-session', async () => {
    const events = [];
    const runnerApi = mockRunnerApi();
    const brains = { hacker: { generate: async () => '3 ports open so far.' } };
    const loop = createVmControlLoop({
      runnerApi, brains, sessionId: 's-ask', onEvent: (e) => events.push(e),
    });
    const answer = await loop.ask('What did you find?');
    assert.equal(answer, '3 ports open so far.');
    const ev = events.find((e) => e.type === 'ask.answered');
    assert.ok(ev);
    assert.equal(ev.question, 'What did you find?');
  });

  test('ask() requires a question and a hacker brain', async () => {
    const loop = createVmControlLoop({
      runnerApi: mockRunnerApi(),
      brains: { hacker: { generate: async () => 'x' } },
      sessionId: 's-ask2',
    });
    await assert.rejects(() => loop.ask('   '), /needs a question/);
    const noBrain = createVmControlLoop({ runnerApi: mockRunnerApi(), brains: {}, sessionId: 's-ask3' });
    await assert.rejects(() => noBrain.ask('hi'), /hacking brain unavailable/);
  });
});
