-- ============================================================
-- EveryWhere — schema iniziale (Step 2)
-- Da eseguire nel SQL Editor del progetto Supabase (dev).
-- Idempotente dove possibile; pensata per un database vuoto.
--
-- Regola di prodotto centrale: un profilo è visibile solo a
--   (a) sé stessi, (b) chi ha una sessione attiva nello stesso
--   locale, (c) i propri match. Implementata in can_view_profile().
-- Le scritture "di gioco" (check-in, EV, match) passano SOLO da
-- funzioni RPC: le tabelle non hanno policy di insert dirette.
-- ============================================================

create extension if not exists postgis with schema extensions;

-- ------------------------------------------------------------
-- TABELLE
-- ------------------------------------------------------------

-- Profili: 1:1 con auth.users
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null default 'personal'
    check (account_type in ('personal', 'business')),
  name text not null check (char_length(name) between 1 and 80),
  age int check (age >= 18 and age < 120),
  bio text not null default '' check (char_length(bio) <= 500),
  photo_path text,          -- path nel bucket 'avatars', mai URL pubblico
  interests text[] not null default '{}',
  relationship_status text not null default 'single',
  created_at timestamptz not null default now()
);

-- Locali. Un owner può avere più venues (l'onboarding UI per ora ne crea 1).
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  image_path text,
  location extensions.geography (point, 4326),
  session_duration_minutes int not null default 300
    check (session_duration_minutes between 15 and 1440),
  created_at timestamptz not null default now()
);
create index venues_location_idx on public.venues using gist (location);
create index venues_owner_idx on public.venues (owner_id);

-- QR token in tabella separata: leggibile solo dall'owner,
-- così la select sui venues resta pubblica senza esporre il token.
create table public.venue_qr_tokens (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  rotated_at timestamptz not null default now()
);

-- Check-in di un utente in un locale.
-- Attiva = ended_at IS NULL AND expires_at > now()
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);
create index sessions_venue_open_idx on public.sessions (venue_id) where ended_at is null;
create index sessions_user_idx on public.sessions (user_id);
create unique index sessions_one_open_per_user on public.sessions (user_id) where ended_at is null;

-- EV: l'interesse inviato (con nota opzionale)
create table public.evs (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  note text check (char_length(note) <= 300),
  status text not null default 'pending'
    check (status in ('pending', 'ignored', 'matched')),
  created_at timestamptz not null default now(),
  unique (sender_id, receiver_id, venue_id),
  check (sender_id <> receiver_id)
);
create index evs_receiver_idx on public.evs (receiver_id, status);

-- Match: EV reciproco. Convenzione user_a < user_b per evitare doppioni.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  matched_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

-- Chat: solo dentro un match
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages (match_id, created_at);

-- Promo/info del locale
create table public.venue_messages (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  type text not null default 'info' check (type in ('promo', 'info')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) <= 1000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index venue_messages_venue_idx on public.venue_messages (venue_id, pinned desc, created_at desc);

-- Ricordi delle serate (privati dell'owner, v1)
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  other_user_id uuid references public.profiles (id) on delete set null,
  venue_id uuid references public.venues (id) on delete set null,
  image_path text,          -- path nel bucket 'memories'
  created_at timestamptz not null default now()
);
create index memories_owner_idx on public.memories (owner_id, created_at desc);

-- Drink offerti. I passaggi di stato legati al pagamento avverranno
-- SOLO lato server (webhook Stripe con service role) allo Step 6.
create table public.drinks (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  amount_cents int check (amount_cents > 0),
  currency text not null default 'eur',
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'redeemed', 'cancelled')),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index drinks_receiver_idx on public.drinks (receiver_id, status);

-- ------------------------------------------------------------
-- FUNZIONI HELPER (security definer: usate dentro le policy)
-- ------------------------------------------------------------

