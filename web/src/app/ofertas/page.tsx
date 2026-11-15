import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TarjetaOferta } from "@/components/tarjeta-oferta";
import { ofertasVigentes } from "@/lib/ofertas";
import { cookies } from "next/headers";
import { supabasePublico } from "@/lib/supabase/publico";
import { COOKIE_UBICACION, leerUbicacion } from "@/lib/ubicacion";
import { CENTROS, RADIO_INICIAL, ZONA_INICIAL } from "@/lib/zonas";

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
  // Las de los comercios cercanos a la ubicación guardada (la del GPS o la elegida).
  const u = leerUbicacion((await cookies()).get(COOKIE_UBICACION)?.value);
  const zona = u.zona && CENTROS[u.zona] ? u.zona : ZONA_INICIAL;
  const centro = u.lat != null && u.lng != null ? { lat: u.lat, lng: u.lng } : CENTROS[zona];
  const db = supabasePublico();
  const { data: cerca } = await db.rpc("comercios_cercanos", { p_lat: centro.lat, p_lng: centro.lng, p_radio_km: u.radio ?? RADIO_INICIAL });
  const ofertas = await ofertasVigentes(db, { limite: 60, comercios: (cerca ?? []).map((c) => c.id) });
  if (!ofertas.length) {
    return (
      <div className="tarjeta rounded-3xl p-8 text-center text-sm">
        Por ahora no hay ofertas vigentes cerca de tu ubicación. Volvé en unos días, ampliá el radio de búsqueda o{" "}
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
