import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Users, Send, X, CalendarDays, LocateFixed, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';

// Mock new-announcement data per event id
const EVENT_ANNOUNCEMENTS = {
  'e1': {
    title: 'Nuova serata: Back to the 90s',
    date: 'Venerdì 16 Maggio · ore 23:00',
    body: 'Moon Club torna con una serata speciale anni \'90. DJ set, visual e drink tematici. Accesso garantito solo dall\'app con geolocalizzazione attiva.',
    image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800&q=80',
  },
  'e2': {
    title: 'Evento speciale: Open Air Night',
    date: 'Sabato 17 Maggio · ore 22:00',
    body: 'Neon Garden apre le porte per una notte all\'aperto. Line-up di artisti internazionali. Ingresso riservato agli utenti Everywhere presenti in zona.',
    image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80',
  },
};

function EventAnnouncementBanner({ event, announcement, onClose, onPartecipa }) {
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | checking | granted | denied

  const handlePartecipa = () => {
    setGeoStatus('checking');
    navigator.geolocation.getCurrentPosition(
      () => {
        setGeoStatus('granted');
        setTimeout(() => {
          onPartecipa(event);
          onClose();
        }, 1400);
      },
      () => {
        setGeoStatus('denied');
      },
      { timeout: 6000 }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-black/75 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="w-full max-w-sm bg-card rounded-3xl overflow-hidden"
      >
        {/* Image */}
        <div className="relative h-40">
          <img src={announcement.image} alt={announcement.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-semibold uppercase tracking-wider">
            Nuovo
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <p className="text-xs text-primary font-medium mb-1">{event.venueName}</p>
          <h3 className="text-base font-bold text-foreground mb-1">{announcement.title}</h3>
          <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
            <CalendarDays className="w-3 h-3" />
            <span className="text-xs">{announcement.date}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">{announcement.body}</p>

          {/* Geo warning */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/60 mb-4">
            <LocateFixed className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              L'accesso è valido solo all'ora dell'evento e richiede la geolocalizzazione attiva in loco.
            </p>
          </div>

          {geoStatus === 'idle' && (
            <Button
              onClick={handlePartecipa}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
            >
              Partecipa
            </Button>
          )}

          {geoStatus === 'checking' && (
            <div className="w-full h-12 rounded-xl bg-secondary flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Verifica posizione...</span>
            </div>
          )}

          {geoStatus === 'granted' && (
            <div className="w-full h-12 rounded-xl bg-primary/10 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-semibold">Accesso confermato!</span>
            </div>
          )}

          {geoStatus === 'denied' && (
            <div className="space-y-2">
              <div className="w-full px-4 py-2 rounded-xl bg-destructive/10 text-center">
                <p className="text-xs text-destructive">Geolocalizzazione non disponibile o non sei in zona.</p>
              </div>
              <button onClick={onClose} className="w-full text-center text-xs text-muted-foreground underline underline-offset-2">
                Chiudi
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MemoryCard({ memory, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="relative h-36">
        <img
          src={memory.image}
          alt={memory.venue}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/50">
            <img src={memory.personPhoto} alt={memory.personName} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">
              Incontro con {memory.personName}
            </p>
            <p className="text-white/60 text-[10px]">
              {memory.venue} · {memory.date} · {memory.time}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EventCard({ event, index, onAnnouncementOpen }) {
  const hasAnnouncement = !!EVENT_ANNOUNCEMENTS[event.id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="glass rounded-2xl overflow-hidden relative"
    >
      {/* Red dot indicator */}
      {hasAnnouncement && (
        <button
          onClick={() => onAnnouncementOpen(event)}
          className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full bg-destructive flex items-center justify-center shadow-lg"
          style={{ boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
        >
          <span className="text-[9px] font-bold text-white">!</span>
        </button>
      )}

      <div className="relative h-28">
        <img
          src={event.venueImage}
          alt={event.venueName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white font-bold text-base">{event.venueName}</p>
              <p className="text-white/60 text-[10px] flex items-center gap-1 mt-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {event.date}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Send className="w-3.5 h-3.5" />
          <span className="text-xs">{event.evSent} EV inviati</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs">{event.evReceived} ricevuti</span>
        </div>
        {event.matches > 0 && (
          <div className="flex items-center gap-1.5 text-primary">
            <div className="w-3.5 h-3.5 rounded-full bg-primary/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
            <span className="text-xs font-medium">{event.matches} match</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Memories() {
  const { memories, events, startSession } = useApp();
  const [activeTab, setActiveTab] = useState('known');
  const [activeAnnouncement, setActiveAnnouncement] = useState(null); // { event }

  const handleAnnouncementOpen = (event) => setActiveAnnouncement({ event });
  const handleAnnouncementClose = () => setActiveAnnouncement(null);
  const handlePartecipa = (event) => {
    startSession();
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground mb-5">
        Ricordi
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary mb-6">
        <button
          onClick={() => setActiveTab('known')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
            activeTab === 'known'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          Conosciuti
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
            activeTab === 'events'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          Eventi
        </button>
      </div>

      {/* Conosciuti */}
      {activeTab === 'known' && (
        <div className="space-y-3">
          {memories.length > 0
            ? memories.map((memory, index) => (
                <MemoryCard key={memory.id} memory={memory} index={index} />
              ))
            : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-muted-foreground text-sm">Nessun incontro ancora.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Le persone che incontri appariranno qui.</p>
              </div>
            )
          }
        </div>
      )}

      {/* Eventi */}
      {activeTab === 'events' && (
        <div className="space-y-3">
          {events.length > 0
            ? events.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} onAnnouncementOpen={handleAnnouncementOpen} />
              ))
            : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-muted-foreground text-sm">Nessun evento ancora.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">I locali e gli eventi che visiti appariranno qui.</p>
              </div>
            )
          }
        </div>
      )}
      {/* Announcement banner */}
      <AnimatePresence>
        {activeAnnouncement && (
          <EventAnnouncementBanner
            event={activeAnnouncement.event}
            announcement={EVENT_ANNOUNCEMENTS[activeAnnouncement.event.id]}
            onClose={handleAnnouncementClose}
            onPartecipa={handlePartecipa}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
