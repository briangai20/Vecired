-- La búsqueda de productos la hace la base de datos (antes se traían hasta
-- 2.000 productos y se filtraban en el servidor de la web).
--
-- 1. texto_producto(): todo lo buscable de un producto, en minúsculas, sin
--    acentos y sin signos (igual que normalizar() de web/src/lib/busqueda.ts).
-- 2. Índice de trigramas sobre ese texto: hace rápidos el "contiene" (LIKE
--    '%palabra%') y el "se parece" (word_similarity) aunque haya muchos productos.
-- 3. buscar_productos(): devuelve solo los productos que coinciden.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent no se puede usar en un índice tal cual: con el diccionario fijo, sí.
create or replace function public.texto_producto(
  p_nombre text, p_marca text, p_medida text, p_material text, p_descripcion text, p_grupo text, p_codigo text
)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select trim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary,
      concat_ws(' ', p_nombre, p_marca, p_medida, p_material, p_descripcion, p_grupo, p_codigo))),
    '[^a-z0-9]+', ' ', 'g'));
$$;

create index if not exists productos_texto_trgm on public.productos
  using gin (public.texto_producto(nombre, marca, medida, material, descripcion, grupo, codigo) extensions.gin_trgm_ops);

-- p_palabras: las palabras buscadas, ya normalizadas por la web.
-- p_aprox = false: cada palabra tiene que estar en el producto ("collar rojo"
--   encuentra "Collar de cuero rojo").
-- p_aprox = true: alguna palabra se parece (errores de tipeo); van primero los
--   que más se parecen. La web después afina con su corrector.
-- Corre con los permisos de quien busca: solo ve productos activos de comercios aprobados.
create or replace function public.buscar_productos(
  p_comercios bigint[], p_palabras text[], p_aprox boolean default false, p_limite integer default 500
)
returns setof public.productos
language sql stable set search_path = ''
as $$
  select p.*
  from public.productos p
  cross join lateral (
    select public.texto_producto(p.nombre, p.marca, p.medida, p.material, p.descripcion, p.grupo, p.codigo) as t
  ) x
  where p.comercio_id = any (p_comercios)
    and p.activo
    and (
      (not p_aprox and not exists (select 1 from unnest(p_palabras) w where x.t not like '%' || w || '%'))
      or (p_aprox and exists (select 1 from unnest(p_palabras) w where extensions.word_similarity(w, x.t) >= 0.3))
    )
  order by
    case when p_aprox then (select sum(extensions.word_similarity(w, x.t)) from unnest(p_palabras) w) end desc nulls last,
    p.id desc
  limit least(greatest(coalesce(p_limite, 500), 1), 1000);
$$;
revoke execute on function public.buscar_productos(bigint[], text[], boolean, integer) from public;
grant execute on function public.buscar_productos(bigint[], text[], boolean, integer) to anon, authenticated;
