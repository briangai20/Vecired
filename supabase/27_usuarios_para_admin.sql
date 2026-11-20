-- =====================================================================
-- VeciRed · Usuarios registrados en el panel de administración
--
-- Lista de todas las cuentas (compradores y comerciantes) con los datos del
-- perfil y su estado: mail confirmado, último ingreso y, si vende, en qué
-- estado está su comercio. Solo la pueden pedir los administradores.
-- No cambia ni borra nada.
-- =====================================================================

create function public.usuarios_para_admin()
returns table (
  id uuid,
  email text,
  nombre text,
  rol text,
  telefono text,
  foto_url text,
  avisos_mail text,
  creado_en timestamptz,
  mail_confirmado boolean,
  ultimo_ingreso timestamptz,
  comercio_id bigint,
  comercio_nombre text,
  comercio_estado text,
  reservas bigint,
  retiradas bigint,
  es_admin boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo para administradores';
  end if;
  return query
    select
      u.id,
      u.email::text,
      p.nombre,
      p.rol::text,
      p.telefono,
      p.foto_url,
      p.avisos_mail::text,
      coalesce(p.creado_en, u.created_at),
      u.email_confirmed_at is not null,
      u.last_sign_in_at,
      c.id,
      c.nombre,
      case
        when c.id is null then null
        when c.dado_de_baja_en is not null then 'dado_de_baja'
        when c.aprobado then 'publicado'
        when c.motivo_rechazo is not null then 'rechazado'
        else 'en_revision'
      end,
      (select count(*) from public.reservas r where r.comprador_id = u.id),
      (select count(*) from public.reservas r where r.comprador_id = u.id and r.estado = 'retirada'),
      exists (select 1 from public.administradores a where a.usuario_id = u.id)
    from auth.users u
    join public.perfiles p on p.id = u.id
    left join lateral (
      select x.* from public.comercios x where x.dueno_id = u.id order by x.id limit 1
    ) c on true
    order by coalesce(p.creado_en, u.created_at) desc;
end;
$$;
revoke execute on function public.usuarios_para_admin() from public, anon;
grant execute on function public.usuarios_para_admin() to authenticated;
