-- =========================================================================
-- El arriendo no se maneja por contratos: se quitan la fecha de fin de
-- contrato y sus recordatorios. Se mantienen la fecha de ingreso (opcional)
-- y la solicitud de cambio del día de pago.
-- =========================================================================

drop trigger if exists leases_before_update on public.leases;
drop function if exists public.leases_reset_contract_stage();

alter table public.leases
  drop column if exists contract_end,
  drop column if exists contract_stage;

-- El inquilino pide otro día de pago (mensaje sin hablar de "contrato").
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
    raise exception 'No tienes un arriendo activo o ya pagas ese día.';
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

-- Tarea diaria: genera el arriendo del mes y manda los recordatorios de pago.
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
