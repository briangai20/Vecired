-- =====================================================================
-- VeciRed · Dar de baja el comercio, ofertas, medida y material
--
-- 1. El comerciante da de baja su comercio sin borrar la cuenta: se oculta
--    (con sus productos) pero queda guardado para reactivarlo. Las reservas
--    en curso se cancelan solas y a cada cliente le llega el aviso. La
--    cuenta pasa a usarse como comprador.
-- 2. Ofertas: el comercio carga un producto rebajado (precio de oferta) o
--    un aviso libre (texto e imagen), con fecha de fin.
-- 3. Productos con Medida y Material, para filtrar.
-- No se borra ni se cambia nada de lo que ya existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Baja y reactivación del comercio
-- ---------------------------------------------------------------------
alter table public.comercios add column dado_de_baja_en timestamptz;

create function public.dar_de_baja_mi_comercio()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  c public.comercios;
  v_canceladas integer;
begin
  select * into c from public.comercios where dueno_id = yo and dado_de_baja_en is null order by id limit 1;
  if not found then
    raise exception 'No tenés un comercio activo';
  end if;
  -- Reservas en curso: se cancelan (le llega "no puede tomar tu reserva" al cliente).
  delete from public.reserva_alternativas a using public.reservas r
  where a.reserva_id = r.id and r.comercio_id = c.id and r.estado in ('pendiente', 'alternativa', 'aceptada');
  update public.reservas set estado = 'rechazada', actualizada_en = now()
  where comercio_id = c.id and estado in ('pendiente', 'alternativa', 'aceptada');
  get diagnostics v_canceladas = row_count;
  -- Se oculta: todo lo público muestra solo comercios aprobados.
  -- Si estaba publicado, queda registrado como revisado para poder reactivarlo.
  update public.comercios
  set aprobado = false,
      dado_de_baja_en = now(),
      revisado_en = case when c.aprobado then coalesce(revisado_en, now()) else revisado_en end
  where id = c.id;
  update public.perfiles set rol = 'comprador' where id = yo;
  return v_canceladas;
end;
$$;
revoke execute on function public.dar_de_baja_mi_comercio() from public, anon;
grant execute on function public.dar_de_baja_mi_comercio() to authenticated;

-- Vuelve a publicarlo tal como estaba (si ya había sido aprobado antes).
create function public.reactivar_mi_comercio()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  c public.comercios;
begin
  select * into c from public.comercios where dueno_id = yo and dado_de_baja_en is not null order by dado_de_baja_en desc limit 1;
  if not found then
    raise exception 'No tenés un comercio dado de baja';
  end if;
  update public.comercios
  set dado_de_baja_en = null, aprobado = (revisado_en is not null and motivo_rechazo is null)
  where id = c.id;
  update public.perfiles set rol = 'comerciante' where id = yo;
end;
$$;
revoke execute on function public.reactivar_mi_comercio() from public, anon;
grant execute on function public.reactivar_mi_comercio() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Ofertas
-- ---------------------------------------------------------------------
create table public.ofertas (
  id bigint generated always as identity primary key,
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  -- Producto rebajado…
  producto_id bigint references public.productos (id) on delete cascade,
  precio_oferta numeric(12, 2) check (precio_oferta > 0),
  -- …o aviso libre.
  titulo text check (length(trim(titulo)) between 3 and 80),
  imagen_url text check (length(imagen_url) <= 500),
  hasta date not null,
  creada_en timestamptz not null default now(),
  check (
    (producto_id is not null and precio_oferta is not null)
    or (producto_id is null and titulo is not null)
  )
);
create index on public.ofertas (comercio_id);
create index on public.ofertas (hasta);

-- El producto tiene que ser del mismo comercio, la oferta más barata que el
-- precio normal y la fecha de fin entre hoy y 60 días.
create function public.preparar_oferta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_precio numeric;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not public.es_dueno(new.comercio_id) then
    raise exception 'Comercio no encontrado';
  end if;
  if new.producto_id is not null then
    select precio into v_precio from public.productos where id = new.producto_id and comercio_id = new.comercio_id;
    if not found then
      raise exception 'Ese producto no es de tu comercio';
    end if;
    if v_precio is not null and new.precio_oferta >= v_precio then
      raise exception 'El precio de oferta tiene que ser menor al precio normal';
    end if;
  end if;
  if new.hasta < v_hoy or new.hasta > v_hoy + 60 then
    raise exception 'La oferta puede durar hasta 60 días desde hoy';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.ofertas where comercio_id = new.comercio_id and hasta >= v_hoy) >= 10 then
    raise exception 'Podés tener hasta 10 ofertas vigentes a la vez';
  end if;
  new.titulo := nullif(trim(coalesce(new.titulo, '')), '');
  return new;
end;
$$;
revoke execute on function public.preparar_oferta() from public, anon, authenticated;

create trigger al_guardar_oferta
  before insert or update on public.ofertas
  for each row execute function public.preparar_oferta();

alter table public.ofertas enable row level security;

-- Todos ven las vigentes de comercios publicados; el dueño ve todas las suyas.
create policy "ofertas: ver" on public.ofertas
  for select to anon, authenticated
  using (
    public.es_dueno(comercio_id)
    or (
      hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
      and exists (select 1 from public.comercios c where c.id = comercio_id and c.aprobado)
    )
  );
create policy "ofertas: cargar" on public.ofertas
  for insert to authenticated with check (public.es_dueno(comercio_id));
create policy "ofertas: cambiar" on public.ofertas
  for update to authenticated using (public.es_dueno(comercio_id)) with check (public.es_dueno(comercio_id));
create policy "ofertas: borrar" on public.ofertas
  for delete to authenticated using (public.es_dueno(comercio_id));

revoke all on public.ofertas from anon, authenticated;
grant select on public.ofertas to anon, authenticated;
grant insert (comercio_id, producto_id, precio_oferta, titulo, imagen_url, hasta) on public.ofertas to authenticated;
grant update (precio_oferta, titulo, imagen_url, hasta) on public.ofertas to authenticated;
grant delete on public.ofertas to authenticated;

-- ---------------------------------------------------------------------
-- 3. Medida y material de cada producto
-- ---------------------------------------------------------------------
alter table public.productos
  add column medida text check (length(medida) <= 60),
  add column material text check (length(material) <= 60);

-- ---------------------------------------------------------------------
-- 4. Reservar con el precio de oferta
-- ---------------------------------------------------------------------
-- Precio con el que se reserva: el de la oferta vigente más barata, si hay.
create function public.precio_vigente(p_producto bigint)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select min(o.precio_oferta) from public.ofertas o
     where o.producto_id = p_producto
       and o.hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date),
    (select precio from public.productos where id = p_producto)
  );
$$;
grant execute on function public.precio_vigente(bigint) to anon, authenticated;

-- preparar_reserva() y elegir_alternativa() quedan iguales que antes, salvo
-- que el precio_unitario sale de public.precio_vigente(p.id) en vez de p.precio.
-- (Se aplicaron con "create or replace" copiando la versión vigente de cada una.)
