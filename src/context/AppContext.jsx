import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { fetchMyProfile, upsertMyProfile, rowToUser } from '@/api/profiles';
import { getAvatarUrl, uploadMyAvatar } from '@/api/avatars';
import { fetchMySession, endMySession } from '@/api/sessions';
import {
  fetchPeopleInMyNight, fetchNightHeadcount, fetchMyEvs, fetchMyMatches,
  sendEv as sendEvApi, ignoreEv as ignoreEvApi,
} from '@/api/people';
import { fetchMessagesByPerson, sendMessage as sendMessageApi, rowToMessage, ChatError } from '@/api/chat';
import { fetchVisibleVenueMessages } from '@/api/venueMessages';
import { fetchMyMemories, fetchMyNightRecaps } from '@/api/memories';
import { supabase } from '@/lib/supabaseClient';

const AppContext = createContext(null);

export const ALL_TOPICS = [
  'Musica', 'Vino', 'Viaggi', 'Concerti', 'Cinema', 'Arte', 'Sport',
  'Techno', 'Cibo', 'Serate', 'Fotografia', 'Design', 'Libri', 'Cocktail',
  'Festival', 'Cultura pop',
];

export function AppProvider({ children }) {
  const { user: authUser, authChecked } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [business, setBusiness] = useState(null);
  // Sessione reale letta dal DB: sopravvive al reload
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Persone ed EV reali della serata in corso
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState(null);
  const [headcount, setHeadcount] = useState(0);
  const [sentEVs, setSentEVs] = useState([]);      // id delle persone a cui ho inviato
  const [receivedEVs, setReceivedEVs] = useState([]); // id di chi mi ha inviato
  const [matchedEVs, setMatchedEVs] = useState([]);   // id delle persone con cui ho un match
  const [evNotes, setEvNotes] = useState({});         // personId -> nota
  const evIdByPerson = useRef({});                    // personId -> id dell'EV ricevuto
  const matchIdByPerson = useRef({});                 // personId -> id del match (per la chat)
  const [memories, setMemories] = useState([]);
  const [events, setEvents] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesError, setMemoriesError] = useState(null);
  const [venueMessages, setVenueMessages] = useState([]);
  const [activeChats, setActiveChats] = useState({}); // personId -> messages[]
  // Il tempo rimasto si calcola dalla scadenza reale invece di scalare
  // un contatore: così un reload (o il telefono in tasca) non lo falsa.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  const sessionTimeLeft = session
    ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - nowTick) / 1000))
    : 0;
  const isInSession = !!session && sessionTimeLeft > 0;
  const currentVenue = session?.venue ?? null;
  const currentNight = session?.night ?? null;

  // Sessione scaduta mentre l'app era aperta: si esce da soli
  useEffect(() => {
    if (session && sessionTimeLeft === 0) setSession(null);
  }, [session, sessionTimeLeft]);

  const refreshSession = useCallback(async () => {
    if (!authUser) {
      setSession(null);
      setSessionChecked(true);
      return null;
    }
    try {
      const s = await fetchMySession();
      setSession(s);
      return s;
    } catch (err) {
      console.error('Caricamento sessione fallito:', err);
      setSession(null);
      return null;
    } finally {
      setSessionChecked(true);
    }
  }, [authUser]);

  // All'avvio (e a ogni cambio utente) recupera la sessione dal DB
  useEffect(() => {
    if (!authChecked) return;
    refreshSession();
  }, [authChecked, refreshSession]);

  // Carica il profilo reale da Supabase quando cambia l'utente autenticato.
  // profileChecked resta false finché l'auth non è risolta E il profilo non è
  // stato cercato: chi fa routing deve aspettare entrambi.
  useEffect(() => {
    let cancelled = false;
    if (!authChecked) return;
    if (!authUser) {
      setCurrentUser(prev => (prev?.isGuest ? prev : null));
      // Logout: azzera lo stato dell'app, altrimenti chi accede dopo
      // eredita sessione, locale e chat dell'utente precedente
      setBusiness(null);
      setSession(null);
      setSentEVs([]);
      setMatchedEVs([]);
      setActiveChats({});
      setVenueMessages([]);
      setProfileChecked(true);
      return;
    }
    setProfileChecked(false);
    fetchMyProfile()
      .then(row => {
        if (cancelled) return;
        setCurrentUser(rowToUser(row));
        // La signed URL della foto arriva in un secondo momento:
        // nel frattempo la UI mostra il fallback
        if (row?.photo_path) {
          getAvatarUrl(row.photo_path).then(url => {
            if (!cancelled && url) {
              setCurrentUser(prev =>
                prev && prev.id === row.id ? { ...prev, photo: url } : prev
              );
            }
          });
        }
      })
      .catch(err => {
        console.error('Caricamento profilo fallito:', err);
        if (!cancelled) setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setProfileChecked(true);
      });
    return () => { cancelled = true; };
  }, [authChecked, authUser?.id]);

  // Ricarica il profilo dal DB quando cambia senza che cambi l'utente
  // autenticato (es. l'onboarding business che imposta account_type).
  const refreshProfile = useCallback(async () => {
    const row = await fetchMyProfile();
    const user = rowToUser(row);
    if (row?.photo_path) user.photo = await getAvatarUrl(row.photo_path);
    setCurrentUser(user);
    return user;
  }, []);

  const loginAsGuest = useCallback(() => {
    setCurrentUser({
      id: 'guest',
      name: 'Ospite',
      age: null,
      bio: '',
      photo: null,
      interests: [],
      isGuest: true,
    });
  }, []);

  const createProfile = useCallback(async (profileData) => {
    if (authUser) {
      const fields = {
        name: profileData.name,
        bio: profileData.bio ?? '',
        age: profileData.age ?? null,
        interests: profileData.interests ?? [],
      };
      // Foto caricata durante l'onboarding, prima che la riga esistesse
      if (profileData.photoPath) fields.photo_path = profileData.photoPath;
      const row = await upsertMyProfile(fields);
      const user = rowToUser(row);
      if (row.photo_path) user.photo = await getAvatarUrl(row.photo_path);
      setCurrentUser(user);
      return user;
    }
    // Modalità ospite (demo): solo stato locale
    setCurrentUser(prev => ({ ...prev, ...profileData, isGuest: false }));
  }, [authUser]);

  const updateProfile = useCallback(async (profileData) => {
    if (authUser && currentUser && !currentUser.isGuest) {
      const row = await upsertMyProfile({
        name: profileData.name ?? currentUser.name,
        bio: profileData.bio ?? currentUser.bio ?? '',
        age: profileData.age ?? currentUser.age,
        interests: profileData.interests ?? currentUser.interests ?? [],
      });
      setCurrentUser(rowToUser(row));
      return;
    }
    setCurrentUser(prev => ({ ...prev, ...profileData }));
  }, [authUser, currentUser]);

  // Carica la foto profilo. Ritorna { path, url }; lancia AvatarError
  // con messaggio user-friendly su file non validi o errori di rete.
  const uploadAvatar = useCallback(async (file) => {
    const { path, url } = await uploadMyAvatar(file);
    setCurrentUser(prev =>
      prev && !prev.isGuest ? { ...prev, photo: url, photoPath: path } : prev
    );
    return { path, url };
  }, []);

  // Uscita volontaria dal locale: chiude la sessione anche sul server,
  // altrimenti si resterebbe visibili agli altri presenti.
  const endSession = useCallback(async () => {
    try {
      if (authUser) await endMySession();
    } catch (err) {
      console.error('Chiusura sessione fallita:', err);
    } finally {
      setSession(null);
    }
  }, [authUser]);

  // ─── Persone, EV e match reali ──────────────────────────────────────
  // Le pagine consumano le stesse forme di prima (array di id, mappa
  // delle note): cambia la sorgente, non l'interfaccia.

  const refreshPeople = useCallback(async () => {
    if (!session) {
      setPeople([]);
      setHeadcount(0);
      return;
    }
    setPeopleError(null);
    try {
      const [list, count] = await Promise.all([
        fetchPeopleInMyNight(),
        fetchNightHeadcount(),
      ]);
      setPeople(list);
      setHeadcount(count);
    } catch (err) {
      console.error('Caricamento persone fallito:', err);
      setPeopleError('Non riesco a caricare chi è presente. Controlla la connessione.');
    }
  }, [session]);

  const refreshMemories = useCallback(async () => {
    if (!authUser) {
      setMemories([]);
      setEvents([]);
      return;
    }
    setMemoriesLoading(true);
    setMemoriesError(null);
    try {
      const [mem, recaps] = await Promise.all([fetchMyMemories(), fetchMyNightRecaps()]);
      setMemories(mem);
      setEvents(recaps);
    } catch (err) {
      console.error('Caricamento ricordi fallito:', err);
      setMemoriesError('Non riesco a caricare i tuoi ricordi. Controlla la connessione.');
    } finally {
      setMemoriesLoading(false);
    }
  }, [authUser]);

  // I ricordi non dipendono da una serata in corso: si guardano da casa
  useEffect(() => {
    if (!authChecked) return;
    refreshMemories();
  }, [authChecked, refreshMemories]);

  const refreshVenueMessages = useCallback(async () => {
    if (!session) {
      setVenueMessages([]);
      return;
    }
    try {
      setVenueMessages(await fetchVisibleVenueMessages());
    } catch (err) {
      console.error('Caricamento comunicazioni fallito:', err);
    }
  }, [session]);

  const refreshEvs = useCallback(async () => {
    if (!session?.nightId) {
      setSentEVs([]);
      setReceivedEVs([]);
      setMatchedEVs([]);
      setEvNotes({});
      evIdByPerson.current = {};
      return;
    }
    try {
      const [{ sent, received, notes }, matches] = await Promise.all([
        fetchMyEvs(session.nightId),
        fetchMyMatches(),
      ]);
      const matchedIds = matches.map(m => m.personId);
      evIdByPerson.current = Object.fromEntries(received.map(r => [r.personId, r.id]));
      matchIdByPerson.current = Object.fromEntries(matches.map(m => [m.personId, m.id]));
      setSentEVs(sent);
      // Chi è già diventato match esce dalla lista "ricevuti"
      setReceivedEVs(received.map(r => r.personId).filter(id => !matchedIds.includes(id)));
      setMatchedEVs(matchedIds);
      setEvNotes(notes);

      // I messaggi arrivano in una sola query per tutti i match
      if (matches.length > 0) {
        try {
          setActiveChats(await fetchMessagesByPerson(matches));
        } catch (err) {
          console.error('Caricamento messaggi fallito:', err);
        }
      } else {
        setActiveChats({});
      }
    } catch (err) {
      console.error('Caricamento EV fallito:', err);
    }
  }, [session?.nightId]);

  // Aggiunge un messaggio evitando i doppioni: lo stesso messaggio arriva
  // sia dalla risposta dell'insert sia dall'evento Realtime.
  const appendMessage = useCallback((personId, msg) => {
    setActiveChats(prev => {
      const list = prev[personId] ?? [];
      if (list.some(m => m.id === msg.id)) return prev;
      return { ...prev, [personId]: [...list, msg] };
    });
  }, []);

  // Caricamento iniziale quando si entra in una serata
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setPeopleLoading(true);
    Promise.all([refreshPeople(), refreshEvs(), refreshVenueMessages()]).finally(() => {
      if (!cancelled) setPeopleLoading(false);
    });
    return () => { cancelled = true; };
  }, [session?.nightId, refreshPeople, refreshEvs, refreshVenueMessages]);

  // Realtime: arrivi e uscite dalla serata, EV ricevuti, match.
  // Senza questo la lista sarebbe ferma al momento dell'ingresso.
  useEffect(() => {
    if (!session?.nightId || !authUser) return;
    const channel = supabase
      .channel(`night:${session.nightId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `night_id=eq.${session.nightId}` },
        () => refreshPeople()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evs', filter: `receiver_id=eq.${authUser.id}` },
        () => refreshEvs()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => { refreshEvs(); refreshMemories(); }
      )
      // La RLS lascia passare solo i messaggi dei match di cui faccio
      // parte: non serve (e non si potrebbe) filtrare per match qui.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'venue_messages' },
        () => refreshVenueMessages()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          const personId = Object.keys(matchIdByPerson.current)
            .find(pid => matchIdByPerson.current[pid] === row.match_id);
          if (!personId) {
            // Match appena creato e non ancora in mappa: ricarica
            refreshEvs();
            return;
          }
          appendMessage(personId, rowToMessage(row, authUser.id, personId));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.nightId, authUser?.id, refreshPeople, refreshEvs, refreshVenueMessages, refreshMemories, appendMessage]);

  // Invia un EV. Ritorna { matched } perché la UI possa festeggiare.
  const sendEV = useCallback(async (personId, note = null) => {
    const result = await sendEvApi(personId, note);
    setSentEVs(prev => (prev.includes(personId) ? prev : [...prev, personId]));
    if (result.matched) {
      setMatchedEVs(prev => (prev.includes(personId) ? prev : [...prev, personId]));
      setReceivedEVs(prev => prev.filter(id => id !== personId));
    }
    return result;
  }, []);

  // Ricambiare è semplicemente inviare: il server rileva la reciprocità
  const sendEVBack = useCallback(async (personId) => sendEV(personId), [sendEV]);

  const ignoreEV = useCallback(async (personId) => {
    const evId = evIdByPerson.current[personId];
    // Sparisce subito dalla lista: l'attesa di rete qui non aiuta nessuno
    setReceivedEVs(prev => prev.filter(id => id !== personId));
    if (!evId) return;
    try {
      await ignoreEvApi(evId);
    } catch (err) {
      console.error('Ignora EV fallita:', err);
      await refreshEvs(); // ripristina lo stato vero se il server ha rifiutato
    }
  }, [refreshEvs]);

  // Invio reale: il messaggio compare solo quando il server lo accetta.
  // Lancia ChatError con messaggio leggibile in caso di fallimento.
  const sendChatMessage = useCallback(async (personId, text) => {
    const matchId = matchIdByPerson.current[personId];
    if (!matchId) {
      throw new ChatError('Chat non disponibile: il match non risulta più attivo.');
    }
    const row = await sendMessageApi(matchId, text);
    appendMessage(personId, rowToMessage(row, authUser?.id, personId));
  }, [authUser?.id, appendMessage]);

  const formatTime = useCallback((seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, profileChecked, loginAsGuest, createProfile, updateProfile, uploadAvatar, refreshProfile,
      business, setBusiness,
      isInSession, currentVenue, currentNight, sessionTimeLeft, formatTime,
      session, sessionChecked, refreshSession, endSession,
      people, peopleLoading, peopleError, headcount, refreshPeople,
      sentEVs, sendEV, sendEVBack, ignoreEV,
      evNotes,
      receivedEVs, setReceivedEVs,
      matchedEVs,
      memories, events, memoriesLoading, memoriesError, refreshMemories,
      venueMessages,
      activeChats, sendChatMessage,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
