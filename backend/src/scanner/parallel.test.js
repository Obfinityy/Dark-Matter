// Dark Matter scanner — parallel phase runner tests (10 Nov 2026).
//
// The probe block runs concurrently in a bounded pool (parallel.js)
// instead of one-by-one. These tests pin the contract that makes that
// safe:
//
// - Equivalence: a parallel run produces the IDENTICAL confirmed-title
//   set, in the IDENTICAL order, as a sequential run — no duplicates,
//   no lost findings. The dedup first-wins winner is preserved because
//   outcomes merge in task order, never completion order.
// - Error isolation: one phase throwing (or timing out) never aborts
//   the scan; the failure is recorded and the other phases complete.
// - Teardown: an OOB collaborator stop runs after its phase settles,
//   and a teardown failure never masks the phase result.
// - Concurrency: the pool really overlaps work, but never exceeds
//   the cap.
//
// No network, no docker: the runner tests use stub tasks with fixed
// delays; the runScan test reuses the phaseEvents stub-fetch harness.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runPhaseTasks, resolvePhaseConcurrency, DEFAULT_PHASE_CONCURRENCY } from './parallel.js';
import { dedupeFindings } from '../hunt-intel/differential.js';
import { runScan } from './index.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Finding-shaped objects, as the probes return them. dedupeFindings
// keys on class+sink+trigger+title (first-wins), so the duplicate
// below must carry all four fields identical to collapse.
function finding(cls, sink, title) {
  return { class: cls, sink, trigger: `trigger-${title}`, title, severity: 'medium' };
}

// Mirror of runScan's onSettled merge: findings in task order, errors
// collected, skipped/failed records emitted in order. The runner test
// proves the runner delivers outcomes in task order; the runScan test
// below proves the real merge.
function makeMerge() {
  const merged = [];
  const errors = [];
  const records = [];
  const onSettled = (outcome) => {
    const value = outcome.value;
    if (value && value.record) {
      if (Array.isArray(value.result)) merged.push(...value.result);
      if (value.error) errors.push(`${outcome.name}: ${value.error}`);
      records.push(value.record);
      return;
    }
    errors.push(`${outcome.name}: ${outcome.error}`);
    records.push({
      name: outcome.name,
      ok: false,
      error: outcome.error,
      findingsCount: 0,
    });
  };
  return { merged, errors, records, onSettled };
}

// Seven stub phase tasks with deliberately staggered delays so a
// completion-order merge would scramble them (task 'cors' finishes
// first at 5ms, 'headers' last at 40ms). One finding is returned by
// two tasks: dedupe must collapse it to one, first-wins.
function stubPhaseTasks() {
  const dup = finding('missing-security-header', 'http://example.com/', 'Missing X-Frame-Options');
  return [
    {
      name: 'headers',
      run: async () => {
        await sleep(40);
        return {
          result: [dup, finding('missing-security-header', 'http://example.com/', 'Missing CSP')],
          record: { name: 'headers', ok: true, error: null, findingsCount: 2 },
          ok: true,
          error: null,
        };
      },
    },
    {
      name: 'cors',
      run: async () => {
        await sleep(5);
        return {
          result: [finding('cors', 'http://example.com/', 'Permissive CORS')],
          record: { name: 'cors', ok: true, error: null, findingsCount: 1 },
          ok: true,
          error: null,
        };
      },
    },
    {
      name: 'cookies',
      run: async () => {
        await sleep(25);
        return {
          result: [dup, finding('cookie-flags', 'http://example.com/', 'Cookie Without Secure')],
          record: { name: 'cookies', ok: true, error: null, findingsCount: 2 },
          ok: true,
          error: null,
        };
      },
    },
    {
      name: 'host-header',
      run: async () => {
        await sleep(15);
        return {
          result: [],
          record: { name: 'host-header', ok: true, error: null, findingsCount: 0 },
          ok: true,
          error: null,
        };
      },
    },
    {
      name: 'verb-tampering',
      run: async () => {
        await sleep(0);
        const now = new Date().toISOString();
        return {
          result: [],
          record: {
            name: 'verb-tampering',
            startedAt: now,
            finishedAt: now,
            durationMs: 0,
            ok: true,
            skipped: true,
            skipReason: 'no probe targets',
            error: null,
            findingsCount: 0,
          },
          ok: true,
          error: null,
        };
      },
    },
  ];
}

