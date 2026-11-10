# Basket-logic probe (`basket-logic`, coverage rows #82, #370, #374, #80, #83)

`backend/src/scanner/probes/basketLogic.js` — shop-basket ledger probe.

## How it works

- **Control.** Reads the canary basket total, then runs a +1 CONTROL (quantity +1
  must raise the total by exactly one unit price — if it does not, the oracle
  is uncalibrated and the probe returns `[]`). A control that fails on a
  leftover out-of-stock item resets the canary (clear, re-seed, retry once)
  before bailing; every early bail records `bailStage` in diagnostics.
- **Edge mutations (at most 3).** Replays edge quantities on the first basket
  item and re-reads the total: `-1` (negative quantity), `0` (zero quantity),
  `2^53-1` (huge quantity, `HUGE_QTY`). A confirmed `set` edge must ALSO
  survive a same-value replay (re-set the same quantity — the total must not
  move, or the observation is drift, not a finding).
- **Checkout tamper.** One POST to the checkout route with a tampered total
  (`totalPrice: 0.01`); fires ONLY when the response shows an order total
  equal to the tampered amount.
- **Seed (10 Nov 2026, proof #40).** The seed walks the price list until a
  product adds (`seedFirstAddableProduct`) instead of trusting the cheapest
  product — Juice refuses an out-of-stock product with 400, and the cheapest
  product is the first to drain.

## Firing rules

- `Business logic — negative quantity reduces the basket total` (HIGH, #82):
  a negative quantity is accepted and the total drops (or goes negative).
- `Business logic — zero-quantity item corrupts the basket total` (MEDIUM, #374):
  a zero-quantity item corrupts the ledger.
- `Business logic — oversized quantity wraps the basket total` (HIGH, #80):
  a huge quantity wraps the total down (or drives it negative).
- `Business logic — tampered price accepted at checkout` (HIGH, #83): the
  checkout charges the tampered total.

## Close-outs — rows #80 + #83 (10 Nov 2026, feasible-remainder lane; DO NOT re-attempt)

Both rows were tried deterministically by this probe and did not fire on any
lab.

- **#80 Integer Overflow in Calculations.** The `2^53-1` edge runs in the same
  invocation as the `-1` / `0` edges. Proof #41 (Juice hunt `h_6dd46e1c2e8f`,
  30/0 PASS) confirmed the `-1` title in that invocation, so the
  huge-quantity edge necessarily executed in it and did not confirm: Juice's
  quantityCheck refuses quantities above stock with 400, so the huge-quantity
  PUT never lands, and the total never wraps.
- **#83 Price / Payment Tampering.** The tampered-checkout POST runs in the
  same invocation right after the restore — it executed on Juice in proof #41
  and the order total was not the tampered amount.

No new oracle exists for either row: an overflow that never wraps and a
checkout that ignores the tampered price leave nothing further to observe
black-box. Both rows stay tried-and-negative; only a future lab with a
wrapping ledger or a trusting checkout could reopen them.

## Honest limits

- The canary's OWN basket id comes from the login response or the whoami user
  id (Juice convention: basket id == user id) — never a mined filler id, so no
  other user's basket is ever touched.
- The canary basket is restored best-effort (original quantity, or quantity 0
  when the probe seeded the item) before checkout.
