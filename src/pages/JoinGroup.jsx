import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useGroup } from '@/context/GroupContext';

export default function JoinGroup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('g');
  const { user: authUser, authChecked } = useAuth();
  const { joinGroup } = useGroup();
  const [state, setState] = useState('loading'); // loading | need_login | error | done
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (!authChecked || attempted.current) return;
    if (!token) {
      setState('error');
      setMessage('Link del gruppo non valido.');
      return;
    }
    if (!authUser) {
      setState('need_login');
      return;
    }
    attempted.current = true;
    joinGroup(token)
      .then(() => {
        setState('done');
        navigate('/group', { replace: true });
      })
      .catch(err => {
        setState('error');
        setMessage(err?.message ?? 'Ingresso nel gruppo non riuscito.');
      });
  }, [authChecked, authUser, token, joinGroup, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      {state === 'loading' && (
        <>
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Ti sto facendo entrare nel gruppo…</p>
        </>
      )}

      {state === 'need_login' && (
        <>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">Accedi per entrare nel gruppo</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
            Dopo l'accesso torna a inquadrare il QR del gruppo per entrare.
          </p>
          <button
            onClick={() => navigate('/')}
            className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold glow-pink"
          >
            Accedi
          </button>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">Non è stato possibile entrare</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">{message}</p>
          <button
            onClick={() => navigate('/group')}
            className="h-12 px-6 rounded-xl glass border border-border/50 text-foreground font-semibold"
          >
            Vai ai gruppi
          </button>
        </>
      )}
    </div>
  );
}
