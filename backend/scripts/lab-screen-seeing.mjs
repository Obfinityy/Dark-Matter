// Lab for the screen-seeing lane (27 Oct 2026, owner order) — the agent
// looks at the screen itself and controls from what it sees.
//
// Scripted humanIteration sessions with a stubbed desktop:
//   session A: brain issues see_screen -> the observation IS the screen map
//     (scrot + tesseract TSV stubbed), with (x, y) click points.
//   session B: brain clicks a point FROM THE MAP with desktop_click_at ->
//     xdotool mousemove + click runs at exactly those coordinates.
//   session C: brain clicks with garbage coordinates -> refused BEFORE any
//     exec, with the fix named.
//   session D: tesseract missing in the image -> see_screen names the
//     missing OCR instead of failing silently.
//   session E: see_screen again after the click -> the screen re-reads
//     (look -> act -> look again).
//
// Run: node backend/scripts/lab-screen-seeing.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-screen-seeing-'));
process.env.DATA_DIR = tmp;

const { humanIteration } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const HUNT = 'h_screen_lab';
const TARGET = 'https://ksuite.infomaniak.com';
const PS = { domain: 'ksuite.infomaniak.com', inScope: ['ksuite.infomaniak.com'], outOfScope: [], rules: { noDoS: true, noHeavyScan: true, maxRequestsPerMin: 0 } };

// The live login page, as tesseract would read it.
const TSV_HEADER = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const TSV = [
  TSV_HEADER,
  '5\t1\t1\t1\t1\t1\t100\t300\t60\t20\t92\tLog',
  '5\t1\t1\t1\t1\t2\t170\t300\t20\t20\t88\tin',
  '5\t1\t1\t1\t2\t1\t100\t340\t120\t20\t95\tEmail',
].join('\n');

const events = [];
const notes = [];
const metaStore = { huntId: HUNT, target: TARGET, mode: 'human', humanMode: true, parsedScope: PS };
const execCalls = [];
let tesseractMissing = false;

function baseDeps(chat) {
  return {
    chat,
    record: (h, ev) => { events.push(ev); },
    readMeta: () => metaStore,
    writeMeta: (h, m) => { Object.assign(metaStore, m); },
    readEvents: () => events,
    recordNote: (h, entry) => { notes.push(entry); },
    execRaw: async (h, cmd) => {
      execCalls.push(cmd);
      if (cmd.includes('scrot')) return { stdout: 'captured', stderr: '', code: 0 };
      if (cmd.includes('getdisplaygeometry')) return { stdout: '1920 1080', stderr: '', code: 0 };
      if (cmd.includes('tesseract')) {
        if (tesseractMissing) return { stdout: '', stderr: '', code: 127 };
        return { stdout: TSV, stderr: '', code: 0 };
      }
      if (cmd.includes('xdotool mousemove')) return { stdout: 'clicked', stderr: '', code: 0 };
      return { stdout: '', stderr: '', code: 0 };
    },
    buildBriefing: async () => '',
    buildStateOfMind: () => [],
    gui: {
      open: async () => ({ observation: 'opened' }),
      snapshot: async () => ({ observation: 'page text' }),
      click: async () => ({ observation: 'clicked' }),
      type: async () => ({ observation: 'typed' }),
      screenshot: async () => ({ observation: 'shot' }),
    },
    sleep: async () => {},
    assess: null,
  };
}

// ---- session A: the brain looks at the screen ------------------------------
const resA = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async () => 'The login page is up — let me read the screen.\n{"action":"see_screen"}'),
});
check('A: one turn ran', resA.turnsRun === 1);
const logA = (resA.log || []).find((l) => l.action === 'see_screen');
check('A: see_screen observation IS the screen map', !!logA && /"Log in" at \(145, 310\)/.test(logA.observation || ''));
check('A: map carries the screen size', !!logA && /1920x1080/.test(logA.observation || ''));
check('A: tool_call records see_screen', events.some((e) => e.type === 'tool_call' && e.tool === 'see_screen'));

// ---- session B: the brain clicks a point from the map ----------------------
execCalls.length = 0;
const resB = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async () => 'The "Log in" text is at (145, 310) — clicking it.\n{"action":"desktop_click_at","x":145,"y":310}'),
});
check('B: one turn ran', resB.turnsRun === 1);
const logB = (resB.log || []).find((l) => l.action && l.action.startsWith('desktop_click_at'));
check('B: observation confirms the click', !!logB && /Clicked at \(145, 310\)/.test(logB.observation || ''));
check('B: xdotool ran at exactly the map point', execCalls.some((c) => /xdotool mousemove 145 310 click 1/.test(c)));
check('B: tool_call records the point', events.some((e) => e.type === 'tool_call' && e.tool === 'desktop_click_at' && e.detail === '145,310'));

// ---- session C: garbage coordinates are refused before any exec ------------
execCalls.length = 0;
const resC = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async () => 'Clicking somewhere.\n{"action":"desktop_click_at","x":"abc","y":310}'),
});
check('C: one turn ran', resC.turnsRun === 1);
const logC = (resC.log || []).find((l) => l.action && l.action.startsWith('desktop_click_at'));
check('C: refusal names integer coordinates', !!logC && /integer "x" and "y"/.test(logC.observation || ''));
check('C: no xdotool ran on the refusal', !execCalls.some((c) => c.includes('xdotool mousemove')));

// ---- session D: tesseract missing -> named, not silent ---------------------
tesseractMissing = true;
const resD = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async () => 'Reading the screen again.\n{"action":"see_screen"}'),
});
check('D: one turn ran', resD.turnsRun === 1);
const logD = (resD.log || []).find((l) => l.action === 'see_screen');
check('D: observation names the missing OCR install', !!logD && /tesseract OCR is not installed/.test(logD.observation || ''));
tesseractMissing = false;

// ---- session E: look again after acting ------------------------------------
const resE = await humanIteration(HUNT, TARGET, {
  turns: 1,
  deps: baseDeps(async () => 'Confirming what changed.\n{"action":"see_screen"}'),
});
check('E: one turn ran', resE.turnsRun === 1);
const logE = (resE.log || []).find((l) => l.action === 'see_screen');
check('E: screen re-reads after the click', !!logE && /"Log in" at \(145, 310\)/.test(logE.observation || ''));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
