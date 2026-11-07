// Tests for differential confirmation protocols — the judge that turns a
// probe's control evidence into confirmed / rejected / unconfirmed.
// Covers the OOB (collaborator-hit) protocol: a finding whose class ends in
// `_oob` is judged on oobHit, exactly like SSRF.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessConfirmation, dedupeFindings } from './differential.js';
import { probeHeaders } from '../scanner/probes/headers.js';
import { verifyFindings } from '../scanner/verifier.js';

describe('assessConfirmation OOB protocol', () => {
  it('confirms saml_xxe_oob when oobHit is true', () => {
    const r = assessConfirmation({ class: 'saml_xxe_oob', evidence: { oobHit: true } });
    assert.equal(r.verdict, 'confirmed');
  });

  it('rejects saml_xxe_oob when oobHit is false', () => {
    const r = assessConfirmation({ class: 'saml_xxe_oob', evidence: { oobHit: false } });
    assert.equal(r.verdict, 'rejected');
  });

  it('is unconfirmed for saml_xxe_oob with no oobHit signal', () => {
    const r = assessConfirmation({ class: 'saml_xxe_oob', evidence: {} });
    assert.equal(r.verdict, 'unconfirmed');
  });

  it('keeps saml_xxe_oob_sent on the default protocol (signalCorrelated)', () => {
    // The '_sent' dispatch record must NOT be re-judged on oobHit: it has
    // no oobHit flag, and flipping it to unconfirmed would silently drop
    // the honest dispatched record from confirmed findings.
    const r = assessConfirmation({ class: 'saml_xxe_oob_sent', evidence: { signalCorrelated: true } });
    assert.equal(r.verdict, 'confirmed');
  });

  it('confirms ssrf on oobHit (pre-existing behaviour, guard)', () => {
    assert.equal(assessConfirmation({ class: 'ssrf', evidence: { oobHit: true } }).verdict, 'confirmed');
    assert.equal(assessConfirmation({ class: 'ssrf', evidence: { oobHit: false } }).verdict, 'rejected');
  });

  it('confirms sqli_oob on oobHit — the OOB guard must precede the sqli family branch', () => {
    // 7 Nov 2026 (#280): 'sqli_oob' contains 'sqli', so the family
    // branch used to claim it for the boolean protocol (judged on
    // `diverged`, which an OOB finding never carries) and a
    // collaborator-confirmed hit came out 'unconfirmed'. The OOB guard
    // now runs first, so the hit judges on oobHit like every other
    // _oob class.
    assert.equal(assessConfirmation({ class: 'sqli_oob', evidence: { oobHit: true } }).verdict, 'confirmed');
    assert.equal(assessConfirmation({ class: 'sqli_oob', evidence: { oobHit: false } }).verdict, 'rejected');
    assert.equal(assessConfirmation({ class: 'sqli_oob', evidence: {} }).verdict, 'unconfirmed');
  });
});

// dedupeFindings title segment (7 Nov 2026): the key is
// [class, sink||parameter||url, trigger||payload, title]. Without the
// title segment, distinct findings sharing class + URL and carrying no
// sink/parameter/trigger collapsed to one — probeHeaders' five
// missing-header checks lost four, and two nuclei templates matching at
// the same URL lost one. Title, not id: several probes use
// random-suffixed ids, so keying on id would defeat dedup for them.
describe('dedupeFindings title segment', () => {
  const URL = 'http://172.17.0.1:3100/login.php';

  it('keeps all five probeHeaders missing-header findings (the bug)', () => {
    const found = probeHeaders({ url: URL, headers: {} });
    assert.equal(found.length, 5);
    const kept = dedupeFindings(found);
    assert.equal(kept.length, 5);
    assert.deepEqual(
      kept.map((f) => f.id),
      ['missing-hsts', 'missing-csp', 'missing-xfo', 'missing-xcto', 'missing-rp']
    );
  });

  it('keeps two probeHeaders runs on the same URL deduped to five, not ten', () => {
    const found = probeHeaders({ url: URL, headers: {} });
    assert.equal(dedupeFindings([...found, ...found]).length, 5);
  });

  it('still collapses exact duplicates (same class + url + title) to one', () => {
    const a = { class: 'headers', url: URL, title: 'Missing Content-Security-Policy header' };
    const b = { class: 'headers', url: URL, title: 'Missing Content-Security-Policy header' };
    assert.equal(dedupeFindings([a, b]).length, 1);
  });

  it('still splits the same title across different URLs and sinks', () => {
    const title = 'Missing Content-Security-Policy header';
    const byUrl = [
      { class: 'headers', url: 'http://a.example/', title },
      { class: 'headers', url: 'http://b.example/', title },
    ];
    assert.equal(dedupeFindings(byUrl).length, 2);
    const bySink = [
      { class: 'xss_reflected', sink: 'q', url: URL, title: 'Reflected XSS' },
      { class: 'xss_reflected', sink: 'name', url: URL, title: 'Reflected XSS' },
    ];
    assert.equal(dedupeFindings(bySink).length, 2);
  });

  it('behaves as before for findings without titles', () => {
    const noTitle = [
      { class: 'headers', url: URL },
      { class: 'headers', url: URL },
    ];
    assert.equal(dedupeFindings(noTitle).length, 1);
    const noTitleDiffUrl = [
      { class: 'headers', url: 'http://a.example/' },
      { class: 'headers', url: 'http://b.example/' },
    ];
    assert.equal(dedupeFindings(noTitleDiffUrl).length, 2);
  });

  it('keeps two nuclei templates matching at the same URL (different titles)', () => {
    const nucleiShaped = [
      { class: 'nuclei', id: 'http-missing-security-headers', title: 'Missing Security Headers', url: URL },
      { class: 'nuclei', id: 'http-exposed-panel', title: 'Exposed Panel', url: URL },
    ];
    assert.equal(dedupeFindings(nucleiShaped).length, 2);
    // Same template twice at the same URL still collapses.
    const sameTemplate = [
      { class: 'nuclei', id: 'http-exposed-panel', title: 'Exposed Panel', url: URL },
      { class: 'nuclei', id: 'http-exposed-panel', title: 'Exposed Panel', url: URL },
    ];
    assert.equal(dedupeFindings(sameTemplate).length, 1);
  });

  it('verifyFindings confirms all five probeHeaders findings (end to end)', () => {
    const found = probeHeaders({ url: URL, headers: {} });
    const { confirmed, unconfirmed } = verifyFindings(found);
    assert.equal(confirmed.length, 5);
    assert.equal(unconfirmed.length, 0);
    assert.deepEqual(
      confirmed.map((f) => f.id),
      ['missing-hsts', 'missing-csp', 'missing-xfo', 'missing-xcto', 'missing-rp']
    );
  });
});
