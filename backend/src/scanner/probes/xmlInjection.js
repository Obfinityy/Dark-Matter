// Dark Matter rule-based scanner — XML injection probe
// (coverage row #214 [Medium], phase 78).
//
// NARROW DEFINITION (the ledger row is a bare title, so the boundary
// is written down here, in index.js, and in the lane report): this
// phase detects ONE thing — attacker-controlled XML structure. An
// application that builds an XML document from a request parameter
// (a search API returning XML, an RSS/Atom feed, a SOAP-ish
// endpoint, an XML config read) and splices the raw value in lets
// the attacker break out of the element the value was meant to sit
// in: `</name><admin>true</admin><name>` rewrites the document the
// parser sees, and a malformed value (`<unclosed`) makes the
// application's own XML parser fail loudly. That is XML injection
// (CWE-91) — the parameter reaches an XML parser as structure,
// not as data.
//
// VERIFICATION (100% truth rule): a finding counts ONLY on a
// differential against a benign control for the SAME parameter:
//   1. STRUCTURE vector — the breakout payload carries a unique
//      marker element (`<dm-injected>dmxml<hex></dm-injected>`).
//      It fires only when the response is an XML-context response
//      (XML content-type, an `<?xml` prolog, or a non-HTML body
//      starting with `<`) AND the marker element appears verbatim
//      in it AND the benign response does not contain it. A raw
//      echo into an HTML page is NOT a finding — that reflection
//      is XSS territory, not XML structure, and this phase stays
//      silent there.
//   2. ERROR vector — the malformed payload fires only when an
//      XML-parser error signature appears in the malicious
//      response AND is absent from the benign response. The
//      patterns are parser-specific (SAX / libxml / expat /
//      javax.xml parsers / "not well-formed" / "mismatched tag").
//      A bare 500 or a generic error page NEVER fires —
//      error-disclosure owns generic errors.
// A finding is one per distinct (parameter, vector); the first
// firing payload per parameter wins and the probe moves on.
//
// NON-OVERLAP (by design): DOCTYPE / external-entity / SYSTEM
// payloads are owned by 'xxe' (internal-entity + blind OOB) —
// this probe sends none of them, ever. XPath engine errors are
// owned by 'xpathi' — a response whose XML error text mentions
// XPath is not counted here. Billion-laughs / entity-expansion
// bombs are EXCLUDED by policy (DoS-class payloads, never sent).
// Binary / non-text responses are skipped (NUL byte = binary).
//
// SAFETY: read-only GETs only — no writes, no allowWrite gate.
// At most 30 requests per URL (10 params x (1 benign + 2
// payloads)); findings capped at 10 per call. Payloads are
// structure-breaking metacharacters only — no destructive content.
import { randomBytes } from 'node:crypto';
import { mutateUrl, probePointName, probePointParameter, noteAttemptedPoints } from '../probePoints.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const MAX_POINTS = 10;
const MAX_FINDINGS = 10;
const BODY_CAP = 200000;

// XML-parser error signatures. Every entry names a parser error,
// never a bare word like "error": a generic 500 page carries none
// of these. The javax.xml entry lists the parser packages only —
// javax.xml.xpath is deliberately NOT here (xpathi owns XPath
// errors), and detectXmlParserError also vetoes any match whose
// surrounding text mentions XPath.
const XML_ERROR_PATTERNS = [
  { label: 'XML parsing error', re: /XML parsing error/i },
  { label: 'XMLSyntaxError', re: /XMLSyntaxError/ },
  { label: 'SAXParseException', re: /SAXParseException/ },
  { label: 'org.xml.sax parser error', re: /org\.xml\.sax/ },
  { label: 'javax.xml parser error', re: /javax\.xml\.(?:parsers|transform|sax|stream|validation|bind)/ },
  { label: 'libxml error', re: /libxml/i },
  { label: 'Python expat error', re: /xml\.parsers\.expat|ExpatError/ },
  { label: 'Python ElementTree error', re: /xml\.etree\.ElementTree|ElementTree\.ParseError/ },
  { label: 'not well-formed XML', re: /not well-formed/i },
  { label: 'mismatched tag', re: /mismatched tag|Opening and ending tag mismatch/i },
  { label: 'malformed XML', re: /malformed XML/i },
  { label: 'invalid XML', re: /invalid XML/i },
  { label: 'empty XML document', re: /Document is empty/i },
  { label: 'extra content after XML document', re: /Extra content at the end of the document/i },
  { label: 'XML start tag expected', re: /Start tag expected/i },
  { label: 'premature end of XML data', re: /Premature end of data/i },
];

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    const text = await res.text().catch(() => '');
    let contentType = '';
    try {
      contentType = res.headers ? String(res.headers.get('content-type') || '') : '';
    } catch {
      contentType = '';
    }
    return { status: res.status, text: text.slice(0, BODY_CAP), contentType };
  } finally {
    clearTimeout(t);
  }
}

function marker() {
  return `dmxml${randomBytes(3).toString('hex')}`;
}

// A response is binary when it carries a NUL byte — XML and HTML
// never do. Binary bodies are never scanned for parser errors.
export function isTextBody(text) {
  return typeof text === 'string' && !text.includes('\u0000');
}

