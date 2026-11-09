# coupon-lab — deliberately vulnerable coupon shop (LAB ONLY)

A deterministic stub shop for the Dark Matter scanner's coupon-abuse
probe (coverage rows **#78** and **#371**, phase `coupon-abuse`).
Node stdlib only, no dependencies, no external calls, $0 spend.
Port **3610**.

## Why this lab exists

Proof #29 (9 Nov 2026) came back INCONCLUSIVE on both existing labs:
Juice Shop has a coupon-apply route but no coupon-list endpoint and no
published codes (`/api/Coupons` → "Unexpected path", `/rest/coupons` →
500, no codes in the JS bundle or the basket body), so the probe mined
0 codes and ran 0 attempts. DVWA has no coupon surface at all. The
probe is correctly built — it refuses to invent a code, because an
invented code cannot distinguish "invalid coupon" from "reuse
rejected" — so the rows needed a lab that publishes its own coupon
list. This lab is that shop.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Shop page, loads `/main.js` (the route-mining surface) |
| GET | `/health` | `{ok, service, stacking, reuse}` |
| GET | `/main.js` | Shop frontend; contains every API route as a literal |
| GET | `/api/Coupons` | **Public** coupon list: SAVE10 (10%), SAVE20 (20%) |
| GET | `/api/products` | Product list (cheapest first for the probe) |
| POST | `/rest/user/login` | `{email\|username, password}` → bearer token + `basketId` |
| GET | `/rest/basket/:id` | Juice-shaped basket (`data.totalPrice`, `data.Products[]`) |
| POST | `/api/BasketItems` | Add an item (`{BasketId, ProductId, quantity}`) |
| PUT | `/api/BasketItems/:id` | Set quantity (`{quantity: 0}` removes the item) |
| PUT | `/rest/basket/:id/coupon/:code` | Apply a coupon code to the basket |
| POST | `/rest/basket/:id/checkout` | Empties the basket (fallback empty path) |

Lab login (documented fixture, fake): `lab-user` / `lab-pass`.
The bearer token is a fixed fake string (`coupon-lab-token-1`).
Basket id equals the user id (Juice convention), so the login
response's `bid` / `basketId` always resolves.

## Planted vulnerabilities (deliberate, documented)

1. **Coupon reuse — row #371 (Medium, CWE-840).** A code is never
   marked used, so the same code discounts every fresh basket.
   Smoke test (default mode): seed 1 mug (total 100) → apply SAVE10
   → 90; empty the basket → re-seed (fresh total 100) → apply SAVE10
   again → **90** (drop 10 = control drop — reuse confirmed).
2. **Coupon stacking — row #78 (Medium, CWE-840).** A second code
   applies on top of the first instead of replacing it. Smoke test
   (default mode): seed 1 mug (total 100) → apply SAVE10 → 90
   (control drop 10) → apply SAVE20 → **72**, below the
   single-coupon floor of 80 (100 − max(10, 20)) — stacking
   confirmed.

Money is integer cents internally, so every total the probe reads is
exact (100 → 90 → 72, no float dust). Emptying a basket clears its
applied coupons, so a fresh basket starts undiscounted. An invalid
code returns 400; a missing bearer token returns 401.

## Proof modes

The probe returns at most one finding per hunt (early return), and
its stacking leg runs before its reuse leg — so the two rows need
two lab modes, selected by env vars (anything other than the literal
`fixed` means the vulnerable behaviour):

- **Default** (`COUPON_STACKING` / `COUPON_REUSE` unset): both
  vulnerable. A hunt proves stacking (#78): 100 → 90 → 72.
- **`COUPON_STACKING=fixed`**: a second code REPLACES the first.
  Smoke test: 100 → SAVE10 → 90 → SAVE20 → **80** (exactly the
  floor — stacking rejected), then empty + re-seed + SAVE10 → **90**
  (reuse confirmed). A hunt in this mode proves reuse (#371).
- **`COUPON_REUSE=fixed`**: a code redeemed once is rejected on a
  fresh basket (400 `coupon already redeemed`).

## Run it

```sh
node server.js            # → http://0.0.0.0:3610 (defaults: both vulnerable)
COUPON_STACKING=fixed PORT=3611 node server.js   # reuse-proof mode
```

Docker (not build-tested locally — no Docker in the sandbox; the
parent deploys it on EC2):

```sh
docker build -t coupon-lab .
docker run -p 172.17.0.1:3610:3610 coupon-lab
```

## Safety

- All money is FAKE (one cheap product, integer cents). No payments,
  no payment provider, no external calls, no real credentials.
- The container binds 0.0.0.0:3610 only inside its own container; on
  EC2 the port is published on 172.17.0.1 (lab network), never on the
  public interface.
- Seed data lives in `data/seed.json` (force-added: root `.gitignore`
  ignores `data/`).
