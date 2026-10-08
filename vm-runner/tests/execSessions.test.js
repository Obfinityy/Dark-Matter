import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExecSessionManager, ExecNotFoundError } from '../src/execSessions.js';

/** In-memory fake of the guest agent's async exec endpoints. */
function makeFakeGuest() {
  const jobs = new Map();
  let n = 0;
  return {
    jobs,
    async execStart({ command }) {
      const execId = `exec-${++n}`;
      jobs.set(execId, { command, chunks: [''], done: false, exit_code: null });
      return { execId };
    },
    async execPoll(execId) {
      const job = jobs.get(execId);
      if (!job) throw Object.assign(new Error('no such exec'), { code: 'not_found' });
      return {
        done: job.done,
        exit_code: job.exit_code,
        stdout: job.chunks.join(''),
        stderr: '',
      };
    },
    async execKill(execId) {
      const job = jobs.get(execId);
      if (!job) throw Object.assign(new Error('no such exec'), { code: 'not_found' });
      job.done = true;
      job.exit_code = -1;
      return { ok: true };
    },
    emit(execId, text) {
      jobs.get(execId).chunks.push(text);
    },
    finish(execId, code = 0) {
      const job = jobs.get(execId);
      job.done = true;
      job.exit_code = code;
    },
  };
}

const mgrWith = (fake) =>
  new ExecSessionManager({ getGuestClient: async () => fake });

describe('ExecSessionManager', () => {
  it('starts, polls deltas, and completes', async () => {
    const fake = makeFakeGuest();
    const mgr = mgrWith(fake);
    const { execId } = await mgr.start('sess-a', { command: 'nmap example.com' });
    assert.match(execId, /^exec-/);

    fake.emit(execId, 'line1\n');
    let p = await mgr.poll('sess-a', execId);
    assert.equal(p.done, false);
    assert.equal(p.outputDelta, 'line1\n');
    assert.ok(!('exit_code' in p));

    fake.emit(execId, 'line2\n');
    p = await mgr.poll('sess-a', execId);
    assert.equal(p.outputDelta, 'line2\n'); // delta only, not cumulative
    assert.equal(p.stdout, 'line1\nline2\n'); // cumulative

    fake.finish(execId, 0);
    p = await mgr.poll('sess-a', execId);
    assert.equal(p.done, true);
    assert.equal(p.exit_code, 0);
  });

  it('scopes execIds to their session', async () => {
    const fake = makeFakeGuest();
    const mgr = mgrWith(fake);
    const { execId } = await mgr.start('sess-a', { command: 'sleep 60' });
    await assert.rejects(() => mgr.poll('sess-b', execId), ExecNotFoundError);
    await assert.rejects(() => mgr.kill('sess-b', execId), ExecNotFoundError);
  });

  it('rejects unknown execIds', async () => {
    const mgr = mgrWith(makeFakeGuest());
    await assert.rejects(() => mgr.poll('sess-a', 'nope'), /unknown exec session/);
  });

  it('kill terminates and forgets the session', async () => {
    const fake = makeFakeGuest();
    const mgr = mgrWith(fake);
    const { execId } = await mgr.start('sess-a', { command: 'sleep 60' });
    assert.deepEqual(await mgr.kill('sess-a', execId), { ok: true });
    assert.equal(fake.jobs.get(execId).done, true);
    await assert.rejects(() => mgr.poll('sess-a', execId), ExecNotFoundError);
  });

  it('requires a command', async () => {
    const mgr = mgrWith(makeFakeGuest());
    await assert.rejects(() => mgr.start('sess-a', { command: '' }), /command is required/);
  });

  it('forgetSession drops all of a session execs', async () => {
    const fake = makeFakeGuest();
    const mgr = mgrWith(fake);
    const a = await mgr.start('sess-a', { command: 'sleep 1' });
    const b = await mgr.start('sess-b', { command: 'sleep 1' });
    mgr.forgetSession('sess-a');
    await assert.rejects(() => mgr.poll('sess-a', a.execId), ExecNotFoundError);
    const p = await mgr.poll('sess-b', b.execId); // untouched
    assert.equal(p.done, false);
  });
});
