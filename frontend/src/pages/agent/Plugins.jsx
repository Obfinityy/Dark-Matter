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
import '../../styles/kinetic-data.css';
import './Plugins.css';

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
    <div className="dm-page kda-page">
      <div className="dm-container">
        <header className="dm-page-head kda-head">
          <h1 className="dm-page-title kda-title">
            <span className="kda-w" style={{ '--kda-d': '0ms' }}>
              Plugins
            </span>
          </h1>
          <p className="dm-page-sub kda-sub" style={{ '--kda-d': '220ms' }}>
            Extend the agent. Models, payload packs, and integrations — everything plugs into the
            same brain.
          </p>
        </header>

        <div className="dm-grid-3 kda-grid">
          {FAMILIES.map((f, i) => (
            <article
              key={f.id}
              className={`dm-card plugins-card kda-card kda-rise${f.disabled ? ' plugins-card-disabled' : ''}`}
              style={{ animationDelay: `${i * 90}ms` }}
              aria-labelledby={`plugins-${f.id}-name`}
            >
              <div className="plugins-card-head">
                <span className="plugins-icon" aria-hidden="true">
                  <f.icon size={22} />
                </span>
                <span className={`dm-badge ${f.status === 'Live' ? 'dm-badge-green' : ''}`}>
                  {f.status}
                </span>
              </div>
              <h3 className="dm-card-title kda-card-title" id={`plugins-${f.id}-name`}>
                {f.name}
              </h3>
              <p className="dm-card-sub plugins-tagline">{f.tagline}</p>
              <p className="dm-muted plugins-desc">{f.description}</p>
              {f.to ? (
                <Link
                  to={f.to}
                  className="dm-btn dm-btn-secondary plugins-cta"
                  aria-label={`${f.cta} — ${f.name}`}
                >
                  {f.cta} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              ) : (
                <button
                  className="dm-btn dm-btn-ghost plugins-cta"
                  disabled
                  title="Coming soon"
                  aria-label={`${f.name} — coming soon`}
                >
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
