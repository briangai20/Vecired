"use client";

import { createContext, use, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { confirmarRetiro, entregarSinCodigo } from "./acciones";
import type { Enum } from "@/lib/supabase/tipos";

type Estado = Enum<"estado_reserva">;
type Accion = "aceptar" | "rechazar";

// Las acciones de una reserva (Aceptar, Rechazar) cambian la
// tarjeta en el mismo momento del clic y guardan en el servidor por detrás.
// Si el servidor rechaza el cambio, vuelve al estado real y muestra el error.
const RESULTADO: Record<Accion, Estado> = { aceptar: "aceptada", rechazar: "rechazada" };

const Contexto = createContext<{ reserva: number; pagoLocal: boolean; estado: Estado; etiquetas: Record<Estado, string>; hacer: (a: Accion) => void } | null>(null);

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
  pagoLocal = true,
  children,
}: {
  reserva: number;
  /** Con pago en el local se puede "Entregar sin código". */
  pagoLocal?: boolean;
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
  return <Contexto value={{ reserva, pagoLocal, estado: optimo, etiquetas, hacer }}>{children}</Contexto>;
}

export function EstadoReserva() {
  const { estado, etiquetas } = useReserva();
  return (
    <span className="chip-estado shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">{etiquetas[estado]}</span>
  );
}

// Muestra su contenido solo mientras la reserva esté en ese estado (por ejemplo,
// "ofrecer otra cosa" desaparece en cuanto se acepta).
export function SiEstado({ es, children }: { es: Estado; children: ReactNode }) {
  return useReserva().estado === es ? children : null;
}

const SECUNDARIO = "flex-1 rounded-xl border border-white/40 py-2 text-sm hover:bg-white/10";

/** conRetiro: false cuando el código se carga una sola vez para todo el pedido. */
export function BotonesReserva({ conRetiro = true }: { conRetiro?: boolean } = {}) {
  const { estado, hacer, reserva, pagoLocal } = useReserva();
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
  if (estado === "aceptada") return conRetiro ? <ConfirmarRetiro reserva={reserva} pagoLocal={pagoLocal} /> : null;
  return null;
}

const MOTIVOS_SIN_CODIGO = ["El cliente no tenía el código a mano", "Al cliente no le andaba el celular", "Otro"];

// "Confirmar retiro": el comercio carga el código de 4 números que le muestra
// el cliente. Si el cliente no lo tiene, "Entregar sin código" con un motivo.
export function ConfirmarRetiro({ reserva, pagoLocal }: { reserva: number; pagoLocal: boolean }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [sinCodigo, setSinCodigo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [otro, setOtro] = useState("");
  const [enviando, empezar] = useTransition();

  const confirmar = () =>
    empezar(async () => {
      setError("");
      const r = await confirmarRetiro(reserva, codigo);
      if (r.error) setError(r.error);
    });
  const entregar = () =>
    empezar(async () => {
      setError("");
      const r = await entregarSinCodigo(reserva, motivo === "Otro" ? otro : motivo);
      if (r.error) setError(r.error);
    });

  return (
    <div className="mt-3 space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
        className="flex gap-2"
      >
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Código del cliente"
          aria-label="Código de retiro del cliente (4 números)"
          className="campo min-w-0 flex-1 text-center text-lg font-bold tracking-[0.4em]"
        />
        <button type="submit" disabled={codigo.length !== 4 || enviando} className="boton shrink-0 rounded-xl px-4 text-sm font-semibold">
          {enviando && !sinCodigo ? "Confirmando…" : "Confirmar retiro"}
        </button>
      </form>
      {pagoLocal ? (
        <div className="text-xs">
          <button type="button" onClick={() => setSinCodigo((v) => !v)} className="text-white/75 hover:text-naranja-vivo active:text-naranja-vivo">
            {sinCodigo ? "Cancelar" : "¿El cliente no tiene el código? Entregar sin código"}
          </button>
          {sinCodigo ? (
            <div className="info mt-2 space-y-2">
              <p>Queda registrado y al cliente le llega un aviso para confirmar que fue él.</p>
              {MOTIVOS_SIN_CODIGO.map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input type="radio" name={`motivo-${reserva}`} checked={motivo === m} onChange={() => setMotivo(m)} />
                  {m}
                </label>
              ))}
              {motivo === "Otro" ? (
                <input value={otro} onChange={(e) => setOtro(e.target.value)} maxLength={300} placeholder="Contanos qué pasó" className="campo" />
              ) : null}
              <button
                type="button"
                onClick={entregar}
                disabled={!motivo || (motivo === "Otro" && otro.trim().length < 5) || enviando}
                className="rounded-xl border border-white/40 px-4 py-2 font-semibold hover:bg-white/10"
              >
                {enviando ? "Registrando…" : "Entregar sin código"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-[#ffb4a2]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
