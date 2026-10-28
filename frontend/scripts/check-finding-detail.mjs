// Finding-detail logic test (28 Oct 2026) — no test framework in
// the frontend, so this is a dependency-free node guard, in the same
// pattern as scripts/check-be-a-brain.mjs.
//
// What it covers (real, executed):
//   1. The new api.js call (getFindingDetail) hits the contract
//      path/method against a MOCKED fetch — encodeURIComponent on
//      the title, the verified-XSS shape, the under-investigation
//      shape, and the 404 unknown_finding case.
//   2. The pure helpers in src/lib/findingDetail.js (imported for
//      real): evidence rendering (object/string/missing), the
//      reproduction command, the recorded timestamp, the status line.
//   3. Source-level wiring checks: HuntCard rows are buttons that
//      open the modal for both lists, FindingDetail is imported and
//      mounted with a close path, the modal closes via button /
//      Escape / backdrop, and no hunt-state mutation exists in the
//      new code.
//
// What it does NOT cover (stated honestly):
//   - No browser/DOM render: it cannot prove the modal paints or
//     that a click reaches the handler. That needs a live browser
//     against the real backend.
//   - No live backend: the contract shapes are the ones in the lane
//     brief; if the backend worker lands different shapes, the
//     mocked responses here will not catch it — only a live run will.
//
// Run: node scripts/check-finding-detail.mjs   (exit 0 = all checks pass)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, '..', 'src');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// ---------------------------------------------------------------------------
// Fixtures — the contract shapes from the lane brief.
// ---------------------------------------------------------------------------
const XSS_TITLE = 'Reflected XSS in /vulnerabilities/xss_r name parameter';
const MOCK_VERIFIED = {
  ok: true,
  huntId: 'h_test',
  finding: {
    title: XSS_TITLE,
    severity: 'high',
    verified: true,
    verification: 'confirmed (all 4 steps passed)',
    detail: 'Reflected XSS via the name parameter on /vulnerabilities/xss_r.',
    evidence: {
      request: 'python3 /opt/hunt/parent_brain_xss.py PBRN7719',
      response: 'xss_r 200 len 4388\nRAW marker present: True | script tag present: True\nREFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert(1)</sCrIpT></pre>',
    },
    stamps: {},
    at: '2026-10-28T09:36:00.000Z',
    firstSeen: '2026-10-28T09:30:00.000Z',
    lastSeen: '2026-10-28T09:36:00.000Z',
  },
};
const LEAD_TITLE = 'Possible SQL injection in the login form';
const MOCK_LEAD = {
  ok: true,
  huntId: 'h_test',
  finding: {
    title: LEAD_TITLE,
    severity: 'medium',
    verified: false,
    verification: 'probe sent, awaiting reproduction',
    detail: 'Login error message changes with a quote character.',
    evidence: null,
    stamps: {},
    at: null,
    firstSeen: '2026-10-28T10:05:00.000Z',
    lastSeen: '2026-10-28T10:05:00.000Z',
  },
};

// ---------------------------------------------------------------------------
// 1. api.js against a mocked fetch (the real request() wrapper runs).
// ---------------------------------------------------------------------------
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : undefined });
  const path = String(url).replace(/^https?:\/\/[^/]+/, '');
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const prefix = '/api/v1/hunts/h_test/findings/';
  if (path.startsWith(prefix)) {
    const title = decodeURIComponent(path.slice(prefix.length));
    if (title === XSS_TITLE) return json(200, MOCK_VERIFIED);
    if (title === LEAD_TITLE) return json(200, MOCK_LEAD);
    return json(404, { ok: false, error: 'unknown_finding' });
  }
  return json(404, { ok: false, error: 'not_found' });
};

const api = await (async () => {
  // Node ESM (unlike Vite) will not resolve api.js's extensionless
  // `from '../config'` — rewrite that one import to the absolute
  // file URL and load the module from a data: URL. The code under
  // test is api.js itself, byte-for-byte apart from that import.
  const apiSrcRaw = readFileSync(join(srcDir, 'lib', 'api.js'), 'utf8');
  const configUrl = new URL(`file://${join(srcDir, 'config.js')}`).href;
  const rewritten = apiSrcRaw.replace(
    /from '\.\.\/config'/,
    `from '${configUrl}'`,
  );
  if (rewritten === apiSrcRaw) throw new Error('api.js config import not found to rewrite');
  return import(`data:text/javascript;base64,${Buffer.from(rewritten).toString('base64')}`);
})();

