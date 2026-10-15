// Top-up page — replaces Premium. Users buy hunt credits (USD) via Razorpay.
// Credits are spent per hunt iteration; when the balance runs out, running
// hunts auto-pause and resume after the next top-up.
import React, { useCallback, useEffect, useState } from 'react';
import { billingStatus, createTopupOrder, verifyTopup } from '../lib/api';
import { useAuth } from '../lib/auth';

const PRESETS = [1, 3, 5, 10];

function loadCheckoutJs() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection and try again.'));
    document.body.appendChild(s);
  });
}

export default function TopUpPage() {
  const { ready, user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [txns, setTxns] = useState([]);
  const [amount, setAmount] = useState(3);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const refresh = useCallback(async () => {
    const res = await billingStatus();
    if (res.ok && res.data) {
      setBalance(res.data.balanceUsd ?? 0);
      setConfigured(res.data.configured !== false);
      setTxns(res.data.txns || []);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const effectiveAmount = custom.trim() !== '' ? Number(custom) : amount;

  async function pay() {
    setMsg(null);
    const usd = Number(effectiveAmount);
    if (!Number.isFinite(usd) || usd < 1 || usd > 500) {
      setMsg({ kind: 'error', text: 'Enter an amount between $1 and $500.' });
      return;
    }
    setBusy(true);
    try {
      const orderRes = await createTopupOrder(usd);
      if (!orderRes.ok || !orderRes.data || !orderRes.data.order) {
        throw new Error(orderRes.error || 'Could not start the payment.');
      }
      const { order, keyId } = orderRes.data;
      await loadCheckoutJs();
      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency || 'USD',
        order_id: order.id,
        name: 'Dark Matter',
        description: `Hunt credits top-up — $${usd.toFixed(2)}`,
        theme: { color: '#c9a227' },
        handler: async (resp) => {
          try {
            const v = await verifyTopup(order.id, resp.razorpay_payment_id, resp.razorpay_signature);
            if (v.ok && v.data) {
              setBalance(v.data.balanceUsd ?? 0);
              setMsg({ kind: 'ok', text: `Payment successful — $${usd.toFixed(2)} added to your balance.` });
              refresh();
            } else {
              setMsg({ kind: 'error', text: v.error || 'Payment verification failed. Contact support with your payment ID.' });
            }
          } catch (e) {
            setMsg({ kind: 'error', text: e.message || 'Verification failed.' });
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', (r) => {
        setBusy(false);
        setMsg({ kind: 'error', text: `Payment failed: ${(r.error && r.error.description) || 'try again'}.` });
      });
      rzp.open();
    } catch (e) {
      setBusy(false);
      setMsg({ kind: 'error', text: e.message || 'Payment could not start.' });
    }
  }

  // Wallet is per-user: top-up requires login. Show a clear gate instead of
  // confusing payment errors.
  if (ready && !user) {
    return (
      <div className="page">
        <h2>Hunt credits</h2>
        <p className="page-sub">Top up your balance to run hunts. Each hunt iteration costs a little based on its intensity — when credits run out, hunts pause until you recharge.</p>
        <div className="balance-card">
          <div className="balance-label">🔒 Log in to top up</div>
          <p className="page-sub">Your wallet belongs to your account. Log in to see your balance and add credits.</p>
          <button className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('dm:open-auth'))}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Hunt credits</h2>
      <p className="page-sub">Top up your balance to run hunts. Each hunt iteration costs a little based on its intensity — when credits run out, hunts pause until you recharge.</p>

      <div className="balance-card">
        <div className="balance-label">Your balance</div>
        <div className="balance-value">{balance === null ? '…' : `$${Number(balance).toFixed(2)}`}</div>
      </div>

      {!configured && (
        <p className="notice">Payments are not configured on the backend yet — top-up is disabled.</p>
      )}

      <div className="topup-box">
        <div className="field-label">Amount (USD)</div>
        <div className="preset-row">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`preset${amount === p && custom.trim() === '' ? ' selected' : ''}`}
              onClick={() => { setAmount(p); setCustom(''); }}
            >
              ${p}
            </button>
          ))}
          <input
            className="text-input preset-custom"
            placeholder="Custom"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
          />
        </div>
        <button className="btn btn-primary" onClick={pay} disabled={busy || !configured}>
          {busy ? 'Processing…' : `Top up $${Number.isFinite(Number(effectiveAmount)) ? Number(effectiveAmount).toFixed(2) : '0.00'}`}
        </button>
        {msg && <p className={msg.kind === 'ok' ? 'msg-ok' : 'msg-error'}>{msg.text}</p>}
      </div>

      <h3>Recent activity</h3>
      {txns.length === 0 ? (
        <p className="muted">No transactions yet.</p>
      ) : (
        <ul className="txn-list">
          {txns.map((t, i) => (
            <li key={i}>
              <span className={t.cents >= 0 ? 'txn-plus' : 'txn-minus'}>
                {t.cents >= 0 ? '+' : '−'}${(Math.abs(t.cents) / 100).toFixed(2)}
              </span>
              <span className="muted">{t.type === 'topup' ? 'Top-up' : 'Hunt spend'}{t.mode ? ` · ${t.mode}` : ''}</span>
              <span className="muted">{new Date(t.ts).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
