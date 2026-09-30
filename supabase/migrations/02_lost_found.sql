-- =========================================================================
-- lost_found_reports: cartelera de objetos perdidos/encontrados.
-- Cualquier inquilino puede publicar y ver los reportes de los demás
-- (a través de la RPC get_lost_found_board), para contactarse
-- directamente sin depender de que la dueña sea intermediaria.
-- =========================================================================

create table public.lost_found_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  report_type text not null check (report_type in ('perdido', 'encontrado')),
  description text not null,
  location text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.lost_found_reports enable row level security;

-- La tabla base solo se lee directamente para "mis reportes" o por la
-- dueña; la cartelera compartida se sirve mediante la RPC de abajo, que
-- expone únicamente nombre/habitación/teléfono del inquilino que reportó
-- (no toda la tabla profiles).
create policy "lost_found_select_own_or_owner"
  on public.lost_found_reports for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_owner());

create policy "lost_found_insert_own"
  on public.lost_found_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "lost_found_update_own_or_owner"
  on public.lost_found_reports for update
  to authenticated
  using (reporter_id = auth.uid() or public.is_owner())
  with check (reporter_id = auth.uid() or public.is_owner());

create policy "lost_found_delete_own_or_owner"
  on public.lost_found_reports for delete
  to authenticated
  using (reporter_id = auth.uid() or public.is_owner());

-- Solo se puede cambiar el estado "resuelto"; la descripción y el tipo
-- no se editan después de publicados.
revoke update on public.lost_found_reports from authenticated;
grant update (resolved) on public.lost_found_reports to authenticated;

-- =========================================================================
-- RPC: get_lost_found_board
-- Cartelera compartida: expone los reportes de todos los inquilinos con
-- el contacto de quien reportó, sin abrir la tabla profiles completa.
-- =========================================================================

create or replace function public.get_lost_found_board()
returns table (
  id uuid,
  reporter_id uuid,
  report_type text,
  description text,
  location text,
  resolved boolean,
  created_at timestamptz,
  first_name text,
  last_name text,
  room_number text,
  phone text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id, r.reporter_id, r.report_type, r.description, r.location, r.resolved, r.created_at,
    p.first_name, p.last_name, p.room_number, p.phone
  from public.lost_found_reports r
  join public.profiles p on p.id = r.reporter_id
  order by r.resolved asc, r.created_at desc;
$$;

revoke all on function public.get_lost_found_board() from public;
grant execute on function public.get_lost_found_board() to authenticated;
