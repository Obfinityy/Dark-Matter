import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, Globe, Link, Loader2, Lock,
  Plus, Send, Shield, ShieldCheck, X, Zap
} from 'lucide-react';
import { createAssessment, normalizeTargetUrl, extractTargetUrl } from '../../services/api';

const MODES = [
  { value: 'NORMAL', label: 'Normal', desc: 'Standard reconnaissance — balanced speed and depth', icon: Shield },
  { value: 'MEDIUM', label: 'Medium', desc: 'Extended discovery with additional tools', icon: Zap },
  { value: 'HIGH', label: 'High', desc: 'Deep investigation — comprehensive tool coverage', icon: ShieldCheck },
  { value: 'INFINITY', label: 'Infinity', desc: 'Maximum depth — full tool registry, all categories', icon: Globe }
];

export const NewAssessment = () => {
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState('');
  const [mode, setMode] = useState('NORMAL');
  const [message, setMessage] = useState('');
  const [authConfirmed, setAuthConfirmed] = useState(false);
  const [includedScope, setIncludedScope] = useState('');
  const [excludedScope, setExcludedScope] = useState('');
  const [authNotes, setAuthNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const resolved = normalizeTargetUrl(targetUrl.trim()) || extractTargetUrl(message);
    if (!resolved) {
      setError('Provide an HTTP or HTTPS target URL.');
      return;
    }
    if (!authConfirmed) {
      setError('You must confirm authorization before starting a security assessment.');
      return;
    }

    setIsSubmitting(true);
    try {
      const scope = {};
      if (includedScope.trim()) {
        scope.included = includedScope.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (excludedScope.trim()) {
        scope.excluded = excludedScope.split(',').map(s => s.trim()).filter(Boolean);
      }

      const result = await createAssessment({
        targetUrl: resolved,
        authorizationConfirmed: true,
        authorizationNotes: authNotes.trim() || undefined,
        mode,
        message: message.trim() || `Security assessment for ${resolved}`,
        scope: Object.keys(scope).length > 0 ? scope : undefined
      });

      if (result.status === 'started' && result.assessmentId) {
        navigate(`/assessment/${result.assessmentId}`);
      } else if (result.status === 'awaiting_authorization') {
        setError(result.message || 'Authorization is required.');
      } else if (result.status === 'needs_target') {
        setError(result.message || 'Provide a valid target.');
      } else {
        setError(result.message || 'Assessment could not be started.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="new-assessment-page animate-fade-in">
      <div className="new-assessment-container">
        <div className="new-assessment-header">
          <div className="new-assessment-icon-wrap">
            <Shield size={28} />
          </div>
          <h1>New Security Assessment</h1>
          <p>Launch an autonomous security investigation against an authorized target.</p>
        </div>

        <form className="new-assessment-form" onSubmit={handleSubmit}>
          {/* Target URL */}
          <div className="form-section">
            <label className="form-label"><Globe size={14} /> Target URL</label>
            <input
              className="form-input"
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              onBlur={e => setTargetUrl(normalizeTargetUrl(e.target.value))}
              placeholder="https://example.com or example.com"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoFocus
            />
          </div>

          {/* Assessment mode */}
          <div className="form-section">
            <label className="form-label"><Zap size={14} /> Assessment Mode</label>
            <div className="mode-grid">
              {MODES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  className={`mode-card ${mode === m.value ? 'active' : ''}`}
                  onClick={() => setMode(m.value)}
                >
                  <m.icon size={18} />
                  <div className="mode-card-text">
                    <span className="mode-card-label">{m.label}</span>
                    <span className="mode-card-desc">{m.desc}</span>
                  </div>
                  {mode === m.value && <CheckCircle2 size={16} className="mode-check" />}
                </button>
              ))}
            </div>
          </div>

          {/* Optional message */}
          <div className="form-section">
            <label className="form-label"><Send size={14} /> Investigation Instructions (optional)</label>
            <textarea
              className="form-textarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Focus on API endpoints, skip port scanning, etc."
              rows={3}
            />
          </div>

          {/* Advanced scope settings */}
          <button type="button" className="btn form-toggle-advanced" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? <X size={14} /> : <Plus size={14} />}
            {showAdvanced ? 'Hide' : 'Show'} Advanced Scope Settings
          </button>

          {showAdvanced && (
            <div className="form-advanced-section">
              <div className="form-section">
                <label className="form-label"><CheckCircle2 size={14} /> Included Domains (comma-separated)</label>
                <input
                  className="form-input"
                  value={includedScope}
                  onChange={e => setIncludedScope(e.target.value)}
                  placeholder="example.com, api.example.com"
                />
              </div>
              <div className="form-section">
                <label className="form-label"><X size={14} /> Excluded Domains (comma-separated)</label>
                <input
                  className="form-input"
                  value={excludedScope}
                  onChange={e => setExcludedScope(e.target.value)}
                  placeholder="admin.example.com, internal.example.com"
                />
              </div>
              <div className="form-section">
                <label className="form-label"><Lock size={14} /> Authorization Notes</label>
                <textarea
                  className="form-textarea"
                  value={authNotes}
                  onChange={e => setAuthNotes(e.target.value)}
                  placeholder="Bug bounty program URL, written authorization reference, etc."
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Authorization confirmation */}
          <div className="form-authorization">
            <label className="checkbox-container">
              <input type="checkbox" checked={authConfirmed} onChange={e => setAuthConfirmed(e.target.checked)} />
              <span className="checkmark" />
              <span className="checkbox-text">
                I confirm I am <strong>explicitly authorized</strong> to perform security testing on this target and all domains within the declared scope.
              </span>
            </label>
          </div>

          {error && (
            <div className="form-error">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn new-assessment-submit"
            disabled={isSubmitting || !targetUrl.trim()}
          >
            {isSubmitting ? (
              <><Loader2 size={18} className="animate-spin" /> Initializing Assessment...</>
            ) : (
              <><Shield size={18} /> Start Security Assessment</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
