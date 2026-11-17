-- =====================================================================
-- VeciRed · Reprogramar el retiro (una vez) o se cancela
--
-- 1. Termina la franja de una reserva aceptada y el cliente no retiró:
--    no se cancela enseguida. Se le avisa que elija otro horario antes del
--    cierre del local (si ya cerró, hasta el cierre del próximo día que
--    abre). Si no lo cambia a tiempo, se cancela ("no retirada").
-- 2. Puede reprogramar UNA vez, a cualquier franja disponible. Si tampoco
--    retira en el horario nuevo, se cancela.
-- 3. Al comercio le llega un aviso del cambio y puede cancelar la reserva
--    reprogramada con un motivo, que ve el cliente.
-- No se borra ni se cambia nada de lo que ya existe.
-- =====================================================================

alter table public.reservas
  add column reprogramar_hasta timestamptz,
  add column reprogramada_en timestamptz,
  add column motivo_comercio text;

-- Hasta cuándo puede reprogramar: el cierre del local hoy (si todavía no
-- cerró) o el del próximo día que abre. Sin horario cargado: fin del día.
create function public.cierre_para_reprogramar(p_comercio bigint, p_desde timestamptz)
returns timestamptz
language plpgsql stable security definer set search_path = ''
as $$
declare
  hoy date := (p_desde at time zone 'America/Argentina/Buenos_Aires')::date;
  d date;
  v_cierra time;
  v_fin timestamptz;
begin
  if not exists (select 1 from public.horarios where comercio_id = p_comercio) then
    return ((hoy + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires') - interval '1 minute';
  end if;
  for i in 0..14 loop
    d := hoy + i;
    continue when exists (select 1 from public.dias_cerrados(p_comercio, d, d));
    select max(cierra) into v_cierra from public.horarios where comercio_id = p_comercio and dia = extract(dow from d)::int;
    continue when v_cierra is null;
    v_fin := (d + v_cierra) at time zone 'America/Argentina/Buenos_Aires';
    -- Al menos 30 minutos para elegir otro horario.
    if v_fin > p_desde + interval '30 minutes' then
      return v_fin;
    end if;
  end loop;
  return p_desde + interval '1 day';
end;
$$;
revoke execute on function public.cierre_para_reprogramar(bigint, timestamptz) from public, anon, authenticated;

-- El cliente elige otro horario (una sola vez, con la franja ya vencida).
create function public.reprogramar_retiro(p_reserva bigint, p_retiro text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  v_hasta timestamptz := public.fin_de_franja(p_retiro, now());
  c public.comercios;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or r.comprador_id is distinct from auth.uid() then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'aceptada' or r.reprogramar_hasta is null then
    raise exception 'Esta reserva no necesita cambiar el horario';
  end if;
  if r.reprogramada_en is not null then
    raise exception 'El horario se puede cambiar una sola vez';
  end if;
  if r.reprogramar_hasta < now() then
    raise exception 'Se pasó el plazo para cambiar el horario';
  end if;
  if v_hasta is null or v_hasta <= now() then
    raise exception 'Elegí un horario de retiro que todavía no haya pasado';
  end if;
  update public.reservas
  set retiro = left(p_retiro, 80), retiro_hasta = v_hasta, reprogramada_en = now(), reprogramar_hasta = null, actualizada_en = now()
  where id = r.id;
  select * into c from public.comercios where id = r.comercio_id;
  perform public.notificar(
    c.dueno_id,
    'Cambió el horario de retiro: ' || r.producto_nombre,
    coalesce(public.nombre_corto(r.comprador_id), 'El cliente') || ' ahora retira ' || left(p_retiro, 80) || '. Si no podés, cancelala con un motivo.',
    '/comerciante?seccion=reservas#reserva-' || r.id
  );
end;
$$;
revoke execute on function public.reprogramar_retiro(bigint, text) from public, anon;
grant execute on function public.reprogramar_retiro(bigint, text) to authenticated;

-- El comercio cancela una reserva reprogramada, con un motivo para el cliente.
create function public.cancelar_reprogramada(p_reserva bigint, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'aceptada' or r.reprogramada_en is null then
    raise exception 'Solo se puede cancelar así una reserva a la que el cliente le cambió el horario';
  end if;
  if length(v_motivo) < 5 then
    raise exception 'Contale al cliente por qué la cancelás';
  end if;
  perform public.revisar_textos('publico', v_motivo);
  perform public.devolver_stock(r.producto_id, r.cantidad);
  update public.reservas
  set estado = 'rechazada', motivo_comercio = left(v_motivo, 300), actualizada_en = now()
  where id = r.id;
end;
$$;
revoke execute on function public.cancelar_reprogramada(bigint, text) from public, anon;
grant execute on function public.cancelar_reprogramada(bigint, text) to authenticated;

-- Vencimientos (cada 10 minutos).
create or replace function public.vencer_reservas(p_horas integer default 2)
returns integer
language plpgsql security definer set search_path = ''
as $function$
declare
  n integer;
  fila public.reservas;
  v_hasta timestamptz;
begin
  -- Sin respuesta del comercio: 2 horas de horario de atención.
  update public.reservas r
  set estado = 'vencida', actualizada_en = now()
  where r.estado in ('pendiente', 'alternativa')
    and public.minutos_abierto(
          r.comercio_id,
          case when r.estado = 'alternativa' then r.actualizada_en else r.creada_en end,
          now()
        ) >= p_horas * 60;
  get diagnostics n = row_count;

  -- Terminó la franja y no la reprogramó nunca: se le pide otro horario.
  for fila in
    select * from public.reservas x
    where x.estado = 'aceptada' and x.retiro_hasta < now()
      and x.reprogramada_en is null and x.reprogramar_hasta is null
    for update
  loop
    v_hasta := public.cierre_para_reprogramar(fila.comercio_id, now());
    update public.reservas set reprogramar_hasta = v_hasta where id = fila.id;
    perform public.notificar(
      fila.comprador_id,
      'Se pasó tu horario de retiro',
      'Elegí otro horario para ' || fila.producto_nombre || ' antes de las '
        || to_char(v_hasta at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI "del" DD/MM') || ', o la reserva se cancela.',
      '/reservas#reserva-' || fila.id
    );
  end loop;

  -- Se cancela: no reprogramó a tiempo, o ya la reprogramó y tampoco retiró.
  -- (Las de antes del cambio 24, sin retiro_hasta: 5 días de atención.)
  for fila in
    select * from public.reservas x
    where x.estado = 'aceptada'
      and (
        (x.reprogramar_hasta is not null and x.reprogramar_hasta < now())
        or (x.reprogramada_en is not null and x.retiro_hasta < now())
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
