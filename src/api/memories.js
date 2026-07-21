import { supabase } from '@/lib/supabaseClient';
import { getAvatarUrl } from '@/api/avatars';

export class MemoriesError extends Error {}

const dateFmt = (iso) =>
  new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = (iso) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Le persone conosciute: un match per riga, con dove e quando.
// Le foto sono su bucket privato, quindi servono signed URL.
export async function fetchMyMemories() {
  const { data, error } = await supabase.rpc('my_memories');
  if (error) {
    console.error('my_memories fallita:', error);
    throw new MemoriesError('Caricamento dei ricordi non riuscito.');
  }

  const rows = data ?? [];
  const photos = await Promise.all(
    rows.map(r => (r.photo_path ? getAvatarUrl(r.photo_path).catch(() => null) : null))
  );

  return rows.map((r, i) => ({
    id: r.match_id,
    personId: r.person_id,
    personName: r.person_name,
    personPhoto: photos[i],
    venue: r.venue_name ?? 'Locale',
    nightTitle: r.night_title,
    date: dateFmt(r.matched_at),
    time: timeFmt(r.matched_at),
    matchedAt: r.matched_at,
  }));
}

// Il riepilogo delle serate a cui ho partecipato
export async function fetchMyNightRecaps() {
  const { data, error } = await supabase.rpc('my_night_recaps');
  if (error) {
    console.error('my_night_recaps fallita:', error);
    throw new MemoriesError('Caricamento delle serate non riuscito.');
  }
  return (data ?? []).map(r => ({
    id: r.night_id,
    venueName: r.venue_name,
    nightTitle: r.night_title,
    date: dateFmt(r.attended_at),
    attendedAt: r.attended_at,
    evSent: r.ev_sent ?? 0,
    evReceived: r.ev_received ?? 0,
    matches: r.match_count ?? 0,
  }));
}
