// File upload race condition probe tests (row #498 [High] File
// upload — race condition (validation timing), CWE-362/434; phase
// 'upload-race').
//
// The probe confirms only on a state change: the upload is
// accepted, the marker is retrievable inside the polling window,
// and a later GET shows the file gone (the check removed it). A
// file that persists is a stored upload, not a race window; a file
// never retrievable was validated before the move. The mock
// listener stores the uploaded file and, per mode, unlinks it
// after 300ms ('racy'), rejects the .php upload outright
// ('validate-first'), or never unlinks it ('persistent').

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeUploadRace,
  findUploadForms,
  findUploadedUrl,
  predictPublicUrl,
  assessUploadRace,
  __uploadRaceMeta,
} from './uploadRace.js';
import { verifyFindings } from '../verifier.js';

// Parse one multipart file part: { filename, content } or null.
function parseMultipart(body) {
  const nameIdx = body.indexOf('filename="');
  if (nameIdx < 0) return null;
  const nameEnd = body.indexOf('"', nameIdx + 10);
  const filename = body.slice(nameIdx + 10, nameEnd);
  const headEnd = body.indexOf('\r\n\r\n', nameEnd);
  if (headEnd < 0) return null;
  const start = headEnd + 4;
  const end = body.indexOf('\r\n--', start);
  return { filename, content: body.slice(start, end < 0 ? undefined : end) };
}

// Mock upload listener. `mode` picks the handler's validation
// timing: 'racy' (move first, unlink 300ms later),
// 'validate-first' (reject .php uploads), 'persistent' (never
// unlink). Every stored file is served back at
// /uploads/<filename> while it lives.
async function startLab(mode) {
  const stored = new Map();
  let hits = 0;
  const srv = http.createServer((req, res) => {
    hits += 1;
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><body><form action="/upload" method="post" enctype="multipart/form-data">' +
          '<input type="file" name="file"><input type="submit"></form></body></html>',
      );
      return;
    }
    if (req.method === 'POST' && u.pathname === '/upload') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const part = parseMultipart(Buffer.concat(chunks).toString('utf8'));
        if (!part) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('no file part');
          return;
        }
        if (mode === 'validate-first' && part.filename.endsWith('.php')) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('extension .php not allowed');
          return;
        }
        stored.set(part.filename, part.content);
        if (mode === 'racy') {
          setTimeout(() => stored.delete(part.filename), 300);
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`stored <a href="/uploads/${part.filename}">download</a>`);
      });
      return;
    }
    if (req.method === 'GET' && u.pathname.startsWith('/uploads/')) {
      const name = decodeURIComponent(u.pathname.slice('/uploads/'.length));
      if (stored.has(name)) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(stored.get(name));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${srv.address().port}/`,
    close: () => srv.close(),
    hits: () => hits,
  };
}

// ---- pure helpers ------------------------------------------------------------

test('UR-1: findUploadForms mines file forms and resolves the action', () => {
  const forms = findUploadForms(
    '<form action="/upload" method="post"><input type="file" name="up"></form>' +
      '<form action="/x"><input type="text" name="q"></form>',
    'http://lab.local/page',
  );
  assert.equal(forms.length, 1);
  assert.equal(forms[0].action, 'http://lab.local/upload');
  assert.equal(forms[0].fileInput, 'up');
});

test('UR-2: findUploadForms ignores pages with no file input', () => {
  assert.deepEqual(findUploadForms('<form action="/x"><input type="text" name="q"></form>', 'http://lab.local/'), []);
});

test('UR-3: findUploadForms caps at 2 forms', () => {
  const body = [1, 2, 3]
    .map((n) => `<form action="/up${n}"><input type="file" name="f"></form>`)
    .join('');
  assert.equal(findUploadForms(body, 'http://lab.local/').length, 2);
});

test('UR-4: findUploadedUrl reads the disclosed href', () => {
  assert.equal(
    findUploadedUrl('stored <a href="/uploads/dmprobe_x.php">download</a>', 'dmprobe_x.php', 'http://lab.local/upload'),
    'http://lab.local/uploads/dmprobe_x.php',
  );
});

test('UR-5: findUploadedUrl returns null when nothing is disclosed', () => {
  assert.equal(findUploadedUrl('upload ok', 'dmprobe_x.php', 'http://lab.local/upload'), null);
});

test('UR-6: predictPublicUrl follows the lab /uploads convention', () => {
  assert.equal(
    predictPublicUrl('http://lab.local:8080/upload', 'dmprobe_x.php'),
    'http://lab.local:8080/uploads/dmprobe_x.php',
  );
});

test('UR-7: assessUploadRace confirms the full window open-then-close', () => {
  const v = assessUploadRace({ uploadAccepted: true, hitObserved: true, goneAfter: true, disclosedUrlMatches: true });
  assert.equal(v.verdict, 'confirmed');
});

test('UR-8: assessUploadRace rejects an upload that was never accepted', () => {
  assert.equal(
    assessUploadRace({ uploadAccepted: false, hitObserved: false, goneAfter: false, disclosedUrlMatches: true }).verdict,
    'rejected',
  );
});

test('UR-9: assessUploadRace rejects when the marker was never retrievable', () => {
  assert.equal(
    assessUploadRace({ uploadAccepted: true, hitObserved: false, goneAfter: false, disclosedUrlMatches: true }).verdict,
    'rejected',
  );
});

test('UR-10: assessUploadRace rejects a file that persists (stored upload, not a race)', () => {
  const v = assessUploadRace({ uploadAccepted: true, hitObserved: true, goneAfter: false, disclosedUrlMatches: true });
  assert.equal(v.verdict, 'rejected');
  assert.match(v.reason, /persist/);
});

test('UR-11: assessUploadRace is unconfirmed when the disclosed path differs', () => {
  assert.equal(
    assessUploadRace({ uploadAccepted: true, hitObserved: true, goneAfter: true, disclosedUrlMatches: false }).verdict,
    'unconfirmed',
  );
});

test('UR-12: probe meta names the phase and its depths', () => {
  assert.deepEqual(__uploadRaceMeta.phases, ['upload-race']);
  assert.deepEqual(__uploadRaceMeta.depth, ['standard', 'deep']);
});

// ---- gates -------------------------------------------------------------------

test('UR-13: gate — no allowWrite means no requests at all', async () => {
  const lab = await startLab('racy');
  try {
    const findings = await probeUploadRace(lab.url, { labTargets: ['127.0.0.1'] });
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

test('UR-14: gate — non-lab host means no requests at all', async () => {
  const lab = await startLab('racy');
  try {
    const findings = await probeUploadRace(lab.url, { allowWrite: true, labTargets: ['10.0.0.99'] });
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

test('UR-15: page with no upload form stays quiet', async () => {
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>no forms here</body></html>');
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    const diag = {};
    const findings = await probeUploadRace(`http://127.0.0.1:${srv.address().port}/`, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.forms, 0);
    assert.equal(diag.skipReason, 'no upload form on the page');
  } finally {
    srv.close();
  }
});

