-- =========================================================================
-- Notificaciones dentro de la app: cuando se crea una reserva, se avisa
-- al inquilino (confirmación) y a la dueña (quién reservó). Sin canal
-- externo (sin email/SMS) — se ven en la campanita dentro de la app.
-- =========================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where not read;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Solo se puede marcar como leída; el contenido lo escribe el trigger de abajo.
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- Nadie inserta notificaciones directamente: las crea el trigger
-- (SECURITY DEFINER) al confirmarse una reserva. No hay policy de INSERT.

-- =========================================================================
-- Trigger: al crear una reserva, notifica al inquilino y a la dueña.
-- =========================================================================

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

  formatted := to_char(new.starts_at, 'DD/MM') || ' a las ' || to_char(new.starts_at, 'HH24:MI');

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

create trigger reservations_after_insert
  after insert on public.reservations
  for each row execute function public.notify_on_reservation();
