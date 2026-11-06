// Lane WebGoat healthcheck (7 Nov 2026) — lab stack definition tests.
//
// lab-webgoat reported "unhealthy" since 31 Oct 2026 because the upstream
// webgoat/webgoat image's HEALTHCHECK calls `curl`, which is not installed
// in the image (health log: "/bin/sh: 1: curl: not found"). The fix lives
// in docker/labs-compose.yml: WebGoat's healthcheck is overridden with a
// probe built only from bash builtins, hitting the same actuator endpoint.
// These tests pin the live lab inventory (images / names / ports, verified
// read-only via `docker inspect` on EC2) and the probe's behaviour.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

const execFileAsync = promisify(execFile);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const composePath = path.join(repoRoot, 'docker', 'labs-compose.yml');

function loadCompose() {
  return loadYaml(fs.readFileSync(composePath, 'utf8'));
}

// The five live labs, as observed on EC2 via `docker inspect` 7 Nov 2026.
const EXPECTED = {
  dvwa: { image: 'vulnerables/web-dvwa', container: 'lab-dvwa', hostPort: '3100', containerPort: '80' },
  'juice-shop': { image: 'bkimminich/juice-shop:v17.3.0', container: 'juice-shop-lab', hostPort: '3000', containerPort: '3000' },
  webgoat: { image: 'webgoat/webgoat', container: 'lab-webgoat', hostPort: '3200', containerPort: '8080' },
  bwapp: { image: 'raesene/bwapp', container: 'lab-bwapp', hostPort: '3300', containerPort: '80' },
  vampi: { image: 'erev0s/vampi', container: 'lab-vampi', hostPort: '3400', containerPort: '5000' },
};

test('LC-1 labs-compose.yml defines all five live labs exactly', () => {
  const doc = loadCompose();
  assert.deepEqual(Object.keys(doc.services).sort(), Object.keys(EXPECTED).sort());
  for (const [name, want] of Object.entries(EXPECTED)) {
    const svc = doc.services[name];
    assert.equal(svc.image, want.image, `${name} image`);
    assert.equal(svc.container_name, want.container, `${name} container_name`);
    assert.equal(svc.restart, 'unless-stopped', `${name} restart`);
    assert.equal(svc.network_mode, 'bridge', `${name} must stay on the default bridge (scanner targets 172.17.0.1)`);
    const ports = (svc.ports || []).map(String);
    assert.equal(ports.length, 1, `${name} has exactly one port binding`);
    assert.equal(ports[0], `172.17.0.1:${want.hostPort}:${want.containerPort}`, `${name} port binding`);
  }
});

test('LC-2 webgoat healthcheck uses only tools present in the image', () => {
  const doc = loadCompose();
  const hc = doc.services.webgoat.healthcheck;
  assert.ok(hc, 'webgoat must carry an explicit healthcheck overriding the upstream curl one');
  const cmd = Array.isArray(hc.test) ? hc.test.join(' ') : String(hc.test);
  assert.match(cmd, /bash -c/, 'probe runs under bash (verified present in the image)');
  assert.match(cmd, /\/dev\/tcp\/127\.0\.0\.1\/8080/, 'probe targets the in-container port via bash /dev/tcp');
  assert.doesNotMatch(cmd, /\bcurl\b/, 'probe must not call curl — not installed in the image');
  assert.doesNotMatch(cmd, /\bwget\b/, 'probe must not call wget — not installed in the image');
  assert.doesNotMatch(cmd, /\bpython/, 'probe must not call python — not installed in the image');
  assert.match(cmd, /\/WebGoat\/actuator\/health/, 'probe hits the same actuator endpoint the upstream check used');
  assert.match(cmd, /grep -q "200"/, 'probe requires a 200 status line');
});

test('LC-3 the other four labs carry no healthcheck (matches live state)', () => {
  const doc = loadCompose();
  for (const name of Object.keys(EXPECTED)) {
    if (name === 'webgoat') continue;
    assert.equal(doc.services[name].healthcheck, undefined, `${name} must not gain a healthcheck`);
  }
});

test('LC-4 webgoat healthcheck timings are sane', () => {
  const hc = loadCompose().services.webgoat.healthcheck;
  assert.ok(hc.interval && hc.timeout && hc.retries && hc.start_period, 'interval/timeout/retries/start_period all set');
  // WebGoat's Java boot takes over a minute; start_period must cover it
  // or the container flaps unhealthy during every boot.
  assert.match(String(hc.start_period), /^\d+s$/, 'start_period in seconds');
  assert.ok(parseInt(String(hc.start_period), 10) >= 60, 'start_period >= 60s for the Java boot');
});

// Run the REAL probe command from the compose file against a stub server
// (port substituted: the file hardcodes the in-container 8080).
async function runProbeAgainst(cmd, port, urlPath) {
  // NOTE: the probe addresses the port as /dev/tcp/127.0.0.1/8080
  // (slash, not colon) — substitute the stub port in that same form.
  const runnable = cmd
    .replace('127.0.0.1/8080', `127.0.0.1/${port}`)
    .replace('/WebGoat/actuator/health', urlPath);
  try {
    await execFileAsync('bash', ['-c', runnable], { timeout: 10000 });
    return 0;
  } catch (err) {
    return err.code ?? 1;
  }
}

test('LC-5 webgoat probe exits 0 on HTTP 200 and non-zero on 404', async () => {
  const doc = loadCompose();
  const cmd = doc.services.webgoat.healthcheck.test[1];
  const server = http.createServer((req, res) => {
    if (req.url === '/WebGoat/actuator/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"UP"}');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal(
      await runProbeAgainst(cmd, port, '/WebGoat/actuator/health'),
      0, 'probe must pass on the 200 health endpoint');
    assert.notEqual(
      await runProbeAgainst(cmd, port, '/WebGoat/actuator/nope'),
      0, 'probe must fail on a 404 path (it must discriminate, not always pass)');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
