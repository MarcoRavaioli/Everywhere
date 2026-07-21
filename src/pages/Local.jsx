import React from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Tag, GlassWater, Music, CalendarDays } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const MESSAGE_STYLES = {
  promo:  { label: 'Promozione', icon: Tag,       highlight: true },
  lineup: { label: 'Lineup',     icon: Music,     highlight: false },
  event:  { label: 'Evento',     icon: CalendarDays, highlight: false },
  info:   { label: null,         icon: Megaphone, highlight: false },
};

function VenueMessageCard({ msg, index }) {
  const style = MESSAGE_STYLES[msg.type] ?? MESSAGE_STYLES.info;
  const Icon = style.icon;
  const isPromo = style.highlight;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      className={`rounded-2xl p-4 ${isPromo ? 'bg-primary/10 border border-primary/20' : 'glass'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPromo ? 'bg-primary/20' : 'bg-secondary'}`}>
          <Icon className={`w-4 h-4 ${isPromo ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          {style.label && (
            <span className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 block ${isPromo ? 'text-primary' : 'text-muted-foreground/70'}`}>
              {style.label}
            </span>
          )}
          <h3 className="text-sm font-semibold text-foreground">{msg.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{msg.body}</p>
        </div>
        <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 mt-0.5">{msg.time}</span>
      </div>
    </motion.div>
  );
}

export default function Locale() {
  const { currentVenue, venueMessages } = useApp();

  const pinned = venueMessages.filter(m => m.pinned);
  const rest = venueMessages.filter(m => !m.pinned);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Sei in</p>
        <h1 className="text-2xl font-bold text-foreground">{currentVenue?.name || 'MOON CLUB'}</h1>
      </div>

      {/* Offri un drink: la funzione arriva coi pagamenti in-app.
          Finché non è attiva non si chiedono dati di pagamento. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/40 border border-border/50">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <GlassWater className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-muted-foreground">Offri un drink</p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground/80 whitespace-nowrap">
                Presto
              </span>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
              Arriverà quando i pagamenti in-app saranno attivi.
            </p>
          </div>
        </div>
      </motion.div>

      {venueMessages.length === 0 && (
        <div className="text-center py-12 px-6">
          <Megaphone className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium">Nessuna comunicazione</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[260px] mx-auto">
            Quando il locale pubblica promozioni o annunci, li vedrai qui
            senza dover ricaricare.
          </p>
        </div>
      )}

      {/* Section title */}
      {rest.length > 0 && (
        <>
          <h2 className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
            Comunicazioni
          </h2>
          <div className="space-y-2">
            {rest.map((msg, i) => <VenueMessageCard key={msg.id} msg={msg} index={i + pinned.length} />)}
          </div>
        </>
      )}

    </div>
  );
}
