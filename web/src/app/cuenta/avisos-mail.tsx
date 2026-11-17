"use client";

import { useState, useTransition } from "react";
import { guardarAvisosMail } from "./acciones";

type Opcion = "importantes" | "ninguno";

// "Avisos por mail: importantes / ninguno". Con "ninguno" se explica por qué
// conviene dejarlos y qué mails se mandan igual (los imprescindibles).
export function AvisosMail({ inicial, comerciante }: { inicial: Opcion; comerciante: boolean }) {
  const [valor, setValor] = useState<Opcion>(inicial);
  const [guardado, setGuardado] = useState("");
  const [guardando, empezar] = useTransition();

  function elegir(v: Opcion) {
    setValor(v);
    setGuardado("");
    empezar(async () => {
      const r = await guardarAvisosMail(v);
      setGuardado(r.error ?? "Guardado.");
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-2" role="radiogroup" aria-label="Avisos por mail">
        {(
          [
            ["importantes", "Importantes"],
            ["ninguno", "Ninguno"],
          ] as const
        ).map(([v, texto]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="avisos_mail" checked={valor === v} onChange={() => elegir(v)} disabled={guardando} />
            <span className={valor === v ? "font-semibold text-naranja-vivo" : ""}>{texto}</span>
          </label>
        ))}
        <span role="status" className="text-xs text-white/70">
          {guardando ? "Guardando…" : guardado}
        </span>
      </div>
      {valor === "importantes" ? (
        <p className="text-xs text-white/75">
          Te mandamos un mail cuando {comerciante ? "te hacen una reserva, " : ""}confirman, rechazan o te ofrecen otra cosa en tu reserva, con tu código de
          retiro, y el comprobante cuando retirás.
        </p>
      ) : (
        <div className="info text-xs">
          <p className="font-semibold">Te recomendamos dejarlos en “Importantes”.</p>
          <p className="mt-1">
            Así te enterás a tiempo de lo que pasa con tus reservas aunque no tengas VeciRed abierta. Igual te vamos a mandar los mails imprescindibles:
            tu código de retiro{comerciante ? ", cada reserva nueva de tu comercio" : ""} y el aviso si alguien marca tu reserva como retirada sin tu código.
          </p>
        </div>
      )}
    </div>
  );
}
