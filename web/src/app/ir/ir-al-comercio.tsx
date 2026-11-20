"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { OpcionesMapa } from "@/components/como-llegar";

const nada = () => () => {};

export function IrAlComercio() {
  const [lat, lng] = (useSearchParams().get("destino") ?? "").split(",").map(Number);
  // Las opciones necesitan saber qué celular es: solo en el navegador.
  const enNavegador = useSyncExternalStore(nada, () => true, () => false);
  const valido = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

  return (
    <div className="mx-auto max-w-sm rounded-3xl bg-white p-5 text-marino shadow-xl">
      <h1 className="text-lg font-bold">¿Con qué app querés ir?</h1>
      {valido ? (
        <>
          <p className="mt-1 text-sm text-marino/75">Elegí la app y tocá “Iniciar” (o “Ir”) para que te guíe hasta el comercio.</p>
          <div className="mt-4">{enNavegador ? <OpcionesMapa destino={{ lat, lng }} /> : <div className="h-52 animate-pulse rounded-2xl bg-marino/5" />}</div>
          <p className="mt-3 text-[11px] text-marino/65">Si te pregunta “¿Abrir en…?”, tocá Abrir. Si no tenés la app instalada, se abre en el navegador.</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-marino/80">No encontramos la ubicación del comercio. Volvé a escanear el código.</p>
      )}
      <Link href="/" className="mt-4 inline-block text-xs underline">
        Ir a VeciRed
      </Link>
    </div>
  );
}
