// Generated-spreadsheet (.xlsx) external-image probe (V10-F5) — tests.
//
// Fixture: a page linking to /export.xlsx, served as a synthetic
// .xlsx built in-test (stored ZIP entries only). Linked =
// TargetMode="External" + <a:blip r:link> in the drawing, no
// xl/media/. Embedded = r:embed + xl/media/. No network beyond
// localhost; no collaborator; no Meta spend.
import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeSpreadsheetExternalImage } from './spreadsheetExternalImage.js';
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

const LINKED_DRAWING =
  `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:pic><a:blip r:link="rId1"/></xdr:pic></xdr:wsDr>`;
const LINKED_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://httpbin.org/image/png?marker=V10SHEET" TargetMode="External"/></Relationships>`;
const EMBEDDED_DRAWING =
  `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:pic><a:blip r:embed="rId2"/></xdr:pic></xdr:wsDr>`;
const EMBEDDED_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`;

function linkedXlsx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['xl/workbook.xml', '<workbook/>'],
    ['xl/drawings/drawing1.xml', LINKED_DRAWING],
    ['xl/drawings/_rels/drawing1.xml.rels', LINKED_RELS],
  ]);
}

function embeddedXlsx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['xl/workbook.xml', '<workbook/>'],
    ['xl/drawings/drawing1.xml', EMBEDDED_DRAWING],
    ['xl/drawings/_rels/drawing1.xml.rels', EMBEDDED_RELS],
    ['xl/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ]);
}

// Modes: linked | embedded | nolinks.
function startFixture(mode) {
  const xlsx = mode === 'embedded' ? embeddedXlsx() : linkedXlsx();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://fixture.invalid');
    if (u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        mode === 'nolinks'
          ? '<html><body><p>no documents here</p></body></html>'
          : '<html><body><a href="/export.xlsx">Download sheet</a></body></html>'
      );
      return;
    }
    if (u.pathname === '/export.xlsx') {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      res.end(xlsx);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

describe('probeSpreadsheetExternalImage', () => {
  it('flags a linked external picture and the verifier confirms it', async () => {
    const fx = await startFixture('linked');
    try {
      const diag = {};
      const findings = await probeSpreadsheetExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.equal(findings.length, 1, JSON.stringify(findings));
      const f = findings[0];
      assert.equal(f.class, 'spreadsheet_external_image');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.externalLinkPreserved, true);
      assert.equal(f.evidence.embeddedMedia, false);
      assert.match(f.evidence.response, /TargetMode="External"/);
      assert.match(f.evidence.response, /V10SHEET/);
      assert.match(f.evidence.response, /r:link="rId1"/);
      assert.equal(diag.documentsChecked, 1);
      assert.equal(diag.externalFound, 1);
      const { confirmed, unconfirmed } = verifyFindings(findings);
      assert.equal(confirmed.length, 1, JSON.stringify(unconfirmed));
      assert.equal(confirmed[0].confirmation, 'confirmed');
    } finally {
      fx.server.close();
    }
  });

  it('embedded picture is the control — no finding, controlStatus recorded', async () => {
    const fx = await startFixture('embedded');
    try {
      const diag = {};
      const findings = await probeSpreadsheetExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.match(diag.controlStatus || '', /embedded/);
    } finally {
      fx.server.close();
    }
  });

  it('no document links — no finding, skipped noted', async () => {
    const fx = await startFixture('nolinks');
    try {
      const diag = {};
      const findings = await probeSpreadsheetExternalImage(`http://127.0.0.1:${fx.port}/`, { diagnostics: diag });
      assert.deepEqual(findings, []);
      assert.equal(diag.skipped, 'no document targets');
    } finally {
      fx.server.close();
    }
  });
});
