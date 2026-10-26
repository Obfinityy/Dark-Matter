// HUMAN-BRAIN lane (26 Oct 2026, owner order, extends hunter-mind):
//   (1) NO PREDEFINED SEQUENCE — the brain never follows a fixed
//       recon→scan→exploit script; every step is decided fresh from
//       memory + live observation.
//   (2) PER-HUNT MEMORY ISOLATION — covered by
//       globalMemory.isolation.test.js (ISO-1..ISO-5).
//   (3) GUI-VISIBLE TERMINAL — terminal work happens in a terminal
//       window ON the GUI desktop, typed visibly, so the owner
//       watches it live.
//
//   HB-B1  the typed line wraps the command in a subshell, tees its
//          output to the per-hunt log, and appends the exit marker;
//          newlines are stripped; the command is capped.
//   HB-B2  parseTerminalExit reads the marker (or null while running).
//   HB-B3  the log file is per-hunt and shell-safe.
//   HB-T1  desktop_terminal happy path: terminal present — focus,
//          type visibly, Return, log read back, screenshot artifact,
//          output saved in the ledger under the shell signature.
//   HB-T2  no terminal open — the loop launches xfce4-terminal first.
//   HB-T3  desktop down — the loop starts the desktop first.
//   HB-T4  a repeated desktop_terminal command is recalled from the
//          saved output (0 exec calls on the repeat).
//   HB-T5  an out-of-scope command is blocked before anything runs.
//   HB-T6  a heavy-scan command is blocked when the programme
//          forbids it.
//   HB-P1  the system prompt carries the no-fixed-order rule and the
//          desktop_terminal action, and no fixed-sequence wording.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-humanbrain-'));
process.env.DATA_DIR = tmpRoot;

const { humanIteration } = await import('./humanLoop.js');
const { loadOutputs, findOutput } = await import('./outputMemory.js');
const {
  DESKTOP_TERMINAL_COMMAND_CAP,
  desktopTerminalLogFile,
  desktopTerminalWrapCommand,
  parseTerminalExit,
} = await import('./desktopControl.js');
const { parseScope } = await import('./scopeParser.js');

const TARGET = 'https://scanme.nmap.org';

const SNAP = { url: TARGET, title: 'scanme', text: 'scanme.nmap.org', elements: [] };

const WINDOWS_OUT = [
  '11111', '22222',
  '---TITLES---',
  'Chromium — scanme', 'Terminal',
  '---ACTIVE---',
  'Chromium — scanme',
].join('\n');
const TERMINAL_OUT = ['22222', '---TITLES---', 'Terminal'].join('\n');
const EMPTY_WINDOWS = '';

// A fake container desktop: stateful enough to prove the sequence
// (windows -> terminal class search -> click -> type -> Return ->
// log read -> screenshot). `downFirst` makes the first windows
// read empty so the loop must start the desktop.
function stubDesktop({ downFirst = false, terminalOpen = true } = {}) {
  const calls = [];
  let launched = false;
  let started = false;
  let windowsReads = 0;
  const execRaw = async (h, cmd) => {
    calls.push(String(cmd || ''));
    const c = String(cmd || '');
    if (c.includes('xdotool search --onlyvisible --name')) {
      windowsReads++;
      if (downFirst && windowsReads === 1 && !started) return { stdout: '', stderr: 'cannot open display' };
      return { stdout: WINDOWS_OUT, stderr: '' };
    }
    if (c.includes('--class xfce4-terminal')) {
      return { stdout: (terminalOpen || launched) ? TERMINAL_OUT : EMPTY_WINDOWS, stderr: '' };
    }
    if (c.includes('xfce4-terminal --disable-server')) { launched = true; return { stdout: 'launched', stderr: '' }; }
    if (c.includes('windowactivate')) return { stdout: 'clicked', stderr: '' };
    if (c.includes('xdotool type')) return { stdout: 'typed', stderr: '' };
    if (c.includes('xdotool key')) return { stdout: 'key_sent', stderr: '' };
    if (c.includes('cat ') && c.includes('/tmp/dt-')) return { stdout: 'hello-terminal\n__DT_EXIT__:0\n', stderr: '' };
    return { stdout: '', stderr: '' };
  };
  return {
    calls, execRaw,
    get launched() { return launched; },
    get started() { return started; },
    startDesktop: async () => { started = true; },
  };
}

