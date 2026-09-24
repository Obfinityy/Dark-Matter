import React from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { mockPlugins } from '../../mock/plugins';

export const Plugins = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Tool Catalog</h1>
          <p className="page-description">Manage security tools and execution plugins available to the AI.</p>
        </div>
      </div>

      <div className="grid grid-cols-3">
        {mockPlugins.map(plugin => (
          <Card key={plugin.id}>
            <CardHeader title={plugin.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>v{plugin.version}</span>
                <Badge variant={plugin.status === 'Available' ? 'success' : 'neutral'}>{plugin.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 16 }}>
                {plugin.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{plugin.category}</span>
                <Button variant="secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} disabled={plugin.status !== 'Available'}>
                  {plugin.status === 'Available' ? 'Configure' : 'Locked'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
