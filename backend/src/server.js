/**
 * server — process entry point.
 * Boots the Express app, binds the HTTP listener, and handles
 * SIGINT/SIGTERM for graceful shutdown.
 * Part of: Infinity AI / Dark-Matter backend (application bootstrap).
 */

import { createApp } from './app.js';
import { config } from './config.js';

let app;
try {
  app = await createApp();
} catch (error) {
  const message =
    error?.codeName === 'AtlasError' && error?.code === 8000
      ? 'MongoDB authentication failed. Check the database username, password, and URL encoding in backend/.env.'
      : `Backend startup failed: ${error?.message || 'unknown error'}`;
  console.error(message);
  process.exit(1);
}

const server = app.listen(config.port, config.host, () => {
  console.log(`DarkMatter Express API listening at http://${config.host}:${config.port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  // Idempotent: a second signal (or a stuck close) must not re-run the flow.
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, closing server`);
  server.close(async () => {
    await app.locals.shutdown?.();
    process.exit(0);
  });
  // server.close() waits for all connections — including long-lived SSE
  // streams — to finish. Force the issue after 10s: stop accepting new
  // connections, destroy idle keep-alive sockets, then exit.
  setTimeout(() => {
    console.warn('Shutdown timed out waiting for connections — forcing exit');
    try {
      // Node 18.2+: closes idle connections so close() can complete.
      server.closeIdleConnections?.();
    } catch {
      /* ignore */
    }
    // Destroy any remaining sockets outright.
    try {
      server.getConnections?.((err, count) => {
        if (!err) console.warn(`Forcing exit with ${count} connection(s) still open`);
      });
    } catch {
      /* ignore */
    }
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
