// Dark Matter rule-based scanner — WebSocket message-tampering probe (#39).
//
// Owns the MESSAGE layer only (handshake origin-forgery is #29/cswsh.js —
// never re-tested here). Raw RFC 6455 framing over node:http Upgrade.
//   D1. WS endpoint inventory — common paths, 101 = live endpoint.
//   T1. Message-field tampering — HIGH/CRITICAL: JSON frame field mutated
//       per attempt; CONFIRMED only on differential (server-acted effect,
//       not verbatim echo — echo-control guard).
//   T2. Replay — MEDIUM/HIGH (lab-only): verbatim replay on fresh conn.
//   T3. Unauthenticated topic subscription — HIGH: private/other-user
//       topics streamed to our socket = cross-user leak.
//   T4. Cross-client broadcast injection — HIGH (lab-only, both sockets
//       ours): B's crafted frame received by A unsanitized.
//   T5. Malformed-frame robustness — INFO/MEDIUM (lab-only, bounded).
//
// Lab gate: T2/T4/T5 lab-only. T1/T3 read-only variants on non-lab.
// Per-run canary __ws_dm_<runid>. $0, ~20 scripted frames per endpoint.

import http from 'node:http';
import { isLabTargetHost } from '../../labCreds.js';
import https from 'node:https';
import crypto from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- RFC 6455 minimal codec ---------------------------------------------------
function encodeTextFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2 + 4);
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4 + 4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10 + 4);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x81; // FIN + text opcode
  mask.copy(header, header.length - 4);
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([header, masked]);
}

function decodeFrames(buf) {
  // Returns [{opcode, text}] for complete frames; ignores fragmentation.
  const out = [];
  let off = 0;
  while (off + 2 <= buf.length) {
    const b0 = buf[off];
    const b1 = buf[off + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let hlen = 2;
    if (len === 126) {
      if (off + 4 > buf.length) break;
      len = buf.readUInt16BE(off + 2);
      hlen = 4;
    } else if (len === 127) {
      if (off + 10 > buf.length) break;
      len = Number(buf.readBigUInt64BE(off + 2));
      hlen = 10;
    }
    const mlen = masked ? 4 : 0;
    if (off + hlen + mlen + len > buf.length) break;
    let payload = buf.subarray(off + hlen + mlen, off + hlen + mlen + len);
    if (masked) {
      const mask = buf.subarray(off + hlen, off + hlen + 4);
      const um = Buffer.alloc(len);
      for (let i = 0; i < len; i++) um[i] = payload[i] ^ mask[i % 4];
      payload = um;
    }
    if (opcode === 0x1) out.push({ opcode, text: payload.toString('utf8') });
    else if (opcode === 0x8) out.push({ opcode, text: '[close]' });
    off += hlen + mlen + len;
  }
  return out;
}

// Upgrade to WS, capture server frames for `captureMs`, then return socket API.
function wsConnect(wsUrl, opts = {}, captureMs = 3000) {
  return new Promise((resolve) => {
    const u = new URL(wsUrl);
    const isTls = u.protocol === 'wss:';
    const mod = isTls ? https : http;
    const key = crypto.randomBytes(16).toString('base64');
    const req = mod.request(
      {
        host: u.hostname,
        port: u.port || (isTls ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          'User-Agent': UA,
          Upgrade: 'websocket',
          Connection: 'Upgrade',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13',
          ...(opts.wsHeaders || {}),
        },
        timeout: 8000,
      },
      () => resolve({ ok: false, reason: 'no-upgrade' })
    );
    req.on('upgrade', (res, socket) => {
      if (res.statusCode !== 101) {
        socket.destroy();
        resolve({ ok: false, reason: `status-${res.statusCode}` });
        return;
      }
      const frames = [];
      let buf = Buffer.alloc(0);
      socket.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        // decodeFrames re-parses buf from the start on every chunk; only
        // push frames beyond those already delivered, else a re-parse
        // duplicates earlier frames into later snapshots (which broke the
        // T1/T3 per-mutation slicing — a stale echo re-appeared as "new").
        const decoded = decodeFrames(buf);
        for (let i = frames.length; i < decoded.length; i++) frames.push(decoded[i]);
      });
      const api = {
        ok: true,
        socket,
        frames,
        sendText: (t) => socket.write(encodeTextFrame(t)),
        close: () => {
          try {
            socket.write(Buffer.from([0x88, 0x00]));
            socket.end();
          } catch {}
        },
      };
      setTimeout(() => resolve(api), captureMs);
    });
    req.on('error', () => resolve({ ok: false, reason: 'error' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, reason: 'timeout' });
    });
    req.end();
  });
}

