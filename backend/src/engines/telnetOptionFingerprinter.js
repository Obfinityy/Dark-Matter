/**
 * telnetOptionFingerprinter.js — Telnet option-negotiation fingerprinter.
 *
 * Parses IAC (0xFF) negotiation sequences from captured telnet handshake
 * bytes — WILL/WONT/DO/DONT commands, option bytes, and SB..SE
 * subnegotiations — and matches the resulting pattern against known
 * server implementations (Cisco, Windows Telnet, MikroTik, BBS, printers).
 *
 * Pure analysis of captured data only — no connections are made here.
 */

const COMMANDS = {
  240: 'SE',
  241: 'NOP',
  242: 'DM',
  243: 'BRK',
  244: 'IP',
  245: 'AO',
  246: 'AYT',
  247: 'EC',
  248: 'EL',
  249: 'GA',
  250: 'SB',
  251: 'WILL',
  252: 'WONT',
  253: 'DO',
  254: 'DONT',
  255: 'IAC',
};

/**
 * Registered telnet option numbers (RFC 854 and extensions).
 *
 * Option table (selection):
 * | #  | name              | #  | name                |
 * |----|-------------------|----|---------------------|
 * | 0  | BINARY            | 24 | TERMINAL-TYPE       |
 * | 1  | ECHO              | 31 | NAWS                |
 * | 3  | SUPPRESS-GO-AHEAD | 32 | TERMINAL-SPEED      |
 * | 5  | STATUS            | 33 | REMOTE-FLOW-CONTROL |
 * | 6  | TIMING-MARK       | 34 | LINEMODE            |
 * | 23 | SEND-LOCATION     | 35 | X-DISPLAY-LOCATION  |
 * | 25 | END-OF-RECORD     | 36 | ENVIRONMENT (old)   |
 * | 37 | AUTHENTICATION    | 39 | NEW-ENVIRONMENT     |
 */
const OPTION_NAMES = {
  0: 'BINARY',
  1: 'ECHO',
  3: 'SUPPRESS-GO-AHEAD',
  5: 'STATUS',
  6: 'TIMING-MARK',
  8: '3270-REGIME',
  23: 'SEND-LOCATION',
  24: 'TERMINAL-TYPE',
  25: 'END-OF-RECORD',
  31: 'NAWS',
  32: 'TERMINAL-SPEED',
  33: 'REMOTE-FLOW-CONTROL',
  34: 'LINEMODE',
  35: 'X-DISPLAY-LOCATION',
  36: 'ENVIRONMENT',
  37: 'AUTHENTICATION',
  39: 'NEW-ENVIRONMENT',
};

/**
 * Convert a hex dump (whitespace/colon/dash separators tolerated),
 * Buffer, Uint8Array, or number[] into a Buffer.
 */
function toBytes(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (Array.isArray(input)) return Buffer.from(input);
  const hex = String(input || '').replace(/[\s:;\-]/g, '');
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('parseNegotiation: input is not valid hex.');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Parse IAC negotiation sequences from captured telnet handshake bytes.
 *
 * Handles: IAC WILL/WONT/DO/DONT <option>, IAC SB <option> <data...> IAC SE
 * (with 0xFF 0xFF data escaping), two-byte commands (e.g. IAC AYT), and
 * escaped literal 0xFF bytes.
 *
 * @param {string|Buffer|Uint8Array|number[]} bytesOrHex
 * @returns {{ command: string, option: number|null, optionName: string|null, subData?: number[] }[]}
 *   Ordered list of parsed negotiation events.
 */
export function parseNegotiation(bytesOrHex) {
  const buf = toBytes(bytesOrHex);
  const events = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1; // payload data — not part of negotiation
      continue;
    }
    if (i + 1 >= buf.length) break;
    const cmd = buf[i + 1];
    const command = COMMANDS[cmd];
    if (!command) {
      i += 2;
      continue;
    }
    if (cmd === 255) {
      i += 2; // escaped literal 0xFF data byte
      continue;
    }
    if (cmd >= 251 && cmd <= 254) {
      if (i + 2 >= buf.length) break;
      const option = buf[i + 2];
      events.push({ command, option, optionName: OPTION_NAMES[option] || `OPTION-${option}` });
      i += 3;
      continue;
    }
    if (cmd === 250) {
      // Subnegotiation: IAC SB <option> <bytes...> IAC SE, honoring FF FF escaping.
      if (i + 2 >= buf.length) break;
      const option = buf[i + 2];
      const data = [];
      let j = i + 3;
      let closed = false;
      while (j < buf.length) {
        if (buf[j] === 0xff) {
          if (j + 1 < buf.length && buf[j + 1] === 0xff) {
            data.push(0xff);
            j += 2;
            continue;
          }
          if (j + 1 < buf.length && buf[j + 1] === 240) {
            j += 2;
            closed = true;
            break;
          }
        }
        data.push(buf[j]);
        j += 1;
      }
      events.push({
        command: 'SB',
        option,
        optionName: OPTION_NAMES[option] || `OPTION-${option}`,
        subData: data,
        terminated: closed,
      });
      i = j;
      continue;
    }
    // Two-byte commands (AYT, IP, AO, EC, EL, BRK, DM, NOP, GA).
    events.push({ command, option: null, optionName: null });
    i += 2;
  }
  return events;
}

