/**
 * Premium — Infinity Credits top-up with live Razorpay billing.
 *
 * Kinetic redesign (issue #292): pricing is instantly scannable (hero balance
 * card, quick-amount chips), the pay button is unmissable. No tiers: any
 * whole-rupee amount (min ₹10); the backend credits your Infinity Credits
 * wallet after Razorpay verifies the payment. Local VM mode is free and
 * unmetered; credits are reserved for future Cloud-mode usage.
 *
 * All billing logic, the Razorpay flow and the deprecated tier exports are
 * untouched — only markup placement and classes changed.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, PlusCircle, Info, Loader2 } from 'lucide-react';
import {
  getBillingStatus,
  createTopupOrder,
  verifyTopupPayment,
} from '../../services/api.js';
import '../../styles/kinetic-acct.css';

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

/** Kinetic letter spans for a title string. Parent must carry aria-label. */
function kineticLetters(text) {
  let i = 0;
  return text.split(' ').map((word, wi, words) => (
    <span key={wi} className="kac-word" aria-hidden="true">
      {word.split('').map(ch => {
        const idx = i++;
        return (
          <span key={idx} className="kac-ch" style={{ '--kac-i': idx }} aria-hidden="true">
            {ch}
          </span>
        );
      })}
      {wi < words.length - 1 ? ' ' : null}
    </span>
  ));
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
        handler: async resp => {
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
    <div className="kac-page">
      <header className="kac-head">
        <h1 className="kac-title" aria-label="Infinity Credits">
          {kineticLetters('Infinity Credits')}
        </h1>
        <p className="kac-sub">
          Pay-as-you-go credit for future Cloud-mode hunts. Local VM mode stays free and unmetered.
        </p>
      </header>

      {/* ── Balance hero ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 1 }} aria-label="Credit balance">
        <div className="kac-prem-hero">
          <span className="kac-prem-icon" aria-hidden="true">
            <Wallet size={24} />
          </span>
          <div>
            <p className="kac-muted kac-prem-label">Infinity Credits</p>
            <p className="kac-prem-value" aria-live="polite">
              {loading ? (
                <Loader2 size={24} className="sg-spin" aria-label="Loading balance" />
              ) : (
                formatInr(balance)
              )}
            </p>
          </div>
        </div>
        <p className="kac-prem-note">
          <Info size={15} aria-hidden="true" />
          Local VM mode is free and unmetered. Your credits are kept safe for Cloud mode, where usage is metered per minute.
        </p>
      </section>

      {/* ── Top-up ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 2 }} aria-label="Top up credits">
        <h2 className="kac-h" style={{ '--kac-i': 2 }}>
          <PlusCircle size={18} aria-hidden="true" /> Top up
        </h2>
        <p className="kac-body">
          Add any whole-rupee amount (minimum ₹{TOPUP_MIN}). Payment is processed securely via Razorpay — UPI, cards, netbanking.
        </p>
        {billingLive ? (
          <>
            <div className="kac-chips" role="group" aria-label="Quick amounts">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`kac-chip${parsedAmount === q ? ' kac-chip-on' : ''}`}
                  aria-pressed={parsedAmount === q}
                  onClick={() => setAmount(String(q))}
                  disabled={paying}
                >
                  ₹{q.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <div className="kac-amount-row">
              <label htmlFor="kac-topup-amount" className="kac-amount-label">
                Amount (₹)
              </label>
              <input
                id="kac-topup-amount"
                type="number"
                min={TOPUP_MIN}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={paying}
                aria-invalid={amount !== '' && !amountValid}
                className="kac-amount-input"
              />
              <button
                type="button"
                className="kac-btn kac-btn-primary kac-btn-lg"
                onClick={topUp}
                disabled={paying}
              >
                <PlusCircle size={17} aria-hidden="true" />
                {paying ? 'Opening checkout…' : `Top up${amountValid ? ` ${formatInr(parsedAmount)}` : ''}`}
              </button>
            </div>
            {payError && (
              <p className="kac-error" role="alert" style={{ marginTop: 16 }}>
                {payError}
              </p>
            )}
          </>
        ) : (
          <p className="kac-body">
            Billing isn&apos;t live yet — top-ups open as soon as Razorpay is connected. Your balance will appear here automatically.
          </p>
        )}
      </section>
    </div>
  );
}
