-- =========================================================================
-- Control de arriendos: contrato por inquilino, cobros mensuales (arriendo,
-- lavadora, luz/agua, otros), pagos con comprobante y revisión de la dueña,
-- multa por atraso (se calcula en la app), recordatorios en la campanita.
-- Moneda: USD. Fechas de cobro: tipo date (sin zona horaria).
-- =========================================================================

-- ---------- Contrato / condiciones por inquilino ----------
create table public.leases (
  tenant_id uuid primary key references public.profiles (id) on delete cascade,
  monthly_rent numeric(10, 2) not null check (monthly_rent >= 0),
  due_day int not null default 5 check (due_day between 1 and 28),
  late_fee_per_day numeric(10, 2) not null default 0 check (late_fee_per_day >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.leases enable row level security;

create policy "leases_select_own_or_owner" on public.leases for select to authenticated
  using (tenant_id = auth.uid() or public.is_owner());
create policy "leases_owner_write" on public.leases for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- Cobros ----------
create table public.charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  period date not null check (extract(day from period) = 1),
  kind text not null check (kind in ('arriendo', 'lavadora', 'servicio', 'otro')),
  concept text not null,
  amount numeric(10, 2) not null check (amount > 0),
  due_date date not null,
  reminder_stage int not null default 0,
  created_at timestamptz not null default now()
);

-- Un solo cobro de arriendo y uno de lavadora por inquilino y mes.
create unique index charges_one_per_kind_idx
  on public.charges (tenant_id, period, kind) where kind in ('arriendo', 'lavadora');
create index charges_period_idx on public.charges (period);
create index charges_tenant_idx on public.charges (tenant_id, period desc);

alter table public.charges enable row level security;

create policy "charges_select_own_or_owner" on public.charges for select to authenticated
  using (tenant_id = auth.uid() or public.is_owner());
create policy "charges_owner_write" on public.charges for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- Pagos ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges (id) on delete restrict,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('transferencia', 'efectivo')),
  paid_on date not null default ((now() at time zone 'America/Guayaquil')::date),
  receipt_path text,
  note text,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_charge_idx on public.payments (charge_id);
create index payments_tenant_idx on public.payments (tenant_id, created_at desc);
create index payments_pending_idx on public.payments (created_at) where status = 'pendiente';

alter table public.payments enable row level security;

create policy "payments_select_own_or_owner" on public.payments for select to authenticated
  using (tenant_id = auth.uid() or public.is_owner());

-- El inquilino solo reporta pagos propios, siempre "pendiente", sobre cobros propios.
create policy "payments_insert_tenant" on public.payments for insert to authenticated
  with check (
    tenant_id = auth.uid()
    and status = 'pendiente'
    and exists (select 1 from public.charges c where c.id = charge_id and c.tenant_id = auth.uid())
  );
-- La dueña registra pagos de cualquiera (p. ej. efectivo) y puede dejarlos aprobados.
create policy "payments_insert_owner" on public.payments for insert to authenticated
  with check (public.is_owner());

create policy "payments_update_owner" on public.payments for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
revoke update on public.payments from authenticated;
grant update (status, review_note, reviewed_at) on public.payments to authenticated;

create policy "payments_delete_owner_or_own_pending" on public.payments for delete to authenticated
  using (public.is_owner() or (tenant_id = auth.uid() and status = 'pendiente'));

-- Sella la fecha de revisión.
create or replace function public.payments_set_reviewed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status <> 'pendiente' then
    new.reviewed_at := now();
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.reviewed_at := case when new.status = 'pendiente' then null else now() end;
  end if;
  return new;
end;
$$;

create trigger payments_before_write
  before insert or update on public.payments
  for each row execute function public.payments_set_reviewed();

-- ---------- Datos para transferir (una sola fila) ----------
create table public.rent_settings (
  singleton boolean primary key default true check (singleton),
  payment_instructions text not null default ''
);
insert into public.rent_settings (singleton) values (true);