/**
 * Fingerprint a telnet server from its negotiation pattern.
 *
 * Matching heuristics (ordered by specificity):
 *  - Cisco IOS: DO TTYPE + DO NAWS + DO TSPEED + DO LFLOW + DO NEW-ENVIRON,
 *    WILL ECHO, WILL SUPPRESS-GO-AHEAD, and often WONT STATUS.
 *  - Windows Telnet Server: DO/DONT AUTHENTICATION with NTLM subnegotiation,
 *    WILL/WONT TERMINAL-TYPE, WILL NAWS.
 *  - MikroTik RouterOS: DO TTYPE, DO NAWS, WILL ECHO, WILL SUPPRESS-GO-AHEAD
 *    in a compact 4-negotiation burst, no NEW-ENVIRONMENT/TSPEED.
 *  - BBS (Mystic / Synchronet): DO TTYPE, DO NAWS, DO TERMINAL-SPEED,
 *    WILL ECHO, WILL SUPPRESS-GO-AHEAD — plus ECHO-before-SGA quirks.
 *  - HP JetDirect / printers: minimal — WILL ECHO + WILL SUPPRESS-GO-AHEAD
 *    only, no DO requests at all.
 *
 * @param {{ command: string, option: number|null, optionName: string|null }[]} negotiations
 * @returns {{ implementation: string, confidence: 'high'|'medium'|'low', evidence: string }}
 */
export function fingerprintTelnetServer(negotiations = []) {
  const events = Array.isArray(negotiations) ? negotiations : [];
  const seq = events.map(
    e => `${e.command}${e.option != null ? ` ${e.optionName || e.option}` : ''}`
  );
  const has = (command, option) => events.some(e => e.command === command && e.option === option);
  const willCount = events.filter(e => e.command === 'WILL').length;
  const doCount = events.filter(e => e.command === 'DO').length;

  const ciscoScore =
    (has('DO', 24) ? 1 : 0) +
    (has('DO', 31) ? 1 : 0) +
    (has('DO', 32) ? 1 : 0) +
    (has('DO', 33) ? 1 : 0) +
    (has('DO', 39) ? 1 : 0) +
    (has('WILL', 1) ? 1 : 0) +
    (has('WILL', 3) ? 1 : 0);
  if (ciscoScore >= 5) {
    return {
      implementation: 'Cisco IOS',
      confidence: ciscoScore >= 6 ? 'high' : 'medium',
      evidence: `Matched ${ciscoScore}/7 Cisco IOS negotiation markers: ${seq.join(', ')}.`,
    };
  }

  if (has('DO', 37) || has('DONT', 37) || events.some(e => e.command === 'SB' && e.option === 37)) {
    return {
      implementation: 'Windows Telnet Server',
      confidence: 'high',
      evidence: `AUTHENTICATION (option 37) negotiation observed: ${seq.join(', ')}.`,
    };
  }

  if (
    doCount >= 2 &&
    willCount >= 2 &&
    has('DO', 24) &&
    has('DO', 31) &&
    has('WILL', 1) &&
    has('WILL', 3) &&
    !has('DO', 39) &&
    !has('DO', 32)
  ) {
    return {
      implementation: 'MikroTik RouterOS',
      confidence: 'medium',
      evidence: `Compact TTYPE/NAWS + ECHO/SGA burst without NEW-ENVIRONMENT or TERMINAL-SPEED: ${seq.join(', ')}.`,
    };
  }

  if (has('DO', 24) && has('DO', 31) && has('DO', 32) && has('WILL', 1) && has('WILL', 3)) {
    return {
      implementation: 'BBS server (Mystic / Synchronet style)',
      confidence: 'medium',
      evidence: `TTYPE + NAWS + TERMINAL-SPEED + ECHO + SGA pattern typical of BBS telnet: ${seq.join(', ')}.`,
    };
  }

  if (willCount >= 2 && doCount === 0 && has('WILL', 1) && has('WILL', 3)) {
    return {
      implementation: 'HP JetDirect / embedded printer',
      confidence: 'medium',
      evidence: `Minimal WILL ECHO + WILL SUPPRESS-GO-AHEAD with no DO requests — typical of print servers: ${seq.join(', ')}.`,
    };
  }

  if (events.length === 0) {
    return {
      implementation: 'Unknown',
      confidence: 'low',
      evidence: 'No IAC negotiation sequences found in the captured bytes.',
    };
  }

  return {
    implementation: 'Unknown',
    confidence: 'low',
    evidence: `Negotiation pattern did not match known implementations: ${seq.join(', ')}.`,
  };
}

export const TELNET_OPTION_FINGERPRINTER = { parseNegotiation, fingerprintTelnetServer };
export default TELNET_OPTION_FINGERPRINTER;
