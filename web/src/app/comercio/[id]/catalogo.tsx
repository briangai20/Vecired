"use client";

import { useState, type ReactNode } from "react";

export type ItemCatalogo = { clave: string; texto: string; tarjeta: ReactNode };

const sinAcentos = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Buscador del catálogo de un local: filtra las tarjetas mientras se escribe,
// sin Enter. Cada palabra tiene que aparecer en el nombre, la marca, la
// descripción o el grupo ("collar rojo" encuentra "Collar de cuero rojo").
export function Catalogo({ comercio, items, inicial }: { comercio: string; items: ItemCatalogo[]; inicial: string }) {
  const [q, setQ] = useState(inicial);
  const palabras = sinAcentos(q).split(/\s+/).filter(Boolean);
  const visibles = palabras.length ? items.filter((i) => palabras.every((p) => i.texto.includes(p))) : items;

  function cambiar(valor: string) {
    setQ(valor);
    // Deja la búsqueda en la dirección, para compartirla o volver con "atrás", sin recargar.
    const url = new URL(window.location.href);
    if (valor.trim()) url.searchParams.set("q", valor.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <>
      <form className="mt-6" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="catq" className="sr-only">
          Buscar un producto en {comercio}
        </label>
        <input
          id="catq"
          name="q"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => cambiar(e.target.value)}
          placeholder={`Buscar un producto en ${comercio}`}
          className="campo"
        />
      </form>
      <p className="mt-2 text-xs text-white/80" role="status">
        {palabras.length ? `${visibles.length} resultado${visibles.length === 1 ? "" : "s"} en este local` : `${items.length} productos en este local`}
      </p>

      {visibles.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/30 p-8 text-center text-sm">
          {palabras.length ? `No encontramos "${q.trim()}" en este local. Probá con otra palabra.` : "Este comercio todavía no cargó productos."}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((i) => (
            <div key={i.clave} className="contents">
              {i.tarjeta}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
