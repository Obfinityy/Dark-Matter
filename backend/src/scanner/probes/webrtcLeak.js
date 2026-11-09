// Dark Matter rule-based scanner — WebRTC local IP leakage probe
// (coverage row #459 [Low] Browser — WebRTC local IP leakage,
// CWE-200 | OWASP A01:2021; phase 111, 'webrtc-leak').
//
// ORACLE (deterministic CDP drive, no judge, no LLM, $0): a page
// that runs WebRTC learns the visitor's local network addresses
// from the ICE host candidates the browser gathers — an attacker
// page (or any third-party script on the page) reads them straight
// out of the RTCPeerConnection. The probe drives the pasted page in
// a real headless browser (the same transient-container +
// fixed-loopback-CDP pattern as the DOM trio) and runs an
// RTCPeerConnection with NO STUN/TURN servers — host candidates
// only, so no public IP is ever exposed and no external server is
// contacted — collecting onicecandidate lines for up to 5s (or
// until the null candidate ends gathering). Each candidate line is
// parsed (`candidate:<foundation> <component> <transport>
// <priority> <ip> <port> typ <type> ...`) and judged:
//   * typ host + a literal RFC1918 address (10/8, 172.16/12,
//     192.168/16), a link-local address (169.254/16) or an IPv6
//     local address (ULA fc00::/7, link-local fe80::/10) — the
//     leak: CONFIRM, one aggregated finding per scan.
//   * typ host + an mDNS hostname (*.local) — the modern-browser
//     masking (Chrome mDNS obfuscation): a proven true negative,
//     counted in the diagnostics so the proof can tell "masked"
//     from "never gathered".
//   * typ srflx / relay — the server-reflexive / relayed address,
//     never this row's leak; counted, never a finding.
//   * ZERO candidate lines at all — UNCALIBRATED, never a proven
//     true negative: a modern browser masking via mDNS still yields
//     candidate lines (with .local hostnames), so zero lines means
//     the gather did not run, not that the browser is safe.
//
// GATES (lab-gated like the DOM trio: labCreds + allowWrite +
// isLabTargetHost + depth !== 'quick'): the drive executes JS in
// the target page via CDP, so it never runs outside the lab gate.
// The drive performs NO writes to the target and contacts NO
// external server (empty iceServers); allowWrite is used here as
// the "lab-only browser drive" gate, exactly as the DOM trio uses
// it. BOUND: at most 1 browser drive per scan, gather wait capped
// at 5s, container timeout AUTH_RENDER_TIMEOUT_MS.
//
// HONEST LIMITS (stated up front, not discovered later):
// - The candidates are a property of the VISITING BROWSER, not of
//   the target's code — any page the browser visits gets the same
//   host candidates. A firing finding means the browser that
//   visited the page leaks its local IP; it is not a flaw in the
//   target's server code. The finding text says so.
// - Modern browsers mask local IPs with mDNS by default, so a true
//   negative is the expected outcome on both current labs (the
//   scout's note). The live value of this probe is the negative
//   control: a clean run proves the gather genuinely observed
//   candidates (candidatesCollected > 0 in the phase extras) and
//   found none local — it never passes on empty data.
// - The drive is ANONYMOUS (no lab session): a page that gates
//   its WebRTC surface behind login is not reached — the probe
//   reports the anonymous-surface result, never a proven negative
//   for the logged-in surface.
// - Loopback (127/8, ::1) is not flagged: it identifies the host
//   itself, not its LAN address.
//
// VERIFICATION: the candidate line IS the evidence (the literal
// local IP in an ICE host candidate gathered from the live page),
// so the differential verifier judges this on the default protocol
// (signalCorrelated). The class name 'webrtc_ip_leak' is routed by
// protocolFor to the default protocol ON PURPOSE: it contains
// neither 'xss' (xss_reflected would judge on canaryReflected,
// which a candidate line never carries) nor 'bypass' (auth_bypass,
// judged on bypassWorks) — the same trap dom_sink avoids (see
// domXssSinks.js). Verified by a unit test that calls
// assessConfirmation on a probe finding and expects 'confirmed'.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { runCmd } from '../runner.js';
import { DOM_RENDER_IMAGE } from '../domRender.js';
import { connectCdp } from '../cdpClient.js';
import {
  buildCdpContainerRunArgs,
  buildCdpContainerRmArgs,
  AUTH_RENDER_CONNECT_ATTEMPTS,
  AUTH_RENDER_CONNECT_DELAY_MS,
  AUTH_RENDER_TIMEOUT_MS,
  AUTH_RENDER_DEBUG_ENDPOINT,
} from '../authDomRender.js';

