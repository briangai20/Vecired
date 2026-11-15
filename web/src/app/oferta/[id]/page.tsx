import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TarjetaProducto } from "@/components/tarjeta-producto";
import { disponibilidad, fechaAR } from "@/lib/formato";
import { hastaCorto, preciosDeOferta } from "@/lib/ofertas";
import { supabasePublico } from "@/lib/supabase/publico";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Oferta" };

// Página de una oferta libre ("2x1 en tornillos"): el texto, la imagen, hasta
// cuándo vale y los productos de la promo para reservar.
export default function PaginaOferta({ params }: Props) {
  return (
    <Suspense fallback={<div className="tarjeta h-72 animate-pulse rounded-3xl" />}>
      <Oferta params={params} />
    </Suspense>
  );
}

async function Oferta({ params }: Pick<Props, "params">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await connection();
  const ahora = new Date();
  const db = supabasePublico();
  const { data: o } = await db
    .from("ofertas")
    .select("id, titulo, imagen_url, hasta, producto_id, comercio:comercios!inner(id, nombre, direccion, aprobado)")
    .eq("id", id)
    .eq("comercio.aprobado", true)
    .gte("hasta", fechaAR(ahora))
    .maybeSingle();
  if (!o) notFound();
  // Si es un producto rebajado, la oferta es ese producto.
  if (o.producto_id) redirect(`/producto/${o.producto_id}`);

  const { data: filas } = await db
    .from("oferta_productos")
    .select("producto:productos!inner(id, nombre, precio, foto_url, modo, stock, semaforo, actualizado_en, activo)")
    .eq("oferta_id", o.id);
  const productos = (filas ?? []).map((f) => f.producto).filter((p) => p.activo);
  const ofertaDe = await preciosDeOferta(
    db,
    productos.map((p) => p.id),
  );

  return (
    <div className="space-y-4">
      <section className="tarjeta overflow-hidden rounded-3xl">
        <div className="grid sm:grid-cols-[2fr_3fr]">
          <div className="relative aspect-video bg-marino-claro sm:aspect-auto sm:min-h-56">
            {o.imagen_url ? (
              <Image src={o.imagen_url} alt={o.titulo ?? "Oferta"} fill sizes="(min-width: 640px) 40vw, 100vw" className="object-cover" priority />
            ) : (
              <div aria-hidden className="absolute inset-0 grid place-items-center text-7xl">
                🏷️
              </div>
            )}
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-xs font-bold tracking-wide text-naranja-vivo uppercase">🔥 Oferta · {hastaCorto(o.hasta)}</p>
            <h1 className="mt-2 text-2xl leading-tight font-black sm:text-3xl">{o.titulo}</h1>
            <p className="mt-3 text-sm text-white/85">
              En{" "}
              <Link href={`/comercio/${o.comercio.id}`} className="font-semibold underline">
                {o.comercio.nombre}
              </Link>{" "}
              · {o.comercio.direccion}
            </p>
            <p className="mt-2 text-xs text-white/70">Reservá el producto y retiralo en el local. La promoción la aplica el comercio al retirar.</p>
            <Link href={`/comercio/${o.comercio.id}`} className="boton mt-4 inline-block rounded-xl px-4 py-2.5 text-sm font-semibold">
              Ver el comercio
            </Link>
          </div>
        </div>
      </section>

      {productos.length ? (
        <section>
          <h2 className="titulo-seccion mb-3 text-marino">🛍️ Productos de la oferta</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {productos.map((p) => (
              <TarjetaProducto
                key={p.id}
                id={p.id}
                nombre={p.nombre}
                precio={p.precio}
                foto={p.foto_url}
                d={disponibilidad(p, ahora)}
                comercio={o.comercio.nombre}
                oferta={ofertaDe.get(p.id) ?? null}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
