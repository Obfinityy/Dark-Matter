/**
 * nfcTagUrlExtractor.js — NFC-tag URL extraction.
 *
 * Idea 00885: extract URLs programmed into NFC tag references found in a
 * target's web presence — SmartPoster NDEF records, tag-writer instructions,
 * App Clip / Instant App NFC deep links, and data-* NFC payload attributes.
 *
 * The module scans HTML/JS/text for NFC-related markers and recovers the
 * encoded URLs locally. It is defensive asset mapping of the target's own
 * published tag references; no radio interaction, no network calls.
 */

/** Markers that suggest NFC content in markup or scripts. */
export const NFC_MARKER_RE =
  /\bnfc\b|ndef|smartposter|tagwriter|ntag|ndefwriter|webnfc|NDEFReader/i;

/** NDEF SmartPoster URI-identifier-code prefixes (NFC Forum RTD). */
export const NDEF_URI_PREFIXES = {
  0x00: '',
  0x01: 'http://www.',
  0x02: 'https://www.',
  0x03: 'http://',
  0x04: 'https://',
  0x05: 'tel:',
  0x06: 'mailto:',
  0x0d: 'sms:',
};

/**
 * Extract URLs from SmartPoster-style NDEF text dumps, e.g.
 * "TNF:1 TYPE:U PAYLOAD:04 65 78 61 6d 70 6c 65 2e 63 6f 6d" or
 * "ndef://uri/https://example.com/x".
 * @param {string} text
 * @returns {{raw: string, url: string}[]}
 */
export function extractNdefUrls(text = '') {
  const out = [];
  const seen = new Set();
  // Explicit URI records: ndef://uri/<url> or "URI: https://..."
  const uriRe = /(?:ndef:\/\/uri\/|(?:^|[\s"'“])(?:uri|url)\s*:\s*)(https?:\/\/[^\s"'”<>{}|^`\\]+)/gi;
  let m;
  while ((m = uriRe.exec(String(text))) !== null) {
    const url = m[1];
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ raw: m[0].trim(), url });
    }
  }
  // SmartPoster payload bytes: "U 04 65 78..." with a URI prefix code.
  const bytesRe = /\bU\s+((?:[0-9A-Fa-f]{2}\s+){2,}[0-9A-Fa-f]{2})/g;
  while ((m = bytesRe.exec(String(text))) !== null) {
    const bytes = m[1].trim().split(/\s+/).map(h => parseInt(h, 16));
    const prefix = NDEF_URI_PREFIXES[bytes[0]];
    if (prefix === undefined) continue;
    const rest = Buffer.from(bytes.slice(1)).toString('utf8').replace(/[^\x20-\x7e]/g, '');
    const url = `${prefix}${rest}`;
    if (/^https?:\/\//.test(url) && !seen.has(url)) {
      seen.add(url);
      out.push({ raw: m[0].trim(), url });
    }
  }
  return out;
}

/**
 * Extract App Clip / Instant App NFC launch URLs and tag URIs.
 * @param {string} text
 * @returns {{raw: string, url: string, kind: string}[]}
 */
export function extractNfcLaunchUrls(text = '') {
  const out = [];
  const seen = new Set();
  const patterns = [
    { re: /https:\/\/appclip\.apple\.com\/[^\s"'<>{}|^`\\]+/gi, kind: 'app-clip' },
    { re: /https:\/\/play\.google\.com\/store\/apps\/details\?[^\s"'<>{}|^`\\]*instant[^"'\s]*/gi, kind: 'instant-app' },
    { re: /tag:\/\/[^\s"'<>{}|^`\\]+/gi, kind: 'tag-uri' },
    { re: /["'](https?:\/\/[^"'\s]*[?&](?:nfc|tag|tap)=[^"'\s]*)["']/gi, kind: 'nfc-param-link' },
  ];
  for (const { re, kind } of patterns) {
    let m;
    while ((m = re.exec(String(text))) !== null) {
      const url = m[1] || m[0];
      if (!seen.has(url)) {
        seen.add(url);
        out.push({ raw: m[0], url, kind });
      }
    }
  }
  return out;
}

/**
 * Extract NFC tag URLs from HTML/JS/text published by the target.
 * @param {string} text - Page HTML, tag-writer docs, or script text.
 * @returns {{tags: object[], stats: object}}
 */
export function extractNfcTagUrls(text = '') {
  const src = String(text);
  const hasMarkers = NFC_MARKER_RE.test(src);
  const ndef = extractNdefUrls(src).map(r => ({ ...r, kind: 'ndef-smartposter' }));
  const launch = extractNfcLaunchUrls(src);
  // data-nfc-* attributes carrying a URL payload.
  const attrHits = [];
  const attrRe = /\bdata-nfc(?:-[a-z]+)?\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  let m;
  const seenAttr = new Set();
  while ((m = attrRe.exec(src)) !== null) {
    if (!seenAttr.has(m[1])) {
      seenAttr.add(m[1]);
      attrHits.push({ raw: m[0], url: m[1], kind: 'data-attribute' });
    }
  }
  const tags = [...ndef, ...launch, ...attrHits].map(t => ({
    kind: 'nfc-tag-url',
    ...t,
  }));
  const byKind = {};
  for (const t of tags) byKind[t.kind] = (byKind[t.kind] || 0) + 1;
  return {
    tags,
    stats: {
      nfcMarkersPresent: hasMarkers,
      total: tags.length,
      byKind,
      uniqueUrls: [...new Set(tags.map(t => t.url))],
    },
  };
}

/**
 * Build a report finding from NFC tag extraction.
 * @param {ReturnType<typeof extractNfcTagUrls>} result
 */
export function nfcTagFinding(result) {
  return {
    title: `NFC tag URL extraction — ${result.stats.total} tag URL(s)`,
    severity: 'Info',
    confidence: result.stats.total > 0 ? 'high' : 'medium',
    stats: result.stats,
    evidence:
      `${result.stats.total} NFC-programmed URL(s) recovered from published ` +
      `content${result.stats.nfcMarkersPresent ? ' (NFC markers present)' : ''}.`,
  };
}

export const NFC_TAG_URL_EXTRACTOR = {
  extractNdefUrls,
  extractNfcLaunchUrls,
  extractNfcTagUrls,
  nfcTagFinding,
};
export default NFC_TAG_URL_EXTRACTOR;
