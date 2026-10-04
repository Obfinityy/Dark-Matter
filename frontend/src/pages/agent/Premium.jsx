/**
 * Premium — subscription tiers (FRONTEND ONLY for now).
 *
 * Tiers: Free $0 · Low $20 · Medium $50 · High $100 · UltraMax $299 · Infinity $499.
 * No payment code exists yet: clicking a tier marks it "reserved" and tells
 * the user payments will be integrated later. The backend never sees this.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Crown, Check, Sparkles, X } from 'lucide-react';
import './Premium.css';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
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

/** The tier the user reserved on the Premium page (frontend-only for now). */
export function getReservedTier() {
  try {
    const id = window.localStorage.getItem(RESERVED_KEY);
    return TIERS.some((t) => t.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function Premium() {
  const [reserved, setReserved] = useState(() => getReservedTier());
  const [pending, setPending] = useState(null); // tier with the "coming soon" modal open
  const modalRef = useRef(null);

  // Escape closes the modal; focus it on open for keyboard users.
  useEffect(() => {
    if (!pending) return;
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
              <span className="sg-premium-amount">${tier.price}</span>
              <span className="sg-premium-period">/month</span>
            </p>
            <ul className="sg-premium-features">
              {tier.features.map((f) => (
                <li key={f}><Check size={14} /> {f}</li>
              ))}
            </ul>
            <button
              className={`sg-btn ${reserved === tier.id ? 'sg-btn-ghost' : tier.flagship ? 'sg-btn-primary' : 'sg-btn-ghost'} sg-premium-cta`}
              onClick={() => setPending(tier)}
              disabled={reserved === tier.id}
            >
              {reserved === tier.id ? '✓ Tier reserved' : tier.price === 0 ? 'Start free' : `Choose ${tier.name}`}
            </button>
            {reserved === tier.id && (
              <p className="sg-small sg-premium-note">
                Payments integrate later — your <strong>{tier.name}</strong> tier is reserved.
                We'll notify you the moment billing goes live.
              </p>
            )}
          </article>
        ))}
      </div>

      {/* ── "Coming soon" modal — payments don't exist yet (frontend only). ── */}
      {pending && (
        <div className="sg-modal-scrim" onClick={() => setPending(null)} role="presentation">
          <div
            className="sg-card sg-card-pad sg-premium-modal"
            role="dialog" aria-modal="true" aria-label={`${pending.name} tier coming soon`}
            onClick={(e) => e.stopPropagation()}
            ref={modalRef} tabIndex={-1}
          >
            <button className="sg-modal-close" onClick={() => setPending(null)} aria-label="Close">
              <X size={18} />
            </button>
            <div className="sg-premium-modal-icon"><Crown size={26} /></div>
            <h3 className="sg-h2">{pending.name} — coming soon</h3>
            <p className="sg-body">
              Billing isn't live yet, so you can't pay for{' '}
              <strong>${pending.price}/month</strong> today. Reserve the{' '}
              <strong>{pending.name}</strong> tier now and we'll notify you the
              moment payments open.
            </p>
            <div className="sg-premium-modal-actions">
              <button className="sg-btn sg-btn-primary" onClick={() => reserve(pending)}>
                {pending.price === 0 ? 'Start free' : 'Reserve my spot'}
              </button>
              <button className="sg-btn sg-btn-ghost" onClick={() => setPending(null)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
