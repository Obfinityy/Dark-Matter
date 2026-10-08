/**
 * Long-running exec session registry for the Infinity AI VM Runner.
 *
 * The guest agent owns the actual process lifecycle (POST /exec/start,
 * GET /exec/:id/poll, POST /exec/:id/kill). This registry scopes execIds to
 * their session (an execId from session A can never be polled with session
 * B's token) and computes per-poll output deltas from the guest's cumulative
 * output. Output returned to callers is tail-capped so a runaway nmap cannot
 * blow up runner memory.
 */
export const OUTPUT_TAIL_CHARS = 50000;
export const EXEC_TTL_MS = 60 * 60 * 1000; // forget execs an hour after completion

export class ExecNotFoundError extends Error {
  constructor(execId) {
    super(`unknown exec session: ${execId}`);
    this.name = 'ExecNotFoundError';
    this.code = 'not_found';
  }
}

function tail(s, n = OUTPUT_TAIL_CHARS) {
  const str = String(s || '');
  return str.length > n ? str.slice(-n) : str;
}

export class ExecSessionManager {
  /**
   * @param {{ getGuestClient: (sessionId: string) => Promise<GuestClient> }} opts
   */
  constructor({ getGuestClient }) {
    if (typeof getGuestClient !== 'function') throw new Error('ExecSessionManager requires getGuestClient');
    this.getGuestClient = getGuestClient;
    /** execId -> { sessionId, execId, command, stdoutOffset, stderrOffset, done, exit_code, startedAt, finishedAt } */
    this.sessions = new Map();
  }

  require(sessionId, execId) {
    const rec = this.sessions.get(execId);
    if (!rec || rec.sessionId !== sessionId) throw new ExecNotFoundError(execId);
    return rec;
  }

  sweep() {
    const now = Date.now();
    for (const [id, rec] of this.sessions) {
      if (rec.done && now - rec.finishedAt > EXEC_TTL_MS) this.sessions.delete(id);
    }
  }

  /** Start a long-running command → { execId }. */
  async start(sessionId, { command, cwd, timeoutMs = 3600000 }) {
    if (!command || typeof command !== 'string') throw new Error('command is required');
    this.sweep();
    const client = await this.getGuestClient(sessionId);
    const { execId } = await client.execStart({ command, cwd, timeoutMs });
    if (!execId) throw new Error('guest agent did not return an execId');
    this.sessions.set(execId, {
      sessionId,
      execId,
      command,
      stdoutOffset: 0,
      stderrOffset: 0,
      done: false,
      exit_code: null,
      startedAt: Date.now(),
      finishedAt: null,
    });
    return { execId };
  }

  /**
   * Poll → { done, exit_code?, outputDelta, stdout, stderr }.
   * stdout/stderr are tail-capped cumulative output; outputDelta is only the
   * bytes produced since the previous poll.
   */
  async poll(sessionId, execId) {
    const rec = this.require(sessionId, execId);
    const client = await this.getGuestClient(sessionId);
    const res = await client.execPoll(execId);
    const stdout = String(res.stdout || '');
    const stderr = String(res.stderr || '');
    const outputDelta = stdout.slice(rec.stdoutOffset) + stderr.slice(rec.stderrOffset);
    rec.stdoutOffset = stdout.length;
    rec.stderrOffset = stderr.length;
    if (res.done && !rec.done) {
      rec.done = true;
      rec.exit_code = res.exit_code ?? null;
      rec.finishedAt = Date.now();
    }
    return {
      done: rec.done,
      ...(rec.done ? { exit_code: rec.exit_code } : {}),
      outputDelta,
      stdout: tail(stdout),
      stderr: tail(stderr),
    };
  }

  /** Kill a running exec → { ok }. */
  async kill(sessionId, execId) {
    const rec = this.require(sessionId, execId);
    const client = await this.getGuestClient(sessionId);
    try {
      await client.execKill(execId);
    } finally {
      this.sessions.delete(execId);
    }
    return { ok: true };
  }

  /** Forget all execs of a session (called on /vm/stop). */
  forgetSession(sessionId) {
    for (const [id, rec] of this.sessions) {
      if (rec.sessionId === sessionId) this.sessions.delete(id);
    }
  }
}
