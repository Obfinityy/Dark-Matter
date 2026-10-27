// Tools/OS autonomy (27 Oct 2026) — integration tests through a
// stubbed humanIteration (RH harness style):
//   TA-1  launch_tool burp runs the Burp first-use path end to end
//         (launch, wizard, proxy, browser, target) and records the
//         tool state in the hunt memory.
//   TA-2  launch_tool with an unknown tool is refused before any exec.
//   TA-3  download_tool installs an allow-listed tool and refuses
//         anything else before any exec.
//   TA-4  list_controls returns AT-SPI map lines, and degrades
//         honestly when the stack is missing.
//   TA-5  the new actions are wired: gated, Take-Control-paused,
//         and listed among the valid actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-tools-'));
process.env.DATA_DIR = tmpRoot;

const { humanIteration, GATED_TOOLS, GUI_CONTROL_KINDS } = await import('./humanLoop.js');

const TARGET = 'http://172.17.0.1:3100/';
const LOGIN_SNAP = {
  url: TARGET,
  title: 'Login :: Damn Vulnerable Web Application',
  text: 'Username Password Login',
  elements: [
    { label: 'Username', tag: 'input', type: 'text', id: 'username' },
    { label: 'Password', tag: 'input', type: 'password', id: 'password' },
    { label: 'Login', tag: 'button', id: 'submit' },
  ],
};
const WINDOWS_OUT = [
  '12345678', '87654321', '---TITLES---',
  'Burp Suite - Community Edition', 'Terminal - bash', '---ACTIVE---',
  'Terminal - bash', '',
].join('\n');
const ATSPI_LIST_OK = JSON.stringify({
  ok: true,
  windows: ['Burp Suite - Community Edition'],
  controls: [
    { name: 'Proxy', role: 'page tab', rect: [10, 40, 60, 24] },
    { name: 'Repeater', role: 'page tab', rect: [80, 40, 70, 24] },
    { name: 'Start Burp', role: 'push button', rect: [500, 400, 90, 30] },
    { name: 'Open Browser', role: 'push button', rect: [300, 100, 110, 26] },
  ],
});
const ATSPI_MISSING = JSON.stringify({
  ok: false,
  error: 'pyatspi is not installed in this image (python3-pyatspi missing) — in-app clicking needs the image rebuild; use desktop_key keyboard navigation instead',
});
const ATSPI_CLICK_OK = (name) => JSON.stringify({ ok: true, clicked: { name, role: 'push button', window: 'Burp Suite - Community Edition' } });
const TSV_HEADER = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const TSV_HOST = [
  TSV_HEADER,
  '5\t0\t1\t1\t1\t1\t100\t200\t50\t20\t90\tLogin',
  '5\t0\t1\t1\t1\t2\t400\t100\t120\t20\t90\t172.17.0.1:3100',
].join('\n');

function stubSession(huntId, replies, { events = [], execImpl = null, meta = {} } = {}) {
  const recorded = [];
  const execCalls = [];
  const screens = [];
  const writtenMeta = [];
  let n = 0;
  const execRaw = execImpl || (async (h, cmd) => {
    execCalls.push(String(cmd || ''));
    return { stdout: '', stderr: '', code: 0 };
  });
  return {
    recorded, execCalls, screens, writtenMeta,
    run: () => humanIteration(huntId, TARGET, {
      turns: replies.length,
      deps: {
        chat: async (messages, system) => { screens.push(messages[0].text); screens.push(String(system || '')); return replies[n++]; },
        gui: {
          open: async () => ({ observation: 'opened', snapshot: LOGIN_SNAP }),
          snapshot: async () => ({ observation: `Page: ${TARGET}\nLogin`, snapshot: LOGIN_SNAP }),
          click: async () => ({ ok: true, observation: 'clicked', snapshot: LOGIN_SNAP }),
          type: async () => ({ ok: true, observation: 'Typed.', snapshot: LOGIN_SNAP }),
          screenshot: async () => ({ observation: 'shot', snapshot: LOGIN_SNAP }),
        },
        execRaw,
        desktopScreenshot: async () => ({ ok: true, name: 'desktop-20261027120000.jpg' }),
        search: async (q) => `results for ${q}`,
        deliverChatAnswer: async () => true,
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => meta,
        writeMeta: (h, patch) => { writtenMeta.push(patch); },
        readEvents: () => events,
        buildBriefing: async () => '',
        machineControlled: () => false,
        sleep: async () => {},
        assess: null,
      },
    }),
  };
}