describe('runPhaseTasks equivalence', () => {
  it('parallel run produces the identical title set and order as sequential', async () => {
    const expectedTitles = [
      'Missing X-Frame-Options',
      'Missing CSP',
      'Permissive CORS',
      'Missing X-Frame-Options',
      'Cookie Without Secure',
    ];
    const expectedNames = ['headers', 'cors', 'cookies', 'host-header', 'verb-tampering'];

    const seq = makeMerge();
    const seqOutcomes = await runPhaseTasks(stubPhaseTasks(), { concurrency: 1, onSettled: seq.onSettled });
    assert.deepEqual(seq.merged.map((f) => f.title), expectedTitles);
    assert.deepEqual(seq.records.map((r) => r.name), expectedNames);
    assert.deepEqual(seq.errors, []);
    assert.ok(seq.records.find((r) => r.name === 'verb-tampering').skipped);

    const par = makeMerge();
    const parOutcomes = await runPhaseTasks(stubPhaseTasks(), { concurrency: 5, onSettled: par.onSettled });
    // Identical merged order (task order, not completion order), no
    // duplicates, no lost findings.
    assert.deepEqual(par.merged.map((f) => f.title), expectedTitles);
    assert.deepEqual(par.records.map((r) => r.name), expectedNames);
    assert.deepEqual(par.errors, []);
    assert.ok(par.records.find((r) => r.name === 'verb-tampering').skipped);
    // The duplicate finding collapses to one under the REAL dedup,
    // first-wins, identically in both runs.
    const seqDeduped = dedupeFindings(seq.merged).map((f) => f.title);
    const parDeduped = dedupeFindings(par.merged).map((f) => f.title);
    assert.deepEqual(parDeduped, seqDeduped);
    assert.deepEqual(parDeduped, [
      'Missing X-Frame-Options',
      'Missing CSP',
      'Permissive CORS',
      'Cookie Without Secure',
    ]);
    // Outcomes themselves are in task order too, with timing filled in.
    assert.deepEqual(parOutcomes.map((o) => o.name), expectedNames);
    assert.ok(parOutcomes.every((o) => o.ok && typeof o.durationMs === 'number' && o.durationMs >= 0));
  });

  it('a failing phase does not abort the scan', async () => {
    const tasks = [
      { name: 'headers', run: async () => ({ result: [finding('x', 'u', 'A')], record: { name: 'headers', ok: true, error: null, findingsCount: 1 }, ok: true, error: null }) },
      {
        name: 'cors',
        run: async () => {
          await sleep(5);
          throw new Error('probe exploded');
        },
      },
      { name: 'cookies', run: async () => ({ result: [finding('x', 'u', 'B')], record: { name: 'cookies', ok: true, error: null, findingsCount: 1 }, ok: true, error: null }) },
    ];
    const { merged, errors, records, onSettled } = makeMerge();
    const outcomes = await runPhaseTasks(tasks, { concurrency: 3, onSettled });
    assert.deepEqual(merged.map((f) => f.title), ['A', 'B']);
    assert.deepEqual(errors, ['cors: probe exploded']);
    assert.deepEqual(records.map((r) => r.name), ['headers', 'cors', 'cookies']);
    const failed = outcomes.find((o) => o.name === 'cors');
    assert.equal(failed.ok, false);
    assert.match(failed.error, /probe exploded/);
    assert.equal(failed.value, undefined);
  });

  it('a task returning null is passed through intact, not treated as a failure', async () => {
    // executeStepBody always returns an object, so a null value cannot
    // arise from a real phase — the runner must still deliver it
    // without crashing or mislabelling it.
    const outcomes = await runPhaseTasks(
      [{ name: 'odd', run: async () => null }],
      { concurrency: 1 }
    );
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].ok, true);
    assert.equal(outcomes[0].value, null);
    assert.equal(outcomes[0].error, null);
  });

  it('a timed-out phase fails with a timeout error, teardown still runs, others complete', async () => {
    let teardownRan = false;
    const tasks = [
      {
        name: 'hung',
        run: () => new Promise(() => {}), // never resolves
        teardown: async () => {
          teardownRan = true;
        },
      },
      {
        name: 'headers',
        run: async () => {
          await sleep(5);
          return { result: [finding('x', 'u', 'A')], record: { name: 'headers', ok: true, error: null, findingsCount: 1 }, ok: true, error: null };
        },
      },
    ];
    const started = Date.now();
    const outcomes = await runPhaseTasks(tasks, { concurrency: 2, timeoutMs: 50 });
    // The pool resolves promptly: the hung task cannot wedge the run.
    assert.ok(Date.now() - started < 2000, 'pool must not wait on the hung task');
    const hung = outcomes.find((o) => o.name === 'hung');
    assert.equal(hung.ok, false);
    assert.match(hung.error, /timeout/);
    assert.equal(hung.value, undefined);
    assert.equal(teardownRan, true);
    assert.equal(outcomes.find((o) => o.name === 'headers').ok, true);
  });

  it('a throwing teardown does not mask the result or break other tasks', async () => {
    const tasks = [
      {
        name: 'sqli-oob',
        run: async () => ({ result: [finding('x', 'u', 'A')], record: { name: 'sqli-oob', ok: true, error: null, findingsCount: 1 }, ok: true, error: null }),
        teardown: async () => {
          throw new Error('collaborator stop failed');
        },
      },
      {
        name: 'headers',
        run: async () => ({ result: [finding('x', 'u', 'B')], record: { name: 'headers', ok: true, error: null, findingsCount: 1 }, ok: true, error: null }),
      },
    ];
    const outcomes = await runPhaseTasks(tasks, { concurrency: 2 });
    assert.deepEqual(outcomes.map((o) => o.name), ['sqli-oob', 'headers']);
    assert.ok(outcomes.every((o) => o.ok));
    assert.equal(outcomes[0].value.result[0].title, 'A');
  });

  it('concurrency stays within the cap and above one (real parallelism)', async () => {
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 8 }, (_, i) => ({
      name: `phase-${i}`,
      run: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await sleep(30);
        active -= 1;
        return i;
      },
    }));
    await runPhaseTasks(tasks, { concurrency: 5 });
    assert.ok(peak > 1, `expected real overlap, peak was ${peak}`);
    assert.ok(peak <= 5, `peak ${peak} exceeded the cap of 5`);
  });

  it('empty task list resolves to an empty array', async () => {
    assert.deepEqual(await runPhaseTasks([], { concurrency: 5 }), []);
  });
});

