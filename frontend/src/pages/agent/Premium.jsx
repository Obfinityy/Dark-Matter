/**
 * Premium — subscription tiers with live Razorpay billing.
 *
 * Tiers: Free $0 · Low $20 · Medium $50 · High $100 · UltraMax $299 · Infinity $499.
 * Paid tiers check out through Razorpay (test mode): the backend creates the
 * order at its own authoritative INR price and verifies the payment signature.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Crown, Check, Sparkles, X } from 'lucide-react';
import {
  getBillingStatus,
  createBillingOrder,
  verifyBillingPayment,
  getBillingSubscription,
} from '../../services/api.js';
import './Premium.css';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    inrPrice: 0,
    tagline: 'Taste the hunt.',
    features: [
      '2 hunts per month',
      'Community models',
      'Payload library access',
      'Standard queue',
    ],
  },
  {
    id: 'low',
    name: 'Low',
    price: 20,
    inrPrice: 1699,
    tagline: 'For curious hackers.',
    features: [
      '25 hunts per month',
      'Standard uncensored models',
      'Payload library + learning',
      'Standard queue',
      'PDF hunt reports',
    ],
  },
  {
    id: 'medium',
    name: 'Medium',
    price: 50,
    inrPrice: 4199,
    tagline: 'Serious bug hunting.',
    features: [
      '150 hunts per month',
      'All 8B–13B uncensored models',
      'Faster queue priority',
      'Mid-hunt agent chat',
      'On-demand PDF reports',
      'Computer control (Control mode)',
    ],
  },
  {
    id: 'high',
    name: 'High',
    price: 100,
    inrPrice: 8399,
    tagline: 'Go pro.',
    features: [
      'Unlimited hunts',
      '70B uncensored models',
      'API access',
      'Priority queue',
      'Full computer control',
      'Remote GPU (Kaggle / Colab) brain',
    ],
  },
  {
    id: 'ultramax',
    name: 'UltraMax',
    price: 299,
    inrPrice: 24999,
    tagline: 'Maximum firepower.',
    features: [
      'Everything in High',
      'Priority compute cluster',
      '5 team seats',
      'Shared hunt workspaces',
      'Advanced PoC generation',
      'Priority support',
    ],
  },
  {
    id: 'infinity',
    name: 'Infinity',
    price: 499,
    inrPrice: 41999,
    tagline: 'No limits. Ever.',
    features: [
      'Everything in UltraMax',
      'Dedicated brain (your own model)',
      'White-glove onboarding',
      'Custom integrations',
      'Early access to new engines',
    ],
    flagship: true,
  },
];

const RESERVED_KEY = 'dm.reservedTier';
const ACTIVE_KEY = 'dm.activeTier';

/** The tier the user reserved on the Premium page (frontend-only for now). */
export function getReservedTier() {
  try {
    const id = window.localStorage.getItem(RESERVED_KEY);
    return TIERS.some((t) => t.id === id) ? id : null;
  } catch {
    return null;
  }
}

