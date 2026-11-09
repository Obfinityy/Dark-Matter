// Tests for the document.domain relaxation probe
// (coverage row #484 [Low] SOP — document.domain relaxation,
// CWE-668, phase 103).
// No network, no lab needed — the probe fetches bundles through the
// opts.fetchPage seam, stubbed here; inline scripts are scanned
// directly from the page body. Fixtures replicate the exact shapes
// a relaxation takes in served code: a plain literal assignment,
// the window. prefix, the bracket form, and a template literal —
// plus the shapes that must never fire (a read, a comparison, a
// commented-out assignment, assignment text inside a string, a
// non-literal right-hand side, a no-op same-host value, and a
// non-suffix value the browser would reject).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeDocumentDomain,
  scanDomainAssignments,
  assessDomainAssignment,
} from './documentDomain.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://app.example.com/';
const MAIN_URL = 'http://app.example.com/main.abc123.js';
const VENDOR_URL = 'http://app.example.com/vendor.def456.js';

// Stub fetchPage: maps bundle URLs to bodies, records fetches.
function fetchBodies(bodies, seen = []) {
  return async (url) => {
    seen.push(url);
    return { status: 200, body: bodies[url] || '' };
  };
}

const RELAXING_BUNDLE =
  'function boot(){document.domain = "example.com";init();}';
const WINDOW_RELAXING =
  'if (legacy) { window.document.domain = "example.com"; }';
const BRACKET_RELAXING =
  "document['domain'] = 'example.com';";
const TEMPLATE_RELAXING =
  'document.domain = `example.com`;';
const MIXED_BUNDLE =
  'document.domain = "example.com";\n' +
  'document.domain = location.hostname;\n' +
  'document.domain = "app.example.com";\n' +
  'document.domain = "other.com";';
const CLEAN_BUNDLE =
  'function render(t){const el=document.createElement("div");el.textContent=t.name;document.body.appendChild(el);}';

describe('assessDomainAssignment', () => {
  it('DD-1: a parent-suffix value relaxes the origin', () => {
    const v = assessDomainAssignment('app.example.com', 'example.com');
    assert.equal(v.kind, 'relaxation');
  });
  it('DD-2: dropping two labels still relaxes', () => {
    const v = assessDomainAssignment('a.b.example.com', 'example.com');
    assert.equal(v.kind, 'relaxation');
  });
  it('DD-3: a value equal to the host is a no-op', () => {
    const v = assessDomainAssignment('app.example.com', 'app.example.com');
    assert.equal(v.kind, 'noop');
  });
  it('DD-4: a non-suffix value is invalid (the browser rejects it)', () => {
    const v = assessDomainAssignment('app.example.com', 'other.com');
    assert.equal(v.kind, 'invalid');
  });
  it('DD-5: a single-label value is invalid, not a parent suffix', () => {
    const v = assessDomainAssignment('a.localhost', 'localhost');
    assert.equal(v.kind, 'invalid');
  });
  it('DD-6: a non-literal right-hand side is unresolved', () => {
    const v = assessDomainAssignment('app.example.com', null);
    assert.equal(v.kind, 'unresolved');
  });
  it('DD-7: a malformed value is invalid', () => {
    assert.equal(assessDomainAssignment('app.example.com', '-bad-.com').kind, 'invalid');
    assert.equal(assessDomainAssignment('app.example.com', 'exa mple.com').kind, 'invalid');
    assert.equal(assessDomainAssignment('app.example.com', 'com').kind, 'invalid');
  });
  it('DD-8: host and value compare case-insensitively, trailing dots ignored', () => {
    assert.equal(assessDomainAssignment('APP.EXAMPLE.COM.', 'Example.COM').kind, 'relaxation');
    assert.equal(assessDomainAssignment('APP.EXAMPLE.COM.', 'APP.EXAMPLE.COM').kind, 'noop');
  });
});

