import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EvLogo from '@/components/everywhere/EvLogo';
import { isValidToken } from '@/api/sessions';

export default function Scanner() {
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState(null);

  // La fotocamera arriva nello step successivo: per ora si incolla il
  // codice, oppure si inquadra il QR con la fotocamera del telefono
  // (il QR contiene l'URL completo, quindi apre l'app da solo).
  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!isValidToken(code)) {
      setError('Codice non valido: deve essere il codice completo del QR.');
      return;
    }
    setError(null);
    navigate(`/checkin?t=${encodeURIComponent(code)}`);
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Simulated camera background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900" />

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 -mt-10">
        {/* Title */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white text-lg font-semibold mb-2"
        >
          Inquadra il QR code del locale
        </motion.p>
        <p className="text-white/50 text-xs text-center mb-8 max-w-[260px]">
          Il QR abilita la tua sessione temporanea all'interno della venue.
        </p>

        {/* Scanner frame */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative w-64 h-64 mb-8"
        >
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-primary rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-primary rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-primary rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-primary rounded-br-xl" />

          {/* Scan line */}
          <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent scan-line" />

          {/* QR placeholder */}
          <div className="absolute inset-8 flex items-center justify-center opacity-20">
            <EvLogo size="sm" />
          </div>
        </motion.div>

        <div className="space-y-3 w-full max-w-sm">
          <p className="text-white/50 text-xs text-center flex items-center justify-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            Inserisci il codice del QR
          </p>

          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => { setManualCode(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              placeholder="Codice della serata"
              className="flex-1 h-11 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30"
            />
            <Button
              onClick={handleManualSubmit}
              disabled={!manualCode.trim()}
              className="h-11 px-5 rounded-xl bg-primary"
            >
              Entra
            </Button>
          </div>

          {error && <p className="text-destructive text-xs text-center">{error}</p>}

          <p className="text-white/30 text-[11px] text-center leading-relaxed pt-1">
            Puoi anche inquadrare il QR con la fotocamera del telefono:
            aprirà direttamente l'app.
          </p>
        </div>
      </div>
    </div>
  );
}
