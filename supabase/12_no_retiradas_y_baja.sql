-- =====================================================================
-- VeciRed · Reservas aceptadas que nunca se retiran y baja de cuenta (2026-10-28)
--
-- 1) Una reserva aceptada que el comprador no retira pasa a "no_retirada" y el
--    producto vuelve al stock. Las franjas de retiro que ofrece la app caen en
--    los primeros días con horario del local (contando el día de la reserva,
--    hasta 4 si ese día ya no quedaban franjas); se le guarda un día de atención
--    más. Por eso vence al terminar el 5.º día abierto desde que se reservó.
--    Corre en el mismo cron de vencer_reservas (cada 10 minutos).
--
-- 2) borrar_mi_cuenta(): el usuario borra su propia cuenta. Se borra en cascada
--    su perfil, sus comercios (con productos, horarios y reservas), sus
--    reservas y sus reseñas. No deja borrar si quedan reservas activas, para
--    que nadie se quede esperando: primero hay que cancelarlas o resolverlas.
--    Las fotos de productos las borra la app antes de llamar a esta función.
--
-- El "alter type" va solo: Postgres no deja usar un valor nuevo de enum en la
-- misma transacción en que se agrega.
-- =====================================================================
alter type public.estado_reserva add value if not exists 'no_retirada' after 'retirada';

-- ---------------------------------------------------------------------
-- Días con el local abierto entre dos fechas (incluidas), en hora argentina.
-- Respeta horarios, feriados y cierres puntuales (vía minutos_abierto).
create or replace function public.dias_abiertos(p_comercio bigint, p_desde date, p_hasta date)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_desde, p_hasta, interval '1 day') g
  where public.minutos_abierto(
          p_comercio,
          g::timestamp at time zone 'America/Argentina/Buenos_Aires',
          (g::date + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'
        ) > 0
$$;
revoke execute on function public.dias_abiertos(bigint, date, date) from public, anon, authenticated;

create or replace function public.vencer_reservas(p_horas integer default 2)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
  r public.reservas;
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

  -- Aceptadas sin retirar: terminó el 5.º día abierto desde la reserva.
  -- (El filtro de 4 días corridos solo evita calcular de más.)
  for r in
    select * from public.reservas x
    where x.estado = 'aceptada'
      and x.creada_en < now() - interval '4 days'
      and public.dias_abiertos(
            x.comercio_id,
            (x.creada_en at time zone 'America/Argentina/Buenos_Aires')::date,
            (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1
          ) >= 5
    for update
  loop
    perform public.devolver_stock(r.producto_id, r.cantidad);
    update public.reservas set estado = 'no_retirada', actualizada_en = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.vencer_reservas(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then
    raise exception 'Tenés que ingresar para borrar tu cuenta';
  end if;
  if exists (select 1 from public.reservas
             where comprador_id = yo and estado in ('pendiente', 'alternativa', 'aceptada')) then
    raise exception 'Tenés reservas activas. Cancelalas desde Mis reservas antes de borrar la cuenta.';
  end if;
  if exists (select 1 from public.reservas r join public.comercios c on c.id = r.comercio_id
             where c.dueno_id = yo and r.estado in ('pendiente', 'alternativa', 'aceptada')) then
    raise exception 'Tu comercio tiene reservas activas. Respondelas o marcalas como retiradas antes de borrar la cuenta.';
  end if;
  delete from auth.users where id = yo;
end;
$$;
revoke execute on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;
