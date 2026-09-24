import React from 'react';
import { Button } from './Basic';

export const EmptyState = ({ title, description, actionText, onAction, icon: Icon }) => (
  <div style={{ textAlign: 'center', padding: '64px 24px', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
    {Icon && <Icon size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />}
    <h3 style={{ marginBottom: 8 }}>{title}</h3>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
      {description}
    </p>
    {actionText && (
      <Button variant="primary" onClick={onAction}>
        {actionText}
      </Button>
    )}
  </div>
);
