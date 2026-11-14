// Dark Matter rule-based scanner — generated-document external-image
// probe (V10-F4 docx, V10-F5 xlsx, V10-VC-1 pptx control; Meta Cat 7).
//
// When a target generates an Office document that LINKS an external
// image (instead of embedding it), every viewer who opens the document
// fetches that URL — disclosing the viewer IP and the view event, and
// transmitting any data encoded in the URL — with no approval. The
// link is verifiable offline from the package (see officePackage.js):
// an image Relationship with TargetMode="External" + an <a:blip
// r:link> in the body/drawing, and no media part embedding that image.
//
//   .docx -> class document_external_image (V10-F4)
//   .xlsx -> class spreadsheet_external_image (V10-F5)
//   .pptx -> class presentation_external_image; the V10 pipeline bakes
//     slides as rendered images, so the expected outcome is NO finding
//     (embedded control, V10-VC-1). A .pptx that DID link an image
//     would be a finding under the same rule.
//
// READ-ONLY: the probe only GETs document URLs the target itself links
// to (hrefs ending .docx/.xlsx/.pptx on the target page + site root).
// It never submits a form and never sends a collaborator URL anywhere
// — no lab gate, no OOB channel, no Meta spend. A target that
// generates documents only via a form POST is out of scope for this
// probe (the link-discovery covers the common "Export" link case);
// the probe records that as a diagnostic, not a finding.
//
// Candidates are bounded (3 per scan) and downloads are size-capped
// (32MB); a candidate that is not a ZIP/OOXML package, or that the
// reader cannot parse, is skipped silently — never a finding.
// One finding per document (first external image per document wins);
// the phase records a control diagnostic when a document embeds its
// images instead of linking them.
import { analyzeOfficePackage, discoverDocumentUrls } from './officePackage.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_DOCUMENTS = 3;
const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;

export const OFFICE_KIND_CONFIG = {
  docx: {
    ext: '.docx',
    findingClass: 'document_external_image',
    title:
      'Generated document links an external image — viewer fetches the URL on open (HIGH)',
    relsHint: 'word/_rels/document.xml.rels',
    mediaHint: 'word/media/',
  },
  xlsx: {
    ext: '.xlsx',
    findingClass: 'spreadsheet_external_image',
    title:
      'Generated spreadsheet links an external image — viewer fetches the URL on open (HIGH)',
    relsHint: 'xl/drawings/_rels/drawing1.xml.rels',
    mediaHint: 'xl/media/',
  },
  pptx: {
    ext: '.pptx',
    findingClass: 'presentation_external_image',
    title:
      'Generated presentation links an external image — viewer fetches the URL on open (HIGH)',
    relsHint: 'ppt/slides/_rels/slide1.xml.rels',
    mediaHint: 'ppt/media/',
  },
};

function siteRoot(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return url;
  }
}

async function getText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    if (!res || typeof res.text !== 'function') return '';
    return await res.text().catch(() => '');
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

async function fetchBytes(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    if (!res || typeof res.arrayBuffer !== 'function') return null;
    if (typeof res.status === 'number' && res.status !== 200) return null;
    const len = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-length') : null;
    if (len && Number(len) > MAX_DOCUMENT_BYTES) return null;
    const ab = await res.arrayBuffer().catch(() => null);
    if (!ab || ab.byteLength === 0 || ab.byteLength > MAX_DOCUMENT_BYTES) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Probe one Office kind for linked external images. `kind` is one of
 * 'docx' | 'xlsx' | 'pptx'. Candidates come from opts.documentUrls
 * (explicit list — tests and the live-proof driver) or from link
 * discovery on the target page + site root. Diagnostics ride
 * opts.diagnostics ({ documentsChecked, documentsFound, externalFound,
 * controlStatus, skipped }). Returns findings (0..MAX_DOCUMENTS).
 */
export async function probeOfficeExternalImage(url, opts = {}, kind) {
  const findings = [];
  const cfg = OFFICE_KIND_CONFIG[kind];
  if (!cfg) return findings;
  const diag = opts.diagnostics || {};
  diag.documentsChecked = 0;
  diag.documentsFound = 0;
  diag.externalFound = 0;
  diag.controlStatus = null;
  diag.skipped = null;

  let candidates = [];
  if (Array.isArray(opts.documentUrls) && opts.documentUrls.length) {
    candidates = opts.documentUrls.filter((u) => String(u).toLowerCase().includes(cfg.ext));
  } else {
    const pages = [String(url || ''), siteRoot(url)];
    for (const pageUrl of pages) {
      const html = await getText(pageUrl, opts);
      if (!html) continue;
      for (const found of discoverDocumentUrls(html, pageUrl, [cfg.ext])) {
        if (!candidates.includes(found)) candidates.push(found);
      }
    }
  }
  candidates = candidates.slice(0, MAX_DOCUMENTS);
  diag.documentsFound = candidates.length;
  if (!candidates.length) {
    diag.skipped = 'no document targets';
    return findings;
  }

  for (const docUrl of candidates) {
    const bytes = await fetchBytes(docUrl, opts);
    if (!bytes) continue;
    diag.documentsChecked++;
    const analysis = analyzeOfficePackage(bytes);
    if (!analysis || analysis.kind !== kind) continue;
    if (analysis.externalImages.length) {
      const img = analysis.externalImages[0];
      findings.push({
        class: cfg.findingClass,
        id: `${cfg.findingClass}-${docUrl}`.slice(0, 120),
        title: cfg.title,
        severity: 'high',
        url: docUrl,
        param: img.sourceFile,
        parameter: img.sourceFile, // dedup key: one finding per document
        evidence: {
          request: `GET ${docUrl}`,
          response:
            `${img.sourceFile} holds an image Relationship with TargetMode="External": ` +
            `Target="${img.target}" (${img.relId}), referenced by <a:blip r:link="${img.relId}"/> ` +
            `in the document body — and the package carries no ${cfg.mediaHint} embedding for it ` +
            `(media parts: ${analysis.mediaCount}). A viewer opening this document fetches the URL.`,
          impact_demo:
            'A linked external image causes every viewer to fetch an attacker URL directly on open — disclosing the viewer IP + view event and transmitting any data encoded in the URL — with no approval, no warning, and no sanitisation. The fetch is made by the viewer application, so it never passes through any agent egress gate.',
          externalLinkPreserved: true,
          embeddedMedia: Boolean(img.alsoEmbedded),
        },
      });
      diag.externalFound++;
    } else if (analysis.embeddedImages.length) {
      // Negative control (V10-VC-1): the pipeline embeds the image
      // (build-time render) — no live link, no channel, not a finding.
      diag.controlStatus = `embedded — no live link (${analysis.embeddedImages.length} image(s) embedded, ${analysis.mediaCount} media part(s))`;
    } else {
      diag.controlStatus = diag.controlStatus || 'no images in package';
    }
  }
  return findings;
}

export const __officeExternalImageMeta = {
  phases: ['document-external-image', 'spreadsheet-external-image', 'presentation-external-image'],
  depth: ['quick', 'standard', 'deep'],
};
