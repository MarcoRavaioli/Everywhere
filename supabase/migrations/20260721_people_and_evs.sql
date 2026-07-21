-- ============================================================
-- EveryWhere — persone nella serata, EV e match (Step 3e)
--
-- Corregge anche un residuo del modello precedente: gli EV erano
-- legati al LOCALE (unique per venue), quindi due persone che si
-- incontrano in due serate diverse dello stesso locale non avrebbero
-- potuto rimandarsi un EV. Ora l'unità è la SERATA.
-- ============================================================

-- ------------------------------------------------------------
-- 1. EV e match appartengono a una serata
-- ------------------------------------------------------------
alter table public.evs
  add column if not exists night_id uuid references public.nights (id) on delete cascade;
alter table public.matches
  add column if not exists night_id uuid references public.nights (id) on delete set null;

-- Il vincolo per locale lascia il posto a quello per serata
alter table public.evs drop constraint if exists evs_sender_id_receiver_id_venue_id_key;
create unique index if not exists evs_unique_per_night
  on public.evs (sender_id, receiver_id, night_id);
create index if not exists evs_night_receiver_idx on public.evs (night_id, receiver_id);

-- ------------------------------------------------------------
-- 2. I partecipanti devono poter leggere l'etichetta della propria sala
--    (finora night_qr_codes era leggibile solo dal proprietario)
-- ------------------------------------------------------------
drop policy if exists "night_qr_codes_participant" on public.night_qr_codes;
create policy "night_qr_codes_participant" on public.night_qr_codes
  for select to authenticated using (
    exists (
      select 1 from public.sessions s
      where s.night_id = night_qr_codes.night_id
        and s.user_id = auth.uid()
        and s.ended_at is null
    )
  );

-- Senza questa policy il Realtime non notifica gli arrivi: un utente
-- vede solo le proprie sessioni, quindi non riceverebbe mai l'evento
-- di qualcun altro che entra. Espone le stesse persone che
-- people_in_my_night() mostra già.
drop policy if exists "sessions_select_same_night" on public.sessions;
create policy "sessions_select_same_night" on public.sessions
  for select to authenticated using (
    night_id is not null
    and night_id = public.active_session_night(auth.uid())
  );

-- ------------------------------------------------------------
-- 3. Chi c'è alla mia serata
--    Solo con una sessione attiva; nessuna riga altrimenti.
--    same_room distingue chi è entrato dal mio stesso QR.
-- ------------------------------------------------------------
create or replace function public.people_in_my_night()
returns table (
  id uuid,
  name text,
  age int,
  bio text,
  photo_path text,
  interests text[],
  relationship_status text,
  qr_code_id uuid,
  room_label text,
  same_room boolean,
  since timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_night uuid := public.active_session_night(auth.uid());
  v_my_qr uuid;
begin
  if v_night is null then
    return; -- fuori da una serata attiva non si vede nessuno
  end if;

  select s.qr_code_id into v_my_qr
  from public.sessions s
  where s.user_id = auth.uid() and s.ended_at is null and s.night_id = v_night
  order by s.started_at desc
  limit 1;

  return query
  select
    p.id, p.name, p.age, p.bio, p.photo_path, p.interests, p.relationship_status,
    s.qr_code_id,
    q.label,
    (s.qr_code_id is not distinct from v_my_qr) as same_room,
    s.started_at
  from public.sessions s
  join public.profiles p on p.id = s.user_id
  left join public.night_qr_codes q on q.id = s.qr_code_id
  where s.night_id = v_night
    and s.ended_at is null
    and s.expires_at > now()
    and s.user_id <> auth.uid()
    -- TODO (3h): escludere gli utenti bloccati quando esisterà `blocks`
  order by same_room desc, s.started_at desc;
end;
$$;

-- Quante persone ci sono in totale alla mia serata (per l'intestazione)
create or replace function public.my_night_headcount()
returns int
language sql stable security definer
set search_path = public
as $$
  select count(*)::int
  from public.sessions s
  where s.night_id = public.active_session_night(auth.uid())
    and s.ended_at is null
    and s.expires_at > now()
$$;

-- ------------------------------------------------------------
-- 4. Invio EV: ancorato alla serata, con limite anti-abuso
-- ------------------------------------------------------------
create or replace function public.send_ev(p_receiver uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_night uuid;
  v_venue uuid;
  v_note text;
  v_recent int;
  v_ev public.evs;
  v_reciprocal public.evs;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_receiver = v_uid then
    raise exception 'cannot_ev_self';
  end if;

  v_night := public.active_session_night(v_uid);
  if v_night is null or v_night is distinct from public.active_session_night(p_receiver) then
    raise exception 'not_in_same_night';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if char_length(coalesce(v_note, '')) > 280 then
    raise exception 'ev_note_too_long';
  end if;

  -- Limite: un'app di incontri senza freno agli inviti diventa spam
  -- al primo utente molesto. 20 EV al minuto è generoso per una
  -- persona reale e taglia fuori gli invii automatici.
  select count(*) into v_recent
  from public.evs
  where sender_id = v_uid and created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception 'ev_rate_limited';
  end if;

  select venue_id into v_venue from public.nights where id = v_night;

  insert into public.evs (sender_id, receiver_id, venue_id, night_id, note)
  values (v_uid, p_receiver, v_venue, v_night, v_note)
  on conflict (sender_id, receiver_id, night_id) do nothing
  returning * into v_ev;

  if v_ev.id is null then
    -- EV già inviato in questa serata: nessun duplicato, nessun errore
    select * into v_ev from public.evs
    where sender_id = v_uid and receiver_id = p_receiver and night_id = v_night;
  end if;

  -- L'altro mi aveva già mandato un EV (non ignorato)? È un match.
  select * into v_reciprocal from public.evs
  where sender_id = p_receiver and receiver_id = v_uid
    and night_id = v_night and status <> 'ignored';

  if found then
    update public.evs set status = 'matched' where id in (v_ev.id, v_reciprocal.id);
    insert into public.matches (user_a, user_b, venue_id, night_id)
    values (least(v_uid, p_receiver), greatest(v_uid, p_receiver), v_venue, v_night)
    on conflict (user_a, user_b) do nothing;
    return jsonb_build_object('ev_id', v_ev.id, 'matched', true);
  end if;

  return jsonb_build_object('ev_id', v_ev.id, 'matched', false);
end;
$$;

-- Ricambiare un EV ricevuto è semplicemente inviarne uno: send_ev
-- rileva la reciprocità e crea il match.

revoke execute on function public.people_in_my_night() from anon, public;
revoke execute on function public.my_night_headcount() from anon, public;
grant execute on function public.people_in_my_night() to authenticated;
grant execute on function public.my_night_headcount() to authenticated;
