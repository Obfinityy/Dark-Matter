// Dark Matter rule-based scanner — metadata leakage (EXIF / document metadata)
// (coverage row #178 [Low], phase 74).
//
// DIAGNOSIS: an image or document served with its embedded metadata
// intact — GPS coordinates in a JPEG's EXIF, a camera serial number,
// an author name, or a software string carrying an internal user path
// — hands the attacker the photographer's location, device identity
// or workstation layout without any login. A photo of a whiteboard
// can leak the office's GPS; a serial ties images to one device
// across the web.
//
// VERIFICATION (100% truth rule): a finding counts ONLY when the
// fetched file actually carries a SENSITIVE metadata field. Benign
// metadata (dimensions, color profile, orientation, resolution,
// camera make/model alone, a plain software name) is NEVER a
// finding. A value already printed on the pasted page is NEVER a
// finding (mandatory baseline differential — the author/GPS/serial
// must not appear in the baseline page body). One finding per
// distinct file + sensitive field kind. The metadata is parsed from
// raw bytes (JPEG APP1 EXIF, PNG eXIf/tEXt/iTXt/zTXt, TIFF, WebP
// EXIF) — a 200 status alone is NEVER a finding, and an HTML shell
// served for an image path is NEVER a finding.
//
// NON-OVERLAP (by design): this probe targets EMBEDDED metadata
// only. JS bundle contents are already mined by 'secrets-in-js';
// error responses by 'error-disclosure'; HTTP headers by
// 'fingerprint-banner'. A .js/.ts file served normally is a public
// static asset, not a disclosure. PDF/DOCX metadata is out of scope
// (no dependency for their parsers — honest open item).
//
// SAFETY: read-only GETs only — no writes, no allowWrite gate.
// Baseline page (HTML, via the fetchPage seam) + up to 10 image
// fetches (raw bytes, via the fetchBytes seam, 5MB cap each). The
// pasted page is always a surface, so this phase never skips.
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fetchPage } from '../fingerprint.js';

const MAX_FETCHES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FINDINGS = 20;

// Image extensions eligible for metadata checks. Static assets that
// carry no EXIF (.svg, .ico, .gif, .bmp) are deliberately NOT here.
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp']);

// TIFF tag ids we act on.
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_SOFTWARE = 0x0131;
const TAG_ARTIST = 0x013b;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LON_REF = 0x0003;
const TAG_GPS_LON = 0x0004;
const TAG_BODY_SERIAL = 0xa431;
const TAG_XP_AUTHOR = 0x9c9d;

// A software string is a leak only when it carries an internal user
// path (a username or workstation layout), not when it is a plain
// product name like "Adobe Photoshop".
const USER_PATH_RE = /(?:\/home\/|\/Users\/|\/var\/home\/|[A-Za-z]:\\Users\\)[^\s\\/]+/;

// PNG textual keywords that carry identity (case-insensitive).
const PNG_AUTHOR_KEYS = new Set(['author', 'creator', 'artist']);
const PNG_SERIAL_KEYS = new Set(['serial number', 'serialnumber', 'camera serial']);
const PNG_SOFTWARE_KEYS = new Set(['software']);

