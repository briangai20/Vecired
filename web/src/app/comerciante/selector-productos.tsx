"use client";

import { useState } from "react";
import { coincideAprox, coincideExacto, palabrasBuscadas, palabrasDe } from "@/lib/busqueda";
import { plata } from "@/lib/formato";

type Producto = { id: number; nombre: string; precio: number | null; marca?: string | null; codigo?: string | null };

// Lista de productos con casillas y un buscador, para elegir los de una
// oferta libre ("2x1"). Manda los elegidos como varios campos "productos".
export function SelectorProductos({
  productos,
  elegidos = [],
  maximo = 20,
  titulo = "Productos de la oferta",
}: {
  productos: Producto[];
  elegidos?: number[];
  maximo?: number;
  titulo?: string;
}) {
  const [buscar, setBuscar] = useState("");
  const [marcados, setMarcados] = useState<number[]>(elegidos);
  // Busca por nombre, marca o código; si no hay nada tal cual, lo parecido ("martiyo" → "Martillo").
  const buscadas = palabrasBuscadas(buscar);
  const texto = (p: Producto) => [p.nombre, p.marca, p.codigo].filter(Boolean).join(" ");
  const exactos = productos.filter((p) => coincideExacto(texto(p), buscadas));
  const aprox = buscadas.length > 0 && !exactos.some((p) => !marcados.includes(p.id));
  const coinciden = aprox ? productos.filter((p) => coincideAprox(palabrasDe(texto(p)), buscadas)) : exactos;
  const visibles = productos.filter((p) => marcados.includes(p.id) || !buscadas.length || coinciden.includes(p)).slice(0, 80);

  return (
    <div className="text-xs">
      <p>
        {titulo} <span className="text-white/60">({marcados.length} de {maximo} como máximo)</span>
      </p>
      <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Escribí el nombre, la marca o el código…" className="campo mt-1" />
      <ul className="mt-2 max-h-56 divide-y divide-white/10 overflow-y-auto">
        {visibles.map((p) => {
          const marcado = marcados.includes(p.id);
          return (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 py-2">
                <input
                  type="checkbox"
                  name="productos"
                  value={p.id}
                  checked={marcado}
                  disabled={!marcado && marcados.length >= maximo}
                  onChange={() => setMarcados((m) => (marcado ? m.filter((x) => x !== p.id) : [...m, p.id]))}
                />
                <span className="min-w-0 flex-1 break-words">{p.nombre}</span>
                <span className="shrink-0 text-white/60">{plata(p.precio)}</span>
              </label>
            </li>
          );
        })}
        {!visibles.length ? <li className="py-2 text-white/60">No encontramos “{buscar.trim()}” entre tus productos.</li> : null}
      </ul>
    </div>
  );
}
