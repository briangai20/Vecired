-- =====================================================================
-- VeciRed · Carrito, "Retiro ya", "No vino", recordatorio y avisos
--
-- 1. Avisos: cada uno lleva una categoría (reservas, mensajes, ofertas,
--    favoritos, reseñas y preguntas, cuenta) para filtrarlos en la
--    campanita, y se borran solos a los 7 días.
-- 2. Ofertas nuevas: avisan a quien tiene el producto o el comercio en
--    favoritos.
-- 3. Carrito: varios productos del mismo comercio en un solo pedido, con
--    UN código de retiro. El comercio acepta o rechaza producto por
--    producto; el código sirve para todo lo que aceptó.
-- 4. "Retiro ya": si el local está abierto y el producto tiene el stock
--    cargado al día, la reserva queda aceptada al instante, para retirar
--    en las próximas 2 horas (o hasta el cierre de la franja).
-- 5. "No vino": pasado el horario de retiro, el comercio cierra la reserva
--    y el producto vuelve al stock en el momento.
-- 6. Recordatorio al cliente 30 minutos antes de que termine su horario.
-- No se borra nada de lo que ya existe (salvo los avisos de más de 7 días).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Categoría de los avisos y borrado a los 7 días
-- ---------------------------------------------------------------------
alter table public.notificaciones
  add column categoria text not null default 'cuenta'
  check (categoria in ('reservas', 'mensajes', 'ofertas', 'favoritos', 'resenas', 'cuenta'));

