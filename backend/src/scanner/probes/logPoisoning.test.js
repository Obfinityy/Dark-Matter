// Log-poisoning-to-RCE probe tests (14 Nov 2026, coverage row #337 [Critical]).
//
// The scanner had NO log-poison concept anywhere (batch-6 re-proof: the
// only "log-poison" hit is a prose mention in csvLogInjection.js:214 —
// "log-poisoning chains" as an impact phrase, not a probe;
// sensitiveDataInLogs.js only READS served log files, never writes or
// includes one). This probe is the two-step leg the row-#337 oracle
// specifies:
//
//   Step 1 (discovery): send a benign canary (dmprobe-benign-<rand>)
//     in a field that lands in a server log (User-Agent, Referer as a
//     fallback) and include each candidate log path through each
//     LFI-looking parameter (file/page/path/include/view). The first
//     (param, log path) pair whose included output contains the benign
//     canary proves the log is writable AND includable.
//   Step 2 (execution): inject PHP code
//     (<?php echo "dmprobe-<rand>-exec";?>) through the same field,
//     include the same log path, and confirm ONLY when the executed
//     marker appears AND the raw PHP payload does NOT — execution,
//     not reflection. A merely reflected payload (raw or HTML-escaped)
//     is never a finding.
//
// Lab-gated: the probe writes attacker content into server logs, so it
// returns [] without a single request on a non-lab host
// (isLabTargetHost, labCreds.js — same gate as rfi/xslt). One confirmed
// finding per scan: the first working (param, log path) pair wins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { probeLogPoisoning } from './logPoisoning.js';

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const LAB_HOST = '172.17.0.1';
const LAB_URL = `http://${LAB_HOST}:3100/view.php?page=home`;
const NONLAB_URL = 'https://example.com/view.php?page=home';
const LOG_PATHS = [
  '/var/log/apache2/access.log',
  '/var/log/apache2/error.log',
  '/var/log/nginx/access.log',
  '/var/log/nginx/error.log',
  '/var/log/httpd/access_log',
  '/var/log/httpd/error_log',
];

// Mock lab app: an in-memory access log. Normal requests append a log
// line carrying the User-Agent and Referer headers. Including a log path
// through ?page= (or ?file=) returns the log — how it returns it depends
// on the mode:
//   vulnerable: PHP in the log EXECUTES — a line carrying
//     <?php echo "dmprobe-X-exec";?> comes back as dmprobe-X-exec
//     (the raw payload is gone); every other line comes back raw.
//   reflected: the log comes back raw — the exec payload is visible
//     unexecuted, so the oracle must stay silent.
//   escaped: the log comes back HTML-escaped — the exec payload is
//     visible as &lt;?php ..., so the oracle must stay silent.
//   no-lfi: including a log path 404s — there is no LFI sink.
//   no-log: requests are served but nothing is logged — the canary
//     can never appear in an include.
//   referer-only: the log records Referer but not User-Agent — the
//     User-Agent discovery leg finds nothing and the Referer retry
//     must be the one that confirms.
//   second-path: only the 2nd log path (error.log) is includable —
//     the first path 404s, so the path loop must keep going.
function makeLabFetch(mode) {
  const log = [];
  let calls = 0;
  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const includeBody = (path) => {
    if (mode === 'no-lfi') return null;
    if (mode === 'second-path' && path !== LOG_PATHS[1]) return null;
    if (mode === 'escaped') return log.map(esc).join('\n');
    if (mode === 'reflected' || mode === 'no-log') return log.join('\n');
    // 'vulnerable', 'referer-only' and 'second-path' all EXECUTE the
    // PHP in the log: a line carrying <?php echo "dmprobe-X-exec";?>
    // comes back as dmprobe-X-exec (the raw payload is gone); every
    // other line comes back raw.
    return log
      .map((line) => line.replace(/<\?php echo "([^"]+)";\?>/g, '$1'))
      .join('\n');
  };
  const fetchMock = async (url, options = {}) => {
    calls += 1;
    const u = new URL(String(url));
    const headers = options.headers || {};
    const ua = headers['User-Agent'] || headers['user-agent'] || '';
    const referer = headers.Referer || headers.referer || '';
    const incParam = ['page', 'file', 'path', 'include', 'view'].find((p) => u.searchParams.has(p));
    const incValue = incParam ? u.searchParams.get(incParam) : null;
    if (incValue && LOG_PATHS.includes(incValue)) {
      const body = includeBody(incValue);
      if (body === null) return { status: 404, text: async () => 'not found' };
      return { status: 200, text: async () => body };
    }
    if (mode !== 'no-log') {
      const uaPart = mode === 'referer-only' ? '' : ` UA="${ua}"`;
      log.push(`[14/Nov/2026] "GET ${u.pathname}" 200${uaPart} Referer="${referer}"`);
    }
    return { status: 200, text: async () => '<html><body>view page</body></html>' };
  };
  fetchMock.calls = () => calls;
  fetchMock.log = () => [...log];
  return fetchMock;
}

