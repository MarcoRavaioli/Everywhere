-- ============================================================
-- EveryWhere — Gruppi: fondazione (Step 3j-1)
--
-- Un insieme di persone può presentarsi a una serata come UN'UNICA
-- entità. Questa migration porta solo le fondamenta: tabelle, QR del
-- gruppo, RPC di ciclo di vita e RLS. La presenza del gruppo nella
-- serata (3j-2), il frontend (3j-3) e la chat di gruppo (3j-4)
-- arrivano dopo.
--
-- Decisioni di prodotto (v. ROADMAP §7/§8):
--   - il gruppo si può formare PRIMA o DURANTE una serata
--   - dura 1h se non entra in una serata; entrato in serata, vive
--     finché la serata è aperta
--   - se il capogruppo se ne va, la LEADERSHIP passa al membro più
--     anziano; il gruppo si scioglie solo quando resta vuoto, scade,
--     o la sua serata chiude
--   - un utente sta in UN SOLO gruppo attivo alla volta
--   - massimo 8 membri  (entrambi i limiti sono ASSUNZIONI da
--     confermare: cambiarli è banale, sono in un punto solo)
--
-- Principio chiave — VITALITÀ DERIVATA, non memorizzata: come per le
-- sessioni (attiva = non chiusa + non scaduta + serata aperta) e per i
-- ricordi, "gruppo attivo" si CALCOLA (is_group_active). Così alla
-- chiusura della serata il gruppo diventa inattivo da solo e NON serve
-- toccare close_night / end_session / check_in: nessuna RPC già
-- testata viene modificata qui. L'unica modifica a codice esistente è
-- un'aggiunta additiva a can_view_profile (i co-membri si vedono anche
-- prima di entrare in una serata, altrimenti il "crea gruppo prima
-- dell'evento" mostrerebbe profili vuoti).
--
-- Idempotente dove possibile. Additiva.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelle
-- ------------------------------------------------------------

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.profiles (id) on delete cascade,
  -- null finché il gruppo non entra in una serata
  night_id uuid references public.nights (id) on delete set null,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  -- override della foto gruppo; se null, il client compone gli avatar dei membri
  photo_path text,
  status text not null default 'forming'
    check (status in ('forming', 'in_night', 'dissolved')),
  -- rilevante solo in 'forming': scade dopo 1h se non entra in serata
  expires_at timestamptz not null,
  entered_night_at timestamptz,
  dissolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists groups_night_idx on public.groups (night_id) where status = 'in_night';

