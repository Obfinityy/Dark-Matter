// Tests for the request-smuggling TE.CL / TE.TE / chunked-extension /
// LF-only legs (rows #352/#353/#354 [High] HTTP request smuggling,
// CWE-444; phase 'request-smuggling', probeRequestSmuggling in
// smuggling.js).
//
// The mock is a small HTTP/1.1 parser over a raw socket whose `policy`
// makes it vulnerable to EXACTLY ONE variant (teCl, clTe, xchunked,
// spaceColon, dupTe, vt, chunkedExt, lfOnly) — or to none ('clean'),
// or 'rejecting' (400s any ambiguous POST but answers the pipelined
// GET — the correct-rejection behaviour, which must NOT be a finding).
// All servers are local node:net listeners; no external service is
// touched.
//
// The new legs are LAB-GATED (allowWrite + lab host, same gate as
// file-upload): non-lab targets get a gated skip and no variant
// exchange is attempted. The existing CL.TE leg is ungated and must
// behave exactly as before (see the regression test below).

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {
  probeRequestSmuggling,
  buildTeClPayload,
  buildObfuscatedTePayload,
  buildChunkedExtPayload,
  buildLfOnlyPayload,
} from './smuggling.js';
import { assessSmugglingDesync } from './smugglingClCl.js';
import { verifyFindings } from '../verifier.js';

const LAB_OPTS = { timeoutMs: 1500, allowWrite: true, labTargets: '127.0.0.1' };

// ---- mock ---------------------------------------------------------------

// Peek at the chunked body (bytes after the header terminator) to tell
// the two body-shape variants apart: a chunk-size line carrying a
// ';ext=' extension, and a chunk-size line terminated by LF only.
function restHasChunkExt(rest) {
  const firstLine = rest.split('\r\n')[0] || '';
  return firstLine.includes(';');
}

function restHasLfOnly(rest) {
  const lf = rest.indexOf('\n');
  const crlf = rest.indexOf('\r\n');
  return lf >= 0 && (crlf < 0 || lf < crlf);
}

// Parse a chunked body starting at rest[0]. Returns { ok, len } where
// len is the byte length of the whole chunked body (size lines, data,
// trailers, terminating empty line). Extensions are accepted only when
// policy.chunkedExt; LF-only line endings only when policy.lfOnly.
function parseChunked(rest, policy) {
  let i = 0;
  for (;;) {
    let eol = rest.indexOf('\r\n', i);
    let eolLen = 2;
    if (policy.lfOnly) {
      const lf = rest.indexOf('\n', i);
      if (lf >= 0 && (eol < 0 || lf < eol)) {
        eol = lf;
        eolLen = 1;
      }
    }
    if (eol < 0) return { ok: false };
    const sizeLine = rest.slice(i, eol);
    if (sizeLine.includes(';') && !policy.chunkedExt) return { ok: false };
    const size = parseInt(sizeLine.split(';')[0].trim(), 16);
    if (Number.isNaN(size)) return { ok: false };
    i = eol + eolLen;
    if (size === 0) {
      if (rest.slice(i, i + 2) === '\r\n') return { ok: true, len: i + 2 };
      if (policy.lfOnly && rest[i] === '\n') return { ok: true, len: i + 1 };
      return { ok: false };
    }
    i += size;
    if (rest.slice(i, i + 2) === '\r\n') i += 2;
    else if (policy.lfOnly && rest[i] === '\n') i += 1;
    else return { ok: false };
  }
}

