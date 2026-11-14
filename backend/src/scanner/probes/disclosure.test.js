// Tests for the disclosure legs (coverage rows #409/#410, files phase):
// #409 — robots.txt / sitemap.xml listing sensitive paths (read-only GETs).
// #410 — secrets / internals inside HTML comments (fp.body inspection).
// Test-first: written before backend/src/scanner/probes/disclosure.js.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeDisclosure,
  extractRobotsPaths,
  extractSitemapLocs,
  extractHtmlComments,
  matchCommentSecrets,
  isSensitivePath,
} from './disclosure.js';

const INDEX_HTML =
  '<!doctype html><html><head><title>Home</title></head><body><h1>Hi</h1>' +
  '<p>password: hunter2</p>' + // visible text — NOT a comment, must never fire (#410 reads comments only)
  '<!-- db password: hunter2 -->' +
  '<!-- deploy key AKIAIOSFODNN7EXAMPLE -->' +
  '<!-- TODO: fix the password field below -->' +
  '<!--#include virtual="/header.html" -->' +
  '<!--[if IE 9]><p>old browser</p><![endif]-->' +
  '<!-- api_key = "test" -->' +
  '<!-- internal db: db01.corp.example.com -->' +
  '<!-- -----BEGIN RSA PRIVATE KEY-----\nNOT-A-REAL-KEY-0123456789abcdef -->' +
  '<!-- mongodb://admin:s3cret@10.0.0.5:27017/app -->' +
  '</body></html>';

const ROBOTS_REAL =
  'User-agent: *\n' +
  'Disallow: /admin/\n' +
  'Disallow: /backup/db.sql\n' +
  'Disallow: /public/\n' +
  'Allow: /public/help\n' +
  'Sitemap: /sitemap.xml\n';

const SITEMAP_REAL =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  '<url><loc>http://127.0.0.1/BACKUP/old.zip</loc></url>\n' +
  '<url><loc>http://127.0.0.1/about</loc></url>\n' +
  '<url><loc>http://127.0.0.1/wp-admin/</loc></url>\n' +
  '</urlset>\n';

const ROBOTS_CLEAN = 'User-agent: *\nDisallow: /\nDisallow: /public/\n';
const SITEMAP_CLEAN =
  '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  '<url><loc>http://127.0.0.1/about</loc></url>' +
  '<url><loc>http://127.0.0.1/contact</loc></url></urlset>';

