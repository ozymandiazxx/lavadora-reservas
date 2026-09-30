-- =========================================================================
-- Piso del edificio: subsuelo y terraza son todas suites; piso 2 y piso 3
-- son habitaciones normales (14 en cada uno). El frontend deriva
-- room_type a partir del piso elegido al registrarse, pero se guardan
-- ambos datos por separado para no tener que recalcular room_type cada
-- vez que se necesita.
-- =========================================================================

alter table public.profiles
  add column floor text not null default 'piso_2'
    check (floor in ('subsuelo', 'piso_2', 'piso_3', 'terraza'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, room_number, room_type, floor, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'room_number',
    coalesce(new.raw_user_meta_data ->> 'room_type', 'normal'),
    coalesce(new.raw_user_meta_data ->> 'floor', 'piso_2'),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

revoke update on public.profiles from authenticated;
grant update (first_name, last_name, room_number, room_type, floor, phone) on public.profiles to authenticated;
