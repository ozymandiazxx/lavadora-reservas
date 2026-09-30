-- =========================================================================
-- Login por número de habitación (sin email real): cada inquilino entra
-- con su número de habitación + contraseña. El email que usa Supabase
-- Auth por dentro es sintético (lo arma el frontend a partir del número
-- de habitación) y nunca se le muestra al inquilino ni se le envía nada.
--
-- Esto exige que room_number sea único: si un inquilino se muda, hay que
-- borrar su cuenta en Authentication → Users antes de que otra persona
-- se registre con ese mismo número.
-- =========================================================================

alter table public.profiles
  add constraint profiles_room_number_unique unique (room_number);
