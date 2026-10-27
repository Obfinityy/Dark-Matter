// Lab for the TOOLS/OS AUTONOMY lane (27 Oct 2026).
//
// Boots the REAL backend (child process, tmp DATA_DIR, admin user
// from env bootstrap) and proves, end to end — no live api.meta.ai
// call, no credit burn, no docker (the container-facing calls run
// against a stubbed execRaw here; the REAL container proof is the
// EC2 scratch-container run, whose results are recorded in the lane
// report):
//
//   1. Backend boots + health OK; admin login works.
//   2. launch_tool (GUI): Burp launches, the window appears, the
//      observation is the AT-SPI control map.
//   3. AT-SPI missing: the same launch falls back to the OCR map.
//   4. download_tool: allow-listed apt install runs; anything else
//      is refused before any exec.
//   5. Burp first-use (stubbed container): launch, wizard, proxy,
//      browser, target — all true, state recorded in the hunt memory
//      through the REAL store (tmp DATA_DIR).
//   6. Static deliverables: the desktop-tools skill card names the
//      new actions, and the AT-SPI RUN sits at the TRUE END of
//      docker/Dockerfile.hunt (after the hunt-runner npm install).
//
// Run: node backend/scripts/lab-tools-autonomy.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-tools-autonomy-'));
process.env.DATA_DIR = tmp;
const PORT = 4625;
const HUNT_SEED = 'h_tools_lab';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const { writeHuntMeta, readHuntMeta } = await import('../src/store.js');
const {
  launchGuiTool,
  downloadTool,
  burpFirstUse,
  recordToolState,
} = await import('../src/toolLaunch.js');

