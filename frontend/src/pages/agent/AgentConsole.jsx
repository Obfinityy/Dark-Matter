/**
 * AgentConsole — the agent console's self-contained route tree.
 *
 * Mount this ONCE inside the host app's router at `/agent/*`, e.g.:
 *
 *   import { AuthProvider } from './auth/AuthContext';   // path as installed
 *   import { AgentConsole } from './pages/agent/AgentConsole';
 *   import './styles/agent.css';
 *
 *   <Route path="/agent/*" element={<AgentConsole />} />
 *
 * It brings its own auth gate (shows <Login/> when signed out) and the
 * AgentShell chrome (sidebar + top bar), so the host app needs no other
 * wiring. Every page is wrapped in `.dm-page` for consistent padding.
 */
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import { AgentShell } from '../../components/agent/AgentShell';
import { PageErrorBoundary } from '../../components/PageErrorBoundary';
import { Login } from '../Auth/Login';
import { AgentHome } from './AgentHome';
import { HuntView } from './HuntView';
import { InfinityAI } from './InfinityAI';
import { Settings } from './Settings';
import { Reports } from './Reports';
import { ReportReader } from './ReportReader';
import { ModelLibrary } from './ModelLibrary';
import { PayloadLibrary } from './PayloadLibrary';
import { Plugins } from './Plugins';
import { Premium } from './Premium';
import { Account } from './Account';
import { Queues } from './Queues';
import { Schedules } from './Schedules';
import { Loader2 } from 'lucide-react';

function Gate({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="dm-auth-page">
        <div className="dm-page-loading" role="status" aria-label="Signing in">
          <Loader2 size={18} className="dm-spin" aria-hidden="true" /> Signing you in…
        </div>
      </div>
    );
  }
  if (!user) return <Login />;
  return children;
}

function Page({ children }) {
  return <div className="dm-page">{children}</div>;
}

/* Route-level document titles — orientation in the tab bar and for
 * screen readers, with no routing or rendering behaviour changes. */
const ROUTE_TITLES = {
  '': 'Agent home',
  hunt: 'Hunt AI',
  infinity: 'Infinity AI',
  settings: 'Settings',
  reports: 'Reports',
  models: 'Models',
  library: 'Payload library',
  plugins: 'Plugins',
  premium: 'Premium',
  account: 'Account',
  queues: 'Queues',
  schedules: 'Schedules',
};

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const segment = pathname.replace(/^\/agent\/?/, '').split('/')[0];
    document.title = `${ROUTE_TITLES[segment] ?? 'Dark Matter'} · Dark Matter`;
    return () => { document.title = 'Dark Matter'; };
  }, [pathname]);
  return null;
}

export function AgentConsole() {
  return (
    <AuthProvider>
      <Gate>
        <AgentShell>
          <RouteTitle />
          <Routes>
            <Route index element={<Page><PageErrorBoundary pageName="Agent home"><AgentHome /></PageErrorBoundary></Page>} />
            <Route path="hunt/:jobId" element={<Page><PageErrorBoundary pageName="Hunt AI"><HuntView /></PageErrorBoundary></Page>} />
            <Route path="infinity" element={<Page><PageErrorBoundary pageName="Infinity AI"><InfinityAI /></PageErrorBoundary></Page>} />
            <Route path="settings" element={<Page><PageErrorBoundary pageName="Settings"><Settings /></PageErrorBoundary></Page>} />
            <Route path="reports" element={<Page><PageErrorBoundary pageName="Reports"><Reports /></PageErrorBoundary></Page>} />
            <Route path="reports/:id" element={<Page><PageErrorBoundary pageName="Report"><ReportReader /></PageErrorBoundary></Page>} />
            <Route path="models" element={<Page><PageErrorBoundary pageName="Models"><ModelLibrary /></PageErrorBoundary></Page>} />
            <Route path="library" element={<Page><PageErrorBoundary pageName="Payload library"><PayloadLibrary /></PageErrorBoundary></Page>} />
            <Route path="plugins" element={<Page><PageErrorBoundary pageName="Plugins"><Plugins /></PageErrorBoundary></Page>} />
            <Route path="premium" element={<Page><PageErrorBoundary pageName="Premium"><Premium /></PageErrorBoundary></Page>} />
            <Route path="account" element={<Page><PageErrorBoundary pageName="Account"><Account /></PageErrorBoundary></Page>} />
            <Route path="queues" element={<Page><PageErrorBoundary pageName="Queues"><Queues /></PageErrorBoundary></Page>} />
            <Route path="schedules" element={<Page><PageErrorBoundary pageName="Schedules"><Schedules /></PageErrorBoundary></Page>} />
            <Route path="*" element={<Navigate to="/agent" replace />} />
          </Routes>
        </AgentShell>
      </Gate>
    </AuthProvider>
  );
}
