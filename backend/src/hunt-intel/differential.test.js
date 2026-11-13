// Tests for differential confirmation protocols — the judge that turns a
// probe's control evidence into confirmed / rejected / unconfirmed.
// Covers the OOB (collaborator-hit) protocol: a finding whose class ends in
// `_oob` is judged on oobHit, exactly like SSRF.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessConfirmation, dedupeFindings, isTinyErrorPageDivergence, scoreExploitability } from './differential.js';
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

  it('confirms sqli_second_order on diverged — the boolean protocol judges the second-request divergence', () => {
    // 14 Nov 2026 (#208): 'sqli_second_order' contains 'sqli' but
    // neither 'time'/'blind' nor 'error', so protocolFor routes it to
    // the sqli_boolean protocol, judged on `diverged`. The probe
    // carries diverged:true (the trigger response diverged between
    // the malicious-stored and benign-stored values) alongside
    // errorCorrelated:true (the specific signal), so the finding
    // confirms instead of landing 'unconfirmed' for carrying the
    // wrong flag.
    assert.equal(
      assessConfirmation({ class: 'sqli_second_order', evidence: { diverged: true, errorCorrelated: true } }).verdict,
      'confirmed'
    );
    assert.equal(
      assessConfirmation({ class: 'sqli_second_order', evidence: { diverged: false, errorCorrelated: true } }).verdict,
      'rejected'
    );
    assert.equal(
      assessConfirmation({ class: 'sqli_second_order', evidence: { errorCorrelated: true } }).verdict,
      'unconfirmed'
    );
  });
});

// assessConfirmation egress_laundering protocol (H3(b), V8-F1, 11 Nov
// 2026): a finding confirms only when BOTH the external URL is
// preserved verbatim in rendered HTML AND a viewer-browser fetch hit
// the collaborator. Verbatim without a fetch is unconfirmed (the URL
// may be inert); a stripped/rewritten URL is rejected.
describe('assessConfirmation egress_laundering protocol', () => {
  it('confirms when verbatimPreserved and clientFetchHit are both true', () => {
    const r = assessConfirmation({
      class: 'egress_laundering',
      evidence: { verbatimPreserved: true, clientFetchHit: true },
    });
    assert.equal(r.verdict, 'confirmed');
  });

  it('rejects when verbatimPreserved is false (stripped / proxied / escaped)', () => {
    const r = assessConfirmation({
      class: 'egress_laundering',
      evidence: { verbatimPreserved: false, clientFetchHit: false },
    });
    assert.equal(r.verdict, 'rejected');
  });

  it('is unconfirmed when verbatim but no fetch hit (no viewer fetch observed)', () => {
    const r = assessConfirmation({
      class: 'egress_laundering',
      evidence: { verbatimPreserved: true },
    });
    assert.equal(r.verdict, 'unconfirmed');
  });

  it('is unconfirmed with no flags (fail-closed)', () => {
    const r = assessConfirmation({ class: 'egress_laundering', evidence: {} });
    assert.equal(r.verdict, 'unconfirmed');
  });
});

