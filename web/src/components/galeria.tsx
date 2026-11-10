"use client";

import Image from "next/image";
import { useState } from "react";
import { FotoProducto } from "./foto-producto";

// Fotos del producto: la grande y, si hay más de una, miniaturas para elegir
// (como en Mercado Libre). En el celular también se pasa con las flechas.
export function Galeria({ fotos, nombre }: { fotos: string[]; nombre: string }) {
  const [actual, setActual] = useState(0);
  const total = fotos.length;
  const mover = (paso: number) => setActual((i) => (i + paso + total) % total);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/20 bg-marino">
        <FotoProducto url={fotos[actual] ?? null} nombre={nombre} sizes="(min-width: 768px) 50vw, 100vw" texto="text-7xl" />
        {total > 1 ? (
          <>
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Foto anterior"
              className="absolute top-1/2 left-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-marino/80 text-white hover:bg-marino"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Foto siguiente"
              className="absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-marino/80 text-white hover:bg-marino"
            >
              ›
            </button>
            <span className="absolute right-2 bottom-2 rounded-full bg-marino/80 px-2 py-0.5 text-[11px]">
              {actual + 1} / {total}
            </span>
          </>
        ) : null}
      </div>
      {total > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {fotos.map((f, i) => (
            <button
              key={f}
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === actual}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${i === actual ? "border-white" : "border-white/20 opacity-70 hover:opacity-100"}`}
            >
              <Image src={f} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
