import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';

export default function SessionConfirm() {
  const navigate = useNavigate();
  const { startSession } = useApp();

  const handleEnter = () => {
    startSession();
    navigate('/session', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center glow-pink">
          <CheckCircle className="w-10 h-10 text-primary" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <p className="text-muted-foreground text-sm mb-1">Sei entrato in</p>
        <h1 className="text-3xl font-bold text-foreground mb-8">
          MOON CLUB
        </h1>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mb-10">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">Sessione attiva</span>
            </div>
            <p className="text-2xl font-space font-bold text-foreground">
              04:59:32
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Tempo rimanente</p>
          </div>

          <div className="w-px h-12 bg-border" />

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">Persone presenti</span>
            </div>
            <p className="text-2xl font-space font-bold text-foreground">
              128
            </p>
          </div>
        </div>

        <Button
          onClick={handleEnter}
          className="w-full max-w-xs h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base glow-pink"
        >
          Entra
        </Button>
      </motion.div>
    </div>
  );
}
