/**
 * Landing — Dark Matter public site.
 * Kinetic-type redesign (#292): staggered headline reveals, scroll
 * reveals, marquee accent, weight-shift section headings. Visual and
 * placement only — all links, handlers, and auth logic are unchanged.
 */
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Link2,
  Search,
  FileCheck,
  Lock,
  ShieldCheck,
  Brain,
  Eye,
} from 'lucide-react';
import Logo from '../../components/brand/Logo';
import { KineticHeading, Reveal, Marquee } from '../../components/kinetic/Kinetic';
import '../../styles/kinetic-core.css';
import './Landing.elegant.css';

const STEPS = [
  {
    icon: Link2,
    title: 'Paste your link',
    text: 'Drop in any website you own or are authorized to test. Scope is confirmed before anything runs.',
  },
  {
    icon: Search,
    title: 'AI hunts autonomously',
    text: 'Three specialized brains — vision, grounding, hacking — recon, probe, validate, and chain findings into real attack paths.',
  },
  {
    icon: FileCheck,
    title: 'Get PoC + report',
    text: 'Every confirmed bug ships with a working proof-of-concept and a professional bounty-ready report.',
  },
];

const MARQUEE_ITEMS = [
  'Autonomous recon',
  'PoC-validated bugs',
  'Bounty-ready reports',
  'Vision · Hacking · Grounding',
  'Authorized targets only',
];