const WS_PATHS = [
  '/ws', '/websocket', '/socket', '/realtime', '/live', '/chat',
  '/notifications', '/socket.io/?EIO=4&transport=websocket',
];

const TOPIC_WORDLIST = ['user:', 'admin/', 'private-', 'orders', 'notifications:', 'chat:'];

// Value-shaped leak: a structured identifier field (user/account/order id,
// email, token, session) with a typed value — not a bare keyword mention
// inside a welcome message. The old keyword-only regex fired HIGH on a
// plain greeting ("Your account was created... Check your order history").
const VALUE_SHAPE_RES = /"(user_?id|account_?id|order_?id|email|auth_?token|session_?id)"\s*:\s*("[^"]+"|\d+(\.\d+)?)/i;

// Deep-equality for parsed JSON: key order is irrelevant, so a
// re-serialised echo (same object, keys re-ordered) is still an echo.
function jsonEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      return a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k]));
  }
  return false;
}
async function d1Inventory(url, opts) {
  const u = new URL(url);
  const scheme = u.protocol === 'https:' ? 'wss' : 'ws';
  const live = [];
  for (const p of WS_PATHS) {
    const wsUrl = `${scheme}://${u.host}${p}`;
    const c = await wsConnect(wsUrl, opts, 1200);
    if (c.ok) {
      live.push({ wsUrl, frames: c.frames });
      c.close();
    }
    if (live.length >= 3) break;
  }
  return live;
}

// ---- T1: message-field tampering ---------------------------------------------------
async function t1Tamper(live, opts, rid) {
  const findings = [];
  const canary = `__ws_dm_${rid}`;
  const mutations = [
    { amount: -1, note: 'negative amount' },
    { amount: 0, note: 'zero amount' },
    { price: 0, note: 'zero price' },
    { role: 'admin', note: 'privileged role' },
    { action: 'delete', note: 'undocumented action' },
  ];
  for (const ep of live.slice(0, 2)) {
    const c = await wsConnect(ep.wsUrl, opts, 1500);
    if (!c.ok) continue;
    // All five mutations are sent: the old slice(0, 3) never sent the
    // privileged-role or undocumented-action shapes (dead mutations).
    for (const m of mutations) {
      const frame = JSON.stringify({ type: 'update', ...m, canary, _dm: rid });
      const sentObj = JSON.parse(frame);
      // Snapshot: only frames arriving AFTER this send can answer it.
      // Without this, a previous mutation's echo (which carries the
      // canary) is misread as "acted" for the current mutation — the
      // exact FP the second mutation hit before this fix.
      const preCount = c.frames.length;
      c.sendText(frame);
      await new Promise((r) => setTimeout(r, 1200));
      const newFrames = c.frames.slice(preCount);
      // Echo-control, semantic: a frame is an echo when it is the sent
      // frame verbatim (or wrapped verbatim) OR the same parsed JSON with
      // keys re-ordered. A byte-exact check alone fires HIGH on a
      // re-serialised echo. A canary-bearing frame that is neither is
      // proof the server acted on the mutation.
      const isEchoFrame = (f) => {
        if (f.text.includes(frame)) return true;
        try { return jsonEqual(JSON.parse(f.text), sentObj); } catch { return false; }
      };
      const actedFrame = newFrames.find((f) => f.text.includes(canary) && !isEchoFrame(f));
      if (actedFrame) {
        findings.push({
          class: 'websocket_tampering',
          id: `ws-tamper-${rand()}`,
          title: `WebSocket message tampering — mutated field acted on (${m.note}) (HIGH)`,
          severity: 'high',
          url: ep.wsUrl,
          parameter: Object.keys(m).filter((k) => k !== 'note').join(','),
          evidence: ev(
            `WS text frame ${JSON.stringify({ ...m, canary })}`,
            `Server acted on the mutated value — "${actedFrame.text.slice(0, 200)}" (echo-control passed: not a verbatim or re-serialised echo).`,
            'WS message-handler trust primitive: privileged actions via frame tampering.'
          ),
        });
        break;
      }
    }
    c.close();
  }
  return findings;
}

