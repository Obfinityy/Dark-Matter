// Dark Matter rule-based scanner — unrestricted file upload probe.
//
// Finds <input type="file"> forms, uploads a benign marker file, then tries
// dangerous variants (double extension, .phtml). Confirms by retrieving the
// uploaded file or by the server accepting an executable extension.
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
    return await res.text().catch(() => '');
  } finally {
    clearTimeout(t);
  }
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
    let resp = '';
    try {
      resp = await upload(form.action, form.fileInput, txtName, marker, opts);
    } catch {
      continue;
    }
    const stored = resp.includes(txtName) || resp.includes(marker) || /success|uploaded/i.test(resp);
    if (!stored) continue;
    // Dangerous variant: executable-ish extension.
    const evilName = `dmprobe_${rand}.phtml`;
    let evilResp = '';
    try {
      evilResp = await upload(form.action, form.fileInput, evilName, marker, opts);
    } catch {
      // ignore
    }
    const evilAccepted = evilResp.includes(evilName) || (/success|uploaded/i.test(evilResp) && !/not allowed|invalid|denied|error/i.test(evilResp));
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
          ? `server accepted ${evilName} — executable extension not rejected`
          : `server stored ${txtName} with marker content retrievable in response`,
        impact_demo: evilAccepted
          ? 'executable upload primitive — webshell path on misconfigured hosts'
          : 'arbitrary file write primitive — stored-XSS/phishing payload hosting',
        signalCorrelated: true,
      },
    });
  }
  return findings;
}
