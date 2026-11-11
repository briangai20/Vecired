"use client";

import { startTransition, useActionState } from "react";
import { preguntar, type EstadoPregunta } from "./acciones";
import { useListo } from "@/components/use-listo";

export function FormPregunta({ productoId }: { productoId: number }) {
  const [estado, accion, enviando] = useActionState<EstadoPregunta, FormData>(preguntar, {});
  const listo = useListo();

  return (
    <form
      // Se envía a mano para que, si hay un error, no se borre lo escrito.
      // Si salió bien, la clave cambia y el formulario vuelve a quedar vacío.
      key={estado.ok ?? "nuevo"}
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="mt-3"
    >
      <input type="hidden" name="producto" value={productoId} />
      <label className="block text-xs text-white/80" htmlFor={`pregunta-${productoId}`}>
        Preguntale al comercio
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <textarea
          id={`pregunta-${productoId}`}
          name="texto"
          rows={2}
          minLength={3}
          maxLength={500}
          required
          placeholder="Ej.: ¿Lo tienen en otro color? ¿Hasta qué hora puedo retirar?"
          className="campo min-h-12 flex-1"
        />
        <button type="submit" disabled={!listo || enviando} className="boton shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold sm:self-start">
          {enviando ? "Enviando…" : "Preguntar"}
        </button>
      </div>
      {estado.error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-naranja-vivo">
          {estado.error}
        </p>
      ) : estado.ok ? (
        <p role="status" className="mt-2 text-xs text-white/85">
          ¡Listo! Le avisamos al comercio. Cuando responda, te llega un aviso.
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-white/60">Tu pregunta y la respuesta se ven en esta página. No mostramos tu nombre.</p>
    </form>
  );
}
