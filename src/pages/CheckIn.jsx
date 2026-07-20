import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EvLogo from '@/components/everywhere/EvLogo';
import EmailAuthForm from '@/components/everywhere/EmailAuthForm';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/context/AppContext';
import { checkIn, isValidToken, SessionError } from '@/api/sessions';

/**
 * Destinazione del QR: /checkin?t=<token>
 * Funziona anche inquadrando il codice con la fotocamera di sistema,
 * ed è la stessa forma che useranno i deep link con Capacitor.
 */
export default function CheckIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('t');
  const { isAuthenticated, authChecked, signInWithGoogle, authError } = useAuth();
  const { currentUser, profileChecked, refreshSession, formatTime } = useApp();

  const [status, setStatus] = useState('idle'); // idle | working | done | error
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);

  const run = useCallback(async () => {
    setStatus('working');
    setError(null);
    try {
      const s = await checkIn(token);
      setSession(s);
      await refreshSession();
      setStatus('done');
    } catch (err) {
      setError(err instanceof SessionError ? err.message : 'Ingresso non riuscito. Riprova.');
      setStatus('error');
    }
  }, [token, refreshSession]);

  // Check-in appena si hanno token, sessione autenticata e profilo.
  // Senza profilo non si entra: gli altri presenti vedrebbero un utente vuoto.
  useEffect(() => {
    if (!authChecked || !profileChecked) return;
    if (!isAuthenticated || !currentUser || currentUser.isGuest) return;
    if (!isValidToken(token)) return;
    if (status !== 'idle') return;
    run();
  }, [authChecked, profileChecked, isAuthenticated, currentUser, token, status, run]);

  const Frame = ({ children }) => (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm flex flex-col items-center"
      >
        {children}
      </motion.div>
    </div>
  );

  // 1. QR malformato o link aperto a mano
  if (!isValidToken(token)) {
    return (
      <Frame>
        <AlertCircle className="w-10 h-10 text-destructive" />
        <h1 className="text-xl font-bold text-foreground mt-4">Link non valido</h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Questo indirizzo non contiene un codice valido. Inquadra di nuovo il
          QR esposto nel locale.
        </p>
        <Button
          onClick={() => navigate('/scanner')}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold mt-8 glow-pink"
        >
          Apri lo scanner
        </Button>
      </Frame>
    );
  }

  if (!authChecked || (isAuthenticated && !profileChecked)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Non autenticato: si accede restando su questa pagina, così il
  //    token del QR non va perso (Google torna esattamente qui)
  if (!isAuthenticated) {
    return (
      <Frame>
        <EvLogo size="md" />
        <h1 className="text-xl font-bold text-foreground mt-6">Accedi per entrare</h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Ti serve un account per essere visibile alle persone presenti.
          Dopo l'accesso entri direttamente.
        </p>
        <div className="w-full space-y-3 mt-8">
          <Button
            onClick={() => signInWithGoogle(window.location.href)}
            className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
          >
            <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4 mr-2" />
            Continua con Google
          </Button>
          {authError && <p className="text-destructive text-xs">{authError.message}</p>}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">oppure</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <EmailAuthForm />
        </div>
      </Frame>
    );
  }

  // 3. Autenticato ma senza profilo: prima il profilo, poi si entra
  if (!currentUser || currentUser.isGuest) {
    return (
      <Frame>
        <EvLogo size="md" />
        <h1 className="text-xl font-bold text-foreground mt-6">Completa il profilo</h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Serve un profilo prima di entrare: le persone nel locale devono
          sapere chi sei.
        </p>
        <Button
          onClick={() => navigate(`/create-profile?next=${encodeURIComponent(`/checkin?t=${token}`)}`)}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold mt-8 glow-pink"
        >
          Crea il profilo
        </Button>
      </Frame>
    );
  }

  if (status === 'working' || status === 'idle') {
    return (
      <Frame>
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground mt-4">Ingresso in corso…</p>
      </Frame>
    );
  }

  // 4. Rifiutato dal server: QR scaduto, serata chiusa, codice sconosciuto
  if (status === 'error') {
    return (
      <Frame>
        <AlertCircle className="w-10 h-10 text-destructive" />
        <h1 className="text-xl font-bold text-foreground mt-4">Non è stato possibile entrare</h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{error}</p>
        <div className="w-full space-y-2 mt-8">
          <Button
            onClick={run}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold glow-pink"
          >
            Riprova
          </Button>
          <Button
            onClick={() => navigate('/home')}
            variant="outline"
            className="w-full h-12 rounded-xl border-border/50 text-foreground"
          >
            Torna alla home
          </Button>
        </div>
      </Frame>
    );
  }

  // 5. Dentro
  const secondsLeft = session
    ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <Frame>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center glow-pink"
      >
        <CheckCircle className="w-10 h-10 text-primary" />
      </motion.div>

      <p className="text-muted-foreground text-sm mt-6">Sei entrato in</p>
      <h1 className="text-3xl font-bold text-foreground mt-1">
        {session?.venue?.name ?? 'Locale'}
      </h1>
      {session?.night?.title && (
        <p className="text-sm text-primary mt-1">{session.night.title}</p>
      )}
      {session?.venue?.city && (
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {session.venue.city}
        </p>
      )}

      <div className="flex items-center gap-1.5 text-muted-foreground mt-6">
        <Clock className="w-3.5 h-3.5" />
        <span className="text-xs">Sessione attiva</span>
      </div>
      <p className="text-2xl font-space font-bold text-foreground mt-1">
        {formatTime(secondsLeft)}
      </p>

      <Button
        onClick={() => navigate('/session', { replace: true })}
        className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base mt-8 glow-pink"
      >
        Entra
      </Button>
    </Frame>
  );
}
