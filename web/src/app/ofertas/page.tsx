import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TarjetaOferta } from "@/components/tarjeta-oferta";
import { ofertasVigentes } from "@/lib/ofertas";
import { supabasePublico } from "@/lib/supabase/publico";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Las ofertas que lanzan los comercios de tu barrio en VeciRed. Reservá y retirá en el local.",
  alternates: { canonical: "/ofertas" },
};

export default function PaginaOfertas() {
  return (
    <div className="space-y-4">
      <h1 className="titulo-seccion text-2xl text-marino">🔥 Ofertas de tu barrio</h1>
      <p className="text-sm text-marino/80">Lo que lanzan los comercios cercanos. Reservalo al precio de oferta y retiralo en el local.</p>
      <Suspense fallback={<div className="tarjeta h-40 animate-pulse rounded-3xl" />}>
        <Lista />
      </Suspense>
    </div>
  );
}

async function Lista() {
  const ofertas = await ofertasVigentes(supabasePublico(), { limite: 60 });
  if (!ofertas.length) {
    return (
      <div className="tarjeta rounded-3xl p-8 text-center text-sm">
        Por ahora no hay ofertas vigentes. Volvé en unos días o{" "}
        <Link href="/" className="underline">
          buscá lo que necesitás
        </Link>
        .
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ofertas.map((o) => (
        <TarjetaOferta key={o.id} o={o} className="h-40" />
      ))}
    </div>
  );
}
