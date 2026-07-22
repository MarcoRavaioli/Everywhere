import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchMyGroup, createGroup as createGroupApi, joinGroup as joinGroupApi,
  leaveGroup as leaveGroupApi, transferLeadership as transferLeadershipApi,
  setGroupVisibility as setGroupVisibilityApi, setGroupDisplay as setGroupDisplayApi,
  enterNightAsGroup as enterNightAsGroupApi, dissolveGroup as dissolveGroupApi,
  fetchGroupsInNight, sendGroupEv as sendGroupEvApi,
  acceptGroupEv as acceptGroupEvApi, ignoreGroupEv as ignoreGroupEvApi,
  fetchIncomingGroupEvs, fetchGroupConversations, fetchGroupMessages,
  sendGroupMessage as sendGroupMessageApi,
} from '@/api/groups';

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const { user: authUser, authChecked } = useAuth();
  const { session } = useApp();
  const nightId = session?.nightId ?? null;

  const [myGroup, setMyGroup] = useState(null);
  const [myGroupLoading, setMyGroupLoading] = useState(false);
  const [myGroupError, setMyGroupError] = useState(null);

  const [groupsInNight, setGroupsInNight] = useState([]);
  const [incomingGroupEvs, setIncomingGroupEvs] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [groupChats, setGroupChats] = useState({}); // groupMatchId -> messages[]

  const refreshMyGroup = useCallback(async () => {
    if (!authUser) {
      setMyGroup(null);
      return null;
    }
    setMyGroupError(null);
    try {
      const g = await fetchMyGroup();
      setMyGroup(g);
      return g;
    } catch (err) {
      console.error('Caricamento gruppo fallito:', err);
      setMyGroupError('Non riesco a caricare il gruppo. Controlla la connessione.');
      return null;
    }
  }, [authUser]);

  const refreshGroupsInNight = useCallback(async () => {
    if (!nightId) {
      setGroupsInNight([]);
      return;
    }
    try {
      setGroupsInNight(await fetchGroupsInNight());
    } catch (err) {
      console.error('Caricamento gruppi in serata fallito:', err);
    }
  }, [nightId]);

  const refreshIncomingGroupEvs = useCallback(async () => {
    if (!authUser) {
      setIncomingGroupEvs([]);
      return;
    }
    try {
      setIncomingGroupEvs(await fetchIncomingGroupEvs());
    } catch (err) {
      console.error('Caricamento EV di gruppo fallito:', err);
    }
  }, [authUser]);

  const refreshConversations = useCallback(async () => {
    if (!authUser) {
      setConversations([]);
      return;
    }
    try {
      setConversations(await fetchGroupConversations());
    } catch (err) {
      console.error('Caricamento chat di gruppo fallito:', err);
    }
  }, [authUser]);

  const openGroupChat = useCallback(async (groupMatchId) => {
    try {
      const msgs = await fetchGroupMessages(groupMatchId);
      setGroupChats(prev => ({ ...prev, [groupMatchId]: msgs }));
    } catch (err) {
      console.error('Caricamento messaggi di gruppo fallito:', err);
    }
  }, []);

  const appendGroupMessage = useCallback((groupMatchId, msg) => {
    setGroupChats(prev => {
      const list = prev[groupMatchId] ?? [];
      if (list.some(m => m.id === msg.id)) return prev;
      return { ...prev, [groupMatchId]: [...list, msg] };
    });
  }, []);

  // Carica il mio gruppo all'avvio e a ogni cambio utente
  useEffect(() => {
    if (!authChecked) return;
    setMyGroupLoading(true);
    refreshMyGroup().finally(() => setMyGroupLoading(false));
  }, [authChecked, authUser?.id, refreshMyGroup]);

  // Le conversazioni e gli EV in arrivo dipendono dall'utente (non solo
  // dalla serata: una chat di gruppo resta dopo il match)
  useEffect(() => {
    if (!authChecked) return;
    refreshConversations();
    refreshIncomingGroupEvs();
  }, [authChecked, authUser?.id, refreshConversations, refreshIncomingGroupEvs]);

  // I gruppi presenti dipendono dalla serata in corso
  useEffect(() => {
    refreshGroupsInNight();
  }, [refreshGroupsInNight]);

  // Realtime: gruppo, membri, EV di gruppo, match e messaggi
  useEffect(() => {
    if (!authUser) return;
    const channel = supabase
      .channel(`groups:${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' },
        () => { refreshMyGroup(); refreshGroupsInNight(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' },
        () => { refreshMyGroup(); refreshGroupsInNight(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_evs' },
        () => refreshIncomingGroupEvs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_matches' },
        () => refreshConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' },
        (payload) => {
          const row = payload.new;
          // Se ho la chat aperta la aggiorno; altrimenti la ignoro
          // (verrà caricata all'apertura). Il nome mittente non è nel
          // payload: la riga arriva senza join, quindi ricarico i messaggi
          // di quella conversazione se la sto già seguendo.
          setGroupChats(prev => {
            if (!(row.group_match_id in prev)) return prev;
            fetchGroupMessages(row.group_match_id)
              .then(msgs => setGroupChats(p => ({ ...p, [row.group_match_id]: msgs })))
              .catch(() => {});
            return prev;
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser?.id, refreshMyGroup, refreshGroupsInNight, refreshIncomingGroupEvs, refreshConversations]);

  // ─── Azioni ────────────────────────────────────────────────────────
  const createGroup = useCallback(async (name) => {
    const res = await createGroupApi(name);
    await refreshMyGroup();
    return res;
  }, [refreshMyGroup]);

  const joinGroup = useCallback(async (token) => {
    const res = await joinGroupApi(token);
    await refreshMyGroup();
    return res;
  }, [refreshMyGroup]);

  const leaveGroup = useCallback(async () => {
    const res = await leaveGroupApi();
    await Promise.all([refreshMyGroup(), refreshConversations(), refreshIncomingGroupEvs()]);
    return res;
  }, [refreshMyGroup, refreshConversations, refreshIncomingGroupEvs]);

  const dissolveGroup = useCallback(async () => {
    await dissolveGroupApi();
    await refreshMyGroup();
  }, [refreshMyGroup]);

  const transferLeadership = useCallback(async (userId) => {
    await transferLeadershipApi(userId);
    await refreshMyGroup();
  }, [refreshMyGroup]);

  const setVisibility = useCallback(async (visibility) => {
    await setGroupVisibilityApi(visibility);
    await refreshMyGroup();
  }, [refreshMyGroup]);

  const setDisplayName = useCallback(async (name) => {
    await setGroupDisplayApi(name);
    await refreshMyGroup();
  }, [refreshMyGroup]);

  const enterNightAsGroup = useCallback(async () => {
    const res = await enterNightAsGroupApi();
    await Promise.all([refreshMyGroup(), refreshGroupsInNight()]);
    return res;
  }, [refreshMyGroup, refreshGroupsInNight]);

  const sendGroupEv = useCallback(async (groupId, note = null) => {
    return sendGroupEvApi(groupId, note);
  }, []);

  const acceptGroupEv = useCallback(async (groupEvId) => {
    const res = await acceptGroupEvApi(groupEvId);
    await Promise.all([refreshIncomingGroupEvs(), refreshConversations()]);
    return res;
  }, [refreshIncomingGroupEvs, refreshConversations]);

  const ignoreGroupEv = useCallback(async (groupEvId) => {
    setIncomingGroupEvs(prev => prev.filter(e => e.id !== groupEvId));
    try {
      await ignoreGroupEvApi(groupEvId);
    } catch (err) {
      console.error('Ignora EV di gruppo fallita:', err);
      await refreshIncomingGroupEvs();
    }
  }, [refreshIncomingGroupEvs]);

  const sendGroupMessage = useCallback(async (groupMatchId, text) => {
    const row = await sendGroupMessageApi(groupMatchId, text);
    appendGroupMessage(groupMatchId, {
      id: row.id,
      senderId: row.sender_id,
      senderName: null, // sono io: la UI mostra "Tu"
      text: row.text,
      createdAt: row.created_at,
    });
  }, [appendGroupMessage]);

  return (
    <GroupContext.Provider value={{
      myGroup, myGroupLoading, myGroupError, refreshMyGroup,
      groupsInNight, refreshGroupsInNight,
      incomingGroupEvs, conversations, groupChats,
      createGroup, joinGroup, leaveGroup, dissolveGroup, transferLeadership,
      setVisibility, setDisplayName, enterNightAsGroup,
      sendGroupEv, acceptGroupEv, ignoreGroupEv,
      openGroupChat, sendGroupMessage,
    }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used within GroupProvider');
  return ctx;
}
