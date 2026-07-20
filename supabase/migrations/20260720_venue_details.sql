-- ============================================================
-- EveryWhere — anagrafica locale (fix Step 3c-1)
-- La prima versione di create_my_venue() accettava city/address
-- ma non li scriveva: i dati del form andavano persi. Qui le
-- colonne mancanti + la funzione che le persiste davvero.
--
-- NOTA: applicare DOPO 20260720_venues_rpc.sql.
-- `location` resta null: il geocoding (city+address -> lat/lng) è
-- un task separato, necessario prima che venues_nearby() possa
-- restituire questi locali (oggi filtra `location is not null`).
-- ============================================================

alter table public.venues
  add column if not exists venue_type text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists hours_open text,
  add column if not exists hours_close text;

-- Lunghezze limitate: valgono anche per chi chiama l'API direttamente
-- bypassando il form (idempotente: si può rieseguire)
alter table public.venues drop constraint if exists venues_text_lengths;
alter table public.venues add constraint venues_text_lengths check (
  (venue_type  is null or char_length(venue_type)  <= 60)  and
  (address     is null or char_length(address)     <= 200) and
  (city        is null or char_length(city)        <= 100) and
  (phone       is null or char_length(phone)       <= 40)  and
  (email       is null or char_length(email)       <= 200) and
  (website     is null or char_length(website)     <= 200) and
  (hours_open  is null or char_length(hours_open)  <= 20)  and
  (hours_close is null or char_length(hours_close) <= 20)
);

-- Ricerca per città (lista locali lato utente, finché non c'è il geocoding)
create index if not exists venues_city_idx on public.venues (lower(city));

-- La firma cambia: va rimossa la vecchia, altrimenti Postgres tiene
-- entrambe le versioni e PostgREST non sa quale chiamare.
drop function if exists public.create_my_venue(text, text, text, int);

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
  p_session_minutes int default 300
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.profiles%rowtype;
  v_venue public.venues%rowtype;
  v_token uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'venue_name_required';
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
    hours_open, hours_close, location, session_duration_minutes
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
    null, -- geocoding: task separato (v. ROADMAP)
    coalesce(p_session_minutes, 300)
  )
  returning * into v_venue;

  insert into public.venue_qr_tokens (venue_id)
  values (v_venue.id)
  returning token into v_token;

  return jsonb_build_object(
    'venue_id', v_venue.id,
    'name', v_venue.name,
    'city', v_venue.city,
    'session_minutes', v_venue.session_duration_minutes,
    'qr_token', v_token
  );
end;
$$;

revoke execute on function public.create_my_venue(
  text, text, text, text, text, text, text, text, text, int
) from anon, public;
grant execute on function public.create_my_venue(
  text, text, text, text, text, text, text, text, text, int
) to authenticated;
