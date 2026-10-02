/**
 * bootTestServer.js — TEST SUPPORT ONLY.
 *
 * Boots the REAL Dark-Matter backend (createApp from backend/src/app.js —
 * unmodified production code) on 127.0.0.1:4561 with a file-backed database
 * (tests/support/fileDatabase.js) so state survives a process kill.
 *
 * Env:
 *   W3_DB_DIR   — directory for JSON collection files (required)
 *   PORT        — default 4561
 *   W3_READY    — if set, print READY once listening (for test harnesses)
 *
 * Signals readiness on stdout ("W3_READY") and via process.send('ready').
 */
import { createApp } from '../../src/app.js';
import { FileDatabase } from './fileDatabase.js';

const dir = process.env.W3_DB_DIR;
if (!dir) {
  console.error('[w3-test-server] W3_DB_DIR is required');
  process.exit(2);
}

const port = Number(process.env.PORT || 4561);
const db = new FileDatabase(dir);
const app = await createApp({ database: db });

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`[w3-test-server] listening on http://127.0.0.1:${port} db=${dir}`);
  console.log('W3_READY');
  if (process.send) process.send('ready');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
