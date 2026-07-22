import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MapPin, RefreshCw, ChevronRight, Send, Heart, Crown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useGroup } from '@/context/GroupContext';
import SessionTimer from '@/components/everywhere/SessionTimer';
import PersonCard from '@/components/everywhere/PersonCard';
import { DEFAULT_AVATAR } from '@/api/avatars';

function PeopleGrid({ list, offset = 0 }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {list.map((person, i) => (
        <PersonCard key={person.id} person={person} index={offset + i} />
      ))}
    </div>
  );
}

// Cluster degli avatar dei membri: la "faccia" del gruppo quando non ha
// una foto impostata.
function GroupAvatars({ group }) {
  if (group.photo) {
    return (
      <div className="w-14 h-14 rounded-full overflow-hidden border border-primary/30">
        <img src={group.photo} alt={group.displayName || 'Gruppo'} className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }} />
      </div>
    );
  }
  const shown = group.members.slice(0, 3);
  return (
    <div className="flex -space-x-3">
      {shown.map(m => (
        <div key={m.id} className="w-10 h-10 rounded-full overflow-hidden border-2 border-background">
          <img src={m.photo || DEFAULT_AVATAR} alt={m.name} className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }} />
        </div>
      ))}
    </div>
  );
}

function GroupCard({ group, onEv }) {
  return (
    <button
      onClick={() => onEv(group)}
      className="w-full glass rounded-2xl p-4 flex items-center gap-3 border border-primary/20 text-left"
    >
      <GroupAvatars group={group} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-primary" />
          {group.displayName || 'Gruppo'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {group.memberCount} {group.memberCount === 1 ? 'persona' : 'persone'} · manda un EV al gruppo
        </p>
      </div>
      <Heart className="w-4 h-4 text-primary flex-shrink-0" />
    </button>
  );
}

function GroupEvSheet({ group, onClose }) {
  const { sendGroupEv } = useGroup();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await sendGroupEv(group.id, note.trim() || null);
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err?.message ?? 'Invio non riuscito.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed bottom-0 left-0 right-0 z-[60] glass-strong rounded-t-3xl px-5 pt-5 pb-10"
      >
        <div className="w-10 h-1 rounded-full bg-border/60 mx-auto mb-5" />
        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
              <Heart className="w-7 h-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground">EV inviato al gruppo!</p>
            <p className="text-xs text-muted-foreground mt-1">Se un membro accetta, si apre una chat con tutti.</p>
          </div>
        ) : (
          <>
            <h3 className="text-base font-bold text-foreground mb-1">
              EV a {group.displayName || 'questo gruppo'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Qualsiasi membro potrà accettare: nascerà una chat condivisa con tutto il gruppo.
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={280}
              placeholder="Aggiungi una nota (facoltativa)…"
              className="w-full h-20 rounded-xl bg-secondary border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 resize-none mb-3"
            />
            {error && <p className="text-[13px] text-destructive text-center mb-2">{error}</p>}
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 glow-pink disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Invio…' : 'Invia EV al gruppo'}
            </button>
          </>
        )}
      </motion.div>
    </>
  );
}

export default function Session() {
  const navigate = useNavigate();
  const {
    currentVenue, currentNight, people, peopleLoading, peopleError,
    headcount, refreshPeople,
  } = useApp();
  const { myGroup, groupsInNight } = useGroup();
  const [evGroup, setEvGroup] = useState(null);

  // Chi è entrato dal mio stesso QR è "nella mia sala": stessa festa,
  // ma sapere chi hai davvero intorno cambia l'esperienza.
  const sameRoom = people.filter(p => p.sameRoom);
  const elsewhere = people.filter(p => !p.sameRoom);
  const myRoomLabel = sameRoom[0]?.roomLabel ?? null;
  const isEmpty = people.length === 0 && groupsInNight.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-strong px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              {currentVenue?.name ?? 'Locale'}
            </h2>
            {currentNight?.title && (
              <p className="text-[11px] text-primary truncate">{currentNight.title}</p>
            )}
          </div>
          <SessionTimer variant="compact" />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-primary" />
            <span className="text-xs text-muted-foreground">
              {headcount === 1 ? '1 persona presente' : `${headcount} persone presenti`}
            </span>
          </span>
          {myRoomLabel && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
              <MapPin className="w-3 h-3" />
              {myRoomLabel}
            </span>
          )}
        </div>
      </div>

      {/* Banner gruppo */}
      <button
        onClick={() => navigate('/group')}
        className="w-full px-4 py-2.5 flex items-center gap-2 glass border-b border-border/40 text-left"
      >
        {myGroup ? (
          <>
            <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-foreground flex-1 truncate">
              Sei nel gruppo {myGroup.display_name || 'senza nome'} · gestiscilo
            </span>
          </>
        ) : (
          <>
            <Users className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-xs text-foreground flex-1">Presentati in gruppo</span>
          </>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>

      <div className="px-3 py-4">
        {peopleError ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-muted-foreground leading-relaxed">{peopleError}</p>
            <button
              onClick={refreshPeople}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Riprova
            </button>
          </div>
        ) : peopleLoading && isEmpty ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="text-center py-16 px-6">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-foreground font-medium">Sei il primo qui</p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[260px] mx-auto">
              Appena qualcun altro entra nella serata lo vedrai comparire,
              senza dover ricaricare.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupsInNight.length > 0 && (
              <section>
                <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 px-1">
                  Gruppi presenti
                </h3>
                <div className="space-y-2">
                  {groupsInNight.map(g => (
                    <GroupCard key={g.id} group={g} onEv={setEvGroup} />
                  ))}
                </div>
              </section>
            )}

            {sameRoom.length > 0 && (
              <section>
                {elsewhere.length > 0 && (
                  <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 px-1">
                    {myRoomLabel ? `Nella tua sala · ${myRoomLabel}` : 'Vicino a te'}
                  </h3>
                )}
                <PeopleGrid list={sameRoom} />
              </section>
            )}

            {elsewhere.length > 0 && (
              <section>
                <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 px-1">
                  Altrove alla serata
                </h3>
                <PeopleGrid list={elsewhere} offset={sameRoom.length} />
              </section>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {evGroup && <GroupEvSheet group={evGroup} onClose={() => setEvGroup(null)} />}
      </AnimatePresence>
    </div>
  );
}
