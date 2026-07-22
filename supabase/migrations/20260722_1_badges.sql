-- ============================================================
-- EveryWhere — Badge e gameability (Step 3k)
--
-- Riconoscimenti a soglie, DERIVATI dai dati reali (come i ricordi):
-- nessuna tabella da tenere sincronizzata. Il backend espone solo i
-- CONTEGGI; le soglie, le etichette e le icone dei badge vivono nel
-- frontend (src/lib/badges.js), un unico posto da aggiornare.
--
-- Visibilità decisa (v. ROADMAP §7): i badge li vedono l'UTENTE stesso
-- e il LOCALE che ha organizzato la serata. Il locale, tramite una RPC
-- security definer limitata alle SUE serate, vede i partecipanti con i
-- loro conteggi — è un cambiamento del modello di privacy (§2, debito
-- D14): oggi vedeva solo i numeri, non le identità.
--
-- I "drink offerti" restano a 0 finché non esiste il flusso drink
-- (Step 6): la funzione è già pronta a contarli.
-- Additiva.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Conteggi (security definer: riusati da my_stats e dalla vista locale)
-- ------------------------------------------------------------

-- Serate a cui ho partecipato: night distinte con una mia sessione.
create or replace function public.count_nights_attended(p_user uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select count(distinct night_id)::int
  from public.sessions
  where user_id = p_user and night_id is not null
$$;

-- Drink offerti e onorati (0 finché non esiste il flusso drink, Step 6).
create or replace function public.count_drinks_offered(p_user uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select count(*)::int
  from public.drinks
  where sender_id = p_user and status in ('paid', 'redeemed')
$$;

-- Match ottenuti (chat 1:1).
create or replace function public.count_matches(p_user uuid)
returns int
language sql stable security definer
set search_path = public
as $$
  select count(*)::int
  from public.matches
  where user_a = p_user or user_b = p_user
$$;

-- ------------------------------------------------------------
-- 2. I miei conteggi (per la schermata profilo)
-- ------------------------------------------------------------
create or replace function public.my_stats()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'nights_attended', public.count_nights_attended(auth.uid()),
    'drinks_offered', public.count_drinks_offered(auth.uid()),
    'matches', public.count_matches(auth.uid())
  )
$$;

-- ------------------------------------------------------------
-- 3. Vista locale: i partecipanti di una MIA serata, coi conteggi
--    Solo l'owner del locale della serata. present = sessione attiva ora.
-- ------------------------------------------------------------
create or replace function public.night_participants_with_stats(p_night uuid)
returns table (
  user_id uuid,
  name text,
  photo_path text,
  present boolean,
  nights_attended int,
  drinks_offered int,
  matches int
)
language plpgsql stable security definer
set search_path = public
as $$
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

  return query
  with participants as (
    select
      s.user_id,
      bool_or(s.ended_at is null and s.expires_at > now()) as present,
      max(s.started_at) as last_seen
    from public.sessions s
    where s.night_id = p_night
    group by s.user_id
  )
  select
    pa.user_id,
    p.name,
    p.photo_path,
    pa.present,
    public.count_nights_attended(pa.user_id),
    public.count_drinks_offered(pa.user_id),
    public.count_matches(pa.user_id)
  from participants pa
  join public.profiles p on p.id = pa.user_id
  order by pa.present desc, pa.last_seen desc;
end;
$$;

-- ------------------------------------------------------------
-- 4. Permessi
-- ------------------------------------------------------------
revoke execute on function public.my_stats() from anon, public;
revoke execute on function public.night_participants_with_stats(uuid) from anon, public;
grant execute on function public.my_stats() to authenticated;
grant execute on function public.night_participants_with_stats(uuid) to authenticated;
