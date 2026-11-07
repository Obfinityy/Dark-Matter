// Tests for the source-code disclosure probe
// (coverage row #184 [High], phase 73).
// No network, no lab needed — fetches go through the opts.fetchPage seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeSourceCodeDisclosure,
  buildSourceCodeTargets,
  detectSourceLanguage,
} from './sourceCodeDisclosure.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://lab.local/login.php';
const BASELINE = '<html><body><h1>Login</h1><form></form></body></html>';
const CATCHALL = 'http://lab.local/dm-nonexistent-9f27a1c4.html';
const BAK = 'http://lab.local/login.php.bak';
const OLD = 'http://lab.local/login.php.old';
const GITCONFIG = 'http://lab.local/.git/config';
const JS_PAGE = 'http://lab.local/app.js';
const MAP = 'http://lab.local/app.js.map';

const PHP_SOURCE = `<?php
require_once 'config.php';
function authenticate($user, $pass) {
  $db = new Database();
  echo 'checking';
  return $db->query($user);
}
?>`;

// fetchPage seam: map URL -> { status, headers, body }. Unknown URLs 404.
// Records every call so the fetch budget can be asserted.
function fetchPageFor(bodies, calls) {
  return async (url) => {
    if (Array.isArray(calls)) calls.push(String(url));
    const entry = bodies[String(url)];
    if (entry === undefined) return { status: 404, body: 'Not Found' };
    if (entry instanceof Error) throw entry;
    return entry;
  };
}

describe('detectSourceLanguage', () => {
  it('a <?php tag proves PHP on its own', () => {
    assert.equal(detectSourceLanguage('<?php echo "hello world"; ?>', 'php'), 'php');
  });

  it('two PHP idioms without <?php still prove PHP', () => {
    assert.equal(detectSourceLanguage('function auth($user) {\n  $db = connect();\n}', 'php'), 'php');
  });

  it('one PHP idiom alone is not enough', () => {
    assert.equal(detectSourceLanguage('function auth(user) {\n  return true;\n}', 'php'), null);
  });

  it('Python def + import prove Python', () => {
    assert.equal(
      detectSourceLanguage('import os\ndef main():\n  return 0\n', 'py'),
      'python'
    );
  });

  it('one Python idiom alone is not enough', () => {
    assert.equal(detectSourceLanguage('def main():\n  return 0\n', 'py'), null);
  });

  it('Java package + java import prove Java', () => {
    assert.equal(
      detectSourceLanguage('package com.example;\nimport java.util.List;\npublic class Foo {}\n', 'java'),
      'java'
    );
  });

  it('a JSP page directive proves JSP', () => {
    assert.equal(detectSourceLanguage('<%@ page language="java" %>\n<html></html>', 'jsp'), 'jsp');
  });

  it('a rendered HTML page is never source', () => {
    assert.equal(detectSourceLanguage(BASELINE, 'php'), null);
    assert.equal(
      detectSourceLanguage('<!DOCTYPE html><html><body><pre>function f() {}</pre></body></html>', 'php'),
      null
    );
  });

  it('docs prose mentioning code is not source', () => {
    assert.equal(
      detectSourceLanguage('To authenticate, call the function with a user. See the guide.', 'php'),
      null
    );
  });

  it('JavaScript claimed as PHP is not PHP (one idiom only)', () => {
    assert.equal(
      detectSourceLanguage('function greet(name) {\n  return "hi " + name;\n}', 'php'),
      null
    );
  });

  it('Ruby require + def prove Ruby', () => {
    assert.equal(detectSourceLanguage("require 'json'\ndef load(path)\nend\n", 'rb'), 'ruby');
  });

  it('Go package + func prove Go', () => {
    assert.equal(detectSourceLanguage('package main\nfunc main() {}\n', 'go'), 'go');
  });

  it('a shell shebang proves shell', () => {
    assert.equal(detectSourceLanguage('#!/bin/bash\necho hello\n', 'sh'), 'shell');
  });

  it('Perl use strict + my variable prove Perl', () => {
    assert.equal(detectSourceLanguage('use strict;\nmy $name = shift;\n', 'pl'), 'perl');
  });

  it('C# using System + namespace prove C#', () => {
    assert.equal(detectSourceLanguage('using System;\nnamespace App {\npublic class Foo {}\n}\n', 'cs'), 'csharp');
  });

  it('empty, short and unknown-extension bodies are not source', () => {
    assert.equal(detectSourceLanguage('', 'php'), null);
    assert.equal(detectSourceLanguage('<?php', 'php'), null);
    assert.equal(detectSourceLanguage('CREATE TABLE t (id INT);', 'sql'), null);
  });
});