// ---- probe behaviour (real lab listener) -------------------------------------

test('UR-16: move-first/unlink-after-300ms confirms the race', async () => {
  const lab = await startLab('racy');
  try {
    const diag = {};
    const findings = await probeUploadRace(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'file_upload_race');
    assert.equal(findings[0].severity, 'high');
    assert.match(findings[0].title, /race condition/);
    assert.equal(findings[0].evidence.signalCorrelated, true);
    assert.match(findings[0].evidence.response, /retrievable/);
    assert.equal(diag.uploadAccepted, true);
    assert.equal(diag.goneAfter, true);
    assert.equal(diag.verdict, 'confirmed');
    assert.ok(typeof diag.windowHitMs === 'number' && diag.windowHitMs >= 0);
    assert.ok(typeof diag.windowClosedMs === 'number' && diag.windowClosedMs > diag.windowHitMs);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.filter((f) => f.class === 'file_upload_race').length, 1);
  } finally {
    lab.close();
  }
});

test('UR-17: validate-first (.php rejected) stays quiet', async () => {
  const lab = await startLab('validate-first');
  try {
    const diag = {};
    const findings = await probeUploadRace(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.validatedBeforeMove, true);
  } finally {
    lab.close();
  }
});

test('UR-18: persistent file stays quiet (stored upload, not a race window)', async () => {
  const lab = await startLab('persistent');
  try {
    const diag = {};
    const findings = await probeUploadRace(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      pollBudgetMs: 800,
      diagnostics: diag,
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.goneAfter, false);
    assert.equal(diag.verdict, 'rejected');
  } finally {
    lab.close();
  }
});

test('UR-19: network errors never crash the probe', async () => {
  const findings = await probeUploadRace('http://127.0.0.1:1/', {
    allowWrite: true,
    labTargets: ['127.0.0.1'],
    fetchFn: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(findings.length, 0);
});
