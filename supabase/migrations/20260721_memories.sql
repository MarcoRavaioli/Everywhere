-- ============================================================
-- EveryWhere — Ricordi (Step 3g-2)
--
-- Nessuna tabella nuova: il recap delle serate si deriva da
-- sessions + evs + matches. Duplicare quei numeri in una tabella
-- significherebbe doverli tenere sincronizzati per sempre.
-- ============================================================

-- Le serate a cui ho partecipato, con il riepilogo di quello che è successo.
-- I conteggi riguardano solo me: quanti EV ho mandato, quanti ne ho
-- ricevuti, quanti match sono nati.
create or replace function public.my_night_recaps()
returns table (
  night_id uuid,
  venue_name text,
  night_title text,
  attended_at timestamptz,
  ev_sent int,
  ev_received int,
  match_count int
)
language sql stable security definer
set search_path = public
as $$
  select
    n.id,
    v.name,
    n.title,
    min(s.started_at) as attended_at,
    (select count(*)::int from public.evs e
      where e.night_id = n.id and e.sender_id = auth.uid()),
    (select count(*)::int from public.evs e
      where e.night_id = n.id and e.receiver_id = auth.uid()),
    (select count(*)::int from public.matches m
      where m.night_id = n.id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
  from public.sessions s
  join public.nights n on n.id = s.night_id
  join public.venues v on v.id = n.venue_id
  where s.user_id = auth.uid()
  group by n.id, v.name, n.title
  order by min(s.started_at) desc
$$;

-- Le persone con cui ho un match, con dove e quando ci siamo conosciuti.
-- Restituisce solo i miei match: gli altri profili restano invisibili.
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
  where m.user_a = auth.uid() or m.user_b = auth.uid()
  order by m.matched_at desc
$$;

revoke execute on function public.my_night_recaps() from anon, public;
revoke execute on function public.my_memories() from anon, public;
grant execute on function public.my_night_recaps() to authenticated;
grant execute on function public.my_memories() to authenticated;
