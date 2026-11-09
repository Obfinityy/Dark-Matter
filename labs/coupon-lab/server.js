// coupon-lab — deliberately vulnerable coupon shop (LAB ONLY).
//
// A DETERMINISTIC stub shop: Node stdlib only, no dependencies, no
// external calls, $0 spend. It behaves like a real shop's coupon
// surface for probe purposes: a public coupon list, a basket, and a
// coupon-apply endpoint. The planted behaviours are the test
// surface — they are documented, not hidden. This is a lab, not a
// product.
//
// Planted vulnerabilities (see README.md for the row mapping):
//   1. Coupon reuse (#371) — a code discounts every fresh basket
//      (no one-time-use tracking).
//   2. Coupon stacking (#78) — a second code applies on top of the
//      first instead of replacing it, so the total falls below the
//      single-coupon floor.
//
// Safety rails (non-negotiable — see README.md):
//   - All money is FAKE (integer cents, one cheap product). No
//     payments, no payment provider, no external calls.
//   - No real credentials: the single lab login is a documented
//     fixture (lab-user / lab-pass). The bearer token is a fixed
//     fake string, never a real secret.
//   - The container binds 0.0.0.0:3610 only inside its own
//     container; on EC2 the port is published on 172.17.0.1 (lab
//     network), never on the public interface.
//
// Proof modes (env vars, both default to the vulnerable behaviour):
//   COUPON_STACKING=vulnerable|fixed — 'fixed' makes a second code
//     REPLACE the first (total lands on the single-coupon floor),
//     so the stacking leg is rejected and the reuse leg can run.
//   COUPON_REUSE=vulnerable|fixed — 'fixed' makes a code redeemed
//     once unusable on a fresh basket (400 'coupon already
//     redeemed'), so the reuse leg is rejected.
// With the defaults a hunt proves stacking (#78); with
// COUPON_STACKING=fixed a hunt proves reuse (#371). The probe
// returns at most one finding per hunt (early return), so the two
// rows need the two modes.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3610);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const MAX_BODY_BYTES = 64 * 1024;

// Proof modes. Anything other than the literal 'fixed' means the
// vulnerable behaviour — a typo can never silently fix the lab.
const STACKING_FIXED = process.env.COUPON_STACKING === 'fixed';
const REUSE_FIXED = process.env.COUPON_REUSE === 'fixed';

// ---------------------------------------------------------------- seed data
// Loaded from data/seed.json. Prices are integer cents so every total
// the probe reads is exact (no float dust in the oracle arithmetic).
const seed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'seed.json'), 'utf8'));
const PRODUCTS = seed.products; // [{ id, name, priceCents, description }]
const COUPONS = seed.coupons; // [{ code, discount, description }] — discount is a percent

// Single documented lab login (fake fixture, established pattern).
const LAB_USER = 'lab-user';
const LAB_PASS = 'lab-pass';
const LAB_TOKEN = 'coupon-lab-token-1';

// ---------------------------------------------------------------- state
// In-memory only; a restart resets every basket. Basket ids are
// numeric and equal to the user id (Juice convention: basket id ==
// user id), so the probe's login-response basket id always resolves.
let nextBasketItemId = 1;
const baskets = new Map(); // id -> { id, userId, items: [{id, productId, quantity}], coupons: [code] }
const redeemedByUser = new Map(); // userId -> Set(code), only consulted when REUSE_FIXED

function getBasket(id) {
  const key = Number(id);
  if (!Number.isFinite(key)) return null;
  if (!baskets.has(key)) {
    baskets.set(key, { id: key, userId: key, items: [], coupons: [] });
  }
  return baskets.get(key);
}

function productById(id) {
  return PRODUCTS.find((p) => String(p.id) === String(id)) || null;
}

function couponByCode(code) {
  return COUPONS.find((c) => c.code === String(code)) || null;
}

