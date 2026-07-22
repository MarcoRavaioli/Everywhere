import { supabase } from '@/lib/supabaseClient';
import { getAvatarUrl } from '@/api/avatars';

export class BadgeError extends Error {}

// I miei conteggi (per i badge sul profilo).
export async function fetchMyStats() {
  const { data, error } = await supabase.rpc('my_stats');
  if (error) {
    console.error('my_stats fallita:', error);
    throw new BadgeError('Caricamento dei riconoscimenti non riuscito.');
  }
  return {
    nights_attended: data?.nights_attended ?? 0,
    drinks_offered: data?.drinks_offered ?? 0,
    matches: data?.matches ?? 0,
  };
}

// I partecipanti di una serata del locale, coi conteggi per i badge.
// Solo l'owner del locale ottiene righe (RPC security definer).
export async function fetchNightParticipants(nightId) {
  const { data, error } = await supabase.rpc('night_participants_with_stats', {
    p_night: nightId,
  });
  if (error) {
    console.error('night_participants_with_stats fallita:', error);
    throw new BadgeError('Caricamento dei partecipanti non riuscito.');
  }
  const rows = data ?? [];
  const photos = await Promise.all(
    rows.map(r => (r.photo_path ? getAvatarUrl(r.photo_path).catch(() => null) : null))
  );
  return rows.map((r, i) => ({
    id: r.user_id,
    name: r.name,
    photo: photos[i],
    present: r.present,
    stats: {
      nights_attended: r.nights_attended,
      drinks_offered: r.drinks_offered,
      matches: r.matches,
    },
  }));
}
