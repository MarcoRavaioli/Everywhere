import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Send, CalendarDays, Sparkles, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { DEFAULT_AVATAR } from '@/api/avatars';

// I locali non hanno ancora una foto caricata (v. debito D5): invece di
// mettere immagini di repertorio, le card usano un fondo grafico.
function MemoryCard({ memory, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="relative h-32 bg-gradient-to-br from-primary/30 via-accent/20 to-background">
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/50 flex-shrink-0">
            <img
              src={memory.personPhoto || DEFAULT_AVATAR}
              alt={memory.personName}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              Incontro con {memory.personName}
            </p>
            <p className="text-white/60 text-[10px] truncate">
              {memory.venue}
              {memory.nightTitle ? ` · ${memory.nightTitle}` : ''} · {memory.date} · {memory.time}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EventCard({ event, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="relative h-24 bg-gradient-to-br from-accent/25 via-primary/15 to-background">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white font-bold text-base truncate">{event.venueName}</p>
          <p className="text-white/60 text-[10px] flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            {event.nightTitle ? `${event.nightTitle} · ` : ''}{event.date}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-around py-3">
        {[
          { icon: Send, label: 'EV inviati', value: event.evSent },
          { icon: Users, label: 'EV ricevuti', value: event.evReceived },
          { icon: Sparkles, label: 'Match', value: event.matches },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center">
            <Icon className="w-3.5 h-3.5 text-muted-foreground mb-1" />
            <p className="text-base font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="text-center py-14 px-6">
      <Icon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
      <p className="text-sm text-foreground font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[270px] mx-auto">
        {children}
      </p>
      {action}
    </div>
  );
}

export default function Memories() {
  const navigate = useNavigate();
  const { memories, events, memoriesLoading, memoriesError, refreshMemories } = useApp();
  const [activeTab, setActiveTab] = useState('known');

  const goToScanner = (
    <Button
      onClick={() => navigate('/scanner')}
      className="mt-6 h-11 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-pink"
    >
      Entra in un locale
    </Button>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground mb-5">Ricordi</h1>

      <div className="flex gap-1 p-1 rounded-xl bg-secondary mb-6">
        {[
          { id: 'known', label: 'Conosciuti' },
          { id: 'events', label: 'Serate' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {memoriesError ? (
        <div className="text-center py-14 px-6">
          <p className="text-sm text-muted-foreground leading-relaxed">{memoriesError}</p>
          <button
            onClick={refreshMemories}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Riprova
          </button>
        </div>
      ) : memoriesLoading && memories.length === 0 && events.length === 0 ? (
        <div className="flex justify-center py-14">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : activeTab === 'known' ? (
        memories.length > 0 ? (
          <div className="space-y-3">
            {memories.map((memory, i) => (
              <MemoryCard key={memory.id} memory={memory} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Sparkles} title="Ancora nessun incontro" action={goToScanner}>
            Quando un EV viene ricambiato nasce un match, e la persona
            compare qui con il locale e la serata in cui vi siete conosciuti.
          </EmptyState>
        )
      ) : events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarDays} title="Nessuna serata ancora" action={goToScanner}>
          Ogni serata a cui partecipi finisce qui, con il riepilogo di quanti
          EV hai inviato e ricevuto e quanti match sono nati.
        </EmptyState>
      )}
    </div>
  );
}
