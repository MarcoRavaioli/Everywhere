import React from 'react';

export default function EvLogo({ size = 'lg' }) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  return (
    <h1 className={`${sizes[size]} font-space font-bold tracking-tight`}>
      <span className="text-primary">EV</span>
      <span className="text-foreground">ERYWHERE</span>
    </h1>
  );
}
