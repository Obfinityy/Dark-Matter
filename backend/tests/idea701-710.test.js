/**
 * idea701-710.test.js — Tests for the WASM + JS-deobfuscation + SDK wave.
 *
 * Ideas 701-710: WASM import/memory analysis (wasmAnalyzer.js),
 * minified-JS endpoint recovery (jsDeobfuscator.js) and bundled SDK
 * fingerprinting (sdkDetector.js). All fixtures are synthetic, shaped like
 * real build artifacts. No exploit material, no live targets.
 *
 * Run: cd backend && node --test tests/idea701-710.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isWasm,
  readUleb128,
  analyzeWasmImports,
  scanWasmMemorySegments,
  extractWasmCustomNames,
  analyzeWasmModule,
} from '../src/engines/wasmAnalyzer.js';

import {
  stripComments,
  extractStringLiterals,
  findStringArrays,
  resolveStringArrayRefs,
  foldStringConcatenations,
  decodeBase64Blobs,
  harvestDynamicImports,
  resolveImportMap,
  recoverEndpoints,
} from '../src/engines/jsDeobfuscator.js';

import {
  detectSdk,
  extractSdkVersions,
  compareVersions,
  analyzeSdkFreshness,
  findFeatureFlagEndpoints,
  auditBundledSdks,
} from '../src/engines/sdkDetector.js';

// ---------------------------------------------------------------------------
// Synthetic WASM fixture: magic + import section (env.memory, go.run) +
// data section with two URL-bearing payloads.
// ---------------------------------------------------------------------------
function buildWasmFixture() {
  const bytes = [];
  const push = (...bs) => bytes.push(...bs);
  const uleb = (n) => {
    do {
      let b = n & 0x7f;
      n >>>= 7;
      if (n) b |= 0x80;
      push(b);
    } while (n);
  };
  const name = (s) => {
    const enc = Buffer.from(s, 'utf8');
    uleb(enc.length);
    push(...enc);
  };
  const section = (id, body) => {
    push(id);
    uleb(body.length);
    push(...body);
  };

  push(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00); // magic + v1

  // import section: 2 imports
  const imp = [];
  const iPush = (...bs) => imp.push(...bs);
  const iUleb = (n) => {
    const tmp = [];
    let x = n;
    do {
      let b = x & 0x7f;
      x >>>= 7;
      if (x) b |= 0x80;
      tmp.push(b);
    } while (x);
    iPush(...tmp);
  };
  const iName = (s) => {
    const enc = Buffer.from(s, 'utf8');
    iUleb(enc.length);
    iPush(...enc);
  };
  iUleb(2);
  iName('env');
  iName('memory');
  iPush(2); // kind: memory
  iUleb(0);
  iUleb(1);
  iName('wasi_snapshot_preview1');
  iName('fd_write');
  iPush(0); // kind: function
  iUleb(0); // type index
  section(2, imp);

  // data section: 2 active segments with embedded URLs
  const seg = (text) => {
    const payload = Buffer.from(text, 'utf8');
    const body = [];
    const bPush = (...bs) => body.push(...bs);
    const bUleb = (n) => {
      let x = n;
      do {
        let b = x & 0x7f;
        x >>>= 7;
        if (x) b |= 0x80;
        bPush(b);
      } while (x);
    };
    bUleb(0); // flags: active, no memory index
    bPush(0x41, 0x10, 0x0b); // i32.const 16; end
    bUleb(payload.length);
    bPush(...payload);
    return body;
  };
  const dataBody = [];
  dataBody.push(2); // segment count (leb128 of 2)
  dataBody.push(...seg('config https://api.example.com/v2/graphql endpoint'));
  dataBody.push(...seg('static/chunk-abc123.js loaded from /assets/app.js'));
  section(11, dataBody);

  return Uint8Array.from(bytes);
}

describe('wasmAnalyzer', () => {
  it('rejects non-WASM bytes', () => {
    assert.equal(isWasm(Buffer.from('hello')), false);
    const r = analyzeWasmImports(Buffer.from('hello'));
    assert.equal(r.ok, false);
    assert.match(r.error, /not a WebAssembly/);
  });

  it('parses import section into host dependencies (idea 701)', () => {
    const wasm = buildWasmFixture();
    assert.equal(isWasm(wasm), true);
    const r = analyzeWasmImports(wasm);
    assert.equal(r.ok, true);
    assert.equal(r.imports.length, 2);
    assert.deepEqual(r.moduleDependencies, ['env', 'wasi_snapshot_preview1']);
    assert.equal(r.imports[0].kind, 'memory');
    assert.equal(r.imports[1].kind, 'function');
    assert.ok(r.summary.functionImports.includes('wasi_snapshot_preview1.fd_write'));
  });

  it('scans memory initializers for URLs (idea 702)', () => {
    const wasm = buildWasmFixture();
    const r = scanWasmMemorySegments(wasm);
    assert.equal(r.ok, true);
    assert.equal(r.segments.length, 2);
    assert.ok(r.segments[0].urls.includes('https://api.example.com/v2/graphql'));
    assert.ok(r.segments[1].urls.some((u) => u.includes('/assets/app.js')));
  });

  it('handles custom name section gracefully', () => {
    const wasm = buildWasmFixture();
    const r = extractWasmCustomNames(wasm);
    assert.equal(r.ok, true);
    assert.deepEqual(r.names, []);
  });

  it('one-call summary merges imports and embedded URLs', () => {
    const r = analyzeWasmModule(buildWasmFixture());
    assert.equal(r.ok, true);
    assert.ok(r.embeddedUrls.includes('https://api.example.com/v2/graphql'));
  });

  it('readUleb128 decodes multi-byte values', () => {
    const r = readUleb128(Uint8Array.from([0x80, 0x01]), 0);
    assert.equal(r.value, 128);
    assert.equal(r.next, 2);
  });
});

describe('jsDeobfuscator', () => {
  it('strips comments without touching string contents', () => {
    const out = stripComments('var a = "//x"; // real comment\n/* b */var c=1;');
    assert.ok(out.includes('"//x"'));
    assert.ok(!out.includes('real comment'));
  });

  it('detects obfuscator string arrays and resolves refs (idea 703)', () => {
    const js = `var _0x1a=["https://","api.example.com","/v1/users","/v1/orders","token","refresh","/v1/auth","/v1/billing","csrf","nonce","/v1/search","debug"];var u=_0x1a[0]+_0x1a[1]+_0x1a[2];`;
    const tables = findStringArrays(js);
    assert.equal(tables.size, 1);
    assert.equal(tables.get('_0x1a').length, 12);
    const resolved = resolveStringArrayRefs(js, tables);
    assert.ok(resolved.includes('"https://"'));
    assert.ok(!resolved.includes('_0x1a[0]'));
  });

  it('folds split string concatenations into URLs (idea 704)', () => {
    const folded = foldStringConcatenations(`var u=("ht"+"tp://"+"h"+"ost"+"/a"+"pi");`);
    assert.ok(folded.includes('"http://host/api"'));
    assert.ok(!folded.includes('"ht"+'));
  });

  it('decodes base64 blobs hiding endpoints (idea 705)', () => {
    const hidden = Buffer.from('{"url":"https://secret.example.com/collect"}', 'utf8').toString('base64');
    const findings = decodeBase64Blobs(`var c=atob("${hidden}");var t="aGVsbG8=";`);
    assert.ok(findings.length >= 1);
    const hit = findings.find((f) => f.decoded.includes('secret.example.com'));
    assert.ok(hit);
    assert.ok(hit.urls.includes('https://secret.example.com/collect'));
  });

  it('harvests dynamic import() targets incl. templates (idea 706)', () => {
    const js = `import("./chunk-admin.js");const x=import(\`./views/\${page}.js\`);import(/* webpackChunkName: "billing" */ "./billing.js");`;
    const found = harvestDynamicImports(js);
    const specs = found.map((f) => f.specifier);
    assert.ok(specs.includes('./chunk-admin.js'));
    assert.ok(specs.includes('./views/${page}.js'));
    assert.ok(specs.some((s) => s.includes('billing')));
  });

  it('resolves import-map bare specifiers (idea 707)', () => {
    const html = `<script type="importmap">{"imports":{"react":"https://cdn.example.com/react.js","app/":"/static/app/"}}</script>`;
    const r = resolveImportMap(html, 'https://www.example.com/');
    assert.equal(r.ok, true);
    assert.equal(r.resolve('react'), 'https://cdn.example.com/react.js');
    assert.equal(r.resolve('app/main.js'), 'https://www.example.com/static/app/main.js');
    assert.equal(r.resolve('unknown'), null);
  });

  it('recoverEndpoints combines every heuristic', () => {
    const hidden = Buffer.from('https://metrics.example.com/ingest', 'utf8').toString('base64');
    const js = `
      var _0xa=["https://","api.example.com","/v1/data","/v1/auth","tok","csrf","a","b","c","d","e","f"];
      fetch(_0xa[0]+_0xa[1]+_0xa[2]);
      import("./lazy/settings.js");
      var b = atob("${hidden}");
    `;
    const r = recoverEndpoints(js);
    assert.ok(r.endpoints.some((e) => e.includes('api.example.com/v1/data')));
    assert.ok(r.endpoints.includes('./lazy/settings.js'));
    assert.ok(r.endpoints.includes('https://metrics.example.com/ingest'));
    assert.equal(r.stringArrays, 1);
  });
});

