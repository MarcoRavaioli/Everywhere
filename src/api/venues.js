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
  night_not_open: 'La serata non è aperta: il QR non è attivo.',
  invalid_qr_token: 'QR non valido.',
  qr_not_yet_active: 'Questo QR non è ancora attivo: riprova più tardi.',
  qr_expired: 'Questo QR non è più valido.',
  qr_label_required: 'Dai un nome al QR (es. "Sala principale").',
  qr_label_too_long: 'Il nome del QR è troppo lungo.',
  invalid_time_window: 'L\'orario di fine deve essere successivo a quello di inizio.',
  last_qr_of_night: 'Non puoi eliminare l\'unico QR della serata.',
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

// ─── Serate e QR ───────────────────────────────────────────────────────
// Una serata ha PIÙ QR (ingresso principale, sale, zone): sono punti di
// distribuzione della stessa festa, chi entra da QR diversi si vede.
// Ogni QR ha la sua finestra oraria opzionale.

// Stato della serata calcolato dagli orari + override manuale.
// Stessa logica di night_is_active() lato DB, qui serve solo per la UI:
// a decidere chi entra è comunque il server.
export function nightState(night) {
  const now = Date.now();
  const ts = (v) => (v ? new Date(v).getTime() : null);
  if (night.closedAt) return 'closed';
  const closes = ts(night.closesAt);
  if (closes && now >= closes) return 'closed';
  const opens = ts(night.opensAt);
  if (night.openedAt || (opens && now >= opens)) return 'open';
  if (opens && now < opens) return 'scheduled';
  return 'draft';
}

// Un QR è utilizzabile solo se la serata è attiva E siamo nella sua finestra
export function qrState(qr, night) {
  const nState = nightState(night);
  if (nState !== 'open') return nState === 'closed' ? 'closed' : 'waiting_night';
  const now = Date.now();
  if (qr.startsAt && now < new Date(qr.startsAt).getTime()) return 'scheduled';
  if (qr.endsAt && now >= new Date(qr.endsAt).getTime()) return 'expired';
  return 'active';
}

function rowToQr(row) {
  return {
    id: row.id,
    label: row.label,
    token: row.token,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

function rowToNight(row) {
  return {
    id: row.id,
    title: row.title,
    paymentStatus: row.payment_status,
    opensAt: row.opens_at,     // apertura programmata
    closesAt: row.closes_at,   // chiusura programmata
    openedAt: row.opened_at,   // apertura manuale
    closedAt: row.closed_at,   // chiusura manuale
    createdAt: row.created_at,
    qrCodes: (row.night_qr_codes ?? []).map(rowToQr),
  };
}

export async function fetchNights(venueId) {
  if (!venueId) return [];
  const { data, error } = await supabase
    .from('nights')
    .select('*, night_qr_codes(*)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchNights fallita:', error);
    throw toVenueError(error, 'Caricamento delle serate non riuscito.');
  }
  return (data ?? []).map(rowToNight);
}

export async function createNight(venueId, { title, opensAt, closesAt } = {}) {
  const { data, error } = await supabase.rpc('create_night', {
    p_venue: venueId,
    p_title: title ?? null,
    p_opens_at: opensAt ?? null,
    p_closes_at: closesAt ?? null,
  });
  if (error) {
    console.error('create_night fallita:', error);
    throw toVenueError(error, 'Creazione della serata non riuscita. Riprova.');
  }
  return data;
}

export async function updateNightSchedule(nightId, { opensAt, closesAt } = {}) {
  const { error } = await supabase.rpc('update_night_schedule', {
    p_night: nightId,
    p_opens_at: opensAt ?? null,
    p_closes_at: closesAt ?? null,
  });
  if (error) {
    console.error('update_night_schedule fallita:', error);
    throw toVenueError(error, 'Aggiornamento degli orari non riuscito.');
  }
}

export async function openNight(nightId) {
  const { data, error } = await supabase.rpc('open_night', { p_night: nightId });
  if (error) {
    console.error('open_night fallita:', error);
    throw toVenueError(error, 'Apertura della serata non riuscita. Riprova.');
  }
  return data;
}

// Chiude la serata: termina le sessioni e spegne in blocco tutti i suoi QR
export async function closeNight(nightId) {
  const { data, error } = await supabase.rpc('close_night', { p_night: nightId });
  if (error) {
    console.error('close_night fallita:', error);
    throw toVenueError(error, 'Chiusura della serata non riuscita. Riprova.');
  }
  return data;
}

export async function createNightQr(nightId, { label, startsAt, endsAt } = {}) {
  const { data, error } = await supabase.rpc('create_night_qr', {
    p_night: nightId,
    p_label: label,
    p_starts_at: startsAt ?? null,
    p_ends_at: endsAt ?? null,
  });
  if (error) {
    console.error('create_night_qr fallita:', error);
    throw toVenueError(error, 'Creazione del QR non riuscita. Riprova.');
  }
  return data;
}

export async function updateNightQr(qrId, { label, startsAt, endsAt } = {}) {
  const { error } = await supabase.rpc('update_night_qr', {
    p_qr: qrId,
    p_label: label ?? null,
    p_starts_at: startsAt ?? null,
    p_ends_at: endsAt ?? null,
  });
  if (error) {
    console.error('update_night_qr fallita:', error);
    throw toVenueError(error, 'Aggiornamento del QR non riuscito. Riprova.');
  }
}

// Nuovo token: invalida le copie già stampate di QUESTO QR
export async function rotateNightQr(qrId) {
  const { data, error } = await supabase.rpc('rotate_night_qr', { p_qr: qrId });
  if (error) {
    console.error('rotate_night_qr fallita:', error);
    throw toVenueError(error, 'Rigenerazione del QR non riuscita. Riprova.');
  }
  return data;
}

export async function deleteNightQr(qrId) {
  const { error } = await supabase.rpc('delete_night_qr', { p_qr: qrId });
  if (error) {
    console.error('delete_night_qr fallita:', error);
    throw toVenueError(error, 'Eliminazione del QR non riuscita. Riprova.');
  }
}

// Presenze di una serata; se passi anche il QR, quante persone in quella sala
export async function fetchNightStats(nightId) {
  if (!nightId) return { activeNow: 0, totalCheckIns: 0, byQr: {}, failed: false };
  const nowIso = new Date().toISOString();
  const [active, total] = await Promise.all([
    supabase.from('sessions').select('qr_code_id')
      .eq('night_id', nightId).is('ended_at', null).gt('expires_at', nowIso),
    supabase.from('sessions').select('id', { count: 'exact', head: true })
      .eq('night_id', nightId),
  ]);
  if (active.error || total.error) {
    console.error('fetchNightStats fallita:', active.error || total.error);
    return { activeNow: 0, totalCheckIns: 0, byQr: {}, failed: true };
  }
  const byQr = {};
  for (const row of active.data ?? []) {
    if (row.qr_code_id) byQr[row.qr_code_id] = (byQr[row.qr_code_id] ?? 0) + 1;
  }
  return {
    activeNow: (active.data ?? []).length,
    totalCheckIns: total.count ?? 0,
    byQr,
    failed: false,
  };
}

// URL che il QR codificherà: funziona anche inquadrato dalla fotocamera
// di sistema ed è già la forma pronta per i deep link Capacitor (Step 5).
export function checkInUrl(token, origin = window.location.origin) {
  return `${origin}/checkin?t=${token}`;
}
