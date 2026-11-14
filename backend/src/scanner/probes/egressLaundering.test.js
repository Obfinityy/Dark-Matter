// Egress-laundering probe (H3(b), V8-F1) — unit + integration tests.
//
// Fixtures model a DVWA-style stored-content page (guestbook): a form
// posts a message, the message is re-rendered on the action page. The
// modes cover the probe's decision surface:
//   verbatim — message rendered as-is (vulnerable)
//   escaped  — message HTML-escaped on render (safe)
//   stripped — tags stripped on render (safe)
//   proxied  — external URLs rewritten to a same-origin proxy (safe)
//
// The browser render is ALWAYS stubbed (opts.renderDom) — unit tests
// must never spawn docker. The stub is a faithful viewer simulation:
// it GETs the page, then GETs every absolute http(s) subresource the
// page references in an automatic-fetch attribute, with a browser
// User-Agent. The OOB collaborator is REAL (in-process, 127.0.0.1),
// same as sqliOob.test.js — it is the confirmation channel, and a
// hit for a fresh token can only arrive via the stubbed render.
//
// The (c) distinction is tested directly: a render stub that returns
// ok:true but fetches no subresource (the scanner's own fetch() calls
// alone) produces NO finding — an agent-issued POST through the gate
// is permitted by design and is NOT a finding.
import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createOobCollaborator } from '../oobCollaborator.js';
import { probeEgressLaundering, findVerbatimFetchable } from './egressLaundering.js';
import { verifyFindings } from '../verifier.js';

const LAB = '127.0.0.1';
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---- Fixture: DVWA-style stored-content page --------------------------------
// Modes: verbatim | escaped | stripped | proxied. The message is stored
// from the POSTed `message` field and rendered on GET /guestbook.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

function proxyUrls(s) {
  return String(s).replace(/https?:\/\/[^\s"'<>]+/gi, (u) => `/proxy?u=${encodeURIComponent(u)}`);
}

function startFixture(mode) {
  const stored = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://fixture.invalid');
    if (req.method === 'POST' && u.pathname === '/guestbook') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        stored.push(params.get('message') || '');
        res.writeHead(302, { Location: '/guestbook' });
        res.end();
      });
      return;
    }
    if (req.method === 'GET' && u.pathname === '/guestbook') {
      const rendered = stored
        .map((m) => {
          if (mode === 'escaped') return `<div class="msg">${escapeHtml(m)}</div>`;
          if (mode === 'stripped') return `<div class="msg">${escapeHtml(stripTags(m))}</div>`;
          if (mode === 'proxied') return `<div class="msg">${proxyUrls(m)}</div>`;
          return `<div class="msg">${m}</div>`; // verbatim
        })
        .join('\n');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Guestbook</h1>${rendered}</body></html>`);
      return;
    }
    if (req.method === 'GET' && u.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Home</h1></body></html>');
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port, stored });
    });
  });
}

// Faithful viewer simulation: GET the page, then GET every absolute
// http(s) subresource it references in an automatic-fetch attribute.
// A real browser does exactly this on render; the scanner's own
// fetch() never loads subresources, so a collaborator hit here can
// only come from this render.
async function fakeBrowserRender(pageUrl) {
  const res = await fetch(pageUrl, { headers: { 'User-Agent': BROWSER_UA } });
  const html = await res.text().catch(() => '');
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href|data|poster|background)\s*=\s*["']([^"']+)["']/gi)) {
    if (/^https?:\/\//i.test(m[1])) urls.add(m[1]);
  }
  for (const u of urls) {
    try {
      await fetch(u, { headers: { 'User-Agent': BROWSER_UA } });
    } catch { /* subresource fetch failure is not a render failure */ }
  }
  return { ok: true, html, error: null, durationMs: 0 };
}

// A render that succeeds but loads nothing — models the scanner's own
// fetch() calls alone (no viewer). Must NOT confirm a finding.
async function noFetchRender(pageUrl) {
  const res = await fetch(pageUrl, { headers: { 'User-Agent': BROWSER_UA } });
  const html = await res.text().catch(() => '');
  return { ok: true, html, error: null, durationMs: 0 };
}

function formsFor(port) {
  return [
    {
      action: `http://127.0.0.1:${port}/guestbook`,
      method: 'post',
      inputs: [
        { name: 'message', type: 'text', value: '' },
        { name: 'Submit', type: 'submit', value: '1' },
      ],
    },
  ];
}

describe('findVerbatimFetchable', () => {
  const CANARY = 'http://127.0.0.1:49999/h3babc123';

  it('matches <img src> (double + single quotes)', () => {
    assert.equal(findVerbatimFetchable(`<img src="${CANARY}">`, CANARY).attr, 'src');
    assert.equal(findVerbatimFetchable(`<img src='${CANARY}'>`, CANARY).attr, 'src');
  });

  it('matches iframe / script src, object data, video poster, link href', () => {
    assert.equal(findVerbatimFetchable(`<iframe src="${CANARY}"></iframe>`, CANARY).attr, 'src');
    assert.equal(findVerbatimFetchable(`<script src="${CANARY}"></script>`, CANARY).attr, 'src');
    assert.equal(findVerbatimFetchable(`<object data="${CANARY}"></object>`, CANARY).attr, 'data');
    assert.equal(findVerbatimFetchable(`<video poster="${CANARY}"></video>`, CANARY).attr, 'poster');
    assert.equal(findVerbatimFetchable(`<link rel="stylesheet" href="${CANARY}">`, CANARY).attr, 'href');
  });

  it('rejects a URL rendered as plain text (not an attribute value)', () => {
    assert.equal(findVerbatimFetchable(`<div>${CANARY}</div>`, CANARY), null);
  });

  it('rejects <a href> — a link fetches only on click, not on render', () => {
    assert.equal(findVerbatimFetchable(`<a href="${CANARY}">click</a>`, CANARY), null);
  });

  it('rejects an HTML-escaped payload', () => {
    const escaped = `&lt;img src=&quot;${CANARY}&quot;&gt;`;
    assert.equal(findVerbatimFetchable(escaped, CANARY), null);
  });

  it('rejects the canary as a prefix of a longer URL', () => {
    assert.equal(findVerbatimFetchable(`<img src="${CANARY}/extra">`, CANARY), null);
  });

  it('returns null for empty inputs', () => {
    assert.equal(findVerbatimFetchable('', CANARY), null);
    assert.equal(findVerbatimFetchable('<img src="x">', ''), null);
  });
});

