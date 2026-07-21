import React from 'react';

/**
 * Ultima rete di sicurezza: un errore in un componente porterebbe a una
 * schermata bianca senza spiegazioni. Qui l'utente vede almeno cosa fare.
 *
 * Punto naturale in cui agganciare Sentry (Step 4): componentDidCatch
 * riceve errore e stack dei componenti.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // In produzione questo andrà a Sentry, senza dati personali
    console.error('Errore non gestito:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-foreground mt-5">Qualcosa è andato storto</h1>
        <p className="text-xs text-muted-foreground mt-2 max-w-[280px] leading-relaxed">
          L'app ha incontrato un errore imprevisto. Ricaricare di solito basta;
          se succede di nuovo, faccelo sapere.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-sm mt-8 glow-pink"
        >
          Ricarica l'app
        </button>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="text-muted-foreground text-xs underline underline-offset-2 mt-5"
        >
          Torna all'inizio
        </button>
      </div>
    );
  }
}
