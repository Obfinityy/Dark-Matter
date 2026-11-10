// Server config override via .htaccess upload probe tests (row
// #499 [High] File upload — server config override (.htaccess),
// CWE-434; phase 'upload-htaccess').
//
// The probe confirms only on differential execution: a control
// marker uploaded BEFORE the .htaccess must be served inert,
// the .htaccess must be accepted, and a marker uploaded AFTER
// it must execute (canary returned with no PHP source) twice.
// The mock listener plants the .htaccess handling per mode:
// 'vulnerable' (.htaccess accepted + marker executes after it),
// 'htaccess-rejected', 'inert-marker' (.htaccess accepted but
// the marker is still served as source), and
// 'mapped-server-wide' (the extension already executes without
// any .htaccess, so the control vetoes).

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeUploadHtaccess,
  htaccessContent,
  markerContent,
  markerExecuted,
  markerServedInert,
  assessUploadHtaccess,
  __uploadHtaccessMeta,
} from './uploadHtaccess.js';
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

// Extract the canary from stored marker source:
// <?php echo "DM-HTACCESS-..."; ?> -> DM-HTACCESS-...
function canaryOf(content) {
  return (String(content).match(/"([^"]+)"/) || [])[1] || '';
}

// Mock upload listener. `mode` picks the .htaccess handling (see
// the header comment). A stored .l33t marker executes only when
// the mode maps the extension: after an accepted .htaccess in
// 'vulnerable' mode, or always in 'mapped-server-wide' mode.
async function startLab(mode) {
  const stored = new Map();
  let htaccessActive = false;
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
        if (part.filename === '.htaccess') {
          if (mode === 'htaccess-rejected') {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('.htaccess upload not allowed');
            return;
          }
          htaccessActive = true;
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('stored .htaccess');
          return;
        }
        stored.set(part.filename, part.content);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`stored <a href="/uploads/${part.filename}">download</a>`);
      });
      return;
    }
    if (req.method === 'GET' && u.pathname.startsWith('/uploads/')) {
      const name = decodeURIComponent(u.pathname.slice('/uploads/'.length));
      if (!stored.has(name)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      const content = stored.get(name);
      const executes =
        name.endsWith('.l33t') &&
        (mode === 'mapped-server-wide' || (mode === 'vulnerable' && htaccessActive));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(executes ? canaryOf(content) : content);
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

test('UH-1: htaccessContent maps only the nonsense .l33t extension to PHP', () => {
  assert.equal(htaccessContent(), 'AddType application/x-httpd-php .l33t\n');
});

test('UH-2: markerContent is a canary echo only, never a functional shell', () => {
  const content = markerContent('DM-HTACCESS-abc');
  assert.equal(content, '<?php echo "DM-HTACCESS-abc"; ?>');
  assert.doesNotMatch(content, /system|exec|passthru|_GET|_POST|_FILES|include|fopen/i);
});

test('UH-3: markerExecuted is true only for canary-without-source', () => {
  assert.equal(markerExecuted('DM-HTACCESS-abc', 'DM-HTACCESS-abc'), true);
  assert.equal(markerExecuted('<?php echo "DM-HTACCESS-abc"; ?>', 'DM-HTACCESS-abc'), false);
  assert.equal(markerExecuted('something else entirely', 'DM-HTACCESS-abc'), false);
  assert.equal(markerExecuted('', 'DM-HTACCESS-abc'), false);
});

test('UH-4: markerServedInert is true only for canary-inside-source', () => {
  assert.equal(markerServedInert('<?php echo "DM-HTACCESS-abc"; ?>', 'DM-HTACCESS-abc'), true);
  assert.equal(markerServedInert('DM-HTACCESS-abc', 'DM-HTACCESS-abc'), false);
  assert.equal(markerServedInert('nothing here', 'DM-HTACCESS-abc'), false);
});

test('UH-5: assessUploadHtaccess confirms the full clean matrix', () => {
  const v = assessUploadHtaccess({
    htaccessAccepted: true,
    controlExecuted: false,
    controlRetrievable: true,
    probeExecuted: true,
    probeRepeatExecuted: true,
    disclosedUrlMatches: true,
  });
  assert.equal(v.verdict, 'confirmed');
});

test('UH-6: assessUploadHtaccess rejects a refused .htaccess', () => {
  assert.equal(
    assessUploadHtaccess({ htaccessAccepted: false, controlExecuted: false, controlRetrievable: true, probeExecuted: false, probeRepeatExecuted: false, disclosedUrlMatches: true }).verdict,
    'rejected',
  );
});

test('UH-7: assessUploadHtaccess is unconfirmed when the control already executes', () => {
  assert.equal(
    assessUploadHtaccess({ htaccessAccepted: true, controlExecuted: true, controlRetrievable: true, probeExecuted: true, probeRepeatExecuted: true, disclosedUrlMatches: true }).verdict,
    'unconfirmed',
  );
});

test('UH-8: assessUploadHtaccess is unconfirmed when the control was never retrievable', () => {
  assert.equal(
    assessUploadHtaccess({ htaccessAccepted: true, controlExecuted: false, controlRetrievable: false, probeExecuted: true, probeRepeatExecuted: true, disclosedUrlMatches: true }).verdict,
    'unconfirmed',
  );
});

test('UH-9: assessUploadHtaccess rejects when the probe marker never executes', () => {
  assert.equal(
    assessUploadHtaccess({ htaccessAccepted: true, controlExecuted: false, controlRetrievable: true, probeExecuted: false, probeRepeatExecuted: false, disclosedUrlMatches: true }).verdict,
    'rejected',
  );
});

test('UH-10: assessUploadHtaccess is unconfirmed when the execution does not repeat', () => {
  assert.equal(
    assessUploadHtaccess({ htaccessAccepted: true, controlExecuted: false, controlRetrievable: true, probeExecuted: true, probeRepeatExecuted: false, disclosedUrlMatches: true }).verdict,
    'unconfirmed',
  );
});

test('UH-11: assessUploadHtaccess is unconfirmed when the disclosed path differs', () => {
  assert.equal(
    assessUploadHtaccess({ htaccessAccepted: true, controlExecuted: false, controlRetrievable: true, probeExecuted: true, probeRepeatExecuted: true, disclosedUrlMatches: false }).verdict,
    'unconfirmed',
  );
});

test('UH-12: probe meta names the phase and its depths', () => {
  assert.deepEqual(__uploadHtaccessMeta.phases, ['upload-htaccess']);
  assert.deepEqual(__uploadHtaccessMeta.depth, ['standard', 'deep']);
});

// ---- gates -------------------------------------------------------------------

test('UH-13: gate — no allowWrite means no requests at all', async () => {
  const lab = await startLab('vulnerable');
  try {
    const findings = await probeUploadHtaccess(lab.url, { labTargets: ['127.0.0.1'] });
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

test('UH-14: gate — non-lab host means no requests at all', async () => {
  const lab = await startLab('vulnerable');
  try {
    const findings = await probeUploadHtaccess(lab.url, { allowWrite: true, labTargets: ['10.0.0.99'] });
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

test('UH-15: page with no upload form stays quiet', async () => {
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>no forms here</body></html>');
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    const diag = {};
    const findings = await probeUploadHtaccess(`http://127.0.0.1:${srv.address().port}/`, {
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

test('UH-16: .htaccess accepted + marker executes after it confirms', async () => {
  const lab = await startLab('vulnerable');
  try {
    const diag = {};
    const findings = await probeUploadHtaccess(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'file_upload_htaccess');
    assert.equal(findings[0].severity, 'high');
    assert.match(findings[0].title, /\.htaccess/);
    assert.equal(findings[0].evidence.signalCorrelated, true);
    assert.match(findings[0].evidence.response, /DM-HTACCESS-/);
    assert.equal(diag.htaccessAccepted, true);
    assert.equal(diag.controlExecuted, false);
    assert.equal(diag.controlRetrievable, true);
    assert.equal(diag.probeExecuted, true);
    assert.equal(diag.probeRepeatExecuted, true);
    assert.equal(diag.verdict, 'confirmed');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.filter((f) => f.class === 'file_upload_htaccess').length, 1);
  } finally {
    lab.close();
  }
});

test('UH-17: rejected .htaccess stays quiet', async () => {
  const lab = await startLab('htaccess-rejected');
  try {
    const diag = {};
    const findings = await probeUploadHtaccess(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.htaccessAccepted, false);
  } finally {
    lab.close();
  }
});

test('UH-18: .htaccess accepted but marker still served inert stays quiet', async () => {
  const lab = await startLab('inert-marker');
  try {
    const diag = {};
    const findings = await probeUploadHtaccess(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.htaccessAccepted, true);
    assert.equal(diag.probeExecuted, false);
  } finally {
    lab.close();
  }
});

test('UH-19: extension already mapped server-wide stays quiet (control veto)', async () => {
  const lab = await startLab('mapped-server-wide');
  try {
    const diag = {};
    const findings = await probeUploadHtaccess(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 0);
    assert.equal(diag.controlExecuted, true);
  } finally {
    lab.close();
  }
});

test('UH-20: network errors never crash the probe', async () => {
  const findings = await probeUploadHtaccess('http://127.0.0.1:1/', {
    allowWrite: true,
    labTargets: ['127.0.0.1'],
    fetchFn: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(findings.length, 0);
});
