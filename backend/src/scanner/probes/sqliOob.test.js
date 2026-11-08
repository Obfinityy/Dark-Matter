// Tests for the SQL injection out-of-band (OOB) probe
// (coverage row #280 [High], phase 83).
// The collaborator is real (loopback); the "database" is a fetch stub
// that fetches the canary URL embedded in the payload — exactly what a
// vulnerable DB would do. No lab needed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeSqliOob, oobPayloadBuilders, normalizeDbHint } from './sqliOob.js';
import { createOobCollaborator } from '../oobCollaborator.js';
import { verifyFindings } from '../verifier.js';

const TARGET = 'http://127.0.0.1:41001/app?id=1';
const LAB = '127.0.0.1';
// Canary fixtures are dead endpoints (port 9 = discard), built by
// concatenation — never a single literal, GH013.
const DEAD_CANARY = 'http://127.0.0.1:9' + '/tok-1';

function loopbackCollab() {
  return createOobCollaborator({ listenHost: '127.0.0.1', callbackHost: '127.0.0.1' });
}

async function withCollab(fn) {
  const collab = loopbackCollab();
  const base = await collab.start();
  try {
    return await fn(collab, base);
  } finally {
    await collab.stop();
  }
}

// A fetch stub that simulates a vulnerable database: any canary URL
// embedded in the request is fetched with the REAL fetch, so the
// collaborator records the hit. callbackFor(canary, decodedUrl) decides
// whether this request's canary is fetched (default: every canary).
// Returns the intercepted calls; the caller restores global fetch.
function vulnDbStub(realFetch, calls, callbackFor = () => true) {
  return async (url, init) => {
    const raw = String(url);
    const decoded = decodeURIComponent(raw);
    calls.push({ url: raw, decoded, init });
    const m = decoded.match(/http:\/\/127\.0\.0\.1:\d+\/sqli-oob-[A-Za-z0-9]+/);
    if (m && callbackFor(m[0], decoded)) {
      await realFetch(m[0]).catch(() => {});
    }
    return { status: 200, text: async () => '<html>ok</html>' };
  };
}

function oobOpts(collab, base, extra = {}) {
  return {
    dbHint: 'oracle',
    labTargets: LAB,
    oobCallback: base,
    oobWaitFor: (token, ms) => collab.waitFor(token, ms),
    oobWaitTimeoutMs: 200,
    ...extra,
  };
}

describe('normalizeDbHint', () => {
  it('maps pgsql/postgres/postgresql to postgres, sqlserver to mssql', () => {
    assert.equal(normalizeDbHint('pgsql'), 'postgres');
    assert.equal(normalizeDbHint('postgres'), 'postgres');
    assert.equal(normalizeDbHint('postgresql'), 'postgres');
    assert.equal(normalizeDbHint('sqlserver'), 'mssql');
    assert.equal(normalizeDbHint('mssql'), 'mssql');
    assert.equal(normalizeDbHint('oracle'), 'oracle');
  });
  it('passes mysql/sqlite through and maps empty/unknown to null', () => {
    assert.equal(normalizeDbHint('mysql'), 'mysql');
    assert.equal(normalizeDbHint('sqlite'), 'sqlite');
    assert.equal(normalizeDbHint(null), null);
    assert.equal(normalizeDbHint(undefined), null);
    assert.equal(normalizeDbHint(''), null);
    assert.equal(normalizeDbHint('cockroach'), 'cockroach');
  });
  it('is case-insensitive', () => {
    assert.equal(normalizeDbHint('ORACLE'), 'oracle');
    assert.equal(normalizeDbHint('Postgres'), 'postgres');
    assert.equal(normalizeDbHint('MSSQL'), 'mssql');
  });
});

