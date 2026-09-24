import React from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { mockFindings } from '../../mock/findings';

export const Findings = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Findings</h1>
          <p className="page-description">Review and manage discovered security issues.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="secondary">Export CSV</Button>
          <Button variant="primary">Generate Report</Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Severity</th>
                  <th>Confidence</th>
                  <th>Asset</th>
                  <th>Status</th>
                  <th>Discovered</th>
                </tr>
              </thead>
              <tbody>
                {mockFindings.map(finding => (
                  <tr key={finding.id} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{finding.title}</td>
                    <td>
                      <Badge variant={finding.severity === 'High' ? 'danger' : finding.severity === 'Medium' ? 'warning' : 'info'}>
                        {finding.severity}
                      </Badge>
                    </td>
                    <td>{finding.confidence}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{finding.asset}</td>
                    <td>
                      <Badge variant={finding.status === 'Validated' ? 'success' : 'neutral'}>
                        {finding.status}
                      </Badge>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{finding.discovered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
