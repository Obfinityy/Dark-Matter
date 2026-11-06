// Tests for differential confirmation protocols — the judge that turns a
// probe's control evidence into confirmed / rejected / unconfirmed.
// Covers the OOB (collaborator-hit) protocol: a finding whose class ends in
// `_oob` is judged on oobHit, exactly like SSRF.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessConfirmation } from './differential.js';

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
});
