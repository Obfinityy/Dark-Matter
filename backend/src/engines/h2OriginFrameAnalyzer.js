/**
 * h2OriginFrameAnalyzer.js — HTTP/2 ORIGIN frame analysis engine.
 *
 * Parses and analyzes HTTP/2 ORIGIN frames (RFC 8336, frame type 0xC) observed
 * on connections to authorized targets. ORIGIN frames advertise alternate
 * origins the server claims authority for — a legitimate discovery source for
 * alternate hostnames (aliases, regional endpoints, legacy domains) that may
 * sit in or out of the authorized scope.
 *
 * Pure parsing/analysis of captured frame payloads; performs no network I/O.
 */

export const ORIGIN_FRAME_TYPE = 0x0c;

/**
 * Parse the payload of an ORIGIN frame into its origin list (RFC 8336 §2).
 * Payload: sequence of Origin-Entry = Origin-Len (16 bits) + ASCII-Origin.
 * @param {Buffer|Uint8Array|number[]} payload raw frame payload bytes
 * @returns {{origins: string[], malformed: boolean, notes: string[]}}
 */
export function parseOriginFrame(payload) {
  const notes = [];
  let buf;
  try {
    buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  } catch {
    return { origins: [], malformed: true, notes: ['payload is not decodable as bytes'] };
  }
  const origins = [];
  let offset = 0;
  let malformed = false;
  while (offset < buf.length) {
    if (offset + 2 > buf.length) {
      malformed = true;
      notes.push(`truncated origin length at offset ${offset}`);
      break;
    }
    const len = buf.readUInt16BE(offset);
    offset += 2;
    if (len === 0) {
      malformed = true;
      notes.push('zero-length origin entry (invalid per RFC 8336)');
      break;
    }
    if (offset + len > buf.length) {
      malformed = true;
      notes.push(`origin entry of ${len} bytes overruns payload at offset ${offset}`);
      break;
    }
    const raw = buf.slice(offset, offset + len).toString('ascii');
    offset += len;
    if (!/^https?:\/\/[^\s/]+$/i.test(raw)) {
      malformed = true;
      notes.push(`non-ASCII-origin entry rejected: "${raw.slice(0, 64)}"`);
      continue;
    }
    origins.push(raw.toLowerCase());
  }
  return { origins: [...new Set(origins)], malformed, notes };
}

/**
 * Build an ORIGIN frame payload from a list of origins (for test harnesses).
 * @param {string[]} origins e.g. ["https://example.com"]
 * @returns {Buffer}
 */
export function buildOriginPayload(origins = []) {
  const parts = [];
  for (const o of origins) {
    const ascii = Buffer.from(String(o), 'ascii');
    const len = Buffer.alloc(2);
    len.writeUInt16BE(ascii.length, 0);
    parts.push(len, ascii);
  }
  return Buffer.concat(parts);
}

/**
 * Aggregate ORIGIN frames observed across connections into an alternate-origin map.
 * @param {{connection: string, payload: Buffer|Uint8Array|number[]}[]} frames
 * @returns {{byConnection: object, alternates: string[], malformedFrames: number}}
 */
export function discoverAlternateOrigins(frames = []) {
  const byConnection = {};
  const alternates = new Set();
  let malformedFrames = 0;
  for (const f of Array.isArray(frames) ? frames : []) {
    if (!f || !f.connection) continue;
    const parsed = parseOriginFrame(f.payload);
    byConnection[f.connection] = parsed.origins;
    for (const o of parsed.origins) alternates.add(o);
    if (parsed.malformed) malformedFrames++;
  }
  return { byConnection, alternates: [...alternates].sort(), malformedFrames };
}

/**
 * Assess discovered alternate origins for scope and exposure concerns.
 * @param {string[]} origins origin URLs from ORIGIN frames
 * @param {string[]} [inScopeHosts] authorized hostnames (lowercase)
 * @returns {{origin: string, inScope: boolean, exposure: string, riskScore: number}[]}
 */
export function assessOriginExposure(origins = [], inScopeHosts = []) {
  const scope = new Set(
    (Array.isArray(inScopeHosts) ? inScopeHosts : []).map(h => String(h).toLowerCase())
  );
  return (Array.isArray(origins) ? origins : [])
    .map(origin => {
      let host = '';
      try {
        host = new URL(origin).hostname.toLowerCase();
      } catch {
        host = '';
      }
      const inScope = host !== '' && scope.has(host);
      let exposure = 'public-alias';
      let riskScore = 10;
      if (!inScope) {
        exposure = 'out-of-scope-origin';
        riskScore = 55;
      }
      if (/(^|[.-])(internal|intranet|staging|stage|dev|test|qa|admin|vpn)($|[.-])/i.test(host)) {
        exposure = 'sensitive-name-origin';
        riskScore = Math.max(riskScore, 75);
      }
      return { origin, inScope, exposure, riskScore };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

export const H2_ORIGIN_FRAME = {
  ORIGIN_FRAME_TYPE,
  parseOriginFrame,
  buildOriginPayload,
  discoverAlternateOrigins,
  assessOriginExposure,
};
