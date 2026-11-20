-- Respuestas del comercio (a reseñas y a preguntas): se escriben una sola vez.
-- No se pueden modificar; se pueden borrar, y después de borrarla esa reseña o
-- pregunta ya no se puede volver a responder.

alter table public.resenas add column if not exists respuesta_borrada_en timestamptz;
alter table public.preguntas add column if not exists respuesta_borrada_en timestamptz;
grant select (respuesta_borrada_en) on public.preguntas to authenticated;

-- Texto con algo: responde (solo si nunca respondió). Texto vacío: borra la
-- respuesta que tiene.
create or replace function public.responder_resena(p_resena bigint, p_texto text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.resenas;
  v_texto text := nullif(trim(coalesce(p_texto, '')), '');
begin
  select * into r from public.resenas where id = p_resena for update;
  if not found or not public.es_dueno(r.comercio_id) then
    raise exception 'Reseña no encontrada';
  end if;
  if v_texto is null then
    if r.respuesta is null then
      raise exception 'Escribí tu respuesta';
    end if;
    update public.resenas set respuesta = null, respondida_en = null, respuesta_borrada_en = now() where id = p_resena;
    return;
  end if;
  if r.respuesta is not null then
    raise exception 'Ya respondiste esta reseña: la respuesta no se puede modificar, solo borrar';
  end if;
  if r.respuesta_borrada_en is not null then
    raise exception 'Borraste tu respuesta a esta reseña: ya no se puede volver a responder';
  end if;
  if length(v_texto) > 1000 then
    raise exception 'La respuesta puede tener hasta 1000 letras';
  end if;
  update public.resenas set respuesta = v_texto, respondida_en = now() where id = p_resena;
end;
$$;

create or replace function public.responder_pregunta(p_pregunta bigint, p_texto text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  q public.preguntas;
  v_texto text := nullif(trim(coalesce(p_texto, '')), '');
begin
  select * into q from public.preguntas where id = p_pregunta for update;
  if not found or not public.es_dueno(q.comercio_id) then
    raise exception 'Pregunta no encontrada';
  end if;
  if v_texto is null then
    if q.respuesta is null then
      raise exception 'Escribí tu respuesta';
    end if;
    update public.preguntas set respuesta = null, respondida_en = null, respuesta_borrada_en = now() where id = p_pregunta;
    return;
  end if;
  if q.respuesta is not null then
    raise exception 'Ya respondiste esta pregunta: la respuesta no se puede modificar, solo borrar';
  end if;
  if q.respuesta_borrada_en is not null then
    raise exception 'Borraste tu respuesta a esta pregunta: ya no se puede volver a responder';
  end if;
  if length(v_texto) > 1000 then
    raise exception 'La respuesta puede tener hasta 1000 letras';
  end if;
  update public.preguntas set respuesta = v_texto, respondida_en = now() where id = p_pregunta;
end;
$$;

revoke execute on function public.responder_resena(bigint, text) from public, anon;
grant execute on function public.responder_resena(bigint, text) to authenticated;
revoke execute on function public.responder_pregunta(bigint, text) from public, anon;
grant execute on function public.responder_pregunta(bigint, text) to authenticated;
