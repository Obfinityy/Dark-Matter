// Test for deterministic click-target resolution (Lane R, 23 Oct 2026).
//
// Live evidence it answers: on the lab hunt h_bench_d69e5746 (OWASP
// Juice Shop, human mode) the hunter stood on the /ftp directory
// listing and asked browser_click for "ftp/acquisitions.md". The
// page's link label is exactly "acquisitions.md"; the old in-page
// matcher demanded a byte-exact label (its only fallback was a
// contains test in the wrong direction) and the click failed with
// "no clickable element matches". Turn 8 of that hunt died on label
// precision, with corrective feedback the hunter could only satisfy
// by guessing better.
//
// resolveClickTarget (guiTools.js) now resolves in deterministic
// tiers — 1: exact label (historical behaviour, first match wins);
// 2: path-prefix-insensitive (basename of a path-like request as an
// exact label, or a label ending in "/<requested>"); 3: the same
// forms case-insensitively. Fallback tiers must match EXACTLY ONE
// element or the click fails with the page's real labels listed.
// No substring/contains matching anywhere.
//
// The resolver is pure and is embedded BY SOURCE into the CDP driver
// script, so Part 2 also proves the shipped in-page copy is the same
// function and that the generated driver script still parses.
//
// Run: node backend/scripts/test-click-resolution.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-click-'));
process.env.DATA_DIR = tmp;

