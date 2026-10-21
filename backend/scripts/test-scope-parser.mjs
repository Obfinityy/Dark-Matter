// Test for the scope parser's explicit in-scope enumeration
// (Lane D, 21 Oct 2026 — Ezviz audit).
//
// The bug this pins: parseScope never read the programme's asset
// list — inScope was silently just [target domain]. On the Ezviz
// programme (11 named assets) the hunt was confined to the single
// target host: www.ezviz.com / api.ezvizlife.com were unreachable by
// the gate and invisible on the hunter's screen (0 mentions in the
// hunt's 1,246 events). Extraction is narrow on purpose: it runs
// only for an explicit "In scope:" enumeration, and named
// out-of-scope hosts (test.ys7.com) beat wildcard bases (*.ys7.com).
//
// Run: node backend/scripts/test-scope-parser.mjs
import { parseScope } from '../src/scopeParser.js';
import { scopeViolation } from '../src/humanLoop.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// The owner's Ezviz scope text, verbatim from the live hunt's meta.
const EZZ = "Ezviz YesWeHack bug bounty. In scope: www.ezviz.com, api.ezvizlife.com, open.ys7.com, *.ezviz.com, *.ys7.com, *.ezvizlife.com, *.eziot.com, *.ezviz7.com, *.hicloudcam.com, *.hikops.com, *.ezvizru.com. Out of scope: test environments, pre-release environments, demo environments, test.ys7.com, pb.ys7.com, ezcpcloudiot.eziot.com - do not test these. Rules: no automated scanners, do not use scanner tools, no DoS, no brute force, no heavy scanning, max 20 requests per minute, test only the owner's own accounts, never access other users' cameras or data, no disclosure outside YesWeHack.";

const ps = parseScope('https://open.ys7.com', EZZ);
check('ezviz: target domain first in inScope', ps.inScope[0] === 'open.ys7.com');
for (const h of ['www.ezviz.com', 'api.ezvizlife.com', 'ezviz.com', 'ys7.com', 'ezvizlife.com', 'eziot.com', 'ezviz7.com', 'hicloudcam.com', 'hikops.com', 'ezvizru.com']) {
  check(`ezviz: inScope includes ${h}`, ps.inScope.includes(h));
}
for (const h of ['test.ys7.com', 'pb.ys7.com', 'ezcpcloudiot.eziot.com']) {
  check(`ezviz: outOfScopeHosts includes ${h}`, ps.outOfScopeHosts.includes(h));
  check(`ezviz: inScope excludes named-out ${h}`, !ps.inScope.includes(h));
}
check('ezviz: rules still detected (noHeavyScan)', ps.rules.noHeavyScan === true);
check('ezviz: rules still detected (20 rpm)', ps.rules.maxRequestsPerMin === 20);

// Gate behaviour against the parsed scope (human mode's gate).
const T = 'https://open.ys7.com';
check('gate: target allowed', scopeViolation('https://open.ys7.com/login', T, ps) === null);
check('gate: named asset www.ezviz.com allowed', scopeViolation('https://www.ezviz.com/en/', T, ps) === null);
check('gate: named asset api.ezvizlife.com allowed', scopeViolation('https://api.ezvizlife.com/v3', T, ps) === null);
check('gate: wildcard base subdomain allowed', scopeViolation('https://console.ys7.com/x', T, ps) === null);
check('gate: named-out test.ys7.com blocked despite wildcard', scopeViolation('https://test.ys7.com/x', T, ps) === 'https://test.ys7.com/x');
check('gate: named-out pb.ys7.com blocked despite wildcard', scopeViolation('https://pb.ys7.com/', T, ps) === 'https://pb.ys7.com/');
check('gate: named-out ezcpcloudiot.eziot.com blocked despite *.eziot.com', scopeViolation('https://ezcpcloudiot.eziot.com/', T, ps) === 'https://ezcpcloudiot.eziot.com/');
check('gate: subdomain of a named-out host blocked', scopeViolation('https://sub.test.ys7.com/', T, ps) === 'https://sub.test.ys7.com/');
check('gate: foreign host still blocked', scopeViolation('https://evil.example.com/', T, ps) === 'https://evil.example.com/');

// No explicit enumeration -> behaviour identical to the old parser.
const plain = parseScope('https://example.org', 'Please hunt this site carefully, no DoS.');
check('plain: inScope is just the target domain', JSON.stringify(plain.inScope) === JSON.stringify(['example.org']));
check('plain: outOfScopeHosts empty array', Array.isArray(plain.outOfScopeHosts) && plain.outOfScopeHosts.length === 0);

// Empty scope text -> defaults intact.
const bare = parseScope('https://example.org', '');
check('bare: inScope default', JSON.stringify(bare.inScope) === JSON.stringify(['example.org']));
check('bare: outOfScopeHosts empty array', Array.isArray(bare.outOfScopeHosts) && bare.outOfScopeHosts.length === 0);

// A host named in BOTH lists fails closed (out wins), and the target
// domain can never be pushed into outOfScopeHosts by prose.
const both = parseScope('https://a.example.com', 'In scope: a.example.com, b.example.com. Out of scope: b.example.com, a.example.com.');
check('both: b.example.com out wins', !both.inScope.includes('b.example.com') && both.outOfScopeHosts.includes('b.example.com'));
check('both: target domain never an out host', !both.outOfScopeHosts.includes('a.example.com'));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
