-- =====================================================================
-- VeciRed · Panel de administración (2026-10-27)
-- Quién administra VeciRed y cómo se aprueban o rechazan los comercios
-- desde /admin, sin entrar a Supabase.
-- Para sumar un administrador:
--   insert into public.administradores (usuario_id)
--   select id from auth.users where email = 'mail@ejemplo.com';
-- =====================================================================

create table public.administradores (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table public.administradores enable row level security;
-- Sin reglas: nadie la lee ni la cambia desde la app; solo es_admin().

create function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.administradores where usuario_id = (select auth.uid()));
$$;

-- Estado de la revisión. Sin aprobar y sin motivo = en revisión;
-- sin aprobar y con motivo = rechazado (el comerciante ve el motivo).
alter table public.comercios
  add column motivo_rechazo text check (length(motivo_rechazo) <= 500),
  add column revisado_en timestamptz;

-- Cuando el comerciante corrige su comercio rechazado, vuelve a revisión.
create function public.volver_a_revision()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.motivo_rechazo is not null and new.motivo_rechazo is not distinct from old.motivo_rechazo
     and new.dueno_id = (select auth.uid()) then
    new.motivo_rechazo := null;
  end if;
  return new;
end;
$$;

create trigger comercios_volver_a_revision
  before update on public.comercios
  for each row execute function public.volver_a_revision();

-- Comercios para revisar, con los datos de contacto del dueño.
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
  con_horario boolean
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
      exists (select 1 from public.horarios h where h.comercio_id = c.id)
    from public.comercios c
    join public.zonas z on z.id = c.zona_id
    join public.perfiles p on p.id = c.dueno_id
    join auth.users u on u.id = c.dueno_id
    order by c.creado_en desc;
end;
$$;

-- Aprobar, rechazar o despublicar. Para rechazar o despublicar hace falta un motivo.
create function public.revisar_comercio(p_comercio bigint, p_aprobar boolean, p_motivo text default null)
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
      revisado_en = now()
  where id = p_comercio;
  if not found then
    raise exception 'El comercio no existe';
  end if;
end;
$$;

revoke execute on function public.comercios_para_revisar() from public, anon;
revoke execute on function public.revisar_comercio(bigint, boolean, text) from public, anon;
grant execute on function public.comercios_para_revisar() to authenticated;
grant execute on function public.revisar_comercio(bigint, boolean, text) to authenticated;
