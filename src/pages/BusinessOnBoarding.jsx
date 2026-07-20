import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, Store, MapPin, Clock, FileText, CreditCard, Image, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EvLogo from '@/components/everywhere/EvLogo';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { createMyVenue, fetchMyVenue, VenueError } from '@/api/venues';
import EmailAuthForm from '@/components/everywhere/EmailAuthForm';

const VENUE_TYPES = ['Club / Discoteca', 'Bar / Cocktail Bar', 'Lounge', 'Festival', 'Evento privato', 'Ristorante', 'Beach club', 'Altro'];

const STEPS = ['Attività', 'Contatti & Orari', 'Documenti', 'Piano'];

export default function BusinessOnboarding() {
  const navigate = useNavigate();
  const { setBusiness, refreshProfile } = useApp();
  const { isAuthenticated, authChecked, signInWithGoogle, authError } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [checkingVenue, setCheckingVenue] = useState(true);

  // Chi ha già un locale non deve crearne un secondo per sbaglio:
  // a livello dati sono ammessi, ma la UI ne gestisce uno solo.
  useEffect(() => {
    let cancelled = false;
    if (!authChecked || !isAuthenticated) {
      setCheckingVenue(false);
      return;
    }
    fetchMyVenue()
      .then(venue => {
        if (!cancelled && venue) navigate('/business', { replace: true });
      })
      .catch(err => console.error('Controllo locale esistente fallito:', err))
      .finally(() => { if (!cancelled) setCheckingVenue(false); });
    return () => { cancelled = true; };
  }, [authChecked, isAuthenticated, navigate]);
  const [form, setForm] = useState({
    name: '', type: '', address: '', city: '',
    phone: '', email: '', website: '',
    hoursOpen: '', hoursClose: '',
    vatNumber: '', adminRef: '',
    logo: '', coverImage: '',
    plan: '',
  });

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Crea profilo business + venue + token QR (RPC atomica lato server).
  // Il piano scelto resta per ora un dato locale: la fatturazione arriva
  // con Stripe (Step 6), qui non si incassa nulla.
  const handleFinish = async (plan) => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const venue = await createMyVenue({
        name: form.name,
        venueType: form.type,
        address: form.address,
        city: form.city,
        phone: form.phone,
        email: form.email,
        website: form.website,
        hoursOpen: form.hoursOpen,
        hoursClose: form.hoursClose,
        // 'subscription' = serate illimitate; 'pay_per_night' = serata singola
        plan: plan === 'subscription' ? 'subscription' : 'pay_per_night',
      });
      if (setBusiness) setBusiness({ ...form, plan, venueId: venue.venue_id });
      localStorage.removeItem('ew_signup_intent');
      await refreshProfile();
      navigate('/business', { replace: true });
    } catch (err) {
      setError(err instanceof VenueError ? err.message : 'Registrazione non riuscita. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.type && form.city.trim();
    if (step === 1) return form.phone.trim() || form.email.trim();
    return true;
  };

  // Il locale deve avere un account PRIMA di compilare: il login
  // rimanda alla home e i dati del form andrebbero persi.
  if (authChecked && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <EvLogo size="md" />
        <h2 className="text-xl font-bold text-foreground mt-6">Registra il tuo locale</h2>
        <p className="text-xs text-muted-foreground mt-2 max-w-[280px] leading-relaxed">
          Serve un account per gestire la tua venue, il QR e le comunicazioni.
          Accedi prima di inserire i dati.
        </p>
        <div className="w-full max-w-sm mt-8 space-y-3">
          <Button
            onClick={signInWithGoogle}
            className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
          >
            <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4 mr-2" />
            Continua con Google
          </Button>

          {authError && (
            <p className="text-destructive text-xs">Accesso non riuscito: {authError.message}</p>
          )}

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">oppure</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          {/* Nessuna navigazione: autenticato, il gate lascia il posto al form */}
          <EmailAuthForm />
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-muted-foreground text-xs underline underline-offset-2 mt-6"
        >
          Torna indietro
        </button>
      </div>
    );
  }

  if (!authChecked || checkingVenue) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="glass-strong px-4 pt-8 pb-4 flex items-center gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="w-9 h-9 rounded-full glass flex items-center justify-center flex-shrink-0">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <div className="flex-1">
          <EvLogo size="sm" />
          <p className="text-[11px] text-muted-foreground mt-0.5">Registrazione locale · passo {step + 1} di {STEPS.length}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-4 pb-4 pt-2">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
        ))}
      </div>

      <div className="flex-1 px-6 pb-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">La tua attività</h2>
                <p className="text-xs text-muted-foreground">Inserisci i dati principali della venue.</p>
              </div>

              <Field label="Nome attività *">
                <Input value={form.name} onChange={e => update('name', e.target.value)} maxLength={120} placeholder="Es. Moon Club" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>

              <Field label="Tipologia venue *">
                <div className="flex flex-wrap gap-2">
                  {VENUE_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => update('type', t)}
                      className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all border ${form.type === t ? 'bg-primary text-primary-foreground border-primary glow-pink' : 'bg-secondary text-secondary-foreground border-border/50 hover:border-primary/40'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Indirizzo">
                <Input value={form.address} onChange={e => update('address', e.target.value)} maxLength={200} placeholder="Via Roma 12" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>

              <Field label="Città *">
                <Input value={form.city} onChange={e => update('city', e.target.value)} maxLength={100} placeholder="Milano" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Contatti & Orari</h2>
                <p className="text-xs text-muted-foreground">Come possono trovarti i tuoi utenti?</p>
              </div>
              <Field label="Telefono">
                <Input value={form.phone} onChange={e => update('phone', e.target.value)} maxLength={40} placeholder="+39 02 123456" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
              <Field label="Email di contatto">
                <Input value={form.email} onChange={e => update('email', e.target.value)} maxLength={200} type="email" placeholder="info@moonclub.it" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
              <Field label="Sito web">
                <Input value={form.website} onChange={e => update('website', e.target.value)} maxLength={200} placeholder="www.moonclub.it" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
              <div className="flex gap-3">
                <Field label="Apertura" className="flex-1">
                  <Input value={form.hoursOpen} onChange={e => update('hoursOpen', e.target.value)} maxLength={20} placeholder="22:00" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
                </Field>
                <Field label="Chiusura" className="flex-1">
                  <Input value={form.hoursClose} onChange={e => update('hoursClose', e.target.value)} maxLength={20} placeholder="05:00" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
                </Field>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Documenti & Identità</h2>
                <p className="text-xs text-muted-foreground">Dati per la verifica dell'account business.</p>
              </div>
              <Field label="Partita IVA / Codice Fiscale">
                <Input value={form.vatNumber} onChange={e => update('vatNumber', e.target.value)} placeholder="IT 12345678901" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
              <Field label="Referente amministrativo">
                <Input value={form.adminRef} onChange={e => update('adminRef', e.target.value)} placeholder="Nome e cognome" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
              <Field label="Logo venue (URL)">
                <Input value={form.logo} onChange={e => update('logo', e.target.value)} placeholder="https://..." className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
              <Field label="Immagine copertina (URL)">
                <Input value={form.coverImage} onChange={e => update('coverImage', e.target.value)} placeholder="https://..." className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
              </Field>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Scegli il tuo piano</h2>
                <p className="text-xs text-muted-foreground">Puoi cambiare in qualsiasi momento.</p>
                <p className="text-[11px] text-muted-foreground/60 mt-2">
                  Nessun addebito ora: la fatturazione non è ancora attiva.
                </p>
              </div>

              {error && (
                <p className="text-destructive text-sm text-center">{error}</p>
              )}
              {saving && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Registrazione del locale in corso…
                </div>
              )}

              {/* Subscription */}
              <button
                onClick={() => handleFinish('subscription')}
                disabled={saving}
                className="w-full glass rounded-2xl p-5 text-left border border-accent/40 hover:border-accent/70 transition-all group disabled:opacity-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground">Abbonamento</h3>
                      <span className="text-base font-bold text-accent">€150/mese</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {['5 sessioni al mese', 'Insight avanzati', 'Comunicazioni a tutti gli utenti', 'Gestione continua venue', 'Funzioni promozionali'].map(f => (
                        <li key={f} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Check className="w-3 h-3 text-accent flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>

              {/* Single session */}
              <button
                onClick={() => handleFinish('pay-per-session')}
                disabled={saving}
                className="w-full glass rounded-2xl p-5 text-left border border-border/50 hover:border-primary/40 transition-all group disabled:opacity-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground">Sessione singola</h3>
                      <span className="text-base font-bold text-primary">€50/sessione</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {['Paghi solo quando la usi', 'Accesso completo per la serata', 'QR code generato automaticamente', 'Nessun vincolo'].map(f => (
                        <li key={f} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Check className="w-3 h-3 text-primary flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      {step < 3 && (
        <div className="px-6 pb-10 pt-2">
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
          >
            Continua
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{label}</label>
      {children}
    </div>
  );
}
