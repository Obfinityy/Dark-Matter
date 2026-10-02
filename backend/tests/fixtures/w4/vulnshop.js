/**
 * VulnShop — intentionally vulnerable local fixture for Worker 4's
 * continuous-improvement vuln-depth probes. Binds 127.0.0.1 ONLY.
 * Every flaw here is deliberate and documented; nothing here is reachable
 * beyond loopback.
 */
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';

const JWT_WEAK_SECRET = 'secret123';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function signHS256(header, payload) {
  const h = b64url(header), p = b64url(payload);
  const sig = crypto.createHmac('sha256', JWT_WEAK_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
export function forgeWeakJwt(payload) {
  return signHS256({ alg: 'HS256', typ: 'JWT' }, payload);
}

export function createVulnShop({ xxeCanaryPath = null } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.text({ type: 'text/xml' }));

  const users = {
    1: { id: 1, name: 'alice', email: 'alice@w4.local', role: 'user' },
    2: { id: 2, name: 'bob', email: 'bob@w4.local', role: 'user' }
  };
  let nextId = 3;
  const couponUses = {};          // VULN: never capped per user
  const singleUse = { 'RACE-001': true };
  let shopConfig = {};

  // ── business logic ──────────────────────────────────────────
  app.post('/api/cart', (req, res) => {
    const { price, qty } = req.body;                 // VULN: client-controlled price
    res.json({ total: Number(price) * Number(qty) });
  });
  app.post('/api/coupon', (req, res) => {
    const { code } = req.body;                       // VULN: unlimited stacking
    couponUses[code] = (couponUses[code] || 0) + 1;
    res.json({ code, discountPct: 10 * couponUses[code], uses: couponUses[code] });
  });

  // ── auth bypass ─────────────────────────────────────────────
  app.get('/api/admin/users', (req, res) => {         // VULN: forced browsing, no auth
    res.json(Object.values(users));
  });
  app.post('/api/login', (req, res) => {             // VULN: ?role= pollution + cookie w/o HttpOnly
    const role = req.query.role || 'user';
    res.setHeader('Set-Cookie', `session=sess_${req.body.user || 'anon'}; Path=/`);
    res.json({ token: forgeWeakJwt({ sub: req.body.user || 'anon', role }), role });
  });

  // ── race condition ──────────────────────────────────────────
  app.post('/api/redeem', async (req, res) => {       // VULN: check-then-act, no lock
    const { code } = req.body;
    if (!singleUse[code]) return res.status(400).json({ error: 'already redeemed' });
    await new Promise((r) => setTimeout(r, 60));      // window for the race
    delete singleUse[code];
    res.json({ ok: true, code });
  });

  // ── JWT ─────────────────────────────────────────────────────
  app.get('/api/profile', (req, res) => {
    const tok = (req.headers.authorization || '').replace('Bearer ', '');
    const [h, p, s] = tok.split('.');
    if (!h || !p) return res.status(401).json({ error: 'no token' });
    let header, payload;
    try {
      header = JSON.parse(Buffer.from(h, 'base64url').toString());
      payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    } catch { return res.status(401).json({ error: 'bad token' }); }
    if (header.alg === 'none') return res.json({ profile: payload, via: 'alg-none' }); // VULN
    const expect = crypto.createHmac('sha256', JWT_WEAK_SECRET).update(`${h}.${p}`).digest('base64url');
    if (s === expect) return res.json({ profile: payload, via: 'hs256' });              // VULN: weak secret
    if (header.kid) return res.status(500).json({ error: `key file not found: ${header.kid}` }); // VULN: kid reflected
    return res.status(401).json({ error: 'bad signature' });
  });

  // ── mass assignment + IDOR→privesc ──────────────────────────
  app.post('/api/users', (req, res) => {              // VULN: role mass-assignable
    const u = { id: nextId++, name: req.body.name, email: req.body.email, role: req.body.role || 'user' };
    users[u.id] = u;
    res.status(201).json(u);
  });
  app.put('/api/users/:id', (req, res) => {          // VULN: no ownership check
    const u = users[req.params.id];
    if (!u) return res.status(404).json({ error: 'not found' });
    Object.assign(u, req.body);
    res.json(u);
  });

  // ── GraphQL ─────────────────────────────────────────────────
  app.post('/graphql', (req, res) => {               // VULN: introspection enabled
    const q = String(req.body.query || '');
    if (q.includes('__schema')) {
      return res.json({ data: { __schema: { queryType: { name: 'Query' }, types: [{ name: 'User' }, { name: 'Admin' }] } } });
    }
    res.json({ data: { hello: 'world' } });
  });

  // ── SSTI ────────────────────────────────────────────────────
  app.get('/api/greet', (req, res) => {               // VULN: naive template eval
    const name = String(req.query.name || 'guest');
    const out = name.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      try { return String(Function(`'use strict'; return (${expr})`)()); }
      catch { return _; }
    });
    res.send(`Hello ${out}`);
  });

  // ── XXE ─────────────────────────────────────────────────────
  app.post('/api/xml', (req, res) => {                // VULN: external entities resolved
    const body = String(req.body || '');
    const m = body.match(/<!ENTITY\s+(\w+)\s+SYSTEM\s+"file:\/\/([^"]+)"/);
    let out = body;
    if (m && xxeCanaryPath) {
      try {
        const content = fs.readFileSync(m[2] === '/canary' ? xxeCanaryPath : m[2], 'utf8').trim();
        out = body.replace(new RegExp(`&${m[1]};`, 'g'), content);
      } catch (e) { out = `entity error: ${e.message}`; }
    }
    res.send(`<result>${out}</result>`);
  });

  // ── prototype pollution ─────────────────────────────────────
  const merge = (t, s) => {                          // VULN: no __proto__ guard
    for (const k of Object.keys(s)) {
      if (s[k] && typeof s[k] === 'object') merge(t[k] || (t[k] = {}), s[k]);
      else t[k] = s[k];
    }
    return t;
  };
  app.post('/api/config', (req, res) => { merge(shopConfig, req.body); res.json({ ok: true }); });
  app.get('/api/config', (req, res) => res.json({ polluted: ({}).polluted === true, config: shopConfig }));

  // ── open redirect ───────────────────────────────────────────
  app.get('/api/goto', (req, res) => {                // VULN: unvalidated redirect
    res.redirect(String(req.query.next || '/'));
  });

  // ── reflected XSS (for the XSS→ATO chain) ────────────────────
  app.get('/api/echo', (req, res) => res.send(`<html>you said: ${req.query.msg || ''}</html>`));

  // ── secrets in JS ───────────────────────────────────────────
  app.get('/static/app.js', (req, res) => {
    res.type('application/javascript').send(`
      const API_KEY = "sk-live-w4testkey1234567890";
      const cfg = { aws_secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYW4TESTKEY" };
      // stripe pk_test_51H7w4TestKey00000000000000
      fetch("/api/users");
    `);
  });

  return app;
}
