import React from 'react';

export const Card = ({ children, className = '', ...props }) => (
  <div className={`card ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ title, children }) => (
  <div className="card-header">
    {title && <div className="card-title">{title}</div>}
    {children}
  </div>
);

export const CardContent = ({ children }) => (
  <div className="card-content">
    {children}
  </div>
);

export const CardValue = ({ value }) => (
  <div className="card-value">{value}</div>
);
