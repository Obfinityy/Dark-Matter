// CouponShop frontend (lab only). A tiny shop UI that talks to the
// coupon-lab API. The route strings below are the shop's real API
// surface — the scanner mines them from this bundle, exactly like a
// production shop frontend.
'use strict';

let token = null;
let basketId = null;

async function api(path, opts) {
  const res = await fetch(path, {
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}
    ),
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    method: (opts && opts.method) || 'GET',
  });
  return res.json();
}

async function loadProducts() {
  const data = await api('/api/products');
  const list = document.getElementById('products');
  list.innerHTML = '';
  for (const p of data.data || []) {
    const li = document.createElement('li');
    li.textContent = p.name + ' — $' + p.price + ' ';
    const btn = document.createElement('button');
    btn.textContent = 'Add to basket';
    btn.onclick = () => addToBasket(p.id);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function loadCoupons() {
  const data = await api('/api/Coupons');
  return data.data || [];
}

async function login(email, password) {
  const data = await api('/rest/user/login', { method: 'POST', body: { email, password } });
  token = data.authentication.token;
  basketId = data.authentication.bid;
  return data;
}

async function loadBasket() {
  const data = await api(`/rest/basket/${basketId}`);
  const el = document.getElementById('basket');
  const items = (data.data && data.data.Products) || [];
  el.textContent = 'Total: $' + (data.data ? data.data.totalPrice : 0) +
    ' (' + items.length + ' items, coupon: ' + ((data.data && data.data.coupon) || 'none') + ')';
  return data;
}

async function addToBasket(productId) {
  await api('/api/BasketItems', {
    method: 'POST',
    body: { BasketId: basketId, ProductId: productId, quantity: 1 },
  });
  await loadBasket();
}

async function setItemQuantity(itemId, quantity) {
  await api(`/api/BasketItems/${itemId}`, { method: 'PUT', body: { quantity } });
  await loadBasket();
}

async function applyCoupon(code) {
  const data = await api(`/rest/basket/${basketId}/coupon/${code}`, { method: 'PUT' });
  await loadBasket();
  return data;
}

async function checkout() {
  const data = await api(`/rest/basket/${basketId}/checkout`, { method: 'POST', body: {} });
  await loadBasket();
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadCoupons();
  const form = document.getElementById('login');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const email = form.email.value;
      const password = form.password.value;
      login(email, password).then(loadBasket);
    });
  }
});
