// Screen-seeing (27 Oct 2026, owner order) — the text-only brain "sees" the
// desktop through a TEXT MAP: screenshot -> OCR words with coordinates ->
// lines with (x, y) centres the brain can click.
//
// The 8B brain cannot see pixels (llm.js has no image path; screenshots
// today go to PNG artifacts the OWNER views). So the machine translates the
// screen into text the brain CAN read — the same sense-act-observe loop it
// already runs in the browser (browser_snapshot -> click), now desktop-wide.
//
//   see_screen       scrot + tesseract TSV -> screen map (this module)
//   desktop_click_at xdotool mousemove + click at map coordinates
//
// Pure parts (unit-tested here): parseTesseractTsv, buildScreenMap,
// parseClickAt, desktopClickAtCommand. Orchestration (deps seam):
// captureScreenMap(huntId, deps) — scrot + tesseract inside the hunt
// container via deps.execRaw (tests inject a stub).
//
// AT-SPI LAYER (pending owner decision): when at-spi2-core +
// python3-pyatspi land in the image, a second builder will add the real UI
// tree (named buttons/fields + coordinates) beside the OCR lines. The map
// format stays the same — one line per element — so the brain's actions do
// not change.

import { DESKTOP_DISPLAY } from './desktopControl.js';

export const SCREEN_MAP_BUDGET = 2000; // chars of map text per screen
export const SCREEN_SHOT_PATH = '/tmp/dm-screen.png'; // distinct from the owner's poller shot
export const MIN_WORD_CONF = 30; // tesseract 0-100; below this a word is noise
export const MAX_CLICK_COORD = 10000; // sanity bound for a click coordinate

/**
 * Parse tesseract TSV output (level 5 rows are words) into
 * [{ text, x, y, w, h, conf, line }] with x/y the word's TOP-LEFT and
 * `line` the (block:par:line) key its words group by. Rows with
 * conf < MIN_WORD_CONF or empty text are dropped. Never throws.
 */
export function parseTesseractTsv(tsv) {
  const words = [];
  for (const raw of String(tsv || '').split('\n')) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('level\t')) continue;
    const cols = line.split('\t');
    if (cols.length < 12) continue;
    if (cols[0] !== '5') continue; // level 5 = word
    const text = (cols[11] || '').trim();
    const conf = Number(cols[10]);
    if (!text) continue;
    if (!Number.isFinite(conf) || conf < MIN_WORD_CONF) continue;
    const left = Number(cols[6]);
    const top = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    if (![left, top, width, height].every(Number.isFinite)) continue;
    words.push({ text, x: left, y: top, w: width, h: height, conf, line: `${cols[2]}:${cols[3]}:${cols[4]}` });
  }
  return words;
}

/**
 * Group words into lines (same tesseract block/par/line) and format the
 * screen map: one line per text line, `"<text>" at (cx, cy)` with the
 * line's CENTRE — the point desktop_click_at aims at. Lines sort
 * top-to-bottom, then left-to-right. Capped to SCREEN_MAP_BUDGET chars;
 * the cap note says how many lines were cut. Pure.
 *
 * Words carry their line key when they came from parseTesseractTsv via
 * the optional `line` field; without it, words group by y-proximity
 * (same row when their vertical centres are within 8px).
 */
export function buildScreenMap(words, { width = 0, height = 0 } = {}) {
  const list = (words || []).filter((w) => w && w.text);
  const lines = new Map();
  for (const w of list) {
    const key = w.line != null
      ? String(w.line)
      : `y${Math.round((w.y + w.h / 2) / 8)}`;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(w);
  }
  const rows = [];
  for (const group of lines.values()) {
    const sorted = [...group].sort((a, b) => a.x - b.x);
    const text = sorted.map((w) => w.text).join(' ');
    const left = Math.min(...sorted.map((w) => w.x));
    const top = Math.min(...sorted.map((w) => w.y));
    const right = Math.max(...sorted.map((w) => w.x + w.w));
    const bottom = Math.max(...sorted.map((w) => w.y + w.h));
    rows.push({ text, cx: Math.round((left + right) / 2), cy: Math.round((top + bottom) / 2), top, left });
  }
  rows.sort((a, b) => (a.top - b.top) || (a.left - b.left));
  const header = width && height
    ? `=== WHAT THE SCREEN SHOWS (${width}x${height}) ===`
    : '=== WHAT THE SCREEN SHOWS ===';
  const out = [header];
  let cut = 0;
  for (const r of rows) {
    const line = `  "${r.text}" at (${r.cx}, ${r.cy})`;
    if (out.join('\n').length + line.length + 1 > SCREEN_MAP_BUDGET) { cut++; continue; }
    out.push(line);
  }
  if (!rows.length) out.push('  (no readable text on screen — blank desktop or a picture with no words)');
  if (cut > 0) out.push(`  ... (${cut} more line(s) cut — the screen is dense; click what you need, then see_screen again)`);
  return out.join('\n');
}

/**
 * Build the same map shape from an AT-SPI control list
 * ([{ name, role, rect: [x, y, w, h] }]) — the "second builder" the
 * OCR lane left as a TODO. One line per control,
 * `"Name" (role) at (cx, cy)` with the control's CENTRE — the point
 * desktop_click_at aims at, and the name desktop_click_control
 * presses. Same SCREEN_MAP_BUDGET cap and cut note as the OCR map,
 * so the brain's actions do not change between sources. Controls
 * without a name or rect are dropped; the list sorts top-to-bottom,
 * then left-to-right. Pure.
 */
