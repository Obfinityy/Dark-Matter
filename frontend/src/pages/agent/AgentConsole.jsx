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
 * Dark Matter is free and login-free: no auth gate — the console renders
 * straight away. Kept sections: Hunt, Models, Library (payloads), Plugins,
 * Reports, Settings. (Infinity AI, Premium, Account, Queues and Schedules
 * were removed from the product; their component files stay on disk,
 * unrouted.)
 */
import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext';
import { AgentShell } from '../../components/agent/AgentShell';
import { PageErrorBoundary } from '../../components/PageErrorBoundary';
import { AgentHome } from './AgentHome';
import { HuntView } from './HuntView';
import { ContinuousHuntConsole } from '../../components/hunt/ContinuousHuntConsole';
import { Settings } from './Settings';
import { Reports } from './Reports';
import { ReportReader } from './ReportReader';
import { ModelLibrary } from './ModelLibrary';
import { PayloadLibrary } from './PayloadLibrary';
import { Plugins } from './Plugins';
import '../../styles/kinetic-hunt.css';

/* Kinetic page transition: every route mounts a fresh .khu-page, so the
 * fade-rise entrance replays on navigation. Visual only — no routing or
 * rendering behaviour changes. */
function Page({ children }) {
  return <div className="dm-page khu-page">{children}</div>;
}

/* Route-level document titles — orientation in the tab bar and for
 * screen readers, with no routing or rendering behaviour changes. */
const ROUTE_TITLES = {
  '': 'Hunt AI home',
  hunt: 'Hunt AI',
  settings: 'Settings',
  reports: 'Reports',
  models: 'Models',
  library: 'Payload library',
  plugins: 'Plugins',
};

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const segment = pathname.replace(/^\/agent\/?/, '').split('/')[0];
    document.title = `${ROUTE_TITLES[segment] ?? 'Dark Matter'} · Dark Matter`;
    return () => {
      document.title = 'Dark Matter';
    };
  }, [pathname]);
  return null;
}

export function AgentConsole() {
  return (
    <AuthProvider>
      <AgentShell>
        <RouteTitle />
        <Routes>
            <Route
              index
              element={
                <Page>
                  <PageErrorBoundary pageName="Agent home">
                    <AgentHome />
                  </PageErrorBoundary>
                </Page>
              }
            />
            {/* The Hunt AI page is the continuous-hunt console (new /hunts/* API):
                terminal + chat + voice as the hero. `hunt-live/:huntId` stays
                as an alias for older links. */}
            <Route
              path="hunt/:huntId"
              element={
                <Page>
                  <PageErrorBoundary pageName="Hunt AI">
                    <ContinuousHuntConsole />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route
              path="hunt-live/:huntId"
              element={
                <Page>
                  <PageErrorBoundary pageName="Continuous hunt">
                    <ContinuousHuntConsole />
                  </PageErrorBoundary>
                </Page>
              }
            />
            {/* Legacy single-sweep jobs (old /jobs API) keep their own view. */}
            <Route
              path="hunt-job/:jobId"
              element={
                <Page>
                  <PageErrorBoundary pageName="Hunt AI">
                    <HuntView />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route
            path="settings"
              element={
                <Page>
                  <PageErrorBoundary pageName="Settings">
                    <Settings />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route
              path="reports"
              element={
                <Page>
                  <PageErrorBoundary pageName="Reports">
                    <Reports />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route
              path="reports/:id"
              element={
                <Page>
                  <PageErrorBoundary pageName="Report">
                    <ReportReader />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route
              path="models"
              element={
                <Page>
                  <PageErrorBoundary pageName="Models">
                    <ModelLibrary />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route
              path="library"
              element={
                <Page>
                  <PageErrorBoundary pageName="Payload library">
                    <PayloadLibrary />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route
              path="plugins"
              element={
                <Page>
                  <PageErrorBoundary pageName="Plugins">
                    <Plugins />
                  </PageErrorBoundary>
                </Page>
              }
            />
            <Route path="*" element={<Navigate to="/agent" replace />} />
          </Routes>
      </AgentShell>
    </AuthProvider>
  );
}