function sha12(text) {
  return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

function fileExtension(pathname) {
  const base = String(pathname || '').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function toBuffer(body) {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (typeof body === 'string') return Buffer.from(body, 'latin1');
  return null;
}

// ---- TIFF parsing (shared by JPEG APP1, PNG eXIf, TIFF, WebP) ------

const TIFF_TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function tiffView(buf) {
  if (!buf || buf.length < 8) return null;
  const le = buf[0] === 0x49 && buf[1] === 0x49;
  const be = buf[0] === 0x4d && buf[1] === 0x4d;
  if (!le && !be) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint16(2, le) !== 42) return null;
  return { view, le };
}

// Read one IFD at absolute offset `ifdOff` (relative to the TIFF
// start `base`). Returns a Map tag -> { type, count, valueOff }.
function readIfd(view, le, base, ifdOff) {
  const out = new Map();
  if (ifdOff < 0 || ifdOff + 2 > view.byteLength) return out;
  const count = view.getUint16(base + ifdOff, le);
  if (count > 200) return out;
  for (let i = 0; i < count; i += 1) {
    const e = base + ifdOff + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = view.getUint16(e, le);
    const type = view.getUint16(e + 2, le);
    const n = view.getUint32(e + 4, le);
    const size = TIFF_TYPE_SIZE[type];
    if (!size || n > 100000) continue;
    const total = n * size;
    const valueOff = total <= 4 ? e + 8 : base + view.getUint32(e + 8, le);
    out.set(tag, { type, count: n, valueOff });
  }
  return out;
}

function readAscii(view, le, entry) {
  if (entry.type !== 2) return null;
  const bytes = [];
  for (let i = 0; i < entry.count; i += 1) {
    if (entry.valueOff + i >= view.byteLength) break;
    const b = view.getUint8(entry.valueOff + i);
    if (b === 0) break;
    bytes.push(b);
  }
  if (!bytes.length) return null;
  return Buffer.from(bytes).toString('latin1').trim() || null;
}

function readUtf16Le(view, entry) {
  if (entry.type !== 1) return null;
  const bytes = [];
  for (let i = 0; i < entry.count; i += 1) {
    if (entry.valueOff + i >= view.byteLength) break;
    bytes.push(view.getUint8(entry.valueOff + i));
  }
  if (!bytes.length) return null;
  return Buffer.from(bytes).toString('utf16le').replace(/\0+$/, '').trim() || null;
}

function readRationals(view, le, entry) {
  if ((entry.type !== 5 && entry.type !== 10) || entry.count === 0) return null;
  const out = [];
  for (let i = 0; i < entry.count; i += 1) {
    const off = entry.valueOff + i * 8;
    if (off + 8 > view.byteLength) return null;
    const num = entry.type === 5 ? view.getUint32(off, le) : view.getInt32(off, le);
    const den = entry.type === 5 ? view.getUint32(off + 4, le) : view.getInt32(off + 4, le);
    if (den === 0) return null;
    out.push(num / den);
  }
  return out;
}

function readLong(view, le, entry) {
  if (entry.type !== 4 && entry.type !== 3) return null;
  if (entry.count < 1) return null;
  return entry.type === 4
    ? view.getUint32(entry.valueOff, le)
    : view.getUint16(entry.valueOff, le);
}

function rationalsToDegrees(parts, ref) {
  if (!Array.isArray(parts) || parts.length < 3) return null;
  const deg = parts[0] + parts[1] / 60 + parts[2] / 3600;
  if (!Number.isFinite(deg)) return null;
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  return deg * sign;
}

/**
 * Parse a TIFF payload (JPEG APP1, PNG eXIf, raw .tif, WebP EXIF).
 * Pure — returns { gps, serial, author, software } with nulls for
 * absent fields, or null when the buffer is not TIFF at all.
 */
export function parseTiff(buf) {
  const t = toBuffer(buf);
  if (!t) return null;
  const tv = tiffView(t);
  if (!tv) return null;
  const { view, le } = tv;
  try {
    const ifd0Off = view.getUint32(4, le);
    const ifd0 = readIfd(view, le, 0, ifd0Off);
    const meta = { gps: null, serial: null, author: null, software: null };
    const software = ifd0.get(TAG_SOFTWARE);
    if (software) meta.software = readAscii(view, le, software);
    const artist = ifd0.get(TAG_ARTIST);
    if (artist) meta.author = readAscii(view, le, artist);
    if (!meta.author) {
      const xpAuthor = ifd0.get(TAG_XP_AUTHOR);
      if (xpAuthor) meta.author = readUtf16Le(view, xpAuthor);
    }
    const exifPtr = ifd0.get(TAG_EXIF_IFD);
    if (exifPtr) {
      const exifOff = readLong(view, le, exifPtr);
      if (exifOff !== null) {
        const exif = readIfd(view, le, 0, exifOff);
        const serial = exif.get(TAG_BODY_SERIAL);
        if (serial) meta.serial = readAscii(view, le, serial);
      }
    }
    const gpsPtr = ifd0.get(TAG_GPS_IFD);
    if (gpsPtr) {
      const gpsOff = readLong(view, le, gpsPtr);
      if (gpsOff !== null) {
        const gps = readIfd(view, le, 0, gpsOff);
        const latRef = gps.get(TAG_GPS_LAT_REF);
        const lat = gps.get(TAG_GPS_LAT);
        const lonRef = gps.get(TAG_GPS_LON_REF);
        const lon = gps.get(TAG_GPS_LON);
        const latVal = lat ? rationalsToDegrees(readRationals(view, le, lat), latRef ? readAscii(view, le, latRef) : 'N') : null;
        const lonVal = lon ? rationalsToDegrees(readRationals(view, le, lon), lonRef ? readAscii(view, le, lonRef) : 'E') : null;
        if (latVal !== null && lonVal !== null) meta.gps = { lat: latVal, lon: lonVal };
      }
    }
    return meta;
  } catch {
    return null;
  }
}

// PNG textual chunks: keyword\0value. Returns { author, serial,
// software } (nulls when absent). zTXt is zlib-compressed.
function parsePngTextChunks(buf) {
  const found = { author: null, serial: null, software: null };
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const dataStart = off + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > buf.length) break;
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      let keyword = '';
      let value = '';
      try {
        if (type === 'tEXt') {
          const nul = buf.indexOf(0, dataStart);
          if (nul > dataStart && nul < dataEnd) {
            keyword = buf.toString('latin1', dataStart, nul).trim();
            value = buf.toString('latin1', nul + 1, dataEnd).trim();
          }
        } else if (type === 'zTXt') {
          const nul = buf.indexOf(0, dataStart);
          if (nul > dataStart && nul < dataEnd) {
            keyword = buf.toString('latin1', dataStart, nul).trim();
            value = inflateSync(buf.subarray(nul + 2, dataEnd)).toString('latin1').trim();
          }
        } else {
          // iTXt: keyword NUL compressionFlag compressionMethod language NUL translated NUL text
          const nul = buf.indexOf(0, dataStart);
          if (nul > dataStart && nul < dataEnd) {
            keyword = buf.toString('latin1', dataStart, nul).trim();
            let p = nul + 3;
            const langEnd = buf.indexOf(0, p);
            if (langEnd >= 0) {
              p = langEnd + 1;
              const transEnd = buf.indexOf(0, p);
              if (transEnd >= 0) {
                const raw = buf.subarray(transEnd + 1, dataEnd);
                value = buf[nul + 1] === 1 ? inflateSync(raw).toString('utf8').trim() : raw.toString('utf8').trim();
              }
            }
          }
        }
      } catch {
        keyword = '';
        value = '';
      }
      const key = keyword.toLowerCase();
      if (value) {
        if (!found.author && PNG_AUTHOR_KEYS.has(key)) found.author = value;
        else if (!found.serial && PNG_SERIAL_KEYS.has(key)) found.serial = value;
        else if (!found.software && PNG_SOFTWARE_KEYS.has(key)) found.software = value;
      }
    }
    if (type === 'IEND') break;
    off = dataEnd + 4;
  }
  return found;
}

