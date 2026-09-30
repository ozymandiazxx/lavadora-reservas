-- =========================================================================
-- Fix: room_number se repite entre pisos (ej: piso 2 y piso 3 tienen
-- ambos una "habitación 1"), así que el número solo no puede ser único
-- en todo el edificio. El identificador real es piso + habitación.
-- =========================================================================

alter table public.profiles drop constraint profiles_room_number_unique;

alter table public.profiles
  add constraint profiles_floor_room_unique unique (floor, room_number);
