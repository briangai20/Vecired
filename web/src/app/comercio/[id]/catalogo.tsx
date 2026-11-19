"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ListaConMas } from "@/components/lista-con-mas";
import { coincideAprox, coincideExacto, corregir, palabrasBuscadas, palabrasDe, parecido, vocabulario } from "@/lib/busqueda";

export type ItemCatalogo = { clave: string; texto: string; tarjeta: ReactNode };

const GRILLA = "mt-4 grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3";

// Buscador del catálogo de un local: filtra las tarjetas mientras se escribe,
// sin Enter. Cada palabra tiene que aparecer en el nombre, la marca, la
// descripción o el grupo ("collar rojo" encuentra "Collar de cuero rojo").
// Si no aparece tal cual, entiende errores de tipeo ("martiyo" → "martillo");
// y si el local no lo tiene, lo dice y deja seguir mirando el resto.
export function Catalogo({ comercio, items, inicial }: { comercio: string; items: ItemCatalogo[]; inicial: string }) {
  const [q, setQ] = useState(inicial);
  const buscadas = palabrasBuscadas(q);
  const conPalabras = useMemo(() => items.map((i) => ({ i, palabras: palabrasDe(i.texto) })), [items]);
  const vocab = useMemo(() => vocabulario(items.map((i) => i.texto)), [items]);

  const exactos = buscadas.length ? items.filter((i) => coincideExacto(i.texto, buscadas)) : items;
  const aprox = buscadas.length && !exactos.length ? conPalabras.filter((x) => coincideAprox(x.palabras, buscadas)).map((x) => x.i) : [];
  const visibles = exactos.length ? exactos : aprox;
  const corregida = aprox.length ? corregir(q, vocab) : null;
  // Si no hay nada, el resto del local, primero lo que más se parece.
  const otros =
    buscadas.length && !visibles.length
      ? conPalabras
          .map((x) => ({ i: x.i, p: parecido(x.palabras, buscadas) }))
          .sort((a, b) => b.p - a.p)
          .map((x) => x.i)
      : [];

  function cambiar(valor: string) {
    setQ(valor);
    // Deja la búsqueda en la dirección, para compartirla o volver con "atrás", sin recargar.
    const url = new URL(window.location.href);
    if (valor.trim()) url.searchParams.set("q", valor.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }

  const grilla = (lista: ItemCatalogo[], clave: string) => (
    // Al cambiar la búsqueda vuelve a mostrar solo los primeros.
    <ListaConMas key={clave} deA={12} deACelular={6} que="productos" className={GRILLA}>
      {lista.map((i) => (
        <div key={i.clave} className="contents">
          {i.tarjeta}
        </div>
      ))}
    </ListaConMas>
  );

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
        {buscadas.length ? `${visibles.length} resultado${visibles.length === 1 ? "" : "s"} en este local` : `${items.length} productos en este local`}
      </p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/30 p-8 text-center text-sm">Este comercio todavía no cargó productos.</div>
      ) : visibles.length ? (
        <>
          {aprox.length ? (
            <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
              No encontramos “{q.trim()}” tal cual.{" "}
              {corregida ? (
                <>
                  Te mostramos resultados de{" "}
                  <button type="button" onClick={() => cambiar(corregida)} className="font-bold text-naranja-vivo underline">
                    “{corregida}”
                  </button>
                  .
                </>
              ) : (
                "Te mostramos lo más parecido."
              )}
            </p>
          ) : null}
          {grilla(visibles, buscadas.join(" "))}
        </>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-dashed border-white/30 p-5 text-center text-sm">
            <p>
              <b>“{q.trim()}”</b> no está en {comercio}.
            </p>
            <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2">
              <Link href={`/?q=${encodeURIComponent(q.trim())}`} className="font-semibold text-naranja-vivo underline">
                Buscarlo en otros comercios cerca
              </Link>
              <button type="button" onClick={() => cambiar("")} className="underline">
                Ver todo el catálogo
              </button>
            </p>
          </div>
          <h2 className="titulo-seccion mt-6">Otros productos de {comercio}</h2>
          {grilla(otros, `otros-${buscadas.join(" ")}`)}
        </>
      )}
    </>
  );
}
