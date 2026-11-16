-- =====================================================================
-- VeciRed · Moderación de textos y promos (2x1, 2da unidad, % off)
--
-- 1. Moderación: no se pueden guardar insultos (aunque estén disfrazados:
--    "p.u.t.o", "pel0tud0", "b o l u d o"), ni contenido discriminatorio.
--    En los textos PÚBLICOS (preguntas, reseñas, respuestas, productos,
--    ofertas, nombres) tampoco datos personales: teléfonos, mails, links,
--    DNI, tarjetas o cuentas, direcciones de casa. En los mensajes privados
--    de una reserva sí se pueden pasar datos para coordinar el retiro.
--    Los datos del perfil (WhatsApp y dirección del comercio, teléfono del
--    cliente) se siguen mostrando donde ya se mostraban.
-- 2. Promos en las ofertas: "Llevá X, pagá Y", "% en la 2da unidad" y
--    "% de descuento". La reserva guarda el descuento y el total lo respeta.
-- No se borra ni se cambia nada de lo que ya existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Moderación
-- ---------------------------------------------------------------------

-- Texto "aplanado" para buscar insultos disfrazados: minúsculas, sin
-- acentos, números y símbolos que imitan letras (0→o, 1→i, 3→e, 4→a, 5→s,
-- 7→t, @→a, $→s), letras sueltas separadas por símbolos se juntan
-- ("p.u.t.o" → "puto") y las letras repetidas se achican ("putooo" → "puto").
create function public.aplanar_texto(p text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  t text := lower(coalesce(p, ''));
  partes text[];
  salida text[] := '{}';
  junta text := '';
  w text;
begin
  t := translate(t, 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
  -- números y símbolos que imitan letras ("p!ja", "pel0tud0")
  t := regexp_replace(t, '(?<=[a-z])[!|1](?=[a-z])', 'i', 'g');
  t := translate(t, '0345@$7', 'oeasast');
  t := regexp_replace(t, '([a-z])\1{2,}', '\1', 'g');
  partes := regexp_split_to_array(t, '[^a-z0-9]+');
  -- "p u t o" / "p.u.t.o": letras sueltas seguidas se juntan en una palabra
  foreach w in array partes loop
    if length(w) = 1 then
      junta := junta || w;
    else
      if length(junta) > 0 then
        salida := salida || junta;
        junta := '';
      end if;
      if w <> '' then
        salida := salida || w;
      end if;
    end if;
  end loop;
  if length(junta) > 0 then
    salida := salida || junta;
  end if;
  return ' ' || array_to_string(salida, ' ') || ' ';
end;
$$;

-- Palabras prohibidas (se buscan como palabra entera, ya aplanadas).
create table public.palabras_prohibidas (
  palabra text primary key
);
alter table public.palabras_prohibidas enable row level security;
revoke all on public.palabras_prohibidas from anon, authenticated;

insert into public.palabras_prohibidas (palabra) values
  ('puto'), ('puta'), ('putos'), ('putas'), ('putito'), ('putita'), ('hdp'), ('hijo de puta'), ('hija de puta'), ('hijos de puta'),
  ('pelotudo'), ('pelotuda'), ('pelotudos'), ('pelotudas'), ('boludo'), ('boluda'), ('boludos'), ('boludas'),
  ('forro'), ('forra'), ('forros'), ('conchudo'), ('conchuda'), ('la concha de'), ('concha de tu madre'), ('concha de su madre'),
  ('mierda'), ('mierdas'), ('de mierda'), ('garca'), ('garcas'), ('estafador'), ('estafadores'),
  ('culiado'), ('culiada'), ('culeado'), ('culeada'), ('trolo'), ('trola'), ('trolos'), ('putarraca'),
  ('mogolico'), ('mogolica'), ('mogolicos'), ('idiota'), ('idiotas'), ('imbecil'), ('imbeciles'), ('estupido'), ('estupida'),
  ('tarado'), ('tarada'), ('retrasado'), ('retrasada'), ('subnormal'), ('choto'), ('chota'), ('pija'), ('verga'), ('chupala'), ('chupame'),
  ('cagon'), ('cagona'), ('sorete'), ('soretes'), ('pajero'), ('pajera'), ('orto'), ('ortiva'), ('cornudo'), ('cornuda'), ('marica'), ('maricon'), ('puton'), ('negro de mierda'), ('negra de mierda'),
  ('villero de mierda'), ('sudaca'), ('judio de mierda'), ('rata inmunda'), ('andate a la mierda'),
  ('te voy a matar'), ('los voy a matar'), ('te mato'), ('te cago a trompadas'), ('muerete'), ('ojala te mueras'),
  ('fuck'), ('fucking'), ('shit'), ('bitch'), ('motherfucker'), ('asshole'), ('nigger'), ('cunt');

-- Devuelve el problema del texto, o null si está bien. Nivel:
--   'privado'  (mensajes de una reserva, nombres): solo insultos.
--   'catalogo' (productos, ofertas): además mails, links y datos de contacto.
--   'publico'  (preguntas, reseñas, respuestas): además teléfonos, DNI,
--              tarjetas o cuentas y direcciones particulares.
create function public.problema_texto(p_texto text, p_nivel text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  plano text;
  crudo text := lower(coalesce(p_texto, ''));
  digitos text;
begin
  if coalesce(trim(p_texto), '') = '' then
    return null;
  end if;
  plano := public.aplanar_texto(p_texto);
  if exists (select 1 from public.palabras_prohibidas w where position(' ' || w.palabra || ' ' in plano) > 0) then
    return 'El texto tiene palabras ofensivas o agresivas. Escribilo de otra forma, con respeto.';
  end if;
  if p_nivel = 'privado' then
    return null;
  end if;
  -- Mails y links
  if crudo ~ '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]| arroba )\s*[a-z0-9.-]+\s*(\.|punto)\s*[a-z]{2,}' then
    return 'Por seguridad no se pueden publicar mails. Usá los datos de contacto del perfil.';
  end if;
  if crudo ~ '(https?://|www\.|wa\.me|bit\.ly|\m[a-z0-9-]+\.(com|ar|net|org|io|me|link|shop|store)\M)' then
    return 'Por seguridad no se pueden publicar links ni páginas web.';
  end if;
  if plano ~ ' (whatsapp|whatsap|wsp|wpp|watsap|telegram|instagram|facebook|mi cel|mi celular|mi telefono|mi numero|mi mail|mi correo|llamame|escribime al) ' then
    return 'Por seguridad no se pueden publicar datos de contacto. Usá los del perfil.';
  end if;
  if p_nivel = 'catalogo' then
    return null;
  end if;
  -- Teléfonos, DNI, tarjetas y cuentas: 7 o más números seguidos (aunque
  -- tengan espacios, puntos o guiones en el medio).
  digitos := regexp_replace(crudo, '(\d)[\s.\-/()]{1,2}(?=\d)', '\1', 'g');
  if digitos ~ '\d{7,}' then
    return 'Por seguridad no se pueden publicar teléfonos, DNI, ni números de tarjeta o cuenta.';
  end if;
  -- Direcciones de casa: "calle …", "av. …", "lote", "piso", "depto" con número.
  -- (sobre el texto sin cambiar números por letras)
  if ' ' || regexp_replace(translate(crudo, 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g') || ' '
     ~ ' (vivo en|mi casa|mi direccion|calle|av|avenida|pasaje|lote|manzana|mz|depto|dpto|departamento|piso) [a-z ]{0,30}\d{1,5} ' then
    return 'Por seguridad no se pueden publicar direcciones particulares.';
  end if;
  return null;
end;
$$;
grant execute on function public.problema_texto(text, text) to anon, authenticated;

-- Lanza el error si alguno de los textos tiene un problema.
create function public.revisar_textos(p_nivel text, variadic p_textos text[])
returns void
language plpgsql stable set search_path = ''
as $$
declare
  t text;
  v_problema text;
begin
  foreach t in array p_textos loop
    v_problema := public.problema_texto(t, p_nivel);
    if v_problema is not null then
      raise exception '%', v_problema;
    end if;
  end loop;
end;
$$;
revoke execute on function public.revisar_textos(text, text[]) from public, anon, authenticated;

create function public.moderar()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  case tg_table_name
    when 'preguntas' then perform public.revisar_textos('publico', new.texto, new.respuesta);
    when 'resenas' then perform public.revisar_textos('publico', new.texto, new.respuesta);
    when 'mensajes' then perform public.revisar_textos('privado', new.texto);
    when 'productos' then perform public.revisar_textos('catalogo', new.nombre, new.descripcion, new.marca, new.grupo);
    when 'ofertas' then perform public.revisar_textos('catalogo', new.titulo);
    when 'comercios' then perform public.revisar_textos('privado', new.nombre);
    when 'perfiles' then perform public.revisar_textos('privado', new.nombre);
    else null;
  end case;
  return new;
end;
$$;
revoke execute on function public.moderar() from public, anon, authenticated;

-- Se revisa solo lo que se escribe o cambia (lo ya guardado no se toca).
create trigger moderar_preguntas before insert or update of texto, respuesta on public.preguntas for each row execute function public.moderar();
create trigger moderar_resenas before insert or update of texto, respuesta on public.resenas for each row execute function public.moderar();
create trigger moderar_mensajes before insert on public.mensajes for each row execute function public.moderar();
create trigger moderar_productos before insert or update of nombre, descripcion, marca, grupo on public.productos for each row execute function public.moderar();
create trigger moderar_ofertas before insert or update of titulo on public.ofertas for each row execute function public.moderar();
create trigger moderar_comercios before insert or update of nombre on public.comercios for each row execute function public.moderar();
create trigger moderar_perfiles before insert or update of nombre on public.perfiles for each row execute function public.moderar();

-- ---------------------------------------------------------------------
-- 2. Promos
-- ---------------------------------------------------------------------
alter table public.ofertas
  add column promo text check (promo in ('nxm', 'segunda', 'porcentaje')),
  add column lleva integer check (lleva between 2 and 10),
  add column paga integer check (paga between 1 and 9),
  add column porcentaje integer check (porcentaje between 1 and 90),
  add constraint promo_completa check (
    promo is null
    or (promo = 'nxm' and lleva is not null and paga is not null and paga < lleva)
    or (promo in ('segunda', 'porcentaje') and porcentaje is not null)
  );
grant insert (promo, lleva, paga, porcentaje) on public.ofertas to authenticated;
grant update (promo, lleva, paga, porcentaje) on public.ofertas to authenticated;

alter table public.reservas
  add column descuento numeric(12, 2) not null default 0 check (descuento >= 0),
  add column promo text;

-- La mejor promo vigente para un producto y una cantidad: precio por
-- unidad (con rebaja si hay), descuento total y el nombre de la promo.
create function public.precio_con_promo(p_producto bigint, p_cantidad integer)
returns table (precio_unitario numeric, descuento numeric, promo text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_unitario numeric := public.precio_vigente(p_producto);
  v_mejor numeric := 0;
  v_promo text := null;
  o record;
  v numeric;
begin
  if v_unitario is null or p_cantidad < 1 then
    return query select v_unitario, 0::numeric, null::text;
    return;
  end if;
  for o in
    select distinct x.id, x.promo, x.lleva, x.paga, x.porcentaje
    from public.ofertas x
    left join public.oferta_productos op on op.oferta_id = x.id
    where x.promo is not null
      and x.hasta >= v_hoy
      and (x.producto_id = p_producto or op.producto_id = p_producto)
  loop
    v := case o.promo
      when 'nxm' then floor(p_cantidad / o.lleva) * (o.lleva - o.paga) * v_unitario
      when 'segunda' then floor(p_cantidad / 2) * v_unitario * o.porcentaje / 100.0
      when 'porcentaje' then p_cantidad * v_unitario * o.porcentaje / 100.0
    end;
    if v > v_mejor then
      v_mejor := v;
      v_promo := case o.promo
        when 'nxm' then o.lleva || 'x' || o.paga
        when 'segunda' then o.porcentaje || '% en la 2da unidad'
        else o.porcentaje || '% de descuento'
      end;
    end if;
  end loop;
  return query select v_unitario, round(v_mejor, 2), v_promo;
end;
$$;
grant execute on function public.precio_con_promo(bigint, integer) to anon, authenticated;

-- preparar_reserva y elegir_alternativa: guardan precio, descuento y promo.
create or replace function public.preparar_reserva()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  p public.productos;
  c record;
begin
  select * into p from public.productos where id = new.producto_id and activo;
  if not found then
    raise exception 'El producto no existe o no está disponible';
  end if;
  if not exists (select 1 from public.comercios where id = p.comercio_id and aprobado) then
    raise exception 'El comercio no está disponible';
  end if;
  if (p.modo = 'exacto' and coalesce(p.stock, 0) < new.cantidad)
     or (p.modo = 'semaforo' and p.semaforo = 'no') then
    raise exception 'No hay stock suficiente de %', p.nombre;
  end if;
  if new.medio_pago = 'online' and p.precio is null then
    raise exception 'Este producto no tiene precio cargado: elegí pagar en el local';
  end if;

  select * into c from public.precio_con_promo(p.id, new.cantidad);
  new.comprador_id := auth.uid();
  new.comercio_id := p.comercio_id;
  new.producto_nombre := p.nombre;
  new.precio_unitario := c.precio_unitario;
  new.descuento := coalesce(c.descuento, 0);
  new.promo := c.promo;
  new.producto_original_id := null;
  new.estado := 'pendiente';
  new.creada_en := now();
  new.actualizada_en := now();
  return new;
end;
$function$;

create or replace function public.elegir_alternativa(p_reserva bigint, p_producto bigint)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r public.reservas;
  p public.productos;
  c record;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found or r.comprador_id is distinct from auth.uid() then
    raise exception 'Reserva no encontrada';
  end if;
  if r.estado <> 'alternativa' then
    raise exception 'Esta reserva no tiene alternativas para elegir';
  end if;
  if not exists (select 1 from public.reserva_alternativas where reserva_id = r.id and producto_id = p_producto) then
    raise exception 'Ese producto no está entre las alternativas ofrecidas';
  end if;

  select * into p from public.productos where id = p_producto;
  perform public.descontar_stock(p.id, r.cantidad);
  select * into c from public.precio_con_promo(p.id, r.cantidad);

  update public.reservas set
    producto_original_id = coalesce(r.producto_original_id, r.producto_id),
    producto_id = p.id,
    producto_nombre = p.nombre,
    precio_unitario = c.precio_unitario,
    descuento = coalesce(c.descuento, 0),
    promo = c.promo,
    medio_pago = case when p.precio is null then 'local'::public.medio_pago else r.medio_pago end,
    estado = 'aceptada',
    actualizada_en = now()
  where id = r.id;
  delete from public.reserva_alternativas where reserva_id = r.id;
end;
$function$;

-- ---------------------------------------------------------------------
-- 22b · Direcciones más precisas (aplicado aparte). problema_texto() quedó
-- igual que arriba salvo la regla de direcciones, que ahora es:
--   ' (vivo en|mi casa|mi direccion|mi domicilio) '
--   o ' (calle|av|avenida|pasaje) <nombre> <altura de 2 a 5 números> '
-- (antes "piso 2" o "lote 5" daban falsos bloqueos).
-- ---------------------------------------------------------------------
