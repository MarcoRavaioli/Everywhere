import React from 'react';
import { useApp } from '@/context/AppContext';

export default function SessionTimer({ variant = 'full' }) {
  const { sessionTimeLeft, formatTime } = useApp();

  if (variant === 'compact') {
    return (
      <div className="text-center">
        <p className="text-2xl font-space font-bold text-foreground tracking-wider">
          {formatTime(sessionTimeLeft)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
        Sessione attiva
      </p>
      <p className="text-4xl font-space font-bold text-foreground tracking-wider">
        {formatTime(sessionTimeLeft)}
      </p>
      <p className="text-xs text-muted-foreground mt-1">Tempo rimanente</p>
    </div>
  );
}
