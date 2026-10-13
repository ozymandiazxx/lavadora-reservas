-- =========================================================================
-- El edificio tiene 3 lavadoras. Cada reserva pertenece a una máquina (1-3)
-- y el anti-solapamiento ahora es POR máquina: pueden usarse las tres a la
-- vez. La regla "una reserva por semana por inquilino" se mantiene igual.
-- Las reservas existentes quedan asignadas a la lavadora 1.
-- =========================================================================

create extension if not exists btree_gist with schema extensions;

alter table public.reservations
  add column machine smallint not null default 1 check (machine between 1 and 3);

alter table public.reservations drop constraint no_overlapping_reservations;
alter table public.reservations
  add constraint no_overlapping_reservations
  exclude using gist (machine with =, tsrange(starts_at, ends_at, '[)') with &&);

-- Horarios ocupados, ahora con la máquina (sin exponer de quién son).
drop function if exists public.get_occupied_ranges(date);

create function public.get_occupied_ranges(p_date date)
returns table (starts_at timestamp, ends_at timestamp, machine smallint)
language sql
security definer
set search_path = ''
stable
as $$
  select starts_at, ends_at, machine
  from public.reservations
  where starts_at::date = p_date or ends_at::date = p_date;
$$;

revoke all on function public.get_occupied_ranges(date) from public;
grant execute on function public.get_occupied_ranges(date) to authenticated;

-- Las notificaciones indican la lavadora.
create or replace function public.notify_on_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_profile record;
  owner_row record;
  formatted text;
begin
  select first_name, last_name, room_number into tenant_profile
  from public.profiles where id = new.tenant_id;

  formatted := to_char(new.starts_at, 'DD/MM') || ' a las ' || to_char(new.starts_at, 'HH24:MI')
    || ' (lavadora ' || new.machine || ')';

  insert into public.notifications (user_id, title, body)
  values (new.tenant_id, 'Reserva confirmada', 'Tu turno de lavadora es el ' || formatted || '.');

  for owner_row in select id from public.profiles where is_owner = true loop
    insert into public.notifications (user_id, title, body)
    values (
      owner_row.id,
      'Nueva reserva',
      coalesce(tenant_profile.first_name || ' ' || tenant_profile.last_name, 'Un inquilino')
        || ' (Hab. ' || coalesce(tenant_profile.room_number, '?') || ') reservó para el ' || formatted || '.'
    );
  end loop;

  return new;
end;
$$;
