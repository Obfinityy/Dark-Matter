// UPI payment details — unit tests (node --test). Pure module, no store.
import test from 'node:test';
import assert from 'node:assert/strict';

const { UPI_PAYEE_ID, UPI_PAYEE_NAME, UPI_AMOUNT_INR, UPI_CURRENCY, UPI_ACCESS_DAYS, upiPayLink, upiPayDetails } =
  await import('./upiPay.js');

test('UPI payee constants are the owner-specified values', () => {
  assert.equal(UPI_PAYEE_ID, '6376411796@ibl');
  assert.equal(UPI_PAYEE_NAME, 'Obfinity');
  assert.equal(UPI_AMOUNT_INR, 10000);
  assert.equal(UPI_CURRENCY, 'INR');
  assert.equal(UPI_ACCESS_DAYS, 1);
});

test('deep link is exactly the specified UPI pay URI', () => {
  assert.equal(upiPayLink(), 'upi://pay?pa=6376411796%40ibl&pn=Obfinity&am=10000&cu=INR');
  // ...and it decodes back to the plain values a UPI app expects.
  const u = new URL(upiPayLink());
  assert.equal(u.protocol, 'upi:');
  assert.equal(u.searchParams.get('pa'), '6376411796@ibl');
  assert.equal(u.searchParams.get('pn'), 'Obfinity');
  assert.equal(u.searchParams.get('am'), '10000');
  assert.equal(u.searchParams.get('cu'), 'INR');
});

test('upiPayDetails carries everything the pay screen needs', () => {
  const d = upiPayDetails();
  assert.equal(d.upiId, '6376411796@ibl');
  assert.equal(d.payeeName, 'Obfinity');
  assert.equal(d.amountInr, 10000);
  assert.equal(d.currency, 'INR');
  assert.equal(d.accessDays, 1);
  assert.equal(d.deepLink, upiPayLink());
});
