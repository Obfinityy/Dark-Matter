// Tests for the metadata leakage probe
// (coverage row #178 [Low], phase 74).
// No network, no lab needed — fetches go through the opts.fetchPage /
// opts.fetchBytes seams, and image fixtures are built in-code (a small
// TIFF writer + JPEG/PNG/WebP wrappers).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeMetadataLeakage,
  buildMetadataTargets,
  extractImageMetadata,
  detectMetadataLeaks,
  parseTiff,
} from './metadataLeakage.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://lab.local/gallery.html';
const BASELINE =
  '<html><body><h1>Gallery</h1><img src="/photos/shot1.jpg"><img src="/photos/shot2.png"></body></html>';
const IMG1 = 'http://lab.local/photos/shot1.jpg';
const IMG2 = 'http://lab.local/photos/shot2.png';
const IMG3 = 'http://lab.local/photos/shot3.jpg';

// ---- Fixture builders ------------------------------------------------

// Decimal degrees -> [d, m, s] rationals (denominator 100 for seconds).
function dms(value) {
  const a = Math.abs(value);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60 * 100);
  return [
    [d, 1],
    [m, 1],
    [s, 100],
  ];
}

// Minimal little-endian TIFF writer. fields: { make, model, software,
// artist, serial, gps: { lat, lon } }. Returns a Buffer.
function buildTiff(fields = {}) {
  // IFD0 entry count is fixed up front so the data area starts at a
  // known offset — every allocated offset is absolute from the start.
  const nIfd0 =
    (fields.make !== undefined ? 1 : 0) +
    (fields.model !== undefined ? 1 : 0) +
    (fields.software !== undefined ? 1 : 0) +
    (fields.artist !== undefined ? 1 : 0) +
    (fields.gps ? 1 : 0) +
    (fields.serial !== undefined ? 1 : 0);
  const dataStart = 8 + 2 + nIfd0 * 12 + 4;
  const ifd0 = [];
  const chunks = [];
  let cursor = dataStart;
  const alloc = (buf) => {
    const at = cursor;
    chunks.push({ buf, at });
    cursor += buf.length;
    return at;
  };
  const asciiEntry = (tag, value) => {
    if (value === undefined) return;
    const buf = Buffer.from(`${value}\0`, 'latin1');
    if (buf.length <= 4) {
      const inline = Buffer.alloc(4);
      buf.copy(inline);
      ifd0.push({ tag, type: 2, count: buf.length, inline });
    } else {
      ifd0.push({ tag, type: 2, count: buf.length, offset: alloc(buf) });
    }
  };
  asciiEntry(0x010f, fields.make);
  asciiEntry(0x0110, fields.model);
  asciiEntry(0x0131, fields.software);
  asciiEntry(0x013b, fields.artist);

  // GPS IFD (allocated after the IFD0 size is known).
  let gpsOff = null;
  if (fields.gps) {
    const latParts = dms(fields.gps.lat);
    const lonParts = dms(fields.gps.lon);
    const latBuf = Buffer.alloc(24);
    const lonBuf = Buffer.alloc(24);
    latParts.forEach(([n, d], i) => {
      latBuf.writeUInt32LE(n, i * 8);
      latBuf.writeUInt32LE(d, i * 8 + 4);
    });
    lonParts.forEach(([n, d], i) => {
      lonBuf.writeUInt32LE(n, i * 8);
      lonBuf.writeUInt32LE(d, i * 8 + 4);
    });
    const latOff = alloc(latBuf);
    const lonOff = alloc(lonBuf);
    const latRef = Buffer.from(fields.gps.lat < 0 ? 'S\0' : 'N\0', 'latin1');
    const lonRef = Buffer.from(fields.gps.lon < 0 ? 'W\0' : 'E\0', 'latin1');
    const latRefInline = Buffer.alloc(4);
    latRef.copy(latRefInline);
    const lonRefInline = Buffer.alloc(4);
    lonRef.copy(lonRefInline);
    const gpsBlock = Buffer.alloc(2 + 4 * 12 + 4);
    gpsBlock.writeUInt16LE(4, 0);
    const gpsEntries = [
      { tag: 0x0001, type: 2, count: 2, inline: latRefInline },
      { tag: 0x0002, type: 5, count: 3, offset: latOff },
      { tag: 0x0003, type: 2, count: 2, inline: lonRefInline },
      { tag: 0x0004, type: 5, count: 3, offset: lonOff },
    ];
    gpsEntries.forEach((e, i) => {
      const p = 2 + i * 12;
      gpsBlock.writeUInt16LE(e.tag, p);
      gpsBlock.writeUInt16LE(e.type, p + 2);
      gpsBlock.writeUInt32LE(e.count, p + 4);
      if (e.inline) e.inline.copy(gpsBlock, p + 8);
      else gpsBlock.writeUInt32LE(e.offset, p + 8);
    });
    gpsBlock.writeUInt32LE(0, 2 + 4 * 12);
    gpsOff = alloc(gpsBlock);
    ifd0.push({ tag: 0x8825, type: 4, count: 1, offset: gpsOff });
  }

  // Exif IFD (body serial number).
  if (fields.serial !== undefined) {
    const serialBuf = Buffer.from(`${fields.serial}\0`, 'latin1');
    const serialOff = serialBuf.length <= 4 ? null : alloc(serialBuf);
    const exifBlock = Buffer.alloc(2 + 1 * 12 + 4);
    exifBlock.writeUInt16LE(1, 0);
    exifBlock.writeUInt16LE(0xa431, 2);
    exifBlock.writeUInt16LE(2, 4);
    exifBlock.writeUInt32LE(serialBuf.length, 6);
    if (serialOff === null) {
      const inline = Buffer.alloc(4);
      serialBuf.copy(inline);
      inline.copy(exifBlock, 10);
    } else {
      exifBlock.writeUInt32LE(serialOff, 10);
    }
    exifBlock.writeUInt32LE(0, 14);
    const exifOff = alloc(exifBlock);
    ifd0.push({ tag: 0x8769, type: 4, count: 1, offset: exifOff });
  }

  // Assemble: header + IFD0 + allocated chunks at absolute offsets.
  const total = cursor;
  const out = Buffer.alloc(total);
  out.write('II', 0, 'latin1');
  out.writeUInt16LE(42, 2);
  out.writeUInt32LE(8, 4);
  out.writeUInt16LE(ifd0.length, 8);
  ifd0.forEach((e, i) => {
    const p = 10 + i * 12;
    out.writeUInt16LE(e.tag, p);
    out.writeUInt16LE(e.type, p + 2);
    out.writeUInt32LE(e.count, p + 4);
    if (e.inline) e.inline.copy(out, p + 8);
    else out.writeUInt32LE(e.offset, p + 8);
  });
  out.writeUInt32LE(0, 10 + ifd0.length * 12);
  for (const c of chunks) c.buf.copy(out, c.at);
  return out;
}

