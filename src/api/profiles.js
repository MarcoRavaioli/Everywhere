import { supabase } from '@/lib/supabaseClient';

// Mappa una riga di public.profiles nella shape che le pagine si aspettano
// (quella dei vecchi mock: photo, status, ...).
export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    bio: row.bio,
    photo: null, // signed URL dal bucket avatars: arriva con l'upload foto
    photoPath: row.photo_path,
    interests: row.interests ?? [],
    status: row.relationship_status,
    accountType: row.account_type,
    isGuest: false,
  };
}

export async function fetchMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Crea o aggiorna il profilo dell'utente loggato.
// fields: { name, bio, age, interests, account_type? }
export async function upsertMyProfile(fields) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}
