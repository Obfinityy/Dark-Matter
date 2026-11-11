// Dark Matter rule-based scanner — OOXML package analysis (V10-F4/F5,
// document + spreadsheet external-image links, Meta Cat 7).
//
// Technique (V10-F4 docx, V10-F5 xlsx, taught 11 Nov 2026, owner order:
// hunt, then train): when a generated Office document preserves an
// external image URL as a LINKED image, a viewer (Word, Excel, Google
// Docs/Sheets, LibreOffice) fetches that URL on open — disclosing the
// viewer IP and the view event, and transmitting any data encoded in
// the URL — with no approval. The link is verifiable offline from the
// package itself, no viewer needed:
//
//   .docx: word/_rels/document.xml.rels holds an image Relationship
//     with TargetMode="External" + Target="<url>", and word/document.xml
//     references it via <a:blip r:link="rId.."/>. No word/media/
//     directory means the image is NOT embedded.
//   .xlsx: xl/drawings/_rels/drawing<N>.xml.rels holds the same shape,
//     and xl/drawings/drawing<N>.xml references it via <a:blip
//     r:link="rId.."/>. No xl/media/ parts means not embedded.
//   .pptx: the CONTROL (V10-VC-1). A pipeline that bakes each slide as
//     a rendered image embeds it: <a:blip r:embed="rId.."/> + an
//     internal Target (../media/imageN.png) + ppt/media/ parts, and no
//     external URL anywhere. Embedded is not a channel — never a
//     finding. A .pptx that DID carry TargetMode="External" + r:link
//     would be a finding under the same rule (the probe checks for it).
//
// This module is PURE (no network, no filesystem): it reads a ZIP
// buffer and judges the package. The network probes
// (documentExternalImage / spreadsheetExternalImage /
// presentationExternalImage) only discover + download candidate
// documents and call analyzeOfficePackage on the bytes.
//
// ZIP reading is a minimal local-header walk (stored + deflate) with
// node:zlib — no dependency. Limits: 4096 entries, 16MB per entry,
// entries past a corrupt/truncated header are ignored. Data-descriptor
// (streaming) ZIPs and ZIP64 are NOT handled — OOXML writers emit
// plain local headers with sizes up front, and generated documents are
// small; a package this reader cannot parse yields `null` (not a
// finding), never a misread.
import { inflateRawSync } from 'node:zlib';

const ZIP_LOCAL_HEADER = 0x04034b50; // PK\x03\x04
const MAX_ENTRIES = 4096;
const MAX_ENTRY_BYTES = 16 * 1024 * 1024;
const IMAGE_REL_SUFFIX = '/image';

/**
 * Minimal ZIP reader: local-file-header walk. Returns a Map of
 * entry-name -> Buffer (directories skipped). Pure — exported for
 * unit tests. Returns an empty Map for a non-ZIP buffer.
 */
export function readZipEntries(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const entries = new Map();
  let offset = 0;
  let count = 0;
  while (offset + 30 <= buf.length && count < MAX_ENTRIES) {
    if (buf.readUInt32LE(offset) !== ZIP_LOCAL_HEADER) break;
    const method = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const fileNameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.toString('utf8', offset + 30, offset + 30 + fileNameLen);
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    // A data-descriptor ZIP leaves the sizes zero in the local header
    // (compressedSize 0 with the real size after the data) — this walk
    // cannot locate the next header, so stop: the package is unreadable
    // here, not evidence of anything.
    if (dataEnd > buf.length || (compressedSize === 0 && method !== 0 && name.length > 0 && dataStart >= buf.length)) break;
    if (!name.endsWith('/') && compressedSize <= MAX_ENTRY_BYTES) {
      const raw = buf.subarray(dataStart, dataEnd);
      let data = null;
      if (method === 0) data = Buffer.from(raw);
      else if (method === 8) {
        try {
          data = inflateRawSync(raw);
        } catch {
          data = null;
        }
      }
      if (data) entries.set(name, data);
    }
    offset = dataEnd;
    count++;
  }
  return entries;
}

/** Parse a .rels file: image relationships only. Pure. */
export function parseImageRels(relsXml) {
  const out = [];
  for (const m of String(relsXml || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const tag = m[0];
    const type = /Type="([^"]*)"/.exec(tag)?.[1] || '';
    if (!type.endsWith(IMAGE_REL_SUFFIX)) continue;
    out.push({
      id: /Id="([^"]*)"/.exec(tag)?.[1] || '',
      target: /Target="([^"]*)"/.exec(tag)?.[1] || '',
      targetMode: /TargetMode="([^"]*)"/.exec(tag)?.[1] || '',
    });
  }
  return out;
}

/** Parse <a:blip> references: { id, mode: 'link' | 'embed' }. Pure. */
export function findBlipRefs(xml) {
  const out = [];
  for (const m of String(xml || '').matchAll(/<a:blip\b[^>]*>/g)) {
    const tag = m[0];
    const link = /r:link="([^"]*)"/.exec(tag)?.[1];
    const embed = /r:embed="([^"]*)"/.exec(tag)?.[1];
    if (link) out.push({ id: link, mode: 'link' });
    else if (embed) out.push({ id: embed, mode: 'embed' });
  }
  return out;
}