function wrapJpeg(tiffBuf, withApp0 = false) {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (withApp0) {
    const app0 = Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1');
    const len = Buffer.alloc(2);
    len.writeUInt16BE(app0.length + 2, 0);
    parts.push(Buffer.from([0xff, 0xe0]), len, app0);
  }
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiffBuf]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2, 0);
  parts.push(Buffer.from([0xff, 0xe1]), len, payload, Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
}

function wrapPng({ textChunks = [], exif = null, ztext = null } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
  ];
  for (const [key, value] of textChunks) {
    parts.push(pngChunk('tEXt', Buffer.from(`${key}\0${value}`, 'latin1')));
  }
  if (ztext) {
    const [key, value] = ztext;
    const compressed = deflateRaw(value);
    parts.push(
      pngChunk('zTXt', Buffer.concat([Buffer.from(`${key}\0`, 'latin1'), Buffer.from([0]), compressed]))
    );
  }
  if (exif) parts.push(pngChunk('eXIf', exif));
  parts.push(pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// Minimal zlib wrapper for the zTXt fixture (node:zlib deflateSync).
import { deflateSync } from 'node:zlib';
function deflateRaw(value) {
  return deflateSync(Buffer.from(value, 'latin1'));
}

function wrapWebp(tiffBuf) {
  const exifChunk = Buffer.concat([
    Buffer.from('EXIF', 'latin1'),
    (() => {
      const l = Buffer.alloc(4);
      l.writeUInt32LE(tiffBuf.length, 0);
      return l;
    })(),
    tiffBuf,
  ]);
  const riffSize = Buffer.alloc(4);
  riffSize.writeUInt32LE(4 + exifChunk.length, 0);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), riffSize, Buffer.from('WEBP', 'latin1'), exifChunk]);
}

const GPS_TIFF = () =>
  buildTiff({
    make: 'Canon',
    model: 'EOS 5D',
    software: 'Adobe Lightroom 12.0 /home/jdoe/photos',
    artist: 'Jane Doe',
    serial: 'SN12345678',
    gps: { lat: 26.9124, lon: 75.7873 },
  });

