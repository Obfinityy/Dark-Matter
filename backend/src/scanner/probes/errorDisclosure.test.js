// Tests for the error-disclosure probe
// (coverage rows #175 [Low] + #176 [Medium], phase 70).
// No network, no lab needed — fetches go through the opts.fetchPage seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeErrorDisclosure, buildErrorTriggers } from './errorDisclosure.js';
import { verifyFindings } from '../verifier.js';

const TARGET_PLAIN = 'http://lab.local/login.php';
const TARGET_PARAM = 'http://lab.local/search?q=hello&page=2';
const BASELINE_PLAIN = '<html><body><h1>Login</h1><form></form></body></html>';
const BASELINE_PARAM = '<html><body><h1>Results for hello</h1></body></html>';
const LEAK_PATH = '/var/www/html/includes/db.php';
const LEAK_WIN_PATH = 'C:\\inetpub\\wwwroot\\app\\web.config';
const TRACEBACK =
  'Traceback (most recent call last):\n  File "/app/views.py", line 42, in search\nValueError: bad value';

// fetchPage seam: map URL -> { status, body }. Unknown URLs 404.
function fetchPageFor(bodies) {
  return async (url) => {
    const entry = bodies[String(url)];
    if (entry === undefined) return { status: 404, body: 'Not Found' };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

describe('buildErrorTriggers', () => {
  it('a param target gets a malformed-query trigger on its first param', () => {
    const t = buildErrorTriggers([TARGET_PARAM]);
    assert.equal(t.length, 2); // malformed-query + the extra nonexistent-path trigger
    assert.equal(t[0].kind, 'malformed-query');
    assert.equal(t[0].parameter, 'q');
    assert.equal(t[0].baselineUrl, TARGET_PARAM);
    const u = new URL(t[0].url);
    assert.equal(u.searchParams.get('page'), '2');
    assert.ok(u.searchParams.get('q').includes('AAAA'));
    assert.notEqual(u.searchParams.get('q'), 'hello');
    assert.equal(t[1].kind, 'nonexistent-path');
  });

  it('a plain target gets a non-existent-path trigger under its directory', () => {
    const t = buildErrorTriggers([TARGET_PLAIN]);
    assert.equal(t.length, 1);
    assert.equal(t[0].kind, 'nonexistent-path');
    assert.equal(t[0].baselineUrl, TARGET_PLAIN);
    assert.equal(t[0].url, 'http://lab.local/dm-nonexistent-9f27a1c4.html');
    assert.equal(t[0].parameter, null);
  });

  it('a nested plain target nests the non-existent leaf under its directory', () => {
    const t = buildErrorTriggers(['http://lab.local/admin/users']);
    assert.equal(t[0].url, 'http://lab.local/admin/dm-nonexistent-9f27a1c4.html');
  });

  it('every param-bearing target gets a malformed-query trigger — no shared cap (re-proof #3)', () => {
    // The old shared 10-cap cut the 11th+ param target even after the
    // malformed-first reorder (15 param-bearing Juice targets, live).
    // Malformed triggers are per-class uncapped now: 12 param targets
    // yield 12 malformed triggers plus the extra nonexistent-path one.
    const urls = Array.from({ length: 12 }, (_, i) => `http://lab.local/p${i}?a=${i}`);
    const t = buildErrorTriggers(urls);
    assert.equal(t.filter((x) => x.kind === 'malformed-query').length, 12);
    assert.equal(t.length, 13);
    for (const u of urls) {
      assert.ok(
        t.some((x) => x.kind === 'malformed-query' && x.baselineUrl === u),
        `param target ${u} must keep its malformed trigger`
      );
    }
  });

  it('two targets in one directory share one non-existent-path trigger', () => {
    const t = buildErrorTriggers([TARGET_PLAIN, 'http://lab.local/other.php']);
    assert.equal(t.length, 1);
    assert.equal(t[0].kind, 'nonexistent-path');
  });

  it('no targets yields no triggers', () => {
    assert.deepEqual(buildErrorTriggers([]), []);
    assert.deepEqual(buildErrorTriggers(null), []);
  });

  it('a malformed URL is skipped, the rest still trigger', () => {
    const t = buildErrorTriggers(['not a url', TARGET_PLAIN]);
    assert.equal(t.length, 1);
    assert.equal(t[0].kind, 'nonexistent-path');
  });

  it('malformed-query triggers sort before nonexistent-path triggers', () => {
    const t = buildErrorTriggers([
      'http://lab.local/a/page',
      'http://lab.local/search?q=x',
      'http://lab.local/b/page',
    ]);
    assert.deepEqual(
      t.map((x) => x.kind),
      ['malformed-query', 'nonexistent-path', 'nonexistent-path']
    );
  });

  it('a param-bearing target past position 10 still gets a malformed trigger when param-less targets sort ahead (re-proof #2)', () => {
    // Live shape (8 Nov 2026): the miner promotes param-less
    // login/check routes ahead of /rest/products/search?q=, so a
    // single in-order pass spent the 10-trigger cap before reaching
    // it and the SQLite leak vanished. Malformed triggers are built
    // first now, so the param class can never be starved by the sort.
    const plain = Array.from({ length: 12 }, (_, i) => `http://lab.local/dir${i}/page`);
    const search = 'http://lab.local/rest/products/search?q=hello';
    const t = buildErrorTriggers([...plain, search]);
    assert.equal(t.length, 11, '1 malformed + 10 nonexistent (per-class caps)');
    const malformed = t.find((x) => x.kind === 'malformed-query' && x.baselineUrl === search);
    assert.ok(malformed, `the late param target must keep its malformed trigger; kinds: ${t.map((x) => x.kind).join(',')}`);
    assert.equal(malformed.parameter, 'q');
    assert.ok(t.some((x) => x.kind === 'nonexistent-path'), 'the nonexistent-path shape is still exercised');
  });

  it('a param-bearing target past position 10 still gets a malformed trigger when 11+ param targets precede it (re-proof #3)', () => {
    // Test-gap fix (8 Nov 2026): the old cap test asserted COUNT only
    // (12 param targets -> 10 triggers) and the re-proof #2 test was
    // 12 plain + 1 param — no test ever covered a NAMED late param
    // target among 11+ param-bearing targets. Live shape: Juice has
    // 15 param-bearing verb targets; /rest/products/search?q= sits
    // past position 10 when standalone/DOM targets precede it, and
    // the shared cap dropped its malformed trigger — the SQLite leak
    // vanished. Every param target must keep its trigger now.
    const before = Array.from({ length: 10 }, (_, i) => `http://lab.local/api/r${i}?e=${i}`);
    const search = 'http://lab.local/rest/products/search?q=hello';
    const after = Array.from({ length: 4 }, (_, i) => `http://lab.local/api/s${i}?e=${i}`);
    const t = buildErrorTriggers([...before, search, ...after]);
    const malformed = t.filter((x) => x.kind === 'malformed-query');
    assert.equal(malformed.length, 15, 'one malformed trigger per param-bearing target');
    const hit = t.find((x) => x.kind === 'malformed-query' && x.baselineUrl === search);
    assert.ok(hit, `the 11th param target must keep its malformed trigger; kinds: ${t.map((x) => x.kind).join(',')}`);
    assert.equal(hit.parameter, 'q');
    assert.ok(t.some((x) => x.kind === 'nonexistent-path'), 'the nonexistent-path shape is still exercised');
  });
});

describe('errorDisclosure probe — path disclosure (#175)', () => {
  it('a Unix path in a 404 response, absent from the baseline, is a Low finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 404,
          body: `<html><body>Not Found: ${LEAK_PATH} on line 42</body></html>`,
        },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'path_disclosure');
    assert.equal(f.severity, 'low');
    assert.ok(f.title.includes('Full path disclosure'));
    assert.equal(f.url, trigger);
    assert.ok(f.evidence.request.includes(trigger));
    assert.ok(f.evidence.response.includes('404'));
    assert.ok(f.evidence.response.includes(LEAK_PATH));
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('a Windows path in a 500 response is a Low finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 500,
          body: `Server Error in application ${LEAK_WIN_PATH} failed to load`,
        },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'path_disclosure');
    assert.equal(findings[0].severity, 'low');
    assert.ok(findings[0].evidence.response.includes('web.config'));
  });

  it('the same path in the baseline is NOT a finding (differential)', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 404,
          body: `<html><body>Not Found: ${LEAK_PATH} on line 42</body></html>`,
        },
        [TARGET_PLAIN]: {
          status: 200,
          body: `<html><body>Source: ${LEAK_PATH} (docs)</body></html>`,
        },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a URL path without a file extension is not a path leak', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 404,
          body: '<html><body>The requested URL /api/users/123 was not found on this server.</body></html>',
        },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    assert.deepEqual(findings, []);
  });
});

