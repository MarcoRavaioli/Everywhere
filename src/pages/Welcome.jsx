import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EvLogo from '@/components/everywhere/EvLogo';
import { useApp } from '@/context/AppContext';

export default function Welcome() {
  const navigate = useNavigate();
  const { loginAsGuest } = useApp();

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
            onClick={handleGuestLogin}
            className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm glow-pink"
          >
            <Mail className="w-4 h-4 mr-2" />
            Accedi con Email
          </Button>

          <Button
            variant="outline"
            className="w-full h-13 rounded-xl border-border/50 bg-white/5 hover:bg-white/10 text-foreground font-medium text-sm"
            onClick={handleGuestLogin}
          >
            <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4 mr-2" />
            Continua con Google
          </Button>

          <Button
            variant="outline"
            className="w-full h-13 rounded-xl border-border/50 bg-white/5 hover:bg-white/10 text-foreground font-medium text-sm"
            onClick={handleGuestLogin}
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            Continua con Facebook
          </Button>

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
