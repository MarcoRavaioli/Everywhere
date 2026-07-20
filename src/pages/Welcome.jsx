import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import EvLogo from '@/components/everywhere/EvLogo';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/lib/AuthContext';
import EmailAuthForm from '@/components/everywhere/EmailAuthForm';

export default function Welcome() {
  const navigate = useNavigate();
  const { loginAsGuest } = useApp();
  const { signInWithGoogle, authError } = useAuth();

  const handleGuestLogin = () => {
    loginAsGuest();
    navigate('/create-profile');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80"
          alt="Nightlife"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-black" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-between min-h-screen px-6 py-12">
        {/* Top section */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <EvLogo size="lg" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-muted-foreground text-sm mt-4 max-w-[260px] leading-relaxed"
          >
            People around you.
            <br />
            Connections in real life.
          </motion.p>
        </div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="w-full max-w-sm space-y-3"
        >
          <Button
            className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm glow-pink"
            onClick={signInWithGoogle}
          >
            <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4 mr-2" />
            Continua con Google
          </Button>

          {/* Sign in with Apple arriverà con l'account Apple Developer (v. ROADMAP) */}

          {authError && (
            <p className="text-center text-destructive text-xs">
              Accesso non riuscito: {authError.message}
            </p>
          )}

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">oppure</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* Dopo il login la "/" smista in base al profilo */}
          <EmailAuthForm onAuthenticated={() => navigate('/', { replace: true })} />

          <div className="pt-2">
            <button
              onClick={handleGuestLogin}
              className="w-full text-center text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Prosegui come ospite
            </button>
          </div>

          <p className="text-center text-muted-foreground/60 text-[10px] pt-3 leading-relaxed">
            Everywhere funziona solo all'interno di locali<br />ed eventi abilitati.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