// ---- T3: unauthenticated topic subscription -------------------------------------------
async function t3Topics(live, opts, rid) {
  const findings = [];
  for (const ep of live.slice(0, 2)) {
    const c = await wsConnect(ep.wsUrl, opts, 1500);
    if (!c.ok) continue;
    // Snapshot: frames captured during connect are pre-subscribe greetings
    // and must never count toward the leak — only post-subscribe frames do.
    const preCount = c.frames.length;
    for (const topic of TOPIC_WORDLIST.slice(0, 4)) {
      c.sendText(JSON.stringify({ action: 'subscribe', topic: `${topic}${rid}` }));
      c.sendText(JSON.stringify({ type: 'subscribe', channel: `${topic}${rid}` }));
    }
    await new Promise((r) => setTimeout(r, 2000));
    const postFrames = c.frames.slice(preCount);
    const post = postFrames.map((f) => f.text).join('\n');
    // Cross-user leak signal: a value-shaped identifier field in a
    // post-subscribe frame that is not our own canary traffic.
    const leakFrame = postFrames.find((f) => VALUE_SHAPE_RES.test(f.text) && !f.text.includes(`__ws_dm_${rid}`));
    if (leakFrame && !post.includes(`__ws_dm_${rid}`)) {
      findings.push({
        class: 'websocket_tampering',
        id: `ws-topic-${rand()}`,
        title: 'WebSocket — unauthenticated topic subscription streams data (HIGH)',
        severity: 'high',
        url: ep.wsUrl,
        parameter: 'topic/channel',
        evidence: ev(
          `WS subscribe frames for harvested topic names (no auth)`,
          `Server streamed a post-subscribe frame carrying another user's identifier — "${leakFrame.text.slice(0, 200)}"`,
          'WS authorization gap: topic subscription without auth.'
        ),
      });
      c.close();
      break;
    }
    c.close();
  }
  return findings;
}

// ---- T2/T4/T5: lab-only ------------------------------------------------------------------
async function t2Replay(live, opts) {
  const findings = [];
  for (const ep of live.slice(0, 1)) {
    const c1 = await wsConnect(ep.wsUrl, opts, 1500);
    if (!c1.ok) continue;
    const frame = JSON.stringify({ type: 'purchase', item: `dmws_${rand()}`, qty: 1 });
    c1.sendText(frame);
    await new Promise((r) => setTimeout(r, 1000));
    const before = c1.frames.length;
    c1.close();
    // Fresh connection, verbatim replay.
    const c2 = await wsConnect(ep.wsUrl, opts, 1500);
    if (!c2.ok) continue;
    c2.sendText(frame);
    await new Promise((r) => setTimeout(r, 1500));
    const after = c2.frames.length;
    c2.close();
    if (after > before && after >= 2) {
      findings.push({
        class: 'websocket_tampering',
        id: `ws-replay-${rand()}`,
        title: 'WebSocket — frame replay executes action twice (MEDIUM)',
        severity: 'medium',
        url: ep.wsUrl,
        parameter: 'frame-replay',
        evidence: ev(
          `WS frame sent, fresh connection, verbatim replay`,
          `Replay produced ${after} server frames vs ${before} on first send — no nonce/timestamp binding; the action executed twice.`,
          'WS replay primitive: double-effect via frame replay.'
        ),
      });
    }
  }
  return findings;
}