function stubSession(huntId, replies, { desktop = null, parsedScope = null, execImpl = null } = {}) {
  const d = desktop || stubDesktop();
  const recorded = [];
  const screens = [];
  const systems = [];
  const shotCalls = [];
  let n = 0;
  return {
    recorded, screens, systems, shotCalls, desktop: d,
    run: () => humanIteration(huntId, TARGET, {
      turns: replies.length,
      ...(parsedScope ? { parsedScope } : {}),
      deps: {
        chat: async (messages, system) => { screens.push(messages[0].text); systems.push(String(system || '')); return replies[n++]; },
        gui: {
          open: async () => ({ observation: 'opened', snapshot: SNAP }),
          snapshot: async () => ({ observation: `Page: ${TARGET}`, snapshot: SNAP }),
          click: async () => ({ ok: true, observation: 'clicked', snapshot: SNAP }),
          type: async () => ({ ok: true, observation: 'Typed.', snapshot: SNAP }),
          screenshot: async () => ({ observation: 'shot', snapshot: SNAP }),
        },
        execRaw: d.execRaw,
        exec: execImpl || (async () => ({ stdout: '', stderr: '', code: 0 })),
        search: async () => 'no results',
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => ({}),
        readEvents: () => [],
        buildBriefing: async () => '',
        machineControlled: () => false,
        desktopScreenshot: async () => { shotCalls.push(1); return { ok: true, name: 'desktop-20261026190000.jpg' }; },
        startDesktop: d.startDesktop,
        assess: null,
      },
    }),
  };
}

const termReply = (cmd) => `abhi main terminal me ye command chalata hoon, owner live dekh raha hai.\n${JSON.stringify({ action: 'desktop_terminal', command: cmd })}`;

// --- Builders (pure) -------------------------------------------------------

test('HB-B1: the typed line wraps, tees, and marks the exit; newlines stripped; capped', () => {
  const wrapped = desktopTerminalWrapCommand('echo hi\nnmap -sV x', '/tmp/dt-h1.log');
  assert.ok(!wrapped.includes('\n'), 'a newline inside typed text would act as Return mid-command');
  assert.ok(wrapped.startsWith('( echo hi nmap -sV x ) 2>&1 | tee '), 'subshell + tee');
  assert.ok(wrapped.includes(`'/tmp/dt-h1.log'`), 'log path single-quoted');
  assert.ok(wrapped.includes('echo __DT_EXIT__:${PIPESTATUS[0]} >> '), 'exit marker appended to the same log');
  const long = desktopTerminalWrapCommand('x'.repeat(600), '/tmp/dt-h1.log');
  assert.ok(long.length <= 500, 'the typed line must fit xdotool type (500 cap)');
  assert.ok(desktopTerminalWrapCommand('echo hi', '/tmp/dt-h1.log').includes('echo hi'));
});

test('HB-B2: parseTerminalExit reads the marker, null while running', () => {
  assert.equal(parseTerminalExit('hello\n__DT_EXIT__:0\n'), 0);
  assert.equal(parseTerminalExit('oops\n__DT_EXIT__:127\n'), 127);
  assert.equal(parseTerminalExit('hello\n'), null, 'no marker yet — still running');
  assert.equal(parseTerminalExit(''), null);
});

test('HB-B3: the log file is per-hunt and shell-safe', () => {
  assert.equal(desktopTerminalLogFile('h_hb_t1'), '/tmp/dt-h_hb_t1.log');
  assert.equal(desktopTerminalLogFile('h/weird id!'), '/tmp/dt-hweirdid.log');
});

// --- Dispatch --------------------------------------------------------------

test('HB-T1: desktop_terminal types visibly, reads the log back, screenshots, saves', async () => {
  const huntId = 'h_hb_t1';
  const s = stubSession(huntId, [termReply('echo hello-terminal'), '{"action":"note","text":"done"}']);
  await s.run();
  const typeCall = s.desktop.calls.find((c) => c.includes('xdotool type'));
  assert.ok(typeCall, 'the command was typed via xdotool');
  assert.ok(typeCall.includes('echo hello-terminal'), 'the typed text carries the command');
  assert.ok(typeCall.includes('tee'), 'the typed line tees the output to the log');
  assert.ok(s.desktop.calls.some((c) => c.includes('xdotool key') && c.includes('Return')), 'Return was pressed');
  assert.ok(s.desktop.calls.some((c) => c.includes('windowactivate')), 'the terminal window was focused first');
  assert.ok(s.desktop.calls.some((c) => c.includes('dt-h_hb_t1.log')), 'the tee log was read back');
  assert.equal(s.shotCalls.length, 1, 'a desktop screenshot proves the visible run');
  assert.ok(s.screens[1].includes('hello-terminal'), 'the output rides the next screen');
  assert.ok(s.screens[1].includes('Exit code 0'), 'the exit code rides the observation');
  assert.ok(s.screens[1].includes('desktop-20261026190000.jpg'), 'the screenshot artifact is named');
  assert.ok(s.screens[1].includes('Ran visibly in the terminal'), 'the observation says it was visible');
  const call = s.recorded.find((e) => e.type === 'tool_call' && e.tool === 'desktop_terminal');
  assert.ok(call, 'a desktop_terminal tool_call is recorded');
  // Saved under the shell signature — a headless repeat recalls it.
  const saved = findOutput(loadOutputs(huntId), 'shell|echo hello-terminal');
  assert.ok(saved, 'the visible run is saved in the output ledger');
  assert.equal(saved.runs, 1);
});