-- Token del QR del gruppo, in tabella separata come per i QR di serata:
-- così la riga del gruppo si può leggere senza esporre il token a chi
-- non è membro.
create table if not exists public.group_qr_tokens (
  group_id uuid primary key references public.groups (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  rotated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'group_only'      = raggiungibile SOLO come parte del gruppo (niente EV singoli)
  -- 'single_and_group'= visibile sia come singolo sia nel gruppo
  visibility text not null default 'single_and_group'
    check (visibility in ('group_only', 'single_and_group')),
  is_leader boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- ------------------------------------------------------------
-- 2. Helper (security definer: usati dentro policy e RPC, aggirano RLS
--    per evitare la ricorsione delle policy su group_members)
-- ------------------------------------------------------------

create or replace function public.is_group_member(p_group uuid, p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group and user_id = p_user
  )
$$;

-- LA definizione di "gruppo attivo": derivata, mai fidarsi dello status
-- da solo. forming ⇒ entro l'ora; in_night ⇒ la serata è ancora aperta.
-- "Serata aperta" si calcola con night_is_active (nights non ha una
-- colonna status: lo stato deriva da opened_at/closed_at/opens_at/closes_at).
create or replace function public.is_group_active(p_group uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group
      and g.dissolved_at is null
      and (
        (g.status = 'forming'  and g.expires_at > now())
        or (g.status = 'in_night' and public.night_is_active(g.night_id))
      )
  )
$$;

-- L'unico gruppo attivo a cui appartiene un utente (null se nessuno)
create or replace function public.active_group(p_user uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select gm.group_id
  from public.group_members gm
  where gm.user_id = p_user
    and public.is_group_active(gm.group_id)
  limit 1
$$;

-- Due utenti sono nello stesso gruppo attivo?
create or replace function public.in_same_active_group(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members ga
    join public.group_members gb on gb.group_id = ga.group_id
    where ga.user_id = a and gb.user_id = b and a <> b
      and public.is_group_active(ga.group_id)
  )
$$;

-- ------------------------------------------------------------
-- 3. Visibilità dei profili: i co-membri si vedono (anche fuori serata)
--    Aggiunta ADDITIVA di un ramo (in_same_active_group). ATTENZIONE:
--    ricalca l'ultima versione (3h, blocks_reports) e ne PRESERVA la
--    guardia sul blocco: il ramo gruppo sta DENTRO `not is_blocked_between`,
--    così chi si è bloccato non torna visibile tramite il gruppo. Questa
--    migration gira dopo 3h, quindi la definizione qui è quella finale.
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
        or public.in_same_active_group(target, auth.uid())
      )
    )
$$;

-- ------------------------------------------------------------
-- 4. RLS: lettura per i membri; ogni scrittura passa dalle RPC
-- ------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_qr_tokens enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select to authenticated
  using (public.is_group_member(id, auth.uid()));

drop policy if exists "group_tokens_select_member" on public.group_qr_tokens;
create policy "group_tokens_select_member" on public.group_qr_tokens
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "group_members_select_comember" on public.group_members;
create policy "group_members_select_comember" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- ------------------------------------------------------------
-- 5. RPC di ciclo di vita
-- ------------------------------------------------------------

-- Crea un gruppo (l'autore ne è il capogruppo) con il suo QR.
create or replace function public.create_group(p_display_name text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups%rowtype;
  v_token uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.profiles where id = v_uid and account_type = 'personal'
  ) then
    raise exception 'not_personal_account';
  end if;
  if public.active_group(v_uid) is not null then
    raise exception 'already_in_group';
  end if;

  v_name := nullif(btrim(coalesce(p_display_name, '')), '');
  if char_length(coalesce(v_name, '')) > 80 then
    raise exception 'group_name_too_long';
  end if;

  insert into public.groups (leader_id, display_name, status, expires_at)
  values (v_uid, v_name, 'forming', now() + interval '1 hour')
  returning * into v_group;

  insert into public.group_members (group_id, user_id, is_leader, visibility)
  values (v_group.id, v_uid, true, 'single_and_group');

  insert into public.group_qr_tokens (group_id)
  values (v_group.id)
  returning token into v_token;

  return jsonb_build_object(
    'group_id', v_group.id,
    'token', v_token,
    'status', v_group.status,
    'expires_at', v_group.expires_at
  );
end;
$$;

-- Entra in un gruppo scansionandone il QR (token).
create or replace function public.join_group(p_token uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups%rowtype;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.profiles where id = v_uid and account_type = 'personal'
  ) then
    raise exception 'not_personal_account';
  end if;

  select g.* into v_group
  from public.groups g
  join public.group_qr_tokens t on t.group_id = g.id
  where t.token = p_token;
  if not found then
    raise exception 'invalid_group_token';
  end if;

  if not public.is_group_active(v_group.id) then
    raise exception 'group_not_active';
  end if;

  -- già membro: nessun errore, ritorna lo stato
  if exists (
    select 1 from public.group_members
    where group_id = v_group.id and user_id = v_uid
  ) then
    return jsonb_build_object('group_id', v_group.id, 'status', v_group.status, 'already_member', true);
  end if;

  if public.active_group(v_uid) is not null then
    raise exception 'already_in_group';
  end if;

  select count(*) into v_count from public.group_members where group_id = v_group.id;
  if v_count >= 8 then
    raise exception 'group_full';
  end if;

  -- se il gruppo è già in serata, chi entra dev'essere in QUELLA serata
  if v_group.status = 'in_night'
     and public.active_session_night(v_uid) is distinct from v_group.night_id then
    raise exception 'not_in_group_night';
  end if;

  insert into public.group_members (group_id, user_id, is_leader, visibility)
  values (v_group.id, v_uid, false, 'single_and_group');

  return jsonb_build_object('group_id', v_group.id, 'status', v_group.status, 'already_member', false);
end;
$$;

-- Lascia il gruppo. Se ero il capogruppo, la leadership passa al membro
-- più anziano; se resto l'ultimo, il gruppo si scioglie.
create or replace function public.leave_group()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_was_leader boolean;
  v_new_leader uuid;
  v_remaining int;
  v_dissolved boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select gm.group_id, gm.is_leader into v_group, v_was_leader
  from public.group_members gm
  where gm.user_id = v_uid and public.is_group_active(gm.group_id)
  limit 1;
  if v_group is null then
    raise exception 'not_in_group';
  end if;

  delete from public.group_members where group_id = v_group and user_id = v_uid;

  select count(*) into v_remaining from public.group_members where group_id = v_group;
  if v_remaining = 0 then
    update public.groups set status = 'dissolved', dissolved_at = now() where id = v_group;
    v_dissolved := true;
  elsif v_was_leader then
    select user_id into v_new_leader
    from public.group_members where group_id = v_group
    order by joined_at asc limit 1;
    update public.group_members set is_leader = (user_id = v_new_leader) where group_id = v_group;
    update public.groups set leader_id = v_new_leader where id = v_group;
  end if;

  return jsonb_build_object('left', true, 'dissolved', v_dissolved, 'new_leader', v_new_leader);
end;
$$;

-- Il capogruppo cede esplicitamente la leadership a un membro.
create or replace function public.transfer_leadership(p_new_leader uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select group_id into v_group
  from public.group_members
  where user_id = v_uid and is_leader and public.is_group_active(group_id)
  limit 1;
  if v_group is null then
    raise exception 'not_group_leader';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = v_group and user_id = p_new_leader
  ) then
    raise exception 'not_a_member';
  end if;
  update public.group_members set is_leader = (user_id = p_new_leader) where group_id = v_group;
  update public.groups set leader_id = p_new_leader where id = v_group;
end;
$$;

-- Ogni membro sceglie come mostrarsi: solo gruppo, o singolo e gruppo.
create or replace function public.set_group_visibility(p_visibility text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_visibility not in ('group_only', 'single_and_group') then
    raise exception 'invalid_visibility';
  end if;
  select group_id into v_group
  from public.group_members
  where user_id = v_uid and public.is_group_active(group_id)
  limit 1;
  if v_group is null then
    raise exception 'not_in_group';
  end if;
  update public.group_members set visibility = p_visibility
  where group_id = v_group and user_id = v_uid;
end;
$$;

-- Il capogruppo dà un nome al gruppo (facoltativo).
create or replace function public.set_group_display(p_display_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select group_id into v_group
  from public.group_members
  where user_id = v_uid and is_leader and public.is_group_active(group_id)
  limit 1;
  if v_group is null then
    raise exception 'not_group_leader';
  end if;
  v_name := nullif(btrim(coalesce(p_display_name, '')), '');
  if char_length(coalesce(v_name, '')) > 80 then
    raise exception 'group_name_too_long';
  end if;
  update public.groups set display_name = v_name where id = v_group;
end;
$$;

-- Il capogruppo aggancia il gruppo alla serata in cui si trova. Da qui
-- il gruppo vive quanto la serata (non più il timer di 1h).
create or replace function public.enter_night_as_group()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups%rowtype;
  v_night uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select g.* into v_group
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  where gm.user_id = v_uid and gm.is_leader and public.is_group_active(g.id)
  limit 1;
  if v_group.id is null then
    raise exception 'not_group_leader';
  end if;

  if v_group.status = 'in_night' then
    return jsonb_build_object('group_id', v_group.id, 'night_id', v_group.night_id, 'status', 'in_night');
  end if;

  v_night := public.active_session_night(v_uid);
  if v_night is null then
    raise exception 'leader_not_in_night';
  end if;

  update public.groups
  set night_id = v_night, status = 'in_night', entered_night_at = now()
  where id = v_group.id;

  return jsonb_build_object('group_id', v_group.id, 'night_id', v_night, 'status', 'in_night');
end;
$$;

-- Il capogruppo scioglie il gruppo in anticipo.
create or replace function public.dissolve_group()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select group_id into v_group
  from public.group_members
  where user_id = v_uid and is_leader and public.is_group_active(group_id)
  limit 1;
  if v_group is null then
    raise exception 'not_group_leader';
  end if;
  update public.groups set status = 'dissolved', dissolved_at = now() where id = v_group;
end;
$$;

-- Il mio gruppo attivo, con i membri, per il client. null se non ne ho.
create or replace function public.my_group()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.groups%rowtype;
  v_token uuid;
  v_members jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select g.* into v_group
  from public.groups g
  join public.group_members gm on gm.group_id = g.id
  where gm.user_id = v_uid and public.is_group_active(g.id)
  limit 1;
  if v_group.id is null then
    return null;
  end if;

  select token into v_token from public.group_qr_tokens where group_id = v_group.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'photo_path', p.photo_path,
      'is_leader', gm.is_leader,
      'visibility', gm.visibility,
      'joined_at', gm.joined_at
    ) order by gm.joined_at
  ), '[]'::jsonb)
  into v_members
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = v_group.id;

  return jsonb_build_object(
    'group_id', v_group.id,
    'display_name', v_group.display_name,
    'photo_path', v_group.photo_path,
    'status', v_group.status,
    'night_id', v_group.night_id,
    'leader_id', v_group.leader_id,
    'is_leader', (v_group.leader_id = v_uid),
    'expires_at', v_group.expires_at,
    'entered_night_at', v_group.entered_night_at,
    'token', v_token,
    'members', v_members
  );
end;
$$;

-- ------------------------------------------------------------
-- 6. Permessi: tutto solo per utenti autenticati
-- ------------------------------------------------------------
revoke execute on function public.create_group(text) from anon, public;
revoke execute on function public.join_group(uuid) from anon, public;
revoke execute on function public.leave_group() from anon, public;
revoke execute on function public.transfer_leadership(uuid) from anon, public;
revoke execute on function public.set_group_visibility(text) from anon, public;
revoke execute on function public.set_group_display(text) from anon, public;
revoke execute on function public.enter_night_as_group() from anon, public;
revoke execute on function public.dissolve_group() from anon, public;
revoke execute on function public.my_group() from anon, public;

grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(uuid) to authenticated;
grant execute on function public.leave_group() to authenticated;
grant execute on function public.transfer_leadership(uuid) to authenticated;
grant execute on function public.set_group_visibility(text) to authenticated;
grant execute on function public.set_group_display(text) to authenticated;
grant execute on function public.enter_night_as_group() to authenticated;
grant execute on function public.dissolve_group() to authenticated;
grant execute on function public.my_group() to authenticated;

-- ------------------------------------------------------------
-- 7. Realtime: il client segue arrivi, leadership e scioglimento
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
end $$;
