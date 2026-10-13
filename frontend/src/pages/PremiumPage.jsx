// Premium — subscription tiers (placeholder prices; owner sets final prices).
// Tiers gate hunt intensity modes: Free → Normal/Medium, Pro → +High/Ultra,
// Elite → +Max/Infinity.
import React from 'react';
import { toast } from '../lib/toast';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['Normal + Medium hunt modes', 'Community templates', 'PDF reports', '1 concurrent hunt'],
    cta: 'Current plan',
    current: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$99',
    period: '/month',
    features: ['Everything in Free', 'High + Ultra High modes', 'Exploit-chain engine', 'Variant mining', '5 concurrent hunts'],
    cta: 'Go Pro',
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '$299',
    period: '/month',
    features: ['Everything in Pro', 'Max + Infinity modes', 'Unlimited tokens', 'Learning loop playbook', 'Priority engine', '16 concurrent hunts'],
    cta: 'Go Elite',
    highlight: true,
  },
];

export default function PremiumPage() {
  function buy(tier) {
    if (tier.current) return;
    toast(`Checkout for ${tier.name} (${tier.price}${tier.period}) is coming soon.`, 'info');
  }

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <h1>Premium</h1>
          <p className="page-sub">
            Unlock deeper hunts. Higher tiers mean more tokens, more techniques,
            and the Infinity mode that never stops.
          </p>
        </header>
        <div className="tier-grid">
          {TIERS.map((t) => (
            <div key={t.id} className={`tier-card${t.highlight ? ' highlight' : ''}`}>
              {t.highlight && <div className="tier-badge">Most popular</div>}
              <h2>{t.name}</h2>
              <div className="tier-price">
                {t.price}<span className="tier-period">{t.period}</span>
              </div>
              <ul className="tier-features">
                {t.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                className={`btn ${t.highlight ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => buy(t)}
                disabled={t.current}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="page-sub" style={{ marginTop: 24 }}>
          Prices are placeholders — final pricing is decided by the owner.
        </p>
      </div>
    </div>
  );
}
