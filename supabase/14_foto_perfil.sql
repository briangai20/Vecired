-- =====================================================================
-- VeciRed · Foto de perfil (2026-11-04)
-- - perfiles.foto_url: foto que cada persona elige al registrarse o en
--   "Mi perfil". Se guarda en el bucket "perfiles", carpeta <id del usuario>/.
-- - resenas.autor_foto_url: la foto que acompaña la reseña. Se copia al
--   escribirla (las reseñas son públicas y los perfiles no) y se actualiza
--   si la persona cambia su foto.
-- =====================================================================

alter table public.perfiles add column foto_url text check (length(foto_url) <= 500);
grant update (foto_url) on public.perfiles to authenticated;

alter table public.resenas add column autor_foto_url text;

-- Bucket público (las fotos se ven en las reseñas), hasta 2 MB y solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perfiles', 'perfiles', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']);

-- Cada uno sube, ve, cambia y borra solo en su carpeta.
create policy "perfiles: subir la propia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'perfiles' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "perfiles: ver la propia" on storage.objects
  for select to authenticated
  using (bucket_id = 'perfiles' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "perfiles: cambiar la propia" on storage.objects
  for update to authenticated
  using (bucket_id = 'perfiles' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "perfiles: borrar la propia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'perfiles' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- La reseña lleva la foto del autor.
create or replace function public.preparar_resena()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  r public.reservas;
  partes text[];
  foto text;
begin
  select * into r from public.reservas where id = new.reserva_id;
  if not found or r.comprador_id is distinct from auth.uid() then
    raise exception 'Solo podés reseñar tus propias reservas';
  end if;
  if r.estado <> 'retirada' then
    raise exception 'Podés dejar la reseña después de retirar el pedido';
  end if;

  select regexp_split_to_array(trim(nombre), '\s+'), foto_url into partes, foto
  from public.perfiles where id = auth.uid();

  new.comercio_id := r.comercio_id;
  new.autor_id := auth.uid();
  new.autor_nombre := case
    when coalesce(partes[1], '') = '' then 'Cliente'
    when array_length(partes, 1) > 1 then partes[1] || ' ' || left(partes[2], 1) || '.'
    else partes[1]
  end;
  new.autor_foto_url := foto;
  new.creada_en := now();
  return new;
end;
$$;

-- Si cambia la foto, se cambia también en sus reseñas.
create function public.actualizar_foto_resenas()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.resenas set autor_foto_url = new.foto_url where autor_id = new.id;
  return new;
end;
$$;

create trigger perfiles_foto_en_resenas
  after update of foto_url on public.perfiles
  for each row when (old.foto_url is distinct from new.foto_url)
  execute function public.actualizar_foto_resenas();

-- Las que ya existen toman la foto actual.
update public.resenas e set autor_foto_url = p.foto_url from public.perfiles p where p.id = e.autor_id;
