import React, { useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button, Badge } from '../../components/ui/Basic';
import { ShieldAlert } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const NewScan = () => {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');

  const modes = [
    { id: 'NORMAL', desc: 'Standard coverage', usage: '$', avail: true },
    { id: 'MEDIUM', desc: 'Extended coverage & payloads', usage: '$$', avail: true },
    { id: 'HIGH', desc: 'Advanced AI analysis & deep recon', usage: '$$$', avail: true },
    { id: 'ULTRA HIGH', desc: 'Exhaustive validation & bypass attempts', usage: '$$$$', avail: true },
    { id: 'INFINITY', desc: 'Maximum configured research capacity', usage: '$$$$$', avail: false }
  ];

  return (
    <div className="animate-fade-in new-scan-page">
      <div className="page-header">
        <h1 className="page-title">New Investigation</h1>
        <p className="page-description">Configure and launch a new autonomous security scan.</p>
      </div>

      <div className="scan-stepper" aria-label={`Step ${step} of 5`}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={s <= step ? 'step-active' : ''} />
        ))}
      </div>

      <Card>
        <CardContent className="new-scan-card-content">
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="step-title">Step 1: Select Project</h2>
              <input className="form-control" style={{ marginBottom: 24 }} value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" />
              <div className="step-actions step-actions-end">
                <Button variant="primary" onClick={() => setStep(2)}>Next</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="step-title">Step 2: Select Target</h2>
              <input className="form-control" style={{ marginBottom: 24 }} value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://authorized-target" type="url" />
              <div className="step-actions">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" onClick={() => setStep(3)}>Next</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="step-title">Step 3: Verify Authorization</h2>
              <div className="authorization-warning">
                <div className="authorization-warning-head">
                  <ShieldAlert color="var(--danger)" />
                  <h3>Authorization Required</h3>
                </div>
                <p>Only test targets you are explicitly authorized to assess. Unauthorized testing is illegal and violates our terms of service.</p>
                <label className="checkbox-container">
                  <input type="checkbox" />
                  <span className="checkmark"></span>
                  <span className="checkbox-text">I confirm that I am authorized to test this target and its defined scope.</span>
                </label>
              </div>
              <div className="step-actions">
                <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                <Button variant="primary" onClick={() => setStep(4)}>Next</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <h2 className="step-title">Step 4: Execution Mode</h2>
              <div className="scan-mode-list">
                {modes.map(mode => (
                  <div 
                    key={mode.id} 
                    onClick={() => mode.avail && setSelectedMode(mode.id)}
                    className={`scan-mode-option ${selectedMode === mode.id ? 'selected' : ''} ${!mode.avail ? 'unavailable' : ''}`}
                    role="button"
                    tabIndex={mode.avail ? 0 : -1}
                    onKeyDown={(event) => { if (mode.avail && (event.key === 'Enter' || event.key === ' ')) setSelectedMode(mode.id); }}
                  >
                    <div className="scan-mode-copy">
                      <div className="scan-mode-title">{mode.id}</div>
                      <div className="scan-mode-description">{mode.desc}</div>
                    </div>
                    <div className="scan-mode-meta">
                      <div className="scan-mode-usage">{mode.usage}</div>
                      {!mode.avail && <Badge variant="neutral">Coming Soon</Badge>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="step-actions">
                <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
                <Button variant="primary" disabled={!selectedMode} onClick={() => setStep(5)}>Next</Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-in">
              <h2 className="step-title">Step 5: Review</h2>
              <div className="scan-review-card">
                <div className="scan-review-grid">
                  <div style={{ color: 'var(--text-secondary)' }}>Project</div>
                  <div style={{ fontWeight: 500 }}>{projectName || 'No project selected'}</div>
                  
                  <div style={{ color: 'var(--text-secondary)' }}>Target</div>
                  <div style={{ fontWeight: 500 }}>{targetUrl || 'No target selected'}</div>
                  
                  <div style={{ color: 'var(--text-secondary)' }}>Mode</div>
                  <div><Badge variant="neutral">{selectedMode}</Badge></div>
                  
                  <div style={{ color: 'var(--text-secondary)' }}>Est. Usage</div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>--</div>
                </div>
              </div>
              <div className="step-actions">
                <Button variant="secondary" onClick={() => setStep(4)}>Back</Button>
                <NavLink to="/scans/live">
                  <Button variant="primary" className="start-investigation-button">Start Investigation</Button>
                </NavLink>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