/** Full Burp first-use stub: launch, wizard, proxy, browser, target. */
function burpExec() {
  const calls = [];
  let probes = 0;
  let proxyProbes = 0;
  // Wizard state machine (EC2 lab, 27 Oct 2026): EULA → project →
  // config → start. Each button exists only on its own page.
  let wizardStep = 0; // 0=EULA, 1=project, 2=config, 3=start, 4=done
  const wizardClick = (name) => {
    if (name === 'Accept' && wizardStep === 0) { wizardStep = 1; return ATSPI_CLICK_OK('Accept'); }
    if (name === 'Next' && (wizardStep === 1 || wizardStep === 2)) { wizardStep += 1; return ATSPI_CLICK_OK('Next'); }
    if (name === 'Start Burp' && wizardStep === 3) { wizardStep = 4; return ATSPI_CLICK_OK('Start Burp'); }
    return JSON.stringify({ ok: false, error: `no control named "${name}" found` });
  };
  const execRaw = async (h, cmd) => {
    const c = String(cmd || '');
    calls.push(c);
    if (c.includes("xdotool search --onlyvisible --name 'Burp Suite'")) return { stdout: (++probes === 1 ? '' : '12345\n'), stderr: '', code: 0 };
    if (c.includes('nohup burpsuite')) return { stdout: 'started:123\n', stderr: '', code: 0 };
    if (c.includes("python3 - 'list'")) return { stdout: ATSPI_LIST_OK, stderr: '', code: 0 };
    if (c.includes("python3 - 'click' 'Accept'")) return { stdout: wizardClick('Accept'), stderr: '', code: 0 };
    if (c.includes("python3 - 'click' 'Next'")) return { stdout: wizardClick('Next'), stderr: '', code: 0 };
    if (c.includes("python3 - 'click' 'Start Burp'")) return { stdout: wizardClick('Start Burp'), stderr: '', code: 0 };
    if (c.includes("python3 - 'click' 'Open Browser'")) return { stdout: ATSPI_CLICK_OK('Open Browser'), stderr: '', code: 0 };
    if (c.includes('ss -ltn')) return { stdout: (++proxyProbes === 1 ? 'proxy_down\n' : 'proxy_up\n'), stderr: '', code: 0 };
    if (c.includes('xdotool key')) return { stdout: 'key_sent\n', stderr: '', code: 0 };
    if (c.includes('xdotool type')) return { stdout: 'typed\n', stderr: '', code: 0 };
    if (c.includes('scrot')) return { stdout: 'captured', stderr: '', code: 0 };
    if (c.includes('getdisplaygeometry')) return { stdout: '1280 800', stderr: '', code: 0 };
    if (c.includes('tesseract')) return { stdout: TSV_HOST, stderr: '', code: 0 };
    if (c.includes('xdotool search')) return { stdout: WINDOWS_OUT, stderr: '', code: 0 };
    return { stdout: '', stderr: '', code: 0 };
  };
  return { calls, execRaw };
}

test('TA-1: launch_tool burp runs Burp first-use end to end and records the tool state', async () => {
  const { calls, execRaw } = burpExec();
  const s = stubSession('h_ta1', ['Launching Burp to work the target through the proxy.\n{"action":"launch_tool","tool":"burp"}'], { execImpl: execRaw });
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  const obs = res.log[0].observation;
  assert.match(obs, /Burp first-use: running · proxy listening/);
  assert.match(obs, /target visible in the Burp browser/);
  // (The launch screen map rides in the full observation the brain
  // sees; the turn log truncates at 300 chars, so its map lines are
  // proven in the toolLaunch unit test instead.)
  const toolCalls = s.recorded.filter((e) => e.type === 'tool_call' && e.tool === 'launch_tool');
  assert.equal(toolCalls.length, 1, 'the launch is logged like any brain action');
  assert.equal(toolCalls[0].detail, 'burp');
  assert.ok(calls.some((c) => c.includes('nohup burpsuite')), 'Burp was actually launched');
  const toolsPatch = s.writtenMeta.find((p) => p.tools && p.tools.burp);
  assert.ok(toolsPatch, 'tool state recorded in the hunt memory');
  assert.equal(toolsPatch.tools.burp.firstUseDone, true);
  assert.equal(toolsPatch.tools.burp.proxyUp, true);
  assert.equal(toolsPatch.tools.burp.targetLoaded, true);
});

