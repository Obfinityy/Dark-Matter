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
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import { AgentShell } from '../../components/agent/AgentShell';
import { Login } from '../Auth/Login';
import { AgentHome } from './AgentHome';
import { HuntView } from './HuntView';
import { Reports } from './Reports';
import { ReportReader } from './ReportReader';
import { ModelLibrary } from './ModelLibrary';
import { Queues } from './Queues';
import { Schedules } from './Schedules';
import { Alerts } from './Alerts';
import { PayloadLibrary } from './PayloadLibrary';
import { Loader2 } from 'lucide-react';

function Gate({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="dm-auth-page">
        <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Signing you in…</div>
      </div>
    );
  }
  if (!user) return <Login />;
  return children;
}

function Page({ children }) {
  return <div className="dm-page">{children}</div>;
}

export function AgentConsole() {
  return (
    <AuthProvider>
      <Gate>
        <AgentShell>
          <Routes>
            <Route index element={<Page><AgentHome /></Page>} />
            <Route path="hunt/:jobId" element={<Page><HuntView /></Page>} />
            <Route path="reports" element={<Page><Reports /></Page>} />
            <Route path="reports/:id" element={<Page><ReportReader /></Page>} />
            <Route path="models" element={<Page><ModelLibrary /></Page>} />
            <Route path="queues" element={<Page><Queues /></Page>} />
            <Route path="schedules" element={<Page><Schedules /></Page>} />
            <Route path="alerts" element={<Page><Alerts /></Page>} />
            <Route path="libraries" element={<Page><PayloadLibrary /></Page>} />
            <Route path="*" element={<Navigate to="/agent" replace />} />
          </Routes>
        </AgentShell>
      </Gate>
    </AuthProvider>
  );
}
