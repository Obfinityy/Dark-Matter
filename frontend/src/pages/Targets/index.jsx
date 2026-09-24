import React from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { mockTargets } from '../../mock/targets';

export const Targets = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Targets</h1>
          <p className="page-description">Manage authorized targets for security research.</p>
        </div>
        <Button variant="primary">+ Add Target</Button>
      </div>

      <div className="grid grid-cols-2">
        {mockTargets.map(target => (
          <Card key={target.id}>
            <CardHeader title={target.name}>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Badge variant="success">Authorized</Badge>
                <Badge variant="neutral">{target.projectId}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                <strong>URL:</strong> <a href={target.url} target="_blank" rel="noreferrer">{target.url}</a>
              </div>
              <div style={{ padding: 12, backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Scope</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginBottom: 4 }}>
                  + Included: {target.scope.included.join(', ')}
                </div>
                {target.scope.excluded.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                    - Excluded: {target.scope.excluded.join(', ')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
