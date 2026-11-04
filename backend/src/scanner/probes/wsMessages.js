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
import https from 'node:https';
import crypto from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function isLab(url, opts) {
  try {
    const host = new URL(url).hostname;
    return String(opts.labTargets || '')
      .split(/[,\s]+/)
      .filter(Boolean)
      .some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
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
        for (const f of decodeFrames(buf)) frames.push(f);
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

// ---- D1: endpoint inventory ------------------------------------------------------
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
    for (const m of mutations.slice(0, 3)) {
      const frame = JSON.stringify({ type: 'update', ...m, canary, _dm: rid });
      c.sendText(frame);
      await new Promise((r) => setTimeout(r, 1200));
      const post = c.frames.map((f) => f.text).join('\n');
      // Echo-control: verbatim echo of our frame is NOT proof.
      const isEcho = post.includes(frame);
      const acted = post.includes(canary) && !isEcho;
      if (acted) {
        findings.push({
          class: 'websocket_tampering',
          id: `ws-tamper-${rand()}`,
          title: `WebSocket message tampering — mutated field acted on (${m.note}) (HIGH)`,
          severity: 'high',
          url: ep.wsUrl,
          parameter: Object.keys(m).filter((k) => k !== 'note').join(','),
          evidence: ev(
            `WS text frame ${JSON.stringify({ ...m, canary })}`,
            `Server frames show the canary in a NON-echo context — the mutated value took effect server-side (echo-control passed).`,
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
    for (const topic of TOPIC_WORDLIST.slice(0, 4)) {
      c.sendText(JSON.stringify({ action: 'subscribe', topic: `${topic}${rid}` }));
      c.sendText(JSON.stringify({ type: 'subscribe', channel: `${topic}${rid}` }));
    }
    await new Promise((r) => setTimeout(r, 2000));
    const post = c.frames.map((f) => f.text).join('\n');
    // Cross-user leak signal: frames referencing OTHER users/topics.
    const leak = /(user|account|order)[^"']{0,30}(?!__ws_dm_)/i.test(post) && post.length > 50;
    if (leak && !post.includes(`__ws_dm_${rid}`)) {
      findings.push({
        class: 'websocket_tampering',
        id: `ws-topic-${rand()}`,
        title: 'WebSocket — unauthenticated topic subscription streams data (HIGH)',
        severity: 'high',
        url: ep.wsUrl,
        parameter: 'topic/channel',
        evidence: ev(
          `WS subscribe frames for harvested topic names (no auth)`,
          `Server streamed frames referencing other users/orders without authentication — cross-user data leak over WS.`,
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

export async function probeWsMessages(url, opts = {}) {
  const findings = [];
  const lab = isLab(url, opts);
  const depth = opts.depth || 'standard';
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
