import React from 'react';
import { Card, CardHeader, CardContent, CardValue } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { EmptyState } from '../../components/ui/EmptyState';
import { Activity, Plus, WalletCards } from 'lucide-react';
import { mockScans } from '../../mock/scans';
import { mockFindings } from '../../mock/findings';

export const Dashboard = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-description">Overview of your autonomous security operations.</p>
        </div>
        <div className="page-header-actions">
          <Button variant="secondary"><WalletCards size={16} /> Add Funds</Button>
          <Button variant="primary"><Plus size={16} /> New Scan</Button>
        </div>
      </div>

      <div className="grid grid-cols-4" style={{ marginBottom: 32 }}>
        <Card>
          <CardHeader title="Wallet Balance" />
          <CardContent>
            <CardValue value="--" />
            <div className="metric-note">Balance data will appear after billing is connected.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Active Scans" />
          <CardContent>
            <CardValue value="--" />
            <div className="metric-note">No active investigations yet.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Total Findings" />
          <CardContent>
            <CardValue value="--" />
            <div className="metric-note">Findings will appear after a scan completes.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Usage" />
          <CardContent>
            <CardValue value="--" />
            <div className="metric-note">Usage is not available yet.</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: 32 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Card style={{ height: '100%' }}>
            <CardHeader title="Recent Scans" />
            <CardContent>
              {mockScans.length === 0 ? <EmptyState title="No investigations yet" description="Start an authorized reconnaissance run to see live activity here." icon={Activity} /> : <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Target</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th>Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockScans.map(scan => (
                      <tr key={scan.id}>
                        <td>{scan.targetId}</td>
                        <td><Badge variant="neutral">{scan.mode}</Badge></td>
                        <td>
                          <Badge variant={scan.status === 'running' ? 'info' : scan.status === 'completed' ? 'success' : 'danger'}>
                            {scan.status}
                          </Badge>
                        </td>
                        <td>{scan.findings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card style={{ height: '100%' }}>
            <CardHeader title="Recent Findings" />
            <CardContent>
              {mockFindings.length === 0 ? <EmptyState title="No findings yet" description="Completed investigations will surface validated findings here." icon={Activity} /> : <div className="finding-list">
                {mockFindings.slice(0, 3).map(finding => (
                  <div key={finding.id} className="finding-preview">
                    <div className="finding-preview-head">
                      <span>{finding.title}</span>
                      <Badge variant={finding.severity === 'High' ? 'danger' : finding.severity === 'Medium' ? 'warning' : 'info'}>{finding.severity}</Badge>
                    </div>
                    <div className="finding-preview-meta">
                      {finding.asset} • {finding.discovered}
                    </div>
                  </div>
                ))}
              </div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
