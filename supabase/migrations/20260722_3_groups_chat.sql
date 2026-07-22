-- ============================================================
-- EveryWhere — Chat di gruppo (Step 3j-4, il debito D13)
--
-- Un utente manda un EV AL GRUPPO; un qualsiasi membro lo accetta e
-- nasce una CHAT CONDIVISA fra quell'utente e tutti i membri.
--
-- Scelta di architettura: NON si generalizza il modello match/messages
-- a due utenti (rischioso, già testato). Si affianca un sistema di
-- conversazione parallelo e dedicato:
--   group_evs      → EV da un singolo verso un gruppo
--   group_matches  → conversazione (gruppo ⇄ singolo) nata da un accept
--   group_messages → messaggi condivisi della conversazione
-- I match e le chat 1:1 restano intatti.
--
-- Additiva. Dipende dalle tabelle groups/group_members (3j-1).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelle
-- ------------------------------------------------------------

create table if not exists public.group_evs (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  night_id uuid references public.nights (id) on delete set null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'ignored', 'matched')),
  created_at timestamptz not null default now(),
  unique (sender_id, group_id, night_id)
);
create index if not exists group_evs_group_idx on public.group_evs (group_id, status);

create table if not exists public.group_matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  other_user_id uuid not null references public.profiles (id) on delete cascade,
  night_id uuid references public.nights (id) on delete set null,
  matched_at timestamptz not null default now(),
  unique (group_id, other_user_id)
);
create index if not exists group_matches_group_idx on public.group_matches (group_id);
create index if not exists group_matches_other_idx on public.group_matches (other_user_id);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_match_id uuid not null references public.group_matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_match_idx on public.group_messages (group_match_id, created_at);

-- ------------------------------------------------------------
-- 2. Helper
-- ------------------------------------------------------------

-- Partecipa alla conversazione chi è il singolo dell'altro lato, oppure
-- un membro (attuale) del gruppo.
create or replace function public.is_group_match_participant(p_match uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_matches m
    where m.id = p_match
      and (m.other_user_id = p_user or public.is_group_member(m.group_id, p_user))
  )
$$;

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
alter table public.group_evs enable row level security;
alter table public.group_matches enable row level security;
alter table public.group_messages enable row level security;

-- group_evs: il mittente e i membri del gruppo destinatario
drop policy if exists "group_evs_select" on public.group_evs;
create policy "group_evs_select" on public.group_evs
  for select to authenticated using (
    sender_id = auth.uid() or public.is_group_member(group_id, auth.uid())
  );

-- group_matches: il singolo e i membri del gruppo
drop policy if exists "group_matches_select" on public.group_matches;
create policy "group_matches_select" on public.group_matches
  for select to authenticated using (
    other_user_id = auth.uid() or public.is_group_member(group_id, auth.uid())
  );

-- group_messages: i partecipanti della conversazione
drop policy if exists "group_messages_select" on public.group_messages;
create policy "group_messages_select" on public.group_messages
  for select to authenticated using (
    public.is_group_match_participant(group_match_id, auth.uid())
  );
drop policy if exists "group_messages_insert" on public.group_messages;
create policy "group_messages_insert" on public.group_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_group_match_participant(group_match_id, auth.uid())
  );

-- ------------------------------------------------------------
-- 4. RPC
-- ------------------------------------------------------------

