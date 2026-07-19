import React from 'react';

export default function InterestChip({ label }) {
  return (
    <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border/50">
      {label}
    </span>
  );
}
