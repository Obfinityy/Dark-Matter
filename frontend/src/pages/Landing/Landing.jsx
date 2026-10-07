/**
 * Landing.jsx — Public marketing landing page for Dark-Matter (issue #45).
 *
 * The first-10-users acquisition page. Public route, no auth required.
 * Sections: hero (paste link → autonomous hunt), how-it-works (3 steps),
 * live-hunt CTA, pricing teaser (Free → Infinity). Infinity AI branding
 * only, lucide icons (no emojis), mobile-responsive.
 */
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Zap, FileText, ArrowRight, Check, Link2,
  Search, FlaskConical, FileCheck, Sparkles, Lock,
} from 'lucide-react';
import './Landing.css';
import './Landing.polish.css';
import Logo from '../../components/brand/Logo';

const STEPS = [
  {
    icon: Link2,
    title: 'Paste your link',
    text: 'Drop in any website you own or are authorized to test. Scope rules and program policies are parsed automatically before anything runs.',
  },
  {
    icon: Search,
    title: 'AI hunts autonomously',
    text: 'Hunt AI reconnoiters the target, probes for vulnerabilities, validates every finding, and chains them into real attack paths — all on its own.',
  },
  {
    icon: FileCheck,
    title: 'Get PoC + report',
    text: 'Every confirmed bug ships with a working proof-of-concept and a professional bounty-ready report. No noise, no false positives.',
  },
];

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['3 hunts per month', 'Community findings feed', 'Standard reports'],
    cta: 'Start free',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    features: ['Unlimited hunts', 'Priority AI brain', 'PoC replay + PDF reports', 'API access'],
    cta: 'Go Pro',
    featured: true,
  },
  {
    name: 'Infinity',
    price: 'Custom',
    period: '',
    features: ['Team workspaces', 'SSO + audit log', 'Dedicated infrastructure', 'SLA support'],
    cta: 'Contact us',
    featured: false,
  },
];

function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="lp-nav" aria-label="Primary">
      <div className="lp-nav-inner">
        <button type="button" className="lp-brand" onClick={() => navigate('/')} aria-label="Dark Matter home">
          <Logo size={30} />
          <span>Dark Matter</span>
        </button>
        <ul className="lp-nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><button type="button" className="lp-btn lp-btn-ghost" onClick={() => navigate('/login')}>Sign in</button></li>
          <li><button type="button" className="lp-btn lp-btn-primary" onClick={() => navigate('/agent')}>Start hunting</button></li>
        </ul>
      </div>
    </nav>
  );
}

function Hero() {
  const navigate = useNavigate();
  const [url, setUrl] = React.useState('');
  const start = (e) => {
    e.preventDefault();
    navigate('/agent');
  };
  return (
    <header className="lp-hero">
      <div className="lp-hero-glow" aria-hidden="true" />
      <div className="lp-hero-inner">
        <span className="lp-eyebrow"><Sparkles size={14} aria-hidden="true" /> Autonomous bug-bounty agent</span>
        <h1>
          Paste a link. <span className="lp-gradient">AI hunts the bugs.</span>
        </h1>
        <p className="lp-sub">
          Dark Matter reconnoiters your target, finds vulnerabilities, proves each one
          with a working PoC, and writes the report — all autonomously, better than any human hunter.
        </p>
        <form className="lp-hero-form" onSubmit={start}>
          <div className="lp-url-input">
            <Link2 size={18} aria-hidden="true" />
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-website.com" aria-label="Target website URL"
            />
          </div>
          <button type="submit" className="lp-btn lp-btn-primary lp-btn-lg">
            Hunt now <ArrowRight size={18} />
          </button>
        </form>
        <p className="lp-hero-note"><Lock size={13} /> Only test targets you own or are authorized to test.</p>
        <div className="lp-stats">
          <div><strong>11</strong><span>planner engines</span></div>
          <div><strong>100%</strong><span>autonomous loop</span></div>
          <div><strong>0%</strong><span>false-positive noise</span></div>
        </div>
      </div>
    </header>
  );
}

function HowItWorks() {
  return (
    <section className="lp-section" id="how" aria-labelledby="lp-how-h">
      <h2 id="lp-how-h">How it works</h2>
      <p className="lp-section-sub">Three steps. Zero manual probing.</p>
      <div className="lp-steps">
        {STEPS.map((s, i) => (
          <div key={s.title} className="lp-step">
            <span className="lp-step-num">{i + 1}</span>
            <span className="lp-step-icon"><s.icon size={24} /></span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
      <div className="lp-pipeline" aria-hidden="true">
        <span><Search size={15} /> Recon</span><i>→</i>
        <span><FlaskConical size={15} /> Detection</span><i>→</i>
        <span><Zap size={15} /> PoC</span><i>→</i>
        <span><FileText size={15} /> Report</span>
      </div>
    </section>
  );
}

function LiveHuntCTA() {
  const navigate = useNavigate();
  return (
    <section className="lp-cta" aria-labelledby="lp-cta-h">
      <div className="lp-cta-inner">
        <h2 id="lp-cta-h">Watch it hunt, live.</h2>
        <p>Open the console and see Hunt AI think, probe, validate, and report — in real time.</p>
        <button type="button" className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => navigate('/agent')}>
          Open live hunt <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

function Pricing() {
  const navigate = useNavigate();
  return (
    <section className="lp-section" id="pricing" aria-labelledby="lp-pricing-h">
      <h2 id="lp-pricing-h">Pricing</h2>
      <p className="lp-section-sub">Start free. Scale when the bounties roll in.</p>
      <div className="lp-tiers">
        {TIERS.map((t) => (
          <div key={t.name} className={`lp-tier ${t.featured ? 'lp-tier-featured' : ''}`}>
            {t.featured && <span className="lp-tier-badge">Most popular</span>}
            <h3>{t.name}</h3>
            <p className="lp-tier-price">{t.price}{t.period ? <span>{t.period.startsWith('/') ? t.period : ` ${t.period}`}</span> : null}</p>
            <ul>
              {t.features.map((f) => (
                <li key={f}><Check size={15} className="lp-check" /> {f}</li>
              ))}
            </ul>
            <button
              type="button"
              className={`lp-btn ${t.featured ? 'lp-btn-primary' : 'lp-btn-ghost'}`}
              onClick={() => navigate('/agent')}
            >
              {t.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer">
      <span className="lp-brand"><Logo size={24} /> Dark Matter</span>
      <span className="lp-footer-note">Autonomous bug-bounty hunting. Test only authorized targets.</span>
      <span className="lp-footer-links">
        <Link to="/privacy-policy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </span>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="lp-page">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <LiveHuntCTA />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}

export default Landing;