-- Se decide por el título y el enlace que arman los avisos existentes, así
-- no hay que tocar cada uno. Los de ofertas y favoritos la traen puesta.
create function public.categoria_aviso(p_titulo text, p_enlace text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_titulo like 'Mensaje de %' then 'mensajes'
    when p_titulo like 'Nueva pregunta%' or p_titulo like '% respondió tu pregunta'
      or p_titulo like 'Nueva reseña%' or p_titulo like '% respondió tu reseña'
      or p_titulo like '¿Cómo te fue en %' then 'resenas'
    when coalesce(p_enlace, '') like '%seccion=reservas%' or coalesce(p_enlace, '') like '/reservas%'
      or p_titulo like 'Reclamo%' then 'reservas'
    else 'cuenta'
  end;
$$;

create function public.poner_categoria_aviso()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.categoria is null or new.categoria = 'cuenta' then
    new.categoria := public.categoria_aviso(new.titulo, new.enlace);
  end if;
  return new;
end;
$$;
revoke execute on function public.poner_categoria_aviso() from public, anon, authenticated;

create trigger categoria_al_notificar
  before insert on public.notificaciones
  for each row execute function public.poner_categoria_aviso();

update public.notificaciones set categoria = public.categoria_aviso(titulo, enlace);

-- Crea un aviso con categoría (uso interno).
create function public.notificar_en(p_usuario uuid, p_categoria text, p_titulo text, p_cuerpo text, p_enlace text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notificaciones (usuario_id, categoria, titulo, cuerpo, enlace)
  select p_usuario, p_categoria, left(p_titulo, 140), left(p_cuerpo, 280), p_enlace
  where p_usuario is not null;
$$;
revoke execute on function public.notificar_en(uuid, text, text, text, text) from public, anon, authenticated;

-- Todos los días a las 4:00 (hora argentina = 7:00 UTC) se borran los de más de 7 días.
create function public.borrar_avisos_viejos()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.notificaciones where creada_en < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.borrar_avisos_viejos() from public, anon, authenticated;
select cron.schedule('borrar-avisos-viejos', '0 7 * * *', $$select public.borrar_avisos_viejos()$$);
select public.borrar_avisos_viejos();

-- ---------------------------------------------------------------------
-- 2. Ofertas nuevas: aviso a quien tiene el producto o el comercio en favoritos
-- ---------------------------------------------------------------------
create function public.avisar_oferta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.comercios;
  v_producto text;
  u uuid;
begin
  select * into c from public.comercios where id = new.comercio_id;
  if not found or not c.aprobado then
    return new;
  end if;
  if new.producto_id is not null then
    select nombre into v_producto from public.productos where id = new.producto_id;
    for u in
      select distinct f.usuario_id from public.favoritos f
      where f.producto_id = new.producto_id and f.usuario_id <> c.dueno_id
    loop
      perform public.notificar_en(u, 'ofertas', v_producto || ' está en oferta',
        'En ' || c.nombre || ' a $ ' || replace(to_char(round(new.precio_oferta), 'FM999,999,990'), ',', '.') || ' hasta el ' || to_char(new.hasta, 'DD/MM') || '.',
        '/producto/' || new.producto_id);
    end loop;
  end if;
  -- Quien sigue al comercio (y no recibió ya el aviso del producto).
  for u in
    select distinct f.usuario_id from public.favoritos f
    where f.comercio_id = new.comercio_id and f.usuario_id <> c.dueno_id
      and not exists (select 1 from public.favoritos g where g.usuario_id = f.usuario_id and g.producto_id is not distinct from new.producto_id and new.producto_id is not null)
  loop
    perform public.notificar_en(u, 'favoritos', 'Nueva oferta en ' || c.nombre,
      coalesce(v_producto, new.titulo) || ' · hasta el ' || to_char(new.hasta, 'DD/MM') || '.',
      case when new.producto_id is not null then '/producto/' || new.producto_id else '/oferta/' || new.id end);
  end loop;
  return new;
end;
$$;
revoke execute on function public.avisar_oferta() from public, anon, authenticated;

create trigger avisar_oferta_nueva
  after insert on public.ofertas
  for each row execute function public.avisar_oferta();

-- ---------------------------------------------------------------------
-- 3 y 4. Carrito (pedido) y "Retiro ya"
-- ---------------------------------------------------------------------
create sequence public.pedidos_seq;

alter table public.reservas
  add column pedido bigint,
  add column retiro_ya boolean not null default false,
  add column recordada_en timestamptz;
create index on public.reservas (pedido) where pedido is not null;

grant insert (retiro_ya) on public.reservas to authenticated;

-- Franja de atención en curso del comercio (abre, cierra), o nada si está cerrado.
create function public.franja_abierta(p_comercio bigint, p_ahora timestamptz)
returns table (abre time, cierra time)
language sql stable security definer set search_path = ''
as $$
  select h.abre, h.cierra
  from public.horarios h
  where h.comercio_id = p_comercio
    and h.dia = extract(dow from (p_ahora at time zone 'America/Argentina/Buenos_Aires'))::int
    and h.abre <= (p_ahora at time zone 'America/Argentina/Buenos_Aires')::time
    and h.cierra > (p_ahora at time zone 'America/Argentina/Buenos_Aires')::time
    and not exists (
      select 1 from public.dias_cerrados(
        p_comercio,
        (p_ahora at time zone 'America/Argentina/Buenos_Aires')::date,
        (p_ahora at time zone 'America/Argentina/Buenos_Aires')::date
      )
    )
  order by h.cierra desc
  limit 1;
$$;
revoke execute on function public.franja_abierta(bigint, timestamptz) from public, anon, authenticated;

-- Corre después de preparar_reserva (que la deja "pendiente") y antes de
-- zz_fin_de_franja (que lee el horario de retiro).
create function public.preparar_retiro_ya()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p public.productos;
  f record;
  ahora_ar timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_hasta time;
begin
  -- Un pedido es de un solo comprador y un solo comercio.
  if new.pedido is not null and exists (
    select 1 from public.reservas x
    where x.pedido = new.pedido and (x.comprador_id <> new.comprador_id or x.comercio_id <> new.comercio_id)
  ) then
    raise exception 'Un pedido solo puede tener productos del mismo comercio';
  end if;

  if not new.retiro_ya then
    return new;
  end if;
  select * into p from public.productos where id = new.producto_id;
  if p.modo <> 'exacto' or p.actualizado_en < now() - interval '7 days' then
    raise exception 'Retiro ya: % no tiene el stock confirmado. Reservalo con un horario y el comercio te confirma.', p.nombre;
  end if;
  if coalesce(p.stock, 0) < new.cantidad then
    raise exception 'Retiro ya: no queda stock suficiente de % (hay %)', p.nombre, coalesce(p.stock, 0);
  end if;
  select * into f from public.franja_abierta(new.comercio_id, now());
  if not found or f.cierra is null then
    raise exception 'Retiro ya: el comercio está cerrado ahora. Elegí un horario de retiro.';
  end if;
  if f.cierra - ahora_ar::time < interval '15 minutes' then
    raise exception 'Retiro ya: el comercio cierra en menos de 15 minutos. Elegí otro horario.';
  end if;
  v_hasta := least(f.cierra, (ahora_ar + interval '2 hours')::time);
  if v_hasta < ahora_ar::time then
    v_hasta := f.cierra; -- pasa la medianoche: hasta el cierre
  end if;
  perform public.descontar_stock(p.id, new.cantidad);
  new.estado := 'aceptada';
  new.retiro := 'Hoy, ' || to_char(ahora_ar, 'FMHH24:MI') || ' a ' || to_char(v_hasta, 'FMHH24:MI');
  return new;
end;
$$;
revoke execute on function public.preparar_retiro_ya() from public, anon, authenticated;

create trigger zy_retiro_ya
  before insert on public.reservas
  for each row execute function public.preparar_retiro_ya();

-- Reserva todo el carrito de un comercio en un solo pedido.
-- p_items: [{"producto": 12, "cantidad": 2}, …]. Devuelve el número de pedido.
create function public.reservar_pedido(p_items jsonb, p_retiro text, p_ya boolean default false)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_pedido bigint := nextval('public.pedidos_seq');
begin
  if auth.uid() is null then
    raise exception 'Ingresá a tu cuenta para reservar';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Un pedido puede tener hasta 30 productos';
  end if;
  if not coalesce(p_ya, false) and coalesce(trim(p_retiro), '') = '' then
    raise exception 'Elegí un horario de retiro';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e where coalesce((e ->> 'cantidad')::int, 0) not between 1 and 20) then
    raise exception 'Elegí una cantidad entre 1 y 20 de cada producto';
  end if;
  if (select count(distinct comercio_id) from public.productos
      where id in (select (e ->> 'producto')::bigint from jsonb_array_elements(p_items) e)) <> 1 then
    raise exception 'Un pedido solo puede tener productos del mismo comercio';
  end if;
  -- Todo en una sola instrucción: los avisos (que corren al final) ven el pedido completo.
  insert into public.reservas (producto_id, cantidad, retiro, medio_pago, pedido, retiro_ya)
  select (e ->> 'producto')::bigint, (e ->> 'cantidad')::int, coalesce(nullif(left(trim(p_retiro), 80), ''), 'Ya'), 'local', v_pedido, coalesce(p_ya, false)
  from jsonb_array_elements(p_items) with ordinality as t(e, i)
  order by i;
  return v_pedido;
end;
$$;
revoke execute on function public.reservar_pedido(jsonb, text, boolean) from public, anon;
grant execute on function public.reservar_pedido(jsonb, text, boolean) to authenticated;

-- Un solo código por pedido: lo que se acepta después usa el mismo.
create or replace function public.crear_codigo_retiro()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_codigo text;
begin
  if new.estado = 'aceptada' then
    if new.pedido is not null then
      select rc.codigo into v_codigo
      from public.reserva_codigos rc join public.reservas x on x.id = rc.reserva_id
      where x.pedido = new.pedido and x.id <> new.id
      limit 1;
    end if;
    insert into public.reserva_codigos (reserva_id, codigo)
    values (new.id, coalesce(v_codigo, lpad(floor(random() * 10000)::int::text, 4, '0')))
    on conflict (reserva_id) do nothing;
  end if;
  return new;
end;
$$;

-- Con el código se retira todo lo aceptado del pedido.
create or replace function public.confirmar_retiro(p_reserva bigint, p_codigo text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  c public.reserva_codigos;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    return 'Reserva no encontrada';
  end if;
  if r.estado <> 'aceptada' then
    return 'Solo se confirman las reservas aceptadas';
  end if;
  select * into c from public.reserva_codigos where reserva_id = r.id for update;
  if not found then
    return 'Esta reserva no tiene código. Usá "Entregar sin código".';
  end if;
  if c.bloqueado_hasta > now() then
    return 'Demasiados intentos. Probá de nuevo en ' || ceil(extract(epoch from c.bloqueado_hasta - now()) / 60) || ' minutos.';
  end if;
  if regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g') <> c.codigo then
    update public.reserva_codigos
    set intentos = case when c.intentos + 1 >= 5 then 0 else c.intentos + 1 end,
        bloqueado_hasta = case when c.intentos + 1 >= 5 then now() + interval '15 minutes' else null end
    where reserva_id = r.id;
    return case when c.intentos + 1 >= 5
      then 'Código incorrecto. Por seguridad se bloqueó 15 minutos.'
      else 'El código no coincide. Pedile al cliente el código de 4 números de "Mis reservas".' end;
  end if;
  update public.reservas set estado = 'retirada', actualizada_en = now()
  where estado = 'aceptada' and (id = r.id or (r.pedido is not null and pedido = r.pedido));
  return null;
end;
$$;

create or replace function public.entregar_sin_codigo(p_reserva bigint, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_comercio text;
  v_que text;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'aceptada' then
    raise exception 'Solo se entregan las reservas aceptadas';
  end if;
  if r.medio_pago <> 'local' then
    raise exception 'Con pago online hace falta el código del cliente';
  end if;
  if length(v_motivo) < 5 then
    raise exception 'Contanos por qué la entregás sin código';
  end if;
  update public.reservas
  set estado = 'retirada', retiro_sin_codigo = left(v_motivo, 300), actualizada_en = now()
  where estado = 'aceptada' and (id = r.id or (r.pedido is not null and pedido = r.pedido));
  select nombre into v_comercio from public.comercios where id = r.comercio_id;
  v_que := case when r.pedido is not null then 'tu pedido' else r.producto_nombre end;
  perform public.notificar(
    r.comprador_id,
    'Tu reserva figura como retirada sin código',
    v_comercio || ' entregó ' || v_que || ' sin tu código. Si no fuiste vos, tocá "No lo retiré" dentro de las 48 horas.',
    '/reservas#reserva-' || r.id
  );
end;
$$;

-- Avisos de reservas: un solo aviso por pedido y texto propio para "Retiro ya".
create or replace function public.avisar_reserva()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.comercios;
  cliente text;
  pedido text := new.producto_nombre || ' × ' || new.cantidad;
  v_n integer;
  al_comercio constant text := '/comerciante?seccion=reservas#reservas';
  al_cliente constant text := '/reservas';
begin
  select * into c from public.comercios where id = new.comercio_id;
  cliente := coalesce(public.nombre_corto(new.comprador_id), 'El cliente');

  if tg_op = 'INSERT' then
    if new.pedido is not null then
      -- Se avisa una vez, con la primera fila del pedido.
      if exists (select 1 from public.reservas x where x.pedido = new.pedido and x.id < new.id) then
        return new;
      end if;
      select count(*) into v_n from public.reservas x where x.pedido = new.pedido;
      if v_n > 1 then
        pedido := 'pedido de ' || v_n || ' productos';
      end if;
    end if;
    if new.retiro_ya then
      perform public.notificar(c.dueno_id, '⚡ Retiro ya: ' || pedido, cliente || ' va para el local ahora (' || new.retiro || '). Ya quedó aceptada y el stock descontado.', al_comercio);
    else
      perform public.notificar(c.dueno_id, 'Nueva reserva: ' || pedido, cliente || ' retira ' || new.retiro || '. Respondé dentro de las 2 horas.', al_comercio);
    end if;
    return new;
  end if;

  if new.estado is not distinct from old.estado then
    return new;
  end if;

  case new.estado
    when 'aceptada' then
      if old.estado = 'alternativa' then
        perform public.notificar(c.dueno_id, cliente || ' eligió una alternativa', 'Reservó ' || pedido || '. Retira ' || new.retiro || '.', al_comercio);
      else
        perform public.notificar(new.comprador_id, c.nombre || ' aceptó tu reserva', pedido || '. Retirá ' || new.retiro || '.', al_cliente);
      end if;
    when 'rechazada' then
      perform public.notificar(new.comprador_id, c.nombre || ' no puede tomar tu reserva', pedido || '. Probá en otro comercio de la zona.', al_cliente);
    when 'alternativa' then
      perform public.notificar(new.comprador_id, c.nombre || ' te ofrece otras opciones', 'No tiene ' || new.producto_nombre || '. Elegí una alternativa o cancelá sin costo.', al_cliente);
    when 'retirada' then
      -- Del pedido, se pide una sola reseña.
      if new.pedido is null or not exists (
        select 1 from public.reservas x where x.pedido = new.pedido and x.id < new.id and x.estado = 'retirada'
      ) then
        perform public.notificar(new.comprador_id, '¿Cómo te fue en ' || c.nombre || '?', 'Dejá tu reseña de ' || new.producto_nombre || '.', al_cliente);
      end if;
    when 'cancelada' then
      perform public.notificar(c.dueno_id, cliente || ' canceló la reserva', pedido || '.', al_comercio);
    when 'vencida' then
      perform public.notificar(new.comprador_id, 'Tu reserva venció', c.nombre || ' no respondió a tiempo: ' || pedido || '.', al_cliente);
    when 'no_retirada' then
      perform public.notificar(new.comprador_id, 'Tu reserva se cerró sin retirar', pedido || ' en ' || c.nombre || '.', al_cliente);
    else
      null;
  end case;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. "No vino": el comercio cierra la reserva pasado el horario de retiro
-- ---------------------------------------------------------------------
create function public.marcar_no_vino(p_reserva bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  fila public.reservas;
  c public.comercios;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'aceptada' then
    raise exception 'Solo se puede marcar en una reserva aceptada';
  end if;
  if r.retiro_hasta is not null and r.retiro_hasta > now() then
    raise exception 'Todavía está dentro de su horario de retiro (hasta las %)',
      to_char(r.retiro_hasta at time zone 'America/Argentina/Buenos_Aires', 'FMHH24:MI');
  end if;
  -- Todo lo aceptado del pedido: es el mismo viaje.
  for fila in
    select * from public.reservas x
    where x.estado = 'aceptada' and (x.id = r.id or (r.pedido is not null and x.pedido = r.pedido))
    for update
  loop
    perform public.devolver_stock(fila.producto_id, fila.cantidad);
    update public.reservas
    set estado = 'no_retirada', motivo_comercio = 'El cliente no vino a retirar en su horario.', actualizada_en = now()
    where id = fila.id;
  end loop;
end;
$$;
revoke execute on function public.marcar_no_vino(bigint) from public, anon;
grant execute on function public.marcar_no_vino(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Vencimientos (cada 10 minutos) + recordatorio 30 minutos antes
-- ---------------------------------------------------------------------
create or replace function public.vencer_reservas(p_horas integer default 2)
returns integer
language plpgsql security definer set search_path = ''
as $function$
declare
  n integer;
  fila public.reservas;
  v_hasta timestamptz;
  c public.comercios;
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

  -- Recordatorio: quedan 30 minutos o menos del horario de retiro (uno por
  -- pedido; no a las que se hicieron hace menos de 45 minutos).
  for fila in
    select * from public.reservas x
    where x.estado = 'aceptada' and x.recordada_en is null
      and x.retiro_hasta > now() and x.retiro_hasta <= now() + interval '30 minutes'
      and x.creada_en < x.retiro_hasta - interval '45 minutes'
    for update
  loop
    update public.reservas set recordada_en = now()
    where id = fila.id or (fila.pedido is not null and pedido = fila.pedido and estado = 'aceptada');
    continue when fila.pedido is not null and exists (
      select 1 from public.reservas x where x.pedido = fila.pedido and x.id < fila.id and x.estado = 'aceptada'
    );
    select * into c from public.comercios where id = fila.comercio_id;
    perform public.notificar(
      fila.comprador_id,
      '⏰ Te quedan menos de 30 minutos para retirar',
      case when fila.pedido is not null then 'Tu pedido' else fila.producto_nombre end || ' en ' || c.nombre || ', hasta las '
        || to_char(fila.retiro_hasta at time zone 'America/Argentina/Buenos_Aires', 'FMHH24:MI') || '. Si no llegás, cambiá el horario.',
      '/reservas#reserva-' || fila.id
    );
  end loop;

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
