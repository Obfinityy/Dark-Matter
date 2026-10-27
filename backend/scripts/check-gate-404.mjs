// Gate-404 regression check (27 Oct 2026, 404-verified audit).
//
// The live DVWA hunt h_830317bdc184 showed 10 "verified" findings
// that were 5 unique 404 pages counted twice (a finding record +
// a "PoC confirmed:" duplicate stamp). Every surface that counts
// verified findings must now: (1) demote stamps whose stored
// evidence is an HTTP error page, and (2) fold a "PoC confirmed:"
// stamp into its parent row instead of counting it twice.
//
// Run: node backend/scripts/check-gate-404.mjs   (exit 0 = all pass)
import { panelFindings, findingCounts, isErrorPageFinding, normTitle } from '../src/huntMemory.js';

// Real evidence excerpts from the live DVWA hunt (27 Oct 2026).
const APACHE_404 = 'HTTP/1.1 404 Not Found\r\nDate: Tue, 27 Oct 2026 15:28:22 GMT\r\nServer: Apache/2.4.25 (Debian)\r\nContent-Length: 306\r\nContent-Type: text/html; charset=iso-8859-1\r\n\r\n<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">';
const BODY_404 = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL /rest/admin/application-configuration was not found on this server.</p>';
const OK_200 = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"admin": true, "token": "abc"}';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// 1. Error-page detection on stored evidence.
check('404 header response is an error-page finding', isErrorPageFinding({ evidence: { response: APACHE_404 } }));
check('body-only 404 is an error-page finding', isErrorPageFinding({ evidence: { response: BODY_404 } }));
check('404 in poc_output is an error-page finding', isErrorPageFinding({ evidence: { poc_output: BODY_404 } }));
check('200 response is NOT an error-page finding', !isErrorPageFinding({ evidence: { response: OK_200 } }));
check('missing evidence is NOT an error-page finding', !isErrorPageFinding({}));

// 2. The PoC stamp folds into its parent title.
check(
  'normTitle strips the "PoC confirmed:" prefix',
  normTitle('PoC confirmed: admin panel unauthenticated disclosure') === normTitle('admin panel unauthenticated disclosure'),
);

// 3. The live hunt's shape, replayed: 5 unique 404s (one with its PoC
// duplicate) + 1 genuine verified + 1 unverified lead.
const findings = [
  { title: 'admin panel unauthenticated disclosure', severity: 'medium', verified: true, evidence: { response: APACHE_404 } },
  { title: 'PoC confirmed: admin panel unauthenticated disclosure', severity: 'medium', verified: true, evidence: { poc_output: BODY_404 } },
  { title: 'admin config variant sweep', severity: 'medium', verified: true, evidence: { response: APACHE_404 } },
  { title: 'encryption keys client disclosure', severity: 'medium', verified: true, evidence: { response: BODY_404 } },
  { title: 'admin application-version variant sweep', severity: 'medium', verified: true, evidence: { response: BODY_404 } },
  { title: 'admin security-config variant sweep', severity: 'medium', verified: true, evidence: { response: APACHE_404 } },
  { title: 'real sqli login bypass', severity: 'high', verified: true, evidence: { response: OK_200 } },
  { title: 'unverified xss probe', severity: 'low', verified: false, evidence: { response: OK_200 } },
];
const rows = panelFindings(findings);
const counts = findingCounts(findings);
check('panel folds the PoC duplicate into its parent (7 rows, not 8)', rows.length === 7, `got ${rows.length}`);
check('only the genuine finding counts as verified', counts.confirmed === 1, `got ${counts.confirmed}`);
check('the 5 error-page findings count as leads', counts.leads === 6, `got ${counts.leads}`);
check(
  'no error-page row is marked verified',
  rows.filter((r) => r.verified).every((r) => r.title === 'real sqli login bypass'),
);
check(
  'the admin panel row exists once, as a lead',
  rows.filter((r) => r.title.toLowerCase().includes('admin panel')).length === 1
    && rows.find((r) => r.title.toLowerCase().includes('admin panel')).verified === false,
);

console.log(failures === 0 ? '\nAll gate-404 checks passed.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
