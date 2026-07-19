import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';

function TabBar({ active, onChange }) {
  const tabs = ['Inviati', 'Ricevuti', 'Condivisi'];
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-secondary mb-6">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
            active === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function EVSentCard({ person }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full overflow-hidden border border-border/50 flex-shrink-0">
          <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{person.name}, {person.age}</h3>
          <p className="text-xs text-muted-foreground">EV inviato · in attesa</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Send className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
    </motion.div>
  );
}


function EVReceivedCard({ person, note, onSendBack, onIgnore }) {
  const [noteExpanded, setNoteExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-start gap-4">
        {/* Photo with red dot */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => note && setNoteExpanded(v => !v)}
            className={`w-14 h-14 rounded-full overflow-hidden border ${noteExpanded ? 'border-primary/60' : 'border-primary/30'} block`}
          >
            <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
          </button>
          {note && (
            <button
              onClick={() => setNoteExpanded(v => !v)}
              className="absolute bottom-0 left-0 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
              style={{ boxShadow: '0 0 6px rgba(239,68,68,0.7)' }}
            >
              <span className="text-[8px] font-bold text-white">!</span>
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-primary font-medium mb-0.5">Hai ricevuto un EV</p>
          <h3 className="text-base font-semibold text-foreground">
            da {person.name}, {person.age}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{person.bio}</p>
        </div>
      </div>

      {/* Expandable note */}
      <AnimatePresence>
        {noteExpanded && note && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/20">
              <p className="text-xs text-primary font-medium mb-1 uppercase tracking-wider">Nota</p>
              <p className="text-sm text-foreground leading-relaxed">{note}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 mt-4">
        <Button
          onClick={() => onSendBack(person.id)}
          className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm glow-pink"
        >
          <Send className="w-4 h-4 mr-1.5" />
          Ricambia EV
        </Button>
        <Button
          onClick={() => onIgnore(person.id)}
          variant="outline"
          className="h-11 px-4 rounded-xl border-border/50 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function EVMatchCard({ person, onOpenChat }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-13 h-13 rounded-full overflow-hidden border-2 border-primary/50">
            <img src={person.photo} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{person.name}, {person.age}</h3>
          <p className="text-xs text-primary font-medium">EV reciproco · match</p>
        </div>
        <Button
          onClick={() => onOpenChat(person)}
          className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold glow-pink"
        >
          <MessageCircle className="w-3.5 h-3.5 mr-1" />
          Chat
        </Button>
      </div>
    </motion.div>
  );
}

function ChatModal({ person, onClose }) {
  const { activeChats, sendChatMessage, sessionTimeLeft, formatTime } = useApp();
  const [input, setInput] = useState('');
  const messages = activeChats[person.id] || [];
  const messagesEndRef = React.useRef(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendChatMessage(person.id, trimmed);
    setInput('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="glass-strong px-4 pt-6 pb-3 flex items-center gap-3">
        <button onClick={onClose} className="w-9 h-9 rounded-full glass flex items-center justify-center flex-shrink-0">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/30 flex-shrink-0">
          <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{person.name}</p>
          <p className="text-[10px] text-primary">Chat attiva · scade in {formatTime(sessionTimeLeft)}</p>
        </div>
      </div>

      {/* Warning */}
      <div className="px-4 py-2 bg-primary/5 border-b border-primary/10">
        <p className="text-[10px] text-muted-foreground text-center">
          Questa chat è temporanea e scade con la sessione. Non sarà accessibile dopo.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <p className="text-muted-foreground text-sm">Nessun messaggio ancora.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Di' ciao a {person.name}!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.from === 'me'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'glass text-foreground rounded-bl-sm'
            }`}>
              <p>{msg.text}</p>
              <p className={`text-[10px] mt-0.5 ${msg.from === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-strong px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Scrivi un messaggio..."
          className="flex-1 h-11 rounded-xl bg-secondary border border-border/50 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
        />
        <button
          onClick={handleSend}
          className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center glow-pink flex-shrink-0"
        >
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </motion.div>
  );
}

export default function EVPage() {
  const { people, sentEVs, receivedEVs, matchedEVs, sendEVBack, ignoreEV, evNotes } = useApp();
  const [activeTab, setActiveTab] = useState('Inviati');
  const [chatPerson, setChatPerson] = useState(null);

  const sentPeople = people.filter(p => sentEVs.includes(p.id) && !matchedEVs.includes(p.id));
  const receivedPeople = people.filter(p => receivedEVs.includes(p.id));
  const matchedPeople = people.filter(p => matchedEVs.includes(p.id));

  const isEmpty = {
    Inviati: sentPeople.length === 0,
    Ricevuti: receivedPeople.length === 0,
    Condivisi: matchedPeople.length === 0,
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground mb-5">EV</h1>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {activeTab === 'Inviati' && (
          <motion.div key="inviati" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {sentPeople.length > 0 ? (
              <div className="space-y-2">
                {sentPeople.map(person => <EVSentCard key={person.id} person={person} />)}
              </div>
            ) : (
              <EmptyState icon={Send} text="Nessun EV inviato." sub="Invia il tuo primo EV dalla lista persone." />
            )}
          </motion.div>
        )}

        {activeTab === 'Ricevuti' && (
          <motion.div key="ricevuti" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {receivedPeople.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence>
                  {receivedPeople.map(person => (
                    <EVReceivedCard
                      key={person.id}
                      person={person}
                      note={evNotes?.[person.id] || null}
                      onSendBack={sendEVBack}
                      onIgnore={ignoreEV}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <EmptyState icon={Send} text="Nessun EV ricevuto." sub="Quando qualcuno ti invia un EV, appare qui." />
            )}
          </motion.div>
        )}

        {activeTab === 'Condivisi' && (
          <motion.div key="condivisi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {matchedPeople.length > 0 ? (
              <div className="space-y-2">
                {matchedPeople.map(person => (
                  <EVMatchCard key={person.id} person={person} onOpenChat={setChatPerson} />
                ))}
              </div>
            ) : (
              <EmptyState icon={MessageCircle} text="Nessun match ancora." sub="Quando un EV è ricambiato, il profilo appare qui e puoi aprire la chat." />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat modal */}
      <AnimatePresence>
        {chatPerson && (
          <ChatModal person={chatPerson} onClose={() => setChatPerson(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ icon: Icon, text, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-sm">{text}</p>
      {sub && <p className="text-muted-foreground/60 text-xs mt-1 max-w-[220px] leading-relaxed">{sub}</p>}
    </div>
  );
}
