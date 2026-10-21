// Regression test for the verifier label-trust re-fire (Lane A, 21 Oct 2026).
// Run: node backend/scripts/test-verifier-label-trust.mjs
//
// Root cause: on the first real target (Ezviz, https://open.ys7.com) the
// canary-controlled /ftp probe v3 ran CORRECTLY — every per-file verdict
// was "not exposed:" because the target returns HTTP 200 + the identical
// 43-byte login JSON for every /ftp/* path (a catch-all). The verifier
// still stamped verified:true (2026-10-20T13:23:12.720Z, episode #16010)
// because its signal extraction trusted the probe's own text:
//   - extractSignal matched 'dir-listing' in the probe's UNCONDITIONAL
//     echo banner ("--- /ftp/ directory listing ---", verbatim in the
//     command) — and the reproducibility re-run reproduced the banner,
//     so sig1 === sig2 "confirmed" it;
//   - payload_validation's bare regex matched 'exposed' inside the
//     negated "not exposed:" verdict lines.
// The fix derives every verify-path signal from evidenceSignalIds
// (differential.js): lines that are neither negated before the match nor
// the probe's own framing (verbatim in the executed command). The v1/v2
// status-only premise detIds are additionally RETIRED in assessResult
// (their labels were conditional on a check the verifier cannot see, so
// that family is gated by detector version, not by text).
//
// Fixtures are the REAL command/output pairs from production episodes
// #16010 (the re-fire) and #15923 (the original v2 stamp), plus the
// genuine lab shape of the same v3 probe.
import fs from 'node:fs';
import {
  evidenceSignalIds,
  supportingSignalLines,
  assessContentRelevance,
  verifyPipeline,
  executionFailed,
  scoreWeirdness,
} from '../src/hunt-intel/index.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- The re-fire: v3 probe on the Ezviz catch-all (episode #16010) --------
const EZVIZ_CMD = `{ echo '--- /ftp/ directory listing ---'; curl -sk "https://open.ys7.com/ftp/"|grep -o 'href="[^"]*"'; C=$(curl -sk "https://open.ys7.com/ftp/zz-canary-9x7"); for f in incident-support.kdbx eastere.gg encrypt.pyc package.json.bak coupons_2013.md.bak suspicious_errors.yml; do S=$(curl -sk -o /tmp/dmfb -w "%{http_code}" "https://open.ys7.com/ftp/$f"); B=$(cat /tmp/dmfb); if [ "$S" = 200 ] && [ -n "$B" ] && [ "$B" != "$C" ]; then echo "EXPOSED: $f WITHOUT authentication (real content, differs from not-found control)"; else echo "not exposed: $f"; fi; done; }`;
const EZVIZ_OUT = `--- /ftp/ directory listing ---
not exposed: incident-support.kdbx
not exposed: eastere.gg
not exposed: encrypt.pyc
not exposed: package.json.bak
not exposed: coupons_2013.md.bak
not exposed: suspicious_errors.yml
`;

check('re-fire fixture: without framing exclusion the banner still supplies dir-listing (the old trap)',
  eq(evidenceSignalIds(EZVIZ_OUT), ['dir-listing']));
check('re-fire fixture: evidence signals are EMPTY once the probe framing is excluded',
  eq(evidenceSignalIds(EZVIZ_OUT, EZVIZ_CMD), []));
check('re-fire fixture: no supporting evidence lines (banner framing, verdicts negated)',
  supportingSignalLines(EZVIZ_OUT, { excludeText: EZVIZ_CMD }).length === 0);

// Compose the assessResult verify path exactly as huntAgent.js does:
// execution gate → evidence-signal confirmation (sig1 === sig2 across a
// deterministic re-run) → verifyPipeline → (relevance only if verified).
function assessOutcome({ command, output, confirmOutput }) {
  if (executionFailed({ code: 0 }, output)) return { verified: false, at: 'execution' };
  const weird = scoreWeirdness(
    { status: 200, bodyLength: output.length, timeMs: 1000, body: output },
    { status: 200, bodyLength: 2000, timeMs: 500 }
  );
  const sigs = evidenceSignalIds(output, command).join(',');
  const sig1 = evidenceSignalIds(output, command).join(',');
  const sig2 = evidenceSignalIds(confirmOutput, command).join(',');
  const confirmed = sig1.length > 0 && sig1 === sig2;
  const v = verifyPipeline({
    reachability: output.length > 50,
    payload_validation: supportingSignalLines(output, { excludeText: command }).length > 0
      || /vulnerable|bypass|injection|leak/i.test(output),
    impact_assessment: weird.score >= 40 || sigs.length > 0 || /vulnerable|bypass|injection|leak/i.test(output),
    exploit_confirmation: confirmed,
  });
  return { verified: v.verified, at: v.failedAt, confirmed };
}

