import { supabase } from '@/lib/supabaseClient';
import { getAvatarUrl } from '@/api/avatars';

export class ModerationError extends Error {}

// Motivi allineati al vincolo del DB. L'ordine è quello mostrato all'utente.
export const REPORT_REASONS = [
  { id: 'harassment', label: 'Molestie o minacce' },
  { id: 'inappropriate', label: 'Contenuti inappropriati' },
  { id: 'fake_profile', label: 'Profilo falso' },
  { id: 'underage', label: 'Sembra minorenne' },
  { id: 'spam', label: 'Spam o pubblicità' },
  { id: 'other', label: 'Altro' },
];

const DB_ERRORS = {
  not_authenticated: 'Devi accedere per usare questa funzione.',
  cannot_block_self: 'Non puoi bloccare te stesso.',
  cannot_report_self: 'Non puoi segnalare te stesso.',
  invalid_reason: 'Scegli un motivo valido.',
  details_too_long: 'La descrizione è troppo lunga (max 1000 caratteri).',
  user_not_found: 'Questa persona non esiste più.',
};

function toModerationError(error, fallback) {
  const raw = error?.message || '';
  const key = Object.keys(DB_ERRORS).find(k => raw.includes(k));
  return new ModerationError(key ? DB_ERRORS[key] : fallback);
}

// Blocca: da qui in poi non vi vedete più, in nessuna schermata
export async function blockUser(personId) {
  const { error } = await supabase.rpc('block_user', { p_user: personId });
  if (error) {
    console.error('block_user fallita:', error);
    throw toModerationError(error, 'Blocco non riuscito. Riprova.');
  }
}

export async function unblockUser(personId) {
  const { error } = await supabase.rpc('unblock_user', { p_user: personId });
  if (error) {
    console.error('unblock_user fallita:', error);
    throw toModerationError(error, 'Sblocco non riuscito. Riprova.');
  }
}

// Segnala. Il server blocca automaticamente la persona segnalata:
// chi segnala non deve restare esposto a chi ha appena segnalato.
export async function reportUser(personId, reason, details = null) {
  const { data, error } = await supabase.rpc('report_user', {
    p_user: personId,
    p_reason: reason,
    p_details: details,
  });
  if (error) {
    console.error('report_user fallita:', error);
    throw toModerationError(error, 'Segnalazione non riuscita. Riprova.');
  }
  return data;
}

// Le persone che ho bloccato, con la foto, per poterle sbloccare
export async function fetchBlockedUsers() {
  const { data, error } = await supabase.rpc('my_blocked_users');
  if (error) {
    console.error('my_blocked_users fallita:', error);
    throw toModerationError(error, 'Caricamento dell\'elenco non riuscito.');
  }
  const rows = data ?? [];
  const photos = await Promise.all(
    rows.map(r => (r.photo_path ? getAvatarUrl(r.photo_path).catch(() => null) : null))
  );
  return rows.map((r, i) => ({
    id: r.person_id,
    name: r.person_name,
    photo: photos[i],
    blockedAt: r.blocked_at,
  }));
}
