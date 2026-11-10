// Dark Matter rule-based scanner — server config override via
// .htaccess upload probe (coverage row #499 [High] File upload —
// server config override (.htaccess), CWE-434 | OWASP A03:2021;
// phase 'upload-htaccess').
//
// Some upload handlers accept a `.htaccess` file into a public
// directory, letting an attacker rewrite the directory's server
// configuration — here, mapping a new extension to the PHP
// handler. The probe uploads a `.htaccess` carrying
// `AddType application/x-httpd-php .l33t`, then uploads a MARKER
// file with the `.l33t` extension, and confirms only on
// execution of that marker.
//
// ORACLE (differential execution, four conjuncts, all required):
//   (1) CONTROL INERT — the same marker extension uploaded
//       BEFORE the .htaccess (a different file name, same
//       `.l33t` extension) must be served INERT: the GET returns
//       the marker source (it contains the canary string inside
//       `<?php ... ?>`), or the file is not retrievable at all.
//       A control marker that already executes means the
//       extension is mapped server-wide and the .htaccess proves
//       nothing — the verdict is unconfirmed, never a finding.
//   (2) HTACCESS ACCEPTED — the .htaccess upload returns 2xx.
//       A rejected .htaccess ends the probe quietly.
//   (3) PROBE EXECUTES — the marker uploaded AFTER the .htaccess
//       is served EXECUTED: the GET returns the canary string
//       with NO `<?php` source in the body. Serving the source
//       back is inert storage, not execution, and stays quiet.
//   (4) REPEAT — a second GET of the probe marker executes the
//       same way. One executed GET is not proof the mapping is
//       live (a caching or rendering quirk could echo once).
// A finding fires at most once per form.
//
// SAFETY: this probe WRITES files to the target. It runs ONLY
// when opts.allowWrite is true AND the target is a lab host
// (isLabTargetHost, the same lab gate as fileUpload). Everywhere
// else it returns [] without a single request. The marker content
// is a canary echo only — `<?php echo "<canary>"; ?>` — never a
// functional shell: no input handling, no command execution, no
// file access, nothing an attacker could reuse. The file names
// carry a per-run random suffix. Findings are class
// 'file_upload_htaccess' — the default confirmation protocol,
// judged on evidence.signalCorrelated (see differential.js).
//
// HONEST LIMITS: the probe predicts the public path as
// /uploads/<filename> (the lab convention) and confirms it
// against the URL the upload response discloses when present; a
// lab that stores uploads under an unpredictable path shows no
// execution and the phase reports 'path not predicted', never a
// finding. A server that ignores .htaccess (nginx, or Apache
// with AllowOverride None) shows a quiet result — "override not
// observed", not "override impossible". Only the AddType mapping
// for the `.l33t` extension is tested; other directives
// (php_value, AddHandler, FilesMatch) are out of scope for this
// row. No dedicated .htaccess lab exists today; the unit tests
// prove the oracle against a local mock server whose .htaccess
// handling is planted per mode.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { findUploadForms, findUploadedUrl, predictPublicUrl } from './uploadRace.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 20000;
const MAX_FORMS = 2;
// The extension the .htaccess maps to the PHP handler. A nonsense
// extension no server maps by default, so execution of a file
// carrying it can only come from the uploaded .htaccess.
const MARKER_EXTENSION = '.l33t';

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * The .htaccess content: a single AddType directive mapping the
 * marker extension to the PHP handler. Pure.
 */
export function htaccessContent() {
  return `AddType application/x-httpd-php ${MARKER_EXTENSION}\n`;
}

/**
 * The marker file content: a PHP echo of the canary string. A
 * canary echo only — never a functional shell. Pure.
 */
export function markerContent(canary) {
  return `<?php echo "${canary}"; ?>`;
}

/**
 * True when a GET of the marker file shows EXECUTION: the canary
 * is present and no PHP source survives in the body. A body that
 * serves the source back contains the canary too, but also
 * contains `<?php` — that is inert storage, not execution. Pure.
 */
