import { supabase } from '@/lib/supabaseClient';

// Errore con messaggio pensato per l'utente (le pagine mostrano .message)
export class VenueError extends Error {}

// Le RPC sollevano eccezioni Postgres con messaggi-codice: qui diventano
// testi comprensibili. Tutto ciò che non riconosciamo resta generico
// (non esponiamo dettagli interni del DB all'utente).
const DB_ERRORS = {
  not_authenticated: 'Devi accedere per registrare il tuo locale.',
  venue_name_required: 'Il nome del locale è obbligatorio.',
  account_already_personal:
    'Questo account è già registrato come utente personale. Usa un altro account Google per il locale.',
  not_venue_owner: 'Non sei il proprietario di questo locale.',
  venue_field_too_long: 'Uno dei campi inseriti è troppo lungo. Accorcialo e riprova.',
};

function toVenueError(error, fallback) {
  const raw = error?.message || '';
  const key = Object.keys(DB_ERRORS).find(k => raw.includes(k));
  return new VenueError(key ? DB_ERRORS[key] : fallback);
}

// Crea profilo business + venue + token QR in un'unica transazione lato server.
// owner_id e token non sono controllabili dal client (v. migration).
export async function createMyVenue({
  name, venueType, address, city, phone, email, website,
  hoursOpen, hoursClose, sessionMinutes,
} = {}) {
  const { data, error } = await supabase.rpc('create_my_venue', {
    p_name: name,
    p_venue_type: venueType ?? null,
    p_address: address ?? null,
    p_city: city ?? null,
    p_phone: phone ?? null,
    p_email: email ?? null,
    p_website: website ?? null,
    p_hours_open: hoursOpen ?? null,
    p_hours_close: hoursClose ?? null,
    p_session_minutes: sessionMinutes ?? 300,
  });
  if (error) {
    console.error('create_my_venue fallita:', error);
    throw toVenueError(error, 'Registrazione del locale non riuscita. Riprova.');
  }
  return data; // { venue_id, name, session_minutes, qr_token }
}

// Il locale del business loggato (il modello dati ne ammette più d'uno,
// la UI per ora assume il primo). Il token è leggibile solo dall'owner.
export async function fetchMyVenue() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('venues')
    .select('*, venue_qr_tokens(token, rotated_at)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('fetchMyVenue fallita:', error);
    throw toVenueError(error, 'Caricamento del locale non riuscito.');
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    venueType: data.venue_type,
    address: data.address,
    city: data.city,
    phone: data.phone,
    email: data.email,
    website: data.website,
    hoursOpen: data.hours_open,
    hoursClose: data.hours_close,
    hasLocation: !!data.location, // false finché non c'è il geocoding
    sessionMinutes: data.session_duration_minutes,
    createdAt: data.created_at,
    qrToken: data.venue_qr_tokens?.[0]?.token ?? null,
    qrRotatedAt: data.venue_qr_tokens?.[0]?.rotated_at ?? null,
  };
}

// Genera un nuovo token QR (invalida quello esposto in precedenza).
export async function rotateVenueQr(venueId) {
  const { data, error } = await supabase.rpc('rotate_venue_qr', { p_venue: venueId });
  if (error) {
    console.error('rotate_venue_qr fallita:', error);
    throw toVenueError(error, 'Rigenerazione del QR non riuscita. Riprova.');
  }
  return data; // nuovo token
}

// URL che il QR codificherà: funziona anche inquadrato dalla fotocamera
// di sistema ed è già la forma pronta per i deep link Capacitor (Step 5).
export function checkInUrl(token, origin = window.location.origin) {
  return `${origin}/checkin?t=${token}`;
}