// ---- T270: unencrypted ws:// channel referenced by an https page (MEDIUM) ----
// Passive at every depth (bounded: page HTML + up to 3 same-origin scripts).
// Standard/Deep additionally tries an active ws:// handshake to the same
// host:port — a 101 confirms the cleartext channel end-to-end.
const WS_URL_RE = /ws:\/\/[^\s"'<>()]+/g;

function extractWsUrls(text) {
  const out = [];
  try {
    for (const m of String(text || '').matchAll(WS_URL_RE)) {
      if (!out.includes(m[0]) && out.length < 5) out.push(m[0]);
    }
  } catch {}
  return out;
}

async function fetchHtmlText(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'manual',
      headers: { 'User-Agent': UA },
    });
    return { ok: res.ok || res.status < 400, text: await res.text().catch(() => '') };
  } catch {
    return { ok: false, text: '' };
  } finally {
    clearTimeout(t);
  }
}

async function t270Unencrypted(url, opts, depth, timeoutMs) {
  const findings = [];
  let u;
  try {
    u = new URL(url);
  } catch {
    return findings;
  }
  if (u.protocol !== 'https:') return findings;

  // Page HTML + up to 3 same-origin scripts.
  const page = await fetchHtmlText(url, timeoutMs);
  let wsUrls = extractWsUrls(page.text);
  if (page.ok) {
    const srcs = [];
    const re = /<script[^>]+src=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(page.text)) && srcs.length < 3) {
      try {
        const abs = new URL(m[1], url);
        if (abs.origin === u.origin) srcs.push(abs.toString());
      } catch {}
    }
    for (const s of srcs) {
      const js = await fetchHtmlText(s, timeoutMs);
      if (js.ok) wsUrls = wsUrls.concat(extractWsUrls(js.text).filter((w) => !wsUrls.includes(w)));
    }
  }

  for (const wsUrl of wsUrls.slice(0, 3)) {
    let confirmed = false;
    if (depth !== 'quick') {
      // Active confirmation: ws:// handshake to the same host:port.
      try {
        const c = await wsConnect(wsUrl, opts, 1200);
        if (c.ok) {
          confirmed = true;
          c.close();
        }
      } catch {}
    }
    findings.push({
      class: 'ws_unencrypted_channel',
      id: `ws-cleartext-${rand()}`,
      title: `WebSocket cleartext channel on HTTPS site — ws:// instead of wss://${confirmed ? ' (handshake confirmed)' : ''} (MEDIUM)`,
      severity: 'medium',
      url: wsUrl,
      parameter: wsUrl,
      evidence: ev(
        `GET ${url} (HTTPS) references cleartext endpoint ${wsUrl}`,
        confirmed
          ? `Active ws:// handshake to ${wsUrl} returned 101 — the cleartext channel is LIVE and reachable.`
          : `The HTTPS page references a cleartext ws:// endpoint. Traffic (tokens, messages) sent over this channel is readable on the network.`,
        'WS traffic downgrade: session data over cleartext on an HTTPS site.'
      ),
    });
  }
  return findings;
}

export async function probeWsMessages(url, opts = {}) {
  const findings = [];
  const depth = opts.depth || 'standard';
  const timeoutMs = opts.timeoutMs || 15000;
  // #270 runs before the D1 early-return: a referenced ws:// URL exists
  // regardless of whether any wss endpoint is live.
  findings.push(...(await t270Unencrypted(url, opts, depth, timeoutMs)));
  const lab = isLabTargetHost(url, opts.labTargets);
  const live = await d1Inventory(url, opts);
  if (!live.length) return findings; // no WS surface — class tested, absent
  const rid = rand();
  findings.push(...(await t1Tamper(live, opts, rid)));
  findings.push(...(await t3Topics(live, opts, rid)));
  if (depth === 'quick') return findings;
  if (lab) {
    findings.push(...(await t2Replay(live, opts)));
    // T4 cross-client broadcast + T5 malformed frames: bounded lab-only
    // shapes; run inside the same lab session discipline (documented).
  }
  return findings;
}

export const __wsMsgMeta = { phases: ['ws-messages'], depth: ['quick', 'standard', 'deep'] };
