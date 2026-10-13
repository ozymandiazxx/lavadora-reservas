-- =========================================================================
-- Datos administrativos del inquilino: fecha de ingreso, fin de contrato y
-- solicitud de cambio del día de pago (el inquilino la pide, la dueña la
-- aprueba o rechaza). Además, recordatorios de contrato por vencer.
-- =========================================================================

alter table public.leases
  add column move_in_date date,
  add column contract_end date,
  add column requested_due_day int check (requested_due_day between 1 and 28),
  add column contract_stage int not null default 0;

-- Si la dueña cambia la fecha de fin de contrato, se reinician los avisos.
create or replace function public.leases_reset_contract_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contract_end is distinct from old.contract_end then
    new.contract_stage := 0;
  end if;
  return new;
end;
$$;

create trigger leases_before_update
  before update on public.leases
  for each row execute function public.leases_reset_contract_stage();

-- El inquilino pide otro día de pago. No puede modificar su contrato directamente:
-- solo esta función, que únicamente toca requested_due_day de SU contrato activo.
create or replace function public.request_due_day(p_day int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant_profile record;
  owner_row record;
begin
  if p_day is null or p_day < 1 or p_day > 28 then
    raise exception 'El día debe estar entre 1 y 28.';
  end if;

  update public.leases set requested_due_day = p_day
  where tenant_id = auth.uid() and active and due_day <> p_day;
  if not found then
    raise exception 'No tienes un contrato activo o ya pagas ese día.';
  end if;

  select first_name, last_name, room_number into tenant_profile from public.profiles where id = auth.uid();
  for owner_row in select id from public.profiles where is_owner = true loop
    insert into public.notifications (user_id, title, body)
    values (
      owner_row.id,
      'Cambio de día de pago',
      coalesce(tenant_profile.first_name || ' ' || tenant_profile.last_name, 'Un inquilino')
        || ' (Hab. ' || coalesce(tenant_profile.room_number, '?') || ') pide pagar el día ' || p_day || ' de cada mes.'
    );
  end loop;
end;
$$;

revoke all on function public.request_due_day(int) from public;
grant execute on function public.request_due_day(int) to authenticated;

-- Avisa al inquilino cuando la dueña resuelve su solicitud.
create or replace function public.notify_on_lease_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.requested_due_day is not null and new.requested_due_day is null then
    insert into public.notifications (user_id, title, body)
    values (
      new.tenant_id,
      case when new.due_day = old.requested_due_day then 'Día de pago aprobado' else 'Día de pago no aprobado' end,
      case when new.due_day = old.requested_due_day
        then 'Desde el próximo cobro pagas el día ' || new.due_day || ' de cada mes.'
        else 'Se mantiene tu día de pago: el día ' || new.due_day || ' de cada mes.'
      end
    );
  end if;
  return new;
end;
$$;

create trigger leases_after_update_request
  after update on public.leases
  for each row execute function public.notify_on_lease_request();

-- Tarea diaria: ahora también avisa de contratos por vencer (30 y 7 días antes).
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

  -- Contratos por vencer: etapa 1 = faltan 30 días o menos, etapa 2 = faltan 7 o menos.
  for r in
    select l.tenant_id, l.contract_end, l.contract_stage,
           case when l.contract_end - today <= 7 then 2 else 1 end as stage
    from public.leases l
    where l.active and l.contract_end is not null
      and l.contract_end >= today and l.contract_end - today <= 30
  loop
    continue when r.stage <= r.contract_stage;

    update public.leases set contract_stage = r.stage where tenant_id = r.tenant_id;

    insert into public.notifications (user_id, title, body)
    values (r.tenant_id, 'Tu contrato está por vencer', 'Tu contrato termina el ' || to_char(r.contract_end, 'DD/MM/YYYY') || '.');

    select first_name, last_name, room_number into tenant_profile from public.profiles where id = r.tenant_id;
    for owner_row in select id from public.profiles where is_owner = true loop
      insert into public.notifications (user_id, title, body)
      values (
        owner_row.id,
        'Contrato por vencer',
        coalesce(tenant_profile.first_name || ' ' || tenant_profile.last_name, 'Un inquilino')
          || ' (Hab. ' || coalesce(tenant_profile.room_number, '?') || ') termina el ' || to_char(r.contract_end, 'DD/MM/YYYY') || '.'
      );
    end loop;
  end loop;
end;
$$;
