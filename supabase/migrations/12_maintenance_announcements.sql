-- =========================================================================
-- Reportes de mantenimiento (inquilino -> dueña, con foto) y avisos
-- generales (dueña -> todos). Ambos generan notificaciones en la app, y por
-- el trigger de 11_push.sql también llegan al celular.
-- =========================================================================

-- ---------- Mantenimiento ----------
create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  category text not null check (category in ('lavadora', 'luz', 'agua', 'internet', 'habitacion', 'otro')),
  description text not null check (char_length(description) between 3 and 600),
  photo_path text,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_proceso', 'resuelto')),
  response text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index maintenance_status_idx on public.maintenance_requests (status, created_at desc);
create index maintenance_tenant_idx on public.maintenance_requests (tenant_id, created_at desc);

alter table public.maintenance_requests enable row level security;

create policy "maintenance_select_own_or_owner" on public.maintenance_requests for select to authenticated
  using (tenant_id = auth.uid() or public.is_owner());
create policy "maintenance_insert_own" on public.maintenance_requests for insert to authenticated
  with check (tenant_id = auth.uid() and status = 'pendiente');
create policy "maintenance_update_owner" on public.maintenance_requests for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "maintenance_delete_own_pending_or_owner" on public.maintenance_requests for delete to authenticated
  using (public.is_owner() or (tenant_id = auth.uid() and status = 'pendiente'));

-- La dueña solo puede cambiar el estado y la respuesta, no reescribir el reporte.
revoke update on public.maintenance_requests from authenticated;
grant update (status, response, resolved_at) on public.maintenance_requests to authenticated;

-- Fotos: bucket privado, cada quien sube a su carpeta; la dueña ve todo.
insert into storage.buckets (id, name, public)
values ('maintenance', 'maintenance', false)
on conflict (id) do nothing;

create policy "maintenance_photos_read_own_or_owner" on storage.objects for select to authenticated
  using (bucket_id = 'maintenance' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
create policy "maintenance_photos_insert_own_folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'maintenance' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "maintenance_photos_delete_own_folder" on storage.objects for delete to authenticated
  using (bucket_id = 'maintenance' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.notify_on_maintenance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_profile record;
  owner_row record;
  label text;
begin
  if tg_op = 'INSERT' then
    select first_name, last_name, room_number into tenant_profile from public.profiles where id = new.tenant_id;
    for owner_row in select id from public.profiles where is_owner = true loop
      insert into public.notifications (user_id, title, body)
      values (
        owner_row.id,
        'Nueva falla reportada',
        coalesce(tenant_profile.first_name || ' ' || tenant_profile.last_name, 'Un inquilino')
          || ' (Hab. ' || coalesce(tenant_profile.room_number, '?') || '): ' || left(new.description, 80)
      );
    end loop;
  elsif new.status is distinct from old.status then
    label := case new.status when 'en_proceso' then 'en proceso' when 'resuelto' then 'resuelto' else 'pendiente' end;
    insert into public.notifications (user_id, title, body)
    values (
      new.tenant_id,
      'Tu reporte está ' || label,
      left(new.description, 60) || coalesce(' — ' || nullif(new.response, ''), '')
    );
  end if;
  return new;
end;
$$;

create trigger maintenance_after_write
  after insert or update on public.maintenance_requests
  for each row execute function public.notify_on_maintenance();

-- ---------- Avisos generales ----------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 3 and 800),
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create index announcements_created_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;

create policy "announcements_select_all" on public.announcements for select to authenticated using (true);
create policy "announcements_owner_insert" on public.announcements for insert to authenticated
  with check (public.is_owner() and created_by = auth.uid());
create policy "announcements_owner_delete" on public.announcements for delete to authenticated
  using (public.is_owner());

-- Cada aviso llega a todos los demás como notificación.
create or replace function public.notify_on_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, title, body)
  select p.id, 'Aviso: ' || new.title, left(new.body, 140)
  from public.profiles p
  where p.id <> new.created_by;
  return new;
end;
$$;

create trigger announcements_after_insert
  after insert on public.announcements
  for each row execute function public.notify_on_announcement();