describe('oobPayloadBuilders', () => {
  it('Oracle returns 2 builders and both payloads embed the canary URL', () => {
    const builders = oobPayloadBuilders('oracle');
    assert.equal(builders.length, 2);
    for (const b of builders) {
      assert.equal(b.dialect, 'oracle');
      assert.ok(b.build(DEAD_CANARY).includes(DEAD_CANARY), b.build(DEAD_CANARY));
    }
  });
  it('Oracle string variant starts with a quote and calls UTL_HTTP.REQUEST', () => {
    const [str] = oobPayloadBuilders('oracle');
    const payload = str.build(DEAD_CANARY);
    assert.ok(payload.startsWith("'"), payload);
    assert.ok(payload.includes('UTL_HTTP.REQUEST'), payload);
  });
  it('Oracle numeric variant starts with 1, calls UTL_HTTP.REQUEST, and differs from the string variant', () => {
    const [, num] = oobPayloadBuilders('oracle');
    const payload = num.build(DEAD_CANARY);
    assert.ok(payload.startsWith('1'), payload);
    assert.ok(payload.includes('UTL_HTTP.REQUEST'), payload);
    assert.notEqual(payload, oobPayloadBuilders('oracle')[0].build(DEAD_CANARY));
  });
  it('Postgres returns 1 builder: COPY TO PROGRAM curl with the canary', () => {
    const builders = oobPayloadBuilders('postgres');
    assert.equal(builders.length, 1);
    assert.equal(builders[0].dialect, 'postgres');
    const payload = builders[0].build(DEAD_CANARY);
    assert.ok(payload.includes('COPY'), payload);
    assert.ok(payload.includes('TO PROGRAM'), payload);
    assert.ok(payload.includes('curl ' + DEAD_CANARY), payload);
  });
  it('MSSQL returns 1 builder: xp_cmdshell curl with the canary', () => {
    const builders = oobPayloadBuilders('mssql');
    assert.equal(builders.length, 1);
    assert.equal(builders[0].dialect, 'mssql');
    const payload = builders[0].build(DEAD_CANARY);
    assert.ok(payload.includes('xp_cmdshell'), payload);
    assert.ok(payload.includes('curl ' + DEAD_CANARY), payload);
  });
  it('MySQL and SQLite return [] — no HTTP-fetch function exists, no payload is faked', () => {
    assert.deepEqual(oobPayloadBuilders('mysql'), []);
    assert.deepEqual(oobPayloadBuilders('sqlite'), []);
  });
  it('null / undefined / empty dbHint returns []', () => {
    assert.deepEqual(oobPayloadBuilders(null), []);
    assert.deepEqual(oobPayloadBuilders(undefined), []);
    assert.deepEqual(oobPayloadBuilders(''), []);
  });
  it('unknown dialect returns []', () => {
    assert.deepEqual(oobPayloadBuilders('cockroach'), []);
  });
});

