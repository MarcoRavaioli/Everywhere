import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Ban, Flag, AlertTriangle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { blockUser, reportUser, REPORT_REASONS, ModerationError } from '@/api/moderation';

/**
 * Blocco e segnalazione di una persona.
 * onDone() viene chiamato dopo un'azione riuscita: chi la usa deve
 * ricaricare le liste e uscire dalla schermata della persona, che
 * da quel momento non è più visibile.
 */
export default function ReportBlockSheet({ person, onClose, onDone }) {
  const [view, setView] = useState('menu'); // menu | block | report
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (fn) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
      onDone?.();
    } catch (err) {
      setError(err instanceof ModerationError ? err.message : 'Operazione non riuscita. Riprova.');
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-card rounded-t-3xl px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        {view === 'menu' && (
          <>
            <h2 className="text-base font-bold text-foreground mb-1">{person.name}</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Se questa persona ti mette a disagio, puoi intervenire subito.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => setView('block')}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/5 transition-colors text-left"
              >
                <Ban className="w-4 h-4 text-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground">Blocca</p>
                  <p className="text-[11px] text-muted-foreground">Non vi vedrete più a vicenda</p>
                </div>
              </button>
              <button
                onClick={() => setView('report')}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/5 transition-colors text-left"
              >
                <Flag className="w-4 h-4 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm text-destructive">Segnala</p>
                  <p className="text-[11px] text-muted-foreground">
                    Ci avvisi e blocchiamo la persona per te
                  </p>
                </div>
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full text-center text-muted-foreground text-xs mt-5 py-2"
            >
              Annulla
            </button>
          </>
        )}

        {view === 'block' && (
          <>
            <button
              onClick={() => setView('menu')}
              className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Indietro
            </button>
            <div className="flex items-start gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bloccando <strong className="text-foreground">{person.name}</strong> sparirete
                l'uno dalla vista dell'altro: liste, chat ed eventuali match.
                Puoi sbloccare in seguito dal tuo profilo.
              </p>
            </div>
            {error && <p className="text-destructive text-xs mb-3">{error}</p>}
            <div className="flex gap-2">
              <Button
                onClick={onClose}
                variant="outline"
                disabled={busy}
                className="flex-1 h-11 rounded-xl border-border/50 text-foreground text-sm"
              >
                Annulla
              </Button>
              <Button
                onClick={() => run(() => blockUser(person.id))}
                disabled={busy}
                className="flex-1 h-11 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm"
              >
                {busy ? 'Blocco…' : 'Blocca'}
              </Button>
            </div>
          </>
        )}

        {view === 'report' && (
          <>
            <button
              onClick={() => setView('menu')}
              className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Indietro
            </button>
            <h2 className="text-base font-bold text-foreground mb-1">Cosa è successo?</h2>
            <p className="text-xs text-muted-foreground mb-4">
              La segnalazione è anonima. {person.name} verrà bloccato automaticamente.
            </p>

            <div className="space-y-1.5 mb-4">
              {REPORT_REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full px-4 py-3 rounded-xl text-left text-sm transition-colors border ${
                    reason === r.id
                      ? 'bg-primary/10 border-primary/40 text-foreground'
                      : 'glass border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={e => setDetails(e.target.value.slice(0, 1000))}
              placeholder="Vuoi aggiungere qualcosa? (facoltativo)"
              rows={3}
              className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 resize-none mb-2"
            />

            {error && <p className="text-destructive text-xs mb-3">{error}</p>}

            <div className="flex gap-2">
              <Button
                onClick={onClose}
                variant="outline"
                disabled={busy}
                className="flex-1 h-11 rounded-xl border-border/50 text-foreground text-sm"
              >
                Annulla
              </Button>
              <Button
                onClick={() => run(() => reportUser(person.id, reason, details.trim() || null))}
                disabled={busy || !reason}
                className="flex-1 h-11 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm"
              >
                {busy ? 'Invio…' : 'Invia segnalazione'}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
