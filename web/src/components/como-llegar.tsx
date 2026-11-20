"use client";

import { useEffect, useState, type ReactNode } from "react";
import { enlaceApp, enlaceComoLlegar, enlaceNavegar, sistemaDelCelular, ubicacionDelNavegador, type AppMapa } from "@/lib/ubicacion";

type Destino = { lat: number; lng: number };
const EVENTO = "vecired:como-llegar";

// Abre la app de mapas; si a los 2 segundos seguimos acá (no está instalada),
// abre la versión web.
function abrirApp(app: string, web: string) {
  let salio = false;
  const marcar = () => {
    if (document.visibilityState === "hidden") salio = true;
  };
  document.addEventListener("visibilitychange", marcar);
  window.addEventListener("pagehide", marcar);
  window.location.href = app;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", marcar);
    window.removeEventListener("pagehide", marcar);
    if (!salio && document.visibilityState === "visible") window.location.href = web;
  }, 2000);
}

// Abre el cartel para elegir con qué app ir (sirve también desde código que no
// es React, como los globitos del mapa).
export function abrirComoLlegar(destino: Destino) {
  window.dispatchEvent(new CustomEvent<Destino>(EVENTO, { detail: destino }));
}

// "Cómo llegar": pregunta si abrir Google Maps, Waze o Mapas de Apple.
export function ComoLlegar({ lat, lng, className, children = "Cómo llegar" }: { lat: number; lng: number; className?: string; children?: ReactNode }) {
  return (
    <a
      href={enlaceComoLlegar({ lat, lng })}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        abrirComoLlegar({ lat, lng });
      }}
      className={className}
    >
      {children}
    </a>
  );
}

const APPS: { app: AppMapa; nombre: string; detalle: string; icono: ReactNode }[] = [
  {
    app: "google",
    nombre: "Google Maps",
    detalle: "Recorrido y botón “Iniciar”",
    icono: <span className="text-2xl">🗺️</span>,
  },
  { app: "waze", nombre: "Waze", detalle: "Arranca a guiarte directo", icono: <span className="text-2xl">🚗</span> },
  { app: "apple", nombre: "Mapas de Apple", detalle: "Recorrido y botón “Ir”", icono: <span className="text-2xl">🧭</span> },
];

// Cartel único (va en el layout) que se abre con abrirComoLlegar().
export function ElegirMapa() {
  const [destino, setDestino] = useState<Destino | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => setDestino((e as CustomEvent<Destino>).detail);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  useEffect(() => {
    if (!destino) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setDestino(null);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [destino]);

  if (!destino) return null;
  // Celular o tablet: la app arranca la navegación desde donde estás.
  const celular = window.matchMedia("(pointer: coarse)").matches;
  const desde = ubicacionDelNavegador();
  const sistema = sistemaDelCelular();

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setDestino(null)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-como-llegar"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-marino shadow-2xl sm:pb-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="titulo-como-llegar" className="text-base font-bold">
            ¿Con qué app querés ir?
          </h2>
          <button type="button" onClick={() => setDestino(null)} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-marino/70 hover:bg-marino/10">
            ✕
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {APPS.map((a) => (
            <li key={a.app}>
              <a
                href={enlaceNavegar(a.app, destino, desde, celular)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  const app = enlaceApp(a.app, destino, sistema);
                  if (app) {
                    e.preventDefault();
                    abrirApp(app, enlaceNavegar(a.app, destino, desde, celular));
                  }
                  setDestino(null);
                }}
                className="flex items-center gap-3 rounded-2xl border border-marino/15 px-4 py-3 transition hover:border-naranja hover:bg-naranja/10 active:bg-naranja/20"
              >
                {a.icono}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{a.nombre}</span>
                  <span className="block text-xs text-marino/70">{a.detalle}</span>
                </span>
                <span aria-hidden className="text-marino/50">›</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-marino/65">Se abre la app. Si te pregunta “¿Abrir en…?”, tocá Abrir. Si no la tenés instalada, se abre en el navegador.</p>
      </div>
    </div>
  );
}
