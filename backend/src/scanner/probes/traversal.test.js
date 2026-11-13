// Tests for the absolute-path traversal leg (coverage row #230 [High]
// Absolute Path Traversal): a server that opens a bare absolute
// filesystem path directly — /etc/passwd, C:\windows\win.ini — as the
// parameter value must be confirmed on the file-content marker, while
// a server that only falls to relative ../ payloads must NOT produce
// an absolute finding, and a safe server must produce nothing at all.
//
// Local node:http mocks only; no external service is touched.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeTraversal } from './traversal.js';
import { verifyFindings } from '../verifier.js';

const PASSWD = 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n';
const WININI = '[extensions]\n[fonts]\n';

const RELATIVE_UNIX = '../../../../../../../../etc/passwd';
const RELATIVE_WIN = '..\\..\\..\\..\\..\\..\\windows\\win.ini';
const ABSOLUTE_UNIX = '/etc/passwd';
const ABSOLUTE_WIN = 'C:\\windows\\win.ini';

describe('absolute-path traversal probe (traversal.js, row #230)', () => {
  let server;
  let port;
  let mode = 'safe';
  const base = () => `http://127.0.0.1:${port}`;
  const target = () => `${base()}/page?file=benign`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const file = u.searchParams.get('file') ?? '';
      const send = (body) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(body);
      };
      const notFound = () => {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
      };

      if (mode === 'absolute-only') {
        // Blocks ../ (relative traversal fails) but opens a bare
        // absolute path directly — the exact #230 shape.
        if (file === ABSOLUTE_UNIX) return send(PASSWD);
        if (file === ABSOLUTE_WIN) return send(WININI);
        return notFound();
      }

      if (mode === 'absolute-windows-only') {
        // Unix absolute fails here; only the Windows absolute path
        // is served — exercises the windows absolute leg on its own.
        if (file === ABSOLUTE_WIN) return send(WININI);
        return notFound();
      }

      if (mode === 'relative-only') {
        // Classic traversal target: ../ works, bare absolute paths do not.
        if (file === RELATIVE_UNIX) return send(PASSWD);
        if (file === RELATIVE_WIN) return send(WININI);
        return notFound();
      }

      if (mode === 'all') {
        if (file === RELATIVE_UNIX || file === ABSOLUTE_UNIX) return send(PASSWD);
        if (file === RELATIVE_WIN || file === ABSOLUTE_WIN) return send(WININI);
        return notFound();
      }

      // mode 'safe': echoes the value back, never serves file content.
      return send(`you asked for: ${file}\n`);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('confirms an absolute-path unix finding when only the bare /etc/passwd value works', async () => {
    mode = 'absolute-only';
    const findings = await probeTraversal(target(), ['file'], {});
    assert.equal(findings.length, 1);
    const [f] = findings;
    assert.equal(f.class, 'lfi');
    assert.equal(f.id, 'traversal-file-unix-absolute');
    assert.match(f.title, /Absolute path traversal/);
    assert.equal(f.severity, 'high');
    assert.equal(f.param, 'file');
    // The bare absolute path was sent as the parameter value
    // (URL-encoded by mutateUrl: %2Fetc%2Fpasswd).
    assert.ok(f.evidence.request.includes('%2Fetc%2Fpasswd'), f.evidence.request);
    assert.ok(f.evidence.response.includes('root:x:0:0'));
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('confirms an absolute-path windows finding when only the bare C:\\windows\\win.ini value works', async () => {
    mode = 'absolute-windows-only';
    const findings = await probeTraversal(target(), ['file'], {});
    assert.equal(findings.length, 1);
    const [f] = findings;
    assert.equal(f.class, 'lfi');
    assert.equal(f.id, 'traversal-file-windows-absolute');
    assert.match(f.title, /Absolute path traversal/);
    assert.equal(f.severity, 'high');
    assert.ok(f.evidence.response.includes('[extensions]'));
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('relative-only server: relative finding fires, no absolute finding', async () => {
    mode = 'relative-only';
    const findings = await probeTraversal(target(), ['file'], {});
    assert.equal(findings.length, 1);
    const [f] = findings;
    assert.equal(f.id, 'traversal-file-unix');
    assert.doesNotMatch(f.title, /Absolute path/);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('safe server: zero findings (echo without a file-content marker)', async () => {
    mode = 'safe';
    const findings = await probeTraversal(target(), ['file'], {});
    assert.equal(findings.length, 0);
  });

  it('fully vulnerable server: one finding per param, relative leg wins (existing ordering preserved)', async () => {
    mode = 'all';
    const findings = await probeTraversal(target(), ['file'], {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'traversal-file-unix');
  });
});
