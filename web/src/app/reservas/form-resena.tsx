"use client";

import { Fragment, startTransition, useActionState, useEffect, useState } from "react";
import { dejarResena, type EstadoResena } from "./acciones";

// Formulario de reseña. Si el texto tiene algo que no se puede publicar
// (teléfonos, mails, links, direcciones, insultos), aparece un cartel que lo
// explica y la reseña queda escrita para corregirla.
export function FormResena({ reserva }: { reserva: number }) {
  const [estado, accion, enviando] = useActionState<EstadoResena, FormData>(dejarResena, {});
  const [cartel, setCartel] = useState<string | null>(null);
  const [visto, setVisto] = useState<EstadoResena>(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.error) setCartel(estado.error);
  }

  // Escape cierra el cartel.
  useEffect(() => {
    if (!cartel) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setCartel(null);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [cartel]);

  return (
    <>
      <form
        // Se envía a mano para que, si hay un error, no se borre lo escrito.
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          startTransition(() => accion(datos));
        }}
        className="mt-4 space-y-2 rounded-xl border border-white/25 p-3"
      >
        <input type="hidden" name="reserva" value={reserva} />
        <p className="text-sm font-semibold">¿Cómo te atendieron?</p>
        <fieldset className="calificar" aria-label="Calificación de 1 a 5 estrellas">
          {/* Van de 5 a 1: la hoja de estilos las da vuelta y pinta la elegida y las anteriores. */}
          {[5, 4, 3, 2, 1].map((n) => (
            <Fragment key={n}>
              <input type="radio" id={`e${reserva}-${n}`} name="estrellas" value={n} required />
              <label htmlFor={`e${reserva}-${n}`} title={`${n} ${n === 1 ? "estrella" : "estrellas"}`}>
                ★<span className="sr-only">{n} {n === 1 ? "estrella" : "estrellas"}</span>
              </label>
            </Fragment>
          ))}
        </fieldset>
        <textarea name="texto" rows={2} maxLength={1000} placeholder="Contá tu experiencia (opcional)" className="campo" />
        <button disabled={enviando} className="boton rounded-lg px-4 py-2 text-sm font-semibold">
          {enviando ? "Publicando…" : "Publicar reseña"}
        </button>
      </form>

      {cartel ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setCartel(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`cartel-resena-${reserva}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-marino shadow-2xl"
          >
            <p id={`cartel-resena-${reserva}`} className="text-lg font-bold">
              ⚠️ No publicamos tu reseña
            </p>
            <p className="mt-2 text-sm">{cartel}</p>
            <p className="mt-2 text-sm text-marino/75">
              Por seguridad, en las reseñas no se pueden poner teléfonos, mails, links, direcciones ni otros datos personales, ni palabras ofensivas. Sacalo
              del texto y volvé a publicarla: lo que escribiste quedó guardado.
            </p>
            <button type="button" autoFocus onClick={() => setCartel(null)} className="boton mt-4 w-full rounded-xl py-2.5 text-sm font-semibold">
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