function startMock(policy = {}) {
  const server = net.createServer((socket) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      drain(false);
    });
    socket.on('error', () => {});
    socket.on('end', () => {
      drain(true);
      try {
        socket.end();
      } catch {
        /* ignore */
      }
    });
    function safeWrite(s) {
      try {
        if (!socket.destroyed && socket.writable) socket.write(s);
      } catch {
        /* peer already gone */
      }
    }
    function drain(final) {
      if (socket.destroyed) return;
      let wrote = false;
      for (;;) {
        const headEnd = buf.indexOf('\r\n\r\n');
        if (headEnd < 0) return;
        const head = buf.slice(0, headEnd);
        const lines = head.split('\r\n');
        const requestLine = lines[0] || '';
        if (!/^(GET|POST) \S+ HTTP\/1\.1$/.test(requestLine)) {
          safeWrite('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
          buf = '';
          try {
            socket.end();
          } catch {
            /* ignore */
          }
          return;
        }
        const rest = buf.slice(headEnd + 4);
        const hdrs = [];
        for (const l of lines.slice(1)) {
          const i = l.indexOf(':');
          if (i < 0) continue;
          hdrs.push({ name: l.slice(0, i), value: l.slice(i + 1) });
        }
        const clIdx = hdrs.findIndex((h) => /^content-length$/i.test(h.name));
        const clVal = clIdx >= 0 ? Number(hdrs[clIdx].value.trim()) : null;
        // Transfer-Encoding headers in order. `spaced` is the
        // "Transfer-Encoding : chunked" (space before the colon) spelling.
        const teHdrs = [];
        let teIdx = -1;
        hdrs.forEach((h, i) => {
          const strictName = /^transfer-encoding$/i.test(h.name);
          const spacedName = /^transfer-encoding\s+$/i.test(h.name);
          if (!strictName && !spacedName) return;
          if (teIdx < 0) teIdx = i;
          teHdrs.push({ name: h.name, value: h.value, spaced: spacedName });
        });

        // Correct rejection: 400 the ambiguous POST, answer the
        // pipelined GET normally. The judge must call this 'rejected',
        // not a desync.
        if (policy.rejecting && clIdx >= 0 && teHdrs.length) {
          buf = buf.slice(Math.min(headEnd + 4 + (clVal || 0), buf.length));
          safeWrite('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: keep-alive\r\n\r\n');
          wrote = true;
          continue;
        }

        // Decide whether Transfer-Encoding is honoured (chunked
        // framing) for THIS request. The clean server always honours
        // Content-Length when present; each policy key honours TE only
        // for its own variant shape.
        let honorChunked = false;
        if (teHdrs.length) {
          const firstTe = teHdrs[0];
          const v0 = firstTe.value.trim().toLowerCase();
          // VT/FF check must use the RAW value: trim() strips \x0b/\x0c,
          // so the trimmed v0 can never equal '\x0bchunked' (resume-lane
          // fix — the original mock never honoured the vertical-tab
          // policy and the vt test could not pass).
          const rawV0 = firstTe.value.toLowerCase();
          if (teHdrs.length > 1 && policy.dupTe) honorChunked = true;
          else if (firstTe.spaced && policy.spaceColon) honorChunked = true;
          else if (v0 === 'xchunked' && policy.xchunked) honorChunked = true;
          else if ((rawV0 === '\x0bchunked' || rawV0 === '\x0cchunked') && policy.vt) honorChunked = true;
          else if (v0 === 'chunked' && clIdx >= 0 && teIdx < clIdx && policy.teCl) honorChunked = true;
          else if (v0 === 'chunked' && clIdx >= 0 && teIdx > clIdx && policy.clTe) honorChunked = true;
          else if (v0 === 'chunked' && clIdx >= 0 && policy.chunkedExt && restHasChunkExt(rest)) honorChunked = true;
          else if (v0 === 'chunked' && clIdx >= 0 && policy.lfOnly && restHasLfOnly(rest)) honorChunked = true;
        }

        let consumed;
        if (honorChunked) {
          const parsed = parseChunked(rest, policy);
          if (!parsed.ok) {
            safeWrite('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
            buf = '';
            try {
              socket.end();
            } catch {
              /* ignore */
            }
            return;
          }
          consumed = headEnd + 4 + parsed.len;
        } else if (clVal !== null && Number.isFinite(clVal)) {
          if (rest.length < clVal) {
            if (!final) return;
            consumed = headEnd + 4 + rest.length;
          } else {
            consumed = headEnd + 4 + clVal;
          }
        } else {
          consumed = headEnd + 4;
        }
        buf = buf.slice(consumed);
        safeWrite('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: keep-alive\r\n\r\nok');
        wrote = true;
        if (buf.length === 0 && wrote) {
          // Whole payload answered; close so the probe's exchange
          // resolves without waiting for the client half-close.
          try {
            socket.end();
          } catch {
            /* ignore */
          }
          return;
        }
      }
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

describe('smuggling TE variants (#352/#353/#354)', () => {
  let mocks = [];
  afterEach(async () => {
    for (const m of mocks) await new Promise((r) => m.server.close(r));
    mocks = [];
  });
  async function mock(policy) {
    const m = await startMock(policy);
    mocks.push(m);
    return `http://127.0.0.1:${m.port}/`;
  }

  it('#352 CONFIRMS desync when Transfer-Encoding precedes Content-Length', async () => {
    const diag = {};
    const findings = await probeRequestSmuggling(await mock({ teCl: true }), {
      ...LAB_OPTS,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'request_smuggling');
    assert.equal(f.id, 'request-smuggling-te-cl-desync');
    assert.equal(f.severity, 'high');
    assert.match(f.title, /TE\.CL/);
    assert.ok(f.evidence.signalCorrelated);
    assert.ok(f.evidence.response.includes('baseline: 2'));
    assert.equal(diag['variant:te-cl'], 'confirmed');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('#353 CONFIRMS on the xchunked obfuscation', async () => {
    const diag = {};
    const findings = await probeRequestSmuggling(await mock({ xchunked: true }), {
      ...LAB_OPTS,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-te-te-desync');
    assert.equal(findings[0].severity, 'high');
    assert.match(findings[0].title, /TE\.TE/);
    assert.match(findings[0].evidence.response, /xchunked/);
    assert.equal(diag['variant:te-te-xchunked'], 'confirmed');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('#353 CONFIRMS on the space-before-colon obfuscation', async () => {
    const findings = await probeRequestSmuggling(await mock({ spaceColon: true }), LAB_OPTS);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-te-te-desync');
    assert.match(findings[0].evidence.response, /space-before-colon/);
  });

  it('#353 CONFIRMS on duplicate Transfer-Encoding headers', async () => {
    const findings = await probeRequestSmuggling(await mock({ dupTe: true }), LAB_OPTS);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-te-te-desync');
    assert.match(findings[0].evidence.response, /duplicate/);
  });

  it('#353 CONFIRMS on the vertical-tab obfuscation', async () => {
    const findings = await probeRequestSmuggling(await mock({ vt: true }), LAB_OPTS);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-te-te-desync');
    assert.match(findings[0].evidence.response, /vertical-tab/);
  });

  it('#354 CONFIRMS on the chunked-extension vector', async () => {
    const findings = await probeRequestSmuggling(await mock({ chunkedExt: true }), LAB_OPTS);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-chunked-ext-desync');
    assert.equal(findings[0].severity, 'high');
    assert.match(findings[0].title, /chunked-extension/);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('#354 CONFIRMS on the LF-only vector', async () => {
    const findings = await probeRequestSmuggling(await mock({ lfOnly: true }), LAB_OPTS);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-lf-only-desync');
    assert.equal(findings[0].severity, 'high');
    assert.match(findings[0].title, /LF-only/);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  // NOTE (resume lane): the original expectation here was "no findings
  // at all" — wrong. A CL-honouring server that answers 2xx to the
  // ambiguous CL.TE request fires the VERIFIED #351 medium (accepted
  // ambiguity, batch-6) — the CL.TE leg is ungated and unchanged.
  // What must stay silent is every NEW variant leg.
  it('new variants stay silent on a clean server (CL.TE medium still fires)', async () => {
    const diag = {};
    const findings = await probeRequestSmuggling(await mock({}), { ...LAB_OPTS, diagnostics: diag });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-ambiguity');
    assert.ok(
      !findings.some(
        (f) => f.id.includes('te-cl') || f.id.includes('te-te') || f.id.includes('chunked-ext') || f.id.includes('lf-only')
      )
    );
    assert.equal(diag['variant:te-cl'], 'rejected');
    assert.equal(diag['variant:te-te-xchunked'], 'rejected');
  });

  // NOTE (resume lane): "silent" was wrong — the ungated CL.TE leg
  // still fires its verified medium on a server that 200s the
  // ambiguous request. Lab-gating covers the NEW variants only.
  it('new variants are lab-gated: no variant finding without allowWrite', async () => {
    const diag = {};
    const findings = await probeRequestSmuggling(await mock({ teCl: true }), {
      timeoutMs: 1500,
      diagnostics: diag,
    });
    assert.ok(
      !findings.some(
        (f) => f.id.includes('te-cl') || f.id.includes('te-te') || f.id.includes('chunked-ext') || f.id.includes('lf-only')
      )
    );
    assert.match(diag.skipped, /lab-gated/);
  });

  // NOTE (resume lane): same correction as above — the ungated CL.TE
  // medium still fires; the new variants must not.
  it('new variants are lab-gated: no variant finding when the host is not a lab target', async () => {
    const diag = {};
    const findings = await probeRequestSmuggling(await mock({ teCl: true }), {
      timeoutMs: 1500,
      allowWrite: true,
      labTargets: 'example.invalid',
      diagnostics: diag,
    });
    assert.ok(
      !findings.some(
        (f) => f.id.includes('te-cl') || f.id.includes('te-te') || f.id.includes('chunked-ext') || f.id.includes('lf-only')
      )
    );
    assert.match(diag.skipped, /lab-gated/);
  });

  it('CL.TE leg unchanged: still fires without allowWrite on a cl-te-vuln mock', async () => {
    const findings = await probeRequestSmuggling(await mock({ clTe: true }), { timeoutMs: 1500 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'request-smuggling-desync');
    assert.equal(findings[0].title, 'HTTP request smuggling (CL.TE desync proven)');
    // The early return means no new-variant finding rides along.
    assert.ok(!findings.some((f) => f.id.includes('te-cl') || f.id.includes('te-te')));
  });

  it('correct rejection is not a desync: 400 on the ambiguous POST, GET answered', async () => {
    const findings = await probeRequestSmuggling(await mock({ rejecting: true }), LAB_OPTS);
    assert.deepEqual(findings, []);
  });

  it('judge: first-response 400 is a rejection, not a desync', () => {
    const baseline = { data: 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 200 OK\r\n\r\nok', timedOut: false };
    const probe = { data: 'HTTP/1.1 400 Bad Request\r\n\r\nHTTP/1.1 200 OK\r\n\r\nok', timedOut: false };
    assert.equal(assessSmugglingDesync({ baseline, probe }).verdict, 'rejected');
  });

  it('judge: response-count divergence is a desync', () => {
    const baseline = { data: 'HTTP/1.1 200 OK\r\n\r\nokHTTP/1.1 200 OK\r\n\r\nok', timedOut: false };
    const probe = { data: 'HTTP/1.1 200 OK\r\n\r\nok', timedOut: false };
    assert.equal(assessSmugglingDesync({ baseline, probe }).verdict, 'confirmed');
  });

  it('judge: unusable baseline is unconfirmed, not a finding', () => {
    const baseline = { data: '', timedOut: true };
    const probe = { data: 'HTTP/1.1 200 OK\r\n\r\nok', timedOut: false };
    assert.equal(assessSmugglingDesync({ baseline, probe }).verdict, 'unconfirmed');
  });

  it('payload builders are pure and well-formed', () => {
    const teCl = buildTeClPayload('/', '127.0.0.1');
    assert.ok(teCl.indexOf('Transfer-Encoding: chunked') < teCl.indexOf('Content-Length: 6'));
    assert.ok(teCl.includes('0\r\n\r\nXGET / HTTP/1.1'));

    const xchunked = buildObfuscatedTePayload('/', '127.0.0.1', 'xchunked');
    assert.ok(xchunked.includes('Transfer-Encoding: xchunked'));
    assert.ok(xchunked.includes('Content-Length: 6'));

    const spaced = buildObfuscatedTePayload('/', '127.0.0.1', 'space-colon');
    assert.ok(spaced.includes('Transfer-Encoding : chunked'));

    const dup = buildObfuscatedTePayload('/', '127.0.0.1', 'duplicate');
    assert.ok(dup.includes('Transfer-Encoding: chunked\r\nTransfer-Encoding: identity'));

    const vt = buildObfuscatedTePayload('/', '127.0.0.1', 'vertical-tab');
    assert.ok(vt.includes('Transfer-Encoding:\x0bchunked'));

    const ext = buildChunkedExtPayload('/', '127.0.0.1');
    assert.ok(ext.includes('0;ext=x\r\n\r\nXGET / HTTP/1.1'));
    assert.ok(ext.includes('Content-Length: 12'));

    const lf = buildLfOnlyPayload('/', '127.0.0.1');
    assert.ok(lf.includes('0\n\nXGET / HTTP/1.1'));
    assert.ok(lf.includes('Content-Length: 4'));
  });
});
