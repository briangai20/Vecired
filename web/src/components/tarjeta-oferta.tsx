import Image from "next/image";
import Link from "next/link";
import { descuento, hastaCorto, type Oferta } from "@/lib/ofertas";
import { plata } from "@/lib/formato";

// Tarjeta de una oferta: producto rebajado (precio normal tachado y el de
// oferta) o aviso libre del comercio (título e imagen).
export function TarjetaOferta({ o, className = "" }: { o: Oferta; className?: string }) {
  const p = o.producto;
  const foto = p?.foto_url ?? o.imagen_url;
  const menos = p ? descuento(p.precio, o.precio_oferta) : null;
  return (
    <Link
      href={p ? `/producto/${p.id}` : `/comercio/${o.comercio.id}`}
      className={`group flex overflow-hidden rounded-2xl border border-white/20 bg-marino text-white shadow-lg shadow-black/20 transition hover:border-white/60 ${className}`}
    >
      <div className="relative w-2/5 shrink-0 bg-marino-claro">
        {foto ? (
          <Image src={foto} alt={p?.nombre ?? o.titulo ?? "Oferta"} fill sizes="(min-width: 1024px) 15vw, 40vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-5xl" aria-hidden>
            🏷️
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-naranja px-2.5 py-0.5 text-xs font-black shadow">{menos ? `-${menos}%` : "Oferta"}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <p className="text-[11px] font-semibold tracking-wide text-naranja-vivo uppercase">🔥 Oferta · {hastaCorto(o.hasta)}</p>
        <p className="mt-1 line-clamp-2 leading-snug font-bold">{p ? p.nombre : o.titulo}</p>
        {p ? (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-black">{plata(o.precio_oferta)}</span>
            {p.precio != null ? <span className="text-xs text-white/60 line-through">{plata(p.precio)}</span> : null}
          </p>
        ) : null}
        <p className="mt-auto pt-2 text-xs break-words text-white/75">{o.comercio.nombre}</p>
      </div>
    </Link>
  );
}
