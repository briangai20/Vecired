"use client";

import { Children, useState, type ReactNode } from "react";

// Muestra los primeros "deA" elementos y un botón para ir cargando el resto,
// así una lista larga no obliga a leer (ni a bajar) todo de una.
export function ListaConMas({
  children,
  deA = 12,
  className,
  que = "resultados",
}: {
  children: ReactNode;
  deA?: number;
  className?: string;
  /** Qué se lista, en plural: "comercios", "productos". */
  que?: string;
}) {
  const todos = Children.toArray(children);
  const [visibles, setVisibles] = useState(deA);
  const faltan = todos.length - visibles;

  return (
    <>
      <div className={className}>{todos.slice(0, visibles)}</div>
      {faltan > 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="text-xs opacity-70">
            Estás viendo {visibles} de {todos.length} · faltan {faltan}
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {faltan > deA ? (
              <button
                type="button"
                onClick={() => setVisibles((v) => v + deA)}
                className="rounded-xl border border-current/40 px-5 py-2.5 text-sm font-semibold hover:bg-current/10"
              >
                Ver {deA} {que} más
              </button>
            ) : null}
            <button type="button" onClick={() => setVisibles(todos.length)} className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
              Ver todos
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