const { resolveClickTarget, guiBrowserClick, resetGuiProbeCache } = await import('../src/guiTools.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// The genuine Juice Shop /ftp listing labels the lab hunter faced.
const FTP_LISTING = [
  'quarantine', 'acquisitions.md', 'announcement_encrypted.md',
  'coupons_2013.md.bak', 'eastere.gg', 'encrypt.pyc',
  'incident-support.kdbx', 'legal.md', 'package.json.bak',
  'suspicious_errors.yml',
];

// ---------------------------------------------------------------------------
// Part 1 — resolver units
// ---------------------------------------------------------------------------
const exact = resolveClickTarget('acquisitions.md', FTP_LISTING);
check('exact: status exact, tier 1', exact.status === 'exact' && exact.tier === 1);
check('exact: picks the matching index', FTP_LISTING[exact.index] === 'acquisitions.md');

const dup = resolveClickTarget('Login', ['Login', 'Login', 'Register']);
check('exact: duplicate labels keep historical first-match', dup.status === 'exact' && dup.index === 0);

check('exact: surrounding whitespace on the request is ignored',
  resolveClickTarget('  acquisitions.md  ', FTP_LISTING).status === 'exact');

// The live failure, replayed: path-prefixed request, bare filename label.
const live = resolveClickTarget('ftp/acquisitions.md', FTP_LISTING);
check('live case: "ftp/acquisitions.md" resolves at tier 2', live.status === 'resolved' && live.tier === 2);
check('live case: resolves to the "acquisitions.md" element', live.label === 'acquisitions.md' && FTP_LISTING[live.index] === 'acquisitions.md');

check('tier 2: backslash path basename resolves',
  resolveClickTarget('ftp\\acquisitions.md', FTP_LISTING).label === 'acquisitions.md');
check('tier 2: deeper path basename resolves',
  resolveClickTarget('a/b/c/legal.md', FTP_LISTING).label === 'legal.md');
check('tier 2: bare request matches a path-rendered label (suffix form)',
  resolveClickTarget('acquisitions.md', ['ftp/acquisitions.md']).status === 'resolved' &&
  resolveClickTarget('acquisitions.md', ['ftp/acquisitions.md']).tier === 2);

// Ambiguity: two identical basenames on the page — never guess.
const amb = resolveClickTarget('ftp/acquisitions.md', ['acquisitions.md', 'other.md', 'acquisitions.md']);
check('ambiguity: duplicate basenames are NOT clicked', amb.status === 'none' && amb.index === -1);
check('ambiguity: error candidates name the real labels once',
  amb.candidates.filter((c) => c === 'acquisitions.md').length === 1 && amb.candidates.includes('other.md'));

// Case-insensitive tier.
const ci = resolveClickTarget('acquisitions.md', ['Acquisitions.MD']);
check('tier 3: case-only difference resolves', ci.status === 'resolved' && ci.tier === 3 && ci.label === 'Acquisitions.MD');
check('tier 3: case + path prefix resolves',
  resolveClickTarget('ftp/acquisitions.md', ['ACQUISITIONS.md']).tier === 3);
const ciAmb = resolveClickTarget('readme.md', ['Readme.md', 'README.md']);
check('tier 3: case ambiguity is NOT clicked', ciAmb.status === 'none');

// No match — error surface carries the page's actual labels.
const miss = resolveClickTarget('nonexistent.txt', ['a.md', 'b.md']);
check('no match: status none', miss.status === 'none');
check('no match: candidates are the visible labels',
  JSON.stringify(miss.candidates) === JSON.stringify(['a.md', 'b.md']));

// Never widen to contains/substring.
check('no widening: "acquisitions.md" does not match label "acquisitions.md.bak"',
  resolveClickTarget('acquisitions.md', ['acquisitions.md.bak']).status === 'none');
check('no widening: "acquisitions.md" does not match label "My acquisitions.md notes"',
  resolveClickTarget('acquisitions.md', ['My acquisitions.md notes']).status === 'none');
check('no widening: wrong-directory path label "xftp/acquisitions.md" is not picked for "ftp/acquisitions.md"',
  resolveClickTarget('ftp/acquisitions.md', ['xftp/acquisitions.md']).status === 'none');

// Degenerate inputs.
check('degenerate: blank request -> none', resolveClickTarget('   ', FTP_LISTING).status === 'none');
check('degenerate: no labels -> none, no candidates',
  resolveClickTarget('acquisitions.md', []).status === 'none' &&
  resolveClickTarget('acquisitions.md', []).candidates.length === 0);
const many = Array.from({ length: 25 }, (_, i) => `file-${i}.md`);
check('candidates: listing is capped at 20 labels',
  resolveClickTarget('nope.md', many).candidates.length === 20);

// ---------------------------------------------------------------------------
// Part 2 — the shipped driver script embeds THIS resolver, unchanged
// ---------------------------------------------------------------------------
const src = resolveClickTarget.toString().replace(/^export\s+/, '');
const rehydrated = new Function(`${src}; return resolveClickTarget;`)();
check('embedded copy: rehydrated resolver reproduces the live case',
  rehydrated('ftp/acquisitions.md', FTP_LISTING).label === 'acquisitions.md');
check('embedded copy: rehydrated resolver reproduces the ambiguity refusal',
  rehydrated('ftp/acquisitions.md', ['acquisitions.md', 'acquisitions.md']).status === 'none');

// Capture the real CDP driver script through the deps.exec seam (the
// script is base64'd into the install command) and prove it parses
// as a module and carries the resolver, not the old contains matcher.
let driverScript = '';
const fakeExec = async (h, cmd) => {
  if (cmd.includes('command -v chromium')) {
    return { stdout: 'chrome=/usr/bin/chromium\ncdp={"Browser":"chrome-test"}\nxsock=X0\n', stderr: '', code: 0 };
  }
  if (cmd.includes('cdp.mjs') && cmd.includes('base64 -d')) {
    const b64 = (/printf %s '([A-Za-z0-9+/=]+)'/.exec(cmd) || [])[1] || '';
    driverScript = Buffer.from(b64, 'base64').toString('utf8');
    return { stdout: String(driverScript.length), stderr: '', code: 0 };
  }
  if (cmd.includes('cdp.mjs click')) {
    return {
      stdout: JSON.stringify({ ok: false, error: 'no clickable element matches "ftp/acquisitions.md" — clickable labels on this page: "acquisitions.md", "legal.md"' }),
      stderr: '', code: 0,
    };
  }
  return { stdout: '', stderr: '', code: 0 };
};

resetGuiProbeCache();
const click = await guiBrowserClick('h_click_test', 'ftp/acquisitions.md', { exec: fakeExec });
check('driver: script was installed through the exec seam', driverScript.length > 1000);
check('driver: script embeds resolveClickTarget', driverScript.includes('function resolveClickTarget'));
check('driver: old contains fallback is gone', !driverScript.includes('.includes(want)'));
const driverFile = path.join(tmp, 'cdp-driver-check.mjs');
fs.writeFileSync(driverFile, driverScript);
let parses = true;
try { execFileSync(process.execPath, ['--check', driverFile], { stdio: 'pipe' }); } catch { parses = false; }
check('driver: generated CDP script parses as a module', parses);
check('click: failure observation passes the error through', click.ok === false && click.observation.includes('Click failed: no clickable element matches "ftp/acquisitions.md"'));
check('click: failure observation carries the candidate labels', click.observation.includes('"acquisitions.md", "legal.md"'));
check('click: failure observation keeps the snapshot advice', click.observation.includes('Take a browser_snapshot and use an exact label from it.'));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
