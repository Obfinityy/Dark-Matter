// Screen-seeing (27 Oct 2026, owner order) — the text-only brain "sees" the
// desktop through a TEXT MAP: screenshot -> OCR words with coordinates ->
// lines with (x, y) centres the brain can click.
//
// Asserted here:
//   - tesseract TSV parsing keeps level-5 words, drops low-confidence
//     words and non-word rows, and groups words by their (block:par:line).
//   - The map formats one `"text" at (cx, cy)` line per text line, sorted
//     top-to-bottom, capped to SCREEN_MAP_BUDGET.
//   - Click targets are validated BEFORE any exec (integer, in range) —
//     an unvalidated coordinate would be an injection into xdotool.
//   - captureScreenMap names its failures (desktop_down / ocr_missing /
//     blank) instead of failing silently.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTesseractTsv,
  buildScreenMap,
  parseClickAt,
  desktopClickAtCommand,
  captureScreenMap,
  screenMapErrorLine,
  parseScreenMapLines,
  SCREEN_MAP_BUDGET,
} from './screenMap.js';

const TSV_HEADER = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const TSV = [
  TSV_HEADER,
  '1\t1\t0\t0\t0\t0\t0\t0\t1920\t1080\t-1\t',
  '2\t1\t1\t0\t0\t0\t0\t0\t1920\t1080\t-1\t',
  '5\t1\t1\t1\t1\t1\t100\t300\t60\t20\t92\tLog',
  '5\t1\t1\t1\t1\t2\t170\t300\t20\t20\t88\tin',
  '5\t1\t1\t1\t2\t1\t100\t340\t120\t20\t95\tEmail',
  '5\t1\t1\t1\t2\t2\t900\t340\t40\t20\t12\tnoise',
  '5\t1\t1\t1\t3\t1\t500\t600\t80\t20\t-1\tblank',
  '5\t1\t1\t1\t3\t2\t500\t600\t80\t20\t95\t',
].join('\n');

test('parseTesseractTsv keeps words, drops noise and non-word rows', () => {
  const words = parseTesseractTsv(TSV);
  assert.equal(words.length, 3);
  assert.deepEqual(words.map((w) => w.text), ['Log', 'in', 'Email']);
  assert.equal(words[0].line, '1:1:1');
  assert.equal(words[2].line, '1:1:2');
  assert.equal(words[0].x, 100);
  assert.equal(words[0].conf, 92);
  assert.deepEqual(parseTesseractTsv(''), []);
  assert.deepEqual(parseTesseractTsv(null), []);
});

test('buildScreenMap formats one line per text line with click centres', () => {
  const words = parseTesseractTsv(TSV);
  const map = buildScreenMap(words, { width: 1920, height: 1080 });
  assert.match(map, /=== WHAT THE SCREEN SHOWS \(1920x1080\) ===/);
  assert.match(map, /"Log in" at \(145, 310\)/);
  assert.match(map, /"Email" at \(160, 350\)/);
  // Top-to-bottom order: Log in (y 300) before Email (y 340).
  assert.ok(map.indexOf('"Log in"') < map.indexOf('"Email"'));
});

test('buildScreenMap caps long screens and says so', () => {
  const words = [];
  for (let i = 0; i < 300; i++) {
    words.push({ text: `line-number-${i}-with-plenty-of-words-here`, x: 10, y: i * 20, w: 200, h: 16, conf: 90, line: `1:1:${i}` });
  }
  const map = buildScreenMap(words);
  assert.ok(map.length <= SCREEN_MAP_BUDGET + 200);
  assert.match(map, /more line\(s\) cut/);
});

test('buildScreenMap names a blank screen', () => {
  assert.match(buildScreenMap([]), /no readable text on screen/);
});

