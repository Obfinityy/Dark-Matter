// Landing page — the logged-out front door of Dark Matter (issue 489).
// Rendered by App.jsx in place of ChatPage when page === 'chat' and there
// is no logged-in user. The sidebar/topbar shell around it is unchanged.
// Everything on this page is honest about the product: the app mock below
// the hero is a static illustration built from the real hunt-card classes
// with clearly labelled sample data — not a screenshot, not real findings.
// Pricing states the one price that exists in the repo (UpiPayPage.jsx):
// Rs 10,000 for 1 day of access, paid via UPI, admin-verified within 24h.
// There are no tiers.
import React from 'react';
import './LandingPage.css';
import { openAuthModal } from '../lib/auth';

function scrollToSection(id) {
  try {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch { /* ignore */ }
}

// Inline icons in the house style: 1.8-stroke SVGs, no emoji.
function Icon({ d, children }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d ? <path d={d} /> : children}
    </svg>
  );
}

const ICONS = {
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2l8 3v6c0 5-3.5 9.3-8 11-4.5-1.7-8-6-8-11V5l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  chain: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
  monitor: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  report: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </>
  ),
  brain: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
};

const NAV_LINKS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'security', label: 'Security' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
];

const STEPS = [
  {
    icon: ICONS.target,
    title: 'Authorize a target',
    text: 'Name the target and confirm you are authorized to test it. No hunt starts without that confirmation — authorization is a required step, not a checkbox you can skip.',
  },
  {
    icon: ICONS.search,
    title: 'The hunter works',
    text: 'The agent plans, probes, and tests on your own machine — thinking out loud in a live terminal feed you can watch, steer, or pause at any time.',
  },
  {
    icon: ICONS.shield,
    title: 'Verified findings with proof',
    text: 'Every candidate finding is probed again with true/false controls. False positives are rejected. What survives ships with reproduction steps in a report you can submit.',
  },
];

const FEATURES = [
  {
    icon: ICONS.search,
    title: 'Autonomous hunting',
    text: 'A multi-agent brain — Orchestrator, Researcher, Developer, Executor — plans and runs the hunt while you watch or steer it.',
  },
  {
    icon: ICONS.shield,
    title: 'Verification that rejects false positives',
    text: 'Differential probes test each candidate against true and false controls. Unconfirmed findings are labelled as such — never reported as real.',
  },
  {
    icon: ICONS.chain,
    title: 'Exploit-chain analysis',
    text: 'Findings are combined into chains — read plus write becomes remote code execution — so mediums that chain into criticals are treated as criticals.',
  },
  {
    icon: ICONS.monitor,
    title: 'Live machine view',
    text: 'Follow the hunt live: the terminal feed, the machine it runs on, and the findings as they land.',
  },
  {
    icon: ICONS.report,
    title: 'Reports with proof',
    text: 'A report any time, even mid-hunt, in Markdown or PDF — findings first, exploit chains first, with reproduction steps.',
  },
  {
    icon: ICONS.brain,
    title: 'You are the brain',
    text: 'Pause any hunt at a checkpoint and drive it yourself from the Brain Console. The agent waits for your call — nothing moves without you.',
  },
];

const SECURITY_POINTS = [
  'Hunts run only on targets you name and confirm you are authorized to test.',
  'Non-destructive by design — the hunter probes; it does not damage, deface, or disrupt.',
  'Every finding is verified before it is reported. Unconfirmed findings are labelled, not hidden.',
  'Hunt execution runs on your own machine. The hosted backend only orchestrates.',
  'You can pause, resume, or stop a hunt at any time — and take over manually.',
  'AI output needs human review. Validate a finding before you act on it or disclose it.',
];

const FAQS = [
  {
    q: 'What is Dark Matter?',
    a: 'Dark Matter is an autonomous AI bug-bounty agent built by Obfinity. You point it at a target you are authorized to test, and it hunts for vulnerabilities, verifies each one with real probes, and produces a report with proof — ready to submit to a bug-bounty program.',
  },
  {
    q: 'Do I need authorization to test a target?',
    a: 'Yes — always. Dark Matter only hunts targets you own or have explicit, current authorization to test. Starting a hunt requires you to name the target and confirm your authorization, and testing without permission is against the terms of service.',
  },
  {
    q: 'How does verification work?',
    a: 'A candidate finding is not trusted on first sight. The agent runs differential probes — true and false controls for the same vulnerability class — and marks each finding confirmed, unconfirmed, or rejected. Rejected findings (false positives) are dropped; only verified findings are reported as real.',
  },
  {
    q: 'What do I get from a hunt?',
    a: 'A live terminal feed while the hunt runs, a findings list with severity and verification status, exploit-chain analysis that shows how findings combine, and a report in Markdown or PDF at any time — including mid-hunt. You can also chat with the agent during a hunt to steer it.',
  },
  {
    q: 'How do I get access?',
    a: 'Request access and create an account — an admin reviews every account. To start hunting right away, pay ₹10,000 through any UPI app: submit the payment details and an admin verifies them, and your account is activated for 1 day within 24 hours of verification.',
  },
];

