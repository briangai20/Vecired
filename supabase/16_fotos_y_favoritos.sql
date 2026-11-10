-- =====================================================================
-- VeciRed · Fotos extra por producto y favoritos
--
-- 1. Cada producto puede tener hasta 5 fotos más, además de la principal
--    (foto_url), para mostrarlas en una galería.
-- 2. Favoritos: cada persona guarda productos y comercios con un corazón.
-- =====================================================================

-- 1. Fotos extra (direcciones públicas del bucket "productos").
alter table public.productos
  add column fotos text[] not null default '{}'
  check (cardinality(fotos) <= 5);

-- 2. Favoritos: un producto o un comercio por fila, sin repetir.
create table public.favoritos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  producto_id bigint references public.productos (id) on delete cascade,
  comercio_id bigint references public.comercios (id) on delete cascade,
  creado_en timestamptz not null default now(),
  check ((producto_id is null) <> (comercio_id is null))
);
create unique index on public.favoritos (usuario_id, producto_id) where producto_id is not null;
create unique index on public.favoritos (usuario_id, comercio_id) where comercio_id is not null;
create index on public.favoritos (usuario_id, creado_en desc);

alter table public.favoritos enable row level security;

-- Cada uno ve, agrega y saca solo los suyos.
create policy "favoritos: ver los propios" on public.favoritos
  for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "favoritos: agregar los propios" on public.favoritos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "favoritos: sacar los propios" on public.favoritos
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

revoke insert, update, delete on public.favoritos from anon, authenticated;
grant insert (producto_id, comercio_id), delete on public.favoritos to authenticated;
