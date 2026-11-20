import type { Metadata } from "next";
import { Suspense } from "react";
import { IrAlComercio } from "./ir-al-comercio";

export const metadata: Metadata = { title: "Cómo llegar", robots: { index: false } };

// Se abre al escanear el QR de "Cómo llegar" en la compu: desde el celular se
// elige la app y se inicia el viaje.
export default function PaginaIr() {
  return (
    <Suspense fallback={<div className="tarjeta mx-auto h-72 max-w-sm animate-pulse rounded-3xl" />}>
      <IrAlComercio />
    </Suspense>
  );
}
