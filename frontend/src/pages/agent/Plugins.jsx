/**
 * Plugins — the extension surface for Dark Matter.
 *
 * Three plugin families, each wired to the page that already implements it:
 *   Model plugins   → Models page (local / remote-GPU / Kaggle / Colab brains)
 *   Payload plugins → Payload library (self-learning payload packs)
 *   API plugins     → external integrations (docs / coming soon)
 *
 * This page is the directory; the heavy lifting lives in the linked pages.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Package, Plug, ArrowRight } from 'lucide-react';

const FAMILIES = [
  {
    id: 'models',
    icon: Brain,
    name: 'Model plugins',
    tagline: 'Brains the agent can run on.',
    description:
      'Local uncensored models, remote GPUs, Kaggle and Colab connections. ' +
      'Download a model, press Run, and it becomes the brain behind both Hunt AI and Infinity AI.',
    to: '/agent/models',
    cta: 'Open Models',
    status: 'Live',
  },
  {
    id: 'payloads',
    icon: Package,
    name: 'Payload plugins',
    tagline: 'Tradecraft the agent learns.',
    description:
      'Self-learning payload packs — every payload the agent tries is recorded ' +
      'with its outcome, and the winners rise to the top of the library.',
    to: '/agent/library',
    cta: 'Open Library',
    status: 'Live',
  },
  {
    id: 'api',
    icon: Plug,
    name: 'API plugins',
    tagline: 'External integrations.',
    description:
      'Webhooks, notification channels, and third-party tool hooks. ' +
      'The plugin API is being finalized — integrations land here.',
    to: null,
    cta: 'Coming soon',
    status: 'Soon',
    disabled: true,
  },
];

export function Plugins() {
  return (
    <div className="dm-page">
      <div className="dm-container">
        <header className="dm-page-head">
          <h1 className="dm-page-title">Plugins</h1>
          <p className="dm-page-sub">
            Extend the agent. Models, payload packs, and integrations —
            everything plugs into the same brain.
          </p>
        </header>

        <div className="dm-grid-3">
          {FAMILIES.map((f) => (
            <article
              key={f.id}
              className="dm-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                opacity: f.disabled ? 0.72 : 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--dm-4)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--dm-r)',
                    background: 'var(--dm-surface-2)',
                    border: '1px solid var(--dm-border)',
                    color: 'var(--dm-gold-soft)',
                  }}
                >
                  <f.icon size={22} />
                </span>
                <span className={`dm-badge ${f.status === 'Live' ? 'dm-badge-green' : ''}`}>
                  {f.status}
                </span>
              </div>
              <h3 className="dm-card-title">{f.name}</h3>
              <p className="dm-card-sub" style={{ marginBottom: 'var(--dm-2)' }}>
                {f.tagline}
              </p>
              <p
                className="dm-muted"
                style={{
                  fontSize: 'var(--dm-text-sm)',
                  lineHeight: 1.6,
                  margin: '0 0 var(--dm-6)',
                  flex: 1,
                }}
              >
                {f.description}
              </p>
              {f.to ? (
                <Link
                  to={f.to}
                  className="dm-btn dm-btn-secondary"
                  aria-label={`${f.cta} — ${f.name}`}
                >
                  {f.cta} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : (
                <button className="dm-btn dm-btn-ghost" disabled title="Coming soon">
                  {f.cta}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
