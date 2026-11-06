// Tests for the prototype pollution probe (#35). Lab-gated.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probePrototypePollution } from './prototypePollution.js';

const LAB = { labTargets: '127.0.0.1', timeoutMs: 8000 };

// Stub server. `store` is the server-side merged state (polluted defaults).
// GET / returns JSON of a FRESH object {...{}, ...store} — polluted defaults,
// never the raw posted body. POST merges per mode. Query GETs merge __proto__
// patterns per mode (query modes only). /admin is the T5 decision page.
function hasProtoKey(obj) {
  // Own-property only: '__proto__' in obj is true for EVERY object via
  // the prototype chain, which would destroy the control POST too.
  if (!obj || typeof obj !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__')) return true;
  return Object.values(obj).some((v) => hasProtoKey(v));
}

function mergeBody(body, mode, store) {
  const mergeProto = (src) => {
    if (!src || typeof src !== 'object') return;
    if (src.__proto__ && typeof src.__proto__ === 'object') {
      for (const [k, v] of Object.entries(src.__proto__)) store[k] = v;
    }
  };
  if (mode !== 'deny-proto') {
    if (mode === 'merge-nested-only') {
      if (body.a) mergeProto(body.a);
    } else {
      mergeProto(body);
      if (body.a) mergeProto(body.a);
    }
  }
  // Benign nested control key (a.b.ctrl_*): a real merge sink flattens it
  // into the store; the probe's control proves it on the follow GET.
  if (body.a && body.a.b && typeof body.a.b === 'object') {
    for (const [k, v] of Object.entries(body.a.b)) store[k] = v;
  }
  if (body.constructor && body.constructor.prototype && typeof body.constructor.prototype === 'object') {
    for (const [k, v] of Object.entries(body.constructor.prototype)) store[k] = v;
  }
}

function startStub(mode) {
  const store = {};
  let adminGets = 0;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const fresh = () => JSON.stringify({ ...{}, ...store });
    if (req.method === 'GET' && u.pathname === '/admin') {
      adminGets += 1;
      if (mode === 'flip') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(adminGets >= 2 ? 'Welcome to the dashboard' : 'Access denied — login required');
        return;
      }
      if (mode === 'fail-first') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(adminGets >= 2 ? 'Welcome to the dashboard' : '');
        return;
      }
      // Allows only once the T5 pollution POST landed (value '1' marker);
      // T1/T2 pollute with 't1'/'t2' and must not flip the decision.
      const polluted = Object.entries(store).some(([k, v]) => k.startsWith('__pp_dm_') && v === '1');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(polluted ? 'Welcome to the dashboard' : 'Access denied — login required');
      return;
    }
    if (req.method === 'GET') {
      if (mode === 'echo-query' || mode === 'echo-all') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(u.search.slice(1));
        return;
      }
      if (mode === 'merge-query' || mode === 'merge-query-nested') {
        for (const [k, v] of u.searchParams.entries()) {
          const top = k.match(/^__proto__\[(.+)\]$/);
          const nested = k.match(/^a\[__proto__\]\[(.+)\]$/);
          if (top && mode === 'merge-query') store[top[1]] = v;
          if (nested) store[nested[1]] = v;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(fresh());
        return;
      }
      if (mode === 'merge-gadget') {
        const key = Object.keys(store).find((k) => k.startsWith('__pp_dm_'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(key ? `<html><img src="/static?k=${key}"></html>` : fresh());
        return;
      }
      if (mode === 'text') {
        const key = Object.keys(store).find((k) => k.startsWith('__pp_dm_'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(key ? `<html><p>key: ${key}</p></html>` : fresh());
        return;
      }
      if (mode === 'echo') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status":"ok"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fresh());
      return;
    }
    // POST
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body = {};
      try { body = JSON.parse(raw); } catch { body = {}; }
      if (mode === 'echo' || mode === 'echo-all') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
        return;
      }
      if (mode === 'proto-reset' && hasProtoKey(body)) {
        req.socket.destroy();
        return;
      }
      if (mode === 'baseline') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }
      mergeBody(body, mode, store);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fresh());
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      port: server.address().port,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

async function runStub(mode, opts = {}) {
  const { server, port, close } = await startStub(mode);
  try {
    return await probePrototypePollution(`http://127.0.0.1:${port}/`, { ...LAB, ...opts });
  } finally {
    await close();
  }
}

describe('prototypePollution probe', () => {
  it('returns [] on non-lab targets (lab gate)', async () => {
    const findings = await probePrototypePollution('http://example.com/', {
      labTargets: 'lab.local',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, [], 'non-lab target must not be probed');
  });

  it('handles unreachable lab host without throwing', async () => {
    const findings = await probePrototypePollution('http://127.0.0.1:1/', {
      labTargets: '127.0.0.1',
      timeoutMs: 2000,
    });
    assert.ok(Array.isArray(findings));
  });

  // ---- T1/T2: echo vs merge ------------------------------------------------
  it('T1 FP-guard: pure echo endpoint stays silent', async () => {
    const findings = await runStub('echo');
    assert.deepEqual(findings, [], 'an echo endpoint merges nothing');
  });

  it('T1 true positive: merge sink fires HIGH with a verbatim window', async () => {
    const findings = await runStub('merge');
    const f = findings.find((x) => x.id.startsWith('pp-proto-'));
    assert.ok(f, `expected T1 HIGH finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
    assert.equal(f.severity, 'high');
    assert.equal(f.parameter, '__proto__');
    assert.ok(f.evidence.response.includes('__pp_dm_'), 'evidence must quote the polluted default verbatim');
  });

  it('T2 denylist-bypass: __proto__ blocked + constructor merges => MEDIUM', async () => {
    const findings = await runStub('deny-proto');
    assert.ok(!findings.some((x) => x.id.startsWith('pp-proto-')), 'T1 must stay silent when __proto__ is blocked');
    const f = findings.find((x) => x.id.startsWith('pp-ctor-'));
    assert.ok(f, `expected T2 finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('denylist bypass'));
    assert.equal(f.parameter, 'constructor.prototype');
  });

  it('T2 bypass-claim guard: inconclusive T1 never yields a bypass title', async () => {
    const findings = await runStub('proto-reset');
    assert.ok(!findings.some((x) => x.title.includes('denylist bypass')), 'no bypass claim without positive blocking proof');
    const f = findings.find((x) => x.id.startsWith('pp-ctor-'));
    assert.ok(f, 'constructor chain must still fire HIGH when it merges');
    assert.equal(f.severity, 'high');
  });

  it('T1/T2 negative: baseline endpoint stays silent', async () => {
    const findings = await runStub('baseline');
    assert.deepEqual(findings, []);
  });

  it('T1 nested-body boundary: nested a.__proto__ merge fires once', async () => {
    const findings = await runStub('merge-nested-only');
    const t1 = findings.filter((x) => x.id.startsWith('pp-proto-'));
    assert.equal(t1.length, 1, 'exactly one T1 finding from the nested body');
  });

  // ---- T3: query oracle ----------------------------------------------------
  it('T3 FP-guard: query-echo page stays silent', async () => {
    const findings = await runStub('echo-query');
    assert.ok(!findings.some((x) => x.id.startsWith('pp-query-')), 'a query echo is not a merge');
  });

  it('T3 true positive: query parser merge fires MEDIUM with a window', async () => {
    const findings = await runStub('merge-query');
    const f = findings.find((x) => x.id.startsWith('pp-query-'));
    assert.ok(f, `expected T3 MEDIUM finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
    assert.equal(f.severity, 'medium');
    assert.equal(f.parameter, '__proto__');
    assert.ok(f.evidence.response.includes('__pp_dm_'), 'evidence must quote the polluted default verbatim');
  });

  it('T3 negative: baseline stays silent', async () => {
    const findings = await runStub('baseline');
    assert.ok(!findings.some((x) => x.id.startsWith('pp-query-')));
  });

  it('T3 nested-variant boundary: nested a[__proto__] merge fires once', async () => {
    const findings = await runStub('merge-query-nested');
    const t3 = findings.filter((x) => x.id.startsWith('pp-query-'));
    assert.equal(t3.length, 1, 'exactly one T3 finding from the nested variant');
  });

  it('includes()-family triple-count pin: echo-all stays silent', async () => {
    const findings = await runStub('echo-all');
    assert.deepEqual(findings, [], 'one echo endpoint must not yield three findings');
  });

  // ---- T4/T5: gadget + logic bypass (deep) --------------------------------
  it('T4 true positive: polluted key in a src sink fires HIGH', async () => {
    const findings = await runStub('merge-gadget', { depth: 'deep' });
    const f = findings.find((x) => x.id.startsWith('pp-gadget-'));
    assert.ok(f, `expected T4 gadget finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
    assert.equal(f.severity, 'high');
    assert.ok(f.evidence.response.includes('src='), 'evidence must quote the sink window verbatim');
  });

  it('T4 negative: merge without a sink stays silent', async () => {
    const findings = await runStub('merge', { depth: 'deep' });
    assert.ok(!findings.some((x) => x.id.startsWith('pp-gadget-')), 'pollution without a reachable gadget stays silent');
  });

  it('T4 sink-scope boundary: plain-text render is not a sink', async () => {
    const findings = await runStub('text', { depth: 'deep' });
    assert.ok(!findings.some((x) => x.id.startsWith('pp-gadget-')), 'a canary in plain text must not match the sink regex');
  });

  it('T4 gate pin: echo at deep depth stays silent', async () => {
    const findings = await runStub('echo', { depth: 'deep' });
    assert.ok(!findings.some((x) => x.id.startsWith('pp-gadget-')), 'T4 must not compound the T1 echo shape');
  });

  it('T5 true positive: denied before, allowed after pollution => CRITICAL', async () => {
    const { server, port, close } = await startStub('merge');
    try {
      const findings = await probePrototypePollution(`http://127.0.0.1:${port}/`, {
        ...LAB,
        depth: 'deep',
        ppLab: { actionUrl: `http://127.0.0.1:${port}/admin`, denyKeyword: 'denied', allowKeyword: 'Welcome' },
      });
      const f = findings.find((x) => x.id.startsWith('pp-logic-'));
      assert.ok(f, `expected T5 CRITICAL finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
      assert.equal(f.severity, 'critical');
      assert.ok(f.evidence.response.includes('denied'), 'evidence must quote the deny window');
      assert.ok(f.evidence.response.includes('Welcome'), 'evidence must quote the allow window');
    } finally {
      await close();
    }
  });

  it('T5 coincidental-flip guard: control flip stays silent', async () => {
    const { server, port, close } = await startStub('flip');
    try {
      const findings = await probePrototypePollution(`http://127.0.0.1:${port}/`, {
        ...LAB,
        depth: 'deep',
        ppLab: { actionUrl: `http://127.0.0.1:${port}/admin`, denyKeyword: 'denied', allowKeyword: 'Welcome' },
      });
      assert.ok(!findings.some((x) => x.id.startsWith('pp-logic-')), 'a flip with no pollution is not a bypass');
    } finally {
      await close();
    }
  });

  it('T5 empty-before guard: failed first read stays silent', async () => {
    const { server, port, close } = await startStub('fail-first');
    try {
      const findings = await probePrototypePollution(`http://127.0.0.1:${port}/`, {
        ...LAB,
        depth: 'deep',
        ppLab: { actionUrl: `http://127.0.0.1:${port}/admin`, denyKeyword: 'denied', allowKeyword: 'Welcome' },
      });
      assert.ok(!findings.some((x) => x.id.startsWith('pp-logic-')), 'an empty first read is inconclusive, never denial');
    } finally {
      await close();
    }
  });

  it('T5 negative: no flip stays silent', async () => {
    const { server, port, close } = await startStub('baseline');
    try {
      const findings = await probePrototypePollution(`http://127.0.0.1:${port}/`, {
        ...LAB,
        depth: 'deep',
        ppLab: { actionUrl: `http://127.0.0.1:${port}/admin`, denyKeyword: 'denied', allowKeyword: 'Welcome' },
      });
      assert.ok(!findings.some((x) => x.id.startsWith('pp-logic-')));
    } finally {
      await close();
    }
  });
});
