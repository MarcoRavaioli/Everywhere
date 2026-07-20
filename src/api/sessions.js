import { supabase } from '@/lib/supabaseClient';
import { nightState } from '@/api/venues';

// Errore con messaggio già pronto per l'utente
export class SessionError extends Error {}

const DB_ERRORS = {
  not_authenticated: 'Devi accedere per entrare nel locale.',
  invalid_qr_token: 'QR non valido. Controlla di aver inquadrato il codice giusto.',
  night_not_open: 'La serata non è ancora aperta (o è già finita): questo QR non è attivo adesso.',
  qr_not_yet_active: 'Questo ingresso non è ancora attivo. Riprova più tardi.',
  qr_expired: 'Questo ingresso non è più valido: cerca un altro QR nel locale.',
};

function toSessionError(error, fallback) {
  const raw = error?.message || '';
  const key = Object.keys(DB_ERRORS).find(k => raw.includes(k));
  return new SessionError(key ? DB_ERRORS[key] : fallback);
}

// Un token è valido solo se è un UUID: filtrando qui evitiamo di
// mandare al server qualunque cosa incollata a mano nel campo codice.
export function isValidToken(token) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    (token ?? '').trim()
  );
}

function shapeSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    venueId: row.venue_id,
    nightId: row.night_id,
    qrCodeId: row.qr_code_id,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    venue: row.venues
      ? { id: row.venue_id, name: row.venues.name, city: row.venues.city }
      : null,
    night: row.nights
      ? {
          id: row.night_id,
          title: row.nights.title,
          opensAt: row.nights.opens_at,
          closesAt: row.nights.closes_at,
          openedAt: row.nights.opened_at,
          closedAt: row.nights.closed_at,
        }
      : null,
  };
}

// Check-in con il token del QR. Se sei già in questa serata il server
// aggiorna solo la posizione (cambio sala) senza far ripartire la sessione.
export async function checkIn(token) {
  if (!isValidToken(token)) {
    throw new SessionError('QR non valido. Controlla di aver inquadrato il codice giusto.');
  }
  const { error } = await supabase.rpc('check_in', { p_qr_token: token.trim() });
  if (error) {
    console.error('check_in fallita:', error);
    throw toSessionError(error, 'Ingresso non riuscito. Riprova.');
  }
  // La RPC ritorna la riga grezza: rileggiamo con locale e serata allegati
  return fetchMySession();
}

// La sessione attiva dell'utente, con locale e serata.
// Una serata chiusa a orario non azzera ended_at, quindi lo stato della
// serata va comunque verificato: il server lo fa sul check-in, qui serve
// per non mostrare una sessione che di fatto è finita.
export async function fetchMySession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('sessions')
    .select('*, venues(name, city), nights(*)')
    .eq('user_id', user.id)
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('fetchMySession fallita:', error);
    throw toSessionError(error, 'Caricamento della sessione non riuscito.');
  }
  if (!data) return null;

  const shaped = shapeSession(data);
  if (shaped.night && nightState(shaped.night) !== 'open') return null;
  return shaped;
}

export async function endMySession() {
  const { error } = await supabase.rpc('end_session');
  if (error) {
    console.error('end_session fallita:', error);
    throw toSessionError(error, 'Uscita non riuscita. Riprova.');
  }
}
