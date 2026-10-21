// Test for the headless-fallback browser wording + snapshot text
// hygiene (Lane D, 21 Oct 2026 — Ezviz audit).
//
// The audited hunt ran on a machine with Chromium but NO desktop
// (headless fallback). The old fallback text said the desktop was
// "not up yet" / "not controllable yet" — the hunter read that as a
// defect it could fix and burned ~14 turns over 82 minutes on
// apt-get install attempts (including an invented "browser-features"
// package) for a browser that was already installed. The fallback
// must now state plainly: look-only, environment-fixed, not
// hunter-fixable. The snapshot text must also drop the JS/CSS banner
// comments that led every Ezviz page dump.
//
// The container is faked through guiTools' deps.exec seam: the probe
// answers "chromium present, no CDP" -> headless mode.
//
// Run: node backend/scripts/test-gui-fallback.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-gui-'));
process.env.DATA_DIR = tmp;

const { guiBrowserOpen, guiBrowserClick, guiBrowserType, resetGuiProbeCache } = await import('../src/guiTools.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const HTML = `<html><head><title>Ezviz Open Platform</title><style>/*! css-banner */ body{margin:0}</style></head>
<body>/*! * @ezviz/ezd BANNERJUNK long library banner */<!-- HTMLCOMMENTJUNK --><h1>Developer Console</h1><p>Real page text here</p><a href="/login">Sign in</a></body></html>`;

const fakeExec = async (h, cmd) => {
  if (cmd.includes('command -v chromium')) {
    return { stdout: 'chrome=/usr/bin/chromium\ncdp=\nxsock=\n', stderr: '', code: 0 };
  }
  if (cmd.includes('--dump-dom')) return { stdout: HTML, stderr: '', code: 0 };
  return { stdout: '', stderr: '', code: 0 }; // writeState / misc
};

resetGuiProbeCache();
const open = await guiBrowserOpen('h_gui_test', 'https://open.ys7.com/', { exec: fakeExec });
check('open: succeeds in headless fallback', open.ok === true);
check('open: says look-only', open.observation.includes('look-only'));
check('open: no "not controllable yet" phrasing', !open.observation.includes('not controllable yet'));
check('open: real page text visible', open.observation.includes('Real page text here'));
check('open: JS banner comment stripped', !open.observation.includes('BANNERJUNK'));
check('open: HTML comment stripped', !open.observation.includes('HTMLCOMMENTJUNK'));
check('open: clickable element listed', open.observation.includes('Sign in'));

const click = await guiBrowserClick('h_gui_test', 'Sign in', { exec: fakeExec });
check('click: refused in headless mode', click.ok === false);
check('click: says it cannot be installed/started from inside the hunt', click.observation.includes('cannot be started or installed from inside the hunt'));
check('click: no "not up yet" phrasing', !click.observation.includes('not up yet'));

const type = await guiBrowserType('h_gui_test', 'hello', false, { exec: fakeExec });
check('type: refused in headless mode', type.ok === false);
check('type: says it cannot be installed/started from inside the hunt', type.observation.includes('cannot be started or installed from inside the hunt'));
check('type: no "not up yet" phrasing', !type.observation.includes('not up yet'));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
