import React from 'react';
import { Card, CardHeader, CardContent, CardValue } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
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
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="secondary">Add Funds</Button>
          <Button variant="primary">+ New Scan</Button>
        </div>
      </div>

      <div className="grid grid-cols-4" style={{ marginBottom: 32 }}>
        <Card>
          <CardHeader title="Wallet Balance" />
          <CardContent>
            <CardValue value="$150.00" />
            <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: 8 }}>+$50.00 this month</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Active Scans" />
          <CardContent>
            <CardValue value="1" />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>Across 3 projects</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Total Findings" />
          <CardContent>
            <CardValue value="16" />
            <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 8 }}>3 High severity</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Usage" />
          <CardContent>
            <CardValue value="$12.40" />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>Estimated this month</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: 32 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Card style={{ height: '100%' }}>
            <CardHeader title="Recent Scans" />
            <CardContent>
              <div className="table-container">
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
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card style={{ height: '100%' }}>
            <CardHeader title="Recent Findings" />
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {mockFindings.slice(0, 3).map(finding => (
                  <div key={finding.id} style={{ padding: 12, backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{finding.title}</span>
                      <Badge variant={finding.severity === 'High' ? 'danger' : finding.severity === 'Medium' ? 'warning' : 'info'}>{finding.severity}</Badge>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {finding.asset} • {finding.discovered}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
