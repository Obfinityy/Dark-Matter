// Blind XPath injection probe tests (row #479 [High] Blind XPath
// injection, CWE-643; phase 103, 'blind-xpath').
//
// The probe proves a blind XPath boolean by differential response
// behaviour only: a TRUE/FALSE payload pair differing ONLY in the
// compared character must diverge, each leg must reproduce, and a
// SECOND independent witness must hold (substring() extraction of
// the known literal on shape A, string-length() on shape B). The
// fake fetch below simulates an XPath search sink in several
// modes: 'vulnerable-substring' (substring TRUE legs widen the
// result set), 'vulnerable-equality' (substring shows nothing,
// the 1=1/1=2 pair + string-length witness fire), 'secure'
// (inert), 'jittery' (baselines disagree), 'error-only' (every
// breakout returns the same error page — TRUE == FALSE),
// 't2-fail' (T1 fires, extraction does not), 'throw'.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeBlindXpath,
  responseSig,
  responsesMatch,
  blindTruePayload,
  blindFalsePayload,
  equalityTruePayload,
  equalityFalsePayload,
  lengthTruePayload,
  lengthFalsePayload,
  assessBlindOracle,
  assessBlindExtract,
  __blindXpathMeta,
} from './blindXpath.js';
import { verifyFindings } from '../verifier.js';

const BIG = `<html>${'<book>secret</book>'.repeat(40)}</html>`;
const SMALL = '<html>no books</html>';
const ERROR_PAGE = '<html>XPath error: invalid expression</html>';

function res(body, status = 200) {
  return { status, text: async () => body };
}

// A deterministic fake XPath search sink. `mode` picks the sink's
// behaviour; the value of the `q` param decides the answer.
function fakeFetch(mode) {
  let calls = 0;
  const fn = async (url) => {
    calls += 1;
    const u = new URL(String(url));
    // Query values AND path segments: the probe mutates both kinds
    // of probe point, so the sink must read both.
    const v = [...u.searchParams.values()].join(' ') + ' ' + decodeURIComponent(u.pathname);
    const isTrue =
      v.includes(`substring('dmprobe',1,1)='d`) ||
      v.includes(`substring('dmprobe',2,1)='m`) ||
      v.includes(`substring('dmprobe',3,1)='p`) ||
      v.includes(`string-length('dmprobe')=7`) ||
      v.includes(`' or '1'='1`);
    if (mode === 'throw') throw new Error('network down');
    if (mode === 'jittery' && !v.includes(' or ')) {
      // Benign baselines alternate lengths — the page is jittery.
      return res(calls % 2 === 0 ? SMALL : `${SMALL}<!-- pad ${'x'.repeat(300)} -->`);
    }
    if (mode === 'error-only' && v.includes(' or ')) return res(ERROR_PAGE);
    if (mode === 'secure') return res(SMALL);
    if (mode === 'vulnerable-equality') {
      // substring() shows nothing; the equality pair + the
      // string-length witness fire.
      if (v.includes('substring(')) return res(SMALL);
      return res(isTrue ? BIG : SMALL);
    }
    if (mode === 't2-fail') {
      // T1 fires; positions 2/3 never widen, so extraction fails.
      if (v.includes(`substring('dmprobe',2,1)`) || v.includes(`substring('dmprobe',3,1)`)) {
        return res(SMALL);
      }
      return res(isTrue ? BIG : SMALL);
    }
    return res(isTrue ? BIG : SMALL);
  };
  fn.calls = () => calls;
  return fn;
}

const R = (status, len) => ({ status, text: 'x'.repeat(len) });

// ---- pure helpers ------------------------------------------------------------

test('BX-1: responsesMatch agrees on identical responses', () => {
  assert.equal(responsesMatch(R(200, 1000), R(200, 1000)), true);
});

test('BX-2: responsesMatch rejects a status-class change', () => {
  assert.equal(responsesMatch(R(200, 1000), R(500, 1000)), false);
});

test('BX-3: responsesMatch rejects a large length gap', () => {
  assert.equal(responsesMatch(R(200, 1000), R(200, 20)), false);
});

