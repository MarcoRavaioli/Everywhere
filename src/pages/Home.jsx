import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EvLogo from '@/components/everywhere/EvLogo';
import { useApp } from '@/context/AppContext';

export default function Home() {
  const navigate = useNavigate();
  const { isInSession } = useApp();

  // If already in session, redirect
  useEffect(() => {
    if (isInSession) navigate('/session', { replace: true });
  }, [isInSession, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center max-w-sm"
      >
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Sei pronto!
        </h1>

        <p className="text-muted-foreground text-sm leading-relaxed mb-10 max-w-[280px]">
          Per iniziare a usare Everywhere, entra in un locale o un evento abilitato.
        </p>

        {/* QR Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-10"
        >
          <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-pink">
            <QrCode className="w-12 h-12 text-primary" />
          </div>
        </motion.div>

        <Button
          onClick={() => navigate('/scanner')}
          className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base glow-pink"
        >
          <QrCode className="w-5 h-5 mr-2" />
          Scannerizza un QR Code
        </Button>

        <p className="text-muted-foreground/50 text-xs mt-6 leading-relaxed">
          Potrai vedere chi è presente e inviare EV.
        </p>
      </motion.div>
    </div>
  );
}