// assessConfirmation office external-image protocols (V10-F4 docx,
// V10-F5 xlsx, V10-VC-1 pptx control, 11 Nov 2026): a finding
// confirms only when the package links an external image
// (TargetMode="External" + <a:blip r:link>) AND that image is not
// also embedded. A linked image with no embedding is the fetch
// channel; an embedded image is the negative control.
describe('assessConfirmation office external-image protocols', () => {
  for (const cls of ['document_external_image', 'spreadsheet_external_image', 'presentation_external_image']) {
    it(`${cls}: confirms when externalLinkPreserved and not embeddedMedia`, () => {
      const r = assessConfirmation({
        class: cls,
        evidence: { externalLinkPreserved: true, embeddedMedia: false },
      });
      assert.equal(r.verdict, 'confirmed');
    });

    it(`${cls}: rejects when externalLinkPreserved is false (embedded / no link)`, () => {
      const r = assessConfirmation({
        class: cls,
        evidence: { externalLinkPreserved: false, embeddedMedia: true },
      });
      assert.equal(r.verdict, 'rejected');
    });

    it(`${cls}: is unconfirmed when linked but also embedded`, () => {
      const r = assessConfirmation({
        class: cls,
        evidence: { externalLinkPreserved: true, embeddedMedia: true },
      });
      assert.equal(r.verdict, 'unconfirmed');
    });

    it(`${cls}: is unconfirmed with no flags (fail-closed)`, () => {
      const r = assessConfirmation({ class: cls, evidence: {} });
      assert.equal(r.verdict, 'unconfirmed');
    });
  }
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

// Tiny-error-page differential guard (GitHub calibration hunt
// h_d7b2902f1a99, 10 Nov 2026): 11x NoSQLi + 1x LDAP + 2x XPath on
// /login "confirmed" on a length divergence that was a rejected request
// — the operator response was a 31-char error stub against a full
// benign page (45,581 chars on /login, 192,606 on /resources/articles).
// Same class as the Zerodha incident (9 Nov, 37 FPs). The guard is
// directional: a genuine bypass returns MORE rows than the benign query,
// so the operator side is the larger one and the guard can never fire
// on it. It fires only when the operator request was rejected.
describe('tiny-error-page differential guard', () => {
  it('rejects the GitHub NoSQLi /resources/articles shape (benign 192606, operator 31)', () => {
    const r = assessConfirmation({
      class: 'nosql_injection',
      evidence: { diverged: true, benignLength: 192606, operatorLength: 31 },
    });
    assert.equal(r.verdict, 'rejected');
    assert.match(r.protocol, /tiny error page/);
  });

  it('rejects the GitHub /login shape for all three boolean classes (benign 45581, operator 31)', () => {
    for (const cls of ['nosql_injection', 'ldap_injection', 'xpath_injection']) {
      const r = assessConfirmation({
        class: cls,
        evidence: { diverged: true, signalCorrelated: true, benignLength: 45581, operatorLength: 31 },
      });
      assert.equal(r.verdict, 'rejected', cls);
    }
  });

  it('still confirms a genuine bypass: operator returns MORE than benign', () => {
    const r = assessConfirmation({
      class: 'nosql_injection',
      evidence: { diverged: true, benignLength: 45581, operatorLength: 60000 },
    });
    assert.equal(r.verdict, 'confirmed');
  });

  it('still confirms a genuine small differential (benign 500, operator 900)', () => {
    const r = assessConfirmation({
      class: 'ldap_injection',
      evidence: { diverged: true, signalCorrelated: true, benignLength: 500, operatorLength: 900 },
    });
    assert.equal(r.verdict, 'confirmed');
  });

  it('boundary: operator 512 at exactly 10x benign is rejected; 513 is not', () => {
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: true, benignLength: 5120, operatorLength: 512 } }).verdict,
      'rejected'
    );
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: true, benignLength: 5130, operatorLength: 513 } }).verdict,
      'confirmed'
    );
  });

  it('boundary: ratio 9x does not fire (benign 1800, operator 200)', () => {
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: true, benignLength: 1800, operatorLength: 200 } }).verdict,
      'confirmed'
    );
  });

  it('boundary: benign below the 1024-char full-page floor abstains (benign 1000, operator 31)', () => {
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: true, benignLength: 1000, operatorLength: 31 } }).verdict,
      'confirmed'
    );
  });

  it('abstains when either length is missing — old behaviour unchanged', () => {
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: true } }).verdict,
      'confirmed'
    );
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: true, benignLength: 45581 } }).verdict,
      'confirmed'
    );
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: true, operatorLength: 31 } }).verdict,
      'confirmed'
    );
  });

  it('never touches error-oracle evidence (no lengths, signalCorrelated)', () => {
    // The LDAP/XPath error legs confirm on error TEXT, not on length —
    // they carry no benignLength/operatorLength, so the guard abstains.
    assert.equal(
      assessConfirmation({ class: 'ldap_injection', evidence: { signalCorrelated: true } }).verdict,
      'confirmed'
    );
  });

  it('never touches OOB confirmations (collaborator hit, not lengths)', () => {
    assert.equal(
      assessConfirmation({ class: 'ssrf', evidence: { oobHit: true, benignLength: 45581, operatorLength: 31 } }).verdict,
      'confirmed'
    );
  });

  it('never promotes: already-rejected stays rejected, unconfirmed stays unconfirmed', () => {
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { diverged: false, benignLength: 45581, operatorLength: 31 } }).verdict,
      'rejected'
    );
    assert.equal(
      assessConfirmation({ class: 'nosql_injection', evidence: { benignLength: 45581, operatorLength: 31 } }).verdict,
      'unconfirmed'
    );
  });

  it('isTinyErrorPageDivergence pins the pure rule', () => {
    assert.equal(isTinyErrorPageDivergence({ benignLength: 45581, operatorLength: 31 }), true);
    assert.equal(isTinyErrorPageDivergence({ benignLength: 45581, operatorLength: 60000 }), false);
    assert.equal(isTinyErrorPageDivergence({ benignLength: 500, operatorLength: 900 }), false);
    assert.equal(isTinyErrorPageDivergence({}), false);
    assert.equal(isTinyErrorPageDivergence({ benignLength: 45581 }), false);
    assert.equal(isTinyErrorPageDivergence({ benignLength: 'x', operatorLength: 31 }), false);
  });

  it('verifyFindings drops a GitHub-shaped finding to unconfirmed (end to end)', () => {
    // Mirrors the archived h_d7b2902f1a99 finding verbatim in shape:
    // high severity, request + response + impact_demo evidence, diverged.
    const found = [{
      class: 'nosql_injection',
      title: "NoSQL injection (boolean bypass) in parameter 'login'",
      severity: 'high',
      url: 'https://github.com/session',
      evidence: {
        request: 'GET https://github.com/session?login=dmnoabc123 vs benign',
        response: 'result set diverged by 45550 chars (benign 45581, operator 31)',
        impact_demo: '$ne operator bypassed the equality filter',
        diverged: true,
        benignLength: 45581,
        operatorLength: 31,
      },
    }];
    const { confirmed, unconfirmed } = verifyFindings(found);
    assert.equal(confirmed.length, 0);
    assert.equal(unconfirmed.length, 1);
    assert.equal(unconfirmed[0].confirmation, 'rejected');
  });
});