test('BX-4: responsesMatch tolerates a few wobbling bytes', () => {
  assert.equal(responsesMatch(R(200, 1000), R(200, 1010)), true);
  assert.equal(responsesMatch(R(200, 50), R(200, 90)), true);
});

test('BX-5: assessBlindOracle confirms a full stable matrix', () => {
  const v = assessBlindOracle({
    base1: R(200, 20),
    base2: R(200, 20),
    trueLeg: R(200, 1000),
    falseLeg: R(200, 20),
    trueRepeat: R(200, 1000),
    falseRepeat: R(200, 20),
  });
  assert.equal(v.verdict, 'confirmed');
});

test('BX-6: assessBlindOracle rejects indistinguishable legs', () => {
  const v = assessBlindOracle({
    base1: R(200, 20),
    base2: R(200, 20),
    trueLeg: R(200, 20),
    falseLeg: R(200, 20),
    trueRepeat: R(200, 20),
    falseRepeat: R(200, 20),
  });
  assert.equal(v.verdict, 'rejected');
});

test('BX-7: assessBlindOracle is unconfirmed on a jittery baseline', () => {
  const v = assessBlindOracle({
    base1: R(200, 20),
    base2: R(200, 900),
    trueLeg: R(200, 1000),
    falseLeg: R(200, 20),
    trueRepeat: R(200, 1000),
    falseRepeat: R(200, 20),
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('BX-8: assessBlindOracle is unconfirmed when a leg does not reproduce', () => {
  const v = assessBlindOracle({
    base1: R(200, 20),
    base2: R(200, 20),
    trueLeg: R(200, 1000),
    falseLeg: R(200, 20),
    trueRepeat: R(200, 20),
    falseRepeat: R(200, 20),
  });
  assert.equal(v.verdict, 'unconfirmed');
});

test('BX-9: payload builders differ only in the compared character', () => {
  assert.equal(blindTruePayload(1, 'd'), `' or substring('dmprobe',1,1)='d`);
  assert.equal(blindFalsePayload(1), `' or substring('dmprobe',1,1)='0`);
  assert.equal(equalityTruePayload(), `' or '1'='1`);
  assert.equal(equalityFalsePayload(), `' or '1'='2`);
  assert.equal(lengthTruePayload(), `' or string-length('dmprobe')=7`);
  assert.equal(lengthFalsePayload(), `' or string-length('dmprobe')=6`);
  assert.ok(!blindTruePayload(2, 'm').includes('1,1'));
});

test('BX-10: assessBlindExtract verifies both positions', () => {
  const ext = assessBlindExtract([
    { pos: 2, trueLeg: R(200, 1000), falseLeg: R(200, 20), trueRef: R(200, 1000), falseRef: R(200, 20) },
    { pos: 3, trueLeg: R(200, 1000), falseLeg: R(200, 20), trueRef: R(200, 1000), falseRef: R(200, 20) },
  ]);
  assert.equal(ext.extracted, 'dmp');
  assert.equal(ext.verified, 2);
});

test('BX-11: assessBlindExtract verifies nothing when no position matches', () => {
  const ext = assessBlindExtract([
    { pos: 2, trueLeg: R(200, 20), falseLeg: R(200, 20), trueRef: R(200, 1000), falseRef: R(200, 20) },
    { pos: 3, trueLeg: R(200, 20), falseLeg: R(200, 20), trueRef: R(200, 1000), falseRef: R(200, 20) },
  ]);
  assert.equal(ext.extracted, 'd');
  assert.equal(ext.verified, 0);
});

test('BX-12: responseSig buckets status class and length', () => {
  assert.equal(responseSig(R(200, 450)), 'ok:2');
  assert.equal(responseSig(R(500, 450)), 'err:2');
  assert.equal(responseSig(null), 'err:missing');
});

test('BX-13: probe meta names the phase and all depths', () => {
  assert.deepEqual(__blindXpathMeta.phases, ['blind-xpath']);
  assert.deepEqual(__blindXpathMeta.depth, ['quick', 'standard', 'deep']);
});

// ---- probe behaviour ---------------------------------------------------------

test('BX-14: vulnerable substring sink confirms with extraction', async () => {
  const fetchFn = fakeFetch('vulnerable-substring');
  const findings = await probeBlindXpath('http://example.com/books', ['q'], { fetchFn });
  const x = findings.filter((f) => f.class === 'xpath_injection');
  assert.equal(x.length, 1);
  assert.equal(x[0].title, `Blind XPath injection in parameter 'q'`);
  assert.equal(x[0].severity, 'high');
  assert.ok(x[0].evidence.signalCorrelated);
  assert.ok(x[0].evidence.blindOracle);
  assert.match(x[0].evidence.response, /dmp/);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.filter((f) => f.class === 'xpath_injection').length, 1);
});

test('BX-15: inert sink stays quiet', async () => {
  const findings = await probeBlindXpath('http://example.com/books', ['q'], {
    fetchFn: fakeFetch('secure'),
  });
  assert.equal(findings.length, 0);
});

test('BX-16: jittery baselines stay quiet', async () => {
  const findings = await probeBlindXpath('http://example.com/books', ['q'], {
    fetchFn: fakeFetch('jittery'),
  });
  assert.equal(findings.length, 0);
});

test('BX-17: same error page on both legs stays quiet (no error-string verdict)', async () => {
  const findings = await probeBlindXpath('http://example.com/books', ['q'], {
    fetchFn: fakeFetch('error-only'),
  });
  assert.equal(findings.length, 0);
});

test('BX-18: shape A silent, shape B fires — equality oracle with length witness', async () => {
  const fetchFn = fakeFetch('vulnerable-equality');
  const diag = {};
  const findings = await probeBlindXpath('http://example.com/books', ['q'], { fetchFn, diagnostics: diag });
  assert.equal(findings.length, 1);
  assert.equal(diag.shape, 'equality');
  assert.equal(findings[0].title, `Blind XPath injection in parameter 'q'`);
  const { confirmed } = verifyFindings(findings);
  assert.equal(confirmed.length, 1);
});

test('BX-19: T1 fires but the second witness fails — no finding', async () => {
  const findings = await probeBlindXpath('http://example.com/books', ['q'], {
    fetchFn: fakeFetch('t2-fail'),
  });
  assert.equal(findings.length, 0);
});

test('BX-20: network errors never crash the probe', async () => {
  const findings = await probeBlindXpath('http://example.com/books', ['q'], {
    fetchFn: fakeFetch('throw'),
  });
  assert.equal(findings.length, 0);
});

test('BX-21: no params means no findings', async () => {
  const findings = await probeBlindXpath('http://example.com/books', [], {
    fetchFn: fakeFetch('vulnerable-substring'),
  });
  assert.equal(findings.length, 0);
});

test('BX-22: at most 6 params are probed', async () => {
  const fetchFn = fakeFetch('vulnerable-substring');
  const findings = await probeBlindXpath('http://example.com/books', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], {
    fetchFn,
  });
  assert.equal(findings.length, 6);
});

test('BX-23: quick depth still runs (no depth gate)', async () => {
  const findings = await probeBlindXpath('http://example.com/books', ['q'], {
    fetchFn: fakeFetch('vulnerable-substring'),
    depth: 'quick',
  });
  assert.equal(findings.length, 1);
});

test('BX-24: diagnostics record the oracle, shape and extraction', async () => {
  const diag = {};
  await probeBlindXpath('http://example.com/books', ['q'], {
    fetchFn: fakeFetch('vulnerable-substring'),
    diagnostics: diag,
  });
  assert.equal(diag.paramsTried, 1);
  assert.equal(diag.oracleParams, 1);
  assert.equal(diag.shape, 'substring');
  assert.equal(diag.extracted, 'dmp');
  assert.ok(diag.attempts >= 10);
});

test('BX-25: path points are probed with the (path) label', async () => {
  const fetchFn = fakeFetch('vulnerable-substring');
  const findings = await probeBlindXpath('http://example.com/books/title', [{ kind: 'path', name: 'title', segment: 2 }], {
    fetchFn,
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].parameter, 'title (path)');
});
