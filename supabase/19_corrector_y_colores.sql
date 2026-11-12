-- =====================================================================
-- VeciRed · Corrector del buscador y colores de los avisos
--
-- 1. corregir_busqueda('cillar') → 'collar': compara cada palabra buscada
--    con las palabras que existen en VeciRed (nombres de productos, marcas,
--    comercios y rubros) y, si no existe, la cambia por la más parecida.
-- 2. Cada aviso nuevo lleva un "tono" para pintarlo en la campanita:
--    accion (naranja, hay que hacer algo), bien (verde), mal (rojo).
--    Los avisos viejos quedan sin tono y se ven como siempre.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Corrector
-- ---------------------------------------------------------------------

-- Texto en minúsculas y sin acentos, para comparar.
create function public.normalizar(p text)
returns text
language sql stable set search_path = ''
as $$
  select lower(extensions.unaccent(coalesce(p, '')));
$$;

-- Devuelve la búsqueda corregida, o null si no hacía falta corregir nada.
create function public.corregir_busqueda(p_texto text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_vocabulario text[];
  v_palabra text;
  v_mejor text;
  v_salida text[] := '{}';
  v_cambio boolean := false;
begin
  if length(trim(coalesce(p_texto, ''))) < 3 then
    return null;
  end if;

  select array_agg(distinct w) into v_vocabulario
  from (
    select regexp_split_to_table(public.normalizar(p.nombre || ' ' || coalesce(p.marca, '') || ' ' || coalesce(p.grupo, '')), '[^a-z0-9ñ]+') as w
    from public.productos p
    join public.comercios c on c.id = p.comercio_id
    where p.activo and c.aprobado
    union all
    select regexp_split_to_table(public.normalizar(c.nombre || ' ' || c.rubro), '[^a-z0-9ñ]+')
    from public.comercios c
    where c.aprobado
  ) x
  where length(w) >= 3;

  foreach v_palabra in array regexp_split_to_array(public.normalizar(trim(p_texto)), '\s+') loop
    -- Si la palabra existe (o es el comienzo de una que existe), queda como está.
    if length(v_palabra) < 3 or exists (select 1 from unnest(v_vocabulario) v where v like v_palabra || '%') then
      v_salida := v_salida || v_palabra;
      continue;
    end if;
    select v into v_mejor
    from unnest(v_vocabulario) v
    where extensions.similarity(v, v_palabra) >= 0.3
    order by extensions.similarity(v, v_palabra) desc, abs(length(v) - length(v_palabra)), v
    limit 1;
    if v_mejor is null then
      v_salida := v_salida || v_palabra;
    else
      v_salida := v_salida || v_mejor;
      v_cambio := true;
    end if;
  end loop;

  return case when v_cambio then array_to_string(v_salida, ' ') end;
end;
$$;
revoke execute on function public.corregir_busqueda(text) from public;
grant execute on function public.corregir_busqueda(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Color de los avisos
-- ---------------------------------------------------------------------
alter table public.notificaciones
  add column tono text check (tono in ('accion', 'bien', 'mal'));

-- Se decide por el título que arman los avisos de 15_mensajes_y_notificaciones
-- y 17_preguntas, así no hay que tocar cada uno.
create function public.tono_aviso()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.tono is null then
    new.tono := case
      when new.titulo like '% aceptó tu reserva'
        or new.titulo like '¡% ya está publicado!'
        or new.titulo like '% respondió tu pregunta'
        or new.titulo like '% respondió tu reseña' then 'bien'
      when new.titulo like '% no puede tomar tu reserva'
        or new.titulo = 'Tu reserva venció'
        or new.titulo = 'Tu reserva se cerró sin retirar'
        or new.titulo like '% canceló la reserva'
        or new.titulo like 'Despublicamos %'
        or new.titulo like '% necesita cambios' then 'mal'
      else 'accion'
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.tono_aviso() from public, anon, authenticated;

create trigger tono_al_notificar
  before insert on public.notificaciones
  for each row execute function public.tono_aviso();
