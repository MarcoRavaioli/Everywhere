import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MoreHorizontal, Send } from 'lucide-react';
import InterestChip from '@/components/everywhere/InterestChip';
import { useApp } from '@/context/AppContext';
import ReportBlockSheet from '@/components/everywhere/ReportBlockSheet';
import { DEFAULT_AVATAR } from '@/api/avatars';

const MAX_NOTE = 280;

export default function PersonDetail() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { people, sentEVs, sendEV, refreshPeople, refreshMemories } = useApp();
  const [showSentConfirm, setShowSentConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [evError, setEvError] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Dopo blocco o segnalazione la persona non è più visibile:
  // si ricaricano le liste e si esce dalla sua scheda.
  const handleModerationDone = async () => {
    setSheetOpen(false);
    await Promise.all([refreshPeople(), refreshMemories()]);
    navigate('/session', { replace: true });
  };
  // 'idle' | 'expanded' | 'sent'
  const [evState, setEvState] = useState('idle');
  const [note, setNote] = useState('');
  const inputRef = useRef(null);

  const person = people.find(p => p.id === personId);
  const hasSentEV = sentEVs.includes(personId);

  useEffect(() => {
    if (evState === 'expanded') {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [evState]);

  if (!person) {
    navigate(-1);
    return null;
  }

  const handleEvTap = async () => {
    if (hasSentEV || sending) return;
    if (evState === 'idle') {
      setEvState('expanded');
      return;
    }
    // Conferma solo dopo l'esito del server, non prima
    setSending(true);
    setEvError(null);
    try {
      await sendEV(person.id, note.trim() || null);
      setEvState('sent');
      setShowSentConfirm(true);
      setTimeout(() => setShowSentConfirm(false), 3000);
    } catch (err) {
      setEvError(err?.message ?? 'Invio non riuscito. Riprova.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Photo */}
      <div className="relative">
        <div className="aspect-[3/4] max-h-[65vh]">
          <img
            src={person.photo || DEFAULT_AVATAR}
            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
            alt={person.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        </div>

        {/* Top buttons */}
        <div className="absolute top-6 left-4 right-4 flex justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Blocca o segnala"
            className="w-10 h-10 rounded-full glass flex items-center justify-center"
          >
            <MoreHorizontal className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-6 -mt-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-foreground">
            {person.name}, <span className="font-normal">{person.age}</span>
          </h1>

          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            {person.bio}
          </p>

          {/* Interests */}
          <div className="flex flex-wrap gap-2 mt-5">
            {person.interests.map((interest) => (
              <InterestChip key={interest} label={interest} />
            ))}
          </div>

          {/* EV Button — expands inline */}
          <div className="mt-8 mb-8">
            {/* Idle */}
            {!hasSentEV && evState === 'idle' && (
              <button
                onClick={handleEvTap}
                className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base glow-pink flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Invia EV
              </button>
            )}

            {/* Expanded */}
            {!hasSentEV && evState === 'expanded' && (
              <div className="w-full rounded-2xl bg-primary/10 border border-primary/25 overflow-hidden">
                <div className="relative">
                  <input
                    ref={inputRef}
                    value={note}
                    onChange={e => setNote(e.target.value.slice(0, MAX_NOTE))}
                    onKeyDown={e => e.key === 'Enter' && handleEvTap()}
                    placeholder="Aggiungi una nota… (opzionale)"
                    className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                  {note.length > 0 && (
                    <span className={`absolute top-4 right-4 text-[10px] ${note.length >= MAX_NOTE ? 'text-destructive' : 'text-muted-foreground/50'}`}>
                      {note.length}/{MAX_NOTE}
                    </span>
                  )}
                </div>
                {evError && (
                  <p className="px-4 pb-2 text-xs text-destructive">{evError}</p>
                )}
                <button
                  onClick={handleEvTap}
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 h-12 bg-primary text-primary-foreground font-semibold text-sm glow-pink disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Invio…' : (note.trim() ? 'Invia EV con nota' : 'Invia EV')}
                </button>
              </div>
            )}

            {/* Sent */}
            {(hasSentEV || evState === 'sent') && (
              <div className="w-full h-14 rounded-xl bg-secondary flex items-center justify-center gap-2">
                <Send className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground font-medium">EV inviato</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* EV Sent Overlay */}
      <AnimatePresence>
        {showSentConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center px-6"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 glow-pink-strong">
                <Send className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">EV inviato!</h2>
              <p className="text-muted-foreground text-sm max-w-[260px] leading-relaxed">
                Se anche lei ti invierà un EV, potrete incontrarvi nella vita reale.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    <AnimatePresence>
        {sheetOpen && (
          <ReportBlockSheet
            person={person}
            onClose={() => setSheetOpen(false)}
            onDone={handleModerationDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
