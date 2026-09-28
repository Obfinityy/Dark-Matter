import React from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { EmptyState } from '../../components/ui/EmptyState';
import { FileSearch, FileText, ShieldAlert } from 'lucide-react';
import { mockFindings } from '../../mock/findings';

export const Findings = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Findings</h1>
          <p className="page-description">Review and manage discovered security issues.</p>
        </div>
        <div className="page-header-actions">
          <Button variant="secondary"><FileText size={16} /> Export CSV</Button>
          <Button variant="primary"><FileSearch size={16} /> Generate Report</Button>
        </div>
      </div>

      <Card>
        <CardContent>
          {mockFindings.length === 0 ? <EmptyState title="No findings yet" description="Validated findings from completed investigations will appear here." icon={ShieldAlert} /> : <div className="table-container">
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
          </div>}
        </CardContent>
      </Card>
    </div>
  );
};
