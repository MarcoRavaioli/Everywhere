import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Tag, GlassWater, X, CreditCard, CheckCircle, Music, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function DrinkModal({ onClose, people }) {
  const { sendDrink, confirmDrinkPayment, currentUser } = useApp();
  const [step, setStep] = useState('select'); // 'select' | 'payment' | 'done'
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [pendingNotif, setPendingNotif] = useState(null);

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setStep('payment');
  };

  const handlePay = () => {
    const notif = sendDrink(currentUser?.name || 'Qualcuno', selectedPerson);
    setPendingNotif(notif);
    confirmDrinkPayment(notif.id);
    setStep('done');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-card rounded-t-3xl p-6 pb-10"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">
            {step === 'select' && 'Offri un drink'}
            {step === 'payment' && 'Conferma e paga'}
            {step === 'done' && 'Drink inviato!'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-xs text-muted-foreground mb-4">
                Scegli a chi offrire un drink. L'utente riceverà una notifica e potrà ritirarlo al bar.
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {people.map(person => (
                  <button
                    key={person.id}
                    onClick={() => handleSelectPerson(person)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-border/50 flex-shrink-0">
                      <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{person.name}</p>
                      <p className="text-xs text-muted-foreground">{person.age} anni</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 p-4 glass rounded-2xl mb-5">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-primary/30 flex-shrink-0">
                  <img src={selectedPerson.photo} alt={selectedPerson.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Drink per {selectedPerson.name}</p>
                  <p className="text-xs text-muted-foreground">Il barista preparerà il drink al ritiro</p>
                </div>
              </div>

              <div className="glass rounded-2xl p-4 mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Cocktail della casa</span>
                  <span className="text-sm font-semibold text-foreground">€9,00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Commissione servizio</span>
                  <span className="text-sm font-semibold text-foreground">€1,00</span>
                </div>
                <div className="h-px bg-border my-3" />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground">Totale</span>
                  <span className="text-base font-bold text-primary">€10,00</span>
                </div>
              </div>

              <Button
                onClick={handlePay}
                className="w-full h-13 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-pink"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Paga e invia drink
              </Button>
              <button onClick={() => setStep('select')} className="w-full text-center text-muted-foreground text-xs mt-3">
                Cambia persona
              </button>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-4"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 glow-pink">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Drink offerto a {selectedPerson.name}!
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                {selectedPerson.name} riceverà una notifica. Può passare dal bar per ritirarlo.
              </p>
              <Button onClick={onClose} className="mt-6 rounded-xl px-8 bg-primary hover:bg-primary/90 text-primary-foreground glow-pink">
                Chiudi
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default function Locale() {
  const { currentVenue, venueMessages, people } = useApp();
  const [showDrinkModal, setShowDrinkModal] = useState(false);

  const pinned = venueMessages.filter(m => m.pinned);
  const rest = venueMessages.filter(m => !m.pinned);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Sei in</p>
        <h1 className="text-2xl font-bold text-foreground">{currentVenue?.name || 'MOON CLUB'}</h1>
      </div>

      {/* Offer drink CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <button
          onClick={() => setShowDrinkModal(true)}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20 glow-pink hover:from-primary/30 transition-all duration-300"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <GlassWater className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-foreground">Offri un drink</p>
            <p className="text-xs text-muted-foreground mt-0.5">Scegli qualcuno e paga direttamente in app</p>
          </div>
        </button>
      </motion.div>

      {/* Pinned messages */}
      {pinned.length > 0 && (
        <div className="mb-4">
          {pinned.map((msg, i) => <VenueMessageCard key={msg.id} msg={msg} index={i} />)}
        </div>
      )}

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

      {/* Drink modal */}
      <AnimatePresence>
        {showDrinkModal && (
          <DrinkModal onClose={() => setShowDrinkModal(false)} people={people} />
        )}
      </AnimatePresence>
    </div>
  );
}
