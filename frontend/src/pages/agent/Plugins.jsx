/**
 * Plugins — the extension surface for DarkMatter.
 *
 * Three plugin families, each wired to the page that already implements it:
 *   🧠 Model plugins   → Models page (local / remote-GPU / Kaggle / Colab brains)
 *   📦 Payload plugins → Payload library (self-learning payload packs)
 *   🔌 API plugins     → external integrations (docs / coming soon)
 *
 * This page is the directory; the heavy lifting lives in the linked pages.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Blocks, Brain, Package, Plug, ArrowRight } from 'lucide-react';
import './Plugins.css';

const FAMILIES = [
  {
    id: 'models',
    icon: Brain,
    name: 'Model plugins',
    tagline: 'Brains the agent can run on.',
    description:
      'Local uncensored models, remote GPUs, Kaggle and Colab connections. ' +
      'Download a model, press Run, and it becomes the brain behind both Hunt and Infinity AI.',
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
    <div className="sg-plugins">
      <header className="sg-plugins-head">
        <h2 className="sg-h1"><Blocks size={26} /> Plugins</h2>
        <p className="sg-body">
          Extend the agent. Models, payload packs, and integrations —
          everything plugs into the same brain.
        </p>
      </header>

      <div className="sg-plugins-grid">
        {FAMILIES.map((f) => (
          <article key={f.id} className="sg-card sg-card-pad sg-plugin-card">
            <span className="sg-plugin-icon"><f.icon size={22} /></span>
            <div className="sg-plugin-top">
              <h3 className="sg-h2">{f.name}</h3>
              <span className={`sg-pill ${f.status === 'Live' ? 'sg-pill-go' : ''}`}>{f.status}</span>
            </div>
            <p className="sg-plugin-tagline">{f.tagline}</p>
            <p className="sg-small">{f.description}</p>
            {f.to ? (
              <Link to={f.to} className="sg-btn sg-btn-ghost sg-plugin-cta">
                {f.cta} <ArrowRight size={15} />
              </Link>
            ) : (
              <button className="sg-btn sg-btn-ghost sg-plugin-cta" disabled>
                {f.cta}
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