describe('scanDomainAssignments', () => {
  it('DD-9: a literal assignment is found with value, line and snippet', () => {
    const scan = scanDomainAssignments(RELAXING_BUNDLE, 'app.example.com');
    assert.equal(scan.relaxations.length, 1);
    assert.equal(scan.relaxations[0].value, 'example.com');
    assert.equal(scan.relaxations[0].line, 1);
    assert.ok(scan.relaxations[0].snippet.includes('document.domain'));
    assert.equal(scan.unresolved, 0);
    assert.equal(scan.noop, 0);
    assert.equal(scan.invalid, 0);
  });
  it('DD-10: window.document.domain fires', () => {
    const scan = scanDomainAssignments(WINDOW_RELAXING, 'app.example.com');
    assert.equal(scan.relaxations.length, 1);
    assert.equal(scan.relaxations[0].value, 'example.com');
  });
  it('DD-11: the bracket form fires', () => {
    const scan = scanDomainAssignments(BRACKET_RELAXING, 'app.example.com');
    assert.equal(scan.relaxations.length, 1);
  });
  it('DD-12: a template-literal value fires', () => {
    const scan = scanDomainAssignments(TEMPLATE_RELAXING, 'app.example.com');
    assert.equal(scan.relaxations.length, 1);
  });
  it('DD-13: == / === comparisons never fire', () => {
    assert.equal(
      scanDomainAssignments('if (document.domain == "example.com") { return; }', 'app.example.com'),
      null
    );
    assert.equal(
      scanDomainAssignments("if (document.domain === 'example.com') { return; }", 'app.example.com'),
      null
    );
  });
  it('DD-14: a read never fires', () => {
    assert.equal(
      scanDomainAssignments('var d = document.domain; console.log(d);', 'app.example.com'),
      null
    );
  });
  it('DD-15: a commented-out assignment never fires', () => {
    assert.equal(
      scanDomainAssignments('// document.domain = "example.com";\nvar a = 1;', 'app.example.com'),
      null
    );
    assert.equal(
      scanDomainAssignments('/* document.domain = "example.com"; */\nvar a = 1;', 'app.example.com'),
      null
    );
  });
  it('DD-16: assignment text inside a string literal never fires', () => {
    assert.equal(
      scanDomainAssignments(
        'var s = "see document.domain = \'example.com\' to relax";',
        'app.example.com'
      ),
      null
    );
  });
  it('DD-17: a non-literal right-hand side counts unresolved, never a relaxation', () => {
    const scan = scanDomainAssignments('document.domain = location.hostname;', 'app.example.com');
    assert.equal(scan.relaxations.length, 0);
    assert.equal(scan.unresolved, 1);
  });
  it('DD-18: a same-host value counts noop, never a relaxation', () => {
    const scan = scanDomainAssignments('document.domain = "app.example.com";', 'app.example.com');
    assert.equal(scan.relaxations.length, 0);
    assert.equal(scan.noop, 1);
  });
  it('DD-19: a non-suffix value counts invalid, never a relaxation', () => {
    const scan = scanDomainAssignments('document.domain = "other.com";', 'app.example.com');
    assert.equal(scan.relaxations.length, 0);
    assert.equal(scan.invalid, 1);
  });
  it('DD-20: a clean body has no assignments', () => {
    assert.equal(scanDomainAssignments(CLEAN_BUNDLE, 'app.example.com'), null);
    assert.equal(scanDomainAssignments('', 'app.example.com'), null);
    assert.equal(scanDomainAssignments(null, 'app.example.com'), null);
  });
});

describe('probeDocumentDomain', () => {
  it('DD-21: a relaxing bundle yields one aggregated [Low] finding', async () => {
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: RELAXING_BUNDLE }) }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'sop_domain_relaxation');
    assert.equal(findings[0].severity, 'low');
    assert.ok(findings[0].title.includes('example.com'));
    assert.equal(findings[0].parameter, 'document.domain');
    assert.equal(findings[0].evidence.signalCorrelated, true);
    assert.ok(findings[0].evidence.response.includes('app.example.com'));
  });
  it('DD-22: a vendor bundle is skipped, never fetched', async () => {
    const seen = [];
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: [VENDOR_URL], inline: [] },
      { fetchPage: fetchBodies({ [VENDOR_URL]: RELAXING_BUNDLE }, seen) }
    );
    assert.equal(findings.length, 0);
    assert.equal(seen.length, 0);
  });
  it('DD-23: a clean bundle yields no findings', async () => {
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: CLEAN_BUNDLE }) }
    );
    assert.equal(findings.length, 0);
  });
  it('DD-24: a relaxing inline block yields a finding filed under the page URL', async () => {
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: [], inline: [RELAXING_BUNDLE] },
      { fetchPage: fetchBodies({}) }
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, PAGE_URL);
    assert.equal(findings[0].class, 'sop_domain_relaxation');
  });
  it('DD-25: at most 5 findings per scan', async () => {
    const urls = Array.from({ length: 6 }, (_, i) => `http://app.example.com/b${i}.js`);
    const bodies = {};
    for (const u of urls) bodies[u] = RELAXING_BUNDLE;
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: urls, inline: [] },
      { fetchPage: fetchBodies(bodies) }
    );
    assert.equal(findings.length, 5);
  });
  it('DD-26: a probe finding judges confirmed on the default protocol', async () => {
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: RELAXING_BUNDLE }) }
    );
    assert.equal(findings.length, 1);
    const { verdict } = assessConfirmation(findings[0]);
    assert.equal(verdict, 'confirmed');
  });
  it('DD-27: diagnostics count every assignment shape', async () => {
    const diag = {};
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: fetchBodies({ [MAIN_URL]: MIXED_BUNDLE }), diagnostics: diag }
    );
    assert.equal(findings.length, 1);
    assert.equal(diag.domainRelaxations, 1);
    assert.equal(diag.unresolvedAssignments, 1);
    assert.equal(diag.noopAssignments, 1);
    assert.equal(diag.invalidAssignments, 1);
    assert.equal(diag.bundlesScanned, 1);
  });
  it('DD-28: a non-200 bundle is skipped', async () => {
    const findings = await probeDocumentDomain(
      PAGE_URL,
      { bundles: [MAIN_URL], inline: [] },
      { fetchPage: async () => ({ status: 404, body: '' }) }
    );
    assert.equal(findings.length, 0);
  });
});