describe('buildSourceCodeTargets', () => {
  it('a PHP page yields raw + backup + gitconfig candidates, no map', () => {
    const t = buildSourceCodeTargets(PAGE, [PAGE]);
    assert.deepEqual(
      t.map((c) => `${c.kind}:${c.url}`),
      [
        `raw:${PAGE}`,
        `backup:${BAK}`,
        `backup:${OLD}`,
        `gitconfig:${GITCONFIG}`,
      ]
    );
  });

  it('a JS target yields a map candidate and no raw/backup for it', () => {
    const t = buildSourceCodeTargets(JS_PAGE, []);
    assert.deepEqual(
      t.map((c) => `${c.kind}:${c.url}`),
      [`gitconfig:${GITCONFIG}`, `map:${MAP}`]
    );
  });

  it('a bare root page yields only the gitconfig candidate', () => {
    const t = buildSourceCodeTargets('http://lab.local/', []);
    assert.deepEqual(
      t.map((c) => `${c.kind}:${c.url}`),
      [`gitconfig:${GITCONFIG}`]
    );
  });

  it('base paths cap at 5', () => {
    const urls = Array.from({ length: 7 }, (_, i) => `http://lab.local/p${i}.php`);
    const t = buildSourceCodeTargets(PAGE, urls);
    const raws = t.filter((c) => c.kind === 'raw');
    assert.equal(raws.length, 5);
    assert.equal(t.filter((c) => c.kind === 'backup').length, 5);
  });

  it('duplicate and cross-origin paths are dropped, malformed URLs skipped', () => {
    const t = buildSourceCodeTargets(PAGE, [PAGE, 'http://other.local/x.php', 'not a url']);
    assert.equal(t.filter((c) => c.kind === 'raw').length, 1);
  });

  it('an unparseable page URL yields no candidates', () => {
    assert.deepEqual(buildSourceCodeTargets('not a url', []), []);
  });
});

describe('sourceCodeDisclosure probe — findings', () => {
  it('a .bak copy serving PHP source is a High finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [BAK]: { status: 200, headers: {}, body: PHP_SOURCE },
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'source_code_disclosure');
    assert.equal(f.severity, 'high');
    assert.ok(f.title.includes('backup'));
    assert.ok(f.title.includes('php'));
    assert.equal(f.url, BAK);
    assert.ok(f.evidence.request.includes(BAK));
    assert.ok(f.evidence.response.includes('<?php'));
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('a backup finding verifies as confirmed through verifyFindings', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [BAK]: { status: 200, headers: {}, body: PHP_SOURCE },
      }),
    });
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });

  it('an exposed .git/config is a High finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [GITCONFIG]: {
          status: 200,
          headers: {},
          body: '[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = https://example.com/repo.git\n',
        },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('.git/config'));
    assert.equal(findings[0].severity, 'high');
  });

  it('a .js.map with sourcesContent is a High finding', async () => {
    const mapBody = JSON.stringify({
      version: 3,
      sources: ['app.ts'],
      mappings: 'AAAA',
      sourcesContent: ['function greet(name) {\n  const msg = "hi " + name;\n  return msg;\n}\n'],
    });
    const findings = await probeSourceCodeDisclosure(JS_PAGE, [JS_PAGE], {
      fetchPage: fetchPageFor({
        [JS_PAGE]: { status: 200, headers: {}, body: 'function greet(n){return "hi "+n}' },
        [MAP]: { status: 200, headers: {}, body: mapBody },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('source map'));
    assert.equal(findings[0].url, MAP);
  });

  it('the pasted page itself served as raw PHP source is a High finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: PHP_SOURCE },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('served unexecuted'));
    assert.equal(findings[0].url, PAGE);
  });

  it('two backup variants both serving source are TWO findings', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [BAK]: { status: 200, headers: {}, body: PHP_SOURCE },
        [OLD]: { status: 200, headers: {}, body: PHP_SOURCE },
      }),
    });
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.url === BAK));
    assert.ok(findings.some((f) => f.url === OLD));
  });
});

