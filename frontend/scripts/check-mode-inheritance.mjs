// Mode-inheritance regression check (27 Oct 2026) — no test framework in
// the frontend, so this is a dependency-free node guard over ChatPage.jsx
// + api.js plus a functional run of the resolveHuntMode helper.
//
// The bug it guards: the list endpoint returned hunts without `mode`, so
// handleStartFreshHunt / handleRerunHunt always fell back to 'normal'
// (hunt.mode || 'normal') — a human-mode hunt re-created as normal
// lost the whole human loop, which is what happened to the live DVWA
// hunt h_830317bdc184 on 27 Oct 2026 (22+ min, zero brain turns).
//
// Run: node scripts/check-mode-inheritance.mjs   (exit 0 = all checks pass)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveHuntMode } from '../src/lib/huntMode.js';

const root = dirname(fileURLToPath(import.meta.url));
const chatPage = readFileSync(join(root, '..', 'src', 'pages', 'ChatPage.jsx'), 'utf8');
const api = readFileSync(join(root, '..', 'src', 'lib', 'api.js'), 'utf8');
const huntModeSrc = readFileSync(join(root, '..', 'src', 'lib', 'huntMode.js'), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// 1. No silent 'normal' fallback remains in the re-run paths.
check("no hunt.mode || 'normal' fallback remains in ChatPage", !chatPage.includes("hunt.mode || 'normal'"));
// 2. Both re-run paths resolve the real mode (two call sites).
const resolveCalls = (chatPage.match(/await resolveHuntMode\(hunt\)/g) || []).length;
check('handleRerunHunt + handleStartFreshHunt resolve the real mode', resolveCalls === 2, `found ${resolveCalls}`);
// 3. The locally-built hunt card carries the mode it was started with.
check('local hunt card carries mode', /^\s+mode,\n\s+status: 'idle',/m.test(chatPage));
// 4. The detail-fetch helper exists for stale cards.
check('api.js exports getHunt', api.includes('export async function getHunt('));
// 5. The resolver never falls back to 'normal'.
check("resolver never returns 'normal' as a fallback", !huntModeSrc.includes("return 'normal'"));
check("resolver's last resort is the owner's default 'infinity'", huntModeSrc.includes("return 'infinity'"));

// 6. Functional run of resolveHuntMode with stub fetchers.
const mustNotFetch = async () => { throw new Error('fetch must not run when mode is present'); };
check("mode on the hunt object wins ('human')",
  (await resolveHuntMode({ huntId: 'h1', mode: 'human' }, mustNotFetch)) === 'human');
check("detail fetch recovers 'human' for a stale card",
  (await resolveHuntMode({ huntId: 'h2' }, async () => ({ ok: true, data: { hunt: { mode: 'human' } } }))) === 'human');
check("detail 'normal' is honored (not forced to infinity)",
  (await resolveHuntMode({ huntId: 'h3' }, async () => ({ ok: true, data: { hunt: { mode: 'normal' } } }))) === 'normal');
check('unresolvable mode falls back to infinity, never normal',
  (await resolveHuntMode({ huntId: 'h4' }, async () => { throw new Error('detail down'); })) === 'infinity');
check('null hunt falls back to infinity',
  (await resolveHuntMode(null, mustNotFetch)) === 'infinity');

console.log(failures === 0 ? '\nAll mode-inheritance checks passed.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