describe('disclosure probe (disclosure.js) — rows #409/#410', () => {
  let server;
  let port;
  let mode = 'real';
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const p = u.pathname;

      if (mode === 'spa-catchall') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(INDEX_HTML);
        return;
      }
      if (mode === 'redirect') {
        if (p === '/robots.txt' || p === '/sitemap.xml') {
          res.writeHead(302, { Location: `${base()}/` });
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(INDEX_HTML);
        return;
      }
      if (p === '/robots.txt') {
        if (mode === 'clean') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(ROBOTS_CLEAN);
          return;
        }
        if (mode === 'missing') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(ROBOTS_REAL);
        return;
      }
      if (p === '/sitemap.xml') {
        if (mode === 'clean') {
          res.writeHead(200, { 'Content-Type': 'application/xml' });
          res.end(SITEMAP_CLEAN);
          return;
        }
        if (mode === 'missing') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('not found');
          return;
        }
        if (mode === 'sitemapindex') {
          res.writeHead(200, { 'Content-Type': 'application/xml' });
          res.end(
            '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
              '<sitemap><loc>http://127.0.0.1/sitemap-posts.xml</loc></sitemap></sitemapindex>'
          );
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(SITEMAP_REAL);
        return;
      }
      if (p === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(INDEX_HTML);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  // ---- pure helpers ----
  it('isSensitivePath: admin/backup/git/env/config/internal match, public pages do not', () => {
    assert.equal(isSensitivePath('/admin/'), true);
    assert.equal(isSensitivePath('/wp-admin/'), true);
    assert.equal(isSensitivePath('/backup/db.sql'), true);
    assert.equal(isSensitivePath('/BACKUP/old.zip'), true);
    assert.equal(isSensitivePath('/.git/config'), true);
    assert.equal(isSensitivePath('/.env'), true);
    assert.equal(isSensitivePath('/private/files'), true);
    assert.equal(isSensitivePath('/internal/docs'), true);
    assert.equal(isSensitivePath('/phpmyadmin/'), true);
    assert.equal(isSensitivePath('/'), false);
    assert.equal(isSensitivePath('/public/'), false);
    assert.equal(isSensitivePath('/about'), false);
    assert.equal(isSensitivePath('/contact'), false);
    assert.equal(isSensitivePath('/login'), false);
  });

  it('extractRobotsPaths: Disallow/Allow/Sitemap lines only, wildcards stripped', () => {
    const paths = extractRobotsPaths(
      'User-agent: *\nDisallow: /admin*\nAllow: /public/\nSitemap: https://example.com/sitemap.xml\n# comment\nDisallow: /\n'
    );
    assert.deepEqual(paths, ['/admin', '/public/', '/sitemap.xml', '/']);
  });

  it('extractSitemapLocs: loc pathnames only', () => {
    const locs = extractSitemapLocs(SITEMAP_REAL);
    assert.deepEqual(locs, ['/BACKUP/old.zip', '/about', '/wp-admin/']);
  });

  it('extractHtmlComments: real comments only — SSI and conditional comments skipped', () => {
    const comments = extractHtmlComments(INDEX_HTML);
    const texts = comments.map((c) => c.text);
    assert.ok(texts.some((t) => t.includes('db password: hunter2')));
    assert.ok(texts.some((t) => t.includes('AKIAIOSFODNN7EXAMPLE')));
    assert.ok(!texts.some((t) => t.includes('#include')));
    assert.ok(!texts.some((t) => t.includes('[if IE')));
    assert.equal(extractHtmlComments('<p>no comments here</p>').length, 0);
    assert.equal(extractHtmlComments('').length, 0);
  });

  it('matchCommentSecrets: password assignment fires, TODO without a value does not', () => {
    const hits = matchCommentSecrets('db password: hunter2');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'credential-assignment');
    assert.equal(hits[0].param, 'password');
    assert.equal(matchCommentSecrets('TODO: fix the password field below').length, 0);
  });

  it('matchCommentSecrets: placeholders and test values never fire', () => {
    assert.equal(matchCommentSecrets('password: ***').length, 0);
    assert.equal(matchCommentSecrets('password: changeme').length, 0);
    assert.equal(matchCommentSecrets('api_key = "test"').length, 0);
    assert.equal(matchCommentSecrets('secret: null').length, 0);
  });

  it('matchCommentSecrets: private key, AWS key, connection string, internal host', () => {
    assert.equal(matchCommentSecrets('-----BEGIN RSA PRIVATE KEY-----')[0].kind, 'private-key');
    assert.equal(matchCommentSecrets('key AKIAIOSFODNN7EXAMPLE here')[0].kind, 'aws-key');
    assert.equal(
      matchCommentSecrets('mongodb://admin:s3cret@10.0.0.5:27017/app')[0].kind,
      'connection-string'
    );
    assert.equal(matchCommentSecrets('db host db01.corp.example.com')[0].kind, 'internal-host');
    assert.equal(matchCommentSecrets('see 127.0.0.1 for local dev').length, 0);
    assert.equal(matchCommentSecrets('visit localhost:3000').length, 0);
  });

  // ---- #409: robots.txt / sitemap.xml ----
  it('#409 robots.txt lists sensitive paths — /admin/ and /backup/db.sql fire, /public/ does not', async () => {
    mode = 'real';
    const findings = await probeDisclosure(base(), { html: '', timeoutMs: 8000 });
    const robots = findings.filter((f) => f.class === 'robots_sitemap_disclosure' && f.url.endsWith('/robots.txt'));
    const urls = robots.map((f) => f.url);
    assert.ok(urls.some((u) => u.endsWith('/robots.txt') && robots.find((f) => f.url === u && f.evidence.response.includes('/admin/'))));
    assert.ok(robots.some((f) => f.evidence.response.includes('/backup/db.sql')));
    assert.ok(!robots.some((f) => f.evidence.response.includes('/public/')));
    assert.ok(robots.every((f) => f.severity === 'low'));
    assert.ok(robots.every((f) => f.evidence.signalCorrelated === true));
  });

  it('#409 sitemap.xml lists sensitive paths — /backup/old.zip and /wp-admin/ fire, /about does not', async () => {
    mode = 'real';
    const findings = await probeDisclosure(base(), { html: '', timeoutMs: 8000 });
    const sm = findings.filter(
      (f) => f.class === 'robots_sitemap_disclosure' && f.url.endsWith('/sitemap.xml')
    );
    assert.ok(sm.some((f) => f.evidence.response.includes('/BACKUP/old.zip')));
    assert.ok(sm.some((f) => f.evidence.response.includes('/wp-admin/')));
    assert.ok(!sm.some((f) => f.evidence.response.includes('/about')));
  });

  it('#409 clean robots/sitemap (no sensitive paths) yields no disclosure findings', async () => {
    mode = 'clean';
    const findings = await probeDisclosure(base(), { html: '', timeoutMs: 8000 });
    assert.equal(
      findings.filter((f) => f.class === 'robots_sitemap_disclosure').length,
      0,
      JSON.stringify(findings.map((f) => f.title))
    );
  });

  it('#409 SPA catch-all (every path serves the index page) yields no disclosure findings', async () => {
    mode = 'spa-catchall';
    const findings = await probeDisclosure(base(), { html: '', timeoutMs: 8000 });
    assert.equal(
      findings.filter((f) => f.class === 'robots_sitemap_disclosure').length,
      0,
      JSON.stringify(findings.map((f) => f.title))
    );
  });

  it('#409 redirect to the homepage is NOT a disclosure (no redirect following)', async () => {
    mode = 'redirect';
    const findings = await probeDisclosure(base(), { html: '', timeoutMs: 8000 });
    assert.equal(findings.filter((f) => f.class === 'robots_sitemap_disclosure').length, 0);
  });

  it('#409 missing robots.txt/sitemap.xml (404) yields no disclosure findings', async () => {
    mode = 'missing';
    const findings = await probeDisclosure(base(), { html: '', timeoutMs: 8000 });
    assert.equal(findings.filter((f) => f.class === 'robots_sitemap_disclosure').length, 0);
  });

  it('#409 sitemap index (no sensitive locs, sub-sitemaps not chased) yields no findings', async () => {
    mode = 'sitemapindex';
    const findings = await probeDisclosure(base(), { html: '', timeoutMs: 8000 });
    assert.equal(
      findings.filter((f) => f.class === 'robots_sitemap_disclosure' && f.url.endsWith('/sitemap.xml')).length,
      0
    );
  });

  // ---- #410: HTML comments ----
  it('#410 comment secrets fire — password, AWS key, private key, internal host, connection string', async () => {
    mode = 'missing'; // #409 half quiet so only comment findings show
    const findings = await probeDisclosure(base(), { html: INDEX_HTML, timeoutMs: 8000 });
    const comments = findings.filter((f) => f.class === 'html_comment_secret');
    const titles = comments.map((f) => f.title);
    assert.ok(titles.some((t) => t.includes('password assignment')), JSON.stringify(titles));
    assert.ok(titles.some((t) => t.includes('AWS access key')), JSON.stringify(titles));
    assert.ok(titles.some((t) => t.includes('Private key')), JSON.stringify(titles));
    assert.ok(titles.some((t) => t.includes('Internal hostname')), JSON.stringify(titles));
    assert.ok(titles.some((t) => t.includes('connection string')), JSON.stringify(titles));
    assert.ok(comments.every((f) => f.severity === 'low'));
    assert.ok(comments.every((f) => f.evidence.signalCorrelated === true));
    // The credential value is masked in evidence, never published in full.
    assert.ok(!comments.some((f) => f.evidence.response.includes('hunter2')));
  });

  it('#410 TODO, SSI, conditional comments, test values and visible text never fire', async () => {
    mode = 'missing';
    const html =
      '<html><body><p>password: hunter2</p>' +
      '<!-- TODO: fix the password field below -->' +
      '<!--#include virtual="/header.html" -->' +
      '<!--[if IE 9]><p>old</p><![endif]-->' +
      '<!-- api_key = "test" -->' +
      '<!-- password: *** -->' +
      '</body></html>';
    const findings = await probeDisclosure(base(), { html, timeoutMs: 8000 });
    assert.equal(
      findings.filter((f) => f.class === 'html_comment_secret').length,
      0,
      JSON.stringify(findings.map((f) => f.title))
    );
  });

  it('#410 one finding per comment even when a comment matches several patterns', async () => {
    mode = 'missing';
    const html = '<html><body><!-- mongodb://admin:s3cret@10.0.0.5:27017/app password: hunter2 --></body></html>';
    const findings = await probeDisclosure(base(), { html, timeoutMs: 8000 });
    const comments = findings.filter((f) => f.class === 'html_comment_secret');
    assert.equal(comments.length, 1, JSON.stringify(comments.map((f) => f.title)));
    assert.ok(comments[0].title.includes('connection string'));
    assert.ok(comments[0].evidence.response.includes('credential-assignment'));
  });

  it('#410 comment findings are capped at 5', async () => {
    mode = 'missing';
    const many = Array.from({ length: 8 }, (_, i) => `<!-- service${i} password: hunter${i}x -->`).join('\n');
    const findings = await probeDisclosure(base(), { html: `<html><body>${many}</body></html>`, timeoutMs: 8000 });
    assert.equal(findings.filter((f) => f.class === 'html_comment_secret').length, 5);
  });

  it('#410 falls back to fetching the page itself when no html is passed', async () => {
    mode = 'missing'; // robots/sitemap 404; / serves INDEX_HTML with secret comments
    const findings = await probeDisclosure(base(), { timeoutMs: 8000 });
    assert.ok(
      findings.filter((f) => f.class === 'html_comment_secret').length >= 1,
      JSON.stringify(findings.map((f) => f.title))
    );
  });

  it('probeDisclosure returns [] for an unreachable base instead of throwing', async () => {
    const findings = await probeDisclosure('http://127.0.0.1:1/', { html: '', timeoutMs: 2000 });
    assert.deepEqual(findings, []);
  });
});
