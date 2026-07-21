import { supabase } from '@/lib/supabaseClient';

export class VenueMessageError extends Error {}

export const MESSAGE_TYPES = [
  { id: 'promo', label: 'Promozione' },
  { id: 'lineup', label: 'Lineup' },
  { id: 'info', label: 'Info' },
  { id: 'event', label: 'Evento' },
];

const DB_ERRORS = {
  not_authenticated: 'Devi accedere per gestire le comunicazioni.',
  not_venue_owner: 'Non sei il proprietario di questo locale.',
  invalid_message_type: 'Tipo di comunicazione non valido.',
  message_title_required: 'Il titolo è obbligatorio.',
  message_title_too_long: 'Il titolo è troppo lungo (max 120 caratteri).',
  message_body_required: 'Il messaggio è obbligatorio.',
  message_body_too_long: 'Il messaggio è troppo lungo (max 1000 caratteri).',
  night_not_of_venue: 'Quella serata non appartiene a questo locale.',
  qr_not_of_venue: 'Quella sala non appartiene a questo locale.',
};

function toMessageError(error, fallback) {
  const raw = error?.message || '';
  const key = Object.keys(DB_ERRORS).find(k => raw.includes(k));
  return new VenueMessageError(key ? DB_ERRORS[key] : fallback);
}

function rowToMessage(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    nightId: row.night_id,
    qrCodeId: row.qr_code_id,
    createdAt: row.created_at,
    // La UI mostra solo l'ora: le comunicazioni sono della serata in corso
    time: new Date(row.created_at).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

// Comunicazioni visibili a chi è in sessione: la RLS filtra già per
// locale e serata, qui non serve (né si potrebbe) ricontrollare.
export async function fetchVisibleVenueMessages() {
  const { data, error } = await supabase
    .from('venue_messages')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchVisibleVenueMessages fallita:', error);
    throw toMessageError(error, 'Caricamento delle comunicazioni non riuscito.');
  }
  return (data ?? []).map(rowToMessage);
}

// Tutte le comunicazioni del locale, per la dashboard del gestore
export async function fetchVenueMessages(venueId) {
  if (!venueId) return [];
  const { data, error } = await supabase
    .from('venue_messages')
    .select('*')
    .eq('venue_id', venueId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchVenueMessages fallita:', error);
    throw toMessageError(error, 'Caricamento delle comunicazioni non riuscito.');
  }
  return (data ?? []).map(rowToMessage);
}

// Destinatari, dal più ampio al più stretto:
//   niente        → tutto il locale
//   nightId       → solo quella serata
//   qrCodeId      → solo chi è in quella sala adesso (la serata si ricava dal QR)
export async function createVenueMessage(
  venueId,
  { type, title, body, nightId, qrCodeId, pinned } = {}
) {
  const { data, error } = await supabase.rpc('create_venue_message', {
    p_venue: venueId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_night: nightId ?? null,
    p_pinned: !!pinned,
    p_qr_code: qrCodeId ?? null,
  });
  if (error) {
    console.error('create_venue_message fallita:', error);
    throw toMessageError(error, 'Invio della comunicazione non riuscito. Riprova.');
  }
  return data;
}

export async function deleteVenueMessage(messageId) {
  const { error } = await supabase.rpc('delete_venue_message', { p_message: messageId });
  if (error) {
    console.error('delete_venue_message fallita:', error);
    throw toMessageError(error, 'Eliminazione non riuscita. Riprova.');
  }
}

export async function setVenueMessagePinned(messageId, pinned) {
  const { error } = await supabase.rpc('set_venue_message_pinned', {
    p_message: messageId,
    p_pinned: pinned,
  });
  if (error) {
    console.error('set_venue_message_pinned fallita:', error);
    throw toMessageError(error, 'Operazione non riuscita. Riprova.');
  }
}
