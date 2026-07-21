-- ============================================================
-- EveryWhere — blocco e segnalazione (Step 3h)
--
-- Requisito non negoziabile per App Store e Play Store su qualunque
-- app con contenuti generati dagli utenti, ma prima ancora è una
-- misura di sicurezza per le persone che usano l'app.
--
-- Il blocco è SIMMETRICO negli effetti: se A blocca B, nessuno dei
-- due vede più l'altro, in nessuna schermata e nemmeno via API.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelle
-- ------------------------------------------------------------
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in (
    'harassment',      -- molestie o minacce
    'inappropriate',   -- contenuti inappropriati
    'fake_profile',    -- profilo falso o identità rubata
    'underage',        -- sospetto minore di 18 anni
    'spam',
    'other'
  )),
  details text check (details is null or char_length(details) <= 1000),
  night_id uuid references public.nights (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reported_idx on public.reports (reported_id);

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Vedo solo i blocchi che ho creato io: sapere di essere stati
-- bloccati esporrebbe l'utente a ritorsioni.
drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

-- Vedo solo le mie segnalazioni; la revisione avviene lato staff
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

-- Scritture solo via RPC

-- ------------------------------------------------------------
-- 3. C'è un blocco tra due persone, in una delle due direzioni?
-- ------------------------------------------------------------
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  )
$$;

-- ------------------------------------------------------------
-- 4. La regola di visibilità tiene conto del blocco
--    Un blocco batte anche il match: non basta nascondere la lista,
--    va chiuso anche l'accesso al profilo e alla foto.
-- ------------------------------------------------------------
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    target = auth.uid()
    or (
      not public.is_blocked_between(target, auth.uid())
      and (
        public.are_matched(target, auth.uid())
        or (
          public.active_session_night(auth.uid()) is not null
          and public.active_session_night(target) = public.active_session_night(auth.uid())
        )
      )
    )
$$;

-- ------------------------------------------------------------
-- 5. Chi c'è alla serata: i bloccati spariscono
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
  order by same_room desc, s.started_at desc;
end;
$$;

-- I ricordi non mostrano le persone bloccate
create or replace function public.my_memories()
returns table (
  match_id uuid,
  person_id uuid,
  person_name text,
  photo_path text,
  venue_name text,
  night_title text,
  matched_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    m.id,
    case when m.user_a = auth.uid() then m.user_b else m.user_a end,
    p.name,
    p.photo_path,
    v.name,
    n.title,
    m.matched_at
  from public.matches m
  join public.profiles p
    on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join public.nights n on n.id = m.night_id
  left join public.venues v on v.id = m.venue_id
  where (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not public.is_blocked_between(
      case when m.user_a = auth.uid() then m.user_b else m.user_a end,
      auth.uid()
    )
  order by m.matched_at desc
$$;

-- ------------------------------------------------------------
-- 6. Match e messaggi: il blocco chiude la conversazione
-- ------------------------------------------------------------
drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_participant" on public.matches
  for select to authenticated using (
    (user_a = auth.uid() or user_b = auth.uid())
    and not public.is_blocked_between(user_a, user_b)
  );

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
        and not public.is_blocked_between(m.user_a, m.user_b)
    )
  );

drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
        and not public.is_blocked_between(m.user_a, m.user_b)
    )
  );

-- Gli EV verso una persona bloccata (o che mi ha bloccato) non partono
drop policy if exists "evs_select_participant" on public.evs;
create policy "evs_select_participant" on public.evs
  for select to authenticated using (
    (sender_id = auth.uid() or receiver_id = auth.uid())
    and not public.is_blocked_between(sender_id, receiver_id)
  );

-- ------------------------------------------------------------
-- 7. RPC
-- ------------------------------------------------------------
create or replace function public.block_user(p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_block_self';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user_not_found';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), p_user)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql security definer
set search_path = public
as $$
  delete from public.blocks
  where blocker_id = auth.uid() and blocked_id = p_user
$$;

-- Segnalazione. Blocca anche automaticamente: chi segnala non deve
-- restare esposto a chi ha appena segnalato.
create or replace function public.report_user(
  p_user uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_night uuid;
  v_report public.reports%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_report_self';
  end if;
  if p_reason is null or p_reason not in
     ('harassment', 'inappropriate', 'fake_profile', 'underage', 'spam', 'other') then
    raise exception 'invalid_reason';
  end if;
  if char_length(coalesce(p_details, '')) > 1000 then
    raise exception 'details_too_long';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user_not_found';
  end if;

  v_night := public.active_session_night(auth.uid());

  insert into public.reports (reporter_id, reported_id, reason, details, night_id)
  values (auth.uid(), p_user, p_reason, nullif(btrim(coalesce(p_details, '')), ''), v_night)
  returning * into v_report;

  -- Segnalare implica non voler più avere a che fare con quella persona
  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), p_user)
  on conflict (blocker_id, blocked_id) do nothing;

  return jsonb_build_object('report_id', v_report.id, 'blocked', true);
end;
$$;

-- Le persone che ho bloccato, per poterle sbloccare
create or replace function public.my_blocked_users()
returns table (person_id uuid, person_name text, photo_path text, blocked_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select b.blocked_id, p.name, p.photo_path, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;

revoke execute on function public.block_user(uuid) from anon, public;
revoke execute on function public.unblock_user(uuid) from anon, public;
revoke execute on function public.report_user(uuid, text, text) from anon, public;
revoke execute on function public.my_blocked_users() from anon, public;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.report_user(uuid, text, text) to authenticated;
grant execute on function public.my_blocked_users() to authenticated;

-- ------------------------------------------------------------
-- 8. Coda di moderazione (per ora si consulta dal dashboard Supabase)
-- ------------------------------------------------------------
comment on table public.reports is
  'Segnalazioni utenti. Finché non esiste un ruolo staff, si consultano dal dashboard Supabase: select * from reports where status = ''open'' order by created_at desc;';
