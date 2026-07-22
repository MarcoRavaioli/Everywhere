-- ============================================================
-- EveryWhere — Gruppi: presenza nella serata (Step 3j-2)
--
-- Un gruppo 'in_night' compare nella serata come UN'UNICA entità.
-- I membri che hanno scelto 'group_only' NON compaiono più come
-- singoli (né ricevono EV individuali); quelli 'single_and_group'
-- restano visibili sia come singoli sia dentro il gruppo.
--
-- Ridefinisce people_in_my_night e send_ev partendo dalle versioni più
-- recenti (3h con filtro blocchi / 3e ancorata alla serata) e AGGIUNGE
-- la logica gruppo. Essendo datata 0722 è l'ultima ad applicarsi.
-- Additiva.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Chi c'è alla serata: bloccati fuori + "solo gruppo" fuori
--    (identica alla 3h, con la sola aggiunta dell'ultima condizione)
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
    return;
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
    and not public.is_blocked_between(s.user_id, auth.uid())
    -- "solo gruppo": raggiungibile unicamente attraverso il gruppo
    and not exists (
      select 1 from public.group_members gm
      where gm.user_id = s.user_id
        and gm.visibility = 'group_only'
        and public.is_group_active(gm.group_id)
    )
  order by same_room desc, s.started_at desc;
end;
$$;

-- ------------------------------------------------------------
-- 2. I gruppi presenti alla mia serata, come entità uniche
--    Mostra solo i membri effettivamente presenti (sessione attiva
--    nella serata) e non bloccati; nasconde il mio stesso gruppo
--    (lo vedo nel pannello "il mio gruppo").
-- ------------------------------------------------------------
create or replace function public.groups_in_my_night()
returns table (
  group_id uuid,
  display_name text,
  photo_path text,
  member_count int,
  members jsonb,
  since timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_night uuid := public.active_session_night(auth.uid());
begin
  if v_night is null then
    return;
  end if;

  return query
  select
    g.id,
    g.display_name,
    g.photo_path,
    count(*)::int as member_count,
    coalesce(jsonb_agg(
      jsonb_build_object('id', p.id, 'name', p.name, 'photo_path', p.photo_path)
      order by gm.joined_at
    ), '[]'::jsonb) as members,
    g.entered_night_at
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  join public.profiles p on p.id = gm.user_id
  join public.sessions s
    on s.user_id = gm.user_id
   and s.night_id = v_night
   and s.ended_at is null
   and s.expires_at > now()
  where g.status = 'in_night'
    and g.night_id = v_night
    and g.dissolved_at is null
    and not public.is_group_member(g.id, auth.uid())
    and not public.is_blocked_between(gm.user_id, auth.uid())
  group by g.id, g.display_name, g.photo_path, g.entered_night_at
  having count(*) > 0;
end;
$$;

-- ------------------------------------------------------------
-- 3. Invio EV: rifiuta i destinatari "solo gruppo"
--    (identica alla 3e, con la sola aggiunta del controllo)
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

  -- Il destinatario si mostra solo come parte di un gruppo: niente EV singoli.
  -- L'interesse verso di lui passa dall'EV al gruppo (3j-4).
  if exists (
    select 1 from public.group_members gm
    where gm.user_id = p_receiver
      and gm.visibility = 'group_only'
      and public.is_group_active(gm.group_id)
  ) then
    raise exception 'receiver_group_only';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if char_length(coalesce(v_note, '')) > 280 then
    raise exception 'ev_note_too_long';
  end if;

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
    select * into v_ev from public.evs
    where sender_id = v_uid and receiver_id = p_receiver and night_id = v_night;
  end if;

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

revoke execute on function public.groups_in_my_night() from anon, public;
grant execute on function public.groups_in_my_night() to authenticated;
