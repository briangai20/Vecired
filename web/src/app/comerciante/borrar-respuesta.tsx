"use client";

import { useState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";

// Borrar la respuesta a una reseña o pregunta: antes avisa que después no se
// puede volver a responder.
export function BorrarRespuesta({
  accion,
  campo,
  id,
  que,
}: {
  accion: (d: FormData) => Promise<void>;
  campo: "resena" | "pregunta";
  id: number;
  que: "reseña" | "pregunta";
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/60 hover:bg-white/10"
      >
        Borrar respuesta
      </button>
      {abierto ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" onClick={() => setAbierto(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`borrar-${campo}-${id}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-marino shadow-2xl"
          >
            <p id={`borrar-${campo}-${id}`} className="text-lg font-bold">
              ¿Borrar tu respuesta?
            </p>
            <p className="mt-2 text-sm text-marino/80">
              Si la borrás, <b>no vas a poder volver a responder esta {que}</b>. Va a quedar sin respuesta para siempre.
            </p>
            <form action={accion} className="mt-5 flex flex-wrap justify-end gap-2">
              <input type="hidden" name={campo} value={id} />
              <input type="hidden" name="respuesta" value="" />
              <button type="button" onClick={() => setAbierto(false)} className="rounded-xl border border-marino/25 px-4 py-2 text-sm font-medium hover:bg-marino/5">
                No, dejarla
              </button>
              <BotonEnviar enviando="Borrando…" className="rounded-xl bg-[#c92a2a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a61e1e]">
                Sí, borrar
              </BotonEnviar>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
