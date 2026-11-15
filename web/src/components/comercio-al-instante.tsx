"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoComercio } from "@/components/logo-comercio";

export const EVENTO_ELEGIDO = "vecired:comercio-elegido";
export type ComercioTocado = { id: number; nombre: string; rubro: string; direccion: string; logo_url?: string | null };

// Al tocar un comercio en el mapa, la pantalla baja enseguida hasta acá y se
// ve una tarjeta rápida con lo que ya sabe el mapa, mientras carga el resto
// (horario, valoración…). Cuando llega la tarjeta completa, esta se va.
export function ComercioAlInstante() {
  const params = useSearchParams();
  const elegidoEnPagina = Number(params.get("comercio")) || null;
  const [tocado, setTocado] = useState<ComercioTocado | null>(null);

  useEffect(() => {
    const alTocar = (e: Event) => {
      setTocado((e as CustomEvent<ComercioTocado>).detail);
      // Al instante, apenas se dibuja la tarjeta.
      requestAnimationFrame(() => document.getElementById("comercio-elegido")?.scrollIntoView({ behavior: "instant", block: "start" }));
    };
    window.addEventListener(EVENTO_ELEGIDO, alTocar);
    return () => window.removeEventListener(EVENTO_ELEGIDO, alTocar);
  }, []);

  const mostrar = tocado && tocado.id !== elegidoEnPagina ? tocado : null;

  return (
    <div id="comercio-elegido" className="scroll-mt-32">
      {mostrar ? (
        <div className="tarjeta flex items-center gap-3 rounded-2xl p-4" aria-live="polite">
          <LogoComercio url={mostrar.logo_url ?? null} nombre={mostrar.nombre} />
          <div className="min-w-0 flex-1">
            <p className="leading-snug font-semibold break-words">{mostrar.nombre}</p>
            <p className="text-xs text-white/80">{mostrar.rubro}</p>
            <p className="mt-1 text-xs break-words text-white/70">{mostrar.direccion}</p>
          </div>
          <Link href={`/comercio/${mostrar.id}`} className="boton shrink-0 rounded-xl px-3 py-2 text-xs font-semibold">
            Ver catálogo
          </Link>
        </div>
      ) : null}
    </div>
  );
}