/** The tier the user actually paid for (verified server-side). */
export function getActiveTier() {
  try {
    const id = window.localStorage.getItem(ACTIVE_KEY);
    return TIERS.some((t) => t.id === id) ? id : null;
  } catch {
    return null;
  }
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

export function Premium() {
  const [reserved, setReserved] = useState(() => getReservedTier());
  const [active, setActive] = useState(() => getActiveTier());
  const [pending, setPending] = useState(null); // tier with the checkout modal open
  const [billingLive, setBillingLive] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const modalRef = useRef(null);

  useEffect(() => {
    getBillingStatus().then((s) => setBillingLive(Boolean(s?.configured))).catch(() => {});
    // Server-side plan wins: if the user paid on another device/browser,
    // restore their active tier from the backend.
    getBillingSubscription()
      .then((r) => {
        const tierId = r?.subscription?.tierId;
        if (tierId && TIERS.some((t) => t.id === tierId)) {
          setActive(tierId);
          try { window.localStorage.setItem(ACTIVE_KEY, tierId); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  // Escape closes the modal; focus it on open for keyboard users.
  useEffect(() => {
    if (!pending) return;
    setPayError('');
    const onKey = (e) => { if (e.key === 'Escape') setPending(null); };
    document.addEventListener('keydown', onKey);
    modalRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [pending]);

  const reserve = (tier) => {
    setReserved(tier.id);
    try { window.localStorage.setItem(RESERVED_KEY, tier.id); } catch { /* ignore */ }
    setPending(null);
  };

  const payForTier = async (tier) => {
    setPaying(true);
    setPayError('');
    try {
      await loadRazorpayScript();
      const { order, keyId } = await createBillingOrder(tier.id);
      const rzp = new window.Razorpay({
        key: keyId,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        name: 'Dark Matter',
        description: `${tier.name} — monthly`,
        theme: { color: '#7c3aed' },
        handler: async (resp) => {
          try {
            const result = await verifyBillingPayment({
              orderId: resp.razorpay_order_id,
              paymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
              tierId: tier.id,
            });
            if (result?.ok) {
              setActive(tier.id);
              try { window.localStorage.setItem(ACTIVE_KEY, tier.id); } catch { /* ignore */ }
              setPending(null);
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
    <div className="sg-premium">
      <header className="sg-premium-head">
        <h2 className="sg-h1"><Crown size={26} /> Premium</h2>
        <p className="sg-body">
          Pick the firepower you need. Hunt like an elite — or become one.
        </p>
      </header>

      <div className="sg-premium-grid">
        {TIERS.map((tier, i) => (
          <article
            key={tier.id}
            className={`sg-card sg-card-pad sg-premium-card dm-polish-in${tier.flagship ? ' sg-premium-flagship' : ''}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {tier.flagship && (
              <span className="sg-premium-badge"><Sparkles size={12} /> Most powerful</span>
            )}
            <h3 className="sg-premium-name">{tier.name}</h3>
            <p className="sg-premium-tagline">{tier.tagline}</p>
            <p className="sg-premium-price">
              <span className="sg-premium-amount">₹{tier.inrPrice.toLocaleString('en-IN')}</span>
              <span className="sg-premium-period">/month</span>
            </p>
            <ul className="sg-premium-features">
              {tier.features.map((f) => (
                <li key={f}><Check size={14} /> {f}</li>
              ))}
            </ul>
            <button
              className={`sg-btn ${active === tier.id ? 'sg-btn-primary' : reserved === tier.id ? 'sg-btn-ghost' : tier.flagship ? 'sg-btn-primary' : 'sg-btn-ghost'} sg-premium-cta`}
              onClick={() => setPending(tier)}
              disabled={active === tier.id}
              aria-label={active === tier.id ? `${tier.name} — your active plan` : reserved === tier.id ? `${tier.name} — reserved, open to pay` : tier.price === 0 ? `Start free with ${tier.name}` : `Choose the ${tier.name} tier`}
            >
              {active === tier.id ? <><Check size={14} aria-hidden="true" /> Active plan</> : reserved === tier.id ? <><Check size={14} aria-hidden="true" /> Tier reserved</> : tier.price === 0 ? 'Start free' : `Choose ${tier.name}`}
            </button>
            {active === tier.id && (
              <p className="sg-small sg-premium-note">
                Your <strong>{tier.name}</strong> plan is active. Hunt like an elite. <Sparkles size={12} aria-hidden="true" />
              </p>
            )}
            {active !== tier.id && reserved === tier.id && (
              <p className="sg-small sg-premium-note">
                {billingLive
                  ? <>Your <strong>{tier.name}</strong> tier is reserved — open the tier to complete payment via Razorpay (test mode, no real money moves).</>
                  : <>Billing goes live soon — your <strong>{tier.name}</strong> tier is reserved. We'll notify you the moment payments open.</>}
              </p>
            )}
          </article>
        ))}
      </div>

      {/* ── Checkout modal — live Razorpay billing (test mode). ── */}
      {pending && (
        <div className="sg-modal-scrim" onClick={() => setPending(null)} role="presentation">
          <div
            className="sg-card sg-card-pad sg-premium-modal"
            role="dialog" aria-modal="true" aria-label={`${pending.name} tier checkout`}
            onClick={(e) => e.stopPropagation()}
            ref={modalRef} tabIndex={-1}
          >
            <button className="sg-modal-close" onClick={() => setPending(null)} aria-label="Close checkout dialog">
              <X size={18} />
            </button>
            <div className="sg-premium-modal-icon"><Crown size={26} /></div>
            <h3 className="sg-h2">{pending.name} — ₹{pending.inrPrice.toLocaleString('en-IN')}/month</h3>
            {pending.price === 0 ? (
              <>
                <p className="sg-body">
                  The <strong>Free</strong> tier needs no payment — start hunting right away.
                </p>
                <div className="sg-premium-modal-actions">
                  <button className="sg-btn sg-btn-primary" onClick={() => reserve(pending)}>
                    Start free
                  </button>
                  <button className="sg-btn sg-btn-ghost" onClick={() => setPending(null)}>
                    Not now
                  </button>
                </div>
              </>
            ) : billingLive ? (
              <>
                <p className="sg-body">
                  Pay securely via Razorpay (UPI, cards, netbanking). Test mode — no real
                  money moves.
                </p>
                {payError && <p className="sg-small sg-premium-error" role="alert">{payError}</p>}
                <div className="sg-premium-modal-actions">
                  <button
                    className="sg-btn sg-btn-primary"
                    onClick={() => payForTier(pending)}
                    disabled={paying}
                  >
                    {paying ? 'Opening checkout…' : `Pay ₹${pending.inrPrice.toLocaleString('en-IN')}/month`}
                  </button>
                  <button className="sg-btn sg-btn-ghost" onClick={() => setPending(null)} disabled={paying}>
                    Not now
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="sg-body">
                  Billing isn't live yet, so you can't pay for{' '}
                  <strong>₹{pending.inrPrice.toLocaleString('en-IN')}/month</strong> today. Reserve the{' '}
                  <strong>{pending.name}</strong> tier now and we'll notify you the
                  moment payments open.
                </p>
                <div className="sg-premium-modal-actions">
                  <button className="sg-btn sg-btn-primary" onClick={() => reserve(pending)}>
                    Reserve my spot
                  </button>
                  <button className="sg-btn sg-btn-ghost" onClick={() => setPending(null)}>
                    Not now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