const GPS_JPEG = () => wrapJpeg(GPS_TIFF());
const GPS_ONLY_JPEG = () => wrapJpeg(buildTiff({ gps: { lat: 26.9124, lon: 75.7873 } }));
const BENIGN_JPEG = () =>
  wrapJpeg(
    buildTiff({ make: 'Canon', model: 'EOS 5D', software: 'Adobe Photoshop 24.0' })
  );
const NO_EXIF_JPEG = () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

// fetchPage seam: map URL -> { status, headers, body }. Unknown URLs 404.
function fetchPageFor(bodies, calls) {
  return async (url) => {
    if (Array.isArray(calls)) calls.push(String(url));
    const entry = bodies[String(url)];
    if (entry === undefined) return { status: 404, body: 'Not Found' };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

// fetchBytes seam: map URL -> { status, body: Buffer }. Unknown URLs 404.
function fetchBytesFor(bodies, calls) {
  return async (url) => {
    if (Array.isArray(calls)) calls.push(String(url));
    const entry = bodies[String(url)];
    if (entry === undefined) return { status: 404, body: Buffer.alloc(0) };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

describe('parseTiff / extractImageMetadata', () => {
  it('a JPEG GPS payload parses lat/lon + serial + author + software', () => {
    const meta = extractImageMetadata(GPS_JPEG(), 'jpg');
    assert.ok(meta);
    assert.ok(Math.abs(meta.gps.lat - 26.9124) < 0.0001, `lat ${meta.gps.lat}`);
    assert.ok(Math.abs(meta.gps.lon - 75.7873) < 0.0001, `lon ${meta.gps.lon}`);
    assert.equal(meta.serial, 'SN12345678');
    assert.equal(meta.author, 'Jane Doe');
    assert.equal(meta.software, 'Adobe Lightroom 12.0 /home/jdoe/photos');
  });

  it('a JPEG with only make/model/software is parsed but carries no sensitive field', () => {
    const meta = extractImageMetadata(BENIGN_JPEG(), 'jpg');
    assert.ok(meta);
    assert.equal(meta.gps, null);
    assert.equal(meta.serial, null);
    assert.equal(meta.author, null);
    assert.equal(meta.software, 'Adobe Photoshop 24.0');
  });

  it('a JPEG with no EXIF segment returns null', () => {
    assert.equal(extractImageMetadata(NO_EXIF_JPEG(), 'jpg'), null);
  });

  it('a JPEG with an APP0 segment before APP1 still finds the EXIF', () => {
    const meta = extractImageMetadata(wrapJpeg(GPS_TIFF(), true), 'jpg');
    assert.ok(meta && meta.gps);
    assert.ok(Math.abs(meta.gps.lat - 26.9124) < 0.0001);
  });

  it('a truncated JPEG never throws', () => {
    const buf = GPS_JPEG().subarray(0, 20);
    assert.equal(extractImageMetadata(buf, 'jpg'), null);
  });

  it('a PNG tEXt Author chunk parses as author', () => {
    const png = wrapPng({ textChunks: [['Author', 'Jane Doe']] });
    const meta = extractImageMetadata(png, 'png');
    assert.ok(meta);
    assert.equal(meta.author, 'Jane Doe');
    assert.equal(meta.gps, null);
  });

  it('a PNG eXIf chunk parses GPS like a JPEG', () => {
    const png = wrapPng({ exif: GPS_TIFF() });
    const meta = extractImageMetadata(png, 'png');
    assert.ok(meta && meta.gps);
    assert.ok(Math.abs(meta.gps.lon - 75.7873) < 0.0001);
  });

  it('a PNG with only an IHDR returns null', () => {
    assert.equal(extractImageMetadata(wrapPng({}), 'png'), null);
  });

  it('a PNG zTXt Author chunk inflates and parses', () => {
    const png = wrapPng({ ztext: ['Author', 'Jane Doe'] });
    const meta = extractImageMetadata(png, 'png');
    assert.ok(meta);
    assert.equal(meta.author, 'Jane Doe');
  });

  it('a raw TIFF file parses directly', () => {
    const meta = extractImageMetadata(GPS_TIFF(), 'tif');
    assert.ok(meta && meta.gps);
    assert.equal(meta.serial, 'SN12345678');
  });

  it('a WebP EXIF chunk parses GPS', () => {
    const meta = extractImageMetadata(wrapWebp(GPS_TIFF()), 'webp');
    assert.ok(meta && meta.gps);
    assert.ok(Math.abs(meta.gps.lat - 26.9124) < 0.0001);
  });

  it('a GIF and random garbage return null without throwing', () => {
    assert.equal(extractImageMetadata(Buffer.from('GIF89a................', 'latin1'), 'gif'), null);
    assert.equal(extractImageMetadata(Buffer.from('not an image at all, just text', 'latin1'), 'jpg'), null);
  });

  it('parseTiff rejects a bad magic number', () => {
    const bad = Buffer.from(GPS_TIFF());
    bad.writeUInt16LE(43, 2);
    assert.equal(parseTiff(bad), null);
  });
});

describe('detectMetadataLeaks', () => {
  const META = {
    gps: { lat: 26.9124, lon: 75.7873 },
    serial: 'SN12345678',
    author: 'Jane Doe',
    software: 'Adobe Lightroom 12.0 /home/jdoe/photos',
  };

  it('GPS + serial + author + software-path all fire on a clean baseline', () => {
    const leaks = detectMetadataLeaks(META, BASELINE);
    assert.deepEqual(
      leaks.map((l) => l.kind).sort(),
      ['author', 'gps', 'serial', 'software-path']
    );
  });

  it('GPS already printed on the baseline page does not fire', () => {
    const leaks = detectMetadataLeaks(META, `${BASELINE} Store at 26.9124, 75.7873 — visit us!`);
    assert.deepEqual(
      leaks.map((l) => l.kind).sort(),
      ['author', 'serial', 'software-path']
    );
  });

  it('a serial already on the baseline page does not fire', () => {
    const leaks = detectMetadataLeaks(META, `${BASELINE} Unit SN12345678 on display.`);
    assert.ok(!leaks.some((l) => l.kind === 'serial'));
    assert.ok(leaks.some((l) => l.kind === 'gps'));
  });

  it('an author already on the baseline page does not fire (case-insensitive)', () => {
    const leaks = detectMetadataLeaks(META, `${BASELINE} Photos by jane doe.`);
    assert.ok(!leaks.some((l) => l.kind === 'author'));
    assert.ok(leaks.some((l) => l.kind === 'gps'));
  });

  it('a plain software name without a user path never fires', () => {
    assert.deepEqual(detectMetadataLeaks({ software: 'Adobe Photoshop 24.0' }, BASELINE), []);
  });

  it('a software string with a Windows user path fires', () => {
    const leaks = detectMetadataLeaks({ software: 'Lightroom C:\\Users\\jdoe\\photos' }, BASELINE);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].kind, 'software-path');
  });

  it('benign-only metadata fires nothing', () => {
    assert.deepEqual(
      detectMetadataLeaks({ gps: null, serial: null, author: null, software: 'Adobe Photoshop 24.0' }, BASELINE),
      []
    );
  });

  it('null metadata fires nothing', () => {
    assert.deepEqual(detectMetadataLeaks(null, BASELINE), []);
  });

  it('the GPS display rounds coordinates to ~1km', () => {
    const leaks = detectMetadataLeaks({ gps: { lat: 26.9124, lon: 75.7873 } }, BASELINE);
    assert.equal(leaks.length, 1);
    assert.equal(leaks[0].value, '26.91, 75.79');
  });
});

describe('buildMetadataTargets', () => {
  it('collects <img> sources, resolving relative URLs against the page', () => {
    const targets = buildMetadataTargets(PAGE, [], BASELINE);
    assert.deepEqual(
      targets.map((t) => t.url).sort(),
      [IMG1, IMG2]
    );
  });

  it('collects <a> links to image files and ignores other links', () => {
    const html = '<html><body><a href="/photos/big.png">full</a><a href="/about.html">about</a></body></html>';
    const targets = buildMetadataTargets(PAGE, [], html);
    assert.deepEqual(
      targets.map((t) => t.url),
      ['http://lab.local/photos/big.png']
    );
  });

  it('drops cross-origin images', () => {
    const html = '<html><body><img src="https://cdn.example.com/x.jpg"></body></html>';
    assert.deepEqual(buildMetadataTargets(PAGE, [], html), []);
  });

  it('dedups the same image via img + link', () => {
    const html = `<html><body><img src="/photos/shot1.jpg"><a href="/photos/shot1.jpg">x</a></body></html>`;
    const targets = buildMetadataTargets(PAGE, [], html);
    assert.equal(targets.length, 1);
  });

  it('the pasted URL itself is a candidate when it IS an image', () => {
    const targets = buildMetadataTargets(IMG1, [], '<html></html>');
    assert.deepEqual(
      targets.map((t) => t.url),
      [IMG1]
    );
  });

  it('caps candidates at 10', () => {
    const imgs = Array.from({ length: 15 }, (_, i) => `<img src="/p${i}.jpg">`).join('');
    const targets = buildMetadataTargets(PAGE, [], `<html><body>${imgs}</body></html>`);
    assert.equal(targets.length, 10);
  });

  it('an unparseable page URL returns no targets', () => {
    assert.deepEqual(buildMetadataTargets('::bad::', [], BASELINE), []);
  });
});

describe('probeMetadataLeakage', () => {
  it('a GPS-only JPEG is one Low finding and verifyFindings confirms it', async () => {
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({
        [IMG1]: { status: 200, body: GPS_ONLY_JPEG() },
        [IMG2]: { status: 200, body: BENIGN_JPEG() },
      }),
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'metadata_leakage');
    assert.equal(findings[0].severity, 'low');
    assert.equal(findings[0].url, IMG1);
    assert.match(findings[0].title, /GPS coordinates/);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });

  it('a fully-loaded JPEG fires one finding per sensitive kind (gps, serial, author, software-path)', async () => {
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({
        [IMG1]: { status: 200, body: GPS_JPEG() },
        [IMG2]: { status: 200, body: BENIGN_JPEG() },
      }),
    });
    assert.equal(findings.length, 4);
    assert.deepEqual(
      findings.map((f) => f.title.match(/GPS coordinates|serial number|author name|internal user path/)[0]).sort(),
      ['GPS coordinates', 'author name', 'internal user path', 'serial number']
    );
  });

  it('an author PNG is a Low finding', async () => {
    const png = wrapPng({ textChunks: [['Author', 'Jane Doe']] });
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({
        [IMG1]: { status: 200, body: BENIGN_JPEG() },
        [IMG2]: { status: 200, body: png },
      }),
    });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /author name/);
  });

  it('a benign JPEG fires nothing', async () => {
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({ [IMG1]: { status: 200, body: BENIGN_JPEG() } }),
    });
    assert.equal(findings.length, 0);
  });

  it('an image URL serving HTML (SPA fallback) fires nothing', async () => {
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({ [IMG1]: { status: 200, body: Buffer.from(BASELINE, 'latin1') } }),
    });
    assert.equal(findings.length, 0);
  });

  it('an author already named on the baseline page fires nothing', async () => {
    const png = wrapPng({ textChunks: [['Author', 'Jane Doe']] });
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, body: `${BASELINE}<p>Photos by Jane Doe.</p>` },
      }),
      fetchBytes: fetchBytesFor({ [IMG2]: { status: 200, body: png } }),
    });
    assert.equal(findings.length, 0);
  });

  it('a non-200 image fires nothing', async () => {
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({ [IMG1]: { status: 404, body: Buffer.alloc(0) } }),
    });
    assert.equal(findings.length, 0);
  });

  it('two GPS-only images are two findings', async () => {
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({
        [IMG1]: { status: 200, body: GPS_ONLY_JPEG() },
        [IMG2]: { status: 200, body: GPS_ONLY_JPEG() },
      }),
    });
    assert.equal(findings.length, 2);
  });

  it('a serial-only JPEG is one finding', async () => {
    const serialJpeg = wrapJpeg(buildTiff({ serial: 'SN999' }));
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: fetchBytesFor({ [IMG1]: { status: 200, body: serialJpeg } }),
    });
    assert.equal(findings.length, 1);
    assert.match(findings[0].title, /serial number/);
  });

  it('the fetch budget is respected (baseline + at most 10 image fetches)', async () => {
    const calls = [];
    const bytes = {};
    for (let i = 0; i < 12; i += 1) bytes[`http://lab.local/p${i}.jpg`] = { status: 200, body: GPS_ONLY_JPEG() };
    const imgs = Array.from({ length: 12 }, (_, i) => `<img src="/p${i}.jpg">`).join('');
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: `<html><body>${imgs}</body></html>` } }),
      fetchBytes: fetchBytesFor(bytes, calls),
    });
    assert.ok(calls.length <= 10, `byte fetches ${calls.length}`);
    assert.equal(findings.length, 10);
  });

  it('a throwing byte fetcher never throws the probe', async () => {
    const findings = await probeMetadataLeakage(PAGE, [], {
      fetchPage: fetchPageFor({ [PAGE]: { status: 200, body: BASELINE } }),
      fetchBytes: async () => {
        throw new Error('boom');
      },
    });
    assert.deepEqual(findings, []);
  });
});
