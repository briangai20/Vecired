"use client";

import { startTransition, useActionState, useState } from "react";
import { plata } from "@/lib/formato";
import { mejorPromo, nombrePromo, type PromoOferta } from "@/lib/promos";
import { reservar, type EstadoReserva } from "@/app/reservas/acciones";
import { useListo } from "@/components/use-listo";

type Props = {
  productoId: number;
  maximo: number;
  franjas: string[];
  textoBoton: string;
  precio: number | null;
  /** Promos vigentes del producto (4x3, % en la 2da…), para mostrar el total. */
  promos?: PromoOferta[];
};

export function FormReserva({ productoId, maximo, franjas, textoBoton, precio, promos = [] }: Props) {
  const [estado, accion, enviando] = useActionState<EstadoReserva, FormData>(reservar, {});
  const listo = useListo();
  const [cantidad, setCantidad] = useState(1);
  // Mismo cálculo que hace la base al reservar.
  const promo = precio == null ? null : mejorPromo(promos, precio, cantidad);
  const total = precio == null ? null : precio * cantidad - (promo?.descuento ?? 0);

  return (
    <form
      // Se envía a mano para que, si hay un error, no se borre lo elegido.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="mt-5"
    >
      <input type="hidden" name="producto" value={productoId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          Cantidad
          <select name="cantidad" value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className="campo mt-1">
            {Array.from({ length: maximo }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Horario de retiro
          <select name="retiro" className="campo mt-1">
            {franjas.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      {total != null ? (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-xl border-l-4 border-naranja-vivo bg-naranja/15 px-3 py-2">
          <span className="text-sm">
            Total {cantidad > 1 ? `por ${cantidad}` : ""}
            {promo ? <span className="ml-2 rounded-full bg-naranja px-2 py-0.5 text-[11px] font-bold">Promo {nombrePromo(promo.promo)}</span> : null}
          </span>
          <span className="text-right">
            <span className="text-xl font-black">{plata(total)}</span>
            {promo ? <span className="ml-2 text-xs text-white/60 line-through">{plata(precio! * cantidad)}</span> : null}
          </span>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-white/80">
        Pagás en el local al retirar{precio == null ? " (el precio te lo confirma el comercio)" : ""}. El pago online con Mercado Pago llega pronto.
      </p>
      <button disabled={enviando || !listo} className="boton mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold">
        {enviando ? "Reservando…" : textoBoton}
      </button>
      <p role="status" className="mt-2 min-h-5 text-sm text-[#ffb4a2]">
        {estado.error}
      </p>
    </form>
  );
}
