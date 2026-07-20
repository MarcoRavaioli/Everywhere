-- ============================================================
-- EveryWhere — le SERATE diventano l'entità centrale (Step 3c-3)
--
-- Modello deciso:
--   piano (abbonamento illimitato | serata singola)
--     └── locale (venues)
--           └── serate (nights) ← il QR sta QUI, non sul locale
--                 └── check-in utenti (sessions)
--
-- Regole scelte:
--   - la serata si apre e si chiude A MANO dal gestore
--   - il QR funziona SOLO a serata aperta
--   - alla chiusura tutte le sessioni dentro vengono terminate
--   - una sola serata aperta per locale alla volta
--
-- ATTENZIONE: questa migration ELIMINA `venue_qr_tokens` (il QR a
-- livello locale, superato dal QR per serata). Sul database di dev
-- significa perdere i token di test già generati: i QR stampati
-- finora smettono di funzionare. Applicare DOPO le migration
-- precedenti.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Piano del locale (scelto in onboarding, prima della creazione)
-- ------------------------------------------------------------
alter table public.venues
  add column if not exists plan text;

alter table public.venues drop constraint if exists venues_plan_check;
alter table public.venues add constraint venues_plan_check
  check (plan is null or plan in ('subscription', 'pay_per_night'));

-- ------------------------------------------------------------
-- 2. Serate
-- ------------------------------------------------------------
create table if not exists public.nights (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed')),
  -- 'waived' = coperta dall'abbonamento; 'pending' = da pagare (Step 6)
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'waived')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nights_venue_idx on public.nights (venue_id, created_at desc);

-- Il vincolo che rende impossibile avere due serate aperte nello stesso locale
create unique index if not exists nights_one_open_per_venue
  on public.nights (venue_id) where status = 'open';

