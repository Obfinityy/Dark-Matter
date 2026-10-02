/**
 * improvementLoop.test.js — continuous-improvement extras, each proven:
 *   X1: exploit CHAIN PoC templates (proof-only narratives with STOP markers)
 *   X2: business-impact quantification (elite-human triager summaries)
 *   X3: remediation CODE snippets per finding class
 *   X4: false-positive self-review pass (evidence-driven verdicts)
 *   X5: technical report carries the triager assessment + fix code
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateChainPoc, listExploitChains, checkPocSafety, EXPLOIT_CHAINS
} from '../src/agent/exploitEngine.js';
import { quantifyImpact, remediationSnippet } from '../src/agent/impactModel.js';
import { reviewFinding, reviewFindings } from '../src/agent/findingReview.js';
import { renderTechnicalReport } from '../src/services/vulnerabilityReportBuilder.js';

// ── X1: exploit chains ────────────────────────────────────────────────────

describe('X1 exploit chain PoCs', () => {
  it('lists chains with their step counts', () => {
    const chains = listExploitChains();
    assert.ok(chains.length >= 3, 'xss→session, sqli→data, idor→access chains');
    for (const c of chains) assert.ok(c.steps >= 3, `${c.id} must have ≥3 steps`);
  });

  it('builds the XSS→session chain for a reflected-XSS finding', () => {
    const chain = generateChainPoc({ type: 'xss_reflected', title: 'Reflected XSS', url: 'http://127.0.0.1:4567/search' });
    assert.ok(chain, 'chain must exist for xss_reflected');
    assert.equal(chain.id, 'xss_to_session_impact');
    assert.ok(chain.steps >= 3);
    assert.ok(chain.safetyChecked, 'must be safety-checked');
    assert.ok(/STOP/i.test(chain.code), 'chain must mark where execution stops');
    assert.ok(!/document\.cookie/i.test(chain.code), 'must never touch cookies even in narrative');
  });

  it('builds the SQLi→data chain and refuses data extraction', () => {
    const chain = generateChainPoc({ type: 'sqli', title: 'SQLi', url: 'http://127.0.0.1:4567/user?id=1' });
    assert.equal(chain.id, 'sqli_to_data_impact');
    assert.ok(/do not extract/i.test(chain.code), 'narrative must say no extraction');
  });

  it('builds the IDOR→access chain and forbids real-user IDs', () => {
    const chain = generateChainPoc({ type: 'idor', title: 'IDOR', url: 'http://x/api/order/123' });
    assert.equal(chain.id, 'idor_to_access_impact');
    assert.ok(/never use a real user/i.test(chain.code));
  });

  it('chain code passes the destructive-pattern guardrail', () => {
    for (const chain of EXPLOIT_CHAINS) {
      const gen = generateChainPoc({ type: chain.requires[0], title: 't', url: 'http://x/' });
      assert.ok(gen, `chain ${chain.id} must generate`);
      const check = checkPocSafety(gen.code);
      assert.equal(check.safe, true, `chain ${chain.id} must be guardrail-clean: ${check.violations}`);
    }
  });

  it('returns null when no chain applies', () => {
    assert.equal(generateChainPoc({ type: 'dns_zone_transfer' }), null);
  });
});

// ── X2: business-impact quantification ────────────────────────────────────

describe('X2 business-impact quantification', () => {
  it('grades SQLi as easy exploitability with high CIA', () => {
    const q = quantifyImpact({ type: 'sqli', url: 'http://x/user?id=1', parameter: 'id' });
    assert.equal(q.exploitability, 'easy');
    assert.equal(q.cia.confidentiality, 'High');
    assert.ok(q.triagerSummary.length > 100, 'summary must read like a human paragraph');
    assert.ok(!/devastating|catastrophic|apocalyptic/i.test(q.triagerSummary), 'no hype words');
  });

  it('grades stored XSS as trivial and names the wormable consequence', () => {
    const q = quantifyImpact({ type: 'xss_stored', url: 'http://x/guestbook' });
    assert.equal(q.exploitability, 'trivial');
    assert.ok(/mass compromise|every visitor/i.test(q.triagerSummary));
  });

  it('degrades gracefully for unknown types instead of inventing impact', () => {
    const q = quantifyImpact({ type: 'weird_new_thing', url: 'http://x/' });
    assert.equal(q.exploitability, 'moderate');
    assert.ok(/assess manually/i.test(q.triagerSummary));
  });
});

// ── X3: remediation code ──────────────────────────────────────────────────

describe('X3 remediation code snippets', () => {
  it('gives parameterized-query code for SQLi', () => {
    const s = remediationSnippet({ type: 'sqli' });
    assert.ok(s, 'snippet must exist');
    assert.ok(/%s|parameterized/i.test(s.code), 'must show parameterization');
    assert.ok(/BAD/i.test(s.code), 'must contrast bad vs good');
  });

  it('gives output-encoding code for XSS classes', () => {
    for (const t of ['xss_reflected', 'xss_stored', 'xss_dom']) {
      const s = remediationSnippet({ type: t });
      assert.ok(s, `snippet for ${t}`);
      assert.ok(/escape|textContent/i.test(s.code));
    }
  });

  it('covers the other template classes', () => {
    for (const t of ['ssrf', 'idor', 'lfi', 'command_injection', 'csrf', 'open_redirect', 'xxe', 'ssti']) {
      assert.ok(remediationSnippet({ type: t }), `snippet for ${t}`);
    }
  });
});

// ── X4: false-positive self-review ────────────────────────────────────────

describe('X4 false-positive self-review', () => {
  const solidXss = {
    type: 'xss_reflected', confidence: 'confirmed', url: 'http://127.0.0.1:4567/search',
    evidence: 'Payload <script>alert("XSS confirmed at 127.0.0.1")</script> reflected unencoded in the response; dialogFired=true in headless capture.',
    reproductionSteps: ['GET http://127.0.0.1:4567/search?q=<script>alert(1)</script>', 'observe the alert dialog']
  };

  it('confirms a well-evidenced finding', () => {
    const r = reviewFinding(solidXss);
    assert.equal(r.verdict, 'confirmed');
    assert.ok(r.checks.every((c) => c.pass));
  });

  it('flags a finding with no evidence as likely false positive', () => {
    const r = reviewFinding({ type: 'sqli', confidence: 'confirmed', url: 'http://x/' });
    assert.equal(r.verdict, 'likely_false_positive');
    assert.ok(r.reasons.length > 0);
  });

  it('sends mismatched confidence back for retest', () => {
    const r = reviewFinding({
      type: 'xss_reflected', confidence: 'confirmed', url: 'http://x/',
      evidence: 'Scanner heuristic matched the string "error" on the page — payload was HTML-encoded in the response.',
      reproductionSteps: ['GET http://x/search?q=test']
    });
    assert.equal(r.verdict, 'needs_retest');
    assert.ok(r.checks.some((c) => c.name.startsWith('type-proof') && !c.pass));
  });

  it('confirms SQLi only on a differential or error evidence', () => {
    const ok = reviewFinding({
      type: 'sqli', confidence: 'high', url: 'http://127.0.0.1:4567/user?id=1',
      evidence: 'TRUE payload returned the user row; FALSE payload returned "User not found" — boolean differential confirmed.',
      reproductionSteps: ['GET /user?id=1%27+AND+%271%27%3D%271', 'GET /user?id=1%27+AND+%271%27%3D%272']
    });
    assert.equal(ok.verdict, 'confirmed');
  });

  it('splits a mixed list into confirmed / retest / false-positive buckets', () => {
    const { confirmed, needsRetest, falsePositives } = reviewFindings([
      solidXss,
      { type: 'sqli', confidence: 'confirmed', url: 'http://x/' },
      { type: 'xss_reflected', confidence: 'confirmed', url: 'http://x/', evidence: 'Page contained the word "script" in a blog post.', reproductionSteps: ['GET http://x/'] }
    ]);
    assert.equal(confirmed.length, 1);
    assert.equal(falsePositives.length, 1);
    assert.equal(needsRetest.length, 1);
    assert.ok(confirmed[0].selfReview, 'enriched with the review');
  });
});

// ── X5: technical report carries triager assessment + fix code ─────────────

describe('X5 technical report: triager assessment + fix code', () => {
  it('embeds impact quantification and remediation code in the report', () => {
    const md = renderTechnicalReport({
      target: 'http://127.0.0.1:4567/',
      summary: 'Fixture hunt',
      findings: [{
        type: 'sqli', severity: 'high', confidence: 'high', title: 'SQL injection',
        url: 'http://127.0.0.1:4567/user?id=1', parameter: 'id',
        evidence: 'boolean differential', reproductionSteps: ['GET /user?id=1%27+AND+%271%27%3D%271']
      }]
    });
    assert.ok(md.includes('Triager assessment'), 'must include the triager assessment');
    assert.ok(/exploitability/i.test(md), 'must name exploitability');
    assert.ok(md.includes('Fix code (python)'), 'must include copy-paste fix code');
    assert.ok(/%s/.test(md), 'fix code must show parameterization');
  });
});
