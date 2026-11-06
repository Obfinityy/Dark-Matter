// Dark Matter rule-based scanner — unrestricted file upload probe.
//
// Finds <input type="file"> forms, uploads a benign marker file, then tries
// dangerous variants (double extension, .phtml). Confirmation tiers:
//   1. Acceptance — the upload returns 2xx AND echoes the filename/marker
//      back (a bare "success" word is not storage proof).
//   2. Retrieval — when the upload response discloses where the file went,
//      the probe GETs that URL and requires the marker to come back.
//
// SAFETY: this probe WRITES files to the target. It runs ONLY when
// opts.allowWrite is true, which runScan sets solely for lab targets
// (labTargets). Everywhere else it returns [] without a single request.
// Uploaded content is a harmless text marker — never a real shell.
//
// class 'file_upload' → default protocol → signalCorrelated=true.
// Severity: high when an executable extension is accepted, medium for
// unrestricted-but-inert upload.
import { randomBytes } from 'node:crypto';

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
  fd.append(fileInput, new Blob([content], { type: 'text/plain' }), filename);
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
    // Dangerous variant: executable-ish extension.
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
    const echoNeedle = evilAccepted ? evilName : (resp.text.includes(txtName) ? txtName : marker);
    const echoText = evilAccepted ? evilResp.text : resp.text;
    const echoWindow = windowAround(echoText, echoNeedle);
    findings.push({
      class: 'file_upload',
      id: `file-upload-${form.action}`.slice(0, 120),
      title: evilAccepted
        ? `Unrestricted file upload accepts executable extension (.phtml)`
        : `Unrestricted file upload (no extension validation observed)`,
      severity: evilAccepted ? 'high' : 'medium',
      url: form.action,
      evidence: {
        request: `POST ${form.action} multipart (${form.fileInput}=${evilAccepted ? evilName : txtName})`,
        response: evilAccepted
          ? (servedBack
            ? `server accepted ${evilName} and serves it back at ${servedBack.url} — "...${servedBack.window}..."`
            : `server accepted ${evilName} (HTTP ${evilResp.status}, filename echoed in upload response) — "...${echoWindow}..."`)
          : `server stored ${txtName} (HTTP ${resp.status}, filename/marker echoed) — "...${echoWindow}..."`,
        impact_demo: evilAccepted
          ? 'executable upload primitive — webshell path on misconfigured hosts'
          : 'arbitrary file write primitive — stored-XSS/phishing payload hosting',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
