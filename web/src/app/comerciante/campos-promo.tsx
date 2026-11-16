"use client";

import { useState } from "react";

export type Promo = { promo: "nxm" | "segunda" | "porcentaje" | null; lleva: number | null; paga: number | null; porcentaje: number | null };

// Tipo de promo de una oferta libre, con números para que la reserva la
// respete: "Llevá 4, pagá 3", "50% en la 2da unidad" o "20% de descuento".
export function CamposPromo({ inicial }: { inicial?: Promo }) {
  const [tipo, setTipo] = useState<string>(inicial?.promo ?? "");
  return (
    <div className="space-y-2 text-xs">
      <label className="block">
        Tipo de promo (para que la reserva cobre bien)
        <select name="promo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo mt-1">
          <option value="">Solo aviso (el comercio aplica la promo al retirar)</option>
          <option value="nxm">Llevá X, pagá Y (2x1, 3x2, 4x3…)</option>
          <option value="segunda">% de descuento en la 2da unidad</option>
          <option value="porcentaje">% de descuento</option>
        </select>
      </label>
      {tipo === "nxm" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            Llevá
            <input name="lleva" type="number" min={2} max={10} required defaultValue={inicial?.lleva ?? 2} className="campo mt-1 w-24" />
          </label>
          <label className="block">
            Pagá
            <input name="paga" type="number" min={1} max={9} required defaultValue={inicial?.paga ?? 1} className="campo mt-1 w-24" />
          </label>
        </div>
      ) : tipo ? (
        <label className="block">
          Porcentaje de descuento
          <input name="porcentaje" type="number" min={1} max={90} required defaultValue={inicial?.porcentaje ?? (tipo === "segunda" ? 50 : 20)} className="campo mt-1 w-28" />
        </label>
      ) : null}
    </div>
  );
}