export default function LandingPage({ onNavigate, onRequestAccess }) {
  const requestAccess = () => {
    if (typeof onRequestAccess === 'function') onRequestAccess();
    else openAuthModal('login');
  };
  const logIn = () => openAuthModal('login');

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <button type="button" className="lp-brand" onClick={() => scrollToSection('top')} aria-label="Dark Matter — back to top">
            <img src="/dark-matter-symbol.png" alt="" width="28" height="28" className="lp-brand-symbol" />
            <span className="lp-brand-wordmark">DARK MATTER</span>
          </button>
          <nav className="lp-nav-links" aria-label="Sections">
            {NAV_LINKS.map((l) => (
              <button key={l.id} type="button" className="lp-nav-link" onClick={() => scrollToSection(l.id)}>
                {l.label}
              </button>
            ))}
          </nav>
          <div className="lp-nav-actions">
            <button type="button" className="btn btn-ghost" onClick={logIn}>Log in</button>
            <button type="button" className="btn btn-primary" onClick={requestAccess}>Request access</button>
          </div>
        </div>
      </header>

      <main className="lp-main" id="top">
        <section className="lp-hero">
          <p className="lp-eyebrow">Autonomous AI bug-bounty agent</p>
          <h1 className="lp-hero-title">An AI agent that hunts vulnerabilities — and proves them.</h1>
          <p className="lp-hero-sub">
            Dark Matter hunts, verifies, and reports vulnerabilities on targets you are
            authorized to test. It probes like an attacker, rejects its own false
            positives, and hands you findings with proof — ready to submit.
          </p>
          <div className="lp-hero-ctas">
            <button type="button" className="btn btn-primary lp-cta" onClick={requestAccess}>Request access</button>
            <button type="button" className="btn btn-ghost lp-cta" onClick={() => scrollToSection('how-it-works')}>See how it works</button>
          </div>
          <p className="lp-hero-note">Authorized targets only · Non-destructive · You stay in control</p>

          <figure className="lp-mock" aria-label="Illustrative example of the Dark Matter hunt view">
            <div className="hunt-card">
              <div className="hunt-statusline">
                <span className="status-pill status-running"><span className="dot" aria-hidden="true" />Running</span>
                <span className="hunt-id-badge" title="Sample hunt ID">hunt-9f3a2c</span>
                <span className="hunt-status-text">Hunting example.com</span>
              </div>
              <div className="hunt-feed" aria-hidden="true">
                <div className="log-line log-think"><span className="log-prefix">think</span>Mapping the target — 14 routes found, 3 take user input.</div>
                <div className="log-line log-tool"><span className="log-prefix">tool</span>Probing search parameter for reflected input…</div>
                <div className="log-line log-finding"><span className="log-prefix">finding</span>Candidate: reflected XSS on /search?q= — running control probes.</div>
                <div className="log-line log-tool"><span className="log-prefix">tool</span>Control probe: benign input returns no script execution. True probe: payload executes.</div>
                <div className="log-line log-finding"><span className="log-prefix">finding</span>Verified: reflected XSS. Writing reproduction steps.</div>
              </div>
              <div className="lp-mock-findings">
                <div className="finding sev-high">
                  <span className="finding-sev">High</span>
                  <span className="finding-title">Reflected XSS — Verified</span>
                  <span className="finding-badge finding-verified">Verified</span>
                  <div className="finding-detail">/search?q= reflects input without encoding. Payload executes in the victim&apos;s browser. Reproduction steps included in the report.</div>
                </div>
                <div className="finding sev-medium">
                  <span className="finding-sev">Medium</span>
                  <span className="finding-title">Missing security headers — Verified</span>
                  <span className="finding-badge finding-verified">Verified</span>
                  <div className="finding-detail">Content-Security-Policy and X-Frame-Options are not set on the main application.</div>
                </div>
              </div>
            </div>
            <figcaption className="lp-mock-caption">
              Illustrative example — sample data from a demonstration hunt against example.com, not real findings.
            </figcaption>
          </figure>
        </section>

        <section className="lp-section" id="how-it-works">
          <h2>How it works</h2>
          <p className="lp-section-sub">Three steps from a target to a submittable report.</p>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <article key={s.title} className="lp-step">
                <span className="lp-step-icon" aria-hidden="true"><Icon>{s.icon}</Icon></span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="features">
          <h2>What it does</h2>
          <p className="lp-section-sub">Capabilities that exist in the product today.</p>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feature">
                <span className="lp-feature-icon" aria-hidden="true"><Icon>{f.icon}</Icon></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="security">
          <h2>Built for authorized testing only</h2>
          <p className="lp-section-sub">Security research, with the guardrails that make it responsible.</p>
          <ul className="lp-security-list">
            {SECURITY_POINTS.map((point) => (
              <li key={point}>
                <span className="lp-check" aria-hidden="true"><Icon>{ICONS.check}</Icon></span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section" id="pricing">
          <h2>Pricing</h2>
          <p className="lp-section-sub">One flat price. No tiers.</p>
          <div className="lp-price-card">
            <p className="lp-price-amount">₹10,000</p>
            <p className="lp-price-term">1 day of access</p>
            <p className="lp-price-detail">
              Pay through any UPI app, then submit the payment details. An admin
              verifies the payment and activates your account within 24 hours of
              verification.
            </p>
            <button type="button" className="btn btn-primary lp-cta" onClick={requestAccess}>Request access</button>
            <p className="lp-price-note">
              Access is granted by an admin after review. The ₹10,000 UPI payment is
              the fast path to one day of access.
            </p>
          </div>
        </section>

        <section className="lp-section" id="faq">
          <h2>Frequently asked questions</h2>
          <div className="lp-faq-list">
            {FAQS.map((f) => (
              <details key={f.q} className="lp-faq">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <img src="/dark-matter-symbol.png" alt="" width="24" height="24" className="lp-brand-symbol" />
            <span className="lp-footer-wordmark">DARK MATTER</span>
            <span className="lp-footer-sub">Infinity AI · Built by Obfinity</span>
          </div>
          <nav className="lp-footer-links" aria-label="Legal">
            <button type="button" className="lp-footer-link" onClick={() => onNavigate && onNavigate('privacy')}>Privacy Policy</button>
            <button type="button" className="lp-footer-link" onClick={() => onNavigate && onNavigate('terms')}>Terms of Service</button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
