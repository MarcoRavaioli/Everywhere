import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, MessageSquare, Play, QrCode, X, ChevronRight, Check, Send, Users, TrendingUp, Clock, Zap, Crown, CreditCard, User, Settings, LogOut, Share2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EvLogo from '@/components/everywhere/EvLogo';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// ─── Mock data ─────────────────────────────────────────────────────────────
const INSIGHT_DATA = {
  totalSessions: 12,
  totalUsers: 847,
  evSent: 1243,
  evReceived: 1198,
  matches: 342,
  avgAge: 24,
  genderSplit: [{ name: 'Donne', value: 54 }, { name: 'Uomini', value: 42 }, { name: 'Altro', value: 4 }],
  hourlyFlow: [
    { h: '22', u: 42 }, { h: '23', u: 118 }, { h: '00', u: 197 },
    { h: '01', u: 234 }, { h: '02', u: 178 }, { h: '03', u: 95 }, { h: '04', u: 43 },
  ],
  commPerformance: [{ name: 'Aperte', value: 68 }, { name: 'Ignorate', value: 32 }],
};

const GENDER_COLORS = ['#ec4899', '#a855f7', '#3b82f6'];
const COMM_COLORS = ['#ec4899', '#374151'];

// ─── Sub-screens ────────────────────────────────────────────────────────────
function InsightScreen() {
  const d = INSIGHT_DATA;
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Insight</h2>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Sessioni', value: d.totalSessions, icon: Zap, color: 'text-primary' },
          { label: 'Utenti totali', value: d.totalUsers, icon: Users, color: 'text-accent' },
          { label: 'EV inviati', value: d.evSent, icon: Send, color: 'text-primary' },
          { label: 'Match', value: d.matches, icon: Check, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-2xl p-4">
            <Icon className={`w-4 h-4 ${color} mb-2`} />
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Age + Gender */}
      <div className="glass rounded-2xl p-4 flex items-center gap-6">
        <div className="text-center">
          <p className="text-3xl font-bold text-foreground">{d.avgAge}</p>
          <p className="text-[11px] text-muted-foreground">Età media</p>
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">Genere</p>
          <ResponsiveContainer width="100%" height={80}>
            <PieChart>
              <Pie data={d.genderSplit} dataKey="value" cx="50%" cy="50%" outerRadius={34} innerRadius={18}>
                {d.genderSplit.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#111', border: 'none', fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-1">
            {d.genderSplit.map((g, i) => (
              <span key={g.name} className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: GENDER_COLORS[i] }} />
                {g.name} {g.value}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly flow */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Flusso orario</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={d.hourlyFlow} barSize={16}>
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: '#111', border: 'none', fontSize: 11 }} />
            <Bar dataKey="u" fill="#ec4899" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Comm performance */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Performance comunicazioni</p>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={80} height={80}>
            <PieChart>
              <Pie data={d.commPerformance} dataKey="value" cx="50%" cy="50%" outerRadius={36} innerRadius={22}>
                {d.commPerformance.map((_, i) => <Cell key={i} fill={COMM_COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            <p className="text-2xl font-bold text-primary">{d.commPerformance[0].value}%</p>
            <p className="text-[11px] text-muted-foreground">tasso di apertura</p>
            <p className="text-[11px] text-muted-foreground/60">{d.commPerformance[1].value}% ignorate</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunicationsScreen() {
  const [type, setType] = useState('promo');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  const TYPES = [
    { id: 'promo', label: 'Promozione' },
    { id: 'lineup', label: 'Lineup' },
    { id: 'update', label: 'Aggiornamento' },
    { id: 'event', label: 'Evento' },
  ];

  const handleSend = () => {
    if (!title.trim() || !body.trim()) return;
    setSent(true);
    setTitle('');
    setBody('');
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">Comunicazioni</h2>
      <p className="text-xs text-muted-foreground -mt-2">Raggiungi gli utenti presenti o chi ha partecipato a una tua sessione.</p>

      {/* Type selector */}
      <div className="flex gap-2 flex-wrap">
        {TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all ${type === t.id ? 'bg-primary text-primary-foreground border-primary glow-pink' : 'bg-secondary text-secondary-foreground border-border/50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Titolo</label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Happy Hour dalle 23 🍹" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Messaggio</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Scrivi il messaggio per il tuo pubblico..."
          rows={4}
          className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors resize-none"
        />
      </div>

      <AnimatePresence>
        {sent && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
            <Check className="w-4 h-4 text-primary" />
            <p className="text-sm text-primary font-medium">Comunicazione inviata!</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={handleSend}
        disabled={!title.trim() || !body.trim()}
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
      >
        <Send className="w-4 h-4 mr-2" />
        Invia comunicazione
      </Button>
    </div>
  );
}

function StartSessionScreen() {
  const [phase, setPhase] = useState('config'); // config | payment | qr
  const [config, setConfig] = useState({ duration: '5', minAge: '18', maxAge: '35', promo: '', event: '' });
  const [paying, setPaying] = useState(false);

  const updateC = (k, v) => setConfig(prev => ({ ...prev, [k]: v }));

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => { setPaying(false); setPhase('qr'); }, 2000);
  };

  const handlePrint = () => window.print();
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'Everywhere QR Code', text: 'Entra nella sessione Everywhere!', url: window.location.href });
    }
  };

  if (phase === 'qr') {
    return (
      <div className="flex flex-col items-center text-center space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Sessione attiva 🎉</h2>
          <p className="text-xs text-muted-foreground mt-1">Il QR code è pronto. Esponilo all'ingresso o condividilo digitalmente.</p>
        </div>

        {/* QR placeholder */}
        <div className="glass rounded-2xl p-6 border border-primary/30 glow-pink">
          <div className="w-48 h-48 mx-auto flex items-center justify-center relative">
            {/* Simulated QR pattern */}
            <QrCode className="w-36 h-36 text-primary opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Sessione · {config.duration}h · {config.minAge}–{config.maxAge} anni</p>
        </div>

        <div className="flex gap-3 w-full">
          <Button onClick={handlePrint} variant="outline" className="flex-1 h-12 rounded-xl border-border/50 text-foreground">
            <Printer className="w-4 h-4 mr-2" />
            Stampa
          </Button>
          <Button onClick={handleShare} className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground glow-pink">
            <Share2 className="w-4 h-4 mr-2" />
            Invia / Condividi
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/60 leading-relaxed max-w-[280px]">
          Puoi esporre il QR all'ingresso, al bar, in guardaroba, ai tavoli o in qualsiasi punto strategico della venue.
        </p>
      </div>
    );
  }

  if (phase === 'payment') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Conferma pagamento</h2>
          <p className="text-xs text-muted-foreground mt-1">Una volta pagato, la sessione si attiva e il QR viene generato automaticamente.</p>
        </div>

        {/* Summary */}
        <div className="glass rounded-2xl p-4 space-y-2">
          <Row label="Durata" value={`${config.duration} ore`} />
          <Row label="Fascia d'età" value={`${config.minAge} – ${config.maxAge} anni`} />
          {config.promo && <Row label="Promozione" value={config.promo} />}
          {config.event && <Row label="Evento" value={config.event} />}
          <div className="border-t border-border/50 pt-2 mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Totale</span>
            <span className="text-lg font-bold text-primary">€50,00</span>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Metodo di pagamento</p>
          <Input placeholder="Numero carta" className="h-11 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
          <div className="flex gap-2">
            <Input placeholder="MM/AA" className="flex-1 h-11 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
            <Input placeholder="CVV" className="w-20 h-11 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
          </div>
        </div>

        <Button onClick={handlePay} disabled={paying} className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink">
          {paying ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Elaborazione...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Paga €50 e avvia sessione
            </span>
          )}
        </Button>

        <button onClick={() => setPhase('config')} className="w-full text-center text-muted-foreground text-xs underline underline-offset-2">
          Modifica parametri
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Avvia sessione</h2>
        <p className="text-xs text-muted-foreground mt-1">Configura i parametri della serata.</p>
      </div>

      <Field label="Durata sessione (ore)">
        <div className="flex gap-2">
          {['3', '5', '7', '8'].map(h => (
            <button key={h} onClick={() => updateC('duration', h)} className={`flex-1 h-12 rounded-xl text-sm font-semibold border transition-all ${config.duration === h ? 'bg-primary text-primary-foreground border-primary glow-pink' : 'bg-secondary text-secondary-foreground border-border/50'}`}>{h}h</button>
          ))}
        </div>
      </Field>

      <div className="flex gap-3">
        <Field label="Età minima" className="flex-1">
          <Input value={config.minAge} onChange={e => updateC('minAge', e.target.value)} placeholder="18" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
        </Field>
        <Field label="Età massima" className="flex-1">
          <Input value={config.maxAge} onChange={e => updateC('maxAge', e.target.value)} placeholder="35" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
        </Field>
      </div>

      <Field label="Promozione attiva (opzionale)">
        <Input value={config.promo} onChange={e => updateC('promo', e.target.value)} placeholder="Es. Free entry under 25 fino alle 00:00" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
      </Field>

      <Field label="Evento collegato (opzionale)">
        <Input value={config.event} onChange={e => updateC('event', e.target.value)} placeholder="Es. DJ Marco Carola b2b" className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50" />
      </Field>

      <Button onClick={() => setPhase('payment')} className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink">
        Continua al pagamento
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { business, setBusiness } = useApp();
  const [screen, setScreen] = useState(null); // null | 'insight' | 'comms' | 'session'
  const [menuOpen, setMenuOpen] = useState(false);

  const venueName = business?.name || 'La tua venue';
  const plan = business?.plan || 'pay-per-session';

  if (screen) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="glass-strong px-4 pt-8 pb-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setScreen(null)} className="w-9 h-9 rounded-full glass flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <EvLogo size="sm" />
        </div>
        <div className="flex-1 px-5 py-5 overflow-y-auto pb-16">
          {screen === 'insight' && <InsightScreen />}
          {screen === 'comms' && <CommunicationsScreen />}
          {screen === 'session' && <StartSessionScreen />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="glass-strong px-5 pt-10 pb-5 flex items-center justify-between">
        <div>
          <EvLogo size="sm" />
          <p className="text-xs text-muted-foreground mt-0.5">Account business</p>
        </div>
        <button onClick={() => setMenuOpen(true)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto pb-20">
        {/* Venue info */}
        <div className="glass rounded-2xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
            {business?.logo
              ? <img src={business.logo} alt={venueName} className="w-full h-full object-cover" />
              : <QrCode className="w-7 h-7 text-muted-foreground" />
            }
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{venueName}</h2>
            <p className="text-[11px] text-muted-foreground">{business?.type || 'Venue'} · {business?.city || '—'}</p>
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${plan === 'subscription' ? 'bg-accent/15 text-accent' : 'bg-primary/15 text-primary'}`}>
              {plan === 'subscription' ? '★ Abbonamento' : 'Pay per session'}
            </span>
          </div>
        </div>

        {/* Main actions */}
        <div className="grid grid-cols-2 gap-3">
          <ActionCard icon={BarChart2} label="Insight" sub="Analisi & dati" color="text-accent" bg="bg-accent/10" onClick={() => setScreen('insight')} />
          <ActionCard icon={MessageSquare} label="Comunicazioni" sub="Messaggia il tuo pubblico" color="text-primary" bg="bg-primary/10" onClick={() => setScreen('comms')} />
        </div>

        {/* Avvia sessione — full width CTA */}
        <button
          onClick={() => setScreen('session')}
          className="w-full glass rounded-2xl p-5 border border-primary/30 hover:border-primary/60 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center glow-pink flex-shrink-0">
              <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-foreground">Avvia sessione</p>
              <p className="text-[11px] text-muted-foreground">Configura, paga, genera il QR</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>

        {/* Plan area */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Piano attivo</p>
            <button className="text-[10px] text-primary underline underline-offset-2">Gestisci</button>
          </div>
          {plan === 'subscription' ? (
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-semibold text-foreground">Abbonamento · €150/mese</p>
                <p className="text-[11px] text-muted-foreground">5 sessioni / mese · insight avanzati</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Pay per session · €50/sessione</p>
                <p className="text-[11px] text-muted-foreground">Paghi solo quando usi Everywhere</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Sessioni', value: INSIGHT_DATA.totalSessions },
            { label: 'Utenti', value: INSIGHT_DATA.totalUsers },
            { label: 'EV totali', value: INSIGHT_DATA.evSent },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Settings drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed bottom-0 left-0 right-0 z-50 glass-strong rounded-t-3xl px-5 pt-5 pb-10"
            >
              <div className="w-10 h-1 rounded-full bg-border/60 mx-auto mb-5" />
              <h3 className="text-sm font-bold text-foreground mb-4">Impostazioni</h3>
              <div className="space-y-1.5">
                <MenuRow icon={User} label="Profilo attività" onClick={() => setMenuOpen(false)} />
                <MenuRow icon={CreditCard} label="Pagamenti" onClick={() => setMenuOpen(false)} />
                <MenuRow icon={Crown} label="Piano & abbonamento" onClick={() => setMenuOpen(false)} />
                <MenuRow icon={QrCode} label="QR code sessione attiva" onClick={() => setMenuOpen(false)} />
                <div className="border-t border-border/40 my-2" />
                <MenuRow icon={LogOut} label="Esci" className="text-destructive" iconClass="text-destructive" onClick={() => { setMenuOpen(false); navigate('/'); }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionCard({ icon: Icon, label, sub, color, bg, onClick }) {
  return (
    <button onClick={onClick} className="glass rounded-2xl p-4 text-left hover:bg-white/5 transition-all border border-border/50 hover:border-primary/30">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </button>
  );
}

function MenuRow({ icon: Icon, label, onClick, className = '', iconClass = 'text-muted-foreground' }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl glass hover:bg-white/5 transition-colors ${className}`}>
      <Icon className={`w-4 h-4 ${iconClass}`} />
      <span className="text-sm text-foreground flex-1 text-left">{label}</span>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
    </button>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground font-medium">{value}</span>
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