alter table public.rent_settings enable row level security;
create policy "rent_settings_select" on public.rent_settings for select to authenticated using (true);
create policy "rent_settings_owner_write" on public.rent_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------- Comprobantes (bucket privado) ----------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_read_own_or_owner" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_owner()));
create policy "receipts_insert_own_folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_delete_own_folder" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- Notificaciones (dentro de la app, igual que las de reservas)
-- =========================================================================

create or replace function public.notify_on_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, title, body)
  values (
    new.tenant_id,
    'Nuevo cobro',
    new.concept || ': $' || to_char(new.amount, 'FM999990.00') || '. Vence el ' || to_char(new.due_date, 'DD/MM') || '.'
  );
  return new;
end;
$$;

create trigger charges_after_insert
  after insert on public.charges
  for each row execute function public.notify_on_charge();

create or replace function public.notify_on_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_profile record;
  charge_concept text;
  owner_row record;
  money text := '$' || to_char(new.amount, 'FM999990.00');
begin
  select concept into charge_concept from public.charges where id = new.charge_id;

  if tg_op = 'INSERT' then
    if new.status = 'pendiente' then
      select first_name, last_name, room_number into tenant_profile from public.profiles where id = new.tenant_id;
      for owner_row in select id from public.profiles where is_owner = true loop
        insert into public.notifications (user_id, title, body)
        values (
          owner_row.id,
          'Pago por revisar',
          coalesce(tenant_profile.first_name || ' ' || tenant_profile.last_name, 'Un inquilino')
            || ' (Hab. ' || coalesce(tenant_profile.room_number, '?') || ') reportó ' || money
            || ' por ' || charge_concept || '.'
        );
      end loop;
    elsif new.status = 'aprobado' then
      insert into public.notifications (user_id, title, body)
      values (new.tenant_id, 'Pago registrado', 'Se registró tu pago de ' || money || ' por ' || charge_concept || '.');
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'aprobado' then
      insert into public.notifications (user_id, title, body)
      values (new.tenant_id, 'Pago aprobado', 'Tu pago de ' || money || ' por ' || charge_concept || ' fue aprobado.');
    elsif new.status = 'rechazado' then
      insert into public.notifications (user_id, title, body)
      values (
        new.tenant_id,
        'Pago rechazado',
        'Tu pago de ' || money || ' por ' || charge_concept || ' fue rechazado'
          || coalesce(': ' || nullif(new.review_note, ''), '.')
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger payments_after_write
  after insert or update on public.payments
  for each row execute function public.notify_on_payment();

-- =========================================================================
-- Tarea diaria: genera el arriendo del mes y manda recordatorios.
--   etapa 1 = faltan 1-3 días, 2 = vence hoy, 3 = vencido.
-- Se ejecuta sola cada día (pg_cron, si está disponible) y también cada vez
-- que la dueña abre la pestaña de arriendos, así funciona aunque no haya cron.
-- =========================================================================

create or replace function public.rent_daily_job()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Guayaquil')::date;
  month_start date := date_trunc('month', (now() at time zone 'America/Guayaquil'))::date;
  r record;
  new_stage int;
  owner_row record;
  tenant_profile record;
begin
  if auth.uid() is not null and not public.is_owner() then
    raise exception 'Solo la dueña puede ejecutar esta tarea.' using errcode = '42501';
  end if;

  insert into public.charges (tenant_id, period, kind, concept, amount, due_date)
  select l.tenant_id, month_start, 'arriendo', 'Arriendo ' || to_char(month_start, 'MM/YYYY'),
         l.monthly_rent, month_start + (l.due_day - 1)
  from public.leases l
  where l.active and l.monthly_rent > 0
  on conflict (tenant_id, period, kind) where kind in ('arriendo', 'lavadora') do nothing;

  for r in
    select c.id, c.tenant_id, c.concept, c.amount, c.due_date, c.reminder_stage,
           c.amount - coalesce((select sum(p.amount) from public.payments p
                                where p.charge_id = c.id and p.status = 'aprobado'), 0) as remaining
    from public.charges c
  loop
    continue when r.remaining <= 0;
    new_stage := case
      when r.due_date < today then 3
      when r.due_date = today then 2
      when r.due_date - today <= 3 then 1
      else 0
    end;
    continue when new_stage <= r.reminder_stage;

    update public.charges set reminder_stage = new_stage where id = r.id;

    insert into public.notifications (user_id, title, body)
    values (
      r.tenant_id,
      case new_stage when 1 then 'Tu pago vence pronto' when 2 then 'Tu pago vence hoy' else 'Pago vencido' end,
      r.concept || ' por $' || to_char(r.remaining, 'FM999990.00')
        || case new_stage
             when 1 then ' vence el ' || to_char(r.due_date, 'DD/MM') || '.'
             when 2 then ' vence hoy.'
             else ' venció el ' || to_char(r.due_date, 'DD/MM') || '. Puede generar multa.'
           end
    );

    if new_stage = 3 then
      select first_name, last_name, room_number into tenant_profile from public.profiles where id = r.tenant_id;
      for owner_row in select id from public.profiles where is_owner = true loop
        insert into public.notifications (user_id, title, body)
        values (
          owner_row.id,
          'Pago vencido',
          coalesce(tenant_profile.first_name || ' ' || tenant_profile.last_name, 'Un inquilino')
            || ' (Hab. ' || coalesce(tenant_profile.room_number, '?') || ') no pagó ' || r.concept || '.'
        );
      end loop;
    end if;
  end loop;
end;
$$;

revoke all on function public.rent_daily_job() from public;
grant execute on function public.rent_daily_job() to authenticated;

-- Recordatorio manual desde la ficha del inquilino.
create or replace function public.remind_tenant(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  if not public.is_owner() then
    raise exception 'Solo la dueña puede enviar recordatorios.' using errcode = '42501';
  end if;
  select tenant_id, concept, amount, due_date into c from public.charges where id = p_charge_id;
  if not found then
    raise exception 'Cobro no encontrado.';
  end if;
  insert into public.notifications (user_id, title, body)
  values (c.tenant_id, 'Recordatorio de pago', c.concept || ' por $' || to_char(c.amount, 'FM999990.00')
    || ' (vence el ' || to_char(c.due_date, 'DD/MM') || '). Revisa la pestaña Pagos.');
end;
$$;

revoke all on function public.remind_tenant(uuid) from public;
grant execute on function public.remind_tenant(uuid) to authenticated;

-- Cobra el uso de la lavadora del mes: usos × precio por uso, por inquilino.
-- Si ya existía el cobro del mes y no tiene pagos aprobados, lo recalcula.
create or replace function public.add_laundry_charges(p_period date, p_price numeric)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected int;
  month_start date := date_trunc('month', p_period)::date;
begin
  if not public.is_owner() then
    raise exception 'Solo la dueña puede generar cobros.' using errcode = '42501';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'El precio por uso debe ser mayor a 0.';
  end if;

  insert into public.charges (tenant_id, period, kind, concept, amount, due_date)
  select r.tenant_id, month_start, 'lavadora',
         'Lavadora ' || to_char(month_start, 'MM/YYYY') || ' (' || count(*) || ' usos)',
         count(*) * p_price,
         (month_start + interval '1 month' - interval '1 day')::date
  from public.reservations r
  where r.starts_at >= month_start and r.starts_at < month_start + interval '1 month'
  group by r.tenant_id
  on conflict (tenant_id, period, kind) where kind in ('arriendo', 'lavadora')
  do update set amount = excluded.amount, concept = excluded.concept
  where not exists (
    select 1 from public.payments p where p.charge_id = public.charges.id and p.status = 'aprobado'
  );

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.add_laundry_charges(date, numeric) from public;
grant execute on function public.add_laundry_charges(date, numeric) to authenticated;

-- Ejecución diaria a las 08:00 de Ecuador (13:00 UTC). Si pg_cron no está
-- disponible no pasa nada: la tarea igual corre cuando la dueña abre Arriendos.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('rent-daily-job', '0 13 * * *', 'select public.rent_daily_job()');
exception when others then
  raise notice 'pg_cron no disponible (%), se omite la programación diaria.', sqlerrm;
end;
$$;
