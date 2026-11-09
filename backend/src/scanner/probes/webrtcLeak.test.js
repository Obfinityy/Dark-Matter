// Dark Matter rule-based scanner — WebRTC local IP leakage probe
// tests (coverage row #459 [Low] Browser — WebRTC local IP leakage,
// CWE-200; phase 111, 'webrtc-leak').
//
// Fake CDP seams (fake runner / fake CDP client); no docker, no
// real browser, no network. Candidate fixtures use TEST-NET /
// RFC1918 documentation addresses only — never real user IPs.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeWebrtcLeak,
  driveIceGathering,
  extractCandidateIp,
  isLocalIp,
  assessIceCandidates,
  __webrtcLeakMeta,
} from './webrtcLeak.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const LAB_URL = 'http://172.17.0.1:3000/';
const NON_LAB_URL = 'http://example.com/';
const LAB_TARGETS = ['172.17.0.1'];
const LAB_CREDS = { username: 'lab-user', password: 'lab-pass' };

function labOpts(extra = {}) {
  return {
    labCreds: LAB_CREDS,
    allowWrite: true,
    labTargets: LAB_TARGETS,
    depth: 'standard',
    ...extra,
  };
}

// ---- candidate fixtures (documentation addresses only) ---------------------

const HOST_RFC1918 =
  'candidate:1 1 udp 2122260223 192.168.1.5 54321 typ host generation 0 ufrag abc';
const HOST_RFC1918_10 =
  'candidate:2 1 udp 2122260223 10.0.4.7 54322 typ host generation 0 ufrag abc';
const HOST_DOCKER_BRIDGE =
  'candidate:1 1 udp 2122260223 172.17.0.2 54321 typ host generation 0 ufrag abc';
const HOST_MDNS =
  'candidate:1 1 udp 2122260223 a1b2c3d4-1234-5678-9abc-def012345678.local 54321 typ host generation 0 ufrag abc';
const HOST_MDNS_2 =
  'candidate:2 1 udp 2122260223 b2c3d4e5-2345-6789-abcd-ef0123456789.local 54322 typ host generation 0 ufrag abc';
const HOST_PUBLIC =
  'candidate:1 1 udp 2122260223 203.0.113.9 54321 typ host generation 0 ufrag abc';
const SRFLX_PUBLIC =
  'candidate:1 1 udp 1686052607 203.0.113.9 54321 typ srflx raddr 192.168.1.5 rport 54321 generation 0 ufrag abc';
const RELAY_PUBLIC =
  'candidate:1 1 udp 41885439 203.0.113.9 54321 typ relay raddr 203.0.113.9 rport 54321 generation 0 ufrag abc';

// ---- fakes -----------------------------------------------------------------

