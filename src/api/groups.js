import { supabase } from '@/lib/supabaseClient';
import { getAvatarUrl } from '@/api/avatars';

export class GroupError extends Error {}

const DB_ERRORS = {
  not_authenticated: 'Devi accedere per usare i gruppi.',
  not_personal_account: 'Solo un profilo personale può creare o entrare in un gruppo.',
  already_in_group: 'Sei già in un gruppo. Esci da quello attuale per entrarne in un altro.',
  invalid_group_token: 'Questo QR di gruppo non è valido.',
  group_not_active: 'Questo gruppo non è più attivo.',
  group_full: 'Il gruppo ha già raggiunto il massimo di partecipanti.',
  not_in_group_night: 'Per entrare in questo gruppo devi essere nella sua stessa serata.',
  not_group_leader: 'Solo il capogruppo può farlo.',
  not_in_group: 'Non fai parte di nessun gruppo.',
  not_a_member: 'Questa persona non fa parte del gruppo.',
  leader_not_in_night: 'Per portare il gruppo in serata devi prima entrare nella serata.',
  group_name_too_long: 'Il nome del gruppo è troppo lungo.',
  invalid_visibility: 'Impostazione di visibilità non valida.',
  cannot_ev_own_group: 'Non puoi mandare un EV al tuo stesso gruppo.',
  group_ev_ignored: 'Questo EV è già stato rifiutato.',
  not_a_participant: 'Non fai parte di questa conversazione.',
  ev_rate_limited: 'Stai inviando troppi EV. Aspetta qualche istante.',
  not_in_same_night: 'Il gruppo non è più in questa serata.',
};

function toGroupError(error, fallback) {
  const raw = error?.message || '';
  const key = Object.keys(DB_ERRORS).find(k => raw.includes(k));
  return new GroupError(key ? DB_ERRORS[key] : fallback);
}

// Aggiunge la signed URL (o null) a una lista di membri con photo_path.
async function withPhotos(members) {
  const list = members ?? [];
  const photos = await Promise.all(
    list.map(m => (m.photo_path ? getAvatarUrl(m.photo_path).catch(() => null) : null))
  );
  return list.map((m, i) => ({ ...m, photo: photos[i] }));
}

// ─── Il mio gruppo ──────────────────────────────────────────────────

export async function fetchMyGroup() {
  const { data, error } = await supabase.rpc('my_group');
  if (error) {
    console.error('my_group fallita:', error);
    throw toGroupError(error, 'Caricamento del gruppo non riuscito.');
  }
  if (!data) return null;
  return { ...data, members: await withPhotos(data.members) };
}

export async function createGroup(name = null) {
  const { data, error } = await supabase.rpc('create_group', { p_display_name: name });
  if (error) throw toGroupError(error, 'Creazione del gruppo non riuscita.');
  return data;
}

export async function joinGroup(token) {
  const { data, error } = await supabase.rpc('join_group', { p_token: token });
  if (error) throw toGroupError(error, 'Ingresso nel gruppo non riuscito.');
  return data;
}

export async function leaveGroup() {
  const { data, error } = await supabase.rpc('leave_group');
  if (error) throw toGroupError(error, 'Operazione non riuscita.');
  return data;
}

export async function transferLeadership(userId) {
  const { error } = await supabase.rpc('transfer_leadership', { p_new_leader: userId });
  if (error) throw toGroupError(error, 'Passaggio di leadership non riuscito.');
}

export async function setGroupVisibility(visibility) {
  const { error } = await supabase.rpc('set_group_visibility', { p_visibility: visibility });
  if (error) throw toGroupError(error, 'Modifica della visibilità non riuscita.');
}

export async function setGroupDisplay(name) {
  const { error } = await supabase.rpc('set_group_display', { p_display_name: name });
  if (error) throw toGroupError(error, 'Modifica del nome non riuscita.');
}

export async function enterNightAsGroup() {
  const { data, error } = await supabase.rpc('enter_night_as_group');
  if (error) throw toGroupError(error, 'Non è stato possibile portare il gruppo in serata.');
  return data;
}

