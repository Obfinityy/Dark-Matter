/**
 * findingReview.js — false-positive self-review pass.
 *
 * Before a finding reaches a report, the agent re-checks its own work:
 *   1. Is there actual evidence attached (not just a hypothesis)?
 *   2. Are the reproduction steps concrete (endpoint + parameter, not vague)?
 *   3. Does the confidence match the evidence (confirmed ⇒ real proof)?
 *   4. Type-specific proof requirements (reflection for XSS, differential
 *      for SQLi, cross-account 200 for IDOR, …).
 *
 * Verdicts: 'confirmed' (ship it) | 'needs_retest' (more evidence required)
 * | 'likely_false_positive' (do not report as a vulnerability).
 *
 * This is deterministic and evidence-driven — it never invents proof, it
 * only grades what is already attached to the finding.
 */

const TYPE_PROOF = {
  xss_reflected: {
    needs: [
      'reflection of the payload in the response',
      'script execution (dialog fired or DOM marker)',
    ],
    test: ev => /<script|onerror=|alert\(|dialogFired|reflect/i.test(ev),
  },
  xss_stored: {
    needs: ['payload persisted', 'payload rendered on a later load'],
    test: ev => /persist|stored|rendered|later/i.test(ev),
  },
  xss_dom: {
    needs: [
      'identified source (URL fragment, postMessage, …)',
      'identified sink (innerHTML, eval, …)',
    ],
    test: ev => /sink|source|innerHTML|location\.hash|postMessage/i.test(ev),
  },
  xss: {
    needs: ['reflection of the payload in the response'],
    test: ev => /<script|onerror=|alert\(|dialogFired|reflect/i.test(ev),
  },
  sqli: {
    needs: ['boolean/time differential or a database error message'],
    test: ev => /differential|syntax error|sleep|SLEEP|different/i.test(ev),
  },
  sql_injection: {
    needs: ['boolean/time differential or a database error message'],
    test: ev => /differential|syntax error|sleep|SLEEP|different/i.test(ev),
  },
  ssrf: {
    needs: ['canary URL fetched by the server, or internal response reflected'],
    test: ev => /canary|fetched|169\.254|internal/i.test(ev),
  },
  idor: {
    needs: ["200 on another (test) account's resource with the first account's token"],
    test: ev => /200|other.*account|cross-account/i.test(ev),
  },
  broken_access_control: {
    needs: ['unauthorized access demonstrated with test accounts'],
    test: ev => /200|unauthorized|access/i.test(ev),
  },
  lfi: {
    needs: ['traversal marker read from a non-sensitive file'],
    test: ev => /\.\.\/|traversal|marker/i.test(ev),
  },
  path_traversal: {
    needs: ['traversal marker read from a non-sensitive file'],
    test: ev => /\.\.\/|traversal|marker/i.test(ev),
  },
  'path-traversal': {
    needs: ['traversal marker read from a non-sensitive file'],
    test: ev => /\.\.\/|traversal|marker/i.test(ev),
  },
  command_injection: {
    needs: ['timing differential from the sleep canary, or command output reflected'],
    test: ev => /sleep|timing|delay|canary/i.test(ev),
  },
  rce: {
    needs: ['timing differential from the sleep canary, or command output reflected'],
    test: ev => /sleep|timing|delay|canary/i.test(ev),
  },
  csrf: {
    needs: ['state-changing request succeeded without a token'],
    test: ev => /without.*token|no.*token|succeeded/i.test(ev),
  },
  open_redirect: {
    needs: ['Location header pointing at the attacker domain'],
    test: ev => /redirect|location|evil\.example/i.test(ev),
  },
  xxe: {
    needs: ['defined entity resolved in the response'],
    test: ev => /DM-XXE-PROOF|entity|ENTITY/i.test(ev),
  },
  ssti: {
    needs: ['template arithmetic evaluated (e.g. 7*7 → 49)'],
    test: ev => /49|evaluated|\{\{/i.test(ev),
  },
  template_injection: {
    needs: ['template arithmetic evaluated (e.g. 7*7 → 49)'],
    test: ev => /49|evaluated|\{\{/i.test(ev),
  },
};

function typeKey(finding) {
  const type = String(finding?.type || finding?.vulnType || '')
    .toLowerCase()
    .trim();
  return Object.keys(TYPE_PROOF).find(k => type === k || type.includes(k)) || null;
}

function evidenceText(finding) {
  const parts = [];
  if (typeof finding.evidence === 'string') parts.push(finding.evidence);
  if (Array.isArray(finding.evidence)) {
    for (const e of finding.evidence) {
      parts.push(typeof e === 'string' ? e : JSON.stringify(e));
    }
  }
  if (finding.observedBehavior) parts.push(finding.observedBehavior);
  if (finding.proofNote) parts.push(finding.proofNote);
  return parts.join('\n');
}

/**
 * Self-review one finding.
 * @returns {{ verdict: 'confirmed'|'needs_retest'|'likely_false_positive', checks: Array<{name, pass, detail}>, reasons: string[] }}
 */
export function reviewFinding(finding = {}) {
  const checks = [];
  const reasons = [];
  const evText = evidenceText(finding);
  const key = typeKey(finding);

  // 1. Evidence attached?
  const hasEvidence = evText.trim().length > 20;
  checks.push({
    name: 'evidence-attached',
    pass: hasEvidence,
    detail: hasEvidence ? `${evText.trim().length} chars of evidence` : 'no evidence text attached',
  });
  if (!hasEvidence)
    reasons.push(
      'No evidence attached — a finding without evidence is a hypothesis, not a vulnerability.'
    );

  // 2. Reproduction steps concrete?
  const steps = Array.isArray(finding.reproductionSteps) ? finding.reproductionSteps : [];
  const concreteSteps = steps.filter(s => /(GET|POST|PUT|DELETE|PATCH|http|\/)/i.test(String(s)));
  const stepsOk = concreteSteps.length > 0;
  checks.push({
    name: 'reproduction-concrete',
    pass: stepsOk,
    detail: stepsOk
      ? `${concreteSteps.length} concrete step(s)`
      : 'reproduction steps are missing or vague',
  });
  if (!stepsOk)
    reasons.push('Reproduction steps are missing or vague — a triager cannot replay this.');

  // 3. Confidence/evidence consistency.
  const confidence = String(finding.confidence || '').toLowerCase();
  const confidenceOk = confidence !== 'confirmed' || hasEvidence;
  checks.push({
    name: 'confidence-consistent',
    pass: confidenceOk,
    detail: confidence ? `confidence=${confidence}` : 'no confidence recorded',
  });
  if (!confidenceOk)
    reasons.push("Marked 'confirmed' but no evidence is attached — downgrade to needs_retest.");

  // 4. Type-specific proof requirement.
  let typeOk = true;
  if (key) {
    typeOk = TYPE_PROOF[key].test(evText);
    checks.push({
      name: `type-proof:${key}`,
      pass: typeOk,
      detail: typeOk
        ? 'type-specific proof present'
        : `missing: ${TYPE_PROOF[key].needs.join('; ')}`,
    });
    if (!typeOk)
      reasons.push(
        `Type-specific proof missing for ${key}: needs ${TYPE_PROOF[key].needs.join('; ')}.`
      );
  } else {
    checks.push({
      name: 'type-proof:unknown',
      pass: true,
      detail: 'no proof model for this type — manual review',
    });
  }

  const failed = checks.filter(c => !c.pass);
  let verdict = 'confirmed';
  if (failed.length >= 3 || (!hasEvidence && !stepsOk)) {
    verdict = 'likely_false_positive';
  } else if (failed.length > 0) {
    verdict = 'needs_retest';
  }

  return { verdict, checks, reasons };
}

/**
 * Review a whole finding list; returns { confirmed, needsRetest, falsePositives }.
 * The report pipeline should only ship `confirmed`.
 */
export function reviewFindings(findings = []) {
  const out = { confirmed: [], needsRetest: [], falsePositives: [] };
  for (const finding of findings) {
    const review = reviewFinding(finding);
    const enriched = { ...finding, selfReview: review };
    if (review.verdict === 'confirmed') out.confirmed.push(enriched);
    else if (review.verdict === 'needs_retest') out.needsRetest.push(enriched);
    else out.falsePositives.push(enriched);
  }
  return out;
}
