import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Corazon } from "@/components/corazon";
import { LogoComercio } from "@/components/logo-comercio";
import { TarjetaProducto, TarjetaProductoCargando } from "@/components/tarjeta-producto";
import { disponibilidad } from "@/lib/formato";
import { usuarioActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Mis favoritos", robots: { index: false } };

export default function PaginaFavoritos() {
  return (
    <div className="tarjeta rounded-3xl p-5 sm:p-6">
      <h1 className="text-2xl font-bold">Mis favoritos</h1>
      <p className="mt-1 text-sm text-white/80">Lo que guardaste con el corazón. Tocá el corazón de nuevo para sacarlo.</p>
      <Suspense
        fallback={
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <TarjetaProductoCargando key={i} />
            ))}
          </div>
        }
      >
        <Lista />
      </Suspense>
    </div>
  );
}

async function Lista() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar?siguiente=/favoritos");
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("favoritos")
    .select(
      "id, producto:productos(id, nombre, precio, foto_url, modo, stock, semaforo, actualizado_en, activo, comercio:comercios(nombre, aprobado)), comercio:comercios(id, nombre, rubro, direccion, logo_url, aprobado)",
    )
    .order("creado_en", { ascending: false });

  const ahora = new Date();
  // Solo lo que sigue publicado.
  const productos = (data ?? []).flatMap((f) => (f.producto && f.producto.activo && f.producto.comercio?.aprobado ? [f.producto] : []));
  const comercios = (data ?? []).flatMap((f) => (f.comercio && f.comercio.aprobado ? [f.comercio] : []));

  if (!productos.length && !comercios.length) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-white/30 p-8 text-center text-sm">
        Todavía no guardaste nada. Cuando veas un producto o un comercio que te guste, tocá el corazón ♡ y aparece acá.
        <div className="mt-4">
          <Link href="/" className="boton inline-block rounded-xl px-5 py-2.5 font-semibold">
            Buscar en mi barrio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {productos.length ? (
        <section className="mt-6">
          <h2 className="titulo-seccion">🛍️ Productos ({productos.length})</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {productos.map((p) => (
              <li key={p.id} className="relative">
                <TarjetaProducto
                  id={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  foto={p.foto_url}
                  d={disponibilidad(p, ahora)}
                  comercio={p.comercio?.nombre ?? ""}
                  className="h-full"
                />
                <Corazon tipo="producto" id={p.id} guardado conSesion className="absolute top-2 right-2 bg-marino/80" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {comercios.length ? (
        <section className="mt-8">
          <h2 className="titulo-seccion">🏪 Comercios ({comercios.length})</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {comercios.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/20 p-4">
                <LogoComercio url={c.logo_url} nombre={c.nombre} />
                <Link href={`/comercio/${c.id}`} className="min-w-0 flex-1">
                  <span className="block font-semibold break-words hover:underline">{c.nombre}</span>
                  <span className="block text-xs text-white/75">{c.rubro}</span>
                  <span className="block text-xs break-words text-white/60">{c.direccion}</span>
                </Link>
                <Corazon tipo="comercio" id={c.id} guardado conSesion />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
