// Tests for the SSTI — Pebble engine probe (row #486 [Critical] SSTI —
// Pebble, CWE-94; phase 'ssti-pebble').
//
// The probe fingerprints Pebble with the Java-style ternary
// {{ true ? 9352 : 1111 }} (Jinja2/Twig spell it as an if-expression)
// plus the {{1336*7}} arithmetic oracle, each repeated at the same
// reflection point, with the false ternary leg as the nonsense control.
// Stubs below: a Pebble evaluator, a Jinja2-style evaluator (arithmetic
// + if-expression, never the ternary), a literal reflector, a page whose
// control already carries 9352, and the proof-#18 fresh-token shape.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeSstiPebble,
  pebbleArithmeticPayload,
  pebbleTernaryTruePayload,
  pebbleTernaryFalsePayload,
  jinjaConditionalPayload,
  assessPebbleLeg,
  __sstiPebbleMeta,
} from './sstiPebble.js';
import { verifyFindings } from '../verifier.js';

describe('ssti-pebble probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;
  let tokenSeq = 0;

  function freshToken(withOracle) {
    tokenSeq += 1;
    const seq = String(tokenSeq).padStart(2, '0');
    return 'd9516f' + seq + (withOracle ? '9352' : '4177') + '3765cd44c03913e4c7c';
  }

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const q = u.searchParams.get('q') || '';
      let out;
      if (u.pathname === '/pebble') {
        if (q === '{{1336*7}}') out = 'result: 9352';
        else if (q === '{{ true ? 9352 : 1111 }}') out = 'result: 9352';
        else if (q === '{{ false ? 9352 : 1111 }}') out = 'result: 1111';
        else if (q === '{{ 9352 if true else 1111 }}') out = `result: ${q}`; // Pebble never evaluates the if-expression
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/jinja') {
        // Jinja2-style: arithmetic + if-expression evaluate, ternary does not.
        if (q === '{{1336*7}}') out = 'result: 9352';
        else if (q === '{{ 9352 if true else 1111 }}') out = 'result: 9352';
        else if (q.includes('? 9352 :')) out = `result: ${q}`;
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/login') {
        // Proof-#18 shape: fresh hidden token; the payload response's
        // token happens to contain 9352, the control's does not.
        const token = freshToken(q === '{{1336*7}}' || q.includes('? 9352 :'));
        out = `<form><input type="hidden" name="user_token" value="${token}">login</form>`;
      } else if (u.pathname === '/noisy') {
        out = 'result: 9352 always';
      } else {
        out = `result: ${q}`; // plain reflector
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>${out}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fires on a Pebble evaluator (ternary + arithmetic, false leg flips)', async () => {
    const diag = {};
    const findings = await probeSstiPebble(`${base()}/pebble`, ['q'], { timeoutMs: 8000, diagnostics: diag });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'ssti');
    assert.equal(f.id, 'ssti-pebble-q');
    assert.equal(f.severity, 'critical');
    assert.match(f.title, /Pebble/);
    assert.equal(f.evidence.engine, 'pebble');
    assert.ok(f.evidence.signalCorrelated);
    assert.ok(f.evidence.response.includes('9352'));
    assert.equal(diag.pebbleParams, 1);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('stays silent on a Jinja2-style evaluator (ternary never evaluates)', async () => {
    // Generic SSTI owns this sink (ssti.js fires on the arithmetic);
    // the Pebble fingerprint must NOT fire — the ternary is the
    // discriminator and it stays literal here.
    const findings = await probeSstiPebble(`${base()}/jinja`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('stays silent on literal reflection', async () => {
    const findings = await probeSstiPebble(`${base()}/reflect`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('stays silent when the control already carries 9352', async () => {
    const findings = await probeSstiPebble(`${base()}/noisy`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('stays silent when 9352 hides inside a fresh hidden token (proof-#18 FP)', async () => {
    const findings = await probeSstiPebble(`${base()}/login`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });

  it('payload builders are the documented Pebble/Jinja spellings', () => {
    assert.equal(pebbleArithmeticPayload(), '{{1336*7}}');
    assert.equal(pebbleTernaryTruePayload(), '{{ true ? 9352 : 1111 }}');
    assert.equal(pebbleTernaryFalsePayload(), '{{ false ? 9352 : 1111 }}');
    assert.equal(jinjaConditionalPayload(), '{{ 9352 if true else 1111 }}');
    assert.notEqual(pebbleTernaryTruePayload(), jinjaConditionalPayload());
  });

  it('assessPebbleLeg confirms a full stable leg', () => {
    const v = assessPebbleLeg({
      controlRaw: '<html>result: baseline-ok</html>',
      bodyRaw: '<html>result: 9352</html>',
      bodyRepeatRaw: '<html>result: 9352</html>',
      payload: '{{1336*7}}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'confirmed');
  });

  it('assessPebbleLeg rejects literal reflection', () => {
    const v = assessPebbleLeg({
      controlRaw: '<html>result: baseline-ok</html>',
      bodyRaw: '<html>result: {{1336*7}}</html>',
      bodyRepeatRaw: '<html>result: {{1336*7}}</html>',
      payload: '{{1336*7}}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessPebbleLeg rejects a control that already carries the oracle', () => {
    const v = assessPebbleLeg({
      controlRaw: '<html>result: 9352 always</html>',
      bodyRaw: '<html>result: 9352</html>',
      bodyRepeatRaw: '<html>result: 9352</html>',
      payload: '{{1336*7}}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'rejected');
  });

  it('assessPebbleLeg is unconfirmed when the repeat moves the reflection point', () => {
    const v = assessPebbleLeg({
      controlRaw: '<html>result: baseline-ok</html>',
      bodyRaw: '<html>result: 9352</html>',
      bodyRepeatRaw: '<html>other slot: 9352</html>',
      payload: '{{1336*7}}',
      expected: '9352',
    });
    assert.equal(v.verdict, 'unconfirmed');
  });

  it('probe meta names the phase and all depths', () => {
    assert.deepEqual(__sstiPebbleMeta.phases, ['ssti-pebble']);
    assert.deepEqual(__sstiPebbleMeta.depth, ['quick', 'standard', 'deep']);
  });

  it('no params means no findings', async () => {
    const findings = await probeSstiPebble(`${base()}/pebble`, [], { timeoutMs: 8000 });
    assert.deepEqual(findings, []);
  });
});
