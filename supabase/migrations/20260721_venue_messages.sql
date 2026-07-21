-- ============================================================
-- EveryWhere — comunicazioni del locale (Step 3g-1)
--
-- Due correzioni:
--   - i tipi non combaciavano: la UI ne offriva 4 (promo, lineup,
--     aggiornamento, evento), il DB ne accettava 2 (promo, info)
--   - i messaggi erano solo per locale: ora possono essere legati a
--     una serata specifica (night_id) oppure valere per il locale
--     in generale (night_id null)
-- ============================================================

alter table public.venue_messages
  add column if not exists night_id uuid references public.nights (id) on delete cascade;

create index if not exists venue_messages_night_idx
  on public.venue_messages (night_id, pinned desc, created_at desc);

-- Tipi allineati alla UI
alter table public.venue_messages drop constraint if exists venue_messages_type_check;
alter table public.venue_messages add constraint venue_messages_type_check
  check (type in ('promo', 'info', 'lineup', 'event'));

-- ------------------------------------------------------------
-- Lettura: chi è presente vede i messaggi generali del locale e
-- quelli della PROPRIA serata, non quelli di altre serate.
-- ------------------------------------------------------------
drop policy if exists "venue_messages_select_in_session" on public.venue_messages;
create policy "venue_messages_select_in_session" on public.venue_messages
  for select to authenticated using (
    (
      public.active_session_venue(auth.uid()) = venue_id
      and (night_id is null or night_id = public.active_session_night(auth.uid()))
    )
    or exists (
      select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid()
    )
  );

-- Le scritture passano dalle RPC: la policy diretta permetteva di
-- allegare un messaggio a una serata di un ALTRO locale, perché
-- controllava solo la proprietà del venue.
drop policy if exists "venue_messages_write_owner" on public.venue_messages;

-- ------------------------------------------------------------
-- RPC di gestione (solo owner del locale)
-- ------------------------------------------------------------
create or replace function public.create_venue_message(
  p_venue uuid,
  p_type text,
  p_title text,
  p_body text,
  p_night uuid default null,
  p_pinned boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_msg public.venue_messages%rowtype;
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
  -- La serata deve appartenere a QUESTO locale
  if p_night is not null and not exists (
    select 1 from public.nights n where n.id = p_night and n.venue_id = p_venue
  ) then
    raise exception 'night_not_of_venue';
  end if;

  insert into public.venue_messages (venue_id, night_id, type, title, body, pinned)
  values (p_venue, p_night, p_type, btrim(p_title), btrim(p_body), coalesce(p_pinned, false))
  returning * into v_msg;

  return jsonb_build_object('id', v_msg.id, 'created_at', v_msg.created_at);
end;
$$;

create or replace function public.delete_venue_message(p_message uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.venue_messages m
    join public.venues v on v.id = m.venue_id
    where m.id = p_message and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  delete from public.venue_messages where id = p_message;
end;
$$;

create or replace function public.set_venue_message_pinned(p_message uuid, p_pinned boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.venue_messages m
    join public.venues v on v.id = m.venue_id
    where m.id = p_message and v.owner_id = auth.uid()
  ) then
    raise exception 'not_venue_owner';
  end if;

  update public.venue_messages set pinned = coalesce(p_pinned, false) where id = p_message;
end;
$$;

revoke execute on function public.create_venue_message(uuid, text, text, text, uuid, boolean) from anon, public;
revoke execute on function public.delete_venue_message(uuid) from anon, public;
revoke execute on function public.set_venue_message_pinned(uuid, boolean) from anon, public;
grant execute on function public.create_venue_message(uuid, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.delete_venue_message(uuid) to authenticated;
grant execute on function public.set_venue_message_pinned(uuid, boolean) to authenticated;

-- I presenti vedono comparire le comunicazioni senza ricaricare
alter publication supabase_realtime add table public.venue_messages;
