import React, { useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { Pause, Play, Download, Copy } from 'lucide-react';

export const LiveScan = () => {
  const [events] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);

  return (
    <div className="animate-fade-in live-scan-page">
      <div className="live-scan-toolbar">
        <div className="live-scan-heading">
          <h2 style={{ fontSize: '1.2rem' }}>Investigation</h2>
          <Badge variant="neutral">Awaiting data</Badge>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Not connected</span>
        </div>
        <Button variant="danger">Stop Investigation</Button>
      </div>

      <div className="live-scan-layout">
        {/* AI State Panel */}
        <Card className="live-scan-state-card">
          <CardContent>
            <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>AI Research State</h3>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Current Objective</div>
              <div style={{ fontWeight: 500 }}>Waiting for investigation events</div>
            </div>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="animate-spin" style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>Idle</span>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Current Hypothesis</div>
              <div style={{ fontSize: '0.9rem', padding: 12, backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                Tool output will appear here when this investigation is connected.
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Next Action</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No next action is available yet.</div>
            </div>

            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>Timeline</h3>
              <div className="timeline">
                {['Target Initialized', 'Scope Verified', 'Reconnaissance', 'Asset Discovery'].map((phase, idx) => (
                  <div key={idx} className="timeline-item completed">
                    <div className="timeline-icon">✓</div>
                    <div className="timeline-content">
                      <div className="timeline-title" style={{ fontSize: '0.85rem' }}>{phase}</div>
                    </div>
                  </div>
                ))}
                <div className="timeline-item active">
                  <div className="timeline-icon">●</div>
                  <div className="timeline-content">
                    <div className="timeline-title" style={{ fontSize: '0.85rem' }}>Attack Surface Analysis</div>
                  </div>
                </div>
                {['Validation', 'Evidence', 'Reporting'].map((phase, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="timeline-icon" style={{ borderColor: 'var(--border)' }}>○</div>
                    <div className="timeline-content">
                      <div className="timeline-title" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{phase}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Terminal */}
        <div className="live-scan-terminal-column">
          <div className="terminal-container">
            <div className="terminal-header">
              <div className="terminal-title">Technical Output</div>
              <div className="terminal-actions">
                <button className="btn" style={{ padding: 4 }} onClick={() => setAutoScroll(!autoScroll)}>
                  {autoScroll ? <Pause size={16} color="var(--text-secondary)" /> : <Play size={16} color="var(--text-secondary)" />}
                </button>
                <button 
                  className="btn" 
                  style={{ padding: 4 }} 
                  title="Copy terminal output"
                  onClick={() => {
                    const textToCopy = events.map(e => `[${e.timestamp}] ${e.level.padEnd(8, ' ')} ${e.message}`).join('\n');
                    navigator.clipboard.writeText(textToCopy);
                  }}
                >
                  <Copy size={16} color="var(--text-secondary)" />
                </button>
                <button className="btn" style={{ padding: 4 }}><Download size={16} color="var(--text-secondary)" /></button>
              </div>
            </div>
            <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {events.map((evt, idx) => (
                <div key={idx} className="log-entry">
                  <span className="log-timestamp">[{evt.timestamp}]</span>
                  <span className={`log-level ${evt.level}`}>{evt.level.padEnd(8, ' ')}</span>
                  <span className="log-message">{evt.message}</span>
                </div>
              ))}
              {events.length === 0 && <div className="terminal-empty">No live events are available yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
