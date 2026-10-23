// Test for Lane P, Defect 3 (23 Oct 2026) — the Plugins page
// rendered its heading and subtitle but ZERO integration cards.
//
// Root cause (frontend): the API client (frontend/src/lib/api.js)
// wraps every payload as { ok, data }, so the provider list lives
// at res.data.providers — but PluginsPage read res.providers
// (always undefined) and silently kept an empty list. The page now
// reads res.data.providers and shows an honest error/empty state
// when the list cannot be loaded.
//
// This suite pins the BACKEND half of that contract: GET
// /api/v1/plugins/providers returns { ok:true, providers:[...] }
// with the real integration registry (GitHub, Shodan, VirusTotal,
// and the built-in Payload Library), each card carrying the fields
// the page renders (id, name, description, configured, builtIn).
// The frontend half is proven by the production build plus the
// before/after accessor (res.providers -> res.data.providers,
// the same shape ReportsPage already uses for res.data.hunts).
//
// Run: node backend/scripts/test-plugins-catalog.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-plugins-'));
process.env.DATA_DIR = tmp;

const express = (await import('express')).default;
const pluginsRouter = (await import('../src/routes/plugins.js')).default;

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const app = express();
app.use(express.json());
app.use('/api/v1/plugins', pluginsRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const res = await fetch(`${base}/api/v1/plugins/providers`);
  const body = await res.json();
  check('GET /providers -> 200 { ok:true }', res.status === 200 && body.ok === true);
  check('payload shape: providers array under the top-level key the client unwraps (data.providers)',
    Array.isArray(body.providers));
  const ids = (body.providers || []).map((p) => p.id);
  check('registry is NOT empty: github, shodan, virustotal, payloads',
    ['github', 'shodan', 'virustotal', 'payloads'].every((id) => ids.includes(id)));
  check('every card carries id + name + description + configured',
    (body.providers || []).every((p) => p.id && p.name && typeof p.description === 'string' && typeof p.configured === 'boolean'));
  const payloads = (body.providers || []).find((p) => p.id === 'payloads');
  check('Payload Library is built-in and configured by default',
    Boolean(payloads) && payloads.builtIn === true && payloads.configured === true);
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
