"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Buscador del encabezado, como la barra de Mercado Libre: está en todas las
// páginas y siempre lleva a los resultados de la portada. Si ya estás en la
// portada, conserva la ubicación, el radio y el orden que elegiste.
export function Buscador({ className = "" }: { className?: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const actual = ruta === "/" ? (params.get("q") ?? "") : "";
  const [texto, setTexto] = useState(actual);
  const [antes, setAntes] = useState(actual);
  // Si la búsqueda cambia desde otro lado (un rubro, volver atrás), el campo la acompaña.
  if (actual !== antes) {
    setAntes(actual);
    setTexto(actual);
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams(ruta === "/" ? params.toString() : "");
    p.delete("comercio");
    p.delete("ver");
    const t = texto.trim();
    if (t) p.set("q", t);
    else p.delete("q");
    router.push(`/${p.size ? `?${p}` : ""}`);
  }

  return (
    <form role="search" onSubmit={buscar} className={`relative ${className}`}>
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscá productos o comercios: tornillos, alimento para perro…"
        aria-label="Buscar productos o comercios"
        autoComplete="off"
        className="h-11 w-full rounded-xl border border-white/30 bg-white pr-12 pl-4 text-sm text-marino placeholder:text-marino/55 focus:border-white focus:ring-2 focus:ring-naranja-vivo focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="absolute top-1 right-1 grid h-9 w-10 place-items-center rounded-lg bg-naranja text-white transition hover:bg-naranja-hover"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}

// Lo que se ve mientras carga (mismo tamaño, para que no salte la página).
export function BuscadorCargando({ className = "" }: { className?: string }) {
  return <div className={`h-11 rounded-xl border border-white/30 bg-white ${className}`} />;
}
