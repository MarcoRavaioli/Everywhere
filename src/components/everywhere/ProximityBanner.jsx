import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Simulated nearby venue check — in production this would compare coords
// against a real list of enabled venues. Here we fire once after a delay.
const NEARBY_VENUE = { name: 'Moon Club', id: 'moon-club' };

export default function ProximityBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => {
    if (dismissed) return;

    if (!('geolocation' in navigator)) return;

    // Ask for permission, then simulate a nearby venue after a short delay
    navigator.geolocation.getCurrentPosition(
      () => {
        // Permission granted → simulate proximity after 8s
        timerRef.current = setTimeout(() => {
          setVisible(true);
        }, 8000);
      },
      () => {
        // Permission denied or unavailable — do nothing
      },
      { timeout: 5000 }
    );

    return () => clearTimeout(timerRef.current);
  }, [dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  const handleEnter = () => {
    setVisible(false);
    navigate('/scanner');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div className="glass-strong rounded-2xl px-4 py-3 flex items-center gap-3 border border-primary/20"
               style={{ boxShadow: '0 0 24px rgba(236,72,153,0.15)' }}>
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight">
                {NEARBY_VENUE.name} è nelle vicinanze
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                C'è una sessione Everywhere attiva qui vicino.
              </p>
            </div>
            <button
              onClick={handleEnter}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold glow-pink flex-shrink-0"
            >
              <Zap className="w-3 h-3" />
              Entra
            </button>
            <button onClick={handleDismiss} className="w-7 h-7 flex items-center justify-center text-muted-foreground flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
