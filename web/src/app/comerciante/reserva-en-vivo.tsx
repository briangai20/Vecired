"use client";

import { createContext, use, useOptimistic, useTransition, type ReactNode } from "react";
import type { Enum } from "@/lib/supabase/tipos";

type Estado = Enum<"estado_reserva">;
type Accion = "aceptar" | "rechazar" | "retirada";

// Las acciones de una reserva (Aceptar, Rechazar, Ya lo retiró) cambian la
// tarjeta en el mismo momento del clic y guardan en el servidor por detrás.
// Si el servidor rechaza el cambio, vuelve al estado real y muestra el error.
const RESULTADO: Record<Accion, Estado> = { aceptar: "aceptada", rechazar: "rechazada", retirada: "retirada" };

const Contexto = createContext<{ estado: Estado; etiquetas: Record<Estado, string>; hacer: (a: Accion) => void } | null>(null);

function useReserva() {
  const c = use(Contexto);
  if (!c) throw new Error("Falta <ReservaEnVivo>");
  return c;
}

export function ReservaEnVivo({
  reserva,
  estado,
  etiquetas,
  accion,
  children,
}: {
  reserva: number;
  estado: Estado;
  etiquetas: Record<Estado, string>;
  accion: (d: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [optimo, cambiar] = useOptimistic(estado);
  const [, empezar] = useTransition();
  const hacer = (a: Accion) =>
    empezar(async () => {
      cambiar(RESULTADO[a]);
      const d = new FormData();
      d.set("reserva", String(reserva));
      d.set("accion", a);
      await accion(d);
    });
  return <Contexto value={{ estado: optimo, etiquetas, hacer }}>{children}</Contexto>;
}

export function EstadoReserva() {
  const { estado, etiquetas } = useReserva();
  return (
    <span className="shrink-0 rounded-full border border-white/40 px-2.5 py-0.5 text-[11px] font-semibold">{etiquetas[estado]}</span>
  );
}

// Muestra su contenido solo mientras la reserva esté en ese estado (por ejemplo,
// "ofrecer otra cosa" desaparece en cuanto se acepta).
export function SiEstado({ es, children }: { es: Estado; children: ReactNode }) {
  return useReserva().estado === es ? children : null;
}

const SECUNDARIO = "flex-1 rounded-xl border border-white/40 py-2 text-sm hover:bg-white/10";

export function BotonesReserva() {
  const { estado, hacer } = useReserva();
  if (estado === "pendiente")
    return (
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => hacer("aceptar")} className="boton flex-1 rounded-xl py-2 text-sm font-semibold">
          Aceptar
        </button>
        <button type="button" onClick={() => hacer("rechazar")} className={SECUNDARIO}>
          Rechazar
        </button>
      </div>
    );
  if (estado === "alternativa")
    return (
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => hacer("rechazar")} className={SECUNDARIO}>
          Rechazar
        </button>
      </div>
    );
  if (estado === "aceptada")
    return (
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => hacer("retirada")} className={`${SECUNDARIO} border-white/60 font-semibold`}>
          Ya lo retiró
        </button>
      </div>
    );
  return null;
}
