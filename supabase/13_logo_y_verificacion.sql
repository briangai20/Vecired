-- =====================================================================
-- VeciRed · Logo de los comercios y datos para verificarlos (2026-11-04)
-- - comercios.logo_url: logo que se ve en el inicio, el mapa y la página
--   del comercio. Se sube al bucket "productos" en <id del comercio>/logo-….
-- - verificaciones_comercio: CUIT, red social o web y foto del frente del
--   local. Solo los ven el dueño y los administradores (no son públicos).
-- - revisar_comercio guarda qué controles hizo el administrador al aprobar.
-- =====================================================================

alter table public.comercios
  add column logo_url text check (length(logo_url) <= 500),
  add column controles text[];
-- El dueño puede cambiar su logo; "controles" solo lo escribe revisar_comercio.
grant insert (logo_url), update (logo_url) on public.comercios to authenticated;

create table public.verificaciones_comercio (
  comercio_id bigint primary key references public.comercios (id) on delete cascade,
  cuit text check (cuit ~ '^[0-9]{11}$'),
  redes text check (length(redes) <= 200),
  foto_local_url text check (length(foto_local_url) <= 500),
  actualizado_en timestamptz not null default now()
);
alter table public.verificaciones_comercio enable row level security;

create policy "verificaciones: ver la propia" on public.verificaciones_comercio
  for select to authenticated using (public.es_dueno(comercio_id) or public.es_admin());
create policy "verificaciones: alta de la propia" on public.verificaciones_comercio
  for insert to authenticated with check (public.es_dueno(comercio_id));
create policy "verificaciones: editar la propia" on public.verificaciones_comercio
  for update to authenticated using (public.es_dueno(comercio_id)) with check (public.es_dueno(comercio_id));

-- El inicio y el mapa necesitan el logo: se agrega a la búsqueda por cercanía.
drop function public.comercios_cercanos(double precision, double precision, double precision, text);
create function public.comercios_cercanos(
  p_lat double precision,
  p_lng double precision,
  p_radio_km double precision default 5,
  p_busqueda text default null
)
returns table (
  id bigint,
  nombre text,
  rubro text,
  direccion text,
  zona_id text,
  lat double precision,
  lng double precision,
  whatsapp text,
  logo_url text,
  distancia_km double precision
)
language sql stable set search_path = ''
as $$
  select t.*
  from (
    select c.id, c.nombre, c.rubro, c.direccion, c.zona_id, c.lat, c.lng, c.whatsapp, c.logo_url,
      6371 * 2 * asin(least(1, sqrt(
        power(sin(radians(c.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(c.lat)) * power(sin(radians(c.lng - p_lng) / 2), 2)
      ))) as distancia_km
    from public.comercios c
    where c.aprobado
      and c.lat is not null and c.lng is not null
      and (
        coalesce(trim(p_busqueda), '') = ''
        or extensions.unaccent(c.nombre || ' ' || c.rubro) ilike '%' || extensions.unaccent(trim(p_busqueda)) || '%'
        or exists (
          select 1 from public.productos p
          where p.comercio_id = c.id and p.activo
            and extensions.unaccent(p.nombre || ' ' || coalesce(p.marca, '')) ilike '%' || extensions.unaccent(trim(p_busqueda)) || '%'
        )
      )
  ) t
  where t.distancia_km <= p_radio_km
  order by t.distancia_km;
$$;
grant execute on function public.comercios_cercanos(double precision, double precision, double precision, text) to anon, authenticated;

-- La lista del panel /admin, ahora con logo, datos de verificación y controles hechos.
drop function public.comercios_para_revisar();
create function public.comercios_para_revisar()
returns table (
  id bigint,
  nombre text,
  rubro text,
  direccion text,
  zona text,
  lat double precision,
  lng double precision,
  whatsapp text,
  aprobado boolean,
  motivo_rechazo text,
  creado_en timestamptz,
  revisado_en timestamptz,
  dueno_nombre text,
  dueno_email text,
  dueno_telefono text,
  productos bigint,
  con_horario boolean,
  logo_url text,
  cuit text,
  redes text,
  foto_local_url text,
  controles text[],
  mail_confirmado boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo para administradores';
  end if;
  return query
    select c.id, c.nombre, c.rubro, c.direccion, z.nombre, c.lat, c.lng, c.whatsapp, c.aprobado, c.motivo_rechazo,
      c.creado_en, c.revisado_en, p.nombre, u.email::text, p.telefono,
      (select count(*) from public.productos pr where pr.comercio_id = c.id),
      exists (select 1 from public.horarios h where h.comercio_id = c.id),
      c.logo_url, v.cuit, v.redes, v.foto_local_url, c.controles, u.email_confirmed_at is not null
    from public.comercios c
    join public.zonas z on z.id = c.zona_id
    join public.perfiles p on p.id = c.dueno_id
    join auth.users u on u.id = c.dueno_id
    left join public.verificaciones_comercio v on v.comercio_id = c.id
    order by c.creado_en desc;
end;
$$;

-- Aprobar guarda la lista de controles que hizo el administrador.
drop function public.revisar_comercio(bigint, boolean, text);
create function public.revisar_comercio(p_comercio bigint, p_aprobar boolean, p_motivo text default null, p_controles text[] default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo para administradores';
  end if;
  if not p_aprobar and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribí el motivo para que el comerciante sepa qué corregir';
  end if;
  update public.comercios
  set aprobado = p_aprobar,
      motivo_rechazo = case when p_aprobar then null else trim(p_motivo) end,
      controles = case when p_aprobar then p_controles else controles end,
      revisado_en = now()
  where id = p_comercio;
  if not found then
    raise exception 'El comercio no existe';
  end if;
end;
$$;

revoke execute on function public.comercios_para_revisar() from public, anon;
revoke execute on function public.revisar_comercio(bigint, boolean, text, text[]) from public, anon;
grant execute on function public.comercios_para_revisar() to authenticated;
grant execute on function public.revisar_comercio(bigint, boolean, text, text[]) to authenticated;