// Log poisoning judge routing + exploitability (14 Nov 2026, coverage
// row #337): class 'log_poisoning' normalises to 'logpoisoning', which
// matches no family branch in protocolFor, so it falls to the default
// protocol judged on signalCorrelated — the flag the probe carries
// alongside diverged and executed. The capability map must also carry
// it (file_read + code_exec) or scoreExploitability would rate a
// confirmed RCE BENIGN.
describe('log_poisoning judge routing + exploitability', () => {
  it('confirms log_poisoning on signalCorrelated (default protocol)', () => {
    const r = assessConfirmation({
      class: 'log_poisoning',
      evidence: { signalCorrelated: true, diverged: true, executed: true },
    });
    assert.equal(r.verdict, 'confirmed');
  });

  it('rejects log_poisoning when signalCorrelated is false', () => {
    const r = assessConfirmation({
      class: 'log_poisoning',
      evidence: { signalCorrelated: false },
    });
    assert.equal(r.verdict, 'rejected');
  });

  it('is unconfirmed for log_poisoning with no signalCorrelated flag', () => {
    const r = assessConfirmation({ class: 'log_poisoning', evidence: {} });
    assert.equal(r.verdict, 'unconfirmed');
  });

  it('scores a confirmed log_poisoning finding LIKELY_EXPLOITABLE (file_read + code_exec)', () => {
    const r = scoreExploitability({ class: 'log_poisoning' }, 'confirmed');
    assert.equal(r.level, 'LIKELY_EXPLOITABLE');
  });
});
