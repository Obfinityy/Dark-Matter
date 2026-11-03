// Scanner findings surfacing tests (3 Nov 2026).
//
// REGRESSION: the first product acceptance test (3 Nov) found that a
// finished automation hunt recorded 2 genuine confirmed findings on the
// backend (as `scanner_finding` events) while the frontend showed
// "0 confirmed, 0 under investigation". The product findings surface
// (applyRetractions -> panelFindings -> report/panel/chat) only reads
// `type: 'finding'` events, so scanner findings never appeared.
//
// The fix: buildScannerFindingRecords emits BOTH the raw scanner_finding
// record AND a standard `finding` event with verified=true ONLY when the
// scanner's own differential verifier confirmed the finding (100% truth
// rule — nothing unconfirmed ever renders as Confirmed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScannerFindingRecords } from './scannerHunt.js';
import { applyRetractions, panelFindings } from './huntMemory.js';

const confirmedFinding = {
  class: 'cookie_flags',
  title: "Cookie 'PHPSESSID' missing security flags: Secure, HttpOnly, SameSite",
  severity: 'medium',
  url: 'http://172.17.0.1:3100',
  param: null,
  evidence: {
    request: 'GET http://172.17.0.1:3100',
    response: 'Set-Cookie: PHPSESSID=abc; path=/',
    impact_demo: 'missing Secure, HttpOnly, SameSite — stealable via XSS',
    signalCorrelated: true,
  },
  confirmation: 'confirmed',
};

test('buildScannerFindingRecords emits raw + product-surface events', () => {
  const [raw, surface] = buildScannerFindingRecords(confirmedFinding);
  assert.equal(raw.type, 'scanner_finding');
  assert.equal(raw.finding.title, confirmedFinding.title);
  assert.equal(raw.finding.confirmation, 'confirmed');
  assert.equal(surface.type, 'finding');
  assert.equal(surface.title, confirmedFinding.title);
  assert.equal(surface.severity, 'medium');
  assert.equal(surface.url, confirmedFinding.url);
  assert.equal(surface.source, 'scanner');
});

test('confirmed scanner finding surfaces as verified through panelFindings', () => {
  const [, surface] = buildScannerFindingRecords(confirmedFinding);
  assert.equal(surface.verified, true);
  assert.match(surface.verification, /rule-based differential verifier/);
  assert.ok(surface.detail.length > 0);
  const rows = panelFindings(applyRetractions([surface]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].verified, true);
  assert.equal(rows[0].severity, 'medium');
});

test('unconfirmed scanner finding NEVER surfaces as verified (truth rule)', () => {
  const lead = { ...confirmedFinding, confirmation: 'unconfirmed' };
  const [, surface] = buildScannerFindingRecords(lead);
  assert.equal(surface.verified, false);
  assert.match(surface.verification, /Not confirmed/);
  const rows = panelFindings(applyRetractions([surface]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].verified, false); // a lead, never Confirmed
});

test('raw scanner_finding events alone still surface nothing (the old bug)', () => {
  const [raw] = buildScannerFindingRecords(confirmedFinding);
  const rows = panelFindings(applyRetractions([raw]));
  assert.equal(rows.length, 0); // type 'scanner_finding' is invisible by design
});
