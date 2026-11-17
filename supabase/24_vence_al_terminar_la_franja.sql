-- =====================================================================
-- VeciRed · La reserva aceptada vence al terminar el horario de retiro
--
-- Antes: una reserva aceptada sin retirar vencía después de 5 días de
-- atención. Ahora: se guarda cuándo termina la franja que eligió el cliente
-- ("Hoy, 9:00 a 11:00" → hoy 11:00) y, si a esa hora no se retiró, vence
-- ("no retirada") y el producto vuelve al stock. Corre cada 10 minutos.
-- Las reservas hechas antes de este cambio siguen con la regla anterior.
-- =====================================================================

alter table public.reservas add column retiro_hasta timestamptz;

-- Cuándo termina una franja de retiro, a partir del texto que arma la página
-- ("Hoy, 9:00 a 11:00", "Mañana, …", "Jueves, …", "Jueves 26/11, …") y de la
-- fecha en que se hizo la reserva. null si no se entiende el texto.
create function public.fin_de_franja(p_retiro text, p_desde timestamptz)
returns timestamptz
language plpgsql stable set search_path = ''
as $$
declare
  base date := (p_desde at time zone 'America/Argentina/Buenos_Aires')::date;
  m text[];
  dia text;
  d date;
  dm text[];
  idx integer;
  dias text[] := array['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
begin
  m := regexp_match(coalesce(p_retiro, ''), '^(.+), \d{1,2}:\d{2} a (\d{1,2}:\d{2})$');
  if m is null then
    return null;
  end if;
  dia := m[1];
  if dia = 'Hoy' then
    d := base;
  elsif dia = 'Mañana' then
    d := base + 1;
  else
    dm := regexp_match(dia, '^(\S+) (\d{1,2})/(\d{1,2})$');
    if dm is not null then
      d := make_date(extract(year from base)::int, dm[3]::int, dm[2]::int);
      if d < base then
        d := make_date(extract(year from base)::int + 1, dm[3]::int, dm[2]::int);
      end if;
    else
      idx := array_position(dias, dia);
      if idx is null then
        return null;
      end if;
      d := base + ((idx - 1 - extract(dow from base)::int + 7) % 7);
    end if;
  end if;
  return (d + m[2]::time) at time zone 'America/Argentina/Buenos_Aires';
exception when others then
  return null;
end;
$$;

-- Al reservar se guarda el fin de la franja.
create function public.guardar_fin_de_franja()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.retiro_hasta := public.fin_de_franja(new.retiro, coalesce(new.creada_en, now()));
  return new;
end;
$$;
revoke execute on function public.guardar_fin_de_franja() from public, anon, authenticated;

-- "zz_" para que corra después de preparar_reserva (que fija creada_en).
create trigger zz_fin_de_franja
  before insert on public.reservas
  for each row execute function public.guardar_fin_de_franja();

create or replace function public.vencer_reservas(p_horas integer default 2)
returns integer
language plpgsql security definer set search_path = ''
as $function$
declare
  n integer;
  m integer;
  fila public.reservas;
begin
  -- Sin respuesta: 2 horas de horario de atención.
  update public.reservas r
  set estado = 'vencida', actualizada_en = now()
  where r.estado in ('pendiente', 'alternativa')
    and public.minutos_abierto(
          r.comercio_id,
          case when r.estado = 'alternativa' then r.actualizada_en else r.creada_en end,
          now()
        ) >= p_horas * 60;
  get diagnostics n = row_count;

  -- Aceptadas sin retirar: terminó el horario de retiro que eligió el cliente.
  -- (Las de antes de este cambio, sin retiro_hasta: 5 días de atención.)
  for fila in
    select * from public.reservas x
    where x.estado = 'aceptada'
      and (
        (x.retiro_hasta is not null and x.retiro_hasta < now())
        or (
          x.retiro_hasta is null
          and x.creada_en < now() - interval '4 days'
          and public.dias_abiertos(
                x.comercio_id,
                (x.creada_en at time zone 'America/Argentina/Buenos_Aires')::date,
                (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1
              ) >= 5
        )
      )
    for update
  loop
    perform public.devolver_stock(fila.producto_id, fila.cantidad);
    update public.reservas set estado = 'no_retirada', actualizada_en = now() where id = fila.id;
    n := n + 1;
  end loop;
  return n;
end;
$function$;
revoke execute on function public.vencer_reservas(integer) from public, anon, authenticated;