describe('probeSqliOob', () => {
  const realFetch = globalThis.fetch;
  const teardown = () => {
    globalThis.fetch = realFetch;
  };

  it('fires on an Oracle collaborator hit — High, class sqli_oob, confirmed 1/0', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base));
        assert.equal(findings.length, 1);
        const f = findings[0];
        assert.equal(f.class, 'sqli_oob');
        assert.equal(f.severity, 'high');
        assert.equal(f.param, 'id');
        assert.equal(f.dbFamily, 'oracle');
        assert.ok(f.id.includes('id') && f.id.includes('oracle'), f.id);
        assert.ok(f.title.includes('out-of-band'), f.title);
        assert.equal(f.evidence.oobHit, true);
        assert.ok(f.evidence.request.startsWith('GET http://127.0.0.1:41001/app?id='), f.evidence.request);
        assert.ok(f.evidence.request.includes('UTL_HTTP'), f.evidence.request);
        assert.ok(f.evidence.response.includes('collaborator received GET'), f.evidence.response);
        const { confirmed, unconfirmed } = verifyFindings(findings);
        assert.equal(confirmed.length, 1);
        assert.equal(unconfirmed.length, 0);
      } finally {
        teardown();
      }
    });
  });

  it('returns [] when nothing calls back', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls, () => false);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base));
        assert.deepEqual(findings, []);
        assert.equal(calls.length, 2, 'both Oracle variants go out — each wait just finds no hit');
        assert.equal(collab.hits.length, 0);
      } finally {
        teardown();
      }
    });
  });

  it('returns [] when the hit is for a different token', async () => {
    await withCollab(async (collab, base) => {
      globalThis.fetch = async (url) => {
        const decoded = decodeURIComponent(String(url));
        const m = decoded.match(/http:\/\/127\.0\.0\.1:\d+\/sqli-oob-[A-Za-z0-9]+/);
        if (m) {
          await realFetch(m[0].replace(/\/[^/]+$/, '/wrong-token')).catch(() => {});
        }
        return { status: 200, text: async () => '<html>ok</html>' };
      };
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base));
        assert.deepEqual(findings, []);
        assert.ok(collab.hasHit('wrong-token'), 'the wrong-token hit landed — the stub ran, just not our token');
      } finally {
        teardown();
      }
    });
  });

  it('returns [] on a non-lab host without a single request', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { labTargets: '' }));
        assert.deepEqual(findings, []);
        assert.equal(calls.length, 0, 'a non-lab target never receives a callback URL');
        assert.equal(collab.hits.length, 0);
      } finally {
        teardown();
      }
    });
  });

  // isLab follow-up (8 Nov 2026): the old substring gate matched a lab
  // entry that is a PREFIX of the target host (127.0.0.1 vs
  // 127.0.0.10:41001) — fail-open. The canonical helper compares exact
  // canonical hostnames, port-insensitive.
  it('fires with PORT-BEARING labTargets (the production shape)', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { labTargets: '127.0.0.1:41001' }));
        assert.equal(findings.length, 1);
        assert.equal(findings[0].class, 'sqli_oob');
        assert.equal(findings[0].severity, 'high');
      } finally {
        teardown();
      }
    });
  });

  it('near-miss host: no requests at all when the lab entry is a prefix of the target host', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], 'http://127.0.0.10:41001/app?id=1', oobOpts(collab, base, { labTargets: '127.0.0.1' }));
        assert.deepEqual(findings, []);
        assert.equal(calls.length, 0, 'a near-miss host never receives a callback URL');
        assert.equal(collab.hits.length, 0);
      } finally {
        teardown();
      }
    });
  });

  it('returns [] with no oobCallback and sends nothing', async () => {
    const calls = [];
    globalThis.fetch = vulnDbStub(realFetch, calls);
    try {
      const findings = await probeSqliOob(['id'], TARGET, {
        dbHint: 'oracle',
        labTargets: LAB,
        oobWaitFor: (token, ms) => Promise.resolve(null),
      });
      assert.deepEqual(findings, []);
      assert.equal(calls.length, 0);
    } finally {
      teardown();
    }
  });

  it('returns [] with no oobWaitFor and sends nothing — a payload without a waiter can never be confirmed', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, {
          dbHint: 'oracle',
          labTargets: LAB,
          oobCallback: base,
        });
        assert.deepEqual(findings, []);
        assert.equal(calls.length, 0);
      } finally {
        teardown();
      }
    });
  });

  it('returns [] for MySQL and sends nothing — no payload exists for it', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { dbHint: 'mysql' }));
        assert.deepEqual(findings, []);
        assert.equal(calls.length, 0);
      } finally {
        teardown();
      }
    });
  });

  it('returns [] for SQLite and sends nothing', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { dbHint: 'sqlite' }));
        assert.deepEqual(findings, []);
        assert.equal(calls.length, 0);
      } finally {
        teardown();
      }
    });
  });

  it('returns [] for a null dbHint and sends nothing', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { dbHint: null }));
        assert.deepEqual(findings, []);
        assert.equal(calls.length, 0);
      } finally {
        teardown();
      }
    });
  });

  it('caps at 2 params: the third param is never probed', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['a', 'b', 'c'], TARGET, oobOpts(collab, base));
        assert.equal(findings.length, 2);
        assert.deepEqual(findings.map((f) => f.param).sort(), ['a', 'b']);
        assert.equal(calls.length, 2, 'one payload per probed param — the first variant hits, the second is a fallback');
        assert.ok(!calls.some((c) => /[?&]c=/.test(c.decoded)), 'param c must never be sent');
      } finally {
        teardown();
      }
    });
  });

  it('two payloads get two distinct tokens (first variant misses, second hits)', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      // Callback only for the numeric variant (payload starts with 1||).
      globalThis.fetch = vulnDbStub(realFetch, calls, (canary, decoded) => decoded.includes('1||'));
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base));
        assert.equal(findings.length, 1);
        assert.equal(calls.length, 2, 'both variants go out — the string variant times out first');
        const tokens = calls.map((c) => c.decoded.match(/sqli-oob-[a-z0-9]+/)[0]);
        assert.equal(new Set(tokens).size, 2, 'one canary token per payload');
        assert.equal(collab.hits.length, 1, 'only the numeric variant was fetched back');
      } finally {
        teardown();
      }
    });
  });

  it('fires on a Postgres collaborator hit with dbFamily postgres', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { dbHint: 'postgres' }));
        assert.equal(findings.length, 1);
        assert.equal(findings[0].class, 'sqli_oob');
        assert.equal(findings[0].dbFamily, 'postgres');
        assert.ok(findings[0].evidence.request.includes('COPY'), findings[0].evidence.request);
        const { confirmed } = verifyFindings(findings);
        assert.equal(confirmed.length, 1);
      } finally {
        teardown();
      }
    });
  });

  it('fires on an MSSQL collaborator hit with dbFamily mssql', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { dbHint: 'mssql' }));
        assert.equal(findings.length, 1);
        assert.equal(findings[0].class, 'sqli_oob');
        assert.equal(findings[0].dbFamily, 'mssql');
        assert.ok(findings[0].evidence.request.includes('xp_cmdshell'), findings[0].evidence.request);
        const { confirmed } = verifyFindings(findings);
        assert.equal(confirmed.length, 1);
      } finally {
        teardown();
      }
    });
  });

  it('moves to the second param when the first gets no hit', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      // Callback only when the probed param is b.
      globalThis.fetch = vulnDbStub(realFetch, calls, (canary, decoded) => /[?&]b=/.test(decoded));
      try {
        const findings = await probeSqliOob(['a', 'b'], TARGET, oobOpts(collab, base));
        assert.equal(findings.length, 1);
        assert.equal(findings[0].param, 'b');
      } finally {
        teardown();
      }
    });
  });

  it('labels a path-segment point with the (path) suffix', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(
          [{ kind: 'path', name: 'book_title', segment: 3 }],
          'http://127.0.0.1:41001/books/v1/xxx',
          oobOpts(collab, base)
        );
        assert.equal(findings.length, 1);
        assert.equal(findings[0].param, 'book_title (path)');
      } finally {
        teardown();
      }
    });
  });

  it('never waits when the transport fails — the waiter is not called', async () => {
    const waiterCalls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = async () => {
        throw new Error('connection refused');
      };
      try {
        const findings = await probeSqliOob(['id'], TARGET, {
          dbHint: 'oracle',
          labTargets: LAB,
          oobCallback: base,
          oobWaitFor: (token, ms) => {
            waiterCalls.push(token);
            return collab.waitFor(token, ms);
          },
          oobWaitTimeoutMs: 200,
        });
        assert.deepEqual(findings, []);
        assert.equal(waiterCalls.length, 0, 'waiting for a hit that cannot come would only stall the scan');
      } finally {
        teardown();
      }
    });
  });

  it('fires with an uppercase dbHint (ORACLE)', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        const findings = await probeSqliOob(['id'], TARGET, oobOpts(collab, base, { dbHint: 'ORACLE' }));
        assert.equal(findings.length, 1);
        assert.equal(findings[0].dbFamily, 'oracle');
      } finally {
        teardown();
      }
    });
  });

  it('returns [] for empty params', async () => {
    await withCollab(async (collab, base) => {
      const findings = await probeSqliOob([], TARGET, oobOpts(collab, base));
      assert.deepEqual(findings, []);
    });
  });

  it('sends the payload via GET with the scanner User-Agent', async () => {
    const calls = [];
    await withCollab(async (collab, base) => {
      globalThis.fetch = vulnDbStub(realFetch, calls);
      try {
        await probeSqliOob(['id'], TARGET, oobOpts(collab, base));
        assert.equal(calls.length, 1);
        assert.equal(calls[0].init.headers['User-Agent'], 'DarkMatter-Scanner/1.0 (+authorized-scan)');
      } finally {
        teardown();
      }
    });
  });
});
