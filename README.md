# Reserva de lavadora

Sistema de reservas de lavadora para un edificio de inquilinos. React + Vite + TypeScript + Tailwind CSS v4 + Supabase.

## Reglas de negocio

- **Registro**: cada inquilino se registra con nombre, apellido, número de habitación, tipo de habitación (normal o suite) y teléfono de contacto. Ese teléfono es lo que le permite a la dueña contactarlos (aparece en su panel y en el email de notificación de cada reserva).
- **Reservas sin franjas fijas**: no hay horarios predefinidos. Cada inquilino elige libremente la hora de inicio (incluida la madrugada) y el sistema calcula el fin del ciclo sumando una duración fija (1h45). Se bloquean automáticamente los horarios que se superponen con otra reserva ya existente.
- Cada inquilino puede reservar 1 vez por semana ISO (lunes a domingo).
- Se bloquean: segunda reserva en la misma semana, horario superpuesto con otra reserva, y horarios que ya pasaron.
- **Objetos perdidos y encontrados**: cualquier inquilino puede publicar "perdí algo" o "encontré algo" (descripción + dónde, opcional). Es una cartelera compartida: todos los inquilinos ven todos los reportes con el contacto (nombre, habitación, teléfono) de quien reportó, para resolverlo directamente entre ellos. El autor de un reporte (o la dueña) puede marcarlo como resuelto o eliminarlo.

## Cómo correr el proyecto

```bash
npm install
npm run dev
```

### Modo demo (sin Supabase)

Si no existen `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY`, la app arranca en **modo demo**: usa [`src/lib/mockSupabase.ts`](src/lib/mockSupabase.ts), un almacén en memoria que imita las respuestas y errores reales de Postgres/RLS (código `P0001` del trigger de una reserva por semana, `23P01` de la restricción `no_overlapping_reservations`, `42501` de RLS) y trae reservas y reportes ya cargados por vecinas de ejemplo. No hay pantalla de login: se simula una inquilina (`Vecina Demo`, habitación 5B) y un botón en el banner amarillo permite alternar entre su vista de inquilina y la vista de la dueña para poder probar ambas sin credenciales.

### Modo real (con Supabase)

1. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. Sobre un proyecto Supabase **nuevo**, aplica en orden las migraciones de `supabase/migrations/`:
   - `01_schema.sql` — crea `profiles` y `reservations` desde cero (ya no depende de tablas externas), con el trigger de alta de usuario, RLS, la restricción de solapamiento y la RPC `get_occupied_ranges`.
   - `02_lost_found.sql` — crea `lost_found_reports`, su RLS y la RPC `get_lost_found_board` (cartelera compartida).
3. `npm run dev` — ahora aparece la pantalla de login/registro. El registro guarda `first_name`, `last_name`, `room_number`, `room_type` y `phone` en `raw_user_meta_data`, y el trigger de la migración crea el `profile` automáticamente.
4. Para marcar a la dueña del edificio, ejecuta manualmente (ver el comentario final de `01_schema.sql`):
   ```sql
   update public.profiles set is_owner = true where id = '<uuid-de-la-dueña>';
   ```

> Si ya tenías un proyecto Supabase con el esquema anterior (franjas fijas `time_slots`), esta es una migración disruptiva: `01_schema.sql` crea las tablas desde cero, así que hay que aplicarla sobre un proyecto limpio o adaptar manualmente los datos existentes antes de correrla.

## Estructura

- `src/lib/supabase.ts` — cliente real de Supabase, o `null` si faltan las env vars (modo demo).
- `src/lib/mockSupabase.ts` — almacén en memoria del modo demo (reservas y reportes de objetos perdidos).
- `src/lib/constants.ts` — duración fija del ciclo de lavado (`RESERVATION_DURATION_MINUTES`), debe coincidir con el trigger SQL.
- `src/lib/db.ts` — capa única que expone reservas (`fetchOccupiedRanges`, `createReservation`, `cancelReservation`, `fetchMyReservations`, `fetchOwnerReservations`) y objetos perdidos (`fetchLostFoundBoard`, `createLostFoundReport`, `setLostFoundResolved`, `deleteLostFoundReport`); internamente decide si golpea Supabase real o el mock.
- `src/lib/errors.ts` — traduce los códigos de error de Postgres/RLS al mensaje de cada toast.
- `src/lib/dateUtils.ts` — fecha/hora local (evita el corrimiento de día de `toISOString`/UTC), semana ISO, cálculo de fin de ciclo y detección de solapamiento.
- `src/components/LaundryBooking.tsx` — elegir fecha y hora libre, ver horarios ocupados ese día, reservar/cancelar.
- `src/components/LostFound.tsx` — publicar y ver reportes de objetos perdidos/encontrados.
- `src/components/OwnerView.tsx` — tabla de reservas de la semana con nombre, habitación, tipo y teléfono de cada inquilino.
- `src/components/Auth.tsx` — login/registro (solo modo real).
- `supabase/migrations/01_schema.sql` — `profiles`, `reservations`, trigger de alta, `is_owner()`, RLS, restricción de solapamiento, RPC `get_occupied_ranges`.
- `supabase/migrations/02_lost_found.sql` — `lost_found_reports`, RLS, RPC `get_lost_found_board`.
- `supabase/functions/notify-owner/` — Edge Function que notifica por email a la dueña ante cada reserva nueva (incluye teléfono del inquilino).

## Despliegue de la Edge Function

```bash
supabase secrets set WEBHOOK_SECRET=<secreto-compartido-con-el-webhook>
supabase secrets set RESEND_API_KEY=<tu-api-key-de-resend>
supabase secrets set OWNER_EMAIL=<email-de-la-dueña>
# opcional, remitente verificado en Resend:
supabase secrets set RESEND_FROM="Lavadora <notificaciones@tu-dominio.com>"

supabase functions deploy notify-owner --no-verify-jwt
```

### Configurar el Database Webhook

En el dashboard de Supabase → **Database → Webhooks**:

1. Nuevo webhook sobre la tabla `reservations`, evento `INSERT`.
2. Tipo: **HTTP Request** → `POST` a la URL de la función desplegada (`https://<project-ref>.supabase.co/functions/v1/notify-owner`).
3. Header personalizado: `x-webhook-secret: <el mismo valor de WEBHOOK_SECRET>`.

## Verificación realizada

- `npx tsc --noEmit`: sin errores.
- Lógica de negocio del modo demo (`src/lib/mockSupabase.ts`) ejecutada directamente con un script Node (vía `jiti`, sin artefactos permanentes): reserva a medianoche, bloqueo de segunda reserva semanal, bloqueo por solapamiento de horarios, reserva en horario libre, bloqueo de fecha/hora pasada, cancelación, y el flujo completo de objetos perdidos (crear, listar en el board con contacto, permisos de resolver/eliminar). Todos los casos dieron el resultado esperado.
- `npm run dev`: Vite compila y sirve todos los componentes sin errores (`curl` a cada archivo fuente devuelve el módulo transformado, no un error overlay).

**No verificado**: interacción manual en un navegador real (no hay herramienta de browser disponible en este entorno) ni el esquema SQL/RLS contra un proyecto Supabase real (no hay uno conectado). Antes de usar en producción, conviene aplicar las migraciones sobre un proyecto Supabase de prueba y recorrer el flujo de registro → reserva → objetos perdidos a mano.
