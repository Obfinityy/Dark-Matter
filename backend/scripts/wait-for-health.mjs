// wait-for-health.mjs — CI/deploy helper (NOT imported by the running server).
//
// Polls the backend /health endpoint until it answers 2xx or the attempt
// budget runs out, then exits 0 (healthy) or 1 (still down).
//
// Why a wait instead of a single curl: a deploy restart makes the backend
// unreachable for seconds (clean restart ~15s to bind; a transient
// first-start failure + systemd respawn longer), and a single curl fired
// into that window fails the whole workflow run even though the backend
// comes back on its own. That exact race red-flagged runs 42217388113 +
// 42218258225 (6 Nov 2026): both failed on the SKIP path's one-shot
// health check in the same second as the manual restart. Retrying keeps
// the failure signal (a backend that never comes back still fails the
// deploy after the budget) without failing it for downtime the deploy
// itself caused.
//
// Usage (from backend/):
//   node scripts/wait-for-health.mjs [url] [--attempts N] [--delay-ms N]
// Defaults: url http://localhost:4000/api/v1/health, attempts 12, delay 5000ms
// (60s budget — covers a manual restart + backend boot, or a failed
// first start + respawn + boot). Invalid numeric args exit 2 with usage.

const DEFAULT_URL = 'http://localhost:4000/api/v1/health';
const DEFAULT_ATTEMPTS = 12;
const DEFAULT_DELAY_MS = 5000;
const PER_ATTEMPT_TIMEOUT_MS = 3000;

function parseArgs(argv) {
  let url = DEFAULT_URL;
  let attempts = DEFAULT_ATTEMPTS;
  let delayMs = DEFAULT_DELAY_MS;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--attempts') {
      attempts = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === '--delay-ms') {
      delayMs = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg.startsWith('--')) {
      console.error(`wait-for-health: unknown option '${arg}'`);
      process.exit(2);
    } else if (!arg.startsWith('-')) {
      url = arg;
    } else {
      console.error(`wait-for-health: unknown option '${arg}'`);
      process.exit(2);
    }
  }
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isInteger(delayMs) || delayMs < 0) {
    console.error('wait-for-health: --attempts must be >= 1 and --delay-ms >= 0');
    process.exit(2);
  }
  return { url, attempts, delayMs };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tryOnce(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS) });
    return res.ok;
  } catch {
    return false;
  }
}

const { url, attempts, delayMs } = parseArgs(process.argv.slice(2));
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  // eslint-disable-next-line no-await-in-loop
  if (await tryOnce(url)) {
    console.log(`wait-for-health: healthy after ${attempt} attempt(s) (${url})`);
    process.exit(0);
  }
  if (attempt < attempts) {
    console.log(`wait-for-health: attempt ${attempt}/${attempts} — not healthy yet, retrying in ${delayMs}ms`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(delayMs);
  }
}
console.error(`wait-for-health: ERROR: ${url} never became healthy after ${attempts} attempt(s)`);
process.exit(1);
