// Dark Matter rule-based scanner — local SMTP canary inbox.
// A minimal $0 SMTP sink the scanner starts for the duration of a
// lab-gated scan. A vulnerable target's mail stack, fed an injected Bcc
// header pointing at OUR canary address, delivers the mail HERE — the
// delivery itself is the confirmation for SMTP header injection T2
// (Bcc relay, CRITICAL), and the same oracle serves T3 (From spoof /
// Content-Type flip) and T4 (MIME separator) when those probes land.
// No external mail service, no real delivery to any third-party address,
// no new network egress: the sink only ever LISTENS, it never relays
// anything onward, and every message it stores was addressed to the
// canary domain.
//
// Topology: the scanner backend runs ON the EC2 host; the authorised lab
// containers live on the docker bridge and reach the host at the bridge
// gateway (172.17.0.1). The listener binds 0.0.0.0 on an ephemeral port
// and the canary address carries the reserved `.invalid` domain
// (RFC 2606 — guaranteed unresolvable), so a lab app's MTA can only
// deliver to the sink when it is explicitly configured to relay to it
// (our lab fixture does exactly that). A real lab target with no mail
// form — DVWA and Juice Shop today — is an honest true negative: the
// probe sends nothing confirmable and the phase stays silent.
//
// Lab gating mirrors the OOB collaborators: runScan starts the sink only
// when the scan target itself is a lab host (allowWrite), and the probe
// re-checks opts.labTargets before sending anything. A non-lab target
// never receives a canary address. The sink is always stopped afterwards
// (finally), so no listener outlives the scan.
//
// Safety: the sink records messages and answers with static SMTP replies.
// It never serves files, never executes anything, never sends mail.
// Tokens (the per-run random id in the canary address) are per-run
// random, so a stray message cannot be mistaken for another probe's
// confirmation. Stored messages are capped (oldest dropped first).
import net from 'node:net';

const DEFAULT_DOMAIN = 'dm-canary.invalid'; // RFC 2606 reserved — never resolves
const MAX_MESSAGES = 200;

function parseHeaders(raw) {
  const head = raw.split(/\r?\n\r?\n/)[0] || '';
  return head;
}

function parseBody(raw) {
  const idx = raw.search(/\r?\n\r?\n/);
  if (idx < 0) return '';
  return raw.slice(idx).replace(/^\r?\n\r?\n/, '');
}

