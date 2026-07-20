import React, { useState } from 'react';
import { Mail, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, AuthError, MIN_PASSWORD_LENGTH } from '@/lib/AuthContext';

/**
 * Accesso e registrazione con email e password.
 * Usato sia dagli utenti (Welcome) sia dai locali (BusinessOnBoarding).
 *
 * onAuthenticated() viene chiamato solo quando c'è davvero una sessione:
 * con la conferma email attiva (produzione) la registrazione non logga
 * subito, quindi mostriamo l'invito a controllare la posta.
 */
export default function EmailAuthForm({ onAuthenticated, submitLabel }) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | signup
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const isSignUp = mode === 'signup';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setError(null);

    if (!form.email.trim()) {
      setError('Inserisci la tua email.');
      return;
    }
    if (!form.password) {
      setError('Inserisci la password.');
      return;
    }
    if (isSignUp && form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
      return;
    }

    setBusy(true);
    try {
      if (isSignUp) {
        const { needsConfirmation } = await signUpWithEmail(form.email, form.password);
        if (needsConfirmation) {
          setConfirmSent(true);
          return;
        }
      } else {
        await signInWithEmail(form.email, form.password);
      }
      onAuthenticated?.();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Operazione non riuscita. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="glass rounded-2xl p-5 text-center space-y-2 border border-primary/30">
        <Check className="w-6 h-6 text-primary mx-auto" />
        <p className="text-sm font-semibold text-foreground">Controlla la tua email</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Ti abbiamo inviato un link di conferma a <strong>{form.email.trim()}</strong>.
          Aprilo per attivare l'account, poi torna qui per accedere.
        </p>
        <button
          onClick={() => { setConfirmSent(false); setMode('signin'); }}
          className="text-[11px] text-primary underline underline-offset-2 pt-1"
        >
          Torna all'accesso
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        placeholder="La tua email"
        maxLength={200}
        className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50"
      />
      <Input
        type="password"
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        placeholder={isSignUp ? `Password (min ${MIN_PASSWORD_LENGTH} caratteri)` : 'Password'}
        className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50"
      />

      {error && <p className="text-destructive text-xs text-center">{error}</p>}

      <Button
        type="submit"
        disabled={busy}
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm glow-pink"
      >
        <Mail className="w-4 h-4 mr-2" />
        {busy
          ? (isSignUp ? 'Registrazione…' : 'Accesso…')
          : (submitLabel ?? (isSignUp ? 'Registrati' : 'Accedi'))}
      </Button>

      <button
        type="button"
        onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(null); }}
        className="w-full text-center text-muted-foreground text-xs underline underline-offset-2"
      >
        {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
      </button>
    </form>
  );
}
