/**
 * Tests for hardeningDetector.js — post-incident hardening signal detection.
 * Feeds VFS-style client code patterns and checks verdicts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeUploadValidation,
  detectDevtoolsBlocking,
  scoreFromSignals,
} from '../src/engines/hardeningDetector.js';

// realistic VFS-style feedback-form client code (patterns observed 9 Oct 2026)
const VFS_STYLE_JS = `
  var allowedUploadExtensions = ["jpeg", "jpg", "png", "pdf"];
  var allowedUploadMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
  var blockedUploadNameFragments = [
    ".asp", ".aspx", ".ashx", ".asmx", ".cer", ".asa", ".php", ".html",
    ".svg", ".js", ".exe", ".dll", ".config", ".cshtml", ".jsp", ".war", ".jar"
  ];
  var maxUploadFileSize = 5 * 1024 * 1024;
  var isFileValidatedOnServer = false;
  function hasBlockedUploadNameFragment(fileName) { /* ... */ }
  function hasMultipleExtensions(fileName) { return (fileName.match(/\\./g) || []).length > 1; }
  function readFileHeader(file, byteCount) { /* FileReader + readAsArrayBuffer */ }
  function matchesFileSignature(header, extension) {
    if (extension === "pdf") {
      return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    }
    if (extension === "jpg") {
      return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
    }
  }
  document.onkeydown = function (e) {
    if (event.keyCode == 123) { return false; }
    if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) { return false; }
    if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) { return false; }
  }
`;

const MINIMAL_JS = `
  var input = document.getElementById('file');
  input.addEventListener('change', function () { upload(this.files[0]); });
`;

describe('hardeningDetector.analyzeUploadValidation', () => {
  it('rates VFS-style hardened code as heavily-hardened', () => {
    const r = analyzeUploadValidation({ js: VFS_STYLE_JS });
    assert.equal(r.verdict, 'heavily-hardened');
    assert.ok(r.hardeningScore >= 70, `score ${r.hardeningScore} should be >= 70`);
    const types = r.signals.map((s) => s.type);
    assert.ok(types.includes('blocked_fragments'), 'detects blocked-fragment list');
    assert.ok(types.includes('signature_check'), 'detects magic-byte checks');
    assert.ok(types.includes('extension_allowlist'), 'detects extension allowlist');
    assert.ok(types.includes('mime_allowlist'), 'detects MIME allowlist');
    assert.ok(types.includes('multi_ext_rejection'), 'detects multi-extension rejection');
    assert.ok(types.includes('size_limit'), 'detects size limit');
    assert.ok(types.includes('devtools_blocking'), 'detects devtools blocking');
    assert.match(r.recommendation, /Deprioritize/);
  });

  it('rates minimal validation as basic or none', () => {
    const r = analyzeUploadValidation({ js: MINIMAL_JS });
    assert.ok(['basic', 'none'].includes(r.verdict), `verdict was ${r.verdict}`);
    assert.ok(r.hardeningScore < 40, `score ${r.hardeningScore} should be < 40`);
  });

  it('rates empty input as none', () => {
    const r = analyzeUploadValidation({});
    assert.equal(r.verdict, 'none');
    assert.equal(r.hardeningScore, 0);
    assert.deepEqual(r.signals, []);
  });

  it('detects partial hardening as moderate', () => {
    const js = `
      var allowedUploadExtensions = ["jpg", "png"];
      var maxUploadFileSize = 2 * 1024 * 1024;
      function validate(f) { return allowedUploadExtensions.includes(f.ext); }
    `;
    const r = analyzeUploadValidation({ js });
    assert.ok(['basic', 'moderately-hardened'].includes(r.verdict), `verdict was ${r.verdict}`);
  });
});

describe('hardeningDetector.detectDevtoolsBlocking', () => {
  it('finds F12 blocking with evidence', () => {
    const r = detectDevtoolsBlocking({ js: VFS_STYLE_JS });
    assert.equal(r.blocked, true);
    assert.ok(r.evidence.length >= 2);
    assert.ok(r.evidence.some((e) => e.includes('F12')));
  });

  it('returns not-blocked for clean code', () => {
    const r = detectDevtoolsBlocking({ js: MINIMAL_JS });
    assert.equal(r.blocked, false);
    assert.deepEqual(r.evidence, []);
  });
});

describe('hardeningDetector.scoreFromSignals', () => {
  it('sums weights and clamps to 0-100', () => {
    assert.equal(scoreFromSignals([{ weight: 10 }, { weight: 20 }]), 30);
    assert.equal(scoreFromSignals([{ weight: 500 }]), 100);
    assert.equal(scoreFromSignals([]), 0);
    assert.equal(scoreFromSignals(null), 0);
  });
});