-- ------------------------------------------------------------
-- 3. QR per serata (sostituisce quello del locale)
-- ------------------------------------------------------------
create table if not exists public.night_qr_tokens (
  night_id uuid primary key references public.nights (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  rotated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Le sessioni appartengono a una serata
-- ------------------------------------------------------------
alter table public.sessions
  add column if not exists night_id uuid references public.nights (id) on delete cascade;
create index if not exists sessions_night_idx on public.sessions (night_id) where ended_at is null;

-- ------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------
alter table public.nights enable row level security;
alter table public.night_qr_tokens enable row level security;

drop policy if exists "nights_select_owner" on public.nights;
create policy "nights_select_owner" on public.nights
  for select to authenticated using (
    exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid())
  );

-- Chi ha fatto check-in vede la serata in cui si trova
drop policy if exists "nights_select_participant" on public.nights;
create policy "nights_select_participant" on public.nights
  for select to authenticated using (
    exists (
      select 1 from public.sessions s
      where s.night_id = nights.id and s.user_id = auth.uid() and s.ended_at is null
    )
  );

-- Nessuna policy di scrittura: si passa solo dalle RPC qui sotto
drop policy if exists "night_tokens_owner" on public.night_qr_tokens;
create policy "night_tokens_owner" on public.night_qr_tokens
  for select to authenticated using (
    exists (
      select 1 from public.nights n
      join public.venues v on v.id = n.venue_id
      where n.id = night_id and v.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 6. Visibilità: ora è la SERATA a definire "siamo insieme"
-- ------------------------------------------------------------
create or replace function public.active_session_night(p_user uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select s.night_id
  from public.sessions s
  join public.nights n on n.id = s.night_id
  where s.user_id = p_user
    and s.ended_at is null
    and s.expires_at > now()
    and n.status = 'open'
  order by s.started_at desc
  limit 1
$$;

create or replace function public.active_session_venue(p_user uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select s.venue_id
  from public.sessions s
  join public.nights n on n.id = s.night_id
  where s.user_id = p_user
    and s.ended_at is null
    and s.expires_at > now()
    and n.status = 'open'
  order by s.started_at desc
  limit 1
$$;

-- Stessa regola di prodotto, ma ancorata alla serata: chiusa la serata,
-- le persone smettono di vedersi anche se la sessione non è scaduta
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select target = auth.uid()
    or public.are_matched(target, auth.uid())
    or (
      public.active_session_night(auth.uid()) is not null
      and public.active_session_night(target) = public.active_session_night(auth.uid())
    )
$$;

-- ------------------------------------------------------------
-- 7. RPC di gestione serata
-- ------------------------------------------------------------

-- Crea una serata in bozza CON il suo QR: così può essere stampato
-- in anticipo, pur non funzionando finché la serata non viene aperta.
create or replace function public.create_night(p_venue uuid, p_title text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_night public.nights%rowtype;
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(coalesce(btrim(p_title), '')) > 120 then
    raise exception 'night_title_too_long';
  end if;

  select plan into v_plan from public.venues where id = p_venue and owner_id = v_uid;
  if not found then
    raise exception 'not_venue_owner';
  end if;

  insert into public.nights (venue_id, title, payment_status)
  values (
    p_venue,
    nullif(btrim(coalesce(p_title, '')), ''),
    case when v_plan = 'subscription' then 'waived' else 'pending' end
  )
  returning * into v_night;

  insert into public.night_qr_tokens (night_id)
  values (v_night.id)
  returning token into v_token;

  return jsonb_build_object(
    'night_id', v_night.id,
    'title', v_night.title,
    'status', v_night.status,
    'payment_status', v_night.payment_status,
    'qr_token', v_token
  );
end;
$$;

-- Apre la serata: da qui il QR fa entrare le persone.
-- NOTA Step 6: qui andrà il controllo del pagamento
-- (payment_status deve essere 'paid' o 'waived'). Oggi non blocca,
-- altrimenti non si potrebbe testare nulla senza Stripe.
create or replace function public.open_night(p_night uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_night public.nights%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select n.* into v_night
  from public.nights n
  join public.venues v on v.id = n.venue_id
  where n.id = p_night and v.owner_id = v_uid;
  if not found then
    raise exception 'not_venue_owner';
  end if;

  if v_night.status = 'closed' then
    raise exception 'night_already_closed';
  end if;
  if v_night.status = 'open' then
    return jsonb_build_object('night_id', v_night.id, 'status', 'open');
  end if;

  begin
    update public.nights
    set status = 'open', opened_at = now()
    where id = p_night;
  exception when unique_violation then
    -- l'indice parziale impedisce due serate aperte nello stesso locale
    raise exception 'another_night_open';
  end;

  return jsonb_build_object('night_id', p_night, 'status', 'open');
end;
$$;

-- Chiude la serata e termina TUTTE le sessioni ancora aperte dentro.
create or replace function public.close_night(p_night uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_closed int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.nights n
    join public.venues v on v.id = n.venue_id
    where n.id = p_night and v.owner_id = v_uid
  ) then
    raise exception 'not_venue_owner';
  end if;

  update public.sessions
  set ended_at = now()
  where night_id = p_night and ended_at is null;
  get diagnostics v_closed = row_count;

  update public.nights
  set status = 'closed', closed_at = now()
  where id = p_night;

  return jsonb_build_object('night_id', p_night, 'status', 'closed', 'sessions_closed', v_closed);
end;
$$;

create or replace function public.rotate_night_qr(p_night uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.nights n
    join public.venues v on v.id = n.venue_id
    where n.id = p_night and v.owner_id = v_uid
  ) then
    raise exception 'not_venue_owner';
  end if;

  update public.night_qr_tokens
  set token = gen_random_uuid(), rotated_at = now()
  where night_id = p_night
  returning token into v_token;

  return v_token;
end;
$$;

-- ------------------------------------------------------------
-- 8. Check-in: il token ora identifica una SERATA
-- ------------------------------------------------------------
create or replace function public.check_in(p_qr_token uuid)
returns public.sessions
language plpgsql security definer
set search_path = public
as $$
declare
  v_night public.nights%rowtype;
  v_venue public.venues%rowtype;
  v_session public.sessions;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select n.* into v_night
  from public.nights n
  join public.night_qr_tokens t on t.night_id = n.id
  where t.token = p_qr_token;

  if not found then
    raise exception 'invalid_qr_token';
  end if;
  if v_night.status <> 'open' then
    -- QR valido ma serata non aperta (non ancora iniziata o già chiusa)
    raise exception 'night_not_open';
  end if;

  select * into v_venue from public.venues where id = v_night.venue_id;

  -- una sola sessione aperta per utente
  update public.sessions
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  insert into public.sessions (user_id, venue_id, night_id, expires_at)
  values (
    auth.uid(),
    v_venue.id,
    v_night.id,
    now() + make_interval(mins => coalesce(v_venue.session_duration_minutes, 300))
  )
  returning * into v_session;

  return v_session;
end;
$$;

-- ------------------------------------------------------------
-- 9. create_my_venue: aggiunge il piano, non crea più token di locale
-- ------------------------------------------------------------
drop function if exists public.create_my_venue(
  text, text, text, text, text, text, text, text, text, int
);

create or replace function public.create_my_venue(
  p_name text,
  p_venue_type text default null,
  p_address text default null,
  p_city text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_hours_open text default null,
  p_hours_close text default null,
  p_session_minutes int default 300,
  p_plan text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.profiles%rowtype;
  v_venue public.venues%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'venue_name_required';
  end if;
  if p_plan is not null and p_plan not in ('subscription', 'pay_per_night') then
    raise exception 'invalid_plan';
  end if;
  if char_length(btrim(p_name)) > 120
     or char_length(coalesce(btrim(p_venue_type), '')) > 60
     or char_length(coalesce(btrim(p_address), '')) > 200
     or char_length(coalesce(btrim(p_city), '')) > 100
     or char_length(coalesce(btrim(p_phone), '')) > 40
     or char_length(coalesce(btrim(p_email), '')) > 200
     or char_length(coalesce(btrim(p_website), '')) > 200
     or char_length(coalesce(btrim(p_hours_open), '')) > 20
     or char_length(coalesce(btrim(p_hours_close), '')) > 20 then
    raise exception 'venue_field_too_long';
  end if;

  select * into v_existing from public.profiles where id = v_uid;
  if found and v_existing.account_type = 'personal' then
    raise exception 'account_already_personal';
  end if;

  insert into public.profiles (id, account_type, name)
  values (v_uid, 'business', btrim(p_name))
  on conflict (id) do update set account_type = 'business';

  insert into public.venues (
    owner_id, name, venue_type, address, city, phone, email, website,
    hours_open, hours_close, location, session_duration_minutes, plan
  )
  values (
    v_uid,
    btrim(p_name),
    nullif(btrim(coalesce(p_venue_type, '')), ''),
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_website, '')), ''),
    nullif(btrim(coalesce(p_hours_open, '')), ''),
    nullif(btrim(coalesce(p_hours_close, '')), ''),
    null, -- geocoding: task separato
    coalesce(p_session_minutes, 300),
    p_plan
  )
  returning * into v_venue;

  return jsonb_build_object(
    'venue_id', v_venue.id,
    'name', v_venue.name,
    'city', v_venue.city,
    'plan', v_venue.plan,
    'session_minutes', v_venue.session_duration_minutes
  );
end;
$$;

-- ------------------------------------------------------------
-- 10. Rimozione del QR a livello locale (superato dal QR per serata)
-- ------------------------------------------------------------
drop function if exists public.rotate_venue_qr(uuid);
drop table if exists public.venue_qr_tokens;

-- ------------------------------------------------------------
-- 11. Permessi: tutto solo per utenti autenticati
-- ------------------------------------------------------------
revoke execute on function public.create_night(uuid, text) from anon, public;
revoke execute on function public.open_night(uuid) from anon, public;
revoke execute on function public.close_night(uuid) from anon, public;
revoke execute on function public.rotate_night_qr(uuid) from anon, public;
revoke execute on function public.create_my_venue(
  text, text, text, text, text, text, text, text, text, int, text
) from anon, public;

grant execute on function public.create_night(uuid, text) to authenticated;
grant execute on function public.open_night(uuid) to authenticated;
grant execute on function public.close_night(uuid) to authenticated;
grant execute on function public.rotate_night_qr(uuid) to authenticated;
grant execute on function public.create_my_venue(
  text, text, text, text, text, text, text, text, text, int, text
) to authenticated;

-- Realtime: la dashboard segue apertura/chiusura e presenze
alter publication supabase_realtime add table public.nights;
