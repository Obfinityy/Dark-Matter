import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapPaymentGatewayIntegrations,
  mapFraudSdkEndpoints,
  mapBotManagementSignals,
  analyseRiskSignalSurface,
} from './riskSignalRecon.js';

test('997: mapPaymentGatewayIntegrations detects Stripe with masked key and checkout hints', () => {
  const js = `
<script src="https://js.stripe.com/v3/stripe.js"></script>
const stripe = Stripe('pk_live_abcdef1234567890');
fetch('/api/billing/create-payment-intent', { method: 'POST' });`;
  const out = mapPaymentGatewayIntegrations(js);
  assert.equal(out.length, 1);
  assert.equal(out[0].gateway, 'Stripe');
  assert.ok(!out[0].publicKey.includes('pk_live'), 'publishable key must be masked');
  assert.ok(out[0].checkoutHints.some(h => h.includes('payment-intent')));
});

test('997: mapPaymentGatewayIntegrations detects Razorpay and PayPal side by side', () => {
  const js = `
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
const rzp = new Razorpay({ key: 'rzp_live_xyz123', amount: 50000 });
<script src="https://www.paypal.com/sdk/js?client-id=abc&currency=USD"></script>
paypal.Buttons({ createOrder: () => fetch('/paypal/order', { method: 'POST' }) });`;
  const out = mapPaymentGatewayIntegrations(js);
  const names = out.map(f => f.gateway);
  assert.ok(names.includes('Razorpay'));
  assert.ok(names.includes('PayPal'));
  const rzp = out.find(f => f.gateway === 'Razorpay');
  assert.ok(!rzp.publicKey.includes('rzp_live'), 'Razorpay key must be masked');
});

test('997: mapPaymentGatewayIntegrations returns empty for plain source', () => {
  const out = mapPaymentGatewayIntegrations('const a = 1; fetch("/api/data");');
  assert.deepEqual(out, []);
});

test('998: mapFraudSdkEndpoints detects Sift with beacon host and pushed signals', () => {
  const js = `
<script src="https://cdn.sift.com/s/v3/js/sift.js"></script>
var _sift = _sift || []; _sift.push(['$create_order', { $order_id: '123' }]);
_sift.push(['$add_item_to_cart', {}]);`;
  const out = mapFraudSdkEndpoints(js);
  assert.equal(out.length, 1);
  assert.equal(out[0].sdk, 'Sift');
  assert.ok(out[0].beaconHost.includes('sift'));
  const sigs = out[0].signals.map(s => s.signal);
  assert.ok(sigs.includes('$create_order'));
  assert.ok(sigs.includes('$add_item_to_cart'));
});

test('998: mapFraudSdkEndpoints detects Riskified beacon', () => {
  const js = `
<script src="https://beacon.riskified.com/"></script>
Riskified.Beacon.render('store.example.com');`;
  const out = mapFraudSdkEndpoints(js);
  assert.ok(out.some(f => f.sdk === 'Riskified'));
});

test('998: mapFraudSdkEndpoints dedupes repeated signals', () => {
  const js = `<script src="https://cdn.sift.com/s/v3/js/sift.js"></script>
_sift.push(['$pageview', {}]); _sift.push(['$pageview', {}]);`;
  const out = mapFraudSdkEndpoints(js);
  assert.equal(out[0].signals.length, 1);
});

test('999: mapBotManagementSignals detects PerimeterX app id (truncated) and challenge hints', () => {
  const js = `
<script>window._pxAppId = 'PXabcdef123456'; window._pxJsClientSrc = '/px/init.js';</script>
<script src="https://client.perimeterx.net/PXabcdef123456/main.min.js"></script>`;
  const out = mapBotManagementSignals(js);
  const px = out.find(f => f.sdk === 'PerimeterX');
  assert.ok(px, 'PerimeterX detected');
  assert.ok(px.signals.length >= 1);
  assert.ok(px.signals.every(s => !s.signal.includes('PXabcdef123456')), 'app id must be truncated');
});

test('999: mapBotManagementSignals detects Turnstile with challenge hints', () => {
  const js = `
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
<div class="cf-turnstile" data-sitekey="0x4AAAAAAAAAABcd123456"></div>
<script>turnstile.render('#captcha', { sitekey: '0x4AAAAAAAAAABcd123456' });</script>`;
  const out = mapBotManagementSignals(js);
  const ts = out.find(f => f.sdk === 'Cloudflare Turnstile');
  assert.ok(ts, 'Turnstile detected');
  assert.ok(ts.signals.some(s => s.signal.length <= 12 || s.signal.includes('truncated')), 'sitekey truncated or short');
});

test('999: mapBotManagementSignals detects DataDome', () => {
  const js = `<script src="https://geo.captcha-delivery.com/captcha-delivery.js" async></script>
<script>window.ddjskey = 'abc123'; var dd = document.createElement('script');</script>
<div>datadome protected</div>`;
  const out = mapBotManagementSignals(js);
  assert.ok(out.some(f => f.sdk === 'DataDome'));
});

test('999: mapBotManagementSignals returns empty for plain source', () => {
  const out = mapBotManagementSignals('const a = 1;');
  assert.deepEqual(out, []);
});

test('analyseRiskSignalSurface combines all three mappers', () => {
  const js = `
<script src="https://js.stripe.com/v3/stripe.js"></script>
<script src="https://cdn.sift.com/s/v3/js/sift.js"></script>
<script src="https://www.google.com/recaptcha/api.js"></script>`;
  const out = analyseRiskSignalSurface(js);
  assert.ok(out.paymentGateways.some(g => g.gateway === 'Stripe'));
  assert.ok(out.fraudSdks.some(s => s.sdk === 'Sift'));
  assert.ok(out.botManagement.some(b => b.sdk === 'reCAPTCHA'));
});
