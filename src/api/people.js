import { supabase } from '@/lib/supabaseClient';
import { getAvatarUrl } from '@/api/avatars';

export class PeopleError extends Error {}

const DB_ERRORS = {
  not_authenticated: 'Devi accedere per interagire con le persone presenti.',
  cannot_ev_self: 'Non puoi mandare un EV a te stesso.',
  not_in_same_night: 'Questa persona non è più in questa serata.',
  ev_note_too_long: 'La nota è troppo lunga.',
  ev_rate_limited: 'Stai inviando troppi EV. Aspetta qualche istante.',
};

function toPeopleError(error, fallback) {
  const raw = error?.message || '';
  const key = Object.keys(DB_ERRORS).find(k => raw.includes(k));
  return new PeopleError(key ? DB_ERRORS[key] : fallback);
}

// Le persone presenti alla mia serata. Le foto sono su bucket privato:
// le signed URL si risolvono in parallelo e un fallimento non fa saltare
// la lista (la card mostra l'avatar di riserva).
export async function fetchPeopleInMyNight() {
  const { data, error } = await supabase.rpc('people_in_my_night');
  if (error) {
    console.error('people_in_my_night fallita:', error);
    throw toPeopleError(error, 'Caricamento delle persone non riuscito.');
  }

  const rows = data ?? [];
  const photos = await Promise.all(
    rows.map(r => (r.photo_path ? getAvatarUrl(r.photo_path).catch(() => null) : null))
  );

  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    age: r.age,
    bio: r.bio,
    interests: r.interests ?? [],
    status: r.relationship_status,
    photo: photos[i],
    qrCodeId: r.qr_code_id,
    roomLabel: r.room_label,
    sameRoom: r.same_room,
    since: r.since,
  }));
}

export async function fetchNightHeadcount() {
  const { data, error } = await supabase.rpc('my_night_headcount');
  if (error) {
    console.error('my_night_headcount fallita:', error);
    return 0; // un contatore mancante non deve rompere la pagina
  }
  return data ?? 0;
}

// Invia un EV. Ritorna { matched } così la UI può festeggiare subito.
export async function sendEv(receiverId, note = null) {
  const { data, error } = await supabase.rpc('send_ev', {
    p_receiver: receiverId,
    p_note: note,
  });
  if (error) {
    console.error('send_ev fallita:', error);
    throw toPeopleError(error, 'Invio non riuscito. Riprova.');
  }
  return { evId: data?.ev_id ?? null, matched: !!data?.matched };
}

export async function ignoreEv(evId) {
  const { error } = await supabase.rpc('ignore_ev', { p_ev: evId });
  if (error) {
    console.error('ignore_ev fallita:', error);
    throw toPeopleError(error, 'Operazione non riuscita. Riprova.');
  }
}

// Gli EV che mi riguardano nella serata in corso, divisi per direzione.
// La RLS restituisce solo quelli di cui sono mittente o destinatario.
export async function fetchMyEvs(nightId) {
  if (!nightId) return { sent: [], received: [], notes: {} };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sent: [], received: [], notes: {} };

  const { data, error } = await supabase
    .from('evs')
    .select('id, sender_id, receiver_id, note, status, created_at')
    .eq('night_id', nightId);
  if (error) {
    console.error('fetchMyEvs fallita:', error);
    throw toPeopleError(error, 'Caricamento degli EV non riuscito.');
  }

  const sent = [];
  const received = [];
  const notes = {};
  for (const ev of data ?? []) {
    if (ev.sender_id === user.id) {
      sent.push(ev.receiver_id);
    } else if (ev.receiver_id === user.id && ev.status !== 'ignored') {
      received.push({ id: ev.id, personId: ev.sender_id, note: ev.note, status: ev.status });
      if (ev.note) notes[ev.sender_id] = ev.note;
    }
  }
  return { sent, received, notes };
}

// I miei match: la coppia è normalizzata (user_a < user_b), qui torna
// solo l'id dell'altra persona.
export async function fetchMyMatches() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('matches')
    .select('id, user_a, user_b, night_id, matched_at');
  if (error) {
    console.error('fetchMyMatches fallita:', error);
    throw toPeopleError(error, 'Caricamento dei match non riuscito.');
  }
  return (data ?? []).map(m => ({
    id: m.id,
    personId: m.user_a === user.id ? m.user_b : m.user_a,
    nightId: m.night_id,
    matchedAt: m.matched_at,
  }));
}
