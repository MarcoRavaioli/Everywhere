-- ============================================================
-- EveryWhere — comunicazioni mirate a una sala (Step 3g-1b)
--
-- Prima si poteva scrivere a tutto il locale o a una serata.
-- Ora anche a chi è entrato da uno specifico QR, cioè a chi si
-- trova in quella sala/zona in questo momento.
--
-- Applicare DOPO 20260721_venue_messages.sql
-- ============================================================

alter table public.venue_messages
  add column if not exists qr_code_id uuid references public.night_qr_codes (id) on delete cascade;

create index if not exists venue_messages_qr_idx
  on public.venue_messages (qr_code_id, pinned desc, created_at desc);

-- Da quale QR sono entrato: identifica la sala in cui mi trovo ora.
-- Cambia se riscansiono un altro QR della stessa serata.
create or replace function public.active_session_qr(p_user uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select s.qr_code_id
  from public.sessions s
  where s.user_id = p_user
    and s.ended_at is null
    and s.expires_at > now()
    and public.night_is_active(s.night_id)
  order by s.started_at desc
  limit 1
$$;

-- Lettura: tre livelli di destinatari, dal più ampio al più stretto.
--   qr_code_id + night_id nulli → tutto il locale
--   night_id valorizzato        → solo quella serata
--   qr_code_id valorizzato      → solo chi è in quella sala adesso
drop policy if exists "venue_messages_select_in_session" on public.venue_messages;
create policy "venue_messages_select_in_session" on public.venue_messages
  for select to authenticated using (
    (
      public.active_session_venue(auth.uid()) = venue_id
      and (night_id is null or night_id = public.active_session_night(auth.uid()))
      and (qr_code_id is null or qr_code_id = public.active_session_qr(auth.uid()))
    )
    or exists (
      select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()
    )
  );

-- La firma cambia: va rimossa la versione precedente
drop function if exists public.create_venue_message(uuid, text, text, text, uuid, boolean);

create or replace function public.create_venue_message(
  p_venue uuid,
  p_type text,
  p_title text,
  p_body text,
  p_night uuid default null,
  p_pinned boolean default false,
  p_qr_code uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_msg public.venue_messages%rowtype;
  v_night uuid := p_night;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.venues v where v.id = p_venue and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;
  if p_type is null or p_type not in ('promo', 'info', 'lineup', 'event') then
    raise exception 'invalid_message_type';
  end if;
  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'message_title_required';
  end if;
  if char_length(btrim(p_title)) > 120 then
    raise exception 'message_title_too_long';
  end if;
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'message_body_required';
  end if;
  if char_length(btrim(p_body)) > 1000 then
    raise exception 'message_body_too_long';
  end if;

  -- Se il messaggio è per una sala, la serata si ricava dal QR:
  -- così non possono divergere.
  if p_qr_code is not null then
    select q.night_id into v_night
    from public.night_qr_codes q
    join public.nights n on n.id = q.night_id
    where q.id = p_qr_code and n.venue_id = p_venue;
    if v_night is null then
      raise exception 'qr_not_of_venue';
    end if;
  elsif v_night is not null and not exists (
    select 1 from public.nights n where n.id = v_night and n.venue_id = p_venue
  ) then
    raise exception 'night_not_of_venue';
  end if;

  insert into public.venue_messages (venue_id, night_id, qr_code_id, type, title, body, pinned)
  values (p_venue, v_night, p_qr_code, p_type, btrim(p_title), btrim(p_body), coalesce(p_pinned, false))
  returning * into v_msg;

  return jsonb_build_object('id', v_msg.id, 'created_at', v_msg.created_at);
end;
$$;

revoke execute on function public.create_venue_message(uuid, text, text, text, uuid, boolean, uuid) from anon, public;
grant execute on function public.create_venue_message(uuid, text, text, text, uuid, boolean, uuid) to authenticated;
revoke execute on function public.active_session_qr(uuid) from anon, public;
grant execute on function public.active_session_qr(uuid) to authenticated;