describe('errorDisclosure probe — error details (#176)', () => {
  it('a Python traceback in a 500 response is a Medium finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PARAM])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PARAM], {
      fetchPage: fetchPageFor({
        [trigger]: { status: 500, body: `<html><pre>${TRACEBACK}</pre></html>` },
        [TARGET_PARAM]: { status: 200, body: BASELINE_PARAM },
      }),
    });
    // Two distinct leaks in one body: the traceback itself (Medium)
    // and the /app/views.py path it names (Low).
    assert.equal(findings.length, 2);
    const f = findings.find((x) => x.class === 'error_info_disclosure');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('Python traceback'));
    assert.equal(f.parameter, 'q');
    assert.ok(f.evidence.response.includes('500'));
    assert.ok(f.evidence.response.includes('Traceback'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 2);
  });

  it('a PHP fatal error in a 500 response is a Medium finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 500,
          body: 'Fatal error: Call to undefined function foo() in /srv/app/lib.php on line 7',
        },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    // Two distinct leaks in one body: the /srv/app/lib.php path (Low)
    // and the Fatal error marker (Medium).
    assert.equal(findings.length, 2);
    assert.deepEqual(
      findings.map((f) => f.class).sort(),
      ['error_info_disclosure', 'path_disclosure']
    );
    assert.equal(findings.find((f) => f.class === 'error_info_disclosure').severity, 'medium');
  });

  it('a SQL syntax fragment in a 500 response is a Medium finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PARAM])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PARAM], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 500,
          body: "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''\" at line 1",
        },
        [TARGET_PARAM]: { status: 200, body: BASELINE_PARAM },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'error_info_disclosure');
    assert.ok(findings[0].title.includes('SQL syntax error'));
  });

  it('a SQLITE_ERROR in a 500 response is a Medium finding (Juice Shop shape)', async () => {
    const trigger = buildErrorTriggers([TARGET_PARAM])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PARAM], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 500,
          body: "<html><head><title>Error: SQLITE_ERROR: near \"'\" OR description LIKE '%'\": syntax error</title></head><body><h2>500 Error: SQLITE_ERROR</h2></body></html>",
        },
        [TARGET_PARAM]: { status: 200, body: BASELINE_PARAM },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'error_info_disclosure');
    assert.equal(findings[0].severity, 'medium');
    assert.ok(findings[0].title.includes('SQLite error'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('sqlite3.OperationalError names one leak, not two (containment dedup)', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 500,
          body: '<html><body>sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such table: users</body></html>',
        },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'error_info_disclosure');
    assert.ok(findings[0].title.includes('SQLite error'));
  });

  it('a Werkzeug debugger page in a 500 response is a Medium finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 500,
          body: '<html><head><title>OperationalError // Werkzeug Debugger</title></head><body><h1>OperationalError</h1></body></html>',
        },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    // Two distinct leaks: the OperationalError marker and the
    // Werkzeug debugger marker itself.
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.class === 'error_info_disclosure'));
    assert.ok(findings.some((f) => f.title.includes('Werkzeug debugger')));
  });

  it('a Java stack trace is a Medium finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const body =
      'java.lang.NullPointerException\n' +
      '\tat com.example.web.SearchController.search(SearchController.java:58)\n' +
      '\tat javax.servlet.http.HttpServlet.service(HttpServlet.java:733)';
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: { status: 500, body },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    assert.ok(findings.length >= 1);
    assert.ok(findings.every((f) => f.class === 'error_info_disclosure'));
    assert.ok(findings.every((f) => f.severity === 'medium'));
  });

  it('an error detail already on the baseline page is NOT a finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PARAM])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PARAM], {
      fetchPage: fetchPageFor({
        [trigger]: { status: 500, body: `<html><pre>${TRACEBACK}</pre></html>` },
        [TARGET_PARAM]: {
          status: 200,
          body: `<html><body>Docs example:<pre>${TRACEBACK}</pre></body></html>`,
        },
      }),
    });
    assert.deepEqual(findings, []);
  });
});

