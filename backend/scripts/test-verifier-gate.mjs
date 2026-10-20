// Synthetic regression test for the solver #442 verifier false-accept fix.
// Run: node backend/scripts/test-verifier-gate.mjs
//
// Background: 45 settled false-accepts on benchmark hunt h_bench_d69e5746
// were stamped verified / "confirmed (all 4 steps passed)" although the
// executed probe command had FAILED — its output was the exec layer's error
// echo ("Command failed: docker exec … sh -c <cmd>"), and the signal
// extractor derived 'admin-exposure' from the probe URL inside that echo.
// This test proves: (1) the old step-derivation verifies such evidence,
// (2) the new executionFailed() gate blocks it, (3) genuine evidence shapes
// (the 3 real classes) still pass the gate, (4) verifyPipeline itself is
// unchanged (all-true verifies, any-false rejects).
import { executionFailed, verifyPipeline } from '../src/hunt-intel/differential.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// The one extractSignal rule that drove the false-accepts (huntAgent.js):
// /admin|administrator|dashboard/i -> 'admin-exposure'. Replicated here to
// reconstruct the OLD step derivation faithfully.
const oldSignal = (out) => (/admin|administrator|dashboard/i.test(out) ? 'admin-exposure' : '');
function oldSteps(output, confirmOutput) {
  const sig1 = oldSignal(output);
  const sig2 = oldSignal(confirmOutput);
  return {
    reachability: output.length > 50,
    payload_validation: /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output),
    impact_assessment: sig1.length > 0,
    exploit_confirmation: sig1.length > 0 && sig1 === sig2,
  };
}

// --- Case 1: finding #231's real evidence shape (failed docker exec) -------
const failEcho = "\nCommand failed: docker exec dm-hunt-h_bench_d69e5746 sh -c curl -I -s -X OPTIONS http://172.17.0.1:3000/admin | grep -E '^[0-9]{3}$'\n";
const failResult = { stdout: '', stderr: failEcho, code: 1 };
const failOutput = failResult.stdout + '\n' + failResult.stderr;
check('OLD pipeline verifies the failed-command echo (bug reproduced)',
  verifyPipeline(oldSteps(failOutput, failOutput)).verified === true);
check('NEW gate blocks the failed-command echo',
  executionFailed(failResult, failOutput) === true);

// --- Case 2: curl connection failure, code present, marker in stderr only --
check('NEW gate blocks curl exit 7 (connection refused, "000" output)',
  executionFailed({ stdout: '000\n', stderr: 'Command failed: docker exec x sh -c curl http://h:8080/admin', code: 7 }, '000\n') === true);

// --- Case 3: placeholder-host DNS failure ----------------------------------
check('NEW gate blocks DNS-failure run (exit 6)',
  executionFailed({ stdout: 'Time taken: 0.153943 seconds', stderr: 'Command failed: docker exec x sh -c curl https://target-app/admin', code: 6 }, 'Time taken: 0.153943 seconds') === true);

// --- Case 4: marker survives even if the exit code is lost ------------------
check('NEW gate blocks on failure marker alone (code unknown)',
  executionFailed({ stdout: failEcho, stderr: '' }, failEcho) === true);
check('NEW gate blocks container-missing result',
  executionFailed({ stdout: '', stderr: 'DM_CONTAINER_MISSING: hunt container not running', code: 127 }, 'DM_CONTAINER_MISSING') === true);

// --- Case 5: genuine evidence shapes are NOT blocked ------------------------
// SQLi auth bypass (class 1): clean 200 JSON with admin token, exit 0.
check('Gate passes genuine SQLi evidence (exit 0)',
  executionFailed({ stdout: '{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGF0dXMiOiJzdWNjZXNzIn0.signature","authentication":{"email":"admin@juice-sh.op"}}', stderr: '', code: 0 }, '{"token":"eyJ..."}') === false);
// XXE file disclosure (class 3): /etc/passwd content, exit 0.
check('Gate passes genuine XXE evidence (exit 0)',
  executionFailed({ stdout: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin', stderr: '', code: 0 }, 'root:x:0:0:root:/root:/bin/bash') === false);
// KDBX exposure (class 2): binary download, exit 0.
check('Gate passes genuine KDBX download (exit 0)',
  executionFailed({ stdout: '<binary kdbx bytes>', stderr: '', code: 0 }, '<binary kdbx bytes>') === false);

// --- Case 6: verifyPipeline semantics unchanged -----------------------------
check('verifyPipeline: all steps true -> verified',
  verifyPipeline({ reachability: true, payload_validation: true, impact_assessment: true, exploit_confirmation: true }).verified === true);
check('verifyPipeline: any step false -> rejected',
  verifyPipeline({ reachability: true, payload_validation: true, impact_assessment: true, exploit_confirmation: false }).verified === false);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
