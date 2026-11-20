"use client";

import { useId, useMemo, useState } from "react";
import { coincideAprox, coincideExacto, palabrasBuscadas, palabrasDe, parecido } from "@/lib/busqueda";

export type OpcionProducto = { id: number; nombre: string; codigo?: string | null; marca?: string | null; foto_url?: string | null };

// Campo para elegir un producto escribiendo su nombre, marca o código (con
// corrector: "martiyo" encuentra "Martillo"), en lugar de buscarlo en una
// lista larga.
export function ElegirProducto({
  productos,
  valor,
  alElegir,
  disabled = false,
}: {
  productos: OpcionProducto[];
  valor: number | null;
  alElegir: (id: number | null) => void;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);
  const lista = useId();
  const elegido = productos.find((p) => p.id === valor);

  const indice = useMemo(
    () => productos.map((p) => ({ p, texto: [p.nombre, p.marca, p.codigo].filter(Boolean).join(" ") })).map((x) => ({ ...x, palabras: palabrasDe(x.texto) })),
    [productos],
  );
  const buscadas = palabrasBuscadas(texto);
  const opciones = (() => {
    if (!buscadas.length) return indice.slice(0, 8).map((x) => x.p);
    const exactos = indice.filter((x) => coincideExacto(x.texto, buscadas));
    const lista = exactos.length ? exactos : indice.filter((x) => coincideAprox(x.palabras, buscadas));
    // Si no hay nada parecido del todo, lo que más se acerca.
    const final = lista.length ? lista : indice.filter((x) => parecido(x.palabras, buscadas) > 0);
    return final.slice(0, 8).map((x) => x.p);
  })();

  function elegir(id: number | null) {
    alElegir(id);
    setTexto("");
    setAbierto(false);
  }

  if (elegido && !abierto) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAbierto(true)}
          className="campo flex-1 truncate py-1.5 text-left text-xs"
          title="Cambiar el producto"
        >
          {elegido.nombre}
          {elegido.codigo ? ` · ${elegido.codigo}` : ""}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => elegir(null)}
          aria-label="Sacar el producto elegido"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-1">
      <input
        type="text"
        value={texto}
        disabled={disabled}
        autoFocus={abierto}
        onChange={(e) => {
          setTexto(e.target.value);
          setActiva(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiva((a) => Math.min(a + 1, opciones.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiva((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && opciones[activa]) {
            e.preventDefault();
            elegir(opciones[activa].id);
          } else if (e.key === "Escape") setAbierto(false);
        }}
        placeholder="Escribí el nombre, la marca o el código…"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={lista}
        aria-autocomplete="list"
        autoComplete="off"
        data-buscar
        className="campo py-1.5 text-xs"
      />
      {abierto ? (
        <ul id={lista} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-marino/15 bg-white py-1 text-xs text-marino shadow-xl">
          {opciones.length ? (
            opciones.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === activa}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(p.id)}
                onMouseEnter={() => setActiva(i)}
                className={`cursor-pointer px-3 py-2 ${i === activa ? "bg-crema" : ""}`}
              >
                <span className="font-semibold">{p.nombre}</span>
                {p.codigo ? <span className="text-marino/60"> · {p.codigo}</span> : null}
                {p.foto_url ? <span className="text-marino/60"> (ya tiene foto)</span> : null}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-marino/60">No encontramos “{texto.trim()}” en tus productos.</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
