import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { BarChart2, MessageSquare, Play, QrCode, X, ChevronRight, Check, Send, Users, TrendingUp, Clock, Zap, Crown, CreditCard, User, Settings, LogOut, Share2, Printer, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EvLogo from '@/components/everywhere/EvLogo';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/lib/AuthContext';
import {
  fetchVenueMessages, createVenueMessage, deleteVenueMessage, setVenueMessagePinned,
  MESSAGE_TYPES, VenueMessageError,
} from '@/api/venueMessages';
import {
  fetchMyVenue, fetchVenueStats, fetchNights, fetchNightStats, createNight,
  openNight, closeNight, createNightQr, deleteNightQr, rotateNightQr,
  nightState, qrState, checkInUrl, isLocalOnlyOrigin, VenueError,
} from '@/api/venues';
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

      {/* Onestà verso il gestore: questi numeri non sono ancora reali */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-secondary/60 border border-border/50">
        <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Dati dimostrativi. Le statistiche reali arriveranno quando ci saranno
          check-in e interazioni nel locale.
        </p>
      </div>

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

function CommunicationsScreen({ venue }) {
  const [type, setType] = useState('promo');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [nightId, setNightId] = useState('');   // '' = vale per tutto il locale
  const [nights, setNights] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [msgs, nightList] = await Promise.all([
        fetchVenueMessages(venue.id),
        fetchNights(venue.id),
      ]);
      setMessages(msgs);
      setNights(nightList);
    } catch (err) {
      setError(err instanceof VenueMessageError || err instanceof VenueError
        ? err.message
        : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }, [venue.id]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await createVenueMessage(venue.id, {
        type,
        title: title.trim(),
        body: body.trim(),
        nightId: nightId || null,
        pinned,
      });
      setTitle('');
      setBody('');
      setPinned(false);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      await load();
    } catch (err) {
      setError(err instanceof VenueMessageError ? err.message : 'Invio non riuscito. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const runOn = async (fn, failMsg) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof VenueMessageError ? err.message : failMsg);
    } finally {
      setBusy(false);
    }
  };

  const openNights = nights.filter(n => nightState(n) !== 'closed');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Comunicazioni</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Le vedono le persone presenti nel locale, in tempo reale.
        </p>
      </div>

      {/* Tipo */}
      <div className="flex gap-2 flex-wrap">
        {MESSAGE_TYPES.map(t => (
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
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Es. Happy Hour dalle 23 🍹"
          className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Messaggio</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={1000}
          placeholder="Scrivi il messaggio per il tuo pubblico..."
          rows={4}
          className="w-full bg-secondary border border-border/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors resize-none"
        />
        <p className="text-[10px] text-muted-foreground/50 mt-1 text-right">{body.length}/1000</p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Destinatari</label>
        <select
          value={nightId}
          onChange={e => setNightId(e.target.value)}
          className="w-full h-12 px-3 bg-secondary border border-border/50 rounded-xl text-sm text-foreground outline-none focus:border-primary/50"
        >
          <option value="">Chiunque sia nel locale</option>
          {openNights.map(n => (
            <option key={n.id} value={n.id}>Solo: {n.title || 'Serata senza nome'}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={pinned}
          onChange={e => setPinned(e.target.checked)}
          className="w-4 h-4 accent-current text-primary"
        />
        <span className="text-xs text-muted-foreground">Metti in evidenza in cima</span>
      </label>

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      <AnimatePresence>
        {sent && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
            <Check className="w-4 h-4 text-primary" />
            <p className="text-sm text-primary font-medium">Comunicazione pubblicata!</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={handleSend}
        disabled={busy || !title.trim() || !body.trim()}
        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
      >
        <Send className="w-4 h-4 mr-2" />
        {busy ? 'Pubblicazione…' : 'Pubblica comunicazione'}
      </Button>

      {/* Pubblicate */}
      <div className="border-t border-border/40 pt-5">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Pubblicate</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-6">
            Nessuna comunicazione pubblicata.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map(m => (
              <div key={m.id} className="glass rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{m.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {MESSAGE_TYPES.find(t => t.id === m.type)?.label ?? m.type}
                      {m.nightId ? ' · solo una serata' : ' · tutto il locale'} · {m.time}
                    </p>
                  </div>
                  {m.pinned && (
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary whitespace-nowrap">
                      In evidenza
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => runOn(() => setVenueMessagePinned(m.id, !m.pinned), 'Operazione non riuscita.')}
                    disabled={busy}
                    variant="outline"
                    className="flex-1 h-9 rounded-xl border-border/50 text-foreground text-xs"
                  >
                    {m.pinned ? 'Togli evidenza' : 'Metti in evidenza'}
                  </Button>
                  <Button
                    onClick={() => runOn(() => deleteVenueMessage(m.id), 'Eliminazione non riuscita.')}
                    disabled={busy}
                    variant="outline"
                    className="h-9 px-3 rounded-xl border-destructive/40 text-destructive text-xs"
                  >
                    Elimina
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// datetime-local <-> ISO (l'input lavora in ora locale, il DB in UTC)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

const NIGHT_BADGES = {
  draft: { label: 'Bozza', cls: 'bg-secondary text-muted-foreground' },
  scheduled: { label: 'Programmata', cls: 'bg-accent/15 text-accent' },
  open: { label: '● In corso', cls: 'bg-primary/15 text-primary' },
  closed: { label: 'Conclusa', cls: 'bg-secondary/60 text-muted-foreground/70' },
};

const QR_BADGES = {
  active: { label: '● Attivo', cls: 'bg-primary/15 text-primary' },
  scheduled: { label: 'Programmato', cls: 'bg-accent/15 text-accent' },
  expired: { label: 'Scaduto', cls: 'bg-secondary/60 text-muted-foreground/70' },
  waiting_night: { label: 'Attende la serata', cls: 'bg-secondary text-muted-foreground' },
  closed: { label: 'Serata conclusa', cls: 'bg-secondary/60 text-muted-foreground/70' },
};

function StateBadge({ map, state }) {
  const s = map[state] ?? Object.values(map)[0];
  return <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

function TimeWindowFields({ startsAt, endsAt, onChange, startLabel = 'Attivo da', endLabel = 'Attivo fino a' }) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{startLabel}</label>
        <input
          type="datetime-local"
          value={startsAt}
          onChange={e => onChange({ startsAt: e.target.value, endsAt })}
          className="w-full h-11 px-3 bg-secondary border border-border/50 rounded-xl text-xs text-foreground outline-none focus:border-primary/50"
        />
      </div>
      <div className="flex-1">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{endLabel}</label>
        <input
          type="datetime-local"
          value={endsAt}
          onChange={e => onChange({ startsAt, endsAt: e.target.value })}
          className="w-full h-11 px-3 bg-secondary border border-border/50 rounded-xl text-xs text-foreground outline-none focus:border-primary/50"
        />
      </div>
    </div>
  );
}

// Un singolo QR ingrandito: stampa, condivisione, rotazione
function QrDetailView({ qr, night, venue, onBack, onChanged }) {
  const [rotating, setRotating] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [note, setNote] = useState(null);

  const url = checkInUrl(qr.token);
  const state = qrState(qr, night);

  const handleRotate = async () => {
    if (rotating) return;
    setNote(null);
    setRotating(true);
    try {
      await rotateNightQr(qr.id);
      setConfirmRotate(false);
      await onChanged();
    } catch (err) {
      setNote(err instanceof VenueError ? err.message : 'Rigenerazione non riuscita.');
    } finally {
      setRotating(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${venue.name} · ${qr.label}`, text: 'Entra nella serata su Everywhere', url });
      } else {
        await navigator.clipboard.writeText(url);
        setNote('Link copiato negli appunti.');
      }
    } catch {
      /* condivisione annullata */
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-5">
      <button onClick={onBack} className="self-start text-xs text-muted-foreground underline underline-offset-2">
        ← QR della serata
      </button>

      <div>
        <h2 className="text-xl font-bold text-foreground">{qr.label}</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">{night.title || 'Serata'}</p>
        <div className="mt-2"><StateBadge map={QR_BADGES} state={state} /></div>
      </div>

      {state !== 'active' && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-secondary/60 border border-border/50 text-left">
          <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {state === 'waiting_night' && 'Stampalo pure: entrerà in funzione quando la serata sarà aperta.'}
            {state === 'scheduled' && `Si attiva il ${fmt(qr.startsAt)}.`}
            {state === 'expired' && 'Questo QR ha superato il suo orario di fine.'}
            {state === 'closed' && 'Serata conclusa: questo QR non fa più entrare nessuno.'}
          </p>
        </div>
      )}

      {isLocalOnlyOrigin() && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-left">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Questo QR non funzionerà da altri dispositivi.</strong>{' '}
            Contiene l'indirizzo <code>localhost</code>, che su un altro telefono
            punta a sé stesso. Apri la dashboard dall'indirizzo di rete del
            computer (es. <code>http://192.168.x.x:5173</code>) e rigenera questa
            pagina prima di stampare o mostrare il codice.
          </p>
        </div>
      )}

      <div className="qr-print-area glass rounded-2xl p-6 border border-primary/30">
        <div className={`bg-white p-4 rounded-xl inline-block ${state === 'active' ? '' : 'opacity-60'}`}>
          <QRCodeSVG value={url} size={192} level="M" />
        </div>
        <p className="text-sm font-semibold text-foreground mt-4">{venue.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{qr.label}</p>
      </div>

      <p className="text-[10px] text-muted-foreground/60 break-all max-w-[280px]">{url}</p>

      <div className="flex gap-3 w-full">
        <Button onClick={() => window.print()} variant="outline" className="flex-1 h-12 rounded-xl border-border/50 text-foreground">
          <Printer className="w-4 h-4 mr-2" />
          Stampa
        </Button>
        <Button onClick={handleShare} className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground glow-pink">
          <Share2 className="w-4 h-4 mr-2" />
          Condividi
        </Button>
      </div>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      <div className="w-full border-t border-border/40 pt-5">
        {!confirmRotate ? (
          <button
            onClick={() => { setNote(null); setConfirmRotate(true); }}
            className="text-xs text-muted-foreground underline underline-offset-2 flex items-center gap-1.5 mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Rigenera questo QR
          </button>
        ) : (
          <div className="glass rounded-2xl p-4 space-y-3 border border-destructive/30">
            <div className="flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Le copie già stampate di <strong>{qr.label}</strong> smetteranno di
                funzionare. Gli altri QR della serata non sono toccati.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setConfirmRotate(false)} variant="outline" className="flex-1 h-10 rounded-xl border-border/50 text-foreground text-xs">
                Annulla
              </Button>
              <Button onClick={handleRotate} disabled={rotating} className="flex-1 h-10 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs">
                {rotating ? 'Rigenerazione…' : 'Conferma'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Elenco dei QR di una serata: uno generale + quelli per sala/zona
function NightQrListScreen({ night, venue, stats, onBack, onChanged }) {
  const [selectedId, setSelectedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ label: '', startsAt: '', endsAt: '' });

  const selected = night.qrCodes.find(q => q.id === selectedId);
  if (selected) {
    return (
      <QrDetailView
        qr={selected}
        night={night}
        venue={venue}
        onBack={() => setSelectedId(null)}
        onChanged={onChanged}
      />
    );
  }

  const handleAdd = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await createNightQr(night.id, {
        label: form.label.trim(),
        startsAt: fromLocalInput(form.startsAt),
        endsAt: fromLocalInput(form.endsAt),
      });
      setForm({ label: '', startsAt: '', endsAt: '' });
      setAdding(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof VenueError ? err.message : 'Creazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (qrId) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await deleteNightQr(qrId);
      await onChanged();
    } catch (err) {
      setError(err instanceof VenueError ? err.message : 'Eliminazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-muted-foreground underline underline-offset-2">
        ← Tutte le serate
      </button>

      <div>
        <h2 className="text-xl font-bold text-foreground">{night.title || 'Serata'}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Più QR per la stessa serata: ingresso, sale, zone. Chi entra da QR
          diversi si vede comunque, è la stessa festa.
        </p>
      </div>

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      {isLocalOnlyOrigin() && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Stai usando <code>localhost</code>: i QR generati qui non si aprono
            da altri dispositivi. Per una prova con più telefoni, apri la
            dashboard dall'indirizzo di rete del computer.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {night.qrCodes.map(qr => {
          const state = qrState(qr, night);
          const here = stats.byQr?.[qr.id] ?? 0;
          return (
            <div key={qr.id} className="glass rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{qr.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {qr.startsAt || qr.endsAt
                      ? `${fmt(qr.startsAt) ?? 'da subito'} → ${fmt(qr.endsAt) ?? 'fine serata'}`
                      : 'Attivo per tutta la serata'}
                  </p>
                  {here > 0 && (
                    <p className="text-[11px] text-primary mt-1">{here} {here === 1 ? 'persona' : 'persone'} da qui</p>
                  )}
                </div>
                <StateBadge map={QR_BADGES} state={state} />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setSelectedId(qr.id)}
                  variant="outline"
                  className="flex-1 h-10 rounded-xl border-border/50 text-foreground text-xs"
                >
                  <QrCode className="w-3.5 h-3.5 mr-1.5" />
                  Mostra
                </Button>
                {night.qrCodes.length > 1 && (
                  <Button
                    onClick={() => handleDelete(qr.id)}
                    disabled={busy}
                    variant="outline"
                    className="h-10 px-3 rounded-xl border-destructive/40 text-destructive text-xs"
                  >
                    Elimina
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="glass rounded-2xl p-4 space-y-3">
          <label className="text-xs text-muted-foreground uppercase tracking-wider block">Nuovo QR</label>
          <Input
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            maxLength={60}
            placeholder="Es. Sala rossa, Terrazza, Privé"
            className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50"
          />
          <TimeWindowFields
            startsAt={form.startsAt}
            endsAt={form.endsAt}
            onChange={({ startsAt, endsAt }) => setForm(f => ({ ...f, startsAt, endsAt }))}
          />
          <p className="text-[10px] text-muted-foreground/60">
            Lascia vuoto per un QR attivo da subito e per tutta la serata.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setAdding(false)} variant="outline" className="flex-1 h-11 rounded-xl border-border/50 text-foreground text-xs">
              Annulla
            </Button>
            <Button
              onClick={handleAdd}
              disabled={busy || !form.label.trim()}
              className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              {busy ? 'Creazione…' : 'Crea QR'}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setAdding(true)}
          variant="outline"
          className="w-full h-12 rounded-xl border-border/50 text-foreground"
        >
          + Aggiungi un QR (sala, zona…)
        </Button>
      )}
    </div>
  );
}

function NightsScreen({ venue, onPresenceChange }) {
  const [nights, setNights] = useState([]);
  const [statsByNight, setStatsByNight] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ title: '', opensAt: '', closesAt: '' });
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [openedNightId, setOpenedNightId] = useState(null);
  const [confirmCloseId, setConfirmCloseId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchNights(venue.id);
      setNights(list);
      const entries = await Promise.all(
        list.map(async n => [n.id, await fetchNightStats(n.id)])
      );
      setStatsByNight(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof VenueError ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }, [venue.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (creating) return;
    setError(null);
    setCreating(true);
    try {
      await createNight(venue.id, {
        title: form.title.trim() || null,
        opensAt: fromLocalInput(form.opensAt),
        closesAt: fromLocalInput(form.closesAt),
      });
      setForm({ title: '', opensAt: '', closesAt: '' });
      await load();
    } catch (err) {
      setError(err instanceof VenueError ? err.message : 'Creazione non riuscita.');
    } finally {
      setCreating(false);
    }
  };

  const runOn = async (nightId, fn, failMsg) => {
    if (busyId) return;
    setError(null);
    setBusyId(nightId);
    try {
      await fn(nightId);
      setConfirmCloseId(null);
      await load();
      onPresenceChange?.();
    } catch (err) {
      setError(err instanceof VenueError ? err.message : failMsg);
    } finally {
      setBusyId(null);
    }
  };

  const openedNight = nights.find(n => n.id === openedNightId);
  if (openedNight) {
    return (
      <NightQrListScreen
        night={openedNight}
        venue={venue}
        stats={statsByNight[openedNight.id] ?? { byQr: {} }}
        onBack={() => setOpenedNightId(null)}
        onChanged={load}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Serate</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ogni serata ha i suoi QR. Imposta gli orari o aprila e chiudila a mano.
        </p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <label className="text-xs text-muted-foreground uppercase tracking-wider block">Nuova serata</label>
        <Input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          maxLength={120}
          placeholder="Es. Sabato Techno · DJ Carola"
          className="h-12 bg-secondary border-border/50 rounded-xl text-foreground placeholder:text-muted-foreground/50"
        />
        <TimeWindowFields
          startLabel="Apre alle"
          endLabel="Chiude alle"
          startsAt={form.opensAt}
          endsAt={form.closesAt}
          onChange={({ startsAt, endsAt }) => setForm(f => ({ ...f, opensAt: startsAt, closesAt: endsAt }))}
        />
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Senza orari la serata parte solo quando premi "Apri". Puoi comunque
          aprire in anticipo o chiudere prima in qualsiasi momento.
        </p>
        <Button
          onClick={handleCreate}
          disabled={creating}
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
        >
          {creating ? 'Creazione…' : 'Crea serata'}
        </Button>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          {venue.plan === 'subscription'
            ? 'Abbonamento attivo: serate illimitate.'
            : 'Piano a serata singola. Nessun addebito per ora: la fatturazione non è ancora attiva.'}
        </p>
      </div>

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : nights.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 leading-relaxed">
          Nessuna serata ancora.<br />Creane una per generare il primo QR.
        </p>
      ) : (
        <div className="space-y-2">
          {nights.map(night => {
            const state = nightState(night);
            const st = statsByNight[night.id] ?? { activeNow: 0 };
            return (
              <div key={night.id} className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{night.title || 'Serata'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {night.opensAt || night.closesAt
                        ? `${fmt(night.opensAt) ?? 'apertura manuale'} → ${fmt(night.closesAt) ?? 'chiusura manuale'}`
                        : new Date(night.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {night.qrCodes.length} QR
                      {state === 'open' && ` · ${st.activeNow} ${st.activeNow === 1 ? 'persona' : 'persone'}`}
                    </p>
                  </div>
                  <StateBadge map={NIGHT_BADGES} state={state} />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setOpenedNightId(night.id)}
                    variant="outline"
                    className="flex-1 h-10 rounded-xl border-border/50 text-foreground text-xs"
                  >
                    <QrCode className="w-3.5 h-3.5 mr-1.5" />
                    QR ({night.qrCodes.length})
                  </Button>

                  {(state === 'draft' || state === 'scheduled') && (
                    <Button
                      onClick={() => runOn(night.id, openNight, 'Apertura non riuscita.')}
                      disabled={busyId === night.id}
                      className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                      {busyId === night.id ? '…' : 'Apri ora'}
                    </Button>
                  )}

                  {state === 'open' && confirmCloseId !== night.id && (
                    <Button
                      onClick={() => setConfirmCloseId(night.id)}
                      variant="outline"
                      className="flex-1 h-10 rounded-xl border-destructive/40 text-destructive text-xs"
                    >
                      Chiudi
                    </Button>
                  )}
                </div>

                {confirmCloseId === night.id && (
                  <div className="rounded-xl p-3 space-y-3 border border-destructive/30 bg-destructive/5">
                    <p className="text-[11px] text-muted-foreground leading-relaxed text-left">
                      Chiude la serata e <strong>tutti</strong> i suoi QR insieme. Le persone
                      dentro escono dalla sessione e smettono di vedersi. Non si può riaprire.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={() => setConfirmCloseId(null)} variant="outline" className="flex-1 h-9 rounded-xl border-border/50 text-foreground text-xs">
                        Annulla
                      </Button>
                      <Button
                        onClick={() => runOn(night.id, closeNight, 'Chiusura non riuscita.')}
                        disabled={busyId === night.id}
                        className="flex-1 h-9 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
                      >
                        {busyId === night.id ? 'Chiusura…' : 'Chiudi serata'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { business, setBusiness, setCurrentUser } = useApp();
  const { logout } = useAuth();
  const [screen, setScreen] = useState(null); // null | 'insight' | 'comms' | 'session'
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [venue, setVenue] = useState(null);
  const [stats, setStats] = useState({ activeNow: 0, totalSessions: 0, failed: false });
  const [openNightTitle, setOpenNightTitle] = useState(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [venueError, setVenueError] = useState(null);

  const loadVenue = useCallback(async () => {
    setLoadingVenue(true);
    setVenueError(null);
    try {
      const v = await fetchMyVenue();
      setVenue(v);
      if (v) {
        const [s, nights] = await Promise.all([fetchVenueStats(v.id), fetchNights(v.id)]);
        setStats(s);
        const open = nights.find(n => nightState(n) === 'open');
        setOpenNightTitle(open ? (open.title || 'Serata senza nome') : null);
      }
    } catch (err) {
      setVenueError(err instanceof VenueError ? err.message : 'Caricamento del locale non riuscito.');
    } finally {
      setLoadingVenue(false);
    }
  }, []);

  useEffect(() => { loadVenue(); }, [loadVenue]);

  // Come nel profilo utente: chiude davvero la sessione Supabase
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      setCurrentUser(null);
      setMenuOpen(false);
      navigate('/', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const venueName = venue?.name || business?.name || 'La tua venue';
  const plan = business?.plan || 'pay-per-session';

  if (loadingVenue) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Business autenticato ma senza locale: l'onboarding non è mai stato completato
  if (!venue) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <EvLogo size="md" />
        <h2 className="text-xl font-bold text-foreground mt-6">Nessun locale registrato</h2>
        <p className="text-xs text-muted-foreground mt-2 max-w-[280px] leading-relaxed">
          {venueError || 'Completa la registrazione per ottenere il QR e iniziare a ricevere persone.'}
        </p>
        <Button
          onClick={() => (venueError ? loadVenue() : navigate('/business-onboarding'))}
          className="w-full max-w-sm h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-8 glow-pink"
        >
          {venueError ? 'Riprova' : 'Registra il tuo locale'}
        </Button>
        <button onClick={handleLogout} className="text-muted-foreground text-xs underline underline-offset-2 mt-6">
          Esci
        </button>
      </div>
    );
  }

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
          {screen === 'comms' && <CommunicationsScreen venue={venue} />}
          {screen === 'session' && <NightsScreen venue={venue} onPresenceChange={loadVenue} />}
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
            <p className="text-[11px] text-muted-foreground">
              {venue.venueType || business?.type || 'Venue'} · {venue.city || business?.city || '—'}
            </p>
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
              <p className="text-sm font-bold text-foreground">Serate</p>
              <p className="text-[11px] text-muted-foreground">
                {openNightTitle ? `In corso: ${openNightTitle}` : 'Crea una serata e genera il QR'}
              </p>
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

        {/* Presenze reali: 0 finché nessuno ha fatto check-in */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Presenti ora', value: stats.failed ? '—' : stats.activeNow },
            { label: 'Check-in totali', value: stats.failed ? '—' : stats.totalSessions },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {!stats.failed && stats.totalSessions === 0 && (
          <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
            {openNightTitle
              ? 'Serata aperta, nessun check-in ancora. Esponi il QR all\'ingresso.'
              : 'Nessun check-in finora. Crea una serata e aprila per far entrare le persone.'}
          </p>
        )}
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
                <MenuRow icon={LogOut} label={loggingOut ? 'Uscita in corso…' : 'Esci'} className="text-destructive" iconClass="text-destructive" onClick={handleLogout} />
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
