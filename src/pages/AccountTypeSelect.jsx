import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Store } from 'lucide-react';
import EvLogo from '@/components/everywhere/EvLogo';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/context/AppContext';

export default function AccountTypeSelect() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { currentUser, profileChecked } = useApp();

  // "/" è anche la landing del ritorno OAuth: chi è già loggato
  // viene smistato in base allo stato del profilo.
  useEffect(() => {
    if (!isAuthenticated || !profileChecked) return;
    if (!currentUser) {
      navigate('/create-profile', { replace: true });
    } else if (currentUser.accountType === 'business') {
      navigate('/business', { replace: true });
    } else {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, profileChecked, currentUser, navigate]);

  // Utente loggato in attesa dello smistamento: spinner, non la scelta account
  if (isAuthenticated && !profileChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80"
          alt="Nightlife"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/85 to-black" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-between min-h-screen px-6 py-14">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center"
        >
          <EvLogo size="lg" />
          <p className="text-muted-foreground text-sm mt-4 max-w-[260px] leading-relaxed">
            Scegli come vuoi entrare in Everywhere.
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="w-full max-w-sm space-y-4"
        >
          {/* Utente */}
          <button
            onClick={() => navigate('/welcome')}
            className="w-full glass rounded-2xl p-6 text-left hover:bg-white/10 transition-all duration-300 border border-border/50 hover:border-primary/40 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Sono un utente</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Entra in un locale, connettiti con le persone intorno a te.
                </p>
              </div>
            </div>
          </button>

          {/* Locale */}
          <button
            onClick={() => navigate('/business-onboarding')}
            className="w-full glass rounded-2xl p-6 text-left hover:bg-white/10 transition-all duration-300 border border-border/50 hover:border-accent/40 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/25 transition-colors">
                <Store className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Sono un locale</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Registra la tua venue, avvia sessioni e connetti il tuo pubblico.
                </p>
              </div>
            </div>
          </button>

          <p className="text-center text-muted-foreground/50 text-[10px] pt-2 leading-relaxed">
            Everywhere funziona solo all'interno di locali ed eventi abilitati.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
