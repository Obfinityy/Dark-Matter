// Dark Matter rule-based scanner — differential verification.
// Every probe runs its own malicious-vs-benign control and records the
// control flags inside finding.evidence; assessConfirmation from hunt-intel
// judges them. Only 'confirmed' findings are reported — the 100% truth rule.
import {
  assessConfirmation,
  dedupeFindings,
  evidenceGate,
} from '../hunt-intel/differential.js';

export function verifyFindings(findings) {
  const list = Array.isArray(findings) ? findings : [];
  const assessed = [];
  for (const f of list) {
    let gate;
    try {
      gate = evidenceGate(f);
    } catch {
      continue;
    }
    if (!gate.pass) {
      assessed.push({
        ...gate.gated,
        confirmation: 'unconfirmed',
        confirmationProtocol: null,
      });
      continue;
    }
    let verdict = 'unconfirmed';
    let protocol = null;
    try {
      const r = assessConfirmation(gate.gated, {});
      verdict = r.verdict;
      protocol = r.protocol;
    } catch {
      verdict = 'unconfirmed';
    }
    assessed.push({ ...gate.gated, confirmation: verdict, confirmationProtocol: protocol });
  }
  const confirmed = assessed.filter((f) => f.confirmation === 'confirmed');
  const unconfirmed = assessed.filter((f) => f.confirmation !== 'confirmed');
  return { confirmed: dedupeFindings(confirmed), unconfirmed };
}
