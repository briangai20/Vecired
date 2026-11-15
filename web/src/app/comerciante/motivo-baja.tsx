"use client";

import { useState } from "react";

export const MOTIVOS_BAJA = ["No me trajo ventas", "Cerré el local", "No tengo tiempo", "Es difícil de usar"] as const;
export const MINIMO_OTRO = 30;

// Motivo de la baja: una opción de la lista o "Otro", con un texto de al
// menos 30 letras (sin máximo).
export function MotivoBaja() {
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const otro = motivo === "Otro";
  const faltan = MINIMO_OTRO - texto.trim().length;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">¿Por qué lo das de baja?</legend>
      {[...MOTIVOS_BAJA, "Otro"].map((m) => (
        <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="radio" name="motivo" value={m} required checked={motivo === m} onChange={() => setMotivo(m)} />
          {m === "Otro" ? "Otro (contanos)" : m}
        </label>
      ))}
      {otro ? (
        <div>
          <textarea
            name="otro"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required
            minLength={MINIMO_OTRO}
            rows={3}
            className="campo mt-1"
            placeholder="Contanos con tus palabras por qué te vas (nos ayuda a mejorar)."
          />
          <p className={`mt-1 text-xs ${faltan > 0 ? "text-white/70" : "text-verde"}`}>
            {faltan > 0 ? `Faltan ${faltan} ${faltan === 1 ? "letra" : "letras"} (mínimo ${MINIMO_OTRO}).` : "¡Gracias!"}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
