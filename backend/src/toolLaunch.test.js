// Tools/OS autonomy (27 Oct 2026) — unit + orchestration tests for
// toolLaunch.js. The container-facing calls run against a stubbed
// execRaw (no docker here); the real-container proof lives in the
// lab script (backend/scripts/lab-tools-autonomy.mjs) and the EC2
// scratch-container run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_REGISTRY,
  TOOL_IDS,
  DOWNLOAD_REGISTRY,
  DOWNLOAD_IDS,
  BURP_WIZARD_CLICKS,
  resolveTool,
  resolveDownloadTool,
  launchCommand,
  windowPresentCommand,
  parseWindowPresent,
  browserWindowIdsCommand,
  parseWindowIds,
  windowActivateCommand,
  cliCheckCommand,
  parseCliCheck,
  downloadCommand,
  parseDownloadResult,
  proxyCheckCommand,
  parseProxyCheck,
  mapShowsTarget,
  launchGuiTool,
  checkCliTool,
  downloadTool,
  listToolControls,
  recordToolState,
  burpFirstUseDone,
  burpFirstUse,
} from './toolLaunch.js';

const ATSPI_LIST_OK = JSON.stringify({
  ok: true,
  windows: ['Burp Suite - Community Edition'],
  controls: [
    { name: 'Proxy', role: 'page tab', rect: [10, 40, 60, 24] },
    { name: 'Repeater', role: 'page tab', rect: [80, 40, 70, 24] },
    { name: 'Send', role: 'push button', rect: [200, 300, 50, 24] },
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
  '5\t0\t1\t1\t1\t3\t200\t200\t80\t20\t90\tDamn',
].join('\n');

/** Route stubbed execRaw calls by substring; record every call. */
function stubExec(routes) {
  const calls = [];
  const execRaw = async (h, cmd) => {
    calls.push(String(cmd || ''));
    for (const [needle, out] of routes) {
      if (String(cmd || '').includes(needle)) return { stdout: typeof out === 'function' ? out(calls) : out, stderr: '', code: 0 };
    }
    return { stdout: '', stderr: '', code: 0 };
  };
  return { calls, execRaw };
}

const noSleep = async () => {};

// ---------------------------------------------------------------------------
// Registry + pure builders.
// ---------------------------------------------------------------------------

test('registry: Burp first, then ZAP, nmap, nikto, nuclei, sqlmap — all present in the Kali image', () => {
  for (const id of ['burp', 'zap', 'nmap', 'nikto', 'nuclei', 'sqlmap']) {
    assert.ok(TOOL_REGISTRY[id], `${id} is registered`);
  }
  assert.equal(TOOL_REGISTRY.burp.kind, 'gui');
  assert.equal(TOOL_REGISTRY.burp.proxyPort, 8080);
  assert.equal(TOOL_REGISTRY.nmap.kind, 'cli');
  assert.deepEqual(TOOL_IDS, Object.keys(TOOL_REGISTRY));
});

test('browserWindowIdsCommand/parseWindowIds/windowActivateCommand: the new Chromium window is found and focused', () => {
  assert.match(browserWindowIdsCommand(), /xdotool search --onlyvisible --name 'Chromium'/);
  assert.deepEqual(parseWindowIds('111\n222\nnot-a-window\n'), ['111', '222']);
  assert.deepEqual(parseWindowIds(''), []);
  assert.match(windowActivateCommand('67890'), /xdotool windowactivate --sync 67890/);
});

test('BURP_WIZARD_CLICKS: the v2026.9 edition chooser is in the walk (EC2 lab 27 Oct 2026)', () => {
  // The first EC2 lab run stalled at the EULA because this page was
  // missing from the list: after Accept, Burp shows "Continue with
  // Burp Suite Community Edition", not Next/Start Burp.
  assert.deepEqual(BURP_WIZARD_CLICKS, ['Accept', 'I Accept', 'Continue with Burp Suite Community Edition', 'Start Burp', 'Next']);
});

test('resolveTool: unknown ids are refused with the available list', () => {
  assert.equal(resolveTool('burp').ok, true);
  assert.equal(resolveTool('BURP').tool.id, 'burp', 'case-insensitive');
  assert.equal(resolveTool('hydra-x').ok, false);
  assert.match(resolveTool('hydra-x').error, /burp, zap/);
  assert.equal(resolveTool('').ok, false);
});

test('launchCommand/windowPresentCommand: the tool binary comes from the registry, never brain input', () => {
  assert.match(launchCommand(TOOL_REGISTRY.burp), /nohup burpsuite >/);
  assert.match(launchCommand(TOOL_REGISTRY.burp), /\/tmp\/dm-tool-burp\.log/);
  assert.match(windowPresentCommand(TOOL_REGISTRY.burp), /xdotool search --onlyvisible --name 'Burp Suite'/);
  // EC2 lab 27 Oct 2026: a GUI app needs the session bus address or
  // it never finds the accessibility bus; a Java GUI needs the bridge
  // env — but only when the bridge files exist, or Burp dies with
  // "Assistive Technology not found" on the pre-fix image.
  assert.match(launchCommand(TOOL_REGISTRY.burp), /DBUS_SESSION_BUS_ADDRESS="\$\(cat \/tmp\/dm-dbus-address\)"/);
  assert.match(launchCommand(TOOL_REGISTRY.burp), /org\.GNOME\.Accessibility\.AtkWrapper/);
  assert.match(launchCommand(TOOL_REGISTRY.burp), /\[ -f \/usr\/share\/java\/java-atk-wrapper\.jar \]/);
  assert.match(launchCommand(TOOL_REGISTRY.burp), /\[ -f \/usr\/lib\/x86_64-linux-gnu\/jni\/libatk-wrapper\.so \]/);
  assert.equal(parseWindowPresent('12345\n'), '12345');
  assert.equal(parseWindowPresent(''), null);
  assert.equal(parseWindowPresent('not-a-window\n'), null);
});

test('cliCheckCommand/parseCliCheck: present version vs missing marker', () => {
  assert.match(cliCheckCommand(TOOL_REGISTRY.nmap), /command -v nmap/);
  assert.match(cliCheckCommand(TOOL_REGISTRY.nmap), /nmap --version/);
  assert.equal(parseCliCheck('Nmap version 7.94\n').ok, true);
  assert.equal(parseCliCheck('__TOOL_MISSING__\n').ok, false);
});

test('resolveDownloadTool: the allow-list is the whole contract', () => {
  assert.equal(resolveDownloadTool('subfinder').ok, true);
  assert.equal(resolveDownloadTool('subfinder').entry.method, 'apt');
  assert.equal(resolveDownloadTool('jwt-tool').entry.method, 'direct');
  assert.match(resolveDownloadTool('jwt-tool').entry.url, /^https:\/\/raw\.githubusercontent\.com\/ticarpi\/jwt_tool\//);
  assert.equal(resolveDownloadTool('metasploit').ok, false);
  assert.match(resolveDownloadTool('metasploit').error, /installable tools are/);
  assert.deepEqual(DOWNLOAD_IDS, Object.keys(DOWNLOAD_REGISTRY));
});

test('downloadCommand: apt updates first (the image cleans its lists); direct downloads are size-capped', () => {
  const apt = downloadCommand(DOWNLOAD_REGISTRY.subfinder);
  assert.match(apt, /apt-get update -qq/);
  assert.match(apt, /apt-get install -y subfinder/);
  assert.match(apt, /__INSTALL_FAILED__/);
  const direct = downloadCommand(DOWNLOAD_REGISTRY['jwt-tool']);
  assert.match(direct, /curl -fsSL --max-filesize 1048576/);
  assert.match(direct, /jwt_tool\.py/);
  assert.equal(parseDownloadResult(DOWNLOAD_REGISTRY.subfinder, '/usr/bin/subfinder\n').ok, true);
  assert.equal(parseDownloadResult(DOWNLOAD_REGISTRY.subfinder, '__INSTALL_FAILED__\n').ok, false);
});

test('proxyCheckCommand/parseProxyCheck + mapShowsTarget', () => {
  assert.match(proxyCheckCommand(8080), /:8080/);
  assert.equal(parseProxyCheck('proxy_up\n'), true);
  assert.equal(parseProxyCheck('proxy_down\n'), false);
  assert.equal(mapShowsTarget('"172.17.0.1:3100" at (460, 110)', 'http://172.17.0.1:3100/'), true);
  assert.equal(mapShowsTarget('"Login" at (125, 210)', 'http://172.17.0.1:3100/'), false);
  assert.equal(mapShowsTarget('', 'http://172.17.0.1:3100/'), false);
});

// ---------------------------------------------------------------------------
// Orchestration with stubbed execRaw.
// ---------------------------------------------------------------------------

test('launchGuiTool: Burp launches, window appears on poll, AT-SPI map is the observation', async () => {
  let probes = 0;
  const { calls, execRaw } = stubExec([
    ["xdotool search --onlyvisible --name 'Burp Suite'", () => (++probes === 1 ? '' : '12345\n')],
    ['nohup burpsuite', 'started:123\n'],
    ["python3 - 'list'", ATSPI_LIST_OK],
  ]);
  const res = await launchGuiTool('h_x', 'burp', { execRaw, sleep: noSleep });
  assert.equal(res.ok, true);
  assert.equal(res.alreadyRunning, false);
  assert.equal(res.window, '12345');
  assert.equal(res.via, 'atspi');
  assert.match(res.observation, /Burp Suite is open/);
  assert.match(res.observation, /"Proxy \(page tab\)" at \(40, 52\)/);
  assert.match(res.observation, /"Send \(push button\)" at \(225, 312\)/);
  assert.ok(calls.some((c) => c.includes('nohup burpsuite')), 'launch was executed');
});

test('launchGuiTool: an already-running tool is reported, never re-launched', async () => {
  const { calls, execRaw } = stubExec([
    ["xdotool search --onlyvisible --name 'Burp Suite'", '12345\n'],
    ["python3 - 'list'", ATSPI_LIST_OK],
  ]);
  const res = await launchGuiTool('h_x', 'burp', { execRaw, sleep: noSleep });
  assert.equal(res.ok, true);
  assert.equal(res.alreadyRunning, true);
  assert.match(res.observation, /already running/);
  assert.equal(calls.some((c) => c.includes('nohup burpsuite')), false, 'no second copy started');
});

test('launchGuiTool: AT-SPI missing falls back to the OCR map', async () => {
  const { execRaw } = stubExec([
    ["xdotool search --onlyvisible --name 'Burp Suite'", '12345\n'],
    ["python3 - 'list'", ATSPI_MISSING],
    ['scrot', 'captured'],
    ['getdisplaygeometry', '1280 800'],
    ['tesseract', TSV_HOST],
  ]);
  const res = await launchGuiTool('h_x', 'burp', { execRaw, sleep: noSleep });
  assert.equal(res.ok, true);
  assert.equal(res.via, 'ocr');
  assert.match(res.observation, /"Login Damn 172\.17\.0\.1:3100" at/);
});

test('launchGuiTool: a window that never appears fails honestly with the log path', async () => {
  const { execRaw } = stubExec([
    ["xdotool search --onlyvisible --name 'ZAP'", ''],
    ['nohup zaproxy', 'started:9\n'],
  ]);
  const res = await launchGuiTool('h_x', 'zap', { execRaw, sleep: noSleep });
  assert.equal(res.ok, false);
  assert.match(res.error, /did not open a window/);
  assert.match(res.error, /\/tmp\/dm-tool-zap\.log/);
});

test('launchGuiTool: a CLI tool refuses the GUI path', async () => {
  const res = await launchGuiTool('h_x', 'nmap', { execRaw: async () => ({ stdout: '' }), sleep: noSleep });
  assert.equal(res.ok, false);
  assert.match(res.error, /CLI tool/);
});

test('checkCliTool: present version reported; missing names download_tool when allow-listed', async () => {
  const { execRaw } = stubExec([['nmap --version', 'Nmap version 7.94\n']]);
  const ok = await checkCliTool('h_x', 'nmap', { execRaw });
  assert.equal(ok.ok, true);
  assert.match(ok.observation, /Nmap version 7\.94/);
  const { execRaw: missing } = stubExec([['command -v nmap', '__TOOL_MISSING__\n']]);
  const no = await checkCliTool('h_x', 'nmap', { execRaw: missing });
  assert.equal(no.ok, false);
  assert.match(no.error, /not installed/);
});

test('downloadTool: allow-listed apt install runs; anything else is refused before any exec', async () => {
  const { calls, execRaw } = stubExec([
    ['apt-get install -y subfinder', 'Setting up subfinder\n/usr/bin/subfinder\n'],
  ]);
  const res = await downloadTool('h_x', 'subfinder', { execRaw });
  assert.equal(res.ok, true);
  assert.match(res.observation, /installed \(apt/);
  assert.ok(calls.some((c) => c.includes('apt-get update')), 'apt updated first');

  const s2 = stubExec([]);
  const refused = await downloadTool('h_x', 'metasploit', { execRaw: s2.execRaw });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /not installable/);
  assert.equal(s2.calls.length, 0, 'refused before any exec');
});

test('downloadTool: direct download is size-capped and verified by listing', async () => {
  const { calls, execRaw } = stubExec([
    ['curl -fsSL', '-rw-r--r-- 1 root root 61234 Oct 27 12:00 jwt_tool.py\n'],
  ]);
  const res = await downloadTool('h_x', 'jwt-tool', { execRaw });
  assert.equal(res.ok, true);
  assert.match(res.observation, /downloaded jwt_tool\.py/);
  assert.ok(calls[0].includes('--max-filesize 1048576'));
});

test('listToolControls: AT-SPI list becomes clickable map lines; missing stack falls back honestly', async () => {
  const { execRaw } = stubExec([["python3 - 'list'", ATSPI_LIST_OK]]);
  const res = await listToolControls('h_x', 'Burp Suite', { execRaw });
  assert.equal(res.ok, true);
  assert.equal(res.count, 3);
  assert.match(res.observation, /"Repeater \(page tab\)" at \(115, 52\)/);
  const { execRaw: missing } = stubExec([["python3 - 'list'", ATSPI_MISSING]]);
  const no = await listToolControls('h_x', 'Burp Suite', { execRaw: missing });
  assert.equal(no.ok, false);
  assert.match(no.error, /pyatspi is not installed/);
  assert.match(no.error, /see_screen and desktop_click_at/);
});

test('recordToolState + burpFirstUseDone: checkpoint-merge write, no full meta write', async () => {
  let stored = { tools: { nmap: { running: true } } };
  const deps = {
    readMeta: () => stored,
    writeMeta: (h, patch) => { stored = { ...stored, ...patch }; },
  };
  assert.equal(burpFirstUseDone(stored), false);
  const saved = await recordToolState('h_x', 'burp', { running: true, proxyUp: true, firstUseDone: true }, deps);
  assert.equal(saved.running, true);
  assert.equal(stored.tools.nmap.running, true, 'existing tool state survives the merge');
  assert.equal(stored.tools.burp.firstUseDone, true);
  assert.equal(burpFirstUseDone(stored), true);
  assert.equal(await recordToolState('h_x', 'burp', {}, {}), null, 'no meta seam means no write');
});

test('burpFirstUse: happy path — launch, wizard, proxy, browser, target confirmed', async () => {
  let probes = 0;
  let proxyProbes = 0;
  let browserClicked = false;
  // The real wizard (EC2 lab, 27 Oct 2026): EULA → edition chooser →
  // project → config → start. Each button exists only on its own page.
  let wizardStep = 0; // 0=EULA, 1=edition, 2=project, 3=config, 4=start, 5=done
  const wizardClick = (name) => () => {
    if (name === 'Accept' && wizardStep === 0) { wizardStep = 1; return ATSPI_CLICK_OK('Accept'); }
    if (name === 'Continue with Burp Suite Community Edition' && wizardStep === 1) { wizardStep = 2; return ATSPI_CLICK_OK('Continue with Burp Suite Community Edition'); }
    if (name === 'Next' && (wizardStep === 2 || wizardStep === 3)) { wizardStep += 1; return ATSPI_CLICK_OK('Next'); }
    if (name === 'Start Burp' && wizardStep === 4) { wizardStep = 5; return ATSPI_CLICK_OK('Start Burp'); }
    return JSON.stringify({ ok: false, error: `no control named "${name}" found` });
  };
  const { execRaw } = stubExec([
    ["xdotool search --onlyvisible --name 'Burp Suite'", () => (++probes === 1 ? '' : '12345\n')],
    ['nohup burpsuite', 'started:123\n'],
    ["python3 - 'list'", ATSPI_LIST_OK],
    ["python3 - 'click' 'Accept'", wizardClick('Accept')],
    ["python3 - 'click' 'Continue with Burp Suite Community Edition'", wizardClick('Continue with Burp Suite Community Edition')],
    ["python3 - 'click' 'Next'", wizardClick('Next')],
    ["python3 - 'click' 'Start Burp'", wizardClick('Start Burp')],
    ['ss -ltn', () => (++proxyProbes === 1 ? 'proxy_down\n' : 'proxy_up\n')],
    ["xdotool search --onlyvisible --name 'Chromium'", () => (browserClicked ? '67890\n' : '')],
    ["python3 - 'click' 'Open Browser'", () => { browserClicked = true; return ATSPI_CLICK_OK('Open Browser'); }],
    ['windowactivate --sync 67890', 'activated\n'],
    ['xdotool key', 'key_sent\n'],
    ['xdotool type', 'typed\n'],
    ['scrot', 'captured'],
    ['getdisplaygeometry', '1280 800'],
    ['tesseract', TSV_HOST],
  ]);
  const res = await burpFirstUse('h_x', 'http://172.17.0.1:3100/', { execRaw, sleep: noSleep });
  assert.equal(res.ok, true);
  assert.equal(wizardStep, 5, 'the wizard walk finished in page order (Accept, Community Edition, Next, Next, Start Burp)');
  assert.match(res.notes.join(' '), /wizard: clicked "Accept".*wizard: clicked "Continue with Burp Suite Community Edition".*wizard: clicked "Next".*wizard: clicked "Next".*wizard: clicked "Start Burp"/);
  assert.deepEqual(
    { running: res.state.running, proxyUp: res.state.proxyUp, browserOpened: res.state.browserOpened, targetLoaded: res.state.targetLoaded, firstUseDone: res.state.firstUseDone },
    { running: true, proxyUp: true, browserOpened: true, targetLoaded: true, firstUseDone: true },
  );
  assert.match(res.observation, /Burp first-use: running · proxy listening/);
  assert.match(res.observation, /target visible in the Burp browser/);
});

test('burpFirstUse: proxy never listens — honest partial failure, launch still recorded', async () => {
  const { execRaw } = stubExec([
    ["xdotool search --onlyvisible --name 'Burp Suite'", '12345\n'],
    ["python3 - 'list'", ATSPI_LIST_OK],
    ["python3 - 'click' 'Start Burp'", JSON.stringify({ ok: false, error: 'no control named "Start Burp" found' })],
    ["python3 - 'click' 'Next'", JSON.stringify({ ok: false, error: 'no control named "Next" found' })],
    ['ss -ltn', 'proxy_down\n'],
    ["python3 - 'click' 'Open Browser'", JSON.stringify({ ok: false, error: 'no control named "Open Browser" found' })],
    ['scrot', 'captured'],
    ['getdisplaygeometry', '1280 800'],
    ['tesseract', TSV_HOST],
  ]);
  const res = await burpFirstUse('h_x', 'http://172.17.0.1:3100/', { execRaw, sleep: noSleep });
  assert.equal(res.ok, false);
  assert.equal(res.state.running, true);
  assert.equal(res.state.proxyUp, false);
  assert.equal(res.state.browserOpened, false);
  assert.match(res.observation, /proxy NOT listening/);
});
