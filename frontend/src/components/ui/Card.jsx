import React from 'react';

export const Card = ({ children, className = '', ...props }) => (
  <div className={`card ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ title, children, className = '', ...props }) => (
  <div className={`card-header ${className}`} {...props}>
    {title && <div className="card-title">{title}</div>}
    {children}
  </div>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`card-content ${className}`} {...props}>
    {children}
  </div>
);

export const CardValue = ({ value }) => (
  <div className="card-value">{value}</div>
);
