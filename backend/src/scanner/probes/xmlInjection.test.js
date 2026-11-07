// XML injection (#214) — structure breakout + parser-error vectors.
// A local stub HTTP server plays the XML-backed endpoint in several
// modes (echo / HTML echo / parser error / always-error / generic
// 500 / XPath error / binary / no-reflect), so every oracle is
// deterministic and no real network is touched. Fixtures are plain
// strings built in-code; no secret-shaped literals anywhere (no
// GH013 risk).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeXmlInjection,
  detectXmlParserError,
  isXmlContext,
  isTextBody,
} from './xmlInjection.js';
import { verifyFindings } from '../verifier.js';

let server;
let base;
let mode = 'xml-echo';

function xmlDoc(value) {
  return `<?xml version="1.0"?><search><term>${value}</term></search>`;
}

function valueOf(reqUrl) {
  const u = new URL(reqUrl, 'http://127.0.0.1');
  const m = u.pathname.match(/^\/items\/(.*)$/);
  if (m) return decodeURIComponent(m[1]);
  // Echo every query value, so multi-param probes see the mutated
  // parameter whichever one it is (not just 'q').
  return [...u.searchParams.values()].join('|');
}

before(async () => {
  server = http.createServer((req, res) => {
    const value = valueOf(req.url);
    switch (mode) {
      case 'xml-echo':
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(xmlDoc(value));
        break;
      case 'xml-echo-html':
        // Same raw echo, but served as an HTML page — the marker
        // reflects, yet there is no XML document to break out of.
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(`<html><body><p>results for ${value}</p></body></html>`);
        break;
      case 'xml-parser-error':
        if (value.includes('<')) {
          res.writeHead(500, { 'content-type': 'text/html' });
          res.end('<html><body>XML parsing error: not well-formed (invalid token) at line 1, column 12</body></html>');
        } else {
          res.writeHead(200, { 'content-type': 'application/xml' });
          res.end(xmlDoc(value));
        }
        break;
      case 'xml-parser-error-always':
        // The error text is on the benign page too — the
        // differential must veto the finding.
        res.writeHead(500, { 'content-type': 'text/html' });
        res.end('<html><body>XML parsing error: not well-formed (invalid token) at line 1</body></html>');
        break;
      case 'generic-500':
        if (value.includes('<')) {
          res.writeHead(500, { 'content-type': 'text/html' });
          res.end('<html><body>Internal Server Error — something went wrong</body></html>');
        } else {
          res.writeHead(200, { 'content-type': 'application/xml' });
          res.end(xmlDoc(value));
        }
        break;
      case 'xml-xpath-error':
        if (value.includes('<')) {
          res.writeHead(500, { 'content-type': 'text/html' });
          res.end('<html><body>javax.xml.xpath.XPathExpressionException: Invalid XPath expression</body></html>');
        } else {
          res.writeHead(200, { 'content-type': 'application/xml' });
          res.end(xmlDoc(value));
        }
        break;
      case 'binary':
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]));
        break;
      case 'xml-no-reflect':
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end('<?xml version="1.0"?><search><term>fixed</term></search>');
        break;
      default:
        res.writeHead(200, { 'content-type': 'application/xml' });
        res.end(xmlDoc(value));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/search?q=apple`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('detectXmlParserError', () => {
  it("detects 'XML parsing error'", () => {
    assert.equal(detectXmlParserError('XML parsing error at line 1'), 'XML parsing error');
  });

  it('detects SAXParseException', () => {
    assert.equal(
      detectXmlParserError('org.xml.sax.SAXParseException: element type must be declared'),
      'SAXParseException'
    );
  });

  it("detects 'not well-formed'", () => {
    assert.equal(
      detectXmlParserError('XML parsing error: not well-formed (invalid token)'),
      'XML parsing error'
    );
  });

  it('detects a libxml mismatched tag', () => {
    assert.equal(
      detectXmlParserError("Opening and ending tag mismatch: term line 1 and search"),
      'mismatched tag'
    );
  });

  it('detects a Python expat error', () => {
    assert.equal(
      detectXmlParserError('xml.parsers.expat.ExpatError: mismatched tag'),
      'Python expat error'
    );
  });

  it('detects javax.xml.parsers but not javax.xml.xpath', () => {
    assert.equal(
      detectXmlParserError('javax.xml.parsers.DocumentBuilderFactory error'),
      'javax.xml parser error'
    );
  });

  it('returns null for a generic 500 page', () => {
    assert.equal(detectXmlParserError('<html>Internal Server Error</html>'), null);
  });

  it('returns null for a bare "error" word', () => {
    assert.equal(detectXmlParserError('an error occurred, please retry'), null);
  });

  it('vetoes XPath engine errors (xpathi owns them)', () => {
    assert.equal(
      detectXmlParserError('javax.xml.xpath.XPathExpressionException: Invalid XPath'),
      null
    );
  });

  it('returns null for empty input', () => {
    assert.equal(detectXmlParserError(''), null);
  });
});

describe('isXmlContext', () => {
  it('XML content-type wins', () => {
    assert.equal(isXmlContext('<html>echo</html>', 'application/xml'), true);
  });

  it('an <?xml prolog counts', () => {
    assert.equal(isXmlContext('<?xml version="1.0"?><root/>', 'text/html'), true);
  });

  it('a bare <root> body counts', () => {
    assert.equal(isXmlContext('<root><a>1</a></root>', 'text/plain'), true);
  });

  it('an HTML page does not count', () => {
    assert.equal(isXmlContext('<html><body>echo</body></html>', 'text/html'), false);
  });

  it('a DOCTYPE html page does not count', () => {
    assert.equal(isXmlContext('<!DOCTYPE html><html></html>', 'text/html'), false);
  });

  it('plain text does not count', () => {
    assert.equal(isXmlContext('no results found', 'text/plain'), false);
  });
});

describe('isTextBody', () => {
  it('a normal string is text', () => {
    assert.equal(isTextBody('<root/>'), true);
  });

  it('a NUL byte means binary', () => {
    assert.equal(isTextBody('ab\u0000cd'), false);
  });

  it('a non-string is not text', () => {
    assert.equal(isTextBody(null), false);
  });
});

describe('probeXmlInjection', () => {
  it('structure breakout fires on an XML echo endpoint', async () => {
    mode = 'xml-echo';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'xml_injection');
    assert.equal(f.severity, 'medium');
    assert.match(f.title, /XML injection in parameter 'q'/);
    assert.match(f.title, /breaks out of the XML structure/);
    assert.equal(f.url, base);
    assert.equal(f.parameter, 'q');
    assert.equal(f.evidence.signalCorrelated, true);
    assert.ok(f.evidence.response.includes('dm-injected'), 'evidence must cite the marker element');
  });

  it('verifyFindings confirms the structure finding', async () => {
    mode = 'xml-echo';
    const findings = await probeXmlInjection(base, ['q']);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });

  it('only one finding per parameter when both vectors could fire', async () => {
    mode = 'xml-echo';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 1, 'structure win skips the error vector for the same param');
  });

  it('an HTML echo of the marker does NOT fire (XSS territory, not XML)', async () => {
    mode = 'xml-echo-html';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 0);
  });

  it('malformed XML fires the error vector on a parser-error endpoint', async () => {
    mode = 'xml-parser-error';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'xml_injection');
    assert.equal(f.severity, 'medium');
    assert.match(f.title, /XML injection in parameter 'q'/);
    assert.match(f.title, /parser error/);
    assert.equal(f.parameter, 'q');
    assert.equal(f.evidence.signalCorrelated, true);
    assert.ok(f.evidence.response.includes('not well-formed'), 'evidence must cite the parser error');
  });

  it('verifyFindings confirms the error-vector finding', async () => {
    mode = 'xml-parser-error';
    const findings = await probeXmlInjection(base, ['q']);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });

  it('a generic 500 on malformed input does NOT fire', async () => {
    mode = 'generic-500';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 0);
  });

  it('an error page already on the benign response does NOT fire (differential veto)', async () => {
    mode = 'xml-parser-error-always';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 0);
  });

  it('an XPath engine error does NOT fire (xpathi owns it)', async () => {
    mode = 'xml-xpath-error';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 0);
  });

  it('a binary response does NOT fire', async () => {
    mode = 'binary';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 0);
  });

  it('a non-reflecting endpoint does NOT fire', async () => {
    mode = 'xml-no-reflect';
    const findings = await probeXmlInjection(base, ['q']);
    assert.equal(findings.length, 0);
  });

  it('a path-segment point fires the structure breakout', async () => {
    mode = 'xml-echo';
    const itemUrl = base.replace('/search?q=apple', '/items/apple');
    const findings = await probeXmlInjection(itemUrl, [{ kind: 'path', name: 'item', segment: 2 }]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'item (path)');
    assert.match(findings[0].title, /item \(path\)/);
  });

  it('no params returns []', async () => {
    mode = 'xml-echo';
    const findings = await probeXmlInjection(base, []);
    assert.deepEqual(findings, []);
  });

  it('an unreachable target returns []', async () => {
    const findings = await probeXmlInjection('http://127.0.0.1:1/search?q=x', ['q'], { timeoutMs: 500 });
    assert.deepEqual(findings, []);
  });

  it('findings are capped at 10 across many firing params', async () => {
    mode = 'xml-echo';
    const many = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const url = `http://127.0.0.1:${server.address().port}/search?` + many.map((p) => `${p}=v`).join('&');
    const findings = await probeXmlInjection(url, many);
    assert.ok(findings.length <= 10, `got ${findings.length}, cap is 10`);
    assert.equal(findings.length, 10, 'first 10 points fire; the per-call point cap binds first');
  });

  it('two firing params yield two findings, one per parameter', async () => {
    mode = 'xml-echo';
    const url = `http://127.0.0.1:${server.address().port}/search?q=apple&r=pear`;
    const findings = await probeXmlInjection(url, ['q', 'r']);
    assert.equal(findings.length, 2);
    assert.deepEqual(
      findings.map((f) => f.parameter).sort(),
      ['q', 'r']
    );
  });
});
