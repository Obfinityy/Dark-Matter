// Union-based SQLi probe tests (coverage row #277 [Critical], CWE-89).
//
// Test-first: these tests were written before sqliUnion.js existed and
// watched fail (missing module), then pass after implementation.
//
// Oracle (batch 4 fix plan): discover the column count (ORDER BY n
// differential), then confirm ONLY when a UNION SELECT returns
// attacker-chosen data (a numeric canary) in the response where the
// benign query did not, with a control UNION carrying a DIFFERENT
// canary proving the channel is live and the probe canary is not stale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeSqliUnion, isUnionConfirmed } from './sqliUnion.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const TARGET = 'http://172.17.0.1:3000/rest/products/search?q=1';
const LAB_TARGETS = 'http://172.17.0.1:3000';
const NORMAL_PAGE = '<html><body><h1>Products</h1><p>row 1</p></body></html>';
const MYSQL_ERROR =
  "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1";

// Mock vulnerable app: ORDER BY n errors past `columns`; a UNION SELECT
// echoes the numeric canary found in the injected value back into the page.
function makeFetch({ columns = 3, reflectCanary = true, staleControl = false } = {}) {
  let firstCanary = null;
  let unionCalls = 0;
  return async (url) => {
    const value = new URL(String(url)).searchParams.get('q') || '';
    const orderBy = value.match(/ORDER BY (\d+)/i);
    if (orderBy) {
      const n = Number(orderBy[1]);
      if (n > columns) return { status: 200, text: async () => MYSQL_ERROR };
      return { status: 200, text: async () => NORMAL_PAGE };
    }
    if (/UNION SELECT/i.test(value)) {
      unionCalls += 1;
      if (!reflectCanary) return { status: 200, text: async () => NORMAL_PAGE };
      const m = value.match(/1337\d{4}/);
      const canary = m ? m[0] : '';
      // Stale-control variant: every UNION after the first echoes the
      // FIRST canary seen, so the control returns the probe canary.
      if (staleControl && unionCalls > 1 && firstCanary) {
        return { status: 200, text: async () => `<html><body>${firstCanary}</body></html>` };
      }
      if (unionCalls === 1) firstCanary = canary;
      return { status: 200, text: async () => `<html><body>id name ${canary}</body></html>` };
    }
    return { status: 200, text: async () => NORMAL_PAGE };
  };
}

test('U-0: the pure oracle decides all four differential cases', () => {
  const base = { benign: NORMAL_PAGE, canary: '13371234', controlCanary: '13375678' };
  assert.equal(
    isUnionConfirmed({ ...base, probeBody: '<html>13371234</html>', controlBody: '<html>13375678</html>' }),
    true
  );
  // Canary present on the benign input too — the differential is broken.
  assert.equal(
    isUnionConfirmed({ ...base, benign: '<html>13371234</html>', probeBody: '<html>13371234</html>', controlBody: '<html>13375678</html>' }),
    false
  );
  // Probe UNION does not return the canary.
  assert.equal(
    isUnionConfirmed({ ...base, probeBody: NORMAL_PAGE, controlBody: '<html>13375678</html>' }),
    false
  );
  // Control UNION returns the PROBE canary — stale/static page, not a channel.
  assert.equal(
    isUnionConfirmed({ ...base, probeBody: '<html>13371234</html>', controlBody: '<html>13371234</html>' }),
    false
  );
  // Control UNION returns nothing of its own — the channel is not proven live.
  assert.equal(
    isUnionConfirmed({ ...base, probeBody: '<html>13371234</html>', controlBody: NORMAL_PAGE }),
    false
  );
});

test('U-1: vulnerable 3-column app — one critical finding, columnCount 3', async () => {
  globalThis.fetch = makeFetch({ columns: 3 });
  const findings = await probeSqliUnion(TARGET, ['q'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'sqli_union');
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].evidence.columnCount, 3);
  assert.equal(findings[0].evidence.unionConfirmed, true);
  assert.equal(findings[0].evidence.signalCorrelated, true);
  assert.match(findings[0].title, /Union-based SQL injection in parameter 'q'/);
});

test('U-2: UNION returns no canary — no finding', async () => {
  globalThis.fetch = makeFetch({ columns: 3, reflectCanary: false });
  const findings = await probeSqliUnion(TARGET, ['q'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0);
});

test('U-3: ORDER BY 1 already errors — not injectable, no finding', async () => {
  globalThis.fetch = makeFetch({ columns: 0 });
  const findings = await probeSqliUnion(TARGET, ['q'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0);
});

test('U-4: non-lab target — lab gate fires, zero requests sent', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { status: 200, text: async () => NORMAL_PAGE };
  };
  const findings = await probeSqliUnion('http://example.com/?q=1', ['q'], {});
  assert.equal(findings.length, 0);
  assert.equal(calls, 0, 'a non-lab target must receive no UNION payload at all');
});

test('U-5: control UNION echoes the probe canary (stale page) — no finding', async () => {
  globalThis.fetch = makeFetch({ columns: 3, staleControl: true });
  const findings = await probeSqliUnion(TARGET, ['q'], { labTargets: LAB_TARGETS });
  assert.equal(findings.length, 0, 'a stale control means the channel is not proven');
});

test('U-6: oracle dialect appends FROM DUAL and still confirms', async () => {
  let sawDual = false;
  globalThis.fetch = async (url) => {
    const value = new URL(String(url)).searchParams.get('q') || '';
    if (/FROM DUAL/i.test(value)) sawDual = true;
    return makeFetch({ columns: 2 })(url);
  };
  const findings = await probeSqliUnion(TARGET, ['q'], { labTargets: LAB_TARGETS, dbHint: 'oracle' });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].dbFamily, 'oracle');
  assert.equal(sawDual, true, 'oracle SELECTs need FROM DUAL');
});
