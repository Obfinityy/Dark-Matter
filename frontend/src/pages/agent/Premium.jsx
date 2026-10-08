/**
 * Premium — Infinity Credits top-up with live Razorpay billing.
 *
 * No tiers: you add any whole-rupee amount (min ₹10) and the backend credits
 * your Infinity Credits wallet after Razorpay verifies the payment. Local VM
 * mode is free and unmetered; credits are reserved for future Cloud-mode usage.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, PlusCircle, Info } from 'lucide-react';
import {
  getBillingStatus,
  createTopupOrder,
  verifyTopupPayment,
} from '../../services/api.js';

/** Deprecated: the tier system was removed in favour of Infinity Credits top-ups. */
export function getReservedTier() {
  return null;
}

/** Deprecated: the tier system was removed in favour of Infinity Credits top-ups. */
export function getActiveTier() {
  return null;
}

/** Lazily load Razorpay checkout.js. */
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error('Could not load Razorpay checkout'));
    document.body.appendChild(s);
  });
}

const TOPUP_MIN = 10;
const TOPUP_DEFAULT = 500;
const QUICK_AMOUNTS = [100, 500, 1000, 5000];

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function Premium() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingLive, setBillingLive] = useState(false);
  const [amount, setAmount] = useState(String(TOPUP_DEFAULT));
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const refreshBalance = useCallback(async () => {
    try {
      const s = await getBillingStatus();
      setBillingLive(Boolean(s?.configured));
      setBalance(typeof s?.creditBalanceInr === 'number' ? s.creditBalanceInr : 0);
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const parsedAmount = Number(amount);
  const amountValid = Number.isInteger(parsedAmount) && parsedAmount >= TOPUP_MIN;

  const topUp = async () => {
    if (!amountValid) {
      setPayError(`Enter a whole-rupee amount of at least ₹${TOPUP_MIN}.`);
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      await loadRazorpayScript();
      // Price authority: the backend validates the amount and creates the order.
      // The public keyId comes from the backend order response only.
      const { orderId, amount: amountPaise, currency, keyId } = await createTopupOrder(parsedAmount);
      const rzp = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount: amountPaise,
        currency,
        name: 'Dark Matter',
        description: `Infinity Credits top-up — ${formatInr(parsedAmount)}`,
        theme: { color: '#d4a94e' },
        handler: async (resp) => {
          try {
            const result = await verifyTopupPayment({
              orderId: resp.razorpay_order_id,
              paymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
            });
            if (result?.ok) {
              setBalance(
                typeof result.creditBalanceInr === 'number'
                  ? result.creditBalanceInr
                  : (balance || 0) + (result.creditedInr || 0)
              );
            } else {
              setPayError(result?.error || 'Payment verification failed');
            }
          } catch (e) {
            setPayError(e.message || 'Verification failed');
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on('payment.failed', () => {
        setPayError('Payment failed — no charge was made.');
        setPaying(false);
      });
      rzp.open();
    } catch (e) {
      setPayError(e.message || 'Could not start checkout');
      setPaying(false);
    }
  };

  return (
    <div className="dm-page">
      <div className="dm-container">
        <header className="dm-page-head">
          <h1 className="dm-page-title">Infinity Credits</h1>
          <p className="dm-page-sub">
            Pay-as-you-go credit for future Cloud-mode hunts. Local VM mode stays free and unmetered.
          </p>
        </header>

        {/* ── Balance ── */}
        <section className="dm-card" aria-label="Credit balance" style={{ marginBottom: 'var(--dm-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dm-3)' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 'var(--dm-r)',
                background: 'var(--dm-gold-glow)',
                border: '1px solid var(--dm-gold-border)',
                color: 'var(--dm-gold-soft)',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <Wallet size={22} />
            </span>
            <div>
              <p className="dm-card-sub" style={{ margin: 0 }}>Infinity Credits</p>
              <p style={{ margin: 0, fontSize: 'var(--dm-text-3xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {loading ? '…' : formatInr(balance)}
              </p>
            </div>
          </div>
          <p className="dm-muted" style={{ margin: 'var(--dm-4) 0 0', fontSize: 'var(--dm-text-sm)', display: 'flex', gap: 'var(--dm-2)' }}>
            <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            Local VM mode is free and unmetered. Your credits are kept safe for Cloud mode, where usage is metered per minute.
          </p>
        </section>

        {/* ── Top-up ── */}
        <section className="dm-card" aria-label="Top up credits">
          <h2 className="dm-card-title">Top up</h2>
          <p className="dm-card-sub">
            Add any whole-rupee amount (minimum ₹{TOPUP_MIN}). Payment is processed securely via Razorpay — UPI, cards, netbanking.
          </p>
          {billingLive ? (
            <>
              <div style={{ display: 'flex', gap: 'var(--dm-2)', flexWrap: 'wrap', marginBottom: 'var(--dm-3)' }}>
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`dm-btn dm-btn-sm ${parsedAmount === q ? 'dm-btn-primary' : 'dm-btn-secondary'}`}
                    onClick={() => setAmount(String(q))}
                    disabled={paying}
                  >
                    ₹{q.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 'var(--dm-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                <label htmlFor="topup-amount" className="dm-muted" style={{ fontSize: 'var(--dm-text-sm)' }}>
                  Amount (₹)
                </label>
                <input
                  id="topup-amount"
                  type="number"
                  min={TOPUP_MIN}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={paying}
                  aria-invalid={amount !== '' && !amountValid}
                  style={{
                    width: 140,
                    padding: 'var(--dm-2) var(--dm-3)',
                    borderRadius: 'var(--dm-r)',
                    border: '1px solid var(--dm-border, #2a2a2a)',
                    background: 'var(--dm-bg-2, transparent)',
                    color: 'inherit',
                    fontSize: 'var(--dm-text-base)',
                  }}
                />
                <button
                  className="dm-btn dm-btn-primary"
                  onClick={topUp}
                  disabled={paying}
                >
                  <PlusCircle size={16} aria-hidden="true" />
                  {paying ? 'Opening checkout…' : `Top up${amountValid ? ` ${formatInr(parsedAmount)}` : ''}`}
                </button>
              </div>
              {payError && (
                <p role="alert" style={{ fontSize: 'var(--dm-text-sm)', color: 'var(--dm-red)', margin: 'var(--dm-3) 0 0' }}>
                  {payError}
                </p>
              )}
            </>
          ) : (
            <p className="dm-card-sub">
              Billing isn't live yet — top-ups open as soon as Razorpay is connected. Your balance will appear here automatically.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
