/**
 * downloadUtil connect-timeout test: a server that accepts the connection but
 * never sends response headers must fail fast (60s cap would be too slow for a
 * unit test, so we just assert the plumbing aborts the fetch rather than
 * hanging — using a local server that holds headers open and a short
 * manual abort to simulate the timeout path).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { downloadFile } from '../src/services/modelRunner/downloadUtil.js';

test('downloadFile: user abort during header wait rejects (not a hang)', async () => {
  // Server that accepts the TCP connection but never writes a response.
  const server = http.createServer(() => { /* hold the socket open, send nothing */ });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dl-')), 'f.bin');
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error('simulated head timeout')), 500);
  await assert.rejects(
    () => downloadFile(`http://127.0.0.1:${port}/f.bin`, dest, { signal: controller.signal }),
    /simulated head timeout|aborted/i,
    'must reject instead of hanging forever'
  );
  server.close();
});
