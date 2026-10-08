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

function shutdown(signal) {
  console.log(`${signal} received, closing server`);
  server.close(async () => {
    await app.locals.shutdown?.();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
