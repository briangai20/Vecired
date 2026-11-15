-- =====================================================================
-- VeciRed · Productos de una oferta libre y motivo de baja del comercio
--
-- 1. Una oferta libre ("2x1 en tornillos") puede tener uno o varios
--    productos: la página de la oferta los muestra para reservar.
-- 2. Al dar de baja el comercio se guarda el motivo: una opción de la
--    lista o, si elige "Otro", un texto de 30 letras o más.
-- No se borra ni se cambia nada de lo que ya existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Productos de una oferta libre
-- ---------------------------------------------------------------------
create table public.oferta_productos (
  oferta_id bigint not null references public.ofertas (id) on delete cascade,
  producto_id bigint not null references public.productos (id) on delete cascade,
  primary key (oferta_id, producto_id)
);
create index on public.oferta_productos (producto_id);

-- El producto tiene que ser del mismo comercio que la oferta, y como mucho 20.
create function public.preparar_oferta_producto()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_comercio bigint;
begin
  select comercio_id into v_comercio from public.ofertas where id = new.oferta_id;
  if not found or not public.es_dueno(v_comercio) then
    raise exception 'Oferta no encontrada';
  end if;
  if not exists (select 1 from public.productos where id = new.producto_id and comercio_id = v_comercio) then
    raise exception 'Ese producto no es de tu comercio';
  end if;
  if (select count(*) from public.oferta_productos where oferta_id = new.oferta_id) >= 20 then
    raise exception 'Una oferta puede tener hasta 20 productos';
  end if;
  return new;
end;
$$;
revoke execute on function public.preparar_oferta_producto() from public, anon, authenticated;

create trigger al_agregar_producto_a_oferta
  before insert on public.oferta_productos
  for each row execute function public.preparar_oferta_producto();

alter table public.oferta_productos enable row level security;

-- Se ven si se ve la oferta (las reglas de ofertas deciden).
create policy "oferta_productos: ver" on public.oferta_productos
  for select to anon, authenticated
  using (exists (select 1 from public.ofertas o where o.id = oferta_id));
create policy "oferta_productos: cargar" on public.oferta_productos
  for insert to authenticated
  with check (exists (select 1 from public.ofertas o where o.id = oferta_id and public.es_dueno(o.comercio_id)));
create policy "oferta_productos: sacar" on public.oferta_productos
  for delete to authenticated
  using (exists (select 1 from public.ofertas o where o.id = oferta_id and public.es_dueno(o.comercio_id)));

revoke all on public.oferta_productos from anon, authenticated;
grant select on public.oferta_productos to anon, authenticated;
grant insert, delete on public.oferta_productos to authenticated;

-- ---------------------------------------------------------------------
-- 2. Motivo de baja
-- ---------------------------------------------------------------------
alter table public.comercios add column motivo_baja text;

-- Reemplaza la versión sin motivo (20_baja_ofertas_y_atributos.sql).
drop function public.dar_de_baja_mi_comercio();

create function public.dar_de_baja_mi_comercio(p_motivo text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  c public.comercios;
  v_canceladas integer;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if v_motivo not in ('No me trajo ventas', 'Cerré el local', 'No tengo tiempo', 'Es difícil de usar') and length(v_motivo) < 30 then
    raise exception 'Contanos el motivo de la baja (al menos 30 letras)';
  end if;
  select * into c from public.comercios where dueno_id = yo and dado_de_baja_en is null order by id limit 1;
  if not found then
    raise exception 'No tenés un comercio activo';
  end if;
  delete from public.reserva_alternativas a using public.reservas r
  where a.reserva_id = r.id and r.comercio_id = c.id and r.estado in ('pendiente', 'alternativa', 'aceptada');
  update public.reservas set estado = 'rechazada', actualizada_en = now()
  where comercio_id = c.id and estado in ('pendiente', 'alternativa', 'aceptada');
  get diagnostics v_canceladas = row_count;
  update public.comercios
  set aprobado = false,
      dado_de_baja_en = now(),
      motivo_baja = left(v_motivo, 2000),
      revisado_en = case when c.aprobado then coalesce(revisado_en, now()) else revisado_en end
  where id = c.id;
  update public.perfiles set rol = 'comprador' where id = yo;
  return v_canceladas;
end;
$$;
revoke execute on function public.dar_de_baja_mi_comercio(text) from public, anon;
grant execute on function public.dar_de_baja_mi_comercio(text) to authenticated;