describe('runPhaseTasks exclusive groups', () => {
  it('tasks sharing an exclusive key never overlap; other keys and unkeyed tasks still run concurrently', async () => {
    const spans = [];
    const tracked = (name, ms, exclusive) => ({
      name,
      ...(exclusive ? { exclusive } : {}),
      run: async () => {
        const start = Date.now();
        await sleep(ms);
        spans.push({ name, start, end: Date.now() });
        return name;
      },
    });
    const tasks = [
      tracked('basket-a', 30, 'lab-basket'),
      tracked('basket-b', 30, 'lab-basket'),
      tracked('other', 30, 'other-key'),
      tracked('plain', 30),
    ];
    await runPhaseTasks(tasks, { concurrency: 4 });
    assert.equal(spans.length, 4, 'every task must run exactly once');
    const a = spans.find((s) => s.name === 'basket-a');
    const b = spans.find((s) => s.name === 'basket-b');
    assert.ok(b.start >= a.end, `same-key tasks overlapped: a [${a.start},${a.end}] b [${b.start},${b.end}]`);
    // The pool still overlaps work across keys: at least one
    // different-key task ran while a same-key task was running.
    const overlaps = (x, y) => x.start < y.end && y.start < x.end;
    const other = spans.find((s) => s.name === 'other');
    const plain = spans.find((s) => s.name === 'plain');
    assert.ok(
      overlaps(other, a) || overlaps(plain, a),
      'different-key tasks must still run concurrently with the exclusive group'
    );
  });

  it('exclusive tasks still settle in task order', async () => {
    const tasks = [
      { name: 'a', exclusive: 'k', run: async () => { await sleep(30); return 'a'; } },
      { name: 'b', exclusive: 'k', run: async () => 'b' },
      { name: 'c', run: async () => 'c' },
    ];
    const seen = [];
    const outcomes = await runPhaseTasks(tasks, { concurrency: 3, onSettled: (o) => seen.push(o.name) });
    assert.deepEqual(seen, ['a', 'b', 'c']);
    assert.deepEqual(outcomes.map((o) => o.name), ['a', 'b', 'c']);
    assert.ok(outcomes.every((o) => o.ok));
  });

  it('a throwing exclusive task releases the key for the next holder', async () => {
    let bRan = false;
    const tasks = [
      { name: 'a', exclusive: 'k', run: async () => { throw new Error('boom'); } },
      { name: 'b', exclusive: 'k', run: async () => { bRan = true; return 'b'; } },
    ];
    const outcomes = await runPhaseTasks(tasks, { concurrency: 2 });
    assert.equal(bRan, true, 'the next holder must run after a throwing holder releases the key');
    assert.equal(outcomes[0].ok, false);
    assert.match(outcomes[0].error, /boom/);
    assert.equal(outcomes[1].ok, true);
    assert.equal(outcomes[1].value, 'b');
  });

  it('a timed-out exclusive task releases the key for the next holder', async () => {
    let bRan = false;
    const tasks = [
      { name: 'hung', exclusive: 'k', run: () => new Promise(() => {}) },
      { name: 'b', exclusive: 'k', run: async () => { bRan = true; return 'b'; } },
    ];
    const started = Date.now();
    const outcomes = await runPhaseTasks(tasks, { concurrency: 2, timeoutMs: 50 });
    assert.ok(Date.now() - started < 2000, 'the pool must not wait on the hung task');
    assert.equal(bRan, true, 'the next holder must run after a timed-out holder releases the key');
    assert.equal(outcomes[0].ok, false);
    assert.match(outcomes[0].error, /timeout/);
    assert.equal(outcomes[1].ok, true);
    assert.equal(outcomes[1].value, 'b');
  });

  it('an empty exclusive key behaves like no key (no serialisation)', async () => {
    let peak = 0;
    let active = 0;
    const tasks = [0, 1].map((i) => ({
      name: `t${i}`,
      exclusive: '',
      run: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await sleep(20);
        active -= 1;
        return i;
      },
    }));
    await runPhaseTasks(tasks, { concurrency: 2 });
    assert.equal(peak, 2, 'empty-key tasks must overlap like unkeyed tasks');
  });
});