export function buildAtspiMap(controls, { width = 0, height = 0 } = {}) {
  const list = (controls || []).filter((c) => c && c.name && Array.isArray(c.rect) && c.rect.length === 4);
  const rows = list.map((c) => {
    const [x, y, w, h] = c.rect.map(Number);
    return {
      text: `${String(c.name).trim()}${c.role ? ` (${String(c.role).trim()})` : ''}`,
      cx: Math.round(x + w / 2),
      cy: Math.round(y + h / 2),
      top: y,
      left: x,
    };
  }).filter((r) => [r.cx, r.cy, r.top, r.left].every(Number.isFinite));
  rows.sort((a, b) => (a.top - b.top) || (a.left - b.left));
  const header = width && height
    ? `=== WHAT THE APP SHOWS — accessibility tree (${width}x${height}) ===`
    : '=== WHAT THE APP SHOWS — accessibility tree ===';
  const out = [header];
  let cut = 0;
  for (const r of rows) {
    const line = `  "${r.text}" at (${r.cx}, ${r.cy})`;
    if (out.join('\n').length + line.length + 1 > SCREEN_MAP_BUDGET) { cut++; continue; }
    out.push(line);
  }
  if (!rows.length) out.push('  (no named controls in this window right now)');
  if (cut > 0) out.push(`  ... (${cut} more control(s) cut — the window is dense; click what you need, then list again)`);
  return out.join('\n');
}

/**
 * Validate a click target. Coordinates must be integers in [0, MAX_CLICK_COORD).
 * Anything else is refused BEFORE any exec — an unvalidated number would be an
 * injection into the xdotool command line. Returns { ok, x, y } or { ok, error }.
 */
export function parseClickAt(action) {
  const x = action?.x;
  const y = action?.y;
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return { ok: false, error: 'give integer "x" and "y" from the screen map, e.g. {"action":"desktop_click_at","x":1240,"y":310}' };
  }
  if (x < 0 || y < 0 || x >= MAX_CLICK_COORD || y >= MAX_CLICK_COORD) {
    return { ok: false, error: `coordinates out of range (0–${MAX_CLICK_COORD - 1}): got (${x}, ${y}) — take see_screen again and use a point from the map` };
  }
  return { ok: true, x, y };
}

/** xdotool mousemove + click, in the desktopControl.js style. */
export function desktopClickAtCommand(x, y) {
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool mousemove ${x} ${y} click 1 2>/dev/null && echo clicked || echo click_failed`;
}

/** Screen size via xdotool (for the map header). */
export function screenGeometryCommand() {
  return `DISPLAY=${DESKTOP_DISPLAY} xdotool getdisplaygeometry 2>/dev/null`;
}

function parseGeometry(out) {
  const m = /(\d+)\s+(\d+)/.exec(String(out || ''));
  if (!m) return { width: 0, height: 0 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

/**
 * Capture the desktop and build its screen map. Runs scrot + tesseract
 * INSIDE the hunt container (where the desktop lives) via deps.execRaw.
 * Returns { ok, map, words } or { ok: false, error } with a named error:
 *   desktop_down — scrot could not reach display :99
 *   ocr_missing  — tesseract is not installed in this image (needs the
 *                  image rebuild; the observation says so plainly)
 *   blank        — the screen has no readable text
 * Never throws.
 */
export async function captureScreenMap(huntId, deps) {
  const execRaw = deps?.execRaw;
  if (typeof execRaw !== 'function') return { ok: false, error: 'exec_unavailable' };
  try {
    const shot = await execRaw(
      huntId,
      `DISPLAY=${DESKTOP_DISPLAY} scrot -o ${SCREEN_SHOT_PATH} 2>/dev/null && echo captured`,
      15000,
      { bypassTmux: true },
    );
    if (!String((shot && shot.stdout) || '').includes('captured')) {
      return { ok: false, error: 'desktop_down' };
    }
    let geometry = { width: 0, height: 0 };
    try {
      const g = await execRaw(huntId, screenGeometryCommand(), 10000, { bypassTmux: true });
      geometry = parseGeometry(g && g.stdout);
    } catch { /* geometry is best-effort beside the map */ }
    const ocr = await execRaw(
      huntId,
      `tesseract ${SCREEN_SHOT_PATH} stdout --psm 11 tsv 2>/dev/null`,
      30000,
      { bypassTmux: true },
    );
    const errText = String((ocr && ocr.stderr) || '');
    if (ocr && ocr.code === 127) return { ok: false, error: 'ocr_missing' };
    if (/tesseract: (not found|command not found)/.test(errText)) return { ok: false, error: 'ocr_missing' };
    const words = parseTesseractTsv(ocr && ocr.stdout);
    if (!words.length) return { ok: false, error: 'blank' };
    return { ok: true, map: buildScreenMap(words, geometry), words: words.length };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/** Human-readable observation for a capture failure (named, no guesswork). */
export function screenMapErrorLine(error) {
  switch (error) {
    case 'desktop_down':
      return 'The desktop is not running right now (scrot could not reach display :99). Open a page with browser_open first — that starts the desktop — then see_screen again.';
    case 'ocr_missing':
      return 'This image cannot read the screen yet (tesseract OCR is not installed in the hunt image). The screen-seeing lane needs the image rebuild — note it and move on for now; do not retry see_screen this hunt.';
    case 'blank':
      return 'The screen has no readable text right now (blank desktop or a picture with no words). Take desktop_snapshot to see the windows, then open something with text.';
    default:
      return `Could not read the screen: ${String(error || 'unknown error').slice(0, 160)}. Take desktop_snapshot instead.`;
  }
}
