// Curiosity engine — app model (zero-genuine lane, 27 Oct 2026).
//
// Asserted here:
//   - (a) A known app wins over keyword guessing: DVWA endpoints
//     that LOOK like a shop (leaked Juice Shop /rest/* paths) still
//     model as DVWA, never ecommerce — the mis-model that burned
//     ~160 Meta calls on the live hunt.
//   - Without a known app, the old keyword behaviour is unchanged
//     (shop endpoints still model as ecommerce).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAppModel } from './curiosity.js';

const JUICE_ENDPOINTS = ['/rest/products/search', '/rest/basket', '/rest/user/login', '/api/Products', '/ftp/coupons_2013.md.bak'];
const DVWA_ENDPOINTS = ['/login.php', '/index.php', '/vulnerabilities/sqli/', '/security.php'];

test('DVWA models as DVWA even with shop-looking endpoints in the list', () => {
  const model = buildAppModel([...JUICE_ENDPOINTS, ...DVWA_ENDPOINTS], ['php'], 'generic', 'dvwa');
  assert.equal(model.appType, 'dvwa');
  assert.ok(model.valueFlows.some((v) => v.includes('login form')));
  assert.ok(model.instincts.some((i) => i.includes('Log in first')));
  assert.equal(model.valueFlows.some((v) => v.includes('basket')), false);
});

test('Juice Shop models as a shop from its own endpoints', () => {
  const model = buildAppModel(JUICE_ENDPOINTS, [], 'generic', 'juice-shop');
  assert.equal(model.appType, 'juice-shop');
  assert.ok(model.valueFlows.some((v) => v.includes('basket')));
});

test('without a known app the keyword model is unchanged', () => {
  const shop = buildAppModel(JUICE_ENDPOINTS, [], 'generic');
  assert.equal(shop.appType, 'ecommerce');
  const plain = buildAppModel(DVWA_ENDPOINTS, ['php'], 'generic');
  assert.notEqual(plain.appType, 'ecommerce');
});
