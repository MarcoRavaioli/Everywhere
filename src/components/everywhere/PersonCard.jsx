import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';

const MAX_NOTE = 280;

export default function PersonCard({ person, index = 0 }) {
  const { sentEVs, sendEV } = useApp();
  const hasSentEV = sentEVs.includes(person.id);
  const [evState, setEvState] = useState('idle'); // 'idle' | 'expanded' | 'sent'
  const [note, setNote] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (evState === 'expanded') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [evState]);

  const handleEvTap = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasSentEV || evState === 'sent') return;
    if (evState === 'idle') {
      setEvState('expanded');
    } else if (evState === 'expanded') {
      sendEV(person.id, note.trim() || null);
      setEvState('sent');
    }
  };

  const handleCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEvState('idle');
    setNote('');
  };

  const isSent = hasSentEV || evState === 'sent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Link to={`/session/person/${person.id}`} className="block">
        <div className="relative rounded-2xl overflow-hidden group">
          {/* Photo */}
          <div className="aspect-[3/4] relative">
            <img
              src={person.photo}
              alt={person.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          </div>

          {/* Info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <h3 className="text-white font-semibold text-base">{person.name}</h3>
                <p className="text-white/60 text-xs mt-0.5">{person.age} anni</p>
                <p className="text-white/50 text-[11px] mt-0.5 line-clamp-1">{person.bio}</p>
              </div>
              <button
                onClick={handleEvTap}
                className={`flex-shrink-0 p-2.5 rounded-full transition-all duration-300 ${
                  isSent
                    ? 'bg-primary/30 text-primary'
                    : evState === 'expanded'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-primary text-white glow-pink'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inline note bar */}
            <AnimatePresence>
              {evState === 'expanded' && (
                <motion.div
                  key="inline-bar"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 overflow-hidden"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <div className="rounded-xl bg-black/60 backdrop-blur-sm border border-white/10 overflow-hidden">
                    <input
                      ref={inputRef}
                      value={note}
                      onChange={e => setNote(e.target.value.slice(0, MAX_NOTE))}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleEvTap(e);
                        if (e.key === 'Escape') handleCancel(e);
                      }}
                      placeholder="Nota opzionale…"
                      className="w-full bg-transparent px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none"
                    />
                    <div className="flex items-center justify-between px-3 pb-2">
                      <span className="text-[9px] text-white/30">{note.length}/{MAX_NOTE}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCancel}
                          className="text-[10px] text-white/40 underline underline-offset-2"
                        >
                          Annulla
                        </button>
                        <button
                          onClick={handleEvTap}
                          className="px-3 py-1 rounded-lg bg-primary text-white text-[10px] font-semibold glow-pink"
                        >
                          {note.trim() ? 'Invia con nota' : 'Invia EV'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
