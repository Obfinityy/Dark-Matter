// Generated-presentation (.pptx) external-image probe (V10-VC-1
// control) — tests.
//
// Fixture: a page linking to /export.pptx, served as a synthetic
// .pptx built in-test (stored ZIP entries only). The V10 pipeline
// bakes slides as rendered images, so the expected outcome is NO
// finding: embedded (r:embed + ppt/media/) records a verified
// control. A linked variant (TargetMode="External" + r:link) is also
// covered — the same rule flags it. No network beyond localhost; no
// collaborator; no Meta spend.
import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probePresentationExternalImage } from './presentationExternalImage.js';
import { verifyFindings } from '../verifier.js';

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

const EMBEDDED_SLIDE =
  `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><a:blip r:embed="rId2"/></p:sld>`;
const EMBEDDED_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`;
const LINKED_SLIDE =
  `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><a:blip r:link="rId1"/></p:sld>`;
const LINKED_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://httpbin.org/image/png?marker=V10SLIDE" TargetMode="External"/></Relationships>`;

function embeddedPptx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['ppt/presentation.xml', '<p:presentation/>'],
    ['ppt/slides/slide1.xml', EMBEDDED_SLIDE],
    ['ppt/slides/_rels/slide1.xml.rels', EMBEDDED_RELS],
    ['ppt/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ]);
}

function linkedPptx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['ppt/presentation.xml', '<p:presentation/>'],
    ['ppt/slides/slide1.xml', LINKED_SLIDE],
    ['ppt/slides/_rels/slide1.xml.rels', LINKED_RELS],
  ]);
}

// Modes: embedded | linked | nolinks.
function startFixture(mode) {
  const pptx = mode === 'linked' ? linkedPptx() : embeddedPptx();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://fixture.invalid');
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        mode === 'nolinks'
          ? '<html><body><p>no documents here</p></body></html>'
          : '<html><body><a href="/export.pptx">Download deck</a></body></html>'
      );
      return;
    }
    if (u.pathname === '/export.pptx') {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      res.end(pptx);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

describe('probePresentationExternalImage', () => {
  it('embedded slides are the verified control — no finding', async () => {
    const fx = await startFixture('embedded');
    try {
      const diag = {};
      const findings = await probePresentationExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.match(diag.controlStatus || '', /embedded/);
      assert.equal(diag.documentsChecked, 1);
      assert.equal(diag.externalFound, 0);
    } finally {
      fx.server.close();
    }
  });

  it('a linked image WOULD be flagged and the verifier confirms it', async () => {
    const fx = await startFixture('linked');
    try {
      const findings = await probePresentationExternalImage(`http://127.0.0.1:${fx.port}/`, {});
      assert.equal(findings.length, 1, JSON.stringify(findings));
      const f = findings[0];
      assert.equal(f.class, 'presentation_external_image');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.externalLinkPreserved, true);
      assert.equal(f.evidence.embeddedMedia, false);
      assert.match(f.evidence.response, /V10SLIDE/);
      const { confirmed, unconfirmed } = verifyFindings(findings);
      assert.equal(confirmed.length, 1, JSON.stringify(unconfirmed));
      assert.equal(confirmed[0].confirmation, 'confirmed');
    } finally {
      fx.server.close();
    }
  });

  it('no document links — no finding, skipped noted', async () => {
    const fx = await startFixture('nolinks');
    try {
      const diag = {};
      const findings = await probePresentationExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.skipped, 'no document targets');
    } finally {
      fx.server.close();
    }
  });
});