// Basket money: subtotal in cents, then each applied coupon takes
// its percentage off the CURRENT total (multiplicative). A basket
// with no coupons totals its subtotal.
function basketTotals(basket) {
  const subtotalCents = basket.items.reduce((sum, it) => {
    const p = productById(it.productId);
    return sum + (p ? p.priceCents * it.quantity : 0);
  }, 0);
  let totalCents = subtotalCents;
  for (const code of basket.coupons) {
    const c = couponByCode(code);
    if (c) totalCents = Math.round((totalCents * (100 - c.discount)) / 100);
  }
  return { subtotalCents, totalCents };
}

// Juice-shaped basket body: the probe's parseBasket reads
// data.totalPrice and data.Products[].BasketItem{id, quantity}.
function basketBody(basket) {
  const { totalCents } = basketTotals(basket);
  return {
    status: 'success',
    data: {
      id: basket.id,
      coupon: basket.coupons.length ? basket.coupons[basket.coupons.length - 1] : null,
      totalPrice: totalCents / 100,
      Products: basket.items.map((it) => {
        const p = productById(it.productId);
        return {
          id: it.productId,
          name: p ? p.name : 'unknown',
          price: p ? p.priceCents / 100 : 0,
          totalPrice: p ? (p.priceCents * it.quantity) / 100 : 0,
          BasketItem: { id: it.id, quantity: it.quantity, BasketId: basket.id, ProductId: it.productId },
        };
      }),
    },
  };
}

