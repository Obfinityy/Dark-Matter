// check-active-hunts.mjs — CI/deploy helper (NOT imported by the running server).
//
// Prints the number of hunts that must block an automated backend restart
// (running/created/starting/paused), then exits 0.
// Any failure exits non-zero so the deploy workflow FAILS CLOSED instead of
// restarting blindly.
//
// Run from backend/:  node scripts/check-active-hunts.mjs
//
// NOTE: this exists as a file because appleboy/ssh-action (drone-ssh)
// mangles multi-line `node -e "..."` strings (SyntaxError: Unexpected
// token '['), which used to break the deploy workflow's active-hunt guard.

import { listHuntMetas } from '../src/store.js';

try {
  const metas = listHuntMetas();
  const active = metas.filter(
    (m) =>
      ['running', 'created', 'starting', 'paused'].includes(m.state) &&
      !['stopped', 'finished', 'failed'].includes(m.state)
  );
  console.log(active.length);
} catch (err) {
  console.error('active-hunt check failed:', err && err.message ? err.message : err);
  process.exit(1);
}