// ---- boot the real backend (child) with an admin user ---------------------
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync('lab-admin-pass-123', salt, 64).toString('hex');
const child = spawn(process.execPath, [path.join(here, '..', 'src', 'server.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: tmp,
    LAB_TARGETS: 'example.com',
    ADMIN_USERNAME: 'labadmin',
    ADMIN_PASSWORD_SALT: salt.toString('hex'),
    ADMIN_PASSWORD_HASH: hash,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let childLog = '';
child.stdout.on('data', (d) => { childLog += d; });
child.stderr.on('data', (d) => { childLog += d; });

const base = `http://127.0.0.1:${PORT}`;
async function waitHealthy() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/api/v1/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const ATSPI_LIST_OK = JSON.stringify({
  ok: true,
  windows: ['Burp Suite - Community Edition'],
  controls: [
    { name: 'Proxy', role: 'page tab', rect: [10, 40, 60, 24] },
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
const noSleep = async () => {};

function burpExec() {
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
  const calls = [];
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
    return { stdout: '', stderr: '', code: 0 };
  };
  return { calls, execRaw };
}

try {
  check('backend boots + health OK', await waitHealthy());
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'labadmin', password: 'lab-admin-pass-123' }),
  }).then((r) => r.json()).catch(() => null);
  check('admin login works', !!login && !!login.token);

  // ---- 2. GUI launch with the AT-SPI map ----------------------------------
  const launched = await launchGuiTool(HUNT_SEED, 'burp', { ...burpExec(), sleep: noSleep });
  check('launch_tool burp opens the window', launched.ok === true);
  check('launch observation is the AT-SPI control map', launched.via === 'atspi' && /"Proxy \(page tab\)" at \(40, 52\)/.test(launched.observation || ''));

  // ---- 3. AT-SPI missing falls back to the OCR map ------------------------
  const ocrExec = async (h, cmd) => {
    const c = String(cmd || '');
    if (c.includes("xdotool search --onlyvisible --name 'Burp Suite'")) return { stdout: '12345\n', stderr: '', code: 0 };
    if (c.includes("python3 - 'list'")) return { stdout: ATSPI_MISSING, stderr: '', code: 0 };
    if (c.includes('scrot')) return { stdout: 'captured', stderr: '', code: 0 };
    if (c.includes('getdisplaygeometry')) return { stdout: '1280 800', stderr: '', code: 0 };
    if (c.includes('tesseract')) return { stdout: TSV_HOST, stderr: '', code: 0 };
    return { stdout: '', stderr: '', code: 0 };
  };
  const ocr = await launchGuiTool(HUNT_SEED, 'burp', { execRaw: ocrExec, sleep: noSleep });
  check('launch falls back to the OCR map when AT-SPI is missing', ocr.ok === true && ocr.via === 'ocr');

  // ---- 4. download allow-list ---------------------------------------------
  const dlCalls = [];
  const dlExec = async (h, cmd) => {
    dlCalls.push(String(cmd || ''));
    if (String(cmd || '').includes('apt-get install -y subfinder')) return { stdout: 'Setting up subfinder\n/usr/bin/subfinder\n', stderr: '', code: 0 };
    return { stdout: '', stderr: '', code: 0 };
  };
  const dl = await downloadTool(HUNT_SEED, 'subfinder', { execRaw: dlExec });
  check('download_tool installs an allow-listed tool', dl.ok === true);
  const before = dlCalls.length;
  const refused = await downloadTool(HUNT_SEED, 'metasploit', { execRaw: dlExec });
  check('download_tool refuses a non-listed tool before any exec', refused.ok === false && dlCalls.length === before);

  // ---- 5. Burp first-use + real store --------------------------------------
  writeHuntMeta(HUNT_SEED, {
    huntId: HUNT_SEED, target: 'http://172.17.0.1:3100/', userId: 'labadmin',
    state: 'running', iteration: 1, mode: 'human', humanMode: true,
  });
  const first = await burpFirstUse(HUNT_SEED, 'http://172.17.0.1:3100/', { ...burpExec(), sleep: noSleep });
  check('Burp first-use completes (launch, wizard, proxy, browser, target)', first.ok === true
    && first.state.running && first.state.proxyUp && first.state.browserOpened && first.state.targetLoaded);
  const { readHuntMeta: readMeta, writeHuntMeta: writeMeta } = await import('../src/store.js');
  const saved = await recordToolState(HUNT_SEED, 'burp', { ...first.state }, { readMeta, writeMeta });
  check('first-use state recorded in the hunt memory (meta.tools)', saved && saved.firstUseDone === true && saved.proxyUp === true);
  const reloaded = readHuntMeta(HUNT_SEED);
  check('meta.tools.burp survives a re-read from the real store', reloaded && reloaded.tools && reloaded.tools.burp && reloaded.tools.burp.targetLoaded === true);

  // ---- 6. static deliverables ----------------------------------------------
  const card = fs.readFileSync(path.join(here, '..', 'skills', 'desktop-tools.md'), 'utf8');
  check('skill card names launch_tool / download_tool / list_controls', /launch_tool/.test(card) && /download_tool/.test(card) && /list_controls/.test(card));
  const dockerfile = fs.readFileSync(path.join(here, '..', '..', 'docker', 'Dockerfile.hunt'), 'utf8');
  // The exact package list (space-separated) appears only in the RUN
  // itself — the earlier comment spells it with ' + ' separators.
  const atspiIdx = dockerfile.indexOf('at-spi2-core python3-pyatspi libatk-wrapper-java libatk-wrapper-java-jni');
  const npmIdx = dockerfile.indexOf('npm install --omit=dev');
  const entryIdx = dockerfile.indexOf('ENTRYPOINT');
  check('Dockerfile: AT-SPI RUN is at the true end (after npm install, before ENTRYPOINT)', atspiIdx > npmIdx && atspiIdx > 0 && entryIdx > atspiIdx);
  check('Dockerfile: AT-SPI RUN installs all four packages (incl. the -jni lib)', /at-spi2-core python3-pyatspi libatk-wrapper-java libatk-wrapper-java-jni/.test(dockerfile));
  check('Dockerfile: RUN verifies the bridge jar + native lib exist (fails the build, not a live hunt)', /test -f \/usr\/share\/java\/java-atk-wrapper\.jar/.test(dockerfile) && /test -f \/usr\/lib\/x86_64-linux-gnu\/jni\/libatk-wrapper\.so/.test(dockerfile));
  check('Dockerfile: ENV JAVA_TOOL_OPTIONS carries the AtkWrapper bridge', /ENV JAVA_TOOL_OPTIONS="-Djavax\.accessibility\.assistive_technologies=org\.GNOME\.Accessibility\.AtkWrapper -Xbootclasspath\/a:\/usr\/share\/java\/java-atk-wrapper\.jar"/.test(dockerfile));
  const desktopSh = fs.readFileSync(path.join(here, '..', '..', 'docker', 'hunt-desktop.sh'), 'utf8');
  check('hunt-desktop.sh publishes the session bus address for docker-exec launches', /\/tmp\/dm-dbus-address/.test(desktopSh) && /publish_dbus_address/.test(desktopSh));
} finally {
  try { child.kill('SIGTERM'); } catch { /* already gone */ }
}

console.log(failures === 0 ? 'LAB TOOLS-AUTONOMY: ALL PASS' : `LAB TOOLS-AUTONOMY: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