const MAX_FINDINGS = 1;
const GATHER_WAIT_MS = 5000; // max ICE gathering wait inside the page
const GATHER_POLL_MS = 200;
const ERROR_PREFIX = '__error__:';

// candidate:<foundation> <component> <transport> <priority> <ip>
// <port> typ <type> ... — the IP is the 5th token, the type follows
// the literal 'typ'. IPv6 addresses contain colons but no spaces,
// so \S+ holds for both families.
const CANDIDATE_RE = /^candidate:\S+\s+\d+\s+\S+\s+\d+\s+(\S+)\s+\d+\s+typ\s+(\S+)/;

// ---- pure: candidate parsing + local-IP judgement --------------------------

// Parse one ICE candidate line into { ip, type } (type lower-cased),
// or null when the line is not a well-formed candidate. Pure —
// exported for unit tests.
export function extractCandidateIp(candidate) {
  const line = typeof candidate === 'string' ? candidate : '';
  const m = CANDIDATE_RE.exec(line);
  if (!m) return null;
  return { ip: m[1], type: String(m[2]).toLowerCase() };
}

// Is this a literal LOCAL address — RFC1918 (10/8, 172.16/12,
// 192.168/16), IPv4 link-local (169.254/16), IPv6 ULA (fc00::/7)
// or IPv6 link-local (fe80::/10)? Loopback (127/8, ::1) is NOT a
// leak of the LAN address and is excluded. mDNS hostnames
// (*.local) are not literal IPs and return false. Pure — exported
// for unit tests.
export function isLocalIp(ip) {
  const value = String(ip || '').trim();
  if (!value) return false;
  if (value.endsWith('.local')) return false;
  if (value.includes(':')) {
    // IPv6: first hextet decides the range. fe80::/10 covers
    // fe80–febf; fc00::/7 covers fc00–fdff.
    const first = value.split(':')[0] || '';
    const n = parseInt(first, 16);
    if (!Number.isFinite(n)) return false;
    if (n >= 0xfe80 && n <= 0xfebf) return true;
    if (n >= 0xfc00 && n <= 0xfdff) return true;
    return false;
  }
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => {
    if (!/^\d+$/.test(p)) return NaN;
    return parseInt(p, 10);
  });
  if (octets.some((o) => !Number.isFinite(o) || o < 0 || o > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

// Judge a set of gathered ICE candidate lines. Pure — exported for
// unit tests. candidatesCollected counts candidate lines only (a
// '__error__:' line or junk never counts). Verdicts:
//   'uncalibrated' — zero candidate lines: the gather did not run.
//   'confirmed'    — at least one literal local IP in a host candidate.
//   'not-exposed'  — candidates genuinely observed, none local.
export function assessIceCandidates(candidates) {
  const lines = (Array.isArray(candidates) ? candidates : []).filter(
    (c) => typeof c === 'string' && c.startsWith('candidate:')
  );
  const out = {
    candidatesCollected: lines.length,
    hostCandidates: 0,
    srflxCandidates: 0,
    mdnsCandidates: 0,
    localIps: [],
    verdict: 'uncalibrated',
    reason: 'no ICE candidates were gathered — the observation did not run',
  };
  const seen = new Set();
  for (const line of lines) {
    const parsed = extractCandidateIp(line);
    if (!parsed) continue;
    if (parsed.type === 'host') {
      out.hostCandidates += 1;
      if (parsed.ip.endsWith('.local')) {
        out.mdnsCandidates += 1;
      } else if (isLocalIp(parsed.ip) && !seen.has(parsed.ip)) {
        seen.add(parsed.ip);
        out.localIps.push(parsed.ip);
      }
    } else if (parsed.type === 'srflx' || parsed.type === 'relay') {
      out.srflxCandidates += 1;
    }
  }
  if (lines.length === 0) return out;
  if (out.localIps.length > 0) {
    out.verdict = 'confirmed';
    out.reason = `ICE host candidate(s) carry literal local IP address(es): ${out.localIps.join(', ')}`;
    return out;
  }
  out.verdict = 'not-exposed';
  out.reason = `ICE candidates were gathered (${lines.length}) and none carries a literal local IP address`;
  return out;
}

// ---- the CDP drive ----------------------------------------------------------

// In-page gather script: host candidates only (empty iceServers —
// no STUN/TURN, no external server, no public IP). A data channel
// forces ICE gathering even with no media tracks; the null
// candidate ends the wait early. Returns the candidate lines, or
// a single '__error__:' line when RTCPeerConnection is unavailable
// or throws.
const GATHER_EXPR = `(async () => {
  const out = [];
  let done = false;
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('dmprobe');
    pc.onicecandidate = (e) => {
      if (!e || !e.candidate) { done = true; return; }
      if (e.candidate.candidate) out.push(e.candidate.candidate);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const deadline = Date.now() + ${GATHER_WAIT_MS};
    while (!done && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, ${GATHER_POLL_MS}));
    }
    try { pc.close(); } catch {}
  } catch (e) {
    out.push('${ERROR_PREFIX}' + (e && e.message ? e.message : String(e)));
  }
  return out;
})()`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drive the pasted page in a real headless browser and gather its
 * ICE candidates. Reuses the authenticated-render browser pattern
 * (transient container, fixed host-loopback CDP endpoint, container
 * removed in a finally). Anonymous: no lab session is carried.
 * opts.runner / opts.cdpConnect / opts.image are the test seams
 * (defaults mirror authDomRender). Returns { attempted, executed,
 * candidates, error }. executed is true only when the gather script
 * ran to completion and returned candidate lines; an in-page
 * '__error__:' line or any transport failure leaves executed false
 * and carries the error. Never throws.
 */
export async function driveIceGathering(pageUrl, opts = {}) {
  const out = {
    attempted: false,
    executed: false,
    candidates: [],
    error: null,
  };
  const runner = typeof opts.runner === 'function' ? opts.runner : runCmd;
  const cdpConnect = typeof opts.cdpConnect === 'function' ? opts.cdpConnect : connectCdp;
  const image = opts.image || DOM_RENDER_IMAGE;
  const timeoutMs =
    Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0 ? opts.timeoutMs : AUTH_RENDER_TIMEOUT_MS;
  if (!pageUrl) {
    out.error = 'no url';
    return out;
  }
  let containerId = null;
  let client = null;
  try {
    const run = await runner('docker', buildCdpContainerRunArgs(image), { timeoutMs });
    if (!run || !run.ok || !String(run.stdout || '').trim()) {
      out.error = String((run && run.stderr) || '').trim().slice(0, 200) || 'browser container failed to start';
      return out;
    }
    containerId = String(run.stdout).trim().split(/\s+/)[0];
    out.attempted = true;

    let connected = null;
    let lastError = 'cdp endpoint unreachable';
    for (let i = 0; i < AUTH_RENDER_CONNECT_ATTEMPTS; i += 1) {
      const res = await cdpConnect(AUTH_RENDER_DEBUG_ENDPOINT, opts);
      if (res && res.ok) {
        connected = res;
        break;
      }
      lastError = (res && res.error) || lastError;
      if (i < AUTH_RENDER_CONNECT_ATTEMPTS - 1 && AUTH_RENDER_CONNECT_DELAY_MS > 0) {
        await sleep(AUTH_RENDER_CONNECT_DELAY_MS);
      }
    }
    if (!connected) {
      out.error = lastError;
      return out;
    }
    client = connected.client;

    const target = await client.newTarget('about:blank');
    await client.attach(target.webSocketDebuggerUrl);
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.navigate(pageUrl);

    const raw = await client.evaluate(GATHER_EXPR);
    const list = Array.isArray(raw) ? raw.filter((c) => typeof c === 'string') : [];
    const errLine = list.find((c) => c.startsWith(ERROR_PREFIX));
    out.candidates = list.filter((c) => c.startsWith('candidate:'));
    if (errLine) {
      out.error = errLine.slice(ERROR_PREFIX.length, 200);
      return out;
    }
    out.executed = true;
    return out;
  } catch (e) {
    out.error = e && e.message ? String(e.message).slice(0, 200) : String(e);
    return out;
  } finally {
    try {
      if (client) await client.close();
    } catch {
      // close is best-effort
    }
    if (containerId) {
      try {
        await runner('docker', buildCdpContainerRmArgs(containerId), { timeoutMs: 15000 });
      } catch {
        // container removal is best-effort
      }
    }
  }
}

// ---- the probe ---------------------------------------------------------------

/**
 * Probe WebRTC local IP leakage (#459).
 * @param {string} pageUrl — the pasted page URL (findings are filed under it).
 * @param {object} opts — { labCreds, allowWrite, labTargets, depth,
 *   timeoutMs, runner, cdpConnect, image, diagnostics }.
 *   runner / cdpConnect / image are the CDP-drive seams.
 * @returns {object[]} findings (class 'webrtc_ip_leak', low) — at
 *   most 1 per scan: the aggregated local IPs from the gathered
 *   ICE host candidates.
 */
export async function probeWebrtcLeak(pageUrl, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  // GATES (fail-closed, same lab gate as the DOM trio): lab creds +
  // allowWrite + lab host + depth !== 'quick'. The drive executes
  // JS in the target page via CDP, so it never runs outside the lab
  // gate — even though it performs no writes and contacts no
  // external server.
  const creds = opts.labCreds;
  if (!creds || !creds.username || !creds.password) return findings;
  if (opts.allowWrite !== true) return findings;
  if (!isLabTargetHost(pageUrl, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;
  try {
    new URL(pageUrl);
  } catch {
    return findings;
  }

  // DRIVE — gather ICE candidates from the live page in a real
  // browser. A drive error (browser failed to start, CDP
  // unreachable, in-page RTCPeerConnection unavailable) leaves the
  // oracle uncalibrated — never a finding, and never a proven true
  // negative either.
  setDiag('driveAttempted', true);
  const drive = await driveIceGathering(pageUrl, opts);
  setDiag('driveExecuted', drive.executed);
  if (drive.error) return findings;
  const assess = assessIceCandidates(drive.candidates);
  setDiag('candidatesCollected', assess.candidatesCollected);
  setDiag('rfc1918Found', assess.localIps.length);
  setDiag('mdnsCandidates', assess.mdnsCandidates);
  if (assess.verdict !== 'confirmed') return findings;

  const firstLine = drive.candidates.find((c) => {
    const parsed = extractCandidateIp(c);
    return parsed && parsed.type === 'host' && isLocalIp(parsed.ip);
  });
  findings.push({
    class: 'webrtc_ip_leak',
    id: 'webrtc-local-ip-leak',
    title: `WebRTC local IP leakage — browser exposes local IP address ${assess.localIps[0]} via ICE host candidate (LOW)`,
    severity: 'low',
    url: pageUrl,
    parameter: 'RTCPeerConnection ICE candidate',
    evidence: {
      request:
        `CDP browser drive: navigate ${pageUrl} in a headless browser, then run ` +
        `new RTCPeerConnection({ iceServers: [] }) with a data channel and collect ` +
        `onicecandidate lines for up to ${GATHER_WAIT_MS}ms (host candidates only — no STUN/TURN, ` +
        `no external server contacted, no public IP exposed).`,
      response:
        `The visiting browser exposed literal local IP address(es) in ICE host candidates: ` +
        `${assess.localIps.join(', ')} (${assess.candidatesCollected} candidate line(s) collected, ` +
        `${assess.hostCandidates} host candidate(s), ${assess.mdnsCandidates} mDNS-masked). ` +
        `Example candidate line: ${firstLine || '(none)'} ` +
        `Modern browsers mask local IPs with mDNS (.local) hostnames — this browser did not, so any ` +
        `page the user visits learns their local network address. Note: the candidates are a ` +
        `property of the visiting browser, not of the target's server code.`,
      impact_demo:
        'Local-network topology disclosure — a malicious page (or third-party script) learns the visitor\'s LAN address (e.g. 192.168.x.x), which aids targeted attacks on the local network (router admin, intranet hosts, CSRF against LAN devices). Disable WebRTC, or set the browser\'s WebRTC IP handling policy to mask local IPs with mDNS (the modern default), or route browser traffic through a VPN that hides the LAN address (CWE-200, OWASP A01:2021).',
      signalCorrelated: true,
    },
  });
  return findings.slice(0, MAX_FINDINGS);
}

export const __webrtcLeakMeta = { phases: ['webrtc-leak'], depth: ['standard', 'deep'] };
