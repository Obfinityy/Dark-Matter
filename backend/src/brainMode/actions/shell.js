// Split out of brainMode.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeBrainAction, moved verbatim except that
// dispatcher locals are read through the h context object.

import {
  claimGateCheck,
  claimClassFromTitle,
  extractTaskBlock,
  scopeViolation,
  pendingPlannedProbes,
  targetHostsFor,
} from '../../humanLoop.js';
import { COMMAND_CAP, OBS_BUDGET, defaultAssess, defaultExec, defaultGui } from './common.js';

export async function executeShellAction(huntId, action, h) {
  const fullCommand = String(action.command || '');
  if (!fullCommand.trim()) { h.failProcess('empty_command', 'shell needs a command.'); return { ok: false, error: 'empty_command', message: 'shell needs a command.' }; }
  // FIX (#367, gap 1): the scope check used to run on the command
  // AFTER truncation to COMMAND_CAP, so an out-of-scope URL past
  // 4000 chars evaded the gate — and the executed command was
  // silently truncated. Now the FULL command is scope-checked
  // first; over-long commands are refused outright (naming the
  // cap) instead of silently truncated.
  const badUrl = (() => {
    try {
      const urls = fullCommand.match(/(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s'"<>)|\]]+/gi) || [];
      for (const u of urls) {
        const v = scopeViolation(u, h.target, h.parsedScope);
        if (v) return v;
      }
      return null;
    } catch { return null; }
  })();
  if (badUrl) {
    const msg = `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. Only test ${h.target} and its listed assets. Nothing was sent.`;
    try { h.record(huntId, { type: 'scope_block', tool: 'shell', detail: fullCommand.slice(0, 300), via: 'be-a-brain' }); } catch { /* best-effort */ }
    h.failProcess('out_of_scope', msg);
    return { ok: false, error: 'out_of_scope', output: msg };
  }
  if (fullCommand.length > COMMAND_CAP) {
    const msg = `Command too long (${fullCommand.length} chars; max ${COMMAND_CAP}) — split it into smaller commands. Nothing was run.`;
    h.failProcess('command_too_long', msg);
    return { ok: false, error: 'command_too_long', message: msg };
  }
  const command = fullCommand;
  // The tool_call + note are recorded AFTER execution (recordExecuted
  // below), so the note carries the real result.
  let result;
  try {
    result = await defaultExec(huntId, h.target, command, h.d);
  } catch (err) {
    result = { stdout: '', stderr: String((err && err.message) || err), code: 1 };
  }
  const combined = `${(result && result.stdout) || ''}\n${(result && result.stderr) || ''}`.trim();
  h.observation = combined.length > OBS_BUDGET
    ? `${combined.slice(0, OBS_BUDGET)}\n[output truncated on screen — ${combined.length} chars total]`
    : (combined || `(command finished with no output, exit code ${(result && result.code) ?? 0})`);
  if (result && result.code && result.code !== 0) h.observation += `\n[exit code ${result.code}]`;
  h.recordExecuted();
  return h.finish();
}
