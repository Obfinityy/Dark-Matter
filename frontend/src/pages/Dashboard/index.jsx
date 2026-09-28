import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, Clock,
  Globe, Layers, Loader2, Plus, Search, Shield, ShieldAlert,
  TrendingUp, Zap
} from 'lucide-react';
import { listAssessments } from '../../services/api';

function elapsed(start, end) {
  if (!start) return '--';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const secs = Math.floor((e - s) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function statusBadge(status) {
  const map = {
    created: { bg: 'var(--accent-transparent)', color: 'var(--accent)' },
    scope_validation: { bg: 'var(--accent-transparent)', color: 'var(--accent)' },
    planning: { bg: 'var(--accent-transparent)', color: 'var(--accent)' },
    running: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' },
    paused: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' },
    completed: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' },
    failed: { bg: 'var(--danger-transparent)', color: 'var(--danger)' },
    stopped: { bg: 'rgba(100, 116, 139, 0.15)', color: 'var(--text-muted)' }
  };
  const s = map[status] || map.created;
  return (
    <span className="dashboard-status-badge" style={{ background: s.bg, color: s.color }}>
      {status === 'running' && <span className="status-pulse-sm" />}
      {status}
    </span>
  );
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAssessments()
      .then(res => {
        if (!cancelled) setAssessments(res.assessments || []);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'Failed to load assessments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activeCount = assessments.filter(a => ['running', 'planning', 'scope_validation'].includes(a.status)).length;
  const completedCount = assessments.filter(a => a.status === 'completed').length;
  const totalFindings = assessments.reduce((sum, a) => sum + (a.findingsCount || 0), 0);
  const totalAssets = assessments.reduce((sum, a) => sum + (a.assetsDiscovered || 0), 0);

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Command Center</h1>
          <p className="dashboard-subtitle">Autonomous security operations overview</p>
        </div>
        <button className="btn dashboard-new-btn" onClick={() => navigate('/new')}>
          <Plus size={16} /> New Assessment
        </button>
      </div>

      {/* Stats grid */}
      <div className="dashboard-stats-grid">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrap active"><Activity size={20} /></div>
          <div>
            <div className="dashboard-stat-value">{activeCount}</div>
            <div className="dashboard-stat-label">Active Assessments</div>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrap success"><CheckCircle2 size={20} /></div>
          <div>
            <div className="dashboard-stat-value">{completedCount}</div>
            <div className="dashboard-stat-label">Completed</div>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrap warning"><ShieldAlert size={20} /></div>
          <div>
            <div className="dashboard-stat-value">{totalFindings}</div>
            <div className="dashboard-stat-label">Total Findings</div>
          </div>
        </div>
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon-wrap info"><Search size={20} /></div>
          <div>
            <div className="dashboard-stat-value">{totalAssets}</div>
            <div className="dashboard-stat-label">Assets Discovered</div>
          </div>
        </div>
      </div>

      {/* Assessments list */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <h2><Layers size={18} /> Assessments</h2>
          <span className="dashboard-section-count">{assessments.length} total</span>
        </div>

        {loading && (
          <div className="dashboard-loading"><Loader2 size={20} className="animate-spin" /> Loading assessments...</div>
        )}

        {error && (
          <div className="dashboard-error"><AlertTriangle size={16} /> {error}</div>
        )}

        {!loading && !error && assessments.length === 0 && (
          <div className="dashboard-empty">
            <Shield size={40} />
            <h3>No Assessments Yet</h3>
            <p>Start your first authorized security assessment to see live activity here.</p>
            <button className="btn dashboard-new-btn" onClick={() => navigate('/new')}>
              <Plus size={16} /> Start Assessment
            </button>
          </div>
        )}

        {!loading && !error && assessments.length > 0 && (
          <div className="assessment-cards-grid">
            {assessments.map(a => (
              <div
                key={a.id}
                className="assessment-card"
                onClick={() => navigate(`/assessment/${a.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="assessment-card-top">
                  <div className="assessment-card-target">
                    <Globe size={14} />
                    <span>{a.targetHostname || a.targetUrl || 'Unknown'}</span>
                  </div>
                  {statusBadge(a.status)}
                </div>
                <div className="assessment-card-stats">
                  <span><Search size={12} /> {a.assetsDiscovered || 0} assets</span>
                  <span><Zap size={12} /> {a.toolsExecuted || 0} tools</span>
                  <span><ShieldAlert size={12} /> {a.findingsCount || 0} findings</span>
                </div>
                <div className="assessment-card-footer">
                  <span className="assessment-card-phase">{a.phase}</span>
                  <span className="assessment-card-time">
                    <Clock size={12} /> {elapsed(a.startedAt || a.createdAt, a.completedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
