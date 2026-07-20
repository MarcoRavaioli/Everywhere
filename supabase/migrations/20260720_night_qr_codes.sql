-- ============================================================
-- EveryWhere — più QR per serata + orari (Step 3c-4)
--
-- Correzioni al modello precedente:
--   - una serata può avere PIÙ QR (uno generale + uno per sala/zona):
--     sono punti di distribuzione della stessa festa
--   - ogni QR ha la sua finestra oraria (inizio/fine, entrambi opzionali:
--     nessun inizio = attivo subito, nessuna fine = fino a chiusura serata)
--   - la serata ha orari di apertura/chiusura programmati, più la
--     possibilità di aprire/chiudere a mano
--   - cade il vincolo "una sola serata aperta per locale"
--   - ogni sessione registra DA QUALE QR è entrata: riscansionando un
--     altro QR della stessa serata l'utente aggiorna la sua posizione
--     senza perdere la sessione
--
-- Chi entra da QR diversi della stessa serata SI VEDE: la visibilità
-- resta ancorata alla serata, non al singolo QR.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Via il vincolo di serata unica e la vecchia colonna di stato
--    (lo stato ora si deriva dagli orari + override manuale)
-- ------------------------------------------------------------
drop index if exists public.nights_one_open_per_venue;

alter table public.nights
  add column if not exists opens_at timestamptz,   -- apertura programmata
  add column if not exists closes_at timestamptz;  -- chiusura programmata

-- opened_at / closed_at restano come override manuale
alter table public.nights drop column if exists status;

-- ------------------------------------------------------------
-- 2. Da un token per serata a molti QR per serata
-- ------------------------------------------------------------
create table if not exists public.night_qr_codes (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.nights (id) on delete cascade,
  label text not null default 'Ingresso'
    check (char_length(label) between 1 and 60),
  token uuid not null unique default gen_random_uuid(),
  starts_at timestamptz,  -- null = attivo da subito
  ends_at timestamptz,    -- null = fino alla chiusura della serata
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);
create index if not exists night_qr_codes_night_idx on public.night_qr_codes (night_id);

-- Conserva i token già generati invece di invalidarli
insert into public.night_qr_codes (night_id, token, label)
select t.night_id, t.token, 'Ingresso'
from public.night_qr_tokens t
on conflict (token) do nothing;

drop function if exists public.rotate_night_qr(uuid);
drop table if exists public.night_qr_tokens;

-- ------------------------------------------------------------
-- 3. La sessione ricorda da quale QR è entrata (= in quale sala)
-- ------------------------------------------------------------
alter table public.sessions
  add column if not exists qr_code_id uuid references public.night_qr_codes (id) on delete set null;

-- ------------------------------------------------------------
-- 4. RLS sui QR: solo il proprietario del locale
-- ------------------------------------------------------------
alter table public.night_qr_codes enable row level security;

drop policy if exists "night_qr_codes_owner" on public.night_qr_codes;
create policy "night_qr_codes_owner" on public.night_qr_codes
  for select to authenticated using (
    exists (
      select 1 from public.nights n
      join public.venues v on v.id = n.venue_id
      where n.id = night_id and v.owner_id = auth.uid()
    )
  );
-- Nessuna policy di scrittura: si passa dalle RPC

