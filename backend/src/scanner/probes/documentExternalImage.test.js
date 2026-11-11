// Generated-document (.docx) external-image probe (V10-F4) — tests.
//
// Fixture: a page linking to /export.docx, served as a synthetic
// .docx built in-test (stored ZIP entries only; the deflate path is
// covered in officePackage.test.js). Linked = TargetMode="External" +
// <a:blip r:link>, no word/media/. Embedded = r:embed + word/media/.
// No network beyond localhost; no collaborator; no Meta spend.
import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeDocumentExternalImage } from './documentExternalImage.js';
import { verifyFindings } from '../verifier.js';

// Stored-only ZIP writer (the reader walks local headers).
function makeZip(entries) {
  const parts = [];
  for (const [name, content] of entries) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
  }
  return Buffer.concat(parts);
}

const LINKED_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://httpbin.org/image/png?marker=V10DOC" TargetMode="External"/>` +
  `</Relationships>`;
const LINKED_BODY =
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><a:blip r:link="rId9"/></w:p></w:body></w:document>`;
const EMBEDDED_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>` +
  `</Relationships>`;
const EMBEDDED_BODY =
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><a:blip r:embed="rId2"/></w:p></w:body></w:document>`;

function linkedDocx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['word/document.xml', LINKED_BODY],
    ['word/_rels/document.xml.rels', LINKED_RELS],
  ]);
}

function embeddedDocx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['word/document.xml', EMBEDDED_BODY],
    ['word/_rels/document.xml.rels', EMBEDDED_RELS],
    ['word/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ]);
}

// Modes: linked | embedded | nolinks | notzip.
function startFixture(mode) {
  const docx = mode === 'embedded' ? embeddedDocx() : linkedDocx();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://fixture.invalid');
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        mode === 'nolinks'
          ? '<html><body><p>no documents here</p></body></html>'
          : '<html><body><a href="/export.docx">Download report</a></body></html>'
      );
      return;
    }
    if (u.pathname === '/export.docx') {
      if (mode === 'notzip') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>not found</html>');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      res.end(docx);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

describe('probeDocumentExternalImage', () => {
  it('flags a linked external image and the verifier confirms it', async () => {
    const fx = await startFixture('linked');
    try {
      const diag = {};
      const findings = await probeDocumentExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.equal(findings.length, 1, JSON.stringify(findings));
      const f = findings[0];
      assert.equal(f.class, 'document_external_image');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.externalLinkPreserved, true);
      assert.equal(f.evidence.embeddedMedia, false);
      assert.match(f.evidence.response, /TargetMode="External"/);
      assert.match(f.evidence.response, /V10DOC/);
      assert.match(f.evidence.response, /r:link="rId9"/);
      assert.equal(diag.documentsChecked, 1);
      assert.equal(diag.externalFound, 1);
      const { confirmed, unconfirmed } = verifyFindings(findings);
      assert.equal(confirmed.length, 1, JSON.stringify(unconfirmed));
      assert.equal(confirmed[0].confirmation, 'confirmed');
    } finally {
      fx.server.close();
    }
  });

  it('embedded image is the control — no finding, controlStatus recorded', async () => {
    const fx = await startFixture('embedded');
    try {
      const diag = {};
      const findings = await probeDocumentExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.match(diag.controlStatus || '', /embedded/);
      assert.equal(diag.externalFound, 0);
    } finally {
      fx.server.close();
    }
  });

  it('no document links — no finding, skipped noted', async () => {
    const fx = await startFixture('nolinks');
    try {
      const diag = {};
      const findings = await probeDocumentExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.skipped, 'no document targets');
    } finally {
      fx.server.close();
    }
  });

  it('a non-ZIP served at a .docx URL is skipped, never a finding', async () => {
    const fx = await startFixture('notzip');
    try {
      const findings = await probeDocumentExternalImage(`http://127.0.0.1:${fx.port}/`, {});
      assert.deepEqual(findings, []);
    } finally {
      fx.server.close();
    }
  });

  it('explicit documentUrls override skips discovery', async () => {
    const fx = await startFixture('linked');
    try {
      const findings = await probeDocumentExternalImage(`http://127.0.0.1:${fx.port}/`, {
        documentUrls: [`http://127.0.0.1:${fx.port}/export.docx`],
      });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].class, 'document_external_image');
    } finally {
      fx.server.close();
    }
  });
});
