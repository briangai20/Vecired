"use client";

import Link from "next/link";
import { useState } from "react";
import { agregarAlCarrito, type ItemCarrito } from "@/lib/carrito";

// "Agregar al carrito": junta productos del mismo comercio para reservarlos
// juntos y retirarlos con un solo código.
export function AgregarCarrito({ comercio, item }: { comercio: { id: number; nombre: string }; item: Omit<ItemCarrito, "cantidad"> }) {
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  return (
    <div className="mt-3 flex gap-2">
      <select
        value={cantidad}
        onChange={(e) => setCantidad(Number(e.target.value))}
        aria-label="Cantidad para el carrito"
        className="campo w-20 shrink-0"
      >
        {Array.from({ length: item.maximo }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      {agregado ? (
        <Link href="/carrito" className="flex-1 rounded-xl border border-naranja-vivo bg-naranja/20 px-4 py-3 text-center text-sm font-semibold">
          ✓ Agregado · Ver carrito
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            agregarAlCarrito(comercio, { ...item, cantidad });
            setAgregado(true);
          }}
          className="flex-1 rounded-xl border border-white/40 px-4 py-3 text-sm font-semibold transition hover:bg-white/10"
        >
          🛒 Agregar al carrito
        </button>
      )}
    </div>
  );
}