// Is this response an XML document (not an HTML page that happens
// to echo our input)? Content-type wins; otherwise the body must
// start with an XML prolog, or start with `<` without being HTML
// (no <html / <!DOCTYPE html). An HTML echo of the marker is XSS
// territory — this phase stays silent there.
export function isXmlContext(text, contentType = '') {
  if (typeof text !== 'string') return false;
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('xml')) return true;
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<?xml')) return true;
  if (!trimmed.startsWith('<')) return false;
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return false;
  return true;
}

// Pure XML-parser-error detector — exported for unit tests.
// Returns the matched label, or null. A match whose surrounding
// window mentions XPath is vetoed (xpathi owns that surface).
export function detectXmlParserError(text) {
  if (typeof text !== 'string' || !text) return null;
  for (const p of XML_ERROR_PATTERNS) {
    const fresh = new RegExp(p.re.source, p.re.flags);
    const m = fresh.exec(text);
    if (!m) continue;
    const window = text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80);
    if (/xpath/i.test(window)) continue;
    return p.label;
  }
  return null;
}

function snippetAround(body, matchIndex, matchLen) {
  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(body.length, matchIndex + matchLen + 80);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

/**
 * Probe XML injection (#214). @param {string} url — the GET probe
 * target. @param {object[]|string[]} params — probe points
 * (query + path-segment, path first) from extractProbePoints.
 * @param {object} opts — { timeoutMs, headers }.
 * @returns {object[]} findings (class 'xml_injection', medium) —
 * at most one per (parameter, vector), capped at MAX_FINDINGS.
 */
export async function probeXmlInjection(url, params, opts = {}) {
  const findings = [];
  const points = Array.isArray(params) ? params.slice(0, MAX_POINTS) : [];
  noteAttemptedPoints(opts, points);
  for (const point of points) {
    if (findings.length >= MAX_FINDINGS) break;
    const label = probePointParameter(point);
    const benignValue = marker();
    let benign;
    try {
      benign = await get(mutateUrl(url, point, benignValue), opts);
    } catch {
      continue;
    }
    if (!benign || !isTextBody(benign.text)) continue;

    // VECTOR 1 — structure breakout: close the element the value
    // sits in and open a unique marker element. Fires only in an
    // XML-context response carrying the marker element verbatim.
    const structMarker = marker();
    const breakout = `</dm-x><dm-injected>${structMarker}</dm-injected><dm-x>`;
    let malicious;
    try {
      malicious = await get(mutateUrl(url, point, breakout), opts);
    } catch {
      continue;
    }
    if (malicious && isTextBody(malicious.text)) {
      const element = `<dm-injected>${structMarker}</dm-injected>`;
      if (
        malicious.text.includes(element) &&
        !benign.text.includes(element) &&
        isXmlContext(malicious.text, malicious.contentType)
      ) {
        const idx = malicious.text.indexOf(element);
        findings.push({
          class: 'xml_injection',
          id: `xml-injection-struct-${probePointName(point)}`,
          title: `XML injection in parameter '${label}' — injected element breaks out of the XML structure`,
          severity: 'medium',
          url,
          param: label,
          parameter: label,
          evidence: {
            request: `GET ${mutateUrl(url, point, breakout)} vs benign GET ${mutateUrl(url, point, benignValue)}`,
            response: `Injected marker element reflected verbatim inside an XML response — "...${snippetAround(malicious.text, idx, element.length)}..." — absent on benign input`,
            impact_demo:
              'Input reached the XML document as structure, not data — the attacker controls element boundaries and can inject arbitrary elements/attributes into the parsed document; chain with a downstream XML consumer that trusts the document shape.',
            signalCorrelated: true,
          },
        });
        continue;
      }
    }

    // VECTOR 2 — malformed XML: an unclosed start tag. Fires only
    // when an XML-parser error signature appears on the malicious
    // response and is absent from the benign response.
    const malformed = '<dm-xml-broken';
    let malformedRes;
    try {
      malformedRes = await get(mutateUrl(url, point, malformed), opts);
    } catch {
      continue;
    }
    if (!malformedRes || !isTextBody(malformedRes.text)) continue;
    const signal = detectXmlParserError(malformedRes.text);
    if (signal && !detectXmlParserError(benign.text)) {
      const m = malformedRes.text.match(
        new RegExp(XML_ERROR_PATTERNS.find((p) => p.label === signal).re.source, 'i')
      );
      const idx = m ? malformedRes.text.indexOf(m[0]) : 0;
      const len = m ? m[0].length : 0;
      findings.push({
        class: 'xml_injection',
        id: `xml-injection-error-${probePointName(point)}`,
        title: `XML injection in parameter '${label}' — malformed XML triggers a parser error (${signal})`,
        severity: 'medium',
        url,
        param: label,
        parameter: label,
        evidence: {
          request: `GET ${mutateUrl(url, point, malformed)} vs benign GET ${mutateUrl(url, point, benignValue)}`,
          response: `XML parser error (${signal}) on malformed input — "...${snippetAround(malformedRes.text, idx, len)}..." — absent on benign input`,
          impact_demo:
            'Input reached an XML parser — malformed markup breaks parsing, proving the parameter flows into XML processing; a parser error here is the foothold for structure injection against the same sink.',
          signalCorrelated: true,
        },
      });
    }
  }
  return findings;
}

export const __xmlInjectionMeta = { phases: ['xml-injection'], depth: ['quick', 'standard', 'deep'] };