describe('probeEgressLaundering', () => {
  let collab;
  let base;

  before(async () => {
    collab = createOobCollaborator({ listenHost: '127.0.0.1', callbackHost: '127.0.0.1' });
    base = await collab.start();
  });

  after(async () => {
    await collab.stop();
  });

  function oobOpts(extra = {}) {
    return {
      labTargets: LAB,
      oobCallback: base,
      oobWaitFor: (token, ms) => collab.waitFor(token, ms),
      oobHasHit: (token) => collab.hasHit(token),
      ...extra,
    };
  }

  it('confirms a verbatim <img src> that the viewer browser fetches', async () => {
    const fx = await startFixture('verbatim');
    try {
      const target = `http://127.0.0.1:${fx.port}/`;
      const findings = await probeEgressLaundering(formsFor(fx.port), target, {
        ...oobOpts({ renderDom: fakeBrowserRender }),
      });
      assert.equal(findings.length, 1, JSON.stringify(findings));
      const f = findings[0];
      assert.equal(f.class, 'egress_laundering');
      assert.equal(f.severity, 'high');
      assert.equal(f.evidence.verbatimPreserved, true);
      assert.equal(f.evidence.clientFetchHit, true);
      assert.match(f.evidence.response, /collaborator hit for token h3b[0-9a-f]+/);
      assert.match(f.evidence.response, /Chrome\/120/); // browser UA on the hit
      // The verifier confirms it under the egress_laundering protocol.
      const { confirmed, unconfirmed } = verifyFindings(findings);
      assert.equal(confirmed.length, 1, JSON.stringify(unconfirmed));
      assert.equal(confirmed[0].confirmation, 'confirmed');
    } finally {
      fx.server.close();
    }
  });

  it('returns [] when the payload is HTML-escaped on render', async () => {
    const fx = await startFixture('escaped');
    try {
      const findings = await probeEgressLaundering(formsFor(fx.port), `http://127.0.0.1:${fx.port}/`, {
        ...oobOpts({ renderDom: fakeBrowserRender }),
      });
      assert.deepEqual(findings, []);
    } finally {
      fx.server.close();
    }
  });

  it('returns [] when tags are stripped on render', async () => {
    const fx = await startFixture('stripped');
    try {
      const findings = await probeEgressLaundering(formsFor(fx.port), `http://127.0.0.1:${fx.port}/`, {
        ...oobOpts({ renderDom: fakeBrowserRender }),
      });
      assert.deepEqual(findings, []);
    } finally {
      fx.server.close();
    }
  });

  it('returns [] when the URL is rewritten to a same-origin proxy', async () => {
    const fx = await startFixture('proxied');
    try {
      const findings = await probeEgressLaundering(formsFor(fx.port), `http://127.0.0.1:${fx.port}/`, {
        ...oobOpts({ renderDom: fakeBrowserRender }),
      });
      assert.deepEqual(findings, []);
    } finally {
      fx.server.close();
    }
  });

  it('returns [] for a non-lab target (lab gate) and sends nothing', async () => {
    const fx = await startFixture('verbatim');
    try {
      const findings = await probeEgressLaundering(formsFor(fx.port), `http://127.0.0.1:${fx.port}/`, {
        ...oobOpts({ labTargets: '', renderDom: fakeBrowserRender }),
      });
      assert.deepEqual(findings, []);
      assert.equal(fx.stored.length, 0); // nothing was submitted
    } finally {
      fx.server.close();
    }
  });

  it('returns [] when no collaborator is wired (fail-closed)', async () => {
    const fx = await startFixture('verbatim');
    try {
      const findings = await probeEgressLaundering(formsFor(fx.port), `http://127.0.0.1:${fx.port}/`, {
        labTargets: LAB,
        renderDom: fakeBrowserRender,
      });
      assert.deepEqual(findings, []);
      assert.equal(fx.stored.length, 0); // nothing was submitted
    } finally {
      fx.server.close();
    }
  });

  it('(c) agent POST alone is NOT a finding — no viewer fetch, no hit', async () => {
    const fx = await startFixture('verbatim');
    try {
      const hitsBefore = collab.hits.length;
      const findings = await probeEgressLaundering(formsFor(fx.port), `http://127.0.0.1:${fx.port}/`, {
        ...oobOpts({ renderDom: noFetchRender }),
      });
      assert.deepEqual(findings, []);
      // The scanner's own get()/post() calls never touched the
      // collaborator: only a viewer render fetches the canary URL.
      assert.equal(collab.hits.length, hitsBefore);
    } finally {
      fx.server.close();
    }
  });

  it('returns [] when the browser render fails', async () => {
    const fx = await startFixture('verbatim');
    try {
      const findings = await probeEgressLaundering(formsFor(fx.port), `http://127.0.0.1:${fx.port}/`, {
        ...oobOpts({ renderDom: async () => ({ ok: false, html: '', error: 'no browser', durationMs: 0 }) }),
      });
      assert.deepEqual(findings, []);
    } finally {
      fx.server.close();
    }
  });
});