export function markerExecuted(body, canary) {
  const text = String(body || '');
  return text.includes(canary) && !text.includes('<?');
}

/**
 * True when a GET of the marker file shows INERT storage: the
 * canary is present only inside served-back PHP source. Pure.
 */
export function markerServedInert(body, canary) {
  const text = String(body || '');
  return text.includes(canary) && text.includes('<?');
}

/**
 * Judge the .htaccess oracle. 'confirmed' only when the
 * .htaccess was accepted, the control marker (uploaded before
 * it) did NOT execute, and the probe marker (uploaded after it)
 * executed twice. A control that already executes means the
 * extension is mapped server-wide; a control that was never
 * retrievable means the path prediction failed — both are
 * 'unconfirmed', never a finding. Pure.
 */
export function assessUploadHtaccess({
  htaccessAccepted,
  controlExecuted,
  controlRetrievable,
  probeExecuted,
  probeRepeatExecuted,
  disclosedUrlMatches,
}) {
  if (!htaccessAccepted) {
    return { verdict: 'rejected', reason: 'the .htaccess upload was not accepted' };
  }
  if (disclosedUrlMatches === false) {
    return { verdict: 'unconfirmed', reason: 'upload response disclosed a different public path than predicted — the marker could not be fetched back' };
  }
  if (controlExecuted) {
    return { verdict: 'unconfirmed', reason: 'the control marker already executes without any .htaccess — the extension is mapped server-wide' };
  }
  if (!controlRetrievable) {
    return { verdict: 'unconfirmed', reason: 'the control marker was never retrievable — the public path was not predicted' };
  }
  if (!probeExecuted) {
    return { verdict: 'rejected', reason: 'the marker uploaded after the .htaccess was not executed — the override did not take effect' };
  }
  if (!probeRepeatExecuted) {
    return { verdict: 'unconfirmed', reason: 'the marker executed once but not on repeat' };
  }
  return { verdict: 'confirmed', reason: 'marker executes only after the uploaded .htaccess maps its extension to PHP, reproducibly' };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function get(fetchFn, url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function upload(fetchFn, action, fileInput, filename, content, opts = {}) {
  const fd = new FormData();
  fd.append(fileInput, new Blob([content], { type: 'text/plain' }), filename);
  fd.append('Submit', 'Upload');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetchFn(action, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
      body: fd,
    });
    return { status: res.status, text: await res.text().catch(() => '') };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- the probe ---------------------------------------------------------------

export async function probeUploadHtaccess(url, opts = {}) {
  // LAB GATE: never touch the network unless explicitly allowed
  // on a lab host.
  if (!opts || opts.allowWrite !== true) return [];
  if (!isLabTargetHost(url, opts.labTargets)) return [];
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  let body = '';
  try {
    body = (await get(fetchFn, url, opts))?.text || '';
  } catch {
    return findings;
  }
  const forms = findUploadForms(body, url);
  setDiag('forms', forms.length);
  if (!forms.length) {
    setDiag('skipReason', 'no upload form on the page');
    return findings;
  }
  for (const form of forms) {
    const rand = randomBytes(4).toString('hex');
    const controlCanary = `DM-HTACCESS-CTRL-${rand}`;
    const probeCanary = `DM-HTACCESS-${rand}`;
    const controlName = `dmprobe_ctrl_${rand}${MARKER_EXTENSION}`;
    const probeName = `dmprobe_${rand}${MARKER_EXTENSION}`;
    const controlUrl = predictPublicUrl(form.action, controlName);
    const probeUrl = predictPublicUrl(form.action, probeName);

    // Leg 1 — CONTROL: upload the marker BEFORE any .htaccess.
    // It must be served inert (or not retrievable); execution
    // here means the extension is already mapped server-wide.
    const controlUpload = await upload(fetchFn, form.action, form.fileInput, controlName, markerContent(controlCanary), opts);
    let controlExecuted = false;
    let controlRetrievable = false;
    if (controlUpload && controlUpload.status >= 200 && controlUpload.status < 300) {
      const controlGet = await get(fetchFn, controlUrl, opts);
      if (controlGet && controlGet.status >= 200 && controlGet.status < 300) {
        controlRetrievable = true;
        controlExecuted = markerExecuted(controlGet.text, controlCanary);
      }
    }
    setDiag('controlExecuted', controlExecuted);
    setDiag('controlRetrievable', controlRetrievable);
    if (controlExecuted) {
      setDiag('verdict', 'unconfirmed');
      continue;
    }

    // Leg 2 — the .htaccess itself. A rejection ends the probe
    // quietly for this form.
    const htaccessUpload = await upload(fetchFn, form.action, form.fileInput, '.htaccess', htaccessContent(), opts);
    const htaccessAccepted = Boolean(htaccessUpload && htaccessUpload.status >= 200 && htaccessUpload.status < 300);
    setDiag('htaccessAccepted', htaccessAccepted);
    if (!htaccessAccepted) {
      setDiag('verdict', 'rejected');
      continue;
    }

    // Leg 3 — PROBE: upload the marker AFTER the .htaccess and
    // fetch it back twice. Execution is the canary with no PHP
    // source in the body.
    const probeUpload = await upload(fetchFn, form.action, form.fileInput, probeName, markerContent(probeCanary), opts);
    let probeExecuted = false;
    let probeRepeatExecuted = false;
    let disclosedUrlMatches = true;
    if (probeUpload && probeUpload.status >= 200 && probeUpload.status < 300) {
      const disclosedUrl = findUploadedUrl(probeUpload.text, probeName, form.action);
      disclosedUrlMatches = !disclosedUrl || disclosedUrl === probeUrl;
      const probeGet = await get(fetchFn, probeUrl, opts);
      probeExecuted = Boolean(
        probeGet && probeGet.status >= 200 && probeGet.status < 300 && markerExecuted(probeGet.text, probeCanary),
      );
      if (probeExecuted) {
        const probeRepeat = await get(fetchFn, probeUrl, opts);
        probeRepeatExecuted = Boolean(
          probeRepeat && probeRepeat.status >= 200 && probeRepeat.status < 300 && markerExecuted(probeRepeat.text, probeCanary),
        );
      }
    }
    setDiag('probeExecuted', probeExecuted);
    setDiag('probeRepeatExecuted', probeRepeatExecuted);
    setDiag('disclosedUrlMatches', disclosedUrlMatches);
    const verdict = assessUploadHtaccess({
      htaccessAccepted,
      controlExecuted,
      controlRetrievable,
      probeExecuted,
      probeRepeatExecuted,
      disclosedUrlMatches,
    });
    setDiag('verdict', verdict.verdict);
    if (verdict.verdict !== 'confirmed') continue;
    findings.push({
      class: 'file_upload_htaccess',
      id: `file-upload-htaccess-${rand}`,
      title: 'Server configuration override via .htaccess upload — marker executes as PHP',
      severity: 'high',
      url: form.action,
      evidence: ev(
        `POST ${form.action} multipart (${form.fileInput}=.htaccess with 'AddType application/x-httpd-php .l33t'), then POST ${form.action} multipart (${form.fileInput}=${probeName}) and GET ${probeUrl}`,
        `The control marker uploaded before the .htaccess was served inert, while the marker uploaded after it executes: GET ${probeUrl} returns the canary '${probeCanary}' with no PHP source, reproducibly on repeat. ${verdict.reason}.`,
        'An attacker who uploads a .htaccess rewrites the directory configuration and turns any later upload into executable code — full remote code execution on Apache hosts that honour .htaccess.',
      ),
    });
    // One confirmed override per form is enough; the loop
    // continues to the next form (another form may override
    // differently).
  }
  return findings;
}

export const __uploadHtaccessMeta = { phases: ['upload-htaccess'], depth: ['standard', 'deep'] };