// ---------------------------------------------------------------- http bits
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function sendText(res, status, text, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function bearerOk(req) {
  const h = req.headers.authorization || '';
  return h === `Bearer ${LAB_TOKEN}`;
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>CouponShop — lab shop</title></head>
<body>
<h1>CouponShop</h1>
<p>A tiny lab shop for coupon-abuse testing. All money is fake.</p>
<h2>Products</h2>
<ul id="products"></ul>
<h2>Basket</h2>
<div id="basket">Sign in to see your basket.</div>
<h2>Coupon</h2>
<p>See the public coupon list at <a href="/api/Coupons">/api/Coupons</a>.</p>
<form id="login">
<input name="email" placeholder="email" value="lab-user">
<input name="password" type="password" placeholder="password" value="lab-pass">
<button type="submit">Sign in</button>
</form>
<script src="/main.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------- handlers
async function handle(req, res) {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;
  const m = req.method;

  if (m === 'GET' && p === '/') return sendText(res, 200, indexHtml());
  if (m === 'GET' && p === '/health') {
    return sendJson(res, 200, { ok: true, service: 'coupon-lab', stacking: STACKING_FIXED ? 'fixed' : 'vulnerable', reuse: REUSE_FIXED ? 'fixed' : 'vulnerable' });
  }
  if (m === 'GET' && p === '/main.js') {
    return sendText(res, 200, fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8'), 'text/javascript; charset=utf-8');
  }

  // Public coupon list — the probe's only code source. No auth.
  if (m === 'GET' && p === '/api/Coupons') {
    return sendJson(res, 200, { status: 'success', data: COUPONS });
  }
  if (m === 'GET' && p === '/api/products') {
    return sendJson(res, 200, {
      status: 'success',
      data: PRODUCTS.map((x) => ({ id: x.id, name: x.name, price: x.priceCents / 100, description: x.description })),
    });
  }

  // Login — accepts {email,password} or {username,password}.
  if (m === 'POST' && p === '/rest/user/login') {
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { status: 'error', message: 'bad json' });
    const user = body.email || body.username;
    if (user !== LAB_USER || body.password !== LAB_PASS) {
      return sendJson(res, 401, { status: 'error', message: 'invalid credentials' });
    }
    getBasket(1);
    return sendJson(res, 200, {
      status: 'success',
      authentication: { token: LAB_TOKEN, bid: 1, user: { id: 1, email: LAB_USER } },
      basketId: 1,
    });
  }

  // Everything below needs the lab bearer token.
  const basketMatch = p.match(/^\/rest\/basket\/(\d+)(\/coupon\/([^/]+)|\/checkout)?$/);
  if (basketMatch) {
    if (!bearerOk(req)) return sendJson(res, 401, { status: 'error', message: 'missing token' });
    const basket = getBasket(basketMatch[1]);
    if (!basket) return sendJson(res, 404, { status: 'error', message: 'basket not found' });

    if (m === 'GET' && !basketMatch[2]) return sendJson(res, 200, basketBody(basket));

    if (m === 'PUT' && basketMatch[2] && basketMatch[2].startsWith('/coupon/')) {
      const code = decodeURIComponent(basketMatch[3]);
      const coupon = couponByCode(code);
      if (!coupon) return sendJson(res, 400, { status: 'error', message: 'invalid coupon' });
      if (REUSE_FIXED) {
        const used = redeemedByUser.get(basket.userId) || new Set();
        if (used.has(code)) {
          return sendJson(res, 400, { status: 'error', message: 'coupon already redeemed' });
        }
      }
      if (STACKING_FIXED) {
        // Fixed shop: a new code REPLACES the previous one.
        basket.coupons = [code];
      } else {
        // Planted stacking vuln: a second code applies ON TOP.
        basket.coupons.push(code);
      }
      if (REUSE_FIXED) {
        const used = redeemedByUser.get(basket.userId) || new Set();
        used.add(code);
        redeemedByUser.set(basket.userId, used);
      }
      return sendJson(res, 200, basketBody(basket));
    }

    if (m === 'POST' && basketMatch[2] === '/checkout') {
      basket.items = [];
      basket.coupons = [];
      const body = basketBody(basket);
      body.data.orderId = `ORD-${Date.now()}`;
      return sendJson(res, 200, body);
    }
  }

  // Basket items: POST /api/BasketItems adds; PUT /api/BasketItems/:id sets quantity (0 removes).
  if (p === '/api/BasketItems' && m === 'POST') {
    if (!bearerOk(req)) return sendJson(res, 401, { status: 'error', message: 'missing token' });
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { status: 'error', message: 'bad json' });
    const basketId = body.BasketId != null ? body.BasketId : body.basketId;
    const productId = body.ProductId != null ? body.ProductId : body.productId;
    const quantity = Number(body.quantity) || 1;
    const basket = getBasket(basketId);
    const product = productById(productId);
    if (!basket || !product || quantity < 1) {
      return sendJson(res, 400, { status: 'error', message: 'bad basket item' });
    }
    const item = { id: nextBasketItemId, productId: product.id, quantity };
    nextBasketItemId += 1;
    basket.items.push(item);
    return sendJson(res, 201, { status: 'success', data: { id: item.id, BasketId: basket.id, ProductId: product.id, quantity } });
  }
  const itemMatch = p.match(/^\/api\/BasketItems\/(\d+)$/);
  if (itemMatch && m === 'PUT') {
    if (!bearerOk(req)) return sendJson(res, 401, { status: 'error', message: 'missing token' });
    const body = await readBody(req);
    if (!body) return sendJson(res, 400, { status: 'error', message: 'bad json' });
    const itemId = Number(itemMatch[1]);
    let found = null;
    for (const b of baskets.values()) {
      const it = b.items.find((x) => x.id === itemId);
      if (it) {
        found = { basket: b, item: it };
        break;
      }
    }
    if (!found) return sendJson(res, 404, { status: 'error', message: 'item not found' });
    const qty = Number(body.quantity);
    if (!Number.isFinite(qty) || qty < 0) return sendJson(res, 400, { status: 'error', message: 'bad quantity' });
    if (qty === 0) {
      found.basket.items = found.basket.items.filter((x) => x.id !== itemId);
      // An emptied basket starts clean: its coupons do not carry
      // over to the next (fresh) basket.
      if (!found.basket.items.length) found.basket.coupons = [];
    } else {
      found.item.quantity = qty;
    }
    return sendJson(res, 200, basketBody(found.basket));
  }

  return sendJson(res, 404, { status: 'error', message: 'not found' });
}

http.createServer((req, res) => {
  handle(req, res).catch(() => {
    try {
      sendJson(res, 500, { status: 'error', message: 'internal error' });
    } catch {
      // response already gone
    }
  });
}).listen(PORT, HOST, () => {
  console.log(`coupon-lab listening on ${HOST}:${PORT} (stacking=${STACKING_FIXED ? 'fixed' : 'vulnerable'}, reuse=${REUSE_FIXED ? 'fixed' : 'vulnerable'})`);
});
