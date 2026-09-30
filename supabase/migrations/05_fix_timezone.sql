-- =========================================================================
-- Fix: la policy de INSERT comparaba starts_at (hora local del edificio,
-- sin zona) contra la hora UTC del servidor, así que reservas para "más
-- tarde hoy" en horario local se rechazaban como si ya hubieran pasado
-- (Ecuador está UTC-5). Se corrige comparando contra la hora local real
-- del edificio.
-- =========================================================================

alter policy "reservations_insert_own_future"
  on public.reservations
  with check (tenant_id = auth.uid() and starts_at >= (now() at time zone 'America/Guayaquil'));
