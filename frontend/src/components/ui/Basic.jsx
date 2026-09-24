import React from 'react';

export const Badge = ({ children, variant = 'neutral', className = '' }) => (
  <span className={`badge badge-${variant} ${className}`}>
    {children}
  </span>
);

export const Button = ({ children, variant = 'primary', className = '', ...props }) => (
  <button className={`btn btn-${variant} ${className}`} {...props}>
    {children}
  </button>
);
