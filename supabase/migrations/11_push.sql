-- =========================================================================
-- Notificaciones push (Web Push, gratis): cada notificación nueva de la app
-- también se envía al celular de la persona si activó los avisos.
--
--   notifications (insert) -> trigger -> Edge Function "send-push" -> celular
--
-- Las llaves (VAPID, secreto del webhook) NO van en este archivo: se cargan
-- aparte en la tabla push_config (ver instrucciones al desplegar).
-- =========================================================================

create extension if not exists pg_net with schema extensions;

-- Dispositivos suscritos (uno por navegador/celular).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subs_select_own" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy "push_subs_insert_own" on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
create policy "push_subs_update_own" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subs_delete_own" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- Llaves y secretos. RLS activo y sin policies: ni anon ni authenticated pueden leerla;
-- solo la leen el trigger y la Edge Function (service role).
create table public.push_config (
  singleton boolean primary key default true check (singleton),
  vapid_public text,
  vapid_private text,
  vapid_subject text,
  webhook_secret text,
  anon_key text
);
insert into public.push_config (singleton) values (true);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- La app necesita la llave pública para suscribir el dispositivo.
create or replace function public.get_vapid_public_key()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select vapid_public from public.push_config where singleton;
$$;

revoke all on function public.get_vapid_public_key() from public;
grant execute on function public.get_vapid_public_key() to authenticated;

-- Dispara el envío. Nunca debe romper el insert de la notificación.
create or replace function public.push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
begin
  select webhook_secret, anon_key into cfg from public.push_config where singleton;
  if cfg.webhook_secret is null or cfg.anon_key is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://dzndtjrpqutjzmodpndz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.anon_key,
      'x-webhook-secret', cfg.webhook_secret
    ),
    body := jsonb_build_object('user_id', new.user_id, 'title', new.title, 'body', new.body)
  );
  return new;
exception when others then
  return new;
end;
$$;

create trigger notifications_push_after_insert
  after insert on public.notifications
  for each row execute function public.push_on_notification();
