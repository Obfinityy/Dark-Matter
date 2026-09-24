import React from 'react';
import { Card, CardHeader, CardContent, CardValue } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { mockProjects } from '../../mock/projects';

export const Projects = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-description">Manage your security research projects.</p>
        </div>
        <Button variant="primary">+ New Project</Button>
      </div>

      <div className="grid grid-cols-3">
        {mockProjects.map(project => (
          <Card key={project.id}>
            <CardHeader title={project.name}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}>{project.description}</p>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: 16, marginTop: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Targets</div>
                  <div style={{ fontWeight: 600 }}>{project.targets}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scans</div>
                  <div style={{ fontWeight: 600 }}>{project.activeScans}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Findings</div>
                  <div style={{ fontWeight: 600, color: project.findings > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {project.findings}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