const refire = assessOutcome({ command: EZVIZ_CMD, output: EZVIZ_OUT, confirmOutput: EZVIZ_OUT });
check('re-fire fixture: deterministic re-run does NOT confirm (no evidence signal to reproduce)',
  refire.confirmed === false);
check('re-fire fixture: verify pipeline refuses the stamp', refire.verified === false);

// --- The genuine class: same v3 probe on the lab (canary passes) ----------
const LAB_CMD = EZVIZ_CMD.replaceAll('https://open.ys7.com', 'http://172.17.0.1:3000');
const LAB_OUT = `--- /ftp/ directory listing ---
EXPOSED: incident-support.kdbx WITHOUT authentication (real content, differs from not-found control)
not exposed: eastere.gg
not exposed: encrypt.pyc
not exposed: package.json.bak
not exposed: coupons_2013.md.bak
not exposed: suspicious_errors.yml
`;
check('genuine lab fixture: the conditional EXPOSED label is an evidence signal (keyword)',
  eq(evidenceSignalIds(LAB_OUT, LAB_CMD), ['keyword']));
const genuine = assessOutcome({ command: LAB_CMD, output: LAB_OUT, confirmOutput: LAB_OUT });
check('genuine lab fixture: re-run confirms and the pipeline verifies', genuine.verified === true);
const labRel = assessContentRelevance({
  command: LAB_CMD,
  target: 'http://172.17.0.1:3000',
  output: LAB_OUT,
  baselines: ['<html><head><title>Juice Shop</title></head><body>Loading application</body></html>'],
});
check('genuine lab fixture: content-relevance still passes', labRel.relevant === true);

// --- The original stamp: v2 status-only premise (episode #15923) ----------
// Its EXPOSED labels were conditional on a status+size check inside the
// probe, so text-level gates cannot see the flaw — this family is blocked
// by the RETIRED_DET_IDS version gate in assessResult. Pin the gate's
// presence so it cannot be removed silently.
const huntAgentSrc = fs.readFileSync(new URL('../src/huntAgent.js', import.meta.url), 'utf8');
check('v2 family: RETIRED_DET_IDS contains both superseded detIds',
  huntAgentSrc.includes("'ftp-kdbx-exposure'") && huntAgentSrc.includes("'ftp-kdbx-exposure-v2'"));
check('v2 family: assessResult consults RETIRED_DET_IDS',
  /RETIRED_DET_IDS\.has\(plan\.detId\)/.test(huntAgentSrc));

// --- Genuine classes keep their evidence signals ---------------------------
const SQLI_CMD = `curl -sk -X POST "http://172.17.0.1:3000/rest/user/login" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op' OR 1=1--","password":"x"}'`;
const SQLI_OUT = `{"authentication":{"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdGF0dXMiOiJzdWNjZXNzIn0","user":{"email":"admin@juice-sh.op"}}}`;
check('genuine SQLi: JWT/admin response body is an evidence signal',
  evidenceSignalIds(SQLI_OUT, SQLI_CMD).includes('admin-exposure'));
const XXE_OUT = 'XXE VULNERABLE: external entity resolved - /etc/passwd disclosed (root:x:0:0) EXPOSED in error response WITHOUT authentication';
check('genuine XXE: passwd content is an evidence signal (trailing WITHOUT does not negate)',
  evidenceSignalIds(XXE_OUT, 'curl -sk -X POST -F "file=@/tmp/xe.xml" "http://172.17.0.1:3000/file-upload"').includes('cmd-exec'));

// --- supportingSignalLines stays backward compatible -----------------------
check('supportingSignalLines without excludeText unchanged (banner counts, legacy callers)',
  supportingSignalLines(EZVIZ_OUT).some((s) => s.signal === 'dir-listing'));
check('short lines are never treated as framing',
  supportingSignalLines('admin', { excludeText: 'curl http://172.17.0.1:3000/admin' }).length === 1);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
