// OOXML package analysis (V10-F4/F5, V10-VC-1) — unit tests.
//
// Synthetic packages are built in-test with a minimal ZIP writer
// (stored + deflated entries, no dependency). The shapes mirror the
// real V10 artifacts first-hand: the docx carries rId9
// TargetMode="External" + <a:blip r:link="rId9"/> and no word/media/;
// the xlsx carries rId1 TargetMode="External" + <a:blip r:link="rId1"/>
// and no xl/media/; the pptx embeds (r:embed + ppt/media/) and holds
// no external URL. The live-proof driver (v10-live-proof.mjs) runs
// the same analysis against those real files.
import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
  readZipEntries,
  parseImageRels,
  findBlipRefs,
  analyzeOfficePackage,
  discoverDocumentUrls,
} from './officePackage.js';

// Minimal ZIP writer: entries as [name, content, method?] (method 0
// stored, 8 deflated). CRC is left 0 — the reader does not verify it.
export function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content, method = 0] of entries) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralDir = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDir, end]);
}

const LINKED_DOCX_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://httpbin.org/image/png?marker=V10DOC" TargetMode="External"/>` +
  `</Relationships>`;

const LINKED_DOCX_BODY =
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><a:blip r:link="rId9"/></w:p></w:body></w:document>`;

const EMBEDDED_DOCX_RELS =
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>` +
  `</Relationships>`;

const EMBEDDED_DOCX_BODY =
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><a:blip r:embed="rId2"/></w:p></w:body></w:document>`;

function linkedDocx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['word/document.xml', LINKED_DOCX_BODY],
    ['word/_rels/document.xml.rels', LINKED_DOCX_RELS],
  ]);
}

function embeddedDocx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['word/document.xml', EMBEDDED_DOCX_BODY],
    ['word/_rels/document.xml.rels', EMBEDDED_DOCX_RELS],
    ['word/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ]);
}

function linkedXlsx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['xl/workbook.xml', '<workbook/>'],
    [
      'xl/drawings/drawing1.xml',
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:pic><a:blip r:link="rId1"/></xdr:pic></xdr:wsDr>`,
    ],
    [
      'xl/drawings/_rels/drawing1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://httpbin.org/image/png?marker=V10SHEET" TargetMode="External"/></Relationships>`,
    ],
  ]);
}

function embeddedPptx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['ppt/presentation.xml', '<p:presentation/>'],
    [
      'ppt/slides/slide1.xml',
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><a:blip r:embed="rId2"/></p:sld>`,
    ],
    [
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`,
    ],
    ['ppt/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ]);
}

function linkedPptx() {
  return makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['ppt/presentation.xml', '<p:presentation/>'],
    [
      'ppt/slides/slide1.xml',
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><a:blip r:link="rId1"/></p:sld>`,
    ],
    [
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://httpbin.org/image/png?marker=V10SLIDE" TargetMode="External"/></Relationships>`,
    ],
  ]);
}

describe('readZipEntries', () => {
  it('reads stored entries', () => {
    const entries = readZipEntries(makeZip([['a.txt', 'hello'], ['b/c.txt', 'world']]));
    assert.equal(entries.get('a.txt').toString('utf8'), 'hello');
    assert.equal(entries.get('b/c.txt').toString('utf8'), 'world');
  });

  it('inflates deflated entries', () => {
    const entries = readZipEntries(makeZip([['a.txt', 'hello deflated world', 8]]));
    assert.equal(entries.get('a.txt').toString('utf8'), 'hello deflated world');
  });

  it('returns an empty Map for a non-ZIP buffer', () => {
    assert.equal(readZipEntries(Buffer.from('<html>not a zip</html>')).size, 0);
    assert.equal(readZipEntries(Buffer.alloc(0)).size, 0);
  });

  it('stops cleanly at a truncated entry (never throws)', () => {
    const good = makeZip([['a.txt', 'hello']]);
    const truncated = Buffer.concat([good, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])]);
    const entries = readZipEntries(truncated);
    assert.equal(entries.get('a.txt').toString('utf8'), 'hello');
  });
});

