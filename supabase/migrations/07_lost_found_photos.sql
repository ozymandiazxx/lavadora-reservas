-- =========================================================================
-- Fotos en los reportes de objetos perdidos/encontrados.
-- Bucket público de solo-lectura; cada inquilino solo puede subir dentro
-- de su propia carpeta (prefijo auth.uid()/...), así nadie sube a nombre
-- de otro. La URL pública se guarda en lost_found_reports.photo_url.
-- =========================================================================

alter table public.lost_found_reports add column photo_url text;

insert into storage.buckets (id, name, public)
values ('lost-found', 'lost-found', true)
on conflict (id) do nothing;

create policy "lost_found_photos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'lost-found');

create policy "lost_found_photos_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lost-found' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "lost_found_photos_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lost-found' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- get_lost_found_board ahora también devuelve photo_url.
-- =========================================================================

drop function if exists public.get_lost_found_board();

create function public.get_lost_found_board()
returns table (
  id uuid,
  reporter_id uuid,
  report_type text,
  description text,
  location text,
  photo_url text,
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
    r.id, r.reporter_id, r.report_type, r.description, r.location, r.photo_url, r.resolved, r.created_at,
    p.first_name, p.last_name, p.room_number, p.phone
  from public.lost_found_reports r
  join public.profiles p on p.id = r.reporter_id
  order by r.resolved asc, r.created_at desc;
$$;

revoke all on function public.get_lost_found_board() from public;
grant execute on function public.get_lost_found_board() to authenticated;

-- El insert normal de la tabla ya permitía cualquier columna propia del
-- reporter (reporter_id = auth.uid()), así que photo_url queda incluido
-- automáticamente en la policy "lost_found_insert_own" existente.
