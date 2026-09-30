-- =========================================================================
-- Esquema completo y autocontenido (reemplaza la versión anterior, que
-- asumía tablas `time_slots`/`reservations` creadas por fuera de este
-- repositorio). Pensado para aplicarse sobre un proyecto Supabase nuevo.
--
-- Reglas de negocio:
-- - Cada inquilino puede reservar 1 vez por semana ISO (lunes a domingo).
-- - No hay franjas fijas: se elige cualquier hora de inicio, y el ciclo
--   dura una duración fija (`RESERVATION_DURATION_MINUTES` en el
--   frontend, 105 minutos aquí abajo). Se puede reservar cualquier hora
--   del día, incluida la madrugada.
-- - Se bloquean: segunda reserva en la misma semana, horario que se
--   superpone con otra reserva ya existente, y horarios pasados.
-- =========================================================================

-- =========================================================================
-- profiles: tabla + trigger de creación automática desde auth.users
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  room_number text not null,
  room_type text not null default 'normal' check (room_type in ('normal', 'suite')),
  phone text not null,
  is_owner boolean not null default false
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, room_number, room_type, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'room_number',
    coalesce(new.raw_user_meta_data ->> 'room_type', 'normal'),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- public.is_owner(): evita la recursión de RLS al consultar profiles
-- desde sus propias policies (SECURITY DEFINER corre con los privilegios
-- del dueño de la función, que es dueño de la tabla y por lo tanto
-- omite RLS al leerla).
-- =========================================================================

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_owner() to authenticated;

-- =========================================================================
-- RLS: profiles
-- =========================================================================

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_owner"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_owner());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Nadie puede auto-asignarse is_owner: se revoca UPDATE completo y se
-- otorga solo sobre las columnas editables por el propio inquilino.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, room_number, room_type, phone) on public.profiles to authenticated;

-- =========================================================================
-- reservations
-- Sin franjas fijas: starts_at/ends_at son timestamps locales sin zona
-- horaria, en la hora del edificio (America/Guayaquil, ver la policy de
-- INSERT más abajo). `ends_at` lo calcula el trigger de abajo, nunca lo
-- manda el cliente.
-- =========================================================================

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  starts_at timestamp not null,
  ends_at timestamp not null,
  created_at timestamptz not null default now()
);

create or replace function public.reservations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Duración fija del ciclo de lavado/secado (mantener sincronizado con
  -- RESERVATION_DURATION_MINUTES en src/lib/constants.ts).
  new.ends_at := new.starts_at + make_interval(mins => 105);

  if exists (
    select 1 from public.reservations
    where tenant_id = new.tenant_id
      and date_trunc('week', starts_at) = date_trunc('week', new.starts_at)
  ) then
    raise exception 'El inquilino ya tiene una reserva para esta semana.';
  end if;

  return new;
end;
$$;

create trigger reservations_before_insert
  before insert on public.reservations
  for each row execute function public.reservations_before_insert();

alter table public.reservations enable row level security;

create policy "reservations_select_own_or_owner"
  on public.reservations for select
  to authenticated
  using (tenant_id = auth.uid() or public.is_owner());

create policy "reservations_delete_own_or_owner"
  on public.reservations for delete
  to authenticated
  using (tenant_id = auth.uid() or public.is_owner());

create policy "reservations_insert_own_future"
  on public.reservations for insert
  to authenticated
  with check (tenant_id = auth.uid() and starts_at >= (now() at time zone 'America/Guayaquil'));

-- Sin policy de UPDATE: para cambiar de horario se cancela (DELETE) y se
-- vuelve a reservar (INSERT).

-- Barrera anti-concurrencia a nivel de base de datos: dos reservas no
-- pueden tener rangos horarios que se solapen (una sola lavadora).
alter table public.reservations
  add constraint no_overlapping_reservations
  exclude using gist (tsrange(starts_at, ends_at, '[)') with &&);

-- Barrera anti-concurrencia para "una reserva por semana" (el trigger de
-- arriba es BEFORE INSERT y no ve transacciones concurrentes aún no
-- confirmadas).
create unique index one_reservation_per_week
  on public.reservations (tenant_id, (date_trunc('week', starts_at)));

-- =========================================================================
-- RPC: get_occupied_ranges
-- Con RLS activo, un inquilino no ve las reservas ajenas, así que la
-- pantalla de reserva necesita esta función SECURITY DEFINER para saber
-- qué horarios están ocupados ese día sin exponer de quién son.
-- =========================================================================

create or replace function public.get_occupied_ranges(p_date date)
returns table (starts_at timestamp, ends_at timestamp)
language sql
security definer
set search_path = ''
stable
as $$
  select starts_at, ends_at
  from public.reservations
  where starts_at::date = p_date or ends_at::date = p_date;
$$;

revoke all on function public.get_occupied_ranges(date) from public;
grant execute on function public.get_occupied_ranges(date) to authenticated;

-- =========================================================================
-- Para marcar a la dueña del edificio (ejecutar manualmente una vez que
-- se haya registrado, reemplazando el UUID por el de su cuenta):
--
-- update public.profiles set is_owner = true where id = '<uuid-de-la-dueña>';
-- =========================================================================