-- Il locale della sessione attiva di un utente (null se nessuna)
create or replace function public.active_session_venue(p_user uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select venue_id
  from public.sessions
  where user_id = p_user and ended_at is null and expires_at > now()
  order by started_at desc
  limit 1
$$;

create or replace function public.are_matched(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches
    where user_a = least(a, b) and user_b = greatest(a, b)
  )
$$;

-- LA regola di visibilità dei profili
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select target = auth.uid()
    or public.are_matched(target, auth.uid())
    or (
      public.active_session_venue(auth.uid()) is not null
      and public.active_session_venue(target) = public.active_session_venue(auth.uid())
    )
$$;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_qr_tokens enable row level security;
alter table public.sessions enable row level security;
alter table public.evs enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.venue_messages enable row level security;
alter table public.memories enable row level security;
alter table public.drinks enable row level security;

-- profiles
create policy "profiles_select_visible" on public.profiles
  for select to authenticated using (public.can_view_profile(id));
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- venues: lettura per tutti gli utenti loggati (mappa/check-in), scrittura owner
create policy "venues_select_all" on public.venues
  for select to authenticated using (true);
create policy "venues_insert_owner" on public.venues
  for insert to authenticated with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'business'
    )
  );
create policy "venues_update_owner" on public.venues
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "venues_delete_owner" on public.venues
  for delete to authenticated using (owner_id = auth.uid());

-- venue_qr_tokens: solo l'owner del locale
create policy "qr_tokens_owner_all" on public.venue_qr_tokens
  for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()));

-- sessions: vedi le tue; l'owner del locale vede quelle del suo venue
-- (conteggio presenze in dashboard — i profili restano protetti dalla
-- policy sui profiles). Insert/chiusura solo via RPC.
create policy "sessions_select_own" on public.sessions
  for select to authenticated using (user_id = auth.uid());
create policy "sessions_select_venue_owner" on public.sessions
  for select to authenticated using (
    exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid())
  );

-- evs: vedi solo quelli che ti riguardano; scritture via RPC
create policy "evs_select_participant" on public.evs
  for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());

-- matches: solo i partecipanti; creati dalla RPC send_ev
create policy "matches_select_participant" on public.matches
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());

-- messages: solo i partecipanti del match
create policy "messages_select_participant" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );
create policy "messages_insert_participant" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

-- venue_messages: lettura per chi è in sessione attiva nel locale (o owner)
create policy "venue_messages_select_in_session" on public.venue_messages
  for select to authenticated using (
    public.active_session_venue(auth.uid()) = venue_id
    or exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid())
  );
create policy "venue_messages_write_owner" on public.venue_messages
  for all to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()));

-- memories: privati dell'owner
create policy "memories_owner_all" on public.memories
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- drinks: vedi i tuoi; il mittente può crearne in pending_payment.
-- Nessun update dal client: gli stati cambiano solo server-side (Step 6).
create policy "drinks_select_participant" on public.drinks
  for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "drinks_insert_sender" on public.drinks
  for insert to authenticated with check (
    sender_id = auth.uid() and status = 'pending_payment'
  );

-- ------------------------------------------------------------
-- RPC (security definer: aggirano RLS, validano tutto al loro interno)
-- ------------------------------------------------------------

-- Check-in via QR: valida il token, chiude l'eventuale sessione
-- precedente, apre la nuova con la durata del locale.
create or replace function public.check_in(p_qr_token uuid)
returns public.sessions
language plpgsql security definer
set search_path = public
as $$
declare
  v_venue public.venues%rowtype;
  v_session public.sessions;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select v.* into v_venue
  from public.venues v
  join public.venue_qr_tokens t on t.venue_id = v.id
  where t.token = p_qr_token;

  if not found then
    raise exception 'invalid_qr_token';
  end if;

  update public.sessions
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  insert into public.sessions (user_id, venue_id, expires_at)
  values (
    auth.uid(),
    v_venue.id,
    now() + make_interval(mins => v_venue.session_duration_minutes)
  )
  returning * into v_session;

  return v_session;
end;
$$;