describe('sdkDetector', () => {
  const stripeBundle = `
    /*! stripe-js v3.9.1 */
    var Stripe=function(){this.__stripe-js__=true;};
    Stripe.setPublishableKey=function(k){fetch("https://api.stripe.com/v1/tokens")};
    var VERSION="3.9.1";
    fetch("https://js.stripe.com/v3/");
  `;

  it('detects Stripe SDK with confidence (idea 708)', () => {
    const hits = detectSdk(stripeBundle);
    const stripe = hits.find((h) => h.name === 'Stripe.js');
    assert.ok(stripe);
    assert.equal(stripe.confidence, 'high');
    assert.ok(stripe.knownEndpoints.includes('https://api.stripe.com'));
  });

  it('ignores unrelated bundles', () => {
    assert.deepEqual(detectSdk('var x = 1; console.log("hello");'), []);
  });

  it('extracts version pins and flags outdated ones (idea 709)', () => {
    const pins = extractSdkVersions(stripeBundle);
    assert.ok(pins.some((p) => p.version === '3.9.1'));
    const freshness = analyzeSdkFreshness(pins);
    const stripePin = freshness.find((f) => f.library === 'Stripe.js');
    assert.ok(stripePin);
    assert.equal(stripePin.status, 'outdated');
    assert.equal(stripePin.latestKnown, '4.2.0');
  });

  it('compareVersions orders semver correctly', () => {
    assert.equal(compareVersions('3.9.1', '4.2.0'), -1);
    assert.equal(compareVersions('4.2.0', '4.2.0'), 0);
    assert.equal(compareVersions('11.0.0', '9.0.0'), 1);
  });

  it('finds feature-flag service endpoints and masks keys (idea 710)', () => {
    const cfg = `
      var ldClientKey = "client-1234567890abcdef";
      LD.init({clientSideID: "client-1234567890abcdef"});
      fetch("https://clientstream.launchdarkly.com/eval");
      var splitKey = "sdk-split-auth-key-abcdef123456";
      new WebSocket("https://streaming.split.io/sse");
    `;
    const found = findFeatureFlagEndpoints(cfg);
    const services = new Set(found.map((f) => f.service));
    assert.ok(services.has('LaunchDarkly'));
    assert.ok(services.has('Split'));
    // keys are masked, never logged in full
    for (const f of found.filter((x) => x.kind === 'client-key')) {
      assert.ok(!f.value.includes('1234567890'));
      assert.ok(f.value.endsWith('cdef'));
    }
  });

  it('auditBundledSdks merges detection, versions and flag services', () => {
    const js = stripeBundle + `var k="client-aaaabbbbccccdddd";fetch("https://clientstream.launchdarkly.com/x");`;
    const r = auditBundledSdks(js);
    assert.ok(r.detected.some((d) => d.name === 'Stripe.js'));
    assert.ok(r.flagServices.some((f) => f.service === 'LaunchDarkly'));
    assert.ok(r.thirdPartyHosts.includes('https://api.stripe.com'));
    assert.ok(r.outdatedCount >= 1);
  });
});
