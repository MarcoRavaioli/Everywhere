import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

// Errore con messaggio già pronto per l'utente (i form mostrano .message)
export class AuthError extends Error {}

// Supabase risponde in inglese: qui diventa italiano. Si guarda prima il
// codice (stabile), il testo solo come ripiego: i messaggi cambiano tra
// versioni ed è così che "Email address ... is invalid" ci era sfuggito.
const AUTH_ERROR_BY_CODE = {
  invalid_credentials: 'Email o password non corretti.',
  email_not_confirmed: 'Conferma la tua email prima di accedere: controlla la posta.',
  user_already_exists: 'Questa email è già registrata. Accedi invece di registrarti.',
  email_exists: 'Questa email è già registrata. Accedi invece di registrarti.',
  weak_password: 'Password troppo debole: usane una più lunga.',
  email_address_invalid: 'Indirizzo email non valido. Controlla di averlo scritto bene.',
  email_address_not_authorized: 'Questo indirizzo email non è autorizzato.',
  over_email_send_rate_limit:
    'Troppe email inviate di recente. Riprova tra qualche minuto.',
  over_request_rate_limit: 'Troppi tentativi. Aspetta qualche secondo e riprova.',
  signup_disabled: 'Le registrazioni sono momentaneamente disattivate.',
  validation_failed: 'Controlla i dati inseriti.',
};

function toAuthError(error) {
  const byCode = AUTH_ERROR_BY_CODE[error?.code];
  if (byCode) return new AuthError(byCode);

  const raw = (error?.message || '').toLowerCase();
  if (raw.includes('invalid login credentials')) {
    return new AuthError('Email o password non corretti.');
  }
  if (raw.includes('email not confirmed')) {
    return new AuthError('Conferma la tua email prima di accedere: controlla la posta.');
  }
  if (raw.includes('already registered') || raw.includes('already been registered')) {
    return new AuthError('Questa email è già registrata. Accedi invece di registrarti.');
  }
  if (raw.includes('is invalid') || raw.includes('invalid email') || raw.includes('unable to validate email')) {
    return new AuthError('Indirizzo email non valido. Controlla di averlo scritto bene.');
  }
  if (raw.includes('rate limit') || raw.includes('for security purposes')) {
    return new AuthError('Troppi tentativi. Aspetta qualche minuto e riprova.');
  }
  console.error('Errore auth non mappato:', error);
  return new AuthError('Accesso non riuscito. Riprova.');
}

export const MIN_PASSWORD_LENGTH = 8;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    // Fires on sign-in (including OAuth redirect back), sign-out and token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthError({ type: 'oauth_error', message: error.message });
    }
  }, []);

  // Login con email e password. Lancia AuthError con messaggio leggibile.
  const signInWithEmail = useCallback(async (email, password) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw toAuthError(error);
  }, []);

  // Registrazione con email e password.
  // Ritorna { needsConfirmation }: in produzione la conferma email è
  // attiva e la sessione arriva solo dopo il click sul link; in dev la
  // conferma è disattivata e si entra subito.
  const signUpWithEmail = useCallback(async (email, password) => {
    setAuthError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError(`La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`);
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw toAuthError(error);

    // Con la conferma email attiva Supabase non rivela se l'indirizzo
    // esiste già: restituisce un utente con identities vuoto.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      throw new AuthError('Questa email è già registrata. Prova ad accedere.');
    }
    return { needsConfirmation: !data.session };
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError({ type: 'signout_error', message: error.message });
    }
    setUser(null);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      authChecked,
      authError,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
