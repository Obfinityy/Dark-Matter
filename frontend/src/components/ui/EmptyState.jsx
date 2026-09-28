import React from 'react';
import { Button } from './Basic';

export const EmptyState = ({ title, description, actionText, onAction, icon: Icon, className = '' }) => (
  <div className={`empty-state ${className}`}>
    {Icon && <Icon className="empty-state-icon" size={48} />}
    <h3>{title}</h3>
    <p>
      {description}
    </p>
    {actionText && (
      <Button variant="primary" onClick={onAction}>
        {actionText}
      </Button>
    )}
  </div>
);
