-- =====================================================================
-- VeciRed · Preguntas públicas en cada producto (como en Mercado Libre)
--
-- Cualquier vecino con cuenta pregunta en la página del producto; el
-- comercio responde desde su panel y la pregunta con su respuesta queda a
-- la vista de todos. No se muestra quién preguntó.
-- =====================================================================

create table public.preguntas (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos (id) on delete cascade,
  comercio_id bigint not null references public.comercios (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  texto text not null check (length(trim(texto)) between 3 and 500),
  creada_en timestamptz not null default now(),
  respuesta text check (length(respuesta) <= 1000),
  respondida_en timestamptz
);
create index on public.preguntas (producto_id, creada_en desc);
create index on public.preguntas (comercio_id, creada_en desc);
create index on public.preguntas (autor_id, creada_en desc);

-- Completa el comercio y el autor, y frena el abuso: el dueño no se
-- pregunta a sí mismo, hasta 10 preguntas por día por persona y hasta 3
-- sin responder por producto.
create function public.preparar_pregunta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_comercio bigint;
begin
  select p.comercio_id into v_comercio
  from public.productos p
  join public.comercios c on c.id = p.comercio_id
  where p.id = new.producto_id and p.activo and c.aprobado;
  if not found then
    raise exception 'Producto no encontrado';
  end if;
  if public.es_dueno(v_comercio) then
    raise exception 'No podés preguntar en tu propio comercio';
  end if;
  if (select count(*) from public.preguntas where autor_id = auth.uid() and creada_en > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al máximo de 10 preguntas por día. Probá mañana.';
  end if;
  if (select count(*) from public.preguntas where autor_id = auth.uid() and producto_id = new.producto_id and respuesta is null) >= 3 then
    raise exception 'Ya tenés 3 preguntas sin responder en este producto. Esperá la respuesta del comercio.';
  end if;
  new.comercio_id := v_comercio;
  new.autor_id := auth.uid();
  new.texto := trim(new.texto);
  new.creada_en := now();
  new.respuesta := null;
  new.respondida_en := null;
  return new;
end;
$$;

create trigger al_crear_pregunta
  before insert on public.preguntas
  for each row execute function public.preparar_pregunta();

alter table public.preguntas enable row level security;

create policy "preguntas: ver" on public.preguntas
  for select to anon, authenticated
  using (true);
create policy "preguntas: hacer" on public.preguntas
  for insert to authenticated
  with check (autor_id = (select auth.uid()));
-- Borra el que preguntó o el dueño del comercio (por ejemplo, si es ofensiva).
create policy "preguntas: borrar" on public.preguntas
  for delete to authenticated
  using (autor_id = (select auth.uid()) or public.es_dueno(comercio_id));

-- Quién preguntó no es público: se puede leer todo menos autor_id.
revoke all on public.preguntas from anon, authenticated;
grant select (id, producto_id, comercio_id, texto, creada_en, respuesta, respondida_en) on public.preguntas to anon, authenticated;
grant insert (producto_id, texto) on public.preguntas to authenticated;
grant delete on public.preguntas to authenticated;

-- ¿Esta pregunta es mía? (para mostrar "Tu pregunta" y el botón de borrar).
create function public.mis_preguntas(p_producto bigint)
returns setof bigint
language sql stable security definer set search_path = ''
as $$
  select id from public.preguntas where producto_id = p_producto and autor_id = (select auth.uid());
$$;
revoke execute on function public.mis_preguntas(bigint) from public, anon;
grant execute on function public.mis_preguntas(bigint) to authenticated;

-- El dueño responde, cambia o borra (texto vacío) la respuesta.
create function public.responder_pregunta(p_pregunta bigint, p_texto text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_comercio bigint;
  v_texto text := nullif(trim(coalesce(p_texto, '')), '');
begin
  select comercio_id into v_comercio from public.preguntas where id = p_pregunta;
  if not found or not public.es_dueno(v_comercio) then
    raise exception 'Pregunta no encontrada';
  end if;
  if length(v_texto) > 1000 then
    raise exception 'La respuesta puede tener hasta 1000 letras';
  end if;
  update public.preguntas
  set respuesta = v_texto,
      respondida_en = case when v_texto is null then null else now() end
  where id = p_pregunta;
end;
$$;
revoke execute on function public.responder_pregunta(bigint, text) from public, anon;
grant execute on function public.responder_pregunta(bigint, text) to authenticated;

-- Avisos: pregunta nueva (al comercio) y respuesta (al que preguntó).
create function public.avisar_pregunta()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  c public.comercios;
  v_producto text;
begin
  select * into c from public.comercios where id = new.comercio_id;
  select nombre into v_producto from public.productos where id = new.producto_id;
  if tg_op = 'INSERT' then
    perform public.notificar(c.dueno_id, 'Nueva pregunta: ' || v_producto, '“' || left(new.texto, 160) || '”', '/comerciante?seccion=preguntas');
  elsif new.respuesta is not null and new.respuesta is distinct from old.respuesta then
    perform public.notificar(new.autor_id, c.nombre || ' respondió tu pregunta', v_producto || ': ' || left(new.respuesta, 140), '/producto/' || new.producto_id || '#preguntas');
  end if;
  return new;
end;
$$;

create trigger avisar_pregunta_nueva
  after insert on public.preguntas
  for each row execute function public.avisar_pregunta();
create trigger avisar_pregunta_respuesta
  after update of respuesta on public.preguntas
  for each row execute function public.avisar_pregunta();

revoke execute on function public.preparar_pregunta() from public, anon, authenticated;
revoke execute on function public.avisar_pregunta() from public, anon, authenticated;