-- Chiusura volontaria della sessione
create or replace function public.end_session()
returns void
language sql security definer
set search_path = public
as $$
  update public.sessions
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null
$$;

-- Invio EV. Ritorna l'id dell'EV e se ha generato un match.
create or replace function public.send_ev(p_receiver uuid, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_venue uuid;
  v_ev public.evs;
  v_reciprocal public.evs;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_receiver = auth.uid() then
    raise exception 'cannot_ev_self';
  end if;

  v_venue := public.active_session_venue(auth.uid());
  if v_venue is null or v_venue is distinct from public.active_session_venue(p_receiver) then
    raise exception 'not_in_same_venue';
  end if;

  insert into public.evs (sender_id, receiver_id, venue_id, note)
  values (auth.uid(), p_receiver, v_venue, p_note)
  on conflict (sender_id, receiver_id, venue_id) do nothing
  returning * into v_ev;

  if v_ev.id is null then
    -- EV già inviato in questo locale: nessun duplicato
    select * into v_ev from public.evs
    where sender_id = auth.uid() and receiver_id = p_receiver and venue_id = v_venue;
  end if;

  select * into v_reciprocal from public.evs
  where sender_id = p_receiver and receiver_id = auth.uid()
    and venue_id = v_venue and status <> 'ignored';

  if found then
    update public.evs set status = 'matched' where id in (v_ev.id, v_reciprocal.id);
    insert into public.matches (user_a, user_b, venue_id)
    values (least(auth.uid(), p_receiver), greatest(auth.uid(), p_receiver), v_venue)
    on conflict (user_a, user_b) do nothing;
    return jsonb_build_object('ev_id', v_ev.id, 'matched', true);
  end if;

  return jsonb_build_object('ev_id', v_ev.id, 'matched', false);
end;
$$;

-- Il destinatario ignora un EV ricevuto
create or replace function public.ignore_ev(p_ev uuid)
returns void
language sql security definer
set search_path = public
as $$
  update public.evs
  set status = 'ignored'
  where id = p_ev and receiver_id = auth.uid() and status = 'pending'
$$;

-- Locali vicini (per mappa/lista). Security INVOKER: rispetta la RLS dei venues.
create or replace function public.venues_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 5000
)
returns setof public.venues
language sql stable
set search_path = public, extensions
as $$
  select *
  from public.venues
  where location is not null
    and st_dwithin(location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
  order by st_distance(location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
$$;

-- Le RPC sono solo per utenti loggati
revoke execute on function public.check_in(uuid) from anon, public;
revoke execute on function public.end_session() from anon, public;
revoke execute on function public.send_ev(uuid, text) from anon, public;
revoke execute on function public.ignore_ev(uuid) from anon, public;
revoke execute on function public.venues_nearby(double precision, double precision, int) from anon, public;
grant execute on function public.check_in(uuid) to authenticated;
grant execute on function public.end_session() to authenticated;
grant execute on function public.send_ev(uuid, text) to authenticated;
grant execute on function public.ignore_ev(uuid) to authenticated;
grant execute on function public.venues_nearby(double precision, double precision, int) to authenticated;

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'evs'
  ) then
    alter publication supabase_realtime add table public.evs;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end $$;

-- ------------------------------------------------------------
-- STORAGE: bucket privati, accesso via signed URL
-- Convenzione path: <user_id>/<filename>
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false), ('memories', 'memories', false)
on conflict (id) do nothing;

-- avatars: scrivi solo nella tua cartella; leggi il tuo o quello
-- di un profilo che hai diritto di vedere (stessa regola dei profiles)
create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars_select_visible" on storage.objects
  for select to authenticated using (
    bucket_id = 'avatars'
    and public.can_view_profile(((storage.foldername(name))[1])::uuid)
  );

-- memories: privati, solo la propria cartella
create policy "memories_all_own_folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'memories' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'memories' and (storage.foldername(name))[1] = auth.uid()::text);