export function createSmtpCanaryInbox({
  listenHost = '0.0.0.0',
  listenPort = 0,
  domain = DEFAULT_DOMAIN,
} = {}) {
  const messages = [];
  const waiters = new Map(); // lowercased address -> Set<finish>
  let server = null;
  let boundPort = null;
  let stopped = false;

  function recordMessage(msg) {
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);
    // Wake any waiter whose address this message was sent to (envelope
    // recipient) or named in its headers (a relay that kept the Bcc line
    // in the header block but rewrote the envelope).
    const addrs = new Set(
      (msg.to || []).map((a) => String(a).toLowerCase())
    );
    for (const line of (msg.headers || '').split('\n')) {
      const m = line.match(/^(?:to|cc|bcc)\s*:\s*(.+)$/i);
      if (m) {
        for (const part of m[1].split(',')) {
          const addr = part.trim().replace(/^<|>$/g, '');
          if (addr) addrs.add(addr.toLowerCase());
        }
      }
    }
    for (const addr of addrs) {
      const set = waiters.get(addr);
      if (set) {
        waiters.delete(addr);
        for (const finish of set) finish(msg);
      }
    }
    return msg;
  }

  function check(address) {
    const needle = String(address || '').toLowerCase();
    if (!needle) return null;
    return (
      messages.find(
        (m) =>
          (m.to || []).some((a) => String(a).toLowerCase() === needle) ||
          (m.headers || '').toLowerCase().includes(needle)
      ) || null
    );
  }

  function hasReceived(address) {
    return check(address);
  }

  // Resolves with the message record when mail for the address arrives,
  // or null on timeout / after stop(). Resolves immediately if the mail
  // already arrived before waiting (the target may relay synchronously
  // while our POST is still in flight).
  function waitFor(address, timeoutMs = 8000) {
    const existing = check(address);
    if (existing) return Promise.resolve(existing);
    if (stopped) return Promise.resolve(null);
    const key = String(address || '').toLowerCase();
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => finish(null), timeoutMs);
      function finish(msg) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const set = waiters.get(key);
        if (set) {
          set.delete(finish);
          if (set.size === 0) waiters.delete(key);
        }
        resolve(msg);
      }
      if (!waiters.has(key)) waiters.set(key, new Set());
      waiters.get(key).add(finish);
    });
  }

  function handleConnection(socket) {
    socket.write('220 dm-canary ESMTP ready\r\n');
    let buf = '';
    let inData = false;
    let dataLines = [];
    let mailFrom = '';
    let rcptTo = [];
    let greetingDone = false;

    function resetTransaction() {
      inData = false;
      dataLines = [];
      mailFrom = '';
      rcptTo = [];
    }

    function endData() {
      // Dot-stuffing: a line starting with ".." loses one dot; the
      // terminator is a line that is exactly ".".
      const raw = dataLines
        .map((l) => (l.startsWith('..') ? l.slice(1) : l))
        .join('\r\n');
      const msg = {
        from: mailFrom,
        to: [...rcptTo],
        headers: parseHeaders(raw),
        body: parseBody(raw),
        raw,
        at: new Date().toISOString(),
      };
      resetTransaction();
      recordMessage(msg);
      socket.write('250 OK: message accepted\r\n');
    }

    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (inData) {
          if (line === '.') {
            inData = false;
            try { endData(); } catch { /* recording must never break the reply */ }
          } else {
            dataLines.push(line);
          }
          continue;
        }
        const [verb, ...rest] = line.split(' ');
        const arg = rest.join(' ').trim();
        const cmd = (verb || '').toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') {
          greetingDone = true;
          socket.write('250-Hello\r\n250 8BITMIME\r\n');
        } else if (cmd === 'MAIL') {
          const m = arg.match(/FROM:\s*<?([^>\s]+)>?/i);
          mailFrom = m ? m[1] : arg;
          rcptTo = [];
          socket.write('250 OK\r\n');
        } else if (cmd === 'RCPT') {
          const m = arg.match(/TO:\s*<?([^>\s]+)>?/i);
          if (m) rcptTo.push(m[1]);
          socket.write('250 OK\r\n');
        } else if (cmd === 'DATA') {
          if (!greetingDone || rcptTo.length === 0) {
            socket.write('503 Bad sequence\r\n');
          } else {
            inData = true;
            dataLines = [];
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          }
        } else if (cmd === 'RSET') {
          resetTransaction();
          socket.write('250 OK\r\n');
        } else if (cmd === 'NOOP') {
          socket.write('250 OK\r\n');
        } else if (cmd === 'VRFY') {
          socket.write('252 Send some mail, please\r\n');
        } else if (cmd === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else if (cmd === '') {
          // Ignore empty lines.
        } else {
          socket.write('502 Command not implemented\r\n');
        }
      }
    });
    socket.on('error', () => {
      try { socket.destroy(); } catch { /* ignore */ }
    });
  }

  async function start() {
    if (server) return boundPort;
    server = net.createServer(handleConnection);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(listenPort, listenHost, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    boundPort = server.address().port;
    return boundPort;
  }

  async function stop() {
    stopped = true;
    for (const [, set] of waiters) for (const finish of set) finish(null);
    waiters.clear();
    if (!server) return;
    const s = server;
    server = null;
    await new Promise((resolve) => s.close(resolve));
  }

  return {
    start,
    stop,
    check,
    waitFor,
    hasReceived,
    messages,
    domain,
    get port() {
      return boundPort;
    },
  };
}
