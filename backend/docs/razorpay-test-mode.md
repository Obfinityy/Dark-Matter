# Razorpay auto-payment — test mode setup (issue #491)

Pay -> account activates instantly, with no per-payment admin verification.
**TEST MODE ONLY: no live keys, no real money.** The manual UPI flow
(`UpiPayPage` + admin verify) stays untouched as the fallback.

## How it works

1. The pay page calls `POST /api/v1/payments/razorpay/create-order` (logged-in
   users via Bearer token; pending users via username+password, like the
   manual claim flow). The backend creates a Razorpay order for **Rs 10,000**
   and returns the order id + public `key_id`.
2. The frontend opens Razorpay Checkout (UPI first). On success it polls
   `GET /api/v1/payments/razorpay/order/:orderId` until the order reports paid.
3. Razorpay sends a `payment.captured` webhook to
   `POST /api/v1/payments/razorpay/webhook`. The backend verifies the
   HMAC-SHA256 signature against `RAZORPAY_WEBHOOK_SECRET` using the **raw**
   request body, then activates the paying user for **1 day** via the same
   `grantAccess(user, 1)` path the admin Verify uses — same `accessUntil`
   semantics, same in-app activation notification. Duplicate webhook
   deliveries for the same payment id are a no-op (`alreadyHandled`).
4. If a webhook is missed, the order-status poll activates from Razorpay's
   own order state (self-healing).

## Owner setup (free, no KYC needed for test mode)

1. **Create test keys** — sign up at razorpay.com with an email, open the
   Dashboard -> Settings -> API Keys -> **Generate Test Key**. The key
   secret is shown **once**; copy it now.
2. **Backend env vars** (backend `.env` or the deploy dashboard — never in
   the repo, never in frontend code):
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=<test key secret, shown once>
   RAZORPAY_WEBHOOK_SECRET=<set below>
   ```
3. **Register the webhook** — Razorpay Dashboard -> Settings -> Webhooks ->
   Add New Webhook:
   - URL: `https://<your-backend-host>/api/v1/payments/razorpay/webhook`
     (e.g. `https://api.thebhavesh.online/api/v1/payments/razorpay/webhook`)
   - Active events: **`payment.captured`** (and `payment.failed` if you want
     failed-order tracking).
   - The dashboard shows a **Webhook Secret** after creation — put it in
     `RAZORPAY_WEBHOOK_SECRET`. Without it every webhook is rejected
     (401 `bad_signature`) and no account activates.
4. **Test it** — with test keys, use Razorpay's documented test values:
   - UPI: `success@razorpay` (success) and `failure@razorpay` (failure)
     in the Checkout UPI field.
   - Cards: `4111 1111 1111 1111` (success), any future expiry, any CVV.
   - Then check: the account shows "Access active until <now + 24h>", the
     backend logs `[razorpay] ACTIVATED order ...`, and a second webhook
     delivery for the same payment id does not extend access.
   - The Razorpay Dashboard -> Webhooks -> "Test Webhook" button also sends
     a signed sample event (it is ignored as `unhandled_event` unless it
     is a real `payment.captured` for an order this backend created).

## Troubleshooting

- `503 razorpay_not_configured` on create-order: env vars are missing on
  the backend (check the deploy dashboard, then restart the backend).
- Webhook rejected (`401 bad_signature` in backend logs): the
  `RAZORPAY_WEBHOOK_SECRET` does not match the one in the Razorpay
  dashboard — re-copy it (it changes if the webhook is re-created).
- Payment succeeds but no activation: check the backend logs for
  `[razorpay]` lines. If the webhook never arrived, the order-status poll
  (frontend, after checkout success) activates within ~60s anyway; if
  that also fails, the admin can still verify via the manual claim flow.
- `429 rate_limited` on create-order: 10 attempts per IP per 15 min.
  On order-status: 60 polls per IP per 5 min.

## Going live (later — NOT this PR)

1. Owner completes the one-time merchant KYC on Razorpay (individual
   route: PAN + address proof + bank account; no company/GST needed).
2. A one-time **Rs 199 + tax KYC processing fee may apply** at activation.
3. Replace the test keys with **live** keys (`rzp_live_...`) in the backend
   env vars only; re-register the webhook in the live dashboard.
4. Do one live smoke test (a real Rs 10,000 payment, refundable from the
   Razorpay dashboard), then remove the test-mode note from the pay page.
5. Per-transaction fees (standard 2% + GST, ~Rs 236 per Rs 10,000) are
   deducted from each sale — never paid out of pocket.