describe('sourceCodeDisclosure probe — no finding', () => {
  it('a .bak that 404s is NOT a finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a .bak serving the SPA HTML shell is NOT a finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [BAK]: { status: 200, headers: {}, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a .bak serving an HTML docs page is NOT a finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [BAK]: {
          status: 200,
          headers: {},
          body: '<!DOCTYPE html><html><body><h1>Guide</h1><p>Call the function to authenticate.</p></body></html>',
        },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a .git/config that 404s is NOT a finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a .git/config body without git structure is NOT a finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [GITCONFIG]: { status: 200, headers: {}, body: 'hello world\n' },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a .map without sourcesContent is NOT a finding', async () => {
    const mapBody = JSON.stringify({ version: 3, sources: ['app.ts'], mappings: 'AAAA' });
    const findings = await probeSourceCodeDisclosure(JS_PAGE, [JS_PAGE], {
      fetchPage: fetchPageFor({
        [JS_PAGE]: { status: 200, headers: {}, body: 'function greet(n){return "hi "+n}' },
        [MAP]: { status: 200, headers: {}, body: mapBody },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a .map that is HTML (SPA fallback) is NOT a finding', async () => {
    const findings = await probeSourceCodeDisclosure(JS_PAGE, [JS_PAGE], {
      fetchPage: fetchPageFor({
        [JS_PAGE]: { status: 200, headers: {}, body: 'function greet(n){return "hi "+n}' },
        [MAP]: { status: 200, headers: {}, body: BASELINE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a backup serving config KEY=VALUE lines only is NOT a finding (files phase covers config)', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [BAK]: {
          status: 200,
          headers: {},
          body: 'APP_NAME=demo\nDEBUG=false\nAPP_ENV=local\n',
        },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('backup source already quoted on the baseline page is NOT a finding (differential)', async () => {
    const baselineWithCode = `<html><body><h1>Docs</h1><pre>${PHP_SOURCE}</pre></body></html>`;
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: baselineWithCode },
        [BAK]: { status: 200, headers: {}, body: PHP_SOURCE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('a backup body identical to the catch-all control is NOT a finding', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: fetchPageFor({
        [PAGE]: { status: 200, headers: {}, body: BASELINE },
        [CATCHALL]: { status: 200, headers: {}, body: PHP_SOURCE },
        [BAK]: { status: 200, headers: {}, body: PHP_SOURCE },
      }),
    });
    assert.equal(findings.length, 0);
  });

  it('fetch errors are tolerated — no findings, no throw', async () => {
    const findings = await probeSourceCodeDisclosure(PAGE, [PAGE], {
      fetchPage: async (url) => {
        if (String(url) === PAGE) return { status: 200, headers: {}, body: BASELINE };
        throw new Error('boom');
      },
    });
    assert.equal(findings.length, 0);
  });

  it('fetch budget: many targets stay within 15 GETs', async () => {
    const calls = [];
    const urls = Array.from({ length: 7 }, (_, i) => `http://lab.local/p${i}.php`);
    const findings = await probeSourceCodeDisclosure(PAGE, urls, {
      fetchPage: fetchPageFor(
        {
          [PAGE]: { status: 200, headers: {}, body: BASELINE },
        },
        calls
      ),
    });
    assert.equal(findings.length, 0);
    assert.ok(calls.length <= 15, `expected <= 15 fetches, got ${calls.length}`);
  });
});
