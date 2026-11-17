"use client";

import { useState, useTransition } from "react";
import { cancelarReprogramada } from "./acciones";

const MOTIVOS = ["Se vendió el producto", "No puedo tenerlo listo en ese horario", "Otro"];

// El cliente cambió el horario de retiro: el comercio puede cancelar la
// reserva contándole por qué (el cliente ve el motivo).
export function CancelarReprogramada({ reserva }: { reserva: number }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [otro, setOtro] = useState("");
  const [error, setError] = useState("");
  const [enviando, empezar] = useTransition();
  const texto = motivo === "Otro" ? otro : motivo;

  return (
    <div className="mt-2 text-xs">
      <button type="button" onClick={() => setAbierto((v) => !v)} className="text-white/80 hover:text-naranja-vivo active:text-naranja-vivo">
        {abierto ? "No cancelar" : "¿No podés en ese horario? Cancelar la reserva"}
      </button>
      {abierto ? (
        <div className="info mt-2 space-y-2">
          <p>El cliente va a ver el motivo. El producto vuelve a tu stock.</p>
          {MOTIVOS.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name={`cancelar-${reserva}`} checked={motivo === m} onChange={() => setMotivo(m)} />
              {m}
            </label>
          ))}
          {motivo === "Otro" ? <input value={otro} onChange={(e) => setOtro(e.target.value)} maxLength={300} placeholder="Contale al cliente qué pasó" className="campo" /> : null}
          <button
            type="button"
            disabled={!motivo || texto.trim().length < 5 || enviando}
            onClick={() =>
              empezar(async () => {
                setError("");
                const r = await cancelarReprogramada(reserva, texto);
                if (r.error) setError(r.error);
              })
            }
            className="rounded-xl border border-[#ff6b6b] px-4 py-2 font-semibold text-[#ffb4b4] hover:bg-[#ff6b6b]/15"
          >
            {enviando ? "Cancelando…" : "Cancelar la reserva"}
          </button>
          {error ? <p className="font-semibold text-[#ffb4a2]">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