// Verified XSS: full shape survives the envelope.
let r = await api.getFindingDetail('h_test', XSS_TITLE);
check('GET finding detail (verified XSS) → finding with title/severity/verified',
  r.ok && r.data.finding.title === XSS_TITLE && r.data.finding.severity === 'high'
  && r.data.finding.verified === true && r.data.finding.verification === 'confirmed (all 4 steps passed)',
  JSON.stringify(r.data && r.data.finding && r.data.finding.title));
check('verified XSS evidence carries request + reflected response',
  r.ok && r.data.finding.evidence.request === 'python3 /opt/hunt/parent_brain_xss.py PBRN7719'
  && r.data.finding.evidence.response.includes('RAW marker present: True')
  && r.data.finding.evidence.response.includes('PBRN7719'));
check('finding detail path encodes the title (spaces + slashes)',
  calls[0].method === 'GET'
  && calls[0].url.endsWith(`/api/v1/hunts/h_test/findings/${encodeURIComponent(XSS_TITLE)}`)
  && calls[0].url.includes('%2Fvulnerabilities%2F') && calls[0].url.includes('%20'));

// Under-investigation lead: verified false, no evidence, timestamps kept.
r = await api.getFindingDetail('h_test', LEAD_TITLE);
check('GET finding detail (lead) → verified false, evidence null, firstSeen kept',
  r.ok && r.data.finding.verified === false && r.data.finding.evidence === null
  && r.data.finding.firstSeen === '2026-10-28T10:05:00.000Z');

// Unknown title: clean 404 {ok:false, error:'unknown_finding'} — not a crash.
r = await api.getFindingDetail('h_test', 'No such finding');
check('GET finding detail (unknown) → ok:false, 404, error unknown_finding',
  !r.ok && r.status === 404 && r.error === 'unknown_finding', `error=${r.error}`);

// ---------------------------------------------------------------------------
// 2. Pure helpers in src/lib/findingDetail.js (imported for real).
// ---------------------------------------------------------------------------
const fd = await import(join(srcDir, 'lib', 'findingDetail.js'));
const f = MOCK_VERIFIED.finding;
const lead = MOCK_LEAD.finding;

check('evidenceText renders object evidence as key: value lines',
  fd.evidenceText(f.evidence).includes('request: python3 /opt/hunt/parent_brain_xss.py PBRN7719')
  && fd.evidenceText(f.evidence).includes('REFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert(1)</sCrIpT></pre>'));
check('evidenceText keeps the payload as plain text (no execution, no stripping)',
  fd.evidenceText(f.evidence).includes('<sCrIpT>alert(1)</sCrIpT>'));
check('evidenceText passes a string through as-is',
  fd.evidenceText('raw evidence here') === 'raw evidence here');
check('evidenceText returns empty for null / undefined / {} evidence',
  fd.evidenceText(null) === '' && fd.evidenceText(undefined) === '' && fd.evidenceText({}) === '');
check('reproductionCommand is evidence.request for the verified XSS',
  fd.reproductionCommand(f) === 'python3 /opt/hunt/parent_brain_xss.py PBRN7719');
check('reproductionCommand is empty when there is no evidence',
  fd.reproductionCommand(lead) === '' && fd.reproductionCommand({}) === '');
check('findingRecordedAt prefers at over firstSeen/lastSeen',
  fd.findingRecordedAt(f) === '2026-10-28T09:36:00.000Z');
check('findingRecordedAt falls back to firstSeen when at is missing',
  fd.findingRecordedAt(lead) === '2026-10-28T10:05:00.000Z');
check('findingRecordedAt is empty when nothing was recorded',
  fd.findingRecordedAt({}) === '' && fd.findingRecordedAt(null) === '');
check('formatRecordedAt renders a real timestamp',
  fd.formatRecordedAt('2026-10-28T09:36:00.000Z').includes('2026'));
check('formatRecordedAt says "Not yet available" for a missing timestamp',
  fd.formatRecordedAt('') === 'Not yet available' && fd.formatRecordedAt(null) === 'Not yet available');
check('findingStatus verified → "✓ verified" + the verification note',
  fd.findingStatus(f).label === '✓ verified' && fd.findingStatus(f).note === 'confirmed (all 4 steps passed)');
check('findingStatus unverified → "under investigation"',
  fd.findingStatus(lead).label === 'under investigation');