-- Un singolo manda un EV a un gruppo presente alla sua serata.
create or replace function public.send_group_ev(p_group uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_night uuid;
  v_group public.groups%rowtype;
  v_note text;
  v_recent int;
  v_ev public.group_evs;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_group from public.groups where id = p_group;
  if not found or not public.is_group_active(p_group) then
    raise exception 'group_not_active';
  end if;
  if public.is_group_member(p_group, v_uid) then
    raise exception 'cannot_ev_own_group';
  end if;

  v_night := public.active_session_night(v_uid);
  if v_night is null or v_group.status <> 'in_night' or v_group.night_id is distinct from v_night then
    raise exception 'not_in_same_night';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if char_length(coalesce(v_note, '')) > 280 then
    raise exception 'ev_note_too_long';
  end if;

  -- stesso freno anti-spam degli EV singoli (conteggia entrambi)
  select
    (select count(*) from public.evs where sender_id = v_uid and created_at > now() - interval '1 minute')
    + (select count(*) from public.group_evs where sender_id = v_uid and created_at > now() - interval '1 minute')
  into v_recent;
  if v_recent >= 20 then
    raise exception 'ev_rate_limited';
  end if;

  insert into public.group_evs (sender_id, group_id, night_id, note)
  values (v_uid, p_group, v_night, v_note)
  on conflict (sender_id, group_id, night_id) do nothing
  returning * into v_ev;

  if v_ev.id is null then
    select * into v_ev from public.group_evs
    where sender_id = v_uid and group_id = p_group and night_id = v_night;
  end if;

  return jsonb_build_object('group_ev_id', v_ev.id, 'status', v_ev.status);
end;
$$;

-- Un membro accetta un EV ricevuto dal gruppo: nasce la chat condivisa.
create or replace function public.accept_group_ev(p_group_ev uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ev public.group_evs%rowtype;
  v_match public.group_matches%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_ev from public.group_evs where id = p_group_ev;
  if not found then
    raise exception 'group_ev_not_found';
  end if;
  if not public.is_group_member(v_ev.group_id, v_uid) then
    raise exception 'not_group_member';
  end if;
  if v_ev.status = 'ignored' then
    raise exception 'group_ev_ignored';
  end if;

  update public.group_evs set status = 'matched' where id = p_group_ev;

  insert into public.group_matches (group_id, other_user_id, night_id)
  values (v_ev.group_id, v_ev.sender_id, v_ev.night_id)
  on conflict (group_id, other_user_id) do nothing
  returning * into v_match;

  if v_match.id is null then
    select * into v_match from public.group_matches
    where group_id = v_ev.group_id and other_user_id = v_ev.sender_id;
  end if;

  return jsonb_build_object('group_match_id', v_match.id);
end;
$$;

-- Un membro ignora un EV ricevuto dal gruppo.
create or replace function public.ignore_group_ev(p_group_ev uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ev public.group_evs%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_ev from public.group_evs where id = p_group_ev;
  if not found then
    raise exception 'group_ev_not_found';
  end if;
  if not public.is_group_member(v_ev.group_id, v_uid) then
    raise exception 'not_group_member';
  end if;
  update public.group_evs set status = 'ignored' where id = p_group_ev and status = 'pending';
end;
$$;

-- Invia un messaggio nella conversazione di gruppo.
create or replace function public.send_group_message(p_group_match uuid, p_text text)
returns public.group_messages
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_text text;
  v_msg public.group_messages;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_group_match_participant(p_group_match, v_uid) then
    raise exception 'not_a_participant';
  end if;
  v_text := btrim(coalesce(p_text, ''));
  if char_length(v_text) = 0 then
    raise exception 'empty_message';
  end if;
  if char_length(v_text) > 2000 then
    raise exception 'message_too_long';
  end if;

  insert into public.group_messages (group_match_id, sender_id, text)
  values (p_group_match, v_uid, v_text)
  returning * into v_msg;

  return v_msg;
end;
$$;

-- Gli EV in arrivo al mio gruppo, ancora da gestire (per i membri).
create or replace function public.incoming_group_evs()
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_photo_path text,
  note text,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_group uuid := public.active_group(auth.uid());
begin
  if v_group is null then
    return;
  end if;
  return query
  select e.id, e.sender_id, p.name, p.photo_path, e.note, e.created_at
  from public.group_evs e
  join public.profiles p on p.id = e.sender_id
  where e.group_id = v_group
    and e.status = 'pending'
    and not public.is_blocked_between(e.sender_id, auth.uid())
  order by e.created_at desc;
end;
$$;

-- Le mie conversazioni di gruppo (come membro del gruppo o come singolo).
create or replace function public.my_group_conversations()
returns table (
  group_match_id uuid,
  group_id uuid,
  group_display_name text,
  other_user_id uuid,
  other_user_name text,
  other_user_photo_path text,
  am_i_group_side boolean,
  matched_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  return query
  select
    m.id,
    m.group_id,
    g.display_name,
    m.other_user_id,
    p.name,
    p.photo_path,
    public.is_group_member(m.group_id, v_uid) as am_i_group_side,
    m.matched_at
  from public.group_matches m
  join public.groups g on g.id = m.group_id
  join public.profiles p on p.id = m.other_user_id
  where (m.other_user_id = v_uid or public.is_group_member(m.group_id, v_uid))
    and not public.is_blocked_between(m.other_user_id, v_uid)
  order by m.matched_at desc;
end;
$$;

-- I messaggi di una conversazione, coi nomi dei mittenti.
create or replace function public.group_conversation(p_group_match uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  text text,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_group_match_participant(p_group_match, v_uid) then
    raise exception 'not_a_participant';
  end if;
  return query
  select gm.id, gm.sender_id, p.name, gm.text, gm.created_at
  from public.group_messages gm
  join public.profiles p on p.id = gm.sender_id
  where gm.group_match_id = p_group_match
  order by gm.created_at asc;
end;
$$;

-- ------------------------------------------------------------
-- 5. Permessi
-- ------------------------------------------------------------
revoke execute on function public.send_group_ev(uuid, text) from anon, public;
revoke execute on function public.accept_group_ev(uuid) from anon, public;
revoke execute on function public.ignore_group_ev(uuid) from anon, public;
revoke execute on function public.send_group_message(uuid, text) from anon, public;
revoke execute on function public.incoming_group_evs() from anon, public;
revoke execute on function public.my_group_conversations() from anon, public;
revoke execute on function public.group_conversation(uuid) from anon, public;

grant execute on function public.send_group_ev(uuid, text) to authenticated;
grant execute on function public.accept_group_ev(uuid) to authenticated;
grant execute on function public.ignore_group_ev(uuid) to authenticated;
grant execute on function public.send_group_message(uuid, text) to authenticated;
grant execute on function public.incoming_group_evs() to authenticated;
grant execute on function public.my_group_conversations() to authenticated;
grant execute on function public.group_conversation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Realtime
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_evs') then
    alter publication supabase_realtime add table public.group_evs;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_matches') then
    alter publication supabase_realtime add table public.group_matches;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_messages') then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end $$;