test('LP-1: non-lab target — lab gate returns [] and sends nothing', async () => {
  const fetchMock = makeLabFetch('vulnerable');
  globalThis.fetch = fetchMock;
  const findings = await probeLogPoisoning(NONLAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 0);
  assert.equal(fetchMock.calls(), 0, 'a non-lab target must never receive a poison request');
});

test('LP-2: lab target, no LFI-looking params — no finding, no requests', async () => {
  const fetchMock = makeLabFetch('vulnerable');
  globalThis.fetch = fetchMock;
  const findings = await probeLogPoisoning(LAB_URL, ['q', 'search'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 0);
  assert.equal(fetchMock.calls(), 0, 'without an LFI sink param there is nothing to include through');
});

test('LP-3: vulnerable lab — benign canary discovers the pair, PHP executes, one critical finding', async () => {
  globalThis.fetch = makeLabFetch('vulnerable');
  const findings = await probeLogPoisoning(LAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'log_poisoning');
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].param, 'page');
  assert.equal(findings[0].evidence.logPath, '/var/log/apache2/access.log');
  assert.equal(findings[0].evidence.field, 'user-agent');
  assert.equal(findings[0].evidence.executed, true);
  assert.equal(findings[0].evidence.signalCorrelated, true);
  assert.equal(findings[0].evidence.diverged, true);
  assert.match(findings[0].title, /Log poisoning/);
  assert.match(findings[0].evidence.response, /executed marker/);
});

test('LP-4: log only reflects the payload (never executes) — no finding', async () => {
  globalThis.fetch = makeLabFetch('reflected');
  const findings = await probeLogPoisoning(LAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 0, 'bare log reflection is never confirmation; execution is');
});

test('LP-5: log reflects the payload HTML-escaped — no finding', async () => {
  globalThis.fetch = makeLabFetch('escaped');
  const findings = await probeLogPoisoning(LAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 0, 'an escaped payload did not execute');
});

test('LP-6: no LFI sink — log path never includes, no finding', async () => {
  globalThis.fetch = makeLabFetch('no-lfi');
  const findings = await probeLogPoisoning(LAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 0);
});

test('LP-7: nothing lands in the log — discovery canary never appears, no finding', async () => {
  globalThis.fetch = makeLabFetch('no-log');
  const findings = await probeLogPoisoning(LAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 0);
});

test('LP-8: lab logs Referer but not User-Agent — Referer fallback discovers and confirms', async () => {
  globalThis.fetch = makeLabFetch('referer-only');
  const findings = await probeLogPoisoning(LAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'log_poisoning');
  assert.equal(findings[0].evidence.field, 'referer');
  assert.equal(findings[0].evidence.executed, true);
});

test('LP-9: first log path not includable — the path loop keeps going to the working one', async () => {
  globalThis.fetch = makeLabFetch('second-path');
  const findings = await probeLogPoisoning(LAB_URL, ['page'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].evidence.logPath, '/var/log/apache2/error.log');
});

test('LP-10: two vulnerable LFI params — one finding (first working pair wins)', async () => {
  globalThis.fetch = makeLabFetch('vulnerable');
  const findings = await probeLogPoisoning(LAB_URL, ['page', 'file'], { labTargets: LAB_HOST });
  assert.equal(findings.length, 1, 'one finding per scan; the first confirmed pair stops the probe');
});
