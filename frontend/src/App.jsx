/**
 * App — the root application shell.
 * Sets up client-side routing and the main layout.
 * Dark Matter is a free, local-first product: NO login/signup — opening the
 * app goes straight to the agent console. The backend defaults to the user's
 * own machine (http://localhost:4000).
 * Part of: Dark-Matter frontend (app shell).
 */
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AuthProvider } from './auth/AuthContext';

import './App.css';
import './styles/globals.css';
import './styles/infinity.css';
import './styles/agent.css';
import './styles/polish-pass-payloads-queues-schedules.css';
import './styles/polish-pass-alerts-account-premium.css';
import './styles/polish-pass-coverage-posture-fingerprint.css';
import './styles/polish-pass-surfacemap-diary-terminal.css';
import './styles/polish-pass-attack-surface-r2.css';
import './styles/polish-pass-crew-cvss-dedup.css';
import './styles/polish-pass-export-avatar-bento.css';
import './styles/polish-pass-spotlight-home-hunt.css';
import './styles/polish-pass-errorboundary.css';
import './styles/polish-pass-models-plugins-settings.css';
import './styles/polish-pass-hunt-status.css';
import './styles/ui-refactor.css';
import './styles/animations.css';
import { AgentConsole } from './pages/agent/AgentConsole';
import { Landing } from './pages/Landing/Landing';
import NotFoundPage from './pages/NotFound/NotFound';
import { PageErrorBoundary } from './components/PageErrorBoundary';

/* Shared layout for the legal pages: a centered reading column with a clear
 * heading hierarchy, generous section rhythm, semantic landmarks, and a
 * keyboard-accessible back link. Scoped styling lives in App.css and uses
 * only the design tokens from styles/variables.css. */
const LegalPage = ({ title, updated, children }) => (
  <main className="legal-page">
    <div className="legal-page-inner">
      <Link to="/" className="legal-back">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to app
      </Link>
      <h1 className="sg-h1 legal-title">{title}</h1>
      <p className="sg-body legal-updated">Last updated: {updated}</p>
      <article className="sg-card sg-card-pad">{children}</article>
    </div>
  </main>
);

const PrivacyPolicyPage = () => (
  <LegalPage title="Privacy Policy" updated="October 2026">
    <section>
      <h2 className="sg-h2">1. Data Collection</h2>
      <p className="sg-body">
        We collect minimal data necessary for autonomous security assessments. This includes target
        definitions and findings.
      </p>
    </section>
    <section>
      <h2 className="sg-h2">2. Data Usage</h2>
      <p className="sg-body">
        Data is used strictly to provide the security agent service. We do not sell your data.
      </p>
    </section>
    <section>
      <h2 className="sg-h2">3. Data Security</h2>
      <p className="sg-body">
        All findings are encrypted at rest and in transit. Reports are generated dynamically and
        purged based on your data retention settings.
      </p>
    </section>
  </LegalPage>
);

const TermsConditionsPage = () => (
  <LegalPage title="Terms & Conditions" updated="October 2026">
    <section>
      <h2 className="sg-h2">1. Acceptable Use</h2>
      <p className="sg-body">
        You must only test systems you own or are explicitly authorized to assess. Unauthorized use
        of this autonomous agent is strictly prohibited.
      </p>
    </section>
    <section>
      <h2 className="sg-h2">2. Liability</h2>
      <p className="sg-body">
        Dark Matter is provided &ldquo;as is&rdquo;. We are not responsible for any damage caused by
        automated actions on misconfigured targets.
      </p>
    </section>
    <section>
      <h2 className="sg-h2">3. Account Termination</h2>
      <p className="sg-body">
        We reserve the right to terminate accounts that violate our acceptable use policy
        immediately.
      </p>
    </section>
  </LegalPage>
);

export default function App() {
  const [theme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <AuthProvider>
        {/* A crash in any top-level route must not blank the whole app shell. */}
        <PageErrorBoundary pageName="App">
          <Routes>
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsConditionsPage />} />
            {/* The agent console IS the app: Hunt, Models, Library, Plugins,
                Reports, Settings. No login — straight in. */}
            <Route path="/agent/*" element={<AgentConsole />} />
            {/* Public marketing landing page (issue #45). */}
            <Route path="/landing" element={<Landing />} />
            {/* Root goes straight to the agent console — no login. */}
            <Route path="/" element={<Navigate to="/agent" replace />} />
            {/* Unknown top-level routes get a real 404 page, not a silent redirect. */}
            <Route path="/*" element={<NotFoundPage />} />
          </Routes>
        </PageErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
