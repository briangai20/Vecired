"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CENTROS, ZONA_INICIAL } from "@/lib/zonas";
import { CampoUbicacion } from "./campo-ubicacion";

type Zona = { id: string; nombre: string };

export type ValoresFiltro = {
  q: string;
  zona: string;
  radio: number;
  lat?: number;
  lng?: number;
  /** Nombre del lugar elegido en el buscador (sin él, las coordenadas son "mi ubicación"). */
  lugar?: string;
};

// Arma la dirección con la ubicación y el radio nuevos, sin perder lo demás
// que ya estaba elegido (lo buscado, el orden, "abierto ahora"...).
function armarUrl(v: ValoresFiltro, actuales: URLSearchParams) {
  const p = new URLSearchParams(actuales.toString());
  for (const k of ["zona", "lat", "lng", "lugar", "radio", "comercio"]) p.delete(k);
  if (v.lat != null && v.lng != null) {
    p.set("lat", v.lat.toFixed(5));
    p.set("lng", v.lng.toFixed(5));
    if (v.lugar) p.set("lugar", v.lugar);
  } else {
    p.set("zona", v.zona);
  }
  p.set("radio", String(v.radio));
  return "/?" + p.toString();
}

export function Filtros({ zonas, inicial }: { zonas: Zona[]; inicial: ValoresFiltro }) {
  const router = useRouter();
  const params = useSearchParams();
  // En el celular arrancan plegados (una línea con la zona y el radio).
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [v, setV] = useState(inicial);
  const [aviso, setAviso] = useState("");

  function ir(nuevo: ValoresFiltro) {
    startTransition(() => router.replace(armarUrl(nuevo, params), { scroll: false }));
  }

  function cambiar(parcial: Partial<ValoresFiltro>, navegar = true) {
    const nuevo = { ...v, ...parcial };
    setV(nuevo);
    if (navegar) ir(nuevo);
  }

  function usarUbicacion() {
    if (!navigator.geolocation) {
      setAviso("Tu navegador no permite compartir la ubicación.");
      return;
    }
    setAviso("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAviso("");
        cambiar({ lat: pos.coords.latitude, lng: pos.coords.longitude, lugar: undefined });
      },
      () => setAviso("No pudimos acceder a tu ubicación. Elegí una zona."),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const conUbicacion = v.lat != null && v.lng != null;
  const etiqueta = conUbicacion
    ? v.lugar || "Mi ubicación actual"
    : (zonas.find((z) => z.id === v.zona)?.nombre ?? "");
  const cerca = conUbicacion ? { lat: v.lat!, lng: v.lng! } : (CENTROS[v.zona] ?? CENTROS[ZONA_INICIAL]);

  return (
    <div className="tarjeta rounded-3xl p-4 lg:p-5" aria-busy={pendiente}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 text-left text-sm lg:hidden"
      >
        <span className="min-w-0">
          <span aria-hidden>📍 </span>
          <span className="font-semibold">{etiqueta || "Elegí tu zona"}</span>
          <span className="text-white/75"> · a {v.radio} km</span>
        </span>
        <span className="shrink-0 rounded-lg border border-white/40 px-3 py-1 text-xs">{abierto ? "Listo" : "Cambiar"}</span>
      </button>
      <div className={`${abierto ? "mt-4 block" : "hidden"} lg:mt-0 lg:block`}>
      <h2 className="hidden text-xs font-semibold tracking-wider uppercase lg:block">Dónde buscar</h2>

      <label htmlFor="ubicacion" className="mt-4 block text-xs lg:mt-4">
        Ubicación
      </label>
      <CampoUbicacion
        zonas={zonas}
        etiqueta={etiqueta}
        cerca={cerca}
        onElegir={(e) => {
          setAviso("");
          if (e.tipo === "yo") usarUbicacion();
          else if (e.tipo === "zona") cambiar({ zona: e.zona.id, lat: undefined, lng: undefined, lugar: undefined });
          else cambiar({ lat: e.lugar.lat, lng: e.lugar.lng, lugar: e.lugar.nombre });
        }}
      />
      <p className="mt-2 min-h-5 text-xs text-white/80" role="status">
        {aviso}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <label htmlFor="radio" className="text-xs">
          Radio de búsqueda
        </label>
        <span className="rounded-lg border border-white/25 bg-marino-claro px-2.5 py-1 text-xs font-bold">{v.radio} km</span>
      </div>
      <input
        id="radio"
        type="range"
        min={1}
        max={20}
        value={v.radio}
        onChange={(e) => cambiar({ radio: Number(e.target.value) }, false)}
        onPointerUp={() => ir(v)}
        onKeyUp={() => ir(v)}
        className="mt-2 w-full"
      />
      <div className="mt-1 flex justify-between text-[11px]">
        <span>1 km</span>
        <span>20 km</span>
      </div>
      </div>
    </div>
  );
}