-- ------------------------------------------------------------
-- 5. Quando una serata è "attiva"
--    chiusura manuale > tutto; apertura manuale anticipa l'orario;
--    l'orario di chiusura vale comunque
-- ------------------------------------------------------------
create or replace function public.night_is_active(p_night uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    n.closed_at is null
    and (n.opened_at is not null or (n.opens_at is not null and now() >= n.opens_at))
    and (n.closes_at is null or now() < n.closes_at)
  from public.nights n
  where n.id = p_night
$$;

-- La visibilità dei profili segue la serata attiva (non il singolo QR):
-- chi entra da sale diverse della stessa festa si vede.
create or replace function public.active_session_night(p_user uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select s.night_id
  from public.sessions s
  where s.user_id = p_user
    and s.ended_at is null
    and s.expires_at > now()
    and public.night_is_active(s.night_id)
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
  where s.user_id = p_user
    and s.ended_at is null
    and s.expires_at > now()
    and public.night_is_active(s.night_id)
  order by s.started_at desc
  limit 1
$$;

-- ------------------------------------------------------------
-- 6. RPC serate
-- ------------------------------------------------------------
drop function if exists public.create_night(uuid, text);

create or replace function public.create_night(
  p_venue uuid,
  p_title text default null,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_night public.nights%rowtype;
  v_qr public.night_qr_codes%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(coalesce(btrim(p_title), '')) > 120 then
    raise exception 'night_title_too_long';
  end if;
  if p_opens_at is not null and p_closes_at is not null and p_closes_at <= p_opens_at then
    raise exception 'invalid_time_window';
  end if;

  select plan into v_plan from public.venues where id = p_venue and owner_id = v_uid;
  if not found then
    raise exception 'not_venue_owner';
  end if;

  insert into public.nights (venue_id, title, opens_at, closes_at, payment_status)
  values (
    p_venue,
    nullif(btrim(coalesce(p_title, '')), ''),
    p_opens_at,
    p_closes_at,
    case when v_plan = 'subscription' then 'waived' else 'pending' end
  )
  returning * into v_night;

  -- Ogni serata nasce con il suo QR principale
  insert into public.night_qr_codes (night_id, label)
  values (v_night.id, 'Ingresso principale')
  returning * into v_qr;

  return jsonb_build_object(
    'night_id', v_night.id,
    'title', v_night.title,
    'qr_code_id', v_qr.id,
    'qr_token', v_qr.token
  );
end;
$$;

create or replace function public.update_night_schedule(
  p_night uuid,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_opens_at is not null and p_closes_at is not null and p_closes_at <= p_opens_at then
    raise exception 'invalid_time_window';
  end if;
  if not exists (
    select 1 from public.nights n
    join public.venues v on v.id = n.venue_id
    where n.id = p_night and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  update public.nights
  set opens_at = p_opens_at, closes_at = p_closes_at
  where id = p_night;
end;
$$;

-- Apertura manuale: anticipa l'orario programmato
create or replace function public.open_night(p_night uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_night public.nights%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select n.* into v_night
  from public.nights n
  join public.venues v on v.id = n.venue_id
  where n.id = p_night and v.owner_id = auth.uid();
  if not found then
    raise exception 'not_venue_owner';
  end if;
  if v_night.closed_at is not null then
    raise exception 'night_already_closed';
  end if;

  update public.nights set opened_at = coalesce(opened_at, now()) where id = p_night;
  return jsonb_build_object('night_id', p_night, 'opened', true);
end;
$$;

-- Chiusura manuale: termina tutte le sessioni della serata, da qualunque
-- QR siano entrate, e disattiva in blocco tutti i QR di quella serata
create or replace function public.close_night(p_night uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_closed int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.nights n
    join public.venues v on v.id = n.venue_id
    where n.id = p_night and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  update public.sessions
  set ended_at = now()
  where night_id = p_night and ended_at is null;
  get diagnostics v_closed = row_count;

  update public.nights set closed_at = now() where id = p_night;

  return jsonb_build_object('night_id', p_night, 'sessions_closed', v_closed);
end;
$$;

-- ------------------------------------------------------------
-- 7. RPC per i singoli QR
-- ------------------------------------------------------------
create or replace function public.create_night_qr(
  p_night uuid,
  p_label text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_qr public.night_qr_codes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_label is null or length(btrim(p_label)) = 0 then
    raise exception 'qr_label_required';
  end if;
  if char_length(btrim(p_label)) > 60 then
    raise exception 'qr_label_too_long';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'invalid_time_window';
  end if;
  if not exists (
    select 1 from public.nights n
    join public.venues v on v.id = n.venue_id
    where n.id = p_night and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  insert into public.night_qr_codes (night_id, label, starts_at, ends_at)
  values (p_night, btrim(p_label), p_starts_at, p_ends_at)
  returning * into v_qr;

  return jsonb_build_object('qr_code_id', v_qr.id, 'token', v_qr.token, 'label', v_qr.label);
end;
$$;

create or replace function public.update_night_qr(
  p_qr uuid,
  p_label text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_label is not null and char_length(btrim(p_label)) > 60 then
    raise exception 'qr_label_too_long';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'invalid_time_window';
  end if;
  if not exists (
    select 1 from public.night_qr_codes q
    join public.nights n on n.id = q.night_id
    join public.venues v on v.id = n.venue_id
    where q.id = p_qr and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  update public.night_qr_codes
  set label = coalesce(nullif(btrim(coalesce(p_label, '')), ''), label),
      starts_at = p_starts_at,
      ends_at = p_ends_at
  where id = p_qr;
end;
$$;

create or replace function public.rotate_night_qr(p_qr uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.night_qr_codes q
    join public.nights n on n.id = q.night_id
    join public.venues v on v.id = n.venue_id
    where q.id = p_qr and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  update public.night_qr_codes
  set token = gen_random_uuid(), rotated_at = now()
  where id = p_qr
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.delete_night_qr(p_qr uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.night_qr_codes q
    join public.nights n on n.id = q.night_id
    join public.venues v on v.id = n.venue_id
    where q.id = p_qr and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  -- Ultimo QR della serata: lasciarne almeno uno evita serate irraggiungibili
  if (select count(*) from public.night_qr_codes q
      where q.night_id = (select night_id from public.night_qr_codes where id = p_qr)) <= 1 then
    raise exception 'last_qr_of_night';
  end if;

  delete from public.night_qr_codes where id = p_qr;
end;
$$;

-- ------------------------------------------------------------
-- 8. Check-in: risolve il QR, valida serata + finestra del QR,
--    e se sei già in questa serata aggiorna solo la posizione
-- ------------------------------------------------------------
create or replace function public.check_in(p_qr_token uuid)
returns public.sessions
language plpgsql security definer
set search_path = public
as $$
declare
  v_qr public.night_qr_codes%rowtype;
  v_night public.nights%rowtype;
  v_venue public.venues%rowtype;
  v_session public.sessions;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_qr from public.night_qr_codes where token = p_qr_token;
  if not found then
    raise exception 'invalid_qr_token';
  end if;

  select * into v_night from public.nights where id = v_qr.night_id;

  if not public.night_is_active(v_night.id) then
    raise exception 'night_not_open';
  end if;
  if v_qr.starts_at is not null and now() < v_qr.starts_at then
    raise exception 'qr_not_yet_active';
  end if;
  if v_qr.ends_at is not null and now() >= v_qr.ends_at then
    raise exception 'qr_expired';
  end if;

  select * into v_venue from public.venues where id = v_night.venue_id;

  -- Già dentro questa serata: è un cambio sala, non un nuovo ingresso.
  -- La sessione (e il suo orario d'inizio) resta, cambia solo il QR.
  select * into v_session
  from public.sessions
  where user_id = auth.uid() and ended_at is null;

  if found and v_session.night_id = v_night.id then
    update public.sessions
    set qr_code_id = v_qr.id
    where id = v_session.id
    returning * into v_session;
    return v_session;
  end if;

  if found then
    update public.sessions set ended_at = now() where id = v_session.id;
  end if;

  -- La sessione non sopravvive alla chiusura programmata della serata
  v_expires := now() + make_interval(mins => coalesce(v_venue.session_duration_minutes, 300));
  if v_night.closes_at is not null and v_night.closes_at < v_expires then
    v_expires := v_night.closes_at;
  end if;

  insert into public.sessions (user_id, venue_id, night_id, qr_code_id, expires_at)
  values (auth.uid(), v_venue.id, v_night.id, v_qr.id, v_expires)
  returning * into v_session;

  return v_session;
end;
$$;

-- ------------------------------------------------------------
-- 9. Permessi
-- ------------------------------------------------------------
revoke execute on function public.create_night(uuid, text, timestamptz, timestamptz) from anon, public;
revoke execute on function public.update_night_schedule(uuid, timestamptz, timestamptz) from anon, public;
revoke execute on function public.create_night_qr(uuid, text, timestamptz, timestamptz) from anon, public;
revoke execute on function public.update_night_qr(uuid, text, timestamptz, timestamptz) from anon, public;
revoke execute on function public.rotate_night_qr(uuid) from anon, public;
revoke execute on function public.delete_night_qr(uuid) from anon, public;

grant execute on function public.create_night(uuid, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.update_night_schedule(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.create_night_qr(uuid, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.update_night_qr(uuid, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.rotate_night_qr(uuid) to authenticated;
grant execute on function public.delete_night_qr(uuid) to authenticated;
