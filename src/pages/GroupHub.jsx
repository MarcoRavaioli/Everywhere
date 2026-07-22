import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, Users, Crown, Copy, Check, LogOut, Eye, EyeOff,
  UserPlus, Plus, Send, X, MessageCircle, Heart,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useGroup } from '@/context/GroupContext';
import { DEFAULT_AVATAR } from '@/api/avatars';

function joinUrl(token) {
  return `${window.location.origin}/join-group?g=${token}`;
}

function Avatar({ src, alt, className = '' }) {
  return (
    <img
      src={src || DEFAULT_AVATAR}
      alt={alt || ''}
      className={`object-cover ${className}`}
      onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
    />
  );
}

// Countdown per un gruppo ancora "forming" (1h dalla creazione)
function useCountdown(expiresAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GroupHub() {
  const navigate = useNavigate();
  const { currentUser, isInSession } = useApp();
  const {
    myGroup, myGroupLoading, incomingGroupEvs, conversations,
    createGroup, joinGroup, leaveGroup, dissolveGroup, transferLeadership,
    setVisibility, enterNightAsGroup, acceptGroupEv, ignoreGroupEv,
  } = useGroup();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [joinToken, setJoinToken] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openChat, setOpenChat] = useState(null); // conversation

  const countdown = useCountdown(myGroup?.status === 'forming' ? myGroup?.expires_at : null);
  const myMembership = useMemo(
    () => myGroup?.members?.find(m => m.id === currentUser?.id) ?? null,
    [myGroup, currentUser?.id]
  );

  async function run(fn) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err?.message ?? 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!myGroup?.token) return;
    navigator.clipboard?.writeText(joinUrl(myGroup.token)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const header = (
    <div className="sticky top-0 z-40 glass-strong px-4 py-3 flex items-center gap-3">
      <button
        onClick={() => navigate(isInSession ? '/session' : '/home')}
        className="w-9 h-9 rounded-full glass flex items-center justify-center flex-shrink-0"
        aria-label="Indietro"
      >
        <ArrowLeft className="w-4 h-4 text-muted-foreground" />
      </button>
      <h1 className="text-base font-bold text-foreground">Gruppo</h1>
    </div>
  );

  if (myGroupLoading && !myGroup) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ─── Senza gruppo: crea o entra ───────────────────────────────────
  if (!myGroup) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="px-5 py-6 max-w-lg mx-auto">
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Presentati in gruppo</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[300px] mx-auto">
              Crea un gruppo e condividi il QR con chi è con te, oppure entra in
              un gruppo esistente scansionando il suo QR.
            </p>
          </div>

          {error && <p className="text-[13px] text-destructive text-center mb-3">{error}</p>}

          <button
            onClick={() => run(() => createGroup(null))}
            disabled={busy}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 glow-pink disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            Crea gruppo
          </button>

          {!showJoin ? (
            <button
              onClick={() => setShowJoin(true)}
              className="w-full h-14 mt-3 rounded-xl glass border border-border/50 text-foreground font-semibold flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Partecipa a un gruppo
            </button>
          ) : (
            <div className="mt-3 glass rounded-xl p-4 border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">
                Inquadra il QR del gruppo con la fotocamera, oppure incolla qui il
                codice.
              </p>
              <div className="flex gap-2">
                <input
                  value={joinToken}
                  onChange={e => setJoinToken(e.target.value)}
                  placeholder="Codice del gruppo"
                  className="flex-1 h-11 rounded-xl bg-secondary border border-border/50 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => run(async () => {
                    // accetta sia il token nudo sia l'URL completo
                    const raw = joinToken.trim();
                    const token = raw.includes('g=') ? raw.split('g=')[1].split('&')[0] : raw;
                    await joinGroup(token);
                  })}
                  disabled={busy || !joinToken.trim()}
                  className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>
            </div>
          )}

          <GroupConversations conversations={conversations} onOpen={setOpenChat} />
        </div>

        <AnimatePresence>
          {openChat && <GroupChatModal conversation={openChat} onClose={() => setOpenChat(null)} />}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Con gruppo: gestione ─────────────────────────────────────────
  const isLeader = myGroup.is_leader;
  const groupName = myGroup.display_name || 'Il tuo gruppo';

  return (
    <div className="min-h-screen bg-background pb-10">
      {header}
      <div className="px-5 py-5 max-w-lg mx-auto space-y-5">
        {error && <p className="text-[13px] text-destructive text-center">{error}</p>}

        {/* Stato */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">{groupName}</h2>
          {myGroup.status === 'forming' ? (
            <p className="text-xs text-amber-400 mt-1">
              In formazione · si scioglie tra {countdown ?? '—'} se non entrate in una serata
            </p>
          ) : (
            <p className="text-xs text-primary mt-1">In serata</p>
          )}
        </div>

        {/* QR di invito */}
        <div className="glass rounded-2xl p-5 border border-border/50 flex flex-col items-center">
          <div className="bg-white rounded-xl p-3">
            <QRCodeSVG value={joinUrl(myGroup.token)} size={168} level="M" />
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Fai scansionare questo QR per far entrare qualcuno nel gruppo.
          </p>
          <button
            onClick={copyLink}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Link copiato' : 'Copia il link'}
          </button>
        </div>

        {/* Porta in serata */}
        {myGroup.status === 'forming' && isInSession && (
          <button
            onClick={() => run(enterNightAsGroup)}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold glow-pink disabled:opacity-50"
          >
            Porta il gruppo in questa serata
          </button>
        )}
        {myGroup.status === 'forming' && !isInSession && isLeader && (
          <p className="text-xs text-muted-foreground text-center">
            Entra in una serata (scansiona il QR del locale) per portarci il gruppo.
          </p>
        )}

        {/* Membri */}
        <section>
          <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2 px-1">
            Partecipanti · {myGroup.members.length}
          </h3>
          <div className="space-y-2">
            {myGroup.members.map(m => (
              <div key={m.id} className="glass rounded-xl p-3 flex items-center gap-3 border border-border/40">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-border/50">
                  <Avatar src={m.photo} alt={m.name} className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    {m.name}
                    {m.is_leader && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {m.id === currentUser?.id && <span className="text-[10px] text-muted-foreground">(tu)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.visibility === 'group_only' ? 'Visibile solo nel gruppo' : 'Visibile anche da solo'}
                  </p>
                </div>
                {isLeader && !m.is_leader && (
                  <button
                    onClick={() => run(() => transferLeadership(m.id))}
                    disabled={busy}
                    className="text-[11px] text-primary underline underline-offset-2 disabled:opacity-50"
                  >
                    Rendi capo
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* La mia visibilità */}
        {myMembership && (
          <section className="glass rounded-xl p-4 border border-border/40">
            <p className="text-sm font-medium text-foreground mb-1">Come vuoi mostrarti</p>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Se scegli "solo nel gruppo" non riceverai EV singoli: gli altri ti
              vedranno unicamente come parte del gruppo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => run(() => setVisibility('single_and_group'))}
                disabled={busy}
                className={`h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  myMembership.visibility === 'single_and_group'
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'glass border-border/50 text-muted-foreground'
                }`}
              >
                <Eye className="w-4 h-4" /> Singolo e gruppo
              </button>
              <button
                onClick={() => run(() => setVisibility('group_only'))}
                disabled={busy}
                className={`h-11 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  myMembership.visibility === 'group_only'
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'glass border-border/50 text-muted-foreground'
                }`}
              >
                <EyeOff className="w-4 h-4" /> Solo nel gruppo
              </button>
            </div>
          </section>
        )}

        {/* EV in arrivo al gruppo */}
        {incomingGroupEvs.length > 0 && (
          <section>
            <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2 px-1">
              EV per il gruppo
            </h3>
            <div className="space-y-2">
              {incomingGroupEvs.map(ev => (
                <div key={ev.id} className="glass rounded-xl p-3 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-border/50">
                      <Avatar src={ev.photo} alt={ev.senderName} className="w-full h-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ev.senderName}</p>
                      {ev.note && <p className="text-xs text-muted-foreground truncate">"{ev.note}"</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => run(() => acceptGroupEv(ev.id))}
                      disabled={busy}
                      className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Heart className="w-4 h-4" /> Accetta
                    </button>
                    <button
                      onClick={() => ignoreGroupEv(ev.id)}
                      disabled={busy}
                      className="px-4 h-10 rounded-lg glass border border-border/50 text-sm text-muted-foreground disabled:opacity-50"
                    >
                      Ignora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conversazioni */}
        <GroupConversations conversations={conversations} onOpen={setOpenChat} />

        {/* Azioni */}
        <div className="pt-2 space-y-2">
          <button
            onClick={() => run(leaveGroup)}
            disabled={busy}
            className="w-full h-11 rounded-xl glass border border-border/50 text-destructive text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" /> Esci dal gruppo
          </button>
          {isLeader && (
            <button
              onClick={() => run(dissolveGroup)}
              disabled={busy}
              className="w-full h-11 rounded-xl text-destructive/80 text-xs disabled:opacity-50"
            >
              Sciogli il gruppo per tutti
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {openChat && <GroupChatModal conversation={openChat} onClose={() => setOpenChat(null)} />}
      </AnimatePresence>
    </div>
  );
}

function GroupConversations({ conversations, onOpen }) {
  if (!conversations?.length) return null;
  return (
    <section>
      <h3 className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2 px-1">
        Chat di gruppo
      </h3>
      <div className="space-y-2">
        {conversations.map(c => (
          <button
            key={c.id}
            onClick={() => onOpen(c)}
            className="w-full glass rounded-xl p-3 flex items-center gap-3 border border-border/40 text-left"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-border/50">
              <Avatar src={c.otherUserPhoto} alt={c.otherUserName} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {c.amIGroupSide ? c.otherUserName : (c.groupName || 'Gruppo')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {c.amIGroupSide ? 'ha scritto al gruppo' : 'chat con il gruppo'}
              </p>
            </div>
            <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}

function GroupChatModal({ conversation, onClose }) {
  const { currentUser } = useApp();
  const { groupChats, openGroupChat, sendGroupMessage } = useGroup();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const endRef = React.useRef(null);
  const messages = groupChats[conversation.id] ?? [];

  useEffect(() => { openGroupChat(conversation.id); }, [conversation.id, openGroupChat]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendGroupMessage(conversation.id, trimmed);
      setInput('');
    } catch (err) {
      setError(err?.message ?? 'Messaggio non inviato.');
    } finally {
      setSending(false);
    }
  }

  const title = conversation.amIGroupSide
    ? conversation.otherUserName
    : (conversation.groupName || 'Gruppo');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-background"
    >
      <div className="glass-strong px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center flex-shrink-0">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          <p className="text-[10px] text-primary">Chat di gruppo · la vedono tutti i membri</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <p className="text-muted-foreground text-sm">Nessun messaggio ancora.</p>
          </div>
        )}
        {messages.map(msg => {
          const mine = msg.senderId === currentUser?.id;
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'glass text-foreground rounded-bl-sm'
              }`}>
                {!mine && msg.senderName && (
                  <p className="text-[10px] text-primary mb-0.5">{msg.senderName}</p>
                )}
                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p className="px-4 pb-1 text-[11px] text-destructive text-center">{error}</p>}
      <div className="glass-strong px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Scrivi al gruppo..."
          className="flex-1 h-11 rounded-xl bg-secondary border border-border/50 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center glow-pink flex-shrink-0 disabled:opacity-50"
        >
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </motion.div>
  );
}
