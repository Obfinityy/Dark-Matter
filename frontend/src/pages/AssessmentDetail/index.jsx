import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, BarChart3,
  CheckCircle2, Clock, Copy, Download, FileText,
  Globe, Layers, Link, Loader2, MessageSquare, Pause,
  Play, Search, Send, Shield, ShieldAlert, Square,
  Terminal, TrendingUp, Zap
} from 'lucide-react';
import {
  apiClient,
  getAssessment,
  getAssessmentTimeline,
  getAssessmentFindings,
  getAssessmentToolExecutions,
  sendAssessmentChat,
  pauseAssessment,
  resumeAssessment,
  stopAssessment,
  generateReport,
  getLatestReport,
  subscribeToAssessmentEvents
} from '../../services/api';

function formatTime(timestamp) {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? String(timestamp) : d.toLocaleTimeString([], { hour12: false });
}

function formatDate(timestamp) {
  if (!timestamp) return '--';
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? '--' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function elapsed(start, end) {
  if (!start) return '--';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const secs = Math.floor((e - s) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function severityColor(severity) {
  const map = { critical: 'var(--danger)', high: '#f97316', medium: 'var(--warning)', low: 'var(--info)', informational: 'var(--text-muted)' };
  return map[severity] || 'var(--text-secondary)';
}

function statusBadge(status) {
  const map = {
    created: { bg: 'var(--accent-transparent)', color: 'var(--accent)', label: 'Created' },
    scope_validation: { bg: 'var(--accent-transparent)', color: 'var(--accent)', label: 'Validating' },
    planning: { bg: 'var(--accent-transparent)', color: 'var(--accent)', label: 'Planning' },
    running: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', label: 'Running' },
    paused: { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', label: 'Paused' },
    completed: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', label: 'Completed' },
    failed: { bg: 'var(--danger-transparent)', color: 'var(--danger)', label: 'Failed' },
    stopped: { bg: 'rgba(100, 116, 139, 0.15)', color: 'var(--text-muted)', label: 'Stopped' }
  };
  const s = map[status] || map.created;
  return <span className="assessment-status-badge" style={{ background: s.bg, color: s.color }}>{status === 'running' && <span className="status-pulse-sm" />}{s.label}</span>;
}

const TABS = [
  { id: 'terminal', icon: Terminal, label: 'Live Terminal' },
  { id: 'findings', icon: ShieldAlert, label: 'Findings' },
  { id: 'tools', icon: Zap, label: 'Tool Executions' },
  { id: 'timeline', icon: Clock, label: 'Timeline' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'report', icon: FileText, label: 'Report' },
];

export const AssessmentDetail = () => {
  const { id: assessmentId } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [events, setEvents] = useState([]);
  const [findings, setFindings] = useState([]);
  const [toolExecs, setToolExecs] = useState([]);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('terminal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSending, setChatSending] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const terminalEndRef = useRef(null);
  const unsubRef = useRef(null);
  const pollRef = useRef(null);

  // Load assessment data
  const loadData = useCallback(async () => {
    try {
      const a = await getAssessment(assessmentId);
      setAssessment(a);
      setChatMessages(a.messages || []);
      const [timelineRes, findingsRes, toolsRes] = await Promise.all([
        getAssessmentTimeline(assessmentId).catch(() => ({ events: [] })),
        getAssessmentFindings(assessmentId).catch(() => ({ findings: [] })),
        getAssessmentToolExecutions(assessmentId).catch(() => ({ executions: [] }))
      ]);
      setEvents(timelineRes.events || []);
      setFindings(findingsRes.findings || []);
      setToolExecs(toolsRes.executions || []);
      // Try to load report
      getLatestReport(assessmentId).then(r => setReport(r)).catch(() => {});
    } catch (err) {
      setError(err.message || 'Failed to load assessment');
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    loadData();
    return () => {
      unsubRef.current?.();
      clearInterval(pollRef.current);
    };
  }, [loadData]);

  // SSE subscription for live events
  useEffect(() => {
    if (!assessment || ['completed', 'failed', 'stopped'].includes(assessment.status)) {
      setConnectionStatus(assessment?.status === 'completed' ? 'completed' : assessment?.status || 'idle');
      return;
    }
    unsubRef.current?.();
    setConnectionStatus('connecting');
    unsubRef.current = subscribeToAssessmentEvents(assessmentId, {
      onOpen: () => setConnectionStatus('connected'),
      onEvent: (event) => {
        setEvents(prev => prev.some(e => e.id === event.id) ? prev : [...prev, event]);
        // Update assessment stats on certain events
        if (['ASSESSMENT_COMPLETED', 'ASSESSMENT_FAILED', 'ASSESSMENT_STOPPED', 'ASSESSMENT_PAUSED'].includes(event.type)) {
          loadData();
        }
      },
      onError: () => setConnectionStatus('error')
    });
    return () => unsubRef.current?.();
  }, [assessment?.status, assessmentId]);

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [events, activeTab]);

  // Periodic refresh for stats
  useEffect(() => {
    if (assessment && ['running', 'paused'].includes(assessment.status)) {
      pollRef.current = setInterval(() => {
        getAssessment(assessmentId).then(a => setAssessment(a)).catch(() => {});
      }, 10_000);
      return () => clearInterval(pollRef.current);
    }
  }, [assessment?.status, assessmentId]);

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      if (action === 'pause') await pauseAssessment(assessmentId);
      if (action === 'resume') await resumeAssessment(assessmentId);
      if (action === 'stop') await stopAssessment(assessmentId);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatSending) return;
    const msg = chatInput.trim();
    setChatSending(true);
    setChatMessages(prev => [...prev, { role: 'user', content: msg, createdAt: new Date().toISOString() }]);
    setChatInput('');
    try {
      const res = await sendAssessmentChat(assessmentId, msg);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.message, createdAt: new Date().toISOString() }]);
      if (['paused', 'stopped', 'running'].includes(res.status)) {
        await loadData();
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, createdAt: new Date().toISOString() }]);
    } finally {
      setChatSending(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const r = await generateReport(assessmentId);
      setReport(r);
      setActiveTab('report');
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const copyTerminal = () => {
    const text = events.map(e => `[${formatTime(e.timestamp)}] ${(e.level || 'INFO').padEnd(8)} ${e.message}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="assessment-loading"><Loader2 size={24} className="animate-spin" /> Loading assessment...</div>;
  }
  if (error && !assessment) {
    return <div className="assessment-error"><AlertCircle size={20} /> {error}</div>;
  }
  if (!assessment) return null;

  const isActive = ['running', 'planning', 'scope_validation'].includes(assessment.status);
  const isPaused = assessment.status === 'paused';
  const isFinished = ['completed', 'failed', 'stopped'].includes(assessment.status);

  return (
    <div className="assessment-detail animate-fade-in">
      {/* Header */}
      <div className="assessment-detail-header">
        <div className="assessment-detail-header-left">
          <button className="btn assessment-back-btn" onClick={() => navigate('/')}><ArrowLeft size={18} /></button>
          <div className="assessment-detail-header-info">
            <div className="assessment-detail-target">
              <Globe size={16} /> {assessment.targetHostname || assessment.targetUrl}
              {statusBadge(assessment.status)}
            </div>
            <div className="assessment-detail-meta">
              <span><Clock size={12} /> {elapsed(assessment.startedAt || assessment.createdAt, assessment.completedAt)}</span>
              <span><Layers size={12} /> Phase: {assessment.phase}</span>
              <span><Activity size={12} /> Iteration {assessment.iterationCount || 0}</span>
            </div>
          </div>
        </div>
        <div className="assessment-detail-actions">
          {isActive && (
            <>
              <button className="btn assessment-action-btn" onClick={() => handleAction('pause')} disabled={!!actionLoading}>
                {actionLoading === 'pause' ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />} Pause
              </button>
              <button className="btn assessment-action-btn danger" onClick={() => handleAction('stop')} disabled={!!actionLoading}>
                {actionLoading === 'stop' ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} Stop
              </button>
            </>
          )}
          {isPaused && (
            <button className="btn assessment-action-btn primary" onClick={() => handleAction('resume')} disabled={!!actionLoading}>
              {actionLoading === 'resume' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Resume
            </button>
          )}
          {isFinished && (
            <button className="btn assessment-action-btn primary" onClick={handleGenerateReport} disabled={generatingReport}>
              {generatingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {report ? 'Regenerate Report' : 'Generate Report'}
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="assessment-stats-bar">
        <div className="assessment-stat-card">
          <div className="assessment-stat-icon"><Search size={16} /></div>
          <div className="assessment-stat-data">
            <div className="assessment-stat-value">{assessment.assetsDiscovered || 0}</div>
            <div className="assessment-stat-label">Assets</div>
          </div>
        </div>
        <div className="assessment-stat-card">
          <div className="assessment-stat-icon"><Link size={16} /></div>
          <div className="assessment-stat-data">
            <div className="assessment-stat-value">{assessment.endpointsDiscovered || 0}</div>
            <div className="assessment-stat-label">Endpoints</div>
          </div>
        </div>
        <div className="assessment-stat-card">
          <div className="assessment-stat-icon"><Zap size={16} /></div>
          <div className="assessment-stat-data">
            <div className="assessment-stat-value">{assessment.toolsExecuted || 0}</div>
            <div className="assessment-stat-label">Tools Run</div>
          </div>
        </div>
        <div className="assessment-stat-card">
          <div className="assessment-stat-icon"><ShieldAlert size={16} /></div>
          <div className="assessment-stat-data">
            <div className="assessment-stat-value">{assessment.findingsCount || 0}</div>
            <div className="assessment-stat-label">Findings</div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="assessment-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`assessment-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={15} /> {tab.label}
            {tab.id === 'findings' && findings.length > 0 && <span className="tab-count">{findings.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="assessment-tab-content">
        {/* Terminal tab */}
        {activeTab === 'terminal' && (
          <div className="terminal-container assessment-terminal">
            <div className="terminal-header">
              <div className="terminal-title"><Terminal size={14} /> Live Investigation Terminal</div>
              <div className="terminal-status-bar">
                <div className="terminal-connection">
                  {connectionStatus === 'connected' && <><CheckCircle2 size={13} color="var(--success)" /> streaming</>}
                  {connectionStatus === 'connecting' && <><Loader2 size={13} className="animate-spin" color="var(--accent)" /> connecting</>}
                  {connectionStatus === 'completed' && <><CheckCircle2 size={13} color="var(--success)" /> completed</>}
                  {connectionStatus === 'error' && <><AlertCircle size={13} color="var(--danger)" /> disconnected</>}
                  {connectionStatus === 'idle' && <span>idle</span>}
                </div>
                <button className="btn terminal-copy-btn" title="Copy terminal output" onClick={copyTerminal}>
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="terminal-body">
              {events.length === 0 && <div className="terminal-empty">Waiting for events...</div>}
              {events.map(event => (
                <div key={event.id} className="log-entry">
                  <span className="log-timestamp">[{formatTime(event.timestamp)}]</span>
                  <span className={`log-level ${(event.level || 'INFO').toUpperCase()}`}>
                    {(event.level || 'INFO').toUpperCase().padEnd(8)}
                  </span>
                  <span className="log-message">{event.message}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>
        )}

        {/* Findings tab */}
        {activeTab === 'findings' && (
          <div className="assessment-findings-panel">
            {findings.length === 0 ? (
              <div className="assessment-empty-panel">
                <Shield size={32} />
                <h3>No Findings Yet</h3>
                <p>Validated vulnerabilities will appear here as the agent discovers them.</p>
              </div>
            ) : (
              <div className="findings-list">
                {findings.map(finding => (
                  <div key={finding.id} className="finding-card">
                    <div className="finding-card-header">
                      <span className="finding-severity-dot" style={{ background: severityColor(finding.severity) }} />
                      <span className="finding-severity-label" style={{ color: severityColor(finding.severity) }}>
                        {finding.severity.toUpperCase()}
                      </span>
                      <span className="finding-status">{finding.status}</span>
                    </div>
                    <h4 className="finding-title">{finding.title}</h4>
                    {finding.description && <p className="finding-description">{finding.description}</p>}
                    <div className="finding-meta">
                      {finding.affectedAsset && <span><Globe size={12} /> {finding.affectedAsset}</span>}
                      {finding.category && <span><Layers size={12} /> {finding.category}</span>}
                      <span><Clock size={12} /> {formatDate(finding.createdAt)}</span>
                    </div>
                    {finding.evidence?.length > 0 && (
                      <div className="finding-evidence-count">
                        <FileText size={12} /> {finding.evidence.length} evidence item(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tool Executions tab */}
        {activeTab === 'tools' && (
          <div className="assessment-tools-panel">
            {toolExecs.length === 0 ? (
              <div className="assessment-empty-panel">
                <Zap size={32} />
                <h3>No Tool Executions Yet</h3>
                <p>Tool execution records will appear here as the agent runs security tools.</p>
              </div>
            ) : (
              <div className="tool-exec-list">
                {toolExecs.map(exec => (
                  <div key={exec.id} className="tool-exec-card">
                    <div className="tool-exec-header">
                      <span className="tool-exec-name">{exec.tool}</span>
                      <span className={`tool-exec-status ${exec.status}`}>{exec.status}</span>
                    </div>
                    <div className="tool-exec-meta">
                      <span><Globe size={12} /> {exec.target}</span>
                      <span><Layers size={12} /> {exec.category}</span>
                      {exec.duration != null && <span><Clock size={12} /> {exec.duration.toFixed(1)}s</span>}
                    </div>
                    {exec.aiSummary && <p className="tool-exec-summary">{exec.aiSummary.slice(0, 300)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline tab */}
        {activeTab === 'timeline' && (
          <div className="assessment-timeline-panel">
            {events.length === 0 ? (
              <div className="assessment-empty-panel">
                <Clock size={32} />
                <h3>No Timeline Events Yet</h3>
                <p>Every agent action, tool execution, and finding will be recorded here.</p>
              </div>
            ) : (
              <div className="timeline-list">
                {events.map((event, i) => (
                  <div key={event.id || i} className="timeline-event">
                    <div className="timeline-marker">
                      <div className={`timeline-dot ${(event.level || 'INFO').toLowerCase()}`} />
                      {i < events.length - 1 && <div className="timeline-line" />}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-event-header">
                        <span className="timeline-event-type">{event.type}</span>
                        <span className="timeline-event-time">{formatTime(event.timestamp)}</span>
                      </div>
                      <p className="timeline-event-message">{event.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat tab */}
        {activeTab === 'chat' && (
          <div className="assessment-chat-panel">
            <div className="assessment-chat-messages">
              {chatMessages.length === 0 && (
                <div className="assessment-empty-panel">
                  <MessageSquare size={32} />
                  <h3>Assessment Chat</h3>
                  <p>Communicate with the security agent. Try: "status", "pause", "resume", or ask questions.</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`assessment-chat-msg ${msg.role}`}>
                  <div className="assessment-chat-msg-author">{msg.role === 'user' ? 'You' : 'Agent'}</div>
                  <div className="assessment-chat-msg-content">{msg.content}</div>
                </div>
              ))}
            </div>
            <form className="assessment-chat-form" onSubmit={handleChat}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Send a message to the assessment agent..."
                disabled={chatSending}
              />
              <button type="submit" className="btn assessment-chat-send" disabled={chatSending || !chatInput.trim()}>
                {chatSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        )}

        {/* Report tab */}
        {activeTab === 'report' && (
          <div className="assessment-report-panel">
            {!report ? (
              <div className="assessment-empty-panel">
                <FileText size={32} />
                <h3>No Report Generated</h3>
                <p>Generate a professional security report once the assessment is complete.</p>
                {isFinished && (
                  <button className="btn assessment-action-btn primary" style={{ marginTop: 16 }} onClick={handleGenerateReport} disabled={generatingReport}>
                    {generatingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Generate Report
                  </button>
                )}
              </div>
            ) : (
              <div className="report-viewer">
                <div className="report-header-bar">
                  <h3>{report.title}</h3>
                  <span className="report-version">v{report.version} — {formatDate(report.createdAt)}</span>
                </div>

                <div className="report-severity-summary">
                  <div className="severity-pill critical">{report.criticalCount || 0} Critical</div>
                  <div className="severity-pill high">{report.highCount || 0} High</div>
                  <div className="severity-pill medium">{report.mediumCount || 0} Medium</div>
                  <div className="severity-pill low">{report.lowCount || 0} Low</div>
                  <div className="severity-pill info">{report.informationalCount || 0} Info</div>
                </div>

                <div className="report-section">
                  <h4>Executive Summary</h4>
                  <p className="report-text">{report.executiveSummary}</p>
                </div>

                {report.methodology && (
                  <div className="report-section">
                    <h4>Methodology</h4>
                    <p className="report-text">{report.methodology}</p>
                  </div>
                )}

                {report.attackSurface && (
                  <div className="report-section">
                    <h4>Attack Surface</h4>
                    <div className="report-surface-stats">
                      <span>{report.attackSurface.subdomains} subdomain(s)</span>
                      <span>{report.attackSurface.endpoints} endpoint(s)</span>
                      {report.attackSurface.technologies?.length > 0 && (
                        <span>Technologies: {report.attackSurface.technologies.slice(0, 10).join(', ')}</span>
                      )}
                    </div>
                  </div>
                )}

                {report.detailedFindings?.length > 0 && (
                  <div className="report-section">
                    <h4>Detailed Findings</h4>
                    {report.detailedFindings.map((f, i) => (
                      <div key={f.id || i} className="report-finding">
                        <div className="report-finding-header">
                          <span className="report-finding-severity" style={{ color: severityColor(f.severity) }}>
                            [{f.severity?.toUpperCase()}]
                          </span>
                          <span>{f.title}</span>
                        </div>
                        {f.description && <p className="report-finding-desc">{f.description}</p>}
                        {f.remediation && <p className="report-finding-remediation"><strong>Remediation:</strong> {f.remediation}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {report.riskContext && (
                  <div className="report-section">
                    <h4>Risk Context</h4>
                    <p className="report-text">{report.riskContext}</p>
                  </div>
                )}

                {report.limitations && (
                  <div className="report-section">
                    <h4>Limitations</h4>
                    <p className="report-text">{report.limitations}</p>
                  </div>
                )}

                {report.toolingSummary?.length > 0 && (
                  <div className="report-section">
                    <h4>Tooling Summary</h4>
                    <div className="report-tools-table">
                      <div className="report-tools-header">
                        <span>Tool</span><span>Category</span><span>Runs</span><span>Status</span>
                      </div>
                      {report.toolingSummary.map((t, i) => (
                        <div key={i} className="report-tools-row">
                          <span>{t.tool}</span>
                          <span>{t.category}</span>
                          <span>{t.executions}</span>
                          <span>{t.completed} ok / {t.failed} fail</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="assessment-toast-error">
          <AlertCircle size={14} /> {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
    </div>
  );
};
