-- ============================================================
-- EveryWhere — Gruppi: uscita dalla serata = uscita dal gruppo (Step 3j-1b)
--
-- Decisione presa: quando un membro esce dalla serata (QR di uscita
-- o "Esci dalla serata"), **quel** membro lascia il gruppo; il gruppo
-- prosegue con gli altri. Se chi esce era il capogruppo, la leadership
-- passa al membro più anziano; se resta l'ultimo, il gruppo si scioglie.
--
-- Implementato come TRIGGER su sessions, non riscrivendo check_in /
-- end_session: così l'aggancio vale per OGNI percorso che chiude una
-- sessione (QR di uscita, uscita volontaria e anche close_night) senza
-- toccare una sola RPC già testata. Additiva e idempotente.
--
-- Ambito: rimuove SOLO da un gruppo 'in_night' legato ALLA serata da
-- cui si esce. Un gruppo ancora 'forming' (senza serata) non è toccato
-- dall'uscita da una serata qualsiasi.
-- ============================================================

create or replace function public.tg_remove_from_group_on_session_end()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_group uuid;
  v_was_leader boolean;
  v_remaining int;
  v_new_leader uuid;
begin
  -- solo alla transizione aperta → chiusa
  if old.ended_at is not null or new.ended_at is null then
    return new;
  end if;

  -- il gruppo in serata legato alla serata da cui l'utente esce
  select gm.group_id, gm.is_leader into v_group, v_was_leader
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.user_id = new.user_id
    and g.status = 'in_night'
    and g.night_id = new.night_id
    and g.dissolved_at is null;
  if v_group is null then
    return new;
  end if;

  delete from public.group_members where group_id = v_group and user_id = new.user_id;

  select count(*) into v_remaining from public.group_members where group_id = v_group;
  if v_remaining = 0 then
    update public.groups set status = 'dissolved', dissolved_at = now() where id = v_group;
  elsif v_was_leader then
    select user_id into v_new_leader
    from public.group_members where group_id = v_group
    order by joined_at asc limit 1;
    update public.group_members set is_leader = (user_id = v_new_leader) where group_id = v_group;
    update public.groups set leader_id = v_new_leader where id = v_group;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_remove_from_group_on_session_end on public.sessions;
create trigger trg_remove_from_group_on_session_end
  after update of ended_at on public.sessions
  for each row
  execute function public.tg_remove_from_group_on_session_end();