describe('parseImageRels / findBlipRefs', () => {
  it('parses image rels only (skips styles/settings rels)', () => {
    const rels = parseImageRels(
      `<Relationships><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.invalid/x.png" TargetMode="External"/></Relationships>`
    );
    assert.deepEqual(rels, [{ id: 'rId9', target: 'https://example.invalid/x.png', targetMode: 'External' }]);
  });

  it('finds r:link and r:embed blips', () => {
    assert.deepEqual(findBlipRefs('<a:blip r:link="rId9"/><a:blip r:embed="rId2"/>'), [
      { id: 'rId9', mode: 'link' },
      { id: 'rId2', mode: 'embed' },
    ]);
  });
});

describe('analyzeOfficePackage', () => {
  it('docx: flags the linked external image, no embedding', () => {
    const a = analyzeOfficePackage(linkedDocx());
    assert.equal(a.kind, 'docx');
    assert.deepEqual(a.externalImages, [
      { relId: 'rId9', target: 'https://httpbin.org/image/png?marker=V10DOC', sourceFile: 'word/_rels/document.xml.rels', alsoEmbedded: false },
    ]);
    assert.deepEqual(a.embeddedImages, []);
    assert.equal(a.hasMedia, false);
  });

  it('docx: embedded image is the control, not a channel', () => {
    const a = analyzeOfficePackage(embeddedDocx());
    assert.equal(a.kind, 'docx');
    assert.deepEqual(a.externalImages, []);
    assert.equal(a.embeddedImages.length, 1);
    assert.equal(a.embeddedImages[0].relId, 'rId2');
    assert.equal(a.hasMedia, true);
  });

  it('xlsx: flags the linked external picture in the drawing rels', () => {
    const a = analyzeOfficePackage(linkedXlsx());
    assert.equal(a.kind, 'xlsx');
    assert.equal(a.externalImages.length, 1);
    assert.equal(a.externalImages[0].relId, 'rId1');
    assert.equal(a.externalImages[0].target, 'https://httpbin.org/image/png?marker=V10SHEET');
    assert.equal(a.hasMedia, false);
  });

  it('pptx: embedded slides are the control (V10-VC-1)', () => {
    const a = analyzeOfficePackage(embeddedPptx());
    assert.equal(a.kind, 'pptx');
    assert.deepEqual(a.externalImages, []);
    assert.equal(a.embeddedImages.length, 1);
    assert.equal(a.hasMedia, true);
    assert.equal(a.mediaCount, 1);
  });

  it('pptx: a linked image WOULD be flagged (same rule, other outcome)', () => {
    const a = analyzeOfficePackage(linkedPptx());
    assert.equal(a.kind, 'pptx');
    assert.equal(a.externalImages.length, 1);
    assert.equal(a.externalImages[0].target, 'https://httpbin.org/image/png?marker=V10SLIDE');
  });

  it('returns null for a non-OOXML zip and for non-ZIP bytes', () => {
    assert.equal(analyzeOfficePackage(makeZip([['a.txt', 'hello']])), null);
    assert.equal(analyzeOfficePackage(Buffer.from('not a zip')), null);
  });

  it('ignores an external rel with no matching r:link blip', () => {
    const pkg = makeZip([
      ['[Content_Types].xml', '<Types/>'],
      ['word/document.xml', '<w:document/>'],
      ['word/_rels/document.xml.rels', LINKED_DOCX_RELS],
    ]);
    const a = analyzeOfficePackage(pkg);
    assert.deepEqual(a.externalImages, []);
  });
});

describe('discoverDocumentUrls', () => {
  it('resolves relative hrefs and filters by extension', () => {
    const html = `<a href="/files/report.docx">d</a><a href="sheet.XLSX">s</a><a href="https://example.invalid/x.pptx">p</a><a href="/index.html">h</a>`;
    assert.deepEqual(discoverDocumentUrls(html, 'http://127.0.0.1:9/app/', ['.docx', '.xlsx', '.pptx']), [
      'http://127.0.0.1:9/files/report.docx',
      'http://127.0.0.1:9/app/sheet.XLSX',
      'https://example.invalid/x.pptx',
    ]);
  });

  it('dedupes and skips non-http(s) hrefs', () => {
    const html = `<a href="/a.docx">1</a><a href="/a.docx">2</a><a href="javascript:void(0)">3</a>`;
    assert.deepEqual(discoverDocumentUrls(html, 'http://127.0.0.1:9/', ['.docx']), ['http://127.0.0.1:9/a.docx']);
  });
});
