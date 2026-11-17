-- =====================================================================
-- VeciRed · Código de retiro y preferencia de mails
--
-- 1. Cuando una reserva queda aceptada se genera un código de 4 números.
--    Solo lo ve el cliente (en una tabla aparte; el comercio no puede
--    leerlo). Para confirmar el retiro, el comercio carga el código.
--    5 intentos fallidos bloquean 15 minutos, para que no se adivine.
-- 2. Salida "Entregar sin código" (solo con pago en el local), con motivo.
--    Al cliente le llega un aviso y tiene 48 horas para tocar "No lo
--    retiré"; el reclamo le llega al comercio y a los administradores.
-- 3. Preferencia de mails en el perfil: "importantes" o "ninguno".
-- No se borra ni se cambia nada de lo que ya existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Código
-- ---------------------------------------------------------------------
create table public.reserva_codigos (
  reserva_id bigint primary key references public.reservas (id) on delete cascade,
  codigo text not null check (codigo ~ '^[0-9]{4}$'),
  intentos integer not null default 0,
  bloqueado_hasta timestamptz
);

alter table public.reserva_codigos enable row level security;
-- Lo ve solo el cliente de la reserva.
create policy "codigos: ver el de mis reservas" on public.reserva_codigos
  for select to authenticated
  using (exists (select 1 from public.reservas r where r.id = reserva_id and r.comprador_id = (select auth.uid())));
revoke all on public.reserva_codigos from anon, authenticated;
grant select (reserva_id, codigo) on public.reserva_codigos to authenticated;

create function public.crear_codigo_retiro()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.estado = 'aceptada' then
    insert into public.reserva_codigos (reserva_id, codigo)
    values (new.id, lpad(floor(random() * 10000)::int::text, 4, '0'))
    on conflict (reserva_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.crear_codigo_retiro() from public, anon, authenticated;

create trigger codigo_al_aceptar
  after insert or update of estado on public.reservas
  for each row execute function public.crear_codigo_retiro();

-- Reservas que ya estaban aceptadas: también reciben su código.
insert into public.reserva_codigos (reserva_id, codigo)
select id, lpad(floor(random() * 10000)::int::text, 4, '0') from public.reservas where estado = 'aceptada'
on conflict (reserva_id) do nothing;

alter table public.reservas
  add column retiro_sin_codigo text,
  add column reclamo text,
  add column reclamo_en timestamptz;

-- El comercio confirma el retiro con el código. Devuelve null si salió
-- bien, o el motivo si no (no tira error, para que cuente el intento).
create function public.confirmar_retiro(p_reserva bigint, p_codigo text)
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
  update public.reservas set estado = 'retirada', actualizada_en = now() where id = r.id;
  return null;
end;
$$;
revoke execute on function public.confirmar_retiro(bigint, text) from public, anon;
grant execute on function public.confirmar_retiro(bigint, text) to authenticated;

-- Salida: entregar sin código (solo pago en el local), con motivo. El
-- cliente recibe un aviso para reclamar si no fue él.
create function public.entregar_sin_codigo(p_reserva bigint, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_comercio text;
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
  where id = r.id;
  select nombre into v_comercio from public.comercios where id = r.comercio_id;
  perform public.notificar(
    r.comprador_id,
    'Tu reserva figura como retirada sin código',
    v_comercio || ' entregó ' || r.producto_nombre || ' sin tu código. Si no fuiste vos, tocá "No lo retiré" dentro de las 48 horas.',
    '/reservas#reserva-' || r.id
  );
end;
$$;
revoke execute on function public.entregar_sin_codigo(bigint, text) from public, anon;
grant execute on function public.entregar_sin_codigo(bigint, text) to authenticated;

-- "No lo retiré": el cliente reclama una entrega sin código (48 horas).
create function public.reclamar_retiro(p_reserva bigint, p_texto text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reservas;
  c public.comercios;
  a record;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or r.comprador_id is distinct from auth.uid() then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'retirada' or r.retiro_sin_codigo is null then
    raise exception 'Solo se puede reclamar una entrega hecha sin tu código';
  end if;
  if r.reclamo_en is not null then
    raise exception 'Ya hiciste el reclamo de esta reserva';
  end if;
  if r.actualizada_en < now() - interval '48 hours' then
    raise exception 'Pasaron más de 48 horas. Escribinos a contacto para revisarlo.';
  end if;
  update public.reservas set reclamo = left(trim(coalesce(p_texto, '')), 1000), reclamo_en = now() where id = r.id;
  select * into c from public.comercios where id = r.comercio_id;
  perform public.notificar(c.dueno_id, 'Reclamo: el cliente dice que no retiró', r.producto_nombre || ' × ' || r.cantidad || '. Lo vamos a revisar.', '/comerciante?seccion=reservas#reserva-' || r.id);
  for a in select usuario_id from public.administradores loop
    perform public.notificar(a.usuario_id, 'Reclamo de retiro en ' || c.nombre, r.producto_nombre || ': el cliente dice que no lo retiró.', '/admin');
  end loop;
end;
$$;
revoke execute on function public.reclamar_retiro(bigint, text) from public, anon;
grant execute on function public.reclamar_retiro(bigint, text) to authenticated;

-- Marcar retirada sin código ya no se puede (queda solo para la base).
revoke execute on function public.marcar_retirada(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Preferencia de mails
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column avisos_mail text not null default 'importantes' check (avisos_mail in ('importantes', 'ninguno'));
grant update (avisos_mail) on public.perfiles to authenticated;
