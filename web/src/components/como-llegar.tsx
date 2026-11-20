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

// Las tres apps para elegir. En el celular abre la app directo (con respaldo
// web); en la compu, la página del mapa en otra pestaña.
export function OpcionesMapa({ destino, alElegir }: { destino: Destino; alElegir?: () => void }) {
  const celular = window.matchMedia("(pointer: coarse)").matches;
  const desde = ubicacionDelNavegador();
  const sistema = sistemaDelCelular();
  return (
    <ul className="space-y-2">
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
              alElegir?.();
            }}
            className="flex items-center gap-3 rounded-2xl border border-marino/15 px-4 py-3 transition hover:border-naranja hover:bg-naranja/10 active:bg-naranja/20"
          >
            {a.icono}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{a.nombre}</span>
              <span className="block text-xs text-marino/70">{celular ? a.detalle : "Ver el recorrido en la compu"}</span>
            </span>
            <span aria-hidden className="text-marino/50">›</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// En la compu: QR para seguir en el celular, donde sí se puede iniciar el viaje.
function QrCelular({ destino }: { destino: Destino }) {
  const [imagen, setImagen] = useState("");
  useEffect(() => {
    let vigente = true;
    const url = `${window.location.origin}/ir?destino=${destino.lat},${destino.lng}`;
    void import("qrcode")
      .then((q) => q.toDataURL(url, { margin: 1, width: 360, color: { dark: "#14213d", light: "#ffffff" } }))
      .then((d) => vigente && setImagen(d));
    return () => {
      vigente = false;
    };
  }, [destino.lat, destino.lng]);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-naranja/10 p-3">
      <div className="h-28 w-28 shrink-0 rounded-xl bg-white p-1">
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt="Código QR para abrir el recorrido en el celular" className="h-full w-full" />
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-marino/10" />
        )}
      </div>
      <div className="text-xs">
        <p className="text-sm font-bold">📱 Para iniciar el viaje</p>
        <p className="mt-1 text-marino/80">
          Escaneá el código con la cámara del celular y elegí la app: ahí te guía paso a paso. En la compu los mapas solo muestran el recorrido.
        </p>
      </div>
    </div>
  );
}

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
  const celular = window.matchMedia("(pointer: coarse)").matches;

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
            {celular ? "¿Con qué app querés ir?" : "Cómo llegar"}
          </h2>
          <button type="button" onClick={() => setDestino(null)} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-full text-marino/70 hover:bg-marino/10">
            ✕
          </button>
        </div>
        {celular ? null : (
          <div className="mt-3">
            <QrCelular destino={destino} />
          </div>
        )}
        <div className="mt-3">
          <OpcionesMapa destino={destino} alElegir={() => setDestino(null)} />
        </div>
        {celular ? (
          <p className="mt-3 text-[11px] text-marino/65">Se abre la app. Si te pregunta “¿Abrir en…?”, tocá Abrir. Si no la tenés instalada, se abre en el navegador.</p>
        ) : null}
      </div>
    </div>
  );
}
