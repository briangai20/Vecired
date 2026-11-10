"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Botón "Instalar VeciRed en el celular". En Android y en la compu usa el
// aviso del navegador; en iPhone (que no lo tiene) explica cómo hacerlo.
// Si ya está instalada, no se muestra.
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [esIphone, setEsIphone] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    const instalada = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone);
    if (instalada) return;
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", guardar);
    const t = setTimeout(() => setEsIphone(/iphone|ipad|ipod/i.test(navigator.userAgent)), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", guardar);
    };
  }, []);

  if (!evento && !esIphone) return null;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={async () => {
          if (!evento) return setAyuda((a) => !a);
          await evento.prompt();
          await evento.userChoice;
          setEvento(null);
        }}
        className="flex items-center gap-2 rounded-xl border border-white/40 px-3 py-2 hover:bg-white/10"
      >
        <span aria-hidden>📲</span> Instalar VeciRed en el celular
      </button>
      {ayuda ? (
        <p className="mt-2 max-w-xs text-xs text-white/80">
          En el iPhone: tocá el botón Compartir <span aria-hidden>(⬆️)</span> de Safari y elegí “Agregar a inicio”. Queda el ícono de VeciRed como una app.
        </p>
      ) : null}
    </div>
  );
}