describe('resolvePhaseConcurrency', () => {
  it('defaults to 5, clamps to 1..16, ignores non-numeric input', () => {
    assert.equal(resolvePhaseConcurrency({}), DEFAULT_PHASE_CONCURRENCY);
    assert.equal(DEFAULT_PHASE_CONCURRENCY, 5);
    assert.equal(resolvePhaseConcurrency({ phaseConcurrency: 0 }), 1);
    assert.equal(resolvePhaseConcurrency({ phaseConcurrency: 99 }), 16);
    assert.equal(resolvePhaseConcurrency({ phaseConcurrency: 3 }), 3);
    assert.equal(resolvePhaseConcurrency({ phaseConcurrency: 'abc' }), 5);
    assert.equal(resolvePhaseConcurrency({ phaseConcurrency: '7' }), 7);
  });

  it('reads the env var when opts carry no value, opts win over env', () => {
    const prev = process.env.DM_SCANNER_PHASE_CONCURRENCY;
    try {
      process.env.DM_SCANNER_PHASE_CONCURRENCY = '4';
      assert.equal(resolvePhaseConcurrency({}), 4);
      assert.equal(resolvePhaseConcurrency({ phaseConcurrency: 2 }), 2);
      process.env.DM_SCANNER_PHASE_CONCURRENCY = 'not-a-number';
      assert.equal(resolvePhaseConcurrency({}), 5);
    } finally {
      if (prev === undefined) delete process.env.DM_SCANNER_PHASE_CONCURRENCY;
      else process.env.DM_SCANNER_PHASE_CONCURRENCY = prev;
    }
  });
});

// ---- runScan-level equivalence ------------------------------------------
// Same scan, stub fetch, phaseConcurrency 1 vs 5: identical confirmed
// titles and identical phase-name order. The probe phases in the list
// (headers/cors/cookies/host-header) run through the pool; the setup
// phases stay sequential in both runs.
const PAGE_HTML = `<html><head><title>t</title></head><body>
<a href="/a">a</a>
<form action="/s" method="get"><input name="q"></form>
</body></html>`;

const realFetch = globalThis.fetch;

describe('runScan parallel equivalence', () => {
  it('phaseConcurrency 1 vs 5 gives identical confirmed titles and phase order', async () => {
    const phases = ['fingerprint', 'crawl', 'page-analyze', 'headers', 'cors', 'cookies', 'host-header'];
    const run = async (phaseConcurrency) => {
      globalThis.fetch = async () => ({
        status: 200,
        headers: new Headers({ server: 'nginx/1.24' }),
        text: async () => PAGE_HTML,
      });
      try {
        return await runScan(
          {
            target: 'http://example.com/',
            confirmedAuthorized: true,
            phases,
          },
          { timeoutMs: 5000, phaseConcurrency }
        );
      } finally {
        globalThis.fetch = realFetch;
      }
    };
    const seq = await run(1);
    const par = await run(5);
    assert.deepEqual(
      par.phases.map((p) => p.name),
      seq.phases.map((p) => p.name)
    );
    assert.deepEqual(
      par.phases.map((p) => p.name),
      phases
    );
    assert.deepEqual(
      (par.confirmed || []).map((f) => f.title),
      (seq.confirmed || []).map((f) => f.title)
    );
    assert.deepEqual(par.errors, seq.errors);
    // Every phase recorded ok with a real record (the pool did not
    // swallow a phase into errors[] alone).
    for (const p of par.phases) {
      assert.equal(typeof p.name, 'string');
      assert.equal(typeof p.ok, 'boolean');
      assert.ok(p.error === null || typeof p.error === 'string');
    }
  });
});
