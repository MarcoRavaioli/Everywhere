-- ============================================================
-- EveryWhere — QR di uscita (Step 3d-3)
--
-- Un QR può ora essere di INGRESSO o di USCITA. Inquadrare un QR
-- di uscita chiude la sessione: si smette di essere visibili alle
-- altre persone della serata.
--
-- Principio: da una serata si deve SEMPRE poter uscire. Il QR di
-- uscita non rispetta finestre orarie e funziona anche a serata
-- chiusa — negare l'uscita non protegge nessuno.
-- ============================================================

alter table public.night_qr_codes
  add column if not exists kind text not null default 'entry';

alter table public.night_qr_codes drop constraint if exists night_qr_codes_kind_check;
alter table public.night_qr_codes add constraint night_qr_codes_kind_check
  check (kind in ('entry', 'exit'));

-- ------------------------------------------------------------
-- Creazione QR: si sceglie il tipo
-- ------------------------------------------------------------
drop function if exists public.create_night_qr(uuid, text, timestamptz, timestamptz);

create or replace function public.create_night_qr(
  p_night uuid,
  p_label text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_kind text default 'entry'
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
  if p_kind is null or p_kind not in ('entry', 'exit') then
    raise exception 'invalid_qr_kind';
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

  insert into public.night_qr_codes (night_id, label, starts_at, ends_at, kind)
  values (p_night, btrim(p_label), p_starts_at, p_ends_at, p_kind)
  returning * into v_qr;

  return jsonb_build_object(
    'qr_code_id', v_qr.id, 'token', v_qr.token, 'label', v_qr.label, 'kind', v_qr.kind
  );
end;
$$;

-- Non si può restare senza QR di ingresso: la serata diventerebbe
-- irraggiungibile. Quelli di uscita si possono eliminare tutti.
create or replace function public.delete_night_qr(p_qr uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_night uuid;
  v_kind text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select q.night_id, q.kind into v_night, v_kind
  from public.night_qr_codes q
  join public.nights n on n.id = q.night_id
  join public.venues v on v.id = n.venue_id
  where q.id = p_qr and v.owner_id = auth.uid();

  if v_night is null then
    raise exception 'not_venue_owner';
  end if;

  if v_kind = 'entry' and (
    select count(*) from public.night_qr_codes q
    where q.night_id = v_night and q.kind = 'entry'
  ) <= 1 then
    raise exception 'last_qr_of_night';
  end if;

  delete from public.night_qr_codes where id = p_qr;
end;
$$;

-- ------------------------------------------------------------
-- Scansione: ingresso, cambio sala o uscita
-- Il tipo di ritorno cambia (prima era la riga di sessions), quindi
-- la vecchia versione va rimossa.
-- ------------------------------------------------------------
drop function if exists public.check_in(uuid);

create or replace function public.check_in(p_qr_token uuid)
returns jsonb
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
  select * into v_venue from public.venues where id = v_night.venue_id;

  select * into v_session
  from public.sessions
  where user_id = auth.uid() and ended_at is null;

  -- ── USCITA ────────────────────────────────────────────────
  -- Nessun controllo di orario o di serata aperta: uscire deve
  -- essere sempre possibile.
  if v_qr.kind = 'exit' then
    if not found or v_session.night_id is distinct from v_night.id then
      raise exception 'not_in_this_night';
    end if;
    update public.sessions set ended_at = now() where id = v_session.id;
    return jsonb_build_object(
      'action', 'checked_out',
      'venue_name', v_venue.name,
      'night_title', v_night.title
    );
  end if;

  -- ── INGRESSO ──────────────────────────────────────────────
  if not public.night_is_active(v_night.id) then
    raise exception 'night_not_open';
  end if;
  if v_qr.starts_at is not null and now() < v_qr.starts_at then
    raise exception 'qr_not_yet_active';
  end if;
  if v_qr.ends_at is not null and now() >= v_qr.ends_at then
    raise exception 'qr_expired';
  end if;

  -- Già in questa serata: è un cambio sala, la sessione resta
  if found and v_session.night_id = v_night.id then
    update public.sessions
    set qr_code_id = v_qr.id
    where id = v_session.id
    returning * into v_session;
    return jsonb_build_object(
      'action', 'moved',
      'session_id', v_session.id,
      'venue_name', v_venue.name,
      'night_title', v_night.title,
      'room_label', v_qr.label
    );
  end if;

  if found then
    update public.sessions set ended_at = now() where id = v_session.id;
  end if;

  v_expires := now() + make_interval(mins => coalesce(v_venue.session_duration_minutes, 300));
  if v_night.closes_at is not null and v_night.closes_at < v_expires then
    v_expires := v_night.closes_at;
  end if;

  insert into public.sessions (user_id, venue_id, night_id, qr_code_id, expires_at)
  values (auth.uid(), v_venue.id, v_night.id, v_qr.id, v_expires)
  returning * into v_session;

  return jsonb_build_object(
    'action', 'checked_in',
    'session_id', v_session.id,
    'venue_name', v_venue.name,
    'night_title', v_night.title,
    'room_label', v_qr.label
  );
end;
$$;

revoke execute on function public.create_night_qr(uuid, text, timestamptz, timestamptz, text) from anon, public;
grant execute on function public.create_night_qr(uuid, text, timestamptz, timestamptz, text) to authenticated;
revoke execute on function public.check_in(uuid) from anon, public;
grant execute on function public.check_in(uuid) to authenticated;
