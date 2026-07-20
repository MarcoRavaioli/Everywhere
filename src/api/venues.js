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
  invalid_plan: 'Piano non valido.',
  night_title_too_long: 'Il nome della serata è troppo lungo.',
  night_already_closed: 'Questa serata è già stata chiusa: creane una nuova.',
  another_night_open: 'Hai già una serata aperta. Chiudila prima di aprirne un\'altra.',
  night_not_open: 'La serata non è aperta: il QR non è ancora attivo.',
  invalid_qr_token: 'QR non valido.',
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
  hoursOpen, hoursClose, sessionMinutes, plan,
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
    p_plan: plan ?? null,
  });
  if (error) {
    console.error('create_my_venue fallita:', error);
    throw toVenueError(error, 'Registrazione del locale non riuscita. Riprova.');
  }
  return data; // { venue_id, name, session_minutes, qr_token }
}

// Il locale del business loggato (il modello dati ne ammette più d'uno,
// la UI per ora assume il primo). Il QR non sta più qui: sta sulla serata.
export async function fetchMyVenue() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('venues')
    .select('*')
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
    plan: data.plan,
    createdAt: data.created_at,
  };
}

// Presenze del locale. L'owner può leggere le sessioni del proprio venue
// (RLS), ma non i profili di chi è dentro: qui servono solo i numeri.
// Ritorna sempre un oggetto: un errore non deve rompere la dashboard.
export async function fetchVenueStats(venueId) {
  if (!venueId) return { activeNow: 0, totalSessions: 0, failed: false };
  const nowIso = new Date().toISOString();
  const [active, total] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .is('ended_at', null)
      .gt('expires_at', nowIso),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId),
  ]);
  if (active.error || total.error) {
    console.error('fetchVenueStats fallita:', active.error || total.error);
    return { activeNow: 0, totalSessions: 0, failed: true };
  }
  return { activeNow: active.count ?? 0, totalSessions: total.count ?? 0, failed: false };
}

// ─── Serate ────────────────────────────────────────────────────────────
// Ogni serata ha il proprio QR. Il QR viene creato subito (così si può
// stampare in anticipo) ma fa entrare le persone solo a serata aperta.

function rowToNight(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,               // draft | open | closed
    paymentStatus: row.payment_status, // pending | paid | waived
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    qrToken: row.night_qr_tokens?.[0]?.token ?? null,
  };
}

export async function fetchNights(venueId) {
  if (!venueId) return [];
  const { data, error } = await supabase
    .from('nights')
    .select('*, night_qr_tokens(token)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchNights fallita:', error);
    throw toVenueError(error, 'Caricamento delle serate non riuscito.');
  }
  return (data ?? []).map(rowToNight);
}

export async function createNight(venueId, title) {
  const { data, error } = await supabase.rpc('create_night', {
    p_venue: venueId,
    p_title: title ?? null,
  });
  if (error) {
    console.error('create_night fallita:', error);
    throw toVenueError(error, 'Creazione della serata non riuscita. Riprova.');
  }
  return data; // { night_id, title, status, payment_status, qr_token }
}

export async function openNight(nightId) {
  const { data, error } = await supabase.rpc('open_night', { p_night: nightId });
  if (error) {
    console.error('open_night fallita:', error);
    throw toVenueError(error, 'Apertura della serata non riuscita. Riprova.');
  }
  return data;
}

// Chiude la serata e termina le sessioni di chi è dentro.
export async function closeNight(nightId) {
  const { data, error } = await supabase.rpc('close_night', { p_night: nightId });
  if (error) {
    console.error('close_night fallita:', error);
    throw toVenueError(error, 'Chiusura della serata non riuscita. Riprova.');
  }
  return data; // { sessions_closed, ... }
}

// Nuovo token per la serata: invalida i QR già stampati.
export async function rotateNightQr(nightId) {
  const { data, error } = await supabase.rpc('rotate_night_qr', { p_night: nightId });
  if (error) {
    console.error('rotate_night_qr fallita:', error);
    throw toVenueError(error, 'Rigenerazione del QR non riuscita. Riprova.');
  }
  return data;
}

// Presenze di una singola serata (l'owner legge le sessioni del suo locale).
export async function fetchNightStats(nightId) {
  if (!nightId) return { activeNow: 0, totalCheckIns: 0, failed: false };
  const nowIso = new Date().toISOString();
  const [active, total] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true })
      .eq('night_id', nightId).is('ended_at', null).gt('expires_at', nowIso),
    supabase.from('sessions').select('id', { count: 'exact', head: true })
      .eq('night_id', nightId),
  ]);
  if (active.error || total.error) {
    console.error('fetchNightStats fallita:', active.error || total.error);
    return { activeNow: 0, totalCheckIns: 0, failed: true };
  }
  return { activeNow: active.count ?? 0, totalCheckIns: total.count ?? 0, failed: false };
}

// URL che il QR codificherà: funziona anche inquadrato dalla fotocamera
// di sistema ed è già la forma pronta per i deep link Capacitor (Step 5).
export function checkInUrl(token, origin = window.location.origin) {
  return `${origin}/checkin?t=${token}`;
}