const KIND_PATHS = {
  docx: {
    marker: 'word/document.xml',
    rels: ['word/_rels/document.xml.rels'],
    bodies: ['word/document.xml'],
    mediaPrefix: 'word/media/',
  },
  xlsx: {
    marker: 'xl/workbook.xml',
    rels: null, // drawing rels discovered by pattern below
    bodies: null,
    mediaPrefix: 'xl/media/',
  },
  pptx: {
    marker: 'ppt/presentation.xml',
    rels: null, // slide rels discovered by pattern below
    bodies: null,
    mediaPrefix: 'ppt/media/',
  },
};

function relsAndBodiesFor(kind, entries) {
  if (kind === 'docx') {
    return {
      relsFiles: KIND_PATHS.docx.rels.filter((f) => entries.has(f)),
      bodyFiles: KIND_PATHS.docx.bodies.filter((f) => entries.has(f)),
    };
  }
  const prefix = kind === 'xlsx' ? 'xl/drawings/' : 'ppt/slides/';
  const relsFiles = [];
  const bodyFiles = [];
  for (const name of entries.keys()) {
    if (name.startsWith(`${prefix}_rels/`) && name.endsWith('.xml.rels')) relsFiles.push(name);
    else if (name.startsWith(prefix) && name.endsWith('.xml') && !name.includes('_rels/')) bodyFiles.push(name);
  }
  return { relsFiles, bodyFiles };
}

function isExternalHttp(target) {
  return /^https?:\/\//i.test(String(target || ''));
}

/**
 * Judge an OOXML package for linked external images. Pure — exported
 * for unit tests. Returns null when the buffer is not a recognisable
 * .docx/.xlsx/.pptx package. Otherwise:
 *   { kind, externalImages: [{ relId, target, sourceFile }],
 *     embeddedImages: [{ relId, target, sourceFile }],
 *     hasMedia, mediaCount, relsFiles }
 * externalImages = image rel with TargetMode="External" + an http(s)
 *   target + a matching <a:blip r:link> in a body file. That is the
 *   fetch channel: the viewer fetches the URL on open.
 * embeddedImages = image rel with an internal target + a matching
 *   <a:blip r:embed>. That is the negative control (V10-VC-1).
 * hasMedia = any media part exists under the kind's media prefix.
 */
export function analyzeOfficePackage(buffer) {
  const entries = readZipEntries(buffer);
  if (!entries.size) return null;
  let kind = null;
  for (const [k, spec] of Object.entries(KIND_PATHS)) {
    if (entries.has(spec.marker)) {
      kind = k;
      break;
    }
  }
  if (!kind) return null;
  const { relsFiles, bodyFiles } = relsAndBodiesFor(kind, entries);
  const bodies = bodyFiles.map((f) => entries.get(f).toString('utf8'));
  const blips = bodies.flatMap((xml) => findBlipRefs(xml));
  const externalImages = [];
  const embeddedImages = [];
  for (const relsFile of relsFiles) {
    const rels = parseImageRels(entries.get(relsFile).toString('utf8'));
    for (const rel of rels) {
      if (rel.targetMode === 'External' && isExternalHttp(rel.target)) {
        if (blips.some((b) => b.id === rel.id && b.mode === 'link')) {
          externalImages.push({
            relId: rel.id,
            target: rel.target,
            sourceFile: relsFile,
            // The same rel id also embedded would make the link
            // redundant — the protocol judge treats that as
            // unconfirmed, not confirmed.
            alsoEmbedded: blips.some((b) => b.id === rel.id && b.mode === 'embed'),
          });
        }
      } else if (!rel.targetMode && !isExternalHttp(rel.target)) {
        if (blips.some((b) => b.id === rel.id && b.mode === 'embed')) {
          embeddedImages.push({ relId: rel.id, target: rel.target, sourceFile: relsFile });
        }
      }
    }
  }
  let mediaCount = 0;
  for (const name of entries.keys()) {
    if (name.startsWith(KIND_PATHS[kind].mediaPrefix)) mediaCount++;
  }
  return {
    kind,
    externalImages,
    embeddedImages,
    hasMedia: mediaCount > 0,
    mediaCount,
    relsFiles,
  };
}

/** Extract href values from HTML. Pure — exported for unit tests. */
export function extractHrefs(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    out.push(m[1]);
  }
  return out;
}

/**
 * Discover candidate document URLs on a page: hrefs whose path ends in
 * one of the given extensions (case-insensitive), resolved against the
 * page URL. Pure — exported for unit tests.
 */
export function discoverDocumentUrls(html, pageUrl, extensions) {
  const exts = (extensions || []).map((e) => String(e).toLowerCase());
  const out = [];
  const seen = new Set();
  for (const href of extractHrefs(html)) {
    let resolved;
    try {
      resolved = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/i.test(resolved.protocol)) continue;
    const path = resolved.pathname.toLowerCase();
    if (!exts.some((e) => path.endsWith(e))) continue;
    const key = resolved.href;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export const __officePackageMeta = { kinds: ['docx', 'xlsx', 'pptx'] };