test('HB-T2: no terminal open — the loop launches xfce4-terminal first', async () => {
  const huntId = 'h_hb_t2';
  const d = stubDesktop({ terminalOpen: false });
  const s = stubSession(huntId, [termReply('echo hi'), '{"action":"note","text":"done"}'], { desktop: d });
  await s.run();
  assert.ok(d.launched, 'xfce4-terminal was launched');
  assert.ok(s.desktop.calls.some((c) => c.includes('xdotool type')), 'the command was typed after the launch');
  assert.ok(s.screens[1].includes('hello-terminal'));
});

test('HB-T3: desktop down — the loop starts the desktop first', async () => {
  const huntId = 'h_hb_t3';
  const d = stubDesktop({ downFirst: true });
  const s = stubSession(huntId, [termReply('echo hi'), '{"action":"note","text":"done"}'], { desktop: d });
  await s.run();
  assert.ok(d.started, 'startDesktop was called on a cold desktop');
  assert.ok(s.desktop.calls.some((c) => c.includes('xdotool type')), 'the command was typed after the start');
  assert.ok(s.screens[1].includes('hello-terminal'));
});

test('HB-T4: a repeated desktop_terminal command is recalled, not re-typed', async () => {
  const huntId = 'h_hb_t4';
  const s = stubSession(huntId, [termReply('echo hello-terminal'), termReply('echo hello-terminal'), '{"action":"note","text":"used recall"}']);
  await s.run();
  const typeCalls = s.desktop.calls.filter((c) => c.includes('xdotool type'));
  assert.equal(typeCalls.length, 1, 'the repeat must not be typed again');
  const recall = s.recorded.find((e) => e.type === 'output_recall');
  assert.ok(recall, 'a recall event is recorded');
  assert.equal(recall.tool, 'desktop_terminal');
  assert.ok(s.screens[2].includes('RECALL — you already ran this'), 'the brain sees the saved output');
  assert.ok(s.screens[2].includes('hello-terminal'));
});

test('HB-T5: an out-of-scope command is blocked before anything runs', async () => {
  const huntId = 'h_hb_t5';
  const s = stubSession(huntId, [termReply('curl https://example.com/secret'), '{"action":"note","text":"done"}'], { parsedScope: parseScope(TARGET) });
  await s.run();
  // The loop itself probes the workspace once per turn
  // ('pwd; ls') — count only desktop/terminal calls.
  const termCalls = s.desktop.calls.filter((c) => c.includes('xdotool') || c.includes('xfce4-terminal'));
  assert.equal(termCalls.length, 0, 'nothing was typed, launched, or focused');
  assert.ok(s.screens[1].includes('BLOCKED — OUT OF SCOPE'), 'the refusal names the scope');
  assert.ok(s.screens[1].includes('example.com'));
});

test('HB-T6: a heavy-scan command is blocked when the programme forbids it', async () => {
  const huntId = 'h_hb_t6';
  const scope = parseScope(TARGET);
  scope.rules = { ...(scope.rules || {}), noHeavyScan: true };
  const s = stubSession(huntId, [termReply('nmap -sS -Pn -p- scanme.nmap.org'), '{"action":"note","text":"done"}'], { parsedScope: scope });
  await s.run();
  const termCalls = s.desktop.calls.filter((c) => c.includes('xdotool') || c.includes('xfce4-terminal'));
  assert.equal(termCalls.length, 0, 'nothing was typed for a blocked heavy scan');
  assert.ok(s.screens[1].includes('BLOCKED by the programme rules'), 'the refusal names the programme rule');
});

// --- Prompt ----------------------------------------------------------------

test('HB-P1: the prompt carries the no-fixed-order rule + desktop_terminal, no canned order', async () => {
  const huntId = 'h_hb_p1';
  const s = stubSession(huntId, ['{"action":"note","text":"hi"}']);
  await s.run();
  const sys = s.systems[0];
  assert.ok(sys.includes('There is no fixed order of operations'), 'the no-predefined-sequence rule is on the screen');
  assert.ok(sys.includes('no recon→scan→exploit script'), 'the rule names the forbidden script');
  assert.ok(sys.includes('a different target or a different memory means a different first move'), 'the rule ties the first move to target + memory');
  assert.ok(sys.includes('"action":"desktop_terminal"'), 'the visible-terminal action is offered');
  assert.ok(sys.includes("each target's memory stays its own"), 'the recall line states isolation');
  assert.ok(!sys.includes('Start with recon'), 'no affirmative fixed sequence is imposed');
  assert.ok(!sys.includes('Step 1: recon'), 'no numbered recon-first checklist exists');
  assert.ok(!sys.includes('first recon, then scan'), 'no recon-then-scan order is stated');
});
