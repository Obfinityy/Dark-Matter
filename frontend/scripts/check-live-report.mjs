// Live-report regression check (27 Oct 2026) — no test framework in
// the frontend, so this is a dependency-free node guard over
// HuntCard.jsx + ReportsPage.jsx + ChatThread.jsx.
//
// The bug it guards: a hunt with 0 verified findings showed only the
// bare count "N leads under investigation" — no title, severity or
// evidence — and the Reports page built a report only after a manual
// "Generate report" click, so the owner never saw any report building
// live as findings landed.
//
// Run: node scripts/check-live-report.mjs   (exit 0 = all checks pass)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const huntCard = readFileSync(join(root, '..', 'src', 'components', 'HuntCard.jsx'), 'utf8');
const reportsPage = readFileSync(join(root, '..', 'src', 'pages', 'ReportsPage.jsx'), 'utf8');
const chatThread = readFileSync(join(root, '..', 'src', 'components', 'ChatThread.jsx'), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// 1. HuntCard renders unverified leads as rows, not just a count.
check('HuntCard computes an unverifiedFindings list', huntCard.includes('const unverifiedFindings = findings.filter((f) => f && f.verified !== true);'));
check('lead rows render title + severity + detail', huntCard.includes('findings-leads') && huntCard.includes('{f.detail && <div className="finding-detail">{f.detail}</div>}'));
check('lead rows carry the under-investigation badge', huntCard.includes('finding-unverified') && huntCard.includes('under investigation'));
check(
  'lead rows never carry a verified badge',
  !/findings-leads[\s\S]{0,1200}finding-verified/.test(huntCard),
);
check('the bare "+ N leads" count line is gone', !huntCard.includes('hunt-investigating'));

// 2. ReportsPage builds live: generate on select + 20 s refresh.
check(
  'ReportsPage refreshes the report while a hunt is selected',
  /useEffect\(\(\) => \{\s*if \(!selectedId\) return undefined;/.test(reportsPage)
    && reportsPage.includes('setInterval(refresh, 20000)'),
);
check('ReportsPage generates immediately on select (not only on click)', reportsPage.includes('refresh();'));

// 3. The chat view links to the report while the hunt runs, not only
// after it ends.
check(
  'ChatThread report link is not gated to terminal states only',
  !chatThread.includes("['done', 'stopped', 'failed', 'error'].includes(msg.hunt.status)"),
);
check(
  'ChatThread report link shows for running/paused hunts',
  chatThread.includes("msg.hunt.status !== 'idle'"),
);

console.log(failures === 0 ? '\nAll live-report checks passed.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
