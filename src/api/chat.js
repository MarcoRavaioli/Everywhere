import { supabase } from '@/lib/supabaseClient';

export class ChatError extends Error {}

export const MAX_MESSAGE_LENGTH = 2000;

// Orario mostrato accanto al messaggio
export function formatMessageTime(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Riga del DB → forma usata dalla UI ('me' oppure l'id dell'altra persona)
export function rowToMessage(row, myId, personId) {
  return {
    id: row.id,
    from: row.sender_id === myId ? 'me' : personId,
    text: row.text,
    time: formatMessageTime(row.created_at),
    createdAt: row.created_at,
  };
}

/**
 * Messaggi di tutti i miei match in una sola query, raggruppati per persona.
 * La RLS restituisce solo i match di cui faccio parte.
 *
 * matches: [{ id, personId }]
 * Ritorna: { [personId]: Message[] }
 */
export async function fetchMessagesByPerson(matches) {
  if (!matches?.length) return {};
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const personByMatch = Object.fromEntries(matches.map(m => [m.id, m.personId]));

  const { data, error } = await supabase
    .from('messages')
    .select('id, match_id, sender_id, text, created_at')
    .in('match_id', matches.map(m => m.id))
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchMessagesByPerson fallita:', error);
    throw new ChatError('Caricamento dei messaggi non riuscito.');
  }

  const grouped = {};
  for (const row of data ?? []) {
    const personId = personByMatch[row.match_id];
    if (!personId) continue;
    (grouped[personId] ??= []).push(rowToMessage(row, user.id, personId));
  }
  return grouped;
}

// Invia un messaggio dentro un match. Il server rifiuta chi non ne fa parte.
export async function sendMessage(matchId, text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) throw new ChatError('Il messaggio è vuoto.');
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ChatError('Messaggio troppo lungo.');
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ChatError('Devi accedere per scrivere.');

  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: user.id, text: trimmed })
    .select('id, match_id, sender_id, text, created_at')
    .single();

  if (error) {
    console.error('sendMessage fallita:', error);
    throw new ChatError('Messaggio non inviato. Controlla la connessione e riprova.');
  }
  return data;
}