/**
 * Extract embedded metadata from one image file. Pure — exported for
 * unit tests. Returns { gps, serial, author, software } (nulls for
 * absent fields) or null when the file carries no parseable metadata
 * container at all (no EXIF, no PNG text chunks, unknown format).
 * Never throws on truncated or corrupt input.
 */
export function extractImageMetadata(buf, extension) {
  const b = toBuffer(buf);
  if (!b || b.length < 8) return null;
  const ext = String(extension || '').toLowerCase();
  try {
    // JPEG: scan segments for APP1 "Exif\0\0".
    if ((ext === 'jpg' || ext === 'jpeg' || b[0] === 0xff) && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 4 <= b.length) {
        if (b[i] !== 0xff) break;
        const marker = b[i + 1];
        if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
          i += 2;
          continue;
        }
        const segLen = b.readUInt16BE(i + 2);
        if (segLen < 2 || i + 2 + segLen > b.length) break;
        if (marker === 0xe1 && segLen > 8 && b.toString('latin1', i + 4, i + 10) === 'Exif\0\0') {
          return parseTiff(b.subarray(i + 10, i + 2 + segLen));
        }
        i += 2 + segLen;
      }
      return null;
    }
    // PNG: signature + chunks (eXIf, tEXt, iTXt, zTXt).
    if (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') {
      let exifMeta = null;
      let off = 8;
      while (off + 8 <= b.length) {
        const len = b.readUInt32BE(off);
        const type = b.toString('latin1', off + 4, off + 8);
        const dataStart = off + 8;
        const dataEnd = dataStart + len;
        if (dataEnd + 4 > b.length) break;
        if (type === 'eXIf') exifMeta = parseTiff(b.subarray(dataStart, dataEnd));
        if (type === 'IEND') break;
        off = dataEnd + 4;
      }
      const text = parsePngTextChunks(b);
      const meta = exifMeta || { gps: null, serial: null, author: null, software: null };
      if (!meta.author && text.author) meta.author = text.author;
      if (!meta.serial && text.serial) meta.serial = text.serial;
      if (!meta.software && text.software) meta.software = text.software;
      if (!meta.gps && !meta.serial && !meta.author && !meta.software) return null;
      return meta;
    }
    // TIFF: the whole file is TIFF.
    if (ext === 'tif' || ext === 'tiff' || ((b[0] === 0x49 || b[0] === 0x4d) && b[1] === b[0])) {
      return parseTiff(b);
    }
    // WebP: RIFF....WEBP, scan chunks for EXIF (TIFF payload).
    if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
      let off = 12;
      while (off + 8 <= b.length) {
        const type = b.toString('latin1', off, off + 4);
        const size = b.readUInt32LE(off + 4);
        const dataStart = off + 8;
        const dataEnd = dataStart + size;
        if (dataEnd > b.length) break;
        if (type === 'EXIF') return parseTiff(b.subarray(dataStart, dataEnd));
        off = dataEnd + (size % 2);
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

function normWs(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Core detection for one parsed file — THE negative-control stub
 * point: replacing this body with `return [];` must make every
 * finding-expecting probe test fail and nothing else.
 * `baselineBody` is the pasted page's HTML: a value already printed
 * there is public, not a leak. Returns an array of leaks
 * [{ kind, field, value, display }] — empty when nothing leaks.
 * Kinds: gps, serial, author, software-path.
 */
export function detectMetadataLeaks(meta, baselineBody) {
  if (!meta) return [];
  const base = normWs(baselineBody);
  const baseLower = base.toLowerCase();
  const leaks = [];
  if (meta.gps && Number.isFinite(meta.gps.lat) && Number.isFinite(meta.gps.lon)) {
    const lat4 = meta.gps.lat.toFixed(4);
    const lon4 = meta.gps.lon.toFixed(4);
    // A map page that prints the same coordinates is not a leak.
    if (!(base.includes(lat4) && base.includes(lon4))) {
      leaks.push({
        kind: 'gps',
        field: 'GPS coordinates',
        value: `${meta.gps.lat.toFixed(2)}, ${meta.gps.lon.toFixed(2)}`,
        display: `${meta.gps.lat.toFixed(2)}, ${meta.gps.lon.toFixed(2)} (rounded to ~1km; full-precision rationals parsed from the GPS IFD)`,
      });
    }
  }
  if (meta.serial) {
    const serial = String(meta.serial).trim();
    if (serial && !base.includes(serial)) {
      leaks.push({ kind: 'serial', field: 'camera serial number', value: serial, display: serial });
    }
  }
  if (meta.author) {
    const author = String(meta.author).trim();
    if (author && !baseLower.includes(author.toLowerCase())) {
      leaks.push({ kind: 'author', field: 'author', value: author, display: author });
    }
  }
  if (meta.software) {
    const software = String(meta.software).trim();
    if (software && USER_PATH_RE.test(software)) {
      leaks.push({ kind: 'software-path', field: 'software', value: software, display: software });
    }
  }
  return leaks;
}

/**
 * Probe-facing detection entry — the negative-control stub point.
 * Kept separate from detectMetadataLeaks (the pure helper, unit
 * tested directly) so stubbing this kills only the probe's
 * finding-expecting tests and nothing else.
 */
function findMetadataLeaks(meta, baselineBody) {
  return detectMetadataLeaks(meta, baselineBody);
}

const IMG_SRC_RE = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
const LINK_HREF_RE = /<a[^>]+href\s*=\s*["']([^"']+)["']/gi;

/**
 * Build the candidate fetch list for a scan. Pure — exported for
 * unit tests. Priority: the pasted URL itself when it IS an image,
 * then <img> sources from the baseline HTML, then <a> links to
 * image files, then the orchestrator's URL list. Same-origin only,
 * deduped, capped at MAX_FETCHES. Returns [{ url, extension }].
 */
export function buildMetadataTargets(pageUrl, urls, pageHtml) {
  let page;
  try {
    page = new URL(pageUrl);
  } catch {
    return [];
  }
  const origin = page.origin;
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    if (out.length >= MAX_FETCHES) return;
    let u;
    try {
      u = new URL(raw, pageUrl);
    } catch {
      return;
    }
    if (u.origin !== origin) return;
    const ext = fileExtension(u.pathname);
    if (!IMAGE_EXTS.has(ext)) return;
    const key = `${u.origin}${u.pathname}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url: `${u.origin}${u.pathname}`, extension: ext });
  };
  push(pageUrl);
  const html = typeof pageHtml === 'string' ? pageHtml : '';
  for (const m of html.matchAll(IMG_SRC_RE)) push(m[1]);
  for (const m of html.matchAll(LINK_HREF_RE)) push(m[1]);
  for (const u of Array.isArray(urls) ? urls : []) push(u);
  return out;
}

// Default byte fetcher: raw bytes (fetchPage's res.text() would
// mangle EXIF bytes through UTF-8 decoding). Honors the
// Content-Length cap before downloading and never throws — the
// phase must stay ok:true on fetch trouble.
async function defaultFetchBytes(url, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs) || 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: opts.headers || {},
      signal: controller.signal,
    });
    if (!res || res.status !== 200) return null;
    const lenHeader = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-length') : null;
    if (lenHeader !== null && Number(lenHeader) > MAX_BYTES) return null;
    let buf;
    if (typeof res.arrayBuffer === 'function') {
      buf = Buffer.from(await res.arrayBuffer());
    } else if (typeof res.text === 'function') {
      buf = Buffer.from(await res.text(), 'latin1');
    } else {
      return null;
    }
    if (buf.length > MAX_BYTES) buf = buf.subarray(0, MAX_BYTES);
    return { status: res.status, body: buf };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pushFinding(leak, res, candidate, findings, seen) {
  const key = `${leak.kind}|${candidate.url}`;
  if (seen.has(key)) return;
  seen.add(key);
  const base = candidate.url.split('/').pop();
  let title;
  if (leak.kind === 'gps') {
    title = `Metadata leakage — GPS coordinates embedded in image '${base}'`;
  } else if (leak.kind === 'serial') {
    title = `Metadata leakage — camera serial number embedded in image '${base}'`;
  } else if (leak.kind === 'author') {
    title = `Metadata leakage — author name embedded in image '${base}'`;
  } else {
    title = `Metadata leakage — internal user path embedded in image '${base}' metadata`;
  }
  findings.push({
    class: 'metadata_leakage',
    id: `metadata-${sha12(key)}`,
    title,
    severity: 'low',
    url: candidate.url,
    parameter: null,
    evidence: {
      request: `GET ${candidate.url}`,
      response: `HTTP ${res.status} image carries ${leak.field}: ${leak.display}`,
      impact_demo:
        'Metadata-leakage primitive — embedded EXIF/document metadata exposes the photographer\u2019s location, device serial or identity without any login; a GPS leak reveals where a photo was taken, a serial ties images to one device across the web, and an internal path leaks usernames and workstation layout — chain with OSINT or physical targeting.',
      signalCorrelated: true,
    },
  });
}

/**
 * Probe metadata leakage (#178).
 * @param {string} pageUrl — the pasted page (baseline + surface).
 * @param {string[]} urls — distinct GET probe target URLs (the
 *   orchestrator selects them; image paths seed candidates).
 * @param {object} opts — { timeoutMs, headers, fetchPage,
 *   fetchBytes }. fetchPage is the HTML seam (defaults to
 *   fingerprint.fetchPage); fetchBytes is the raw-bytes seam
 *   (defaults to defaultFetchBytes above).
 * @returns {object[]} findings (class 'metadata_leakage', low).
 */
export async function probeMetadataLeakage(pageUrl, urls, opts = {}) {
  const findings = [];
  try {
    const fetchFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
    const bytesFn = typeof opts.fetchBytes === 'function' ? opts.fetchBytes : defaultFetchBytes;
    const seen = new Set();

    // Baseline first: the pasted page's HTML is the control the
    // differential is measured against (a value printed on the page
    // is public, not a leak) and the source of <img> candidates.
    let baselineBody = '';
    try {
      const res = await fetchFn(pageUrl, opts);
      if (res) baselineBody = typeof res.body === 'string' ? res.body : '';
    } catch {
      baselineBody = '';
    }

    const candidates = buildMetadataTargets(pageUrl, urls, baselineBody);
    for (const candidate of candidates) {
      if (findings.length >= MAX_FINDINGS) break;
      let res;
      try {
        res = await bytesFn(candidate.url, opts);
      } catch {
        continue;
      }
      if (!res || res.status !== 200 || !res.body) continue;
      const body = toBuffer(res.body);
      if (!body) continue;
      const meta = extractImageMetadata(body, candidate.extension);
      const leaks = findMetadataLeaks(meta, baselineBody);
      for (const leak of leaks) {
        pushFinding(leak, res, candidate, findings, seen);
      }
    }
    return findings;
  } catch {
    return findings;
  }
}

export const __metadataLeakageMeta = { phases: ['metadata-leakage'], depth: ['quick', 'standard', 'deep'] };