test('parseClickAt accepts integers in range and refuses the rest', () => {
  assert.deepEqual(parseClickAt({ x: 1240, y: 310 }), { ok: true, x: 1240, y: 310 });
  assert.equal(parseClickAt({ x: 1.5, y: 2 }).ok, false);
  assert.equal(parseClickAt({ x: -1, y: 2 }).ok, false);
  assert.equal(parseClickAt({ x: '1240', y: 310 }).ok, false);
  assert.equal(parseClickAt({ x: 10000, y: 1 }).ok, false);
  assert.equal(parseClickAt({}).ok, false);
  assert.equal(parseClickAt(null).ok, false);
});

test('desktopClickAtCommand moves and clicks at the validated point', () => {
  const cmd = desktopClickAtCommand(1240, 310);
  assert.match(cmd, /DISPLAY=:99 xdotool mousemove 1240 310 click 1/);
  assert.match(cmd, /echo clicked/);
});

test('captureScreenMap: desktop down when scrot fails', async () => {
  const deps = { execRaw: async () => ({ stdout: '', stderr: 'cannot open display', code: 1 }) };
  const res = await captureScreenMap('h_x', deps);
  assert.deepEqual(res, { ok: false, error: 'desktop_down' });
});

test('captureScreenMap: ocr_missing when tesseract is absent (code 127)', async () => {
  const deps = {
    execRaw: async (h, cmd) => {
      if (cmd.includes('scrot')) return { stdout: 'captured', stderr: '', code: 0 };
      if (cmd.includes('getdisplaygeometry')) return { stdout: '1920 1080', stderr: '', code: 0 };
      return { stdout: '', stderr: '', code: 127 };
    },
  };
  const res = await captureScreenMap('h_x', deps);
  assert.deepEqual(res, { ok: false, error: 'ocr_missing' });
});

test('captureScreenMap: full happy path returns the map', async () => {
  const deps = {
    execRaw: async (h, cmd) => {
      if (cmd.includes('scrot')) return { stdout: 'captured', stderr: '', code: 0 };
      if (cmd.includes('getdisplaygeometry')) return { stdout: '1920 1080', stderr: '', code: 0 };
      return { stdout: TSV, stderr: '', code: 0 };
    },
  };
  const res = await captureScreenMap('h_x', deps);
  assert.equal(res.ok, true);
  assert.equal(res.words, 3);
  assert.match(res.map, /\(1920x1080\)/);
  assert.match(res.map, /"Log in" at \(145, 310\)/);
});

test('captureScreenMap: blank screen when OCR finds no words', async () => {
  const deps = {
    execRaw: async (h, cmd) => {
      if (cmd.includes('scrot')) return { stdout: 'captured', stderr: '', code: 0 };
      if (cmd.includes('getdisplaygeometry')) return { stdout: '1920 1080', stderr: '', code: 0 };
      return { stdout: TSV_HEADER + '\n', stderr: '', code: 0 };
    },
  };
  const res = await captureScreenMap('h_x', deps);
  assert.deepEqual(res, { ok: false, error: 'blank' });
});

test('screenMapErrorLine names each failure plainly', () => {
  assert.match(screenMapErrorLine('desktop_down'), /not running/);
  assert.match(screenMapErrorLine('ocr_missing'), /tesseract OCR is not installed/);
  assert.match(screenMapErrorLine('blank'), /no readable text/);
});

test('parseScreenMapLines parses a map back into lines with coordinates', () => {
  const map = [
    '=== WHAT THE SCREEN SHOWS (1280x800) ===',
    '  "u ername" at (640, 300)',
    '  "pa word" at (640, 340)',
    '  "Login" at (640, 380)',
    '  ... (2 more line(s) cut — the screen is dense; click what you need, then see_screen again)',
  ].join('\n');
  assert.deepEqual(parseScreenMapLines(map), [
    { text: 'u ername', x: 640, y: 300 },
    { text: 'pa word', x: 640, y: 340 },
    { text: 'Login', x: 640, y: 380 },
  ]);
  assert.deepEqual(parseScreenMapLines(''), []);
  assert.deepEqual(parseScreenMapLines(null), []);
});
