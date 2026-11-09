// Shared atomic file-write helpers.
//
// Many persistence modules used to hand-roll the same pattern: write to a
// pid-suffixed temp file next to the target, then rename over it. The
// rename is atomic on the same filesystem, so a crash mid-write can never
// leave a half-written target behind. That pattern lives in exactly one
// place now — call sites pass the final contents, never a temp path.
//
// The helpers are synchronous, like every call site they replaced, and
// throw on failure (callers that must never throw keep their own
// try/catch, as before). The destination directory must already exist;
// callers keep their own mkdir/ensureDir calls.

import fs from 'node:fs';

/**
 * Atomically replace a file: write `contents` to a pid-suffixed temp file
 * in the same directory, then rename it over `file`.
 *
 * @param {string} file - destination path
 * @param {string|Buffer} contents - bytes to write
 * @param {{ mode?: number }} [options] - when set, the temp file is
 *   chmodded before the rename and the target after it (best-effort),
 *   matching what the credential/user-details vault writers did before.
 */
export function atomicWrite(file, contents, options = {}) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents);
  if (options.mode != null) {
    try { fs.chmodSync(tmp, options.mode); } catch { /* best-effort */ }
  }
  fs.renameSync(tmp, file);
  if (options.mode != null) {
    try { fs.chmodSync(file, options.mode); } catch { /* best-effort */ }
  }
}

/**
 * Atomically write a JSON value to a file.
 *
 * @param {string} file - destination path
 * @param {*} value - value to serialise
 * @param {{ space?: number, mode?: number }} [options] - `space` is the
 *   JSON.stringify indent (default 2; pass 0 for compact output, 1 where
 *   the previous writer used it); `mode` is an optional chmod, see above.
 */
export function atomicWriteJson(file, value, options = {}) {
  const space = options.space == null ? 2 : options.space;
  atomicWrite(file, JSON.stringify(value, null, space), options);
}

/**
 * Atomically write newline-delimited JSON (one object per line, with a
 * trailing newline), the format the global-memory and playbook stores use.
 *
 * @param {string} file - destination path
 * @param {Array<*>} values - values to serialise, one per line
 * @param {{ mode?: number }} [options] - optional chmod, see above.
 */
export function atomicWriteNdjson(file, values, options = {}) {
  atomicWrite(file, values.map((v) => JSON.stringify(v)).join('\n') + '\n', options);
}
