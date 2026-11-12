"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Carrusel } from "@/components/carrusel";
import { TarjetaProducto } from "@/components/tarjeta-producto";
import { borrarVistos, useVistos } from "@/lib/historial";
import type { Tabla } from "@/lib/supabase/tipos";
import { disponibilidad } from "@/lib/formato";
import { supabaseNavegador } from "@/lib/supabase/navegador";

type Visto = Pick<Tabla<"productos">, "id" | "nombre" | "precio" | "foto_url" | "modo" | "stock" | "semaforo" | "actualizado_en"> & {
  comercio: { nombre: string };
};

// Fila "Vistos recientemente" de la portada, como en Mercado Libre. Los ids
// salen del navegador; el precio y el stock se traen actualizados.
export function VistosRecientes() {
  const q = useSearchParams().get("q");
  const ids = useVistos();
  const clave = ids.join(",");
  const [productos, setProductos] = useState<{ clave: string; lista: Visto[] } | null>(null);

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    const lista = clave.split(",").map(Number);
    supabaseNavegador()
      .from("productos")
      .select("id, nombre, precio, foto_url, modo, stock, semaforo, actualizado_en, comercio:comercios!inner(nombre, aprobado)")
      .in("id", lista)
      .eq("activo", true)
      .eq("comercio.aprobado", true)
      .then(({ data }) => {
        if (!vigente) return;
        const porId = new Map<number, Visto>((data ?? []).map((p) => [p.id, p]));
        setProductos({ clave, lista: lista.flatMap((id) => (porId.has(id) ? [porId.get(id)!] : [])) });
      });
    return () => {
      vigente = false;
    };
  }, [clave]);

  if (q || !clave || !productos?.lista.length) return null;
  const ahora = new Date();

  return (
    <section aria-label="Vistos recientemente" className="banda">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="titulo-seccion text-marino">🕘 Vistos recientemente</h2>
        <button type="button" onClick={borrarVistos} className="text-xs text-marino/70 underline-offset-2 hover:text-marino hover:underline">
          Borrar historial
        </button>
      </div>
      <Carrusel etiqueta="Vistos recientemente">
        {productos.lista.map((p) => (
          <li key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
            <TarjetaProducto
              id={p.id}
              nombre={p.nombre}
              precio={p.precio}
              foto={p.foto_url}
              d={disponibilidad(p, ahora)}
              comercio={p.comercio.nombre}
              className="h-full"
            />
          </li>
        ))}
      </Carrusel>
    </section>
  );
}