// Fake CDP client. `mode` decides what the gather observes:
//   'mdns-only'  — only mDNS-masked host candidates (modern browser).
//   'rfc1918'    — one mDNS host + one RFC1918 host + one public srflx.
//   'zero'       — the gather returns no candidates at all.
//   'page-error' — RTCPeerConnection throws inside the page.
function fakeCdpClient(mode) {
  const canned = {
    'mdns-only': [HOST_MDNS, HOST_MDNS_2],
    rfc1918: [HOST_MDNS, HOST_RFC1918, SRFLX_PUBLIC],
    zero: [],
    'page-error': ['__error__:RTCPeerConnection is not defined'],
  };
  const client = {
    endpoint: 'http://127.0.0.1:9222',
    async newTarget() {
      return { webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/FAKE' };
    },
    async attach() {},
    async send() {
      return {};
    },
    async navigate() {
      return {};
    },
    async evaluate(expr) {
      if (String(expr).includes('RTCPeerConnection')) {
        return canned[mode] !== undefined ? canned[mode].slice() : [];
      }
      return undefined;
    },
    async close() {},
  };
  return client;
}

function fakeCdpConnect(mode) {
  const client = fakeCdpClient(mode);
  return async () => ({ ok: true, client });
}

// Fake docker runner: 'run' starts a container, 'rm' removes it.
function fakeRunner(calls) {
  return async (_file, args) => {
    calls.push(Array.isArray(args) ? args.slice() : args);
    if (Array.isArray(args) && args[0] === 'run') return { ok: true, stdout: 'fake-container-id\n' };
    if (Array.isArray(args) && args[0] === 'rm') return { ok: true, stdout: '' };
    return { ok: true, stdout: '' };
  };
}

function failingRunner() {
  return async () => ({ ok: false, stdout: '', stderr: 'Cannot connect to the Docker daemon' });
}

// Probe with the CDP drive faked (mode selects the observed outcome).
async function probeWithFakeCdp(mode, extra = {}) {
  const calls = [];
  const diag = {};
  const findings = await probeWebrtcLeak(
    LAB_URL,
    labOpts({
      runner: fakeRunner(calls),
      cdpConnect: fakeCdpConnect(mode),
      diagnostics: diag,
      ...extra,
    })
  );
  return { findings, diag, calls };
}

test('WR-1: extractCandidateIp parses a host candidate line', () => {
  assert.deepEqual(extractCandidateIp(HOST_RFC1918), { ip: '192.168.1.5', type: 'host' });
  assert.deepEqual(extractCandidateIp(HOST_MDNS), {
    ip: 'a1b2c3d4-1234-5678-9abc-def012345678.local',
    type: 'host',
  });
});

test('WR-2: extractCandidateIp parses srflx/relay and rejects malformed lines', () => {
  assert.deepEqual(extractCandidateIp(SRFLX_PUBLIC), { ip: '203.0.113.9', type: 'srflx' });
  assert.deepEqual(extractCandidateIp(RELAY_PUBLIC), { ip: '203.0.113.9', type: 'relay' });
  assert.equal(extractCandidateIp('not a candidate at all'), null);
  assert.equal(extractCandidateIp(''), null);
  assert.equal(extractCandidateIp('candidate:1 1 udp'), null);
  assert.equal(extractCandidateIp(null), null);
});

test('WR-3: isLocalIp flags RFC1918 + link-local, not public or loopback', () => {
  for (const ip of ['10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.254', '192.168.0.1', '192.168.1.5', '169.254.10.20']) {
    assert.equal(isLocalIp(ip), true, `${ip} must be local`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.113.9', '172.15.0.1', '172.32.0.1', '192.169.1.1', '127.0.0.1', '0.0.0.0']) {
    assert.equal(isLocalIp(ip), false, `${ip} must NOT be local`);
  }
});

test('WR-4: isLocalIp flags IPv6 ULA + link-local, not global or loopback, not mDNS', () => {
  for (const ip of ['fe80::1', 'febf::abcd', 'fc00::1', 'fd12:3456::1']) {
    assert.equal(isLocalIp(ip), true, `${ip} must be local`);
  }
  for (const ip of ['2001:db8::1', '2606:4700:4700::1111', '::1', 'a1b2c3d4-1234-5678-9abc-def012345678.local']) {
    assert.equal(isLocalIp(ip), false, `${ip} must NOT be local`);
  }
});

test('WR-5: assessIceCandidates with zero lines is uncalibrated, never a pass', () => {
  const r = assessIceCandidates([]);
  assert.equal(r.verdict, 'uncalibrated');
  assert.equal(r.candidatesCollected, 0);
  assert.deepEqual(r.localIps, []);
});

test('WR-6: assessIceCandidates with mDNS-only host candidates is a true negative', () => {
  const r = assessIceCandidates([HOST_MDNS, HOST_MDNS_2]);
  assert.equal(r.verdict, 'not-exposed');
  assert.equal(r.candidatesCollected, 2);
  assert.equal(r.hostCandidates, 2);
  assert.equal(r.mdnsCandidates, 2);
  assert.deepEqual(r.localIps, []);
});

test('WR-7: assessIceCandidates confirms on one RFC1918 host candidate', () => {
  const r = assessIceCandidates([HOST_MDNS, HOST_RFC1918]);
  assert.equal(r.verdict, 'confirmed');
  assert.deepEqual(r.localIps, ['192.168.1.5']);
  assert.equal(r.candidatesCollected, 2);
  assert.equal(r.mdnsCandidates, 1);
});

test('WR-8: assessIceCandidates dedups repeated IPs and counts every shape', () => {
  // HOST_DOCKER_BRIDGE (172.17.0.2) is a genuine RFC1918 host
  // candidate: the scanner's own container bridge IP is flagged
  // exactly like any other LAN address — the oracle does not
  // special-case the scanner's infrastructure.
  const r = assessIceCandidates([HOST_RFC1918, HOST_RFC1918, HOST_RFC1918_10, HOST_DOCKER_BRIDGE, HOST_MDNS, SRFLX_PUBLIC, RELAY_PUBLIC, 'junk line']);
  assert.equal(r.verdict, 'confirmed');
  assert.deepEqual(r.localIps, ['192.168.1.5', '10.0.4.7', '172.17.0.2']);
  assert.equal(r.candidatesCollected, 7);
  assert.equal(r.hostCandidates, 5);
  assert.equal(r.srflxCandidates, 2);
  assert.equal(r.mdnsCandidates, 1);
});

test('WR-9: assessIceCandidates never flags srflx/relay, even with an RFC1918 raddr', () => {
  const r = assessIceCandidates([SRFLX_PUBLIC, RELAY_PUBLIC]);
  assert.equal(r.verdict, 'not-exposed');
  assert.deepEqual(r.localIps, []);
  assert.equal(r.srflxCandidates, 2);
});

test('WR-10: probe gates — no labCreds, no allowWrite, non-lab host, quick depth all return []', async () => {
  const calls = [];
  const base = { runner: fakeRunner(calls), cdpConnect: fakeCdpConnect('rfc1918') };
  assert.deepEqual(await probeWebrtcLeak(LAB_URL, labOpts({ ...base, labCreds: null })), []);
  assert.deepEqual(await probeWebrtcLeak(LAB_URL, labOpts({ ...base, allowWrite: false })), []);
  assert.deepEqual(await probeWebrtcLeak(NON_LAB_URL, labOpts(base)), []);
  assert.deepEqual(await probeWebrtcLeak(LAB_URL, labOpts({ ...base, depth: 'quick' })), []);
  // The gate fails before the drive runs: no container was started.
  assert.equal(calls.length, 0);
});

test('WR-11: drive error (docker runner fails) leaves the oracle uncalibrated, no finding', async () => {
  const diag = {};
  const findings = await probeWebrtcLeak(
    LAB_URL,
    labOpts({ runner: failingRunner(), cdpConnect: fakeCdpConnect('rfc1918'), diagnostics: diag })
  );
  assert.deepEqual(findings, []);
  assert.equal(diag.driveAttempted, true);
  assert.equal(diag.driveExecuted, false);
});

test('WR-12: CDP connect failure leaves the oracle uncalibrated, no finding', async () => {
  const diag = {};
  const findings = await probeWebrtcLeak(
    LAB_URL,
    labOpts({
      runner: fakeRunner([]),
      cdpConnect: async () => ({ ok: false, error: 'cdp endpoint unreachable' }),
      diagnostics: diag,
    })
  );
  assert.deepEqual(findings, []);
  assert.equal(diag.driveAttempted, true);
  assert.equal(diag.driveExecuted, false);
});

test('WR-13: mDNS-only drive is a proven true negative with full diagnostics', async () => {
  const { findings, diag } = await probeWithFakeCdp('mdns-only');
  assert.deepEqual(findings, []);
  assert.equal(diag.driveAttempted, true);
  assert.equal(diag.driveExecuted, true);
  assert.equal(diag.candidatesCollected, 2);
  assert.equal(diag.mdnsCandidates, 2);
  assert.equal(diag.rfc1918Found, 0);
});

test('WR-14: RFC1918 host candidate confirms one Low finding with the candidate line as evidence', async () => {
  const { findings, diag } = await probeWithFakeCdp('rfc1918');
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'webrtc_ip_leak');
  assert.equal(f.severity, 'low');
  assert.equal(f.url, LAB_URL);
  assert.ok(f.title.includes('192.168.1.5'), 'title must name the leaked IP');
  assert.ok(f.evidence.response.includes('192.168.1.5'), 'response must carry the leaked IP');
  assert.ok(f.evidence.response.includes(HOST_RFC1918), 'response must carry the candidate line');
  assert.ok(f.evidence.request.includes('RTCPeerConnection'), 'request must describe the drive');
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(diag.rfc1918Found, 1);
  assert.equal(diag.candidatesCollected, 3);
});

test('WR-15: zero-candidate drive is uncalibrated — no finding, diagnostics prove the empty gather', async () => {
  const { findings, diag } = await probeWithFakeCdp('zero');
  assert.deepEqual(findings, []);
  assert.equal(diag.driveAttempted, true);
  assert.equal(diag.driveExecuted, true);
  assert.equal(diag.candidatesCollected, 0);
  assert.equal(diag.rfc1918Found, 0);
});

test('WR-16: in-page RTCPeerConnection error leaves the oracle uncalibrated, no finding', async () => {
  const { findings, diag } = await probeWithFakeCdp('page-error');
  assert.deepEqual(findings, []);
  assert.equal(diag.driveAttempted, true);
  assert.equal(diag.driveExecuted, false);
});

test('WR-17: a probe finding judges confirmed on the default protocol', async () => {
  const { findings } = await probeWithFakeCdp('rfc1918');
  assert.equal(findings.length, 1);
  const { verdict } = assessConfirmation(findings[0]);
  assert.equal(verdict, 'confirmed');
});

test('WR-18: diagnostics on the confirmed path count every gathered shape', async () => {
  const { findings, diag } = await probeWithFakeCdp('rfc1918');
  assert.equal(findings.length, 1);
  assert.equal(diag.candidatesCollected, 3);
  assert.equal(diag.rfc1918Found, 1);
  assert.equal(diag.mdnsCandidates, 1);
  assert.equal(diag.driveAttempted, true);
  assert.equal(diag.driveExecuted, true);
});

test('WR-19: malformed page URL returns [] without throwing', async () => {
  const findings = await probeWebrtcLeak('not a url', labOpts({ runner: fakeRunner([]), cdpConnect: fakeCdpConnect('rfc1918') }));
  assert.deepEqual(findings, []);
});

test('WR-20: driveIceGathering never throws when the runner fails', async () => {
  const out = await driveIceGathering(LAB_URL, { runner: failingRunner(), cdpConnect: fakeCdpConnect('rfc1918') });
  assert.equal(out.attempted, false);
  assert.equal(out.executed, false);
  assert.deepEqual(out.candidates, []);
  assert.ok(typeof out.error === 'string' && out.error.length > 0);
});

test('WR-21: driveIceGathering returns the gathered candidates on a healthy fake drive', async () => {
  const calls = [];
  const out = await driveIceGathering(LAB_URL, { runner: fakeRunner(calls), cdpConnect: fakeCdpConnect('rfc1918') });
  assert.equal(out.attempted, true);
  assert.equal(out.executed, true);
  assert.equal(out.error, null);
  assert.deepEqual(out.candidates, [HOST_MDNS, HOST_RFC1918, SRFLX_PUBLIC]);
  // Container started and removed.
  assert.ok(calls.some((a) => Array.isArray(a) && a[0] === 'run'));
  assert.ok(calls.some((a) => Array.isArray(a) && a[0] === 'rm'));
});

test('WR-22: probe meta declares the webrtc-leak phase and standard/deep depths', () => {
  assert.deepEqual(__webrtcLeakMeta.phases, ['webrtc-leak']);
  assert.deepEqual(__webrtcLeakMeta.depth, ['standard', 'deep']);
});
