"use client";

import Link from "next/link";
import { unidades, useCarrito } from "@/lib/carrito";

// Ícono del carrito en el encabezado: aparece solo cuando hay algo adentro,
// con la cantidad de productos en naranja.
export function IconoCarrito() {
  const n = unidades(useCarrito());
  if (!n) return null;
  return (
    <Link
      href="/carrito"
      aria-label={`Carrito: ${n} ${n === 1 ? "producto" : "productos"}`}
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/30 text-white transition hover:bg-white/10"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="20" r="1.3" />
        <circle cx="18" cy="20" r="1.3" />
        <path d="M2.5 3.5h2.7l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 7.5H6.1" />
      </svg>
      <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-naranja px-1 text-[11px] font-bold">{n > 9 ? "9+" : n}</span>
    </Link>
  );
}
