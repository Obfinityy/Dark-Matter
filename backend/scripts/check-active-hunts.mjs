// check-active-hunts.mjs — CI/deploy helper (NOT imported by the running server).
//
// Prints the number of hunts that must block an automated backend restart,
// then exits 0. Only hunts in state 'running' block: a paused hunt has no
// live driver, its checkpoint survives a restart, and the boot/60s
// reconciler never resumes it — counting it as active (the pre-fix
// behaviour) made the workflow SKIP the restart on EVERY deploy while
// paused hunts existed (10 on 6 Nov 2026), and the SKIP path's single
// unretried health check then raced the manual restart the SKIP forced,
// red-flagging runs 42217388113 + 42218258225. The 'running'-only rule is
// the same one the queue already uses (store.js countRunningHunts, 20 Oct
// 2026) — this script calls it instead of keeping its own divergent
// filter, so the two definitions can never drift apart again.
// Any failure exits non-zero so the deploy workflow FAILS CLOSED instead of
// restarting blindly.
//
// Run from backend/:  node scripts/check-active-hunts.mjs
//
// NOTE: this exists as a file because appleboy/ssh-action (drone-ssh)
// mangles multi-line `node -e "..."` strings (SyntaxError: Unexpected
// token '['), which used to break the deploy workflow's active-hunt guard.

import { countRunningHunts } from '../src/store.js';

try {
  console.log(countRunningHunts());
} catch (err) {
  console.error('active-hunt check failed:', err && err.message ? err.message : err);
  process.exit(1);
}
