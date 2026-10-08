/**
 * s7commPlcIdentifier.js — Siemens S7comm SZL data parser and PLC identifier.
 *
 * Parses a captured S7comm SZL (System Status List) read response payload
 * (the user-data portion of an S7 telegram, e.g. inside a ROSCTR=ACK_DATA /
 * UserData reply) and identifies the PLC from the well-known SZL list items:
 *
 *   0x0111 — Module identification: order number (MLFB), module name
 *   0x011C — Component identification: firmware / hardware release strings
 *   0x0131 — Communication identification: module name, serial, plant name
 *
 * SZL data layout (captured data parameter):
 *   SZL-ID (2 bytes BE) | index (2 bytes BE) | length of item data (2 bytes BE)
 *   then one or more items, each: fixed-size item record whose layout depends
 *   on the SZL-ID. For 0x0111/0x011C items are 34 bytes: index (2) + 20 bytes
 *   ASCII order number + 2 bytes release + 4 bytes FB + 2 bytes serial + ...
 *   For 0x0131 items are 108 bytes: index (2) + many ASCII fields.
 *
 * Pure parsing — no S7 traffic is generated here; input is captured data.
 */

const VENDOR = 'Siemens';

/**
 * Order-number prefix → PLC family lookup. Order numbers read from SZL data
 * arrive with or without the space after the catalog prefix ("6ES7 3" vs
 * "6ES73"), so matching is done on the spaceless form.
 */
const ORDER_PREFIX_FAMILY = [
  { prefix: '6ES73', family: 'S7-300' },
  { prefix: '6ES74', family: 'S7-400' },
  { prefix: '6ES75', family: 'S7-1500' },
  { prefix: '6ES72', family: 'S7-1200' },
  { prefix: '6ES78', family: 'S7-200 SMART' },
  { prefix: '6GK7', family: 'Siemens network component (CP/CM/NET)' },
  { prefix: '6AV', family: 'Siemens HMI (SIMATIC panel)' },
  { prefix: '6SL', family: 'Siemens drive (SINAMICS)' },
];

/** Normalize captured input to a Buffer. */
function toBuffer(hexOrBuffer) {
  if (Buffer.isBuffer(hexOrBuffer)) return hexOrBuffer;
  const s = String(hexOrBuffer || '').replace(/[^0-9a-fA-F]/g, '');
  return Buffer.from(s, 'hex');
}

/** Decode ASCII field: strip NULs and spaces, printable-only, or 'unknown'. */
function decodeAsciiField(buf) {
  const text = buf
    .toString('latin1')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, '')
    .trim();
  return text.length > 0 ? text : 'unknown';
}

function inferFamily(orderNumber) {
  if (!orderNumber || orderNumber === 'unknown') return 'unknown';
  const normalized = orderNumber.replace(/\s+/g, '').toUpperCase();
  for (const { prefix, family } of ORDER_PREFIX_FAMILY) {
    if (normalized.startsWith(prefix)) return family;
  }
  return 'unknown';
}

/**
 * Parse one SZL item record header and expose typed field slices.
 * Item layouts follow the S7 SZL specification for the known IDs.
 */
function parseSzlItemData(szlId, index, data) {
  const item = { szlId, index, length: data.length, rawHex: data.toString('hex') };
  if (szlId === 0x0111 || szlId === 0x011c) {
    // 34-byte module/component identification record:
    // index(2) | order number(20 ASCII) | release(2) | FB number(4) | serial(2) | spare.
    item.orderNumber = decodeAsciiField(data.slice(2, 22));
    item.release = data.length >= 24 ? `${data[22]}.${data[23]}` : 'unknown';
    item.fbNumber = data.length >= 28 ? data.slice(24, 28).toString('hex') : 'unknown';
  } else if (szlId === 0x0131) {
    // 108-byte communication identification record.
    item.moduleName = decodeAsciiField(data.slice(2, 34));
    item.serialNumber = decodeAsciiField(data.slice(34, 58));
    item.plantDesignation = decodeAsciiField(data.slice(58, 90));
    item.copyright = decodeAsciiField(data.slice(90, 108));
  }
  return item;
}

/**
 * Parse a captured SZL data payload into item records.
 *
 * @param {string|Buffer} hexOrBuffer captured SZL data (hex string or Buffer)
 * @returns {{ szlId: number, index: number, itemLength: number, items: object[] }}
 */
export function parseSzlData(hexOrBuffer) {
  const buf = toBuffer(hexOrBuffer);
  const empty = { szlId: 0, index: 0, itemLength: 0, items: [] };
  if (buf.length < 6) return empty;
  const szlId = buf.readUInt16BE(0);
  const index = buf.readUInt16BE(2);
  const itemLength = buf.readUInt16BE(4);
  const items = [];
  let offset = 6;
  while (offset + itemLength <= buf.length && itemLength > 0) {
    items.push(parseSzlItemData(szlId, index, buf.slice(offset, offset + itemLength)));
    offset += itemLength;
  }
  return { szlId, index, itemLength, items };
}

/**
 * Identify the PLC from known SZL items (0x0111, 0x011C, 0x0131).
 *
 * @param {string|Buffer} hexOrBuffer captured SZL data payload
 * @returns {{ orderNumber: string, firmware: string, moduleName: string,
 *   vendor: string, family: string, confidence: 'high'|'medium'|'low',
 *   evidence: string }}
 */
export function identifyPlcFromSzl(hexOrBuffer) {
  const parsed = parseSzlData(hexOrBuffer);
  const first = parsed.items[0] || {};
  const result = {
    orderNumber: first.orderNumber || 'unknown',
    firmware: 'unknown',
    moduleName: 'unknown',
    vendor: VENDOR,
    family: 'unknown',
    confidence: 'low',
    evidence: 'No known SZL identification items (0x0111/0x011C/0x0131) in captured data.',
  };

  if (parsed.items.length === 0) return result;

  // 0x0111 → order number; 0x011C → firmware/release; 0x0131 → module name.
  if (first.orderNumber && first.orderNumber !== 'unknown') {
    result.orderNumber = first.orderNumber;
  }
  if (parsed.szlId === 0x011c) {
    result.firmware = first.release || 'unknown';
    result.confidence = 'high';
    result.evidence = `SZL 0x011C component record: order ${result.orderNumber}, firmware ${result.firmware}.`;
  } else if (parsed.szlId === 0x0111) {
    result.confidence = 'high';
    result.evidence = `SZL 0x0111 module identification: order number "${result.orderNumber}".`;
  } else if (parsed.szlId === 0x0131) {
    result.moduleName = first.moduleName || 'unknown';
    if (first.serialNumber && first.serialNumber !== 'unknown') {
      result.evidence = `SZL 0x0131 communication record: module "${result.moduleName}", serial ${first.serialNumber}.`;
    } else {
      result.evidence = `SZL 0x0131 communication record: module "${result.moduleName}".`;
    }
    result.confidence = result.moduleName !== 'unknown' ? 'medium' : 'low';
  } else {
    result.confidence = 'low';
    result.evidence = `SZL 0x${parsed.szlId.toString(16).padStart(4, '0')} is not a known identification item.`;
  }

  result.family = inferFamily(result.orderNumber);
  return result;
}

export const S7COMM_PLC_IDENTIFIER = {
  parseSzlData,
  identifyPlcFromSzl,
  VENDOR,
  ORDER_PREFIX_FAMILY,
};

export default S7COMM_PLC_IDENTIFIER;
