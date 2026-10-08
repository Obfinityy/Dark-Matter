/**
 * Landing — Dark Matter public site.
 * Elegant, professional, quiet confidence. No hype, no neon.
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

function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="dm-nav">
      <div className="dm-nav-inner">
        <button
          type="button"
          className="dm-nav-brand"
          onClick={() => navigate('/')}
          aria-label="Dark Matter home"
        >
          <Logo size={28} />
          <span>Dark Matter</span>
        </button>
        <div className="dm-nav-links">
          <a href="#how">How it works</a>
          <a href="#brains">The brains</a>
          <a href="#pricing">Pricing</a>
          <button
            type="button"
            className="dm-btn dm-btn-ghost dm-btn-sm"
            onClick={() => navigate('/login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className="dm-btn dm-btn-primary dm-btn-sm"
            onClick={() => navigate('/agent')}
          >
            Start hunting
          </button>
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
    <header className="dm-hero">
      <div className="dm-hero-inner">
        <span className="dm-badge dm-badge-gold">Autonomous bug-bounty agent</span>
        <h1>
          Paste a link.
          <br />
          <span className="dm-hero-accent">AI hunts the bugs.</span>
        </h1>
        <p className="dm-hero-sub">
          Dark Matter reconnoiters your target, finds vulnerabilities, proves each one with a
          working PoC, and writes the report — autonomously.
        </p>
        <form className="dm-hero-form" onSubmit={start}>
          <div className="dm-hero-input-wrap">
            <Link2 size={18} className="dm-hero-input-icon" />
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-website.com"
              aria-label="Target website URL"
              className="dm-input dm-hero-input"
            />
          </div>
          <button type="submit" className="dm-btn dm-btn-primary dm-btn-lg">
            Hunt now <ArrowRight size={18} />
          </button>
        </form>
        <p className="dm-hero-note">
          <Lock size={13} /> Only test targets you own or are authorized to test.
        </p>
      </div>
    </header>
  );
}

function HowItWorks() {
  return (
    <section className="dm-section-block" id="how">
      <div className="dm-container-narrow">
        <h2 className="dm-h2">How it works</h2>
        <p className="dm-section-sub">Three steps. Zero manual probing.</p>
        <div className="dm-grid-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="dm-card">
              <div className="dm-step-row">
                <span className="dm-step-num">{i + 1}</span>
                <s.icon size={20} className="dm-step-icon" />
              </div>
              <h3 className="dm-card-title">{s.title}</h3>
              <p className="dm-card-sub" style={{ margin: 0 }}>
                {s.text}
              </p>
            </div>
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
    <section className="dm-section-block dm-section-alt" id="brains">
      <div className="dm-container-narrow">
        <h2 className="dm-h2">Three brains, one hunter</h2>
        <p className="dm-section-sub">
          Each brain runs on your own machine. Nothing leaves your computer.
        </p>
        <div className="dm-grid-3">
          {brains.map(b => (
            <div key={b.name} className="dm-card dm-center">
              <b.icon
                size={28}
                style={{ color: 'var(--dm-gold-soft)', marginBottom: 'var(--dm-3)' }}
              />
              <h3 className="dm-card-title">{b.name}</h3>
              <p className="dm-card-sub" style={{ margin: 0 }}>
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const navigate = useNavigate();
  return (
    <section className="dm-cta-block">
      <div className="dm-container-narrow dm-center">
        <h2 className="dm-h2">Watch it hunt, live.</h2>
        <p className="dm-section-sub" style={{ marginBottom: 'var(--dm-6)' }}>
          Open the console and see Hunt AI think, probe, validate, and report — in real time.
        </p>
        <button
          type="button"
          className="dm-btn dm-btn-primary dm-btn-lg"
          onClick={() => navigate('/agent')}
        >
          Open live hunt <ArrowRight size={18} />
        </button>
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
    <section className="dm-section-block" id="pricing">
      <div className="dm-container-narrow">
        <h2 className="dm-h2">Pricing</h2>
        <p className="dm-section-sub">Start free. Scale when the bounties roll in.</p>
        <div className="dm-grid-3">
          {tiers.map(t => (
            <div
              key={t.name}
              className="dm-card"
              style={
                t.featured
                  ? { borderColor: 'var(--dm-gold-border)', background: 'var(--dm-gold-glow)' }
                  : undefined
              }
            >
              {t.featured && (
                <span className="dm-badge dm-badge-gold" style={{ marginBottom: 'var(--dm-3)' }}>
                  Most popular
                </span>
              )}
              <h3 className="dm-card-title">{t.name}</h3>
              <p
                style={{
                  fontSize: 'var(--dm-text-3xl)',
                  fontWeight: 700,
                  margin: 'var(--dm-2) 0',
                  letterSpacing: '-0.02em',
                }}
              >
                {t.price}
                {t.period && (
                  <span
                    style={{
                      fontSize: 'var(--dm-text-sm)',
                      fontWeight: 400,
                      color: 'var(--dm-muted)',
                    }}
                  >
                    {t.period}
                  </span>
                )}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 var(--dm-5)',
                  display: 'grid',
                  gap: 'var(--dm-2)',
                }}
              >
                {t.features.map(f => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      gap: 'var(--dm-2)',
                      fontSize: 'var(--dm-text-sm)',
                      color: 'var(--dm-text-2)',
                    }}
                  >
                    <Check
                      size={15}
                      style={{ color: 'var(--dm-gold-soft)', flexShrink: 0, marginTop: '2px' }}
                    />{' '}
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`dm-btn dm-btn-block ${t.featured ? 'dm-btn-primary' : 'dm-btn-secondary'}`}
                onClick={() => navigate('/agent')}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="dm-footer">
      <div className="dm-footer-inner">
        <span className="dm-nav-brand">
          <Logo size={22} /> Dark Matter
        </span>
        <span className="dm-muted" style={{ fontSize: 'var(--dm-text-sm)' }}>
          Autonomous bug-bounty hunting. Test only authorized targets.
        </span>
        <span style={{ display: 'flex', gap: 'var(--dm-4)' }}>
          <Link to="/privacy-policy" className="dm-footer-link">
            Privacy
          </Link>
          <Link to="/terms" className="dm-footer-link">
            Terms
          </Link>
        </span>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="dm-landing">
      <Nav />
      <main>
        <Hero />
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
