-- ============================================================
-- EveryWhere — RPC creazione/gestione locale (Step 3c)
-- La creazione del venue passa da una funzione atomica: profilo
-- business + venue + token QR in un colpo solo. Il client non
-- controlla né owner_id né il valore del token (anti-abuso).
-- ============================================================

-- Crea il locale del business loggato.
-- - Rifiuta se non autenticato.
-- - Rifiuta se l'account esiste già come 'personal' (niente flip silenzioso).
-- - owner_id è SEMPRE auth.uid(): un client non può crearlo per altri.
-- - Il token QR è generato dal server (gen_random_uuid), mai dal client.
create or replace function public.create_my_venue(
  p_name text,
  p_city text default null,
  p_address text default null,
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

  select * into v_existing from public.profiles where id = v_uid;
  if found and v_existing.account_type = 'personal' then
    raise exception 'account_already_personal';
  end if;

  -- Assicura il profilo business (name obbligatorio: usa il nome locale)
  insert into public.profiles (id, account_type, name)
  values (v_uid, 'business', btrim(p_name))
  on conflict (id) do update set account_type = 'business';

  insert into public.venues (owner_id, name, location, session_duration_minutes)
  values (v_uid, btrim(p_name), null, coalesce(p_session_minutes, 300))
  returning * into v_venue;

  insert into public.venue_qr_tokens (venue_id)
  values (v_venue.id)
  returning token into v_token;

  return jsonb_build_object(
    'venue_id', v_venue.id,
    'name', v_venue.name,
    'session_minutes', v_venue.session_duration_minutes,
    'qr_token', v_token
  );
end;
$$;

-- Ruota il token QR di un locale. Solo l'owner; nuovo valore lato server.
create or replace function public.rotate_venue_qr(p_venue uuid)
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
  if not exists (select 1 from public.venues where id = p_venue and owner_id = v_uid) then
    raise exception 'not_venue_owner';
  end if;

  update public.venue_qr_tokens
  set token = gen_random_uuid(), rotated_at = now()
  where venue_id = p_venue
  returning token into v_token;

  return v_token;
end;
$$;

revoke execute on function public.create_my_venue(text, text, text, int) from anon, public;
revoke execute on function public.rotate_venue_qr(uuid) from anon, public;
grant execute on function public.create_my_venue(text, text, text, int) to authenticated;
grant execute on function public.rotate_venue_qr(uuid) to authenticated;