test('TA-2: launch_tool with an unknown tool is refused before any exec', async () => {
  const s = stubSession('h_ta2', ['{"action":"launch_tool","tool":"hydra-x"}']);
  const res = await s.run();
  assert.match(res.log[0].observation, /not a known tool/);
  assert.match(res.log[0].observation, /burp, zap/);
  // The turn-start state read may exec once (workspace listing) — the
  // refusal itself must not run anything for the tool.
  assert.equal(s.execCalls.filter((c) => /hydra|nohup|burpsuite/i.test(c)).length, 0, 'refused before any exec for the tool');
  assert.equal(s.recorded.filter((e) => e.type === 'tool_call').length, 0, 'refused actions are not logged as runs');
});

test('TA-3: download_tool installs an allow-listed tool and refuses anything else before any exec', async () => {
  const s = stubSession('h_ta3', ['{"action":"download_tool","tool":"subfinder"}'], {
    execImpl: async (h, cmd) => {
      if (String(cmd || '').includes('apt-get install -y subfinder')) return { stdout: 'Setting up subfinder\n/usr/bin/subfinder\n', stderr: '', code: 0 };
      return { stdout: '', stderr: '', code: 0 };
    },
  });
  const res = await s.run();
  assert.match(res.log[0].observation, /subfinder installed \(apt/);
  assert.equal(s.recorded.filter((e) => e.type === 'tool_call' && e.tool === 'download_tool').length, 1);

  const s2 = stubSession('h_ta3b', ['{"action":"download_tool","tool":"metasploit"}']);
  const res2 = await s2.run();
  assert.match(res2.log[0].observation, /not installable/);
  assert.equal(s2.execCalls.filter((c) => /apt-get|metasploit|curl/i.test(c)).length, 0, 'refused before any exec for the tool');
});

test('TA-4: list_controls returns AT-SPI map lines, and degrades honestly when the stack is missing', async () => {
  const s = stubSession('h_ta4', ['{"action":"list_controls","window":"Burp Suite"}'], {
    execImpl: async () => ({ stdout: ATSPI_LIST_OK, stderr: '', code: 0 }),
  });
  const res = await s.run();
  assert.match(res.log[0].observation, /"Proxy \(page tab\)" at \(40, 52\)/);
  assert.match(res.log[0].observation, /desktop_click_control/);

  const s2 = stubSession('h_ta4b', ['{"action":"list_controls","window":"Burp Suite"}'], {
    execImpl: async () => ({ stdout: ATSPI_MISSING, stderr: '', code: 0 }),
  });
  const res2 = await s2.run();
  assert.match(res2.log[0].observation, /pyatspi is not installed/);
  assert.match(res2.log[0].observation, /see_screen and desktop_click_at/);
});

test('TA-5: the new actions are wired — gated, Take-Control-paused, and listed as valid', async () => {
  assert.ok(GATED_TOOLS.has('launch_tool'), 'launch_tool is dedupe-gated');
  assert.ok(GATED_TOOLS.has('download_tool'), 'download_tool is dedupe-gated');
  assert.ok(!GATED_TOOLS.has('list_controls'), 'list_controls only reads — not gated, like browser_snapshot');
  assert.ok(GUI_CONTROL_KINDS.has('launch_tool'), 'launch_tool pauses under Take Control');
  assert.ok(GUI_CONTROL_KINDS.has('list_controls'), 'list_controls pauses under Take Control');
  assert.ok(!GUI_CONTROL_KINDS.has('download_tool'), 'download_tool is a headless container exec, like shell');

  const s = stubSession('h_ta5', ['{"action":"teleport","where":"mars"}']);
  const res = await s.run();
  assert.match(res.log[0].observation, /Unknown action "teleport"/);
  assert.match(res.log[0].observation, /^Unknown action "teleport"\. Valid actions:/);
  // The turn log truncates observations at 300 chars, so the tail of
  // the valid-actions list is proven through the prompt the brain
  // was actually shown (captured by the chat stub).
  const prompt = s.screens.join('\n');
  assert.match(prompt, /\{"action":"launch_tool","tool":"burp"\}/);
  assert.match(prompt, /\{"action":"download_tool","tool":"subfinder"\}/);
  assert.match(prompt, /\{"action":"list_controls","window":"Burp Suite"\}/);
});
