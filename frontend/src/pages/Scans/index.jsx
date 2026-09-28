import React from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { EmptyState } from '../../components/ui/EmptyState';
import { Activity, Plus } from 'lucide-react';
import { mockScans } from '../../mock/scans';
import { NavLink } from 'react-router-dom';

export const Scans = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Investigations</h1>
          <p className="page-description">Monitor and manage autonomous security research.</p>
        </div>
        <NavLink to="/scans/new">
          <Button variant="primary"><Plus size={16} /> New Scan</Button>
        </NavLink>
      </div>

      <Card>
        <CardContent>
          {mockScans.length === 0 ? <EmptyState title="No investigations yet" description="Start an authorized scan to see progress and live events here." icon={Activity} /> : <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Mode</th>
                  <th>Phase</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockScans.map(scan => (
                  <tr key={scan.id}>
                    <td>{scan.targetId}</td>
                    <td><Badge variant="neutral">{scan.mode}</Badge></td>
                    <td>{scan.currentPhase}</td>
                    <td>
                      <div style={{ width: '100px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${scan.progress}%`, backgroundColor: scan.status === 'failed' ? 'var(--danger)' : 'var(--accent)', height: '100%' }}></div>
                      </div>
                    </td>
                    <td>
                      <Badge variant={scan.status === 'running' ? 'info' : scan.status === 'completed' ? 'success' : 'danger'}>
                        {scan.status}
                      </Badge>
                    </td>
                    <td>
                      <NavLink to={`/scans/live/${scan.id}`}>
                        <Button variant="secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>View Live</Button>
                      </NavLink>
                    </td>
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
