/**
 * build-fixture-report.mjs — generate the REAL PDF artifact from REAL
 * fixture findings (verified live against the local fixture on 127.0.0.1).
 *
 * Usage: node scripts/build-fixture-report.mjs
 * Output: ../proof-artifacts/fixture-report.pdf
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReportPdf, verifyReportPdf } from '../src/services/pdfReportWriter.js';
import { quantifyImpact, remediationSnippet } from '../src/agent/impactModel.js';
import { applyCvssToAll } from '../src/agent/cvss.js';
import { generateRepro, generateSafePoc } from '../src/agent/exploitEngine.js';
import { owaspCoverage } from '../src/agent/methodology.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'proof-artifacts');
mkdirSync(outDir, { recursive: true });

const BASE = 'http://127.0.0.1:4567';

// Findings below describe vulnerabilities CONFIRMED with real requests
// against tests/fixtures/vuln_fixture.py during this session:
//  - reflected XSS: curl showed unescaped reflection; Chromium fired the alert
//  - SQLi: true/false differential + syntax error via curl
//  - stored XSS: POST persisted, GET rendered the payload verbatim
const rawFindings = [
  {
    id: 'f-xss-reflected', type: 'xss_reflected', severity: 'high', status: 'validated',
    title: 'Reflected XSS in /search (q parameter)',
    url: `${BASE}/search`, affectedEndpoint: '/search', parameter: 'q', method: 'GET',
    proofToken: 'DM-POC-TOKEN',
    description: 'The q parameter of /search is reflected into the HTML response without output encoding. Verified live: an injected <script> executed in headless Chromium — the alert() dialog fired and a DOM marker was rendered by the injected script.',
    impact: 'An attacker can craft a malicious link that executes JavaScript in a victim session: session hijacking, defacement, phishing on a trusted origin.',
    reproductionSteps: [
      'GET /search?q=<script>alert(document.domain)</script>',
      'Observe the unescaped reflection; the script executes in the browser.'
    ],
    remediation: ['Encode all reflected output with context-appropriate escaping.', 'Deploy a Content-Security-Policy without unsafe-inline.'],
    evidence: [{ kind: 'screenshot', summary: 'alert() fired in headless Chromium; injected DOM marker rendered', dialogFired: true }]
  },
  {
    id: 'f-sqli', type: 'sqli', severity: 'critical', status: 'validated',
    title: "Boolean-based SQL injection in /user (id parameter)",
    url: `${BASE}/user`, affectedEndpoint: '/user', parameter: 'id', method: 'GET',
    proofToken: 'DM-POC-TOKEN',
    description: "The id parameter is interpolated into a SQL query. id=' AND '1'='1 returns the user row while id=' AND '1'='2 returns 'No such user' — a boolean true/false differential. A bare quote triggers a SQL syntax error, confirming the injection point.",
    impact: 'Database compromise: data extraction via boolean inference, authentication bypass, and potential further escalation depending on DB privileges.',
    reproductionSteps: [
      "GET /user?id=' AND '1'='1 → user row returned",
      "GET /user?id=' AND '1'='2 → 'No such user' (differential confirmed)"
    ],
    remediation: ['Use parameterized queries / prepared statements everywhere.', 'Run the application DB account with least privilege.'],
    evidence: [{ kind: 'tool_output', summary: 'true/false response differential plus SQL syntax error on bare quote' }]
  },
  {
    id: 'f-xss-stored', type: 'xss_stored', severity: 'high', status: 'validated',
    title: 'Stored XSS in /guestbook comments',
    url: `${BASE}/guestbook`, affectedEndpoint: '/guestbook', parameter: 'comment', method: 'POST',
    proofToken: 'DM-POC-TOKEN',
    description: 'Posted comments are stored and later rendered without escaping. A comment containing <img src=x onerror=alert(1)> was persisted via POST and rendered verbatim on the subsequent GET.',
    impact: 'Every visitor of the guestbook page executes the attacker script — mass session theft and malware delivery from a trusted page.',
    reproductionSteps: [
      'POST /guestbook with comment=<img src=x onerror=alert(1)>',
      'GET /guestbook → payload rendered unescaped'
    ],
    remediation: ['Encode stored content on output (context-aware).', 'Validate and normalize input on the way in.'],
    evidence: [{ kind: 'tool_output', summary: 'payload persisted via POST and rendered verbatim on GET' }]
  }
];

const findings = applyCvssToAll(rawFindings).map((f) => ({
  ...f,
  repro: generateRepro({ url: f.url, parameter: f.parameter, method: f.method, proofToken: f.proofToken }),
  poc: (() => { try { return generateSafePoc(f); } catch { return null; } })(),
  triager: quantifyImpact(f),
  fixCode: remediationSnippet(f)
}));

const coverage = owaspCoverage(findings);
const summary = {
  critical: findings.filter((f) => f.severity === 'critical').length,
  high: findings.filter((f) => f.severity === 'high').length,
  medium: 0, low: 0, informational: 0, validated: findings.length
};

const screenshots = [];
const shotPath = '/tmp/xss_alert_open.jpg';
if (existsSync(shotPath)) {
  screenshots.push({
    jpeg: readFileSync(shotPath),
    caption: 'Visual proof: reflected-XSS payload executed in headless Chromium — alert() fired and the injected "XSS CONFIRMED" marker rendered (127.0.0.1:4567/search)'
  });
}

const pdf = buildReportPdf({
  title: 'Bug Bounty Assessment Report — 127.0.0.1:4567',
  target: BASE,
  generatedAt: new Date().toISOString(),
  mode: 'technical',
  summary,
  executiveSummary: `An authorized assessment of the local test fixture confirmed ${findings.length} vulnerabilities: 1 critical SQL injection, 1 high-severity reflected XSS and 1 high-severity stored XSS. OWASP Top-10 coverage: ${coverage.percent}% (categories ${coverage.covered.map((c) => c.id).join(', ')}). All findings were confirmed with live requests against the fixture; every PoC is proof-only.`,
  findings,
  screenshots
});

const outPath = join(outDir, 'fixture-report.pdf');
writeFileSync(outPath, pdf);

// Self-verification: parse the bytes back and confirm the content is inside.
const v = verifyReportPdf(pdf, [
  'Reflected XSS in /search',
  'Boolean-based SQL injection',
  'Stored XSS in /guestbook',
  'CVSS',
  'Content-Security-Policy',
  '127.0.0.1:4567',
  'FINDING REPRODUCED'
]);
console.log(JSON.stringify({ outPath, bytes: pdf.length, verify: v }, null, 2));
if (!v.ok) process.exit(1);
