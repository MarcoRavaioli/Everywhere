import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const AppContext = createContext(null);

const MOCK_VENUE = {
  id: 'moon-club',
  name: 'MOON CLUB',
  image: 'https://images.unsplash.com/photo-1566417713940-fe7c7e31e5f2?w=800&q=80',
  sessionDuration: 5 * 60 * 60,
};

const MOCK_PEOPLE = [
  { id: '1', name: 'Sofia', age: 22, bio: 'Ama i concerti e il buon vino', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', interests: ['Musica', 'Viaggi', 'Aperitivi'], status: 'single' },
  { id: '2', name: 'Marco', age: 25, bio: 'DJ il venerdì, esploratore il sabato', photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80', interests: ['DJ', 'Surf', 'Fotografia'], status: 'single' },
  { id: '3', name: 'Giulia', age: 23, bio: 'Arte, vino rosso e tramonti', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80', interests: ['Arte', 'Vino', 'Yoga'], status: 'single' },
  { id: '4', name: 'Luca', age: 24, bio: 'Fotografo e amante del buon cibo', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', interests: ['Fotografia', 'Cucina', 'Cinema'], status: 'single' },
  { id: '5', name: 'Elena', age: 21, bio: 'Ballerina, sognatrice, nottambula', photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', interests: ['Danza', 'Musica', 'Notti'], status: 'single' },
  { id: '6', name: 'Andrea', age: 26, bio: 'Cocktail maker & music lover', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80', interests: ['Cocktail', 'Jazz', 'Design'], status: 'single' },
  { id: '7', name: 'Chiara', age: 22, bio: 'Fashion, musica e tante risate', photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80', interests: ['Fashion', 'Musica', 'Shopping'], status: 'single' },
  { id: '8', name: 'Tommaso', age: 27, bio: 'Architetto di giorno, clubber di notte', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80', interests: ['Architettura', 'Club', 'Viaggio'], status: 'single' },
];

const MOCK_MEMORIES = [
  { id: 'm1', personName: 'Sofia', personPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', venue: 'Moon Club', date: '12 Maggio 2024', time: '01:23', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80', type: 'known' },
  { id: 'm2', personName: 'Luca', personPhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80', venue: 'Moon Club', date: '10 Maggio 2024', time: '23:45', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80', type: 'known' },
  { id: 'm3', personName: 'Elena', personPhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', venue: 'Neon Garden', date: '5 Maggio 2024', time: '02:10', image: 'https://images.unsplash.com/photo-1504680177321-2e6a879aac86?w=600&q=80', type: 'known' },
];

const MOCK_EVENTS = [
  { id: 'e1', venueName: 'Moon Club', venueImage: 'https://images.unsplash.com/photo-1566417713940-fe7c7e31e5f2?w=600&q=80', date: '12 Maggio 2024', evSent: 4, evReceived: 2, matches: 1 },
  { id: 'e2', venueName: 'Neon Garden', venueImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80', date: '5 Maggio 2024', evSent: 2, evReceived: 3, matches: 2 },
  { id: 'e3', venueName: 'Stellar Rave', venueImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80', date: '1 Aprile 2024', evSent: 6, evReceived: 1, matches: 0 },
];

const MOCK_VENUE_MESSAGES = [
  { id: 'vm1', type: 'promo', title: 'Happy Hour 🍹', body: 'Dalle 23:00 all\'1:00 tutti i cocktail a €6. Mostra l\'app al barista.', time: '22:45', pinned: true },
  { id: 'vm2', type: 'info', title: 'DJ Set speciale', body: 'Dalle 01:30 live set di Marco Carola. Main floor capienza limitata.', time: '22:30', pinned: false },
  { id: 'vm3', type: 'info', title: 'Area fumatori', body: 'L\'area fumatori è disponibile nel cortile posteriore. Accesso dal corridoio laterale.', time: '22:00', pinned: false },
];

export const ALL_TOPICS = [
  'Musica', 'Vino', 'Viaggi', 'Concerti', 'Cinema', 'Arte', 'Sport',
  'Techno', 'Cibo', 'Serate', 'Fotografia', 'Design', 'Libri', 'Cocktail',
  'Festival', 'Cultura pop',
];

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [isInSession, setIsInSession] = useState(false);
  const [currentVenue, setCurrentVenue] = useState(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [people] = useState(MOCK_PEOPLE);
  const [sentEVs, setSentEVs] = useState([]);
  // Demo: alcune persone hanno già inviato un EV all'utente, alcune con nota
  const [receivedEVs, setReceivedEVs] = useState(['3', '6', '7']);
  const [matchedEVs, setMatchedEVs] = useState([]); // reciprocal matches
  const [memories] = useState(MOCK_MEMORIES);
  const [events] = useState(MOCK_EVENTS);
  const [venueMessages] = useState(MOCK_VENUE_MESSAGES);
  const [drinkNotifications, setDrinkNotifications] = useState([]);
  const [activeChats, setActiveChats] = useState({}); // personId -> messages[]
  const timerRef = useRef(null);

  // Session timer
  useEffect(() => {
    if (isInSession && sessionTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setSessionTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsInSession(false);
            setCurrentVenue(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isInSession, sessionTimeLeft]);

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

  const createProfile = useCallback((profileData) => {
    setCurrentUser(prev => ({ ...prev, ...profileData, isGuest: false }));
  }, []);

  const updateProfile = useCallback((profileData) => {
    setCurrentUser(prev => ({ ...prev, ...profileData }));
  }, []);

  const startSession = useCallback(() => {
    setCurrentVenue(MOCK_VENUE);
    setSessionTimeLeft(MOCK_VENUE.sessionDuration);
    setIsInSession(true);
  }, []);

  const endSession = useCallback(() => {
    clearInterval(timerRef.current);
    setIsInSession(false);
    setCurrentVenue(null);
    setSessionTimeLeft(0);
  }, []);

  // Demo: note allegate agli EV già ricevuti
  const [evNotes, setEvNotes] = useState({
    '3': 'Ciao! Ti ho notato sul dancefloor, ci prenderemo un drink? 🍹',
    '7': 'Ho visto che ti piace la stessa musica. Parliamo!',
  });

  const sendEV = useCallback((personId, note = null) => {
    setSentEVs(prev => {
      if (prev.includes(personId)) return prev;
      return [...prev, personId];
    });
    // Simulate receiving an EV back → becomes a match
    setTimeout(() => {
      if (Math.random() > 0.4) {
        setReceivedEVs(prev => prev.includes(personId) ? prev : [...prev, personId]);
        // Simulate the other person attaching a note back sometimes
        if (note) {
          setEvNotes(prev => ({ ...prev, [personId]: note }));
        }
      }
    }, 2500);
  }, []);

  const sendEVBack = useCallback((personId) => {
    // Reciprocate: move from received to matched
    setSentEVs(prev => prev.includes(personId) ? prev : [...prev, personId]);
    setMatchedEVs(prev => prev.includes(personId) ? prev : [...prev, personId]);
    setReceivedEVs(prev => prev.filter(id => id !== personId));
    // Init empty chat
    setActiveChats(prev => ({ ...prev, [personId]: prev[personId] || [] }));
  }, []);

  const ignoreEV = useCallback((personId) => {
    setReceivedEVs(prev => prev.filter(id => id !== personId));
  }, []);

  const sendChatMessage = useCallback((personId, text) => {
    const msg = { id: Date.now(), from: 'me', text, time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
    setActiveChats(prev => ({
      ...prev,
      [personId]: [...(prev[personId] || []), msg],
    }));
    // Simulate reply
    setTimeout(() => {
      const replies = [
        'Ottimo! Ci vediamo di là 😊',
        'Sì, sono vicino al bar!',
        'Ti riconosco, hai la felpa nera?',
        'Aspettami 5 minuti sul dancefloor',
        '🔥',
      ];
      const reply = { id: Date.now() + 1, from: personId, text: replies[Math.floor(Math.random() * replies.length)], time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
      setActiveChats(prev => ({
        ...prev,
        [personId]: [...(prev[personId] || []), reply],
      }));
    }, 1800);
  }, []);

  const sendDrink = useCallback((fromPersonId, toPerson) => {
    const notification = {
      id: Date.now(),
      from: fromPersonId,
      to: toPerson.id,
      toName: toPerson.name,
      toPhoto: toPerson.photo,
      status: 'pending_payment',
    };
    setDrinkNotifications(prev => [...prev, notification]);
    return notification;
  }, []);

  const confirmDrinkPayment = useCallback((notifId) => {
    setDrinkNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, status: 'sent' } : n)
    );
  }, []);

  const formatTime = useCallback((seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, loginAsGuest, createProfile, updateProfile,
      business, setBusiness,
      isInSession, currentVenue, sessionTimeLeft, formatTime,
      startSession, endSession,
      people,
      sentEVs, sendEV, sendEVBack, ignoreEV,
      evNotes,
      receivedEVs, setReceivedEVs,
      matchedEVs,
      memories, events,
      venueMessages,
      drinkNotifications, sendDrink, confirmDrinkPayment,
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