// ---------------------------------------------------------------------------
// 3. Source-level wiring checks (component + card + CSS).
// ---------------------------------------------------------------------------
const detailSrc = readFileSync(join(srcDir, 'components', 'FindingDetail.jsx'), 'utf8');
const cardSrc = readFileSync(join(srcDir, 'components', 'HuntCard.jsx'), 'utf8');
const apiSrc = readFileSync(join(srcDir, 'lib', 'api.js'), 'utf8');
const cssSrc = readFileSync(join(srcDir, 'index.css'), 'utf8');

check('api.js exports getFindingDetail',
  /export async function getFindingDetail\(huntId, title\)/.test(apiSrc));
check('api.js getFindingDetail encodes the title and hits /findings/',
  /\/findings\/\$\{encodeURIComponent\(title\)\}/.test(apiSrc));
check('FindingDetail fetches its own detail via getFindingDetail',
  /getFindingDetail\(huntId, title\)/.test(detailSrc));
check('FindingDetail shows a loading state',
  /Loading finding detail…/.test(detailSrc));
check('FindingDetail reports a 404 as "Finding not found"',
  /status === 404/.test(detailSrc) && /Finding not found/.test(detailSrc));
check('FindingDetail renders evidence as safe text in a <pre>',
  /<pre className="finding-detail-evidence">\{evidence\}<\/pre>/.test(detailSrc));
check('FindingDetail falls back to "Evidence not yet available"',
  /EVIDENCE_MISSING/.test(detailSrc) && /Evidence not yet available/.test(readFileSync(join(srcDir, 'lib', 'findingDetail.js'), 'utf8')));
check('FindingDetail falls back to "Not yet available" for repro / recorded',
  /REPRO_MISSING/.test(detailSrc) && /formatRecordedAt\(recorded\)/.test(detailSrc));
check('FindingDetail closes via an explicit Close button',
  />\s*Close\s*<\/button>/.test(detailSrc) && /onClose && onClose\(\)/.test(detailSrc));
check('FindingDetail closes on Escape',
  /e\.key === 'Escape'/.test(detailSrc) && /addEventListener\('keydown'/.test(detailSrc));
check('FindingDetail closes on backdrop click, panel clicks do not close',
  /className="finding-detail-overlay"[\s\S]*?onClick=\{\(\) => onClose && onClose\(\)\}/.test(detailSrc)
  && /stopPropagation/.test(detailSrc));
check('FindingDetail renders the verification note for a verified finding',
  /finding-detail-verification/.test(detailSrc) && /status\.note/.test(detailSrc));
check('No hunt-state mutation in the new code',
  !/pauseHunt|resumeHunt|stopHunt|setHuntBudget|setHuntBrain|startHunt/.test(detailSrc));
check('HuntCard imports FindingDetail',
  /import FindingDetail from '.\/FindingDetail'/.test(cardSrc));
check('HuntCard verified rows are buttons opening the modal',
  cardSrc.includes("finding finding-row ${SEVERITY_CLASS[f.severity]")
  && /onClick=\{\(\) => setSelectedFindingTitle\(f\.title\)\}/.test(cardSrc));
check('HuntCard lead rows are buttons opening the modal too',
  cardSrc.includes('finding finding-row finding-lead'));
check('HuntCard rows show a "View detail →" hint',
  /View detail →/.test(cardSrc));
check('HuntCard mounts FindingDetail with a close path back to the list',
  /<FindingDetail/.test(cardSrc) && /onClose=\{\(\) => setSelectedFindingTitle\(null\)\}/.test(cardSrc));
check('HuntCard findings fetching is unchanged (getHuntEvents)',
  /getHuntEvents\(hunt\.huntId, 200\)/.test(cardSrc));
check('CSS: clickable rows — pointer cursor, hover, focus outline',
  /\.finding-row \{[\s\S]*?cursor: pointer;/.test(cssSrc)
  && /\.finding-row:hover \{ background: var\(--dm-surface\); \}/.test(cssSrc)
  && /\.finding-row:focus-visible \{ outline: 2px solid var\(--dm-blue\);/.test(cssSrc));
check('CSS: detail modal overlay + panel + wrapping evidence <pre>',
  /\.finding-detail-overlay \{/.test(cssSrc) && /\.finding-detail-panel \{/.test(cssSrc)
  && /\.finding-detail-evidence \{[\s\S]*?white-space: pre-wrap;/.test(cssSrc));

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll finding-detail checks passed.');