function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="ktx-nav" aria-label="Primary">
      <div className="ktx-nav-inner">
        <button
          type="button"
          className="ktx-nav-brand"
          onClick={() => navigate('/')}
          aria-label="Dark Matter home"
        >
          <Logo size={28} />
          <span>Dark Matter</span>
        </button>
        <div className="ktx-nav-links">
          <a href="#how">How it works</a>
          <a href="#brains">The brains</a>
          <a href="#pricing">Pricing</a>
          <div className="ktx-nav-actions">
            <button
              type="button"
              className="ktx-btn ktx-btn-ghost ktx-btn-sm"
              onClick={() => navigate('/login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="ktx-btn ktx-btn-primary ktx-btn-sm"
              onClick={() => navigate('/agent')}
            >
              Start hunting
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  const navigate = useNavigate();
  const [url, setUrl] = React.useState('');
  const start = e => {
    e.preventDefault();
    navigate('/agent');
  };
  return (
    <header className="ktx-hero">
      <div className="ktx-hero-inner">
        <span className="ktx-eyebrow">Autonomous bug-bounty agent</span>
        <KineticHeading
          as="h1"
          className="ktx-hero-heading"
          lines={[{ text: 'Paste a link.' }, { text: 'AI hunts the bugs.', accent: true }]}
        />
        <p className="ktx-hero-sub">
          Dark Matter reconnoiters your target, finds vulnerabilities, proves each one with a
          working PoC, and writes the report — autonomously.
        </p>
        <form className="ktx-hero-form" onSubmit={start}>
          <div className="ktx-hero-input-wrap">
            <Link2 size={18} className="ktx-hero-input-icon" aria-hidden="true" />
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-website.com"
              aria-label="Target website URL"
              className="ktx-hero-input"
            />
          </div>
          <button type="submit" className="ktx-btn ktx-btn-primary ktx-btn-lg">
            Hunt now <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <p className="ktx-hero-note">
          <Lock size={13} aria-hidden="true" /> Only test targets you own or are authorized to
          test.
        </p>
      </div>
    </header>
  );
}

function HowItWorks() {
  return (
    <section className="ktx-section" id="how" aria-labelledby="how-h2">
      <div className="ktx-container-narrow">
        <Reveal className="ktx-section-head">
          <h2 className="ktx-h2" id="how-h2">
            How it works
          </h2>
          <p className="ktx-section-sub">Three steps. Zero manual probing.</p>
        </Reveal>
        <div className="ktx-grid-3 ktx-stagger">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <article className="ktx-card" style={{ '--ktx-i': i }}>
                <div className="ktx-step-row">
                  <span className="ktx-step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <s.icon size={20} className="ktx-step-icon" aria-hidden="true" />
                </div>
                <h3 className="ktx-card-title">{s.title}</h3>
                <p className="ktx-card-sub">{s.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Brains() {
  const brains = [
    { icon: Eye, name: 'Vision Brain', desc: 'Sees your screen. Reads UI, understands context.' },
    {
      icon: Brain,
      name: 'Hacking Brain',
      desc: 'Thinks like a hunter. Chains small vulns into big ones.',
    },
    {
      icon: ShieldCheck,
      name: 'Grounding Brain',
      desc: 'Acts precisely. Clicks, types, navigates with pixel accuracy.',
    },
  ];
  return (
    <section className="ktx-section ktx-section-alt" id="brains" aria-labelledby="brains-h2">
      <div className="ktx-container-narrow">
        <Reveal className="ktx-section-head">
          <h2 className="ktx-h2" id="brains-h2">
            Three brains, one hunter
          </h2>
          <p className="ktx-section-sub">
            Each brain runs on your own machine. Nothing leaves your computer.
          </p>
        </Reveal>
        <div className="ktx-grid-3 ktx-stagger">
          {brains.map((b, i) => (
            <Reveal key={b.name} delay={i * 120}>
              <article className="ktx-card ktx-center" style={{ '--ktx-i': i }}>
                <b.icon size={28} className="ktx-brain-icon" aria-hidden="true" />
                <h3 className="ktx-card-title">{b.name}</h3>
                <p className="ktx-card-sub">{b.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const navigate = useNavigate();
  return (
    <section className="ktx-section ktx-cta-glow" aria-labelledby="cta-h2">
      <div className="ktx-container-narrow ktx-center">
        <Reveal>
          <h2 className="ktx-h2" id="cta-h2">
            Watch it hunt, live.
          </h2>
          <p className="ktx-section-sub" style={{ marginBottom: '2rem' }}>
            Open the console and see Hunt AI think, probe, validate, and report — in real time.
          </p>
          <button
            type="button"
            className="ktx-btn ktx-btn-primary ktx-btn-lg"
            onClick={() => navigate('/agent')}
          >
            Open live hunt <ArrowRight size={18} aria-hidden="true" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}

function Pricing() {
  const navigate = useNavigate();
  const tiers = [
    {
      name: 'Free',
      price: '₹0',
      period: 'forever',
      features: ['3 hunts / month', 'Community feed', 'Standard reports'],
      cta: 'Start free',
      featured: false,
    },
    {
      name: 'Pro',
      price: '₹1,699',
      period: '/ month',
      features: ['Unlimited hunts', 'Priority AI brain', 'PoC replay + PDF', 'API access'],
      cta: 'Go Pro',
      featured: true,
    },
    {
      name: 'Infinity',
      price: 'Custom',
      period: '',
      features: ['Team workspaces', 'SSO + audit log', 'Dedicated infra', 'SLA support'],
      cta: 'Contact us',
      featured: false,
    },
  ];
  return (
    <section className="ktx-section" id="pricing" aria-labelledby="pricing-h2">
      <div className="ktx-container-narrow">
        <Reveal className="ktx-section-head">
          <h2 className="ktx-h2" id="pricing-h2">
            Pricing
          </h2>
          <p className="ktx-section-sub">Start free. Scale when the bounties roll in.</p>
        </Reveal>
        <div className="ktx-grid-3 ktx-stagger">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 120}>
              <article
                className={`ktx-card${t.featured ? ' ktx-card-featured' : ''}`}
                style={{ '--ktx-i': i }}
              >
                {t.featured && <span className="ktx-eyebrow">Most popular</span>}
                <h3 className="ktx-card-title" style={{ marginTop: t.featured ? '1rem' : 0 }}>
                  {t.name}
                </h3>
                <p className="ktx-price">
                  {t.price}
                  {t.period && <span className="ktx-price-period"> {t.period}</span>}
                </p>
                <ul className="ktx-feature-list">
                  {t.features.map(f => (
                    <li key={f}>
                      <Check size={15} className="ktx-feature-check" aria-hidden="true" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`ktx-btn ktx-btn-block ${t.featured ? 'ktx-btn-primary' : 'ktx-btn-ghost'}`}
                  onClick={() => navigate('/agent')}
                >
                  {t.cta}
                </button>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="ktx-footer">
      <div className="ktx-footer-inner">
        <span className="ktx-footer-brand">
          <Logo size={22} /> Dark Matter
        </span>
        <span className="ktx-footer-tag">
          Autonomous bug-bounty hunting. Test only authorized targets.
        </span>
        <span className="ktx-footer-links">
          <Link to="/privacy-policy" className="ktx-footer-link">
            Privacy
          </Link>
          <Link to="/terms" className="ktx-footer-link">
            Terms
          </Link>
        </span>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="ktx-landing">
      <Nav />
      <main>
        <Hero />
        <Marquee items={MARQUEE_ITEMS} label={MARQUEE_ITEMS.join('. ') + '.'} />
        <HowItWorks />
        <Brains />
        <CTA />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}

export default Landing;