export async function dissolveGroup() {
  const { error } = await supabase.rpc('dissolve_group');
  if (error) throw toGroupError(error, 'Scioglimento non riuscito.');
}

// ─── Gruppi nella serata ────────────────────────────────────────────

export async function fetchGroupsInNight() {
  const { data, error } = await supabase.rpc('groups_in_my_night');
  if (error) {
    console.error('groups_in_my_night fallita:', error);
    throw toGroupError(error, 'Caricamento dei gruppi non riuscito.');
  }
  const rows = data ?? [];
  return Promise.all(rows.map(async r => ({
    id: r.group_id,
    displayName: r.display_name,
    memberCount: r.member_count,
    members: await withPhotos(r.members),
    since: r.since,
    // foto override del gruppo (se impostata); altrimenti la card
    // compone gli avatar dei membri
    photo: r.photo_path ? await getAvatarUrl(r.photo_path).catch(() => null) : null,
  })));
}

// ─── EV verso i gruppi ──────────────────────────────────────────────

export async function sendGroupEv(groupId, note = null) {
  const { data, error } = await supabase.rpc('send_group_ev', { p_group: groupId, p_note: note });
  if (error) throw toGroupError(error, 'Invio non riuscito. Riprova.');
  return data;
}

export async function acceptGroupEv(groupEvId) {
  const { data, error } = await supabase.rpc('accept_group_ev', { p_group_ev: groupEvId });
  if (error) throw toGroupError(error, 'Non è stato possibile accettare l\'EV.');
  return data;
}

export async function ignoreGroupEv(groupEvId) {
  const { error } = await supabase.rpc('ignore_group_ev', { p_group_ev: groupEvId });
  if (error) throw toGroupError(error, 'Operazione non riuscita.');
}

export async function fetchIncomingGroupEvs() {
  const { data, error } = await supabase.rpc('incoming_group_evs');
  if (error) {
    console.error('incoming_group_evs fallita:', error);
    throw toGroupError(error, 'Caricamento degli EV del gruppo non riuscito.');
  }
  const rows = data ?? [];
  const photos = await Promise.all(
    rows.map(r => (r.sender_photo_path ? getAvatarUrl(r.sender_photo_path).catch(() => null) : null))
  );
  return rows.map((r, i) => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    photo: photos[i],
    note: r.note,
    createdAt: r.created_at,
  }));
}

// ─── Conversazioni di gruppo ────────────────────────────────────────

export async function fetchGroupConversations() {
  const { data, error } = await supabase.rpc('my_group_conversations');
  if (error) {
    console.error('my_group_conversations fallita:', error);
    throw toGroupError(error, 'Caricamento delle chat di gruppo non riuscito.');
  }
  const rows = data ?? [];
  const photos = await Promise.all(
    rows.map(r => (r.other_user_photo_path ? getAvatarUrl(r.other_user_photo_path).catch(() => null) : null))
  );
  return rows.map((r, i) => ({
    id: r.group_match_id,
    groupId: r.group_id,
    groupName: r.group_display_name,
    otherUserId: r.other_user_id,
    otherUserName: r.other_user_name,
    otherUserPhoto: photos[i],
    amIGroupSide: r.am_i_group_side,
    matchedAt: r.matched_at,
  }));
}

export async function fetchGroupMessages(groupMatchId) {
  const { data, error } = await supabase.rpc('group_conversation', { p_group_match: groupMatchId });
  if (error) {
    console.error('group_conversation fallita:', error);
    throw toGroupError(error, 'Caricamento dei messaggi non riuscito.');
  }
  return (data ?? []).map(m => ({
    id: m.id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    text: m.text,
    createdAt: m.created_at,
  }));
}

export async function sendGroupMessage(groupMatchId, text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) throw new GroupError('Il messaggio è vuoto.');
  if (trimmed.length > 2000) throw new GroupError('Messaggio troppo lungo.');
  const { data, error } = await supabase.rpc('send_group_message', {
    p_group_match: groupMatchId,
    p_text: trimmed,
  });
  if (error) throw toGroupError(error, 'Messaggio non inviato. Riprova.');
  return data;
}
