-- =====================================================================
-- VeciRed · Respuestas a reseñas, mensajes por reserva y notificaciones
--
-- 1. El comercio puede responder las reseñas (una respuesta por reseña).
-- 2. Comprador y comercio se escriben mensajes dentro de cada reserva.
-- 3. Notificaciones dentro de la página: las crea la base sola cuando pasa
--    algo (reserva nueva, aceptada, mensaje, reseña...). La página las
--    escucha en vivo (Realtime) para mostrar la campanita y hacer sonido.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Respuesta del comercio a una reseña
-- ---------------------------------------------------------------------
alter table public.resenas
  add column respuesta text check (length(respuesta) <= 1000),
  add column respondida_en timestamptz;

-- El dueño del comercio responde, cambia o borra (texto vacío) su respuesta.
create function public.responder_resena(p_resena bigint, p_texto text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_comercio bigint;
  v_texto text := nullif(trim(coalesce(p_texto, '')), '');
begin
  select comercio_id into v_comercio from public.resenas where id = p_resena;
  if not found or not public.es_dueno(v_comercio) then
    raise exception 'Reseña no encontrada';
  end if;
  if length(v_texto) > 1000 then
    raise exception 'La respuesta puede tener hasta 1000 letras';
  end if;
  update public.resenas
  set respuesta = v_texto,
      respondida_en = case when v_texto is null then null else now() end
  where id = p_resena;
end;
$$;
revoke execute on function public.responder_resena(bigint, text) from public, anon;
grant execute on function public.responder_resena(bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Mensajes dentro de una reserva
-- ---------------------------------------------------------------------
create table public.mensajes (
  id bigint generated always as identity primary key,
  reserva_id bigint not null references public.reservas (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  texto text not null check (length(trim(texto)) between 1 and 1000),
  creado_en timestamptz not null default now()
);
create index on public.mensajes (reserva_id, creado_en);

-- Solo escriben el comprador y el dueño del comercio, y solo mientras la
-- reserva está en curso. Después quedan para leer.
create function public.preparar_mensaje()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
begin
  select * into r from public.reservas where id = new.reserva_id;
  if not found or (r.comprador_id is distinct from auth.uid() and not public.es_dueno(r.comercio_id)) then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado not in ('pendiente', 'alternativa', 'aceptada') then
    raise exception 'Esta reserva ya terminó: no se pueden mandar más mensajes';
  end if;
  new.autor_id := auth.uid();
  new.texto := trim(new.texto);
  new.creado_en := now();
  return new;
end;
$$;

create trigger al_crear_mensaje
  before insert on public.mensajes
  for each row execute function public.preparar_mensaje();

alter table public.mensajes enable row level security;

-- Ve los mensajes quien ve la reserva (el comprador y el comercio).
create policy "mensajes: ver si veo la reserva" on public.mensajes
  for select to authenticated
  using (exists (select 1 from public.reservas r where r.id = reserva_id));
create policy "mensajes: escribir en mis reservas" on public.mensajes
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.reservas r where r.id = reserva_id)
  );

revoke insert, update, delete on public.mensajes from anon, authenticated;
grant insert (reserva_id, texto) on public.mensajes to authenticated;

-- ---------------------------------------------------------------------
-- 3. Notificaciones
-- ---------------------------------------------------------------------
create table public.notificaciones (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  titulo text not null,
  cuerpo text,
  enlace text,
  creada_en timestamptz not null default now(),
  leida_en timestamptz
);
create index on public.notificaciones (usuario_id, creada_en desc);
create index on public.notificaciones (usuario_id) where leida_en is null;

alter table public.notificaciones enable row level security;

-- Cada uno ve y marca como leídas solo las suyas. Las crea la base.
create policy "notificaciones: ver las propias" on public.notificaciones
  for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "notificaciones: marcar las propias" on public.notificaciones
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

revoke insert, update, delete on public.notificaciones from anon, authenticated;
grant update (leida_en) on public.notificaciones to authenticated;

-- Uso interno: crea una notificación (los textos se recortan para no
-- mandar mensajes enormes).
create function public.notificar(p_usuario uuid, p_titulo text, p_cuerpo text, p_enlace text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notificaciones (usuario_id, titulo, cuerpo, enlace)
  select p_usuario, left(p_titulo, 140), left(p_cuerpo, 280), p_enlace
  where p_usuario is not null;
$$;
revoke execute on function public.notificar(uuid, text, text, text) from public, anon, authenticated;

-- Nombre corto de una persona ("Laura M.") para los avisos.
create function public.nombre_corto(p_usuario uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce(partes[1], '') = '' then 'El cliente'
    when array_length(partes, 1) > 1 then partes[1] || ' ' || left(partes[2], 1) || '.'
    else partes[1]
  end
  from (select regexp_split_to_array(trim(nombre), '\s+') as partes from public.perfiles where id = p_usuario) x;
$$;
revoke execute on function public.nombre_corto(uuid) from public, anon, authenticated;

-- Reservas: nueva (al comercio) y cada cambio de estado (al que no lo hizo).
create function public.avisar_reserva()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.comercios;
  cliente text;
  pedido text := new.producto_nombre || ' × ' || new.cantidad;
  al_comercio constant text := '/comerciante?seccion=reservas#reservas';
  al_cliente constant text := '/reservas';
begin
  select * into c from public.comercios where id = new.comercio_id;
  cliente := coalesce(public.nombre_corto(new.comprador_id), 'El cliente');

  if tg_op = 'INSERT' then
    perform public.notificar(c.dueno_id, 'Nueva reserva: ' || pedido, cliente || ' retira ' || new.retiro || '. Respondé dentro de las 2 horas.', al_comercio);
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
      perform public.notificar(new.comprador_id, '¿Cómo te fue en ' || c.nombre || '?', 'Dejá tu reseña de ' || new.producto_nombre || '.', al_cliente);
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

create trigger avisar_reserva_nueva
  after insert on public.reservas
  for each row execute function public.avisar_reserva();
create trigger avisar_reserva_estado
  after update of estado on public.reservas
  for each row execute function public.avisar_reserva();

-- Reseñas: nueva (al comercio) y respuesta del comercio (al autor).
create function public.avisar_resena()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.comercios;
begin
  select * into c from public.comercios where id = new.comercio_id;
  if tg_op = 'INSERT' then
    perform public.notificar(
      c.dueno_id,
      'Nueva reseña: ' || repeat('★', new.estrellas) || repeat('☆', 5 - new.estrellas),
      new.autor_nombre || coalesce(': “' || left(new.texto, 120) || '”', ' calificó tu comercio.'),
      '/comerciante?seccion=resenas'
    );
  elsif new.respuesta is not null and new.respuesta is distinct from old.respuesta then
    perform public.notificar(new.autor_id, c.nombre || ' respondió tu reseña', left(new.respuesta, 160), '/comercio/' || c.id || '#resenas');
  end if;
  return new;
end;
$$;

create trigger avisar_resena_nueva
  after insert on public.resenas
  for each row execute function public.avisar_resena();
create trigger avisar_resena_respuesta
  after update of respuesta on public.resenas
  for each row execute function public.avisar_resena();

-- Mensajes: al otro de la conversación.
create function public.avisar_mensaje()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  c public.comercios;
begin
  select * into r from public.reservas where id = new.reserva_id;
  select * into c from public.comercios where id = r.comercio_id;
  if new.autor_id = r.comprador_id then
    perform public.notificar(c.dueno_id, 'Mensaje de ' || coalesce(public.nombre_corto(r.comprador_id), 'el cliente'), left(new.texto, 160), '/comerciante?seccion=reservas#reserva-' || r.id);
  else
    perform public.notificar(r.comprador_id, 'Mensaje de ' || c.nombre, left(new.texto, 160), '/reservas#reserva-' || r.id);
  end if;
  return new;
end;
$$;

create trigger avisar_mensaje_nuevo
  after insert on public.mensajes
  for each row execute function public.avisar_mensaje();

-- Comercio aprobado, rechazado o despublicado (al dueño).
create function public.avisar_revision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.aprobado and not old.aprobado then
    perform public.notificar(new.dueno_id, '¡' || new.nombre || ' ya está publicado!', 'Los vecinos ya pueden ver tu comercio y reservar tus productos.', '/comercio/' || new.id);
  elsif new.motivo_rechazo is not null and new.motivo_rechazo is distinct from old.motivo_rechazo then
    perform public.notificar(
      new.dueno_id,
      case when old.aprobado then 'Despublicamos ' || new.nombre else new.nombre || ' necesita cambios' end,
      new.motivo_rechazo,
      '/comerciante?seccion=configuracion#datos'
    );
  end if;
  return new;
end;
$$;

create trigger avisar_revision_comercio
  after update of aprobado, motivo_rechazo on public.comercios
  for each row execute function public.avisar_revision();

-- Las funciones de los triggers no se llaman a mano.
revoke execute on function public.preparar_mensaje() from public, anon, authenticated;
revoke execute on function public.avisar_reserva() from public, anon, authenticated;
revoke execute on function public.avisar_resena() from public, anon, authenticated;
revoke execute on function public.avisar_mensaje() from public, anon, authenticated;
revoke execute on function public.avisar_revision() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. En vivo: la página escucha estas tablas (respetando las reglas de
--    arriba, cada uno recibe solo lo suyo).
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.notificaciones, public.mensajes;
