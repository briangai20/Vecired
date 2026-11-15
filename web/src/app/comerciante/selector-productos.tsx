"use client";

import { useState } from "react";
import { plata } from "@/lib/formato";

type Producto = { id: number; nombre: string; precio: number | null };

// Lista de productos con casillas y un buscador, para elegir los de una
// oferta libre ("2x1"). Manda los elegidos como varios campos "productos".
export function SelectorProductos({ productos, elegidos = [], maximo = 20 }: { productos: Producto[]; elegidos?: number[]; maximo?: number }) {
  const [buscar, setBuscar] = useState("");
  const [marcados, setMarcados] = useState<number[]>(elegidos);
  const t = buscar.trim().toLowerCase();
  const visibles = productos.filter((p) => marcados.includes(p.id) || !t || p.nombre.toLowerCase().includes(t)).slice(0, 80);

  return (
    <div className="text-xs">
      <p>
        Productos de la oferta <span className="text-white/60">({marcados.length} de {maximo} como máximo)</span>
      </p>
      <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar en tus productos…" className="campo mt-1" />
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
        {!visibles.length ? <li className="py-2 text-white/60">No hay productos con ese nombre.</li> : null}
      </ul>
    </div>
  );
}
