import Link from "next/link";
import { FotoProducto } from "@/components/foto-producto";
import { Stock } from "@/components/insignias";
import { km, plata, type Disponibilidad } from "@/lib/formato";

// Tarjeta de producto de los resultados, las filas de la portada y favoritos.
export function TarjetaProducto({
  id,
  nombre,
  precio,
  foto,
  d,
  comercio,
  distancia,
  abierto,
  oferta,
  className = "",
}: {
  id: number;
  nombre: string;
  precio: number | null;
  foto: string | null;
  d?: Disponibilidad;
  comercio: string;
  distancia?: number;
  abierto?: boolean | null;
  /** Precio de oferta vigente: se muestra con el normal tachado. */
  oferta?: number | null;
  className?: string;
}) {
  return (
    <Link
      href={`/producto/${id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-white/20 bg-marino transition hover:-translate-y-0.5 hover:border-white/60 ${className}`}
    >
      <div className="relative aspect-square overflow-hidden bg-marino-claro">
        <FotoProducto url={foto} nombre={nombre} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw" />
        {d ? (
          <span className="absolute top-2 left-2">
            <Stock d={d} />
          </span>
        ) : null}
        {oferta != null ? <span className="absolute top-2 right-2 rounded-full bg-naranja px-2 py-0.5 text-[11px] font-black text-white shadow">Oferta</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-3 text-white">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{nombre}</p>
        {oferta != null ? (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-lg font-black text-white">{plata(oferta)}</span>
            <span className="text-xs text-white/60 line-through">{plata(precio)}</span>
          </p>
        ) : (
          <p className="mt-1 text-lg font-black text-white">{plata(precio)}</p>
        )}
        <p className="mt-auto pt-2 text-xs break-words text-white/80">
          {comercio}
          {distancia != null ? ` · ${km(distancia)}` : ""}
        </p>
        {abierto != null ? (
          <p className={`text-[11px] font-semibold ${abierto ? "text-verde" : "text-white/55"}`}>{abierto ? "● Abierto ahora" : "Cerrado ahora"}</p>
        ) : null}
      </div>
    </Link>
  );
}

// Esqueleto gris mientras carga (mismo tamaño que la tarjeta).
export function TarjetaProductoCargando({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <div className="aspect-square animate-pulse bg-white/10" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-4/5 animate-pulse rounded bg-white/10" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}
