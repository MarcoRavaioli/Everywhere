import { supabase } from '@/lib/supabaseClient';

// Avatar neutro inline: nessuna richiesta di rete, mai un'immagine rotta
export const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="%231e1b2e"/><circle cx="48" cy="38" r="16" fill="%236b6580"/><path d="M16 88c4-18 17-26 32-26s28 8 32 26z" fill="%236b6580"/></svg>';

const SIGNED_URL_TTL_S = 3600;            // 1 ora
const RENEW_MARGIN_MS = 5 * 60 * 1000;    // rigenera se mancano <5 min
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // rifiuto client prima di decodificare
const OUTPUT_MAX_PX = 1024;
const JPEG_QUALITY = 0.85;

// Errore con messaggio pensato per l'utente (le pagine mostrano .message)
export class AvatarError extends Error {}

// Decodifica e normalizza il file: qualunque input valido esce come
// JPEG <= 1024px senza metadati (EXIF/GPS rimossi). Qualunque input
// non-immagine (PDF rinominato, file vuoto, bytes casuali) fallisce qui.
async function processImage(file) {
  if (!file || file.size === 0) {
    throw new AvatarError('Il file è vuoto o non leggibile.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarError('Immagine troppo grande (max 15 MB).');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError('Il file non è un\'immagine valida.');
  }
  try {
    const scale = Math.min(1, OUTPUT_MAX_PX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new AvatarError('Elaborazione dell\'immagine fallita.');
    return blob;
  } finally {
    bitmap.close?.();
  }
}

// Cache in memoria delle signed URL: path -> { url, expiresAt }
const urlCache = new Map();

// Signed URL per un avatar. Ritorna null (mai throw) se non ottenibile:
// la UI ripiega su DEFAULT_AVATAR.
export async function getAvatarUrl(path, { fresh = false } = {}) {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (!fresh && hit && hit.expiresAt - Date.now() > RENEW_MARGIN_MS) {
    return hit.url;
  }
  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, SIGNED_URL_TTL_S);
  if (error || !data?.signedUrl) {
    console.error('Signed URL avatar fallita:', error);
    return null;
  }
  urlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_S * 1000 });
  return data.signedUrl;
}

// Valida, normalizza e carica la foto dell'utente loggato.
// Path fisso <uid>/avatar.jpg con upsert: niente file orfani, e le
// policy Storage vincolano la scrittura alla propria cartella.
export async function uploadMyAvatar(file) {
  const blob = await processImage(file);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AvatarError('Devi accedere per caricare una foto.');

  const path = `${user.id}/avatar.jpg`;
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (upErr) {
    console.error('Upload avatar fallito:', upErr);
    throw new AvatarError('Caricamento non riuscito. Controlla la connessione e riprova.');
  }

  // Se il profilo non esiste ancora (upload durante l'onboarding) questo
  // update non tocca righe: il path viene incluso da createProfile.
  const { error: dbErr } = await supabase
    .from('profiles')
    .update({ photo_path: path })
    .eq('id', user.id);
  if (dbErr) {
    console.error('Aggiornamento photo_path fallito:', dbErr);
    throw new AvatarError('Foto caricata ma profilo non aggiornato. Riprova.');
  }

  const url = await getAvatarUrl(path, { fresh: true });
  return { path, url };
}
