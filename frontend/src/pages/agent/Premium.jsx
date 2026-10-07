/**
 * Premium — subscription tiers with live Razorpay billing.
 *
 * Tiers: Free ₹0 · Low ₹1,699 · Medium ₹4,199 · High ₹8,399 · UltraMax ₹24,999 · Infinity ₹41,999.
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
    popular: true,
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

const POPULAR_STYLE = {
  borderColor: 'var(--dm-gold-border)',
  background: 'rgba(212, 169, 78, 0.045)',
};

function TierCard({ tier, active, reserved, onChoose }) {
  const isActive = active === tier.id;
  const isReserved = reserved === tier.id;
  const priceLabel =
    tier.inrPrice === 0 ? 'Free' : `₹${tier.inrPrice.toLocaleString('en-IN')}`;

  let ctaClass = 'dm-btn dm-btn-secondary dm-btn-block';
  let ctaLabel = tier.price === 0 ? 'Start free' : `Choose ${tier.name}`;
  if (isActive) {
    ctaClass = 'dm-btn dm-btn-primary dm-btn-block';
    ctaLabel = 'Active plan';
  } else if (isReserved) {
    ctaClass = 'dm-btn dm-btn-secondary dm-btn-block';
    ctaLabel = 'Tier reserved';
  } else if (tier.popular || tier.flagship) {
    ctaClass = 'dm-btn dm-btn-primary dm-btn-block';
  }

  const ariaLabel = isActive
    ? `${tier.name} — your active plan`
    : isReserved
      ? `${tier.name} — reserved, open to pay`
      : tier.price === 0
        ? `Start free with ${tier.name}`
        : `Choose the ${tier.name} tier`;

  return (
    <article
      className="dm-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...(tier.popular ? POPULAR_STYLE : {}),
      }}
    >
      {(tier.popular || tier.flagship) && (
        <div style={{ marginBottom: 'var(--dm-3)' }}>
          <span className="dm-badge dm-badge-gold">
            <Sparkles size={12} aria-hidden="true" />
            {tier.flagship ? 'Most powerful' : 'Most popular'}
          </span>
        </div>
      )}
      <h3 className="dm-card-title" style={{ fontSize: 'var(--dm-text-xl)' }}>
        {tier.name}
      </h3>
      <p className="dm-card-sub" style={{ marginBottom: 'var(--dm-2)' }}>
        {tier.tagline}
      </p>
      <p style={{ margin: '0 0 var(--dm-4)' }}>
        <span style={{ fontSize: 'var(--dm-text-3xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {priceLabel}
        </span>
        {tier.inrPrice > 0 && (
          <span className="dm-muted" style={{ fontSize: 'var(--dm-text-sm)' }}>
            {' '}/month
          </span>
        )}
      </p>
      <ul
        style={{
          listStyle: 'none',
          margin: '0 0 var(--dm-6)',
          padding: 0,
          display: 'grid',
          gap: 'var(--dm-2)',
          flex: 1,
        }}
      >
        {tier.features.map((f) => (
          <li
            key={f}
            style={{
              display: 'flex',
              gap: 'var(--dm-2)',
              fontSize: 'var(--dm-text-sm)',
              color: 'var(--dm-text-2)',
              lineHeight: 1.5,
            }}
          >
            <Check
              size={14}
              aria-hidden="true"
              style={{ color: 'var(--dm-gold-soft)', flexShrink: 0, marginTop: 3 }}
            />
            {f}
          </li>
        ))}
      </ul>
      <button className={ctaClass} onClick={() => onChoose(tier)} disabled={isActive} aria-label={ariaLabel}>
        {isActive || isReserved ? (
          <>
            <Check size={14} aria-hidden="true" /> {ctaLabel}
          </>
        ) : (
          ctaLabel
        )}
      </button>
      {isActive && (
        <p className="dm-muted dm-mt-2" style={{ fontSize: 'var(--dm-text-xs)', textAlign: 'center' }}>
          Your <strong className="dm-text-2">{tier.name}</strong> plan is active. Hunt like an elite.
        </p>
      )}
      {!isActive && isReserved && (
        <p className="dm-muted dm-mt-2" style={{ fontSize: 'var(--dm-text-xs)', textAlign: 'center' }}>
          Tier reserved — open it to complete payment.
        </p>
      )}
    </article>
  );
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
        theme: { color: '#d4a94e' },
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
    <div className="dm-page">
      <div className="dm-container">
        <header className="dm-page-head">
          <h1 className="dm-page-title">Premium</h1>
          <p className="dm-page-sub">
            Pick the firepower you need. Hunt like an elite — or become one.
          </p>
        </header>

        <div className="dm-grid-3">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              active={active}
              reserved={reserved}
              onChoose={setPending}
            />
          ))}
        </div>
      </div>

      {/* ── Checkout modal — live Razorpay billing (test mode). ── */}
      {pending && (
        <div
          onClick={() => setPending(null)}
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--dm-4)',
          }}
        >
          <div
            className="dm-card"
            role="dialog"
            aria-modal="true"
            aria-label={`${pending.name} tier checkout`}
            onClick={(e) => e.stopPropagation()}
            ref={modalRef}
            tabIndex={-1}
            style={{
              width: '100%',
              maxWidth: 480,
              position: 'relative',
              outline: 'none',
            }}
          >
            <button
              className="dm-btn dm-btn-ghost dm-btn-sm"
              onClick={() => setPending(null)}
              aria-label="Close checkout dialog"
              style={{ position: 'absolute', top: 'var(--dm-3)', right: 'var(--dm-3)' }}
            >
              <X size={16} aria-hidden="true" />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dm-3)', marginBottom: 'var(--dm-4)' }}>
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
                }}
                aria-hidden="true"
              >
                <Crown size={22} />
              </span>
              <div>
                <h3 className="dm-card-title">{pending.name}</h3>
                <p className="dm-muted" style={{ margin: 0, fontSize: 'var(--dm-text-sm)' }}>
                  {pending.inrPrice === 0
                    ? 'Free forever'
                    : `₹${pending.inrPrice.toLocaleString('en-IN')} / month`}
                </p>
              </div>
            </div>
            {pending.price === 0 ? (
              <>
                <p className="dm-card-sub">
                  The <strong className="dm-text-2">Free</strong> tier needs no payment — start hunting right away.
                </p>
                <div style={{ display: 'flex', gap: 'var(--dm-2)', flexWrap: 'wrap' }}>
                  <button className="dm-btn dm-btn-primary" onClick={() => reserve(pending)}>
                    Start free
                  </button>
                  <button className="dm-btn dm-btn-ghost" onClick={() => setPending(null)}>
                    Not now
                  </button>
                </div>
              </>
            ) : billingLive ? (
              <>
                <p className="dm-card-sub">
                  Pay securely via Razorpay (UPI, cards, netbanking). Test mode — no real
                  money moves.
                </p>
                {payError && (
                  <p role="alert" style={{ fontSize: 'var(--dm-text-sm)', color: 'var(--dm-red)', margin: '0 0 var(--dm-3)' }}>
                    {payError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 'var(--dm-2)', flexWrap: 'wrap' }}>
                  <button
                    className="dm-btn dm-btn-primary"
                    onClick={() => payForTier(pending)}
                    disabled={paying}
                  >
                    {paying ? 'Opening checkout…' : `Pay ₹${pending.inrPrice.toLocaleString('en-IN')}/month`}
                  </button>
                  <button className="dm-btn dm-btn-ghost" onClick={() => setPending(null)} disabled={paying}>
                    Not now
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="dm-card-sub">
                  Billing isn't live yet, so you can't pay for{' '}
                  <strong className="dm-text-2">₹{pending.inrPrice.toLocaleString('en-IN')}/month</strong> today.
                  Reserve the <strong className="dm-text-2">{pending.name}</strong> tier now and we'll
                  notify you the moment payments open.
                </p>
                <div style={{ display: 'flex', gap: 'var(--dm-2)', flexWrap: 'wrap' }}>
                  <button className="dm-btn dm-btn-primary" onClick={() => reserve(pending)}>
                    Reserve my spot
                  </button>
                  <button className="dm-btn dm-btn-ghost" onClick={() => setPending(null)}>
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
