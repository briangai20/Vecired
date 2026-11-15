"use client";

import { Children, useState, type ReactNode } from "react";

// Muestra los primeros elementos y un botón "Ver más" para ir cargando el
// resto, así una lista larga no obliga a leer (ni a bajar) todo de una.
// En el celular arranca con menos ("deACelular") porque la pantalla es chica.
export function ListaConMas({
  children,
  deA = 12,
  deACelular,
  className,
}: {
  children: ReactNode;
  deA?: number;
  /** Cuántos se ven al principio en el celular (si no, los mismos que en la compu). */
  deACelular?: number;
  className?: string;
  /** Qué se lista, en plural (ya no se muestra; queda por compatibilidad). */
  que?: string;
}) {
  const todos = Children.toArray(children);
  const [visibles, setVisibles] = useState(deA);
  const [abiertoCelular, setAbiertoCelular] = useState(!deACelular);
  const faltan = todos.length - visibles;
  const recortaCelular = !abiertoCelular && deACelular != null && todos.length > deACelular;

  return (
    <>
      <div className={className}>
        {deACelular == null
          ? todos.slice(0, visibles)
          : todos.slice(0, visibles).map((hijo, i) => (
              // "contents": el envoltorio no cambia la grilla; en el celular se ocultan los de más.
              <div key={i} className={recortaCelular && i >= deACelular ? "contents max-sm:hidden" : "contents"}>
                {hijo}
              </div>
            ))}
      </div>
      {recortaCelular ? (
        <div className="mt-4 flex justify-center sm:hidden">
          <button type="button" onClick={() => setAbiertoCelular(true)} className="boton rounded-xl px-6 py-2.5 text-sm font-semibold">
            Ver más
          </button>
        </div>
      ) : null}
      {faltan > 0 ? (
        <div className={`mt-4 flex-col items-center gap-2 ${recortaCelular ? "hidden sm:flex" : "flex"}`}>
          <span className="text-xs opacity-70">
            Estás viendo {visibles} de {todos.length}
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {faltan > deA ? (
              <button
                type="button"
                onClick={() => setVisibles((v) => v + deA)}
                className="rounded-xl border border-current/40 px-5 py-2.5 text-sm font-semibold hover:bg-current/10"
              >
                Ver más
              </button>
            ) : null}
            <button type="button" onClick={() => setVisibles(todos.length)} className="boton rounded-xl px-5 py-2.5 text-sm font-semibold">
              {faltan > deA ? "Ver todos" : "Ver más"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
