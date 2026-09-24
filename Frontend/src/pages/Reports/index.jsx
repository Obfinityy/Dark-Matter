import React from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { mockReports } from '../../mock/reports';

export const Reports = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-description">Professional security assessment reports.</p>
        </div>
        <Button variant="primary">+ New Report</Button>
      </div>

      <Card>
        <CardContent>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Report Name</th>
                  <th>Project</th>
                  <th>Target</th>
                  <th>Generated</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockReports.map(report => (
                  <tr key={report.id}>
                    <td style={{ fontWeight: 500 }}>{report.name}</td>
                    <td>{report.projectId}</td>
                    <td>{report.targetId}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{report.generated}</td>
                    <td><Badge variant="neutral">{report.format}</Badge></td>
                    <td><Badge variant="success">{report.status}</Badge></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Preview</Button>
                        <Button variant="secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Download</Button>
                      </div>
                    </td>
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