describe('errorDisclosure probe — negatives, dedup, failures', () => {
  it('a bare 404 with no leak is not a finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: {
          status: 404,
          body: '<html><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>',
        },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a bare 500 with no leak is not a finding', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: fetchPageFor({
        [trigger]: { status: 500, body: '<html><body><h1>Internal Server Error</h1></body></html>' },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
      }),
    });
    assert.deepEqual(findings, []);
  });

  it('a 200 answer to a bad input is not scanned (soft error page)', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    let baselineFetched = 0;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: async (url) => {
        if (String(url) === TARGET_PLAIN) baselineFetched += 1;
        if (String(url) === trigger) {
          return { status: 200, body: `<html><body>Oops: ${LEAK_PATH}</body></html>` };
        }
        return { status: 200, body: BASELINE_PLAIN };
      },
    });
    assert.deepEqual(findings, []);
    // The baseline is only fetched when a trigger actually errors.
    assert.equal(baselineFetched, 0);
  });

  it('the same path leaked by two targets is one finding (first URL cited)', async () => {
    const other = 'http://lab.local/admin/other.php';
    const triggers = buildErrorTriggers([TARGET_PLAIN, other]);
    const findings = await probeErrorDisclosure([TARGET_PLAIN, other], {
      fetchPage: fetchPageFor({
        [triggers[0].url]: { status: 404, body: `Not Found ${LEAK_PATH}` },
        [triggers[1].url]: { status: 404, body: `Not Found ${LEAK_PATH}` },
        [TARGET_PLAIN]: { status: 200, body: BASELINE_PLAIN },
        [other]: { status: 200, body: '<html><body>other</body></html>' },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, triggers[0].url);
  });

  it('a failing trigger fetch is skipped, the other target still scans', async () => {
    const other = 'http://lab.local/admin/other.php';
    const triggers = buildErrorTriggers([TARGET_PLAIN, other]);
    const findings = await probeErrorDisclosure([TARGET_PLAIN, other], {
      fetchPage: async (url) => {
        if (String(url) === triggers[0].url) throw new Error('reset');
        if (String(url) === triggers[1].url) {
          return { status: 404, body: `Not Found ${LEAK_PATH}` };
        }
        return { status: 200, body: '<html><body>ok</body></html>' };
      },
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, triggers[1].url);
  });

  it('a failing baseline fetch still counts the leak (no baseline to clear it)', async () => {
    const trigger = buildErrorTriggers([TARGET_PLAIN])[0].url;
    const findings = await probeErrorDisclosure([TARGET_PLAIN], {
      fetchPage: async (url) => {
        if (String(url) === trigger) {
          return { status: 404, body: `Not Found ${LEAK_PATH}` };
        }
        throw new Error('baseline down');
      },
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'path_disclosure');
  });

  it('no targets yields no findings and no fetch', async () => {
    let fetched = 0;
    const findings = await probeErrorDisclosure([], {
      fetchPage: async () => {
        fetched += 1;
        return { status: 200, body: '' };
      },
    });
    assert.deepEqual(findings, []);
    assert.equal(fetched, 0);
  });

  it('every param-bearing target sends its malformed trigger for 12 targets (re-proof #3)', async () => {
    const urls = Array.from({ length: 12 }, (_, i) => `http://lab.local/p${i}?a=${i}`);
    let triggerFetches = 0;
    const findings = await probeErrorDisclosure(urls, {
      fetchPage: async (url) => {
        if (String(url).includes('dm-nonexistent') || String(url).includes('AAAA')) {
          triggerFetches += 1;
        }
        return { status: 200, body: '<html><body>ok</body></html>' };
      },
    });
    assert.deepEqual(findings, []);
    // 12 malformed triggers + the extra nonexistent-path trigger.
    assert.equal(triggerFetches, 13);
  });
});
